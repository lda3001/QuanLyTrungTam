import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { timestamps } from './base'
import { teachers } from './people'

/** Vai trò: admin / manager / teacher / cashier (và vai trò tự tạo) */
export const roles = sqliteTable(
  'roles',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    code: text('code').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    /** 1 = vai trò hệ thống, không cho xoá */
    isSystem: integer('is_system').notNull().default(0),
    ...timestamps
  },
  (t) => ({
    codeIdx: uniqueIndex('roles_code_unique').on(t.code),
    deletedIdx: index('roles_deleted_idx').on(t.deletedAt)
  })
)

/** Danh mục quyền — seed từ hằng số PERMISSIONS, dùng để render cây phân quyền */
export const permissions = sqliteTable(
  'permissions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    code: text('code').notNull(),
    name: text('name').notNull(),
    groupKey: text('group_key').notNull().default('other'),
    ...timestamps
  },
  (t) => ({
    codeIdx: uniqueIndex('permissions_code_unique').on(t.code),
    groupIdx: index('permissions_group_idx').on(t.groupKey)
  })
)

/** Bảng nối vai trò ↔ quyền */
export const rolePermissions = sqliteTable(
  'role_permissions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    roleId: integer('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionCode: text('permission_code').notNull(),
    ...timestamps
  },
  (t) => ({
    roleIdx: index('role_permissions_role_idx').on(t.roleId),
    uniqIdx: uniqueIndex('role_permissions_unique').on(t.roleId, t.permissionCode)
  })
)

/** Tài khoản đăng nhập / nhân viên */
export const users = sqliteTable(
  'users',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    username: text('username').notNull(),
    /** Định dạng: scrypt$N$r$p$<salt-hex>$<hash-hex> — không bao giờ lưu plaintext */
    passwordHash: text('password_hash').notNull(),
    fullName: text('full_name').notNull(),
    email: text('email'),
    phone: text('phone'),
    roleId: integer('role_id')
      .notNull()
      .references(() => roles.id),
    /** Liên kết tới hồ sơ giáo viên nếu tài khoản này là giáo viên */
    teacherId: integer('teacher_id').references(() => teachers.id),
    avatar: text('avatar'),
    isActive: integer('is_active').notNull().default(1),
    lastLoginAt: integer('last_login_at'),
    /** Cơ chế "quên mật khẩu nội bộ": câu hỏi + đáp án đã băm */
    securityQuestion: text('security_question'),
    securityAnswerHash: text('security_answer_hash'),
    ...timestamps
  },
  (t) => ({
    usernameIdx: uniqueIndex('users_username_unique').on(t.username),
    roleIdx: index('users_role_idx').on(t.roleId),
    deletedIdx: index('users_deleted_idx').on(t.deletedAt)
  })
)

export type RoleRow = typeof roles.$inferSelect
export type PermissionRow = typeof permissions.$inferSelect
export type UserRow = typeof users.$inferSelect
