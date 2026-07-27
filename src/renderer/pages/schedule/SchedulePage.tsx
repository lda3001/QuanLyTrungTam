import { useMemo, useState, type DragEvent, type ReactElement } from 'react'
import {
  Alert,
  Badge,
  Button,
  Calendar,
  Card,
  Col,
  Dropdown,
  Flex,
  Row,
  Segmented,
  Select,
  Space,
  Spin,
  Tooltip,
  Typography,
  theme
} from 'antd'
import type { Dayjs } from 'dayjs'
import {
  CalendarOutlined,
  DeleteOutlined,
  EditOutlined,
  LeftOutlined,
  PlusOutlined,
  RightOutlined
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/common/PageHeader'
import { Can } from '@/components/common'
import { SessionFormModal } from './SessionFormModal'
import { useNotify } from '@/hooks/useNotify'
import { classService, scheduleService, teacherService } from '@/services/academic.service'
import { dayjs, ISO_DATE } from '@/utils/format'
import { SessionStatusLabel } from '@shared/constants/enums'
import { PERMISSIONS } from '@shared/constants/permissions'
import type { ClassSessionDetail } from '@shared/types/entities'

type ViewMode = 'week' | 'month'

/** Reference cố định cho danh sách rỗng — tránh tính lại useMemo mỗi render */
const EMPTY_SESSIONS: ClassSessionDetail[] = []

const STATUS_COLOR: Record<string, string> = {
  scheduled: '#1677ff',
  done: '#52c41a',
  cancelled: '#ff4d4f'
}

/**
 * Lịch học với kéo–thả.
 *
 * Dùng HTML5 Drag and Drop API thay vì thư viện ngoài: nhu cầu ở đây rất gọn
 * (kéo một buổi sang ngày khác), thêm một dependency 30KB là không đáng.
 *
 * Quy tắc: chỉ dời được buổi CHƯA dạy. Buổi đã điểm danh mà dời ngày thì dữ
 * liệu chuyên cần sẽ sai lệch — main process cũng chặn việc này.
 */
export default function SchedulePage() {
  const notify = useNotify()
  const queryClient = useQueryClient()
  const { token } = theme.useToken()

  const [view, setView] = useState<ViewMode>('week')
  const [anchor, setAnchor] = useState<Dayjs>(dayjs())
  const [classId, setClassId] = useState<number | undefined>()
  const [teacherId, setTeacherId] = useState<number | undefined>()

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [defaultDate, setDefaultDate] = useState<string | undefined>()
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)

  // Khoảng ngày cần tải: đúng phạm vi đang xem, không tải dư
  const range = useMemo(() => {
    if (view === 'week') {
      const start = anchor.startOf('week')
      return { from: start.format(ISO_DATE), to: start.add(6, 'day').format(ISO_DATE) }
    }
    const start = anchor.startOf('month').startOf('week')
    const end = anchor.endOf('month').endOf('week')
    return { from: start.format(ISO_DATE), to: end.format(ISO_DATE) }
  }, [view, anchor])

  const { data: sessionData, isFetching } = useQuery({
    queryKey: ['sessions', range, classId, teacherId],
    queryFn: () => scheduleService.list({ ...range, classId, teacherId }),
    placeholderData: (prev) => prev
  })

  // Hằng số EMPTY_SESSIONS giữ reference ổn định khi chưa có dữ liệu; viết
  // `= []` ngay trong destructuring sẽ tạo mảng mới mỗi render và khiến
  // useMemo bên dưới tính lại vô ích ở mọi lần render.
  const sessions = sessionData ?? EMPTY_SESSIONS

  const { data: classOptions = [] } = useQuery({
    queryKey: ['class-options'],
    queryFn: () => classService.options(),
    staleTime: 5 * 60_000
  })

  const { data: teacherOptions = [] } = useQuery({
    queryKey: ['teacher-options'],
    queryFn: () => teacherService.options(),
    staleTime: 5 * 60_000
  })

  const moveMutation = useMutation({
    mutationFn: (input: { id: number; sessionDate: string; startTime: string; endTime: string }) =>
      scheduleService.move(input),
    onSuccess: () => {
      notify.success('Đã dời lịch buổi học.')
      void queryClient.invalidateQueries({ queryKey: ['sessions'] })
      void queryClient.invalidateQueries({ queryKey: ['class-sessions'] })
    },
    onError: (err) => notify.error(err)
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => scheduleService.remove(id),
    onSuccess: () => {
      notify.success('Đã xoá buổi học.')
      void queryClient.invalidateQueries({ queryKey: ['sessions'] })
    },
    onError: (err) => notify.error(err)
  })

  /** Gom buổi học theo ngày để mỗi ô lịch tra cứu trong O(1) */
  const byDate = useMemo(() => {
    const map = new Map<string, ClassSessionDetail[]>()
    for (const s of sessions) {
      const arr = map.get(s.sessionDate) ?? []
      arr.push(s)
      map.set(s.sessionDate, arr)
    }
    for (const arr of map.values()) arr.sort((a, b) => a.startTime.localeCompare(b.startTime))
    return map
  }, [sessions])

  const handleDrop = (targetDate: string, event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault()
    setDragOverKey(null)

    const raw = event.dataTransfer.getData('application/json')
    if (!raw) return

    try {
      const payload = JSON.parse(raw) as { id: number; startTime: string; endTime: string; date: string }
      if (payload.date === targetDate) return // thả lại chỗ cũ, không cần gọi API

      moveMutation.mutate({
        id: payload.id,
        sessionDate: targetDate,
        startTime: payload.startTime,
        endTime: payload.endTime
      })
    } catch {
      /* dữ liệu kéo không hợp lệ — bỏ qua im lặng */
    }
  }

  const renderEvent = (session: ClassSessionDetail): ReactElement => {
    const canDrag = session.status !== 'done'

    return (
      <Dropdown
        key={session.id}
        trigger={['contextMenu']}
        menu={{
          items: [
            { key: 'edit', icon: <EditOutlined />, label: 'Sửa buổi học' },
            { type: 'divider' },
            { key: 'delete', icon: <DeleteOutlined />, label: 'Xoá', danger: true }
          ],
          onClick: ({ key }) => {
            if (key === 'edit') {
              setEditingId(session.id)
              setModalOpen(true)
            } else if (key === 'delete') {
              notify.confirmDelete({
                content: `Xoá buổi học lớp ${session.className} ngày ${dayjs(session.sessionDate).format('DD/MM/YYYY')}?`,
                onOk: () => deleteMutation.mutateAsync(session.id)
              })
            }
          }
        }}
      >
        <Tooltip
          title={
            <div>
              <div>
                <strong>{session.className}</strong>
              </div>
              <div>{session.courseName}</div>
              <div>
                {session.startTime} – {session.endTime}
                {session.room ? ` · ${session.room}` : ''}
              </div>
              <div>GV: {session.teacherName ?? 'Chưa phân công'}</div>
              <div>Trạng thái: {SessionStatusLabel[session.status]}</div>
              <div style={{ marginTop: 4, opacity: 0.7 }}>Chuột phải để sửa/xoá</div>
            </div>
          }
        >
          <div
            className="schedule-event"
            draggable={canDrag}
            onDragStart={(e) => {
              e.dataTransfer.setData(
                'application/json',
                JSON.stringify({
                  id: session.id,
                  startTime: session.startTime,
                  endTime: session.endTime,
                  date: session.sessionDate
                })
              )
              e.dataTransfer.effectAllowed = 'move'
            }}
            onDoubleClick={() => {
              setEditingId(session.id)
              setModalOpen(true)
            }}
            style={{
              background: `${STATUS_COLOR[session.status]}18`,
              borderLeftColor: STATUS_COLOR[session.status],
              color: token.colorText,
              cursor: canDrag ? 'grab' : 'default',
              opacity: session.status === 'cancelled' ? 0.6 : 1
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 11 }}>
              {session.startTime}–{session.endTime}
            </div>
            <div
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {session.className}
            </div>
            {session.room && (
              <div style={{ fontSize: 10, opacity: 0.7 }}>
                {session.room} · {session.attendedCount}/{session.totalStudents}
              </div>
            )}
          </div>
        </Tooltip>
      </Dropdown>
    )
  }

  /* ---------------------------- Xem theo tuần ---------------------------- */

  const weekDays = useMemo(() => {
    const start = anchor.startOf('week')
    return Array.from({ length: 7 }, (_, i) => start.add(i, 'day'))
  }, [anchor])

  const weekView = (
    <Row gutter={8}>
      {weekDays.map((day) => {
        const key = day.format(ISO_DATE)
        const items = byDate.get(key) ?? []
        const isToday = day.isSame(dayjs(), 'day')

        return (
          <Col key={key} flex="1 1 14%" style={{ minWidth: 150 }}>
            <Card
              size="small"
              styles={{ body: { padding: 8, minHeight: 380 } }}
              style={{
                borderColor: isToday ? token.colorPrimary : undefined,
                borderWidth: isToday ? 2 : 1,
                background: dragOverKey === key ? token.colorPrimaryBg : undefined
              }}
              title={
                <Flex justify="space-between" align="center">
                  <Typography.Text strong={isToday} style={{ fontSize: 13 }}>
                    {day.format('ddd')}
                  </Typography.Text>
                  <Badge
                    count={items.length}
                    showZero={false}
                    style={{ backgroundColor: token.colorPrimary }}
                  />
                </Flex>
              }
              extra={
                <Typography.Text type={isToday ? 'success' : 'secondary'} style={{ fontSize: 12 }}>
                  {day.format('DD/MM')}
                </Typography.Text>
              }
            >
              <div
                className={`schedule-cell-droppable ${dragOverKey === key ? 'schedule-cell-over' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                  setDragOverKey(key)
                }}
                onDragLeave={() => setDragOverKey((k) => (k === key ? null : k))}
                onDrop={(e) => handleDrop(key, e)}
                onDoubleClick={() => {
                  setEditingId(null)
                  setDefaultDate(key)
                  setModalOpen(true)
                }}
                style={{ minHeight: 340 }}
              >
                {items.length === 0 ? (
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    Trống
                  </Typography.Text>
                ) : (
                  items.map(renderEvent)
                )}
              </div>
            </Card>
          </Col>
        )
      })}
    </Row>
  )

  /* ---------------------------- Xem theo tháng ---------------------------- */

  const monthView = (
    <Card styles={{ body: { padding: 12 } }}>
      <Calendar
        value={anchor}
        onSelect={(date, info) => {
          // Bấm sang tháng khác thì chuyển tháng thay vì chỉ chọn ngày
          if (info.source === 'date') setAnchor(date)
        }}
        headerRender={() => null}
        cellRender={(current, info) => {
          if (info.type !== 'date') return info.originNode

          const key = current.format(ISO_DATE)
          const items = byDate.get(key) ?? []

          return (
            <div
              className={`schedule-cell-droppable ${dragOverKey === key ? 'schedule-cell-over' : ''}`}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOverKey(key)
              }}
              onDragLeave={() => setDragOverKey((k) => (k === key ? null : k))}
              onDrop={(e) => handleDrop(key, e)}
              style={{ minHeight: 64 }}
            >
              {items.slice(0, 3).map(renderEvent)}
              {items.length > 3 && (
                <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                  +{items.length - 3} buổi khác
                </Typography.Text>
              )}
            </div>
          )
        }}
      />
    </Card>
  )

  return (
    <>
      <PageHeader
        title="Lịch học"
        subtitle="Kéo–thả buổi học sang ngày khác để dời lịch · Chuột phải để sửa hoặc xoá"
        breadcrumbs={[{ title: 'Vận hành' }, { title: 'Lịch học' }]}
        icon={<CalendarOutlined style={{ fontSize: 26, color: '#1677ff' }} />}
        extra={
          <Can permission={PERMISSIONS.SCHEDULE_MANAGE}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingId(null)
                setDefaultDate(dayjs().format(ISO_DATE))
                setModalOpen(true)
              }}
            >
              Thêm buổi học
            </Button>
          </Can>
        }
      />

      <Card styles={{ body: { padding: 16 } }} style={{ marginBottom: 16 }}>
        <Flex justify="space-between" align="center" gap={12} wrap="wrap">
          <Space wrap>
            <Button icon={<LeftOutlined />} onClick={() => setAnchor(anchor.subtract(1, view))} />
            <Button onClick={() => setAnchor(dayjs())}>Hôm nay</Button>
            <Button icon={<RightOutlined />} onClick={() => setAnchor(anchor.add(1, view))} />

            <Typography.Title level={5} style={{ margin: '0 8px' }}>
              {view === 'week'
                ? `${anchor.startOf('week').format('DD/MM')} – ${anchor.startOf('week').add(6, 'day').format('DD/MM/YYYY')}`
                : anchor.format('MMMM YYYY')}
            </Typography.Title>
          </Space>

          <Space wrap>
            <Select
              allowClear
              placeholder="Lọc theo lớp"
              style={{ width: 220 }}
              value={classId}
              onChange={setClassId}
              options={classOptions}
              showSearch
              filterOption={(input, option) =>
                String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
            />
            <Select
              allowClear
              placeholder="Lọc theo giáo viên"
              style={{ width: 200 }}
              value={teacherId}
              onChange={setTeacherId}
              options={teacherOptions}
            />
            <Segmented
              value={view}
              onChange={(v) => setView(v as ViewMode)}
              options={[
                { label: 'Tuần', value: 'week' },
                { label: 'Tháng', value: 'month' }
              ]}
            />
          </Space>
        </Flex>
      </Card>

      {sessions.length === 0 && !isFetching && (
        <Alert
          type="info"
          showIcon
          message="Chưa có buổi học nào trong khoảng thời gian này"
          description="Vào chi tiết lớp học và bấm “Sinh buổi học” để tạo lịch tự động từ khung giờ hằng tuần."
          style={{ marginBottom: 16 }}
        />
      )}

      <Spin spinning={isFetching || moveMutation.isPending}>{view === 'week' ? weekView : monthView}</Spin>

      <SessionFormModal
        open={modalOpen}
        sessionId={editingId}
        defaultDate={defaultDate}
        onClose={() => setModalOpen(false)}
      />
    </>
  )
}
