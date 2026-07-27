import { useState } from 'react'
import { Alert, Button, Modal, Space, Statistic, Steps, Table, Typography } from 'antd'
import { DownloadOutlined, FileExcelOutlined, UploadOutlined } from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { fileService } from '@/services/admin.service'
import { classService } from '@/services/academic.service'
import { useNotify } from '@/hooks/useNotify'
import { dayjs, ISO_DATE } from '@/utils/format'
import type { EnrollImportRow, ImportResult } from '@shared/types/dto'

interface Props {
  open: boolean
  classId: number
  className: string
  remainingSlots: number
  onClose: () => void
}

/**
 * Xếp học viên vào lớp hàng loạt từ Excel, 3 bước: tải mẫu → chọn file → kết quả.
 *
 * Khác với nhập học viên: file này KHÔNG tạo học viên mới — chỉ nhận diện học
 * viên đã có (theo Mã HV → SĐT → Họ tên) rồi ghi danh. Ngày ghi danh lấy ngày
 * import; cột "Giảm học phí" để trống thì mặc định 0.
 *
 * Tên cột trong file ánh xạ theo NHÃN tiếng Việt để người dùng dễ điền.
 */
const COLUMN_MAP: Record<string, keyof EnrollImportRow> = {
  'Mã học viên': 'code',
  'Họ và tên': 'fullName',
  'Điện thoại': 'phone',
  'Giảm học phí': 'discount',
  'Ghi chú': 'note'
}

