import { registerHandler } from './handler-factory'
import { IPC } from '@shared/ipc/channels'
import { PERMISSIONS } from '@shared/constants/permissions'
import { studentService } from '../services/student.service'
import { teacherService } from '../services/teacher.service'
import { courseService } from '../services/course.service'
import { classService } from '../services/class.service'
import { classSessionService } from '../services/session.service'
import { attendanceService } from '../services/attendance.service'
import { fileService } from '../services/file.service'
import type {
  AttendanceHistoryQuery,
  AttendanceGridQuery,
  MarkMultiAttendanceInput,
  ClassInput,
  ClassQuery,
  ContinueClassInput,
  CourseInput,
  CourseQuery,
  EnrollImportInput,
  EnrollInput,
  GenerateSessionsInput,
  MarkAttendanceInput,
  MoveSessionInput,
  SessionInput,
  SessionQuery,
  StudentImportRow,
  StudentInput,
  StudentQuery,
  TeacherInput,
  TeacherQuery,
  UpdateEnrollmentInput
} from '@shared/types/dto'

export function registerStudentHandlers(): void {
  const P = PERMISSIONS

  registerHandler(IPC.STUDENT_LIST, { permission: P.STUDENT_VIEW }, (q: StudentQuery) =>
    studentService.list(q)
  )
  registerHandler(IPC.STUDENT_GET, { permission: P.STUDENT_VIEW }, (id: number) =>
    studentService.get(id)
  )
  registerHandler(IPC.STUDENT_CREATE, { permission: P.STUDENT_CREATE }, (i: StudentInput) =>
    studentService.create(i)
  )
  registerHandler(
    IPC.STUDENT_UPDATE,
    { permission: P.STUDENT_UPDATE },
    (id: number, i: StudentInput) => studentService.update(id, i)
  )
  registerHandler(IPC.STUDENT_DELETE, { permission: P.STUDENT_DELETE }, (id: number) =>
    studentService.remove(id)
  )
  registerHandler(IPC.STUDENT_BULK_DELETE, { permission: P.STUDENT_DELETE }, (ids: number[]) =>
    studentService.bulkRemove(ids)
  )
  registerHandler(IPC.STUDENT_OPTIONS, { permission: P.STUDENT_VIEW }, (kw?: string) =>
    studentService.options(kw)
  )
  registerHandler(IPC.STUDENT_SCHOOL_CLASSES, { permission: P.STUDENT_VIEW }, () =>
    studentService.schoolClasses()
  )
  registerHandler(IPC.STUDENT_CLASSES, { permission: P.STUDENT_VIEW }, (id: number) =>
    studentService.enrollments(id)
  )
  registerHandler(IPC.STUDENT_PAYMENTS, { permission: P.PAYMENT_VIEW }, (id: number) =>
    studentService.payments(id)
  )
  registerHandler(
    IPC.STUDENT_IMPORT,
    { permission: P.STUDENT_IMPORT },
    (rows: StudentImportRow[]) => studentService.importRows(rows)
  )
  registerHandler(IPC.STUDENT_IMPORT_TEMPLATE, { permission: P.STUDENT_IMPORT }, () =>
    fileService.studentImportTemplate()
  )
}

export function registerTeacherHandlers(): void {
  const P = PERMISSIONS

  registerHandler(IPC.TEACHER_LIST, { permission: P.TEACHER_VIEW }, (q: TeacherQuery) =>
    teacherService.list(q)
  )
  registerHandler(IPC.TEACHER_GET, { permission: P.TEACHER_VIEW }, (id: number) =>
    teacherService.get(id)
  )
  registerHandler(IPC.TEACHER_CREATE, { permission: P.TEACHER_CREATE }, (i: TeacherInput) =>
    teacherService.create(i)
  )
  registerHandler(
    IPC.TEACHER_UPDATE,
    { permission: P.TEACHER_UPDATE },
    (id: number, i: TeacherInput) => teacherService.update(id, i)
  )
  registerHandler(IPC.TEACHER_DELETE, { permission: P.TEACHER_DELETE }, (id: number) =>
    teacherService.remove(id)
  )
  registerHandler(IPC.TEACHER_OPTIONS, { permission: P.TEACHER_VIEW }, () =>
    teacherService.options()
  )
}

export function registerCourseHandlers(): void {
  const P = PERMISSIONS

  registerHandler(IPC.COURSE_LIST, { permission: P.COURSE_VIEW }, (q: CourseQuery) =>
    courseService.list(q)
  )
  registerHandler(IPC.COURSE_GET, { permission: P.COURSE_VIEW }, (id: number) =>
    courseService.get(id)
  )
  registerHandler(IPC.COURSE_CREATE, { permission: P.COURSE_CREATE }, (i: CourseInput) =>
    courseService.create(i)
  )
  registerHandler(
    IPC.COURSE_UPDATE,
    { permission: P.COURSE_UPDATE },
    (id: number, i: CourseInput) => courseService.update(id, i)
  )
  registerHandler(IPC.COURSE_DELETE, { permission: P.COURSE_DELETE }, (id: number) =>
    courseService.remove(id)
  )
  registerHandler(IPC.COURSE_OPTIONS, { permission: P.COURSE_VIEW }, () => courseService.options())
}

