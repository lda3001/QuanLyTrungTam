import { formatCurrency, formatDate, formatDateTime, numberToVietnameseWords } from './format'
import { PaymentMethodLabel } from '@shared/constants/enums'
import type { ReceiptData } from '@shared/types/dto'

/**
 * Sinh HTML để in / xuất PDF.
 *
 * Vì sao dựng HTML thủ công thay vì render React rồi chụp lại? Chromium sẽ in
 * trang này trong một cửa sổ riêng đã TẮT JavaScript — nội dung phải là HTML
 * tĩnh, tự chứa toàn bộ CSS. Đổi lại, kết quả in cực kỳ ổn định.
 */

/** Escape để nội dung do người dùng nhập không thể chèn thẻ HTML vào bản in */
function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const BASE_STYLE = `
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body {
    font-family: "Times New Roman", Times, serif;
    font-size: 13pt; color: #000; margin: 0;
  }
  .center { text-align: center; }
  .right { text-align: right; }
  .bold { font-weight: bold; }
  .muted { color: #444; font-size: 11pt; }
  .row { display: flex; justify-content: space-between; align-items: flex-start; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  th, td { border: 1px solid #333; padding: 6px 8px; font-size: 11.5pt; }
  th { background: #f0f0f0; font-weight: bold; text-align: center; }
  td.num { text-align: right; }
  .title { font-size: 20pt; font-weight: bold; margin: 6px 0 2px; text-transform: uppercase; }
  .sub { font-size: 11pt; font-style: italic; }
  .field { margin: 7px 0; }
  .dots { border-bottom: 1px dotted #666; display: inline-block; min-width: 60%; }
  .sign { margin-top: 34px; display: flex; justify-content: space-around; text-align: center; }
  .sign div { width: 45%; }
  .sign .role { font-weight: bold; }
  .sign .hint { font-size: 10pt; font-style: italic; color: #444; }
  .sign .space { height: 62px; }
`

