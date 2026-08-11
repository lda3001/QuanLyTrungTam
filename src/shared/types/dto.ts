import type { PageQuery } from './common'
import type {
  AttendanceStatus,
  ClassStatus,
  CourseStatus,
  EnrollmentStatus,
  Gender,
  PaymentMethod,
  PaymentStatus,
  SessionStatus,
  StudentStatus,
  TeacherStatus
} from '../constants/enums'
import type { Permission } from '../constants/permissions'

/* ============================ AUTH ============================ */

export interface LoginInput {
  username: string
  password: string
  remember?: boolean
}

export interface ChangePasswordInput {
  currentPassword: string
  newPassword: string
}

export interface ResetPasswordInput {
  username: string
  securityAnswer: string
  newPassword: string
}

export interface AdminResetPasswordInput {
  userId: number
  newPassword: string
}

/* ============================ STUDENT ============================ */

export interface StudentQuery extends PageQuery {
  status?: StudentStatus
  gender?: Gender
  /** Lớp học tại trung tâm */
  classId?: number
  courseId?: number
  /** Lớp ở trường phổ thông (lọc chính xác theo chuỗi) */
  schoolClass?: string
}

export interface StudentInput {
  code?: string
  fullName: string
  gender: Gender
  birthDate?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  /** Lớp ở trường phổ thông */
  schoolClass?: string | null
  guardianName?: string | null
  guardianPhone?: string | null
  note?: string | null
  status: StudentStatus
  avatar?: string | null
}

export interface StudentImportRow {
  code?: string
  fullName: string
  gender?: string
  birthDate?: string
  email?: string
  phone?: string
  address?: string
  schoolClass?: string
  guardianName?: string
  guardianPhone?: string
  note?: string
}

export interface ImportResult {
  total: number
  inserted: number
  failed: number
  errors: { row: number; message: string }[]
}

/* ============================ TEACHER ============================ */

export interface TeacherQuery extends PageQuery {
  status?: TeacherStatus
  specialization?: string
}

export interface TeacherInput {
  code?: string
  fullName: string
  gender: Gender
  birthDate?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  specialization?: string | null
  degree?: string | null
  salary: number
  hireDate?: string | null
  status: TeacherStatus
  note?: string | null
}

/* ============================ COURSE ============================ */

export interface CourseQuery extends PageQuery {
  status?: CourseStatus
}

export interface CourseInput {
  code?: string
  name: string
  description?: string | null
  tuitionFee: number
  durationHours: number
  totalSessions: number
  status: CourseStatus
}

/* ============================ CLASS ============================ */

export interface ClassQuery extends PageQuery {
  status?: ClassStatus
  courseId?: number
  teacherId?: number
}

export interface ClassScheduleInput {
  weekday: number
  startTime: string
  endTime: string
  room?: string | null
}

export interface ClassInput {
  code?: string
  name: string
  courseId: number
  teacherId?: number | null
  room?: string | null
  startDate?: string | null
  endDate?: string | null
  maxStudents: number
  status: ClassStatus
  note?: string | null
  schedules: ClassScheduleInput[]
}

export interface EnrollInput {
  classId: number
  studentIds: number[]
  enrollDate: string
  discount?: number
  note?: string | null
}

export interface UpdateEnrollmentInput {
  id: number
  enrollDate?: string
  status?: EnrollmentStatus
  agreedFee?: number
  discount?: number
  note?: string | null
}

/**
 * Một dòng trong file Excel xếp học viên vào lớp.
 *
 * Học viên phải ĐÃ tồn tại trong hệ thống — file chỉ dùng để nhận diện
 * (theo Mã HV → SĐT → Họ tên) rồi ghi danh hàng loạt. `discount` có thể là
 * số hoặc chuỗi (người dùng gõ "1.000.000"); backend tự chuẩn hoá.
 */
export interface EnrollImportRow {
  code?: string
  fullName?: string
  phone?: string
  discount?: string | number
  note?: string
}

