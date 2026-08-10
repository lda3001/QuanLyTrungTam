import { BaseRepository } from './base.repository'
import { AppError } from '../utils/errors'
import { generateCode } from '../utils/code-generator'
import { likeParam, normalizePage, safeSort, toPageResult } from '../utils/pagination'
import type { PageResult, SelectOption } from '@shared/types/common'
import type { EnrollmentDetail, PaymentDetail, Student } from '@shared/types/entities'
import type { StudentInput, StudentQuery } from '@shared/types/dto'

const SORTABLE: Record<string, string> = {
  code: 's.code',
  fullName: 'last_name(s.full_name)',
  createdAt: 's.created_at',
  status: 's.status',
  birthDate: 's.birth_date',
  schoolClass: 's.school_class'
}

export class StudentRepository extends BaseRepository<Student> {
  protected readonly tableName = 'students'
  protected readonly selectColumns = `
    id, code, full_name AS fullName, gender, birth_date AS birthDate, email, phone,
    address, school_class AS schoolClass, guardian_name AS guardianName,
    guardian_phone AS guardianPhone, note, status, avatar,
    created_at AS createdAt, updated_at AS updatedAt, deleted_at AS deletedAt`

  /** Bản có tiền tố bảng, dùng cho truy vấn danh sách (bảng được đặt bí danh `s`) */
  private readonly listColumns = `
    s.id, s.code, s.full_name AS fullName, s.gender, s.birth_date AS birthDate,
    s.email, s.phone, s.address, s.school_class AS schoolClass,
    s.guardian_name AS guardianName, s.guardian_phone AS guardianPhone,
    s.note, s.status, s.avatar,
    s.created_at AS createdAt, s.updated_at AS updatedAt, s.deleted_at AS deletedAt`

  /**
   * Danh sách có phân trang phía server.
   *
   * Bộ lọc theo lớp/khoá học dùng EXISTS thay vì JOIN: tránh nhân bản dòng khi
   * học viên ghi danh nhiều lớp, và COUNT(*) vẫn chính xác.
   */
  list(query: StudentQuery): PageResult<Student> {
    const p = normalizePage(query)
    const where: string[] = ['s.deleted_at IS NULL']
    const params: unknown[] = []

    const kw = likeParam(query.keyword)
    if (kw) {
      where.push(`(s.code LIKE ? ESCAPE '\\' OR search_text(s.full_name) LIKE ? ESCAPE '\\'
                   OR s.phone LIKE ? ESCAPE '\\' OR s.email LIKE ? ESCAPE '\\'
                   OR s.school_class LIKE ? ESCAPE '\\')`)
      params.push(kw, kw, kw, kw, kw)
    }
    if (query.status) {
      where.push('s.status = ?')
      params.push(query.status)
    }
    if (query.gender) {
      where.push('s.gender = ?')
      params.push(query.gender)
    }
    if (query.schoolClass) {
      where.push('s.school_class = ?')
      params.push(query.schoolClass)
    }
    if (query.classId) {
      where.push(
        `EXISTS (SELECT 1 FROM enrollments e
                 WHERE e.student_id = s.id AND e.class_id = ? AND e.deleted_at IS NULL)`
      )
      params.push(query.classId)
    }
    if (query.courseId) {
      where.push(
        `EXISTS (SELECT 1 FROM enrollments e
                 JOIN classes c ON c.id = e.class_id
                 WHERE e.student_id = s.id AND c.course_id = ?
                   AND e.deleted_at IS NULL AND c.deleted_at IS NULL)`
      )
      params.push(query.courseId)
    }

    const whereSql = where.join(' AND ')
    const orderBy = query.sortBy
      ? safeSort(query.sortBy, query.sortOrder, SORTABLE, 's.created_at')
      : 'last_name(s.full_name) ASC, s.full_name ASC'

    const total = (
      this.sqlite.prepare(`SELECT COUNT(*) AS c FROM students s WHERE ${whereSql}`).get(...(params as never[])) as {
        c: number
      }
    ).c

    const items = this.sqlite
      .prepare(
        `SELECT ${this.listColumns}
         FROM students s
         WHERE ${whereSql}
         ORDER BY ${orderBy}
         LIMIT ? OFFSET ?`
      )
      .all(...(params as never[]), p.limit, p.offset) as Student[]

    return toPageResult(items, total, p)
  }

