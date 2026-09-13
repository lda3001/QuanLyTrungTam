import { MuiSelect as Select } from '@/components/common/MuiControls'
import { useEffect } from 'react'
import { MuiTimePicker as TimePicker } from '@/components/common/MuiControls'
import {
  Alert,
  Button,
  Card,
  Col,
  Drawer,
  Flex,
  Form,
  Input,
  Row,
  Space,
  Spin,
  Typography
} from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  FormDatePicker,
  FormInput,
  FormNumber,
  FormSelect,
  FormTextArea
} from '@/components/form/fields'
import { useNotify } from '@/hooks/useNotify'
import { classService, courseService, teacherService } from '@/services/academic.service'
import { classSchema, type ClassForm } from '@/utils/schemas'
import { dayjs } from '@/utils/format'
import { ClassStatus, ClassStatusLabel, WeekdayLabel } from '@shared/constants/enums'
import type { ClassInput } from '@shared/types/dto'

interface Props {
  open: boolean
  classId: number | null
  onClose: () => void
}

const EMPTY: ClassForm = {
  code: '',
  name: '',
  courseId: 0,
  teacherId: null,
  room: '',
  startDate: null,
  endDate: null,
  maxStudents: 25,
  academicYear: '',
  status: ClassStatus.PLANNED,
  note: '',
  schedules: [{ weekday: 2, startTime: '18:00', endTime: '20:00', room: '' }]
}

/**
 * Form lớp học — phần khó nhất là danh sách khung giờ hằng tuần.
 *
 * Dùng `useFieldArray` của React Hook Form: mỗi dòng là một khung giờ, thêm/xoá
 * tuỳ ý, và validate từng dòng độc lập (giờ kết thúc phải sau giờ bắt đầu).
 * Khung giờ này chính là công thức để sinh ra các buổi học trên lịch.
 */
