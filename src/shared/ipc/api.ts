import type { IpcResult, PageResult, SelectOption } from '../types/common'
import type { UpdateStatus } from '../types/update'
import type {
  ActivityLog,
  AppSetting,
  AttendanceDetail,
  AuthUser,
  ClassRoomDetail,
  ClassSession,
  ClassSessionDetail,
  Course,
  EnrollmentDetail,
  PaymentDetail,
  TuitionAdjustment,
  Role,
  RoleWithPermissions,
  Student,
  Teacher,
  UserDetail
} from '../types/entities'
import type {
  AdminResetPasswordInput,
  AttendanceGridQuery,
  AttendanceGridResult,
  AttendanceHistoryQuery,
  AttendanceHistoryRow,
  AttendanceReportRow,
  ChangePasswordInput,
  ClassInput,
  ClassQuery,
  CourseInput,
  CourseQuery,
  DashboardData,
  DebtQuery,
  DebtRow,
  EnrollImportInput,
  EnrollInput,
  UpdateEnrollmentInput,
  ExportPdfRequest,
  ExportRequest,
  GenerateSessionsInput,
  ImportResult,
  LoginInput,
  LogQuery,
  MarkAttendanceInput,
  MarkMultiAttendanceInput,
  MoveSessionInput,
  PaymentInput,
  PaymentQuery,
  ReceiptData,
  ReportRange,
  ResetPasswordInput,
  RevenueReport,
  RoleInput,
  SessionInput,
  SessionQuery,
  StudentImportRow,
  StudentInput,
  StudentQuery,
  StudentReportRow,
  TeacherInput,
  TeacherQuery,
  TeacherReportRow,
  TuitionReportRow,
  TuitionAdjustmentInput,
  UserInput,
  UserQuery
} from '../types/dto'

type R<T> = Promise<IpcResult<T>>

export interface AppApi {
  auth: {
    login(input: LoginInput): R<AuthUser>
    logout(): R<boolean>
    me(): R<AuthUser | null>
    changePassword(input: ChangePasswordInput): R<boolean>
    securityQuestion(username: string): R<string | null>
    resetPassword(input: ResetPasswordInput): R<boolean>
  }

  students: {
    list(query: StudentQuery): R<PageResult<Student>>
    get(id: number): R<Student>
    create(input: StudentInput): R<Student>
    update(id: number, input: StudentInput): R<Student>
    remove(id: number): R<boolean>
    bulkRemove(ids: number[]): R<number>
    options(keyword?: string): R<SelectOption[]>
    /** Các lớp ở trường phổ thông đang có, dùng cho ô lọc */
    schoolClasses(): R<string[]>
    importRows(rows: StudentImportRow[]): R<ImportResult>
    importTemplate(): R<string | null>
    classes(studentId: number): R<EnrollmentDetail[]>
    payments(studentId: number): R<PaymentDetail[]>
  }

  teachers: {
    list(query: TeacherQuery): R<PageResult<Teacher>>
    get(id: number): R<Teacher>
    create(input: TeacherInput): R<Teacher>
    update(id: number, input: TeacherInput): R<Teacher>
    remove(id: number): R<boolean>
    options(): R<SelectOption[]>
  }

  courses: {
    list(query: CourseQuery): R<PageResult<Course>>
    get(id: number): R<Course>
    create(input: CourseInput): R<Course>
    update(id: number, input: CourseInput): R<Course>
    remove(id: number): R<boolean>
    options(): R<SelectOption[]>
  }

  classes: {
    list(query: ClassQuery): R<PageResult<ClassRoomDetail>>
    get(id: number): R<ClassRoomDetail>
    create(input: ClassInput): R<ClassRoomDetail>
    update(id: number, input: ClassInput): R<ClassRoomDetail>
    remove(id: number): R<boolean>
    options(): R<SelectOption[]>
    students(classId: number): R<EnrollmentDetail[]>
    availableStudents(classId: number, keyword?: string): R<Student[]>
    enroll(input: EnrollInput): R<number>
    updateEnrollment(input: UpdateEnrollmentInput): R<EnrollmentDetail>
    unenroll(enrollmentId: number): R<boolean>
    /** Xếp học viên vào lớp hàng loạt từ file Excel (chỉ khớp HV đã có) */
    enrollImport(input: EnrollImportInput): R<ImportResult>
    /** Tải file Excel mẫu để xếp lớp */
    enrollTemplate(): R<string | null>
  }

