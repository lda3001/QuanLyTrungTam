import { MuiDatePickerApi as DatePicker } from '@/components/common/MuiControls'
import { useMemo, useState } from 'react'
import { Button, Card, Col, Empty, Flex, Progress, Row, Segmented, Space, Statistic, Table, Tabs, Tag, Typography, theme } from 'antd'
import { BarChartOutlined, FileExcelOutlined, FilePdfOutlined, PrinterOutlined } from '@ant-design/icons'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis
} from 'recharts'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/common/PageHeader'
import { useExport } from '@/hooks/useExport'
import { reportService, settingService } from '@/services/admin.service'
import { buildReportHtml, type ReportPrintColumn } from '@/utils/print-templates'
import { dayjs, DATE_FORMAT, formatCurrency, formatNumber, formatPercent, ISO_DATE } from '@/utils/format'
import { PaymentMethodLabel } from '@shared/constants/enums'
import type {
  AttendanceReportRow,
  StudentReportRow,
  TeacherReportRow,
  TuitionReportRow
} from '@shared/types/dto'

type ReportKey = 'revenue' | 'tuition' | 'attendance' | 'students' | 'teachers'

/**
 * Trung tâm báo cáo.
 *
 * Mỗi tab tự tải dữ liệu khi được chọn (`enabled: tab === ...`) — mở trang
 * không kéo theo 5 truy vấn tổng hợp nặng cùng lúc.
 *
 * Xuất Excel giữ nguyên số liệu thô để kế toán tính tiếp; xuất PDF là bản
 * trình bày có chữ ký, dùng để lưu hồ sơ.
 */
