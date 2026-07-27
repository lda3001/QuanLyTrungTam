import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Result,
  Row,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography
} from 'antd'
import {
  ArrowLeftOutlined,
  CalendarOutlined,
  DeleteOutlined,
  FileExcelOutlined,
  ThunderboltOutlined,
  UserAddOutlined,
  UsergroupAddOutlined
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/common/PageHeader'
import { Can, PageSkeleton, StatusTag } from '@/components/common'
import { EnrollModal } from './EnrollModal'
import { EnrollImportModal } from './EnrollImportModal'
import { useNotify } from '@/hooks/useNotify'
import { classService, scheduleService } from '@/services/academic.service'
import { formatCurrency, formatDate } from '@/utils/format'
import {
  ClassStatusColor,
  ClassStatusLabel,
  EnrollmentStatusLabel,
  SessionStatusLabel,
  WeekdayLabel
} from '@shared/constants/enums'
import { PERMISSIONS } from '@shared/constants/permissions'
import type { ClassSessionDetail, EnrollmentDetail } from '@shared/types/entities'

/**
 * Chi tiết lớp học: thông tin lớp, danh sách học viên đã xếp, và các buổi học.
 *
 * Nút "Sinh buổi học" tạo tự động toàn bộ buổi từ khung giờ hằng tuần — thao
 * tác thủ công cho một lớp 48 buổi là không khả thi.
 */
export default function ClassDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const notify = useNotify()
  const queryClient = useQueryClient()
  const classId = Number(id)

  const [enrollOpen, setEnrollOpen] = useState(false)
  const [enrollImportOpen, setEnrollImportOpen] = useState(false)

  const classQuery = useQuery({
    queryKey: ['class', classId],
    queryFn: () => classService.get(classId),
    enabled: Number.isFinite(classId)
  })

  const studentsQuery = useQuery({
    queryKey: ['class-students', classId],
    queryFn: () => classService.students(classId),
    enabled: Number.isFinite(classId)
  })

  const sessionsQuery = useQuery({
    queryKey: ['class-sessions', classId],
    queryFn: () => scheduleService.list({ classId }),
    enabled: Number.isFinite(classId)
  })

  const unenrollMutation = useMutation({
    mutationFn: (enrollmentId: number) => classService.unenroll(enrollmentId),
    onSuccess: () => {
      notify.success('Đã gỡ học viên khỏi lớp.')
      void queryClient.invalidateQueries({ queryKey: ['class-students', classId] })
      void queryClient.invalidateQueries({ queryKey: ['class', classId] })
    },
    onError: (err) => notify.error(err)
  })

  const generateMutation = useMutation({
    mutationFn: (replaceExisting: boolean) => scheduleService.generate({ classId, replaceExisting }),
    onSuccess: (count) => {
      notify.success(count > 0 ? `Đã tạo ${count} buổi học.` : 'Không có buổi nào cần tạo thêm.')
      void queryClient.invalidateQueries({ queryKey: ['class-sessions', classId] })
      void queryClient.invalidateQueries({ queryKey: ['sessions'] })
    },
    onError: (err) => notify.error(err)
  })

  if (classQuery.isLoading) return <PageSkeleton />

  if (classQuery.isError || !classQuery.data) {
    return (
      <Result
        status="404"
        title="Không tìm thấy lớp học"
        extra={
          <Button type="primary" onClick={() => navigate('/classes')}>
            Về danh sách lớp
          </Button>
        }
      />
    )
  }

  const classroom = classQuery.data
  const students = studentsQuery.data ?? []
  const sessions = sessionsQuery.data ?? []
  const remainingSlots = Math.max(0, classroom.maxStudents - students.length)

  const totalPayable = students.reduce((s, e) => s + (e.agreedFee - e.discount), 0)
  const totalPaid = students.reduce((s, e) => s + e.paidAmount, 0)

  const studentColumns = [
    { title: 'Mã HV', dataIndex: 'studentCode', width: 110 },
    {
      title: 'Học viên',
      dataIndex: 'studentName',
      width: 200,
      render: (v: string, row: EnrollmentDetail) => (
        <a onClick={() => navigate(`/students/${row.studentId}`)}>{v}</a>
      )
    },
    { title: 'Điện thoại', dataIndex: 'studentPhone', width: 130, render: (v: string | null) => v ?? '—' },
    {
      title: 'Ngày ghi danh',
      dataIndex: 'enrollDate',
      width: 130,
      render: (v: string) => formatDate(v)
    },
    {
      title: 'Phải đóng',
      key: 'payable',
      width: 140,
      align: 'right' as const,
      render: (_: unknown, row: EnrollmentDetail) => formatCurrency(row.agreedFee - row.discount)
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
      render: (v: keyof typeof EnrollmentStatusLabel) => <Tag>{EnrollmentStatusLabel[v]}</Tag>
    },
    {
      title: '',
      key: 'actions',
      width: 60,
      align: 'center' as const,
      render: (_: unknown, row: EnrollmentDetail) => (
        <Can permission={PERMISSIONS.CLASS_ENROLL}>
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() =>
              notify.confirmDelete({
                title: 'Gỡ khỏi lớp',
                content: `Gỡ học viên "${row.studentName}" khỏi lớp này?`,
                onOk: () => unenrollMutation.mutateAsync(row.id)
              })
            }
          />
        </Can>
      )
    }
  ]

  const sessionColumns = [
    {
      title: 'Ngày học',
      dataIndex: 'sessionDate',
      width: 140,
      render: (v: string) => formatDate(v)
    },
    {
      title: 'Giờ',
      key: 'time',
      width: 140,
      render: (_: unknown, row: ClassSessionDetail) => `${row.startTime} – ${row.endTime}`
    },
    { title: 'Nội dung', dataIndex: 'topic', width: 200, render: (v: string | null) => v ?? '—' },
    { title: 'Phòng', dataIndex: 'room', width: 90, render: (v: string | null) => v ?? '—' },
    {
      title: 'Điểm danh',
      key: 'attendance',
      width: 130,
      render: (_: unknown, row: ClassSessionDetail) =>
        row.status === 'done' ? (
          <Tag color="green">
            {row.attendedCount}/{row.totalStudents}
          </Tag>
        ) : (
          <Typography.Text type="secondary">Chưa</Typography.Text>
        )
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      width: 140,
      render: (v: keyof typeof SessionStatusLabel) => (
        <Tag color={v === 'done' ? 'green' : v === 'cancelled' ? 'red' : 'blue'}>{SessionStatusLabel[v]}</Tag>
      )
    }
  ]

  return (
    <>
      <PageHeader
        title={classroom.name}
        subtitle={`${classroom.code} · ${classroom.courseName}`}
        breadcrumbs={[{ title: 'Đào tạo' }, { title: 'Lớp học', href: '/classes' }, { title: classroom.name }]}
        extra={
          <>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/classes')}>
              Quay lại
            </Button>
            <Can permission={PERMISSIONS.SCHEDULE_MANAGE}>
              <Button
                icon={<ThunderboltOutlined />}
                loading={generateMutation.isPending}
                onClick={() =>
                  notify.confirm({
                    title: 'Sinh buổi học tự động',
                    content:
                      'Hệ thống sẽ tạo các buổi học từ khung giờ hằng tuần, bắt đầu từ ngày khai giảng cho tới khi đủ số buổi của khoá. Các buổi đã có sẽ được giữ nguyên.',
                    okText: 'Sinh buổi học',
                    onOk: () => generateMutation.mutateAsync(false)
                  })
                }
              >
                Sinh buổi học
              </Button>
            </Can>
            <Can permission={PERMISSIONS.CLASS_ENROLL}>
              <Button
                icon={<FileExcelOutlined />}
                disabled={remainingSlots === 0}
                onClick={() => setEnrollImportOpen(true)}
              >
                Nhập Excel
              </Button>
            </Can>
            <Can permission={PERMISSIONS.CLASS_ENROLL}>
              <Button
                type="primary"
                icon={<UserAddOutlined />}
                disabled={remainingSlots === 0}
                onClick={() => setEnrollOpen(true)}
              >
                Xếp học viên
              </Button>
            </Can>
          </>
        }
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card title="Thông tin lớp">
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Mã lớp">{classroom.code}</Descriptions.Item>
              <Descriptions.Item label="Khoá học">{classroom.courseName}</Descriptions.Item>
              <Descriptions.Item label="Giáo viên">{classroom.teacherName ?? 'Chưa phân công'}</Descriptions.Item>
              <Descriptions.Item label="Phòng học">{classroom.room ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Khai giảng">{formatDate(classroom.startDate)}</Descriptions.Item>
              <Descriptions.Item label="Kết thúc">{formatDate(classroom.endDate)}</Descriptions.Item>
              <Descriptions.Item label="Học phí">{formatCurrency(classroom.courseFee)}</Descriptions.Item>
              <Descriptions.Item label="Trạng thái">
                <StatusTag value={classroom.status} labels={ClassStatusLabel} colors={ClassStatusColor} />
              </Descriptions.Item>
              <Descriptions.Item label="Lịch học">
                <Space size={4} wrap>
                  {classroom.schedules.length === 0 ? (
                    <Typography.Text type="secondary">Chưa khai báo</Typography.Text>
                  ) : (
                    classroom.schedules.map((s) => (
                      <Tag key={s.id} style={{ margin: 0 }}>
                        {WeekdayLabel[s.weekday]} {s.startTime}–{s.endTime}
                      </Tag>
                    ))
                  )}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Ghi chú">{classroom.note ?? '—'}</Descriptions.Item>
            </Descriptions>
          </Card>

          <Card style={{ marginTop: 16 }}>
            <Row gutter={16}>
              <Col span={12}>
                <Statistic
                  title="Sĩ số"
                  value={students.length}
                  suffix={`/ ${classroom.maxStudents}`}
                  prefix={<UsergroupAddOutlined />}
                />
              </Col>
              <Col span={12}>
                <Statistic title="Số buổi đã tạo" value={sessions.length} prefix={<CalendarOutlined />} />
              </Col>
              <Col span={24} style={{ marginTop: 16 }}>
                <Statistic
                  title="Đã thu / Phải thu"
                  value={formatCurrency(totalPaid)}
                  suffix={`/ ${formatCurrency(totalPayable)}`}
                  valueStyle={{ fontSize: 20, color: '#52c41a' }}
                />
              </Col>
            </Row>
          </Card>
        </Col>

        <Col xs={24} lg={16}>
          <Card styles={{ body: { paddingTop: 8 } }}>
            <Tabs
              defaultActiveKey="students"
              items={[
                {
                  key: 'students',
                  label: `Học viên (${students.length})`,
                  children: (
                    <Table<EnrollmentDetail>
                      rowKey="id"
                      size="middle"
                      columns={studentColumns}
                      dataSource={students}
                      loading={studentsQuery.isLoading}
                      pagination={{ pageSize: 15, size: 'small' }}
                      scroll={{ x: 'max-content' }}
                      locale={{
                        emptyText: (
                          <Empty description="Lớp chưa có học viên" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                        )
                      }}
                    />
                  )
                },
                {
                  key: 'sessions',
                  label: `Buổi học (${sessions.length})`,
                  children: (
                    <Table<ClassSessionDetail>
                      rowKey="id"
                      size="middle"
                      columns={sessionColumns}
                      dataSource={sessions}
                      loading={sessionsQuery.isLoading}
                      pagination={{ pageSize: 15, size: 'small' }}
                      scroll={{ x: 'max-content' }}
                      locale={{
                        emptyText: (
                          <Empty
                            description="Chưa có buổi học nào — hãy bấm 'Sinh buổi học'"
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                          />
                        )
                      }}
                    />
                  )
                }
              ]}
            />
          </Card>
        </Col>
      </Row>

      <EnrollModal
        open={enrollOpen}
        classId={classId}
        className={classroom.name}
        remainingSlots={remainingSlots}
        onClose={() => setEnrollOpen(false)}
      />

      <EnrollImportModal
        open={enrollImportOpen}
        classId={classId}
        className={classroom.name}
        remainingSlots={remainingSlots}
        onClose={() => setEnrollImportOpen(false)}
      />
    </>
  )
}
