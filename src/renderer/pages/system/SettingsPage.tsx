import { useEffect } from 'react'
import { Alert, Button, Card, Col, Descriptions, Divider, Form, Row, Segmented, Space, Typography } from 'antd'
import { BgColorsOutlined, SaveOutlined, SettingOutlined } from '@ant-design/icons'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/common/PageHeader'
import { FormInput } from '@/components/form/fields'
import { useNotify } from '@/hooks/useNotify'
import { usePermission } from '@/hooks/usePermission'
import { useUiStore } from '@/store/ui.store'
import { appService, settingService } from '@/services/admin.service'
import { settingSchema, type SettingForm } from '@/utils/schemas'
import { PERMISSIONS } from '@shared/constants/permissions'

const PRESET_COLORS = [
  { label: 'Xanh dương', value: '#1677ff' },
  { label: 'Xanh lá', value: '#52c41a' },
  { label: 'Tím', value: '#722ed1' },
  { label: 'Cam', value: '#fa8c16' },
  { label: 'Hồng', value: '#eb2f96' }
]

/**
 * Cấu hình hệ thống.
 *
 * Hai nhóm tách bạch:
 *  - Thông tin trung tâm & tiền tố mã: lưu vào database, dùng chung mọi máy.
 *  - Giao diện: lưu localStorage, riêng từng máy — người này thích Dark Mode
 *    không có nghĩa người kia cũng vậy.
 */
