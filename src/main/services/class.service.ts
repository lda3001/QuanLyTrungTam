import { classRepository } from '../repositories/class.repository'
import { courseRepository } from '../repositories/course.repository'
import { audit } from './audit'
import { AppError } from '../utils/errors'
import type { PageResult, SelectOption } from '@shared/types/common'
import type { ClassRoomDetail, EnrollmentDetail, Student } from '@shared/types/entities'
import type {
  ClassInput,
  ClassQuery,
  ContinueClassInput,
  EnrollImportInput,
  EnrollInput,
  ImportResult,
  UpdateEnrollmentInput
} from '@shared/types/dto'

export class ClassService {
  list(query: ClassQuery): PageResult<ClassRoomDetail> {
    return classRepository.list(query ?? {})
  }

  get(id: number): ClassRoomDetail {
    return classRepository.detail(id)
  }

  create(input: ClassInput): ClassRoomDetail {
    this.validate(input)
    const cls = classRepository.create(input)
    audit('create', 'classes', cls.id, `Thêm lớp ${cls.code} — ${cls.name}`)
    return cls
  }

  update(id: number, input: ClassInput): ClassRoomDetail {
    this.validate(input)
    const cls = classRepository.update(id, input)
    audit('update', 'classes', cls.id, `Cập nhật lớp ${cls.code} — ${cls.name}`)
    return cls
  }

