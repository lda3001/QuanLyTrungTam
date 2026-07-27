import { join } from 'node:path'
import { writeFile, unlink } from 'node:fs/promises'
import { BrowserWindow, app, dialog } from 'electron'
import ExcelJS from 'exceljs'
import { audit } from './audit'
import { AppError } from '../utils/errors'
import type { ExportPdfRequest, ExportRequest } from '@shared/types/dto'

/**
 * Dịch vụ xuất/nhập tệp. Toàn bộ thao tác với đĩa nằm ở main process —
 * renderer không có quyền truy cập filesystem (đúng nguyên tắc sandbox).
 */
export class FileService {
  /**
   * Xuất Excel bằng ExcelJS: định dạng tiêu đề, tự canh độ rộng cột,
   * đóng băng dòng đầu và bật AutoFilter — file mở lên là dùng được ngay.
   */
  async exportExcel(req: ExportRequest): Promise<string | null> {
    if (!req.columns?.length) throw AppError.validation('Không có cột nào để xuất.')

    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Lưu tệp Excel',
      defaultPath: join(app.getPath('documents'), sanitize(req.fileName) + '.xlsx'),
      filters: [{ name: 'Excel', extensions: ['xlsx'] }]
    })
    if (canceled || !filePath) return null

    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'Quản Lý Trung Tâm'
    workbook.created = new Date()

    const sheet = workbook.addWorksheet(req.sheetName || 'Dữ liệu', {
      views: [{ state: 'frozen', ySplit: req.title ? 3 : 1 }]
    })

    let headerRowIndex = 1

    if (req.title) {
      sheet.mergeCells(1, 1, 1, req.columns.length)
      const titleCell = sheet.getCell(1, 1)
      titleCell.value = req.title
      titleCell.font = { size: 14, bold: true }
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
      sheet.getRow(1).height = 24
      sheet.addRow([])
      headerRowIndex = 3
    }

    const headerRow = sheet.getRow(headerRowIndex)
    req.columns.forEach((col, i) => {
      const cell = headerRow.getCell(i + 1)
      cell.value = col.title
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1677FF' } }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      }
      sheet.getColumn(i + 1).width = col.width ?? Math.max(12, col.title.length + 4)
    })
    headerRow.height = 20

    for (const row of req.rows) {
      const values = req.columns.map((c) => {
        const v = row[c.key]
        return v === null || v === undefined ? '' : (v as ExcelJS.CellValue)
      })
      const added = sheet.addRow(values)
      added.eachCell((cell) => {
        cell.border = {
          top: { style: 'hair' },
          left: { style: 'hair' },
          bottom: { style: 'hair' },
          right: { style: 'hair' }
        }
        // Số lớn hiển thị có dấu phân cách hàng nghìn kiểu Việt Nam
        if (typeof cell.value === 'number' && Math.abs(cell.value) >= 1000) {
          cell.numFmt = '#,##0'
          cell.alignment = { horizontal: 'right' }
        }
      })
    }

    sheet.autoFilter = {
      from: { row: headerRowIndex, column: 1 },
      to: { row: headerRowIndex, column: req.columns.length }
    }

    await workbook.xlsx.writeFile(filePath)
    audit('export', 'files', null, `Xuất Excel: ${req.fileName} (${req.rows.length} dòng)`)
    return filePath
  }

  /**
   * Xuất PDF: dựng một cửa sổ ẩn, nạp HTML rồi gọi printToPDF của Chromium.
   * Không cần thư viện PDF ngoài — engine in của Chromium render đúng CSS,
   * kể cả font tiếng Việt.
   */
  async exportPdf(req: ExportPdfRequest): Promise<string | null> {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Lưu tệp PDF',
      defaultPath: join(app.getPath('documents'), sanitize(req.fileName) + '.pdf'),
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    })
    if (canceled || !filePath) return null

    const buffer = await renderHtmlToPdf(req.html, req.landscape ?? false)
    await writeFile(filePath, buffer)

    audit('export', 'files', null, `Xuất PDF: ${req.fileName}`)
    return filePath
  }

  /** Mở hộp thoại in của hệ điều hành với nội dung HTML dựng sẵn */
  async printHtml(html: string): Promise<boolean> {
    const win = createHiddenWindow()
    try {
      await loadHtml(win, html)
      return await new Promise<boolean>((resolve) => {
        win.webContents.print({ silent: false, printBackground: true }, (success) => resolve(success))
      })
    } finally {
      // Đóng trễ một nhịp để hộp thoại in kịp lấy nội dung
      setTimeout(() => {
        if (!win.isDestroyed()) win.destroy()
      }, 1000)
    }
  }

  /** Đọc file Excel người dùng chọn, trả về mảng object theo tiêu đề cột */
  async importExcel(): Promise<{ fileName: string; rows: Record<string, unknown>[] } | null> {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Chọn tệp Excel',
      properties: ['openFile'],
      filters: [{ name: 'Excel', extensions: ['xlsx', 'xls'] }]
    })
    if (canceled || filePaths.length === 0) return null

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(filePaths[0])

    const sheet = workbook.worksheets[0]
    if (!sheet) throw AppError.validation('Tệp Excel không có sheet nào.')

    const headers: string[] = []
    sheet.getRow(1).eachCell((cell, col) => {
      headers[col - 1] = String(cell.value ?? '').trim()
    })
    if (headers.filter(Boolean).length === 0) {
      throw AppError.validation('Hàng đầu tiên phải là tiêu đề cột.')
    }

    const rows: Record<string, unknown>[] = []
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return

      const obj: Record<string, unknown> = {}
      let hasValue = false
      row.eachCell({ includeEmpty: true }, (cell, col) => {
        const key = headers[col - 1]
        if (!key) return
        const value = normalizeCell(cell.value)
        obj[key] = value
        if (value !== '' && value !== null && value !== undefined) hasValue = true
      })
      if (hasValue) rows.push(obj)
    })

    return { fileName: filePaths[0], rows }
  }

  /** Ghi file mẫu import để người dùng điền theo đúng cột */
  async studentImportTemplate(): Promise<string | null> {
    const columns = [
      { key: 'code', title: 'Mã học viên', width: 16 },
      { key: 'fullName', title: 'Họ và tên', width: 26 },
      { key: 'gender', title: 'Giới tính', width: 12 },
      { key: 'birthDate', title: 'Ngày sinh', width: 14 },
      { key: 'email', title: 'Email', width: 26 },
      { key: 'phone', title: 'Điện thoại', width: 16 },
      { key: 'address', title: 'Địa chỉ', width: 32 },
      { key: 'schoolClass', title: 'Lớp (ở trường)', width: 16 },
      { key: 'guardianName', title: 'Người giám hộ', width: 22 },
      { key: 'guardianPhone', title: 'SĐT giám hộ', width: 16 },
      { key: 'note', title: 'Ghi chú', width: 24 }
    ]

    return this.exportExcel({
      fileName: 'Mau-nhap-hoc-vien',
      sheetName: 'Học viên',
      columns,
      rows: [
        {
          code: '',
          fullName: 'Nguyễn Văn A',
          gender: 'Nam',
          birthDate: '01/09/2010',
          email: 'nguyenvana@gmail.com',
          phone: '0912345678',
          address: 'Hà Nội',
          schoolClass: '10A1',
          guardianName: 'Nguyễn Văn B',
          guardianPhone: '0987654321',
          note: 'Để trống cột Mã học viên nếu muốn hệ thống tự sinh'
        }
      ]
    })
  }

  /**
   * File mẫu để xếp học viên vào lớp: chỉ cần dữ liệu nhận diện học viên đã có.
   * Điền Mã HV để khớp chính xác; nếu bỏ trống thì khớp theo SĐT rồi Họ tên.
   */
  async enrollImportTemplate(): Promise<string | null> {
    const columns = [
      { key: 'code', title: 'Mã học viên', width: 16 },
      { key: 'fullName', title: 'Họ và tên', width: 26 },
      { key: 'phone', title: 'Điện thoại', width: 16 },
      { key: 'discount', title: 'Giảm học phí', width: 16 },
      { key: 'note', title: 'Ghi chú', width: 30 }
    ]

    return this.exportExcel({
      fileName: 'Mau-xep-hoc-vien-vao-lop',
      sheetName: 'Xếp lớp',
      columns,
      rows: [
        {
          code: 'HV0001',
          fullName: 'Nguyễn Văn A',
          phone: '0912345678',
          discount: '',
          note: 'Ưu tiên khớp theo Mã HV; để trống Giảm học phí nếu không giảm'
        }
      ]
    })
  }
}

