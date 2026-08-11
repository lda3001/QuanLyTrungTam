import { Router, type Request, type RequestHandler, type Response } from 'express'
import type { AuthUser } from '../src/shared/types/entities'
import { AppError, toIpcError } from '../src/main/utils/errors'
import { sessionStore } from '../src/main/services/session.store'
import type { Permission } from '../src/shared/constants/permissions'
import { PERMISSIONS } from '../src/shared/constants/permissions'
import { authService } from '../src/main/services/auth.service'
import { studentService } from '../src/main/services/student.service'
import { teacherService } from '../src/main/services/teacher.service'
import { courseService } from '../src/main/services/course.service'
import { classService } from '../src/main/services/class.service'
import { classSessionService } from '../src/main/services/session.service'
import { attendanceService } from '../src/main/services/attendance.service'
import { paymentService } from '../src/main/services/payment.service'
import { userService, roleService } from '../src/main/services/user.service'
import {
  dashboardService,
  reportService,
  settingService
} from '../src/main/services/report.service'
import { logRepository } from '../src/main/repositories/log.repository'
import { getDbFilePath } from '../src/main/database/connection'

declare module 'express-session' {
  interface SessionData {
    user?: AuthUser
  }
}
type Params = Record<string, string | string[]>
type Action = (req: Request, params: Params) => unknown | Promise<unknown>
const router = Router()

function action(permission: Permission | undefined, handler: Action): RequestHandler {
  return async (req, res) =>
    sessionStore.run(req.session.user ?? null, async () => {
      try {
        if (permission && !sessionStore.has(permission))
          throw sessionStore.isAuthenticated() ? AppError.forbidden() : AppError.unauthorized()
        res.json({ ok: true, data: await handler(req, req.params as Params) })
      } catch (error) {
        const result = toIpcError(error)
        const failure = result as Extract<typeof result, { ok: false }>
        const status =
          failure.error.code === 'UNAUTHORIZED'
            ? 401
            : failure.error.code === 'FORBIDDEN'
              ? 403
              : failure.error.code === 'NOT_FOUND'
                ? 404
                : 400
        res.status(status).json(failure)
      }
    })
}
const q = (req: Request): any => req.query
const b = (req: Request): any => req.body
const id = (p: Params, key = 'id') => Number(Array.isArray(p[key]) ? p[key][0] : p[key])
const P = PERMISSIONS

router.post(
  '/auth/login',
  action(undefined, (req) => {
    const user = authService.login(b(req))
    req.session.user = user
    return user
  })
)
router.post(
  '/auth/logout',
  action(undefined, (req) => {
    const result = authService.logout()
    req.session.destroy(() => undefined)
    return result
  })
)
router.get(
  '/auth/me',
  action(undefined, () => authService.me())
)
router.post(
  '/auth/change-password',
  action(undefined, (req) => authService.changePassword(b(req)))
)
router.get(
  '/auth/security-question',
  action(undefined, (req) => authService.securityQuestion(String(q(req).username ?? '')))
)
router.post(
  '/auth/reset-password',
  action(undefined, (req) => authService.resetPassword(b(req)))
)

router.get(
  '/students',
  action(P.STUDENT_VIEW, (req) => studentService.list(q(req)))
)
router.get(
  '/students/options',
  action(P.STUDENT_VIEW, (req) => studentService.options(q(req).keyword as string | undefined))
)
router.get(
  '/students/school-classes',
  action(P.STUDENT_VIEW, () => studentService.schoolClasses())
)
router.post(
  '/students/bulk-delete',
  action(P.STUDENT_DELETE, (req) => studentService.bulkRemove(b(req).ids))
)
router.post(
  '/students/import',
  action(P.STUDENT_IMPORT, (req) => studentService.importRows(b(req).rows))
)
router.get(
  '/students/:id/classes',
  action(P.STUDENT_VIEW, (_r, p) => studentService.enrollments(id(p)))
)
router.get(
  '/students/:id/payments',
  action(P.PAYMENT_VIEW, (_r, p) => studentService.payments(id(p)))
)
router.get(
  '/students/:id',
  action(P.STUDENT_VIEW, (_r, p) => studentService.get(id(p)))
)
router.post(
  '/students',
  action(P.STUDENT_CREATE, (req) => studentService.create(b(req)))
)
router.put(
  '/students/:id',
  action(P.STUDENT_UPDATE, (req, p) => studentService.update(id(p), b(req)))
)
router.delete(
  '/students/:id',
  action(P.STUDENT_DELETE, (_r, p) => studentService.remove(id(p)))
)

