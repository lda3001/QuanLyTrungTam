import { useEffect, useMemo, useState } from 'react'
import { Button, Col, Drawer, Dropdown, Flex, Form, Row, Select, Space, Spin, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  DeleteOutlined,
  EditOutlined,
  FileExcelOutlined,
  MoreOutlined,
  PlusOutlined,
  SolutionOutlined
} from '@ant-design/icons'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/common/PageHeader'
import { DataTable } from '@/components/common/DataTable'
import { Blank, Can, PersonCell, SearchInput, StatusTag } from '@/components/common'
import {
  FormDatePicker,
  FormInput,
  FormNumber,
  FormRadioGroup,
  FormSelect,
  FormTextArea
} from '@/components/form/fields'
import { useTableQuery } from '@/hooks/useTableQuery'
import { useNotify } from '@/hooks/useNotify'
import { useExport } from '@/hooks/useExport'
import { teacherService } from '@/services/academic.service'
import { teacherSchema, type TeacherForm } from '@/utils/schemas'
import { dayjs, formatCurrency, formatDate } from '@/utils/format'
import { Gender, GenderLabel, TeacherStatus, TeacherStatusLabel } from '@shared/constants/enums'
import { PERMISSIONS } from '@shared/constants/permissions'
import type { Teacher } from '@shared/types/entities'
import type { TeacherInput } from '@shared/types/dto'

const STATUS_COLORS: Record<string, string> = { active: 'green', inactive: 'default' }

const EMPTY: TeacherForm = {
  code: '',
  fullName: '',
  gender: Gender.MALE,
  birthDate: null,
  email: '',
  phone: '',
  address: '',
  specialization: '',
  degree: '',
  salary: 0,
  hireDate: null,
  status: TeacherStatus.ACTIVE,
  note: ''
}

/* ------------------------- Drawer thêm/sửa ------------------------- */

