import type Database from 'better-sqlite3'

/**
 * Sinh mã tự động dạng <PREFIX><số thứ tự>, ví dụ HV0001, GV0007.
 *
 * Cách làm: lấy số lớn nhất đang có rồi +1, chạy bên trong transaction của
 * lệnh tạo bản ghi. Kết hợp với UNIQUE INDEX trên cột code, dữ liệu không thể
 * trùng ngay cả khi có lỗi logic — ràng buộc ở database mới là chốt chặn cuối.
 */
export function generateCode(
  sqlite: Database.Database,
  table: 'students' | 'teachers' | 'courses' | 'classes' | 'payments',
  prefix: string,
  padLength = 4
): string {
  const row = sqlite
    .prepare(
      `SELECT code FROM ${table}
       WHERE code LIKE ?
       ORDER BY LENGTH(code) DESC, code DESC
       LIMIT 1`
    )
    .get(`${prefix}%`) as { code: string } | undefined

  let next = 1
  if (row?.code) {
    const digits = row.code.slice(prefix.length).replace(/\D/g, '')
    if (digits) next = parseInt(digits, 10) + 1
  }

  return `${prefix}${String(next).padStart(padLength, '0')}`
}

/** Mã phiếu thu có thêm năm–tháng để dễ tra cứu sổ sách: PT2026070001 */
export function generateReceiptCode(sqlite: Database.Database, prefix: string, date: string): string {
  const [year, month] = date.split('-')
  const fullPrefix = `${prefix}${year}${month}`

  const row = sqlite
    .prepare(
      `SELECT code FROM payments
       WHERE code LIKE ?
       ORDER BY code DESC
       LIMIT 1`
    )
    .get(`${fullPrefix}%`) as { code: string } | undefined

  let next = 1
  if (row?.code) {
    const digits = row.code.slice(fullPrefix.length)
    if (digits) next = parseInt(digits, 10) + 1
  }

  return `${fullPrefix}${String(next).padStart(4, '0')}`
}