/* --------------------------- tiện ích nội bộ --------------------------- */

function createHiddenWindow(): BrowserWindow {
  return new BrowserWindow({
    show: false,
    webPreferences: {
      // Cửa sổ này chỉ render HTML tĩnh do chính app tạo ra — khoá hết mọi khả năng khác
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      javascript: false
    }
  })
}

async function loadHtml(win: BrowserWindow, html: string): Promise<void> {
  // Ghi ra file tạm thay vì data: URL — data: URL có giới hạn độ dài và
  // dễ vỡ với nội dung tiếng Việt dài.
  const tmpPath = join(app.getPath('temp'), `print-${Date.now()}-${Math.floor(Math.random() * 1e6)}.html`)
  await writeFile(tmpPath, html, 'utf8')

  try {
    await win.loadFile(tmpPath)
  } finally {
    setTimeout(() => void unlink(tmpPath).catch(() => undefined), 30_000)
  }
}

async function renderHtmlToPdf(html: string, landscape: boolean): Promise<Buffer> {
  const win = createHiddenWindow()
  try {
    await loadHtml(win, html)
    return await win.webContents.printToPDF({
      landscape,
      printBackground: true,
      pageSize: 'A4',
      margins: { top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 }
    })
  } finally {
    if (!win.isDestroyed()) win.destroy()
  }
}

function normalizeCell(value: ExcelJS.CellValue): unknown {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) {
    const m = String(value.getMonth() + 1).padStart(2, '0')
    const d = String(value.getDate()).padStart(2, '0')
    return `${value.getFullYear()}-${m}-${d}`
  }
  if (typeof value === 'object') {
    // Ô công thức / rich text: lấy phần kết quả hiển thị
    const v = value as { result?: unknown; text?: string; richText?: { text: string }[] }
    if (v.richText) return v.richText.map((t) => t.text).join('')
    if (v.text !== undefined) return v.text
    if (v.result !== undefined) return v.result
    return ''
  }
  return value
}

/** Loại ký tự không hợp lệ trong tên file trên Windows */
function sanitize(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '-').slice(0, 120)
}

export const fileService = new FileService()
