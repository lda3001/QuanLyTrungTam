/**
 * Điểm gom toàn bộ schema. drizzle-kit đọc file này để sinh migration,
 * và `drizzle(sqlite, { schema })` dùng nó để suy ra kiểu cho query.
 */
export * from './base'
export * from './people'
export * from './academic'
export * from './auth'
export * from './enrollment'
export * from './finance'
export * from './system'
