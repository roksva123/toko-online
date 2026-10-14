import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'

export default function HomePage() {
  return (
    <>
      <Helmet>
        <title>Toko Online - Belanja Produk Berkualitas</title>
        <meta name="description" content="Belanja berbagai produk berkualitas dengan harga terjangkau dan pengiriman cepat." />
      </Helmet>

      <div className="max-w-7xl mx-auto px-4">
        {/* Hero Section */}
        <section className="py-12 md:py-20">
          <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-lg px-6 md:px-12 py-12 md:py-16 text-white">
            <h1 className="text-3xl md:text-5xl font-bold mb-4">
              Belanja Produk Berkualitas
            </h1>
            <p className="text-lg md:text-xl mb-6 opacity-90">
              Temukan ribuan produk pilihan dengan harga terbaik dan pengiriman aman ke seluruh negara.
            </p>
            <Link to="/products">
              <Button size="lg" variant="secondary">
                Mulai Belanja Sekarang
              </Button>
            </Link>
          </div>
        </section>

        {/* Categories */}
        <section className="py-12">
          <h2 className="text-2xl font-bold mb-6">Kategori Populer</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {['Elektronik', 'Fashion', 'Rumah & Taman', 'Olahraga'].map((cat) => (
              <Link
                key={cat}
                to={`/products?category=${cat.toLowerCase().replace(/ /g, '-')}`}
              >
                <Card className="hover:shadow-lg transition-shadow cursor-pointer h-24 flex items-center justify-center">
                  <CardBody className="text-center">
                    <p className="font-medium text-gray-900">{cat}</p>
                  </CardBody>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        {/* Featured Products */}
        <section className="py-12">
          <h2 className="text-2xl font-bold mb-6">Produk Unggulan</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="hover:shadow-lg transition-shadow">
                <div className="bg-gray-200 h-48 rounded-t flex items-center justify-center">
                  <Spinner />
                </div>
                <CardBody>
                  <p className="font-semibold text-gray-900 truncate">Produk Unggulan {i}</p>
                  <p className="text-primary-600 font-bold mt-2">Rp 99.000</p>
                  <Button size="sm" fullWidth className="mt-3">
                    Lihat Detail
                  </Button>
                </CardBody>
              </Card>
            ))}
          </div>
        </section>

        {/* Latest Products */}
        <section className="py-12">
          <h2 className="text-2xl font-bold mb-6">Produk Terbaru</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[5, 6, 7, 8].map((i) => (
              <Card key={i} className="hover:shadow-lg transition-shadow">
                <div className="bg-gray-200 h-48 rounded-t flex items-center justify-center">
                  <Spinner />
                </div>
                <CardBody>
                  <p className="font-semibold text-gray-900 truncate">Produk Terbaru {i}</p>
                  <p className="text-primary-600 font-bold mt-2">Rp 149.000</p>
                  <Button size="sm" fullWidth className="mt-3">
                    Lihat Detail
                  </Button>
                </CardBody>
              </Card>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-12 mb-12">
          <div className="bg-primary-50 border border-primary-200 rounded-lg px-6 md:px-12 py-8 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-3">
              Dapatkan Penawaran Eksklusif
            </h2>
            <p className="text-gray-600 mb-6">
              Daftarkan akun Anda sekarang dan nikmati diskon khusus untuk pembelian pertama.
            </p>
            <Link to="/register">
              <Button variant="primary">Daftar Sekarang</Button>
            </Link>
          </div>
        </section>
      </div>
    </>
  )
}
