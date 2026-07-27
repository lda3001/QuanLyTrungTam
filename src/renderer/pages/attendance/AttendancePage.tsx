import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Flex,
  Input,
  Radio,
  Row,
  Segmented,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { CheckSquareOutlined, SaveOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/common/PageHeader'
import { DataTable } from '@/components/common/DataTable'
import { Can, PersonCell, SearchInput } from '@/components/common'
import { useTableQuery } from '@/hooks/useTableQuery'
import { useNotify } from '@/hooks/useNotify'
import { attendanceService, classService, scheduleService } from '@/services/academic.service'
import { dayjs, DATE_FORMAT, formatDate, ISO_DATE } from '@/utils/format'
import {
  AttendanceStatus,
  AttendanceStatusColor,
  AttendanceStatusLabel
} from '@shared/constants/enums'
import { PERMISSIONS } from '@shared/constants/permissions'
import type { AttendanceDetail } from '@shared/types/entities'
import type { AttendanceHistoryRow } from '@shared/types/dto'

/** Reference cố định cho danh sách rỗng — xem giải thích tại chỗ sử dụng */
const EMPTY_ROWS: AttendanceDetail[] = []

/**
 * Điểm danh theo buổi.
 *
 * Luồng: chọn lớp → chọn buổi → chấm trạng thái cho từng học viên → Lưu.
 *
 * Trạng thái nằm trong state cục bộ cho tới khi bấm Lưu. Lý do: giáo viên
 * thường chấm cả lớp 25 người trong vài giây; gọi API sau mỗi lần bấm sẽ tạo
 * 25 lượt ghi database và dễ sinh trạng thái nửa vời nếu máy tắt giữa chừng.
 */
export default function AttendancePage() {
  const notify = useNotify()
  const queryClient = useQueryClient()

  const [classId, setClassId] = useState<number | undefined>()
  const [sessionId, setSessionId] = useState<number | undefined>()
  const [marks, setMarks] = useState<Record<number, AttendanceStatus>>({})
  const [notes, setNotes] = useState<Record<number, string>>({})
  const [dirty, setDirty] = useState(false)

  const { data: classOptions = [] } = useQuery({
    queryKey: ['class-options'],
    queryFn: () => classService.options(),
    staleTime: 5 * 60_000
  })

  const { data: sessions = [], isFetching: loadingSessions } = useQuery({
    queryKey: ['class-sessions', classId],
    queryFn: () => scheduleService.list({ classId }),
    enabled: !!classId
  })

  const { data: attendanceRows, isFetching: loadingRows } = useQuery({
    queryKey: ['attendance', sessionId],
    queryFn: () => attendanceService.bySession(sessionId as number),
    enabled: !!sessionId
  })

  /**
   * KHÔNG dùng `const { data: rows = [] } = useQuery(...)`.
   *
   * Khi query chưa chạy (chưa chọn buổi học), `data` là undefined và giá trị
   * mặc định `[]` sẽ tạo một MẢNG MỚI ở mỗi lần render. useEffect bên dưới so
   * sánh dependency bằng reference nên sẽ chạy lại vô hạn → setState → render
   * → effect... khiến luồng chính bị chiếm và toàn bộ giao diện đơ.
   *
   * Hằng số EMPTY_ROWS ở cấp module giữ nguyên một reference duy nhất.
   */
  const rows = attendanceRows ?? EMPTY_ROWS

  // Nạp trạng thái đã lưu (hoặc mặc định "có mặt") mỗi khi đổi buổi
  useEffect(() => {
    const nextMarks: Record<number, AttendanceStatus> = {}
    const nextNotes: Record<number, string> = {}
    for (const r of rows) {
      nextMarks[r.studentId] = r.status
      if (r.note) nextNotes[r.studentId] = r.note
    }
    setMarks(nextMarks)
    setNotes(nextNotes)
    setDirty(false)
  }, [rows])

  const saveMutation = useMutation({
    mutationFn: () =>
      attendanceService.mark({
        sessionId: sessionId as number,
        items: rows.map((r) => ({
          studentId: r.studentId,
          status: marks[r.studentId] ?? AttendanceStatus.PRESENT,
          note: notes[r.studentId] || null
        }))
      }),
    onSuccess: (count) => {
      notify.success(`Đã lưu điểm danh cho ${count} học viên.`)
      setDirty(false)
      void queryClient.invalidateQueries({ queryKey: ['attendance'] })
      void queryClient.invalidateQueries({ queryKey: ['class-sessions'] })
      void queryClient.invalidateQueries({ queryKey: ['attendance-history'] })
    },
    onError: (err) => notify.error(err)
  })

  const setAll = (status: AttendanceStatus): void => {
    const next: Record<number, AttendanceStatus> = {}
    for (const r of rows) next[r.studentId] = status
    setMarks(next)
    setDirty(true)
  }

  const summary = useMemo(() => {
    const acc = { present: 0, late: 0, excused: 0, absent: 0 }
    for (const r of rows) {
      const status = marks[r.studentId] ?? AttendanceStatus.PRESENT
      acc[status]++
    }
    return acc
  }, [rows, marks])

  const selectedSession = sessions.find((s) => s.id === sessionId)

  const columns: ColumnsType<AttendanceDetail> = [
    {
      title: 'Học viên',
      dataIndex: 'studentName',
      width: 240,
      render: (v: string, row) => <PersonCell name={v} sub={row.studentCode} />
    },
    {
      title: 'Trạng thái',
      key: 'status',
      width: 420,
      render: (_, row) => (
        <Radio.Group
          value={marks[row.studentId] ?? AttendanceStatus.PRESENT}
          onChange={(e) => {
            setMarks((prev) => ({ ...prev, [row.studentId]: e.target.value }))
            setDirty(true)
          }}
          optionType="button"
          buttonStyle="solid"
          size="small"
          options={Object.entries(AttendanceStatusLabel).map(([value, label]) => ({ value, label }))}
        />
      )
    },
    {
      title: 'Ghi chú',
      key: 'note',
      render: (_, row) => (
        <Input
          size="small"
          placeholder="Lý do nghỉ, đi muộn..."
          value={notes[row.studentId] ?? ''}
          onChange={(e) => {
            setNotes((prev) => ({ ...prev, [row.studentId]: e.target.value }))
            setDirty(true)
          }}
          maxLength={200}
        />
      )
    }
  ]

  return (
    <>
      <PageHeader
        title="Điểm danh"
        subtitle="Chấm chuyên cần theo từng buổi học"
        breadcrumbs={[{ title: 'Vận hành' }, { title: 'Điểm danh' }]}
        icon={<CheckSquareOutlined style={{ fontSize: 26, color: '#52c41a' }} />}
      />

      <Tabs
        defaultActiveKey="mark"
        items={[
          {
            key: 'mark',
            label: 'Chấm điểm danh',
            children: (
              <>
                <Card style={{ marginBottom: 16 }}>
                  <Row gutter={[16, 16]} align="middle">
                    <Col xs={24} md={8}>
                      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 6 }}>
                        Lớp học
                      </Typography.Text>
                      <Select
                        placeholder="Chọn lớp học"
                        style={{ width: '100%' }}
                        value={classId}
                        onChange={(v) => {
                          setClassId(v)
                          setSessionId(undefined)
                        }}
                        options={classOptions}
                        showSearch
                        filterOption={(input, option) =>
                          String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                        }
                      />
                    </Col>

                    <Col xs={24} md={10}>
                      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 6 }}>
                        Buổi học
                      </Typography.Text>
                      <Select
                        placeholder={classId ? 'Chọn buổi học' : 'Chọn lớp trước'}
                        style={{ width: '100%' }}
                        value={sessionId}
                        onChange={setSessionId}
                        disabled={!classId}
                        loading={loadingSessions}
                        options={sessions.map((s) => ({
                          value: s.id,
                          label: `${formatDate(s.sessionDate)} · ${s.startTime}–${s.endTime}${
                            s.status === 'done' ? ' (đã điểm danh)' : ''
                          }`
                        }))}
                        // Mặc định đưa buổi gần nhất lên đầu để đỡ phải cuộn
                        listHeight={320}
                      />
                    </Col>

                    <Col xs={24} md={6}>
                      <Can permission={PERMISSIONS.ATTENDANCE_MARK}>
                        <Button
                          type="primary"
                          icon={<SaveOutlined />}
                          block
                          size="large"
                          disabled={!sessionId || rows.length === 0 || !dirty}
                          loading={saveMutation.isPending}
                          onClick={() => saveMutation.mutate()}
                          style={{ marginTop: 22 }}
                        >
                          Lưu điểm danh
                        </Button>
                      </Can>
                    </Col>
                  </Row>
                </Card>

                {!sessionId ? (
                  <Card>
                    <Empty description="Chọn lớp và buổi học để bắt đầu điểm danh" />
                  </Card>
                ) : (
                  <>
                    {selectedSession && (
                      <Card style={{ marginBottom: 16 }}>
                        <Row gutter={16}>
                          <Col xs={12} md={6}>
                            <Statistic
                              title="Có mặt"
                              value={summary.present}
                              valueStyle={{ color: '#52c41a' }}
                            />
                          </Col>
                          <Col xs={12} md={6}>
                            <Statistic title="Đi muộn" value={summary.late} valueStyle={{ color: '#fa8c16' }} />
                          </Col>
                          <Col xs={12} md={6}>
                            <Statistic
                              title="Nghỉ có phép"
                              value={summary.excused}
                              valueStyle={{ color: '#faad14' }}
                            />
                          </Col>
                          <Col xs={12} md={6}>
                            <Statistic
                              title="Nghỉ không phép"
                              value={summary.absent}
                              valueStyle={{ color: '#ff4d4f' }}
                            />
                          </Col>
                        </Row>
                      </Card>
                    )}

                    {dirty && (
                      <Alert
                        type="warning"
                        showIcon
                        message="Bạn có thay đổi chưa lưu"
                        style={{ marginBottom: 16 }}
                        action={
                          <Button
                            size="small"
                            type="primary"
                            loading={saveMutation.isPending}
                            onClick={() => saveMutation.mutate()}
                          >
                            Lưu ngay
                          </Button>
                        }
                      />
                    )}

                    <Card
                      title={
                        selectedSession
                          ? `${selectedSession.className} — ${formatDate(selectedSession.sessionDate)} (${selectedSession.startTime}–${selectedSession.endTime})`
                          : 'Danh sách điểm danh'
                      }
                      extra={
                        <Can permission={PERMISSIONS.ATTENDANCE_MARK}>
                          <Space>
                            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                              Chấm nhanh:
                            </Typography.Text>
                            <Segmented
                              size="small"
                              options={[
                                { label: 'Tất cả có mặt', value: AttendanceStatus.PRESENT },
                                { label: 'Tất cả vắng', value: AttendanceStatus.ABSENT }
                              ]}
                              onChange={(v) => setAll(v as AttendanceStatus)}
                            />
                          </Space>
                        </Can>
                      }
                      styles={{ body: { padding: 0 } }}
                    >
                      <Table<AttendanceDetail>
                        className="app-table"
                        rowKey="studentId"
                        columns={columns}
                        dataSource={rows}
                        loading={loadingRows}
                        pagination={false}
                        scroll={{ x: 'max-content', y: 480 }}
                        locale={{
                          emptyText: <Empty description="Lớp chưa có học viên nào đang theo học" />
                        }}
                      />
                    </Card>
                  </>
                )}
              </>
            )
          },
          {
            key: 'history',
            label: 'Lịch sử điểm danh',
            children: <AttendanceHistoryTab />
          }
        ]}
      />
    </>
  )
}

