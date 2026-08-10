import { BaseRepository } from './base.repository'
import { AppError } from '../utils/errors'
import { generateCode } from '../utils/code-generator'
import { likeParam, normalizePage, safeSort, toPageResult } from '../utils/pagination'
import type { PageResult, SelectOption } from '@shared/types/common'
import type { Teacher } from '@shared/types/entities'
import type { TeacherInput, TeacherQuery } from '@shared/types/dto'

const SORTABLE: Record<string, string> = {
  code: 'code',
  fullName: 'last_name(full_name)',
  salary: 'salary',
  hireDate: 'hire_date',
  createdAt: 'created_at'
}

export class TeacherRepository extends BaseRepository<Teacher> {
  protected readonly tableName = 'teachers'
  protected readonly selectColumns = `
    id, code, full_name AS fullName, gender, birth_date AS birthDate, email, phone,
    address, specialization, degree, salary, hire_date AS hireDate, status, note,
    created_at AS createdAt, updated_at AS updatedAt, deleted_at AS deletedAt`

  list(query: TeacherQuery): PageResult<Teacher> {
    const p = normalizePage(query)
    const where: string[] = ['deleted_at IS NULL']
    const params: unknown[] = []

    const kw = likeParam(query.keyword)
    if (kw) {
      where.push(`(code LIKE ? ESCAPE '\\' OR search_text(full_name) LIKE ? ESCAPE '\\'
                   OR phone LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\'
                   OR specialization LIKE ? ESCAPE '\\')`)
      params.push(kw, kw, kw, kw, kw)
    }
    if (query.status) {
      where.push('status = ?')
      params.push(query.status)
    }
    if (query.specialization) {
      where.push('specialization = ?')
      params.push(query.specialization)
    }

    const whereSql = where.join(' AND ')
    const orderBy = query.sortBy
      ? safeSort(query.sortBy, query.sortOrder, SORTABLE, 'created_at')
      : 'last_name(full_name) ASC, full_name ASC'

    const total = (
      this.sqlite.prepare(`SELECT COUNT(*) AS c FROM teachers WHERE ${whereSql}`).get(...(params as never[])) as {
        c: number
      }
    ).c

    const items = this.sqlite
      .prepare(
        `SELECT ${this.selectColumns} FROM teachers
         WHERE ${whereSql} ORDER BY ${orderBy} LIMIT ? OFFSET ?`
      )
      .all(...(params as never[]), p.limit, p.offset) as Teacher[]

    return toPageResult(items, total, p)
  }

  create(input: TeacherInput, prefix: string): Teacher {
    return this.transaction(() => {
      const code = input.code?.trim() || generateCode(this.sqlite, 'teachers', prefix)
      if (this.isDuplicate('code', code)) {
        throw AppError.duplicate(`Mã giáo viên "${code}" đã tồn tại.`)
      }

      const now = Date.now()
      const res = this.sqlite
        .prepare(
          `INSERT INTO teachers
            (code, full_name, gender, birth_date, email, phone, address,
             specialization, degree, salary, hire_date, status, note,
             created_at, updated_at, deleted_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL)`
        )
        .run(
          code,
          input.fullName.trim(),
          input.gender,
          input.birthDate ?? null,
          input.email?.trim() || null,
          input.phone?.trim() || null,
          input.address?.trim() || null,
          input.specialization?.trim() || null,
          input.degree?.trim() || null,
          Math.max(0, Math.round(input.salary || 0)),
          input.hireDate ?? null,
          input.status,
          input.note?.trim() || null,
          now,
          now
        )

      return this.findByIdOrFail(Number(res.lastInsertRowid), 'Giáo viên')
    })
  }

  update(id: number, input: TeacherInput): Teacher {
    return this.transaction(() => {
      const current = this.findByIdOrFail(id, 'Giáo viên')
      const code = input.code?.trim() || current.code
      if (code !== current.code && this.isDuplicate('code', code, id)) {
        throw AppError.duplicate(`Mã giáo viên "${code}" đã tồn tại.`)
      }

      this.sqlite
        .prepare(
          `UPDATE teachers SET
             code = ?, full_name = ?, gender = ?, birth_date = ?, email = ?, phone = ?,
             address = ?, specialization = ?, degree = ?, salary = ?, hire_date = ?,
             status = ?, note = ?, updated_at = ?
           WHERE id = ? AND deleted_at IS NULL`
        )
        .run(
          code,
          input.fullName.trim(),
          input.gender,
          input.birthDate ?? null,
          input.email?.trim() || null,
          input.phone?.trim() || null,
          input.address?.trim() || null,
          input.specialization?.trim() || null,
          input.degree?.trim() || null,
          Math.max(0, Math.round(input.salary || 0)),
          input.hireDate ?? null,
          input.status,
          input.note?.trim() || null,
          Date.now(),
          id
        )

      return this.findByIdOrFail(id, 'Giáo viên')
    })
  }

  /** Không cho xoá giáo viên còn được phân công lớp đang hoạt động */
  assertDeletable(id: number): void {
    const row = this.sqlite
      .prepare(
        `SELECT COUNT(*) AS c FROM classes
         WHERE teacher_id = ? AND deleted_at IS NULL AND status IN ('planned','ongoing')`
      )
      .get(id) as { c: number }

    if (row.c > 0) {
      throw AppError.conflict('Giáo viên đang phụ trách lớp học. Hãy chuyển lớp cho giáo viên khác trước.')
    }
  }

  options(): SelectOption[] {
    const rows = this.sqlite
      .prepare(
        `SELECT id, code, full_name AS fullName FROM teachers
         WHERE deleted_at IS NULL AND status = 'active' ORDER BY full_name`
      )
      .all() as { id: number; code: string; fullName: string }[]
    return rows.map((r) => ({ label: `${r.code} — ${r.fullName}`, value: r.id }))
  }
}

export const teacherRepository = new TeacherRepository()
