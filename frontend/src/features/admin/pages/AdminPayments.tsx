import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Badge, Button, Card, CardBody, ErrorState, Input, Skeleton } from '@/components/ui'
import {
  adminKeys,
  confirmPayment,
  fetchPayments,
  formatRupiah,
  parseApiError,
  rejectPayment,
} from '@/lib/api/admin'

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })

const apiOrigin = (import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1').replace(
  /\/api\/v1\/?$/,
  ''
)

const assetURL = (path: string) => `${apiOrigin}${path}`

export default function AdminPayments() {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<'waiting_confirmation' | 'paid' | 'rejected'>('waiting_confirmation')
  const [rejectingID, setRejectingID] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  const paymentsQuery = useQuery({
    queryKey: [...adminKeys.payments, status],
    queryFn: () => fetchPayments(status),
  })

  const confirmMutation = useMutation({
    mutationFn: confirmPayment,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminKeys.payments })
      await queryClient.invalidateQueries({ queryKey: [...adminKeys.all, 'dashboard'] })
    },
    onError: (err) => setError(parseApiError(err).message),
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, message }: { id: string; message: string }) => rejectPayment(id, message),
    onSuccess: async () => {
      setRejectingID(null)
      setReason('')
      await queryClient.invalidateQueries({ queryKey: adminKeys.payments })
      await queryClient.invalidateQueries({ queryKey: [...adminKeys.all, 'dashboard'] })
    },
    onError: (err) => setError(parseApiError(err).message),
  })

  const payments = paymentsQuery.data ?? []

  return (
    <>
      <Helmet><title>Pembayaran - Admin Toko Online</title></Helmet>
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Konfirmasi Pembayaran</h1>
          <p className="text-sm text-gray-600 mt-1">Periksa bukti transfer sebelum pesanan diproses.</p>
        </div>
        <Button variant="secondary" onClick={() => void paymentsQuery.refetch()} isLoading={paymentsQuery.isFetching}>
          Muat ulang
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {[
          ['waiting_confirmation', 'Menunggu konfirmasi'],
          ['paid', 'Sudah dikonfirmasi'],
          ['rejected', 'Ditolak'],
        ].map(([value, label]) => (
          <Button
            key={value}
            size="sm"
            variant={status === value ? 'primary' : 'secondary'}
            onClick={() => { setStatus(value as typeof status); setError('') }}
          >
            {label}
          </Button>
        ))}
      </div>

      {error && <p role="alert" className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {paymentsQuery.isLoading && <Skeleton className="h-48 w-full" count={3} />}
      {paymentsQuery.isError && (
        <ErrorState
          title="Pembayaran gagal dimuat"
          message={parseApiError(paymentsQuery.error).message}
          action={<Button onClick={() => void paymentsQuery.refetch()}>Coba lagi</Button>}
        />
      )}

      {!paymentsQuery.isLoading && !paymentsQuery.isError && (
        <div className="space-y-4">
          {payments.length === 0 && (
            <Card><CardBody><p className="text-sm text-gray-600">Belum ada pembayaran pada status ini.</p></CardBody></Card>
          )}
          {payments.map((payment) => (
            <Card key={payment.id}>
              <CardBody>
                <div className="flex flex-col lg:flex-row gap-5">
                  <div className="lg:w-64 shrink-0">
                    {payment.proof_image_url ? (
                      <a href={assetURL(payment.proof_image_url)} target="_blank" rel="noreferrer">
                        <img src={assetURL(payment.proof_image_url)} alt={`Bukti ${payment.order_number}`} className="w-full max-h-64 object-contain rounded border bg-gray-50" />
                      </a>
                    ) : (
                      <div className="h-40 rounded border bg-gray-50 flex items-center justify-center text-sm text-gray-500">Tidak ada bukti</div>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-gray-900">{payment.order_number}</p>
                        <p className="text-sm text-gray-600">{payment.customer_name} · {payment.customer_email}</p>
                      </div>
                      <Badge variant={payment.status === 'paid' ? 'success' : payment.status === 'rejected' ? 'danger' : 'warning'}>
                        {payment.status === 'waiting_confirmation' ? 'Menunggu konfirmasi' : payment.status === 'paid' ? 'Dibayar' : 'Ditolak'}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                      <div><p className="text-gray-500">Nominal transfer</p><p className="font-semibold">{formatRupiah(payment.amount_due)}</p></div>
                      <div><p className="text-gray-500">Nama pengirim</p><p className="font-semibold">{payment.sender_name || '-'}</p></div>
                      <div><p className="text-gray-500">Diupload</p><p className="font-semibold">{formatDate(payment.created_at)}</p></div>
                    </div>
                    {payment.rejection_reason && <p className="text-sm text-red-700">Alasan: {payment.rejection_reason}</p>}
                    {payment.status === 'waiting_confirmation' && (
                      <div className="flex flex-wrap gap-2 pt-2">
                        <Button size="sm" onClick={() => { setError(''); confirmMutation.mutate(payment.id) }} isLoading={confirmMutation.isPending}>Konfirmasi pembayaran</Button>
                        <Button size="sm" variant="danger" onClick={() => { setRejectingID(payment.id); setReason(''); setError('') }}>Tolak</Button>
                      </div>
                    )}
                    {rejectingID === payment.id && (
                      <div className="flex flex-col sm:flex-row gap-2 pt-2">
                        <Input label="Alasan penolakan" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Contoh: nominal tidak sesuai" />
                        <Button size="sm" variant="danger" disabled={!reason.trim()} onClick={() => rejectMutation.mutate({ id: payment.id, message: reason.trim() })} isLoading={rejectMutation.isPending}>Kirim penolakan</Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
