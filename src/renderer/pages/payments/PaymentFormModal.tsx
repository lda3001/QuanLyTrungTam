import { useEffect, useState } from 'react'
import { Alert, Col, Form, Modal, Row, Spin, Typography } from 'antd'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  FormDatePicker,
  FormInput,
  FormNumber,
  FormSelect,
  FormTextArea
} from '@/components/form/fields'
import { useDebounce } from '@/hooks/useDebounce'
import { useNotify } from '@/hooks/useNotify'
import { paymentService } from '@/services/admin.service'
import { studentService } from '@/services/academic.service'
import { paymentSchema, type PaymentForm } from '@/utils/schemas'
import { dayjs, formatCurrency, ISO_DATE } from '@/utils/format'
import { PaymentMethod, PaymentMethodLabel, PaymentStatus, PaymentStatusLabel } from '@shared/constants/enums'

interface Props {
  open: boolean
  paymentId: number | null
  /** Mở sẵn với học viên & lớp cho trước (từ màn hình công nợ) */
  presetStudentId?: number
  presetEnrollmentId?: number
  onClose: () => void
}

const EMPTY: PaymentForm = {
  code: '',
  studentId: 0,
  enrollmentId: null,
  amount: 0,
  method: PaymentMethod.CASH,
  status: PaymentStatus.PAID,
  paidDate: dayjs().format(ISO_DATE),
  note: ''
}

/**
 * Lập / sửa phiếu thu.
 *
 * Chọn học viên → hiện các lớp học viên đó đang nợ → chọn lớp thì tự điền
 * đúng số tiền còn thiếu. Đây là thao tác thu ngân làm hàng chục lần mỗi ngày,
 * nên mặc định phải đúng nhất có thể.
 */
