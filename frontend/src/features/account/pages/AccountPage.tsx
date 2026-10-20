import { Dispatch, FormEvent, ReactNode, SetStateAction, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { Badge, Button, Checkbox, Input } from '@/components/ui'
import { useAuth } from '@/contexts/AuthContext'
import { changePassword, parseApiError, updateProfile } from '@/lib/api/account'

const PHONE_REGEX = /^(?:\+62|62|0)8\d{8,11}$/
const MIN_PASSWORD_LENGTH = 8

const cleanPhone = (value: string) => value.replace(/[\s-]/g, '')

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const letters = parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[1][0]
  return letters.toUpperCase()
}

function Notice({ type, children }: { type: 'success' | 'error'; children: ReactNode }) {
  const style =
    type === 'success'
      ? 'border-green-200 bg-green-50 text-green-800'
      : 'border-red-200 bg-red-50 text-red-700'
  return (
    <div role={type === 'error' ? 'alert' : 'status'} className={`rounded border px-3 py-2.5 text-sm ${style}`}>
      {children}
    </div>
  )
}

function Card({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="bg-white rounded-lg border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        {description && <p className="text-sm text-gray-600 mt-0.5">{description}</p>}
      </div>
      <div className="p-6">{children}</div>
    </section>
  )
}

export default function AccountPage() {
  const { user, logout, updateUser } = useAuth()
  const navigate = useNavigate()

  // ----- Profil -----
  const [name, setName] = useState(user?.name ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({})
  const [profileError, setProfileError] = useState('')
  const [profileNotice, setProfileNotice] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  // ----- Kata sandi -----
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPasswords, setShowPasswords] = useState(false)
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({})
  const [passwordError, setPasswordError] = useState('')
  const [passwordNotice, setPasswordNotice] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  const [loggingOut, setLoggingOut] = useState(false)

  // Isi ulang form jika data user berganti (mis. setelah dipulihkan)
  const userId = user?.id
  useEffect(() => {
    if (!user) return
    setName(user.name)
    setPhone(user.phone ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  useEffect(() => {
    if (!profileNotice) return
    const t = setTimeout(() => setProfileNotice(''), 4000)
    return () => clearTimeout(t)
  }, [profileNotice])

  useEffect(() => {
    if (!passwordNotice) return
    const t = setTimeout(() => setPasswordNotice(''), 5000)
    return () => clearTimeout(t)
  }, [passwordNotice])

  if (!user) return null

  const isAdmin = user.role === 'admin'
  const profileChanged = name.trim() !== user.name || cleanPhone(phone) !== (user.phone ?? '')

  const handleProfileSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setProfileError('')
    setProfileNotice('')

    const errors: Record<string, string> = {}
    if (name.trim().length < 2) errors.name = 'Nama minimal 2 karakter'
    if (!PHONE_REGEX.test(cleanPhone(phone))) {
      errors.phone = 'Gunakan nomor HP Indonesia, contoh 081234567890'
    }
    setProfileErrors(errors)
    if (Object.keys(errors).length > 0) return

    setSavingProfile(true)
    try {
      const updated = await updateProfile({ name: name.trim(), phone: cleanPhone(phone) })
      updateUser(updated)
      setName(updated.name)
      setPhone(updated.phone ?? '')
      setProfileNotice('Profil berhasil diperbarui')
    } catch (err) {
      const feedback = parseApiError(err)
      setProfileErrors(feedback.fields)
      if (Object.keys(feedback.fields).length === 0) setProfileError(feedback.message)
    } finally {
      setSavingProfile(false)
    }
  }

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setPasswordError('')
    setPasswordNotice('')

    const errors: Record<string, string> = {}
    if (!currentPassword) errors.current_password = 'Kata sandi saat ini wajib diisi'
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      errors.new_password = `Kata sandi baru minimal ${MIN_PASSWORD_LENGTH} karakter`
    } else if (newPassword === currentPassword) {
      errors.new_password = 'Kata sandi baru harus berbeda dari yang lama'
    }
    if (!confirmPassword) errors.confirm_password = 'Ulangi kata sandi baru'
    else if (confirmPassword !== newPassword) errors.confirm_password = 'Kata sandi tidak sama'
    setPasswordErrors(errors)
    if (Object.keys(errors).length > 0) return

    setSavingPassword(true)
    try {
      await changePassword({ current_password: currentPassword, new_password: newPassword })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordNotice('Kata sandi berhasil diganti. Perangkat lain akan diminta masuk ulang.')
    } catch (err) {
      const feedback = parseApiError(err)
      setPasswordErrors(feedback.fields)
      if (Object.keys(feedback.fields).length === 0) setPasswordError(feedback.message)
    } finally {
      setSavingPassword(false)
    }
  }

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await logout()
    } finally {
      navigate('/', { replace: true })
    }
  }

  const clearError = (
    setter: Dispatch<SetStateAction<Record<string, string>>>,
    key: string
  ) => setter((prev) => (prev[key] ? { ...prev, [key]: '' } : prev))

  const menuItem =
    'flex items-center justify-between px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors'

  return (
    <>
      <Helmet>
        <title>Akun Saya - Toko Online</title>
      </Helmet>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Akun Saya</h1>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Sidebar */}
          <aside className="md:col-span-1">
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="p-5 flex items-center gap-3 border-b border-gray-100">
                <div
                  aria-hidden="true"
                  className="w-12 h-12 rounded-full bg-primary-600 text-white flex items-center justify-center font-semibold flex-shrink-0"
                >
                  {initials(user.name)}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{user.name}</p>
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  <div className="mt-1">
                    <Badge variant={isAdmin ? 'info' : 'default'}>
                      {isAdmin ? 'Admin' : 'Pelanggan'}
                    </Badge>
                  </div>
                </div>
              </div>

              <nav aria-label="Menu akun" className="divide-y divide-gray-100">
                <span
                  aria-current="page"
                  className="flex items-center px-4 py-3 text-sm font-medium text-primary-700 bg-primary-50 border-l-4 border-primary-600"
                >
                  Profil Saya
                </span>
                <Link to="/account/addresses" className={menuItem}>
                  Alamat Saya <span aria-hidden="true">›</span>
                </Link>
                <Link to="/orders" className={menuItem}>
                  Pesanan Saya <span aria-hidden="true">›</span>
                </Link>
                {isAdmin && (
                  <Link to="/admin" className={`${menuItem} font-medium text-primary-700`}>
                    Dashboard Admin <span aria-hidden="true">›</span>
                  </Link>
                )}
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-60"
                >
                  {loggingOut ? 'Keluar...' : 'Keluar'}
                </button>
              </nav>
            </div>
          </aside>

          {/* Konten */}
          <div className="md:col-span-3 space-y-6">
            {isAdmin && (
              <div className="rounded-lg border border-primary-200 bg-primary-50 px-5 py-4 flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-gray-900">Kamu masuk sebagai admin</p>
                  <p className="text-sm text-gray-600">
                    Kelola produk, kategori, dan pesanan dari dashboard admin.
                  </p>
                </div>
                <Link to="/admin">
                  <Button>Buka Dashboard</Button>
                </Link>
              </div>
            )}

            <Card title="Profil Saya" description="Kelola informasi profil untuk keperluan pengiriman">
              <form onSubmit={handleProfileSubmit} noValidate className="space-y-5 max-w-xl">
                {profileNotice && <Notice type="success">{profileNotice}</Notice>}
                {profileError && <Notice type="error">{profileError}</Notice>}

                <Input
                  label="Nama lengkap"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    clearError(setProfileErrors, 'name')
                  }}
                  error={profileErrors.name}
                  disabled={savingProfile}
                />

                <Input
                  label="Email"
                  type="email"
                  value={user.email}
                  readOnly
                  disabled
                  helperText="Email tidak bisa diubah"
                />

                <Input
                  label="Nomor HP"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value)
                    clearError(setProfileErrors, 'phone')
                  }}
                  error={profileErrors.phone}
                  helperText="Dipakai kurir untuk menghubungi kamu"
                  disabled={savingProfile}
                />

                <p className="text-sm text-gray-500">
                  Bergabung sejak{' '}
                  {new Date(user.created_at).toLocaleDateString('id-ID', { dateStyle: 'long' })}
                </p>

                <Button type="submit" isLoading={savingProfile} disabled={!profileChanged}>
                  Simpan perubahan
                </Button>
              </form>
            </Card>

            <Card
              title="Ubah Kata Sandi"
              description="Gunakan kata sandi yang kuat dan jangan dibagikan ke siapa pun"
            >
              <form onSubmit={handlePasswordSubmit} noValidate className="space-y-5 max-w-xl">
                {passwordNotice && <Notice type="success">{passwordNotice}</Notice>}
                {passwordError && <Notice type="error">{passwordError}</Notice>}

                <Input
                  label="Kata sandi saat ini"
                  type={showPasswords ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => {
                    setCurrentPassword(e.target.value)
                    clearError(setPasswordErrors, 'current_password')
                  }}
                  error={passwordErrors.current_password}
                  disabled={savingPassword}
                />

                <Input
                  label="Kata sandi baru"
                  type={showPasswords ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value)
                    clearError(setPasswordErrors, 'new_password')
                  }}
                  error={passwordErrors.new_password}
                  helperText={`Minimal ${MIN_PASSWORD_LENGTH} karakter`}
                  disabled={savingPassword}
                />

                <Input
                  label="Ulangi kata sandi baru"
                  type={showPasswords ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value)
                    clearError(setPasswordErrors, 'confirm_password')
                  }}
                  error={passwordErrors.confirm_password}
                  disabled={savingPassword}
                />

                <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <Checkbox
                    checked={showPasswords}
                    onChange={(e) => setShowPasswords(e.target.checked)}
                  />
                  Tampilkan kata sandi
                </label>

                <div>
                  <Button type="submit" isLoading={savingPassword}>
                    Ganti kata sandi
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        </div>
      </div>
    </>
  )
}