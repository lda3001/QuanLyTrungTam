import { useCallback, useState } from 'react'
import { fileService } from '@/services/admin.service'
import { useNotify } from './useNotify'
import type { ExportRequest } from '@shared/types/dto'

/**
 * Xuất Excel / PDF kèm trạng thái loading và thông báo kết quả.
 *
 * Người dùng bấm Huỷ ở hộp thoại lưu file thì service trả về null — đó là
 * hành vi bình thường, không phải lỗi, nên không hiện thông báo gì.
 */
export function useExport() {
  const notify = useNotify()
  const [exporting, setExporting] = useState(false)

  const exportExcel = useCallback(
    async (req: ExportRequest) => {
      if (req.rows.length === 0) {
        notify.warning('Không có dữ liệu để xuất.')
        return
      }

      setExporting(true)
      try {
        const path = await fileService.exportExcel(req)
        if (path) notify.success(`Đã lưu: ${path}`)
      } catch (err) {
        notify.error(err)
      } finally {
        setExporting(false)
      }
    },
    [notify]
  )

  const exportPdf = useCallback(
    async (fileName: string, html: string, landscape = false) => {
      setExporting(true)
      try {
        const path = await fileService.exportPdf({ fileName, html, landscape })
        if (path) notify.success(`Đã lưu: ${path}`)
      } catch (err) {
        notify.error(err)
      } finally {
        setExporting(false)
      }
    },
    [notify]
  )

  const print = useCallback(
    async (html: string) => {
      try {
        const printed = await fileService.printHtml(html)
        if (!printed) notify.warning('Đã hủy lệnh in hoặc chưa chọn máy in.')
      } catch (err) {
        notify.error(err)
      }
    },
    [notify]
  )

  return { exportExcel, exportPdf, print, exporting }
}
