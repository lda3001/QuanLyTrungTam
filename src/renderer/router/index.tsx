import { Suspense, lazy, type ComponentType } from 'react'
import { Navigate, createHashRouter } from 'react-router-dom'
import { MainLayout } from '@/layouts/MainLayout'
import { AuthLayout } from '@/layouts/AuthLayout'
import { ProtectedRoute } from './ProtectedRoute'
import { PageSkeleton } from '@/components/common'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { PERMISSIONS, type Permission } from '@shared/constants/permissions'

/* ------------------------------------------------------------------ *
 * Lazy loading: mỗi màn hình là một chunk riêng.
 *
 * Nhờ vậy khởi động app chỉ tải khung + Dashboard, không kéo theo toàn bộ
 * biểu đồ, bảng và form của 15 màn hình khác. Với Electron, thời gian mở
 * cửa sổ đầu tiên là thứ người dùng cảm nhận rõ nhất.
 * ------------------------------------------------------------------ */

const LoginPage = lazy(() => import('@/pages/auth/LoginPage'))
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage'))
const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'))
const StudentsPage = lazy(() => import('@/pages/students/StudentsPage'))
const StudentDetailPage = lazy(() => import('@/pages/students/StudentDetailPage'))
const TeachersPage = lazy(() => import('@/pages/teachers/TeachersPage'))
const CoursesPage = lazy(() => import('@/pages/courses/CoursesPage'))
const ClassesPage = lazy(() => import('@/pages/classes/ClassesPage'))
const ClassDetailPage = lazy(() => import('@/pages/classes/ClassDetailPage'))
const SchedulePage = lazy(() => import('@/pages/schedule/SchedulePage'))
const AttendancePage = lazy(() => import('@/pages/attendance/AttendancePage'))
const PaymentsPage = lazy(() => import('@/pages/payments/PaymentsPage'))
const DebtsPage = lazy(() => import('@/pages/payments/DebtsPage'))
const ReportsPage = lazy(() => import('@/pages/reports/ReportsPage'))
const UsersPage = lazy(() => import('@/pages/system/UsersPage'))
const RolesPage = lazy(() => import('@/pages/system/RolesPage'))
const SettingsPage = lazy(() => import('@/pages/system/SettingsPage'))
const LogsPage = lazy(() => import('@/pages/system/LogsPage'))
const ProfilePage = lazy(() => import('@/pages/system/ProfilePage'))
const NotFoundPage = lazy(() => import('@/pages/misc/NotFoundPage'))

/** Bọc mỗi trang: kiểm tra quyền → chặn lỗi render → skeleton khi đang tải chunk */
function page(Component: ComponentType, permission?: Permission) {
  return (
    <ProtectedRoute permission={permission}>
      <ErrorBoundary>
        <Suspense fallback={<PageSkeleton />}>
          <Component />
        </Suspense>
      </ErrorBoundary>
    </ProtectedRoute>
  )
}

function publicPage(Component: ComponentType) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageSkeleton />}>
        <Component />
      </Suspense>
    </ErrorBoundary>
  )
}

const P = PERMISSIONS

export const router = createHashRouter([
  {
    path: '/',
    element: <AuthLayout />,
    children: [
      { path: 'login', element: publicPage(LoginPage) },
      { path: 'forgot-password', element: publicPage(ForgotPasswordPage) }
    ]
  },
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: page(DashboardPage, P.DASHBOARD_VIEW) },

      { path: 'students', element: page(StudentsPage, P.STUDENT_VIEW) },
      { path: 'students/:id', element: page(StudentDetailPage, P.STUDENT_VIEW) },
      { path: 'teachers', element: page(TeachersPage, P.TEACHER_VIEW) },
      { path: 'courses', element: page(CoursesPage, P.COURSE_VIEW) },
      { path: 'classes', element: page(ClassesPage, P.CLASS_VIEW) },
      { path: 'classes/:id', element: page(ClassDetailPage, P.CLASS_VIEW) },

      { path: 'schedule', element: page(SchedulePage, P.SCHEDULE_VIEW) },
      { path: 'attendance', element: page(AttendancePage, P.ATTENDANCE_VIEW) },

      { path: 'payments', element: page(PaymentsPage, P.PAYMENT_VIEW) },
      { path: 'debts', element: page(DebtsPage, P.PAYMENT_VIEW) },

      { path: 'reports', element: page(ReportsPage, P.REPORT_VIEW) },

      { path: 'users', element: page(UsersPage, P.USER_VIEW) },
      { path: 'roles', element: page(RolesPage, P.USER_VIEW) },
      { path: 'settings', element: page(SettingsPage, P.SETTING_VIEW) },
      { path: 'logs', element: page(LogsPage, P.LOG_VIEW) },
      { path: 'profile', element: page(ProfilePage) },

      { path: '*', element: publicPage(NotFoundPage) }
    ]
  }
])