  create(input: StudentInput, prefix: string): Student {
    return this.transaction(() => {
      const code = input.code?.trim() || generateCode(this.sqlite, 'students', prefix)
      if (this.isDuplicate('code', code)) {
        throw AppError.duplicate(`Mã học viên "${code}" đã tồn tại.`)
      }

      const now = Date.now()
      const res = this.sqlite
        .prepare(
          `INSERT INTO students
            (code, full_name, gender, birth_date, email, phone, address, school_class,
             guardian_name, guardian_phone, note, status, avatar,
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
          input.schoolClass?.trim() || null,
          input.guardianName?.trim() || null,
          input.guardianPhone?.trim() || null,
          input.note?.trim() || null,
          input.status,
          input.avatar ?? null,
          now,
          now
        )

      return this.findByIdOrFail(Number(res.lastInsertRowid), 'Học viên')
    })
  }

  update(id: number, input: StudentInput): Student {
    return this.transaction(() => {
      const current = this.findByIdOrFail(id, 'Học viên')
      const code = input.code?.trim() || current.code
      if (code !== current.code && this.isDuplicate('code', code, id)) {
        throw AppError.duplicate(`Mã học viên "${code}" đã tồn tại.`)
      }

      this.sqlite
        .prepare(
          `UPDATE students SET
             code = ?, full_name = ?, gender = ?, birth_date = ?, email = ?, phone = ?,
             address = ?, school_class = ?, guardian_name = ?, guardian_phone = ?,
             note = ?, status = ?, avatar = ?, updated_at = ?
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
          input.schoolClass?.trim() || null,
          input.guardianName?.trim() || null,
          input.guardianPhone?.trim() || null,
          input.note?.trim() || null,
          input.status,
          input.avatar ?? null,
          Date.now(),
          id
        )

      return this.findByIdOrFail(id, 'Học viên')
    })
  }

  /** Chặn xoá học viên còn đang học ở lớp nào đó — tránh mất dấu công nợ */
  assertDeletable(id: number): void {
    const row = this.sqlite
      .prepare(
        `SELECT COUNT(*) AS c FROM enrollments
         WHERE student_id = ? AND deleted_at IS NULL AND status = 'studying'`
      )
      .get(id) as { c: number }

    if (row.c > 0) {
      throw AppError.conflict(
        'Học viên đang theo học ít nhất một lớp. Hãy kết thúc hoặc rút khỏi lớp trước khi xoá.'
      )
    }
  }

  options(keyword?: string): SelectOption[] {
    const kw = likeParam(keyword)
    const rows = kw
      ? (this.sqlite
          .prepare(
            `SELECT id, code, full_name AS fullName FROM students
             WHERE deleted_at IS NULL AND (code LIKE ? ESCAPE '\\' OR search_text(full_name) LIKE ? ESCAPE '\\')
             ORDER BY full_name LIMIT 50`
          )
          .all(kw, kw) as { id: number; code: string; fullName: string }[])
      : (this.sqlite
          .prepare(
            `SELECT id, code, full_name AS fullName FROM students
             WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 50`
          )
          .all() as { id: number; code: string; fullName: string }[])

    return rows.map((r) => ({ label: `${r.code} — ${r.fullName}`, value: r.id }))
  }

