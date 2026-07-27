import { userRepository } from '../repositories/user.repository'
import { roleRepository } from '../repositories/role.repository'
import { audit } from './audit'
import { AppError } from '../utils/errors'
import type { PageResult, SelectOption } from '@shared/types/common'
import type { Role, RoleWithPermissions, UserDetail } from '@shared/types/entities'
import type { RoleInput, UserInput, UserQuery } from '@shared/types/dto'

export class UserService {
  list(query: UserQuery): PageResult<UserDetail> {
    return userRepository.list(query ?? {})
  }

  get(id: number): UserDetail {
    return userRepository.detail(id)
  }

  create(input: UserInput): UserDetail {
    this.validate(input)
    const user = userRepository.create(input)
    audit('create', 'users', user.id, `Thêm tài khoản ${user.username} (${user.roleName})`)
    return user
  }

  update(id: number, input: UserInput): UserDetail {
    this.validate(input, true)
    const user = userRepository.update(id, input)
    audit('update', 'users', user.id, `Cập nhật tài khoản ${user.username}`)
    return user
  }

  remove(id: number): boolean {
    const user = userRepository.detail(id)
    userRepository.assertDeletable(id)
    const done = userRepository.softDelete(id)
    if (done) audit('delete', 'users', id, `Xoá tài khoản ${user.username}`)
    return done
  }

  private validate(input: UserInput, isUpdate = false): void {
    const username = input.username?.trim()
    if (!username) throw AppError.validation('Tên đăng nhập không được để trống.')
    if (!/^[a-zA-Z0-9._-]{3,32}$/.test(username)) {
      throw AppError.validation('Tên đăng nhập chỉ gồm chữ, số, dấu chấm, gạch dưới và gạch ngang (3–32 ký tự).')
    }
    if (!input.fullName?.trim()) throw AppError.validation('Họ tên không được để trống.')
    if (!roleRepository.exists(input.roleId)) throw AppError.validation('Vai trò không tồn tại.')
    if (!isUpdate && (!input.password || input.password.length < 6)) {
      throw AppError.validation('Mật khẩu phải có ít nhất 6 ký tự.')
    }
    if (isUpdate && input.password?.trim() && input.password.length < 6) {
      throw AppError.validation('Mật khẩu phải có ít nhất 6 ký tự.')
    }
  }
}

export class RoleService {
  list(): RoleWithPermissions[] {
    return roleRepository.listWithPermissions()
  }

  create(input: RoleInput): Role {
    this.validate(input)
    const role = roleRepository.create(input)
    audit('create', 'roles', role.id, `Thêm vai trò ${role.name}`)
    return role
  }

  update(id: number, input: RoleInput): Role {
    this.validate(input)
    const role = roleRepository.update(id, input)
    audit('update', 'roles', role.id, `Cập nhật quyền vai trò ${role.name}`, {
      permissions: input.permissions.length
    })
    return role
  }

  remove(id: number): boolean {
    const role = roleRepository.findByIdOrFail(id, 'Vai trò')
    roleRepository.assertDeletable(id)
    const done = roleRepository.softDelete(id)
    if (done) audit('delete', 'roles', id, `Xoá vai trò ${role.name}`)
    return done
  }

  options(): SelectOption[] {
    return roleRepository.options()
  }

  private validate(input: RoleInput): void {
    if (!input.name?.trim()) throw AppError.validation('Tên vai trò không được để trống.')
    if (!input.code?.trim()) throw AppError.validation('Mã vai trò không được để trống.')
    if (!/^[a-z0-9_-]{2,32}$/.test(input.code.trim().toLowerCase())) {
      throw AppError.validation('Mã vai trò chỉ gồm chữ thường, số, gạch dưới và gạch ngang.')
    }
  }
}

export const userService = new UserService()
export const roleService = new RoleService()
