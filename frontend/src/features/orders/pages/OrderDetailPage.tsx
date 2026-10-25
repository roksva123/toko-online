import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import { Button, Card, CardBody, CardHeader, Badge, Skeleton, ErrorState } from '@/components/ui'
import { formatRupiah, formatDate } from '@/lib/utils'
import { createProductReview } from '@/lib/api/reviews'

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
  items?: Array<{ id: string; product_id: string; product_name: string; variant_name: string; quantity: number; price: number; reviewed: boolean }>
  address?: {
    recipient_name: string
    address: string
    city: string
  }
  shipping?: {
    courier: string
    service: string
    resi_number?: string
  }
  tracking?: OrderTracking[]
  created_at: string
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [reviewItemID, setReviewItemID] = useState<string | null>(null)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewMessage, setReviewMessage] = useState('')

  const reviewMutation = useMutation({
    mutationFn: ({ productID, orderItemID }: { productID: string; orderItemID: string }) =>
      createProductReview(productID, {
        order_item_id: orderItemID,
        rating: reviewRating,
        comment: reviewComment,
      }),
    onSuccess: async () => {
      setReviewItemID(null)
      setReviewComment('')
      setReviewRating(5)
      setReviewMessage('Penilaian berhasil dikirim.')
      await queryClient.invalidateQueries({ queryKey: ['order', id] })
    },
    onError: () => setReviewMessage('Penilaian gagal dikirim. Pastikan pesanan sudah diterima.'),
  })

  const { data: order, isLoading, error } = useQuery({
    queryKey: ['order', id],
    queryFn: async () => {
      const response = await apiClient.get<OrderDetail>(`/orders/${id}`)
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
        {reviewMessage && <p role="status" className="mb-4 rounded bg-green-50 px-3 py-2 text-sm text-green-800">{reviewMessage}</p>}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Order Info */}
            <Card>
              <CardHeader>Informasi Pesanan</CardHeader>
              <CardBody>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Nomor Pesanan</p>
                    <p className="font-bold">{order.order_number}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Status</p>
                    <Badge variant={order.status === 'pending_payment' ? 'pending' : 'processing'} className="mt-1">
                      {order.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Tanggal Pesanan</p>
                    <p className="font-medium">{formatDate(order.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total</p>
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
                  {(order.items ?? []).map((item) => (
                    <div key={item.id} className="py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                      <div className="flex justify-between gap-3">
                        <div>
                          <p className="font-medium">{item.product_name}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{item.variant_name}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Qty: {item.quantity}x</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">{formatRupiah(item.price * item.quantity)}</p>
                          {order.status === 'delivered' && !item.reviewed && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="mt-2"
                              onClick={() => {
                                setReviewItemID(reviewItemID === item.id ? null : item.id)
                                setReviewMessage('')
                              }}
                            >
                              Nilai produk
                            </Button>
                          )}
                        </div>
                      </div>
                      {reviewItemID === item.id && (
                        <div className="mt-3 rounded border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800 p-3">
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Bagaimana penilaianmu?</p>
                          <div className="flex gap-1 mb-3" aria-label="Pilih rating">
                            {[1, 2, 3, 4, 5].map((rating) => (
                              <button
                                key={rating}
                                type="button"
                                onClick={() => setReviewRating(rating)}
                                aria-label={`${rating} bintang`}
                                className={`text-2xl ${rating <= reviewRating ? 'text-amber-500' : 'text-gray-300'}`}
                              >
                                ★
                              </button>
                            ))}
                          </div>
                          <textarea
                            value={reviewComment}
                            onChange={(event) => setReviewComment(event.target.value)}
                            maxLength={1000}
                            rows={3}
                            placeholder="Tulis pengalamanmu (opsional)"
                            className="w-full rounded border border-gray-300 bg-white text-gray-900 placeholder-gray-400 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-400 p-2 text-sm"
                          />
                          <Button
                            size="sm"
                            className="mt-2"
                            isLoading={reviewMutation.isPending}
                            onClick={() => reviewMutation.mutate({ productID: item.product_id, orderItemID: item.id })}
                          >
                            Kirim penilaian
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>

            {/* Address */}
            <Card>
              <CardHeader>Alamat Pengiriman</CardHeader>
              <CardBody>
                <p className="font-medium">{order.address?.recipient_name ?? '-'}</p>
                <p className="text-gray-700 dark:text-gray-300">{order.address?.address ?? '-'}</p>
                <p className="text-gray-600">{order.address?.city ?? '-'}</p>
              </CardBody>
            </Card>

            {/* Shipping */}
            <Card>
              <CardHeader>Informasi Pengiriman</CardHeader>
              <CardBody>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Kurir</p>
                    <p className="font-medium">
                      {order.shipping?.courier ?? '-'} - {order.shipping?.service ?? '-'}
                    </p>
                  </div>
                  {order.shipping?.resi_number && (
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Nomor Resi</p>
                      <div className="flex justify-between items-center mt-1">
                        <p className="font-mono font-bold">{order.shipping?.resi_number}</p>
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
            {(order.tracking ?? []).length > 0 && (
              <Card>
                <CardHeader>Tracking Pengiriman</CardHeader>
                <CardBody>
                  <div className="space-y-4">
                    {(order.tracking ?? []).map((track, idx) => (
                      <div key={idx} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className="w-4 h-4 bg-primary-600 rounded-full"></div>
                          {idx < (order.tracking ?? []).length - 1 && (
                            <div className="w-1 h-12 bg-gray-300 my-2"></div>
                          )}
                        </div>
                        <div>
                          <p className="font-medium">{track.description}</p>
                          {track.location && (
                            <p className="text-sm text-gray-600 dark:text-gray-400">{track.location}</p>
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
                    <Link to={`/orders/${order.id}/payment`}>
                      <Button variant="primary" fullWidth>
                        Bayar Sekarang
                      </Button>
                    </Link>
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
