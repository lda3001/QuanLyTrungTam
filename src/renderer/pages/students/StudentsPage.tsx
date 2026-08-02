import { MuiDropdown as Dropdown, MuiSelect as Select } from '@/components/common/MuiControls'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Flex, Space, Tag, Tooltip, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  FileExcelOutlined,
  MoreOutlined,
  PlusOutlined,
  ReloadOutlined,
  TeamOutlined,
  UploadOutlined
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/common/PageHeader'
import { DataTable } from '@/components/common/DataTable'
import { Blank, Can, Ellipsis, PersonCell, SearchInput, StatusTag } from '@/components/common'
import { StudentFormDrawer } from './StudentFormDrawer'
import { StudentImportModal } from './StudentImportModal'
import { useTableQuery } from '@/hooks/useTableQuery'
import { useNotify } from '@/hooks/useNotify'
import { useExport } from '@/hooks/useExport'
import { studentService } from '@/services/academic.service'
import { formatDate } from '@/utils/format'
import {
  Gender,
  GenderLabel,
  StudentStatus,
  StudentStatusColor,
  StudentStatusLabel
} from '@shared/constants/enums'
import { PERMISSIONS } from '@shared/constants/permissions'
import type { Student } from '@shared/types/entities'

// Dùng `type` chứ không phải `interface`: chỉ type alias mới thoả ràng buộc
// `Record<string, unknown>` của useTableQuery (interface không có index
// signature ngầm định).
type Filters = {
  status?: StudentStatus
  gender?: Gender
  /** Lớp ở trường phổ thông */
  schoolClass?: string
}

/**
 * Danh sách học viên — màn hình dùng nhiều nhất của phần mềm.
 *
 * Phân trang, tìm kiếm và lọc đều chạy phía server: với 20.000 học viên,
 * tải hết về rồi lọc bằng JavaScript sẽ làm treo giao diện vài giây.
 */
