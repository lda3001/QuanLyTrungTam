import { studentRepository } from '../repositories/student.repository'
import { settingRepository } from '../repositories/setting.repository'
import { audit } from './audit'
import { AppError } from '../utils/errors'
import type { PageResult, SelectOption } from '@shared/types/common'
import type { EnrollmentDetail, PaymentDetail, Student } from '@shared/types/entities'
import type { ImportResult, StudentImportRow, StudentInput, StudentQuery } from '@shared/types/dto'
import { Gender, StudentStatus } from '@shared/constants/enums'

export class StudentService {
  list(query: StudentQuery): PageResult<Student> {
    return studentRepository.list(query ?? {})
  }

  get(id: number): Student {
    return studentRepository.findByIdOrFail(id, 'Học viên')
  }

  create(input: StudentInput): Student {
    this.validate(input)
    const prefix = settingRepository.getValue('studentPrefix', 'HV')
    const student = studentRepository.create(input, prefix)
    audit('create', 'students', student.id, `Thêm học viên ${student.code} — ${student.fullName}`)
    return student
  }

  update(id: number, input: StudentInput): Student {
    this.validate(input)
    const student = studentRepository.update(id, input)
    audit('update', 'students', student.id, `Cập nhật học viên ${student.code} — ${student.fullName}`)
    return student
  }

  remove(id: number): boolean {
    const student = studentRepository.findByIdOrFail(id, 'Học viên')
    studentRepository.assertDeletable(id)
    const done = studentRepository.softDelete(id)
    if (done) audit('delete', 'students', id, `Xoá học viên ${student.code} — ${student.fullName}`)
    return done
  }

  bulkRemove(ids: number[]): number {
    for (const id of ids) studentRepository.assertDeletable(id)
    const count = studentRepository.softDeleteMany(ids)
    audit('delete', 'students', null, `Xoá ${count} học viên`, { ids })
    return count
  }

  options(keyword?: string): SelectOption[] {
    return studentRepository.options(keyword)
  }

  schoolClasses(): string[] {
    return studentRepository.schoolClasses()
  }

  enrollments(studentId: number): EnrollmentDetail[] {
    return studentRepository.enrollments(studentId)
  }

  payments(studentId: number): PaymentDetail[] {
    return studentRepository.payments(studentId)
  }

  private validate(input: StudentInput): void {
    if (!input.fullName?.trim()) throw AppError.validation('Họ tên không được để trống.')
    if (input.fullName.trim().length > 100) throw AppError.validation('Họ tên quá dài (tối đa 100 ký tự).')

    if (input.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
      throw AppError.validation('Email không hợp lệ.')
    }
    if (input.phone?.trim() && !/^[0-9+\-\s()]{8,15}$/.test(input.phone.trim())) {
      throw AppError.validation('Số điện thoại không hợp lệ.')
    }
    if (input.birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.birthDate)) {
      throw AppError.validation('Ngày sinh không hợp lệ.')
    }
    if (input.schoolClass && input.schoolClass.trim().length > 50) {
      throw AppError.validation('Lớp ở trường quá dài (tối đa 50 ký tự).')
    }
  }

  /**
   * Nhập danh sách học viên từ Excel.
   *
   * Chiến lược: xử lý từng dòng độc lập — một dòng lỗi không làm hỏng cả file.
   * Kết quả trả về gồm số dòng thành công và chi tiết lỗi theo số dòng để
   * người dùng sửa đúng chỗ trong file gốc.
   */
  importRows(rows: StudentImportRow[]): ImportResult {
    const prefix = settingRepository.getValue('studentPrefix', 'HV')
    const result: ImportResult = { total: rows.length, inserted: 0, failed: 0, errors: [] }

    if (rows.length > 5000) {
      throw AppError.validation('Mỗi lần chỉ nhập tối đa 5.000 dòng.')
    }

    const seenCodes = new Set<string>()

    rows.forEach((row, index) => {
      // +2 vì hàng 1 là tiêu đề, và Excel đánh số từ 1
      const rowNumber = index + 2
      try {
        if (!row.fullName?.trim()) throw new Error('Thiếu họ tên')

        const code = row.code?.trim()
        if (code) {
          if (seenCodes.has(code)) throw new Error(`Mã "${code}" bị lặp trong file`)
          seenCodes.add(code)
        }

        const input: StudentInput = {
          code: code || undefined,
          fullName: row.fullName.trim(),
          gender: parseGender(row.gender),
          birthDate: parseDate(row.birthDate),
          email: row.email?.trim() || null,
          phone: row.phone?.toString().trim() || null,
          address: row.address?.trim() || null,
          schoolClass: row.schoolClass?.trim() || null,
          guardianName: row.guardianName?.trim() || null,
          guardianPhone: row.guardianPhone?.toString().trim() || null,
          note: row.note?.trim() || null,
          status: StudentStatus.ACTIVE
        }

        this.validate(input)
        studentRepository.create(input, prefix)
        result.inserted++
      } catch (err) {
        result.failed++
        result.errors.push({
          row: rowNumber,
          message: err instanceof Error ? err.message : String(err)
        })
      }
    })

    audit('import', 'students', null, `Nhập Excel: ${result.inserted}/${result.total} học viên`, {
      failed: result.failed
    })
    return result
  }
}

/** Chấp nhận cả "Nam/Nữ" tiếng Việt lẫn "male/female" để file mẫu dễ dùng */
function parseGender(value: string | undefined): Gender {
  const v = (value ?? '').trim().toLowerCase()
  if (['nữ', 'nu', 'female', 'f'].includes(v)) return Gender.FEMALE
  if (['khác', 'khac', 'other'].includes(v)) return Gender.OTHER
  return Gender.MALE
}

/** Nhận dd/MM/yyyy (thói quen Việt Nam) và yyyy-MM-dd, trả về yyyy-MM-dd */
function parseDate(value: string | undefined): string | null {
  const v = (value ?? '').trim()
  if (!v) return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v

  const m = v.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/)
  if (m) {
    const [, d, mo, y] = m
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  return null
}

export const studentService = new StudentService()
