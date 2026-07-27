import { z } from 'zod'
import {
  ClassStatus,
  CourseStatus,
  Gender,
  PaymentMethod,
  PaymentStatus,
  SessionStatus,
  StudentStatus,
  TeacherStatus
} from '@shared/constants/enums'

/* ------------------------------------------------------------------ *
 * Schema Zod cho toàn bộ form.
 *
 * Đây là lớp kiểm tra THỨ NHẤT — phản hồi tức thì cho người dùng. Lớp thứ hai
 * nằm ở service của main process; hai lớp cố ý trùng nhau vì lớp đầu có thể
 * bị bỏ qua nếu ai đó gọi thẳng IPC.
 * ------------------------------------------------------------------ */

const phone = z
  .string()
  .trim()
  .regex(/^[0-9+\-\s()]{8,15}$/, 'Số điện thoại không hợp lệ')
  .or(z.literal(''))
  .nullable()
  .optional()

const email = z
  .string()
  .trim()
  .email('Email không hợp lệ')
  .or(z.literal(''))
  .nullable()
  .optional()

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày không hợp lệ')
  .nullable()
  .optional()

const time = z.string().regex(/^\d{2}:\d{2}$/, 'Giờ không hợp lệ')

/* ============================ AUTH ============================ */

export const loginSchema = z.object({
  username: z.string().trim().min(1, 'Vui lòng nhập tên đăng nhập'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
  remember: z.boolean().optional()
})
export type LoginForm = z.infer<typeof loginSchema>

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Nhập mật khẩu hiện tại'),
    newPassword: z.string().min(6, 'Mật khẩu mới tối thiểu 6 ký tự'),
    confirmPassword: z.string().min(1, 'Nhập lại mật khẩu mới')
  })
  // refine ở cấp object mới so sánh được hai trường với nhau
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: 'Mật khẩu nhập lại không khớp',
    path: ['confirmPassword']
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    message: 'Mật khẩu mới phải khác mật khẩu hiện tại',
    path: ['newPassword']
  })
export type ChangePasswordForm = z.infer<typeof changePasswordSchema>

export const forgotPasswordSchema = z
  .object({
    username: z.string().trim().min(1, 'Nhập tên đăng nhập'),
    securityAnswer: z.string().trim().min(1, 'Nhập câu trả lời'),
    newPassword: z.string().min(6, 'Mật khẩu mới tối thiểu 6 ký tự'),
    confirmPassword: z.string().min(1, 'Nhập lại mật khẩu mới')
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: 'Mật khẩu nhập lại không khớp',
    path: ['confirmPassword']
  })
export type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>

/* ============================ STUDENT ============================ */

export const studentSchema = z.object({
  code: z.string().trim().max(20, 'Mã tối đa 20 ký tự').optional(),
  fullName: z.string().trim().min(2, 'Họ tên tối thiểu 2 ký tự').max(100, 'Họ tên tối đa 100 ký tự'),
  gender: z.nativeEnum(Gender),
  birthDate: isoDate,
  email,
  phone,
  address: z.string().trim().max(255).nullable().optional(),
  /** Lớp ở trường phổ thông — 10A1, 6A3... */
  schoolClass: z.string().trim().max(50, 'Tối đa 50 ký tự').nullable().optional(),
  guardianName: z.string().trim().max(100).nullable().optional(),
  guardianPhone: phone,
  note: z.string().trim().max(500).nullable().optional(),
  status: z.nativeEnum(StudentStatus)
})
export type StudentForm = z.infer<typeof studentSchema>

/* ============================ TEACHER ============================ */

export const teacherSchema = z.object({
  code: z.string().trim().max(20).optional(),
  fullName: z.string().trim().min(2, 'Họ tên tối thiểu 2 ký tự').max(100),
  gender: z.nativeEnum(Gender),
  birthDate: isoDate,
  email,
  phone,
  address: z.string().trim().max(255).nullable().optional(),
  specialization: z.string().trim().max(120).nullable().optional(),
  degree: z.string().trim().max(60).nullable().optional(),
  salary: z.number({ invalid_type_error: 'Nhập số' }).min(0, 'Lương không được âm'),
  hireDate: isoDate,
  status: z.nativeEnum(TeacherStatus),
  note: z.string().trim().max(500).nullable().optional()
})
export type TeacherForm = z.infer<typeof teacherSchema>

/* ============================ COURSE ============================ */

export const courseSchema = z.object({
  code: z.string().trim().max(20).optional(),
  name: z.string().trim().min(2, 'Tên khoá học tối thiểu 2 ký tự').max(150),
  description: z.string().trim().max(1000).nullable().optional(),
  tuitionFee: z.number().min(0, 'Học phí không được âm'),
  durationHours: z.number().min(0, 'Thời lượng không được âm').max(10000),
  totalSessions: z.number().min(0, 'Số buổi không được âm').max(1000),
  status: z.nativeEnum(CourseStatus)
})
export type CourseForm = z.infer<typeof courseSchema>

