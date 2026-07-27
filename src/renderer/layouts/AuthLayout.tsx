import { Navigate, Outlet } from 'react-router-dom'
import { Spin } from 'antd'
import { useAuthStore } from '@/store/auth.store'

/**
 * Khung cho các trang chưa đăng nhập (Đăng nhập, Quên mật khẩu).
 *
 * Nếu phiên đã tồn tại thì đá thẳng vào ứng dụng — người dùng đã đăng nhập
 * mà bấm nút Back không nên rơi lại màn hình đăng nhập.
 */
export function AuthLayout() {
  const user = useAuthStore((s) => s.user)
  const initializing = useAuthStore((s) => s.initializing)

  if (initializing) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (user) return <Navigate to="/dashboard" replace />

  return <Outlet />
}
