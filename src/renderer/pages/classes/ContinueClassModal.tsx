import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Checkbox,
  Col,
  Divider,
  Flex,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Space,
  Tag,
  Typography
} from 'antd'
import { CalendarOutlined, LinkOutlined, TeamOutlined } from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { classService } from '@/services/academic.service'
import { useNotify } from '@/hooks/useNotify'
import { dayjs, formatCurrency, formatDate, ISO_DATE } from '@/utils/format'
import type { ClassRoomDetail, EnrollmentDetail } from '@shared/types/entities'
import type { ContinueClassInput } from '@shared/types/dto'

interface Props {
  open: boolean
  source: ClassRoomDetail
  students: EnrollmentDetail[]
  onClose: () => void
  onCreated: (classId: number) => void
}

function nextAcademicYear(source: ClassRoomDetail, startDate: string): string {
  const match = source.academicYear?.match(/(\d{4})\s*[–-]\s*(\d{4})/)
  if (match) return `${Number(match[1]) + 1}–${Number(match[2]) + 1}`
  const year = Number(startDate.slice(0, 4)) || dayjs().year()
  return `${year}–${year + 1}`
}

function initialStartDate(source: ClassRoomDetail): string {
  if (source.endDate) return dayjs(source.endDate, ISO_DATE).add(1, 'day').format(ISO_DATE)
  return dayjs().format(ISO_DATE)
}

