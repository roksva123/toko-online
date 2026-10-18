import { FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient } from '@/lib/api/client'
import { Button, Input } from '@/components/ui'

interface FormValues {
  name: string
  email: string
  phone: string
  password: string
  confirmPassword: string
}

type FormErrors = Partial<Record<keyof FormValues, string>>

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// Nomor HP Indonesia: 08xx, 628xx, atau +628xx (9-13 digit setelah awalan)
const PHONE_REGEX = /^(?:\+62|62|0)8\d{8,11}$/
const MIN_PASSWORD_LENGTH = 8

const initialValues: FormValues = {
  name: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
}

function validate(values: FormValues): FormErrors {
  const errors: FormErrors = {}

  if (!values.name.trim()) errors.name = 'Nama lengkap wajib diisi'
  else if (values.name.trim().length < 2) errors.name = 'Nama minimal 2 karakter'

  if (!values.email.trim()) errors.email = 'Email wajib diisi'
  else if (!EMAIL_REGEX.test(values.email.trim())) errors.email = 'Format email tidak valid'

  const phone = values.phone.replace(/[\s-]/g, '')
  if (!phone) errors.phone = 'Nomor HP wajib diisi'
  else if (!PHONE_REGEX.test(phone)) errors.phone = 'Gunakan nomor HP Indonesia, contoh 081234567890'

  if (!values.password) errors.password = 'Kata sandi wajib diisi'
  else if (values.password.length < MIN_PASSWORD_LENGTH)
    errors.password = `Kata sandi minimal ${MIN_PASSWORD_LENGTH} karakter`

  if (!values.confirmPassword) errors.confirmPassword = 'Ulangi kata sandi kamu'
  else if (values.confirmPassword !== values.password)
    errors.confirmPassword = 'Kata sandi tidak sama'

  return errors
}

export default function RegisterPage() {
  const { user, isLoading, register } = useAuth()
  const navigate = useNavigate()

  const [values, setValues] = useState<FormValues>(initialValues)
  const [errors, setErrors] = useState<FormErrors>({})
  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Setelah daftar berhasil (atau user sudah login), arahkan ke beranda
  useEffect(() => {
    if (isLoading || !user) return
    navigate(user.role === 'admin' ? '/admin' : '/', { replace: true })
  }, [user, isLoading, navigate])

  const setField = (field: keyof FormValues) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues((prev) => ({ ...prev, [field]: e.target.value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError('')

    const validation = validate(values)
    setErrors(validation)
    if (Object.keys(validation).length > 0) return

    setIsSubmitting(true)
    try {
      await register({
        name: values.name.trim(),
        email: values.email.trim(),
        phone: values.phone.replace(/[\s-]/g, ''),
        password: values.password,
      })
      // Redirect ditangani useEffect setelah state user terisi
    } catch (err) {
      const apiError = apiClient.handleError(err)

      // Jika backend mengirim detail per field, tampilkan di field yang sesuai
      const fieldErrors: FormErrors = {}
      const details = apiError.details
      if (details && typeof details === 'object') {
        for (const key of ['name', 'email', 'phone', 'password'] as const) {
          const value = details[key]
          if (typeof value === 'string') fieldErrors[key] = value
        }
      }

      if (Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors)
      } else {
        setFormError(apiError.message)
      }
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Helmet>
        <title>Daftar - Toko Online</title>
      </Helmet>

      <div className="max-w-md mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Buat akun baru</h1>
          <p className="text-gray-600 mt-1">
            Sudah punya akun?{' '}
            <Link to="/login" className="text-primary-600 hover:underline font-medium">
              Masuk
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
            label="Nama lengkap"
            name="name"
            autoComplete="name"
            placeholder="Nama sesuai identitas"
            value={values.name}
            onChange={setField('name')}
            error={errors.name}
            disabled={isSubmitting}
            autoFocus
          />

          <Input
            label="Email"
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            placeholder="nama@email.com"
            value={values.email}
            onChange={setField('email')}
            error={errors.email}
            disabled={isSubmitting}
          />

          <Input
            label="Nomor HP"
            type="tel"
            name="phone"
            autoComplete="tel"
            inputMode="tel"
            placeholder="081234567890"
            value={values.phone}
            onChange={setField('phone')}
            error={errors.phone}
            helperText="Dipakai kurir untuk menghubungi kamu"
            disabled={isSubmitting}
          />

          <Input
            label="Kata sandi"
            type="password"
            name="password"
            autoComplete="new-password"
            placeholder={`Minimal ${MIN_PASSWORD_LENGTH} karakter`}
            value={values.password}
            onChange={setField('password')}
            error={errors.password}
            disabled={isSubmitting}
          />

          <Input
            label="Ulangi kata sandi"
            type="password"
            name="confirmPassword"
            autoComplete="new-password"
            placeholder="Ketik ulang kata sandi"
            value={values.confirmPassword}
            onChange={setField('confirmPassword')}
            error={errors.confirmPassword}
            disabled={isSubmitting}
          />

          <Button type="submit" fullWidth size="lg" isLoading={isSubmitting}>
            Daftar
          </Button>

          <p className="text-xs text-gray-500 text-center">
            Dengan mendaftar, kamu menyetujui{' '}
            <Link to="/terms" className="text-primary-600 hover:underline">
              Syarat &amp; Ketentuan
            </Link>{' '}
            dan{' '}
            <Link to="/privacy" className="text-primary-600 hover:underline">
              Kebijakan Privasi
            </Link>
            .
          </p>
        </form>
      </div>
    </>
  )
}