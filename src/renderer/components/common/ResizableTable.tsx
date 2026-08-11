import { Table } from 'antd'
import type { TableProps } from 'antd'
import type { ColumnsType, ColumnType } from 'antd/es/table'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, ThHTMLAttributes } from 'react'

const DEFAULT_COLUMN_WIDTH = 160
const MIN_COLUMN_WIDTH = 64

interface ResizableHeaderCellProps extends ThHTMLAttributes<HTMLTableCellElement> {
  width?: number
  minWidth?: number
  onResize?: (width: number) => void
}

function ResizableHeaderCell({
  width,
  minWidth = MIN_COLUMN_WIDTH,
  onResize,
  children,
  ...rest
}: ResizableHeaderCellProps) {
  const [resizing, setResizing] = useState(false)

  useEffect(() => {
    return () => document.body.classList.remove('app-column-resizing')
  }, [])

  const handlePointerDown = (event: ReactPointerEvent<HTMLSpanElement>) => {
    if (!width || !onResize) return

    event.preventDefault()
    event.stopPropagation()

    const startX = event.clientX
    const startWidth = width
    setResizing(true)
    document.body.classList.add('app-column-resizing')

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextWidth = Math.max(minWidth, Math.round(startWidth + moveEvent.clientX - startX))
      onResize(nextWidth)
    }

    const stopResizing = () => {
      setResizing(false)
      document.body.classList.remove('app-column-resizing')
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', stopResizing)
      window.removeEventListener('pointercancel', stopResizing)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', stopResizing)
    window.addEventListener('pointercancel', stopResizing)
  }

  return (
    <th {...rest}>
      {children}
      {onResize && (
        <span
          className={`app-column-resize-handle${resizing ? ' is-resizing' : ''}`}
          role="separator"
          aria-orientation="vertical"
          aria-label="Kéo để thay đổi độ rộng cột"
          onPointerDown={handlePointerDown}
          onClick={(event) => event.stopPropagation()}
        />
      )}
    </th>
  )
}

function columnId<T>(column: ColumnType<T>, path: string): string {
  if (column.key !== undefined) return String(column.key)
  if (Array.isArray(column.dataIndex)) return column.dataIndex.join('.')
  if (column.dataIndex !== undefined) return String(column.dataIndex)
  return path
}

function columnSignature<T>(columns: ColumnsType<T>, path = ''): string[] {
  return columns.flatMap((column, index) => {
    const nextPath = path ? `${path}.${index}` : String(index)
    if ('children' in column && column.children) return columnSignature(column.children, nextPath)
    return [columnId(column as ColumnType<T>, nextPath)]
  })
}

function readStoredWidths(storageKey: string): Record<string, number> {
  try {
    const stored = localStorage.getItem(storageKey)
    return stored ? (JSON.parse(stored) as Record<string, number>) : {}
  } catch {
    return {}
  }
}

export interface ResizableTableProps<T> extends TableProps<T> {
  /** Tắt cho những bảng không cần thay đổi độ rộng cột. */
  resizableColumns?: boolean
  /** Khóa localStorage để ghi nhớ độ rộng riêng cho bảng. */
  columnStorageKey?: string
}

/** Ant Design Table có tay nắm kéo ở mép phải tiêu đề từng cột. */
export function ResizableTable<T extends object>({
  resizableColumns = true,
  columnStorageKey,
  columns = [],
  components,
  className,
  ...rest
}: ResizableTableProps<T>) {
  const storageKey = useMemo(
    () => columnStorageKey ?? `app-table-widths:${columnSignature(columns).join('|')}`,
    [columnStorageKey, columns]
  )
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() =>
    readStoredWidths(storageKey)
  )

  useEffect(() => {
    setColumnWidths(readStoredWidths(storageKey))
  }, [storageKey])

  const resizeColumn = useCallback(
    (id: string, width: number) => {
      setColumnWidths((current) => {
        if (current[id] === width) return current
        const next = { ...current, [id]: width }
        try {
          localStorage.setItem(storageKey, JSON.stringify(next))
        } catch {
          // Bảng vẫn kéo được trong phiên hiện tại nếu localStorage bị chặn.
        }
        return next
      })
    },
    [storageKey]
  )

  const resizableTableColumns = useMemo(() => {
    const enhance = (items: ColumnsType<T>, path = ''): ColumnsType<T> =>
      items.map((item, index) => {
        const nextPath = path ? `${path}.${index}` : String(index)
        if ('children' in item && item.children) {
          return { ...item, children: enhance(item.children, nextPath) }
        }

        const column = item as ColumnType<T>
        const id = columnId(column, nextPath)
        const configuredWidth =
          typeof column.width === 'number' ? column.width : DEFAULT_COLUMN_WIDTH
        const width = columnWidths[id] ?? configuredWidth
        const originalOnHeaderCell = column.onHeaderCell

        return {
          ...column,
          width,
          onHeaderCell: (record) => {
            const originalProps = originalOnHeaderCell?.(record)
            return {
              ...originalProps,
              className: [originalProps?.className, 'app-column-resizable']
                .filter(Boolean)
                .join(' '),
              width,
              minWidth: MIN_COLUMN_WIDTH,
              onResize: (nextWidth: number) => resizeColumn(id, nextWidth)
            }
          }
        }
      })

    return resizableColumns ? enhance(columns) : columns
  }, [columnWidths, columns, resizableColumns, resizeColumn])

  return (
    <Table<T>
      {...rest}
      className={['app-table', className].filter(Boolean).join(' ')}
      columns={resizableTableColumns}
      components={
        resizableColumns
          ? {
              ...components,
              header: {
                ...components?.header,
                cell: ResizableHeaderCell
              }
            }
          : components
      }
    />
  )
}
