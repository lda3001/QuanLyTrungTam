import axios from 'axios'
import type { AppApi } from '@shared/ipc/api'
import type { IpcResult } from '@shared/types/common'

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function call<T>(promise: Promise<IpcResult<T>>): Promise<T> {
  const result = await promise
  if (!result?.ok)
    throw new ApiError(
      result?.error.code ?? 'UNKNOWN',
      result?.error.message ?? 'Không nhận được phản hồi từ máy chủ.',
      result?.error.details
    )
  return result.data
}

const client = axios.create({ baseURL: '/api', withCredentials: true })
type Config = { method: string; url: string; data?: unknown; params?: unknown }

function endpoint(group: string, action: string, args: unknown[]): Config {
  const [a, b] = args
  const id = Number(a)
  const base: Record<string, string> = {
    students: '/students',
    teachers: '/teachers',
    courses: '/courses',
    classes: '/classes',
    sessions: '/sessions',
    payments: '/payments',
    users: '/users',
    roles: '/roles'
  }
  if (group === 'auth') {
    const auth: Record<string, Config> = {
      login: { method: 'post', url: '/auth/login', data: a },
      logout: { method: 'post', url: '/auth/logout' },
      me: { method: 'get', url: '/auth/me' },
      changePassword: { method: 'post', url: '/auth/change-password', data: a },
      securityQuestion: { method: 'get', url: '/auth/security-question', params: { username: a } },
      resetPassword: { method: 'post', url: '/auth/reset-password', data: a }
    }
    if (auth[action]) return auth[action]
  }
  if (base[group]) {
    if (action === 'list') return { method: 'get', url: base[group], params: a }
    if (action === 'get') return { method: 'get', url: `${base[group]}/${id}` }
    if (action === 'create') return { method: 'post', url: base[group], data: a }
    if (action === 'update') return { method: 'put', url: `${base[group]}/${id}`, data: b }
    if (action === 'remove') return { method: 'delete', url: `${base[group]}/${id}` }
  }
  const routes: Record<string, Config> = {
    'students.bulkRemove': { method: 'post', url: '/students/bulk-delete', data: { ids: a } },
    'students.options': { method: 'get', url: '/students/options', params: { keyword: a } },
    'students.schoolClasses': { method: 'get', url: '/students/school-classes' },
    'students.importRows': { method: 'post', url: '/students/import', data: { rows: a } },
    'students.classes': { method: 'get', url: `/students/${id}/classes` },
    'students.payments': { method: 'get', url: `/students/${id}/payments` },
    'teachers.options': { method: 'get', url: '/teachers/options' },
    'courses.options': { method: 'get', url: '/courses/options' },
    'classes.options': { method: 'get', url: '/classes/options' },
    'classes.students': { method: 'get', url: `/classes/${id}/students` },
    'classes.availableStudents': {
      method: 'get',
      url: `/classes/${id}/available-students`,
      params: { keyword: b }
    },
    'classes.enroll': {
      method: 'post',
      url: `/classes/${(a as { classId?: number } | undefined)?.classId ?? 0}/enroll`,
      data: a
    },
    'classes.unenroll': { method: 'post', url: '/classes/0/unenroll', data: { enrollmentId: a } },
    'sessions.move': {
      method: 'post',
      url: `/sessions/${(a as { id?: number } | undefined)?.id ?? 0}/move`,
      data: a
    },
    'sessions.generate': { method: 'post', url: '/sessions/generate', data: a },
    'attendance.bySession': { method: 'get', url: `/attendance/session/${id}` },
    'attendance.mark': { method: 'post', url: '/attendance/mark', data: a },
    'attendance.markMulti': { method: 'post', url: '/attendance/mark-multi', data: a },
    'attendance.history': { method: 'get', url: '/attendance/history', params: a },
    'attendance.grid': { method: 'get', url: '/attendance/grid', params: a },
    'attendance.studentSummary': { method: 'get', url: `/attendance/student/${id}/summary` },
    'payments.debts': { method: 'get', url: '/payments/debts', params: a },
    'payments.receipt': { method: 'get', url: `/payments/${id}/receipt` },
    'payments.studentEnrollments': {
      method: 'get',
      url: '/payments/student-enrollments',
      params: { studentId: a }
    },
    'payments.adjustTuition': {
      method: 'put',
      url: `/payments/enrollments/${id}/tuition`,
      data: b
    },
    'payments.tuitionHistory': {
      method: 'get',
      url: `/payments/enrollments/${id}/tuition-history`
    },
    'users.resetPassword': {
      method: 'post',
      url: `/users/${(a as { userId?: number } | undefined)?.userId ?? 0}/reset-password`,
      data: a
    },
    'roles.options': { method: 'get', url: '/roles/options' },
    'dashboard.data': { method: 'get', url: '/dashboard' },
    'reports.revenue': { method: 'get', url: '/reports/revenue', params: a },
    'reports.tuition': { method: 'get', url: '/reports/tuition', params: a },
    'reports.attendance': { method: 'get', url: '/reports/attendance', params: a },
    'reports.students': { method: 'get', url: '/reports/student', params: a },
    'reports.teachers': { method: 'get', url: '/reports/teacher', params: a },
    'settings.getAll': { method: 'get', url: '/settings' },
    'settings.update': { method: 'put', url: '/settings', data: a },
    'logs.list': { method: 'get', url: '/logs', params: a },
    'app.info': { method: 'get', url: '/app/info' }
  }
  const route = routes[`${group}.${action}`]
  if (!route) throw new ApiError('UNKNOWN', `API web chưa hỗ trợ ${group}.${action}.`)
  return route
}

/** HTTP facade: renderer feature services retain their existing typed contracts. */
export function api(): AppApi {
  // Electron exposes the typed IPC bridge through preload. Calling HTTP from a
  // file:// renderer has no /api origin, which made every Dashboard request
  // fail silently and left its cards at zero. The browser build has no bridge,
  // so it continues to use the HTTP facade below.
  if (typeof window !== 'undefined' && window.api) return window.api

  return new Proxy(
    {},
    {
      get: (_target, group: string) =>
        new Proxy(
          {},
          {
            get:
              (_child, action: string) =>
              (...args: unknown[]) => {
                const config = endpoint(group, action, args)
                return client
                  .request<IpcResult<unknown>>(config)
                  .then((r) => r.data)
                  .catch(
                    (error) =>
                      error.response?.data ?? {
                        ok: false,
                        error: { code: 'UNKNOWN', message: 'Không thể kết nối đến máy chủ.' }
                      }
                  )
              }
          }
        )
    }
  ) as AppApi
}
