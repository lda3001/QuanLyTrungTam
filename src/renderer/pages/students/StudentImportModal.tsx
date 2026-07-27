import { useState } from 'react'
import { Alert, Button, Modal, Space, Statistic, Steps, Table, Typography } from 'antd'
import { DownloadOutlined, FileExcelOutlined, UploadOutlined } from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { fileService } from '@/services/admin.service'
import { studentService } from '@/services/academic.service'
import { useNotify } from '@/hooks/useNotify'
import type { ImportResult, StudentImportRow } from '@shared/types/dto'

interface Props {
  open: boolean
  onClose: () => void
}

/**
 * Nhập học viên từ Excel, 3 bước: tải mẫu → chọn file → xem kết quả.
 *
 * Tên cột trong file được ánh xạ theo NHÃN tiếng Việt, vì người dùng sẽ sửa
 * file trên máy họ và không quan tâm tên trường kỹ thuật.
 */
const COLUMN_MAP: Record<string, keyof StudentImportRow> = {
  'Mã học viên': 'code',
  'Họ và tên': 'fullName',
  'Giới tính': 'gender',
  'Ngày sinh': 'birthDate',
  Email: 'email',
  'Điện thoại': 'phone',
  'Địa chỉ': 'address',
  'Lớp (ở trường)': 'schoolClass',
  'Người giám hộ': 'guardianName',
  'SĐT giám hộ': 'guardianPhone',
  'Ghi chú': 'note'
}

export function StudentImportModal({ open, onClose }: Props) {
  const notify = useNotify()
  const queryClient = useQueryClient()

  const [step, setStep] = useState(0)
  const [rows, setRows] = useState<StudentImportRow[]>([])
  const [fileName, setFileName] = useState('')
  const [result, setResult] = useState<ImportResult | null>(null)

  const templateMutation = useMutation({
    mutationFn: () => studentService.importTemplate(),
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
        const row: StudentImportRow = { fullName: '' }
        for (const [label, key] of Object.entries(COLUMN_MAP)) {
          const value = raw[label]
          if (value !== undefined && value !== null && value !== '') {
            row[key] = String(value).trim() as never
          }
        }
        return row
      })

      const valid = mapped.filter((r) => r.fullName)
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
    mutationFn: () => studentService.importRows(rows),
    onSuccess: (res) => {
      setResult(res)
      setStep(2)
      void queryClient.invalidateQueries({ queryKey: ['students'] })
      if (res.failed === 0) notify.success(`Đã nhập ${res.inserted} học viên.`)
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

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      title="Nhập học viên từ Excel"
      width={860}
      destroyOnClose
      footer={
        step === 1 ? (
          <Space>
            <Button onClick={() => setStep(0)}>Chọn tệp khác</Button>
            <Button type="primary" loading={importMutation.isPending} onClick={() => importMutation.mutate()}>
              Nhập {rows.length} dòng
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
            message="Cách nhập dữ liệu"
            description={
              <ol style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                <li>Tải tệp mẫu và điền dữ liệu theo đúng tiêu đề cột.</li>
                <li>Cột &quot;Họ và tên&quot; là bắt buộc; bỏ trống &quot;Mã học viên&quot; để hệ thống tự sinh.</li>
                <li>Giới tính nhận giá trị: Nam / Nữ / Khác. Ngày sinh: dd/MM/yyyy.</li>
                <li>Mỗi lần nhập tối đa 5.000 dòng.</li>
              </ol>
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

          <Table
            size="small"
            rowKey={(_, index) => String(index)}
            dataSource={rows.slice(0, 100)}
            pagination={false}
            scroll={{ y: 320, x: 'max-content' }}
            columns={[
              { title: 'Mã', dataIndex: 'code', width: 100 },
              { title: 'Họ và tên', dataIndex: 'fullName', width: 180 },
              { title: 'Giới tính', dataIndex: 'gender', width: 90 },
              { title: 'Ngày sinh', dataIndex: 'birthDate', width: 110 },
              { title: 'Lớp (ở trường)', dataIndex: 'schoolClass', width: 120 },
              { title: 'Điện thoại', dataIndex: 'phone', width: 120 },
              { title: 'Email', dataIndex: 'email', width: 180 },
              { title: 'Giám hộ', dataIndex: 'guardianName', width: 150 }
            ]}
          />

          {rows.length > 100 && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Chỉ hiển thị 100 dòng đầu để xem trước; toàn bộ {rows.length} dòng sẽ được nhập.
            </Typography.Text>
          )}
        </>
      )}

      {step === 2 && result && (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Space size={40}>
            <Statistic title="Tổng dòng" value={result.total} />
            <Statistic title="Thành công" value={result.inserted} valueStyle={{ color: '#52c41a' }} />
            <Statistic title="Lỗi" value={result.failed} valueStyle={{ color: '#ff4d4f' }} />
          </Space>

          {result.errors.length > 0 && (
            <>
              <Alert type="warning" showIcon message="Các dòng không nhập được" />
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