export function ClassFormDrawer({ open, classId, onClose }: Props) {
  const notify = useNotify()
  const queryClient = useQueryClient()
  const isEdit = classId !== null

  const { control, handleSubmit, reset, formState } = useForm<ClassForm>({
    resolver: zodResolver(classSchema),
    defaultValues: EMPTY
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'schedules' })

  const { data: courseOptions = [] } = useQuery({
    queryKey: ['course-options'],
    queryFn: () => courseService.options(),
    enabled: open,
    staleTime: 5 * 60_000
  })

  const { data: teacherOptions = [] } = useQuery({
    queryKey: ['teacher-options'],
    queryFn: () => teacherService.options(),
    enabled: open,
    staleTime: 5 * 60_000
  })

  const { data: classroom, isFetching } = useQuery({
    queryKey: ['class', classId],
    queryFn: () => classService.get(classId as number),
    enabled: open && isEdit
  })

  useEffect(() => {
    if (!open) return
    if (isEdit && classroom) {
      reset({
        code: classroom.code,
        name: classroom.name,
        courseId: classroom.courseId,
        teacherId: classroom.teacherId,
        room: classroom.room ?? '',
        startDate: classroom.startDate,
        endDate: classroom.endDate,
        maxStudents: classroom.maxStudents,
        academicYear: classroom.academicYear ?? '',
        status: classroom.status,
        note: classroom.note ?? '',
        schedules: classroom.schedules.map((s) => ({
          weekday: s.weekday,
          startTime: s.startTime,
          endTime: s.endTime,
          room: s.room ?? ''
        }))
      })
    } else if (!isEdit) {
      reset(EMPTY)
    }
  }, [open, isEdit, classroom, reset])

  const mutation = useMutation({
    mutationFn: (values: ClassForm) => {
      const payload: ClassInput = {
        ...values,
        code: values.code?.trim() || undefined,
        room: values.room || null,
        note: values.note || null,
        schedules: values.schedules.map((s) => ({ ...s, room: s.room || null }))
      }
      return isEdit ? classService.update(classId, payload) : classService.create(payload)
    },
    onSuccess: () => {
      notify.success(isEdit ? 'Đã cập nhật lớp học.' : 'Đã tạo lớp học mới.')
      void queryClient.invalidateQueries({ queryKey: ['classes'] })
      void queryClient.invalidateQueries({ queryKey: ['class-options'] })
      if (classId !== null) void queryClient.invalidateQueries({ queryKey: ['class', classId] })
      onClose()
    },
    onError: (err) => notify.error(err)
  })

  const scheduleError = formState.errors.schedules?.message

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={720}
      title={isEdit ? 'Cập nhật lớp học' : 'Tạo lớp học mới'}
      destroyOnClose
      footer={
        <Flex justify="flex-end">
          <Space>
            <Button onClick={onClose}>Huỷ</Button>
            <Button
              type="primary"
              loading={mutation.isPending}
              onClick={handleSubmit((v) => mutation.mutate(v))}
            >
              {isEdit ? 'Lưu thay đổi' : 'Tạo lớp'}
            </Button>
          </Space>
        </Flex>
      }
    >
      <Spin spinning={isFetching}>
        <Form layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <FormInput
                control={control}
                name="code"
                label="Mã lớp"
                placeholder="Tự sinh nếu bỏ trống"
              />
            </Col>
            <Col span={12}>
              <FormSelect
                control={control}
                name="status"
                label="Trạng thái"
                required
                options={Object.entries(ClassStatusLabel).map(([value, label]) => ({
                  value,
                  label
                }))}
              />
            </Col>

            <Col span={24}>
              <FormInput
                control={control}
                name="name"
                label="Tên lớp"
                placeholder="Tiếng Anh Giao Tiếp - K1"
                required
              />
            </Col>

            <Col span={12}>
              <FormSelect
                control={control}
                name="courseId"
                label="Khoá học"
                placeholder="Chọn khoá học"
                required
                options={courseOptions}
                extra="Khi tạo lớp, học phí hiện tại của khóa học sẽ được chốt riêng cho lớp"
              />
            </Col>
            <Col span={12}>
              <FormSelect
                control={control}
                name="teacherId"
                label="Giáo viên phụ trách"
                placeholder="Chọn giáo viên"
                options={teacherOptions}
              />
            </Col>

            <Col span={8}>
              <FormInput control={control} name="room" label="Phòng học" placeholder="P.101" />
            </Col>
            <Col span={8}>
              <FormDatePicker control={control} name="startDate" label="Ngày khai giảng" />
            </Col>
            <Col span={8}>
              <FormDatePicker control={control} name="endDate" label="Ngày kết thúc" />
            </Col>

            <Col span={12}>
              <FormNumber
                control={control}
                name="maxStudents"
                label="Sĩ số tối đa"
                min={1}
                addonAfter="học viên"
              />
            </Col>
            <Col span={12}>
              <FormInput
                control={control}
                name="academicYear"
                label="Năm học"
                placeholder="2026–2027"
              />
            </Col>
          </Row>

          {/* ---------------- Khung giờ hằng tuần ---------------- */}
          <Card
            size="small"
            title="Lịch học hằng tuần"
            style={{ marginTop: 8, marginBottom: 16 }}
            extra={
              <Button
                type="dashed"
                size="small"
                icon={<PlusOutlined />}
                onClick={() =>
                  append({ weekday: 2, startTime: '18:00', endTime: '20:00', room: '' })
                }
              >
                Thêm buổi
              </Button>
            }
          >
            <Alert
              type="info"
              showIcon
              message="Khung giờ này dùng để sinh tự động các buổi học trên lịch."
              style={{ marginBottom: 12 }}
            />

            {scheduleError && (
              <Alert
                type="error"
                showIcon
                message={String(scheduleError)}
                style={{ marginBottom: 12 }}
              />
            )}

            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              {fields.map((field, index) => (
                <Row gutter={8} key={field.id} align="middle">
                  <Col span={7}>
                    <Controller
                      control={control}
                      name={`schedules.${index}.weekday`}
                      render={({ field: f }) => (
                        <Select
                          {...f}
                          style={{ width: '100%' }}
                          options={[1, 2, 3, 4, 5, 6, 0].map((d) => ({
                            value: d,
                            label: WeekdayLabel[d]
                          }))}
                        />
                      )}
                    />
                  </Col>

                  <Col span={6}>
                    <Controller
                      control={control}
                      name={`schedules.${index}.startTime`}
                      render={({ field: f, fieldState }) => (
                        <TimePicker
                          style={{ width: '100%' }}
                          format="HH:mm"
                          minuteStep={5}
                          needConfirm={false}
                          status={fieldState.error ? 'error' : undefined}
                          value={f.value ? dayjs(f.value, 'HH:mm') : null}
                          onChange={(d) => f.onChange(d ? d.format('HH:mm') : '')}
                        />
                      )}
                    />
                  </Col>

                  <Col span={6}>
                    <Controller
                      control={control}
                      name={`schedules.${index}.endTime`}
                      render={({ field: f, fieldState }) => (
                        <TimePicker
                          style={{ width: '100%' }}
                          format="HH:mm"
                          minuteStep={5}
                          needConfirm={false}
                          status={fieldState.error ? 'error' : undefined}
                          value={f.value ? dayjs(f.value, 'HH:mm') : null}
                          onChange={(d) => f.onChange(d ? d.format('HH:mm') : '')}
                        />
                      )}
                    />
                  </Col>

                  <Col span={5}>
                    <Flex gap={4}>
                      <Controller
                        control={control}
                        name={`schedules.${index}.room`}
                        render={({ field: f }) => (
                          <Input
                            {...f}
                            value={(f.value as string) ?? ''}
                            placeholder="Phòng"
                            style={{ flex: 1, minWidth: 0 }}
                          />
                        )}
                      />
                      <Button
                        danger
                        type="text"
                        icon={<DeleteOutlined />}
                        // Luôn phải còn ít nhất một khung giờ
                        disabled={fields.length <= 1}
                        onClick={() => remove(index)}
                      />
                    </Flex>
                  </Col>

                  {/* Thông báo lỗi của riêng dòng này */}
                  {formState.errors.schedules?.[index]?.endTime && (
                    <Col span={24}>
                      <Typography.Text type="danger" style={{ fontSize: 12 }}>
                        {formState.errors.schedules[index]?.endTime?.message}
                      </Typography.Text>
                    </Col>
                  )}
                </Row>
              ))}
            </Space>
          </Card>

          <FormTextArea control={control} name="note" label="Ghi chú" rows={3} maxLength={500} />
        </Form>
      </Spin>
    </Drawer>
  )
}