  /** Các lớp học viên đang/đã tham gia, kèm số tiền đã đóng và còn nợ */
  enrollments(studentId: number): EnrollmentDetail[] {
    return this.sqlite
      .prepare(
        `SELECT
           e.id, e.student_id AS studentId, e.class_id AS classId,
           e.enroll_date AS enrollDate, e.status, e.agreed_fee AS agreedFee,
           e.fee_type AS feeType, e.custom_fee AS customFee,
           e.discount, e.surcharge, e.payable_override AS payableOverride, e.note,
           e.created_at AS createdAt, e.updated_at AS updatedAt, e.deleted_at AS deletedAt,
           s.code AS studentCode, s.full_name AS studentName, s.phone AS studentPhone,
           cl.name AS className, co.name AS courseName,
           et.default_fee AS defaultFee, et.calculated_fee AS calculatedFee,
           et.payable AS payableAmount,
           et.eligible_session_count AS eligibleSessionCount,
           et.total_session_count AS totalSessionCount,
           et.billable_month_count AS billableMonthCount,
           COALESCE(pay.paid, 0) AS paidAmount,
           (et.payable - COALESCE(pay.paid, 0)) AS remainingAmount
         FROM enrollments e
         JOIN students s ON s.id = e.student_id
         JOIN classes cl ON cl.id = e.class_id
         JOIN courses co ON co.id = cl.course_id
         JOIN enrollment_tuition et ON et.enrollment_id = e.id
         LEFT JOIN (
           SELECT enrollment_id, SUM(amount) AS paid FROM payments
           WHERE deleted_at IS NULL AND status <> 'refunded'
           GROUP BY enrollment_id
         ) pay ON pay.enrollment_id = e.id
         WHERE e.student_id = ? AND e.deleted_at IS NULL
         ORDER BY e.enroll_date DESC`
      )
      .all(studentId) as EnrollmentDetail[]
  }

  payments(studentId: number): PaymentDetail[] {
    return this.sqlite
      .prepare(
        `SELECT
           p.id, p.code, p.student_id AS studentId, p.enrollment_id AS enrollmentId,
           p.amount, p.method, p.status, p.paid_date AS paidDate, p.note,
           p.created_by AS createdBy,
           p.created_at AS createdAt, p.updated_at AS updatedAt, p.deleted_at AS deletedAt,
           s.code AS studentCode, s.full_name AS studentName, s.phone AS studentPhone,
           cl.name AS className, co.name AS courseName, u.full_name AS createdByName
         FROM payments p
         JOIN students s ON s.id = p.student_id
         LEFT JOIN enrollments e ON e.id = p.enrollment_id
         LEFT JOIN classes cl ON cl.id = e.class_id
         LEFT JOIN courses co ON co.id = cl.course_id
         LEFT JOIN users u ON u.id = p.created_by
         WHERE p.student_id = ? AND p.deleted_at IS NULL
         ORDER BY p.paid_date DESC, p.id DESC`
      )
      .all(studentId) as PaymentDetail[]
  }

  /**
   * Danh sách lớp ở trường đang có trong dữ liệu, dùng làm gợi ý cho ô lọc.
   * Lấy từ chính dữ liệu thay vì bắt người dùng khai báo trước một danh mục —
   * mỗi trung tâm có cách đặt tên lớp khác nhau (10A1, 10 A1, K10-A1...).
   */
  schoolClasses(): string[] {
    const rows = this.sqlite
      .prepare(
        `SELECT DISTINCT school_class AS value FROM students
         WHERE deleted_at IS NULL AND school_class IS NOT NULL AND TRIM(school_class) <> ''
         ORDER BY school_class`
      )
      .all() as { value: string }[]
    return rows.map((r) => r.value)
  }

  /** Dùng cho import Excel: kiểm tra hàng loạt mã đã tồn tại chưa */
  existingCodes(codes: string[]): Set<string> {
    if (codes.length === 0) return new Set()
    const placeholders = codes.map(() => '?').join(',')
    const rows = this.sqlite
      .prepare(`SELECT code FROM students WHERE code IN (${placeholders})`)
      .all(...codes) as { code: string }[]
    return new Set(rows.map((r) => r.code))
  }
}

export const studentRepository = new StudentRepository()