/* ============================ CLASS ============================ */

export const classScheduleSchema = z
  .object({
    weekday: z.number().min(0).max(6),
    startTime: time,
    endTime: time,
    room: z.string().trim().max(50).nullable().optional()
  })
  .refine((v) => v.startTime < v.endTime, {
    message: 'Giờ kết thúc phải sau giờ bắt đầu',
    path: ['endTime']
  })

export const classSchema = z
  .object({
    code: z.string().trim().max(20).optional(),
    name: z.string().trim().min(2, 'Tên lớp tối thiểu 2 ký tự').max(150),
    courseId: z.number({ required_error: 'Chọn khoá học' }).min(1, 'Chọn khoá học'),
    teacherId: z.number().nullable().optional(),
    room: z.string().trim().max(50).nullable().optional(),
    startDate: isoDate,
    endDate: isoDate,
    maxStudents: z.number().min(1, 'Sĩ số tối thiểu 1').max(500),
    status: z.nativeEnum(ClassStatus),
    note: z.string().trim().max(500).nullable().optional(),
    schedules: z.array(classScheduleSchema).min(1, 'Thêm ít nhất một khung giờ học')
  })
  .refine((v) => !v.startDate || !v.endDate || v.startDate <= v.endDate, {
    message: 'Ngày kết thúc phải sau ngày bắt đầu',
    path: ['endDate']
  })
export type ClassForm = z.infer<typeof classSchema>

/* ============================ SESSION ============================ */

export const sessionSchema = z
  .object({
    classId: z.number().min(1, 'Chọn lớp học'),
    sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Chọn ngày học'),
    startTime: time,
    endTime: time,
    room: z.string().trim().max(50).nullable().optional(),
    teacherId: z.number().nullable().optional(),
    topic: z.string().trim().max(200).nullable().optional(),
    status: z.nativeEnum(SessionStatus),
    note: z.string().trim().max(500).nullable().optional()
  })
  .refine((v) => v.startTime < v.endTime, {
    message: 'Giờ kết thúc phải sau giờ bắt đầu',
    path: ['endTime']
  })
export type SessionForm = z.infer<typeof sessionSchema>

/* ============================ PAYMENT ============================ */

export const paymentSchema = z.object({
  code: z.string().trim().max(30).optional(),
  studentId: z.number({ required_error: 'Chọn học viên' }).min(1, 'Chọn học viên'),
  enrollmentId: z.number().nullable().optional(),
  amount: z.number().min(1000, 'Số tiền tối thiểu 1.000 ₫'),
  method: z.nativeEnum(PaymentMethod),
  status: z.nativeEnum(PaymentStatus),
  paidDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Chọn ngày thu'),
  note: z.string().trim().max(500).nullable().optional()
})
export type PaymentForm = z.infer<typeof paymentSchema>

/* ============================ USER / ROLE ============================ */

export const userSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'Tối thiểu 3 ký tự')
    .max(32, 'Tối đa 32 ký tự')
    .regex(/^[a-zA-Z0-9._-]+$/, 'Chỉ gồm chữ, số, dấu chấm, gạch dưới, gạch ngang'),
  password: z.string().max(64).optional().or(z.literal('')),
  fullName: z.string().trim().min(2, 'Họ tên tối thiểu 2 ký tự').max(100),
  email,
  phone,
  roleId: z.number({ required_error: 'Chọn vai trò' }).min(1, 'Chọn vai trò'),
  teacherId: z.number().nullable().optional(),
  isActive: z.number().min(0).max(1),
  securityQuestion: z.string().trim().max(200).nullable().optional(),
  securityAnswer: z.string().trim().max(200).nullable().optional()
})
export type UserForm = z.infer<typeof userSchema>

export const roleSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, 'Tối thiểu 2 ký tự')
    .max(32)
    .regex(/^[a-z0-9_-]+$/, 'Chỉ gồm chữ thường, số, gạch dưới, gạch ngang'),
  name: z.string().trim().min(2, 'Tên vai trò tối thiểu 2 ký tự').max(100),
  description: z.string().trim().max(255).nullable().optional(),
  permissions: z.array(z.string())
})
export type RoleForm = z.infer<typeof roleSchema>

/* ============================ SETTING ============================ */

const prefix = z
  .string()
  .trim()
  .regex(/^[A-Z]{1,5}$/, 'Tiền tố là 1–5 chữ cái in hoa')

export const settingSchema = z.object({
  centerName: z.string().trim().min(1, 'Nhập tên trung tâm').max(150),
  centerAddress: z.string().trim().max(255).optional(),
  centerPhone: z.string().trim().max(30).optional(),
  centerEmail: z.string().trim().email('Email không hợp lệ').or(z.literal('')).optional(),
  centerTaxCode: z.string().trim().max(30).optional(),
  receiptPrefix: prefix,
  studentPrefix: prefix,
  teacherPrefix: prefix
})
export type SettingForm = z.infer<typeof settingSchema>
