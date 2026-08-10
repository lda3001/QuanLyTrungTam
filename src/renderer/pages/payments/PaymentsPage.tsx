import {
  MuiDatePickerApi as DatePicker,
  MuiDropdown as Dropdown,
  MuiSelect as Select
} from '@/components/common/MuiControls'
import { useMemo, useState } from 'react'
import { Button, Flex, Space, Statistic, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  DeleteOutlined,
  DollarOutlined,
  EditOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  MoreOutlined,
  PlusOutlined,
  PrinterOutlined
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/common/PageHeader'
import { DataTable } from '@/components/common/DataTable'
import { Can, PersonCell, SearchInput } from '@/components/common'
import { PaymentFormModal } from './PaymentFormModal'
import { useTableQuery } from '@/hooks/useTableQuery'
import { useNotify } from '@/hooks/useNotify'
import { useExport } from '@/hooks/useExport'
import { paymentService } from '@/services/admin.service'
import { classService } from '@/services/academic.service'
import { buildReceiptHtml } from '@/utils/print-templates'
import { dayjs, DATE_FORMAT, formatCurrency, formatDate, ISO_DATE } from '@/utils/format'
import {
  PaymentMethod,
  PaymentMethodLabel,
  PaymentStatus,
  PaymentStatusColor,
  PaymentStatusLabel
} from '@shared/constants/enums'
import { PERMISSIONS } from '@shared/constants/permissions'
import type { PaymentDetail } from '@shared/types/entities'

// `type` thay vì `interface` — xem giải thích ở StudentsPage
type Filters = {
  status?: PaymentStatus
  method?: PaymentMethod
  classId?: number
  from?: string
  to?: string
}

/**
 * Sổ phiếu thu.
 *
 * In phiếu và xuất PDF đều dùng chung một hàm dựng HTML — bản in ra giấy và
 * bản PDF luôn giống hệt nhau, không bao giờ lệch mẫu.
 */
export default function PaymentsPage() {
  const notify = useNotify()
  const queryClient = useQueryClient()
  const { exportExcel, exportPdf, print, exporting } = useExport()

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)

  const table = useTableQuery<Filters>({
    defaultFilters: {
      from: dayjs().startOf('month').format(ISO_DATE),
      to: dayjs().endOf('month').format(ISO_DATE)
    }
  })

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['payments', table.query],
    queryFn: () => paymentService.list(table.query),
    placeholderData: (prev) => prev
  })

  const { data: classOptions = [] } = useQuery({
    queryKey: ['class-options'],
    queryFn: () => classService.options(),
    staleTime: 5 * 60_000
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => paymentService.remove(id),
    onSuccess: () => {
      notify.success('Đã xoá phiếu thu.')
      void queryClient.invalidateQueries({ queryKey: ['payments'] })
      void queryClient.invalidateQueries({ queryKey: ['debts'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (err) => notify.error(err)
  })

  const handlePrint = async (paymentId: number, asPdf: boolean): Promise<void> => {
    try {
      const receipt = await paymentService.receipt(paymentId)
      const html = buildReceiptHtml(receipt)

      if (asPdf) await exportPdf(`Phieu-thu-${receipt.payment.code}`, html)
      else await print(html)
    } catch (err) {
      notify.error(err)
    }
  }

  const pageTotal = useMemo(
    () => (data?.items ?? []).reduce((sum, p) => sum + (p.status === 'refunded' ? 0 : p.amount), 0),
    [data?.items]
  )

  const handleExport = async (): Promise<void> => {
    const all = await paymentService.list({ ...table.query, page: 1, pageSize: 200 })
    await exportExcel({
      fileName: `Phieu-thu-${table.filters.from ?? ''}_${table.filters.to ?? ''}`,
      sheetName: 'Phiếu thu',
      title: 'DANH SÁCH PHIẾU THU HỌC PHÍ',
      columns: [
        { key: 'code', title: 'Mã phiếu', width: 18 },
        { key: 'paidDateText', title: 'Ngày thu', width: 14 },
        { key: 'studentCode', title: 'Mã HV', width: 12 },
        { key: 'studentName', title: 'Học viên', width: 24 },
        { key: 'className', title: 'Lớp', width: 24 },
        { key: 'amount', title: 'Số tiền', width: 18 },
        { key: 'methodLabel', title: 'Hình thức', width: 16 },
        { key: 'statusLabel', title: 'Trạng thái', width: 16 },
        { key: 'createdByName', title: 'Người thu', width: 20 },
        { key: 'note', title: 'Ghi chú', width: 30 }
      ],
      rows: all.items.map((p) => ({
        code: p.code,
        paidDateText: formatDate(p.paidDate),
        studentCode: p.studentCode,
        studentName: p.studentName,
        className: p.className ?? '',
        amount: p.amount,
        methodLabel: PaymentMethodLabel[p.method],
        statusLabel: PaymentStatusLabel[p.status],
        createdByName: p.createdByName ?? '',
        note: p.note ?? ''
      }))
    })
  }

  const columns = useMemo<ColumnsType<PaymentDetail>>(
    () => [
      {
        title: 'Mã phiếu',
        dataIndex: 'code',
        width: 150,
        sorter: true,
        fixed: 'left',
        render: (v: string) => <Typography.Text strong>{v}</Typography.Text>
      },
      {
        title: 'Ngày thu',
        dataIndex: 'paidDate',
        width: 120,
        sorter: true,
        render: (v: string) => formatDate(v)
      },
      {
        title: 'Học viên',
        dataIndex: 'studentName',
        width: 230,
        sorter: true,
        render: (v: string, row) => <PersonCell name={v} sub={row.studentCode} />
      },
      {
        title: 'Lớp học',
        dataIndex: 'className',
        width: 220,
        render: (v: string | null, row) =>
          v ? (
            <div>
              <div>{v}</div>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {row.courseName}
              </Typography.Text>
            </div>
          ) : (
            <Typography.Text type="secondary">Không gắn lớp</Typography.Text>
          )
      },
      {
        title: 'Số tiền',
        dataIndex: 'amount',
        width: 150,
        align: 'right',
        sorter: true,
        render: (v: number, row) => (
          <Typography.Text
            strong
            style={{ color: row.status === 'refunded' ? '#722ed1' : '#52c41a', fontSize: 14 }}
          >
            {row.status === 'refunded' ? '-' : ''}
            {formatCurrency(v)}
          </Typography.Text>
        )
      },
      {
        title: 'Hình thức',
        dataIndex: 'method',
        width: 130,
        render: (v: PaymentMethod) => <Tag style={{ margin: 0 }}>{PaymentMethodLabel[v]}</Tag>
      },
      {
        title: 'Trạng thái',
        dataIndex: 'status',
        width: 130,
        render: (v: PaymentStatus) => (
          <Tag color={PaymentStatusColor[v]} style={{ margin: 0 }}>
            {PaymentStatusLabel[v]}
          </Tag>
        )
      },
      {
        title: 'Người thu',
        dataIndex: 'createdByName',
        width: 160,
        render: (v: string | null) => v ?? '—'
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
                { key: 'print', icon: <PrinterOutlined />, label: 'In phiếu thu' },
                { key: 'pdf', icon: <FilePdfOutlined />, label: 'Xuất PDF' },
                { type: 'divider' },
                { key: 'edit', icon: <EditOutlined />, label: 'Chỉnh sửa' },
                { key: 'delete', icon: <DeleteOutlined />, label: 'Xoá', danger: true }
              ],
              onClick: ({ key }) => {
                if (key === 'print') void handlePrint(row.id, false)
                else if (key === 'pdf') void handlePrint(row.id, true)
                else if (key === 'edit') {
                  setEditingId(row.id)
                  setModalOpen(true)
                } else if (key === 'delete') {
                  notify.confirmDelete({
                    content: `Xoá phiếu thu ${row.code} (${formatCurrency(row.amount)}) của ${row.studentName}? Công nợ sẽ được tính lại.`,
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
    // handlePrint dùng closure ổn định (chỉ gọi service), không cần đưa vào deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [notify, deleteMutation]
  )

  return (
    <>
      <PageHeader
        title="Phiếu thu học phí"
        subtitle={
          data
            ? `${data.total} phiếu · Tổng trang này: ${formatCurrency(pageTotal)}`
            : 'Đang tải...'
        }
        breadcrumbs={[{ title: 'Học phí' }, { title: 'Phiếu thu' }]}
        icon={<DollarOutlined style={{ fontSize: 26, color: '#52c41a' }} />}
        extra={
          <>
            <Button icon={<FileExcelOutlined />} loading={exporting} onClick={handleExport}>
              Xuất Excel
            </Button>
            <Can permission={PERMISSIONS.PAYMENT_CREATE}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  setEditingId(null)
                  setModalOpen(true)
                }}
              >
                Lập phiếu thu
              </Button>
            </Can>
          </>
        }
      />

      <DataTable<PaymentDetail>
        columns={columns}
        dataSource={data?.items ?? []}
        total={data?.total}
        page={table.page}
        pageSize={table.pageSize}
        loading={isLoading || isFetching}
        onChange={table.handleTableChange}
        toolbar={
          <Flex justify="space-between" align="center" gap={12} wrap="wrap">
            <Space wrap>
              <SearchInput
                value={table.keywordInput}
                onChange={table.setKeyword}
                placeholder="Tìm theo mã phiếu, mã/tên học viên..."
                width={300}
              />
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
              <Select
                allowClear
                placeholder="Lớp học"
                style={{ width: 200 }}
                value={table.filters.classId}
                onChange={(classId) => table.setFilters({ classId })}
                options={classOptions}
                showSearch
                filterOption={(input, option) =>
                  String(option?.label ?? '')
                    .toLowerCase()
                    .includes(input.toLowerCase())
                }
              />
              <Select
                allowClear
                placeholder="Hình thức"
                style={{ width: 150 }}
                value={table.filters.method}
                onChange={(method) => table.setFilters({ method })}
                options={Object.entries(PaymentMethodLabel).map(([value, label]) => ({
                  value,
                  label
                }))}
              />
            </Space>

            <Statistic
              title="Tổng thu (trang hiện tại)"
              value={pageTotal}
              formatter={(v) => formatCurrency(Number(v))}
              valueStyle={{ fontSize: 18, color: '#52c41a' }}
            />
          </Flex>
        }
      />

      <PaymentFormModal
        open={modalOpen}
        paymentId={editingId}
        onClose={() => setModalOpen(false)}
      />
    </>
  )
}
