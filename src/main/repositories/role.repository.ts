import { BaseRepository } from './base.repository'
import { AppError } from '../utils/errors'
import type { SelectOption } from '@shared/types/common'
import type { Role, RoleWithPermissions } from '@shared/types/entities'
import type { RoleInput } from '@shared/types/dto'
import { ALL_PERMISSIONS, type Permission } from '@shared/constants/permissions'

export class RoleRepository extends BaseRepository<Role> {
  protected readonly tableName = 'roles'
  protected readonly selectColumns = `
    id, code, name, description, is_system AS isSystem,
    created_at AS createdAt, updated_at AS updatedAt, deleted_at AS deletedAt`

  listWithPermissions(): RoleWithPermissions[] {
    const roles = this.sqlite
      .prepare(
        `SELECT ${this.selectColumns},
                (SELECT COUNT(*) FROM users u WHERE u.role_id = roles.id AND u.deleted_at IS NULL) AS userCount
         FROM roles WHERE deleted_at IS NULL ORDER BY is_system DESC, name`
      )
      .all() as (Role & { userCount: number })[]

    const perms = this.sqlite
      .prepare(`SELECT role_id AS roleId, permission_code AS code FROM role_permissions`)
      .all() as { roleId: number; code: Permission }[]

    const byRole = new Map<number, Permission[]>()
    for (const p of perms) {
      const arr = byRole.get(p.roleId) ?? []
      arr.push(p.code)
      byRole.set(p.roleId, arr)
    }

    return roles.map((r) => ({ ...r, permissions: byRole.get(r.id) ?? [] }))
  }

  create(input: RoleInput): Role {
    return this.transaction(() => {
      const code = input.code.trim().toLowerCase()
      if (this.isDuplicate('code', code)) {
        throw AppError.duplicate(`Mã vai trò "${code}" đã tồn tại.`)
      }

      const now = Date.now()
      const res = this.sqlite
        .prepare(
          `INSERT INTO roles (code, name, description, is_system, created_at, updated_at, deleted_at)
           VALUES (?,?,?,0,?,?,NULL)`
        )
        .run(code, input.name.trim(), input.description?.trim() || null, now, now)

      const roleId = Number(res.lastInsertRowid)
      this.replacePermissions(roleId, input.permissions)
      return this.findByIdOrFail(roleId, 'Vai trò')
    })
  }

  update(id: number, input: RoleInput): Role {
    return this.transaction(() => {
      const current = this.findByIdOrFail(id, 'Vai trò')

      // Vai trò hệ thống được sửa quyền nhưng không được đổi mã — mã dùng trong code
      const code = current.isSystem ? current.code : input.code.trim().toLowerCase()
      if (code !== current.code && this.isDuplicate('code', code, id)) {
        throw AppError.duplicate(`Mã vai trò "${code}" đã tồn tại.`)
      }

      this.sqlite
        .prepare(`UPDATE roles SET code = ?, name = ?, description = ?, updated_at = ? WHERE id = ?`)
        .run(code, input.name.trim(), input.description?.trim() || null, Date.now(), id)

      // Vai trò admin luôn giữ toàn quyền, kể cả khi UI gửi thiếu
      const perms = current.code === 'admin' ? ALL_PERMISSIONS : input.permissions
      this.replacePermissions(id, perms)

      return this.findByIdOrFail(id, 'Vai trò')
    })
  }

  private replacePermissions(roleId: number, permissions: Permission[]): void {
    this.sqlite.prepare(`DELETE FROM role_permissions WHERE role_id = ?`).run(roleId)

    const valid = new Set<string>(ALL_PERMISSIONS)
    const now = Date.now()
    const insert = this.sqlite.prepare(
      `INSERT OR IGNORE INTO role_permissions (role_id, permission_code, created_at, updated_at, deleted_at)
       VALUES (?,?,?,?,NULL)`
    )

    for (const code of permissions ?? []) {
      // Bỏ qua mã quyền lạ: renderer bị sửa cũng không chèn được quyền tự chế
      if (!valid.has(code)) continue
      insert.run(roleId, code, now, now)
    }
  }

  assertDeletable(id: number): void {
    const role = this.findByIdOrFail(id, 'Vai trò')
    if (role.isSystem) throw AppError.conflict('Không thể xoá vai trò hệ thống.')

    const users = this.sqlite
      .prepare(`SELECT COUNT(*) AS c FROM users WHERE role_id = ? AND deleted_at IS NULL`)
      .get(id) as { c: number }
    if (users.c > 0) {
      throw AppError.conflict(`Đang có ${users.c} tài khoản dùng vai trò này.`)
    }
  }

  options(): SelectOption[] {
    const rows = this.sqlite
      .prepare(`SELECT id, name FROM roles WHERE deleted_at IS NULL ORDER BY is_system DESC, name`)
      .all() as { id: number; name: string }[]
    return rows.map((r) => ({ label: r.name, value: r.id }))
  }
}

export const roleRepository = new RoleRepository()
