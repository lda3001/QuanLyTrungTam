import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
  Timeline,
  Typography,
  message
} from 'antd'
import { HistoryOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { paymentService } from '@/services/admin.service'
import { formatCurrency, formatDateTime } from '@/utils/format'
import type { DebtRow, TuitionAdjustmentInput, TuitionFeeType } from '@shared/types/dto'

type FormValues = {
  feeType: TuitionFeeType
  customFee?: number | null
  discount: number
  surcharge: number
  payableOverride?: number | null
  reason?: string
}

const feeTypeOptions = [
  { value: 'default', label: 'Học phí mặc định của lớp' },
  { value: 'monthly', label: 'Mức học phí theo tháng' },
  { value: 'per_session', label: 'Đơn giá mỗi buổi' },
  { value: 'fixed', label: 'Mức học phí cố định' }
]

export function TuitionAdjustmentModal({
  open,
  row,
  onClose
}: {
  open: boolean
  row: DebtRow | null
  onClose: () => void
}) {
  const [form] = Form.useForm<FormValues>()
  const queryClient = useQueryClient()
  const [overrideEnabled, setOverrideEnabled] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const feeType = Form.useWatch('feeType', form) ?? 'default'
  const customFee = Form.useWatch('customFee', form) ?? 0
  const discount = Form.useWatch('discount', form) ?? 0
  const surcharge = Form.useWatch('surcharge', form) ?? 0
  const override = Form.useWatch('payableOverride', form) ?? 0

  useEffect(() => {
    if (!open || !row) return
    const hasOverride = row.payableOverride != null
    setOverrideEnabled(hasOverride)
    setShowHistory(false)
    form.setFieldsValue({
      feeType: row.feeType,
      customFee: row.customFee,
      discount: row.discount,
      surcharge: row.surcharge,
      payableOverride: row.payableOverride,
      reason: ''
    })
  }, [form, open, row])

  const historyQuery = useQuery({
    queryKey: ['tuition-history', row?.enrollmentId],
    queryFn: () => paymentService.tuitionHistory(row!.enrollmentId),
    enabled: open && !!row && showHistory
  })

  const preview = useMemo(() => {
    if (!row) return 0
    let base = row.calculatedFee
    if (feeType === 'monthly') base = customFee * row.billableMonthCount
    if (feeType === 'per_session') base = customFee * row.eligibleSessionCount
    if (feeType === 'fixed') base = customFee
    return overrideEnabled ? Math.max(0, override) : Math.max(0, base + surcharge - discount)
  }, [customFee, discount, feeType, override, overrideEnabled, row, surcharge])

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      if (!row) return Promise.resolve(false)
      const input: TuitionAdjustmentInput = {
        feeType: values.feeType,
        customFee: values.feeType === 'default' ? null : values.customFee,
        discount: values.discount ?? 0,
        surcharge: values.surcharge ?? 0,
        payableOverride: overrideEnabled ? (values.payableOverride ?? 0) : null,
        reason: values.reason?.trim() || null
      }
      return paymentService.adjustTuition(row.enrollmentId, input)
    },
    onSuccess: async () => {
      message.success('Đã cập nhật và tính lại học phí.')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['debts'] }),
        queryClient.invalidateQueries({ queryKey: ['student-enrollments'] }),
        queryClient.invalidateQueries({ queryKey: ['class-students'] }),
        queryClient.invalidateQueries({ queryKey: ['tuition-history', row?.enrollmentId] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      ])
      onClose()
    }
  })

  const unitLabel =
    feeType === 'monthly'
      ? 'Học phí mỗi tháng'
      : feeType === 'per_session'
        ? 'Đơn giá mỗi buổi'
        : 'Mức học phí cố định'

  return (
    <Modal
      open={open}
      title="Điều chỉnh học phí học viên"
      width={720}
      onCancel={onClose}
      destroyOnHidden
      footer={[
        <Button key="cancel" onClick={onClose}>
          Hủy
        </Button>,
        <Button
          key="save"
          type="primary"
          loading={mutation.isPending}
          onClick={() => form.submit()}
        >
          Lưu điều chỉnh
        </Button>
      ]}
    >
      {row && (
        <>
          <Alert
            type="info"
            showIcon
            message={`${row.studentName} · ${row.className}`}
            description={`Ngày tham gia được giữ nguyên. Hệ thống chỉ tính ${row.eligibleSessionCount}/${row.totalSessionCount} buổi kể từ ngày đăng ký, thuộc ${row.billableMonthCount} tháng học.`}
            style={{ marginBottom: 16 }}
          />

          <Form<FormValues>
            form={form}
            layout="vertical"
            onFinish={(values) => mutation.mutate(values)}
          >
            <Form.Item name="feeType" label="Cách tính học phí" rules={[{ required: true }]}>
              <Select options={feeTypeOptions} />
            </Form.Item>

            {feeType !== 'default' && (
              <Form.Item
                name="customFee"
                label={unitLabel}
                rules={[{ required: true, message: 'Vui lòng nhập mức học phí.' }]}
              >
                <InputNumber
                  min={0}
                  precision={0}
                  step={100000}
                  addonAfter="₫"
                  style={{ width: '100%' }}
                />
              </Form.Item>
            )}

            <Space size={16} style={{ width: '100%' }} align="start">
              <Form.Item name="discount" label="Giảm giá / ưu đãi" style={{ flex: 1 }}>
                <InputNumber
                  min={0}
                  precision={0}
                  step={50000}
                  addonAfter="₫"
                  style={{ width: '100%' }}
                />
              </Form.Item>
              <Form.Item name="surcharge" label="Phụ thu" style={{ flex: 1 }}>
                <InputNumber
                  min={0}
                  precision={0}
                  step={50000}
                  addonAfter="₫"
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Space>

            <div style={{ marginBottom: 16 }}>
              <Space>
                <Switch checked={overrideEnabled} onChange={setOverrideEnabled} />
                <Typography.Text strong>Nhập trực tiếp “Học phí cần thanh toán”</Typography.Text>
              </Space>
              <Typography.Paragraph type="secondary" style={{ margin: '4px 0 0 44px' }}>
                Khi bật, số tiền này có ưu tiên cao nhất và không tự thay đổi theo công thức.
              </Typography.Paragraph>
            </div>

            {overrideEnabled && (
              <Form.Item
                name="payableOverride"
                label="Học phí cần thanh toán"
                rules={[{ required: true }]}
              >
                <InputNumber
                  min={0}
                  precision={0}
                  step={100000}
                  addonAfter="₫"
                  style={{ width: '100%' }}
                />
              </Form.Item>
            )}

            <Form.Item name="reason" label="Lý do điều chỉnh">
              <Input.TextArea
                rows={2}
                maxLength={500}
                showCount
                placeholder="Ví dụ: ưu đãi học viên cũ, học bù, phụ thu tài liệu..."
              />
            </Form.Item>

            <Alert
              type={overrideEnabled ? 'warning' : 'success'}
              showIcon
              message={
                <>
                  Học phí sau điều chỉnh: <strong>{formatCurrency(preview)}</strong>
                </>
              }
              description={`Ban đầu: ${formatCurrency(row.agreedFee)} · Hiện tại: ${formatCurrency(row.payable)}`}
            />
          </Form>

          <Divider />
          <Button
            type="link"
            icon={<HistoryOutlined />}
            style={{ paddingLeft: 0 }}
            onClick={() => setShowHistory((v) => !v)}
          >
            {showHistory ? 'Ẩn lịch sử điều chỉnh' : 'Xem lịch sử điều chỉnh'}
          </Button>
          {showHistory &&
            (historyQuery.data?.length ? (
              <Timeline
                style={{ marginTop: 16 }}
                items={historyQuery.data.map((item) => ({
                  children: (
                    <div>
                      <Typography.Text strong>
                        {formatCurrency(item.originalPayable)} →{' '}
                        {formatCurrency(item.adjustedPayable)}
                      </Typography.Text>
                      <div>
                        <Typography.Text type="secondary">
                          {item.adjustedByName ?? 'Tài khoản hệ thống'} ·{' '}
                          {formatDateTime(item.createdAt)}
                        </Typography.Text>
                      </div>
                      {item.reason && <div>Lý do: {item.reason}</div>}
                    </div>
                  )
                }))}
              />
            ) : (
              <Typography.Text type="secondary">
                {historyQuery.isLoading ? 'Đang tải...' : 'Chưa có lần điều chỉnh nào.'}
              </Typography.Text>
            ))}
        </>
      )}
    </Modal>
  )
}
