import type { BaseEntity } from './common'
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

/* ------------------------------------------------------------------ *
 * Quy ước kiểu dữ liệu
 *  - Mốc thời gian hệ thống (createdAt...) : number = unix milliseconds
 *  - Ngày nghiệp vụ (ngày sinh, khai giảng): string = 'YYYY-MM-DD'
 *  - Giờ                                    : string = 'HH:mm'
 *  - Tiền                                   : number nguyên, đơn vị VND
 * ------------------------------------------------------------------ */

export interface Student extends BaseEntity {
  code: string
  fullName: string
  gender: Gender
  birthDate: string | null
  email: string | null
  phone: string | null
  address: string | null
  /** Lớp ở trường phổ thông (10A1, 6A3...) — không phải lớp học tại trung tâm */
  schoolClass: string | null
  guardianName: string | null
  guardianPhone: string | null
  note: string | null
  status: StudentStatus
  avatar: string | null
}

export interface Teacher extends BaseEntity {
  code: string
  fullName: string
  gender: Gender
  birthDate: string | null
  email: string | null
  phone: string | null
  address: string | null
  specialization: string | null
  degree: string | null
  salary: number
  hireDate: string | null
  status: TeacherStatus
  note: string | null
}

export interface Course extends BaseEntity {
  code: string
  name: string
  description: string | null
  tuitionFee: number
  /** Tổng thời lượng, đơn vị: giờ */
  durationHours: number
  /** Số buổi của khoá */
  totalSessions: number
  status: CourseStatus
}

export interface ClassRoom extends BaseEntity {
  code: string
  name: string
  courseId: number
  teacherId: number | null
  room: string | null
  startDate: string | null
  endDate: string | null
  maxStudents: number
  status: ClassStatus
  note: string | null
}

/** Lớp học kèm dữ liệu đã join sẵn để hiển thị bảng, tránh N+1 query */
export interface ClassRoomDetail extends ClassRoom {
  courseName: string
  courseFee: number
  teacherName: string | null
  studentCount: number
  schedules: ClassSchedule[]
}

/** Khung giờ lặp hằng tuần của một lớp — nguồn để sinh ra các buổi học */
export interface ClassSchedule extends BaseEntity {
  classId: number
  /** 0 = Chủ nhật ... 6 = Thứ bảy */
  weekday: number
  startTime: string
  endTime: string
  room: string | null
}

/** Một buổi học cụ thể (đã quy ra ngày) — đơn vị để điểm danh */
export interface ClassSession extends BaseEntity {
  classId: number
  sessionDate: string
  startTime: string
  endTime: string
  room: string | null
  teacherId: number | null
  topic: string | null
  status: SessionStatus
  note: string | null
}

export interface ClassSessionDetail extends ClassSession {
  className: string
  courseName: string
  teacherName: string | null
  attendedCount: number
  totalStudents: number
}

export interface Enrollment extends BaseEntity {
  studentId: number
  classId: number
  enrollDate: string
  status: EnrollmentStatus
  /** Học phí chốt cho học viên này (có thể khác giá gốc do giảm giá) */
  agreedFee: number
  /** Cach tinh hoc phi rieng; default = hoc phi mac dinh cua lop. */
  feeType: 'default' | 'monthly' | 'per_session' | 'fixed'
  /** Muc theo thang, don gia buoi hoac muc co dinh tuy feeType. */
  customFee: number | null
  discount: number
  surcharge: number
  /** So phai thanh toan nhap truc tiep, uu tien cao nhat. */
  payableOverride: number | null
  note: string | null
}

export interface EnrollmentDetail extends Enrollment {
  studentCode: string
  studentName: string
  studentPhone: string | null
  className: string
  courseName: string
  defaultFee: number
  calculatedFee: number
  payableAmount: number
  eligibleSessionCount: number
  totalSessionCount: number
  billableMonthCount: number
  paidAmount: number
  remainingAmount: number
}

export interface TuitionAdjustment extends BaseEntity {
  enrollmentId: number
  originalPayable: number
  adjustedPayable: number
  beforeSnapshot: string
  afterSnapshot: string
  reason: string | null
  adjustedBy: number | null
  adjustedByName: string | null
}

export interface Attendance extends BaseEntity {
  sessionId: number
  studentId: number
  status: AttendanceStatus
  note: string | null
  markedBy: number | null
  markedAt: number
}

export interface AttendanceDetail extends Attendance {
  studentCode: string
  studentName: string
}

export interface Payment extends BaseEntity {
  code: string
  studentId: number
  enrollmentId: number | null
  amount: number
  method: PaymentMethod
  status: PaymentStatus
  paidDate: string
  note: string | null
  createdBy: number | null
}

export interface PaymentDetail extends Payment {
  studentCode: string
  studentName: string
  studentPhone: string | null
  className: string | null
  courseName: string | null
  createdByName: string | null
}

export interface Role extends BaseEntity {
  code: string
  name: string
  description: string | null
  isSystem: number
}

export interface RoleWithPermissions extends Role {
  permissions: Permission[]
  userCount: number
}

export interface User extends BaseEntity {
  username: string
  fullName: string
  email: string | null
  phone: string | null
  roleId: number
  teacherId: number | null
  avatar: string | null
  isActive: number
  lastLoginAt: number | null
  securityQuestion: string | null
}

export interface UserDetail extends User {
  roleCode: string
  roleName: string
}

/** Phiên đăng nhập hiện tại — không bao giờ chứa hash mật khẩu */
export interface AuthUser {
  id: number
  username: string
  fullName: string
  email: string | null
  avatar: string | null
  roleId: number
  roleCode: string
  roleName: string
  teacherId: number | null
  permissions: Permission[]
}

export interface AppSetting extends BaseEntity {
  key: string
  value: string
  group: string
  description: string | null
}

/** Cấu hình trung tâm, dùng khi in phiếu thu và hiển thị header */
export interface CenterSettings {
  centerName: string
  centerAddress: string
  centerPhone: string
  centerEmail: string
  centerTaxCode: string
  receiptPrefix: string
  studentPrefix: string
  teacherPrefix: string
  currency: string
}

export interface ActivityLog extends BaseEntity {
  userId: number | null
  username: string | null
  action: string
  entity: string
  entityId: number | null
  description: string | null
  ipAddress: string | null
  metadata: string | null
}
