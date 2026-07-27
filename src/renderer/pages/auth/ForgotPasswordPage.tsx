import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Alert, Button, Card, Flex, Form, Input, Result, Steps, Typography, theme } from 'antd'
import { KeyOutlined, SafetyOutlined, UserOutlined } from '@ant-design/icons'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { FormPassword } from '@/components/form/fields'
import { authService } from '@/services/auth.service'
import { ApiError } from '@/services/ipc-client'
import { forgotPasswordSchema, type ForgotPasswordForm } from '@/utils/schemas'

/**
 * Quên mật khẩu NỘI BỘ — không gửi email, không dịch vụ ngoài.
 *
 * Quy trình 3 bước:
 *  1. Nhập tên đăng nhập → hệ thống trả về câu hỏi bảo mật.
 *  2. Trả lời đúng + đặt mật khẩu mới.
 *  3. Xong, quay lại đăng nhập.
 *
 * Nếu tài khoản chưa thiết lập câu hỏi bảo mật thì phải nhờ quản trị viên
 * đặt lại — có chủ đích, để không tạo ra đường vòng qua mặt bảo mật.
 */
export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const { token } = theme.useToken()

  const [step, setStep] = useState(0)
  const [question, setQuestion] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const { control, handleSubmit, getValues, setValue } = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { username: '', securityAnswer: '', newPassword: '', confirmPassword: '' }
  })

  const questionMutation = useMutation({
    mutationFn: (username: string) => authService.securityQuestion(username),
    onSuccess: (q) => {
      if (!q) {
        setErrorMessage(
          'Tài khoản không tồn tại hoặc chưa thiết lập câu hỏi bảo mật. Vui lòng liên hệ quản trị viên để được đặt lại mật khẩu.'
        )
        return
      }
      setQuestion(q)
      setErrorMessage(null)
      setStep(1)
    },
    onError: (err) => setErrorMessage(err instanceof ApiError ? err.message : 'Không tra cứu được tài khoản.')
  })

  const resetMutation = useMutation({
    mutationFn: (values: ForgotPasswordForm) =>
      authService.resetPassword({
        username: values.username,
        securityAnswer: values.securityAnswer,
        newPassword: values.newPassword
      }),
    onSuccess: () => {
      setErrorMessage(null)
      setStep(2)
    },
    onError: (err) => setErrorMessage(err instanceof ApiError ? err.message : 'Không đặt lại được mật khẩu.')
  })

  const handleFindAccount = (): void => {
    const username = getValues('username').trim()
    if (!username) {
      setErrorMessage('Vui lòng nhập tên đăng nhập.')
      return
    }
    questionMutation.mutate(username)
  }

  return (
    <div className="login-page" style={{ background: token.colorBgLayout }}>
      <div className="login-card">
        <Typography.Title level={3} style={{ textAlign: 'center' }}>
          Khôi phục mật khẩu
        </Typography.Title>

        <Card styles={{ body: { padding: 28 } }} style={{ boxShadow: '0 12px 40px rgba(0,0,0,0.12)' }}>
          <Steps
            size="small"
            current={step}
            items={[
              { title: 'Tài khoản', icon: <UserOutlined /> },
              { title: 'Xác thực', icon: <SafetyOutlined /> },
              { title: 'Hoàn tất', icon: <KeyOutlined /> }
            ]}
            style={{ marginBottom: 24 }}
          />

          {errorMessage && (
            <Alert
              type="warning"
              showIcon
              message={errorMessage}
              closable
              onClose={() => setErrorMessage(null)}
              style={{ marginBottom: 18 }}
            />
          )}

          {step === 0 && (
            <Form layout="vertical">
              <Controller
                control={control}
                name="username"
                render={({ field, fieldState }) => (
                  <Form.Item
                    label="Tên đăng nhập"
                    validateStatus={fieldState.error ? 'error' : undefined}
                    help={fieldState.error?.message}
                  >
                    <Input
                      {...field}
                      size="large"
                      prefix={<UserOutlined style={{ opacity: 0.45 }} />}
                      placeholder="Nhập tên đăng nhập của bạn"
                      onPressEnter={handleFindAccount}
                      autoFocus
                    />
                  </Form.Item>
                )}
              />

              <Button
                type="primary"
                size="large"
                block
                loading={questionMutation.isPending}
                onClick={handleFindAccount}
              >
                Tiếp tục
              </Button>
            </Form>
          )}

          {step === 1 && (
            <Form layout="vertical">
              <Alert
                type="info"
                showIcon
                message="Câu hỏi bảo mật"
                description={question}
                style={{ marginBottom: 18 }}
              />

              <Controller
                control={control}
                name="securityAnswer"
                render={({ field, fieldState }) => (
                  <Form.Item
                    label="Câu trả lời"
                    validateStatus={fieldState.error ? 'error' : undefined}
                    help={fieldState.error?.message}
                  >
                    <Input {...field} size="large" placeholder="Nhập câu trả lời" autoFocus />
                  </Form.Item>
                )}
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

              <Flex gap={10}>
                <Button
                  block
                  onClick={() => {
                    setStep(0)
                    setValue('securityAnswer', '')
                  }}
                >
                  Quay lại
                </Button>
                <Button
                  type="primary"
                  block
                  loading={resetMutation.isPending}
                  onClick={handleSubmit((v) => resetMutation.mutate(v))}
                >
                  Đặt lại mật khẩu
                </Button>
              </Flex>
            </Form>
          )}

          {step === 2 && (
            <Result
              status="success"
              title="Đã đặt lại mật khẩu"
              subTitle="Bạn có thể đăng nhập bằng mật khẩu mới."
              extra={
                <Button type="primary" onClick={() => navigate('/login', { replace: true })}>
                  Về trang đăng nhập
                </Button>
              }
            />
          )}

          {step !== 2 && (
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <Link to="/login">← Quay lại đăng nhập</Link>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
