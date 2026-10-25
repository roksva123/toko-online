import { useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import { useCart } from '@/contexts/CartContext'
import { Button, Card, CardBody, Badge, Skeleton, EmptyState } from '@/components/ui'
import { formatRupiah } from '@/lib/utils'
import { AddressFormModal } from '@/features/account/components/AddressFormModal'
import { addressKeys, fetchAddresses, parseApiError } from '@/lib/api/addresses'

interface ShippingRate {
  courier: string
  service: string
  rate: number
  etd: string
}

const DUMMY_SHIPPING_RATES: ShippingRate[] = [
  { courier: 'Toko Online', service: 'Reguler', rate: 15000, etd: '2-4 hari' },
  { courier: 'Toko Online', service: 'Express', rate: 30000, etd: '1-2 hari' },
]

type Step = 'address' | 'summary'

const MAX_ADDRESSES = 10

export default function CheckoutPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { items, subtotal, clearCart } = useCart()
  const [currentStep, setCurrentStep] = useState<Step>('address')
  const [selectedAddressId, setSelectedAddressId] = useState<string>('')
  const [selectedShipping, setSelectedShipping] = useState<ShippingRate | null>(null)
  const [notes, setNotes] = useState('')
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false)

  // Alamat milik user dari database
  const { data: addressesData, isLoading: addressesLoading } = useQuery({
    queryKey: addressKeys.all,
    queryFn: fetchAddresses,
  })

  const addresses = addressesData ?? []
  const selectedAddress = addresses.find((a) => a.id === selectedAddressId)

  // Pilih alamat utama (atau alamat pertama) secara otomatis, dan pilih ulang
  // jika alamat yang terpilih sudah tidak ada (mis. dihapus di tab lain)
  useEffect(() => {
    if (!addressesData || addressesData.length === 0) return
    if (selectedAddressId && addressesData.some((a) => a.id === selectedAddressId)) return
    const preferred = addressesData.find((a) => a.is_default) ?? addressesData[0]
    setSelectedAddressId(preferred.id)
  }, [addressesData, selectedAddressId])

  // Sementara memakai tarif dummy agar checkout tetap bisa digunakan tanpa API kurir.
  // Ongkir dihitung dari berat barang dan dibulatkan ke kelipatan Rp5.000.
  const totalWeight = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity * 1000, 0),
    [items]
  )
  const shippingRates = useMemo(
    () =>
      DUMMY_SHIPPING_RATES.map((rate) => ({
        ...rate,
        rate: rate.rate + Math.max(0, Math.ceil((totalWeight - 1000) / 1000)) * 5000,
      })),
    [totalWeight]
  )

  useEffect(() => {
    setSelectedShipping(shippingRates[0])
  }, [shippingRates])

  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post<{ id: string }>('/orders', {
        address_id: selectedAddressId,
        courier: selectedShipping?.courier,
        service: selectedShipping?.service,
        shipping_cost: selectedShipping?.rate ?? 0,
        notes,
        items: items.map((item) => ({ variant_id: item.variant_id, quantity: item.quantity })),
      })
      return response.data
    },
    onSuccess: (order) => {
      clearCart()
      navigate(`/orders/${order.id}/payment`)
    },
  })

  if (items.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <EmptyState
          icon="🛒"
          title="Keranjang Kosong"
          description="Tidak ada produk untuk di-checkout."
          action={<Button variant="primary" onClick={() => navigate('/products')}>Lanjut Belanja</Button>}
        />
      </div>
    )
  }

  const shippingCost = selectedShipping?.rate ?? 0
  const total = subtotal + shippingCost
  const atAddressLimit = addresses.length >= MAX_ADDRESSES

  return (
    <>
      <Helmet>
        <title>Checkout - Toko Online</title>
      </Helmet>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Checkout</h1>

        {/* Stepper */}
        <div className="mb-8 flex gap-4">
          {(['address', 'summary'] as const).map((step, idx) => (
            <div key={step} className="flex items-center">
              <button
                onClick={() => {
                  if (step === 'address' || (step === 'summary' && selectedAddressId)) {
                    setCurrentStep(step)
                  }
                }}
                className={`w-10 h-10 rounded-full font-bold flex items-center justify-center transition-colors ${
                  currentStep === step
                    ? 'bg-primary-600 text-white'
                    : step === 'address' || (step === 'summary' && selectedAddressId)
                    ? 'bg-primary-100 text-primary-600 cursor-pointer'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {idx + 1}
              </button>
              <div className="text-sm font-medium ml-2">
                {step === 'address' && 'Alamat'}
                {step === 'summary' && 'Ringkasan & Pembayaran'}
              </div>
              {idx < 2 && <div className="flex-1 h-1 bg-gray-200 mx-2" />}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Step 1: Address */}
            {currentStep === 'address' && (
              <Card>
                <CardBody>
                  <h2 className="text-xl font-bold mb-4">Pilih Alamat Pengiriman</h2>

                  {addressesLoading ? (
                    <Skeleton className="h-24" />
                  ) : addresses.length === 0 ? (
                    <EmptyState
                      icon="📍"
                      title="Belum Ada Alamat"
                      description="Tambahkan alamat pengiriman terlebih dahulu."
                      action={
                        <Button size="sm" variant="primary" onClick={() => setIsAddressModalOpen(true)}>
                          Tambah Alamat
                        </Button>
                      }
                    />
                  ) : (
                    <div className="space-y-3 mb-4">
                      {addresses.map((addr) => (
                        <button
                          key={addr.id}
                          onClick={() => setSelectedAddressId(addr.id)}
                          className={`w-full text-left p-4 border rounded-lg transition-colors ${
                            selectedAddressId === addr.id
                              ? 'border-primary-600 bg-primary-50'
                              : 'border-gray-300 hover:border-primary-600'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="font-semibold">{addr.recipient_name}</p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">{addr.phone}</p>
                            </div>
                            <div className="flex gap-1.5">
                              <Badge variant="default">{addr.label}</Badge>
                              {addr.is_default && <Badge variant="info">Utama</Badge>}
                            </div>
                          </div>
                          <p className="text-sm text-gray-700 dark:text-gray-300">{addr.address}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {addr.district}, {addr.city}, {addr.province} {addr.postal_code}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}

                  {addresses.length > 0 && (
                    <Button
                      variant="secondary"
                      fullWidth
                      disabled={atAddressLimit}
                      onClick={() => setIsAddressModalOpen(true)}
                    >
                      {atAddressLimit ? `Batas ${MAX_ADDRESSES} alamat tercapai` : '+ Tambah Alamat Baru'}
                    </Button>
                  )}

                  {selectedAddressId && (
                    <Button
                      variant="primary"
                      fullWidth
                      className="mt-4"
                      onClick={() => setCurrentStep('summary')}
                    >
                      Lanjut ke Pembayaran
                    </Button>
                  )}
                </CardBody>
              </Card>
            )}

            {/* Step 3: Summary */}
            {currentStep === 'summary' && (
              <div className="space-y-4">
                <Card>
                  <CardBody>
                    <h2 className="text-xl font-bold mb-4">Ringkasan Pesanan</h2>
                    <div className="space-y-3 mb-4 pb-4 border-b border-gray-200">
                      {items.map((item) => (
                        <div key={`${item.product_id}-${item.variant_id}`} className="flex justify-between">
                          <div>
                            <p className="font-medium">{item.product_name}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{item.variant_name} x {item.quantity}</p>
                          </div>
                          <p className="font-semibold">{formatRupiah(item.price * item.quantity)}</p>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2 mb-4 pb-4 border-b border-gray-200">
                      <div className="flex justify-between">
                        <span>Subtotal</span>
                        <span>{formatRupiah(subtotal)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Ongkir</span>
                        <span>{formatRupiah(shippingCost)}</span>
                      </div>
                    </div>
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total</span>
                      <span>{formatRupiah(total)}</span>
                    </div>
                  </CardBody>
                </Card>

                <Card>
                  <CardBody>
                    <h3 className="font-bold mb-2">Alamat Pengiriman</h3>
                    {selectedAddress && (
                      <div className="text-sm text-gray-700 dark:text-gray-300">
                        <p>{selectedAddress.recipient_name} ({selectedAddress.phone})</p>
                        <p>{selectedAddress.address}</p>
                        <p>
                          {selectedAddress.district}, {selectedAddress.city}, {selectedAddress.province}{' '}
                          {selectedAddress.postal_code}
                        </p>
                      </div>
                    )}
                  </CardBody>
                </Card>

                <Card>
                  <CardBody>
                    <h3 className="font-bold mb-3">Catatan (Opsional)</h3>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Catatan untuk penjual..."
                      className="w-full p-3 border border-gray-300 rounded text-sm bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400"
                      rows={3}
                    />
                  </CardBody>
                </Card>

                {createOrderMutation.isError && (
                  <div
                    role="alert"
                    className="rounded border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
                  >
                    {parseApiError(createOrderMutation.error).message}
                  </div>
                )}

                <div className="flex gap-3">
                  <Button variant="secondary" fullWidth onClick={() => setCurrentStep('address')}>
                    Kembali
                  </Button>
                  <Button
                    variant="primary"
                    fullWidth
                    isLoading={createOrderMutation.isPending}
                    onClick={() => createOrderMutation.mutate()}
                  >
                    Lanjut ke Pembayaran
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Order Summary Sidebar */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24">
              <CardBody>
                <h3 className="font-bold text-lg mb-4">Ringkasan</h3>
                <div className="space-y-2 mb-4 pb-4 border-b border-gray-200">
                  <div className="flex justify-between text-sm">
                    <span>{items.length} produk</span>
                    <span>{formatRupiah(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Ongkir</span>
                    <span>{formatRupiah(shippingCost)}</span>
                  </div>
                </div>
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span>{formatRupiah(total)}</span>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      </div>

      {/* Tambah alamat: langsung tersimpan ke database lalu otomatis terpilih */}
      <AddressFormModal
        isOpen={isAddressModalOpen}
        onClose={() => setIsAddressModalOpen(false)}
        address={null}
        isFirstAddress={addresses.length === 0}
        onSaved={() => {
          void queryClient.invalidateQueries({ queryKey: addressKeys.all })
        }}
      />
    </>
  )
}