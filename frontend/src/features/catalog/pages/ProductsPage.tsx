import { useEffect, useMemo, useRef, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button, EmptyState, ErrorState, Input, Pagination, ProductGridSkeleton } from '@/components/ui'
import {
  fetchPublicCategories,
  fetchPublicProducts,
  flattenPublicCategories,
} from '@/lib/api/catalog'
import { useDebounce } from '@/lib/utils'
import { ProductCard } from '../components/ProductCard'

const PAGE_SIZE = 12

// Nilai di URL -> nilai yang dikirim ke API
const sortMap = {
  newest: '',
  cheapest: 'price_asc',
  most_expensive: 'price_desc',
} as const
type SortKey = keyof typeof sortMap

const selectClass =
  'w-full px-3 py-2.5 border border-gray-300 rounded text-base bg-white text-gray-900 transition-colors focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'

export default function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [showFilters, setShowFilters] = useState(false)

  const q = searchParams.get('q') || ''
  const category = searchParams.get('category') || ''
  const rawSort = searchParams.get('sort') || 'newest'
  const sort: SortKey = rawSort in sortMap ? (rawSort as SortKey) : 'newest'
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)

  const [searchInput, setSearchInput] = useState(q)
  const debouncedSearch = useDebounce(searchInput, 500)

  // Nilai q terakhir yang kita tahu, supaya ketikan admin tidak tertimpa URL
  const lastQ = useRef(q)

  // URL -> kolom cari (mis. pencarian dari header atau tombol reset)
  useEffect(() => {
    if (q !== lastQ.current) {
      lastQ.current = q
      setSearchInput(q)
    }
  }, [q])

  // Kolom cari -> URL (setelah berhenti mengetik)
  useEffect(() => {
    if (debouncedSearch === lastQ.current) return
    lastQ.current = debouncedSearch
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (debouncedSearch) next.set('q', debouncedSearch)
        else next.delete('q')
        next.delete('page')
        return next
      },
      { replace: true }
    )
  }, [debouncedSearch, setSearchParams])

  const { data: categories } = useQuery({
    queryKey: ['public-categories'],
    queryFn: fetchPublicCategories,
  })
  const categoryRows = useMemo(() => flattenPublicCategories(categories ?? []), [categories])

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['public-products', { q, category, sort, page }],
    queryFn: () =>
      fetchPublicProducts({
        q,
        category,
        sort: sortMap[sort],
        page,
        limit: PAGE_SIZE,
      }),
  })

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const hasFilter = q !== '' || category !== '' || sort !== 'newest'

  const updateParam = (key: string, value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value) next.set(key, value)
      else next.delete(key)
      next.delete('page')
      return next
    })
  }

  const changePage = (newPage: number) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (newPage > 1) next.set('page', String(newPage))
      else next.delete('page')
      return next
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const resetFilters = () => {
    setSearchInput('')
    setSearchParams(new URLSearchParams())
  }

  // Dipakai di panel filter desktop dan mobile
  const filterFields = (
    <div className="space-y-4">
      <Input
        label="Cari"
        placeholder="Nama produk..."
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
      />

      <div>
        <label htmlFor="filter-category" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
          Kategori
        </label>
        <select
          id="filter-category"
          className={selectClass}
          value={category}
          onChange={(e) => updateParam('category', e.target.value)}
        >
          <option value="">Semua kategori</option>
          {categoryRows.map(({ category: c, depth }) => (
            <option key={c.id} value={c.slug}>
              {'— '.repeat(depth)}
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="filter-sort" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
          Urutkan
        </label>
        <select
          id="filter-sort"
          className={selectClass}
          value={sort}
          onChange={(e) => updateParam('sort', e.target.value === 'newest' ? '' : e.target.value)}
        >
          <option value="newest">Terbaru</option>
          <option value="cheapest">Harga termurah</option>
          <option value="most_expensive">Harga termahal</option>
        </select>
      </div>

      {hasFilter && (
        <Button variant="ghost" fullWidth size="sm" onClick={resetFilters}>
          Reset filter
        </Button>
      )}
    </div>
  )

  return (
    <>
      <Helmet>
        <title>Produk - Toko Online</title>
        <meta name="description" content="Jelajahi produk pilihan dengan harga terbaik." />
      </Helmet>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-end justify-between mb-8">
          <h1 className="text-3xl font-bold">Produk</h1>
          {!isLoading && !isError && <p className="text-sm text-gray-600">{total} produk</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Filter desktop */}
          <aside className="hidden md:block">
            <div className="bg-white rounded-lg shadow-md p-4 dark:bg-gray-900">
              <h2 className="font-semibold mb-4">Filter</h2>
              {filterFields}
            </div>
          </aside>

          <div className="md:col-span-3">
            {/* Filter mobile */}
            <div className="md:hidden mb-4 flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => setShowFilters((v) => !v)}>
                {showFilters ? 'Tutup filter' : 'Filter'}
              </Button>
              {hasFilter && (
                <Button size="sm" variant="ghost" onClick={resetFilters}>
                  Reset
                </Button>
              )}
            </div>
            {showFilters && (
              <div className="md:hidden bg-white rounded-lg shadow-md p-4 mb-4">{filterFields}</div>
            )}

            {isLoading && <ProductGridSkeleton />}

            {isError && (
              <ErrorState
                title="Produk gagal dimuat"
                message="Terjadi kesalahan saat memuat produk. Silakan coba lagi."
                action={<Button onClick={() => refetch()}>Coba lagi</Button>}
              />
            )}

            {!isLoading && !isError && items.length === 0 && (
              <EmptyState
                icon="🔍"
                title={hasFilter ? 'Produk tidak ditemukan' : 'Belum ada produk'}
                description={
                  hasFilter
                    ? 'Coba ubah filter atau cari dengan kata kunci lain.'
                    : 'Produk akan muncul di sini setelah ditambahkan oleh admin.'
                }
                action={
                  hasFilter ? <Button onClick={resetFilters}>Reset filter</Button> : undefined
                }
              />
            )}

            {items.length > 0 && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="mt-8">
                    <Pagination
                      currentPage={page}
                      totalPages={totalPages}
                      onPageChange={changePage}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}