export default function SettingsPage() {
  const notify = useNotify()
  const queryClient = useQueryClient()
  const { can } = usePermission()

  const themeMode = useUiStore((s) => s.themeMode)
  const setThemeMode = useUiStore((s) => s.setThemeMode)
  const primaryColor = useUiStore((s) => s.primaryColor)
  const setPrimaryColor = useUiStore((s) => s.setPrimaryColor)
  const compact = useUiStore((s) => s.compact)
  const toggleCompact = useUiStore((s) => s.toggleCompact)

  const canEdit = can(PERMISSIONS.SETTING_UPDATE)

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingService.getAll()
  })

  const { data: appInfo } = useQuery({
    queryKey: ['app-info'],
    queryFn: () => appService.info(),
    staleTime: Infinity
  })

  const { control, handleSubmit, reset } = useForm<SettingForm>({
    resolver: zodResolver(settingSchema),
    defaultValues: {
      centerName: '',
      centerAddress: '',
      centerPhone: '',
      centerEmail: '',
      centerTaxCode: '',
      receiptPrefix: 'PT',
      studentPrefix: 'HV',
      teacherPrefix: 'GV'
    }
  })

  useEffect(() => {
    if (!settings) return
    const map = new Map(settings.map((s) => [s.key, s.value]))
    reset({
      centerName: map.get('centerName') ?? '',
      centerAddress: map.get('centerAddress') ?? '',
      centerPhone: map.get('centerPhone') ?? '',
      centerEmail: map.get('centerEmail') ?? '',
      centerTaxCode: map.get('centerTaxCode') ?? '',
      receiptPrefix: map.get('receiptPrefix') ?? 'PT',
      studentPrefix: map.get('studentPrefix') ?? 'HV',
      teacherPrefix: map.get('teacherPrefix') ?? 'GV'
    })
  }, [settings, reset])

  const mutation = useMutation({
    mutationFn: (values: SettingForm) =>
      settingService.update(values as unknown as Record<string, string>),
    onSuccess: () => {
      notify.success('Đã lưu cấu hình.')
      void queryClient.invalidateQueries({ queryKey: ['settings'] })
    },
    onError: (err) => notify.error(err)
  })

  return (
    <>
      <PageHeader
        title="Cấu hình hệ thống"
        subtitle="Thông tin trung tâm, quy tắc sinh mã và tuỳ chọn giao diện"
        breadcrumbs={[{ title: 'Hệ thống' }, { title: 'Cấu hình' }]}
        icon={<SettingOutlined style={{ fontSize: 26, color: '#8c8c8c' }} />}
        extra={
          canEdit && (
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={mutation.isPending}
              onClick={handleSubmit((v) => mutation.mutate(v))}
            >
              Lưu cấu hình
            </Button>
          )
        }
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Card title="Thông tin trung tâm" loading={isLoading}>
            <Alert
              type="info"
              showIcon
              message="Thông tin này được in trên phiếu thu và các báo cáo xuất ra."
              style={{ marginBottom: 16 }}
            />

            <Form layout="vertical" disabled={!canEdit}>
              <Row gutter={16}>
                <Col span={24}>
                  <FormInput
                    control={control}
                    name="centerName"
                    label="Tên trung tâm"
                    placeholder="Trung Tâm Đào Tạo ABC"
                    required
                    disabled={!canEdit}
                  />
                </Col>
                <Col span={24}>
                  <FormInput
                    control={control}
                    name="centerAddress"
                    label="Địa chỉ"
                    placeholder="123 Nguyễn Trãi, Thanh Xuân, Hà Nội"
                    disabled={!canEdit}
                  />
                </Col>
                <Col span={12}>
                  <FormInput
                    control={control}
                    name="centerPhone"
                    label="Điện thoại"
                    placeholder="024 1234 5678"
                    disabled={!canEdit}
                  />
                </Col>
                <Col span={12}>
                  <FormInput
                    control={control}
                    name="centerEmail"
                    label="Email"
                    placeholder="lienhe@trungtam.vn"
                    disabled={!canEdit}
                  />
                </Col>
                <Col span={12}>
                  <FormInput
                    control={control}
                    name="centerTaxCode"
                    label="Mã số thuế"
                    placeholder="0101234567"
                    disabled={!canEdit}
                  />
                </Col>
              </Row>

              <Divider orientation="left" orientationMargin={0}>
                <Typography.Text type="secondary">Quy tắc sinh mã tự động</Typography.Text>
              </Divider>

              <Alert
                type="warning"
                showIcon
                message="Đổi tiền tố chỉ ảnh hưởng tới bản ghi tạo MỚI. Mã cũ giữ nguyên để không phá vỡ sổ sách."
                style={{ marginBottom: 16 }}
              />

              <Row gutter={16}>
                <Col span={8}>
                  <FormInput
                    control={control}
                    name="studentPrefix"
                    label="Tiền tố học viên"
                    placeholder="HV"
                    extra="Ví dụ: HV0001"
                    disabled={!canEdit}
                  />
                </Col>
                <Col span={8}>
                  <FormInput
                    control={control}
                    name="teacherPrefix"
                    label="Tiền tố giáo viên"
                    placeholder="GV"
                    extra="Ví dụ: GV0001"
                    disabled={!canEdit}
                  />
                </Col>
                <Col span={8}>
                  <FormInput
                    control={control}
                    name="receiptPrefix"
                    label="Tiền tố phiếu thu"
                    placeholder="PT"
                    extra="Ví dụ: PT2026070001"
                    disabled={!canEdit}
                  />
                </Col>
              </Row>
            </Form>
          </Card>
        </Col>

        <Col xs={24} xl={10}>
          <Card
            title={
              <Space>
                <BgColorsOutlined />
                Giao diện
              </Space>
            }
          >
            <Alert
              type="info"
              showIcon
              message="Tuỳ chọn giao diện được lưu riêng trên máy này."
              style={{ marginBottom: 16 }}
            />

            <Space direction="vertical" size={20} style={{ width: '100%' }}>
              <div>
                <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
                  Chế độ hiển thị
                </Typography.Text>
                <Segmented
                  block
                  value={themeMode}
                  onChange={(v) => setThemeMode(v as 'light' | 'dark')}
                  options={[
                    { label: 'Sáng', value: 'light' },
                    { label: 'Tối', value: 'dark' }
                  ]}
                />
              </div>

              <div>
                <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
                  Màu chủ đạo
                </Typography.Text>
                <Space wrap>
                  {PRESET_COLORS.map((c) => (
                    <div
                      key={c.value}
                      onClick={() => setPrimaryColor(c.value)}
                      title={c.label}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: c.value,
                        cursor: 'pointer',
                        // Viền dày báo hiệu màu đang được chọn
                        outline: primaryColor === c.value ? '3px solid rgba(0,0,0,0.25)' : 'none',
                        outlineOffset: 2,
                        transition: 'transform 0.15s ease'
                      }}
                    />
                  ))}
                </Space>
              </div>

              <div>
                <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
                  Mật độ hiển thị
                </Typography.Text>
                <Segmented
                  block
                  value={compact ? 'compact' : 'default'}
                  onChange={() => toggleCompact()}
                  options={[
                    { label: 'Thoáng', value: 'default' },
                    { label: 'Gọn', value: 'compact' }
                  ]}
                />
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Chế độ gọn hiển thị được nhiều dòng hơn trên màn hình nhỏ.
                </Typography.Text>
              </div>
            </Space>
          </Card>

          <Card title="Thông tin ứng dụng" style={{ marginTop: 16 }}>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Phiên bản">{appInfo?.version ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Nền tảng">{appInfo?.platform ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Tệp dữ liệu">
                <Typography.Text copyable style={{ fontSize: 12, wordBreak: 'break-all' }}>
                  {appInfo?.dbPath ?? '—'}
                </Typography.Text>
              </Descriptions.Item>
            </Descriptions>

            <Alert
              type="warning"
              showIcon
              style={{ marginTop: 12 }}
              message="Sao lưu dữ liệu"
              description="Toàn bộ dữ liệu nằm trong tệp trên. Hãy sao chép tệp này định kỳ sang ổ đĩa khác để phòng hỏng máy."
            />
          </Card>
        </Col>
      </Row>
    </>
  )
}
