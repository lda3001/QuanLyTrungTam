/**
 * Các bộ giá trị cố định dùng chung cho cả main & renderer.
 * Dùng object `as const` thay cho `enum` để tương thích `isolatedModules`
 * và tránh sinh runtime code thừa khi bundle.
 */

export const Gender = {
  MALE: 'male',
  FEMALE: 'female',
  OTHER: 'other'
} as const
export type Gender = (typeof Gender)[keyof typeof Gender]

export const GenderLabel: Record<Gender, string> = {
  male: 'Nam',
  female: 'Nữ',
  other: 'Khác'
}

export const StudentStatus = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  GRADUATED: 'graduated',
  DROPPED: 'dropped'
} as const
export type StudentStatus = (typeof StudentStatus)[keyof typeof StudentStatus]

export const StudentStatusLabel: Record<StudentStatus, string> = {
  active: 'Đang học',
  inactive: 'Tạm nghỉ',
  graduated: 'Đã tốt nghiệp',
  dropped: 'Đã nghỉ'
}

export const StudentStatusColor: Record<StudentStatus, string> = {
  active: 'green',
  inactive: 'orange',
  graduated: 'blue',
  dropped: 'red'
}

export const TeacherStatus = {
  ACTIVE: 'active',
  INACTIVE: 'inactive'
} as const
export type TeacherStatus = (typeof TeacherStatus)[keyof typeof TeacherStatus]

export const TeacherStatusLabel: Record<TeacherStatus, string> = {
  active: 'Đang làm việc',
  inactive: 'Đã nghỉ'
}

export const CourseStatus = {
  ACTIVE: 'active',
  INACTIVE: 'inactive'
} as const
export type CourseStatus = (typeof CourseStatus)[keyof typeof CourseStatus]

export const CourseStatusLabel: Record<CourseStatus, string> = {
  active: 'Đang mở',
  inactive: 'Ngừng mở'
}

export const ClassStatus = {
  PLANNED: 'planned',
  ONGOING: 'ongoing',
  FINISHED: 'finished',
  CANCELLED: 'cancelled'
} as const
export type ClassStatus = (typeof ClassStatus)[keyof typeof ClassStatus]

export const ClassStatusLabel: Record<ClassStatus, string> = {
  planned: 'Sắp khai giảng',
  ongoing: 'Đang học',
  finished: 'Đã kết thúc',
  cancelled: 'Đã huỷ'
}

export const ClassStatusColor: Record<ClassStatus, string> = {
  planned: 'blue',
  ongoing: 'green',
  finished: 'default',
  cancelled: 'red'
}

export const EnrollmentStatus = {
  STUDYING: 'studying',
  COMPLETED: 'completed',
  WITHDRAWN: 'withdrawn'
} as const
export type EnrollmentStatus = (typeof EnrollmentStatus)[keyof typeof EnrollmentStatus]

export const EnrollmentStatusLabel: Record<EnrollmentStatus, string> = {
  studying: 'Đang học',
  completed: 'Hoàn thành',
  withdrawn: 'Đã rút'
}

export const AttendanceStatus = {
  PRESENT: 'present',
  EXCUSED: 'excused',
  ABSENT: 'absent',
  LATE: 'late'
} as const
export type AttendanceStatus = (typeof AttendanceStatus)[keyof typeof AttendanceStatus]

export const AttendanceStatusLabel: Record<AttendanceStatus, string> = {
  present: 'Có mặt',
  excused: 'Nghỉ có phép',
  absent: 'Nghỉ không phép',
  late: 'Đi muộn'
}

export const AttendanceStatusColor: Record<AttendanceStatus, string> = {
  present: 'green',
  excused: 'gold',
  absent: 'red',
  late: 'orange'
}

export const PaymentStatus = {
  UNPAID: 'unpaid',
  PARTIAL: 'partial',
  PAID: 'paid',
  REFUNDED: 'refunded'
} as const
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus]

export const PaymentStatusLabel: Record<PaymentStatus, string> = {
  unpaid: 'Chưa đóng',
  partial: 'Đóng một phần',
  paid: 'Đã đóng',
  refunded: 'Đã hoàn tiền'
}

export const PaymentStatusColor: Record<PaymentStatus, string> = {
  unpaid: 'red',
  partial: 'orange',
  paid: 'green',
  refunded: 'purple'
}

export const PaymentMethod = {
  CASH: 'cash',
  TRANSFER: 'transfer',
  CARD: 'card'
} as const
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod]

export const PaymentMethodLabel: Record<PaymentMethod, string> = {
  cash: 'Tiền mặt',
  transfer: 'Chuyển khoản',
  card: 'Quẹt thẻ'
}

export const SessionStatus = {
  SCHEDULED: 'scheduled',
  DONE: 'done',
  CANCELLED: 'cancelled'
} as const
export type SessionStatus = (typeof SessionStatus)[keyof typeof SessionStatus]

export const SessionStatusLabel: Record<SessionStatus, string> = {
  scheduled: 'Chưa diễn ra',
  done: 'Đã dạy',
  cancelled: 'Đã huỷ'
}

/** 0 = Chủ nhật ... 6 = Thứ bảy (khớp với dayjs().day()) */
export const WeekdayLabel: Record<number, string> = {
  0: 'Chủ nhật',
  1: 'Thứ 2',
  2: 'Thứ 3',
  3: 'Thứ 4',
  4: 'Thứ 5',
  5: 'Thứ 6',
  6: 'Thứ 7'
}
