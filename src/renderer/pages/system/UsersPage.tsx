import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Col, Drawer, Dropdown, Flex, Form, Input, Modal, Row, Select, Space, Spin, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  DeleteOutlined,
  EditOutlined,
  KeyOutlined,
  MoreOutlined,
  PlusOutlined,
  UsergroupAddOutlined
} from '@ant-design/icons'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/common/PageHeader'
import { DataTable } from '@/components/common/DataTable'
import { Can, PersonCell, SearchInput } from '@/components/common'
import { FormInput, FormPassword, FormSelect, FormSwitch, FormTextArea } from '@/components/form/fields'
import { useTableQuery } from '@/hooks/useTableQuery'
import { useNotify } from '@/hooks/useNotify'
import { roleService, userService } from '@/services/admin.service'
import { teacherService } from '@/services/academic.service'
import { userSchema, type UserForm } from '@/utils/schemas'
import { formatDateTime } from '@/utils/format'
import { PERMISSIONS, ROLE_LABELS } from '@shared/constants/permissions'
import type { UserDetail } from '@shared/types/entities'

const EMPTY: UserForm = {
  username: '',
  password: '',
  fullName: '',
  email: '',
  phone: '',
  roleId: 0,
  teacherId: null,
  isActive: 1,
  securityQuestion: '',
  securityAnswer: ''
}

/* ---------------------- Drawer thêm/sửa tài khoản ---------------------- */

function UserFormDrawer({ open, userId, onClose }: { open: boolean; userId: number | null; onClose: () => void }) {
  const notify = useNotify()
  const queryClient = useQueryClient()
  const isEdit = userId !== null

  const { control, handleSubmit, reset } = useForm<UserForm>({
    resolver: zodResolver(userSchema),
    defaultValues: EMPTY
  })

  const { data: roleOptions = [] } = useQuery({
    queryKey: ['role-options'],
    queryFn: () => roleService.options(),
    enabled: open
  })

  const { data: teacherOptions = [] } = useQuery({
    queryKey: ['teacher-options'],
    queryFn: () => teacherService.options(),
    enabled: open,
    staleTime: 5 * 60_000
  })

  const { data: user, isFetching } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => userService.get(userId as number),
    enabled: open && isEdit
  })

  useEffect(() => {
    if (!open) return
    if (isEdit && user) {
      reset({
        username: user.username,
        password: '',
        fullName: user.fullName,
        email: user.email ?? '',
        phone: user.phone ?? '',
        roleId: user.roleId,
        teacherId: user.teacherId,
        isActive: user.isActive,
        securityQuestion: user.securityQuestion ?? '',
        securityAnswer: ''
      })
    } else if (!isEdit) {
      reset(EMPTY)
    }
  }, [open, isEdit, user, reset])

  const mutation = useMutation({
    mutationFn: (values: UserForm) => {
      const payload = {
        ...values,
        password: values.password || undefined,
        email: values.email || null,
        phone: values.phone || null,
        securityQuestion: values.securityQuestion || null,
        securityAnswer: values.securityAnswer || null
      }
      return isEdit ? userService.update(userId, payload) : userService.create(payload)
    },
    onSuccess: () => {
      notify.success(isEdit ? 'Đã cập nhật tài khoản.' : 'Đã tạo tài khoản mới.')
      void queryClient.invalidateQueries({ queryKey: ['users'] })
      onClose()
    },
    onError: (err) => notify.error(err)
  })

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={600}
      title={isEdit ? 'Cập nhật tài khoản' : 'Thêm nhân viên mới'}
      destroyOnClose
      footer={
        <Flex justify="flex-end">
          <Space>
            <Button onClick={onClose}>Huỷ</Button>
            <Button type="primary" loading={mutation.isPending} onClick={handleSubmit((v) => mutation.mutate(v))}>
              {isEdit ? 'Lưu thay đổi' : 'Tạo tài khoản'}
            </Button>
          </Space>
        </Flex>
      }
    >
      <Spin spinning={isFetching}>
        <Form layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <FormInput
                control={control}
                name="username"
                label="Tên đăng nhập"
                placeholder="nguyenvana"
                required
                disabled={isEdit && user?.id === 1}
              />
            </Col>
            <Col span={12}>
              <FormPassword
                control={control}
                name="password"
                label={isEdit ? 'Mật khẩu mới' : 'Mật khẩu'}
                placeholder={isEdit ? 'Bỏ trống nếu không đổi' : 'Tối thiểu 6 ký tự'}
                required={!isEdit}
                extra={isEdit ? 'Để trống sẽ giữ nguyên mật khẩu hiện tại' : undefined}
              />
            </Col>

            <Col span={24}>
              <FormInput control={control} name="fullName" label="Họ và tên" placeholder="Nguyễn Văn A" required />
            </Col>

            <Col span={12}>
              <FormInput control={control} name="email" label="Email" placeholder="nhanvien@trungtam.vn" />
            </Col>
            <Col span={12}>
              <FormInput control={control} name="phone" label="Điện thoại" placeholder="0912345678" />
            </Col>

            <Col span={12}>
              <FormSelect
                control={control}
                name="roleId"
                label="Vai trò"
                placeholder="Chọn vai trò"
                required
                options={roleOptions}
              />
            </Col>
            <Col span={12}>
              <FormSelect
                control={control}
                name="teacherId"
                label="Liên kết hồ sơ giáo viên"
                placeholder="Không bắt buộc"
                options={teacherOptions}
                extra="Chọn khi tài khoản này là giáo viên"
              />
            </Col>

            <Col span={24}>
              <FormSwitch
                control={control}
                name="isActive"
                label="Cho phép đăng nhập"
                checkedText="Hoạt động"
                uncheckedText="Khoá"
              />
            </Col>

            <Col span={24}>
              <Alert
                type="info"
                showIcon
                message="Câu hỏi bảo mật dùng để tự khôi phục mật khẩu khi quên, không cần quản trị viên can thiệp."
                style={{ marginBottom: 16 }}
              />
            </Col>

            <Col span={24}>
              <FormInput
                control={control}
                name="securityQuestion"
                label="Câu hỏi bảo mật"
                placeholder="Tên trường tiểu học của bạn là gì?"
              />
            </Col>
            <Col span={24}>
              <FormTextArea
                control={control}
                name="securityAnswer"
                label="Câu trả lời"
                placeholder={isEdit ? 'Bỏ trống nếu không đổi' : 'Nhập câu trả lời'}
                rows={2}
              />
            </Col>
          </Row>
        </Form>
      </Spin>
    </Drawer>
  )
}

