import { useState, useEffect } from 'react'
import { Helmet } from 'react-helmet-async'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import { Button, Input, Select, Card, CardBody, Badge, Skeleton, ProductGridSkeleton, EmptyState, ErrorState, Pagination } from '@/components/ui'
import { formatRupiah, useDebounce } from '@/lib/utils'

interface Product {
  id: string
  slug: string
  name: string
  base_price: number
  category_name: string
  is_active: boolean
}

interface ProductsResponse {
  data: Product[]
  meta: {
    page: number
    limit: number
    total: number
  }
}

export default function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [searchInput, setSearchInput] = useState(searchParams.get('q') || '')
  const [showFilters, setShowFilters] = useState(false)

  // Query params
  const q = searchParams.get('q') || ''
  const category = searchParams.get('category') || ''
  const minPrice = searchParams.get('minPrice') || ''
  const maxPrice = searchParams.get('maxPrice') || ''
  const sort = searchParams.get('sort') || 'newest'
  const page = parseInt(searchParams.get('page') || '1')

  const debouncedSearch = useDebounce(searchInput, 500)

  // Update search param when debounced input changes
  useEffect(() => {
    if (debouncedSearch !== q) {
      setSearchParams((prev) => {
        prev.set('q', debouncedSearch)
        prev.set('page', '1')
        return prev
      })
    }
  }, [debouncedSearch, q, setSearchParams])

  // Fetch products
  const { data, isLoading, error } = useQuery({
    queryKey: ['products', { q, category, minPrice, maxPrice, sort, page }],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (category) params.set('category', category)
      if (minPrice) params.set('min_price', minPrice)
      if (maxPrice) params.set('max_price', maxPrice)
      if (sort) params.set('sort', sort)
      params.set('page', page.toString())
      params.set('limit', '12')

      const response = await apiClient.get<ProductsResponse>(`/products?${params.toString()}`)
      return response.data
    },
  })

  const handleFilterChange = (key: string, value: string) => {
    setSearchParams((prev) => {
      if (value) {
        prev.set(key, value)
      } else {
        prev.delete(key)
      }
      prev.set('page', '1')
      return prev
    })
  }

  const handleResetFilters = () => {
    setSearchInput('')
    setSearchParams(new URLSearchParams())
  }

  return (
    <>
      <Helmet>
        <title>Produk - Toko Online</title>
        <meta name="description" content="Jelajahi ribuan produk pilihan dengan harga terbaik." />
      </Helmet>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Produk</h1>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Filters - Desktop */}
          <div className="hidden md:block space-y-4">
            <div className="bg-white rounded-lg shadow-md p-4">
              <h3 className="font-semibold mb-4">Filter</h3>

              <Input
                label="Cari"
                placeholder="Nama produk..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="mb-4"
              />

              <Select
                label="Kategori"
                options={[
                  { value: '', label: 'Semua Kategori' },
                  { value: 'elektronik', label: 'Elektronik' },
                  { value: 'fashion', label: 'Fashion' },
                  { value: 'rumah', label: 'Rumah & Taman' },
                ]}
                value={category}
                onChange={(e) => handleFilterChange('category', e.target.value)}
                className="mb-4"
              />

              <Select
                label="Urutkan"
                options={[
                  { value: 'newest', label: 'Terbaru' },
                  { value: 'cheapest', label: 'Termurah' },
                  { value: 'most_expensive', label: 'Termahal' },
                ]}
                value={sort}
                onChange={(e) => handleFilterChange('sort', e.target.value)}
                className="mb-4"
              />

              <Button variant="ghost" fullWidth onClick={handleResetFilters} size="sm">
                Reset Filter
              </Button>
            </div>
          </div>

          {/* Products Grid */}
          <div className="md:col-span-3">
            {/* Mobile Filters Button */}
            <div className="md:hidden mb-4 flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => setShowFilters(!showFilters)}>
                Filter
              </Button>
              {(q || category || sort !== 'newest') && (
                <Button size="sm" variant="ghost" onClick={handleResetFilters}>
                  Reset
                </Button>
              )}
            </div>

            {/* Mobile Filters */}
            {showFilters && (
              <div className="md:hidden bg-white rounded-lg shadow-md p-4 mb-4 space-y-4">
                <Input
                  label="Cari"
                  placeholder="Nama produk..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
                <Select
                  label="Kategori"
                  options={[
                    { value: '', label: 'Semua Kategori' },
                    { value: 'elektronik', label: 'Elektronik' },
                    { value: 'fashion', label: 'Fashion' },
                    { value: 'rumah', label: 'Rumah & Taman' },
                  ]}
                  value={category}
                  onChange={(e) => handleFilterChange('category', e.target.value)}
                />
                <Select
                  label="Urutkan"
                  options={[
                    { value: 'newest', label: 'Terbaru' },
                    { value: 'cheapest', label: 'Termurah' },
                    { value: 'most_expensive', label: 'Termahal' },
                  ]}
                  value={sort}
                  onChange={(e) => handleFilterChange('sort', e.target.value)}
                />
              </div>
            )}

            {/* Loading State */}
            {isLoading && <ProductGridSkeleton />}

            {/* Error State */}
            {error && !isLoading && (
              <ErrorState
                title="Gagal Memuat Produk"
                message="Terjadi kesalahan saat memuat produk. Silakan coba lagi."
                action={<Button size="sm" variant="primary" onClick={() => window.location.reload()}>Coba Lagi</Button>}
              />
            )}

            {/* Products Grid */}
            {data && data.data.length > 0 && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {data.data.map((product) => (
                    <a key={product.id} href={`/products/${product.slug}`}>
                      <Card className="hover:shadow-lg transition-shadow h-full">
                        <div className="bg-gray-200 h-48 rounded-t flex items-center justify-center relative">
                          <Skeleton className="w-full h-full" />
                          {!product.is_active && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                              <Badge variant="danger">Tidak Tersedia</Badge>
                            </div>
                          )}
                        </div>
                        <CardBody>
                          <p className="font-semibold text-gray-900 line-clamp-2 h-14">
                            {product.name}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">{product.category_name}</p>
                          <p className="text-primary-600 font-bold mt-3">
                            Dari {formatRupiah(product.base_price)}
                          </p>
                        </CardBody>
                      </Card>
                    </a>
                  ))}
                </div>

                {/* Pagination */}
                {data.meta.total > 0 && (
                  <div className="mt-8">
                    <Pagination
                      currentPage={data.meta.page}
                      totalPages={Math.ceil(data.meta.total / data.meta.limit)}
                      onPageChange={(newPage) =>
                        setSearchParams((prev) => {
                          prev.set('page', newPage.toString())
                          return prev
                        })
                      }
                    />
                  </div>
                )}
              </>
            )}

            {/* Empty State */}
            {!isLoading && data && data.data.length === 0 && (
              <EmptyState
                icon="🔍"
                title="Produk Tidak Ditemukan"
                description="Coba ubah filter atau cari dengan kata kunci lain."
                action={<Button size="sm" variant="primary" onClick={handleResetFilters}>Reset Filter</Button>}
              />
            )}
          </div>
        </div>
      </div>
    </>
  )
}
