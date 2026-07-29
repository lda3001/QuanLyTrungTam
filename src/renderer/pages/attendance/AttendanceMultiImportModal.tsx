import { useState } from 'react'
import { Alert, Button, Modal, Space, Spin, Steps, Table, Tag, Typography } from 'antd'
import { FileExcelOutlined, UploadOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fileService } from '@/services/admin.service'
import { attendanceService } from '@/services/academic.service'
import { useNotify } from '@/hooks/useNotify'
import { dayjs, ISO_DATE } from '@/utils/format'
import { AttendanceStatus, AttendanceStatusLabel, AttendanceStatusColor } from '@shared/constants/enums'
import type { AttendanceGridSession, AttendanceGridStudent } from '@shared/types/dto'

interface Props {
  open: boolean
  classId: number
  className: string
  onClose: () => void
}

interface ParsedCell {
  sessionId: number
  studentId: number
  status: AttendanceStatus
}

interface PreviewRow {
  studentId: number
  studentCode: string
  studentName: string
  cells: { sessionId: number; status: AttendanceStatus }[]
}

const SYMBOL_MAP: Record<string, AttendanceStatus> = {
  x: AttendanceStatus.PRESENT,
  'có mặt': AttendanceStatus.PRESENT,
  present: AttendanceStatus.PRESENT,
  m: AttendanceStatus.LATE,
  'đi muộn': AttendanceStatus.LATE,
  muộn: AttendanceStatus.LATE,
  late: AttendanceStatus.LATE,
  p: AttendanceStatus.EXCUSED,
  'nghỉ có phép': AttendanceStatus.EXCUSED,
  'có phép': AttendanceStatus.EXCUSED,
  excused: AttendanceStatus.EXCUSED,
  n: AttendanceStatus.ABSENT,
  'nghỉ không phép': AttendanceStatus.ABSENT,
  'không phép': AttendanceStatus.ABSENT,
  vắng: AttendanceStatus.ABSENT,
  absent: AttendanceStatus.ABSENT
}

function parseSymbol(raw: unknown): AttendanceStatus | null {
  const key = String(raw ?? '').trim().toLowerCase()
  if (!key) return null
  return SYMBOL_MAP[key] ?? null
}

function matchSession(header: string, sessions: AttendanceGridSession[]): AttendanceGridSession | null {
  const parsed = dayjs(header.trim(), 'DD/MM', true)
  if (!parsed.isValid()) return null
  const candidates = sessions.filter((s) => {
    const d = dayjs(s.sessionDate, ISO_DATE)
    return d.date() === parsed.date() && d.month() === parsed.month()
  })
  if (candidates.length === 0) return null
  if (candidates.length === 1) return candidates[0]
  const today = dayjs()
  return candidates.reduce((best, cur) =>
    Math.abs(dayjs(cur.sessionDate, ISO_DATE).diff(today, 'day')) <
    Math.abs(dayjs(best.sessionDate, ISO_DATE).diff(today, 'day'))
      ? cur
      : best
  )
}