export interface EnrollImportInput {
  classId: number
  /** Ngày ghi danh dùng chung cho cả file — lấy ngày import */
  enrollDate: string
  rows: EnrollImportRow[]
}

/* ============================ SESSION / SCHEDULE ============================ */

export interface SessionQuery {
  classId?: number
  teacherId?: number
  from?: string
  to?: string
  status?: SessionStatus
}

export interface SessionInput {
  classId: number
  sessionDate: string
  startTime: string
  endTime: string
  room?: string | null
  teacherId?: number | null
  topic?: string | null
  status: SessionStatus
  note?: string | null
}

/** Dùng cho thao tác kéo–thả trên lịch */
export interface MoveSessionInput {
  id: number
  sessionDate: string
  startTime: string
  endTime: string
}

export interface GenerateSessionsInput {
  classId: number
  /** Ghi đè các buổi đã sinh trước đó (chỉ buổi chưa điểm danh) */
  replaceExisting?: boolean
}

/* ============================ ATTENDANCE ============================ */

export interface AttendanceMarkItem {
  studentId: number
  status: AttendanceStatus
  note?: string | null
}

export interface MarkAttendanceInput {
  sessionId: number
  items: AttendanceMarkItem[]
}

export interface MarkMultiAttendanceInput {
  /** Mỗi phần tử là điểm danh cho một buổi */
  sessions: MarkAttendanceInput[]
}

export interface AttendanceHistoryQuery extends PageQuery {
  studentId?: number
  classId?: number
  from?: string
  to?: string
  status?: AttendanceStatus
}

export interface AttendanceHistoryRow {
  id: number
  sessionId: number
  sessionDate: string
  startTime: string
  endTime: string
  className: string
  courseName: string
  studentId: number
  studentCode: string
  studentName: string
  status: AttendanceStatus
  note: string | null
  markedByName: string | null
  markedAt: number
}

export interface AttendanceGridQuery {
  classId: number
  from?: string
  to?: string
}

export interface AttendanceGridSession {
  id: number
  sessionDate: string
  startTime: string
  endTime: string
}

export interface AttendanceGridStudent {
  studentId: number
  studentCode: string
  studentName: string
  schoolClass: string | null
  guardianPhone: string | null
}

/**
 * Dữ liệu bảng điểm danh nhiều buổi (dạng lưới): mỗi buổi là một cột, mỗi học
 * viên là một hàng. `marks[studentId][sessionId]` là trạng thái đã chấm — thiếu
 * khoá nghĩa là buổi đó chưa điểm danh cho học viên này.
 */
export interface AttendanceGridResult {
  className: string
  courseName: string
  sessions: AttendanceGridSession[]
  students: AttendanceGridStudent[]
  marks: Record<number, Record<number, AttendanceStatus>>
}

/* ============================ PAYMENT ============================ */

export interface PaymentQuery extends PageQuery {
  status?: PaymentStatus
  method?: PaymentMethod
  studentId?: number
  classId?: number
  from?: string
  to?: string
}

export interface PaymentInput {
  code?: string
  studentId: number
  enrollmentId?: number | null
  amount: number
  method: PaymentMethod
  status: PaymentStatus
  paidDate: string
  note?: string | null
}

export type TuitionFeeType = 'default' | 'monthly' | 'per_session' | 'fixed'

export interface TuitionAdjustmentInput {
  feeType: TuitionFeeType
  customFee?: number | null
  discount: number
  surcharge: number
  payableOverride?: number | null
  reason?: string | null
}

export interface DebtQuery extends PageQuery {
  classId?: number
  courseId?: number
  /** true = chỉ lấy các dòng còn nợ */
  onlyDebt?: boolean
}

