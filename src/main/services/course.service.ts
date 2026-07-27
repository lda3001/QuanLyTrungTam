import { courseRepository } from '../repositories/course.repository'
import { audit } from './audit'
import { AppError } from '../utils/errors'
import type { PageResult, SelectOption } from '@shared/types/common'
import type { Course } from '@shared/types/entities'
import type { CourseInput, CourseQuery } from '@shared/types/dto'

export class CourseService {
  list(query: CourseQuery): PageResult<Course> {
    return courseRepository.list(query ?? {})
  }

  get(id: number): Course {
    return courseRepository.findByIdOrFail(id, 'Khoá học')
  }

  create(input: CourseInput): Course {
    this.validate(input)
    const course = courseRepository.create(input)
    audit('create', 'courses', course.id, `Thêm khoá học ${course.code} — ${course.name}`)
    return course
  }

  update(id: number, input: CourseInput): Course {
    this.validate(input)
    const course = courseRepository.update(id, input)
    audit('update', 'courses', course.id, `Cập nhật khoá học ${course.code} — ${course.name}`)
    return course
  }

  remove(id: number): boolean {
    const course = courseRepository.findByIdOrFail(id, 'Khoá học')
    courseRepository.assertDeletable(id)
    const done = courseRepository.softDelete(id)
    if (done) audit('delete', 'courses', id, `Xoá khoá học ${course.code} — ${course.name}`)
    return done
  }

  options(): SelectOption[] {
    return courseRepository.options()
  }

  private validate(input: CourseInput): void {
    if (!input.name?.trim()) throw AppError.validation('Tên khoá học không được để trống.')
    if (input.tuitionFee < 0) throw AppError.validation('Học phí không được âm.')
    if (input.totalSessions < 0) throw AppError.validation('Số buổi không được âm.')
    if (input.durationHours < 0) throw AppError.validation('Thời lượng không được âm.')
  }
}

export const courseService = new CourseService()
