import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Divider, MenuItem, MenuList, Paper } from '@mui/material'
import { dayjs } from '@/utils/format'

type Option = { label: ReactNode; value: string | number; disabled?: boolean }
type DateValue = ReturnType<typeof dayjs> | null | undefined

const labelText = (label: ReactNode): string => {
  if (typeof label === 'string' || typeof label === 'number') return String(label)
  return ''
}

/**
 * Uses the browser's chooser, styled to match Ant Design. This avoids a
 * portalled pop-up while retaining predictable coordinates on Windows 10.
 */
export function MuiSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Chọn...',
  disabled,
  style,
  className,
  mode,
  onBlur
}: {
  value?: string | number | Array<string | number> | null
  onChange?: (value: any) => void
  options?: Option[]
  placeholder?: string
  disabled?: boolean
  style?: CSSProperties
  className?: string
  mode?: 'multiple' | 'tags'
  allowClear?: boolean
  loading?: boolean
  onSearch?: (value: string) => void
  showSearch?: boolean
  filterOption?: boolean | ((input: string, option: { label?: ReactNode }) => boolean)
  onBlur?: () => void
  notFoundContent?: ReactNode
  [key: string]: unknown
}) {
  const multiple = mode === 'multiple' || mode === 'tags'
  const selected = multiple ? (Array.isArray(value) ? value : []).map(String) : value === null || value === undefined ? '' : String(value)
  const optionValue = (raw: string): string | number => options.find((option) => String(option.value) === raw)?.value ?? raw

  return (
    <span
      className={['ant-native-select', className].filter(Boolean).join(' ')}
      style={style}
    >
      <select
        value={selected}
        disabled={disabled}
        multiple={multiple}
        onBlur={onBlur}
        onChange={(event) => {
          const element = event.currentTarget
          if (multiple) {
            onChange?.(Array.from(element.selectedOptions, (option) => optionValue(option.value)))
          } else {
            const nextValue = element.value
            onChange?.(nextValue === '' ? undefined : optionValue(nextValue))
          }
        }}
      >
        {!multiple && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {labelText(option.label)}
          </option>
        ))}
      </select>
    </span>
  )
}

const dateText = (value: DateValue) => (value?.isValid() ? value.format('YYYY-MM-DD') : '')

export function MuiDatePicker({
  value,
  onChange,
  disabled,
  style,
  className,
  disabledDate,
  placeholder
}: {
  value?: DateValue
  onChange?: (value: any, text?: string) => void
  disabled?: boolean
  style?: CSSProperties
  className?: string
  disabledDate?: (value: ReturnType<typeof dayjs>) => boolean
  format?: string
  placeholder?: string
  allowClear?: boolean
  onBlur?: () => void
  [key: string]: unknown
}) {
  return (
    <input
      type="date"
      className={['ant-native-date-picker', className].filter(Boolean).join(' ')}
      style={style}
      value={dateText(value)}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(event) => {
        const next = event.currentTarget.value ? dayjs(event.currentTarget.value) : null
        if (next && disabledDate?.(next)) return
        onChange?.(next, event.currentTarget.value)
      }}
    />
  )
}

export function MuiDateRangePicker({
  value,
  onChange,
  disabled,
  style,
  className,
  disabledDate
}: {
  value?: [DateValue, DateValue]
  onChange?: (value: any, text?: [string, string]) => void
  disabled?: boolean
  style?: CSSProperties
  className?: string
  disabledDate?: (value: ReturnType<typeof dayjs>) => boolean
  format?: string
  allowClear?: boolean
  onBlur?: () => void
  presets?: unknown
  [key: string]: unknown
}) {
  const update = (index: 0 | 1, next: DateValue) => {
    if (next && disabledDate?.(next)) return
    const values: [DateValue, DateValue] = [value?.[0] ?? null, value?.[1] ?? null]
    values[index] = next
    onChange?.(values, [values[0]?.format('YYYY-MM-DD') ?? '', values[1]?.format('YYYY-MM-DD') ?? ''])
  }

  return (
    <span className={['ant-native-date-range', className].filter(Boolean).join(' ')} style={style}>
      <input type="date" value={dateText(value?.[0])} disabled={disabled} onChange={(event) => update(0, event.currentTarget.value ? dayjs(event.currentTarget.value) : null)} />
      <span>–</span>
      <input type="date" value={dateText(value?.[1])} disabled={disabled} onChange={(event) => update(1, event.currentTarget.value ? dayjs(event.currentTarget.value) : null)} />
    </span>
  )
}

