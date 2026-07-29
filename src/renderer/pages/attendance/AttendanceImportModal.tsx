import { useState } from 'react'
import { Alert, Button, Modal, Space, Steps, Table, Typography } from 'antd'
import { FileExcelOutlined, UploadOutlined } from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { fileService } from '@/services/admin.service'
import { attendanceService } from '@/services/academic.service'
import { useNotify } from '@/hooks/useNotify'
import { AttendanceStatus, AttendanceStatusLabel } from '@shared/constants/enums'
import type { MarkAttendanceInput } from '@shared/types/dto'

interface Props {
  open: boolean
  sessionId: number
  sessionLabel: string
  /** studentId → studentName, dùng để khớp tên */
  enrolledStudents: { studentId: number; studentName: string; studentCode: string }[]
  onClose: () => void
}

interface ParsedRow {
  studentId: number
  studentCode: string
  studentName: string
  status: AttendanceStatus
  note: string
}

/**
 * Ánh xạ nhãn tiếng Việt trong file Excel → AttendanceStatus.
 * Chấp nhận cả nhãn đầy đủ lẫn viết tắt thường gặp.
 */
const STATUS_MAP: Record<string, AttendanceStatus> = {
  'có mặt': AttendanceStatus.PRESENT,
  'co mat': AttendanceStatus.PRESENT,
  present: AttendanceStatus.PRESENT,
  'đi muộn': AttendanceStatus.LATE,
  'di muon': AttendanceStatus.LATE,
  muộn: AttendanceStatus.LATE,
  late: AttendanceStatus.LATE,
  'nghỉ có phép': AttendanceStatus.EXCUSED,
  'nghi co phep': AttendanceStatus.EXCUSED,
  'có phép': AttendanceStatus.EXCUSED,
  excused: AttendanceStatus.EXCUSED,
  'nghỉ không phép': AttendanceStatus.ABSENT,
  'nghi khong phep': AttendanceStatus.ABSENT,
  'không phép': AttendanceStatus.ABSENT,
  vắng: AttendanceStatus.ABSENT,
  absent: AttendanceStatus.ABSENT
}

function parseStatus(raw: unknown): AttendanceStatus {
  const key = String(raw ?? '').trim().toLowerCase()
  return STATUS_MAP[key] ?? AttendanceStatus.PRESENT
}

export function AttendanceImportModal({ open, sessionId, sessionLabel, enrolledStudents, onClose }: Props) {
  const notify = useNotify()
  const queryClient = useQueryClient()

  const [step, setStep] = useState(0)
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [fileName, setFileName] = useState('')
  const [unmatched, setUnmatched] = useState<string[]>([])

  const pickFileMutation = useMutation({
    mutationFn: () => fileService.importExcel(),
    onSuccess: (data) => {
      if (!data) return

      const parsed: ParsedRow[] = []
      const missed: string[] = []

      for (const raw of data.rows) {
        const code = String(raw['Mã học viên'] ?? raw['Mã HV'] ?? '').trim()
        const name = String(raw['Họ và tên'] ?? raw['Học viên'] ?? '').trim()

        const found =
          enrolledStudents.find((s) => code && s.studentCode === code) ??
          enrolledStudents.find((s) => name && s.studentName === name)

        if (!found) {
          missed.push(code || name || '(trống)')
          continue
        }

        parsed.push({
          studentId: found.studentId,
          studentCode: found.studentCode,
          studentName: found.studentName,
          status: parseStatus(raw['Trạng thái']),
          note: String(raw['Ghi chú'] ?? '').trim()
        })
      }

      if (parsed.length === 0) {
        notify.warning('Không khớp được học viên nào. Kiểm tra cột "Mã học viên" hoặc "Họ và tên".')
        return
      }

      setRows(parsed)
      setUnmatched(missed)
      setFileName(data.fileName)
      setStep(1)
    },
    onError: (err) => notify.error(err)
  })

  const saveMutation = useMutation({
    mutationFn: () => {
      const input: MarkAttendanceInput = {
        sessionId,
        items: rows.map((r) => ({ studentId: r.studentId, status: r.status, note: r.note || null }))
      }
      return attendanceService.mark(input)
    },
    onSuccess: (count) => {
      notify.success(`Đã nhập điểm danh cho ${count} học viên.`)
      void queryClient.invalidateQueries({ queryKey: ['attendance'] })
      void queryClient.invalidateQueries({ queryKey: ['class-sessions'] })
      void queryClient.invalidateQueries({ queryKey: ['attendance-history'] })
      handleClose()
    },
    onError: (err) => notify.error(err)
  })

  const handleClose = (): void => {
    setStep(0)
    setRows([])
    setUnmatched([])
    setFileName('')
    onClose()
  }

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      title="Nhập điểm danh từ Excel"
      width={760}
      destroyOnClose
      footer={
        step === 1 ? (
          <Space>
            <Button onClick={() => setStep(0)}>Chọn tệp khác</Button>
            <Button type="primary" loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              Lưu {rows.length} học viên
            </Button>
          </Space>
        ) : (
          <Button onClick={handleClose}>Đóng</Button>
        )
      }
    >
      <Steps
        size="small"
        current={step}
        items={[{ title: 'Chọn tệp' }, { title: 'Xem trước & lưu' }]}
        style={{ marginBottom: 24 }}
      />

      {step === 0 && (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Alert
            type="info"
            showIcon
            message={`Buổi học: ${sessionLabel}`}
            description={
              <div>
                <p style={{ margin: '6px 0 4px' }}>Tệp Excel cần có các cột:</p>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  <li>
                    <b>Mã học viên</b> hoặc <b>Họ và tên</b> — để khớp học viên
                  </li>
                  <li>
                    <b>Trạng thái</b> — Có mặt / Đi muộn / Nghỉ có phép / Nghỉ không phép
                  </li>
                  <li>
                    <b>Ghi chú</b> — tuỳ chọn
                  </li>
                </ul>
              </div>
            }
          />
          <Button
            type="primary"
            icon={<UploadOutlined />}
            loading={pickFileMutation.isPending}
            onClick={() => pickFileMutation.mutate()}
          >
            Chọn tệp Excel
          </Button>
        </Space>
      )}

      {step === 1 && (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Alert
            type="success"
            showIcon
            icon={<FileExcelOutlined />}
            message={`Đọc được ${rows.length} học viên`}
            description={fileName}
          />

          {unmatched.length > 0 && (
            <Alert
              type="warning"
              showIcon
              message={`${unmatched.length} dòng không khớp học viên nào (bỏ qua): ${unmatched.slice(0, 5).join(', ')}${unmatched.length > 5 ? '...' : ''}`}
            />
          )}

          <Table
            size="small"
            rowKey="studentId"
            dataSource={rows}
            pagination={false}
            scroll={{ y: 340, x: 'max-content' }}
            columns={[
              { title: 'Mã HV', dataIndex: 'studentCode', width: 100 },
              { title: 'Họ và tên', dataIndex: 'studentName', width: 200 },
              {
                title: 'Trạng thái',
                dataIndex: 'status',
                width: 160,
                render: (v: AttendanceStatus) => AttendanceStatusLabel[v]
              },
              {
                title: 'Ghi chú',
                dataIndex: 'note',
                render: (v: string) => v || <Typography.Text type="secondary">—</Typography.Text>
              }
            ]}
          />
        </Space>
      )}
    </Modal>
  )
}