export function PaymentFormModal({ open, paymentId, presetStudentId, presetEnrollmentId, onClose }: Props) {
  const notify = useNotify()
  const queryClient = useQueryClient()
  const isEdit = paymentId !== null

  const [studentKeyword, setStudentKeyword] = useState('')
  const debouncedKeyword = useDebounce(studentKeyword, 350)

  const { control, handleSubmit, reset, setValue } = useForm<PaymentForm>({
    resolver: zodResolver(paymentSchema),
    defaultValues: EMPTY
  })

  const studentId = useWatch({ control, name: 'studentId' })
  const enrollmentId = useWatch({ control, name: 'enrollmentId' })

  const { data: studentOptions = [], isFetching: loadingStudents } = useQuery({
    queryKey: ['student-options', debouncedKeyword],
    queryFn: () => studentService.options(debouncedKeyword || undefined),
    enabled: open
  })

  const { data: enrollments = [], isFetching: loadingEnrollments } = useQuery({
    queryKey: ['student-enrollments', studentId],
    queryFn: () => paymentService.studentEnrollments(studentId),
    enabled: open && !!studentId
  })

  const { data: payment, isFetching: loadingPayment } = useQuery({
    queryKey: ['payment', paymentId],
    queryFn: () => paymentService.get(paymentId as number),
    enabled: open && isEdit
  })

  useEffect(() => {
    if (!open) return

    if (isEdit && payment) {
      reset({
        code: payment.code,
        studentId: payment.studentId,
        enrollmentId: payment.enrollmentId,
        amount: payment.amount,
        method: payment.method,
        status: payment.status,
        paidDate: payment.paidDate,
        note: payment.note ?? ''
      })
    } else if (!isEdit) {
      reset({
        ...EMPTY,
        studentId: presetStudentId ?? 0,
        enrollmentId: presetEnrollmentId ?? null,
        paidDate: dayjs().format(ISO_DATE)
      })
    }
  }, [open, isEdit, payment, presetStudentId, presetEnrollmentId, reset])

  const selected = enrollments.find((e) => e.id === enrollmentId)

  /**
   * Khi chọn lớp ở phiếu MỚI, tự điền số tiền còn nợ.
   * Không áp dụng khi sửa phiếu cũ — sẽ ghi đè số tiền người dùng đã nhập.
   */
  useEffect(() => {
    if (isEdit || !selected) return
    setValue('amount', Math.max(0, selected.remainingAmount))
  }, [selected, isEdit, setValue])

  const mutation = useMutation({
    mutationFn: (values: PaymentForm) => {
      const payload = {
        ...values,
        code: values.code?.trim() || undefined,
        note: values.note || null
      }
      return isEdit ? paymentService.update(paymentId, payload) : paymentService.create(payload)
    },
    onSuccess: () => {
      notify.success(isEdit ? 'Đã cập nhật phiếu thu.' : 'Đã lập phiếu thu.')
      void queryClient.invalidateQueries({ queryKey: ['payments'] })
      void queryClient.invalidateQueries({ queryKey: ['debts'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      onClose()
    },
    onError: (err) => notify.error(err)
  })

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={isEdit ? 'Cập nhật phiếu thu' : 'Lập phiếu thu học phí'}
      onOk={handleSubmit((v) => mutation.mutate(v))}
      okText={isEdit ? 'Lưu thay đổi' : 'Lập phiếu thu'}
      cancelText="Huỷ"
      confirmLoading={mutation.isPending}
      width={660}
      destroyOnClose
    >
      <Spin spinning={loadingPayment}>
        <Form layout="vertical">
          <Row gutter={16}>
            <Col span={24}>
              <FormSelect
                control={control}
                name="studentId"
                label="Học viên"
                placeholder="Gõ mã hoặc tên để tìm..."
                required
                options={studentOptions}
                loading={loadingStudents}
                onSearch={setStudentKeyword}
              />
            </Col>

            <Col span={24}>
              <FormSelect
                control={control}
                name="enrollmentId"
                label="Lớp học / khoản thu"
                placeholder={studentId ? 'Chọn lớp cần thu học phí' : 'Chọn học viên trước'}
                disabled={!studentId}
                loading={loadingEnrollments}
                options={enrollments.map((e) => ({
                  value: e.id,
                  label: `${e.className} — còn nợ ${formatCurrency(e.remainingAmount)}`
                }))}
              />
            </Col>

            {selected && (
              <Col span={24}>
                <Alert
                  type={selected.remainingAmount > 0 ? 'warning' : 'success'}
                  showIcon
                  style={{ marginBottom: 16 }}
                  message={
                    <Typography.Text>
                      Học phí: <strong>{formatCurrency(selected.agreedFee - selected.discount)}</strong>
                      {' · '}Đã đóng: <strong>{formatCurrency(selected.paidAmount)}</strong>
                      {' · '}Còn nợ:{' '}
                      <strong style={{ color: selected.remainingAmount > 0 ? '#ff4d4f' : '#52c41a' }}>
                        {formatCurrency(selected.remainingAmount)}
                      </strong>
                    </Typography.Text>
                  }
                />
              </Col>
            )}

            <Col span={12}>
              <FormNumber
                control={control}
                name="amount"
                label="Số tiền thu"
                isCurrency
                step={100_000}
                required
              />
            </Col>
            <Col span={12}>
              <FormDatePicker control={control} name="paidDate" label="Ngày thu" required />
            </Col>

            <Col span={12}>
              <FormSelect
                control={control}
                name="method"
                label="Hình thức thanh toán"
                required
                options={Object.entries(PaymentMethodLabel).map(([value, label]) => ({ value, label }))}
              />
            </Col>
            <Col span={12}>
              <FormSelect
                control={control}
                name="status"
                label="Trạng thái phiếu"
                required
                options={Object.entries(PaymentStatusLabel)
                  // Phiếu thu chỉ ở hai trạng thái này; "chưa đóng"/"một phần"
                  // là trạng thái của công nợ, không phải của phiếu
                  .filter(([value]) => value === 'paid' || value === 'refunded')
                  .map(([value, label]) => ({ value, label }))}
              />
            </Col>

            <Col span={24}>
              <FormInput
                control={control}
                name="code"
                label="Mã phiếu thu"
                placeholder="Tự sinh nếu bỏ trống"
              />
            </Col>

            <Col span={24}>
              <FormTextArea
                control={control}
                name="note"
                label="Ghi chú"
                placeholder="Đóng đợt 1, đóng đủ học phí..."
                rows={2}
                maxLength={500}
              />
            </Col>
          </Row>
        </Form>
      </Spin>
    </Modal>
  )
}
