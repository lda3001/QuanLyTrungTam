import { useEffect, useMemo } from 'react'
import { RouterProvider } from 'react-router-dom'
import { App as AntdApp, ConfigProvider, theme as antdTheme } from 'antd'
import viVN from 'antd/locale/vi_VN'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { router } from '@/router'
import { useUiStore } from '@/store/ui.store'
import { useAuthStore } from '@/store/auth.store'
import { authService } from '@/services/auth.service'
import { ApiError } from '@/services/ipc-client'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { dayjs } from '@/utils/format'

/**
 * Cấu hình React Query cho ứng dụng desktop.
 *
 * Khác với web: dữ liệu nằm ngay trên máy, truy vấn SQLite mất vài mili giây.
 * Vì vậy staleTime để ngắn (30s) — luôn đủ mới mà vẫn tránh gọi lại liên tục
 * khi người dùng chuyển qua lại giữa các tab.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Lỗi nghiệp vụ (không có quyền, không tìm thấy) thử lại cũng vô ích
        if (error instanceof ApiError) return false
        return failureCount < 2
      }
    },
    mutations: {
      retry: false
    }
  }
})

export default function App() {
  const themeMode = useUiStore((s) => s.themeMode)
  const primaryColor = useUiStore((s) => s.primaryColor)
  const compact = useUiStore((s) => s.compact)

  const setUser = useAuthStore((s) => s.setUser)
  const setInitializing = useAuthStore((s) => s.setInitializing)

  /**
   * Khôi phục phiên khi mở app.
   * Phiên do main process giữ; ở đây chỉ hỏi lại "tôi là ai".
   */
  useEffect(() => {
    let cancelled = false

    void authService
      .me()
      .then((user) => {
        if (!cancelled) setUser(user)
      })
      .catch(() => {
        if (!cancelled) setUser(null)
      })
      .finally(() => {
        if (!cancelled) setInitializing(false)
      })

    return () => {
      cancelled = true
    }
  }, [setUser, setInitializing])

  // Đồng bộ màu nền của <body> với theme để viền cửa sổ không bị lệch màu
  useEffect(() => {
    document.body.style.background = themeMode === 'dark' ? '#141414' : '#f5f7fb'
    document.documentElement.setAttribute('data-theme', themeMode)
  }, [themeMode])

  const themeConfig = useMemo(
    () => ({
      algorithm: [
        themeMode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        ...(compact ? [antdTheme.compactAlgorithm] : [])
      ],
      token: {
        colorPrimary: primaryColor,
        borderRadius: 8,
        fontSize: 14,
        fontFamily:
          "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
        colorBgLayout: themeMode === 'dark' ? '#141414' : '#f5f7fb'
      },
      components: {
        Layout: {
          headerHeight: 64,
          headerPadding: '0 20px'
        },
        Menu: {
          itemBorderRadius: 8,
          itemMarginInline: 8,
          itemHeight: 42
        },
        Card: {
          borderRadiusLG: 12
        },
        Table: {
          headerBg: themeMode === 'dark' ? '#1f1f1f' : '#fafafa',
          borderRadius: 10
        },
        Button: {
          controlHeight: 36
        }
      },
      cssVar: true // sinh biến CSS --ant-* để file global.css dùng lại
    }),
    [themeMode, primaryColor, compact]
  )

  return (
    <ConfigProvider
      locale={viVN}
      theme={themeConfig}
      // Bảng lớn không cần hiệu ứng gợn sóng khi bấm — giảm giật khi cuộn
      wave={{ disabled: false }}
    >
      <AntdApp
        notification={{ placement: 'topRight', duration: 3.5 }}
        message={{ maxCount: 3, duration: 2.5 }}
      >
        <QueryClientProvider client={queryClient}>
          <ErrorBoundary>
            <RouterProvider router={router} />
          </ErrorBoundary>
        </QueryClientProvider>
      </AntdApp>
    </ConfigProvider>
  )
}

// Ant Design đọc locale ngày tháng từ dayjs — đặt sẵn tiếng Việt ở utils/format
void dayjs
