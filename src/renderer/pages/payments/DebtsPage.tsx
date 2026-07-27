import { useMemo, useState } from 'react'
import { Button, Card, Col, Flex, Progress, Row, Select, Space, Statistic, Switch, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { AuditOutlined, DollarOutlined, FileExcelOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/common/PageHeader'
import { DataTable } from '@/components/common/DataTable'
import { Can, PersonCell, SearchInput } from '@/components/common'
import { PaymentFormModal } from './PaymentFormModal'
import { useTableQuery } from '@/hooks/useTableQuery'
import { useExport } from '@/hooks/useExport'
import { paymentService } from '@/services/admin.service'
import { classService, courseService } from '@/services/academic.service'
import { formatCurrency } from '@/utils/format'
import { PaymentStatusColor, PaymentStatusLabel } from '@shared/constants/enums'
import { PERMISSIONS } from '@shared/constants/permissions'
import type { DebtRow } from '@shared/types/dto'

/**
 * Bảng công nợ học phí.
 *
 * Mỗi dòng là một lần ghi danh, KHÔNG phải một học viên: học viên học ba lớp
 * thì có ba khoản nợ riêng, thu tiền lớp nào phải ghi đúng lớp đó.
 *
 * Số liệu luôn được tính lại từ phiếu thu, không lưu sẵn — nên xoá/sửa phiếu
 * thì công nợ tự khớp ngay.
 */
export default function DebtsPage() {
  const { exportExcel, exporting } = useExport()

  const [modalOpen, setModalOpen] = useState(false)
  const [preset, setPreset] = useState<{ studentId: number; enrollmentId: number } | null>(null)

  const table = useTableQuery<{ classId?: number; courseId?: number; onlyDebt?: boolean }>({
    defaultPageSize: 20,
    defaultFilters: { onlyDebt: true }
  })

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['debts', table.query],
    queryFn: () => paymentService.debts(table.query),
    placeholderData: (prev) => prev
  })

  const { data: classOptions = [] } = useQuery({
    queryKey: ['class-options'],
    queryFn: () => classService.options(),
    staleTime: 5 * 60_000
  })

  const { data: courseOptions = [] } = useQuery({
    queryKey: ['course-options'],
    queryFn: () => courseService.options(),
    staleTime: 5 * 60_000
  })

  const totals = useMemo(() => {
    const items = data?.items ?? []
    return {
      payable: items.reduce((s, r) => s + r.payable, 0),
      paid: items.reduce((s, r) => s + r.paid, 0),
      remaining: items.reduce((s, r) => s + Math.max(0, r.remaining), 0)
    }
  }, [data?.items])

  const collectRate = totals.payable > 0 ? Math.round((totals.paid / totals.payable) * 100) : 0

  const handleExport = async (): Promise<void> => {
    const all = await paymentService.debts({ ...table.query, page: 1, pageSize: 200 })
    await exportExcel({
      fileName: `Cong-no-hoc-phi-${new Date().toISOString().slice(0, 10)}`,
      sheetName: 'Công nợ',
      title: 'BÁO CÁO CÔNG NỢ HỌC PHÍ',
      columns: [
        { key: 'studentCode', title: 'Mã HV', width: 12 },
        { key: 'studentName', title: 'Học viên', width: 24 },
        { key: 'studentPhone', title: 'Điện thoại', width: 16 },
        { key: 'className', title: 'Lớp', width: 24 },
        { key: 'courseName', title: 'Khoá học', width: 24 },
        { key: 'payable', title: 'Phải đóng', width: 18 },
        { key: 'paid', title: 'Đã đóng', width: 18 },
        { key: 'remaining', title: 'Còn nợ', width: 18 },
        { key: 'statusLabel', title: 'Trạng thái', width: 16 }
      ],
      rows: all.items.map((r) => ({
        studentCode: r.studentCode,
        studentName: r.studentName,
        studentPhone: r.studentPhone ?? '',
        className: r.className,
        courseName: r.courseName,
        payable: r.payable,
        paid: r.paid,
        remaining: r.remaining,
        statusLabel: PaymentStatusLabel[r.status]
      }))
    })
  }

  const columns: ColumnsType<DebtRow> = [
    {
      title: 'Học viên',
      dataIndex: 'studentName',
      width: 240,
      fixed: 'left',
      render: (v: string, row) => <PersonCell name={v} sub={`${row.studentCode}${row.studentPhone ? ` · ${row.studentPhone}` : ''}`} />
    },
    {
      title: 'Lớp học',
      dataIndex: 'className',
      width: 240,
      render: (v: string, row) => (
        <div>
          <div>{v}</div>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {row.courseName}
          </Typography.Text>
        </div>
      )
    },
    {
      title: 'Phải đóng',
      dataIndex: 'payable',
      width: 150,
      align: 'right',
      render: (v: number) => formatCurrency(v)
    },
    {
      title: 'Đã đóng',
      dataIndex: 'paid',
      width: 150,
      align: 'right',
      render: (v: number) => <Typography.Text type="success">{formatCurrency(v)}</Typography.Text>
    },
    {
      title: 'Còn nợ',
      dataIndex: 'remaining',
      width: 150,
      align: 'right',
      render: (v: number) =>
        v > 0 ? (
          <Typography.Text type="danger" strong style={{ fontSize: 14 }}>
            {formatCurrency(v)}
          </Typography.Text>
        ) : (
          <Tag color="green" style={{ margin: 0 }}>
            Đã đủ
          </Tag>
        )
    },
    {
      title: 'Tiến độ',
      key: 'progress',
      width: 140,
      render: (_, row) => {
        const percent = row.payable > 0 ? Math.round((row.paid / row.payable) * 100) : 100
        return (
          <Progress
            percent={Math.min(100, percent)}
            size="small"
            strokeColor={percent >= 100 ? '#52c41a' : percent > 0 ? '#faad14' : '#ff4d4f'}
          />
        )
      }
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      width: 140,
      render: (v: keyof typeof PaymentStatusLabel) => (
        <Tag color={PaymentStatusColor[v]} style={{ margin: 0 }}>
          {PaymentStatusLabel[v]}
        </Tag>
      )
    },
    {
      title: '',
      key: 'actions',
      width: 120,
      fixed: 'right',
      align: 'center',
      render: (_, row) =>
        row.remaining > 0 ? (
          <Can permission={PERMISSIONS.PAYMENT_CREATE}>
            <Button
              type="primary"
              size="small"
              icon={<DollarOutlined />}
              onClick={() => {
                setPreset({ studentId: row.studentId, enrollmentId: row.enrollmentId })
                setModalOpen(true)
              }}
            >
              Thu tiền
            </Button>
          </Can>
        ) : null
    }
  ]

  return (
    <>
      <PageHeader
        title="Công nợ học phí"
        subtitle={data ? `${data.total} khoản ghi danh` : 'Đang tải...'}
        breadcrumbs={[{ title: 'Học phí' }, { title: 'Công nợ' }]}
        icon={<AuditOutlined style={{ fontSize: 26, color: '#ff4d4f' }} />}
        extra={
          <Button icon={<FileExcelOutlined />} loading={exporting} onClick={handleExport}>
            Xuất Excel
          </Button>
        }
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={8}>
          <Card>
            <Statistic
              title="Tổng phải thu (trang này)"
              value={totals.payable}
              formatter={(v) => formatCurrency(Number(v))}
            />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic
              title="Đã thu"
              value={totals.paid}
              formatter={(v) => formatCurrency(Number(v))}
              valueStyle={{ color: '#52c41a' }}
            />
            <Progress percent={collectRate} size="small" strokeColor="#52c41a" />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic
              title="Còn nợ"
              value={totals.remaining}
              formatter={(v) => formatCurrency(Number(v))}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      <DataTable<DebtRow>
        rowKey="enrollmentId"
        columns={columns}
        dataSource={data?.items ?? []}
        total={data?.total}
        page={table.page}
        pageSize={table.pageSize}
        loading={isLoading || isFetching}
        onChange={table.handleTableChange}
        toolbar={
          <Flex gap={12} wrap="wrap" align="center">
            <SearchInput
              value={table.keywordInput}
              onChange={table.setKeyword}
              placeholder="Tìm theo học viên hoặc lớp..."
              width={280}
            />
            <Select
              allowClear
              placeholder="Lớp học"
              style={{ width: 220 }}
              value={table.filters.classId}
              onChange={(classId) => table.setFilters({ classId })}
              options={classOptions}
              showSearch
              filterOption={(input, option) =>
                String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
            />
            <Select
              allowClear
              placeholder="Khoá học"
              style={{ width: 220 }}
              value={table.filters.courseId}
              onChange={(courseId) => table.setFilters({ courseId })}
              options={courseOptions}
            />
            <Space>
              <Switch
                checked={table.filters.onlyDebt}
                onChange={(onlyDebt) => table.setFilters({ onlyDebt })}
              />
              <Typography.Text>Chỉ hiện khoản còn nợ</Typography.Text>
            </Space>
          </Flex>
        }
      />

      <PaymentFormModal
        open={modalOpen}
        paymentId={null}
        presetStudentId={preset?.studentId}
        presetEnrollmentId={preset?.enrollmentId}
        onClose={() => {
          setModalOpen(false)
          setPreset(null)
        }}
      />
    </>
  )
}
