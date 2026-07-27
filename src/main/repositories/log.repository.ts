import { BaseRepository } from './base.repository'
import { likeParam, normalizePage, toPageResult } from '../utils/pagination'
import type { PageResult } from '@shared/types/common'
import type { ActivityLog } from '@shared/types/entities'
import type { LogQuery } from '@shared/types/dto'

export interface WriteLogInput {
  userId: number | null
  username: string | null
  action: string
  entity: string
  entityId?: number | null
  description?: string | null
  metadata?: unknown
}

export class LogRepository extends BaseRepository<ActivityLog> {
  protected readonly tableName = 'logs'
  protected readonly selectColumns = `
    id, user_id AS userId, username, action, entity, entity_id AS entityId,
    description, ip_address AS ipAddress, metadata,
    created_at AS createdAt, updated_at AS updatedAt, deleted_at AS deletedAt`

  /**
   * Ghi nhật ký. Cố ý KHÔNG ném lỗi: một thao tác nghiệp vụ thành công không
   * được phép thất bại chỉ vì ghi log hỏng.
   */
  write(input: WriteLogInput): void {
    try {
      const now = Date.now()
      this.sqlite
        .prepare(
          `INSERT INTO logs
            (user_id, username, action, entity, entity_id, description, ip_address, metadata,
             created_at, updated_at, deleted_at)
           VALUES (?,?,?,?,?,?,NULL,?,?,?,NULL)`
        )
        .run(
          input.userId,
          input.username,
          input.action,
          input.entity,
          input.entityId ?? null,
          input.description ?? null,
          input.metadata === undefined ? null : JSON.stringify(input.metadata),
          now,
          now
        )
    } catch (err) {
      console.error('[log] Không ghi được nhật ký:', err)
    }
  }

  list(query: LogQuery): PageResult<ActivityLog> {
    const p = normalizePage(query)
    const where: string[] = ['deleted_at IS NULL']
    const params: unknown[] = []

    const kw = likeParam(query.keyword)
    if (kw) {
      where.push(`(username LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\' OR entity LIKE ? ESCAPE '\\')`)
      params.push(kw, kw, kw)
    }
    if (query.userId) {
      where.push('user_id = ?')
      params.push(query.userId)
    }
    if (query.action) {
      where.push('action = ?')
      params.push(query.action)
    }
    if (query.entity) {
      where.push('entity = ?')
      params.push(query.entity)
    }
    if (query.from) {
      where.push('created_at >= ?')
      params.push(new Date(`${query.from}T00:00:00`).getTime())
    }
    if (query.to) {
      where.push('created_at <= ?')
      params.push(new Date(`${query.to}T23:59:59`).getTime())
    }

    const whereSql = where.join(' AND ')
    const total = (
      this.sqlite.prepare(`SELECT COUNT(*) AS c FROM logs WHERE ${whereSql}`).get(...(params as never[])) as {
        c: number
      }
    ).c

    const items = this.sqlite
      .prepare(
        `SELECT ${this.selectColumns} FROM logs WHERE ${whereSql}
         ORDER BY created_at DESC LIMIT ? OFFSET ?`
      )
      .all(...(params as never[]), p.limit, p.offset) as ActivityLog[]

    return toPageResult(items, total, p)
  }
}

export const logRepository = new LogRepository()
