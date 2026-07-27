import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { timestamps } from './base'
import { users } from './auth'

/** Cấu hình dạng key–value (tên trung tâm, tiền tố mã, ...) */
export const settings = sqliteTable(
  'settings',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    key: text('key').notNull(),
    value: text('value').notNull().default(''),
    groupKey: text('group_key').notNull().default('general'),
    description: text('description'),
    ...timestamps
  },
  (t) => ({
    keyIdx: uniqueIndex('settings_key_unique').on(t.key)
  })
)

/** Nhật ký thao tác — ghi mọi hành động thay đổi dữ liệu để truy vết */
export const logs = sqliteTable(
  'logs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id').references(() => users.id),
    username: text('username'),
    /** create | update | delete | login | logout | export | import ... */
    action: text('action').notNull(),
    entity: text('entity').notNull(),
    entityId: integer('entity_id'),
    description: text('description'),
    ipAddress: text('ip_address'),
    /** JSON chuỗi hoá: payload rút gọn của thao tác */
    metadata: text('metadata'),
    ...timestamps
  },
  (t) => ({
    userIdx: index('logs_user_idx').on(t.userId),
    entityIdx: index('logs_entity_idx').on(t.entity),
    createdIdx: index('logs_created_idx').on(t.createdAt)
  })
)

export type SettingRow = typeof settings.$inferSelect
export type LogRow = typeof logs.$inferSelect
