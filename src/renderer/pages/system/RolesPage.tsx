import { useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  Flex,
  Form,
  Input,
  Row,
  Space,
  Tag,
  Tree,
  Typography
} from 'antd'
import type { DataNode } from 'antd/es/tree'
import { DeleteOutlined, EditOutlined, PlusOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/common/PageHeader'
import { Can } from '@/components/common'
import { useNotify } from '@/hooks/useNotify'
import { roleService } from '@/services/admin.service'
import {
  PERMISSIONS,
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
  ROLE_LABELS,
  type Permission
} from '@shared/constants/permissions'
import type { RoleWithPermissions } from '@shared/types/entities'

/**
 * Phân quyền theo vai trò.
 *
 * Cây quyền dùng `checkStrictly: false` mặc định của AntD Tree: tích nhóm cha
 * là tích toàn bộ quyền con. Khi lưu, chỉ gửi lên các nút LÁ (mã quyền thật) —
 * khoá nhóm chỉ tồn tại trên giao diện, không phải quyền trong database.
 */
export default function RolesPage() {
  const notify = useNotify()
  const queryClient = useQueryClient()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<RoleWithPermissions | null>(null)
  const [checked, setChecked] = useState<string[]>([])
  const [form, setForm] = useState({ code: '', name: '', description: '' })

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: () => roleService.list()
  })

  const treeData = useMemo<DataNode[]>(
    () =>
      PERMISSION_GROUPS.map((group) => ({
        title: <Typography.Text strong>{group.label}</Typography.Text>,
        key: `group:${group.key}`,
        children: group.permissions.map((p) => ({
          title: PERMISSION_LABELS[p] ?? p,
          key: p
        }))
      })),
    []
  )

  const openDrawer = (role: RoleWithPermissions | null): void => {
    setEditing(role)
    setChecked(role ? role.permissions : [])
    setForm({
      code: role?.code ?? '',
      name: role?.name ?? '',
      description: role?.description ?? ''
    })
    setDrawerOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      // Lọc bỏ khoá nhóm, chỉ giữ mã quyền thật
      const permissions = checked.filter((k) => !k.startsWith('group:')) as Permission[]
      const payload = {
        code: form.code.trim().toLowerCase(),
        name: form.name.trim(),
        description: form.description.trim() || null,
        permissions
      }
      return editing ? roleService.update(editing.id, payload) : roleService.create(payload)
    },
    onSuccess: () => {
      notify.success(editing ? 'Đã cập nhật vai trò.' : 'Đã tạo vai trò mới.')
      void queryClient.invalidateQueries({ queryKey: ['roles'] })
      void queryClient.invalidateQueries({ queryKey: ['role-options'] })
      setDrawerOpen(false)
    },
    onError: (err) => notify.error(err)
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => roleService.remove(id),
    onSuccess: () => {
      notify.success('Đã xoá vai trò.')
      void queryClient.invalidateQueries({ queryKey: ['roles'] })
    },
    onError: (err) => notify.error(err)
  })

  const isAdminRole = editing?.code === 'admin'

  return (
    <>
      <PageHeader
        title="Phân quyền"
        subtitle="Quản lý vai trò và phạm vi truy cập của từng nhóm nhân viên"
        breadcrumbs={[{ title: 'Hệ thống' }, { title: 'Phân quyền' }]}
        icon={<SafetyCertificateOutlined style={{ fontSize: 26, color: '#52c41a' }} />}
        extra={
          <Can permission={PERMISSIONS.USER_CREATE}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openDrawer(null)}>
              Tạo vai trò
            </Button>
          </Can>
        }
      />

      <Alert
        type="info"
        showIcon
        message="Quyền được kiểm tra ở cả giao diện lẫn máy chủ nội bộ"
        description="Ẩn menu chỉ để gọn giao diện. Mọi thao tác đều được kiểm tra quyền một lần nữa trước khi ghi vào cơ sở dữ liệu, nên không thể lách bằng cách sửa giao diện."
        style={{ marginBottom: 16 }}
      />

      <Row gutter={[16, 16]}>
        {roles.map((role) => (
          <Col xs={24} md={12} xl={8} key={role.id}>
            <Card
              loading={isLoading}
              title={
                <Space>
                  <Typography.Text strong>{ROLE_LABELS[role.code] ?? role.name}</Typography.Text>
                  {role.isSystem === 1 && <Tag color="blue">Hệ thống</Tag>}
                </Space>
              }
              extra={
                <Space>
                  <Can permission={PERMISSIONS.USER_UPDATE}>
                    <Button type="text" icon={<EditOutlined />} onClick={() => openDrawer(role)} />
                  </Can>
                  <Can permission={PERMISSIONS.USER_DELETE}>
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      disabled={role.isSystem === 1}
                      onClick={() =>
                        notify.confirmDelete({
                          content: `Xoá vai trò "${role.name}"? Chỉ xoá được khi không còn tài khoản nào dùng vai trò này.`,
                          onOk: () => deleteMutation.mutateAsync(role.id)
                        })
                      }
                    />
                  </Can>
                </Space>
              }
              style={{ height: '100%' }}
            >
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Mã">
                  <Typography.Text code>{role.code}</Typography.Text>
                </Descriptions.Item>
                <Descriptions.Item label="Mô tả">{role.description ?? '—'}</Descriptions.Item>
                <Descriptions.Item label="Tài khoản">{role.userCount} người dùng</Descriptions.Item>
                <Descriptions.Item label="Số quyền">
                  <Tag color={role.code === 'admin' ? 'gold' : 'default'}>
                    {role.code === 'admin' ? 'Toàn quyền' : `${role.permissions.length} quyền`}
                  </Tag>
                </Descriptions.Item>
              </Descriptions>

              <div style={{ marginTop: 12, maxHeight: 120, overflowY: 'auto' }}>
                <Space size={[4, 4]} wrap>
                  {role.permissions.slice(0, 12).map((p) => (
                    <Tag key={p} style={{ margin: 0, fontSize: 11 }}>
                      {PERMISSION_LABELS[p] ?? p}
                    </Tag>
                  ))}
                  {role.permissions.length > 12 && (
                    <Tag style={{ margin: 0, fontSize: 11 }}>+{role.permissions.length - 12}</Tag>
                  )}
                </Space>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={620}
        title={editing ? `Chỉnh sửa vai trò: ${editing.name}` : 'Tạo vai trò mới'}
        destroyOnClose
        footer={
          <Flex justify="flex-end">
            <Space>
              <Button onClick={() => setDrawerOpen(false)}>Huỷ</Button>
              <Button
                type="primary"
                loading={saveMutation.isPending}
                disabled={!form.name.trim() || !form.code.trim()}
                onClick={() => saveMutation.mutate()}
              >
                Lưu vai trò
              </Button>
            </Space>
          </Flex>
        }
      >
        <Form layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Mã vai trò" required>
                <Input
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="thu-ngan"
                  // Vai trò hệ thống dùng mã cố định trong mã nguồn
                  disabled={editing?.isSystem === 1}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Tên hiển thị" required>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Thu ngân"
                />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="Mô tả">
                <Input.TextArea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                  placeholder="Vai trò này phụ trách công việc gì?"
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>

        {isAdminRole ? (
          <Alert
            type="warning"
            showIcon
            message="Vai trò Quản trị viên luôn có toàn quyền"
            description="Không thể giới hạn quyền của vai trò này để tránh trường hợp không còn ai quản trị được hệ thống."
          />
        ) : (
          <>
            <Flex justify="space-between" align="center" style={{ marginBottom: 8 }}>
              <Typography.Text strong>Danh sách quyền</Typography.Text>
              <Space>
                <Button
                  size="small"
                  onClick={() => setChecked(PERMISSION_GROUPS.flatMap((g) => g.permissions))}
                >
                  Chọn tất cả
                </Button>
                <Button size="small" onClick={() => setChecked([])}>
                  Bỏ chọn
                </Button>
              </Space>
            </Flex>

            <Card size="small" styles={{ body: { maxHeight: 460, overflowY: 'auto' } }}>
              <Tree
                checkable
                selectable={false}
                defaultExpandAll
                treeData={treeData}
                checkedKeys={checked}
                onCheck={(keys) => setChecked((keys as string[]) ?? [])}
              />
            </Card>

            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
              Đã chọn {checked.filter((k) => !k.startsWith('group:')).length} quyền
            </Typography.Text>
          </>
        )}
      </Drawer>
    </>
  )
}
