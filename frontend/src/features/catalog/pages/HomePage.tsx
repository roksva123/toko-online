import { useMemo } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Button,
  Card,
  CardBody,
  EmptyState,
  ErrorState,
  ProductGridSkeleton,
} from '@/components/ui'
import { useAuth } from '@/contexts/AuthContext'
import { fetchPublicCategories, fetchPublicProducts } from '@/lib/api/catalog'
import { ProductCard } from '../components/ProductCard'

export default function HomePage() {
  const { isAuthenticated } = useAuth()

  const { data: categories } = useQuery({
    queryKey: ['public-categories'],
    queryFn: fetchPublicCategories,
  })

  const {
    data: latest,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['public-products', 'home-latest'],
    queryFn: () => fetchPublicProducts({ limit: 8 }),
  })

  // Kategori utama saja (tanpa sub-kategori)
  const topCategories = useMemo(
    () => (categories ?? []).filter((c) => c.parent_id === null).slice(0, 8),
    [categories]
  )

  return (
    <>
      <Helmet>
        <title>Toko Online - Belanja Produk Berkualitas</title>
        <meta
          name="description"
          content="Belanja berbagai produk berkualitas dengan harga terjangkau dan pengiriman cepat."
        />
      </Helmet>

      <div className="max-w-7xl mx-auto px-4">
        {/* Hero Section */}
        <section className="py-12 md:py-20">
          <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-lg px-6 md:px-12 py-12 md:py-16 text-white">
            <h1 className="text-3xl md:text-5xl font-bold mb-4">Belanja Produk Berkualitas</h1>
            <p className="text-lg md:text-xl mb-6 opacity-90">
              Temukan produk pilihan dengan harga terbaik dan pengiriman aman ke seluruh negara.
            </p>
            <Link to="/products">
              <Button size="lg" variant="secondary">
                Mulai Belanja Sekarang
              </Button>
            </Link>
          </div>
        </section>

        {/* Kategori */}
        {topCategories.length > 0 && (
          <section className="py-12">
            <h2 className="text-2xl font-bold mb-6">Kategori</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {topCategories.map((cat) => (
                <Link key={cat.id} to={`/products?category=${encodeURIComponent(cat.slug)}`}>
                  <Card className="hover:shadow-lg transition-shadow cursor-pointer h-24 flex items-center justify-center">
                    <CardBody className="text-center">
                      <p className="font-medium text-gray-900">{cat.name}</p>
                    </CardBody>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Produk terbaru */}
        <section className="py-12">
          <div className="flex items-end justify-between mb-6">
            <h2 className="text-2xl font-bold">Produk Terbaru</h2>
            <Link to="/products" className="text-sm text-primary-600 hover:underline">
              Lihat semua
            </Link>
          </div>

          {isLoading && <ProductGridSkeleton />}

          {isError && (
            <ErrorState
              title="Produk gagal dimuat"
              message="Periksa koneksi lalu coba lagi."
              action={<Button onClick={() => refetch()}>Coba lagi</Button>}
            />
          )}

          {!isLoading && !isError && latest && latest.items.length === 0 && (
            <EmptyState
              title="Belum ada produk"
              description="Produk akan muncul di sini setelah ditambahkan oleh admin."
            />
          )}

          {latest && latest.items.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {latest.items.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </section>

        {/* Ajakan daftar (disembunyikan jika sudah login) */}
        {!isAuthenticated && (
          <section className="py-12 mb-12">
            <div className="bg-primary-50 border border-primary-200 rounded-lg px-6 md:px-12 py-8 text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-3">Belanja lebih mudah dengan akun</h2>
              <p className="text-gray-600 mb-6">
                Daftar sekarang untuk menyimpan alamat, memantau pesanan, dan checkout lebih cepat.
              </p>
              <Link to="/register">
                <Button variant="primary">Daftar Sekarang</Button>
              </Link>
            </div>
          </section>
        )}
      </div>
    </>
  )
}