function TeacherFormDrawer({
  open,
  teacherId,
  onClose
}: {
  open: boolean
  teacherId: number | null
  onClose: () => void
}) {
  const notify = useNotify()
  const queryClient = useQueryClient()
  const isEdit = teacherId !== null

  const { control, handleSubmit, reset } = useForm<TeacherForm>({
    resolver: zodResolver(teacherSchema),
    defaultValues: EMPTY
  })

  const { data: teacher, isFetching } = useQuery({
    queryKey: ['teacher', teacherId],
    queryFn: () => teacherService.get(teacherId as number),
    enabled: open && isEdit
  })

  useEffect(() => {
    if (!open) return
    if (isEdit && teacher) {
      reset({
        code: teacher.code,
        fullName: teacher.fullName,
        gender: teacher.gender,
        birthDate: teacher.birthDate,
        email: teacher.email ?? '',
        phone: teacher.phone ?? '',
        address: teacher.address ?? '',
        specialization: teacher.specialization ?? '',
        degree: teacher.degree ?? '',
        salary: teacher.salary,
        hireDate: teacher.hireDate,
        status: teacher.status,
        note: teacher.note ?? ''
      })
    } else if (!isEdit) {
      reset(EMPTY)
    }
  }, [open, isEdit, teacher, reset])

  const mutation = useMutation({
    mutationFn: (values: TeacherForm) => {
      const payload: TeacherInput = {
        ...values,
        code: values.code?.trim() || undefined,
        email: values.email || null,
        phone: values.phone || null,
        address: values.address || null,
        specialization: values.specialization || null,
        degree: values.degree || null,
        note: values.note || null
      }
      return isEdit ? teacherService.update(teacherId, payload) : teacherService.create(payload)
    },
    onSuccess: () => {
      notify.success(isEdit ? 'Đã cập nhật giáo viên.' : 'Đã thêm giáo viên mới.')
      void queryClient.invalidateQueries({ queryKey: ['teachers'] })
      void queryClient.invalidateQueries({ queryKey: ['teacher-options'] })
      onClose()
    },
    onError: (err) => notify.error(err)
  })

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={620}
      title={isEdit ? 'Cập nhật giáo viên' : 'Thêm giáo viên mới'}
      destroyOnClose
      footer={
        <Flex justify="flex-end">
          <Space>
            <Button onClick={onClose}>Huỷ</Button>
            <Button type="primary" loading={mutation.isPending} onClick={handleSubmit((v) => mutation.mutate(v))}>
              {isEdit ? 'Lưu thay đổi' : 'Thêm giáo viên'}
            </Button>
          </Space>
        </Flex>
      }
    >
      <Spin spinning={isFetching}>
        <Form layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <FormInput control={control} name="code" label="Mã giáo viên" placeholder="Tự sinh nếu bỏ trống" />
            </Col>
            <Col span={12}>
              <FormSelect
                control={control}
                name="status"
                label="Trạng thái"
                required
                options={Object.entries(TeacherStatusLabel).map(([value, label]) => ({ value, label }))}
              />
            </Col>

            <Col span={24}>
              <FormInput control={control} name="fullName" label="Họ và tên" placeholder="Trần Văn B" required />
            </Col>

            <Col span={12}>
              <FormRadioGroup
                control={control}
                name="gender"
                label="Giới tính"
                optionType="button"
                options={Object.entries(GenderLabel).map(([value, label]) => ({ value, label }))}
              />
            </Col>
            <Col span={12}>
              <FormDatePicker
                control={control}
                name="birthDate"
                label="Ngày sinh"
                disabledDate={(current) => current && current > dayjs().endOf('day')}
              />
            </Col>

            <Col span={12}>
              <FormInput control={control} name="phone" label="Điện thoại" placeholder="0912345678" />
            </Col>
            <Col span={12}>
              <FormInput control={control} name="email" label="Email" placeholder="giaovien@trungtam.vn" />
            </Col>

            <Col span={12}>
              <FormInput
                control={control}
                name="specialization"
                label="Chuyên môn"
                placeholder="IELTS, Toán tư duy..."
              />
            </Col>
            <Col span={12}>
              <FormInput control={control} name="degree" label="Trình độ" placeholder="Cử nhân / Thạc sĩ" />
            </Col>

            <Col span={12}>
              <FormNumber
                control={control}
                name="salary"
                label="Mức lương"
                isCurrency
                step={500_000}
                placeholder="15.000.000"
              />
            </Col>
            <Col span={12}>
              <FormDatePicker control={control} name="hireDate" label="Ngày vào làm" />
            </Col>

            <Col span={24}>
              <FormInput control={control} name="address" label="Địa chỉ" />
            </Col>
            <Col span={24}>
              <FormTextArea control={control} name="note" label="Ghi chú" rows={3} maxLength={500} />
            </Col>
          </Row>
        </Form>
      </Spin>
    </Drawer>
  )
}

/* --------------------------- Trang chính --------------------------- */

