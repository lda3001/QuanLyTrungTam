import { MuiDatePickerApi as DatePicker } from '@/components/common/MuiControls'
import { useEffect, useState } from 'react'
import { Alert, Flex, InputNumber, Modal, Space, Table, Typography } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { SearchInput } from '@/components/common'
import { useDebounce } from '@/hooks/useDebounce'
import { useNotify } from '@/hooks/useNotify'
import { classService } from '@/services/academic.service'
import { dayjs, DATE_FORMAT, formatDate, ISO_DATE } from '@/utils/format'
import { GenderLabel } from '@shared/constants/enums'
import type { Student } from '@shared/types/entities'

interface Props {
  open: boolean
  classId: number
  className: string
  remainingSlots: number
  onClose: () => void
}

/**
 * Xếp học viên vào lớp.
 *
 * Chỉ hiện những học viên đang hoạt động và CHƯA có trong lớp — lọc ở phía
 * server, tránh cảnh chọn xong mới báo "học viên đã có trong lớp".
 */
export function EnrollModal({ open, classId, className, remainingSlots, onClose }: Props) {
  const notify = useNotify()
  const queryClient = useQueryClient()

  const [keyword, setKeyword] = useState('')
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [enrollDate, setEnrollDate] = useState(dayjs().format(ISO_DATE))
  const [discount, setDiscount] = useState(0)

  const debouncedKeyword = useDebounce(keyword, 350)

  useEffect(() => {
    if (open) {
      setKeyword('')
      setSelectedIds([])
      setDiscount(0)
      setEnrollDate(dayjs().format(ISO_DATE))
    }
  }, [open])

  const { data: students = [], isFetching } = useQuery({
    queryKey: ['available-students', classId, debouncedKeyword],
    queryFn: () => classService.availableStudents(classId, debouncedKeyword || undefined),
    enabled: open
  })

  const mutation = useMutation({
    mutationFn: () =>
      classService.enroll({
        classId,
        studentIds: selectedIds,
        enrollDate,
        discount,
        note: null
      }),
    onSuccess: (count) => {
      notify.success(`Đã xếp ${count} học viên vào lớp.`)
      void queryClient.invalidateQueries({ queryKey: ['class-students', classId] })
      void queryClient.invalidateQueries({ queryKey: ['class', classId] })
      void queryClient.invalidateQueries({ queryKey: ['classes'] })
      onClose()
    },
    onError: (err) => notify.error(err)
  })

  const overLimit = selectedIds.length > remainingSlots

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={`Xếp học viên vào lớp ${className}`}
      width={860}
      okText={`Xếp lớp (${selectedIds.length})`}
      cancelText="Huỷ"
      okButtonProps={{ disabled: selectedIds.length === 0 || overLimit }}
      confirmLoading={mutation.isPending}
      onOk={() => mutation.mutate()}
      destroyOnClose
    >
      <Alert
        type={overLimit ? 'error' : 'info'}
        showIcon
        message={
          overLimit
            ? `Vượt quá sĩ số: lớp chỉ còn ${remainingSlots} chỗ trống.`
            : `Lớp còn ${remainingSlots} chỗ trống.`
        }
        style={{ marginBottom: 16 }}
      />

      <Flex gap={12} wrap="wrap" style={{ marginBottom: 16 }}>
        <SearchInput value={keyword} onChange={setKeyword} placeholder="Tìm học viên..." width={280} />

        <Space>
          <Typography.Text type="secondary">Ngày ghi danh:</Typography.Text>
          <DatePicker
            value={dayjs(enrollDate, ISO_DATE)}
            onChange={(d) => setEnrollDate(d ? d.format(ISO_DATE) : dayjs().format(ISO_DATE))}
            format={DATE_FORMAT}
            allowClear={false}
          />
        </Space>

        <Space>
          <Typography.Text type="secondary">Giảm học phí:</Typography.Text>
          <InputNumber
            value={discount}
            onChange={(v) => setDiscount(v ?? 0)}
            min={0}
            step={100_000}
            addonAfter="₫"
            style={{ width: 170 }}
            formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
            parser={(value) => Number(`${value}`.replace(/\./g, '')) as never}
          />
        </Space>
      </Flex>

      <Table<Student>
        rowKey="id"
        size="small"
        loading={isFetching}
        dataSource={students}
        scroll={{ y: 360, x: 'max-content' }}
        pagination={false}
        rowSelection={{
          selectedRowKeys: selectedIds,
          onChange: (keys) => setSelectedIds(keys as number[])
        }}
        onRow={(row) => ({
          // Bấm cả dòng để chọn — nhanh hơn phải nhắm đúng ô checkbox
          onClick: () =>
            setSelectedIds((prev) =>
              prev.includes(row.id) ? prev.filter((id) => id !== row.id) : [...prev, row.id]
            ),
          style: { cursor: 'pointer' }
        })}
        columns={[
          { title: 'Mã HV', dataIndex: 'code', width: 110 },
          { title: 'Họ và tên', dataIndex: 'fullName', width: 200 },
          {
            title: 'Giới tính',
            dataIndex: 'gender',
            width: 100,
            render: (v: keyof typeof GenderLabel) => GenderLabel[v]
          },
          { title: 'Ngày sinh', dataIndex: 'birthDate', width: 120, render: (v: string | null) => formatDate(v) },
          { title: 'Điện thoại', dataIndex: 'phone', width: 130, render: (v: string | null) => v ?? '—' }
        ]}
        locale={{ emptyText: 'Không còn học viên nào phù hợp' }}
      />
    </Modal>
  )
}
