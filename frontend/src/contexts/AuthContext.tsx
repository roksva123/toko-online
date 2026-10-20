import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { apiClient } from '@/lib/api/client'
import { User, LoginRequest, RegisterRequest, AuthResponse } from '@/lib/api/types'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (data: LoginRequest) => Promise<void>
  register: (data: RegisterRequest) => Promise<void>
  logout: () => Promise<void>
  recoverSession: () => Promise<void>
  updateUser: (user: User) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Naik setiap kali user login/daftar/keluar. Dipakai agar hasil pemulihan sesi
  // yang datang terlambat tidak menimpa login yang baru saja terjadi.
  const authVersion = useRef(0)

  const recoverSession = useCallback(async () => {
    const version = authVersion.current
    try {
      // Minta access token baru dari refresh token (cookie), simpan, lalu ambil data user
      const refreshRes = await apiClient.post<{ access_token: string }>('/auth/refresh')
      if (authVersion.current !== version) return
      apiClient.setAccessToken(refreshRes.data.access_token)

      const response = await apiClient.get<User>('/me')
      if (authVersion.current !== version) return
      setUser(response.data)
    } catch {
      // Tidak ada sesi aktif: user dianggap belum login
      if (authVersion.current === version) {
        apiClient.clearAccessToken()
        setUser(null)
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  const login = useCallback(async (data: LoginRequest) => {
    const response = await apiClient.post<AuthResponse>('/auth/login', data)
    const { access_token, user: userData } = response.data

    authVersion.current++
    apiClient.setAccessToken(access_token)
    setUser(userData)
    setIsLoading(false)
  }, [])

  const register = useCallback(async (data: RegisterRequest) => {
    const response = await apiClient.post<AuthResponse>('/auth/register', data)
    const { access_token, user: userData } = response.data

    authVersion.current++
    apiClient.setAccessToken(access_token)
    setUser(userData)
    setIsLoading(false)
  }, [])

  const logout = useCallback(async () => {
    authVersion.current++
    try {
      await apiClient.post('/auth/logout')
    } finally {
      apiClient.clearAccessToken()
      setUser(null)
    }
  }, [])

  // Dipakai setelah profil diubah supaya header dan halaman lain ikut berubah
  const updateUser = useCallback((updated: User) => {
    setUser(updated)
  }, [])

  // Pulihkan sesi saat aplikasi dibuka
  useEffect(() => {
    recoverSession()
  }, [recoverSession])

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: user !== null,
        login,
        register,
        logout,
        recoverSession,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}