  sessions: {
    list(query: SessionQuery): R<ClassSessionDetail[]>
    get(id: number): R<ClassSessionDetail>
    create(input: SessionInput): R<ClassSession>
    update(id: number, input: SessionInput): R<ClassSession>
    remove(id: number): R<boolean>
    move(input: MoveSessionInput): R<ClassSession>
    generate(input: GenerateSessionsInput): R<number>
  }

  attendance: {
    bySession(sessionId: number): R<AttendanceDetail[]>
    mark(input: MarkAttendanceInput): R<number>
    markMulti(input: MarkMultiAttendanceInput): R<number>
    history(query: AttendanceHistoryQuery): R<PageResult<AttendanceHistoryRow>>
    grid(query: AttendanceGridQuery): R<AttendanceGridResult>
    studentSummary(
      studentId: number
    ): R<{ present: number; excused: number; absent: number; late: number; total: number }>
  }

  payments: {
    list(query: PaymentQuery): R<PageResult<PaymentDetail>>
    get(id: number): R<PaymentDetail>
    create(input: PaymentInput): R<PaymentDetail>
    update(id: number, input: PaymentInput): R<PaymentDetail>
    remove(id: number): R<boolean>
    debts(query: DebtQuery): R<PageResult<DebtRow>>
    receipt(paymentId: number): R<ReceiptData>
    studentEnrollments(studentId: number): R<EnrollmentDetail[]>
    adjustTuition(enrollmentId: number, input: TuitionAdjustmentInput): R<boolean>
    tuitionHistory(enrollmentId: number): R<TuitionAdjustment[]>
  }

  users: {
    list(query: UserQuery): R<PageResult<UserDetail>>
    get(id: number): R<UserDetail>
    create(input: UserInput): R<UserDetail>
    update(id: number, input: UserInput): R<UserDetail>
    remove(id: number): R<boolean>
    resetPassword(input: AdminResetPasswordInput): R<boolean>
  }

  roles: {
    list(): R<RoleWithPermissions[]>
    create(input: RoleInput): R<Role>
    update(id: number, input: RoleInput): R<Role>
    remove(id: number): R<boolean>
    options(): R<SelectOption[]>
  }

  dashboard: {
    data(): R<DashboardData>
  }

  reports: {
    revenue(range: ReportRange & { groupBy?: 'day' | 'month' }): R<RevenueReport>
    tuition(range: ReportRange): R<TuitionReportRow[]>
    attendance(range: ReportRange): R<AttendanceReportRow[]>
    students(range: ReportRange): R<StudentReportRow[]>
    teachers(range: ReportRange): R<TeacherReportRow[]>
  }

  settings: {
    getAll(): R<AppSetting[]>
    update(values: Record<string, string>): R<boolean>
  }

  logs: {
    list(query: LogQuery): R<PageResult<ActivityLog>>
  }

  files: {
    exportExcel(req: ExportRequest): R<string | null>
    exportPdf(req: ExportPdfRequest): R<string | null>
    importExcel(): R<{ fileName: string; rows: Record<string, unknown>[] } | null>
    importExcelRaw(): R<{ fileName: string; matrix: unknown[][] } | null>
    printHtml(html: string): R<boolean>
  }

  app: {
    info(): R<{ version: string; platform: string; dbPath: string }>
    checkForUpdates(): R<UpdateStatus>
    downloadUpdate(): R<UpdateStatus>
    installUpdate(): void
    onUpdateStatus(listener: (status: UpdateStatus) => void): () => void
    minimize(): void
    maximize(): void
    close(): void
  }
}
