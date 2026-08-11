/**
 * Danh sách kênh IPC. Đặt tập trung một chỗ để main & preload không bao giờ
 * lệch tên kênh — sai một ký tự là lỗi runtime câm lặng.
 *
 * Quy ước: `<domain>:<action>`
 */
export const IPC = {
  // Auth
  AUTH_LOGIN: 'auth:login',
  AUTH_LOGOUT: 'auth:logout',
  AUTH_ME: 'auth:me',
  AUTH_CHANGE_PASSWORD: 'auth:change-password',
  AUTH_SECURITY_QUESTION: 'auth:security-question',
  AUTH_RESET_PASSWORD: 'auth:reset-password',

  // Student
  STUDENT_LIST: 'student:list',
  STUDENT_GET: 'student:get',
  STUDENT_CREATE: 'student:create',
  STUDENT_UPDATE: 'student:update',
  STUDENT_DELETE: 'student:delete',
  STUDENT_BULK_DELETE: 'student:bulk-delete',
  STUDENT_OPTIONS: 'student:options',
  STUDENT_SCHOOL_CLASSES: 'student:school-classes',
  STUDENT_IMPORT: 'student:import',
  STUDENT_IMPORT_TEMPLATE: 'student:import-template',
  STUDENT_CLASSES: 'student:classes',
  STUDENT_PAYMENTS: 'student:payments',

  // Teacher
  TEACHER_LIST: 'teacher:list',
  TEACHER_GET: 'teacher:get',
  TEACHER_CREATE: 'teacher:create',
  TEACHER_UPDATE: 'teacher:update',
  TEACHER_DELETE: 'teacher:delete',
  TEACHER_OPTIONS: 'teacher:options',

  // Course
  COURSE_LIST: 'course:list',
  COURSE_GET: 'course:get',
  COURSE_CREATE: 'course:create',
  COURSE_UPDATE: 'course:update',
  COURSE_DELETE: 'course:delete',
  COURSE_OPTIONS: 'course:options',

  // Class
  CLASS_LIST: 'class:list',
  CLASS_GET: 'class:get',
  CLASS_CREATE: 'class:create',
  CLASS_UPDATE: 'class:update',
  CLASS_DELETE: 'class:delete',
  CLASS_OPTIONS: 'class:options',
  CLASS_STUDENTS: 'class:students',
  CLASS_ENROLL: 'class:enroll',
  CLASS_UNENROLL: 'class:unenroll',
  CLASS_UPDATE_ENROLLMENT: 'class:update-enrollment',
  CLASS_AVAILABLE_STUDENTS: 'class:available-students',
  CLASS_ENROLL_IMPORT: 'class:enroll-import',
  CLASS_ENROLL_TEMPLATE: 'class:enroll-template',

  // Session / Schedule
  SESSION_LIST: 'session:list',
  SESSION_GET: 'session:get',
  SESSION_CREATE: 'session:create',
  SESSION_UPDATE: 'session:update',
  SESSION_DELETE: 'session:delete',
  SESSION_MOVE: 'session:move',
  SESSION_GENERATE: 'session:generate',

  // Attendance
  ATTENDANCE_BY_SESSION: 'attendance:by-session',
  ATTENDANCE_MARK: 'attendance:mark',
  ATTENDANCE_HISTORY: 'attendance:history',
  ATTENDANCE_GRID: 'attendance:grid',
  ATTENDANCE_MARK_MULTI: 'attendance:mark-multi',
  ATTENDANCE_STUDENT_SUMMARY: 'attendance:student-summary',

  // Payment
  PAYMENT_LIST: 'payment:list',
  PAYMENT_GET: 'payment:get',
  PAYMENT_CREATE: 'payment:create',
  PAYMENT_UPDATE: 'payment:update',
  PAYMENT_DELETE: 'payment:delete',
  PAYMENT_DEBTS: 'payment:debts',
  PAYMENT_RECEIPT: 'payment:receipt',
  PAYMENT_STUDENT_ENROLLMENTS: 'payment:student-enrollments',
  PAYMENT_TUITION_ADJUST: 'payment:tuition-adjust',
  PAYMENT_TUITION_HISTORY: 'payment:tuition-history',

  // User & Role
  USER_LIST: 'user:list',
  USER_GET: 'user:get',
  USER_CREATE: 'user:create',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',
  USER_RESET_PASSWORD: 'user:reset-password',
  ROLE_LIST: 'role:list',
  ROLE_CREATE: 'role:create',
  ROLE_UPDATE: 'role:update',
  ROLE_DELETE: 'role:delete',
  ROLE_OPTIONS: 'role:options',

  // Dashboard & Report
  DASHBOARD_DATA: 'dashboard:data',
  REPORT_REVENUE: 'report:revenue',
  REPORT_TUITION: 'report:tuition',
  REPORT_ATTENDANCE: 'report:attendance',
  REPORT_STUDENT: 'report:student',
  REPORT_TEACHER: 'report:teacher',

  // Setting & Log
  SETTING_GET_ALL: 'setting:get-all',
  SETTING_UPDATE: 'setting:update',
  LOG_LIST: 'log:list',

  // Tiện ích hệ thống
  FILE_EXPORT_EXCEL: 'file:export-excel',
  FILE_EXPORT_PDF: 'file:export-pdf',
  FILE_IMPORT_EXCEL: 'file:import-excel',
  FILE_IMPORT_EXCEL_RAW: 'file:import-excel-raw',
  FILE_PRINT_HTML: 'file:print-html',
  APP_INFO: 'app:info',
  APP_UPDATE_CHECK: 'app:update-check',
  APP_UPDATE_DOWNLOAD: 'app:update-download',
  APP_UPDATE_INSTALL: 'app:update-install',
  APP_UPDATE_STATUS: 'app:update-status',
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close'
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
