import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemeMode = 'light' | 'dark'

interface UiState {
  themeMode: ThemeMode
  collapsed: boolean
  primaryColor: string
  compact: boolean

  toggleTheme: () => void
  setThemeMode: (mode: ThemeMode) => void
  toggleCollapsed: () => void
  setCollapsed: (value: boolean) => void
  setPrimaryColor: (color: string) => void
  toggleCompact: () => void
}

/**
 * Trạng thái giao diện, lưu vào localStorage.
 *
 * Chỉ giữ những gì thuộc về "sở thích hiển thị". Dữ liệu nghiệp vụ đã có
 * React Query lo — nhét chúng vào Zustand sẽ tạo ra hai nguồn sự thật.
 */
export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      themeMode: 'light',
      collapsed: false,
      primaryColor: '#1677ff',
      compact: false,

      toggleTheme: () => set((s) => ({ themeMode: s.themeMode === 'light' ? 'dark' : 'light' })),
      setThemeMode: (themeMode) => set({ themeMode }),
      toggleCollapsed: () => set((s) => ({ collapsed: !s.collapsed })),
      setCollapsed: (collapsed) => set({ collapsed }),
      setPrimaryColor: (primaryColor) => set({ primaryColor }),
      toggleCompact: () => set((s) => ({ compact: !s.compact }))
    }),
    { name: 'qltt-ui-preferences' }
  )
)
