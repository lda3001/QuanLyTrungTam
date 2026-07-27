import { useNavigate, useParams } from 'react-router-dom'
import {
  Avatar,
  Card,
  Col,
  Descriptions,
  Empty,
  Flex,
  Progress,
  Result,
  Row,
  Space,
  Table,
  Tabs,
  Tag,
  Timeline,
  Typography
} from 'antd'
import { ArrowLeftOutlined, BookOutlined, DollarOutlined, HistoryOutlined, UserOutlined } from '@ant-design/icons'
import { Button } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/common/PageHeader'
import { PageSkeleton, StatusTag } from '@/components/common'
import { attendanceService, studentService } from '@/services/academic.service'
import { colorFromString, formatCurrency, formatDate, formatDateTime, initials } from '@/utils/format'
import {
  EnrollmentStatusLabel,
  GenderLabel,
  PaymentMethodLabel,
  StudentStatusColor,
  StudentStatusLabel
} from '@shared/constants/enums'
import type { EnrollmentDetail, PaymentDetail } from '@shared/types/entities'

/**
 * Hồ sơ chi tiết một học viên: thông tin cá nhân, lớp đang học, lịch sử đóng
 * học phí và thống kê chuyên cần.
 *
 * Bốn nguồn dữ liệu tải song song — không cái nào phụ thuộc cái nào nên
 * không cần chờ tuần tự.
 */
