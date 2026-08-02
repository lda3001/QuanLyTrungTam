import { MuiDatePickerApi as DatePicker, MuiSelect as Select, MuiTimePicker as TimePicker } from '@/components/common/MuiControls'
import type { ReactNode } from 'react'
import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form'
import { Form, Input, InputNumber, Radio, Switch } from 'antd'
import type { SelectProps } from 'antd'
import { dayjs, ISO_DATE, DATE_FORMAT } from '@/utils/format'

/* ------------------------------------------------------------------ *
 * Cầu nối React Hook Form ↔ Ant Design.
 *
 * Ant Design có <Form> riêng, nhưng dùng song song hai hệ quản lý form là
 * nguồn gốc của lỗi khó chịu. Ở đây chỉ dùng <Form.Item> như phần TRÌNH BÀY
 * (nhãn, thông báo lỗi, dấu bắt buộc), còn giá trị và validate hoàn toàn do
 * React Hook Form + Zod nắm giữ.
 * ------------------------------------------------------------------ */

interface BaseProps<T extends FieldValues> {
  control: Control<T>
  name: FieldPath<T>
  label?: ReactNode
  placeholder?: string
  required?: boolean
  disabled?: boolean
  extra?: ReactNode
  /** Số cột trong Form layout dạng lưới (mặc định chiếm trọn) */
  span?: number
}

function Field({
  label,
  required,
  error,
  extra,
  children
}: {
  label?: ReactNode
  required?: boolean
  error?: string
  extra?: ReactNode
  children: ReactNode
}) {
  return (
    <Form.Item
      label={label}
      required={required}
      validateStatus={error ? 'error' : undefined}
      help={error || extra}
      style={{ marginBottom: 16 }}
    >
      {children}
    </Form.Item>
  )
}

export function FormInput<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  required,
  disabled,
  extra,
  maxLength
}: BaseProps<T> & { maxLength?: number }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field label={label} required={required} error={fieldState.error?.message} extra={extra}>
          <Input
            {...field}
            value={(field.value as string) ?? ''}
            placeholder={placeholder}
            disabled={disabled}
            maxLength={maxLength}
            allowClear
          />
        </Field>
      )}
    />
  )
}

export function FormPassword<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  required,
  disabled,
  extra
}: BaseProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field label={label} required={required} error={fieldState.error?.message} extra={extra}>
          <Input.Password
            {...field}
            value={(field.value as string) ?? ''}
            placeholder={placeholder}
            disabled={disabled}
            autoComplete="new-password"
          />
        </Field>
      )}
    />
  )
}

export function FormTextArea<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  required,
  disabled,
  rows = 3,
  maxLength
}: BaseProps<T> & { rows?: number; maxLength?: number }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field label={label} required={required} error={fieldState.error?.message}>
          <Input.TextArea
            {...field}
            value={(field.value as string) ?? ''}
            placeholder={placeholder}
            disabled={disabled}
            rows={rows}
            maxLength={maxLength}
            showCount={!!maxLength}
          />
        </Field>
      )}
    />
  )
}

/**
 * Ô nhập số tiền. Hiển thị có dấu phân cách hàng nghìn nhưng giá trị lưu
 * trong form vẫn là number thuần — nơi khác không phải tự bóc chuỗi.
 */
export function FormNumber<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  required,
  disabled,
  min = 0,
  max,
  step = 1,
  addonAfter,
  isCurrency
}: BaseProps<T> & {
  min?: number
  max?: number
  step?: number
  addonAfter?: ReactNode
  isCurrency?: boolean
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field label={label} required={required} error={fieldState.error?.message}>
          <InputNumber
            style={{ width: '100%' }}
            value={field.value as number}
            onChange={(v) => field.onChange(v ?? 0)}
            onBlur={field.onBlur}
            placeholder={placeholder}
            disabled={disabled}
            min={min}
            max={max}
            step={step}
            addonAfter={addonAfter ?? (isCurrency ? '₫' : undefined)}
            formatter={
              isCurrency ? (value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : undefined
            }
            parser={isCurrency ? ((value) => Number(`${value}`.replace(/\./g, '')) as never) : undefined}
          />
        </Field>
      )}
    />
  )
}

