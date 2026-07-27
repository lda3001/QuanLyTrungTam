import {
  AuditOutlined,
  BankOutlined,
  BarChartOutlined,
  BookOutlined,
  CalendarOutlined,
  CheckSquareOutlined,
  DashboardOutlined,
  DollarOutlined,
  ReadOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  SolutionOutlined,
  TeamOutlined,
  UserOutlined,
  UsergroupAddOutlined
} from '@ant-design/icons'
import type { ReactNode } from 'react'
import { PERMISSIONS, type Permission } from '@shared/constants/permissions'

export interface MenuNode {
  key: string
  label: string
  icon?: ReactNode
  path?: string
  /** Quyền tối thiểu để nhìn thấy mục này */
  permission?: Permission
  children?: MenuNode[]
}

/**
 * Cấu trúc menu bên trái — cũng là nguồn dữ liệu cho breadcrumb.
 *
 * Mỗi mục gắn một quyền; người dùng không có quyền thì mục biến mất hoàn toàn
 * thay vì hiện ra rồi báo lỗi khi bấm.
 */
export const MENU_TREE: MenuNode[] = [
  {
    key: 'dashboard',
    label: 'Tổng quan',
    icon: <DashboardOutlined />,
    path: '/dashboard',
    permission: PERMISSIONS.DASHBOARD_VIEW
  },
  {
    key: 'academic',
    label: 'Đào tạo',
    icon: <ReadOutlined />,
    children: [
      {
        key: 'students',
        label: 'Học viên',
        icon: <TeamOutlined />,
        path: '/students',
        permission: PERMISSIONS.STUDENT_VIEW
      },
      {
        key: 'teachers',
        label: 'Giáo viên',
        icon: <SolutionOutlined />,
        path: '/teachers',
        permission: PERMISSIONS.TEACHER_VIEW
      },
      {
        key: 'courses',
        label: 'Khoá học',
        icon: <BookOutlined />,
        path: '/courses',
        permission: PERMISSIONS.COURSE_VIEW
      },
      {
        key: 'classes',
        label: 'Lớp học',
        icon: <BankOutlined />,
        path: '/classes',
        permission: PERMISSIONS.CLASS_VIEW
      }
    ]
  },
  {
    key: 'operation',
    label: 'Vận hành',
    icon: <CalendarOutlined />,
    children: [
      {
        key: 'schedule',
        label: 'Lịch học',
        icon: <CalendarOutlined />,
        path: '/schedule',
        permission: PERMISSIONS.SCHEDULE_VIEW
      },
      {
        key: 'attendance',
        label: 'Điểm danh',
        icon: <CheckSquareOutlined />,
        path: '/attendance',
        permission: PERMISSIONS.ATTENDANCE_VIEW
      }
    ]
  },
  {
    key: 'finance',
    label: 'Học phí',
    icon: <DollarOutlined />,
    children: [
      {
        key: 'payments',
        label: 'Phiếu thu',
        icon: <DollarOutlined />,
        path: '/payments',
        permission: PERMISSIONS.PAYMENT_VIEW
      },
      {
        key: 'debts',
        label: 'Công nợ',
        icon: <AuditOutlined />,
        path: '/debts',
        permission: PERMISSIONS.PAYMENT_VIEW
      }
    ]
  },
  {
    key: 'reports',
    label: 'Báo cáo',
    icon: <BarChartOutlined />,
    path: '/reports',
    permission: PERMISSIONS.REPORT_VIEW
  },
  {
    key: 'system',
    label: 'Hệ thống',
    icon: <SettingOutlined />,
    children: [
      {
        key: 'users',
        label: 'Nhân viên',
        icon: <UsergroupAddOutlined />,
        path: '/users',
        permission: PERMISSIONS.USER_VIEW
      },
      {
        key: 'roles',
        label: 'Phân quyền',
        icon: <SafetyCertificateOutlined />,
        path: '/roles',
        permission: PERMISSIONS.USER_VIEW
      },
      {
        key: 'settings',
        label: 'Cấu hình',
        icon: <SettingOutlined />,
        path: '/settings',
        permission: PERMISSIONS.SETTING_VIEW
      },
      {
        key: 'logs',
        label: 'Nhật ký',
        icon: <AuditOutlined />,
        path: '/logs',
        permission: PERMISSIONS.LOG_VIEW
      },
      {
        key: 'profile',
        label: 'Tài khoản của tôi',
        icon: <UserOutlined />,
        path: '/profile'
      }
    ]
  }
]

/** Lọc cây menu theo quyền; nhóm rỗng sau khi lọc sẽ bị loại bỏ */
export function filterMenuByPermission(
  nodes: MenuNode[],
  can: (permission: Permission) => boolean
): MenuNode[] {
  const result: MenuNode[] = []

  for (const node of nodes) {
    if (node.children) {
      const children = filterMenuByPermission(node.children, can)
      if (children.length > 0) result.push({ ...node, children })
      continue
    }
    if (!node.permission || can(node.permission)) result.push(node)
  }

  return result
}

/** Tìm đường dẫn từ gốc tới mục có `path` khớp — dùng để dựng breadcrumb */
export function findMenuPath(nodes: MenuNode[], pathname: string, trail: MenuNode[] = []): MenuNode[] | null {
  for (const node of nodes) {
    const next = [...trail, node]
    if (node.path && pathname.startsWith(node.path)) return next
    if (node.children) {
      const found = findMenuPath(node.children, pathname, next)
      if (found) return found
    }
  }
  return null
}
