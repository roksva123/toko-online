import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
export function Navbar() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const { user, logout, isAuthenticated } = useAuth();
    const { totalItems } = useCart();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const handleSearch = (e) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            navigate(`/products?q=${encodeURIComponent(searchQuery)}`);
            setSearchQuery('');
        }
    };
    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };
    return (_jsx("nav", { className: "bg-white border-b border-gray-200 sticky top-0 z-40", children: _jsxs("div", { className: "max-w-7xl mx-auto px-4", children: [_jsxs("div", { className: "flex items-center justify-between h-16", children: [_jsxs(Link, { to: "/", className: "flex items-center gap-2 font-bold text-xl text-primary-600", children: [_jsx("span", { children: "\uD83D\uDECD\uFE0F" }), "Toko Online"] }), _jsx("form", { onSubmit: handleSearch, className: "hidden md:flex flex-1 mx-8 max-w-md", children: _jsxs("div", { className: "w-full flex", children: [_jsx("input", { type: "text", value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), placeholder: "Cari produk...", className: "flex-1 px-4 py-2 border border-gray-300 rounded-l text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" }), _jsx("button", { type: "submit", className: "px-4 py-2 bg-primary-600 text-white rounded-r hover:bg-primary-700 text-sm font-medium", children: "Cari" })] }) }), _jsxs("div", { className: "flex items-center gap-4", children: [_jsxs(Link, { to: "/cart", className: "relative p-2 text-gray-600 hover:text-primary-600 transition-colors", "aria-label": "Keranjang", children: [_jsx("span", { className: "text-2xl", children: "\uD83D\uDED2" }), totalItems > 0 && (_jsx("span", { className: "absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs flex items-center justify-center rounded-full font-bold", children: totalItems > 99 ? '99+' : totalItems }))] }), _jsx("div", { className: "hidden md:flex items-center gap-2", children: isAuthenticated ? (_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("span", { className: "text-sm text-gray-700", children: user?.name }), _jsx(Link, { to: "/account", className: "text-sm text-gray-600 hover:text-gray-900", children: "Profil" }), _jsx("button", { onClick: handleLogout, className: "text-sm text-gray-600 hover:text-gray-900", children: "Keluar" })] })) : (_jsxs(_Fragment, { children: [_jsx(Link, { to: "/login", className: "text-sm text-primary-600 hover:text-primary-700", children: "Masuk" }), _jsx(Link, { to: "/register", className: "text-sm text-primary-600 hover:text-primary-700", children: "Daftar" })] })) }), _jsx("button", { onClick: () => setIsMenuOpen(!isMenuOpen), className: "md:hidden p-2 text-gray-600 hover:text-primary-600", "aria-label": "Menu", children: _jsx("span", { className: "text-2xl", children: "\u2630" }) })] })] }), isMenuOpen && (_jsx("form", { onSubmit: handleSearch, className: "md:hidden py-3 border-t border-gray-200", children: _jsxs("div", { className: "flex gap-2", children: [_jsx("input", { type: "text", value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), placeholder: "Cari produk...", className: "flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" }), _jsx("button", { type: "submit", className: "px-3 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 text-sm font-medium", children: "Cari" })] }) })), isMenuOpen && (_jsxs("div", { className: "md:hidden py-3 border-t border-gray-200 space-y-3", children: [_jsx(Link, { to: "/products", className: "block text-sm text-gray-700 hover:text-primary-600", children: "Produk" }), isAuthenticated ? (_jsxs(_Fragment, { children: [_jsx(Link, { to: "/orders", className: "block text-sm text-gray-700 hover:text-primary-600", children: "Pesanan Saya" }), _jsx(Link, { to: "/account", className: "block text-sm text-gray-700 hover:text-primary-600", children: "Profil" }), _jsx("button", { onClick: handleLogout, className: "w-full text-left text-sm text-gray-700 hover:text-primary-600", children: "Keluar" })] })) : (_jsxs(_Fragment, { children: [_jsx(Link, { to: "/login", className: "block text-sm text-primary-600 hover:text-primary-700", children: "Masuk" }), _jsx(Link, { to: "/register", className: "block text-sm text-primary-600 hover:text-primary-700", children: "Daftar" })] }))] }))] }) }));
}
//# sourceMappingURL=Navbar.js.map