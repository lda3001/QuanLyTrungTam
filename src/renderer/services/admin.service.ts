import { api, call } from './ipc-client'
import { browserFileService } from './file-web.service'
import type { PageResult, SelectOption } from '@shared/types/common'
import type {
  ActivityLog,
  AppSetting,
  EnrollmentDetail,
  PaymentDetail,
  Role,
  RoleWithPermissions,
  UserDetail
} from '@shared/types/entities'
import type {
  AdminResetPasswordInput,
  AttendanceReportRow,
  DashboardData,
  DebtQuery,
  DebtRow,
  ExportPdfRequest,
  ExportRequest,
  LogQuery,
  PaymentInput,
  PaymentQuery,
  ReceiptData,
  ReportRange,
  RevenueReport,
  RoleInput,
  StudentReportRow,
  TeacherReportRow,
  TuitionReportRow,
  UserInput,
  UserQuery
} from '@shared/types/dto'

export const paymentService = {
  list: (q: PaymentQuery): Promise<PageResult<PaymentDetail>> => call(api().payments.list(q)),
  get: (id: number): Promise<PaymentDetail> => call(api().payments.get(id)),
  create: (i: PaymentInput): Promise<PaymentDetail> => call(api().payments.create(i)),
  update: (id: number, i: PaymentInput): Promise<PaymentDetail> => call(api().payments.update(id, i)),
  remove: (id: number): Promise<boolean> => call(api().payments.remove(id)),
  debts: (q: DebtQuery): Promise<PageResult<DebtRow>> => call(api().payments.debts(q)),
  receipt: (id: number): Promise<ReceiptData> => call(api().payments.receipt(id)),
  studentEnrollments: (id: number): Promise<EnrollmentDetail[]> => call(api().payments.studentEnrollments(id))
}

export const userService = {
  list: (q: UserQuery): Promise<PageResult<UserDetail>> => call(api().users.list(q)),
  get: (id: number): Promise<UserDetail> => call(api().users.get(id)),
  create: (i: UserInput): Promise<UserDetail> => call(api().users.create(i)),
  update: (id: number, i: UserInput): Promise<UserDetail> => call(api().users.update(id, i)),
  remove: (id: number): Promise<boolean> => call(api().users.remove(id)),
  resetPassword: (i: AdminResetPasswordInput): Promise<boolean> => call(api().users.resetPassword(i))
}

export const roleService = {
  list: (): Promise<RoleWithPermissions[]> => call(api().roles.list()),
  create: (i: RoleInput): Promise<Role> => call(api().roles.create(i)),
  update: (id: number, i: RoleInput): Promise<Role> => call(api().roles.update(id, i)),
  remove: (id: number): Promise<boolean> => call(api().roles.remove(id)),
  options: (): Promise<SelectOption[]> => call(api().roles.options())
}

export const dashboardService = {
  data: (): Promise<DashboardData> => call(api().dashboard.data())
}

export const reportService = {
  revenue: (r: ReportRange & { groupBy?: 'day' | 'month' }): Promise<RevenueReport> =>
    call(api().reports.revenue(r)),
  tuition: (r: ReportRange): Promise<TuitionReportRow[]> => call(api().reports.tuition(r)),
  attendance: (r: ReportRange): Promise<AttendanceReportRow[]> => call(api().reports.attendance(r)),
  students: (r: ReportRange): Promise<StudentReportRow[]> => call(api().reports.students(r)),
  teachers: (r: ReportRange): Promise<TeacherReportRow[]> => call(api().reports.teachers(r))
}

export const settingService = {
  getAll: (): Promise<AppSetting[]> => call(api().settings.getAll()),
  update: (values: Record<string, string>): Promise<boolean> => call(api().settings.update(values))
}

export const logService = {
  list: (q: LogQuery): Promise<PageResult<ActivityLog>> => call(api().logs.list(q))
}

/** Use native Windows dialogs/printing in Electron and browser downloads on the web. */
export const fileService = {
  exportExcel: (req: ExportRequest): Promise<string | null> =>
    window.api ? call(api().files.exportExcel(req)) : browserFileService.exportExcel(req),
  exportPdf: (req: ExportPdfRequest): Promise<string | null> =>
    window.api ? call(api().files.exportPdf(req)) : browserFileService.exportPdf(req),
  importExcel: (): Promise<{ fileName: string; rows: Record<string, unknown>[] } | null> =>
    window.api ? call(api().files.importExcel()) : browserFileService.importExcel(),
  importExcelRaw: (): Promise<{ fileName: string; matrix: unknown[][] } | null> =>
    window.api ? call(api().files.importExcelRaw()) : browserFileService.importExcelRaw(),
  printHtml: (html: string): Promise<boolean> =>
    window.api ? call(api().files.printHtml(html)) : browserFileService.printHtml(html)
}

export const appService = {
  info: (): Promise<{ version: string; platform: string; dbPath: string }> => call(api().app.info())
}
