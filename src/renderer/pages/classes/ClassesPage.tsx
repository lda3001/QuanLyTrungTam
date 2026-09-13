import { MuiDropdown as Dropdown, MuiSelect as Select } from '@/components/common/MuiControls'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Progress, Space, Tag, Tooltip, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  BankOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  MoreOutlined,
  PlusOutlined
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/common/PageHeader'
import { DataTable } from '@/components/common/DataTable'
import { Can, SearchInput, StatusTag } from '@/components/common'
import { ClassFormDrawer } from './ClassFormDrawer'
import { useTableQuery } from '@/hooks/useTableQuery'
import { useNotify } from '@/hooks/useNotify'
import { classService, courseService, teacherService } from '@/services/academic.service'
import { formatCurrency, formatDate } from '@/utils/format'
import {
  ClassStatus,
  ClassStatusColor,
  ClassStatusLabel,
  WeekdayLabel
} from '@shared/constants/enums'
import { PERMISSIONS } from '@shared/constants/permissions'
import type { ClassRoomDetail } from '@shared/types/entities'

export default function ClassesPage() {
  const navigate = useNavigate()
  const notify = useNotify()
  const queryClient = useQueryClient()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)

  const table = useTableQuery<{ status?: ClassStatus; courseId?: number; teacherId?: number }>()

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['classes', table.query],
    queryFn: () => classService.list(table.query),
    placeholderData: (prev) => prev
  })

  const { data: courseOptions = [] } = useQuery({
    queryKey: ['course-options'],
    queryFn: () => courseService.options(),
    staleTime: 5 * 60_000
  })

  const { data: teacherOptions = [] } = useQuery({
    queryKey: ['teacher-options'],
    queryFn: () => teacherService.options(),
    staleTime: 5 * 60_000
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => classService.remove(id),
    onSuccess: () => {
      notify.success('Đã xoá lớp học.')
      void queryClient.invalidateQueries({ queryKey: ['classes'] })
    },
    onError: (err) => notify.error(err)
  })

  const columns = useMemo<ColumnsType<ClassRoomDetail>>(
    () => [
      {
        title: 'Mã lớp',
        dataIndex: 'code',
        width: 100,
        sorter: true,
        fixed: 'left',
        render: (v: string) => <Typography.Text strong>{v}</Typography.Text>
      },
      {
        title: 'Lớp học',
        dataIndex: 'name',
        width: 240,
        sorter: true,
        render: (v: string, row) => (
          <div>
            <Typography.Text strong>{v}</Typography.Text>
            <br />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {row.courseName}
            </Typography.Text>
          </div>
        )
      },
      {
        title: 'Giáo viên',
        dataIndex: 'teacherName',
        width: 170,
        render: (v: string | null) =>
          v ?? <Typography.Text type="secondary">Chưa phân công</Typography.Text>
      },
      {
        title: 'Lịch học',
        key: 'schedules',
        width: 220,
        render: (_, row) =>
          row.schedules.length === 0 ? (
            <Typography.Text type="secondary">Chưa có</Typography.Text>
          ) : (
            <Space size={4} wrap>
              {row.schedules.map((s) => (
                <Tooltip
                  key={s.id}
                  title={`${s.startTime} – ${s.endTime}${s.room ? ` · ${s.room}` : ''}`}
                >
                  <Tag style={{ margin: 0 }}>{WeekdayLabel[s.weekday]}</Tag>
                </Tooltip>
              ))}
            </Space>
          )
      },
      {
        title: 'Phòng',
        dataIndex: 'room',
        width: 90,
        render: (v: string | null) => v ?? '—'
      },
      {
        title: 'Sĩ số',
        key: 'students',
        width: 150,
        render: (_, row) => {
          const percent =
            row.maxStudents > 0 ? Math.round((row.studentCount / row.maxStudents) * 100) : 0
          return (
            <div>
              <Typography.Text style={{ fontSize: 13 }}>
                {row.studentCount} / {row.maxStudents}
              </Typography.Text>
              <Progress
                percent={percent}
                size="small"
                showInfo={false}
                // Gần đầy chuyển vàng, đầy chuyển đỏ — nhìn là biết còn nhận được không
                strokeColor={percent >= 100 ? '#ff4d4f' : percent >= 80 ? '#faad14' : '#52c41a'}
              />
            </div>
          )
        }
      },
      {
        title: 'Học phí lớp',
        dataIndex: 'courseFee',
        width: 140,
        align: 'right',
        render: (v: number) => formatCurrency(v)
      },
      {
        title: 'Thời gian',
        dataIndex: 'startDate',
        width: 180,
        sorter: true,
        render: (v: string | null, row) => (
          <Typography.Text style={{ fontSize: 13 }}>
            {formatDate(v)} → {formatDate(row.endDate)}
          </Typography.Text>
        )
      },
      {
        title: 'Năm học',
        dataIndex: 'academicYear',
        width: 120,
        render: (value: string | null) => value ?? '—'
      },
      {
        title: 'Trạng thái',
        dataIndex: 'status',
        width: 140,
        render: (v: ClassStatus) => (
          <StatusTag value={v} labels={ClassStatusLabel} colors={ClassStatusColor} />
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
                { key: 'view', icon: <EyeOutlined />, label: 'Chi tiết & xếp lớp' },
                { key: 'edit', icon: <EditOutlined />, label: 'Chỉnh sửa' },
                { type: 'divider' },
                { key: 'delete', icon: <DeleteOutlined />, label: 'Xoá', danger: true }
              ],
              onClick: ({ key, domEvent }) => {
                domEvent.stopPropagation()
                if (key === 'view') navigate(`/classes/${row.id}`)
                else if (key === 'edit') {
                  setEditingId(row.id)
                  setDrawerOpen(true)
                } else if (key === 'delete') {
                  notify.confirmDelete({
                    content: `Xoá lớp "${row.name}"? Chỉ xoá được khi lớp chưa có học viên.`,
                    onOk: () => deleteMutation.mutateAsync(row.id)
                  })
                }
              }
            }}
          >
            <Button type="text" icon={<MoreOutlined />} onClick={(e) => e.stopPropagation()} />
          </Dropdown>
        )
      }
    ],
    [navigate, notify, deleteMutation]
  )

  return (
    <>
      <PageHeader
        title="Quản lý lớp học"
        subtitle={data ? `Tổng cộng ${data.total} lớp` : 'Đang tải...'}
        breadcrumbs={[{ title: 'Đào tạo' }, { title: 'Lớp học' }]}
        icon={<BankOutlined style={{ fontSize: 26, color: '#fa8c16' }} />}
        extra={
          <Can permission={PERMISSIONS.CLASS_CREATE}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingId(null)
                setDrawerOpen(true)
              }}
            >
              Tạo lớp học
            </Button>
          </Can>
        }
      />

      <DataTable<ClassRoomDetail>
        columns={columns}
        dataSource={data?.items ?? []}
        total={data?.total}
        page={table.page}
        pageSize={table.pageSize}
        loading={isLoading || isFetching}
        onChange={table.handleTableChange}
        onRow={(row) => ({
          onDoubleClick: () => navigate(`/classes/${row.id}`),
          style: { cursor: 'pointer' }
        })}
        toolbar={
          <Space wrap>
            <SearchInput
              value={table.keywordInput}
              onChange={table.setKeyword}
              placeholder="Tìm theo mã, tên lớp, phòng..."
              width={280}
            />
            <Select
              allowClear
              placeholder="Khoá học"
              style={{ width: 220 }}
              value={table.filters.courseId}
              onChange={(courseId) => table.setFilters({ courseId })}
              options={courseOptions}
              showSearch
              filterOption={(input, option) =>
                String(option?.label ?? '')
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
            />
            <Select
              allowClear
              placeholder="Giáo viên"
              style={{ width: 200 }}
              value={table.filters.teacherId}
              onChange={(teacherId) => table.setFilters({ teacherId })}
              options={teacherOptions}
              showSearch
              filterOption={(input, option) =>
                String(option?.label ?? '')
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
            />
            <Select
              allowClear
              placeholder="Trạng thái"
              style={{ width: 170 }}
              value={table.filters.status}
              onChange={(status) => table.setFilters({ status })}
              options={Object.entries(ClassStatusLabel).map(([value, label]) => ({ value, label }))}
            />
          </Space>
        }
      />

      <ClassFormDrawer open={drawerOpen} classId={editingId} onClose={() => setDrawerOpen(false)} />
    </>
  )
}
