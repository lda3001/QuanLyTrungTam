import ExcelJS from 'exceljs'
import type { ExportRequest } from '@shared/types/dto'

async function chooseExcel(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = '.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    input.onchange = () => resolve(input.files?.[0] ?? null)
    input.click()
  })
}

async function workbookFromPicker(): Promise<{ name: string; workbook: ExcelJS.Workbook } | null> {
  const file = await chooseExcel()
  if (!file) return null
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(await file.arrayBuffer())
  return { name: file.name, workbook }
}

function valueOf(value: ExcelJS.CellValue): unknown {
  if (value instanceof Date) return value
  if (value && typeof value === 'object') {
    const item = value as { text?: string; result?: unknown; richText?: { text: string }[] }
    return item.richText?.map((part) => part.text).join('') ?? item.text ?? item.result ?? ''
  }
  return value ?? ''
}

function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob); const anchor = document.createElement('a')
  anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url)
}

export const browserFileService = {
  async downloadStudentTemplate(): Promise<string> { return this.exportExcel({ fileName: 'Mau-nhap-hoc-vien', sheetName: 'Học viên', columns: ['Mã học viên', 'Họ và tên', 'Giới tính', 'Ngày sinh', 'Email', 'Điện thoại', 'Địa chỉ', 'Lớp (ở trường)', 'Người giám hộ', 'SĐT giám hộ', 'Ghi chú'].map(title => ({ key: title, title })), rows: [] }) },
  async downloadEnrollTemplate(): Promise<string> { return this.exportExcel({ fileName: 'Mau-xep-hoc-vien-vao-lop', sheetName: 'Xếp lớp', columns: ['Mã học viên', 'Họ và tên', 'Điện thoại', 'Giảm học phí', 'Ghi chú'].map(title => ({ key: title, title })), rows: [] }) },
  async importExcel(): Promise<{ fileName: string; rows: Record<string, unknown>[] } | null> {
    const selected = await workbookFromPicker(); if (!selected) return null
    const sheet = selected.workbook.worksheets[0]; if (!sheet) throw new Error('Tệp Excel không có sheet nào.')
    const headers: string[] = []; sheet.getRow(1).eachCell((cell, index) => { headers[index - 1] = String(valueOf(cell.value)).trim() })
    const rows: Record<string, unknown>[] = []
    sheet.eachRow((row, index) => { if (index === 1) return; const item: Record<string, unknown> = {}; let hasValue = false; row.eachCell({ includeEmpty: true }, (cell, col) => { const key = headers[col - 1]; if (!key) return; const value = valueOf(cell.value); item[key] = value; hasValue ||= value !== '' }); if (hasValue) rows.push(item) })
    return { fileName: selected.name, rows }
  },
  async importExcelRaw(): Promise<{ fileName: string; matrix: unknown[][] } | null> {
    const selected = await workbookFromPicker(); if (!selected) return null
    const sheet = selected.workbook.worksheets[0]; if (!sheet) throw new Error('Tệp Excel không có sheet nào.')
    const matrix: unknown[][] = []; sheet.eachRow((row) => { const cells: unknown[] = []; row.eachCell({ includeEmpty: true }, cell => cells.push(valueOf(cell.value))); matrix.push(cells) })
    return { fileName: selected.name, matrix }
  },
  async exportExcel(req: ExportRequest): Promise<string> {
    const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet(req.sheetName || 'Dữ liệu')
    if (req.title) { sheet.mergeCells(1, 1, 1, req.columns.length); sheet.getCell(1, 1).value = req.title; sheet.getCell(1, 1).font = { bold: true, size: 14 }; sheet.addRow([]) }
    const header = sheet.addRow(req.columns.map(column => column.title)); header.font = { bold: true }
    for (const row of req.rows) sheet.addRow(req.columns.map(column => row[column.key] ?? ''))
    req.columns.forEach((column, index) => { sheet.getColumn(index + 1).width = column.width ?? Math.max(12, column.title.length + 3) })
    download(new Blob([await workbook.xlsx.writeBuffer()], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${req.fileName}.xlsx`)
    return req.fileName
  },
  async exportPdf(req: { fileName: string; html: string; landscape?: boolean }): Promise<string> { const win = window.open('', '_blank'); if (!win) throw new Error('Trình duyệt đã chặn cửa sổ in.'); win.document.write(req.html); win.document.close(); win.focus(); win.print(); return req.fileName },
  async printHtml(html: string): Promise<boolean> { const win = window.open('', '_blank'); if (!win) throw new Error('Trình duyệt đã chặn cửa sổ in.'); win.document.write(html); win.document.close(); win.focus(); win.print(); return true }
}
