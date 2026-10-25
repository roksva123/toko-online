import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Helmet } from 'react-helmet-async'
import { Badge, Button, ErrorState, Input, Pagination, Select, Skeleton } from '@/components/ui'
import { adminKeys, fetchOrders, formatRupiah, parseApiError, updateOrderStatus } from '@/lib/api/admin'

const PAGE_SIZE = 20

const statusOptions = [
  { value: '', label: 'Semua status' },
  { value: 'pending_payment', label: 'Menunggu pembayaran' },
  { value: 'paid', label: 'Dibayar' },
  { value: 'processing', label: 'Diproses' },
  { value: 'shipped', label: 'Dikirim' },
  { value: 'delivered', label: 'Tiba' },
  { value: 'cancelled', label: 'Dibatalkan' },
  { value: 'expired', label: 'Kedaluwarsa' },
]

const statusLabels: Record<string, string> = Object.fromEntries(
  statusOptions.filter((option) => option.value).map((option) => [option.value, option.label])
)

const badgeVariant = (status: string): 'default' | 'pending' | 'success' | 'processing' | 'shipped' | 'delivered' | 'cancelled' => {
  if (status === 'pending_payment') return 'pending'
  if (status === 'paid') return 'success'
  if (status === 'processing') return 'processing'
  if (status === 'shipped') return 'shipped'
  if (status === 'delivered') return 'delivered'
  if (status === 'cancelled') return 'cancelled'
  return 'default'
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })

export default function AdminOrders() {
  const queryClient = useQueryClient()
  const [qInput, setQInput] = useState('')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [editingID, setEditingID] = useState<string | null>(null)
  const [nextStatus, setNextStatus] = useState('')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(qInput.trim())
      setPage(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [qInput])

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [...adminKeys.orders, { page, q, status }],
    queryFn: () => fetchOrders({ page, limit: PAGE_SIZE, q, status }),
  })

  const saveStatus = async () => {
    if (!editingID || !nextStatus) return
    setError('')
    try {
      await updateOrderStatus(editingID, { status: nextStatus, tracking_number: trackingNumber })
      await queryClient.invalidateQueries({ queryKey: adminKeys.orders })
      await queryClient.invalidateQueries({ queryKey: [...adminKeys.all, 'dashboard'] })
      setEditingID(null)
    } catch (err) {
      setError(parseApiError(err).message)
    }
  }

  const items = data?.items ?? []
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE))

  return (
    <>
      <Helmet><title>Pesanan - Admin Toko Online</title></Helmet>
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pesanan</h1>
          <p className="text-sm text-gray-600 mt-1">Kelola pesanan pelanggan dan status pengiriman.</p>
        </div>
        <Button variant="secondary" onClick={() => refetch()}>Muat ulang</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <Input label="Cari pesanan" placeholder="Nomor pesanan, nama, atau email" value={qInput} onChange={(event) => setQInput(event.target.value)} />
        <Select label="Status" value={status} options={statusOptions} onChange={(event) => { setStatus(event.target.value); setPage(1) }} />
      </div>

      {isLoading && <Skeleton className="h-14 w-full" count={6} />}
      {isError && <ErrorState title="Pesanan gagal dimuat" message="Periksa koneksi lalu coba lagi." action={<Button onClick={() => refetch()}>Coba lagi</Button>} />}

      {!isLoading && !isError && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm text-left">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3 font-medium">Pesanan</th>
                <th className="px-4 py-3 font-medium">Pelanggan</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Pengiriman</th>
                <th className="px-4 py-3 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((order) => (
                <tr key={order.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{order.order_number}</p>
                    <p className="text-xs text-gray-500">{formatDate(order.created_at)} · {order.item_count} item</p>
                  </td>
                  <td className="px-4 py-3"><p>{order.customer_name}</p><p className="text-xs text-gray-500">{order.customer_email}</p></td>
                  <td className="px-4 py-3 font-medium whitespace-nowrap">{formatRupiah(order.total)}</td>
                  <td className="px-4 py-3"><Badge variant={badgeVariant(order.status)}>{statusLabels[order.status] ?? order.status}</Badge></td>
                  <td className="px-4 py-3 text-gray-600"><p>{[order.courier, order.courier_service].filter(Boolean).join(' · ') || '-'}</p><p className="text-xs">{order.tracking_number || ''}</p></td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="secondary" onClick={() => { setEditingID(order.id); setNextStatus(order.status); setTrackingNumber(order.tracking_number); setError('') }}>Ubah status</Button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-500">Belum ada pesanan yang sesuai.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && <Pagination className="mt-6" currentPage={page} totalPages={totalPages} onPageChange={setPage} />}

      {editingID && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl space-y-4">
            <div><h2 className="text-lg font-semibold">Ubah status pesanan</h2><p className="mt-1 text-sm text-gray-600">Masukkan resi ketika pesanan dikirim.</p></div>
            <Select label="Status baru" value={nextStatus} options={statusOptions.slice(1)} onChange={(event) => setNextStatus(event.target.value)} />
            <Input label="Nomor resi" value={trackingNumber} onChange={(event) => setTrackingNumber(event.target.value)} error={nextStatus === 'shipped' && !trackingNumber.trim() ? 'Resi wajib untuk status dikirim' : undefined} />
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setEditingID(null)}>Batal</Button><Button onClick={() => void saveStatus()} disabled={nextStatus === 'shipped' && !trackingNumber.trim()}>Simpan</Button></div>
          </div>
        </div>
      )}
    </>
  )
}
