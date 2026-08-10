import { MuiDropdown as Dropdown, MuiSelect as Select } from '@/components/common/MuiControls'
import { useEffect, useMemo, useState } from 'react'
import { Button, Col, Form, Modal, Row, Space, Spin, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { BookOutlined, DeleteOutlined, EditOutlined, MoreOutlined, PlusOutlined } from '@ant-design/icons'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/common/PageHeader'
import { DataTable } from '@/components/common/DataTable'
import { Can, Ellipsis, SearchInput, StatusTag } from '@/components/common'
import { FormInput, FormNumber, FormSelect, FormTextArea } from '@/components/form/fields'
import { useTableQuery } from '@/hooks/useTableQuery'
import { useNotify } from '@/hooks/useNotify'
import { courseService } from '@/services/academic.service'
import { courseSchema, type CourseForm } from '@/utils/schemas'
import { formatCurrency } from '@/utils/format'
import { CourseStatus, CourseStatusLabel } from '@shared/constants/enums'
import { PERMISSIONS } from '@shared/constants/permissions'
import type { Course } from '@shared/types/entities'
import type { CourseInput } from '@shared/types/dto'

const STATUS_COLORS: Record<string, string> = { active: 'green', inactive: 'default' }

const EMPTY: CourseForm = {
  code: '',
  name: '',
  description: '',
  tuitionFee: 0,
  durationHours: 0,
  totalSessions: 0,
  status: CourseStatus.ACTIVE
}

/**
 * Khoá học là "khuôn": định nghĩa học phí và số buổi. Lớp học là một lần mở
 * cụ thể của khoá đó. Tách hai khái niệm giúp mở nhiều lớp cùng chương trình
 * mà không phải nhập lại học phí.
 */
function CourseFormModal({
  open,
  courseId,
  onClose
}: {
  open: boolean
  courseId: number | null
  onClose: () => void
}) {
  const notify = useNotify()
  const queryClient = useQueryClient()
  const isEdit = courseId !== null

  const { control, handleSubmit, reset } = useForm<CourseForm>({
    resolver: zodResolver(courseSchema),
    defaultValues: EMPTY
  })

  const { data: course, isFetching } = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => courseService.get(courseId as number),
    enabled: open && isEdit
  })

  useEffect(() => {
    if (!open) return
    if (isEdit && course) {
      reset({
        code: course.code,
        name: course.name,
        description: course.description ?? '',
        tuitionFee: course.tuitionFee,
        durationHours: course.durationHours,
        totalSessions: course.totalSessions,
        status: course.status
      })
    } else if (!isEdit) {
      reset(EMPTY)
    }
  }, [open, isEdit, course, reset])

  const mutation = useMutation({
    mutationFn: (values: CourseForm) => {
      const payload: CourseInput = {
        ...values,
        code: values.code?.trim() || undefined,
        description: values.description || null
      }
      return isEdit ? courseService.update(courseId, payload) : courseService.create(payload)
    },
    onSuccess: () => {
      notify.success(isEdit ? 'Đã cập nhật khoá học.' : 'Đã thêm khoá học mới.')
      void queryClient.invalidateQueries({ queryKey: ['courses'] })
      void queryClient.invalidateQueries({ queryKey: ['course-options'] })
      if (courseId !== null) void queryClient.invalidateQueries({ queryKey: ['course', courseId] })
      onClose()
    },
    onError: (err) => notify.error(err)
  })

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={isEdit ? 'Cập nhật khoá học' : 'Thêm khoá học mới'}
      onOk={handleSubmit((v) => mutation.mutate(v))}
      okText={isEdit ? 'Lưu thay đổi' : 'Thêm khoá học'}
      cancelText="Huỷ"
      confirmLoading={mutation.isPending}
      width={640}
      destroyOnClose
    >
      <Spin spinning={isFetching}>
        <Form layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <FormInput control={control} name="code" label="Mã khoá học" placeholder="Tự sinh nếu bỏ trống" />
            </Col>
            <Col span={12}>
              <FormSelect
                control={control}
                name="status"
                label="Trạng thái"
                required
                options={Object.entries(CourseStatusLabel).map(([value, label]) => ({ value, label }))}
              />
            </Col>

            <Col span={24}>
              <FormInput
                control={control}
                name="name"
                label="Tên khoá học"
                placeholder="Tiếng Anh Giao Tiếp Cơ Bản"
                required
              />
            </Col>

            <Col span={8}>
              <FormNumber
                control={control}
                name="tuitionFee"
                label="Học phí"
                isCurrency
                step={100_000}
                required
              />
            </Col>
            <Col span={8}>
              <FormNumber
                control={control}
                name="totalSessions"
                label="Số buổi"
                addonAfter="buổi"
                required
              />
            </Col>
            <Col span={8}>
              <FormNumber
                control={control}
                name="durationHours"
                label="Thời lượng"
                addonAfter="giờ"
                required
              />
            </Col>

            <Col span={24}>
              <FormTextArea
                control={control}
                name="description"
                label="Mô tả"
                placeholder="Nội dung, lộ trình, đối tượng phù hợp..."
                rows={4}
                maxLength={1000}
              />
            </Col>
          </Row>
        </Form>
      </Spin>
    </Modal>
  )
}

