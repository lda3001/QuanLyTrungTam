import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button, Result, Typography } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'

interface Props {
  children: ReactNode
  /** Giao diện thay thế tuỳ biến; bỏ trống thì dùng màn hình lỗi mặc định */
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Chặn lỗi render của React.
 *
 * Không có lớp này, một lỗi nhỏ trong bất kỳ component nào sẽ làm React gỡ bỏ
 * TOÀN BỘ cây — người dùng nhìn thấy màn hình trắng, không biết chuyện gì xảy ra.
 *
 * Lưu ý: Error Boundary chỉ bắt lỗi lúc render/lifecycle. Lỗi bất đồng bộ
 * (gọi API) do React Query và useNotify xử lý.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary] Lỗi render:', error, info.componentStack)
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null })
  }

  private handleReload = (): void => {
    window.location.reload()
  }

  override render(): ReactNode {
    if (!this.state.hasError) return this.props.children
    if (this.props.fallback) return this.props.fallback

    return (
      <Result
        status="error"
        title="Giao diện gặp sự cố"
        subTitle="Thao tác vừa rồi khiến màn hình không hiển thị được. Bạn có thể thử lại hoặc tải lại ứng dụng."
        extra={[
          <Button key="retry" type="primary" icon={<ReloadOutlined />} onClick={this.handleReset}>
            Thử lại
          </Button>,
          <Button key="reload" onClick={this.handleReload}>
            Tải lại ứng dụng
          </Button>
        ]}
      >
        {this.state.error && (
          <Typography.Paragraph type="secondary" style={{ maxWidth: 640, margin: '0 auto' }}>
            <Typography.Text code>{this.state.error.message}</Typography.Text>
          </Typography.Paragraph>
        )}
      </Result>
    )
  }
}
