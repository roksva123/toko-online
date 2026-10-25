import { useState, useEffect } from 'react'
import { Helmet } from 'react-helmet-async'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import { Button, Card, CardBody, Badge, Input, Skeleton, ErrorState } from '@/components/ui'
import { formatRupiah } from '@/lib/utils'

interface OrderPayment {
  id: string
  status: 'pending' | 'waiting_confirmation' | 'paid' | 'rejected' | 'expired'
  amount_due: number
  proof_image_url?: string
  sender_name?: string
  rejection_reason?: string
  expires_at: string
  created_at: string
}

interface Order {
  id: string
  order_number: string
  total: number
  payment: OrderPayment
}

export default function PaymentPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [senderName, setSenderName] = useState('')
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [timeLeft, setTimeLeft] = useState<number | null>(null)

  const { data: order, isLoading, error } = useQuery({
    queryKey: ['order', id],
    queryFn: async () => {
      const response = await apiClient.get<Order>(`/orders/${id}`)
      return response.data
    },
  })

  const uploadProofMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData()
      if (proofFile) formData.append('proof', proofFile)
      formData.append('sender_name', senderName)

      const response = await apiClient.post(`/orders/${id}/payment/proof`, formData)
      return response.data
    },
    onSuccess: () => {
      setSenderName('')
      setProofFile(null)
      void queryClient.invalidateQueries({ queryKey: ['order', id] })
    },
  })

  // Countdown timer
  useEffect(() => {
    if (!order?.payment?.expires_at) return

    const timer = setInterval(() => {
      const expiresAt = new Date(order.payment.expires_at).getTime()
      const now = Date.now()
      const diff = Math.max(0, expiresAt - now)

      setTimeLeft(diff)

      if (diff === 0) {
        clearInterval(timer)
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [order?.payment?.expires_at])

  const formatTime = (ms: number | null) => {
    if (ms === null) return 'Menghitung waktu...'
    const hours = Math.floor(ms / (1000 * 60 * 60))
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((ms % (1000 * 60)) / 1000)
    return `${hours}j ${minutes}m ${seconds}s`
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <ErrorState title="Pesanan Tidak Ditemukan" message="Pesanan yang Anda cari tidak tersedia." />
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (!order) return null

  const paymentStatus = order.payment?.status ?? 'pending'
  const isExpired = paymentStatus === 'expired' || (paymentStatus === 'pending' && timeLeft === 0)
  const isPaid = paymentStatus === 'paid'
  const isWaitingConfirmation = paymentStatus === 'waiting_confirmation'
  const isRejected = paymentStatus === 'rejected'

  return (
    <>
      <Helmet>
        <title>Instruksi Pembayaran - Toko Online</title>
      </Helmet>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Instruksi Pembayaran</h1>

        {/* Status */}
        <Card className="mb-6 border-l-4 border-l-yellow-500">
          <CardBody>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-600">Nomor Pesanan</p>
                <p className="font-bold text-lg">{order.order_number}</p>
              </div>
              <Badge variant={isPaid ? 'success' : isExpired ? 'danger' : 'warning'}>
                {isPaid && 'Terbayar'}
                {isExpired && 'Kadaluarsa'}
                {isWaitingConfirmation && 'Menunggu Konfirmasi'}
                {isRejected && 'Bukti Ditolak'}
                {!isPaid && !isExpired && !isWaitingConfirmation && !isRejected && 'Menunggu Pembayaran'}
              </Badge>
            </div>
          </CardBody>
        </Card>

        {isExpired && (
          <Card className="mb-6 border-l-4 border-l-red-500">
            <CardBody>
              <p className="text-red-700 font-medium">
                ⚠️ Waktu pembayaran telah habis. Silakan hubungi customer service.
              </p>
            </CardBody>
          </Card>
        )}

        {isPaid && (
          <Card className="mb-6 border-l-4 border-l-green-500">
            <CardBody>
              <p className="text-green-700 font-medium">✓ Pembayaran telah dikonfirmasi</p>
            </CardBody>
          </Card>
        )}

        {isWaitingConfirmation && (
          <Card className="mb-6 border-l-4 border-l-blue-500">
            <CardBody>
              <p className="text-blue-700 font-medium">✓ Bukti pembayaran sudah diunggah dan sedang diperiksa admin.</p>
              {order.payment.sender_name && (
                <p className="text-sm text-blue-600 mt-2">Nama pengirim: {order.payment.sender_name}</p>
              )}
            </CardBody>
          </Card>
        )}

        {isRejected && (
          <Card className="mb-6 border-l-4 border-l-orange-500">
            <CardBody>
              <p className="text-orange-700 font-medium">
                ⚠️ Pembayaran Anda ditolak: {order.payment?.rejection_reason}
              </p>
              <p className="text-sm text-orange-600 mt-2">Silakan upload bukti pembayaran kembali.</p>
            </CardBody>
          </Card>
        )}

        {!isPaid && !isWaitingConfirmation && !isExpired && (
          <>
            {/* Countdown */}
            <Card className="mb-6 bg-blue-50 border-blue-200">
              <CardBody>
                <p className="text-sm text-gray-600 mb-2">Waktu pembayaran</p>
                <p className="text-3xl font-bold text-blue-600">{formatTime(timeLeft)}</p>
              </CardBody>
            </Card>

            {/* Payment Amount */}
            <Card className="mb-6">
              <CardBody>
                <p className="text-sm text-gray-600 mb-2">Nominal yang harus ditransfer</p>
                <p className="text-4xl font-bold text-primary-600 mb-1">{formatRupiah(order.payment.amount_due)}</p>
                <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mt-3">
                  <p className="text-sm text-yellow-800">
                    ⚠️ Transfer <strong>TEPAT</strong> sesuai nominal di atas, termasuk kode unik di akhir
                  </p>
                </div>
              </CardBody>
            </Card>

            {/* Bank Details */}
            <Card className="mb-6">
              <CardBody>
                <h3 className="font-bold mb-4">Rekening Tujuan Transfer</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-600">Bank</p>
                    <div className="flex justify-between items-center mt-1">
                      <p className="font-semibold">BCA</p>
                      <Button size="sm" variant="ghost">
                        Salin
                      </Button>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Nomor Rekening</p>
                    <div className="flex justify-between items-center mt-1">
                      <p className="font-semibold font-mono">1234567890</p>
                      <Button size="sm" variant="ghost">
                        Salin
                      </Button>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Atas Nama</p>
                    <p className="font-semibold mt-1">PT Toko Online Indonesia</p>
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Upload Proof */}
            <Card>
              <CardBody>
                <h3 className="font-bold mb-4">Upload Bukti Pembayaran</h3>

                <div className="mb-4">
                  <Input
                    label="Nama Pengirim"
                    placeholder="Nama Anda"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload Bukti Transfer
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                      className="hidden"
                      id="proof-file"
                    />
                    <label htmlFor="proof-file" className="cursor-pointer">
                      <p className="text-gray-600">
                        {proofFile ? `✓ ${proofFile.name}` : 'Klik untuk pilih file atau drag & drop'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">JPG, PNG (max 5MB)</p>
                    </label>
                  </div>
                </div>

                <Button
                  variant="primary"
                  fullWidth
                  isLoading={uploadProofMutation.isPending}
                  disabled={!senderName || !proofFile}
                  onClick={() => uploadProofMutation.mutate()}
                >
                  Upload Bukti Pembayaran
                </Button>

                {uploadProofMutation.isError && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded">
                    <p className="text-sm text-red-700">
                      {apiClient.handleError(uploadProofMutation.error).message}
                    </p>
                  </div>
                )}

                {uploadProofMutation.isSuccess && (
                  <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded">
                    <p className="text-sm text-green-700">
                      ✓ Bukti pembayaran berhasil diunggah. Menunggu konfirmasi admin.
                    </p>
                  </div>
                )}
              </CardBody>
            </Card>
          </>
        )}
      </div>
    </>
  )
}