export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const studentId = Number(id)

  const studentQuery = useQuery({
    queryKey: ['student', studentId],
    queryFn: () => studentService.get(studentId),
    enabled: Number.isFinite(studentId)
  })

  const enrollmentsQuery = useQuery({
    queryKey: ['student-classes', studentId],
    queryFn: () => studentService.classes(studentId),
    enabled: Number.isFinite(studentId)
  })

  const paymentsQuery = useQuery({
    queryKey: ['student-payments', studentId],
    queryFn: () => studentService.payments(studentId),
    enabled: Number.isFinite(studentId)
  })

  const attendanceQuery = useQuery({
    queryKey: ['student-attendance', studentId],
    queryFn: () => attendanceService.studentSummary(studentId),
    enabled: Number.isFinite(studentId)
  })

  if (studentQuery.isLoading) return <PageSkeleton />

  if (studentQuery.isError || !studentQuery.data) {
    return (
      <Result
        status="404"
        title="Không tìm thấy học viên"
        subTitle="Học viên có thể đã bị xoá khỏi hệ thống."
        extra={
          <Button type="primary" onClick={() => navigate('/students')}>
            Về danh sách
          </Button>
        }
      />
    )
  }

  const student = studentQuery.data
  const enrollments = enrollmentsQuery.data ?? []
  const payments = paymentsQuery.data ?? []
  const attendance = attendanceQuery.data

  const totalPayable = enrollments.reduce((sum, e) => sum + (e.agreedFee - e.discount), 0)
  const totalPaid = enrollments.reduce((sum, e) => sum + e.paidAmount, 0)
  const totalRemaining = Math.max(0, totalPayable - totalPaid)

  const attendanceRate =
    attendance && attendance.total > 0
      ? Math.round(((attendance.present + attendance.late) / attendance.total) * 100)
      : 0

  const enrollmentColumns = [
    {
      title: 'Lớp học',
      dataIndex: 'className',
      render: (value: string, row: EnrollmentDetail) => (
        <div>
          <div style={{ fontWeight: 500 }}>{value}</div>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {row.courseName}
          </Typography.Text>
        </div>
      )
    },
    {
      title: 'Ngày ghi danh',
      dataIndex: 'enrollDate',
      width: 130,
      render: (v: string) => formatDate(v)
    },
    {
      title: 'Học phí',
      dataIndex: 'agreedFee',
      width: 140,
      align: 'right' as const,
      render: (value: number, row: EnrollmentDetail) => (
        <div>
          <div>{formatCurrency(value - row.discount)}</div>
          {row.discount > 0 && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              giảm {formatCurrency(row.discount)}
            </Typography.Text>
          )}
        </div>
      )
    },
    {
      title: 'Đã đóng',
      dataIndex: 'paidAmount',
      width: 130,
      align: 'right' as const,
      render: (v: number) => <Typography.Text type="success">{formatCurrency(v)}</Typography.Text>
    },
    {
      title: 'Còn nợ',
      dataIndex: 'remainingAmount',
      width: 130,
      align: 'right' as const,
      render: (v: number) =>
        v > 0 ? (
          <Typography.Text type="danger" strong>
            {formatCurrency(v)}
          </Typography.Text>
        ) : (
          <Tag color="green">Đã đủ</Tag>
        )
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      width: 120,
      render: (value: keyof typeof EnrollmentStatusLabel) => <Tag>{EnrollmentStatusLabel[value]}</Tag>
    }
  ]

  const paymentColumns = [
    { title: 'Mã phiếu', dataIndex: 'code', width: 150 },
    { title: 'Ngày thu', dataIndex: 'paidDate', width: 120, render: (v: string) => formatDate(v) },
    { title: 'Lớp', dataIndex: 'className', render: (v: string | null) => v ?? '—' },
    {
      title: 'Số tiền',
      dataIndex: 'amount',
      width: 140,
      align: 'right' as const,
      render: (v: number) => <Typography.Text strong>{formatCurrency(v)}</Typography.Text>
    },
    {
      title: 'Hình thức',
      dataIndex: 'method',
      width: 130,
      render: (v: keyof typeof PaymentMethodLabel) => <Tag>{PaymentMethodLabel[v]}</Tag>
    },
    { title: 'Người thu', dataIndex: 'createdByName', width: 160, render: (v: string | null) => v ?? '—' }
  ]

  return (
    <>
      <PageHeader
        title={student.fullName}
        subtitle={`Mã học viên: ${student.code}`}
        breadcrumbs={[{ title: 'Đào tạo' }, { title: 'Học viên', href: '/students' }, { title: student.fullName }]}
        extra={
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/students')}>
            Quay lại danh sách
          </Button>
        }
      />

      <Row gutter={[16, 16]}>
        {/* ---------- Cột trái: thẻ hồ sơ ---------- */}
        <Col xs={24} lg={8}>
          <Card>
            <Flex vertical align="center" gap={12} style={{ marginBottom: 20 }}>
              <Avatar
                size={88}
                src={student.avatar || undefined}
                style={{ backgroundColor: colorFromString(student.fullName), fontSize: 34 }}
              >
                {initials(student.fullName)}
              </Avatar>
              <div style={{ textAlign: 'center' }}>
                <Typography.Title level={4} style={{ margin: 0 }}>
                  {student.fullName}
                </Typography.Title>
                <StatusTag value={student.status} labels={StudentStatusLabel} colors={StudentStatusColor} />
              </div>
            </Flex>

            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Mã học viên">{student.code}</Descriptions.Item>
              <Descriptions.Item label="Giới tính">{GenderLabel[student.gender]}</Descriptions.Item>
              <Descriptions.Item label="Ngày sinh">{formatDate(student.birthDate)}</Descriptions.Item>
              <Descriptions.Item label="Lớp (ở trường)">
                {student.schoolClass ? <Tag color="geekblue">{student.schoolClass}</Tag> : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Điện thoại">{student.phone ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Email">{student.email ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Địa chỉ">{student.address ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Người giám hộ">
                {student.guardianName ? `${student.guardianName}${student.guardianPhone ? ` — ${student.guardianPhone}` : ''}` : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Ghi chú">{student.note ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Ngày tạo">{formatDateTime(student.createdAt)}</Descriptions.Item>
            </Descriptions>
          </Card>

          <Card title="Chuyên cần" style={{ marginTop: 16 }}>
            <Flex vertical align="center" gap={8}>
              <Progress
                type="dashboard"
                percent={attendanceRate}
                strokeColor={attendanceRate >= 80 ? '#52c41a' : attendanceRate >= 60 ? '#faad14' : '#ff4d4f'}
              />
              <Typography.Text type="secondary">
                {attendance?.total ?? 0} buổi đã điểm danh
              </Typography.Text>
            </Flex>

            <Row gutter={8} style={{ marginTop: 16, textAlign: 'center' }}>
              <Col span={6}>
                <Tag color="green" style={{ width: '100%', margin: 0 }}>
                  Có mặt
                </Tag>
                <div style={{ marginTop: 4, fontWeight: 600 }}>{attendance?.present ?? 0}</div>
              </Col>
              <Col span={6}>
                <Tag color="orange" style={{ width: '100%', margin: 0 }}>
                  Muộn
                </Tag>
                <div style={{ marginTop: 4, fontWeight: 600 }}>{attendance?.late ?? 0}</div>
              </Col>
              <Col span={6}>
                <Tag color="gold" style={{ width: '100%', margin: 0 }}>
                  Có phép
                </Tag>
                <div style={{ marginTop: 4, fontWeight: 600 }}>{attendance?.excused ?? 0}</div>
              </Col>
              <Col span={6}>
                <Tag color="red" style={{ width: '100%', margin: 0 }}>
                  Không phép
                </Tag>
                <div style={{ marginTop: 4, fontWeight: 600 }}>{attendance?.absent ?? 0}</div>
              </Col>
            </Row>
          </Card>
        </Col>

        {/* ---------- Cột phải: tab dữ liệu ---------- */}
        <Col xs={24} lg={16}>
          <Card styles={{ body: { paddingTop: 8 } }}>
            <Tabs
              defaultActiveKey="classes"
              items={[
                {
                  key: 'classes',
                  label: (
                    <span>
                      <BookOutlined /> Lớp học ({enrollments.length})
                    </span>
                  ),
                  children: (
                    <Table<EnrollmentDetail>
                      rowKey="id"
                      size="middle"
                      columns={enrollmentColumns}
                      dataSource={enrollments}
                      loading={enrollmentsQuery.isLoading}
                      pagination={false}
                      scroll={{ x: 'max-content' }}
                      locale={{
                        emptyText: <Empty description="Chưa được xếp lớp" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                      }}
                      summary={() =>
                        enrollments.length > 0 ? (
                          <Table.Summary fixed>
                            <Table.Summary.Row>
                              <Table.Summary.Cell index={0} colSpan={2}>
                                <Typography.Text strong>Tổng cộng</Typography.Text>
                              </Table.Summary.Cell>
                              <Table.Summary.Cell index={2} align="right">
                                <Typography.Text strong>{formatCurrency(totalPayable)}</Typography.Text>
                              </Table.Summary.Cell>
                              <Table.Summary.Cell index={3} align="right">
                                <Typography.Text type="success" strong>
                                  {formatCurrency(totalPaid)}
                                </Typography.Text>
                              </Table.Summary.Cell>
                              <Table.Summary.Cell index={4} align="right">
                                <Typography.Text type="danger" strong>
                                  {formatCurrency(totalRemaining)}
                                </Typography.Text>
                              </Table.Summary.Cell>
                              <Table.Summary.Cell index={5} />
                            </Table.Summary.Row>
                          </Table.Summary>
                        ) : null
                      }
                    />
                  )
                },
                {
                  key: 'payments',
                  label: (
                    <span>
                      <DollarOutlined /> Học phí ({payments.length})
                    </span>
                  ),
                  children: (
                    <Table<PaymentDetail>
                      rowKey="id"
                      size="middle"
                      columns={paymentColumns}
                      dataSource={payments}
                      loading={paymentsQuery.isLoading}
                      pagination={{ pageSize: 10, size: 'small' }}
                      scroll={{ x: 'max-content' }}
                      locale={{
                        emptyText: <Empty description="Chưa có phiếu thu" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                      }}
                    />
                  )
                },
                {
                  key: 'timeline',
                  label: (
                    <span>
                      <HistoryOutlined /> Dòng thời gian
                    </span>
                  ),
                  children:
                    payments.length === 0 && enrollments.length === 0 ? (
                      <Empty description="Chưa có hoạt động" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                    ) : (
                      <Timeline
                        style={{ paddingTop: 12 }}
                        items={[
                          {
                            color: 'blue',
                            dot: <UserOutlined />,
                            children: (
                              <>
                                <Typography.Text strong>Tạo hồ sơ học viên</Typography.Text>
                                <br />
                                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                  {formatDateTime(student.createdAt)}
                                </Typography.Text>
                              </>
                            )
                          },
                          ...enrollments.map((e) => ({
                            color: 'cyan',
                            children: (
                              <>
                                <Typography.Text strong>Ghi danh lớp {e.className}</Typography.Text>
                                <br />
                                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                  {formatDate(e.enrollDate)} — {e.courseName}
                                </Typography.Text>
                              </>
                            )
                          })),
                          ...payments.map((p) => ({
                            color: 'green',
                            children: (
                              <>
                                <Typography.Text strong>
                                  Đóng học phí {formatCurrency(p.amount)}
                                </Typography.Text>
                                <br />
                                <Space size={6}>
                                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                    {formatDate(p.paidDate)} — {p.code}
                                  </Typography.Text>
                                  <Tag style={{ margin: 0 }}>{PaymentMethodLabel[p.method]}</Tag>
                                </Space>
                              </>
                            )
                          }))
                        ]}
                      />
                    )
                }
              ]}
            />
          </Card>
        </Col>
      </Row>
    </>
  )
}
