import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { timestamps } from './base'
import { students } from './people'
import { enrollments } from './enrollment'
import { users } from './auth'

/**
 * Phiếu thu học phí.
 *
 * Một phiếu gắn với một lần ghi danh (enrollment) để biết học viên đóng tiền
 * cho lớp nào. Công nợ KHÔNG lưu thành cột riêng mà luôn tính bằng
 * `agreedFee - discount - SUM(payments.amount)` — tránh dữ liệu lệch nhau khi
 * sửa/xoá phiếu.
 */
export const payments = sqliteTable(
  'payments',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    code: text('code').notNull(),
    studentId: integer('student_id')
      .notNull()
      .references(() => students.id),
    enrollmentId: integer('enrollment_id').references(() => enrollments.id),
    /** VND, số nguyên. Phiếu hoàn tiền lưu số dương + status = 'refunded' */
    amount: integer('amount').notNull().default(0),
    method: text('method').notNull().default('cash'),
    status: text('status').notNull().default('paid'),
    paidDate: text('paid_date').notNull(),
    note: text('note'),
    createdBy: integer('created_by').references(() => users.id),
    ...timestamps
  },
  (t) => ({
    codeIdx: uniqueIndex('payments_code_unique').on(t.code),
    studentIdx: index('payments_student_idx').on(t.studentId),
    enrollmentIdx: index('payments_enrollment_idx').on(t.enrollmentId),
    dateIdx: index('payments_date_idx').on(t.paidDate),
    statusIdx: index('payments_status_idx').on(t.status),
    deletedIdx: index('payments_deleted_idx').on(t.deletedAt)
  })
)

export type PaymentRow = typeof payments.$inferSelect
