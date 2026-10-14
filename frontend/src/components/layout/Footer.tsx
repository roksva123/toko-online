import { Link } from 'react-router-dom'

export function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300 mt-12">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div>
            <h3 className="text-white font-bold text-lg mb-4">Toko Online</h3>
            <p className="text-sm">Belanja produk berkualitas dengan mudah dan aman.</p>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-white font-semibold mb-4">Belanja</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/products" className="hover:text-white transition-colors">
                  Semua Produk
                </Link>
              </li>
              <li>
                <Link to="/products" className="hover:text-white transition-colors">
                  Kategori
                </Link>
              </li>
            </ul>
          </div>

          {/* Akun */}
          <div>
            <h4 className="text-white font-semibold mb-4">Akun</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/login" className="hover:text-white transition-colors">
                  Masuk
                </Link>
              </li>
              <li>
                <Link to="/register" className="hover:text-white transition-colors">
                  Daftar
                </Link>
              </li>
              <li>
                <Link to="/orders" className="hover:text-white transition-colors">
                  Pesanan Saya
                </Link>
              </li>
            </ul>
          </div>

          {/* Info */}
          <div>
            <h4 className="text-white font-semibold mb-4">Info</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Tentang Kami
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Kebijakan Privasi
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Syarat & Ketentuan
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-700 pt-8">
          <p className="text-center text-sm text-gray-400">
            &copy; 2024 Toko Online. Semua hak dilindungi.
          </p>
        </div>
      </div>
    </footer>
  )
}
