import { useCallback, useMemo, useState } from 'react'
import type { TablePaginationConfig } from 'antd'
import type { FilterValue, SorterResult } from 'antd/es/table/interface'
import { useDebounce } from './useDebounce'
import type { PageQuery } from '@shared/types/common'

interface UseTableQueryOptions<TFilters> {
  defaultPageSize?: number
  defaultFilters?: TFilters
  defaultSort?: { sortBy: string; sortOrder: 'asc' | 'desc' }
}

/**
 * Gom toàn bộ trạng thái của một bảng có phân trang phía server:
 * trang hiện tại, từ khoá (đã debounce), bộ lọc và sắp xếp.
 *
 * Quy tắc quan trọng: đổi từ khoá hoặc bộ lọc thì LUÔN quay về trang 1.
 * Bỏ qua bước này sẽ dẫn tới cảnh "lọc xong thấy bảng trống" vì người dùng
 * đang đứng ở trang 7 của kết quả cũ.
 */
export function useTableQuery<TFilters extends Record<string, unknown>>(
  options: UseTableQueryOptions<TFilters> = {}
) {
  const { defaultPageSize = 20, defaultFilters, defaultSort } = options

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(defaultPageSize)
  const [keywordInput, setKeywordInput] = useState('')
  const [filters, setFiltersState] = useState<TFilters>((defaultFilters ?? {}) as TFilters)
  const [sort, setSort] = useState(defaultSort)

  const keyword = useDebounce(keywordInput, 350)

  const setKeyword = useCallback((value: string) => {
    setKeywordInput(value)
    setPage(1)
  }, [])

  const setFilters = useCallback((next: Partial<TFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...next }))
    setPage(1)
  }, [])

  const resetFilters = useCallback(() => {
    setFiltersState((defaultFilters ?? {}) as TFilters)
    setKeywordInput('')
    setPage(1)
  }, [defaultFilters])

  /**
   * Nối vào onChange của Table để nhận sự kiện đổi trang / sắp xếp.
   *
   * Khai báo generic `<TRow,>` là bắt buộc: `SorterResult<T>` bất biến
   * (invariant) trong TypeScript, nên một hàm nhận `SorterResult<unknown>`
   * KHÔNG gán được cho `Table<Course>`. Hàm generic thì mỗi bảng tự suy ra
   * kiểu dòng của mình. Dấu phẩy trong `<TRow,>` để trình biên dịch không
   * nhầm với thẻ JSX.
   */
  const handleTableChange = useCallback(
    <TRow,>(
      pagination: TablePaginationConfig,
      _tableFilters: Record<string, FilterValue | null>,
      sorter: SorterResult<TRow> | SorterResult<TRow>[]
    ): void => {
      setPage(pagination.current ?? 1)
      setPageSize(pagination.pageSize ?? defaultPageSize)

      const s = Array.isArray(sorter) ? sorter[0] : sorter
      if (s?.field && s?.order) {
        setSort({
          sortBy: String(s.field),
          sortOrder: s.order === 'ascend' ? 'asc' : 'desc'
        })
      } else {
        setSort(undefined)
      }
    },
    [defaultPageSize]
  )

  // Object query truyền thẳng cho service; là dependency của queryKey React Query
  const query = useMemo(
    () =>
      ({
        page,
        pageSize,
        keyword: keyword || undefined,
        sortBy: sort?.sortBy,
        sortOrder: sort?.sortOrder,
        ...filters
      }) as PageQuery & TFilters,
    [page, pageSize, keyword, sort, filters]
  )

  return {
    query,
    page,
    pageSize,
    keywordInput,
    filters,
    setKeyword,
    setFilters,
    resetFilters,
    setPage,
    handleTableChange
  }
}