export function registerClassHandlers(): void {
  const P = PERMISSIONS

  registerHandler(IPC.CLASS_LIST, { permission: P.CLASS_VIEW }, (q: ClassQuery) =>
    classService.list(q)
  )
  registerHandler(IPC.CLASS_GET, { permission: P.CLASS_VIEW }, (id: number) => classService.get(id))
  registerHandler(IPC.CLASS_CREATE, { permission: P.CLASS_CREATE }, (i: ClassInput) =>
    classService.create(i)
  )
  registerHandler(IPC.CLASS_UPDATE, { permission: P.CLASS_UPDATE }, (id: number, i: ClassInput) =>
    classService.update(id, i)
  )
  registerHandler(
    IPC.CLASS_CONTINUE,
    { permission: P.CLASS_CREATE },
    (id: number, input: ContinueClassInput) => classService.continueClass(id, input)
  )
  registerHandler(IPC.CLASS_DELETE, { permission: P.CLASS_DELETE }, (id: number) =>
    classService.remove(id)
  )
  registerHandler(IPC.CLASS_OPTIONS, { permission: P.CLASS_VIEW }, (includeFinished?: boolean) =>
    classService.options(includeFinished)
  )
  registerHandler(IPC.CLASS_STUDENTS, { permission: P.CLASS_VIEW }, (id: number) =>
    classService.students(id)
  )
  registerHandler(
    IPC.CLASS_AVAILABLE_STUDENTS,
    { permission: P.CLASS_ENROLL },
    (id: number, kw?: string) => classService.availableStudents(id, kw)
  )
  registerHandler(IPC.CLASS_ENROLL, { permission: P.CLASS_ENROLL }, (i: EnrollInput) =>
    classService.enroll(i)
  )
  registerHandler(
    IPC.CLASS_UPDATE_ENROLLMENT,
    { permission: P.CLASS_UPDATE_ENROLLMENT },
    (i: UpdateEnrollmentInput) => classService.updateEnrollment(i)
  )
  registerHandler(IPC.CLASS_UNENROLL, { permission: P.CLASS_ENROLL }, (id: number) =>
    classService.unenroll(id)
  )
  registerHandler(IPC.CLASS_ENROLL_IMPORT, { permission: P.CLASS_ENROLL }, (i: EnrollImportInput) =>
    classService.enrollImport(i)
  )
  registerHandler(IPC.CLASS_ENROLL_TEMPLATE, { permission: P.CLASS_ENROLL }, () =>
    fileService.enrollImportTemplate()
  )
}

export function registerSessionHandlers(): void {
  const P = PERMISSIONS

  registerHandler(IPC.SESSION_LIST, { permission: P.SCHEDULE_VIEW }, (q: SessionQuery) =>
    classSessionService.list(q)
  )
  registerHandler(IPC.SESSION_GET, { permission: P.SCHEDULE_VIEW }, (id: number) =>
    classSessionService.get(id)
  )
  registerHandler(IPC.SESSION_CREATE, { permission: P.SCHEDULE_MANAGE }, (i: SessionInput) =>
    classSessionService.create(i)
  )
  registerHandler(
    IPC.SESSION_UPDATE,
    { permission: P.SCHEDULE_MANAGE },
    (id: number, i: SessionInput) => classSessionService.update(id, i)
  )
  registerHandler(IPC.SESSION_DELETE, { permission: P.SCHEDULE_MANAGE }, (id: number) =>
    classSessionService.remove(id)
  )
  registerHandler(IPC.SESSION_MOVE, { permission: P.SCHEDULE_MANAGE }, (i: MoveSessionInput) =>
    classSessionService.move(i)
  )
  registerHandler(
    IPC.SESSION_GENERATE,
    { permission: P.SCHEDULE_MANAGE },
    (i: GenerateSessionsInput) => classSessionService.generate(i)
  )
}

export function registerAttendanceHandlers(): void {
  const P = PERMISSIONS

  registerHandler(IPC.ATTENDANCE_BY_SESSION, { permission: P.ATTENDANCE_VIEW }, (id: number) =>
    attendanceService.bySession(id)
  )
  registerHandler(
    IPC.ATTENDANCE_MARK,
    { permission: P.ATTENDANCE_MARK },
    (i: MarkAttendanceInput) => attendanceService.mark(i)
  )
  registerHandler(
    IPC.ATTENDANCE_MARK_MULTI,
    { permission: P.ATTENDANCE_MARK },
    (i: MarkMultiAttendanceInput) => attendanceService.markMulti(i)
  )
  registerHandler(
    IPC.ATTENDANCE_HISTORY,
    { permission: P.ATTENDANCE_VIEW },
    (q: AttendanceHistoryQuery) => attendanceService.history(q)
  )
  registerHandler(
    IPC.ATTENDANCE_GRID,
    { permission: P.ATTENDANCE_VIEW },
    (q: AttendanceGridQuery) => attendanceService.grid(q)
  )
  registerHandler(IPC.ATTENDANCE_STUDENT_SUMMARY, { permission: P.ATTENDANCE_VIEW }, (id: number) =>
    attendanceService.studentSummary(id)
  )
}
