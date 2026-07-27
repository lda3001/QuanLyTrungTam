import { create } from 'zustand'
import type { AuthUser } from '@shared/types/entities'
import type { Permission } from '@shared/constants/permissions'

interface AuthState {
  user: AuthUser | null
  /** true trong lúc khôi phục phiên lúc mở app — tránh nháy sang màn đăng nhập */
  initializing: boolean

  setUser: (user: AuthUser | null) => void
  setInitializing: (value: boolean) => void
  clear: () => void

  can: (permission: Permission) => boolean
  canAny: (permissions: Permission[]) => boolean
}

/**
 * Phiên đăng nhập phía giao diện.
 *
 * CỐ Ý không dùng `persist`: nguồn sự thật của phiên nằm ở main process.
 * Nếu lưu user vào localStorage, mở DevTools sửa vài dòng là "tự phong" admin —
 * menu sẽ hiện ra, dù mọi lệnh gọi vẫn bị main process chặn. Giữ đúng một
 * nguồn giúp giao diện không bao giờ nói dối người dùng.
 */
export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  initializing: true,

  setUser: (user) => set({ user }),
  setInitializing: (initializing) => set({ initializing }),
  clear: () => set({ user: null }),

  can: (permission) => {
    const user = get().user
    if (!user) return false
    if (user.roleCode === 'admin') return true
    return user.permissions.includes(permission)
  },

  canAny: (permissions) => {
    const user = get().user
    if (!user) return false
    if (user.roleCode === 'admin') return true
    return permissions.some((p) => user.permissions.includes(p))
  }
}))
