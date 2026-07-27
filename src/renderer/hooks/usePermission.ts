import { useCallback } from 'react'
import { useAuthStore } from '@/store/auth.store'
import type { Permission } from '@shared/constants/permissions'

/**
 * Kiểm tra quyền trong component.
 *
 * Lưu ý: đây CHỈ là lớp trải nghiệm — ẩn nút, ẩn menu. Chốt chặn thật nằm ở
 * main process (xem handler-factory.ts). Không bao giờ coi kết quả ở đây là
 * bảo đảm an toàn.
 */
export function usePermission() {
  const user = useAuthStore((s) => s.user)

  const can = useCallback(
    (permission: Permission): boolean => {
      if (!user) return false
      if (user.roleCode === 'admin') return true
      return user.permissions.includes(permission)
    },
    [user]
  )

  const canAny = useCallback(
    (permissions: Permission[]): boolean => {
      if (!user) return false
      if (user.roleCode === 'admin') return true
      return permissions.some((p) => user.permissions.includes(p))
    },
    [user]
  )

  const canAll = useCallback(
    (permissions: Permission[]): boolean => {
      if (!user) return false
      if (user.roleCode === 'admin') return true
      return permissions.every((p) => user.permissions.includes(p))
    },
    [user]
  )

  return { can, canAny, canAll, user, isAdmin: user?.roleCode === 'admin' }
}