export default function CoursesPage() {
  const notify = useNotify()
  const queryClient = useQueryClient()

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)

  const table = useTableQuery<{ status?: CourseStatus }>()

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['courses', table.query],
    queryFn: () => courseService.list(table.query),
    placeholderData: (prev) => prev
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => courseService.remove(id),
    onSuccess: () => {
      notify.success('Đã xoá khoá học.')
      void queryClient.invalidateQueries({ queryKey: ['courses'] })
    },
    onError: (err) => notify.error(err)
  })

  const columns = useMemo<ColumnsType<Course>>(
    () => [
      {
        title: 'Mã khoá',
        dataIndex: 'code',
        width: 110,
        sorter: true,
        fixed: 'left',
        render: (v: string) => <Typography.Text strong>{v}</Typography.Text>
      },
      {
        title: 'Tên khoá học',
        dataIndex: 'name',
        width: 260,
        sorter: true,
        render: (v: string) => <Typography.Text strong>{v}</Typography.Text>
      },
      {
        title: 'Mô tả',
        dataIndex: 'description',
        width: 300,
        render: (v: string | null) => <Ellipsis text={v} width={300} />
      },
      {
        title: 'Học phí',
        dataIndex: 'tuitionFee',
        width: 150,
        align: 'right',
        sorter: true,
        render: (v: number) => (
          <Typography.Text strong style={{ color: '#52c41a' }}>
            {formatCurrency(v)}
          </Typography.Text>
        )
      },
      {
        title: 'Số buổi',
        dataIndex: 'totalSessions',
        width: 100,
        align: 'center',
        sorter: true,
        render: (v: number) => `${v} buổi`
      },
      {
        title: 'Thời lượng',
        dataIndex: 'durationHours',
        width: 110,
        align: 'center',
        render: (v: number) => `${v} giờ`
      },
      {
        title: 'Trạng thái',
        dataIndex: 'status',
        width: 130,
        render: (v: CourseStatus) => <StatusTag value={v} labels={CourseStatusLabel} colors={STATUS_COLORS} />
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
                  setModalOpen(true)
                } else if (key === 'delete') {
                  notify.confirmDelete({
                    content: `Xoá khoá học "${row.name}"? Chỉ xoá được khi chưa có lớp nào thuộc khoá này.`,
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
        title="Quản lý khoá học"
        subtitle={data ? `Tổng cộng ${data.total} khoá học` : 'Đang tải...'}
        breadcrumbs={[{ title: 'Đào tạo' }, { title: 'Khoá học' }]}
        icon={<BookOutlined style={{ fontSize: 26, color: '#13c2c2' }} />}
        extra={
          <Can permission={PERMISSIONS.COURSE_CREATE}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingId(null)
                setModalOpen(true)
              }}
            >
              Thêm khoá học
            </Button>
          </Can>
        }
      />

      <DataTable<Course>
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
              placeholder="Tìm theo mã hoặc tên khoá học..."
              width={320}
            />
            <Select
              allowClear
              placeholder="Trạng thái"
              style={{ width: 160 }}
              value={table.filters.status}
              onChange={(status) => table.setFilters({ status })}
              options={Object.entries(CourseStatusLabel).map(([value, label]) => ({ value, label }))}
            />
          </Space>
        }
      />

      <CourseFormModal open={modalOpen} courseId={editingId} onClose={() => setModalOpen(false)} />
    </>
  )
}