export const MuiDatePickerApi = Object.assign(MuiDatePicker, { RangePicker: MuiDateRangePicker })

export function MuiTimePicker({
  value,
  onChange,
  disabled,
  style,
  className,
  minuteStep
}: {
  value?: DateValue
  onChange?: (value: any, text?: string) => void
  disabled?: boolean
  style?: CSSProperties
  className?: string
  minuteStep?: number
  format?: string
  onBlur?: () => void
  [key: string]: unknown
}) {
  return (
    <input
      type="time"
      className={['ant-native-date-picker', className].filter(Boolean).join(' ')}
      style={style}
      value={value?.isValid() ? value.format('HH:mm') : ''}
      disabled={disabled}
      step={minuteStep ? minuteStep * 60 : undefined}
      onChange={(event) => onChange?.(event.currentTarget.value ? dayjs(event.currentTarget.value, 'HH:mm') : null, event.currentTarget.value)}
    />
  )
}

/** A local MUI menu; no body portal means no incorrect `inset` calculation. */
export function MuiDropdown({ children, menu, trigger = ['click'], placement = 'bottomLeft' }: {
  children: ReactNode
  menu: { items?: any[]; onClick?: (info: any) => void }
  trigger?: string[]
  placement?: string
}) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<CSSProperties>({})
  const dropdownRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLSpanElement>(null)
  const dropdownId = useId()
  const contextMenu = trigger.includes('contextMenu')

  useEffect(() => {
    const closeWhenAnotherOpens = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== dropdownId) setOpen(false)
    }
    window.addEventListener('mui-dropdown-open', closeWhenAnotherOpens)
    return () => window.removeEventListener('mui-dropdown-open', closeWhenAnotherOpens)
  }, [dropdownId])

  useEffect(() => {
    if (!open) return
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !dropdownRef.current?.contains(event.target)) setOpen(false)
    }
    // Bắt ở pha capture để vẫn đóng được khi phần tử bên ngoài gọi stopPropagation().
    document.addEventListener('pointerdown', closeOnOutsideClick, true)
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick, true)
  }, [open])

  const announceOpen = () => window.dispatchEvent(new CustomEvent('mui-dropdown-open', { detail: dropdownId }))

  const openFromTrigger = () => {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return

    // Các nút thao tác thường nằm ở cột cuối. Khi không đủ chỗ bên phải,
    // canh mép phải menu với nút để nội dung không bị tràn khỏi màn hình.
    const menuWidth = 190
    const alignRight = placement === 'bottomRight' || rect.left + menuWidth > window.innerWidth - 8
    announceOpen()
    setPosition(
      alignRight
        ? { top: rect.bottom + 6, right: Math.max(8, window.innerWidth - rect.right) }
        : { top: rect.bottom + 6, left: Math.max(8, rect.left) }
    )
    setOpen(true)
  }

  return (
    <div ref={dropdownRef} className={['mui-dropdown', placement === 'bottomRight' ? 'mui-dropdown-right' : ''].join(' ')} onContextMenu={(event) => {
      if (!contextMenu) return
      event.preventDefault()
      event.stopPropagation()
      announceOpen()
      setPosition({ top: event.clientY + 4, left: event.clientX + 4 })
      setOpen(true)
    }}>
      <span ref={triggerRef} className="mui-dropdown-trigger" onClickCapture={() => {
        if (contextMenu) return
        if (open) setOpen(false)
        else openFromTrigger()
      }}>{children}</span>
      {open && (
        <Paper className="mui-dropdown-menu" style={position} elevation={4}>
          <MenuList dense>
            {menu.items?.map((item, index) => item.type === 'divider' ? <Divider key={`divider-${index}`} /> : (
              <MenuItem key={item.key ?? index} disabled={item.disabled} sx={item.danger ? { color: 'error.main' } : undefined} onClick={(event) => {
                event.stopPropagation()
                setOpen(false)
                if (item.key) menu.onClick?.({ key: item.key, domEvent: event })
              }}>
                {item.icon} {item.label}
              </MenuItem>
            ))}
          </MenuList>
        </Paper>
      )}
    </div>
  )
}
