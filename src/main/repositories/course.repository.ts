import { BaseRepository } from './base.repository'
import { AppError } from '../utils/errors'
import { generateCode } from '../utils/code-generator'
import { likeParam, normalizePage, safeSort, toPageResult } from '../utils/pagination'
import type { PageResult, SelectOption } from '@shared/types/common'
import type { Course } from '@shared/types/entities'
import type { CourseInput, CourseQuery } from '@shared/types/dto'

const SORTABLE: Record<string, string> = {
  code: 'code',
  name: 'name',
  tuitionFee: 'tuition_fee',
  totalSessions: 'total_sessions',
  createdAt: 'created_at'
}

export class CourseRepository extends BaseRepository<Course> {
  protected readonly tableName = 'courses'
  protected readonly selectColumns = `
    id, code, name, description, tuition_fee AS tuitionFee,
    duration_hours AS durationHours, total_sessions AS totalSessions, status,
    created_at AS createdAt, updated_at AS updatedAt, deleted_at AS deletedAt`

  list(query: CourseQuery): PageResult<Course> {
    const p = normalizePage(query)
    const where: string[] = ['deleted_at IS NULL']
    const params: unknown[] = []

    const kw = likeParam(query.keyword)
    if (kw) {
      where.push(`(code LIKE ? ESCAPE '\\' OR name LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\')`)
      params.push(kw, kw, kw)
    }
    if (query.status) {
      where.push('status = ?')
      params.push(query.status)
    }

    const whereSql = where.join(' AND ')
    const orderBy = safeSort(query.sortBy, query.sortOrder, SORTABLE, 'created_at')

    const total = (
      this.sqlite.prepare(`SELECT COUNT(*) AS c FROM courses WHERE ${whereSql}`).get(...(params as never[])) as {
        c: number
      }
    ).c

    const items = this.sqlite
      .prepare(
        `SELECT ${this.selectColumns} FROM courses
         WHERE ${whereSql} ORDER BY ${orderBy} LIMIT ? OFFSET ?`
      )
      .all(...(params as never[]), p.limit, p.offset) as Course[]

    return toPageResult(items, total, p)
  }

  create(input: CourseInput): Course {
    return this.transaction(() => {
      const code = input.code?.trim() || generateCode(this.sqlite, 'courses', 'KH')
      if (this.isDuplicate('code', code)) {
        throw AppError.duplicate(`Mã khoá học "${code}" đã tồn tại.`)
      }

      const now = Date.now()
      const res = this.sqlite
        .prepare(
          `INSERT INTO courses
            (code, name, description, tuition_fee, duration_hours, total_sessions, status,
             created_at, updated_at, deleted_at)
           VALUES (?,?,?,?,?,?,?,?,?,NULL)`
        )
        .run(
          code,
          input.name.trim(),
          input.description?.trim() || null,
          Math.max(0, Math.round(input.tuitionFee || 0)),
          Math.max(0, Math.round(input.durationHours || 0)),
          Math.max(0, Math.round(input.totalSessions || 0)),
          input.status,
          now,
          now
        )

      return this.findByIdOrFail(Number(res.lastInsertRowid), 'Khoá học')
    })
  }

  update(id: number, input: CourseInput): Course {
    return this.transaction(() => {
      const current = this.findByIdOrFail(id, 'Khoá học')
      const code = input.code?.trim() || current.code
      if (code !== current.code && this.isDuplicate('code', code, id)) {
        throw AppError.duplicate(`Mã khoá học "${code}" đã tồn tại.`)
      }

      this.sqlite
        .prepare(
          `UPDATE courses SET
             code = ?, name = ?, description = ?, tuition_fee = ?, duration_hours = ?,
             total_sessions = ?, status = ?, updated_at = ?
           WHERE id = ? AND deleted_at IS NULL`
        )
        .run(
          code,
          input.name.trim(),
          input.description?.trim() || null,
          Math.max(0, Math.round(input.tuitionFee || 0)),
          Math.max(0, Math.round(input.durationHours || 0)),
          Math.max(0, Math.round(input.totalSessions || 0)),
          input.status,
          Date.now(),
          id
        )

      return this.findByIdOrFail(id, 'Khoá học')
    })
  }

  assertDeletable(id: number): void {
    const row = this.sqlite
      .prepare(`SELECT COUNT(*) AS c FROM classes WHERE course_id = ? AND deleted_at IS NULL`)
      .get(id) as { c: number }

    if (row.c > 0) {
      throw AppError.conflict(`Khoá học đang có ${row.c} lớp. Hãy xoá các lớp thuộc khoá này trước.`)
    }
  }

  options(): SelectOption[] {
    const rows = this.sqlite
      .prepare(
        `SELECT id, code, name FROM courses
         WHERE deleted_at IS NULL AND status = 'active' ORDER BY name`
      )
      .all() as { id: number; code: string; name: string }[]
    return rows.map((r) => ({ label: `${r.code} — ${r.name}`, value: r.id }))
  }
}

export const courseRepository = new CourseRepository()
