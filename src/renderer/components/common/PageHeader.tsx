import { memo, type ReactNode } from 'react'
import { Breadcrumb, Flex, Space, Typography } from 'antd'
import { Link } from 'react-router-dom'
import { HomeOutlined } from '@ant-design/icons'

export interface BreadcrumbItem {
  title: string
  href?: string
}

interface Props {
  title: string
  subtitle?: string
  breadcrumbs?: BreadcrumbItem[]
  /** Nút hành động ở góc phải (Thêm mới, Xuất Excel...) */
  extra?: ReactNode
  icon?: ReactNode
}

/**
 * Đầu trang chuẩn cho mọi màn hình: breadcrumb, tiêu đề, mô tả và vùng nút.
 * Gom vào một component để mọi trang có cùng khoảng cách và thứ bậc chữ.
 */
export const PageHeader = memo(function PageHeader({ title, subtitle, breadcrumbs, extra, icon }: Props) {
  return (
    <div style={{ marginBottom: 20 }}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumb
          style={{ marginBottom: 10 }}
          items={[
            {
              title: (
                <Link to="/dashboard">
                  <HomeOutlined />
                </Link>
              )
            },
            ...breadcrumbs.map((b) => ({
              title: b.href ? <Link to={b.href}>{b.title}</Link> : b.title
            }))
          ]}
        />
      )}

      <Flex justify="space-between" align="flex-start" gap={16} wrap="wrap">
        <Space align="center" size={12}>
          {icon}
          <div>
            <Typography.Title level={3} style={{ margin: 0, lineHeight: 1.25 }}>
              {title}
            </Typography.Title>
            {subtitle && (
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                {subtitle}
              </Typography.Text>
            )}
          </div>
        </Space>

        {extra && <Space wrap>{extra}</Space>}
      </Flex>
    </div>
  )
})
