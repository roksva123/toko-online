import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Helmet } from 'react-helmet-async'
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  Pagination,
  Select,
  Skeleton,
} from '@/components/ui'
import {
  AdminProduct,
  adminKeys,
  categoryOptions,
  deleteProduct,
  fetchCategories,
  fetchProducts,
  formatRupiah,
  parseApiError,
} from '@/lib/api/admin'
import { ProductForm } from '../components/ProductForm'

const PAGE_SIZE = 20

type View = { mode: 'list' } | { mode: 'form'; productId: string | null }

const statusOptions = [
  { value: 'active', label: 'Aktif' },
  { value: 'inactive', label: 'Nonaktif' },
]

function priceLabel(p: AdminProduct): string {
  if (p.variant_count === 0) return '-'
  if (p.price_min === p.price_max) return formatRupiah(p.price_min)
  return `${formatRupiah(p.price_min)} - ${formatRupiah(p.price_max)}`
}

export default function AdminProducts() {
  const queryClient = useQueryClient()

  const [view, setView] = useState<View>({ mode: 'list' })
  const [notice, setNotice] = useState('')

  // Filter
  const [searchInput, setSearchInput] = useState('')
  const [q, setQ] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [status, setStatus] = useState<'' | 'active' | 'inactive'>('')
  const [page, setPage] = useState(1)

  // Hapus
  const [deleting, setDeleting] = useState<AdminProduct | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [deleteBusy, setDeleteBusy] = useState(false)

  // Pencarian menunggu admin berhenti mengetik sebentar
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(searchInput.trim())
      setPage(1)
    }, 400)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(''), 4000)
    return () => clearTimeout(t)
  }, [notice])

  const { data: categories } = useQuery({
    queryKey: adminKeys.categories,
    queryFn: fetchCategories,
  })
  const categoryFilterOptions = useMemo(() => categoryOptions(categories ?? []), [categories])

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [...adminKeys.products, 'list', { page, q, categoryId, status }],
    queryFn: () =>
      fetchProducts({
        page,
        limit: PAGE_SIZE,
        q,
        category_id: categoryId,
        status,
      }),
    enabled: view.mode === 'list',
  })

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const hasFilter = q !== '' || categoryId !== '' || status !== ''

  const handleDelete = async () => {
    if (!deleting) return
    setDeleteError('')
    setDeleteBusy(true)
    try {
      await deleteProduct(deleting.id)
      await queryClient.invalidateQueries({ queryKey: adminKeys.all })
      setDeleting(null)
      setNotice('Produk berhasil dihapus')
    } catch (err) {
      setDeleteError(parseApiError(err).message)
    } finally {
      setDeleteBusy(false)
    }
  }

  if (view.mode === 'form') {
    return (
      <>
        <Helmet>
          <title>{view.productId ? 'Ubah produk' : 'Tambah produk'} - Admin Toko Online</title>
        </Helmet>
        <ProductForm
          productId={view.productId}
          onCancel={() => setView({ mode: 'list' })}
          onSaved={(message) => {
            setNotice(message)
            setView({ mode: 'list' })
          }}
        />
      </>
    )
  }

  return (
    <>
      <Helmet>
        <title>Produk - Admin Toko Online</title>
      </Helmet>

      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Produk</h1>
          <p className="text-gray-600 text-sm mt-1">
            {total > 0 ? `${total} produk` : 'Kelola produk yang dijual di toko.'}
          </p>
        </div>
        <Button onClick={() => setView({ mode: 'form', productId: null })}>Tambah produk</Button>
      </div>

      {notice && (
        <div
          role="status"
          className="mb-4 rounded border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-green-800"
        >
          {notice}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <Input
          label="Cari produk"
          placeholder="Ketik nama produk"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <Select
          label="Kategori"
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value)
            setPage(1)
          }}
          options={categoryFilterOptions}
        />
        <Select
          label="Status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as '' | 'active' | 'inactive')
            setPage(1)
          }}
          options={statusOptions}
        />
      </div>

      {isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full" count={6} />
        </div>
      )}

      {isError && (
        <ErrorState
          title="Produk gagal dimuat"
          message="Periksa koneksi lalu coba lagi."
          action={<Button onClick={() => refetch()}>Coba lagi</Button>}
        />
      )}

      {!isLoading && !isError && items.length === 0 && (
        <EmptyState
          title={hasFilter ? 'Produk tidak ditemukan' : 'Belum ada produk'}
          description={
            hasFilter
              ? 'Coba ubah kata kunci atau filter.'
              : 'Tambahkan produk pertama agar muncul di toko.'
          }
          action={
            hasFilter ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setSearchInput('')
                  setCategoryId('')
                  setStatus('')
                  setPage(1)
                }}
              >
                Reset filter
              </Button>
            ) : (
              <Button onClick={() => setView({ mode: 'form', productId: null })}>
                Tambah produk
              </Button>
            )
          }
        />
      )}

      {!isLoading && !isError && items.length > 0 && (
        <>
          <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Produk</th>
                  <th className="px-4 py-3 font-medium">Kategori</th>
                  <th className="px-4 py-3 font-medium">Harga</th>
                  <th className="px-4 py-3 font-medium">Stok</th>
                  <th className="px-4 py-3 font-medium">Varian</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900">{p.name}</span>
                      <span className="block text-xs text-gray-500">{p.slug}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{p.category_name}</td>
                    <td className="px-4 py-3 text-gray-900 whitespace-nowrap">{priceLabel(p)}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {p.total_stock === 0 ? (
                        <Badge variant="danger">Habis</Badge>
                      ) : (
                        p.total_stock
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{p.variant_count}</td>
                    <td className="px-4 py-3">
                      <Badge variant={p.is_active ? 'success' : 'default'}>
                        {p.is_active ? 'Aktif' : 'Nonaktif'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setView({ mode: 'form', productId: p.id })}
                        >
                          Ubah
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => {
                            setDeleteError('')
                            setDeleting(p)
                          }}
                        >
                          Hapus
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <Pagination
              className="mt-6"
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          )}
        </>
      )}

      <Modal
        isOpen={deleting !== null}
        onClose={() => !deleteBusy && setDeleting(null)}
        title="Hapus produk"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)} disabled={deleteBusy}>
              Batal
            </Button>
            <Button variant="danger" onClick={handleDelete} isLoading={deleteBusy}>
              Hapus
            </Button>
          </>
        }
      >
        <p className="text-gray-700">
          Hapus produk <strong>{deleting?.name}</strong> beserta semua variannya? Tindakan ini
          tidak bisa dibatalkan.
        </p>
        {deleteError && (
          <div
            role="alert"
            className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
          >
            {deleteError}
          </div>
        )}
      </Modal>
    </>
  )
}