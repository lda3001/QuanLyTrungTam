import { useEffect } from 'react'
import { Alert, Modal } from 'antd'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { FormPassword } from '@/components/form/fields'
import { useNotify } from '@/hooks/useNotify'
import { authService } from '@/services/auth.service'
import { changePasswordSchema, type ChangePasswordForm } from '@/utils/schemas'

interface Props {
  open: boolean
  onClose: () => void
}

/** Đổi mật khẩu cho chính người đang đăng nhập */
export function ChangePasswordModal({ open, onClose }: Props) {
  const notify = useNotify()

  const { control, handleSubmit, reset } = useForm<ChangePasswordForm>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' }
  })

  // Xoá sạch form mỗi lần mở lại — không để mật khẩu cũ nằm lại trong bộ nhớ form
  useEffect(() => {
    if (open) reset({ currentPassword: '', newPassword: '', confirmPassword: '' })
  }, [open, reset])

  const mutation = useMutation({
    mutationFn: (values: ChangePasswordForm) =>
      authService.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword
      }),
    onSuccess: () => {
      notify.success('Đổi mật khẩu thành công.')
      onClose()
    },
    onError: (err) => notify.error(err)
  })

  return (
    <Modal
      open={open}
      title="Đổi mật khẩu"
      onCancel={onClose}
      onOk={handleSubmit((v) => mutation.mutate(v))}
      okText="Cập nhật"
      cancelText="Huỷ"
      confirmLoading={mutation.isPending}
      destroyOnClose
      centered
      width={440}
    >
      <Alert
        type="info"
        showIcon
        message="Mật khẩu tối thiểu 6 ký tự. Nên dùng kết hợp chữ, số và ký tự đặc biệt."
        style={{ marginBottom: 16 }}
      />

      <FormPassword
        control={control}
        name="currentPassword"
        label="Mật khẩu hiện tại"
        placeholder="Nhập mật khẩu đang dùng"
        required
      />
      <FormPassword
        control={control}
        name="newPassword"
        label="Mật khẩu mới"
        placeholder="Tối thiểu 6 ký tự"
        required
      />
      <FormPassword
        control={control}
        name="confirmPassword"
        label="Nhập lại mật khẩu mới"
        placeholder="Nhập lại để xác nhận"
        required
      />
    </Modal>
  )
}
