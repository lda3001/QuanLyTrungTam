import { api, call } from './ipc-client'
import { browserFileService } from './file-web.service'
import type { PageResult, SelectOption } from '@shared/types/common'
import type {
  AttendanceDetail,
  ClassRoomDetail,
  ClassSession,
  ClassSessionDetail,
  Course,
  EnrollmentDetail,
  PaymentDetail,
  Student,
  Teacher
} from '@shared/types/entities'
import type {
  AttendanceGridQuery,
  AttendanceGridResult,
  AttendanceHistoryQuery,
  AttendanceHistoryRow,
  MarkMultiAttendanceInput,
  ClassInput,
  ClassQuery,
  CourseInput,
  CourseQuery,
  EnrollImportInput,
  EnrollInput,
  GenerateSessionsInput,
  ImportResult,
  MarkAttendanceInput,
  MoveSessionInput,
  SessionInput,
  SessionQuery,
  StudentImportRow,
  StudentInput,
  StudentQuery,
  TeacherInput,
  TeacherQuery
} from '@shared/types/dto'

export const studentService = {
  list: (q: StudentQuery): Promise<PageResult<Student>> => call(api().students.list(q)),
  get: (id: number): Promise<Student> => call(api().students.get(id)),
  create: (i: StudentInput): Promise<Student> => call(api().students.create(i)),
  update: (id: number, i: StudentInput): Promise<Student> => call(api().students.update(id, i)),
  remove: (id: number): Promise<boolean> => call(api().students.remove(id)),
  bulkRemove: (ids: number[]): Promise<number> => call(api().students.bulkRemove(ids)),
  options: (keyword?: string): Promise<SelectOption[]> => call(api().students.options(keyword)),
  schoolClasses: (): Promise<string[]> => call(api().students.schoolClasses()),
  importRows: (rows: StudentImportRow[]): Promise<ImportResult> => call(api().students.importRows(rows)),
  importTemplate: (): Promise<string | null> =>
    window.api
      ? call(api().students.importTemplate())
      : browserFileService.downloadStudentTemplate(),
  classes: (id: number): Promise<EnrollmentDetail[]> => call(api().students.classes(id)),
  payments: (id: number): Promise<PaymentDetail[]> => call(api().students.payments(id))
}

export const teacherService = {
  list: (q: TeacherQuery): Promise<PageResult<Teacher>> => call(api().teachers.list(q)),
  get: (id: number): Promise<Teacher> => call(api().teachers.get(id)),
  create: (i: TeacherInput): Promise<Teacher> => call(api().teachers.create(i)),
  update: (id: number, i: TeacherInput): Promise<Teacher> => call(api().teachers.update(id, i)),
  remove: (id: number): Promise<boolean> => call(api().teachers.remove(id)),
  options: (): Promise<SelectOption[]> => call(api().teachers.options())
}

export const courseService = {
  list: (q: CourseQuery): Promise<PageResult<Course>> => call(api().courses.list(q)),
  get: (id: number): Promise<Course> => call(api().courses.get(id)),
  create: (i: CourseInput): Promise<Course> => call(api().courses.create(i)),
  update: (id: number, i: CourseInput): Promise<Course> => call(api().courses.update(id, i)),
  remove: (id: number): Promise<boolean> => call(api().courses.remove(id)),
  options: (): Promise<SelectOption[]> => call(api().courses.options())
}

export const classService = {
  list: (q: ClassQuery): Promise<PageResult<ClassRoomDetail>> => call(api().classes.list(q)),
  get: (id: number): Promise<ClassRoomDetail> => call(api().classes.get(id)),
  create: (i: ClassInput): Promise<ClassRoomDetail> => call(api().classes.create(i)),
  update: (id: number, i: ClassInput): Promise<ClassRoomDetail> => call(api().classes.update(id, i)),
  remove: (id: number): Promise<boolean> => call(api().classes.remove(id)),
  options: (): Promise<SelectOption[]> => call(api().classes.options()),
  students: (id: number): Promise<EnrollmentDetail[]> => call(api().classes.students(id)),
  availableStudents: (id: number, keyword?: string): Promise<Student[]> =>
    call(api().classes.availableStudents(id, keyword)),
  enroll: (i: EnrollInput): Promise<number> => call(api().classes.enroll(i)),
  unenroll: (id: number): Promise<boolean> => call(api().classes.unenroll(id)),
  enrollImport: (i: EnrollImportInput): Promise<ImportResult> => call(api().classes.enrollImport(i)),
  enrollTemplate: (): Promise<string | null> =>
    window.api
      ? call(api().classes.enrollTemplate())
      : browserFileService.downloadEnrollTemplate()
}

export const scheduleService = {
  list: (q: SessionQuery): Promise<ClassSessionDetail[]> => call(api().sessions.list(q)),
  get: (id: number): Promise<ClassSessionDetail> => call(api().sessions.get(id)),
  create: (i: SessionInput): Promise<ClassSession> => call(api().sessions.create(i)),
  update: (id: number, i: SessionInput): Promise<ClassSession> => call(api().sessions.update(id, i)),
  remove: (id: number): Promise<boolean> => call(api().sessions.remove(id)),
  move: (i: MoveSessionInput): Promise<ClassSession> => call(api().sessions.move(i)),
  generate: (i: GenerateSessionsInput): Promise<number> => call(api().sessions.generate(i))
}

export const attendanceService = {
  bySession: (id: number): Promise<AttendanceDetail[]> => call(api().attendance.bySession(id)),
  mark: (i: MarkAttendanceInput): Promise<number> => call(api().attendance.mark(i)),
  markMulti: (i: MarkMultiAttendanceInput): Promise<number> => call(api().attendance.markMulti(i)),
  history: (q: AttendanceHistoryQuery): Promise<PageResult<AttendanceHistoryRow>> =>
    call(api().attendance.history(q)),
  grid: (q: AttendanceGridQuery): Promise<AttendanceGridResult> => call(api().attendance.grid(q)),
  studentSummary: (
    id: number
  ): Promise<{ present: number; excused: number; absent: number; late: number; total: number }> =>
    call(api().attendance.studentSummary(id))
}
