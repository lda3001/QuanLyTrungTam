import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Alert, Button, Card, Checkbox, Divider, Flex, Form, Typography, theme } from 'antd'
import { LockOutlined, LoginOutlined, ReadOutlined, UserOutlined } from '@ant-design/icons'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { Input } from 'antd'
import { authService } from '@/services/auth.service'
import { useAuthStore } from '@/store/auth.store'
import { ApiError } from '@/services/ipc-client'
import { loginSchema, type LoginForm } from '@/utils/schemas'

/**
 * Màn hình đăng nhập.
 *
 * Lỗi hiển thị ngay trong thẻ (Alert) thay vì toast góc màn hình: người dùng
 * đang nhìn vào form, thông báo phải nằm ở nơi mắt họ đang dừng.
 */
export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { token } = theme.useToken()
  const setUser = useAuthStore((s) => s.setUser)

  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const { control, handleSubmit } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '', remember: true }
  })

  const mutation = useMutation({
    mutationFn: (values: LoginForm) =>
      authService.login({ username: values.username, password: values.password }),
    onSuccess: (user) => {
      setUser(user)
      const from = (location.state as { from?: string } | null)?.from
      navigate(from && from !== '/login' ? from : '/dashboard', { replace: true })
    },
    onError: (err) => {
      setErrorMessage(err instanceof ApiError ? err.message : 'Không đăng nhập được. Vui lòng thử lại.')
    }
  })

  const onSubmit = handleSubmit((values) => {
    setErrorMessage(null)
    mutation.mutate(values)
  })

  return (
    <div className="login-page" style={{ background: token.colorBgLayout }}>
      <div className="login-card">
        <Flex vertical align="center" gap={12} style={{ marginBottom: 24 }}>
          <div
            className="app-logo-mark"
            style={{ width: 56, height: 56, minWidth: 56, borderRadius: 16, fontSize: 26 }}
          >
            <ReadOutlined />
          </div>
          <Typography.Title level={3} style={{ margin: 0, textAlign: 'center' }}>
            Quản Lý Trung Tâm
          </Typography.Title>
          <Typography.Text type="secondary">Đăng nhập để tiếp tục làm việc</Typography.Text>
        </Flex>

        <Card styles={{ body: { padding: 28 } }} style={{ boxShadow: '0 12px 40px rgba(0,0,0,0.12)' }}>
          {errorMessage && (
            <Alert
              type="error"
              showIcon
              message={errorMessage}
              closable
              onClose={() => setErrorMessage(null)}
              style={{ marginBottom: 18 }}
            />
          )}

          <Form layout="vertical" onSubmitCapture={onSubmit}>
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
                    placeholder="Vui lòng nhập tên đăng nhập"
                    autoFocus
                    autoComplete="username"
                  />
                </Form.Item>
              )}
            />

            <Controller
              control={control}
              name="password"
              render={({ field, fieldState }) => (
                <Form.Item
                  label="Mật khẩu"
                  validateStatus={fieldState.error ? 'error' : undefined}
                  help={fieldState.error?.message}
                >
                  <Input.Password
                    {...field}
                    size="large"
                    prefix={<LockOutlined style={{ opacity: 0.45 }} />}
                    placeholder="••••••"
                    autoComplete="current-password"
                    // Enter ở ô mật khẩu là thao tác tự nhiên nhất để đăng nhập
                    onPressEnter={onSubmit}
                  />
                </Form.Item>
              )}
            />

            <Flex justify="space-between" align="center" style={{ marginBottom: 18 }}>
              <Controller
                control={control}
                name="remember"
                render={({ field }) => (
                  <Checkbox checked={field.value} onChange={(e) => field.onChange(e.target.checked)}>
                    Ghi nhớ đăng nhập
                  </Checkbox>
                )}
              />
              <Link to="/forgot-password">Quên mật khẩu?</Link>
            </Flex>

            <Button
              type="primary"
              size="large"
              block
              icon={<LoginOutlined />}
              loading={mutation.isPending}
              onClick={onSubmit}
              htmlType="submit"
            >
              Đăng nhập
            </Button>
          </Form>

          <Divider plain style={{ margin: '20px 0 12px' }}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Phần mềm được viết bởi <a href="https://zalo.me/ducanhdev" target="_blank" rel="noopener noreferrer">
                DucAnhDev
              </a>
            </Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              <br />
             
                 © 2026 DucAnhDev. All rights reserved
              
            </Typography.Text>
          </Divider>

          {/* <Typography.Paragraph type="secondary" style={{ textAlign: 'center', fontSize: 12, margin: 0 }}>
            <Typography.Text code>admin</Typography.Text> /{' '}
            <Typography.Text code>admin123</Typography.Text>
            <br />
            Hãy đổi mật khẩu ngay sau lần đăng nhập đầu tiên.
          </Typography.Paragraph> */}
        </Card>
      </div>
    </div>
  )
}
