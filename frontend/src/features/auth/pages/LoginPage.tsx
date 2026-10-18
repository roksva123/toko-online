import { FormEvent, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient } from '@/lib/api/client'
import { Button, Input } from '@/components/ui'

interface FormErrors {
  email?: string
  password?: string
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Hanya terima path internal supaya tidak jadi open redirect
function getSafeRedirect(from: unknown): string | null {
  if (typeof from !== 'string') return null
  if (!from.startsWith('/') || from.startsWith('//')) return null
  if (from.startsWith('/login') || from.startsWith('/register')) return null
  return from
}

export default function LoginPage() {
  const { user, isLoading, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fromState = (location.state as {
    from?: { pathname?: string; search?: string }
  } | null)?.from
  const from = getSafeRedirect(
    fromState?.pathname ? `${fromState.pathname}${fromState.search ?? ''}` : null
  )

  // Arahkan setelah login berhasil, atau jika user yang sudah login membuka halaman ini
  useEffect(() => {
    if (isLoading || !user) return
    if (user.role === 'admin') {
      navigate('/admin', { replace: true })
    } else {
      navigate(from ?? '/', { replace: true })
    }
  }, [user, isLoading, from, navigate])

  const validate = (): FormErrors => {
    const next: FormErrors = {}
    if (!email.trim()) next.email = 'Email wajib diisi'
    else if (!EMAIL_REGEX.test(email.trim())) next.email = 'Format email tidak valid'
    if (!password) next.password = 'Kata sandi wajib diisi'
    return next
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError('')

    const validation = validate()
    setErrors(validation)
    if (Object.keys(validation).length > 0) return

    setIsSubmitting(true)
    try {
      await login({ email: email.trim(), password })
      // Redirect ditangani useEffect setelah state user terisi
    } catch (err) {
      const apiError = apiClient.handleError(err)
      setFormError(apiError.message)
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Helmet>
        <title>Masuk - Toko Online</title>
      </Helmet>

      <div className="max-w-md mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Masuk ke akun kamu</h1>
          <p className="text-gray-600 mt-1">
            Belum punya akun?{' '}
            <Link to="/register" className="text-primary-600 hover:underline font-medium">
              Daftar
            </Link>
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          {formError && (
            <div
              role="alert"
              className="rounded border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
            >
              {formError}
            </div>
          )}

          <Input
            label="Email"
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            placeholder="nama@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
            disabled={isSubmitting}
            autoFocus
          />

          <Input
            label="Kata sandi"
            type="password"
            name="password"
            autoComplete="current-password"
            placeholder="Masukkan kata sandi"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            disabled={isSubmitting}
          />

          <div className="flex justify-end -mt-2">
            <Link
              to="/forgot-password"
              className="text-sm text-primary-600 hover:underline"
            >
              Lupa kata sandi?
            </Link>
          </div>

          <Button type="submit" fullWidth size="lg" isLoading={isSubmitting}>
            Masuk
          </Button>
        </form>
      </div>
    </>
  )
}