import { useMemo } from 'react'
import { DatePicker, Flex, Select, Space, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { AuditOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/common/PageHeader'
import { DataTable } from '@/components/common/DataTable'
import { Ellipsis, SearchInput } from '@/components/common'
import { useTableQuery } from '@/hooks/useTableQuery'
import { logService } from '@/services/admin.service'
import { dayjs, DATE_FORMAT, formatDateTime, formatRelative, ISO_DATE } from '@/utils/format'
import type { ActivityLog } from '@shared/types/entities'

/** Nhãn và màu cho từng loại thao tác — nhìn màu là đoán được mức độ nghiêm trọng */
const ACTION_META: Record<string, { label: string; color: string }> = {
  login: { label: 'Đăng nhập', color: 'blue' },
  logout: { label: 'Đăng xuất', color: 'default' },
  create: { label: 'Thêm mới', color: 'green' },
  update: { label: 'Cập nhật', color: 'orange' },
  delete: { label: 'Xoá', color: 'red' },
  enroll: { label: 'Xếp lớp', color: 'cyan' },
  unenroll: { label: 'Gỡ khỏi lớp', color: 'volcano' },
  mark: { label: 'Điểm danh', color: 'purple' },
  move: { label: 'Dời lịch', color: 'geekblue' },
  generate: { label: 'Sinh buổi học', color: 'lime' },
  export: { label: 'Xuất tệp', color: 'gold' },
  import: { label: 'Nhập tệp', color: 'gold' },
  'change-password': { label: 'Đổi mật khẩu', color: 'magenta' },
  'reset-password': { label: 'Đặt lại mật khẩu', color: 'magenta' },
  view: { label: 'Xem', color: 'default' }
}

const ENTITY_LABEL: Record<string, string> = {
  students: 'Học viên',
  teachers: 'Giáo viên',
  courses: 'Khoá học',
  classes: 'Lớp học',
  class_sessions: 'Buổi học',
  enrollments: 'Ghi danh',
  attendance: 'Điểm danh',
  payments: 'Phiếu thu',
  users: 'Tài khoản',
  roles: 'Vai trò',
  settings: 'Cấu hình',
  reports: 'Báo cáo',
  files: 'Tệp tin'
}

/**
 * Nhật ký hệ thống — dùng để truy vết khi có tranh chấp:
 * ai xoá phiếu thu, ai sửa điểm danh, ai đặt lại mật khẩu cho ai.
 */
export default function LogsPage() {
  const table = useTableQuery<{ action?: string; entity?: string; from?: string; to?: string }>({
    defaultPageSize: 30,
    defaultFilters: {
      from: dayjs().subtract(7, 'day').format(ISO_DATE),
      to: dayjs().format(ISO_DATE)
    }
  })

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['logs', table.query],
    queryFn: () => logService.list(table.query),
    placeholderData: (prev) => prev
  })

  const columns = useMemo<ColumnsType<ActivityLog>>(
    () => [
      {
        title: 'Thời điểm',
        dataIndex: 'createdAt',
        width: 200,
        fixed: 'left',
        render: (v: number) => (
          <div>
            <div>{formatDateTime(v)}</div>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {formatRelative(v)}
            </Typography.Text>
          </div>
        )
      },
      {
        title: 'Người thực hiện',
        dataIndex: 'username',
        width: 160,
        render: (v: string | null) => v ?? <Typography.Text type="secondary">Hệ thống</Typography.Text>
      },
      {
        title: 'Thao tác',
        dataIndex: 'action',
        width: 150,
        render: (v: string) => {
          const meta = ACTION_META[v] ?? { label: v, color: 'default' }
          return (
            <Tag color={meta.color} style={{ margin: 0 }}>
              {meta.label}
            </Tag>
          )
        }
      },
      {
        title: 'Đối tượng',
        dataIndex: 'entity',
        width: 140,
        render: (v: string) => ENTITY_LABEL[v] ?? v
      },
      {
        title: 'Nội dung',
        dataIndex: 'description',
        render: (v: string | null) => <Ellipsis text={v} width={460} />
      }
    ],
    []
  )

  return (
    <>
      <PageHeader
        title="Nhật ký hệ thống"
        subtitle={data ? `${data.total} bản ghi` : 'Đang tải...'}
        breadcrumbs={[{ title: 'Hệ thống' }, { title: 'Nhật ký' }]}
        icon={<AuditOutlined style={{ fontSize: 26, color: '#fa8c16' }} />}
      />

      <DataTable<ActivityLog>
        columns={columns}
        dataSource={data?.items ?? []}
        total={data?.total}
        page={table.page}
        pageSize={table.pageSize}
        loading={isLoading || isFetching}
        onChange={table.handleTableChange}
        toolbar={
          <Flex gap={12} wrap="wrap">
            <SearchInput
              value={table.keywordInput}
              onChange={table.setKeyword}
              placeholder="Tìm theo người dùng hoặc nội dung..."
              width={300}
            />
            <Select
              allowClear
              placeholder="Thao tác"
              style={{ width: 180 }}
              value={table.filters.action}
              onChange={(action) => table.setFilters({ action })}
              options={Object.entries(ACTION_META).map(([value, meta]) => ({ value, label: meta.label }))}
            />
            <Select
              allowClear
              placeholder="Đối tượng"
              style={{ width: 180 }}
              value={table.filters.entity}
              onChange={(entity) => table.setFilters({ entity })}
              options={Object.entries(ENTITY_LABEL).map(([value, label]) => ({ value, label }))}
            />
            <Space>
              <DatePicker.RangePicker
                format={DATE_FORMAT}
                value={[
                  table.filters.from ? dayjs(table.filters.from, ISO_DATE) : null,
                  table.filters.to ? dayjs(table.filters.to, ISO_DATE) : null
                ]}
                onChange={(dates) =>
                  table.setFilters({
                    from: dates?.[0]?.format(ISO_DATE),
                    to: dates?.[1]?.format(ISO_DATE)
                  })
                }
              />
            </Space>
          </Flex>
        }
      />
    </>
  )
}
