import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Outlet } from 'react-router-dom';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
export function RootLayout() {
    return (_jsxs("div", { className: "flex flex-col min-h-screen bg-white", children: [_jsx(Navbar, {}), _jsx("main", { className: "flex-1", children: _jsx(Outlet, {}) }), _jsx(Footer, {})] }));
}
//# sourceMappingURL=RootLayout.js.map