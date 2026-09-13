import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core'
import { timestamps } from './base'
import { teachers } from './people'

/** Khoá học (chương trình đào tạo) */
export const courses = sqliteTable(
  'courses',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    code: text('code').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    /** Đơn vị VND, số nguyên — không dùng float để tránh sai số tiền tệ */
    tuitionFee: integer('tuition_fee').notNull().default(0),
    durationHours: integer('duration_hours').notNull().default(0),
    totalSessions: integer('total_sessions').notNull().default(0),
    status: text('status').notNull().default('active'),
    ...timestamps
  },
  (t) => ({
    codeIdx: uniqueIndex('courses_code_unique').on(t.code),
    nameIdx: index('courses_name_idx').on(t.name),
    deletedIdx: index('courses_deleted_idx').on(t.deletedAt)
  })
)

/** Lớp học — một lần mở của khoá học */
export const classes = sqliteTable(
  'classes',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    code: text('code').notNull(),
    name: text('name').notNull(),
    courseId: integer('course_id')
      .notNull()
      .references(() => courses.id),
    teacherId: integer('teacher_id').references(() => teachers.id),
    room: text('room'),
    startDate: text('start_date'),
    endDate: text('end_date'),
    maxStudents: integer('max_students').notNull().default(30),
    /** Học phí chốt riêng cho lần mở lớp này; không đổi khi sửa giá khóa học. */
    tuitionFee: integer('tuition_fee'),
    /** Năm học/giai đoạn vận hành, ví dụ 2026–2027. */
    academicYear: text('academic_year'),
    /** Lớp liền trước trong chuỗi học tiếp qua các năm. */
    previousClassId: integer('previous_class_id').references((): AnySQLiteColumn => classes.id),
    status: text('status').notNull().default('planned'),
    note: text('note'),
    ...timestamps
  },
  (t) => ({
    codeIdx: uniqueIndex('classes_code_unique').on(t.code),
    courseIdx: index('classes_course_idx').on(t.courseId),
    teacherIdx: index('classes_teacher_idx').on(t.teacherId),
    statusIdx: index('classes_status_idx').on(t.status),
    academicYearIdx: index('classes_academic_year_idx').on(t.academicYear),
    previousClassIdx: index('classes_previous_class_idx').on(t.previousClassId),
    deletedIdx: index('classes_deleted_idx').on(t.deletedAt)
  })
)

/**
 * Khung giờ học lặp theo tuần của một lớp.
 * Ví dụ: lớp IELTS-01 học Thứ 2 & Thứ 4, 18:00–20:00.
 * Đây là "công thức"; bảng class_sessions bên dưới là các buổi đã quy ra ngày.
 */
export const classSchedules = sqliteTable(
  'class_schedules',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    classId: integer('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    /** 0 = Chủ nhật ... 6 = Thứ bảy */
    weekday: integer('weekday').notNull(),
    startTime: text('start_time').notNull(),
    endTime: text('end_time').notNull(),
    room: text('room'),
    ...timestamps
  },
  (t) => ({
    classIdx: index('class_schedules_class_idx').on(t.classId),
    deletedIdx: index('class_schedules_deleted_idx').on(t.deletedAt)
  })
)

/** Buổi học cụ thể — đơn vị dùng để điểm danh và hiển thị trên lịch */
export const classSessions = sqliteTable(
  'class_sessions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    classId: integer('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    /** 'YYYY-MM-DD' */
    sessionDate: text('session_date').notNull(),
    startTime: text('start_time').notNull(),
    endTime: text('end_time').notNull(),
    room: text('room'),
    /** Cho phép giáo viên dạy thay ở buổi lẻ */
    teacherId: integer('teacher_id').references(() => teachers.id),
    topic: text('topic'),
    status: text('status').notNull().default('scheduled'),
    note: text('note'),
    ...timestamps
  },
  (t) => ({
    classIdx: index('class_sessions_class_idx').on(t.classId),
    dateIdx: index('class_sessions_date_idx').on(t.sessionDate),
    teacherIdx: index('class_sessions_teacher_idx').on(t.teacherId),
    deletedIdx: index('class_sessions_deleted_idx').on(t.deletedAt)
  })
)

export type CourseRow = typeof courses.$inferSelect
export type ClassRow = typeof classes.$inferSelect
export type ClassScheduleRow = typeof classSchedules.$inferSelect
export type ClassSessionRow = typeof classSessions.$inferSelect
