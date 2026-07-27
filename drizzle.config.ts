import type { Config } from 'drizzle-kit'

/**
 * Chỉ dùng cho `npm run db:generate` — sinh file SQL migration từ schema.
 * Ứng dụng lúc chạy sẽ đọc các file trong thư mục /drizzle và áp dụng tuần tự.
 */
export default {
  schema: './src/main/database/schema/index.ts',
  out: './drizzle',
  dialect: 'sqlite'
} satisfies Config