/* ---------------------- Modal đặt lại mật khẩu ---------------------- */

function ResetPasswordModal({
  open,
  user,
  onClose
}: {
  open: boolean
  user: UserDetail | null
  onClose: () => void
}) {
  const notify = useNotify()
  const [password, setPassword] = useState('')

  useEffect(() => {
    if (open) setPassword('')
  }, [open])

  const mutation = useMutation({
    mutationFn: () => userService.resetPassword({ userId: user?.id as number, newPassword: password }),
    onSuccess: () => {
      notify.success('Đã đặt lại mật khẩu. Hãy thông báo cho nhân viên đổi lại ngay khi đăng nhập.')
      onClose()
    },
    onError: (err) => notify.error(err)
  })

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={`Đặt lại mật khẩu — ${user?.fullName ?? ''}`}
      onOk={() => mutation.mutate()}
      okText="Đặt lại"
      cancelText="Huỷ"
      okButtonProps={{ disabled: password.length < 6 }}
      confirmLoading={mutation.isPending}
      destroyOnClose
      centered
    >
      <Alert
        type="warning"
        showIcon
        message="Mật khẩu cũ sẽ bị thay thế ngay lập tức."
        style={{ marginBottom: 16 }}
      />
      <Form layout="vertical">
        <Form.Item
          label="Mật khẩu mới"
          help={password && password.length < 6 ? 'Tối thiểu 6 ký tự' : undefined}
          validateStatus={password && password.length < 6 ? 'error' : undefined}
        >
          <Input.Password
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Nhập mật khẩu mới"
            autoFocus
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}

/* --------------------------- Trang chính --------------------------- */