export default function TeachersPage() {
  const notify = useNotify()
  const queryClient = useQueryClient()
  const { exportExcel, exporting } = useExport()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)

  const table = useTableQuery<{ status?: TeacherStatus }>()

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['teachers', table.query],
    queryFn: () => teacherService.list(table.query),
    placeholderData: (prev) => prev
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => teacherService.remove(id),
    onSuccess: () => {
      notify.success('Đã xoá giáo viên.')
      void queryClient.invalidateQueries({ queryKey: ['teachers'] })
    },
    onError: (err) => notify.error(err)
  })

  const columns = useMemo<ColumnsType<Teacher>>(
    () => [
      {
        title: 'Mã GV',
        dataIndex: 'code',
        width: 110,
        sorter: true,
        fixed: 'left',
        render: (v: string) => <Typography.Text strong>{v}</Typography.Text>
      },
      {
        title: 'Giáo viên',
        dataIndex: 'fullName',
        width: 240,
        sorter: true,
        render: (v: string, row) => <PersonCell name={v} sub={row.degree ?? GenderLabel[row.gender]} />
      },
      {
        title: 'Chuyên môn',
        dataIndex: 'specialization',
        width: 200,
        render: (v: string | null) => v ?? <Blank />
      },
      {
        title: 'Liên hệ',
        dataIndex: 'phone',
        width: 200,
        render: (v: string | null, row) => (
          <div>
            <div>{v ?? <Blank />}</div>
            {row.email && (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {row.email}
              </Typography.Text>
            )}
          </div>
        )
      },
      {
        title: 'Mức lương',
        dataIndex: 'salary',
        width: 150,
        align: 'right',
        sorter: true,
        render: (v: number) => <Typography.Text strong>{formatCurrency(v)}</Typography.Text>
      },
      {
        title: 'Ngày vào làm',
        dataIndex: 'hireDate',
        width: 130,
        sorter: true,
        render: (v: string | null) => formatDate(v)
      },
      {
        title: 'Trạng thái',
        dataIndex: 'status',
        width: 140,
        render: (v: TeacherStatus) => (
          <StatusTag value={v} labels={TeacherStatusLabel} colors={STATUS_COLORS} />
        )
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
                { type: 'divider' },
                { key: 'delete', icon: <DeleteOutlined />, label: 'Xoá', danger: true }
              ],
              onClick: ({ key }) => {
                if (key === 'edit') {
                  setEditingId(row.id)
                  setDrawerOpen(true)
                } else if (key === 'delete') {
                  notify.confirmDelete({
                    content: `Xoá giáo viên "${row.fullName}"?`,
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

  const handleExport = async (): Promise<void> => {
    const all = await teacherService.list({ ...table.query, page: 1, pageSize: 200 })
    await exportExcel({
      fileName: `Danh-sach-giao-vien-${new Date().toISOString().slice(0, 10)}`,
      sheetName: 'Giáo viên',
      title: 'DANH SÁCH GIÁO VIÊN',
      columns: [
        { key: 'code', title: 'Mã GV', width: 14 },
        { key: 'fullName', title: 'Họ và tên', width: 26 },
        { key: 'genderLabel', title: 'Giới tính', width: 12 },
        { key: 'specialization', title: 'Chuyên môn', width: 24 },
        { key: 'degree', title: 'Trình độ', width: 16 },
        { key: 'phone', title: 'Điện thoại', width: 16 },
        { key: 'email', title: 'Email', width: 26 },
        { key: 'salary', title: 'Mức lương', width: 18 },
        { key: 'hireDateText', title: 'Ngày vào làm', width: 16 },
        { key: 'statusLabel', title: 'Trạng thái', width: 16 }
      ],
      rows: all.items.map((t) => ({
        code: t.code,
        fullName: t.fullName,
        genderLabel: GenderLabel[t.gender],
        specialization: t.specialization ?? '',
        degree: t.degree ?? '',
        phone: t.phone ?? '',
        email: t.email ?? '',
        salary: t.salary,
        hireDateText: formatDate(t.hireDate),
        statusLabel: TeacherStatusLabel[t.status]
      }))
    })
  }

  return (
    <>
      <PageHeader
        title="Quản lý giáo viên"
        subtitle={data ? `Tổng cộng ${data.total} giáo viên` : 'Đang tải...'}
        breadcrumbs={[{ title: 'Đào tạo' }, { title: 'Giáo viên' }]}
        icon={<SolutionOutlined style={{ fontSize: 26, color: '#722ed1' }} />}
        extra={
          <>
            <Button icon={<FileExcelOutlined />} loading={exporting} onClick={handleExport}>
              Xuất Excel
            </Button>
            <Can permission={PERMISSIONS.TEACHER_CREATE}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  setEditingId(null)
                  setDrawerOpen(true)
                }}
              >
                Thêm giáo viên
              </Button>
            </Can>
          </>
        }
      />

      <DataTable<Teacher>
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
              placeholder="Tìm theo mã, tên, chuyên môn..."
              width={320}
            />
            <Select
              allowClear
              placeholder="Trạng thái"
              style={{ width: 180 }}
              value={table.filters.status}
              onChange={(status) => table.setFilters({ status })}
              options={Object.entries(TeacherStatusLabel).map(([value, label]) => ({ value, label }))}
            />
          </Space>
        }
      />

      <TeacherFormDrawer open={drawerOpen} teacherId={editingId} onClose={() => setDrawerOpen(false)} />
    </>
  )
}
