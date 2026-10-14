import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const recoverSession = useCallback(async () => {
    try {
      // Coba refresh access token terlebih dahulu
      await apiClient.post('/auth/refresh')

      // Ambil data user saat ini
      const response = await apiClient.get<User>('/me')
      setUser(response.data)
    } catch {
      // Session recovery gagal, user tidak terautentikasi
      apiClient.clearAccessToken()
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const login = useCallback(async (data: LoginRequest) => {
    const response = await apiClient.post<AuthResponse>('/auth/login', data)
    const { access_token, user: userData } = response.data

    apiClient.setAccessToken(access_token)
    setUser(userData)
  }, [])

  const register = useCallback(async (data: RegisterRequest) => {
    const response = await apiClient.post<AuthResponse>('/auth/register', data)
    const { access_token, user: userData } = response.data

    apiClient.setAccessToken(access_token)
    setUser(userData)
  }, [])

  const logout = useCallback(async () => {
    try {
      await apiClient.post('/auth/logout')
    } finally {
      apiClient.clearAccessToken()
      setUser(null)
    }
  }, [])

  // Recover session saat aplikasi dibuka
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
