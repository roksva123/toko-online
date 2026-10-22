import { FormEvent, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { apiClient } from '@/lib/api/client'
import { Button, Input } from '@/components/ui'

interface FormErrors {
  email?: string
}

const EMAIL_REGEX = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const validate = (): FormErrors => {
    const next: FormErrors = {}
    if (!email.trim()) next.email = 'Email wajib diisi'
    else if (!EMAIL_REGEX.test(email.trim())) next.email = 'Format email tidak valid'
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
      await apiClient.post('/auth/forgot-password', { email: email.trim() })
      setIsSubmitted(true)
    } catch (err) {
      const apiError = apiClient.handleError(err)
      setFormError(apiError.message)
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Helmet>
        <title>Lupa Kata Sandi - Toko Online</title>
      </Helmet>

      <div className="max-w-md mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Lupa Kata Sandi</h1>
          <p className="text-gray-600 mt-1">
            Masukkan email Anda dan kami akan mengirimkan tautan untuk mengatur ulang kata sandi Anda.
          </p>
        </div>

        {isSubmitted ? (
          <div className="rounded border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-green-700">
            Jika akun dengan email tersebut ditemukan, tautan reset kata sandi telah dikirimkan ke email Anda. Periksa kotak masuk dan folder spam Anda.
          </div>
        ) : (
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

            <Button type="submit" fullWidth size="lg" isLoading={isSubmitting}>
              Kirim Tautan Reset
            </Button>
          </form>
        )}
      </div>
    </>
  )
}