function crud(
  prefix: string,
  permission: { view: Permission; create: Permission; update: Permission; remove: Permission },
  service: any
): void {
  router.get(
    prefix,
    action(permission.view, (req) => service.list(q(req)))
  )
  router.get(
    `${prefix}/options`,
    action(permission.view, () => service.options())
  )
  router.get(
    `${prefix}/:id`,
    action(permission.view, (_r, p) => service.get(id(p)))
  )
  router.post(
    prefix,
    action(permission.create, (req) => service.create(b(req)))
  )
  router.put(
    `${prefix}/:id`,
    action(permission.update, (req, p) => service.update(id(p), b(req)))
  )
  router.delete(
    `${prefix}/:id`,
    action(permission.remove, (_r, p) => service.remove(id(p)))
  )
}
crud(
  '/teachers',
  {
    view: P.TEACHER_VIEW,
    create: P.TEACHER_CREATE,
    update: P.TEACHER_UPDATE,
    remove: P.TEACHER_DELETE
  },
  teacherService
)
crud(
  '/courses',
  {
    view: P.COURSE_VIEW,
    create: P.COURSE_CREATE,
    update: P.COURSE_UPDATE,
    remove: P.COURSE_DELETE
  },
  courseService
)
crud(
  '/users',
  { view: P.USER_VIEW, create: P.USER_CREATE, update: P.USER_UPDATE, remove: P.USER_DELETE },
  userService
)
crud(
  '/roles',
  { view: P.USER_VIEW, create: P.USER_CREATE, update: P.USER_UPDATE, remove: P.USER_DELETE },
  roleService
)

router.get(
  '/classes',
  action(P.CLASS_VIEW, (req) => classService.list(q(req)))
)
router.get(
  '/classes/options',
  action(P.CLASS_VIEW, () => classService.options())
)
router.get(
  '/classes/:id/students',
  action(P.CLASS_VIEW, (_r, p) => classService.students(id(p)))
)
router.get(
  '/classes/:id/available-students',
  action(P.CLASS_ENROLL, (req, p) =>
    classService.availableStudents(id(p), q(req).keyword as string | undefined)
  )
)
router.post(
  '/classes/:id/enroll',
  action(P.CLASS_ENROLL, (req, p) => classService.enroll({ ...b(req), classId: id(p) }))
)
router.put(
  '/classes/enrollments/:id',
  action(P.CLASS_UPDATE_ENROLLMENT, (req, p) =>
    classService.updateEnrollment({ ...b(req), id: id(p) })
  )
)
router.post(
  '/classes/:id/unenroll',
  action(P.CLASS_ENROLL, (req, p) => classService.unenroll(Number(b(req).enrollmentId ?? id(p))))
)
router.get(
  '/classes/:id',
  action(P.CLASS_VIEW, (_r, p) => classService.get(id(p)))
)
router.post(
  '/classes',
  action(P.CLASS_CREATE, (req) => classService.create(b(req)))
)
router.put(
  '/classes/:id',
  action(P.CLASS_UPDATE, (req, p) => classService.update(id(p), b(req)))
)
router.delete(
  '/classes/:id',
  action(P.CLASS_DELETE, (_r, p) => classService.remove(id(p)))
)

router.get(
  '/sessions',
  action(P.SCHEDULE_VIEW, (req) => classSessionService.list(q(req)))
)
router.get(
  '/sessions/:id',
  action(P.SCHEDULE_VIEW, (_r, p) => classSessionService.get(id(p)))
)
router.post(
  '/sessions',
  action(P.SCHEDULE_MANAGE, (req) => classSessionService.create(b(req)))
)
router.put(
  '/sessions/:id',
  action(P.SCHEDULE_MANAGE, (req, p) => classSessionService.update(id(p), b(req)))
)
router.delete(
  '/sessions/:id',
  action(P.SCHEDULE_MANAGE, (_r, p) => classSessionService.remove(id(p)))
)
router.post(
  '/sessions/generate',
  action(P.SCHEDULE_MANAGE, (req) => classSessionService.generate(b(req)))
)
router.post(
  '/sessions/:id/move',
  action(P.SCHEDULE_MANAGE, (req, p) => classSessionService.move({ ...b(req), id: id(p) }))
)

