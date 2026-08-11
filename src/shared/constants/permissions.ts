/**
 * Hệ thống phân quyền dạng `resource:action`.
 *
 * Quyền được kiểm tra ở CẢ HAI phía:
 *  - Renderer: ẩn/hiện menu, disable nút (UX).
 *  - Main process: chặn thật sự trước khi chạm database (bảo mật).
 * Chỉ kiểm ở renderer là không đủ — DevTools có thể sửa state.
 */

export const PERMISSIONS = {
  // Học viên
  STUDENT_VIEW: 'student:view',
  STUDENT_CREATE: 'student:create',
  STUDENT_UPDATE: 'student:update',
  STUDENT_DELETE: 'student:delete',
  STUDENT_IMPORT: 'student:import',
  STUDENT_EXPORT: 'student:export',

  // Giáo viên
  TEACHER_VIEW: 'teacher:view',
  TEACHER_CREATE: 'teacher:create',
  TEACHER_UPDATE: 'teacher:update',
  TEACHER_DELETE: 'teacher:delete',

  // Khoá học
  COURSE_VIEW: 'course:view',
  COURSE_CREATE: 'course:create',
  COURSE_UPDATE: 'course:update',
  COURSE_DELETE: 'course:delete',

  // Lớp học
  CLASS_VIEW: 'class:view',
  CLASS_CREATE: 'class:create',
  CLASS_UPDATE: 'class:update',
  CLASS_DELETE: 'class:delete',
  CLASS_ENROLL: 'class:enroll',
  CLASS_UPDATE_ENROLLMENT: 'class:update-enrollment',

  // Điểm danh
  ATTENDANCE_VIEW: 'attendance:view',
  ATTENDANCE_MARK: 'attendance:mark',

  // Học phí
  PAYMENT_VIEW: 'payment:view',
  PAYMENT_CREATE: 'payment:create',
  PAYMENT_UPDATE: 'payment:update',
  PAYMENT_TUITION_UPDATE: 'payment:tuition-update',
  PAYMENT_DELETE: 'payment:delete',
  PAYMENT_PRINT: 'payment:print',

  // Lịch học
  SCHEDULE_VIEW: 'schedule:view',
  SCHEDULE_MANAGE: 'schedule:manage',

  // Nhân viên / tài khoản
  USER_VIEW: 'user:view',
  USER_CREATE: 'user:create',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',
  USER_RESET_PASSWORD: 'user:reset-password',

  // Báo cáo
  REPORT_VIEW: 'report:view',
  REPORT_EXPORT: 'report:export',

  // Hệ thống
  SETTING_VIEW: 'setting:view',
  SETTING_UPDATE: 'setting:update',
  LOG_VIEW: 'log:view',
  DASHBOARD_VIEW: 'dashboard:view'
} as const

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS)

/** Nhóm quyền để hiển thị dạng cây (Tree) trong màn hình phân quyền */
export const PERMISSION_GROUPS: { key: string; label: string; permissions: Permission[] }[] = [
  {
    key: 'dashboard',
    label: 'Tổng quan',
    permissions: [PERMISSIONS.DASHBOARD_VIEW]
  },
  {
    key: 'student',
    label: 'Học viên',
    permissions: [
      PERMISSIONS.STUDENT_VIEW,
      PERMISSIONS.STUDENT_CREATE,
      PERMISSIONS.STUDENT_UPDATE,
      PERMISSIONS.STUDENT_DELETE,
      PERMISSIONS.STUDENT_IMPORT,
      PERMISSIONS.STUDENT_EXPORT
    ]
  },
  {
    key: 'teacher',
    label: 'Giáo viên',
    permissions: [
      PERMISSIONS.TEACHER_VIEW,
      PERMISSIONS.TEACHER_CREATE,
      PERMISSIONS.TEACHER_UPDATE,
      PERMISSIONS.TEACHER_DELETE
    ]
  },
  {
    key: 'course',
    label: 'Khoá học',
    permissions: [
      PERMISSIONS.COURSE_VIEW,
      PERMISSIONS.COURSE_CREATE,
      PERMISSIONS.COURSE_UPDATE,
      PERMISSIONS.COURSE_DELETE
    ]
  },
  {
    key: 'class',
    label: 'Lớp học',
    permissions: [
      PERMISSIONS.CLASS_VIEW,
      PERMISSIONS.CLASS_CREATE,
      PERMISSIONS.CLASS_UPDATE,
      PERMISSIONS.CLASS_DELETE,
      PERMISSIONS.CLASS_ENROLL,
      PERMISSIONS.CLASS_UPDATE_ENROLLMENT
    ]
  },
  {
    key: 'attendance',
    label: 'Điểm danh',
    permissions: [PERMISSIONS.ATTENDANCE_VIEW, PERMISSIONS.ATTENDANCE_MARK]
  },
  {
    key: 'payment',
    label: 'Học phí',
    permissions: [
      PERMISSIONS.PAYMENT_VIEW,
      PERMISSIONS.PAYMENT_CREATE,
      PERMISSIONS.PAYMENT_UPDATE,
      PERMISSIONS.PAYMENT_TUITION_UPDATE,
      PERMISSIONS.PAYMENT_DELETE,
      PERMISSIONS.PAYMENT_PRINT
    ]
  },
  {
    key: 'schedule',
    label: 'Lịch học',
    permissions: [PERMISSIONS.SCHEDULE_VIEW, PERMISSIONS.SCHEDULE_MANAGE]
  },
  {
    key: 'user',
    label: 'Nhân viên & tài khoản',
    permissions: [
      PERMISSIONS.USER_VIEW,
      PERMISSIONS.USER_CREATE,
      PERMISSIONS.USER_UPDATE,
      PERMISSIONS.USER_DELETE,
      PERMISSIONS.USER_RESET_PASSWORD
    ]
  },
  {
    key: 'report',
    label: 'Báo cáo',
    permissions: [PERMISSIONS.REPORT_VIEW, PERMISSIONS.REPORT_EXPORT]
  },
  {
    key: 'system',
    label: 'Hệ thống',
    permissions: [PERMISSIONS.SETTING_VIEW, PERMISSIONS.SETTING_UPDATE, PERMISSIONS.LOG_VIEW]
  }
]

