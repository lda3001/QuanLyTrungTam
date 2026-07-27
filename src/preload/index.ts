import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '@shared/ipc/channels'
import type { AppApi } from '@shared/ipc/api'

/**
 * Cầu nối duy nhất giữa renderer và main process.
 *
 * Nguyên tắc:
 *  - KHÔNG bao giờ expose `ipcRenderer` thô. Nếu expose, renderer (hoặc bất kỳ
 *    script nào lọt vào trang) có thể gọi mọi kênh, kể cả kênh nội bộ.
 *  - Chỉ mở đúng những hàm đã liệt kê, mỗi hàm gắn cứng một kênh.
 *  - Không có logic nghiệp vụ ở đây — preload chỉ là ống dẫn.
 */

const invoke = <T>(channel: string, ...args: unknown[]): Promise<T> =>
  ipcRenderer.invoke(channel, ...args) as Promise<T>

const api: AppApi = {
  auth: {
    login: (input) => invoke(IPC.AUTH_LOGIN, input),
    logout: () => invoke(IPC.AUTH_LOGOUT),
    me: () => invoke(IPC.AUTH_ME),
    changePassword: (input) => invoke(IPC.AUTH_CHANGE_PASSWORD, input),
    securityQuestion: (username) => invoke(IPC.AUTH_SECURITY_QUESTION, username),
    resetPassword: (input) => invoke(IPC.AUTH_RESET_PASSWORD, input)
  },

  students: {
    list: (query) => invoke(IPC.STUDENT_LIST, query),
    get: (id) => invoke(IPC.STUDENT_GET, id),
    create: (input) => invoke(IPC.STUDENT_CREATE, input),
    update: (id, input) => invoke(IPC.STUDENT_UPDATE, id, input),
    remove: (id) => invoke(IPC.STUDENT_DELETE, id),
    bulkRemove: (ids) => invoke(IPC.STUDENT_BULK_DELETE, ids),
    options: (keyword) => invoke(IPC.STUDENT_OPTIONS, keyword),
    schoolClasses: () => invoke(IPC.STUDENT_SCHOOL_CLASSES),
    importRows: (rows) => invoke(IPC.STUDENT_IMPORT, rows),
    importTemplate: () => invoke(IPC.STUDENT_IMPORT_TEMPLATE),
    classes: (id) => invoke(IPC.STUDENT_CLASSES, id),
    payments: (id) => invoke(IPC.STUDENT_PAYMENTS, id)
  },

  teachers: {
    list: (query) => invoke(IPC.TEACHER_LIST, query),
    get: (id) => invoke(IPC.TEACHER_GET, id),
    create: (input) => invoke(IPC.TEACHER_CREATE, input),
    update: (id, input) => invoke(IPC.TEACHER_UPDATE, id, input),
    remove: (id) => invoke(IPC.TEACHER_DELETE, id),
    options: () => invoke(IPC.TEACHER_OPTIONS)
  },

  courses: {
    list: (query) => invoke(IPC.COURSE_LIST, query),
    get: (id) => invoke(IPC.COURSE_GET, id),
    create: (input) => invoke(IPC.COURSE_CREATE, input),
    update: (id, input) => invoke(IPC.COURSE_UPDATE, id, input),
    remove: (id) => invoke(IPC.COURSE_DELETE, id),
    options: () => invoke(IPC.COURSE_OPTIONS)
  },

  classes: {
    list: (query) => invoke(IPC.CLASS_LIST, query),
    get: (id) => invoke(IPC.CLASS_GET, id),
    create: (input) => invoke(IPC.CLASS_CREATE, input),
    update: (id, input) => invoke(IPC.CLASS_UPDATE, id, input),
    remove: (id) => invoke(IPC.CLASS_DELETE, id),
    options: () => invoke(IPC.CLASS_OPTIONS),
    students: (id) => invoke(IPC.CLASS_STUDENTS, id),
    availableStudents: (id, keyword) => invoke(IPC.CLASS_AVAILABLE_STUDENTS, id, keyword),
    enroll: (input) => invoke(IPC.CLASS_ENROLL, input),
    unenroll: (id) => invoke(IPC.CLASS_UNENROLL, id),
    enrollImport: (input) => invoke(IPC.CLASS_ENROLL_IMPORT, input),
    enrollTemplate: () => invoke(IPC.CLASS_ENROLL_TEMPLATE)
  },

  sessions: {
    list: (query) => invoke(IPC.SESSION_LIST, query),
    get: (id) => invoke(IPC.SESSION_GET, id),
    create: (input) => invoke(IPC.SESSION_CREATE, input),
    update: (id, input) => invoke(IPC.SESSION_UPDATE, id, input),
    remove: (id) => invoke(IPC.SESSION_DELETE, id),
    move: (input) => invoke(IPC.SESSION_MOVE, input),
    generate: (input) => invoke(IPC.SESSION_GENERATE, input)
  },

  attendance: {
    bySession: (id) => invoke(IPC.ATTENDANCE_BY_SESSION, id),
    mark: (input) => invoke(IPC.ATTENDANCE_MARK, input),
    history: (query) => invoke(IPC.ATTENDANCE_HISTORY, query),
    studentSummary: (id) => invoke(IPC.ATTENDANCE_STUDENT_SUMMARY, id)
  },

  payments: {
    list: (query) => invoke(IPC.PAYMENT_LIST, query),
    get: (id) => invoke(IPC.PAYMENT_GET, id),
    create: (input) => invoke(IPC.PAYMENT_CREATE, input),
    update: (id, input) => invoke(IPC.PAYMENT_UPDATE, id, input),
    remove: (id) => invoke(IPC.PAYMENT_DELETE, id),
    debts: (query) => invoke(IPC.PAYMENT_DEBTS, query),
    receipt: (id) => invoke(IPC.PAYMENT_RECEIPT, id),
    studentEnrollments: (id) => invoke(IPC.PAYMENT_STUDENT_ENROLLMENTS, id)
  },

  users: {
    list: (query) => invoke(IPC.USER_LIST, query),
    get: (id) => invoke(IPC.USER_GET, id),
    create: (input) => invoke(IPC.USER_CREATE, input),
    update: (id, input) => invoke(IPC.USER_UPDATE, id, input),
    remove: (id) => invoke(IPC.USER_DELETE, id),
    resetPassword: (input) => invoke(IPC.USER_RESET_PASSWORD, input)
  },

  roles: {
    list: () => invoke(IPC.ROLE_LIST),
    create: (input) => invoke(IPC.ROLE_CREATE, input),
    update: (id, input) => invoke(IPC.ROLE_UPDATE, id, input),
    remove: (id) => invoke(IPC.ROLE_DELETE, id),
    options: () => invoke(IPC.ROLE_OPTIONS)
  },

  dashboard: {
    data: () => invoke(IPC.DASHBOARD_DATA)
  },

  reports: {
    revenue: (range) => invoke(IPC.REPORT_REVENUE, range),
    tuition: (range) => invoke(IPC.REPORT_TUITION, range),
    attendance: (range) => invoke(IPC.REPORT_ATTENDANCE, range),
    students: (range) => invoke(IPC.REPORT_STUDENT, range),
    teachers: (range) => invoke(IPC.REPORT_TEACHER, range)
  },

  settings: {
    getAll: () => invoke(IPC.SETTING_GET_ALL),
    update: (values) => invoke(IPC.SETTING_UPDATE, values)
  },

  logs: {
    list: (query) => invoke(IPC.LOG_LIST, query)
  },

  files: {
    exportExcel: (req) => invoke(IPC.FILE_EXPORT_EXCEL, req),
    exportPdf: (req) => invoke(IPC.FILE_EXPORT_PDF, req),
    importExcel: () => invoke(IPC.FILE_IMPORT_EXCEL),
    printHtml: (html) => invoke(IPC.FILE_PRINT_HTML, html)
  },

  app: {
    info: () => invoke(IPC.APP_INFO),
    minimize: () => ipcRenderer.send(IPC.WINDOW_MINIMIZE),
    maximize: () => ipcRenderer.send(IPC.WINDOW_MAXIMIZE),
    close: () => ipcRenderer.send(IPC.WINDOW_CLOSE)
  }
}

// contextIsolation bật ⇒ bắt buộc dùng contextBridge.
// Nhánh else chỉ là lưới an toàn khi ai đó lỡ tắt contextIsolation.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error('[preload] Không expose được API:', error)
  }
} else {
  // @ts-expect-error window chưa có thuộc tính api khi contextIsolation tắt
  window.api = api
}