/* ----------------------- Tab lịch sử ----------------------- */

function AttendanceHistoryTab() {
  const table = useTableQuery<{ classId?: number; status?: AttendanceStatus; from?: string; to?: string }>({
    defaultPageSize: 20,
    defaultFilters: {
      from: dayjs().subtract(1, 'month').format(ISO_DATE),
      to: dayjs().format(ISO_DATE)
    }
  })

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['attendance-history', table.query],
    queryFn: () => attendanceService.history(table.query),
    placeholderData: (prev) => prev
  })

  const { data: classOptions = [] } = useQuery({
    queryKey: ['class-options'],
    queryFn: () => classService.options(),
    staleTime: 5 * 60_000
  })

  const columns: ColumnsType<AttendanceHistoryRow> = [
    {
      title: 'Ngày học',
      dataIndex: 'sessionDate',
      width: 130,
      render: (v: string) => formatDate(v)
    },
    {
      title: 'Giờ',
      key: 'time',
      width: 130,
      render: (_, row) => `${row.startTime}–${row.endTime}`
    },
    {
      title: 'Lớp',
      dataIndex: 'className',
      width: 200,
      render: (v: string, row) => (
        <div>
          <div>{v}</div>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {row.courseName}
          </Typography.Text>
        </div>
      )
    },
    {
      title: 'Học viên',
      dataIndex: 'studentName',
      width: 220,
      render: (v: string, row) => <PersonCell name={v} sub={row.studentCode} />
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      width: 150,
      render: (v: AttendanceStatus) => (
        <Tag color={AttendanceStatusColor[v]} style={{ margin: 0 }}>
          {AttendanceStatusLabel[v]}
        </Tag>
      )
    },
    { title: 'Ghi chú', dataIndex: 'note', width: 200, render: (v: string | null) => v ?? '—' },
    {
      title: 'Người chấm',
      dataIndex: 'markedByName',
      width: 160,
      render: (v: string | null) => v ?? '—'
    }
  ]

  return (
    <DataTable<AttendanceHistoryRow>
      columns={columns}
      dataSource={data?.items ?? []}
      total={data?.total}
      page={table.page}
      pageSize={table.pageSize}
      loading={isLoading || isFetching}
      onChange={table.handleTableChange}
      toolbar={
        <Flex gap={12} wrap="wrap">
          <SearchInput
            value={table.keywordInput}
            onChange={table.setKeyword}
            placeholder="Tìm theo học viên hoặc lớp..."
            width={280}
          />
          <Select
            allowClear
            placeholder="Lớp học"
            style={{ width: 220 }}
            value={table.filters.classId}
            onChange={(classId) => table.setFilters({ classId })}
            options={classOptions}
            showSearch
            filterOption={(input, option) =>
              String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
          />
          <Select
            allowClear
            placeholder="Trạng thái"
            style={{ width: 170 }}
            value={table.filters.status}
            onChange={(status) => table.setFilters({ status })}
            options={Object.entries(AttendanceStatusLabel).map(([value, label]) => ({ value, label }))}
          />
          <DatePicker.RangePicker
            format={DATE_FORMAT}
            value={[
              table.filters.from ? dayjs(table.filters.from, ISO_DATE) : null,
              table.filters.to ? dayjs(table.filters.to, ISO_DATE) : null
            ]}
            onChange={(dates) =>
              table.setFilters({
                from: dates?.[0]?.format(ISO_DATE),
                to: dates?.[1]?.format(ISO_DATE)
              })
            }
          />
        </Flex>
      }
    />
  )
}
