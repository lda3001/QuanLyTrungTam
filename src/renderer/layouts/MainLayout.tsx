import { MuiDropdown as Dropdown } from '@/components/common/MuiControls'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Avatar, Button, Drawer, Grid, Layout, Menu, Space, Tag, Tooltip, Typography, theme } from 'antd'
import type { MenuProps } from 'antd'
import {
  BulbFilled,
  BulbOutlined,
  KeyOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ReadOutlined,
  UserOutlined
} from '@ant-design/icons'
import { useAuthStore } from '@/store/auth.store'
import { useUiStore } from '@/store/ui.store'
import { usePermission } from '@/hooks/usePermission'
import { useNotify } from '@/hooks/useNotify'
import { authService } from '@/services/auth.service'
import { MENU_TREE, filterMenuByPermission, type MenuNode } from '@/router/menu'
import { ChangePasswordModal } from '@/components/system/ChangePasswordModal'
import { colorFromString, initials } from '@/utils/format'
import { ROLE_LABELS } from '@shared/constants/permissions'

const { Sider, Header, Content } = Layout

/**
 * Khung chính: Sidebar trái — Header trên — Content giữa.
 *
 * Responsive: dưới 992px, sidebar chuyển thành Drawer trượt ra. Ứng dụng
 * desktop vẫn cần điều này vì người dùng hay thu nhỏ cửa sổ để làm việc
 * song song với phần mềm khác.
 */
