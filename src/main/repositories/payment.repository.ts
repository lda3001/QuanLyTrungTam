import { BaseRepository } from './base.repository'
import { AppError } from '../utils/errors'
import { generateReceiptCode } from '../utils/code-generator'
import { likeParam, normalizePage, safeSort, toPageResult } from '../utils/pagination'
import type { PageResult } from '@shared/types/common'
import type { Payment, PaymentDetail } from '@shared/types/entities'
import type { DebtQuery, DebtRow, PaymentInput, PaymentQuery } from '@shared/types/dto'

const SORTABLE: Record<string, string> = {
  code: 'p.code',
  amount: 'p.amount',
  paidDate: 'p.paid_date',
  createdAt: 'p.created_at'
}

const PAYMENT_COLUMNS = `
  p.id, p.code, p.student_id AS studentId, p.enrollment_id AS enrollmentId,
  p.amount, p.method, p.status, p.paid_date AS paidDate, p.note,
  p.created_by AS createdBy,
  p.created_at AS createdAt, p.updated_at AS updatedAt, p.deleted_at AS deletedAt,
  s.code AS studentCode, s.full_name AS studentName, s.phone AS studentPhone,
  cl.name AS className, co.name AS courseName, u.full_name AS createdByName`

const PAYMENT_FROM = `
  FROM payments p
  JOIN students s ON s.id = p.student_id
  LEFT JOIN enrollments e ON e.id = p.enrollment_id
  LEFT JOIN classes cl ON cl.id = e.class_id
  LEFT JOIN courses co ON co.id = cl.course_id
  LEFT JOIN users u ON u.id = p.created_by`

export class PaymentRepository extends BaseRepository<Payment> {
  protected readonly tableName = 'payments'
  protected readonly selectColumns = `
    id, code, student_id AS studentId, enrollment_id AS enrollmentId, amount, method,
    status, paid_date AS paidDate, note, created_by AS createdBy,
    created_at AS createdAt, updated_at AS updatedAt, deleted_at AS deletedAt`

  list(query: PaymentQuery): PageResult<PaymentDetail> {
    const p = normalizePage(query)
    const where: string[] = ['p.deleted_at IS NULL']
    const params: unknown[] = []

    const kw = likeParam(query.keyword)
    if (kw) {
      where.push(`(p.code LIKE ? ESCAPE '\\' OR s.code LIKE ? ESCAPE '\\' OR search_text(s.full_name) LIKE ? ESCAPE '\\')`)
      params.push(kw, kw, kw)
    }
    if (query.status) {
      where.push('p.status = ?')
      params.push(query.status)
    }
    if (query.method) {
      where.push('p.method = ?')
      params.push(query.method)
    }
    if (query.studentId) {
      where.push('p.student_id = ?')
      params.push(query.studentId)
    }
    if (query.classId) {
      where.push('e.class_id = ?')
      params.push(query.classId)
    }
    if (query.from) {
      where.push('p.paid_date >= ?')
      params.push(query.from)
    }
    if (query.to) {
      where.push('p.paid_date <= ?')
      params.push(query.to)
    }

    const whereSql = where.join(' AND ')
    const orderBy = safeSort(query.sortBy, query.sortOrder, SORTABLE, 'p.paid_date')

    const total = (
      this.sqlite
        .prepare(`SELECT COUNT(*) AS c ${PAYMENT_FROM} WHERE ${whereSql}`)
        .get(...(params as never[])) as { c: number }
    ).c

    const items = this.sqlite
      .prepare(
        `SELECT ${PAYMENT_COLUMNS} ${PAYMENT_FROM}
         WHERE ${whereSql} ORDER BY ${orderBy}, p.id DESC LIMIT ? OFFSET ?`
      )
      .all(...(params as never[]), p.limit, p.offset) as PaymentDetail[]

    return toPageResult(items, total, p)
  }

  detail(id: number): PaymentDetail {
    const row = this.sqlite
      .prepare(`SELECT ${PAYMENT_COLUMNS} ${PAYMENT_FROM} WHERE p.id = ? AND p.deleted_at IS NULL`)
      .get(id) as PaymentDetail | undefined
    if (!row) throw AppError.notFound('Phiếu thu')
    return row
  }

  create(input: PaymentInput, createdBy: number | null, prefix: string): PaymentDetail {
    return this.transaction(() => {
      if (input.amount <= 0) throw AppError.validation('Số tiền phải lớn hơn 0.')

      // Không cho thu vượt công nợ còn lại — sai sót này rất khó đối soát về sau
      if (input.enrollmentId) {
        const remaining = this.remainingOfEnrollment(input.enrollmentId)
        if (input.status !== 'refunded' && input.amount > remaining) {
          throw AppError.validation(
            `Số tiền vượt công nợ còn lại (${remaining.toLocaleString('vi-VN')} ₫).`
          )
        }
      }

      const code = input.code?.trim() || generateReceiptCode(this.sqlite, prefix, input.paidDate)
      if (this.isDuplicate('code', code)) {
        throw AppError.duplicate(`Mã phiếu thu "${code}" đã tồn tại.`)
      }

      const now = Date.now()
      const res = this.sqlite
        .prepare(
          `INSERT INTO payments
            (code, student_id, enrollment_id, amount, method, status, paid_date, note,
             created_by, created_at, updated_at, deleted_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,NULL)`
        )
        .run(
          code,
          input.studentId,
          input.enrollmentId ?? null,
          Math.round(input.amount),
          input.method,
          input.status,
          input.paidDate,
          input.note?.trim() || null,
          createdBy,
          now,
          now
        )

      return this.detail(Number(res.lastInsertRowid))
    })
  }

