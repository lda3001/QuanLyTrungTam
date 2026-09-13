import { useMemo, useState } from 'react'
import { MuiDatePickerApi as DatePicker } from '@/components/common/MuiControls'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Button,
  Alert,
  Card,
  Col,
  Descriptions,
  Empty,
  Modal,
  Result,
  Row,
  Space,
  Statistic,
  Tabs,
  Tag,
  Typography
} from 'antd'
import {
  ArrowLeftOutlined,
  CalendarOutlined,
  DeleteOutlined,
  EditOutlined,
  FileExcelOutlined,
  ForkOutlined,
  ThunderboltOutlined,
  UserAddOutlined,
  UsergroupAddOutlined
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/common/PageHeader'
import { ResizableTable } from '@/components/common/ResizableTable'
import { Can, PageSkeleton, SearchInput, StatusTag } from '@/components/common'
import { EnrollModal } from './EnrollModal'
import { EnrollImportModal } from './EnrollImportModal'
import { ContinueClassModal } from './ContinueClassModal'
import { useNotify } from '@/hooks/useNotify'
import { usePermission } from '@/hooks/usePermission'
import { classService, scheduleService } from '@/services/academic.service'
import { DATE_FORMAT, dayjs, formatCurrency, formatDate, ISO_DATE } from '@/utils/format'
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
  const { can } = usePermission()
  const queryClient = useQueryClient()
  const classId = Number(id)

  const [enrollOpen, setEnrollOpen] = useState(false)
  const [enrollImportOpen, setEnrollImportOpen] = useState(false)
  const [continueOpen, setContinueOpen] = useState(false)
  const [studentKeyword, setStudentKeyword] = useState('')
  const [editingEnrollment, setEditingEnrollment] = useState<EnrollmentDetail | null>(null)
  const [editedEnrollDate, setEditedEnrollDate] = useState('')

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

  const updateEnrollmentMutation = useMutation({
    mutationFn: () =>
      classService.updateEnrollment({
        id: editingEnrollment?.id ?? 0,
        enrollDate: editedEnrollDate
      }),
    onSuccess: (enrollment) => {
      notify.success('Đã cập nhật ngày ghi danh và tính lại học phí.')
      setEditingEnrollment(null)
      void queryClient.invalidateQueries({ queryKey: ['class-students', classId] })
      void queryClient.invalidateQueries({
        queryKey: ['student-enrollments', enrollment.studentId]
      })
      void queryClient.invalidateQueries({ queryKey: ['debts'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (err) => notify.error(err)
  })

  const generateMutation = useMutation({
    mutationFn: (replaceExisting: boolean) =>
      scheduleService.generate({ classId, replaceExisting }),
    onSuccess: (count) => {
      notify.success(count > 0 ? `Đã tạo ${count} buổi học.` : 'Không có buổi nào cần tạo thêm.')
      void queryClient.invalidateQueries({ queryKey: ['class-sessions', classId] })
      void queryClient.invalidateQueries({ queryKey: ['sessions'] })
    },
    onError: (err) => notify.error(err)
  })

  const students = studentsQuery.data ?? []
  const filteredStudents = useMemo(() => {
    const keyword = studentKeyword.trim().normalize('NFC').toLocaleLowerCase('vi-VN')
    if (!keyword) return students
    return students.filter(
      (student) =>
        student.studentCode.toLocaleLowerCase('vi-VN').includes(keyword) ||
        student.studentName.normalize('NFC').toLocaleLowerCase('vi-VN').includes(keyword)
    )
  }, [students, studentKeyword])

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
  const sessions = sessionsQuery.data ?? []
  const remainingSlots = Math.max(0, classroom.maxStudents - students.length)

  const totalPayable = students.reduce((s, e) => s + e.payableAmount, 0)
  const totalPaid = students.reduce((s, e) => s + e.paidAmount, 0)

  const compareStudentName = (left: string, right: string) => {
    const lastWord = (name: string) => name.trim().split(/\s+/).at(-1) ?? ''
    return (
      lastWord(left).localeCompare(lastWord(right), 'vi', { sensitivity: 'base' }) ||
      left.localeCompare(right, 'vi', { sensitivity: 'base' })
    )
  }

  const studentColumns = [
    {
      title: 'Mã HV',
      dataIndex: 'studentCode',
      width: 110,
      sorter: (left: EnrollmentDetail, right: EnrollmentDetail) =>
        left.studentCode.localeCompare(right.studentCode, 'vi', { numeric: true })
    },
    {
      title: 'Học viên',
      dataIndex: 'studentName',
      width: 200,
      sorter: (left: EnrollmentDetail, right: EnrollmentDetail) =>
        compareStudentName(left.studentName, right.studentName),
      render: (v: string) => v
    },
    {
      title: 'Điện thoại',
      dataIndex: 'studentPhone',
      width: 130,
      render: (v: string | null) => v ?? '—'
    },
    {
      title: 'Ngày ghi danh',
      dataIndex: 'enrollDate',
      width: 130,
      sorter: (left: EnrollmentDetail, right: EnrollmentDetail) =>
        left.enrollDate.localeCompare(right.enrollDate),
      render: (v: string) => formatDate(v)
    },
    {
      title: 'Phải đóng',
      key: 'payable',
      width: 140,
      align: 'right' as const,
      sorter: (left: EnrollmentDetail, right: EnrollmentDetail) =>
        left.payableAmount - right.payableAmount,
      render: (_: unknown, row: EnrollmentDetail) => formatCurrency(row.payableAmount)
    },
    {
      title: 'Đã đóng',
      dataIndex: 'paidAmount',
      width: 130,
      align: 'right' as const,
      sorter: (left: EnrollmentDetail, right: EnrollmentDetail) =>
        left.paidAmount - right.paidAmount,
      render: (v: number) => <Typography.Text type="success">{formatCurrency(v)}</Typography.Text>
    },
    {
      title: 'Còn nợ',
      dataIndex: 'remainingAmount',
      width: 130,
      align: 'right' as const,
      sorter: (left: EnrollmentDetail, right: EnrollmentDetail) =>
        left.remainingAmount - right.remainingAmount,
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
      width: 100,
      align: 'center' as const,
      render: (_: unknown, row: EnrollmentDetail) => (
        <Space size={2}>
          <Can permission={PERMISSIONS.CLASS_UPDATE_ENROLLMENT}>
            <Button
              type="text"
              icon={<EditOutlined />}
              title="Sửa ngày ghi danh"
              onClick={(event) => {
                event.stopPropagation()
                setEditingEnrollment(row)
                setEditedEnrollDate(row.enrollDate)
              }}
            />
          </Can>
          <Can permission={PERMISSIONS.CLASS_ENROLL}>
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={(event) => {
                event.stopPropagation()
                notify.confirmDelete({
                  title: 'Gỡ khỏi lớp',
                  content: `Gỡ học viên "${row.studentName}" khỏi lớp này?`,
                  onOk: () => unenrollMutation.mutateAsync(row.id)
                })
              }}
            />
          </Can>
        </Space>
      )
    }
  ]

  const canViewStudent = can(PERMISSIONS.STUDENT_VIEW)
  const openStudent = (studentId: number): void => {
    if (!canViewStudent) return
    navigate(`/students/${studentId}`)
  }

  const canViewAttendance = can(PERMISSIONS.ATTENDANCE_VIEW)
  const openAttendance = (sessionId: number): void => {
    if (!canViewAttendance) return
    navigate(`/attendance?classId=${classId}&sessionId=${sessionId}`)
  }

  const sessionColumns: ColumnsType<ClassSessionDetail> = [
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
        <Tag color={v === 'done' ? 'green' : v === 'cancelled' ? 'red' : 'blue'}>
          {SessionStatusLabel[v]}
        </Tag>
      )
    }
  ]

  return (
    <>
      <PageHeader
        title={classroom.name}
        subtitle={`${classroom.code} · ${classroom.courseName}`}
        breadcrumbs={[
          { title: 'Đào tạo' },
          { title: 'Lớp học', href: '/classes' },
          { title: classroom.name }
        ]}
        extra={
          <>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/classes')}>
              Quay lại
            </Button>
            <Can permission={PERMISSIONS.CLASS_CREATE}>
              <Button icon={<ForkOutlined />} onClick={() => setContinueOpen(true)}>
                Mở lớp tiếp tục
              </Button>
            </Can>
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
              <Descriptions.Item label="Năm học">
                {classroom.academicYear ?? 'Chưa thiết lập'}
              </Descriptions.Item>
              {classroom.previousClassId && (
                <Descriptions.Item label="Tiếp tục từ lớp">
                  <a onClick={() => navigate(`/classes/${classroom.previousClassId}`)}>
                    {classroom.previousClassCode} — {classroom.previousClassName}
                  </a>
                </Descriptions.Item>
              )}
              {classroom.continuations.length > 0 && (
                <Descriptions.Item label="Lớp kế tiếp">
                  <Space size={4} wrap>
                    {classroom.continuations.map((nextClass) => (
                      <Tag
                        key={nextClass.id}
                        color="blue"
                        style={{ cursor: 'pointer' }}
                        onClick={() => navigate(`/classes/${nextClass.id}`)}
                      >
                        {nextClass.code} · {nextClass.academicYear ?? 'Chưa có năm học'}
                      </Tag>
                    ))}
                  </Space>
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Giáo viên">
                {classroom.teacherName ?? 'Chưa phân công'}
              </Descriptions.Item>
              <Descriptions.Item label="Phòng học">{classroom.room ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Khai giảng">
                {formatDate(classroom.startDate)}
              </Descriptions.Item>
              <Descriptions.Item label="Kết thúc">
                {formatDate(classroom.endDate)}
              </Descriptions.Item>
              <Descriptions.Item label="Học phí lớp">
                {formatCurrency(classroom.courseFee)}
              </Descriptions.Item>
              <Descriptions.Item label="Trạng thái">
                <StatusTag
                  value={classroom.status}
                  labels={ClassStatusLabel}
                  colors={ClassStatusColor}
                />
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
                <Statistic
                  title="Số buổi đã tạo"
                  value={sessions.length}
                  prefix={<CalendarOutlined />}
                />
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
                    <>
                      <SearchInput
                        value={studentKeyword}
                        onChange={setStudentKeyword}
                        placeholder="Tìm mã học viên hoặc họ tên..."
                        width={300}
                      />
                      <ResizableTable<EnrollmentDetail>
                        style={{ marginTop: 12 }}
                        rowKey="id"
                        size="middle"
                        columnStorageKey="app-table-widths:class-detail-students"
                        columns={studentColumns}
                        dataSource={filteredStudents}
                        loading={studentsQuery.isLoading}
                        onRow={(row) => ({
                          onClick: canViewStudent
                            ? (event) => {
                                const target = event.target as HTMLElement
                                if (target.closest('button, a, input, select, textarea')) return
                                openStudent(row.studentId)
                              }
                            : undefined,
                          onKeyDown: canViewStudent
                            ? (event) => {
                                if (event.currentTarget !== event.target) return
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault()
                                  openStudent(row.studentId)
                                }
                              }
                            : undefined,
                          tabIndex: canViewStudent ? 0 : undefined,
                          role: canViewStudent ? 'link' : undefined,
                          title: canViewStudent ? 'Mở hồ sơ học viên' : undefined,
                          style: canViewStudent ? { cursor: 'pointer' } : undefined
                        })}
                        pagination={{ pageSize: 15, size: 'small' }}
                        scroll={{ x: 'max-content' }}
                        locale={{
                          emptyText: (
                            <Empty
                              description="Lớp chưa có học viên"
                              image={Empty.PRESENTED_IMAGE_SIMPLE}
                            />
                          )
                        }}
                      />
                    </>
                  )
                },
                {
                  key: 'sessions',
                  label: `Buổi học (${sessions.length})`,
                  children: (
                    <ResizableTable<ClassSessionDetail>
                      rowKey="id"
                      size="middle"
                      columnStorageKey="app-table-widths:class-detail-sessions"
                      columns={sessionColumns}
                      dataSource={sessions}
                      loading={sessionsQuery.isLoading}
                      onRow={(row) => ({
                        onClick: canViewAttendance ? () => openAttendance(row.id) : undefined,
                        onKeyDown: canViewAttendance
                          ? (event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault()
                                openAttendance(row.id)
                              }
                            }
                          : undefined,
                        tabIndex: canViewAttendance ? 0 : undefined,
                        role: canViewAttendance ? 'link' : undefined,
                        title: canViewAttendance ? 'Mở điểm danh buổi học' : undefined,
                        style: canViewAttendance ? { cursor: 'pointer' } : undefined
                      })}
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

      <ContinueClassModal
        open={continueOpen}
        source={classroom}
        students={students}
        onClose={() => setContinueOpen(false)}
        onCreated={(nextClassId) => {
          setContinueOpen(false)
          navigate(`/classes/${nextClassId}`)
        }}
      />

      <Modal
        open={!!editingEnrollment}
        title="Sửa ngày ghi danh"
        okText="Lưu thay đổi"
        cancelText="Huỷ"
        confirmLoading={updateEnrollmentMutation.isPending}
        okButtonProps={{ disabled: !editedEnrollDate }}
        onOk={() => updateEnrollmentMutation.mutate()}
        onCancel={() => setEditingEnrollment(null)}
        destroyOnHidden
      >
        {editingEnrollment && (
          <>
            <Alert
              type="info"
              showIcon
              message={`${editingEnrollment.studentName} · ${classroom.name}`}
              description="Các buổi trước ngày ghi danh mới sẽ không được tính. Học phí và công nợ sẽ tự động được tính lại sau khi lưu."
              style={{ marginBottom: 16 }}
            />
            <Space>
              <Typography.Text>Ngày ghi danh:</Typography.Text>
              <DatePicker
                value={editedEnrollDate ? dayjs(editedEnrollDate, ISO_DATE) : null}
                onChange={(value) => setEditedEnrollDate(value ? value.format(ISO_DATE) : '')}
                format={DATE_FORMAT}
                allowClear={false}
              />
            </Space>
          </>
        )}
      </Modal>
    </>
  )
}
