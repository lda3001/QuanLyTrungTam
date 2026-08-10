import { useEffect } from 'react'
import { Button, Col, Drawer, Flex, Form, Row, Space, Spin } from 'antd'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  FormDatePicker,
  FormInput,
  FormRadioGroup,
  FormSelect,
  FormTextArea
} from '@/components/form/fields'
import { useNotify } from '@/hooks/useNotify'
import { studentService } from '@/services/academic.service'
import { studentSchema, type StudentForm } from '@/utils/schemas'
import { Gender, GenderLabel, StudentStatus, StudentStatusLabel } from '@shared/constants/enums'
import { dayjs } from '@/utils/format'
import type { StudentInput } from '@shared/types/dto'

interface Props {
  open: boolean
  /** null = thêm mới, số = sửa bản ghi có id tương ứng */
  studentId: number | null
  onClose: () => void
}

const EMPTY: StudentForm = {
  code: '',
  fullName: '',
  gender: Gender.MALE,
  birthDate: null,
  email: '',
  phone: '',
  address: '',
  schoolClass: '',
  guardianName: '',
  guardianPhone: '',
  note: '',
  status: StudentStatus.ACTIVE
}

/**
 * Drawer thêm/sửa học viên.
 *
 * Dùng Drawer thay vì Modal cho form nhiều trường: người dùng vẫn thấy bảng
 * phía sau để đối chiếu, và không gian dọc thoải mái hơn hộp thoại.
 */
export function StudentFormDrawer({ open, studentId, onClose }: Props) {
  const notify = useNotify()
  const queryClient = useQueryClient()
  const isEdit = studentId !== null

  const { control, handleSubmit, reset } = useForm<StudentForm>({
    resolver: zodResolver(studentSchema),
    defaultValues: EMPTY
  })

  const { data: student, isFetching } = useQuery({
    queryKey: ['student', studentId],
    queryFn: () => studentService.get(studentId as number),
    enabled: open && isEdit
  })

  // Nạp dữ liệu vào form khi mở ở chế độ sửa; reset sạch khi thêm mới
  useEffect(() => {
    if (!open) return

    if (isEdit && student) {
      reset({
        code: student.code,
        fullName: student.fullName,
        gender: student.gender,
        birthDate: student.birthDate,
        email: student.email ?? '',
        phone: student.phone ?? '',
        address: student.address ?? '',
        schoolClass: student.schoolClass ?? '',
        guardianName: student.guardianName ?? '',
        guardianPhone: student.guardianPhone ?? '',
        note: student.note ?? '',
        status: student.status
      })
    } else if (!isEdit) {
      reset(EMPTY)
    }
  }, [open, isEdit, student, reset])

  const mutation = useMutation({
    mutationFn: (values: StudentForm) => {
      const payload: StudentInput = {
        ...values,
        code: values.code?.trim() || undefined,
        email: values.email || null,
        phone: values.phone || null,
        address: values.address || null,
        schoolClass: values.schoolClass || null,
        guardianName: values.guardianName || null,
        guardianPhone: values.guardianPhone || null,
        note: values.note || null
      }
      return isEdit ? studentService.update(studentId, payload) : studentService.create(payload)
    },
    onSuccess: () => {
      notify.success(isEdit ? 'Đã cập nhật học viên.' : 'Đã thêm học viên mới.')
      // Làm mới danh sách và cả ô chọn học viên ở màn hình khác
      void queryClient.invalidateQueries({ queryKey: ['students'] })
      void queryClient.invalidateQueries({ queryKey: ['student-options'] })
      if (studentId !== null) void queryClient.invalidateQueries({ queryKey: ['student', studentId] })
      onClose()
    },
    onError: (err) => notify.error(err)
  })

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={640}
      title={isEdit ? 'Cập nhật học viên' : 'Thêm học viên mới'}
      destroyOnClose
      maskClosable={!mutation.isPending}
      footer={
        <Flex justify="flex-end">
          <Space>
            <Button onClick={onClose}>Huỷ</Button>
            <Button
              type="primary"
              loading={mutation.isPending}
              onClick={handleSubmit((v) => mutation.mutate(v))}
            >
              {isEdit ? 'Lưu thay đổi' : 'Thêm học viên'}
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
                label="Mã học viên"
                placeholder="Để trống để hệ thống tự sinh"
                extra={isEdit ? undefined : 'Bỏ trống sẽ tự sinh theo tiền tố cấu hình'}
                maxLength={20}
              />
            </Col>
            <Col span={12}>
              <FormSelect
                control={control}
                name="status"
                label="Trạng thái"
                required
                options={Object.entries(StudentStatusLabel).map(([value, label]) => ({ value, label }))}
              />
            </Col>

            <Col span={24}>
              <FormInput
                control={control}
                name="fullName"
                label="Họ và tên"
                placeholder="Nguyễn Văn A"
                required
                maxLength={100}
              />
            </Col>

            <Col span={12}>
              <FormRadioGroup
                control={control}
                name="gender"
                label="Giới tính"
                required
                optionType="button"
                options={Object.entries(GenderLabel).map(([value, label]) => ({ value, label }))}
              />
            </Col>
            <Col span={12}>
              <FormDatePicker
                control={control}
                name="birthDate"
                label="Ngày sinh"
                // Không cho chọn ngày trong tương lai
                disabledDate={(current) => current && current > dayjs().endOf('day')}
              />
            </Col>

            <Col span={12}>
              <FormInput control={control} name="phone" label="Điện thoại" placeholder="0912345678" />
            </Col>
            <Col span={12}>
              <FormInput control={control} name="email" label="Email" placeholder="hocvien@email.com" />
            </Col>

            <Col span={16}>
              <FormInput control={control} name="address" label="Địa chỉ" placeholder="Số nhà, đường, quận/huyện" />
            </Col>
            <Col span={8}>
              <FormInput
                control={control}
                name="schoolClass"
                label="Lớp (ở trường)"
                placeholder="10A1"
                extra="Lớp tại trường phổ thông, không phải lớp ở trung tâm"
                maxLength={50}
              />
            </Col>

            <Col span={12}>
              <FormInput
                control={control}
                name="guardianName"
                label="Người giám hộ"
                placeholder="Họ tên phụ huynh"
              />
            </Col>
            <Col span={12}>
              <FormInput control={control} name="guardianPhone" label="SĐT giám hộ" placeholder="0987654321" />
            </Col>

            <Col span={24}>
              <FormTextArea
                control={control}
                name="note"
                label="Ghi chú"
                placeholder="Thông tin thêm về học viên..."
                rows={3}
                maxLength={500}
              />
            </Col>
          </Row>
        </Form>
      </Spin>
    </Drawer>
  )
}