export interface DebtRow {
  enrollmentId: number
  studentId: number
  studentCode: string
  studentName: string
  studentPhone: string | null
  classId: number
  className: string
  courseName: string
  agreedFee: number
  feeType: TuitionFeeType
  customFee: number | null
  discount: number
  surcharge: number
  payableOverride: number | null
  calculatedFee: number
  eligibleSessionCount: number
  totalSessionCount: number
  billableMonthCount: number
  payable: number
  paid: number
  remaining: number
  status: PaymentStatus
}

/** Dữ liệu đủ để render phiếu thu ra HTML/PDF */
export interface ReceiptData {
  payment: {
    code: string
    amount: number
    method: PaymentMethod
    paidDate: string
    note: string | null
  }
  student: { code: string; fullName: string; phone: string | null; address: string | null }
  className: string | null
  courseName: string | null
  totals: { payable: number; paid: number; remaining: number }
  center: {
    centerName: string
    centerAddress: string
    centerPhone: string
    centerEmail: string
    centerTaxCode: string
  }
  cashierName: string
  printedAt: number
}

/* ============================ USER / ROLE ============================ */

export interface UserQuery extends PageQuery {
  roleId?: number
  isActive?: number
}

export interface UserInput {
  username: string
  password?: string
  fullName: string
  email?: string | null
  phone?: string | null
  roleId: number
  teacherId?: number | null
  avatar?: string | null
  isActive: number
  securityQuestion?: string | null
  securityAnswer?: string | null
}

export interface RoleInput {
  code: string
  name: string
  description?: string | null
  permissions: Permission[]
}

/* ============================ DASHBOARD / REPORT ============================ */

export interface DashboardSummary {
  totalStudents: number
  activeStudents: number
  totalTeachers: number
  totalClasses: number
  ongoingClasses: number
  monthRevenue: number
  prevMonthRevenue: number
  unpaidAmount: number
  unpaidCount: number
  todaySessions: number
}

export interface RevenueByMonthRow {
  month: string
  revenue: number
  target?: number
}

export interface StudentsByCourseRow {
  courseName: string
  students: number
}

export interface PaymentRatioRow {
  name: string
  value: number
  key: PaymentStatus
}

export interface TodaySessionRow {
  id: number
  className: string
  courseName: string
  teacherName: string | null
  room: string | null
  startTime: string
  endTime: string
  status: SessionStatus
  studentCount: number
}

export interface DashboardData {
  summary: DashboardSummary
  revenueByMonth: RevenueByMonthRow[]
  studentsByCourse: StudentsByCourseRow[]
  paymentRatio: PaymentRatioRow[]
  todaySessions: TodaySessionRow[]
  recentPayments: {
    id: number
    code: string
    studentName: string
    amount: number
    paidDate: string
    method: PaymentMethod
  }[]
}

export interface ReportRange {
  from: string
  to: string
}

export interface RevenueReportRow {
  period: string
  transactions: number
  revenue: number
}

export interface RevenueReport {
  rows: RevenueReportRow[]
  totalRevenue: number
  totalTransactions: number
  byMethod: { method: PaymentMethod; amount: number; count: number }[]
}

export interface TuitionReportRow {
  classId: number
  className: string
  courseName: string
  students: number
  payable: number
  paid: number
  remaining: number
  rate: number
}

export interface AttendanceReportRow {
  classId: number
  className: string
  sessions: number
  present: number
  excused: number
  absent: number
  late: number
  rate: number
}

export interface StudentReportRow {
  period: string
  newStudents: number
  totalActive: number
  dropped: number
}

export interface TeacherReportRow {
  teacherId: number
  teacherName: string
  classes: number
  sessions: number
  students: number
  salary: number
}

export interface ExportRequest {
  /** Tên file gợi ý khi mở hộp thoại lưu */
  fileName: string
  sheetName?: string
  columns: { key: string; title: string; width?: number }[]
  rows: Record<string, unknown>[]
  title?: string
}

export interface ExportPdfRequest {
  fileName: string
  html: string
  landscape?: boolean
}

export interface LogQuery extends PageQuery {
  userId?: number
  action?: string
  entity?: string
  from?: string
  to?: string
}
