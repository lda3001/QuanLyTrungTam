import { analyticsRepository } from '../repositories/analytics.repository'
import { settingRepository } from '../repositories/setting.repository'
import { audit } from './audit'
import { AppError } from '../utils/errors'
import type {
  AttendanceReportRow,
  DashboardData,
  ReportRange,
  RevenueReport,
  StudentReportRow,
  TeacherReportRow,
  TuitionReportRow
} from '@shared/types/dto'
import type { AppSetting } from '@shared/types/entities'

/** yyyy-MM-dd theo giờ máy người dùng */
function toYmd(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function toYm(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export class DashboardService {
  data(): DashboardData {
    const now = new Date()

    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)

    // 12 tháng gần nhất, cũ → mới, để biểu đồ đường đọc từ trái sang phải
    const months: string[] = []
    for (let i = 11; i >= 0; i--) {
      months.push(toYm(new Date(now.getFullYear(), now.getMonth() - i, 1)))
    }

    return analyticsRepository.dashboard(toYmd(now), toYm(now), toYm(prev), months)
  }
}

export class ReportService {
  revenue(range: ReportRange & { groupBy?: 'day' | 'month' }): RevenueReport {
    this.validateRange(range)
    const report = analyticsRepository.revenueReport(range, range.groupBy === 'day' ? 'day' : 'month')
    audit('view', 'reports', null, `Xem báo cáo doanh thu ${range.from} → ${range.to}`)
    return report
  }

  tuition(range: ReportRange): TuitionReportRow[] {
    this.validateRange(range)
    return analyticsRepository.tuitionReport(range)
  }

  attendance(range: ReportRange): AttendanceReportRow[] {
    this.validateRange(range)
    return analyticsRepository.attendanceReport(range)
  }

  students(range: ReportRange): StudentReportRow[] {
    this.validateRange(range)
    return analyticsRepository.studentReport(range)
  }

  teachers(range: ReportRange): TeacherReportRow[] {
    this.validateRange(range)
    return analyticsRepository.teacherReport(range)
  }

  private validateRange(range: ReportRange): void {
    const pattern = /^\d{4}-\d{2}-\d{2}$/
    if (!pattern.test(range?.from ?? '') || !pattern.test(range?.to ?? '')) {
      throw AppError.validation('Khoảng thời gian không hợp lệ.')
    }
    if (range.from > range.to) {
      throw AppError.validation('Ngày bắt đầu phải trước ngày kết thúc.')
    }
  }
}

export class SettingService {
  getAll(): AppSetting[] {
    return settingRepository.getAll()
  }

  update(values: Record<string, string>): boolean {
    // Tiền tố mã ảnh hưởng trực tiếp tới dữ liệu sinh sau này — kiểm tra chặt
    for (const key of ['receiptPrefix', 'studentPrefix', 'teacherPrefix']) {
      const v = values[key]
      if (v !== undefined && !/^[A-Z]{1,5}$/.test(v)) {
        throw AppError.validation(`${key}: tiền tố phải là 1–5 chữ cái in hoa.`)
      }
    }

    settingRepository.updateMany(values)
    audit('update', 'settings', null, `Cập nhật ${Object.keys(values).length} cấu hình`, {
      keys: Object.keys(values)
    })
    return true
  }
}

export const dashboardService = new DashboardService()
export const reportService = new ReportService()
export const settingService = new SettingService()
