import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api/client';
import { Button, Input } from '@/components/ui';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Hanya terima path internal supaya tidak jadi open redirect
function getSafeRedirect(from) {
    if (typeof from !== 'string')
        return null;
    if (!from.startsWith('/') || from.startsWith('//'))
        return null;
    if (from.startsWith('/login') || from.startsWith('/register'))
        return null;
    return from;
}
export default function LoginPage() {
    const { user, isLoading, login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [errors, setErrors] = useState({});
    const [formError, setFormError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const fromState = location.state?.from;
    const from = getSafeRedirect(fromState?.pathname ? `${fromState.pathname}${fromState.search ?? ''}` : null);
    // Arahkan setelah login berhasil, atau jika user yang sudah login membuka halaman ini
    useEffect(() => {
        if (isLoading || !user)
            return;
        if (user.role === 'admin') {
            navigate('/admin', { replace: true });
        }
        else {
            navigate(from ?? '/', { replace: true });
        }
    }, [user, isLoading, from, navigate]);
    const validate = () => {
        const next = {};
        if (!email.trim())
            next.email = 'Email wajib diisi';
        else if (!EMAIL_REGEX.test(email.trim()))
            next.email = 'Format email tidak valid';
        if (!password)
            next.password = 'Kata sandi wajib diisi';
        return next;
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormError('');
        const validation = validate();
        setErrors(validation);
        if (Object.keys(validation).length > 0)
            return;
        setIsSubmitting(true);
        try {
            await login({ email: email.trim(), password });
            // Redirect ditangani useEffect setelah state user terisi
        }
        catch (err) {
            const apiError = apiClient.handleError(err);
            setFormError(apiError.message);
            setIsSubmitting(false);
        }
    };
    return (_jsxs(_Fragment, { children: [_jsx(Helmet, { children: _jsx("title", { children: "Masuk - Toko Online" }) }), _jsxs("div", { className: "max-w-md mx-auto px-4 py-12", children: [_jsxs("div", { className: "mb-8", children: [_jsx("h1", { className: "text-2xl font-bold text-gray-900", children: "Masuk ke akun kamu" }), _jsxs("p", { className: "text-gray-600 mt-1", children: ["Belum punya akun?", ' ', _jsx(Link, { to: "/register", className: "text-primary-600 hover:underline font-medium", children: "Daftar" })] })] }), _jsxs("form", { onSubmit: handleSubmit, noValidate: true, className: "space-y-5", children: [formError && (_jsx("div", { role: "alert", className: "rounded border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700", children: formError })), _jsx(Input, { label: "Email", type: "email", name: "email", autoComplete: "email", inputMode: "email", placeholder: "nama@email.com", value: email, onChange: (e) => setEmail(e.target.value), error: errors.email, disabled: isSubmitting, autoFocus: true }), _jsx(Input, { label: "Kata sandi", type: "password", name: "password", autoComplete: "current-password", placeholder: "Masukkan kata sandi", value: password, onChange: (e) => setPassword(e.target.value), error: errors.password, disabled: isSubmitting }), _jsx("div", { className: "flex justify-end -mt-2", children: _jsx(Link, { to: "/forgot-password", className: "text-sm text-primary-600 hover:underline", children: "Lupa kata sandi?" }) }), _jsx(Button, { type: "submit", fullWidth: true, size: "lg", isLoading: isSubmitting, children: "Masuk" })] })] })] }));
}
//# sourceMappingURL=LoginPage.js.map