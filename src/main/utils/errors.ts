import { ErrorCode } from '@shared/types/common'
import type { IpcResult } from '@shared/types/common'

/**
 * Lỗi nghiệp vụ có mã. Handler IPC bắt lỗi này và chuyển thành IpcResult
 * để renderer hiển thị thông báo tiếng Việt đúng ngữ cảnh.
 */
export class AppError extends Error {
  readonly code: ErrorCode
  readonly details?: unknown

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.details = details
  }

  static notFound(what = 'Dữ liệu'): AppError {
    return new AppError(ErrorCode.NOT_FOUND, `${what} không tồn tại hoặc đã bị xoá.`)
  }

  static duplicate(message: string): AppError {
    return new AppError(ErrorCode.DUPLICATE, message)
  }

  static validation(message: string, details?: unknown): AppError {
    return new AppError(ErrorCode.VALIDATION, message, details)
  }

  static unauthorized(message = 'Bạn cần đăng nhập để thực hiện thao tác này.'): AppError {
    return new AppError(ErrorCode.UNAUTHORIZED, message)
  }

  static forbidden(message = 'Bạn không có quyền thực hiện thao tác này.'): AppError {
    return new AppError(ErrorCode.FORBIDDEN, message)
  }

  static conflict(message: string): AppError {
    return new AppError(ErrorCode.CONFLICT, message)
  }
}

/** Dịch lỗi kỹ thuật của SQLite sang thông báo người dùng đọc được */
export function toIpcError(err: unknown): IpcResult<never> {
  if (err instanceof AppError) {
    return { ok: false, error: { code: err.code, message: err.message, details: err.details } }
  }

  const message = err instanceof Error ? err.message : String(err)

  if (message.includes('UNIQUE constraint failed')) {
    return {
      ok: false,
      error: {
        code: ErrorCode.DUPLICATE,
        message: 'Dữ liệu đã tồn tại (trùng mã hoặc trùng khoá duy nhất).'
      }
    }
  }
  if (message.includes('FOREIGN KEY constraint failed')) {
    return {
      ok: false,
      error: {
        code: ErrorCode.CONFLICT,
        message: 'Không thể thực hiện: dữ liệu đang được tham chiếu bởi bản ghi khác.'
      }
    }
  }

  console.error('[ipc] Lỗi không xác định:', err)
  return {
    ok: false,
    error: { code: ErrorCode.UNKNOWN, message: 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại.' }
  }
}

export function ok<T>(data: T): IpcResult<T> {
  return { ok: true, data }
}