export default function UsersPage() {
  const notify = useNotify()
  const queryClient = useQueryClient()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [resetTarget, setResetTarget] = useState<UserDetail | null>(null)

  const table = useTableQuery<{ roleId?: number; isActive?: number }>()

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['users', table.query],
    queryFn: () => userService.list(table.query),
    placeholderData: (prev) => prev
  })

  const { data: roleOptions = [] } = useQuery({
    queryKey: ['role-options'],
    queryFn: () => roleService.options()
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => userService.remove(id),
    onSuccess: () => {
      notify.success('Đã xoá tài khoản.')
      void queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (err) => notify.error(err)
  })

  const columns = useMemo<ColumnsType<UserDetail>>(
    () => [
      {
        title: 'Nhân viên',
        dataIndex: 'fullName',
        width: 260,
        sorter: true,
        fixed: 'left',
        render: (v: string, row) => <PersonCell name={v} sub={`@${row.username}`} avatar={row.avatar} />
      },
      {
        title: 'Vai trò',
        dataIndex: 'roleName',
        width: 160,
        render: (v: string, row) => <Tag color="blue">{ROLE_LABELS[row.roleCode] ?? v}</Tag>
      },
      {
        title: 'Liên hệ',
        dataIndex: 'email',
        width: 240,
        render: (v: string | null, row) => (
          <div>
            <div>{v ?? '—'}</div>
            {row.phone && (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {row.phone}
              </Typography.Text>
            )}
          </div>
        )
      },
      {
        title: 'Trạng thái',
        dataIndex: 'isActive',
        width: 130,
        render: (v: number) => <Tag color={v ? 'green' : 'red'}>{v ? 'Hoạt động' : 'Đã khoá'}</Tag>
      },
      {
        title: 'Đăng nhập gần nhất',
        dataIndex: 'lastLoginAt',
        width: 180,
        sorter: true,
        render: (v: number | null) => (v ? formatDateTime(v) : <Typography.Text type="secondary">Chưa từng</Typography.Text>)
      },
      {
        title: '',
        key: 'actions',
        width: 60,
        fixed: 'right',
        align: 'center',
        render: (_, row) => (
          <Dropdown
            trigger={['click']}
            menu={{
              items: [
                { key: 'edit', icon: <EditOutlined />, label: 'Chỉnh sửa' },
                { key: 'reset', icon: <KeyOutlined />, label: 'Đặt lại mật khẩu' },
                { type: 'divider' },
                {
                  key: 'delete',
                  icon: <DeleteOutlined />,
                  label: 'Xoá',
                  danger: true,
                  // Tài khoản quản trị gốc không được xoá — main process cũng chặn
                  disabled: row.id === 1
                }
              ],
              onClick: ({ key }) => {
                if (key === 'edit') {
                  setEditingId(row.id)
                  setDrawerOpen(true)
                } else if (key === 'reset') {
                  setResetTarget(row)
                } else if (key === 'delete') {
                  notify.confirmDelete({
                    content: `Xoá tài khoản "${row.username}" của ${row.fullName}?`,
                    onOk: () => deleteMutation.mutateAsync(row.id)
                  })
                }
              }
            }}
          >
            <Button type="text" icon={<MoreOutlined />} />
          </Dropdown>
        )
      }
    ],
    [notify, deleteMutation]
  )

  return (
    <>
      <PageHeader
        title="Quản lý nhân viên"
        subtitle={data ? `${data.total} tài khoản` : 'Đang tải...'}
        breadcrumbs={[{ title: 'Hệ thống' }, { title: 'Nhân viên' }]}
        icon={<UsergroupAddOutlined style={{ fontSize: 26, color: '#1677ff' }} />}
        extra={
          <Can permission={PERMISSIONS.USER_CREATE}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingId(null)
                setDrawerOpen(true)
              }}
            >
              Thêm nhân viên
            </Button>
          </Can>
        }
      />

      <DataTable<UserDetail>
        columns={columns}
        dataSource={data?.items ?? []}
        total={data?.total}
        page={table.page}
        pageSize={table.pageSize}
        loading={isLoading || isFetching}
        onChange={table.handleTableChange}
        toolbar={
          <Space wrap>
            <SearchInput
              value={table.keywordInput}
              onChange={table.setKeyword}
              placeholder="Tìm theo tên, tên đăng nhập, email..."
              width={300}
            />
            <Select
              allowClear
              placeholder="Vai trò"
              style={{ width: 180 }}
              value={table.filters.roleId}
              onChange={(roleId) => table.setFilters({ roleId })}
              options={roleOptions}
            />
            <Select
              allowClear
              placeholder="Trạng thái"
              style={{ width: 160 }}
              value={table.filters.isActive}
              onChange={(isActive) => table.setFilters({ isActive })}
              options={[
                { value: 1, label: 'Hoạt động' },
                { value: 0, label: 'Đã khoá' }
              ]}
            />
          </Space>
        }
      />

      <UserFormDrawer open={drawerOpen} userId={editingId} onClose={() => setDrawerOpen(false)} />
      <ResetPasswordModal open={!!resetTarget} user={resetTarget} onClose={() => setResetTarget(null)} />
    </>
  )
}
