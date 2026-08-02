import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Card, Col, Empty, Flex, List, Row, Skeleton, Space, Table, Tag, Typography, theme } from 'antd'
import {
  BankOutlined,
  CalendarOutlined,
  DollarCircleOutlined,
  ExclamationCircleOutlined,
  SolutionOutlined,
  TeamOutlined
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis
} from 'recharts'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { dashboardService } from '@/services/admin.service'
import {
  dayjs,
  formatCompactCurrency,
  formatCurrency,
  formatMonthLabel,
  formatNumber,
  growthPercent
} from '@/utils/format'
import { PaymentMethodLabel, SessionStatusLabel } from '@shared/constants/enums'
import type { TodaySessionRow } from '@shared/types/dto'

const PIE_COLORS = ['#52c41a', '#faad14', '#ff4d4f']

/**
 * Trang tổng quan.
 *
 * Toàn bộ số liệu lấy trong MỘT lệnh IPC (`dashboard.data`). Nếu tách thành
 * 6 truy vấn riêng, trang sẽ hiện ra từng mảnh lệch nhịp và tạo cảm giác chậm,
 * dù tổng thời gian không đổi.
 */
export default function DashboardPage() {
  const navigate = useNavigate()
  const { token } = theme.useToken()

  const { data, error, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => dashboardService.data(),
    // Giữ cache ngắn để chuyển trang mượt, nhưng luôn làm mới khi quay lại Dashboard.
    staleTime: 60_000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true 
  })

  const summary = data?.summary

  const revenueTrend = useMemo(
    () => (summary ? growthPercent(summary.monthRevenue, summary.prevMonthRevenue) : 0),
    [summary]
  )

  const revenueData = useMemo(
    () => (data?.revenueByMonth ?? []).map((r) => ({ ...r, label: formatMonthLabel(r.month) })),
    [data?.revenueByMonth]
  )

  const sessionColumns = [
    {
      title: 'Giờ học',
      dataIndex: 'startTime',
      width: 120,
      render: (_: string, row: TodaySessionRow) => (
        <Tag color="blue" style={{ margin: 0 }}>
          {row.startTime} – {row.endTime}
        </Tag>
      )
    },
    {
      title: 'Lớp',
      dataIndex: 'className',
      render: (value: string, row: TodaySessionRow) => (
        <div>
          <div style={{ fontWeight: 500 }}>{value}</div>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {row.courseName}
          </Typography.Text>
        </div>
      )
    },
    { title: 'Giáo viên', dataIndex: 'teacherName', width: 160, render: (v: string | null) => v ?? '—' },
    { title: 'Phòng', dataIndex: 'room', width: 90, render: (v: string | null) => v ?? '—' },
    {
      title: 'Sĩ số',
      dataIndex: 'studentCount',
      width: 80,
      align: 'center' as const
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      width: 130,
      render: (value: keyof typeof SessionStatusLabel) => (
        <Tag color={value === 'done' ? 'green' : value === 'cancelled' ? 'red' : 'blue'} style={{ margin: 0 }}>
          {SessionStatusLabel[value]}
        </Tag>
      )
    }
  ]

  return (
    <>
      <PageHeader
        title="Tổng quan"
        subtitle={`Hôm nay, ${dayjs().format('dddd, DD/MM/YYYY')}`}
        breadcrumbs={[{ title: 'Tổng quan' }]}
      />

      {/* ---------------- Thẻ số liệu ---------------- */}
      {error && (
        <Alert
          type="error"
          showIcon
          message="Không tải được số liệu tổng quan"
          description={error.message}
          style={{ marginBottom: 16 }}
        />
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={8} xxl={4}>
          <StatCard
            title="Tổng học viên"
            value={formatNumber(summary?.totalStudents)}
            suffix={summary ? `/ ${formatNumber(summary.activeStudents)} đang học` : undefined}
            icon={<TeamOutlined />}
            color="#1677ff"
            loading={isLoading}
            onClick={() => navigate('/students')}
          />
        </Col>
        <Col xs={24} sm={12} lg={8} xxl={4}>
          <StatCard
            title="Giáo viên"
            value={formatNumber(summary?.totalTeachers)}
            icon={<SolutionOutlined />}
            color="#722ed1"
            loading={isLoading}
            onClick={() => navigate('/teachers')}
          />
        </Col>
        <Col xs={24} sm={12} lg={8} xxl={4}>
          <StatCard
            title="Lớp học"
            value={formatNumber(summary?.totalClasses)}
            suffix={summary ? `/ ${formatNumber(summary.ongoingClasses)} đang mở` : undefined}
            icon={<BankOutlined />}
            color="#13c2c2"
            loading={isLoading}
            onClick={() => navigate('/classes')}
          />
        </Col>
        <Col xs={24} sm={12} lg={8} xxl={4}>
          <StatCard
            title="Doanh thu tháng"
            value={formatCompactCurrency(summary?.monthRevenue)}
            icon={<DollarCircleOutlined />}
            color="#52c41a"
            trend={revenueTrend}
            trendLabel="so với tháng trước"
            loading={isLoading}
            onClick={() => navigate('/payments')}
          />
        </Col>
        <Col xs={24} sm={12} lg={8} xxl={4}>
          <StatCard
            title="Học phí chưa thu"
            value={formatCompactCurrency(summary?.unpaidAmount)}
            suffix={summary ? `/ ${summary.unpaidCount} khoản` : undefined}
            icon={<ExclamationCircleOutlined />}
            color="#ff4d4f"
            loading={isLoading}
            onClick={() => navigate('/debts')}
          />
        </Col>
        <Col xs={24} sm={12} lg={8} xxl={4}>
          <StatCard
            title="Buổi học hôm nay"
            value={formatNumber(summary?.todaySessions)}
            icon={<CalendarOutlined />}
            color="#fa8c16"
            loading={isLoading}
            onClick={() => navigate('/schedule')}
          />
        </Col>
      </Row>

      {/* ---------------- Biểu đồ ---------------- */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} xl={16}>
          <Card title="Doanh thu 12 tháng gần nhất" styles={{ body: { paddingTop: 8 } }}>
            {isLoading ? (
              <Skeleton active paragraph={{ rows: 6 }} />
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={revenueData} margin={{ top: 12, right: 8, left: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={token.colorPrimary} stopOpacity={0.45} />
                      <stop offset="100%" stopColor={token.colorPrimary} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={token.colorSplit} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: token.colorTextSecondary }} tickMargin={8} />
                  <YAxis
                    tick={{ fontSize: 12, fill: token.colorTextSecondary }}
                    tickFormatter={(v: number) => formatCompactCurrency(v)}
                    width={70}
                  />
                  <ReTooltip
                    formatter={(value: number) => [formatCurrency(value), 'Doanh thu']}
                    contentStyle={{
                      background: token.colorBgElevated,
                      border: `1px solid ${token.colorBorder}`,
                      borderRadius: 8,
                      color: token.colorText
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke={token.colorPrimary}
                    strokeWidth={2.5}
                    fill="url(#revenueFill)"
                    name="Doanh thu"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>

        <Col xs={24} xl={8}>
          <Card title="Tỷ lệ đóng học phí" styles={{ body: { paddingTop: 8 } }}>
            {isLoading ? (
              <Skeleton active paragraph={{ rows: 6 }} />
            ) : (data?.paymentRatio ?? []).every((p) => p.value === 0) ? (
              <Empty description="Chưa có dữ liệu học phí" style={{ padding: '60px 0' }} />
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={data?.paymentRatio ?? []}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={70}
                    outerRadius={110}
                    paddingAngle={3}
                    // Nhãn hiện số lượng ngay trên lát bánh, đỡ phải rê chuột
                    label={({ value }: { value: number }) => (value > 0 ? String(value) : '')}
                  >
                    {(data?.paymentRatio ?? []).map((entry, index) => (
                      <Cell key={entry.key} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <ReTooltip
                    formatter={(value: number, name: string) => [`${value} học viên`, name]}
                    contentStyle={{
                      background: token.colorBgElevated,
                      border: `1px solid ${token.colorBorder}`,
                      borderRadius: 8,
                      color: token.colorText
                    }}
                  />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>

        <Col xs={24} xl={12}>
          <Card title="Học viên theo khoá học" styles={{ body: { paddingTop: 8 } }}>
            {isLoading ? (
              <Skeleton active paragraph={{ rows: 6 }} />
            ) : (data?.studentsByCourse ?? []).length === 0 ? (
              <Empty description="Chưa có học viên nào được xếp lớp" style={{ padding: '60px 0' }} />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={data?.studentsByCourse ?? []}
                  layout="vertical"
                  margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={token.colorSplit} horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12, fill: token.colorTextSecondary }} allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="courseName"
                    tick={{ fontSize: 11, fill: token.colorTextSecondary }}
                    width={150}
                  />
                  <ReTooltip
                    formatter={(value: number) => [`${value} học viên`, 'Số lượng']}
                    contentStyle={{
                      background: token.colorBgElevated,
                      border: `1px solid ${token.colorBorder}`,
                      borderRadius: 8,
                      color: token.colorText
                    }}
                  />
                  <Bar dataKey="students" fill={token.colorPrimary} radius={[0, 6, 6, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>

        <Col xs={24} xl={12}>
          <Card
            title="Phiếu thu gần đây"
            extra={<a onClick={() => navigate('/payments')}>Xem tất cả</a>}
            styles={{ body: { padding: '8px 16px' } }}
          >
            {isLoading ? (
              <Skeleton active paragraph={{ rows: 6 }} />
            ) : (
              <List
                dataSource={data?.recentPayments ?? []}
                locale={{ emptyText: <Empty description="Chưa có phiếu thu" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                renderItem={(item) => (
                  <List.Item>
                    <List.Item.Meta
                      title={
                        <Flex justify="space-between" gap={12}>
                          <span>{item.studentName}</span>
                          <Typography.Text strong style={{ color: token.colorSuccess }}>
                            {formatCurrency(item.amount)}
                          </Typography.Text>
                        </Flex>
                      }
                      description={
                        <Space size={8} wrap>
                          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                            {item.code}
                          </Typography.Text>
                          <Tag style={{ margin: 0 }}>{PaymentMethodLabel[item.method]}</Tag>
                          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                            {dayjs(item.paidDate).format('DD/MM/YYYY')}
                          </Typography.Text>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* ---------------- Lịch học hôm nay ---------------- */}
      <Card
        title="Lịch học hôm nay"
        extra={<a onClick={() => navigate('/schedule')}>Xem lịch đầy đủ</a>}
        style={{ marginTop: 16 }}
        styles={{ body: { padding: 0 } }}
      >
        <Table<TodaySessionRow>
          className="app-table"
          rowKey="id"
          size="middle"
          columns={sessionColumns}
          dataSource={data?.todaySessions ?? []}
          loading={isLoading}
          pagination={false}
          scroll={{ x: 'max-content' }}
          locale={{
            emptyText: <Empty description="Hôm nay không có buổi học nào" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          }}
        />
      </Card>
    </>
  )
}