export default function StudentsPage() {
  const navigate = useNavigate()
  const notify = useNotify()
  const queryClient = useQueryClient()
  const { exportExcel, exporting } = useExport()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<number[]>([])

  const table = useTableQuery<Filters>({ defaultPageSize: 20 })

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['students', table.query],
    queryFn: () => studentService.list(table.query),
    placeholderData: (prev) => prev // giữ dữ liệu cũ khi đổi trang -> không nháy trắng
  })

  // Danh sách lớp ở trường lấy từ chính dữ liệu hiện có, dùng cho ô lọc
  const { data: schoolClasses = [] } = useQuery({
    queryKey: ['student-school-classes'],
    queryFn: () => studentService.schoolClasses(),
    staleTime: 5 * 60_000
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => studentService.remove(id),
    onSuccess: () => {
      notify.success('Đã xoá học viên.')
      void queryClient.invalidateQueries({ queryKey: ['students'] })
    },
    onError: (err) => notify.error(err)
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: number[]) => studentService.bulkRemove(ids),
    onSuccess: (count) => {
      notify.success(`Đã xoá ${count} học viên.`)
      setSelectedIds([])
      void queryClient.invalidateQueries({ queryKey: ['students'] })
    },
    onError: (err) => notify.error(err)
  })

  const handleExport = async (): Promise<void> => {
    // Xuất theo bộ lọc hiện tại nhưng lấy trọn kết quả, không giới hạn theo trang
    const all = await studentService.list({ ...table.query, page: 1, pageSize: 200 })

    await exportExcel({
      fileName: `Danh-sach-hoc-vien-${new Date().toISOString().slice(0, 10)}`,
      sheetName: 'Học viên',
      title: 'DANH SÁCH HỌC VIÊN',
      columns: [
        { key: 'code', title: 'Mã HV', width: 14 },
        { key: 'fullName', title: 'Họ và tên', width: 26 },
        { key: 'genderLabel', title: 'Giới tính', width: 12 },
        { key: 'birthDateText', title: 'Ngày sinh', width: 14 },
        { key: 'schoolClass', title: 'Lớp (ở trường)', width: 16 },
        { key: 'phone', title: 'Điện thoại', width: 16 },
        { key: 'email', title: 'Email', width: 26 },
        { key: 'address', title: 'Địa chỉ', width: 32 },
        { key: 'guardianName', title: 'Người giám hộ', width: 22 },
        { key: 'guardianPhone', title: 'SĐT giám hộ', width: 16 },
        { key: 'statusLabel', title: 'Trạng thái', width: 16 }
      ],
      rows: all.items.map((s) => ({
        code: s.code,
        fullName: s.fullName,
        genderLabel: GenderLabel[s.gender],
        birthDateText: formatDate(s.birthDate),
        schoolClass: s.schoolClass ?? '',
        phone: s.phone ?? '',
        email: s.email ?? '',
        address: s.address ?? '',
        guardianName: s.guardianName ?? '',
        guardianPhone: s.guardianPhone ?? '',
        statusLabel: StudentStatusLabel[s.status]
      }))
    })
  }

  const columns = useMemo<ColumnsType<Student>>(
    () => [
      {
        title: 'Mã HV',
        dataIndex: 'code',
        width: 110,
        sorter: true,
        fixed: 'left',
        render: (value: string) => <Typography.Text strong>{value}</Typography.Text>
      },
      {
        title: 'Học viên',
        dataIndex: 'fullName',
        width: 240,
        sorter: true,
        render: (value: string, row) => (
          <PersonCell name={value} sub={GenderLabel[row.gender]} avatar={row.avatar} />
        )
      },
      {
        title: 'Ngày sinh',
        dataIndex: 'birthDate',
        width: 120,
        sorter: true,
        render: (value: string | null) => formatDate(value)
      },
      {
        // Lớp tại TRƯỜNG phổ thông — khác với lớp học ở trung tâm
        title: 'Lớp (ở trường)',
        dataIndex: 'schoolClass',
        width: 130,
        sorter: true,
        render: (value: string | null) =>
          value ? <Tag color="geekblue" style={{ margin: 0 }}>{value}</Tag> : <Blank />
      },
      {
        title: 'Liên hệ',
        dataIndex: 'phone',
        width: 200,
        render: (value: string | null, row) => (
          <div>
            <div>{value ?? <Blank />}</div>
            {row.email && (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {row.email}
              </Typography.Text>
            )}
          </div>
        )
      },
      {
        title: 'Người giám hộ',
        dataIndex: 'guardianName',
        width: 200,
        render: (value: string | null, row) =>
          value ? (
            <div>
              <div>{value}</div>
              {row.guardianPhone && (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {row.guardianPhone}
                </Typography.Text>
              )}
            </div>
          ) : (
            <Blank />
          )
      },
      {
        title: 'Địa chỉ',
        dataIndex: 'address',
        width: 220,
        render: (value: string | null) => <Ellipsis text={value} />
      },
      {
        title: 'Trạng thái',
        dataIndex: 'status',
        width: 130,
        sorter: true,
        render: (value: StudentStatus) => (
          <StatusTag value={value} labels={StudentStatusLabel} colors={StudentStatusColor} />
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
                { key: 'view', icon: <EyeOutlined />, label: 'Xem hồ sơ' },
                { key: 'edit', icon: <EditOutlined />, label: 'Chỉnh sửa' },
                { type: 'divider' },
                { key: 'delete', icon: <DeleteOutlined />, label: 'Xoá', danger: true }
              ],
              onClick: ({ key, domEvent }) => {
                domEvent.stopPropagation()
                if (key === 'view') navigate(`/students/${row.id}`)
                else if (key === 'edit') {
                  setEditingId(row.id)
                  setDrawerOpen(true)
                } else if (key === 'delete') {
                  notify.confirmDelete({
                    content: `Xoá học viên "${row.fullName}" (${row.code})? Dữ liệu sẽ được ẩn khỏi hệ thống nhưng vẫn lưu để đối soát.`,
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
        title="Quản lý học viên"
        subtitle={data ? `Tổng cộng ${data.total} học viên` : 'Đang tải...'}
        breadcrumbs={[{ title: 'Đào tạo' }, { title: 'Học viên' }]}
        icon={<TeamOutlined style={{ fontSize: 26, color: '#1677ff' }} />}
        extra={
          <>
            <Can permission={PERMISSIONS.STUDENT_EXPORT}>
              <Button icon={<FileExcelOutlined />} loading={exporting} onClick={handleExport}>
                Xuất Excel
              </Button>
            </Can>
            <Can permission={PERMISSIONS.STUDENT_IMPORT}>
              <Button icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>
                Nhập Excel
              </Button>
            </Can>
            <Can permission={PERMISSIONS.STUDENT_CREATE}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  setEditingId(null)
                  setDrawerOpen(true)
                }}
              >
                Thêm học viên
              </Button>
            </Can>
          </>
        }
      />

      <DataTable<Student>
        columns={columns}
        dataSource={data?.items ?? []}
        total={data?.total}
        page={table.page}
        pageSize={table.pageSize}
        loading={isLoading || isFetching}
        onChange={table.handleTableChange}
        onRow={(row) => ({
          onDoubleClick: () => navigate(`/students/${row.id}`),
          style: { cursor: 'pointer' }
        })}
        rowSelection={{
          selectedRowKeys: selectedIds,
          onChange: (keys) => setSelectedIds(keys as number[]),
          preserveSelectedRowKeys: false
        }}
        toolbar={
          <Flex justify="space-between" align="center" gap={12} wrap="wrap">
            <Space wrap>
              <SearchInput
                value={table.keywordInput}
                onChange={table.setKeyword}
                placeholder="Tìm theo mã, tên, SĐT, email..."
                width={300}
              />
              <Select
                allowClear
                placeholder="Trạng thái"
                style={{ width: 160 }}
                value={table.filters.status}
                onChange={(status) => table.setFilters({ status })}
                options={Object.entries(StudentStatusLabel).map(([value, label]) => ({ value, label }))}
              />
              <Select
                allowClear
                placeholder="Giới tính"
                style={{ width: 130 }}
                value={table.filters.gender}
                onChange={(gender) => table.setFilters({ gender })}
                options={Object.entries(GenderLabel).map(([value, label]) => ({ value, label }))}
              />
              <Select
                allowClear
                showSearch
                placeholder="Lớp (ở trường)"
                style={{ width: 160 }}
                value={table.filters.schoolClass}
                onChange={(schoolClass) => table.setFilters({ schoolClass })}
                options={schoolClasses.map((value) => ({ value, label: value }))}
                notFoundContent="Chưa có lớp nào"
              />
              <Tooltip title="Tải lại">
                <Button icon={<ReloadOutlined />} onClick={() => void refetch()} />
              </Tooltip>
            </Space>

            {selectedIds.length > 0 && (
              <Can permission={PERMISSIONS.STUDENT_DELETE}>
                <Space>
                  <Typography.Text type="secondary">Đã chọn {selectedIds.length}</Typography.Text>
                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    loading={bulkDeleteMutation.isPending}
                    onClick={() =>
                      notify.confirmDelete({
                        content: `Xoá ${selectedIds.length} học viên đã chọn?`,
                        onOk: () => bulkDeleteMutation.mutateAsync(selectedIds)
                      })
                    }
                  >
                    Xoá đã chọn
                  </Button>
                </Space>
              </Can>
            )}
          </Flex>
        }
      />

      <StudentFormDrawer open={drawerOpen} studentId={editingId} onClose={() => setDrawerOpen(false)} />
      <StudentImportModal open={importOpen} onClose={() => setImportOpen(false)} />
    </>
  )
}