export function EnrollImportModal({ open, classId, className, remainingSlots, onClose }: Props) {
  const notify = useNotify()
  const queryClient = useQueryClient()

  const [step, setStep] = useState(0)
  const [rows, setRows] = useState<EnrollImportRow[]>([])
  const [fileName, setFileName] = useState('')
  const [result, setResult] = useState<ImportResult | null>(null)

  const templateMutation = useMutation({
    mutationFn: () => classService.enrollTemplate(),
    onSuccess: (path) => {
      if (path) notify.success(`Đã lưu tệp mẫu: ${path}`)
    },
    onError: (err) => notify.error(err)
  })

  const pickFileMutation = useMutation({
    mutationFn: () => fileService.importExcel(),
    onSuccess: (data) => {
      if (!data) return // người dùng bấm Huỷ ở hộp thoại chọn file

      const mapped = data.rows.map((raw) => {
        const row: EnrollImportRow = {}
        for (const [label, key] of Object.entries(COLUMN_MAP)) {
          const value = raw[label]
          if (value !== undefined && value !== null && value !== '') {
            row[key] = String(value).trim() as never
          }
        }
        return row
      })

      // Dòng hợp lệ = có ít nhất một trường nhận diện học viên
      const valid = mapped.filter((r) => r.code || r.phone || r.fullName)
      if (valid.length === 0) {
        notify.warning('Không đọc được dòng hợp lệ nào. Hãy kiểm tra tiêu đề cột có khớp tệp mẫu không.')
        return
      }

      setRows(valid)
      setFileName(data.fileName)
      setStep(1)
    },
    onError: (err) => notify.error(err)
  })

  const importMutation = useMutation({
    mutationFn: () =>
      classService.enrollImport({
        classId,
        enrollDate: dayjs().format(ISO_DATE),
        rows
      }),
    onSuccess: (res) => {
      setResult(res)
      setStep(2)
      void queryClient.invalidateQueries({ queryKey: ['class-students', classId] })
      void queryClient.invalidateQueries({ queryKey: ['class', classId] })
      void queryClient.invalidateQueries({ queryKey: ['classes'] })
      if (res.failed === 0) notify.success(`Đã xếp ${res.inserted} học viên vào lớp.`)
      else notify.warning(`Nhập xong: ${res.inserted} thành công, ${res.failed} lỗi.`)
    },
    onError: (err) => notify.error(err)
  })

  const handleClose = (): void => {
    setStep(0)
    setRows([])
    setResult(null)
    setFileName('')
    onClose()
  }

  const overLimit = rows.length > remainingSlots

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      title={`Nhập Excel xếp học viên vào lớp ${className}`}
      width={820}
      destroyOnClose
      footer={
        step === 1 ? (
          <Space>
            <Button onClick={() => setStep(0)}>Chọn tệp khác</Button>
            <Button
              type="primary"
              loading={importMutation.isPending}
              onClick={() => importMutation.mutate()}
            >
              Xếp {rows.length} học viên
            </Button>
          </Space>
        ) : (
          <Button type="primary" onClick={handleClose}>
            Đóng
          </Button>
        )
      }
    >
      <Steps
        size="small"
        current={step}
        items={[{ title: 'Chuẩn bị tệp' }, { title: 'Xem trước' }, { title: 'Kết quả' }]}
        style={{ marginBottom: 24 }}
      />

      {step === 0 && (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Alert
            type="info"
            showIcon
            message="Cách xếp học viên bằng Excel"
            description={
              <ol style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                <li>Học viên phải đã có trong hệ thống — file chỉ dùng để nhận diện, không tạo mới.</li>
                <li>Ưu tiên khớp theo &quot;Mã học viên&quot;; nếu trống thì khớp theo &quot;Điện thoại&quot; rồi &quot;Họ và tên&quot;.</li>
                <li>Ngày ghi danh lấy theo ngày nhập; &quot;Giảm học phí&quot; để trống là 0.</li>
                <li>Dòng không khớp hoặc trùng sẽ được liệt kê ở bước kết quả để bạn sửa.</li>
              </ol>
            }
          />

          <Alert
            type={remainingSlots === 0 ? 'error' : 'success'}
            showIcon
            message={
              remainingSlots === 0
                ? 'Lớp đã đầy — không còn chỗ trống.'
                : `Lớp còn ${remainingSlots} chỗ trống.`
            }
          />

          <Space>
            <Button
              icon={<DownloadOutlined />}
              loading={templateMutation.isPending}
              onClick={() => templateMutation.mutate()}
            >
              Tải tệp mẫu
            </Button>
            <Button
              type="primary"
              icon={<UploadOutlined />}
              loading={pickFileMutation.isPending}
              disabled={remainingSlots === 0}
              onClick={() => pickFileMutation.mutate()}
            >
              Chọn tệp Excel
            </Button>
          </Space>
        </Space>
      )}

      {step === 1 && (
        <>
          <Alert
            type="success"
            showIcon
            icon={<FileExcelOutlined />}
            message={`Đã đọc ${rows.length} dòng`}
            description={fileName}
            style={{ marginBottom: 16 }}
          />

          {overLimit && (
            <Alert
              type="warning"
              showIcon
              message={`File có ${rows.length} dòng nhưng lớp chỉ còn ${remainingSlots} chỗ. Các học viên vượt sĩ số sẽ báo lỗi.`}
              style={{ marginBottom: 16 }}
            />
          )}

          <Table
            size="small"
            rowKey={(_, index) => String(index)}
            dataSource={rows.slice(0, 100)}
            pagination={false}
            scroll={{ y: 320, x: 'max-content' }}
            columns={[
              { title: 'Mã HV', dataIndex: 'code', width: 120 },
              { title: 'Họ và tên', dataIndex: 'fullName', width: 200 },
              { title: 'Điện thoại', dataIndex: 'phone', width: 140 },
              { title: 'Giảm học phí', dataIndex: 'discount', width: 130 },
              { title: 'Ghi chú', dataIndex: 'note' }
            ]}
          />

          {rows.length > 100 && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Chỉ hiển thị 100 dòng đầu để xem trước; toàn bộ {rows.length} dòng sẽ được xử lý.
            </Typography.Text>
          )}
        </>
      )}

      {step === 2 && result && (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Space size={40}>
            <Statistic title="Tổng dòng" value={result.total} />
            <Statistic title="Đã xếp lớp" value={result.inserted} valueStyle={{ color: '#52c41a' }} />
            <Statistic title="Lỗi" value={result.failed} valueStyle={{ color: '#ff4d4f' }} />
          </Space>

          {result.errors.length > 0 && (
            <>
              <Alert type="warning" showIcon message="Các dòng không xếp được" />
              <Table
                size="small"
                rowKey={(row) => String(row.row)}
                dataSource={result.errors}
                pagination={{ pageSize: 8, size: 'small' }}
                columns={[
                  { title: 'Dòng trong tệp', dataIndex: 'row', width: 140 },
                  { title: 'Nguyên nhân', dataIndex: 'message' }
                ]}
              />
            </>
          )}
        </Space>
      )}
    </Modal>
  )
}
