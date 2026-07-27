import dayjs from 'dayjs'
import 'dayjs/locale/vi'
import relativeTime from 'dayjs/plugin/relativeTime'
import weekday from 'dayjs/plugin/weekday'
import isoWeek from 'dayjs/plugin/isoWeek'
import customParseFormat from 'dayjs/plugin/customParseFormat'

dayjs.extend(relativeTime)
dayjs.extend(weekday)
dayjs.extend(isoWeek)
dayjs.extend(customParseFormat)
dayjs.locale('vi')

export { dayjs }

export const DATE_FORMAT = 'DD/MM/YYYY'
export const DATE_TIME_FORMAT = 'DD/MM/YYYY HH:mm'
export const ISO_DATE = 'YYYY-MM-DD'

/**
 * Tiền tệ Việt Nam. Dùng Intl thay vì tự chèn dấu chấm để đúng quy ước
 * và tự thích ứng nếu sau này đổi đơn vị.
 */
export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '0 ₫'
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0
  }).format(value)
}

/** Rút gọn cho thẻ thống kê: 12.500.000 → 12,5 Tr */
export function formatCompactCurrency(value: number | null | undefined): string {
  const v = value ?? 0
  if (Math.abs(v) >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1).replace('.', ',')} Tỷ`
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace('.', ',')} Tr`
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)} N`
  return String(v)
}

export function formatNumber(value: number | null | undefined): string {
  return new Intl.NumberFormat('vi-VN').format(value ?? 0)
}

/** 'YYYY-MM-DD' hoặc timestamp → 'DD/MM/YYYY' */
export function formatDate(value: string | number | null | undefined): string {
  if (!value) return '—'
  const d = typeof value === 'number' ? dayjs(value) : dayjs(value, ISO_DATE, true)
  return d.isValid() ? d.format(DATE_FORMAT) : '—'
}

export function formatDateTime(value: number | null | undefined): string {
  if (!value) return '—'
  return dayjs(value).format(DATE_TIME_FORMAT)
}

export function formatRelative(value: number | null | undefined): string {
  if (!value) return '—'
  return dayjs(value).fromNow()
}

/** '2026-07' → 'T7/2026' — nhãn trục X của biểu đồ */
export function formatMonthLabel(month: string): string {
  const [y, m] = month.split('-')
  return `T${Number(m)}/${y}`
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  return `${(value ?? 0).toFixed(digits).replace('.', ',')}%`
}

/**
 * Tính % thay đổi giữa hai kỳ.
 * Khi kỳ trước bằng 0 mà kỳ này có số liệu, trả 100% thay vì Infinity.
 */
export function growthPercent(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

/** Chữ cái đầu của tên, dùng cho Avatar khi không có ảnh */
export function initials(fullName: string | null | undefined): string {
  if (!fullName) return '?'
  const parts = fullName.trim().split(/\s+/)
  const last = parts[parts.length - 1] ?? ''
  return last.charAt(0).toUpperCase()
}

/** Màu ổn định theo tên: cùng một người luôn có cùng màu avatar */
export function colorFromString(text: string): string {
  const palette = ['#1677ff', '#52c41a', '#faad14', '#eb2f96', '#722ed1', '#13c2c2', '#fa541c']
  let hash = 0
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) >>> 0
  return palette[hash % palette.length]
}

/** Đọc số tiền thành chữ — bắt buộc trên phiếu thu ở Việt Nam */
export function numberToVietnameseWords(input: number): string {
  const n = Math.floor(Math.abs(input))
  if (n === 0) return 'Không đồng'

  const digits = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín']
  const units = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ']

  const readTriple = (num: number, full: boolean): string => {
    const hundred = Math.floor(num / 100)
    const ten = Math.floor((num % 100) / 10)
    const unit = num % 10
    let out = ''

    if (hundred > 0 || full) out += `${digits[hundred]} trăm`

    if (ten === 0) {
      if (unit > 0) out += `${hundred > 0 || full ? ' lẻ' : ''} ${digits[unit]}`
    } else if (ten === 1) {
      out += ' mười'
      if (unit === 5) out += ' lăm'
      else if (unit > 0) out += ` ${digits[unit]}`
    } else {
      out += ` ${digits[ten]} mươi`
      if (unit === 1) out += ' mốt'
      else if (unit === 5) out += ' lăm'
      else if (unit > 0) out += ` ${digits[unit]}`
    }
    return out.trim()
  }

  // Cắt số thành từng nhóm 3 chữ số, đọc từ nhóm lớn nhất
  const groups: number[] = []
  let rest = n
  while (rest > 0) {
    groups.push(rest % 1000)
    rest = Math.floor(rest / 1000)
  }

  const parts: string[] = []
  for (let i = groups.length - 1; i >= 0; i--) {
    if (groups[i] === 0) continue
    // Nhóm không phải nhóm đầu phải đọc đủ "không trăm" để không mất vị trí
    const text = readTriple(groups[i], i < groups.length - 1)
    parts.push(`${text} ${units[i]}`.trim())
  }

  const result = parts.join(' ').replace(/\s+/g, ' ').trim()
  return result.charAt(0).toUpperCase() + result.slice(1) + ' đồng'
}
