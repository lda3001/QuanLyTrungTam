import { useState } from 'react'
import { Avatar, Button, Card, Col, Descriptions, Flex, Row, Space, Tag, Typography } from 'antd'
import { KeyOutlined, SafetyCertificateOutlined, UserOutlined } from '@ant-design/icons'
import { PageHeader } from '@/components/common/PageHeader'
import { ChangePasswordModal } from '@/components/system/ChangePasswordModal'
import { useAuthStore } from '@/store/auth.store'
import { colorFromString, initials } from '@/utils/format'
import { PERMISSION_LABELS, ROLE_LABELS } from '@shared/constants/permissions'

/** Trang thông tin tài khoản của chính người đang đăng nhập */
export default function ProfilePage() {
  const user = useAuthStore((s) => s.user)
  const [passwordOpen, setPasswordOpen] = useState(false)

  if (!user) return null

  const isAdmin = user.roleCode === 'admin'

  return (
    <>
      <PageHeader
        title="Tài khoản của tôi"
        subtitle="Thông tin cá nhân và phạm vi quyền hạn"
        breadcrumbs={[{ title: 'Hệ thống' }, { title: 'Tài khoản của tôi' }]}
        icon={<UserOutlined style={{ fontSize: 26, color: '#1677ff' }} />}
        extra={
          <Button type="primary" icon={<KeyOutlined />} onClick={() => setPasswordOpen(true)}>
            Đổi mật khẩu
          </Button>
        }
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={10}>
          <Card>
            <Flex vertical align="center" gap={12} style={{ marginBottom: 20 }}>
              <Avatar
                size={96}
                src={user.avatar || undefined}
                style={{ backgroundColor: colorFromString(user.fullName), fontSize: 38 }}
              >
                {initials(user.fullName)}
              </Avatar>
              <div style={{ textAlign: 'center' }}>
                <Typography.Title level={4} style={{ margin: 0 }}>
                  {user.fullName}
                </Typography.Title>
                <Typography.Text type="secondary">@{user.username}</Typography.Text>
                <div style={{ marginTop: 8 }}>
                  <Tag color="blue">{ROLE_LABELS[user.roleCode] ?? user.roleName}</Tag>
                </div>
              </div>
            </Flex>

            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Tên đăng nhập">{user.username}</Descriptions.Item>
              <Descriptions.Item label="Họ và tên">{user.fullName}</Descriptions.Item>
              <Descriptions.Item label="Email">{user.email ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Vai trò">{ROLE_LABELS[user.roleCode] ?? user.roleName}</Descriptions.Item>
              <Descriptions.Item label="Hồ sơ giáo viên">
                {user.teacherId ? `Đã liên kết (#${user.teacherId})` : 'Không liên kết'}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24} lg={14}>
          <Card
            title={
              <Space>
                <SafetyCertificateOutlined />
                Quyền hạn của bạn
              </Space>
            }
          >
            {isAdmin ? (
              <Flex vertical align="center" gap={12} style={{ padding: '32px 0' }}>
                <SafetyCertificateOutlined style={{ fontSize: 48, color: '#faad14' }} />
                <Typography.Title level={5} style={{ margin: 0 }}>
                  Toàn quyền hệ thống
                </Typography.Title>
                <Typography.Text type="secondary" style={{ textAlign: 'center', maxWidth: 420 }}>
                  Tài khoản quản trị viên có quyền truy cập mọi chức năng, bao gồm phân quyền, cấu hình
                  hệ thống và nhật ký thao tác.
                </Typography.Text>
              </Flex>
            ) : (
              <>
                <Typography.Paragraph type="secondary">
                  Bạn được cấp {user.permissions.length} quyền. Chức năng ngoài danh sách này sẽ không hiện
                  trên menu.
                </Typography.Paragraph>
                <Space size={[6, 8]} wrap>
                  {user.permissions.map((p) => (
                    <Tag key={p} style={{ margin: 0 }}>
                      {PERMISSION_LABELS[p] ?? p}
                    </Tag>
                  ))}
                </Space>
              </>
            )}
          </Card>
        </Col>
      </Row>

      <ChangePasswordModal open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </>
  )
}