export function FormSelect<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  required,
  disabled,
  options,
  allowClear = true,
  mode,
  onSearch,
  loading
}: BaseProps<T> & {
  options: { label: ReactNode; value: string | number }[]
  allowClear?: boolean
  mode?: 'multiple' | 'tags'
  onSearch?: SelectProps['onSearch']
  loading?: boolean
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field label={label} required={required} error={fieldState.error?.message}>
          <Select
            value={field.value ?? undefined}
            onChange={(v) => field.onChange(v ?? null)}
            onBlur={field.onBlur}
            placeholder={placeholder}
            disabled={disabled}
            options={options}
            allowClear={allowClear}
            mode={mode}
            loading={loading}
            onSearch={onSearch}
            // Tìm không phân biệt hoa thường; nếu có onSearch thì để server lọc
            showSearch={!!onSearch || options.length > 8}
            filterOption={
              onSearch
                ? false
                : (input, option) => String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            style={{ width: '100%' }}
          />
        </Field>
      )}
    />
  )
}

/**
 * Chọn ngày. Form lưu chuỗi 'YYYY-MM-DD' còn AntD dùng đối tượng Dayjs —
 * chuyển đổi tập trung ở đây để không rải `dayjs()` khắp các màn hình.
 */
export function FormDatePicker<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  required,
  disabled,
  disabledDate
}: BaseProps<T> & { disabledDate?: (current: ReturnType<typeof dayjs>) => boolean }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field label={label} required={required} error={fieldState.error?.message}>
          <DatePicker
            style={{ width: '100%' }}
            value={field.value ? dayjs(field.value as string, ISO_DATE) : null}
            onChange={(d) => field.onChange(d ? d.format(ISO_DATE) : null)}
            onBlur={field.onBlur}
            placeholder={placeholder ?? 'Chọn ngày'}
            disabled={disabled}
            format={DATE_FORMAT}
            disabledDate={disabledDate}
          />
        </Field>
      )}
    />
  )
}

export function FormTimePicker<T extends FieldValues>({
  control,
  name,
  label,
  required,
  disabled,
  minuteStep = 5
}: BaseProps<T> & { minuteStep?: 5 | 10 | 15 | 30 }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field label={label} required={required} error={fieldState.error?.message}>
          <TimePicker
            style={{ width: '100%' }}
            value={field.value ? dayjs(field.value as string, 'HH:mm') : null}
            onChange={(d) => field.onChange(d ? d.format('HH:mm') : null)}
            onBlur={field.onBlur}
            format="HH:mm"
            minuteStep={minuteStep}
            disabled={disabled}
            needConfirm={false}
          />
        </Field>
      )}
    />
  )
}

export function FormRadioGroup<T extends FieldValues>({
  control,
  name,
  label,
  required,
  disabled,
  options,
  optionType = 'default'
}: BaseProps<T> & {
  options: { label: ReactNode; value: string | number }[]
  optionType?: 'default' | 'button'
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field label={label} required={required} error={fieldState.error?.message}>
          <Radio.Group
            {...field}
            options={options}
            optionType={optionType}
            buttonStyle={optionType === 'button' ? 'solid' : undefined}
            disabled={disabled}
          />
        </Field>
      )}
    />
  )
}

export function FormSwitch<T extends FieldValues>({
  control,
  name,
  label,
  disabled,
  checkedText,
  uncheckedText
}: BaseProps<T> & { checkedText?: string; uncheckedText?: string }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field label={label} error={fieldState.error?.message}>
          <Switch
            // Kho dữ liệu dùng 0/1 (SQLite không có kiểu boolean)
            checked={Boolean(field.value)}
            onChange={(checked) => field.onChange(checked ? 1 : 0)}
            disabled={disabled}
            checkedChildren={checkedText}
            unCheckedChildren={uncheckedText}
          />
        </Field>
      )}
    />
  )
}
