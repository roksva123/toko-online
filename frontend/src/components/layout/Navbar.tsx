import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useCart } from '@/contexts/CartContext'
import { Button } from './ui/Button'

export function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const { user, logout, isAuthenticated } = useAuth()
  const { totalItems } = useCart()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/products?q=${encodeURIComponent(searchQuery)}`)
      setSearchQuery('')
    }
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 font-bold text-xl text-primary-600">
            <span>🛍️</span>
            Toko Online
          </Link>

          {/* Search - Desktop */}
          <form onSubmit={handleSearch} className="hidden md:flex flex-1 mx-8 max-w-md">
            <div className="w-full flex">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari produk..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-l text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-primary-600 text-white rounded-r hover:bg-primary-700 text-sm font-medium"
              >
                Cari
              </button>
            </div>
          </form>

          {/* Right side menu */}
          <div className="flex items-center gap-4">
            {/* Cart icon */}
            <Link
              to="/cart"
              className="relative p-2 text-gray-600 hover:text-primary-600 transition-colors"
              aria-label="Keranjang"
            >
              <span className="text-2xl">🛒</span>
              {totalItems > 0 && (
                <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs flex items-center justify-center rounded-full font-bold">
                  {totalItems > 99 ? '99+' : totalItems}
                </span>
              )}
            </Link>

            {/* Account menu - Desktop */}
            <div className="hidden md:flex items-center gap-2">
              {isAuthenticated ? (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-700">{user?.name}</span>
                  <Link to="/account" className="text-sm text-gray-600 hover:text-gray-900">
                    Profil
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="text-sm text-gray-600 hover:text-gray-900"
                  >
                    Keluar
                  </button>
                </div>
              ) : (
                <>
                  <Link to="/login" className="text-sm text-primary-600 hover:text-primary-700">
                    Masuk
                  </Link>
                  <Link to="/register" className="text-sm text-primary-600 hover:text-primary-700">
                    Daftar
                  </Link>
                </>
              )}
            </div>

            {/* Hamburger menu - Mobile */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 text-gray-600 hover:text-primary-600"
              aria-label="Menu"
            >
              <span className="text-2xl">☰</span>
            </button>
          </div>
        </div>

        {/* Mobile Search */}
        {isMenuOpen && (
          <form onSubmit={handleSearch} className="md:hidden py-3 border-t border-gray-200">
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari produk..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button
                type="submit"
                className="px-3 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 text-sm font-medium"
              >
                Cari
              </button>
            </div>
          </form>
        )}

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden py-3 border-t border-gray-200 space-y-3">
            <Link to="/products" className="block text-sm text-gray-700 hover:text-primary-600">
              Produk
            </Link>
            {isAuthenticated ? (
              <>
                <Link to="/orders" className="block text-sm text-gray-700 hover:text-primary-600">
                  Pesanan Saya
                </Link>
                <Link to="/account" className="block text-sm text-gray-700 hover:text-primary-600">
                  Profil
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full text-left text-sm text-gray-700 hover:text-primary-600"
                >
                  Keluar
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="block text-sm text-primary-600 hover:text-primary-700">
                  Masuk
                </Link>
                <Link to="/register" className="block text-sm text-primary-600 hover:text-primary-700">
                  Daftar
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}
