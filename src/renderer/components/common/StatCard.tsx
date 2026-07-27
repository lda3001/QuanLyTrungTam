import { memo, type ReactNode } from 'react'
import { Card, Flex, Skeleton, Space, Typography, theme } from 'antd'
import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons'

interface Props {
  title: string
  value: ReactNode
  icon: ReactNode
  /** Mã màu chủ đạo của thẻ (dùng cho icon, viền và vệt sáng nền) */
  color: string
  suffix?: string
  /** % thay đổi so với kỳ trước; dương = tăng */
  trend?: number
  trendLabel?: string
  loading?: boolean
  onClick?: () => void
}

/**
 * Thẻ số liệu trên Dashboard.
 *
 * Quy ước màu của mũi tên xu hướng cố tình KHÔNG cứng nhắc "tăng = xanh":
 * nơi gọi tự chọn màu qua `color`, vì với chỉ số "học phí chưa thu" thì tăng
 * là tin xấu.
 */
export const StatCard = memo(function StatCard({
  title,
  value,
  icon,
  color,
  suffix,
  trend,
  trendLabel,
  loading,
  onClick
}: Props) {
  const { token } = theme.useToken()

  return (
    <Card
      className="stat-card"
      styles={{ body: { padding: 20 } }}
      style={{ color, cursor: onClick ? 'pointer' : 'default', height: '100%' }}
      onClick={onClick}
      hoverable={!!onClick}
    >
      {loading ? (
        <Skeleton active paragraph={{ rows: 1, width: '60%' }} title={{ width: '40%' }} />
      ) : (
        <Flex align="flex-start" justify="space-between" gap={12}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <Typography.Text type="secondary" style={{ fontSize: 13, display: 'block' }}>
              {title}
            </Typography.Text>

            <Typography.Title
              level={3}
              style={{ margin: '6px 0 0', color: token.colorText, wordBreak: 'break-word' }}
            >
              {value}
              {suffix && (
                <Typography.Text type="secondary" style={{ fontSize: 14, marginLeft: 6 }}>
                  {suffix}
                </Typography.Text>
              )}
            </Typography.Title>

            {trend !== undefined && (
              <Space size={4} style={{ marginTop: 6 }}>
                {trend >= 0 ? (
                  <ArrowUpOutlined style={{ color: token.colorSuccess, fontSize: 12 }} />
                ) : (
                  <ArrowDownOutlined style={{ color: token.colorError, fontSize: 12 }} />
                )}
                <Typography.Text
                  style={{ fontSize: 12, color: trend >= 0 ? token.colorSuccess : token.colorError }}
                >
                  {Math.abs(trend).toFixed(1).replace('.', ',')}%
                </Typography.Text>
                {trendLabel && (
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {trendLabel}
                  </Typography.Text>
                )}
              </Space>
            )}
          </div>

          <div
            className="stat-card-icon"
            style={{ background: `${color}1f`, color, flexShrink: 0 }}
            aria-hidden
          >
            {icon}
          </div>
        </Flex>
      )}
    </Card>
  )
})
