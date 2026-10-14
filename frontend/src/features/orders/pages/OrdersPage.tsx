import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import { Button, Card, CardBody, Badge, Tabs, Skeleton, EmptyState, Pagination } from '@/components/ui'
import { formatRupiah, formatDate } from '@/lib/utils'

interface Order {
  id: string
  order_number: string
  total: number
  status: 'pending_payment' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
  created_at: string
  items: Array<{ product_name: string; quantity: number }>
}

interface OrdersResponse {
  data: Order[]
  meta: {
    page: number
    limit: number
    total: number
  }
}

export default function OrdersPage() {
  const [status, setStatus] = useState<string>('all')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['orders', { status, page }],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (status !== 'all') params.set('status', status)
      params.set('page', page.toString())
      params.set('limit', '10')

      const response = await apiClient.get<OrdersResponse>(`/orders?${params.toString()}`)
      return response.data
    },
  })

  const tabs = [
    { id: 'all', label: 'Semua' },
    { id: 'pending_payment', label: 'Menunggu Bayar' },
    { id: 'processing', label: 'Diproses' },
    { id: 'shipped', label: 'Dikirim' },
    { id: 'delivered', label: 'Tiba' },
    { id: 'cancelled', label: 'Dibatalkan' },
  ]

  const statusColors: Record<string, 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'> = {
    pending_payment: 'pending',
    processing: 'processing',
    shipped: 'shipped',
    delivered: 'delivered',
    cancelled: 'cancelled',
  }

  return (
    <>
      <Helmet>
        <title>Pesanan Saya - Toko Online</title>
      </Helmet>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Pesanan Saya</h1>

        {/* Tabs */}
        <div className="mb-6">
          <Tabs
            tabs={tabs.map((tab) => ({
              id: tab.id,
              label: tab.label,
              content: <div /> // Content handled by active state
            }))}
            defaultTab={status}
            onChange={setStatus}
          />
        </div>

        {/* Orders List */}
        <div className="space-y-4">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))
          ) : data && data.data.length > 0 ? (
            <>
              {data.data.map((order) => (
                <Link key={order.id} to={`/orders/${order.id}`}>
                  <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                    <CardBody>
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="text-sm text-gray-600">Nomor Pesanan</p>
                          <p className="font-bold">{order.order_number}</p>
                        </div>
                        <Badge variant={statusColors[order.status] || 'default'}>
                          {order.status === 'pending_payment' && 'Menunggu Pembayaran'}
                          {order.status === 'processing' && 'Diproses'}
                          {order.status === 'shipped' && 'Dikirim'}
                          {order.status === 'delivered' && 'Tiba'}
                          {order.status === 'cancelled' && 'Dibatalkan'}
                        </Badge>
                      </div>

                      <div className="flex justify-between items-end">
                        <div>
                          <p className="text-sm text-gray-600 mb-2">
                            {order.items.map((item) => `${item.product_name} (${item.quantity})`).join(', ')}
                          </p>
                          <p className="text-xs text-gray-500">{formatDate(order.created_at)}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-primary-600">{formatRupiah(order.total)}</p>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                </Link>
              ))}

              {/* Pagination */}
              {data.meta.total > data.meta.limit && (
                <div className="mt-6">
                  <Pagination
                    currentPage={page}
                    totalPages={Math.ceil(data.meta.total / data.meta.limit)}
                    onPageChange={setPage}
                  />
                </div>
              )}
            </>
          ) : (
            <EmptyState
              icon="📦"
              title="Belum Ada Pesanan"
              description="Anda belum membuat pesanan apapun."
              action={<Link to="/products"><Button variant="primary">Belanja Sekarang</Button></Link>}
            />
          )}
        </div>
      </div>
    </>
  )
}
