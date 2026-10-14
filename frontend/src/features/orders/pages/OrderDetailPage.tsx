import { Helmet } from 'react-helmet-async'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import { Button, Card, CardBody, CardHeader, Badge, Skeleton, ErrorState } from '@/components/ui'
import { formatRupiah, formatDate } from '@/lib/utils'

interface OrderTracking {
  status: string
  description: string
  location?: string
  timestamp: string
}

interface OrderDetail {
  id: string
  order_number: string
  total: number
  status: string
  items: Array<{ product_name: string; variant_name: string; quantity: number; price: number }>
  address: {
    recipient_name: string
    address: string
    city: string
  }
  shipping: {
    courier: string
    service: string
    resi_number?: string
  }
  tracking: OrderTracking[]
  created_at: string
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()

  const { data: order, isLoading, error } = useQuery({
    queryKey: ['order', id],
    queryFn: async () => {
      const response = await apiClient.get<{ data: OrderDetail }>(`/orders/${id}`)
      return response.data
    },
  })

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <ErrorState title="Pesanan Tidak Ditemukan" message="Pesanan yang Anda cari tidak tersedia." />
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (!order) return null

  return (
    <>
      <Helmet>
        <title>Detail Pesanan - Toko Online</title>
      </Helmet>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Detail Pesanan</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Order Info */}
            <Card>
              <CardHeader>Informasi Pesanan</CardHeader>
              <CardBody>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Nomor Pesanan</p>
                    <p className="font-bold">{order.order_number}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Status</p>
                    <Badge variant={order.status === 'pending_payment' ? 'pending' : 'processing'} className="mt-1">
                      {order.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Tanggal Pesanan</p>
                    <p className="font-medium">{formatDate(order.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total</p>
                    <p className="font-bold text-lg text-primary-600">{formatRupiah(order.total)}</p>
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Items */}
            <Card>
              <CardHeader>Item Pesanan</CardHeader>
              <CardBody>
                <div className="space-y-3">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between py-2 border-b border-gray-100 last:border-0">
                      <div>
                        <p className="font-medium">{item.product_name}</p>
                        <p className="text-sm text-gray-600">{item.variant_name}</p>
                        <p className="text-sm text-gray-500">Qty: {item.quantity}x</p>
                      </div>
                      <p className="font-bold">{formatRupiah(item.price * item.quantity)}</p>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>

            {/* Address */}
            <Card>
              <CardHeader>Alamat Pengiriman</CardHeader>
              <CardBody>
                <p className="font-medium">{order.address.recipient_name}</p>
                <p className="text-gray-700">{order.address.address}</p>
                <p className="text-gray-600">{order.address.city}</p>
              </CardBody>
            </Card>

            {/* Shipping */}
            <Card>
              <CardHeader>Informasi Pengiriman</CardHeader>
              <CardBody>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-600">Kurir</p>
                    <p className="font-medium">
                      {order.shipping.courier} - {order.shipping.service}
                    </p>
                  </div>
                  {order.shipping.resi_number && (
                    <div>
                      <p className="text-sm text-gray-600">Nomor Resi</p>
                      <div className="flex justify-between items-center mt-1">
                        <p className="font-mono font-bold">{order.shipping.resi_number}</p>
                        <Button size="sm" variant="ghost">
                          Salin
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </CardBody>
            </Card>

            {/* Tracking */}
            {order.tracking.length > 0 && (
              <Card>
                <CardHeader>Tracking Pengiriman</CardHeader>
                <CardBody>
                  <div className="space-y-4">
                    {order.tracking.map((track, idx) => (
                      <div key={idx} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className="w-4 h-4 bg-primary-600 rounded-full"></div>
                          {idx < order.tracking.length - 1 && (
                            <div className="w-1 h-12 bg-gray-300 my-2"></div>
                          )}
                        </div>
                        <div>
                          <p className="font-medium">{track.description}</p>
                          {track.location && (
                            <p className="text-sm text-gray-600">{track.location}</p>
                          )}
                          <p className="text-xs text-gray-500">{formatDate(track.timestamp, true)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24">
              <CardHeader>Ringkasan</CardHeader>
              <CardBody>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status</span>
                    <Badge>{order.status}</Badge>
                  </div>
                  <div className="border-t border-gray-200 pt-3">
                    <p className="text-2xl font-bold text-primary-600">{formatRupiah(order.total)}</p>
                  </div>
                  {order.status === 'pending_payment' && (
                    <Button variant="primary" fullWidth>
                      Bayar Sekarang
                    </Button>
                  )}
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    </>
  )
}
