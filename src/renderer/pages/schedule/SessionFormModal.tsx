import { useEffect } from 'react'
import { Col, Form, Modal, Row, Spin } from 'antd'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  FormDatePicker,
  FormInput,
  FormSelect,
  FormTextArea,
  FormTimePicker
} from '@/components/form/fields'
import { useNotify } from '@/hooks/useNotify'
import { classService, scheduleService, teacherService } from '@/services/academic.service'
import { sessionSchema, type SessionForm } from '@/utils/schemas'
import { SessionStatus, SessionStatusLabel } from '@shared/constants/enums'

interface Props {
  open: boolean
  sessionId: number | null
  /** Ngày được chọn sẵn khi tạo mới từ ô lịch */
  defaultDate?: string
  onClose: () => void
}

const EMPTY: SessionForm = {
  classId: 0,
  sessionDate: '',
  startTime: '18:00',
  endTime: '20:00',
  room: '',
  teacherId: null,
  topic: '',
  status: SessionStatus.SCHEDULED,
  note: ''
}

/** Thêm/sửa một buổi học lẻ (dạy bù, đổi phòng, học thử...) */
export function SessionFormModal({ open, sessionId, defaultDate, onClose }: Props) {
  const notify = useNotify()
  const queryClient = useQueryClient()
  const isEdit = sessionId !== null

  const { control, handleSubmit, reset } = useForm<SessionForm>({
    resolver: zodResolver(sessionSchema),
    defaultValues: EMPTY
  })

  const { data: classOptions = [] } = useQuery({
    queryKey: ['class-options'],
    queryFn: () => classService.options(),
    enabled: open,
    staleTime: 5 * 60_000
  })

  const { data: teacherOptions = [] } = useQuery({
    queryKey: ['teacher-options'],
    queryFn: () => teacherService.options(),
    enabled: open,
    staleTime: 5 * 60_000
  })

  const { data: session, isFetching } = useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => scheduleService.get(sessionId as number),
    enabled: open && isEdit
  })

  useEffect(() => {
    if (!open) return
    if (isEdit && session) {
      reset({
        classId: session.classId,
        sessionDate: session.sessionDate,
        startTime: session.startTime,
        endTime: session.endTime,
        room: session.room ?? '',
        teacherId: session.teacherId,
        topic: session.topic ?? '',
        status: session.status,
        note: session.note ?? ''
      })
    } else if (!isEdit) {
      reset({ ...EMPTY, sessionDate: defaultDate ?? '' })
    }
  }, [open, isEdit, session, defaultDate, reset])

  const mutation = useMutation({
    mutationFn: (values: SessionForm) => {
      const payload = {
        ...values,
        room: values.room || null,
        topic: values.topic || null,
        note: values.note || null
      }
      return isEdit ? scheduleService.update(sessionId, payload) : scheduleService.create(payload)
    },
    onSuccess: () => {
      notify.success(isEdit ? 'Đã cập nhật buổi học.' : 'Đã thêm buổi học.')
      void queryClient.invalidateQueries({ queryKey: ['sessions'] })
      void queryClient.invalidateQueries({ queryKey: ['class-sessions'] })
      if (sessionId !== null) void queryClient.invalidateQueries({ queryKey: ['session', sessionId] })
      onClose()
    },
    onError: (err) => notify.error(err)
  })

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={isEdit ? 'Cập nhật buổi học' : 'Thêm buổi học'}
      onOk={handleSubmit((v) => mutation.mutate(v))}
      okText={isEdit ? 'Lưu thay đổi' : 'Thêm buổi học'}
      cancelText="Huỷ"
      confirmLoading={mutation.isPending}
      width={620}
      destroyOnClose
    >
      <Spin spinning={isFetching}>
        <Form layout="vertical">
          <Row gutter={16}>
            <Col span={24}>
              <FormSelect
                control={control}
                name="classId"
                label="Lớp học"
                placeholder="Chọn lớp"
                required
                options={classOptions}
              />
            </Col>

            <Col span={8}>
              <FormDatePicker control={control} name="sessionDate" label="Ngày học" required />
            </Col>
            <Col span={8}>
              <FormTimePicker control={control} name="startTime" label="Giờ bắt đầu" required />
            </Col>
            <Col span={8}>
              <FormTimePicker control={control} name="endTime" label="Giờ kết thúc" required />
            </Col>

            <Col span={12}>
              <FormInput control={control} name="room" label="Phòng học" placeholder="P.101" />
            </Col>
            <Col span={12}>
              <FormSelect
                control={control}
                name="teacherId"
                label="Giáo viên"
                placeholder="Mặc định theo lớp"
                options={teacherOptions}
                extra="Chọn khi cần giáo viên dạy thay"
              />
            </Col>

            <Col span={12}>
              <FormInput control={control} name="topic" label="Nội dung buổi học" placeholder="Unit 5 — Speaking" />
            </Col>
            <Col span={12}>
              <FormSelect
                control={control}
                name="status"
                label="Trạng thái"
                required
                options={Object.entries(SessionStatusLabel).map(([value, label]) => ({ value, label }))}
              />
            </Col>

            <Col span={24}>
              <FormTextArea control={control} name="note" label="Ghi chú" rows={2} maxLength={500} />
            </Col>
          </Row>
        </Form>
      </Spin>
    </Modal>
  )
}
