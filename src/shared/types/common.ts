/** Kiểu dùng chung cho phân trang / kết quả IPC */

export interface BaseEntity {
  id: number
  createdAt: number
  updatedAt: number
  deletedAt: number | null
}

export interface PageQuery {
  page?: number
  pageSize?: number
  keyword?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface PageResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

/**
 * Mọi lệnh IPC đều trả về kiểu này — không bao giờ ném exception qua ranh giới
 * process (Electron sẽ nuốt stack trace và renderer nhận được lỗi vô nghĩa).
 * Renderer kiểm tra `ok` rồi mới dùng `data`.
 */
export type IpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; details?: unknown } }

export const ErrorCode = {
  UNKNOWN: 'UNKNOWN',
  VALIDATION: 'VALIDATION',
  NOT_FOUND: 'NOT_FOUND',
  DUPLICATE: 'DUPLICATE',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  CONFLICT: 'CONFLICT',
  DB_ERROR: 'DB_ERROR'
} as const
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode]

export interface SelectOption {
  label: string
  value: number | string
}
