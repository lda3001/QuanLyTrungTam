import type { IpcResult } from '@shared/types/common'

/**
 * Lỗi nghiệp vụ ở phía renderer, dựng lại từ IpcResult.
 * Nhờ có `code`, giao diện xử lý khác nhau cho từng loại lỗi
 * (ví dụ UNAUTHORIZED thì đá về màn hình đăng nhập).
 */
export class ApiError extends Error {
  readonly code: string
  readonly details?: unknown

  constructor(code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.details = details
  }
}

/**
 * Bóc `IpcResult` thành giá trị thật, hoặc ném ApiError.
 *
 * Lý do tồn tại: main process không bao giờ ném lỗi qua ranh giới IPC (stack
 * trace sẽ bị mất). Hàm này chuyển kết quả dạng "ok/error" về đúng mô hình
 * throw/catch mà React Query và try–catch mong đợi.
 */
export async function call<T>(promise: Promise<IpcResult<T>>): Promise<T> {
  const result = await promise

  if (!result) {
    throw new ApiError('UNKNOWN', 'Không nhận được phản hồi từ hệ thống.')
  }
  if (!result.ok) {
    throw new ApiError(result.error.code, result.error.message, result.error.details)
  }
  return result.data
}

/** Truy cập API do preload expose; báo lỗi rõ ràng nếu chạy ngoài Electron */
export function api(): Window['api'] {
  if (typeof window === 'undefined' || !window.api) {
    throw new ApiError('UNKNOWN', 'Ứng dụng chưa sẵn sàng (thiếu cầu nối preload).')
  }
  return window.api
}
