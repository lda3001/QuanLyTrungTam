import { Card, Empty, Skeleton, Table } from 'antd'
import type { TableProps } from 'antd'
import type { ReactNode } from 'react'

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
}

/**
 * Bảng dùng chung.
 *
 * Gói sẵn: phân trang phía server, skeleton lần tải đầu, cuộn ngang khi
 * nhiều cột, và trạng thái rỗng bằng tiếng Việt.
 *
 * Điểm đáng lưu ý: lần tải ĐẦU TIÊN hiện skeleton, còn các lần tải sau
 * (đổi trang, lọc) chỉ hiện spinner của Table — bảng đang có dữ liệu mà biến
 * mất rồi hiện lại sẽ khiến màn hình nhấp nháy.
 */
export function DataTable<T extends object>({
  total,
  page = 1,
  pageSize = 20,
  loading,
  toolbar,
  emptyText = 'Không có dữ liệu',
  virtual,
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
        <Table<T>
          className="app-table"
          size="middle"
          rowKey={rowKey}
          dataSource={dataSource}
          loading={loading}
          virtual={virtual}
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