export const PERMISSION_LABELS: Record<Permission, string> = {
  'dashboard:view': 'Xem tổng quan',
  'student:view': 'Xem học viên',
  'student:create': 'Thêm học viên',
  'student:update': 'Sửa học viên',
  'student:delete': 'Xoá học viên',
  'student:import': 'Nhập Excel',
  'student:export': 'Xuất Excel',
  'teacher:view': 'Xem giáo viên',
  'teacher:create': 'Thêm giáo viên',
  'teacher:update': 'Sửa giáo viên',
  'teacher:delete': 'Xoá giáo viên',
  'course:view': 'Xem khoá học',
  'course:create': 'Thêm khoá học',
  'course:update': 'Sửa khoá học',
  'course:delete': 'Xoá khoá học',
  'class:view': 'Xem lớp học',
  'class:create': 'Thêm lớp học',
  'class:update': 'Sửa lớp học',
  'class:delete': 'Xoá lớp học',
  'class:enroll': 'Xếp lớp học viên',
  'class:update-enrollment': 'Sửa ngày ghi danh',
  'attendance:view': 'Xem điểm danh',
  'attendance:mark': 'Thực hiện điểm danh',
  'payment:view': 'Xem học phí',
  'payment:create': 'Lập phiếu thu',
  'payment:update': 'Sửa phiếu thu',
  'payment:tuition-update': 'Sửa học phí học viên',
  'payment:delete': 'Xoá phiếu thu',
  'payment:print': 'In / xuất PDF phiếu thu',
  'schedule:view': 'Xem lịch học',
  'schedule:manage': 'Quản lý lịch học',
  'user:view': 'Xem nhân viên',
  'user:create': 'Thêm nhân viên',
  'user:update': 'Sửa nhân viên',
  'user:delete': 'Xoá nhân viên',
  'user:reset-password': 'Đặt lại mật khẩu',
  'report:view': 'Xem báo cáo',
  'report:export': 'Xuất báo cáo',
  'setting:view': 'Xem cấu hình',
  'setting:update': 'Sửa cấu hình',
  'log:view': 'Xem nhật ký hệ thống'
}

/** Mã vai trò mặc định được seed sẵn khi khởi tạo database */
export const ROLE_CODES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  TEACHER: 'teacher',
  CASHIER: 'cashier'
} as const
export type RoleCode = (typeof ROLE_CODES)[keyof typeof ROLE_CODES]

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Quản trị viên',
  manager: 'Quản lý',
  teacher: 'Giáo viên',
  cashier: 'Thu ngân'
}

/** Bộ quyền mặc định cho từng vai trò (có thể chỉnh lại trong UI) */
export const DEFAULT_ROLE_PERMISSIONS: Record<RoleCode, Permission[]> = {
  admin: ALL_PERMISSIONS,

  manager: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.STUDENT_VIEW,
    PERMISSIONS.STUDENT_CREATE,
    PERMISSIONS.STUDENT_UPDATE,
    PERMISSIONS.STUDENT_DELETE,
    PERMISSIONS.STUDENT_IMPORT,
    PERMISSIONS.STUDENT_EXPORT,
    PERMISSIONS.TEACHER_VIEW,
    PERMISSIONS.TEACHER_CREATE,
    PERMISSIONS.TEACHER_UPDATE,
    PERMISSIONS.COURSE_VIEW,
    PERMISSIONS.COURSE_CREATE,
    PERMISSIONS.COURSE_UPDATE,
    PERMISSIONS.CLASS_VIEW,
    PERMISSIONS.CLASS_CREATE,
    PERMISSIONS.CLASS_UPDATE,
    PERMISSIONS.CLASS_ENROLL,
    PERMISSIONS.ATTENDANCE_VIEW,
    PERMISSIONS.ATTENDANCE_MARK,
    PERMISSIONS.PAYMENT_VIEW,
    PERMISSIONS.PAYMENT_CREATE,
    PERMISSIONS.PAYMENT_PRINT,
    PERMISSIONS.SCHEDULE_VIEW,
    PERMISSIONS.SCHEDULE_MANAGE,
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.REPORT_EXPORT,
    PERMISSIONS.USER_VIEW,
    PERMISSIONS.SETTING_VIEW
  ],

  teacher: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.STUDENT_VIEW,
    PERMISSIONS.CLASS_VIEW,
    PERMISSIONS.COURSE_VIEW,
    PERMISSIONS.ATTENDANCE_VIEW,
    PERMISSIONS.ATTENDANCE_MARK,
    PERMISSIONS.SCHEDULE_VIEW
  ],

  cashier: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.STUDENT_VIEW,
    PERMISSIONS.CLASS_VIEW,
    PERMISSIONS.COURSE_VIEW,
    PERMISSIONS.PAYMENT_VIEW,
    PERMISSIONS.PAYMENT_CREATE,
    PERMISSIONS.PAYMENT_UPDATE,
    PERMISSIONS.PAYMENT_PRINT,
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.REPORT_EXPORT
  ]
}