router.get(
  '/attendance/session/:id',
  action(P.ATTENDANCE_VIEW, (_r, p) => attendanceService.bySession(id(p)))
)
router.post(
  '/attendance/mark',
  action(P.ATTENDANCE_MARK, (req) => attendanceService.mark(b(req)))
)
router.post(
  '/attendance/mark-multi',
  action(P.ATTENDANCE_MARK, (req) => attendanceService.markMulti(b(req)))
)
router.get(
  '/attendance/history',
  action(P.ATTENDANCE_VIEW, (req) => attendanceService.history(q(req)))
)
router.get(
  '/attendance/grid',
  action(P.ATTENDANCE_VIEW, (req) => attendanceService.grid(q(req)))
)
router.get(
  '/attendance/student/:id/summary',
  action(P.ATTENDANCE_VIEW, (_r, p) => attendanceService.studentSummary(id(p)))
)

router.get(
  '/payments',
  action(P.PAYMENT_VIEW, (req) => paymentService.list(q(req)))
)
router.get(
  '/payments/debts',
  action(P.PAYMENT_VIEW, (req) => paymentService.debts(q(req)))
)
router.get(
  '/payments/student-enrollments',
  action(P.PAYMENT_VIEW, (req) => paymentService.studentEnrollments(Number(q(req).studentId)))
)
router.get(
  '/payments/enrollments/:id/tuition-history',
  action(P.PAYMENT_VIEW, (_r, p) => paymentService.tuitionHistory(id(p)))
)
router.put(
  '/payments/enrollments/:id/tuition',
  action(P.PAYMENT_TUITION_UPDATE, (req, p) => paymentService.adjustTuition(id(p), b(req)))
)
router.get(
  '/payments/:id/receipt',
  action(P.PAYMENT_PRINT, (_r, p) => paymentService.receipt(id(p)))
)
router.get(
  '/payments/:id',
  action(P.PAYMENT_VIEW, (_r, p) => paymentService.get(id(p)))
)
router.post(
  '/payments',
  action(P.PAYMENT_CREATE, (req) => paymentService.create(b(req)))
)
router.put(
  '/payments/:id',
  action(P.PAYMENT_UPDATE, (req, p) => paymentService.update(id(p), b(req)))
)
router.delete(
  '/payments/:id',
  action(P.PAYMENT_DELETE, (_r, p) => paymentService.remove(id(p)))
)
router.post(
  '/users/:id/reset-password',
  action(P.USER_RESET_PASSWORD, (req, p) =>
    authService.adminResetPassword(id(p), b(req).newPassword)
  )
)

router.get(
  '/dashboard',
  action(P.DASHBOARD_VIEW, () => dashboardService.data())
)
router.get(
  '/reports/revenue',
  action(P.REPORT_VIEW, (req) => reportService.revenue(q(req) as any))
)
router.get(
  '/reports/tuition',
  action(P.REPORT_VIEW, (req) => reportService.tuition(q(req)))
)
router.get(
  '/reports/attendance',
  action(P.REPORT_VIEW, (req) => reportService.attendance(q(req)))
)
router.get(
  '/reports/student',
  action(P.REPORT_VIEW, (req) => reportService.students(q(req)))
)
router.get(
  '/reports/teacher',
  action(P.REPORT_VIEW, (req) => reportService.teachers(q(req)))
)
router.get(
  '/settings',
  action(P.SETTING_VIEW, () => settingService.getAll())
)
router.put(
  '/settings',
  action(P.SETTING_UPDATE, (req) => settingService.update(b(req)))
)
router.get(
  '/logs',
  action(P.LOG_VIEW, (req) => logRepository.list(q(req)))
)
router.get(
  '/app/info',
  action(undefined, () => ({
    version: process.env['npm_package_version'] ?? '1.0.0',
    platform: process.platform,
    dbPath: getDbFilePath()
  }))
)
export { router as apiRouter }
