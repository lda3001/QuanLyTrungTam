import { sessionRepository } from '../repositories/session.repository'
import { audit } from './audit'
import type { ClassSession, ClassSessionDetail } from '@shared/types/entities'
import type { GenerateSessionsInput, MoveSessionInput, SessionInput, SessionQuery } from '@shared/types/dto'

export class ClassSessionService {
  list(query: SessionQuery): ClassSessionDetail[] {
    return sessionRepository.list(query ?? {})
  }

  get(id: number): ClassSessionDetail {
    return sessionRepository.detail(id)
  }

  create(input: SessionInput): ClassSession {
    const s = sessionRepository.create(input)
    audit('create', 'class_sessions', s.id, `Thêm buổi học ngày ${s.sessionDate} (${s.startTime}–${s.endTime})`)
    return s
  }

  update(id: number, input: SessionInput): ClassSession {
    const s = sessionRepository.update(id, input)
    audit('update', 'class_sessions', s.id, `Cập nhật buổi học ngày ${s.sessionDate}`)
    return s
  }

  remove(id: number): boolean {
    const s = sessionRepository.findByIdOrFail(id, 'Buổi học')
    sessionRepository.assertDeletable(id)
    const done = sessionRepository.softDelete(id)
    if (done) audit('delete', 'class_sessions', id, `Xoá buổi học ngày ${s.sessionDate}`)
    return done
  }

  /** Kéo–thả trên lịch */
  move(input: MoveSessionInput): ClassSession {
    const s = sessionRepository.move(input)
    audit('move', 'class_sessions', s.id, `Dời buổi học sang ${s.sessionDate} ${s.startTime}–${s.endTime}`)
    return s
  }

  generate(input: GenerateSessionsInput): number {
    const count = sessionRepository.generate(input)
    audit('generate', 'class_sessions', input.classId, `Sinh ${count} buổi học cho lớp #${input.classId}`)
    return count
  }
}

export const classSessionService = new ClassSessionService()
