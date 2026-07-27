import { paymentRepository } from '../repositories/payment.repository'
import { studentRepository } from '../repositories/student.repository'
import { settingRepository } from '../repositories/setting.repository'
import { sessionStore } from './session.store'
import { audit } from './audit'
import { AppError } from '../utils/errors'
import type { PageResult } from '@shared/types/common'
import type { EnrollmentDetail, PaymentDetail } from '@shared/types/entities'
import type { DebtQuery, DebtRow, PaymentInput, PaymentQuery, ReceiptData } from '@shared/types/dto'

export class PaymentService {
  list(query: PaymentQuery): PageResult<PaymentDetail> {
    return paymentRepository.list(query ?? {})
  }

  get(id: number): PaymentDetail {
    return paymentRepository.detail(id)
  }

  create(input: PaymentInput): PaymentDetail {
    this.validate(input)
    const prefix = settingRepository.getValue('receiptPrefix', 'PT')
    const payment = paymentRepository.create(input, sessionStore.userId(), prefix)
    audit(
      'create',
      'payments',
      payment.id,
      `Lập phiếu thu ${payment.code} — ${payment.studentName} — ${payment.amount.toLocaleString('vi-VN')} ₫`
    )
    return payment
  }

  update(id: number, input: PaymentInput): PaymentDetail {
    this.validate(input)
    const payment = paymentRepository.update(id, input)
    audit('update', 'payments', payment.id, `Sửa phiếu thu ${payment.code}`)
    return payment
  }

  remove(id: number): boolean {
    const payment = paymentRepository.detail(id)
    const done = paymentRepository.softDelete(id)
    if (done) {
      audit(
        'delete',
        'payments',
        id,
        `Xoá phiếu thu ${payment.code} — ${payment.studentName} — ${payment.amount.toLocaleString('vi-VN')} ₫`
      )
    }
    return done
  }

  debts(query: DebtQuery): PageResult<DebtRow> {
    return paymentRepository.debts(query ?? {})
  }

  studentEnrollments(studentId: number): EnrollmentDetail[] {
    return studentRepository.enrollments(studentId)
  }

  /**
   * Gom đủ dữ liệu để in phiếu thu.
   * Số liệu công nợ được tính lại tại thời điểm in, không lấy từ bản ghi cũ.
   */
  receipt(paymentId: number): ReceiptData {
    const payment = paymentRepository.detail(paymentId)
    const center = settingRepository.getCenterSettings()
    const student = studentRepository.findByIdOrFail(payment.studentId, 'Học viên')

    let payable = payment.amount
    let paid = payment.amount
    let remaining = 0

    if (payment.enrollmentId) {
      const enrollment = studentRepository
        .enrollments(payment.studentId)
        .find((e) => e.id === payment.enrollmentId)
      if (enrollment) {
        payable = enrollment.agreedFee - enrollment.discount
        paid = enrollment.paidAmount
        remaining = Math.max(0, enrollment.remainingAmount)
      }
    }

    return {
      payment: {
        code: payment.code,
        amount: payment.amount,
        method: payment.method,
        paidDate: payment.paidDate,
        note: payment.note
      },
      student: {
        code: student.code,
        fullName: student.fullName,
        phone: student.phone,
        address: student.address
      },
      className: payment.className,
      courseName: payment.courseName,
      totals: { payable, paid, remaining },
      center: {
        centerName: center.centerName,
        centerAddress: center.centerAddress,
        centerPhone: center.centerPhone,
        centerEmail: center.centerEmail,
        centerTaxCode: center.centerTaxCode
      },
      cashierName: payment.createdByName ?? sessionStore.get()?.fullName ?? '',
      printedAt: Date.now()
    }
  }

  private validate(input: PaymentInput): void {
    if (!input.studentId) throw AppError.validation('Chưa chọn học viên.')
    if (!input.amount || input.amount <= 0) throw AppError.validation('Số tiền phải lớn hơn 0.')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.paidDate)) throw AppError.validation('Ngày thu không hợp lệ.')
    if (!studentRepository.exists(input.studentId)) throw AppError.validation('Học viên không tồn tại.')
  }
}

export const paymentService = new PaymentService()