export function AttendanceMultiImportModal({ open, classId, className, onClose }: Props) {
  const notify = useNotify()
  const queryClient = useQueryClient()

  const [step, setStep] = useState(0)
  const [fileName, setFileName] = useState('')
  const [preview, setPreview] = useState<PreviewRow[]>([])
  const [parsed, setParsed] = useState<ParsedCell[]>([])
  const [skippedCols, setSkippedCols] = useState<string[]>([])
  const [skippedRows, setSkippedRows] = useState<string[]>([])

  const { data: grid, isLoading: loadingGrid } = useQuery({
    queryKey: ['attendance-grid-all', classId],
    queryFn: () => attendanceService.grid({ classId }),
    enabled: open,
    staleTime: 2 * 60_000
  })

  const sessions: AttendanceGridSession[] = grid?.sessions ?? []
  const students: AttendanceGridStudent[] = grid?.students ?? []

  const pickMutation = useMutation({
    mutationFn: () => fileService.importExcelRaw(),
    onSuccess: (data) => {
      if (!data) return
      const { matrix } = data

      let headerRowIdx = 2
      const tryHeader = (idx: number): string[] =>
        (matrix[idx] ?? []).map((c) => String(c ?? '').trim())
      let headers = tryHeader(headerRowIdx)
      if (!headers.some((h) => dayjs(h, 'DD/MM', true).isValid())) {
        headerRowIdx = 0
        headers = tryHeader(0)
      }

      const sessionCols: { colIdx: number; session: AttendanceGridSession }[] = []
      const missedCols: string[] = []
      for (let i = 5; i < headers.length; i++) {
        const h = headers[i]
        const sess = matchSession(h, sessions)
        if (sess) sessionCols.push({ colIdx: i, session: sess })
        else if (dayjs(h, 'DD/MM', true).isValid()) missedCols.push(h)
      }

      if (sessionCols.length === 0) {
        notify.warning('Không tìm thấy cột ngày nào khớp với buổi học của lớp.')
        return
      }

      const cells: ParsedCell[] = []
      const previewRows: PreviewRow[] = []
      const missedStudents: string[] = []

      for (let r = headerRowIdx + 1; r < matrix.length; r++) {
        const row = matrix[r]
        const code = String(row?.[1] ?? '').trim()
        const name = String(row?.[2] ?? '').trim()
        if (!code && !name) continue

        const student =
          students.find((s) => code && s.studentCode === code) ??
          students.find((s) => name && s.studentName === name)

        if (!student) {
          missedStudents.push(code || name)
          continue
        }

        const rowCells: PreviewRow['cells'] = []
        for (const { colIdx, session } of sessionCols) {
          const status = parseSymbol(row?.[colIdx])
          if (status !== null) {
            cells.push({ sessionId: session.id, studentId: student.studentId, status })
            rowCells.push({ sessionId: session.id, status })
          }
        }
        if (rowCells.length > 0) {
          previewRows.push({
            studentId: student.studentId,
            studentCode: student.studentCode,
            studentName: student.studentName,
            cells: rowCells
          })
        }
      }

      if (cells.length === 0) {
        notify.warning('Không đọc được dữ liệu điểm danh nào từ file.')
        return
      }

      setParsed(cells)
      setPreview(previewRows)
      setFileName(data.fileName)
      setSkippedCols(missedCols)
      setSkippedRows(missedStudents)
      setStep(1)
    },
    onError: (err) => notify.error(err)
  })

  const saveMutation = useMutation({
    mutationFn: () => {
      const bySession = new Map<number, { studentId: number; status: AttendanceStatus; note: null }[]>()
      for (const c of parsed) {
        if (!bySession.has(c.sessionId)) bySession.set(c.sessionId, [])
        bySession.get(c.sessionId)!.push({ studentId: c.studentId, status: c.status, note: null })
      }
      return attendanceService.markMulti({
        sessions: Array.from(bySession.entries()).map(([sessionId, items]) => ({ sessionId, items }))
      })
    },
    onSuccess: (count) => {
      notify.success(`Đã lưu ${count} bản ghi điểm danh.`)
      void queryClient.invalidateQueries({ queryKey: ['attendance'] })
      void queryClient.invalidateQueries({ queryKey: ['class-sessions'] })
      void queryClient.invalidateQueries({ queryKey: ['attendance-history'] })
      handleClose()
    },
    onError: (err) => notify.error(err)
  })

  const handleClose = (): void => {
    setStep(0)
    setParsed([])
    setPreview([])
    setFileName('')
    setSkippedCols([])
    setSkippedRows([])
    onClose()
  }

  const sessionIds = Array.from(new Set(parsed.map((c) => c.sessionId)))
  const sessionMap = new Map(sessions.map((s) => [s.id, s]))

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      title="Nhập điểm danh nhiều buổi từ Excel"
      width={820}
      destroyOnClose
      footer={
        step === 1 ? (
          <Space>
            <Button onClick={() => setStep(0)}>Chọn tệp khác</Button>
            <Button type="primary" loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              Lưu {parsed.length} bản ghi
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
            message={`Lớp: ${className}`}
            description={
              <div>
                <p style={{ margin: '6px 0 4px' }}>
                  Chọn file Excel xuất từ chức năng <b>Xuất nhiều buổi</b>. Hệ thống tự khớp cột ngày
                  (DD/MM) với buổi học của lớp và cập nhật trạng thái điểm danh.
                </p>
                <p style={{ margin: 0 }}>
                  Ký hiệu: <b>x</b> = Có mặt · <b>M</b> = Đi muộn · <b>P</b> = Nghỉ có phép ·{' '}
                  <b>N</b> = Nghỉ không phép · <i>ô trống = bỏ qua</i>
                </p>
              </div>
            }
          />
          {loadingGrid ? (
            <Spin />
          ) : (
            <Button
              type="primary"
              icon={<UploadOutlined />}
              loading={pickMutation.isPending}
              disabled={sessions.length === 0}
              onClick={() => pickMutation.mutate()}
            >
              Chọn tệp Excel
            </Button>
          )}
          {!loadingGrid && sessions.length === 0 && (
            <Alert type="warning" showIcon message="Lớp chưa có buổi học nào." />
          )}
        </Space>
      )}

      {step === 1 && (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Alert
            type="success"
            showIcon
            icon={<FileExcelOutlined />}
            message={`Đọc được ${parsed.length} bản ghi từ ${preview.length} học viên, ${sessionIds.length} buổi`}
            description={fileName}
          />
          {skippedCols.length > 0 && (
            <Alert
              type="warning"
              showIcon
              message={`${skippedCols.length} cột ngày không khớp buổi học nào (bỏ qua): ${skippedCols.join(', ')}`}
            />
          )}
          {skippedRows.length > 0 && (
            <Alert
              type="warning"
              showIcon
              message={`${skippedRows.length} học viên không khớp (bỏ qua): ${skippedRows.slice(0, 5).join(', ')}${skippedRows.length > 5 ? '…' : ''}`}
            />
          )}
          <Table
            size="small"
            rowKey="studentId"
            dataSource={preview}
            pagination={false}
            scroll={{ y: 340, x: 'max-content' }}
            columns={[
              { title: 'Mã HV', dataIndex: 'studentCode', width: 90, fixed: 'left' as const },
              { title: 'Họ và tên', dataIndex: 'studentName', width: 180, fixed: 'left' as const },
              ...sessionIds.map((sid) => {
                const sess = sessionMap.get(sid)
                const label = sess ? dayjs(sess.sessionDate, ISO_DATE).format('DD/MM') : String(sid)
                return {
                  title: label,
                  key: `s${sid}`,
                  width: 80,
                  render: (_: unknown, row: PreviewRow) => {
                    const cell = row.cells.find((c) => c.sessionId === sid)
                    if (!cell) return <Typography.Text type="secondary">—</Typography.Text>
                    return (
                      <Tag color={AttendanceStatusColor[cell.status]} style={{ margin: 0 }}>
                        {AttendanceStatusLabel[cell.status]}
                      </Tag>
                    )
                  }
                }
              })
            ]}
          />
        </Space>
      )}
    </Modal>
  )
}
