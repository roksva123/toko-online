import { FormEvent, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { apiClient } from '@/lib/api/client'
import { Button, Input } from '@/components/ui'

interface FormErrors {
  password?: string
}

const MIN_PASSWORD_LEN = 8

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const validate = (): FormErrors => {
    const next: FormErrors = {}
    if (!password) next.password = 'Kata sandi baru wajib diisi'
    else if (password.length < MIN_PASSWORD_LEN) next.password = `Minimal ${MIN_PASSWORD_LEN} karakter`
    return next
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError('')

    const validation = validate()
    setErrors(validation)
    if (Object.keys(validation).length > 0) return

    if (!token) {
      setFormError('Token tidak valid')
      return
    }

    setIsSubmitting(true)
    try {
      await apiClient.post('/auth/reset-password', { token, new_password: password })
      navigate('/login', { state: { message: 'Kata sandi berhasil direset. Silakan masuk.' } })
    } catch (err) {
      const apiError = apiClient.handleError(err)
      setFormError(apiError.message)
      setIsSubmitting(false)
    }
  }

  if (!token) {
    return (
      <div className="max-w-md mx-auto px-4 py-12">
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          Token reset tidak valid atau sudah kedaluwarsa.
        </div>
      </div>
    )
  }

  return (
    <>
      <Helmet>
        <title>Atur Ulang Kata Sandi - Toko Online</title>
      </Helmet>

      <div className="max-w-md mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Atur Ulang Kata Sandi</h1>
          <p className="text-gray-600 mt-1">Masukkan kata sandi baru untuk akun Anda.</p>
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
            label="Kata sandi baru"
            type="password"
            name="password"
            autoComplete="new-password"
            placeholder="Masukkan kata sandi baru"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            disabled={isSubmitting}
            autoFocus
          />

          <Button type="submit" fullWidth size="lg" isLoading={isSubmitting}>
            Simpan Kata Sandi Baru
          </Button>
        </form>
      </div>
    </>
  )
}