import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '@/lib/api/client';
const AuthContext = createContext(undefined);
export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    // Naik setiap kali user login/daftar/keluar. Dipakai agar hasil pemulihan sesi
    // yang datang terlambat tidak menimpa login yang baru saja terjadi.
    const authVersion = useRef(0);
    const recoverSession = useCallback(async () => {
        const version = authVersion.current;
        try {
            // Minta access token baru dari refresh token (cookie), simpan, lalu ambil data user
            const refreshRes = await apiClient.post('/auth/refresh');
            if (authVersion.current !== version)
                return;
            apiClient.setAccessToken(refreshRes.data.access_token);
            const response = await apiClient.get('/me');
            if (authVersion.current !== version)
                return;
            setUser(response.data);
        }
        catch {
            // Tidak ada sesi aktif: user dianggap belum login
            if (authVersion.current === version) {
                apiClient.clearAccessToken();
                setUser(null);
            }
        }
        finally {
            setIsLoading(false);
        }
    }, []);
    const login = useCallback(async (data) => {
        const response = await apiClient.post('/auth/login', data);
        const { access_token, user: userData } = response.data;
        authVersion.current++;
        apiClient.setAccessToken(access_token);
        setUser(userData);
        setIsLoading(false);
    }, []);
    const register = useCallback(async (data) => {
        const response = await apiClient.post('/auth/register', data);
        const { access_token, user: userData } = response.data;
        authVersion.current++;
        apiClient.setAccessToken(access_token);
        setUser(userData);
        setIsLoading(false);
    }, []);
    const logout = useCallback(async () => {
        authVersion.current++;
        try {
            await apiClient.post('/auth/logout');
        }
        finally {
            apiClient.clearAccessToken();
            setUser(null);
        }
    }, []);
    // Dipakai setelah profil diubah supaya header dan halaman lain ikut berubah
    const updateUser = useCallback((updated) => {
        setUser(updated);
    }, []);
    // Pulihkan sesi saat aplikasi dibuka
    useEffect(() => {
        recoverSession();
    }, [recoverSession]);
    return (_jsx(AuthContext.Provider, { value: {
            user,
            isLoading,
            isAuthenticated: user !== null,
            login,
            register,
            logout,
            recoverSession,
            updateUser,
        }, children: children }));
}
export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
}
//# sourceMappingURL=AuthContext.js.map