  update(id: number, input: PaymentInput): PaymentDetail {
    return this.transaction(() => {
      const current = this.findByIdOrFail(id, 'Phiếu thu')
      if (input.amount <= 0) throw AppError.validation('Số tiền phải lớn hơn 0.')

      if (input.enrollmentId) {
        // Cộng lại số tiền của chính phiếu đang sửa trước khi so với công nợ
        const remaining = this.remainingOfEnrollment(input.enrollmentId) + (current.enrollmentId === input.enrollmentId ? current.amount : 0)
        if (input.status !== 'refunded' && input.amount > remaining) {
          throw AppError.validation(`Số tiền vượt công nợ còn lại (${remaining.toLocaleString('vi-VN')} ₫).`)
        }
      }

      const code = input.code?.trim() || current.code
      if (code !== current.code && this.isDuplicate('code', code, id)) {
        throw AppError.duplicate(`Mã phiếu thu "${code}" đã tồn tại.`)
      }

      this.sqlite
        .prepare(
          `UPDATE payments SET
             code = ?, student_id = ?, enrollment_id = ?, amount = ?, method = ?,
             status = ?, paid_date = ?, note = ?, updated_at = ?
           WHERE id = ? AND deleted_at IS NULL`
        )
        .run(
          code,
          input.studentId,
          input.enrollmentId ?? null,
          Math.round(input.amount),
          input.method,
          input.status,
          input.paidDate,
          input.note?.trim() || null,
          Date.now(),
          id
        )

      return this.detail(id)
    })
  }

  /** Công nợ còn lại của một lần ghi danh = học phí − giảm giá − đã thu */
  remainingOfEnrollment(enrollmentId: number): number {
    const row = this.sqlite
      .prepare(
        `SELECT
           e.agreed_fee AS fee, e.discount,
           COALESCE((SELECT SUM(amount) FROM payments
                     WHERE enrollment_id = e.id AND deleted_at IS NULL AND status <> 'refunded'), 0) AS paid
         FROM enrollments e WHERE e.id = ? AND e.deleted_at IS NULL`
      )
      .get(enrollmentId) as { fee: number; discount: number; paid: number } | undefined

    if (!row) throw AppError.notFound('Đăng ký lớp học')
    return Math.max(0, row.fee - row.discount - row.paid)
  }

  /** Bảng công nợ: mỗi dòng là một lần ghi danh kèm số đã thu / còn thiếu */
  debts(query: DebtQuery): PageResult<DebtRow> {
    const p = normalizePage(query)
    const where: string[] = ['e.deleted_at IS NULL', "e.status <> 'withdrawn'"]
    const params: unknown[] = []

    const kw = likeParam(query.keyword)
    if (kw) {
      where.push(`(s.code LIKE ? ESCAPE '\\' OR search_text(s.full_name) LIKE ? ESCAPE '\\' OR cl.name LIKE ? ESCAPE '\\')`)
      params.push(kw, kw, kw)
    }
    if (query.classId) {
      where.push('e.class_id = ?')
      params.push(query.classId)
    }
    if (query.courseId) {
      where.push('cl.course_id = ?')
      params.push(query.courseId)
    }

    const having = query.onlyDebt ? 'AND (e.agreed_fee - e.discount - COALESCE(pay.paid,0)) > 0' : ''
    const whereSql = `${where.join(' AND ')} ${having}`

    const fromSql = `
      FROM enrollments e
      JOIN students s ON s.id = e.student_id
      JOIN classes cl ON cl.id = e.class_id
      JOIN courses co ON co.id = cl.course_id
      LEFT JOIN (
        SELECT enrollment_id, SUM(amount) AS paid FROM payments
        WHERE deleted_at IS NULL AND status <> 'refunded'
        GROUP BY enrollment_id
      ) pay ON pay.enrollment_id = e.id
      WHERE ${whereSql}`

    const total = (
      this.sqlite.prepare(`SELECT COUNT(*) AS c ${fromSql}`).get(...(params as never[])) as { c: number }
    ).c

    const rows = this.sqlite
      .prepare(
        `SELECT
           e.id AS enrollmentId, e.student_id AS studentId,
           s.code AS studentCode, s.full_name AS studentName, s.phone AS studentPhone,
           e.class_id AS classId, cl.name AS className, co.name AS courseName,
           e.agreed_fee AS agreedFee, e.discount,
           (e.agreed_fee - e.discount) AS payable,
           COALESCE(pay.paid, 0) AS paid,
           (e.agreed_fee - e.discount - COALESCE(pay.paid, 0)) AS remaining,
           CASE
             WHEN COALESCE(pay.paid,0) <= 0 THEN 'unpaid'
             WHEN COALESCE(pay.paid,0) >= (e.agreed_fee - e.discount) THEN 'paid'
             ELSE 'partial'
           END AS status
         ${fromSql}
         ORDER BY remaining DESC, s.full_name
         LIMIT ? OFFSET ?`
      )
      .all(...(params as never[]), p.limit, p.offset) as DebtRow[]

    return toPageResult(rows, total, p)
  }

  assertDeletable(_id: number): void {
    // Phiếu thu luôn được phép xoá mềm; ràng buộc nghiệp vụ nằm ở tầng service
    // (chỉ Admin/Quản lý mới có quyền `payment:delete`).
  }
}

export const paymentRepository = new PaymentRepository()
