import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Button, Result, Spin } from 'antd'
import { useAuthStore } from '@/store/auth.store'
import { usePermission } from '@/hooks/usePermission'
import type { Permission } from '@shared/constants/permissions'

interface Props {
  children: ReactNode
  permission?: Permission
}

/**
 * Cổng vào của mọi route trong ứng dụng.
 *
 * Ba trạng thái, thứ tự kiểm tra rất quan trọng:
 *  1. Đang khôi phục phiên  → hiện spinner (nếu bỏ qua, người dùng sẽ thấy màn
 *     hình đăng nhập loé lên rồi biến mất ở mỗi lần mở app).
 *  2. Chưa đăng nhập        → chuyển hướng, ghi nhớ trang đang muốn vào.
 *  3. Thiếu quyền           → hiện 403 thay vì chuyển hướng, để người dùng biết
 *     trang có tồn tại nhưng họ không được vào.
 */
export function ProtectedRoute({ children, permission }: Props) {
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const initializing = useAuthStore((s) => s.initializing)
  const { can } = usePermission()

  if (initializing) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100vh' }}>
        <Spin size="large" tip="Đang khởi động...">
          <div style={{ padding: 40 }} />
        </Spin>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  if (permission && !can(permission)) {
    return (
      <Result
        status="403"
        title="403"
        subTitle="Bạn không có quyền truy cập chức năng này."
        extra={
          <Button type="primary" onClick={() => window.history.back()}>
            Quay lại
          </Button>
        }
      />
    )
  }

  return <>{children}</>
}
