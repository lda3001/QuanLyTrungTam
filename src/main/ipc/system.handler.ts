import { app, BrowserWindow } from 'electron'
import { registerHandler, registerListener } from './handler-factory'
import { IPC } from '@shared/ipc/channels'
import { PERMISSIONS } from '@shared/constants/permissions'
import { paymentService } from '../services/payment.service'
import { userService, roleService } from '../services/user.service'
import { authService } from '../services/auth.service'
import { dashboardService, reportService, settingService } from '../services/report.service'
import { fileService } from '../services/file.service'
import { logRepository } from '../repositories/log.repository'
import { getDbFilePath } from '../database/connection'
import type {
  AdminResetPasswordInput,
  DebtQuery,
  ExportPdfRequest,
  ExportRequest,
  LogQuery,
  PaymentInput,
  PaymentQuery,
  ReportRange,
  RoleInput,
  UserInput,
  UserQuery
} from '@shared/types/dto'

export function registerPaymentHandlers(): void {
  const P = PERMISSIONS

  registerHandler(IPC.PAYMENT_LIST, { permission: P.PAYMENT_VIEW }, (q: PaymentQuery) => paymentService.list(q))
  registerHandler(IPC.PAYMENT_GET, { permission: P.PAYMENT_VIEW }, (id: number) => paymentService.get(id))
  registerHandler(IPC.PAYMENT_CREATE, { permission: P.PAYMENT_CREATE }, (i: PaymentInput) => paymentService.create(i))
  registerHandler(IPC.PAYMENT_UPDATE, { permission: P.PAYMENT_UPDATE }, (id: number, i: PaymentInput) =>
    paymentService.update(id, i)
  )
  registerHandler(IPC.PAYMENT_DELETE, { permission: P.PAYMENT_DELETE }, (id: number) => paymentService.remove(id))
  registerHandler(IPC.PAYMENT_DEBTS, { permission: P.PAYMENT_VIEW }, (q: DebtQuery) => paymentService.debts(q))
  registerHandler(IPC.PAYMENT_RECEIPT, { permission: P.PAYMENT_PRINT }, (id: number) => paymentService.receipt(id))
  registerHandler(IPC.PAYMENT_STUDENT_ENROLLMENTS, { permission: P.PAYMENT_VIEW }, (id: number) =>
    paymentService.studentEnrollments(id)
  )
}

export function registerUserHandlers(): void {
  const P = PERMISSIONS

  registerHandler(IPC.USER_LIST, { permission: P.USER_VIEW }, (q: UserQuery) => userService.list(q))
  registerHandler(IPC.USER_GET, { permission: P.USER_VIEW }, (id: number) => userService.get(id))
  registerHandler(IPC.USER_CREATE, { permission: P.USER_CREATE }, (i: UserInput) => userService.create(i))
  registerHandler(IPC.USER_UPDATE, { permission: P.USER_UPDATE }, (id: number, i: UserInput) =>
    userService.update(id, i)
  )
  registerHandler(IPC.USER_DELETE, { permission: P.USER_DELETE }, (id: number) => userService.remove(id))
  registerHandler(IPC.USER_RESET_PASSWORD, { permission: P.USER_RESET_PASSWORD }, (i: AdminResetPasswordInput) =>
    authService.adminResetPassword(i.userId, i.newPassword)
  )

  registerHandler(IPC.ROLE_LIST, { permission: P.USER_VIEW }, () => roleService.list())
  registerHandler(IPC.ROLE_CREATE, { permission: P.USER_CREATE }, (i: RoleInput) => roleService.create(i))
  registerHandler(IPC.ROLE_UPDATE, { permission: P.USER_UPDATE }, (id: number, i: RoleInput) =>
    roleService.update(id, i)
  )
  registerHandler(IPC.ROLE_DELETE, { permission: P.USER_DELETE }, (id: number) => roleService.remove(id))
  registerHandler(IPC.ROLE_OPTIONS, { permission: P.USER_VIEW }, () => roleService.options())
}

export function registerReportHandlers(): void {
  const P = PERMISSIONS

  registerHandler(IPC.DASHBOARD_DATA, { permission: P.DASHBOARD_VIEW }, () => dashboardService.data())

  registerHandler(IPC.REPORT_REVENUE, { permission: P.REPORT_VIEW }, (r: ReportRange & { groupBy?: 'day' | 'month' }) =>
    reportService.revenue(r)
  )
  registerHandler(IPC.REPORT_TUITION, { permission: P.REPORT_VIEW }, (r: ReportRange) => reportService.tuition(r))
  registerHandler(IPC.REPORT_ATTENDANCE, { permission: P.REPORT_VIEW }, (r: ReportRange) => reportService.attendance(r))
  registerHandler(IPC.REPORT_STUDENT, { permission: P.REPORT_VIEW }, (r: ReportRange) => reportService.students(r))
  registerHandler(IPC.REPORT_TEACHER, { permission: P.REPORT_VIEW }, (r: ReportRange) => reportService.teachers(r))
}

export function registerSystemHandlers(): void {
  const P = PERMISSIONS

  registerHandler(IPC.SETTING_GET_ALL, { permission: P.SETTING_VIEW }, () => settingService.getAll())
  registerHandler(IPC.SETTING_UPDATE, { permission: P.SETTING_UPDATE }, (values: Record<string, string>) =>
    settingService.update(values)
  )

  registerHandler(IPC.LOG_LIST, { permission: P.LOG_VIEW }, (q: LogQuery) => logRepository.list(q ?? {}))

  // Xuất tệp không gắn quyền riêng: dữ liệu truyền vào đã do màn hình có quyền
  // đọc chuẩn bị sẵn, và người dùng phải tự chọn nơi lưu.
  registerHandler(IPC.FILE_EXPORT_EXCEL, {}, (req: ExportRequest) => fileService.exportExcel(req))
  registerHandler(IPC.FILE_EXPORT_PDF, {}, (req: ExportPdfRequest) => fileService.exportPdf(req))
  registerHandler(IPC.FILE_IMPORT_EXCEL, {}, () => fileService.importExcel())
  registerHandler(IPC.FILE_PRINT_HTML, {}, (html: string) => fileService.printHtml(html))

  registerHandler(IPC.APP_INFO, { public: true }, () => ({
    version: app.getVersion(),
    platform: process.platform,
    dbPath: getDbFilePath()
  }))

  registerListener(IPC.WINDOW_MINIMIZE, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })

  registerListener(IPC.WINDOW_MAXIMIZE, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    win.isMaximized() ? win.unmaximize() : win.maximize()
  })

  registerListener(IPC.WINDOW_CLOSE, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })
}
