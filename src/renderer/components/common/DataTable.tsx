import { Card, Empty, Skeleton } from 'antd'
import type { TableProps } from 'antd'
import type { ReactNode } from 'react'
import { ResizableTable } from './ResizableTable'

interface Props<T> extends Omit<TableProps<T>, 'pagination'> {
  /** Tổng số bản ghi từ server (phân trang phía server) */
  total?: number
  page?: number
  pageSize?: number
  loading?: boolean
  /** Thanh công cụ phía trên bảng: ô tìm kiếm, bộ lọc... */
  toolbar?: ReactNode
  emptyText?: string
  /** Bật cuộn ảo — chỉ dùng khi hiển thị hàng nghìn dòng cùng lúc */
  virtual?: boolean
  /** Tắt nếu một bảng đặc biệt không cần cho phép kéo thay đổi độ rộng cột. */
  resizableColumns?: boolean
  /** Khóa lưu độ rộng; mặc định được tạo từ danh sách cột của bảng. */
  columnStorageKey?: string
}

/**
 * Bảng dùng chung: phân trang server, skeleton lần tải đầu, cuộn ngang,
 * trạng thái rỗng và thay đổi độ rộng cột bằng thao tác kéo.
 */
export function DataTable<T extends object>({
  total,
  page = 1,
  pageSize = 20,
  loading,
  toolbar,
  emptyText = 'Không có dữ liệu',
  virtual,
  resizableColumns = true,
  columnStorageKey,
  dataSource,
  rowKey = 'id',
  ...rest
}: Props<T>) {
  const isFirstLoad = loading && (!dataSource || dataSource.length === 0)

  return (
    <Card styles={{ body: { padding: 16 } }}>
      {toolbar && <div style={{ marginBottom: 16 }}>{toolbar}</div>}

      {isFirstLoad ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : (
        <ResizableTable<T>
          size="middle"
          rowKey={rowKey}
          dataSource={dataSource}
          loading={loading}
          virtual={virtual}
          resizableColumns={resizableColumns}
          columnStorageKey={columnStorageKey}
          scroll={virtual ? { x: 'max-content', y: 520 } : { x: 'max-content' }}
          locale={{ emptyText: <Empty description={emptyText} image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
          pagination={
            total === undefined
              ? false
              : {
                  current: page,
                  pageSize,
                  total,
                  showSizeChanger: true,
                  pageSizeOptions: [10, 20, 50, 100],
                  showTotal: (t, range) => `${range[0]}–${range[1]} trên ${t} bản ghi`,
                  size: 'default'
                }
          }
          {...rest}
        />
      )}
    </Card>
  )
}
