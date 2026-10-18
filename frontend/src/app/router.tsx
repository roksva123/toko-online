import { createBrowserRouter, Navigate, RouteObject, useLocation } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Spinner } from '@/components/ui/Spinner'
import { RootLayout } from './RootLayout'
import { AdminLayout } from './AdminLayout'


// Lazy load halaman
const LoginPage = lazy(() => import('@/features/auth/pages/LoginPage'))
const RegisterPage = lazy(() => import('@/features/auth/pages/RegisterPage'))
const ForgotPasswordPage = lazy(() => import('@/features/auth/pages/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('@/features/auth/pages/ResetPasswordPage'))
const HomePage = lazy(() => import('@/features/catalog/pages/HomePage'))
const ProductsPage = lazy(() => import('@/features/catalog/pages/ProductsPage'))
const ProductDetailPage = lazy(() => import('@/features/catalog/pages/ProductDetailPage'))
const CartPage = lazy(() => import('@/features/cart/pages/CartPage'))
const CheckoutPage = lazy(() => import('@/features/checkout/pages/CheckoutPage'))
const PaymentPage = lazy(() => import('@/features/orders/pages/PaymentPage'))
const OrdersPage = lazy(() => import('@/features/orders/pages/OrdersPage'))
const OrderDetailPage = lazy(() => import('@/features/orders/pages/OrderDetailPage'))
const AccountPage = lazy(() => import('@/features/account/pages/AccountPage'))
const AddressesPage = lazy(() => import('@/features/account/pages/AddressesPage'))
const AdminDashboard = lazy(() => import('@/features/admin/pages/AdminDashboard'))
const AdminOrders = lazy(() => import('@/features/admin/pages/AdminOrders'))
const AdminPayments = lazy(() => import('@/features/admin/pages/AdminPayments'))
const AdminProducts = lazy(() => import('@/features/admin/pages/AdminProducts'))
const AdminCategories = lazy(() => import('@/features/admin/pages/AdminCategories'))
const AdminBanks = lazy(() => import('@/features/admin/pages/AdminBanks'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))
const UIShowcase = lazy(() => import('@/pages/UIShowcase'))

function RouteGuard({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<Spinner fullscreen />}>
      {children}
    </Suspense>
  )
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <Spinner fullscreen />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <RouteGuard>{children}</RouteGuard>
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return <Spinner fullscreen />
  }

  if (user?.role !== 'admin') {
    return <Navigate to="/" replace />
  }

  return <RouteGuard>{children}</RouteGuard>
}

const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    children: [
      {
        path: '/',
        element: <RouteGuard><HomePage /></RouteGuard>,
      },
      {
        path: '/login',
        element: <RouteGuard><LoginPage /></RouteGuard>,
      },
      {
        path: '/register',
        element: <RouteGuard><RegisterPage /></RouteGuard>,
      },
      {
        path: '/forgot-password',
        element: <RouteGuard><ForgotPasswordPage /></RouteGuard>,
      },
      {
        path: '/reset-password',
        element: <RouteGuard><ResetPasswordPage /></RouteGuard>,
      },
      {
        path: '/products',
        element: <RouteGuard><ProductsPage /></RouteGuard>,
      },
      {
        path: '/products/:slug',
        element: <RouteGuard><ProductDetailPage /></RouteGuard>,
      },
      {
        path: '/cart',
        element: <RouteGuard><CartPage /></RouteGuard>,
      },
      {
        path: '/checkout',
        element: <RequireAuth><CheckoutPage /></RequireAuth>,
      },
      {
        path: '/orders/:id/payment',
        element: <RequireAuth><PaymentPage /></RequireAuth>,
      },
      {
        path: '/orders',
        element: <RequireAuth><OrdersPage /></RequireAuth>,
      },
      {
        path: '/orders/:id',
        element: <RequireAuth><OrderDetailPage /></RequireAuth>,
      },
      {
        path: '/account',
        element: <RequireAuth><AccountPage /></RequireAuth>,
      },
      {
        path: '/account/addresses',
        element: <RequireAuth><AddressesPage /></RequireAuth>,
      },
      // Dev only - UI showcase
      ...(import.meta.env.DEV ? [{
        path: '/_ui',
        element: <RouteGuard><UIShowcase /></RouteGuard>,
      }] : []),
      {
        path: '*',
        element: <RouteGuard><NotFoundPage /></RouteGuard>,
      },
    ],
  },
  {
    element: <AdminLayout />,
    children: [
      {
        path: '/admin',
        element: <RequireAdmin><AdminDashboard /></RequireAdmin>,
      },
      {
        path: '/admin/orders',
        element: <RequireAdmin><AdminOrders /></RequireAdmin>,
      },
      {
        path: '/admin/payments',
        element: <RequireAdmin><AdminPayments /></RequireAdmin>,
      },
      {
        path: '/admin/products',
        element: <RequireAdmin><AdminProducts /></RequireAdmin>,
      },
      {
        path: '/admin/categories',
        element: <RequireAdmin><AdminCategories /></RequireAdmin>,
      },
      {
        path: '/admin/banks',
        element: <RequireAdmin><AdminBanks /></RequireAdmin>,
      },
    ],
  },
]

export const router = createBrowserRouter(routes)
