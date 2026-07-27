import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { timestamps } from './base'

/** Học viên */
export const students = sqliteTable(
  'students',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    code: text('code').notNull(),
    fullName: text('full_name').notNull(),
    gender: text('gender').notNull().default('male'),
    birthDate: text('birth_date'),
    email: text('email'),
    phone: text('phone'),
    address: text('address'),
    /**
     * Lớp của học sinh Ở TRƯỜNG PHỔ THÔNG (ví dụ "10A1", "6A3").
     * KHÔNG liên quan tới lớp học tại trung tâm — lớp trung tâm nằm ở bảng
     * `classes` và liên kết qua `enrollments`.
     */
    schoolClass: text('school_class'),
    guardianName: text('guardian_name'),
    guardianPhone: text('guardian_phone'),
    note: text('note'),
    status: text('status').notNull().default('active'),
    avatar: text('avatar'),
    ...timestamps
  },
  (t) => ({
    // Mã học viên là duy nhất trong toàn hệ thống (kể cả bản ghi đã xoá mềm)
    codeIdx: uniqueIndex('students_code_unique').on(t.code),
    nameIdx: index('students_name_idx').on(t.fullName),
    phoneIdx: index('students_phone_idx').on(t.phone),
    schoolClassIdx: index('students_school_class_idx').on(t.schoolClass),
    statusIdx: index('students_status_idx').on(t.status),
    deletedIdx: index('students_deleted_idx').on(t.deletedAt)
  })
)

/** Giáo viên */
export const teachers = sqliteTable(
  'teachers',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    code: text('code').notNull(),
    fullName: text('full_name').notNull(),
    gender: text('gender').notNull().default('male'),
    birthDate: text('birth_date'),
    email: text('email'),
    phone: text('phone'),
    address: text('address'),
    specialization: text('specialization'),
    degree: text('degree'),
    salary: integer('salary').notNull().default(0),
    hireDate: text('hire_date'),
    status: text('status').notNull().default('active'),
    note: text('note'),
    ...timestamps
  },
  (t) => ({
    codeIdx: uniqueIndex('teachers_code_unique').on(t.code),
    nameIdx: index('teachers_name_idx').on(t.fullName),
    statusIdx: index('teachers_status_idx').on(t.status),
    deletedIdx: index('teachers_deleted_idx').on(t.deletedAt)
  })
)

export type StudentRow = typeof students.$inferSelect
export type StudentInsert = typeof students.$inferInsert
export type TeacherRow = typeof teachers.$inferSelect
export type TeacherInsert = typeof teachers.$inferInsert
