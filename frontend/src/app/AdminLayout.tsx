import { Outlet } from 'react-router-dom'

export function AdminLayout() {
  return (
    <div className="flex min-h-screen bg-gray-100 dark:bg-gray-950">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white p-4 hidden md:block">
        <h2 className="font-bold text-lg mb-6">Admin Panel</h2>
        <nav className="space-y-2 text-sm">
          <a href="/admin" className="block px-3 py-2 hover:bg-gray-800 rounded">
            Dashboard
          </a>
          <a href="/admin/orders" className="block px-3 py-2 hover:bg-gray-800 rounded">
            Pesanan
          </a>
          <a href="/admin/payments" className="block px-3 py-2 hover:bg-gray-800 rounded">
            Pembayaran
          </a>
          <a href="/admin/products" className="block px-3 py-2 hover:bg-gray-800 rounded">
            Produk
          </a>
          <a href="/admin/categories" className="block px-3 py-2 hover:bg-gray-800 rounded">
            Kategori
          </a>
          <a href="/admin/banks" className="block px-3 py-2 hover:bg-gray-800 rounded">
            Rekening Bank
          </a>
          <hr className="my-4" />
          <a href="/" className="block px-3 py-2 hover:bg-gray-800 rounded text-red-400">
            Kembali ke Toko
          </a>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1">
        <header className="bg-white border-b border-gray-200 dark:bg-gray-900 dark:border-gray-700 px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Admin Dashboard</h1>
          <a href="/" className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white text-sm">
            Keluar
          </a>
        </header>

        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
