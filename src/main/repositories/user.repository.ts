import { BaseRepository } from './base.repository'
import { AppError } from '../utils/errors'
import { hashPassword, hashSecurityAnswer } from '../utils/crypto'
import { likeParam, normalizePage, safeSort, toPageResult } from '../utils/pagination'
import type { PageResult } from '@shared/types/common'
import type { User, UserDetail } from '@shared/types/entities'
import type { UserInput, UserQuery } from '@shared/types/dto'
import type { Permission } from '@shared/constants/permissions'

const SORTABLE: Record<string, string> = {
  username: 'u.username',
  fullName: 'u.full_name',
  createdAt: 'u.created_at',
  lastLoginAt: 'u.last_login_at'
}

/** Không bao giờ đưa password_hash / security_answer_hash ra khỏi repository */
const USER_COLUMNS = `
  u.id, u.username, u.full_name AS fullName, u.email, u.phone,
  u.role_id AS roleId, u.teacher_id AS teacherId, u.avatar, u.is_active AS isActive,
  u.last_login_at AS lastLoginAt, u.security_question AS securityQuestion,
  u.created_at AS createdAt, u.updated_at AS updatedAt, u.deleted_at AS deletedAt,
  r.code AS roleCode, r.name AS roleName`

export interface UserWithSecrets extends User {
  passwordHash: string
  securityAnswerHash: string | null
  roleCode: string
  roleName: string
}

export class UserRepository extends BaseRepository<User> {
  protected readonly tableName = 'users'
  protected readonly selectColumns = `
    id, username, full_name AS fullName, email, phone, role_id AS roleId,
    teacher_id AS teacherId, avatar, is_active AS isActive, last_login_at AS lastLoginAt,
    security_question AS securityQuestion,
    created_at AS createdAt, updated_at AS updatedAt, deleted_at AS deletedAt`

  list(query: UserQuery): PageResult<UserDetail> {
    const p = normalizePage(query)
    const where: string[] = ['u.deleted_at IS NULL']
    const params: unknown[] = []

    const kw = likeParam(query.keyword)
    if (kw) {
      where.push(`(u.username LIKE ? ESCAPE '\\' OR u.full_name LIKE ? ESCAPE '\\' OR u.email LIKE ? ESCAPE '\\')`)
      params.push(kw, kw, kw)
    }
    if (query.roleId) {
      where.push('u.role_id = ?')
      params.push(query.roleId)
    }
    if (query.isActive !== undefined && query.isActive !== null) {
      where.push('u.is_active = ?')
      params.push(query.isActive)
    }

    const whereSql = where.join(' AND ')
    const orderBy = safeSort(query.sortBy, query.sortOrder, SORTABLE, 'u.created_at')

    const total = (
      this.sqlite.prepare(`SELECT COUNT(*) AS c FROM users u WHERE ${whereSql}`).get(...(params as never[])) as {
        c: number
      }
    ).c

    const items = this.sqlite
      .prepare(
        `SELECT ${USER_COLUMNS} FROM users u
         JOIN roles r ON r.id = u.role_id
         WHERE ${whereSql} ORDER BY ${orderBy} LIMIT ? OFFSET ?`
      )
      .all(...(params as never[]), p.limit, p.offset) as UserDetail[]

    return toPageResult(items, total, p)
  }

  detail(id: number): UserDetail {
    const row = this.sqlite
      .prepare(
        `SELECT ${USER_COLUMNS} FROM users u
         JOIN roles r ON r.id = u.role_id
         WHERE u.id = ? AND u.deleted_at IS NULL`
      )
      .get(id) as UserDetail | undefined
    if (!row) throw AppError.notFound('Tài khoản')
    return row
  }

  /** Chỉ dùng trong luồng đăng nhập / đổi mật khẩu */
  findByUsernameWithSecrets(username: string): UserWithSecrets | undefined {
    return this.sqlite
      .prepare(
        `SELECT u.id, u.username, u.password_hash AS passwordHash, u.full_name AS fullName,
                u.email, u.phone, u.role_id AS roleId, u.teacher_id AS teacherId, u.avatar,
                u.is_active AS isActive, u.last_login_at AS lastLoginAt,
                u.security_question AS securityQuestion, u.security_answer_hash AS securityAnswerHash,
                u.created_at AS createdAt, u.updated_at AS updatedAt, u.deleted_at AS deletedAt,
                r.code AS roleCode, r.name AS roleName
         FROM users u JOIN roles r ON r.id = u.role_id
         WHERE u.username = ? AND u.deleted_at IS NULL`
      )
      .get(username) as UserWithSecrets | undefined
  }

