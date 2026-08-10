import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { timestamps } from './base'
import { students } from './people'
import { classes, classSessions } from './academic'
import { users } from './auth'

/** Ghi danh: học viên ↔ lớp học (bảng nối, kèm dữ liệu học phí đã chốt) */
export const enrollments = sqliteTable(
  'enrollments',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    studentId: integer('student_id')
      .notNull()
      .references(() => students.id),
    classId: integer('class_id')
      .notNull()
      .references(() => classes.id),
    enrollDate: text('enroll_date').notNull(),
    status: text('status').notNull().default('studying'),
    /**
     * Học phí chốt riêng cho học viên này. Sao chép từ course.tuitionFee lúc
     * ghi danh — nếu sau này trung tâm tăng giá khoá học, công nợ cũ không đổi.
     */
    agreedFee: integer('agreed_fee').notNull().default(0),
    feeType: text('fee_type').notNull().default('default'),
    customFee: integer('custom_fee'),
    /** Số tiền giảm (VND), không phải phần trăm */
    discount: integer('discount').notNull().default(0),
    surcharge: integer('surcharge').notNull().default(0),
    payableOverride: integer('payable_override'),
    note: text('note'),
    ...timestamps
  },
  (t) => ({
    studentIdx: index('enrollments_student_idx').on(t.studentId),
    classIdx: index('enrollments_class_idx').on(t.classId),
    // Một học viên chỉ ghi danh một lần vào cùng một lớp
    uniqIdx: uniqueIndex('enrollments_student_class_unique').on(t.studentId, t.classId),
    deletedIdx: index('enrollments_deleted_idx').on(t.deletedAt)
  })
)

/** Điểm danh: một dòng = một học viên trong một buổi học */
export const attendance = sqliteTable(
  'attendance',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    sessionId: integer('session_id')
      .notNull()
      .references(() => classSessions.id, { onDelete: 'cascade' }),
    studentId: integer('student_id')
      .notNull()
      .references(() => students.id),
    /** present | excused | absent | late */
    status: text('status').notNull().default('present'),
    note: text('note'),
    markedBy: integer('marked_by').references(() => users.id),
    markedAt: integer('marked_at')
      .notNull()
      .$defaultFn(() => Date.now()),
    ...timestamps
  },
  (t) => ({
    sessionIdx: index('attendance_session_idx').on(t.sessionId),
    studentIdx: index('attendance_student_idx').on(t.studentId),
    // Chống ghi trùng khi điểm danh lại: upsert theo cặp (buổi, học viên)
    uniqIdx: uniqueIndex('attendance_session_student_unique').on(t.sessionId, t.studentId),
    deletedIdx: index('attendance_deleted_idx').on(t.deletedAt)
  })
)

/** Lich su moi lan quan tri vien dieu chinh hoc phi cua mot luot ghi danh. */
export const tuitionAdjustments = sqliteTable(
  'tuition_adjustments',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    enrollmentId: integer('enrollment_id')
      .notNull()
      .references(() => enrollments.id),
    originalPayable: integer('original_payable').notNull(),
    adjustedPayable: integer('adjusted_payable').notNull(),
    beforeSnapshot: text('before_snapshot').notNull(),
    afterSnapshot: text('after_snapshot').notNull(),
    reason: text('reason'),
    adjustedBy: integer('adjusted_by').references(() => users.id),
    ...timestamps
  },
  (t) => ({
    enrollmentIdx: index('tuition_adjustments_enrollment_idx').on(t.enrollmentId),
    userIdx: index('tuition_adjustments_user_idx').on(t.adjustedBy),
    createdIdx: index('tuition_adjustments_created_idx').on(t.createdAt)
  })
)

export type EnrollmentRow = typeof enrollments.$inferSelect
export type AttendanceRow = typeof attendance.$inferSelect
export type TuitionAdjustmentRow = typeof tuitionAdjustments.$inferSelect