  continueClass(sourceClassId: number, input: ContinueClassInput): ClassRoomDetail {
    if (!Number.isInteger(sourceClassId) || sourceClassId < 1) {
      throw AppError.validation('Lớp nguồn không hợp lệ.')
    }
    if (!input.name?.trim()) throw AppError.validation('Tên lớp mới không được để trống.')
    if (!/^\d{4}\s*[–-]\s*\d{4}$/.test(input.academicYear?.trim() ?? '')) {
      throw AppError.validation('Năm học phải có dạng 2026–2027.')
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate ?? '')) {
      throw AppError.validation('Ngày bắt đầu không hợp lệ.')
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.endDate ?? '') || input.endDate < input.startDate) {
      throw AppError.validation('Ngày kết thúc phải từ ngày bắt đầu trở đi.')
    }
    if (input.maxStudents < 1) throw AppError.validation('Sĩ số tối đa phải lớn hơn 0.')
    if (!Number.isFinite(input.tuitionFee) || input.tuitionFee < 0) {
      throw AppError.validation('Học phí lớp mới phải là số không âm.')
    }
    if (!input.schedules?.length) throw AppError.validation('Cần ít nhất một lịch học hàng tuần.')

    const seen = new Set<string>()
    for (const schedule of input.schedules) {
      if (schedule.weekday < 0 || schedule.weekday > 6 || schedule.startTime >= schedule.endTime) {
        throw AppError.validation('Lịch học chuyển tiếp không hợp lệ.')
      }
      const key = `${schedule.weekday}|${schedule.startTime}`
      if (seen.has(key)) throw AppError.validation('Có hai lịch học trùng thời gian.')
      seen.add(key)
    }

    const nextClass = classRepository.continueClass(sourceClassId, input)
    audit(
      'continue',
      'classes',
      nextClass.id,
      `Mở lớp tiếp tục ${nextClass.code} — ${nextClass.name} từ lớp #${sourceClassId}`,
      {
        sourceClassId,
        academicYear: input.academicYear,
        transferredStudents: input.transferStudentIds?.length ?? 0,
        tuitionFee: input.tuitionFee,
        carryDiscounts: input.carryDiscounts === true
      }
    )
    return nextClass
  }

  remove(id: number): boolean {
    const cls = classRepository.findByIdOrFail(id, 'Lớp học')
    classRepository.assertDeletable(id)
    const done = classRepository.softDelete(id)
    if (done) audit('delete', 'classes', id, `Xoá lớp ${cls.code} — ${cls.name}`)
    return done
  }

  options(includeFinished = false): SelectOption[] {
    return classRepository.options(includeFinished)
  }

  students(classId: number): EnrollmentDetail[] {
    return classRepository.studentsOfClass(classId)
  }

  availableStudents(classId: number, keyword?: string): Student[] {
    return classRepository.availableStudents(classId, keyword)
  }

  enroll(input: EnrollInput): number {
    if (!input.studentIds?.length) throw AppError.validation('Chưa chọn học viên nào.')
    const count = classRepository.enroll(input)
    audit(
      'enroll',
      'enrollments',
      input.classId,
      `Xếp ${count} học viên vào lớp #${input.classId}`,
      {
        studentIds: input.studentIds
      }
    )
    return count
  }

  updateEnrollment(input: UpdateEnrollmentInput): EnrollmentDetail {
    if (!input?.id) throw AppError.validation('Thiếu thông tin ghi danh.')
    const parsedDate = input.enrollDate ? new Date(`${input.enrollDate}T00:00:00Z`) : null
    if (
      !input.enrollDate ||
      !/^\d{4}-\d{2}-\d{2}$/.test(input.enrollDate) ||
      !parsedDate ||
      Number.isNaN(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== input.enrollDate
    ) {
      throw AppError.validation('Ngày ghi danh không hợp lệ.')
    }

    const { enrollment, oldDate, oldPayable } = classRepository.updateEnrollmentDate(
      input.id,
      input.enrollDate
    )
    audit(
      'update',
      'enrollments',
      input.id,
      `Sửa ngày ghi danh của ${enrollment.studentName}: ${oldDate} → ${input.enrollDate}`,
      {
        oldDate,
        newDate: input.enrollDate,
        oldPayable,
        newPayable: enrollment.payableAmount
      }
    )
    return enrollment
  }

  unenroll(enrollmentId: number): boolean {
    const done = classRepository.unenroll(enrollmentId)
    if (done)
      audit(
        'unenroll',
        'enrollments',
        enrollmentId,
        `Gỡ học viên khỏi lớp (ghi danh #${enrollmentId})`
      )
    return done
  }

  /** Xếp học viên vào lớp hàng loạt từ file Excel (chỉ khớp học viên đã có) */
  enrollImport(input: EnrollImportInput): ImportResult {
    if (!input?.rows?.length) throw AppError.validation('Không có dòng nào để nhập.')
    const result = classRepository.enrollImport(input)
    audit(
      'enroll',
      'enrollments',
      input.classId,
      `Nhập Excel xếp lớp: ${result.inserted}/${result.total} học viên vào lớp #${input.classId}`,
      { failed: result.failed }
    )
    return result
  }

  private validate(input: ClassInput): void {
    if (!input.name?.trim()) throw AppError.validation('Tên lớp không được để trống.')
    if (!courseRepository.exists(input.courseId))
      throw AppError.validation('Khoá học không tồn tại.')
    if (input.maxStudents < 1) throw AppError.validation('Sĩ số tối đa phải lớn hơn 0.')
    if (input.tuitionFee != null && (!Number.isFinite(input.tuitionFee) || input.tuitionFee < 0)) {
      throw AppError.validation('Học phí lớp phải là số không âm.')
    }

    if (input.startDate && input.endDate && input.startDate > input.endDate) {
      throw AppError.validation('Ngày kết thúc phải sau ngày bắt đầu.')
    }

    // Chặn hai khung giờ trùng nhau trong cùng một lớp
    const seen = new Set<string>()
    for (const s of input.schedules ?? []) {
      if (s.weekday < 0 || s.weekday > 6) throw AppError.validation('Thứ trong tuần không hợp lệ.')
      const key = `${s.weekday}|${s.startTime}`
      if (seen.has(key))
        throw AppError.validation('Có hai khung giờ trùng nhau trong cùng một ngày.')
      seen.add(key)
    }
  }
}

export const classService = new ClassService()
