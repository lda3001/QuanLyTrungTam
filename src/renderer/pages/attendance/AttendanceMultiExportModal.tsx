import { useState } from 'react'
import { Alert, DatePicker, Modal, Space, Typography } from 'antd'
import { DownloadOutlined } from '@ant-design/icons'
import { useMutation } from '@tanstack/react-query'
import { attendanceService } from '@/services/academic.service'
import { useExport } from '@/hooks/useExport'
import { useNotify } from '@/hooks/useNotify'
import { dayjs, DATE_FORMAT, formatDate, ISO_DATE } from '@/utils/format'
import { AttendanceStatus } from '@shared/constants/enums'
import type { ExportRequest } from '@shared/types/dto'

interface Props {
  open: boolean
  classId: number
  className: string
  onClose: () => void
}

/**
 * Ký hiệu ngắn hiển thị trong từng ô của lưới điểm danh. Chọn ký tự đơn để cả
 * bảng nhiều buổi vẫn gọn; phần chú thích ở cuối file giải nghĩa từng ký hiệu.
 */
const MARK_SYMBOL: Record<AttendanceStatus, string> = {
  [AttendanceStatus.PRESENT]: 'x',
  [AttendanceStatus.LATE]: 'M',
  [AttendanceStatus.EXCUSED]: 'P',
  [AttendanceStatus.ABSENT]: 'N'
}

const LEGEND = 'Ghi chú: x = Có mặt · M = Đi muộn · P = Nghỉ có phép · N = Nghỉ không phép'

/**
 * Xuất bảng điểm danh nhiều buổi (dạng lưới): mỗi buổi là một cột, mỗi học viên
 * là một hàng. Người dùng chọn khoảng ngày; hệ thống lấy mọi buổi của lớp trong
 * khoảng đó rồi dựng lưới kèm hai cột tổng "Có mặt" / "Vắng".
 */
export function AttendanceMultiExportModal({ open, classId, className, onClose }: Props) {
  const notify = useNotify()
  const { exportExcel, exporting } = useExport()

  // Mặc định 2 tháng gần nhất — đủ rộng cho hầu hết nhu cầu xuất định kỳ
  const [range, setRange] = useState<[string, string]>(() => [
    dayjs().subtract(2, 'month').format(ISO_DATE),
    dayjs().format(ISO_DATE)
  ])

  const exportMutation = useMutation({
    mutationFn: async () => {
      const grid = await attendanceService.grid({ classId, from: range[0], to: range[1] })
      if (grid.sessions.length === 0) {
        notify.warning('Không có buổi học nào trong khoảng thời gian đã chọn.')
        return
      }

      const sessionColumns = grid.sessions.map((s) => ({
        key: `s${s.id}`,
        title: dayjs(s.sessionDate, ISO_DATE).format('DD/MM'),
        width: 7
      }))

      const columns: ExportRequest['columns'] = [
        { key: 'stt', title: 'STT', width: 6 },
        { key: 'code', title: 'Mã HV', width: 14 },
        { key: 'name', title: 'Họ và tên', width: 26 },
        { key: 'schoolClass', title: 'Lớp', width: 10 },
        { key: 'guardianPhone', title: 'SĐT phụ huynh', width: 16 },
        ...sessionColumns,
        { key: 'present', title: 'Có mặt', width: 9 },
        { key: 'absent', title: 'Vắng', width: 9 }
      ]

      const rows: Record<string, unknown>[] = grid.students.map((st, i) => {
        const studentMarks = grid.marks[st.studentId] ?? {}
        let present = 0
        let absent = 0

        const row: Record<string, unknown> = {
          stt: i + 1,
          code: st.studentCode,
          name: st.studentName,
          schoolClass: st.schoolClass ?? '',
          guardianPhone: st.guardianPhone ?? ''
        }

        for (const s of grid.sessions) {
          const status = studentMarks[s.id]
          row[`s${s.id}`] = status ? MARK_SYMBOL[status] : ''
          if (status === AttendanceStatus.PRESENT || status === AttendanceStatus.LATE) present++
          else if (status === AttendanceStatus.EXCUSED || status === AttendanceStatus.ABSENT) absent++
        }

        row.present = present
        row.absent = absent
        return row
      })

      // Hàng chú thích ký hiệu ở cuối bảng, đặt tại cột Họ và tên cho dễ thấy
      rows.push({ name: LEGEND })

      await exportExcel({
        fileName: `Diem-danh-${className}-${range[0]}_${range[1]}`,
        sheetName: 'Điểm danh',
        title: `BẢNG ĐIỂM DANH — ${className} (${formatDate(range[0])} – ${formatDate(range[1])})`,
        columns,
        rows
      })
      onClose()
    },
    onError: (err) => notify.error(err)
  })

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title="Xuất điểm danh nhiều buổi"
      okText="Xuất Excel"
      okButtonProps={{ icon: <DownloadOutlined />, loading: exporting || exportMutation.isPending }}
      onOk={() => exportMutation.mutate()}
      cancelText="Đóng"
      width={520}
      destroyOnClose
    >
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Alert
          type="info"
          showIcon
          message={`Lớp: ${className}`}
          description="Chọn khoảng ngày. File xuất ra có mỗi buổi là một cột, đánh dấu trạng thái từng học viên."
        />

        <div>
          <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 6 }}>
            Khoảng thời gian
          </Typography.Text>
          <DatePicker.RangePicker
            format={DATE_FORMAT}
            allowClear={false}
            style={{ width: '100%' }}
            value={[dayjs(range[0], ISO_DATE), dayjs(range[1], ISO_DATE)]}
            onChange={(dates) => {
              if (dates?.[0] && dates?.[1]) {
                setRange([dates[0].format(ISO_DATE), dates[1].format(ISO_DATE)])
              }
            }}
          />
        </div>

        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {LEGEND}
        </Typography.Text>
      </Space>
    </Modal>
  )
}