export function MainLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const notify = useNotify()
  const screens = Grid.useBreakpoint()
  const { token } = theme.useToken()

  const user = useAuthStore((s) => s.user)
  const clearUser = useAuthStore((s) => s.clear)
  const { can } = usePermission()

  const collapsed = useUiStore((s) => s.collapsed)
  const toggleCollapsed = useUiStore((s) => s.toggleCollapsed)
  const themeMode = useUiStore((s) => s.themeMode)
  const toggleTheme = useUiStore((s) => s.toggleTheme)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)

  const isMobile = !screens.lg

  // Đóng Drawer mỗi khi đổi trang — nếu không, menu che mất nội dung vừa mở
  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  const menuTree = useMemo(() => filterMenuByPermission(MENU_TREE, can), [can])

  const menuItems = useMemo<MenuProps['items']>(() => toAntdItems(menuTree), [menuTree])

  /** Khoá `selectedKeys` lấy theo tiền tố đường dẫn để trang con vẫn sáng đúng mục cha */
  const selectedKeys = useMemo(() => {
    const match = findDeepest(menuTree, location.pathname)
    return match ? [match] : []
  }, [menuTree, location.pathname])

  const [openKeys, setOpenKeys] = useState<string[]>(() =>
    MENU_TREE.filter((n) => n.children).map((n) => n.key)
  )

  const handleMenuClick = useCallback<NonNullable<MenuProps['onClick']>>(
    ({ key }) => {
      const path = findPathByKey(menuTree, key)
      if (path) navigate(path)
    },
    [menuTree, navigate]
  )

  const handleLogout = useCallback(() => {
    notify.confirm({
      title: 'Đăng xuất',
      content: 'Bạn có chắc muốn thoát khỏi phiên làm việc hiện tại?',
      okText: 'Đăng xuất',
      onOk: async () => {
        try {
          await authService.logout()
        } finally {
          clearUser()
          navigate('/login', { replace: true })
        }
      }
    })
  }, [notify, clearUser, navigate])

  const userMenu: MenuProps['items'] = [
    {
      key: 'info',
      label: (
        <div style={{ padding: '4px 0' }}>
          <div style={{ fontWeight: 600 }}>{user?.fullName}</div>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            @{user?.username}
          </Typography.Text>
        </div>
      ),
      disabled: true
    },
    { type: 'divider' },
    { key: 'profile', icon: <UserOutlined />, label: 'Tài khoản của tôi' },
    { key: 'password', icon: <KeyOutlined />, label: 'Đổi mật khẩu' },
    { type: 'divider' },
    { key: 'logout', icon: <LogoutOutlined />, label: 'Đăng xuất', danger: true }
  ]

  const sidebarContent = (
    <>
      <div className="app-logo">
        <div className="app-logo-mark">
          <ReadOutlined />
        </div>
        {(!collapsed || isMobile) && (
          <div className="app-logo-text">
            Quản Lý
            <br />
            Trung Tâm
          </div>
        )}
      </div>

      <Menu
        mode="inline"
        theme={themeMode === 'dark' ? 'dark' : 'light'}
        items={menuItems}
        selectedKeys={selectedKeys}
        openKeys={collapsed && !isMobile ? undefined : openKeys}
        onOpenChange={setOpenKeys}
        onClick={handleMenuClick}
        style={{ borderInlineEnd: 'none', paddingBottom: 24 }}
      />
    </>
  )

  return (
    <Layout className="app-layout">
      {isMobile ? (
        <Drawer
          placement="left"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          width={260}
          closable={false}
          styles={{ body: { padding: 0 } }}
        >
          {sidebarContent}
        </Drawer>
      ) : (
        <Sider
          className="app-sider"
          collapsible
          collapsed={collapsed}
          onCollapse={toggleCollapsed}
          trigger={null}
          width={240}
          collapsedWidth={72}
          theme={themeMode === 'dark' ? 'dark' : 'light'}
          style={{ background: token.colorBgContainer, overflow: 'auto' }}
        >
          {sidebarContent}
        </Sider>
      )}

      <Layout style={{ background: token.colorBgLayout }}>
        <Header className="app-header" style={{ background: token.colorBgContainer, padding: '0 16px' }}>
          <Button
            type="text"
            icon={
              isMobile ? <MenuUnfoldOutlined /> : collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />
            }
            onClick={() => (isMobile ? setDrawerOpen(true) : toggleCollapsed())}
            aria-label="Đóng/mở menu"
          />

          <div style={{ flex: 1, minWidth: 0 }}>
            <Typography.Text strong style={{ fontSize: 15 }}>
              {titleOf(menuTree, location.pathname)}
            </Typography.Text>
            
          </div>

          <Space size={8}>
            <Tooltip title={themeMode === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}>
              <Button
                type="text"
                icon={themeMode === 'dark' ? <BulbFilled /> : <BulbOutlined />}
                onClick={toggleTheme}
                aria-label="Đổi giao diện sáng/tối"
              />
            </Tooltip>

            <Dropdown
              menu={{
                items: userMenu,
                onClick: ({ key }) => {
                  if (key === 'logout') handleLogout()
                  else if (key === 'profile') navigate('/profile')
                  else if (key === 'password') setPasswordOpen(true)
                }
              }}
              trigger={['click']}
              placement="bottomRight"
            >
              <Space style={{ cursor: 'pointer', padding: '4px 8px', borderRadius: 8 }}>
                <Avatar
                  size={32}
                  src={user?.avatar || undefined}
                  style={{ backgroundColor: colorFromString(user?.fullName ?? 'U') }}
                >
                  {initials(user?.fullName)}
                </Avatar>
                {screens.md && (
                  <div style={{ lineHeight: 1.2 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{user?.fullName}</div>
                    <Tag color="blue" style={{ fontSize: 10, lineHeight: '16px', margin: 0 }}>
                      {ROLE_LABELS[user?.roleCode ?? ''] ?? user?.roleName}
                    </Tag>
                  </div>
                )}
              </Space>
            </Dropdown>
          </Space>
        </Header>

        <Content className="app-content">
          {/* key theo pathname để hiệu ứng chuyển trang chạy lại mỗi lần điều hướng */}
          <div key={location.pathname} className="page-enter">
            <Outlet />
          </div>
        </Content>
      </Layout>

      <ChangePasswordModal open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </Layout>
  )
}

/* --------------------------- tiện ích menu --------------------------- */

function toAntdItems(nodes: MenuNode[]): MenuProps['items'] {
  return nodes.map((node) => ({
    key: node.key,
    icon: node.icon,
    label: node.label,
    children: node.children ? toAntdItems(node.children) : undefined
  }))
}

function findPathByKey(nodes: MenuNode[], key: string): string | undefined {
  for (const node of nodes) {
    if (node.key === key && node.path) return node.path
    if (node.children) {
      const found = findPathByKey(node.children, key)
      if (found) return found
    }
  }
  return undefined
}

/** Chọn mục khớp SÂU nhất, để /classes/12 sáng mục "Lớp học" chứ không phải mục gốc */
function findDeepest(nodes: MenuNode[], pathname: string): string | undefined {
  let best: { key: string; length: number } | undefined

  const walk = (list: MenuNode[]): void => {
    for (const node of list) {
      if (node.path && pathname.startsWith(node.path)) {
        if (!best || node.path.length > best.length) best = { key: node.key, length: node.path.length }
      }
      if (node.children) walk(node.children)
    }
  }

  walk(nodes)
  return best?.key
}

function titleOf(nodes: MenuNode[], pathname: string): string {
  let title = 'Quản Lý Trung Tâm'
  let bestLength = 0

  const walk = (list: MenuNode[]): void => {
    for (const node of list) {
      if (node.path && pathname.startsWith(node.path) && node.path.length > bestLength) {
        title = node.label
        bestLength = node.path.length
      }
      if (node.children) walk(node.children)
    }
  }

  walk(nodes)
  return title
}
