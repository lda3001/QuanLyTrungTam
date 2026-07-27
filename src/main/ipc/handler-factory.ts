import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import { AppError, ok, toIpcError } from '../utils/errors'
import { sessionStore } from '../services/session.store'
import type { IpcChannel } from '@shared/ipc/channels'
import type { Permission } from '@shared/constants/permissions'
import type { IpcResult } from '@shared/types/common'

interface HandlerOptions {
  /** Bỏ qua kiểm tra đăng nhập (chỉ dùng cho login / quên mật khẩu / thông tin app) */
  public?: boolean
  /** Quyền bắt buộc phải có */
  permission?: Permission
}

/**
 * Bọc toàn bộ handler IPC theo một khuôn duy nhất:
 *
 *  1. Chặn request đến từ frame lạ (chống chèn iframe độc hại).
 *  2. Kiểm tra đăng nhập.
 *  3. Kiểm tra quyền — chốt chặn thật sự, không phụ thuộc giao diện.
 *  4. Bắt mọi exception và chuyển thành IpcResult để renderer xử lý êm ái.
 *
 * Nhờ vậy không handler nào có thể "quên" bước bảo mật nào.
 */
export function registerHandler<TArgs extends unknown[], TResult>(
  channel: IpcChannel,
  options: HandlerOptions,
  handler: (...args: TArgs) => TResult | Promise<TResult>
): void {
  ipcMain.handle(channel, async (event: IpcMainInvokeEvent, ...args: unknown[]): Promise<IpcResult<TResult>> => {
    try {
      assertTrustedSender(event)

      if (!options.public && !sessionStore.isAuthenticated()) {
        throw AppError.unauthorized()
      }
      if (options.permission && !sessionStore.has(options.permission)) {
        throw AppError.forbidden()
      }

      const data = await handler(...(args as TArgs))
      return ok(data)
    } catch (err) {
      return toIpcError(err)
    }
  })
}

/** Handler không trả kết quả (điều khiển cửa sổ) — dùng ipcMain.on */
export function registerListener(channel: IpcChannel, handler: (event: IpcMainInvokeEvent) => void): void {
  ipcMain.on(channel, (event) => {
    try {
      assertTrustedSender(event as unknown as IpcMainInvokeEvent)
      handler(event as unknown as IpcMainInvokeEvent)
    } catch (err) {
      console.error(`[ipc] ${channel} lỗi:`, err)
    }
  })
}

/**
 * Chỉ chấp nhận request từ chính trang gốc của ứng dụng.
 * Dev: localhost của Vite. Production: giao thức file://.
 */
function assertTrustedSender(event: IpcMainInvokeEvent): void {
  const url = event.senderFrame?.url ?? ''
  const isDev = !!process.env['ELECTRON_RENDERER_URL']

  const trusted = isDev
    ? url.startsWith(process.env['ELECTRON_RENDERER_URL'] as string) || url.startsWith('file://')
    : url.startsWith('file://')

  if (!trusted) {
    throw AppError.forbidden('Yêu cầu đến từ nguồn không tin cậy.')
  }
}
