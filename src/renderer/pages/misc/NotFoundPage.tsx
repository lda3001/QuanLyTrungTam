import { useNavigate } from 'react-router-dom'
import { Button, Result } from 'antd'

/** Trang 404 cho đường dẫn không tồn tại */
export default function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <Result
      status="404"
      title="404"
      subTitle="Trang bạn tìm không tồn tại hoặc đã được di chuyển."
      extra={
        <Button type="primary" onClick={() => navigate('/dashboard')}>
          Về trang tổng quan
        </Button>
      }
    />
  )
}
