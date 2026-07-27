import { integer } from 'drizzle-orm/sqlite-core'

/**
 * Bộ cột dấu thời gian dùng chung cho MỌI bảng.
 *
 * - Lưu dạng INTEGER (unix milliseconds) thay vì TEXT: so sánh/sắp xếp nhanh,
 *   không phụ thuộc locale, và JS đọc thẳng bằng `new Date(value)`.
 * - `deletedAt = null` nghĩa là bản ghi còn sống. Toàn bộ repository luôn thêm
 *   điều kiện `isNull(deletedAt)` — xoá trong app là xoá mềm, dữ liệu vẫn nằm
 *   lại để đối soát và khôi phục.
 */
export const timestamps = {
  createdAt: integer('created_at')
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at')
    .notNull()
    .$defaultFn(() => Date.now()),
  deletedAt: integer('deleted_at')
}