export default function ReportsPage() {
  const { token } = theme.useToken()
  const { exportExcel, exportPdf, print, exporting } = useExport()

  const [tab, setTab] = useState<ReportKey>('revenue')
  const [groupBy, setGroupBy] = useState<'day' | 'month'>('month')
  const [range, setRange] = useState({
    from: dayjs().subtract(5, 'month').startOf('month').format(ISO_DATE),
    to: dayjs().endOf('month').format(ISO_DATE)
  })

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingService.getAll(),
    staleTime: 10 * 60_000
  })

  const centerName = settings?.find((s) => s.key === 'centerName')?.value ?? 'Trung Tâm'
  const rangeLabel = `Từ ${dayjs(range.from).format(DATE_FORMAT)} đến ${dayjs(range.to).format(DATE_FORMAT)}`

  const revenueQuery = useQuery({
    queryKey: ['report-revenue', range, groupBy],
    queryFn: () => reportService.revenue({ ...range, groupBy }),
    enabled: tab === 'revenue'
  })

  const tuitionQuery = useQuery({
    queryKey: ['report-tuition', range],
    queryFn: () => reportService.tuition(range),
    enabled: tab === 'tuition'
  })

  const attendanceQuery = useQuery({
    queryKey: ['report-attendance', range],
    queryFn: () => reportService.attendance(range),
    enabled: tab === 'attendance'
  })

  const studentsQuery = useQuery({
    queryKey: ['report-students', range],
    queryFn: () => reportService.students(range),
    enabled: tab === 'students'
  })

  const teachersQuery = useQuery({
    queryKey: ['report-teachers', range],
    queryFn: () => reportService.teachers(range),
    enabled: tab === 'teachers'
  })

  /** Cấu hình từng báo cáo: tiêu đề, cột và dữ liệu — gom một chỗ để nút xuất dùng chung */
  const config = useMemo(() => {
    const map: Record<
      ReportKey,
      {
        title: string
        rows: Record<string, unknown>[]
        columns: { key: string; title: string; width?: number; align?: 'right' | 'center' }[]
        summary?: { label: string; value: string }[]
      }
    > = {
      revenue: {
        title: 'BÁO CÁO DOANH THU',
        rows: (revenueQuery.data?.rows ?? []) as unknown as Record<string, unknown>[],
        columns: [
          { key: 'period', title: groupBy === 'day' ? 'Ngày' : 'Tháng', width: 18 },
          { key: 'transactions', title: 'Số phiếu', width: 14, align: 'center' },
          { key: 'revenue', title: 'Doanh thu', width: 22, align: 'right' }
        ],
        summary: [
          { label: 'Tổng doanh thu', value: formatCurrency(revenueQuery.data?.totalRevenue ?? 0) },
          { label: 'Tổng số phiếu', value: formatNumber(revenueQuery.data?.totalTransactions ?? 0) }
        ]
      },
      tuition: {
        title: 'BÁO CÁO THU HỌC PHÍ THEO LỚP',
        rows: (tuitionQuery.data ?? []) as unknown as Record<string, unknown>[],
        columns: [
          { key: 'className', title: 'Lớp học', width: 26 },
          { key: 'courseName', title: 'Khoá học', width: 26 },
          { key: 'students', title: 'Học viên', width: 12, align: 'center' },
          { key: 'payable', title: 'Phải thu', width: 20, align: 'right' },
          { key: 'paid', title: 'Đã thu', width: 20, align: 'right' },
          { key: 'remaining', title: 'Còn nợ', width: 20, align: 'right' },
          { key: 'rate', title: 'Tỷ lệ (%)', width: 14, align: 'right' }
        ]
      },
      attendance: {
        title: 'BÁO CÁO CHUYÊN CẦN',
        rows: (attendanceQuery.data ?? []) as unknown as Record<string, unknown>[],
        columns: [
          { key: 'className', title: 'Lớp học', width: 30 },
          { key: 'sessions', title: 'Số buổi', width: 12, align: 'center' },
          { key: 'present', title: 'Có mặt', width: 12, align: 'center' },
          { key: 'late', title: 'Đi muộn', width: 12, align: 'center' },
          { key: 'excused', title: 'Có phép', width: 12, align: 'center' },
          { key: 'absent', title: 'Không phép', width: 14, align: 'center' },
          { key: 'rate', title: 'Chuyên cần (%)', width: 16, align: 'right' }
        ]
      },
      students: {
        title: 'BÁO CÁO TĂNG TRƯỞNG HỌC VIÊN',
        rows: (studentsQuery.data ?? []) as unknown as Record<string, unknown>[],
        columns: [
          { key: 'period', title: 'Tháng', width: 16 },
          { key: 'newStudents', title: 'Ghi danh mới', width: 16, align: 'center' },
          { key: 'dropped', title: 'Rút khỏi lớp', width: 16, align: 'center' },
          { key: 'totalActive', title: 'Luỹ kế', width: 14, align: 'center' }
        ]
      },
      teachers: {
        title: 'BÁO CÁO GIẢNG DẠY',
        rows: (teachersQuery.data ?? []) as unknown as Record<string, unknown>[],
        columns: [
          { key: 'teacherName', title: 'Giáo viên', width: 26 },
          { key: 'classes', title: 'Số lớp', width: 12, align: 'center' },
          { key: 'sessions', title: 'Buổi đã dạy', width: 16, align: 'center' },
          { key: 'students', title: 'Học viên', width: 14, align: 'center' },
          { key: 'salary', title: 'Mức lương', width: 20, align: 'right' }
        ]
      }
    }
    return map[tab]
  }, [tab, groupBy, revenueQuery.data, tuitionQuery.data, attendanceQuery.data, studentsQuery.data, teachersQuery.data])

  const handleExportExcel = (): void => {
    void exportExcel({
      fileName: `${config.title.replace(/\s+/g, '-')}-${range.from}_${range.to}`,
      sheetName: 'Báo cáo',
      title: `${config.title} (${rangeLabel})`,
      columns: config.columns,
      rows: config.rows
    })
  }

  const buildHtml = (): string => {
    const printColumns: ReportPrintColumn[] = config.columns.map((c) => ({
      key: c.key,
      title: c.title,
      align: c.align,
      render: (value) =>
        // Cột tiền định dạng lại; các cột khác giữ nguyên
        ['revenue', 'payable', 'paid', 'remaining', 'salary'].includes(c.key)
          ? formatCurrency(Number(value ?? 0))
          : String(value ?? '')
    }))

    return buildReportHtml({
      title: config.title,
      subtitle: rangeLabel,
      centerName,
      columns: printColumns,
      rows: config.rows,
      summary: config.summary
    })
  }

  const chartTooltipStyle = {
    background: token.colorBgElevated,
    border: `1px solid ${token.colorBorder}`,
    borderRadius: 8,
    color: token.colorText
  }

  return (
    <>
      <PageHeader
        title="Báo cáo & thống kê"
        subtitle={rangeLabel}
        breadcrumbs={[{ title: 'Báo cáo' }]}
        icon={<BarChartOutlined style={{ fontSize: 26, color: '#722ed1' }} />}
        extra={
          <>
            <Button icon={<PrinterOutlined />} onClick={() => void print(buildHtml())}>
              In
            </Button>
            <Button
              icon={<FilePdfOutlined />}
              loading={exporting}
              onClick={() => void exportPdf(config.title.replace(/\s+/g, '-'), buildHtml(), true)}
            >
              Xuất PDF
            </Button>
            <Button type="primary" icon={<FileExcelOutlined />} loading={exporting} onClick={handleExportExcel}>
              Xuất Excel
            </Button>
          </>
        }
      />

      <Card style={{ marginBottom: 16 }}>
        <Flex gap={16} wrap="wrap" align="center">
          <Space>
            <Typography.Text type="secondary">Khoảng thời gian:</Typography.Text>
            <DatePicker.RangePicker
              format={DATE_FORMAT}
              allowClear={false}
              value={[dayjs(range.from, ISO_DATE), dayjs(range.to, ISO_DATE)]}
              onChange={(dates) => {
                if (dates?.[0] && dates?.[1]) {
                  setRange({ from: dates[0].format(ISO_DATE), to: dates[1].format(ISO_DATE) })
                }
              }}
              presets={[
                { label: 'Tháng này', value: [dayjs().startOf('month'), dayjs().endOf('month')] },
                {
                  label: 'Tháng trước',
                  value: [
                    dayjs().subtract(1, 'month').startOf('month'),
                    dayjs().subtract(1, 'month').endOf('month')
                  ]
                },
                { label: '6 tháng gần nhất', value: [dayjs().subtract(5, 'month').startOf('month'), dayjs()] },
                { label: 'Năm nay', value: [dayjs().startOf('year'), dayjs().endOf('year')] }
              ]}
            />
          </Space>

          {tab === 'revenue' && (
            <Segmented
              value={groupBy}
              onChange={(v) => setGroupBy(v as 'day' | 'month')}
              options={[
                { label: 'Theo tháng', value: 'month' },
                { label: 'Theo ngày', value: 'day' }
              ]}
            />
          )}
        </Flex>
      </Card>

      <Tabs
        activeKey={tab}
        onChange={(key) => setTab(key as ReportKey)}
        items={[
          {
            key: 'revenue',
            label: 'Doanh thu',
            children: (
              <>
                <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                  <Col xs={24} md={8}>
                    <Card>
                      <Statistic
                        title="Tổng doanh thu"
                        value={revenueQuery.data?.totalRevenue ?? 0}
                        formatter={(v) => formatCurrency(Number(v))}
                        valueStyle={{ color: '#52c41a' }}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} md={8}>
                    <Card>
                      <Statistic title="Số phiếu thu" value={revenueQuery.data?.totalTransactions ?? 0} />
                    </Card>
                  </Col>
                  <Col xs={24} md={8}>
                    <Card>
                      <Typography.Text type="secondary">Theo hình thức</Typography.Text>
                      <div style={{ marginTop: 8 }}>
                        {(revenueQuery.data?.byMethod ?? []).map((m) => (
                          <div key={m.method} style={{ marginBottom: 4 }}>
                            <Tag>{PaymentMethodLabel[m.method]}</Tag>
                            <Typography.Text strong>{formatCurrency(m.amount)}</Typography.Text>
                          </div>
                        ))}
                        {(revenueQuery.data?.byMethod ?? []).length === 0 && (
                          <Typography.Text type="secondary">Không có dữ liệu</Typography.Text>
                        )}
                      </div>
                    </Card>
                  </Col>
                </Row>

                <Card title="Biểu đồ doanh thu" style={{ marginBottom: 16 }}>
                  {(revenueQuery.data?.rows ?? []).length === 0 ? (
                    <Empty description="Không có dữ liệu trong khoảng thời gian này" />
                  ) : (
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart data={revenueQuery.data?.rows ?? []}>
                        <CartesianGrid strokeDasharray="3 3" stroke={token.colorSplit} vertical={false} />
                        <XAxis dataKey="period" tick={{ fontSize: 11, fill: token.colorTextSecondary }} />
                        <YAxis
                          tick={{ fontSize: 11, fill: token.colorTextSecondary }}
                          tickFormatter={(v: number) => `${(v / 1_000_000).toFixed(0)}Tr`}
                          width={60}
                        />
                        <ReTooltip
                          formatter={(v: number) => [formatCurrency(v), 'Doanh thu']}
                          contentStyle={chartTooltipStyle}
                        />
                        <Bar dataKey="revenue" fill={token.colorPrimary} radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </Card>

                <Card styles={{ body: { padding: 0 } }}>
                  <Table
                    className="app-table"
                    rowKey="period"
                    loading={revenueQuery.isLoading}
                    dataSource={revenueQuery.data?.rows ?? []}
                    pagination={{ pageSize: 15 }}
                    columns={[
                      { title: groupBy === 'day' ? 'Ngày' : 'Tháng', dataIndex: 'period' },
                      { title: 'Số phiếu', dataIndex: 'transactions', align: 'center', width: 140 },
                      {
                        title: 'Doanh thu',
                        dataIndex: 'revenue',
                        align: 'right',
                        width: 200,
                        render: (v: number) => (
                          <Typography.Text strong style={{ color: '#52c41a' }}>
                            {formatCurrency(v)}
                          </Typography.Text>
                        )
                      }
                    ]}
                  />
                </Card>
              </>
            )
          },

          {
            key: 'tuition',
            label: 'Thu học phí',
            children: (
              <Card styles={{ body: { padding: 0 } }}>
                <Table<TuitionReportRow>
                  className="app-table"
                  rowKey="classId"
                  loading={tuitionQuery.isLoading}
                  dataSource={tuitionQuery.data ?? []}
                  pagination={{ pageSize: 15 }}
                  scroll={{ x: 'max-content' }}
                  columns={[
                    { title: 'Lớp học', dataIndex: 'className', width: 220 },
                    { title: 'Khoá học', dataIndex: 'courseName', width: 220 },
                    { title: 'Học viên', dataIndex: 'students', align: 'center', width: 100 },
                    {
                      title: 'Phải thu',
                      dataIndex: 'payable',
                      align: 'right',
                      width: 160,
                      render: (v: number) => formatCurrency(v)
                    },
                    {
                      title: 'Đã thu',
                      dataIndex: 'paid',
                      align: 'right',
                      width: 160,
                      render: (v: number) => <Typography.Text type="success">{formatCurrency(v)}</Typography.Text>
                    },
                    {
                      title: 'Còn nợ',
                      dataIndex: 'remaining',
                      align: 'right',
                      width: 160,
                      render: (v: number) => (
                        <Typography.Text type={v > 0 ? 'danger' : undefined}>{formatCurrency(v)}</Typography.Text>
                      )
                    },
                    {
                      title: 'Tỷ lệ thu',
                      dataIndex: 'rate',
                      width: 160,
                      render: (v: number) => (
                        <Progress
                          percent={Math.min(100, v)}
                          size="small"
                          strokeColor={v >= 90 ? '#52c41a' : v >= 60 ? '#faad14' : '#ff4d4f'}
                        />
                      )
                    }
                  ]}
                />
              </Card>
            )
          },

          {
            key: 'attendance',
            label: 'Chuyên cần',
            children: (
              <Card styles={{ body: { padding: 0 } }}>
                <Table<AttendanceReportRow>
                  className="app-table"
                  rowKey="classId"
                  loading={attendanceQuery.isLoading}
                  dataSource={attendanceQuery.data ?? []}
                  pagination={{ pageSize: 15 }}
                  scroll={{ x: 'max-content' }}
                  columns={[
                    { title: 'Lớp học', dataIndex: 'className', width: 260 },
                    { title: 'Số buổi', dataIndex: 'sessions', align: 'center', width: 100 },
                    {
                      title: 'Có mặt',
                      dataIndex: 'present',
                      align: 'center',
                      width: 100,
                      render: (v: number) => <Tag color="green">{v}</Tag>
                    },
                    {
                      title: 'Đi muộn',
                      dataIndex: 'late',
                      align: 'center',
                      width: 100,
                      render: (v: number) => <Tag color="orange">{v}</Tag>
                    },
                    {
                      title: 'Có phép',
                      dataIndex: 'excused',
                      align: 'center',
                      width: 100,
                      render: (v: number) => <Tag color="gold">{v}</Tag>
                    },
                    {
                      title: 'Không phép',
                      dataIndex: 'absent',
                      align: 'center',
                      width: 110,
                      render: (v: number) => <Tag color="red">{v}</Tag>
                    },
                    {
                      title: 'Tỷ lệ chuyên cần',
                      dataIndex: 'rate',
                      width: 180,
                      render: (v: number) => (
                        <Progress
                          percent={v}
                          size="small"
                          format={() => formatPercent(v)}
                          strokeColor={v >= 85 ? '#52c41a' : v >= 70 ? '#faad14' : '#ff4d4f'}
                        />
                      )
                    }
                  ]}
                />
              </Card>
            )
          },

          {
            key: 'students',
            label: 'Học viên',
            children: (
              <>
                <Card title="Xu hướng ghi danh" style={{ marginBottom: 16 }}>
                  {(studentsQuery.data ?? []).length === 0 ? (
                    <Empty description="Không có dữ liệu" />
                  ) : (
                    <ResponsiveContainer width="100%" height={320}>
                      <LineChart data={studentsQuery.data ?? []}>
                        <CartesianGrid strokeDasharray="3 3" stroke={token.colorSplit} vertical={false} />
                        <XAxis dataKey="period" tick={{ fontSize: 11, fill: token.colorTextSecondary }} />
                        <YAxis tick={{ fontSize: 11, fill: token.colorTextSecondary }} allowDecimals={false} />
                        <ReTooltip contentStyle={chartTooltipStyle} />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="newStudents"
                          name="Ghi danh mới"
                          stroke={token.colorPrimary}
                          strokeWidth={2.5}
                        />
                        <Line
                          type="monotone"
                          dataKey="dropped"
                          name="Rút khỏi lớp"
                          stroke="#ff4d4f"
                          strokeWidth={2}
                        />
                        <Line
                          type="monotone"
                          dataKey="totalActive"
                          name="Luỹ kế"
                          stroke="#52c41a"
                          strokeWidth={2}
                          strokeDasharray="5 5"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </Card>

                <Card styles={{ body: { padding: 0 } }}>
                  <Table<StudentReportRow>
                    className="app-table"
                    rowKey="period"
                    loading={studentsQuery.isLoading}
                    dataSource={studentsQuery.data ?? []}
                    pagination={{ pageSize: 15 }}
                    columns={[
                      { title: 'Tháng', dataIndex: 'period' },
                      { title: 'Ghi danh mới', dataIndex: 'newStudents', align: 'center', width: 160 },
                      { title: 'Rút khỏi lớp', dataIndex: 'dropped', align: 'center', width: 160 },
                      { title: 'Luỹ kế', dataIndex: 'totalActive', align: 'center', width: 140 }
                    ]}
                  />
                </Card>
              </>
            )
          },

          {
            key: 'teachers',
            label: 'Giáo viên',
            children: (
              <Card styles={{ body: { padding: 0 } }}>
                <Table<TeacherReportRow>
                  className="app-table"
                  rowKey="teacherId"
                  loading={teachersQuery.isLoading}
                  dataSource={teachersQuery.data ?? []}
                  pagination={{ pageSize: 15 }}
                  scroll={{ x: 'max-content' }}
                  columns={[
                    { title: 'Giáo viên', dataIndex: 'teacherName', width: 240 },
                    { title: 'Số lớp phụ trách', dataIndex: 'classes', align: 'center', width: 160 },
                    { title: 'Buổi đã dạy', dataIndex: 'sessions', align: 'center', width: 150 },
                    { title: 'Tổng học viên', dataIndex: 'students', align: 'center', width: 150 },
                    {
                      title: 'Mức lương',
                      dataIndex: 'salary',
                      align: 'right',
                      width: 180,
                      render: (v: number) => formatCurrency(v)
                    }
                  ]}
                />
              </Card>
            )
          }
        ]}
      />
    </>
  )
}