  findByIdWithSecrets(id: number): UserWithSecrets | undefined {
    return this.sqlite
      .prepare(
        `SELECT u.id, u.username, u.password_hash AS passwordHash, u.full_name AS fullName,
                u.email, u.phone, u.role_id AS roleId, u.teacher_id AS teacherId, u.avatar,
                u.is_active AS isActive, u.last_login_at AS lastLoginAt,
                u.security_question AS securityQuestion, u.security_answer_hash AS securityAnswerHash,
                u.created_at AS createdAt, u.updated_at AS updatedAt, u.deleted_at AS deletedAt,
                r.code AS roleCode, r.name AS roleName
         FROM users u JOIN roles r ON r.id = u.role_id
         WHERE u.id = ? AND u.deleted_at IS NULL`
      )
      .get(id) as UserWithSecrets | undefined
  }

  permissionsOfRole(roleId: number): Permission[] {
    const rows = this.sqlite
      .prepare(`SELECT permission_code AS code FROM role_permissions WHERE role_id = ?`)
      .all(roleId) as { code: Permission }[]
    return rows.map((r) => r.code)
  }

  create(input: UserInput): UserDetail {
    return this.transaction(() => {
      const username = input.username.trim().toLowerCase()
      if (!input.password || input.password.length < 6) {
        throw AppError.validation('Mật khẩu phải có ít nhất 6 ký tự.')
      }
      if (this.isDuplicate('username', username)) {
        throw AppError.duplicate(`Tên đăng nhập "${username}" đã tồn tại.`)
      }

      const now = Date.now()
      const res = this.sqlite
        .prepare(
          `INSERT INTO users
            (username, password_hash, full_name, email, phone, role_id, teacher_id,
             avatar, is_active, last_login_at, security_question, security_answer_hash,
             created_at, updated_at, deleted_at)
           VALUES (?,?,?,?,?,?,?,?,?,NULL,?,?,?,?,NULL)`
        )
        .run(
          username,
          hashPassword(input.password),
          input.fullName.trim(),
          input.email?.trim() || null,
          input.phone?.trim() || null,
          input.roleId,
          input.teacherId ?? null,
          input.avatar ?? null,
          input.isActive ? 1 : 0,
          input.securityQuestion?.trim() || null,
          input.securityAnswer ? hashSecurityAnswer(input.securityAnswer) : null,
          now,
          now
        )

      return this.detail(Number(res.lastInsertRowid))
    })
  }

  update(id: number, input: UserInput): UserDetail {
    return this.transaction(() => {
      const current = this.findByIdWithSecrets(id)
      if (!current) throw AppError.notFound('Tài khoản')

      const username = input.username.trim().toLowerCase()
      if (username !== current.username && this.isDuplicate('username', username, id)) {
        throw AppError.duplicate(`Tên đăng nhập "${username}" đã tồn tại.`)
      }

      // Tài khoản admin gốc luôn phải còn hoạt động, tránh tự khoá mình ra ngoài
      if (current.id === 1 && !input.isActive) {
        throw AppError.conflict('Không thể vô hiệu hoá tài khoản quản trị gốc.')
      }

      // Bỏ trống ô mật khẩu = giữ nguyên mật khẩu cũ
      const passwordHash = input.password?.trim() ? hashPassword(input.password) : current.passwordHash
      const answerHash = input.securityAnswer?.trim()
        ? hashSecurityAnswer(input.securityAnswer)
        : current.securityAnswerHash

      this.sqlite
        .prepare(
          `UPDATE users SET
             username = ?, password_hash = ?, full_name = ?, email = ?, phone = ?,
             role_id = ?, teacher_id = ?, avatar = ?, is_active = ?,
             security_question = ?, security_answer_hash = ?, updated_at = ?
           WHERE id = ? AND deleted_at IS NULL`
        )
        .run(
          username,
          passwordHash,
          input.fullName.trim(),
          input.email?.trim() || null,
          input.phone?.trim() || null,
          input.roleId,
          input.teacherId ?? null,
          input.avatar ?? null,
          input.isActive ? 1 : 0,
          input.securityQuestion?.trim() || null,
          answerHash,
          Date.now(),
          id
        )

      return this.detail(id)
    })
  }

  updatePassword(id: number, newPassword: string): void {
    this.sqlite
      .prepare(`UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`)
      .run(hashPassword(newPassword), Date.now(), id)
  }

  touchLastLogin(id: number): void {
    const now = Date.now()
    this.sqlite.prepare(`UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?`).run(now, now, id)
  }

  assertDeletable(id: number): void {
    if (id === 1) throw AppError.conflict('Không thể xoá tài khoản quản trị gốc.')

    const admins = this.sqlite
      .prepare(
        `SELECT COUNT(*) AS c FROM users u JOIN roles r ON r.id = u.role_id
         WHERE r.code = 'admin' AND u.deleted_at IS NULL AND u.is_active = 1`
      )
      .get() as { c: number }

    const target = this.detail(id)
    if (target.roleCode === 'admin' && admins.c <= 1) {
      throw AppError.conflict('Hệ thống phải còn ít nhất một quản trị viên đang hoạt động.')
    }
  }
}

export const userRepository = new UserRepository()