function wrap(title: string, body: string, extraStyle = ''): string {
  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8" />
<title>${esc(title)}</title>
<style>${BASE_STYLE}${extraStyle}</style>
</head>
<body>${body}</body>
</html>`
}

/** Phiếu thu học phí — bố cục theo mẫu chứng từ kế toán Việt Nam */
export function buildReceiptHtml(data: ReceiptData): string {
  const { payment, student, center, totals } = data

  const body = `
  <div class="row">
    <div>
      <div class="bold">${esc(center.centerName)}</div>
      <div class="muted">${esc(center.centerAddress)}</div>
      <div class="muted">ĐT: ${esc(center.centerPhone)}${center.centerEmail ? ` — Email: ${esc(center.centerEmail)}` : ''}</div>
      ${center.centerTaxCode ? `<div class="muted">MST: ${esc(center.centerTaxCode)}</div>` : ''}
    </div>
    <div class="right">
      <div class="bold">Mẫu số 01-TT</div>
      <div class="muted">Số: ${esc(payment.code)}</div>
    </div>
  </div>

  <div class="center" style="margin-top:18px">
    <div class="title">Phiếu thu học phí</div>
    <div class="sub">Ngày ${esc(formatDate(payment.paidDate))}</div>
  </div>

  <div style="margin-top:16px">
    <div class="field">Họ tên học viên: <span class="bold">${esc(student.fullName)}</span>
      &nbsp;&nbsp; Mã HV: <span class="bold">${esc(student.code)}</span></div>
    <div class="field">Điện thoại: ${esc(student.phone || '—')}</div>
    <div class="field">Địa chỉ: ${esc(student.address || '—')}</div>
    <div class="field">Nội dung: Thu học phí lớp <span class="bold">${esc(data.className || '—')}</span>
      ${data.courseName ? `— khoá ${esc(data.courseName)}` : ''}</div>
    <div class="field">Hình thức thanh toán: ${esc(PaymentMethodLabel[payment.method])}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:52%">Khoản mục</th>
        <th style="width:16%">Học phí</th>
        <th style="width:16%">Đã đóng</th>
        <th style="width:16%">Còn lại</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>${esc(data.courseName || 'Học phí')}</td>
        <td class="num">${esc(formatCurrency(totals.payable))}</td>
        <td class="num">${esc(formatCurrency(totals.paid))}</td>
        <td class="num">${esc(formatCurrency(totals.remaining))}</td>
      </tr>
      <tr>
        <td class="bold">Số tiền thu lần này</td>
        <td class="num bold" colspan="3">${esc(formatCurrency(payment.amount))}</td>
      </tr>
    </tbody>
  </table>

  <div class="field" style="margin-top:10px">
    Bằng chữ: <span class="bold">${esc(numberToVietnameseWords(payment.amount))}</span>
  </div>
  ${payment.note ? `<div class="field">Ghi chú: ${esc(payment.note)}</div>` : ''}

  <div class="sign">
    <div>
      <div class="role">Người nộp tiền</div>
      <div class="hint">(Ký, ghi rõ họ tên)</div>
      <div class="space"></div>
      <div>${esc(student.fullName)}</div>
    </div>
    <div>
      <div class="role">Người thu tiền</div>
      <div class="hint">(Ký, ghi rõ họ tên)</div>
      <div class="space"></div>
      <div>${esc(data.cashierName)}</div>
    </div>
  </div>

  <div class="muted" style="margin-top:24px">In lúc ${esc(formatDateTime(data.printedAt))}</div>`

  return wrap(`Phieu-thu-${payment.code}`, body)
}

export interface ReportPrintColumn {
  key: string
  title: string
  align?: 'left' | 'right' | 'center'
  /** Định dạng lại giá trị trước khi in (ví dụ số tiền) */
  render?: (value: unknown, row: Record<string, unknown>) => string
}

/** Bảng báo cáo tổng quát — dùng chung cho mọi loại báo cáo */
export function buildReportHtml(options: {
  title: string
  subtitle?: string
  centerName?: string
  columns: ReportPrintColumn[]
  rows: Record<string, unknown>[]
  summary?: { label: string; value: string }[]
}): string {
  const { title, subtitle, centerName, columns, rows, summary } = options

  const head = columns.map((c) => `<th>${esc(c.title)}</th>`).join('')

  const bodyRows = rows
    .map((row, index) => {
      const cells = columns
        .map((c) => {
          const raw = row[c.key]
          const text = c.render ? c.render(raw, row) : String(raw ?? '')
          const align = c.align === 'right' ? ' class="num"' : c.align === 'center' ? ' style="text-align:center"' : ''
          return `<td${align}>${esc(text)}</td>`
        })
        .join('')
      return `<tr><td style="text-align:center">${index + 1}</td>${cells}</tr>`
    })
    .join('')

  const summaryHtml = summary?.length
    ? `<div style="margin-top:14px">
        ${summary.map((s) => `<div class="field"><span class="bold">${esc(s.label)}:</span> ${esc(s.value)}</div>`).join('')}
       </div>`
    : ''

  const body = `
  ${centerName ? `<div class="bold">${esc(centerName)}</div>` : ''}
  <div class="center">
    <div class="title">${esc(title)}</div>
    ${subtitle ? `<div class="sub">${esc(subtitle)}</div>` : ''}
  </div>

  <table>
    <thead><tr><th style="width:44px">STT</th>${head}</tr></thead>
    <tbody>${bodyRows || `<tr><td colspan="${columns.length + 1}" class="center">Không có dữ liệu</td></tr>`}</tbody>
  </table>

  ${summaryHtml}

  <div class="sign">
    <div>
      <div class="role">Người lập báo cáo</div>
      <div class="hint">(Ký, ghi rõ họ tên)</div>
      <div class="space"></div>
    </div>
    <div>
      <div class="role">Giám đốc trung tâm</div>
      <div class="hint">(Ký, đóng dấu)</div>
      <div class="space"></div>
    </div>
  </div>

  <div class="muted" style="margin-top:20px">In lúc ${esc(formatDateTime(Date.now()))}</div>`

  return wrap(title, body, `body { font-size: 12pt; } th, td { font-size: 10.5pt; }`)
}
