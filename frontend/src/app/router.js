import { jsx as _jsx } from "react/jsx-runtime";
import { createBrowserRouter, Navigate, useLocation } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@/components/ui/Spinner';
import { RootLayout } from './RootLayout';
import { AdminLayout } from './AdminLayout';
// Lazy load halaman
const LoginPage = lazy(() => import('@/features/auth/pages/LoginPage'));
const RegisterPage = lazy(() => import('@/features/auth/pages/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('@/features/auth/pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/features/auth/pages/ResetPasswordPage'));
const HomePage = lazy(() => import('@/features/catalog/pages/HomePage'));
const ProductsPage = lazy(() => import('@/features/catalog/pages/ProductsPage'));
const ProductDetailPage = lazy(() => import('@/features/catalog/pages/ProductDetailPage'));
const CartPage = lazy(() => import('@/features/cart/pages/CartPage'));
const CheckoutPage = lazy(() => import('@/features/checkout/pages/CheckoutPage'));
const PaymentPage = lazy(() => import('@/features/orders/pages/PaymentPage'));
const OrdersPage = lazy(() => import('@/features/orders/pages/OrdersPage'));
const OrderDetailPage = lazy(() => import('@/features/orders/pages/OrderDetailPage'));
const AccountPage = lazy(() => import('@/features/account/pages/AccountPage'));
const AddressesPage = lazy(() => import('@/features/account/pages/AddressesPage'));
const AdminDashboard = lazy(() => import('@/features/admin/pages/AdminDashboard'));
const AdminOrders = lazy(() => import('@/features/admin/pages/AdminOrders'));
const AdminPayments = lazy(() => import('@/features/admin/pages/AdminPayments'));
const AdminProducts = lazy(() => import('@/features/admin/pages/AdminProducts'));
const AdminCategories = lazy(() => import('@/features/admin/pages/AdminCategories'));
const AdminBanks = lazy(() => import('@/features/admin/pages/AdminBanks'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));
const UIShowcase = lazy(() => import('@/pages/UIShowcase'));
function RouteGuard({ children }) {
    return (_jsx(Suspense, { fallback: _jsx(Spinner, { fullscreen: true }), children: children }));
}
function RequireAuth({ children }) {
    const { isAuthenticated, isLoading } = useAuth();
    const location = useLocation();
    if (isLoading) {
        return _jsx(Spinner, { fullscreen: true });
    }
    if (!isAuthenticated) {
        return _jsx(Navigate, { to: "/login", state: { from: location }, replace: true });
    }
    return _jsx(RouteGuard, { children: children });
}
function RequireAdmin({ children }) {
    const { user, isLoading } = useAuth();
    if (isLoading) {
        return _jsx(Spinner, { fullscreen: true });
    }
    if (user?.role !== 'admin') {
        return _jsx(Navigate, { to: "/", replace: true });
    }
    return _jsx(RouteGuard, { children: children });
}
const routes = [
    {
        element: _jsx(RootLayout, {}),
        children: [
            {
                path: '/',
                element: _jsx(RouteGuard, { children: _jsx(HomePage, {}) }),
            },
            {
                path: '/login',
                element: _jsx(RouteGuard, { children: _jsx(LoginPage, {}) }),
            },
            {
                path: '/register',
                element: _jsx(RouteGuard, { children: _jsx(RegisterPage, {}) }),
            },
            {
                path: '/forgot-password',
                element: _jsx(RouteGuard, { children: _jsx(ForgotPasswordPage, {}) }),
            },
            {
                path: '/reset-password',
                element: _jsx(RouteGuard, { children: _jsx(ResetPasswordPage, {}) }),
            },
            {
                path: '/products',
                element: _jsx(RouteGuard, { children: _jsx(ProductsPage, {}) }),
            },
            {
                path: '/products/:slug',
                element: _jsx(RouteGuard, { children: _jsx(ProductDetailPage, {}) }),
            },
            {
                path: '/cart',
                element: _jsx(RouteGuard, { children: _jsx(CartPage, {}) }),
            },
            {
                path: '/checkout',
                element: _jsx(RequireAuth, { children: _jsx(CheckoutPage, {}) }),
            },
            {
                path: '/orders/:id/payment',
                element: _jsx(RequireAuth, { children: _jsx(PaymentPage, {}) }),
            },
            {
                path: '/orders',
                element: _jsx(RequireAuth, { children: _jsx(OrdersPage, {}) }),
            },
            {
                path: '/orders/:id',
                element: _jsx(RequireAuth, { children: _jsx(OrderDetailPage, {}) }),
            },
            {
                path: '/account',
                element: _jsx(RequireAuth, { children: _jsx(AccountPage, {}) }),
            },
            {
                path: '/account/addresses',
                element: _jsx(RequireAuth, { children: _jsx(AddressesPage, {}) }),
            },
            // Dev only - UI showcase
            ...(import.meta.env.DEV ? [{
                    path: '/_ui',
                    element: _jsx(RouteGuard, { children: _jsx(UIShowcase, {}) }),
                }] : []),
            {
                path: '*',
                element: _jsx(RouteGuard, { children: _jsx(NotFoundPage, {}) }),
            },
        ],
    },
    {
        element: _jsx(AdminLayout, {}),
        children: [
            {
                path: '/admin',
                element: _jsx(RequireAdmin, { children: _jsx(AdminDashboard, {}) }),
            },
            {
                path: '/admin/orders',
                element: _jsx(RequireAdmin, { children: _jsx(AdminOrders, {}) }),
            },
            {
                path: '/admin/payments',
                element: _jsx(RequireAdmin, { children: _jsx(AdminPayments, {}) }),
            },
            {
                path: '/admin/products',
                element: _jsx(RequireAdmin, { children: _jsx(AdminProducts, {}) }),
            },
            {
                path: '/admin/categories',
                element: _jsx(RequireAdmin, { children: _jsx(AdminCategories, {}) }),
            },
            {
                path: '/admin/banks',
                element: _jsx(RequireAdmin, { children: _jsx(AdminBanks, {}) }),
            },
        ],
    },
];
export const router = createBrowserRouter(routes);
//# sourceMappingURL=router.js.map