export function ContinueClassModal({ open, source, students, onClose, onCreated }: Props) {
  const notify = useNotify()
  const queryClient = useQueryClient()
  const eligibleStudents = useMemo(
    () => students.filter((student) => student.status === 'studying'),
    [students]
  )

  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [academicYear, setAcademicYear] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [maxStudents, setMaxStudents] = useState(source.maxStudents)
  const [tuitionFee, setTuitionFee] = useState(source.courseCurrentFee)
  const [carryDiscounts, setCarryDiscounts] = useState(false)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [finishSourceClass, setFinishSourceClass] = useState(true)

  useEffect(() => {
    if (!open) return
    const nextStart = initialStartDate(source)
    const nextYear = nextAcademicYear(source, nextStart)
    const durationDays =
      source.startDate && source.endDate
        ? Math.max(
            1,
            dayjs(source.endDate, ISO_DATE).diff(dayjs(source.startDate, ISO_DATE), 'day')
          )
        : 120

    setName(`${source.name} — ${nextYear}`)
    setCode('')
    setAcademicYear(nextYear)
    setStartDate(nextStart)
    setEndDate(dayjs(nextStart, ISO_DATE).add(durationDays, 'day').format(ISO_DATE))
    setMaxStudents(Math.max(source.maxStudents, eligibleStudents.length))
    setTuitionFee(source.courseCurrentFee)
    setCarryDiscounts(false)
    setSelectedIds(eligibleStudents.map((student) => student.studentId))
    setFinishSourceClass(true)
  }, [eligibleStudents, open, source])

  const mutation = useMutation({
    mutationFn: () => {
      const input: ContinueClassInput = {
        code: code.trim() || undefined,
        name: name.trim(),
        academicYear: academicYear.trim(),
        teacherId: source.teacherId,
        room: source.room,
        startDate,
        endDate,
        maxStudents,
        tuitionFee,
        carryDiscounts,
        note: `Lớp tiếp tục từ ${source.code} — ${source.name}`,
        schedules: source.schedules.map((schedule) => ({
          weekday: schedule.weekday,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          room: schedule.room
        })),
        transferStudentIds: selectedIds,
        finishSourceClass
      }
      return classService.continueClass(source.id, input)
    },
    onSuccess: (nextClass) => {
      notify.success(`Đã mở lớp tiếp tục ${nextClass.code} cho năm học ${nextClass.academicYear}.`)
      void queryClient.invalidateQueries({ queryKey: ['classes'] })
      void queryClient.invalidateQueries({ queryKey: ['class', source.id] })
      void queryClient.invalidateQueries({ queryKey: ['class-options'] })
      onCreated(nextClass.id)
    },
    onError: (error) => notify.error(error)
  })

  const canSubmit =
    name.trim().length >= 2 &&
    /^\d{4}\s*[–-]\s*\d{4}$/.test(academicYear.trim()) &&
    !!startDate &&
    !!endDate &&
    startDate <= endDate &&
    maxStudents >= selectedIds.length &&
    Number.isFinite(tuitionFee) &&
    tuitionFee >= 0 &&
    source.schedules.length > 0

  const allSelected = eligibleStudents.length > 0 && selectedIds.length === eligibleStudents.length
  const selectedStudents = eligibleStudents.filter((student) =>
    selectedIds.includes(student.studentId)
  )
  const estimatedTuition = selectedStudents.reduce(
    (total, student) => total + Math.max(0, tuitionFee - (carryDiscounts ? student.discount : 0)),
    0
  )

  return (
    <Modal
      open={open}
      width={760}
      title={
        <Space>
          <LinkOutlined />
          Mở lớp tiếp tục sang năm học mới
        </Space>
      }
      okText="Tạo lớp tiếp tục"
      cancelText="Huỷ"
      confirmLoading={mutation.isPending}
      okButtonProps={{ disabled: !canSubmit }}
      onOk={() => mutation.mutate()}
      onCancel={onClose}
      destroyOnHidden
    >
      <Alert
        type="info"
        showIcon
        message={`Lớp nguồn: ${source.code} — ${source.name}`}
        description="Hệ thống tạo một lớp mới có liên kết với lớp này. Điểm danh, học phí và công nợ cũ được giữ nguyên; lớp mới chốt học phí riêng theo mức bạn xác nhận bên dưới."
        style={{ marginBottom: 18 }}
      />

      <Form layout="vertical">
        <Row gutter={14}>
          <Col span={16}>
            <Form.Item label="Tên lớp mới" required>
              <Input
                value={name}
                maxLength={150}
                onChange={(event) => setName(event.target.value)}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="Mã lớp">
              <Input
                value={code}
                maxLength={20}
                placeholder="Tự sinh"
                onChange={(event) => setCode(event.target.value)}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="Năm học" required extra="Ví dụ: 2026–2027">
              <Input
                value={academicYear}
                placeholder="2026–2027"
                onChange={(event) => setAcademicYear(event.target.value)}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="Ngày bắt đầu" required>
              <Input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="Ngày kết thúc" required>
              <Input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="Sĩ số tối đa" required>
              <InputNumber
                min={Math.max(1, selectedIds.length)}
                max={500}
                value={maxStudents}
                onChange={(value) => setMaxStudents(value ?? 1)}
                style={{ width: '100%' }}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              label="Học phí lớp mới"
              required
              extra={`Giá lớp cũ: ${formatCurrency(source.tuitionFee)}`}
            >
              <InputNumber
                min={0}
                step={100_000}
                value={tuitionFee}
                formatter={(value) => `${value ?? 0}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                parser={(value) => Number(String(value ?? '').replace(/\D/g, ''))}
                addonAfter="₫"
                onChange={(value) => setTuitionFee(Number(value ?? 0))}
                style={{ width: '100%' }}
              />
            </Form.Item>
          </Col>
          <Col span={16}>
            <Form.Item label="Thông tin kế thừa">
              <Flex gap={6} wrap>
                <Tag>{source.courseName}</Tag>
                <Tag color="green">
                  Giá khóa học hiện tại: {formatCurrency(source.courseCurrentFee)}
                </Tag>
                <Tag>{source.teacherName ?? 'Chưa phân công giáo viên'}</Tag>
                <Tag icon={<CalendarOutlined />}>{source.schedules.length} lịch học/tuần</Tag>
              </Flex>
            </Form.Item>
          </Col>
        </Row>
      </Form>

      <Divider orientation="left" plain>
        <Space>
          <TeamOutlined /> Học viên chuyển tiếp ({selectedIds.length}/{eligibleStudents.length})
        </Space>
      </Divider>

      {source.courseCurrentFee !== source.tuitionFee && (
        <Alert
          type="warning"
          showIcon
          message="Giá khóa học đã thay đổi"
          description={`Lớp cũ giữ mức ${formatCurrency(source.tuitionFee)}. Lớp tiếp tục đang lấy giá hiện tại ${formatCurrency(source.courseCurrentFee)}; bạn có thể sửa trước khi tạo.`}
          style={{ marginBottom: 14 }}
        />
      )}

      <Checkbox
        checked={carryDiscounts}
        onChange={(event) => setCarryDiscounts(event.target.checked)}
        style={{ marginBottom: 12 }}
      >
        Giữ mức giảm giá của từng học viên từ lớp cũ
      </Checkbox>
      <Alert
        type="info"
        showIcon
        message={`Tạm tính lớp mới: ${formatCurrency(estimatedTuition)}`}
        description="Các cách tính riêng, phụ thu và mức phải đóng nhập trực tiếp của lớp cũ không được mang sang, tránh kéo theo công nợ sai. Có thể điều chỉnh riêng sau khi tạo lớp."
        style={{ marginBottom: 14 }}
      />

      <Flex justify="space-between" align="center" style={{ marginBottom: 10 }}>
        <Typography.Text type="secondary">
          Chỉ học viên đang học mới được chuyển sang lớp mới.
        </Typography.Text>
        <Button
          type="link"
          size="small"
          onClick={() =>
            setSelectedIds(allSelected ? [] : eligibleStudents.map((student) => student.studentId))
          }
        >
          {allSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
        </Button>
      </Flex>

      <div className="class-continuation-students">
        {eligibleStudents.length === 0 ? (
          <Typography.Text type="secondary">
            Lớp không có học viên đang học để chuyển tiếp.
          </Typography.Text>
        ) : (
          eligibleStudents.map((student) => (
            <Checkbox
              key={student.studentId}
              checked={selectedIds.includes(student.studentId)}
              onChange={(event) =>
                setSelectedIds((current) =>
                  event.target.checked
                    ? [...current, student.studentId]
                    : current.filter((id) => id !== student.studentId)
                )
              }
            >
              <Typography.Text strong>{student.studentCode}</Typography.Text>
              {' — '}
              {student.studentName}
              {student.discount > 0 && (
                <Tag color={carryDiscounts ? 'green' : 'default'} style={{ marginInlineStart: 6 }}>
                  Giảm cũ {formatCurrency(student.discount)}
                </Tag>
              )}
            </Checkbox>
          ))
        )}
      </div>

      <Checkbox
        checked={finishSourceClass}
        onChange={(event) => setFinishSourceClass(event.target.checked)}
        style={{ marginTop: 16 }}
      >
        Đánh dấu lớp nguồn là “Đã kết thúc” và hoàn thành các ghi danh cũ
      </Checkbox>

      {source.schedules.length === 0 && (
        <Alert
          type="warning"
          showIcon
          message="Lớp nguồn chưa có lịch học tuần. Hãy bổ sung lịch trước khi mở lớp tiếp tục."
          style={{ marginTop: 14 }}
        />
      )}
      {startDate && endDate && startDate > endDate && (
        <Alert
          type="error"
          showIcon
          message="Ngày kết thúc phải sau ngày bắt đầu."
          style={{ marginTop: 14 }}
        />
      )}
      {source.endDate && startDate && startDate <= source.endDate && (
        <Alert
          type="warning"
          showIcon
          message={`Lớp mới bắt đầu ${formatDate(startDate)}, chưa sau ngày kết thúc lớp nguồn (${formatDate(source.endDate)}).`}
          style={{ marginTop: 14 }}
        />
      )}
    </Modal>
  )
}
