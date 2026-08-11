import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Flex, Progress, Typography, theme } from 'antd'
import {
  CheckCircleFilled,
  CloudDownloadOutlined,
  LoadingOutlined,
  ReadOutlined,
  ReloadOutlined,
  RocketOutlined,
  WarningFilled
} from '@ant-design/icons'
import type { UpdateStatus } from '@shared/types/update'
import { call } from '@/services/ipc-client'

interface Props {
  onComplete: () => void
}

const initialStatus: UpdateStatus = {
  stage: 'idle',
  currentVersion: ''
}

function formatBytes(value?: number): string {
  if (!value || value < 1) return '0 MB'
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

export function StartupScreen({ onComplete }: Props) {
  const { token } = theme.useToken()
  const [status, setStatus] = useState<UpdateStatus>(initialStatus)
  const [acceptedUpdate, setAcceptedUpdate] = useState(false)
  const [showSkip, setShowSkip] = useState(false)
  const installRequested = useRef(false)

  const updateApi =
    typeof window !== 'undefined' && typeof window.api?.app?.checkForUpdates === 'function'
      ? window.api.app
      : null

  const check = async () => {
    if (!updateApi) {
      setStatus({
        stage: 'disabled',
        currentVersion: '',
        message: 'Đang tải các thành phần ứng dụng…'
      })
      return
    }

    setShowSkip(false)
    setStatus((current) => ({ ...current, stage: 'checking', message: 'Đang kiểm tra bản cập nhật…' }))
    try {
      setStatus(await call(updateApi.checkForUpdates()))
    } catch (error) {
      setStatus((current) => ({
        ...current,
        stage: 'error',
        errorContext: 'check',
        message: error instanceof Error ? error.message : 'Không thể kiểm tra bản cập nhật.'
      }))
    }
  }

  useEffect(() => {
    let active = true
    const unsubscribe = updateApi?.onUpdateStatus((next) => {
      if (active) setStatus(next)
    })

    void check()

    return () => {
      active = false
      unsubscribe?.()
    }
    // Chỉ chạy một lần cho mỗi lần màn hình khởi động được gắn vào DOM.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (status.stage === 'not-available' || status.stage === 'disabled') {
      const timer = window.setTimeout(onComplete, 900)
      return () => window.clearTimeout(timer)
    }
    return undefined
  }, [onComplete, status.stage])

  useEffect(() => {
    if (status.stage !== 'checking') {
      setShowSkip(false)
      return undefined
    }
    const timer = window.setTimeout(() => setShowSkip(true), 10_000)
    return () => window.clearTimeout(timer)
  }, [status.stage])

  useEffect(() => {
    if (!acceptedUpdate || status.stage !== 'downloaded' || installRequested.current || !updateApi) {
      return undefined
    }

    installRequested.current = true
    const timer = window.setTimeout(() => updateApi.installUpdate(), 1_000)
    return () => window.clearTimeout(timer)
  }, [acceptedUpdate, status.stage, updateApi])

  const startUpdate = async () => {
    if (!updateApi) return
    setAcceptedUpdate(true)
    setStatus((current) => ({ ...current, stage: 'downloading', percent: 0 }))
    try {
      setStatus(await call(updateApi.downloadUpdate()))
    } catch (error) {
      setStatus((current) => ({
        ...current,
        stage: 'error',
        errorContext: 'download',
        message: error instanceof Error ? error.message : 'Không thể tải bản cập nhật.'
      }))
    }
  }

  const retry = () => {
    if (status.errorContext === 'download' || acceptedUpdate) void startUpdate()
    else void check()
  }

  const content = useMemo(() => {
    switch (status.stage) {
      case 'available':
        return {
          icon: <CloudDownloadOutlined />,
          title: `Có phiên bản ${status.availableVersion ?? 'mới'}`,
          description: 'Cập nhật ngay để nhận các cải tiến và bản sửa lỗi mới nhất.'
        }
      case 'downloading':
        return {
          icon: <CloudDownloadOutlined />,
          title: 'Đang tải bản cập nhật',
          description: status.total
            ? `${formatBytes(status.transferred)} / ${formatBytes(status.total)} · ${formatBytes(status.bytesPerSecond)}/s`
            : 'Đang chuẩn bị dữ liệu tải xuống…'
        }
      case 'downloaded':
        return {
          icon: <CheckCircleFilled />,
          title: 'Bản cập nhật đã sẵn sàng',
          description: 'Ứng dụng sẽ khởi động lại để cài đặt trong giây lát.'
        }
      case 'installing':
        return {
          icon: <RocketOutlined />,
          title: 'Đang chuẩn bị cài đặt',
          description: 'Vui lòng chờ, ứng dụng sẽ tự mở lại sau khi hoàn tất.'
        }
      case 'not-available':
        return {
          icon: <CheckCircleFilled />,
          title: 'Ứng dụng đã được cập nhật',
          description: 'Bạn đang sử dụng phiên bản mới nhất.'
        }
      case 'error':
        return {
          icon: <WarningFilled />,
          title: status.errorContext === 'download' ? 'Tải cập nhật chưa thành công' : 'Không thể kiểm tra cập nhật',
          description: status.message ?? 'Vui lòng kiểm tra kết nối mạng rồi thử lại.'
        }
      case 'disabled':
        return {
          icon: <RocketOutlined />,
          title: 'Đang khởi động ứng dụng',
          description: status.message ?? 'Đang tải các thành phần cần thiết…'
        }
      default:
        return {
          icon: <LoadingOutlined spin />,
          title: status.stage === 'checking' ? 'Đang kiểm tra cập nhật' : 'Đang khởi tạo ứng dụng',
          description: status.message ?? 'Vui lòng chờ trong giây lát…'
        }
    }
  }, [status])

  const isBusy = ['idle', 'checking', 'downloading', 'downloaded', 'installing'].includes(status.stage)

  return (
    <main className="startup-screen" style={{ background: token.colorBgLayout }}>
      <div className="startup-glow startup-glow-one" />
      <div className="startup-glow startup-glow-two" />

      <section className="startup-panel" aria-live="polite">
        <div className="startup-brand-mark">
          <ReadOutlined />
        </div>

        <Typography.Title level={2} className="startup-brand-title">
          Quản Lý Trung Tâm
        </Typography.Title>
        <Typography.Text type="secondary" className="startup-version">
          {status.currentVersion ? `Phiên bản ${status.currentVersion}` : 'Ứng dụng quản lý trung tâm'}
        </Typography.Text>

        <div className={`startup-status-icon stage-${status.stage}`}>{content.icon}</div>
        <Typography.Title level={4} className="startup-status-title">
          {content.title}
        </Typography.Title>
        <Typography.Paragraph type="secondary" className="startup-status-description">
          {content.description}
        </Typography.Paragraph>

        {status.stage === 'downloading' && (
          <Progress
            percent={Math.round(status.percent ?? 0)}
            status="active"
            strokeColor={{ from: token.colorPrimary, to: '#52c41a' }}
            style={{ width: '100%', marginTop: 4 }}
          />
        )}

        {(status.stage === 'checking' || status.stage === 'idle' || status.stage === 'disabled') && (
          <Progress percent={100} showInfo={false} status="active" className="startup-indeterminate" />
        )}

        {status.stage === 'available' && (
          <Flex gap={10} className="startup-actions">
            <Button onClick={onComplete}>Để sau</Button>
            <Button type="primary" icon={<CloudDownloadOutlined />} onClick={() => void startUpdate()}>
              Cập nhật ngay
            </Button>
          </Flex>
        )}

        {status.stage === 'error' && (
          <Flex gap={10} className="startup-actions">
            <Button onClick={onComplete}>Tiếp tục vào ứng dụng</Button>
            <Button type="primary" icon={<ReloadOutlined />} onClick={retry}>
              Thử lại
            </Button>
          </Flex>
        )}

        {status.stage === 'checking' && showSkip && (
          <Button type="text" onClick={onComplete} className="startup-skip-button">
            Bỏ qua kiểm tra
          </Button>
        )}

        {isBusy && status.stage !== 'checking' && status.stage !== 'downloading' && status.stage !== 'disabled' && (
          <Typography.Text type="secondary" className="startup-wait-note">
            Vui lòng không tắt ứng dụng
          </Typography.Text>
        )}
      </section>
    </main>
  )
}
