import { memo, type ReactNode } from 'react'
import { Avatar, Input, Skeleton, Space, Tag, Tooltip, Typography } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { usePermission } from '@/hooks/usePermission'
import { colorFromString, initials } from '@/utils/format'
import type { Permission } from '@shared/constants/permissions'

/* ------------------------------------------------------------------ *
 * Nhóm component nhỏ dùng lại ở nhiều màn hình.
 * Gom vào một file vì mỗi cái chỉ vài dòng — tách ra sẽ tạo ra rừng file
 * mà không tăng khả năng đọc.
 * ------------------------------------------------------------------ */

/** Ô tìm kiếm có debounce (debounce nằm ở useTableQuery, đây chỉ là giao diện) */
export const SearchInput = memo(function SearchInput({
  value,
  onChange,
  placeholder = 'Tìm kiếm...',
  width = 280
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  width?: number | string
}) {
  return (
    <Input
      allowClear
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      prefix={<SearchOutlined style={{ opacity: 0.45 }} />}
      style={{ width }}
    />
  )
})

/** Thẻ trạng thái: nhận map nhãn + map màu để dùng chung cho mọi loại enum */
export const StatusTag = memo(function StatusTag<T extends string>({
  value,
  labels,
  colors
}: {
  value: T
  labels: Record<string, string>
  colors?: Record<string, string>
}) {
  return (
    <Tag color={colors?.[value]} style={{ margin: 0 }}>
      {labels[value] ?? value}
    </Tag>
  )
})

/** Avatar sinh màu ổn định từ tên, kèm họ tên và dòng phụ */
export const PersonCell = memo(function PersonCell({
  name,
  sub,
  avatar
}: {
  name: string
  sub?: string | null
  avatar?: string | null
}) {
  return (
    <Space size={10}>
      <Avatar src={avatar || undefined} style={{ backgroundColor: colorFromString(name), flexShrink: 0 }}>
        {initials(name)}
      </Avatar>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 500, lineHeight: 1.3 }}>{name}</div>
        {sub && (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {sub}
          </Typography.Text>
        )}
      </div>
    </Space>
  )
})

/**
 * Chỉ render children khi người dùng có quyền.
 *
 * Đây là công cụ giao diện, không phải bảo mật — main process vẫn kiểm tra
 * độc lập. Mục đích: không cho người dùng thấy nút mà bấm vào sẽ bị từ chối.
 */
export const Can = memo(function Can({
  permission,
  anyOf,
  children,
  fallback = null
}: {
  permission?: Permission
  anyOf?: Permission[]
  children: ReactNode
  fallback?: ReactNode
}) {
  const { can, canAny } = usePermission()

  const allowed = permission ? can(permission) : anyOf ? canAny(anyOf) : true
  return <>{allowed ? children : fallback}</>
})

/** Khung xương lúc tải trang — giữ đúng bố cục để nội dung không "nhảy" */
export const PageSkeleton = memo(function PageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="fade-in">
      <Skeleton active title={{ width: 220 }} paragraph={{ rows: 1, width: ['40%'] }} />
      <div style={{ marginTop: 24 }}>
        <Skeleton active paragraph={{ rows }} />
      </div>
    </div>
  )
})

/** Rút gọn văn bản dài trong ô bảng, giữ toàn văn ở tooltip */
export const Ellipsis = memo(function Ellipsis({ text, width = 220 }: { text?: string | null; width?: number }) {
  if (!text) return <Typography.Text type="secondary">—</Typography.Text>
  return (
    <Tooltip title={text} placement="topLeft">
      <div
        style={{
          maxWidth: width,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
      >
        {text}
      </div>
    </Tooltip>
  )
})

/** Giá trị rỗng hiển thị nhất quán bằng dấu gạch ngang */
export const Blank = memo(function Blank() {
  return <Typography.Text type="secondary">—</Typography.Text>
})
