import { teacherRepository } from '../repositories/teacher.repository'
import { settingRepository } from '../repositories/setting.repository'
import { audit } from './audit'
import { AppError } from '../utils/errors'
import type { PageResult, SelectOption } from '@shared/types/common'
import type { Teacher } from '@shared/types/entities'
import type { TeacherInput, TeacherQuery } from '@shared/types/dto'

export class TeacherService {
  list(query: TeacherQuery): PageResult<Teacher> {
    return teacherRepository.list(query ?? {})
  }

  get(id: number): Teacher {
    return teacherRepository.findByIdOrFail(id, 'Giáo viên')
  }

  create(input: TeacherInput): Teacher {
    this.validate(input)
    const prefix = settingRepository.getValue('teacherPrefix', 'GV')
    const teacher = teacherRepository.create(input, prefix)
    audit('create', 'teachers', teacher.id, `Thêm giáo viên ${teacher.code} — ${teacher.fullName}`)
    return teacher
  }

  update(id: number, input: TeacherInput): Teacher {
    this.validate(input)
    const teacher = teacherRepository.update(id, input)
    audit('update', 'teachers', teacher.id, `Cập nhật giáo viên ${teacher.code} — ${teacher.fullName}`)
    return teacher
  }

  remove(id: number): boolean {
    const teacher = teacherRepository.findByIdOrFail(id, 'Giáo viên')
    teacherRepository.assertDeletable(id)
    const done = teacherRepository.softDelete(id)
    if (done) audit('delete', 'teachers', id, `Xoá giáo viên ${teacher.code} — ${teacher.fullName}`)
    return done
  }

  options(): SelectOption[] {
    return teacherRepository.options()
  }

  private validate(input: TeacherInput): void {
    if (!input.fullName?.trim()) throw AppError.validation('Họ tên không được để trống.')
    if (input.salary < 0) throw AppError.validation('Mức lương không được âm.')
    if (input.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
      throw AppError.validation('Email không hợp lệ.')
    }
    if (input.phone?.trim() && !/^[0-9+\-\s()]{8,15}$/.test(input.phone.trim())) {
      throw AppError.validation('Số điện thoại không hợp lệ.')
    }
  }
}

export const teacherService = new TeacherService()
