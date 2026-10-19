import { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useQuery } from '@tanstack/react-query'
import { Badge, Button, ErrorState, Skeleton } from '@/components/ui'
import { useAuth } from '@/contexts/AuthContext'
import { adminKeys, formatRupiah } from '@/lib/api/admin'
import { fetchDashboard } from '@/lib/api/dashboard'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'

const statusInfo: Record<string, { label: string; variant: BadgeVariant }> = {
  pending_payment: { label: 'Menunggu pembayaran', variant: 'pending' },
  paid: { label: 'Dibayar', variant: 'success' },
  processing: { label: 'Diproses', variant: 'processing' },
  shipped: { label: 'Dikirim', variant: 'shipped' },
  delivered: { label: 'Tiba', variant: 'delivered' },
  cancelled: { label: 'Dibatalkan', variant: 'cancelled' },
  expired: { label: 'Kedaluwarsa', variant: 'default' },
}

const statusOrder = ['pending_payment', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'expired']

function StatusBadge({ status }: { status: string }) {
  const info = statusInfo[status] ?? { label: status, variant: 'default' as BadgeVariant }
  return <Badge variant={info.variant}>{info.label}</Badge>
}

function StatCard({
  title,
  value,
  hint,
}: {
  title: string
  value: string
  hint?: ReactNode
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <p className="text-sm text-gray-600">{title}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  )
}

function Panel({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="bg-white rounded-lg border border-gray-200">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900">{title}</h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })

export default function AdminDashboard() {
  const { user } = useAuth()

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: [...adminKeys.all, 'dashboard'],
    queryFn: fetchDashboard,
    refetchInterval: 60_000, // perbarui otomatis tiap menit selama halaman terbuka
  })

  const toProcess = data ? data.orders.by_status['paid'] ?? 0 : 0
  const waitingPayments = data?.orders.waiting_payment_confirmation ?? 0
  const nothingToDo = data !== undefined && toProcess === 0 && waitingPayments === 0

  return (
    <>
      <Helmet>
        <title>Dashboard - Admin Toko Online</title>
      </Helmet>

      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 text-sm mt-1">
            Halo{user ? `, ${user.name}` : ''}. Ini ringkasan toko kamu.
          </p>
        </div>
        <Button variant="secondary" onClick={() => refetch()} isLoading={isFetching && !isLoading}>
          Muat ulang
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Skeleton className="h-28 w-full" count={4} />
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      )}

      {isError && (
        <ErrorState
          title="Dashboard gagal dimuat"
          message="Periksa koneksi, pastikan backend berjalan, lalu coba lagi."
          action={<Button onClick={() => refetch()}>Coba lagi</Button>}
        />
      )}

      {data && (
        <div className="space-y-6">
          {/* Statistik utama */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Pendapatan bulan ini"
              value={formatRupiah(data.revenue.month)}
              hint={`Hari ini ${formatRupiah(data.revenue.today)}`}
            />
            <StatCard
              title="Total pesanan"
              value={String(data.orders.total)}
              hint={`${data.orders.by_status['pending_payment'] ?? 0} menunggu pembayaran`}
            />
            <StatCard
              title="Produk"
              value={String(data.products.total)}
              hint={`${data.products.active} aktif · ${data.categories} kategori`}
            />
            <StatCard title="Pelanggan" value={String(data.customers)} hint="Akun terdaftar" />
          </div>

          {/* Perlu tindakan */}
          <Panel title="Perlu tindakan">
            {nothingToDo ? (
              <p className="text-sm text-gray-600">
                Tidak ada yang perlu ditindaklanjuti saat ini. 🎉
              </p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {waitingPayments > 0 && (
                  <li className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                    <span className="text-sm text-gray-800">
                      <strong>{waitingPayments}</strong> bukti pembayaran menunggu konfirmasi
                    </span>
                    <Link to="/admin/payments">
                      <Button size="sm">Periksa</Button>
                    </Link>
                  </li>
                )}
                {toProcess > 0 && (
                  <li className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                    <span className="text-sm text-gray-800">
                      <strong>{toProcess}</strong> pesanan sudah dibayar dan siap diproses
                    </span>
                    <Link to="/admin/orders">
                      <Button size="sm">Proses</Button>
                    </Link>
                  </li>
                )}
              </ul>
            )}
          </Panel>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Stok menipis */}
            <Panel
              title="Stok menipis"
              action={
                <Link to="/admin/products" className="text-sm text-primary-600 hover:underline">
                  Kelola produk
                </Link>
              }
            >
              {data.low_stock.length === 0 ? (
                <p className="text-sm text-gray-600">
                  Semua stok aman (batas peringatan: {data.low_stock_threshold}).
                </p>
              ) : (
                <>
                  <ul className="divide-y divide-gray-100">
                    {data.low_stock.map((item) => (
                      <li
                        key={`${item.product_id}-${item.sku}`}
                        className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {item.product_name}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {item.variant_name} · {item.sku}
                          </p>
                        </div>
                        {item.stock === 0 ? (
                          <Badge variant="danger">Habis</Badge>
                        ) : (
                          <Badge variant="warning">Sisa {item.stock}</Badge>
                        )}
                      </li>
                    ))}
                  </ul>
                  {data.low_stock_total > data.low_stock.length && (
                    <p className="text-xs text-gray-500 mt-3">
                      +{data.low_stock_total - data.low_stock.length} varian lain dengan stok
                      menipis
                    </p>
                  )}
                </>
              )}
            </Panel>

            {/* Pesanan terbaru */}
            <Panel
              title="Pesanan terbaru"
              action={
                <Link to="/admin/orders" className="text-sm text-primary-600 hover:underline">
                  Lihat semua
                </Link>
              }
            >
              {data.recent_orders.length === 0 ? (
                <p className="text-sm text-gray-600">Belum ada pesanan masuk.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {data.recent_orders.map((order) => (
                    <li
                      key={order.id}
                      className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {order.order_number}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {order.customer_name} · {formatDate(order.created_at)}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold text-gray-900">
                          {formatRupiah(order.total)}
                        </p>
                        <StatusBadge status={order.status} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          {/* Ringkasan status pesanan */}
          <Panel title="Pesanan menurut status">
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              {statusOrder.map((status) => (
                <div key={status} className="rounded border border-gray-200 px-3 py-2.5">
                  <p className="text-xl font-bold text-gray-900">
                    {data.orders.by_status[status] ?? 0}
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5">{statusInfo[status].label}</p>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}
    </>
  )
}