import type { PageQuery, PageResult } from '@shared/types/common'

export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 200

export interface NormalizedPage {
  page: number
  pageSize: number
  offset: number
  limit: number
}

/**
 * Chuẩn hoá tham số phân trang đến từ renderer.
 * Chặn pageSize khổng lồ để một request lỗi không kéo cả bảng vào RAM.
 */
export function normalizePage(query: PageQuery | undefined): NormalizedPage {
  const page = Math.max(1, Math.floor(Number(query?.page) || 1))
  const rawSize = Math.floor(Number(query?.pageSize) || DEFAULT_PAGE_SIZE)
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, rawSize))
  return { page, pageSize, offset: (page - 1) * pageSize, limit: pageSize }
}

export function toPageResult<T>(items: T[], total: number, p: NormalizedPage): PageResult<T> {
  return { items, total, page: p.page, pageSize: p.pageSize }
}

/**
 * Chuẩn bị từ khoá cho mệnh đề LIKE.
 * Escape ký tự đại diện để người dùng gõ "%" không quét toàn bộ bảng.
 */
export function likeParam(keyword: string | undefined): string | null {
  const k = keyword?.trim()
  if (!k) return null
  return `%${k.replace(/[%_\\]/g, (m) => `\\${m}`)}%`
}

/**
 * Chỉ cho phép sắp xếp theo cột nằm trong danh sách trắng.
 * Ghép chuỗi cột trực tiếp vào SQL từ input người dùng là lỗ hổng SQL injection.
 */
export function safeSort(
  sortBy: string | undefined,
  sortOrder: string | undefined,
  allowed: Record<string, string>,
  fallback: string
): string {
  const column = (sortBy && allowed[sortBy]) || fallback
  const direction = String(sortOrder).toLowerCase() === 'asc' ? 'ASC' : 'DESC'
  return `${column} ${direction}`
}
