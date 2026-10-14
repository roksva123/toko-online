import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import { useCart } from '@/contexts/CartContext'
import { Button, Card, CardBody, Badge, Skeleton, Modal, Input, Select, EmptyState, ErrorState } from '@/components/ui'
import { formatRupiah } from '@/lib/utils'

interface Address {
  id: string
  recipient_name: string
  phone: string
  address: string
  district: string
  city: string
  province: string
  postal_code: string
  is_default: boolean
}

interface ShippingRate {
  courier: string
  service: string
  rate: number
  etd: string
}

type Step = 'address' | 'shipping' | 'summary'

export default function CheckoutPage() {
  const navigate = useNavigate()
  const { items, subtotal, clearCart } = useCart()
  const [currentStep, setCurrentStep] = useState<Step>('address')
  const [selectedAddressId, setSelectedAddressId] = useState<string>('')
  const [selectedShipping, setSelectedShipping] = useState<{ courier: string; service: string } | null>(null)
  const [notes, setNotes] = useState('')
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false)

  // Fetch addresses
  const { data: addressesData, isLoading: addressesLoading } = useQuery({
    queryKey: ['addresses'],
    queryFn: async () => {
      const response = await apiClient.get<{ data: Address[] }>('/addresses')
      return response.data
    },
  })

  const addresses = addressesData?.data || []
  const selectedAddress = addresses.find((a) => a.id === selectedAddressId)

  // Fetch shipping rates
  const { data: shippingRates, isLoading: shippingLoading } = useQuery({
    queryKey: ['shipping-rates', selectedAddressId],
    queryFn: async () => {
      if (!selectedAddressId) return null
      const response = await apiClient.post<{ data: ShippingRate[] }>('/shipping/rates', {
        destination_city_id: '123', // TODO: Get from address
        weight: 1000, // TODO: Calculate from products
      })
      return response.data
    },
    enabled: currentStep === 'shipping' && !!selectedAddressId,
  })

  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post('/orders', {
        address_id: selectedAddressId,
        courier: selectedShipping?.courier,
        service: selectedShipping?.service,
        notes,
      })
      return response.data
    },
    onSuccess: (data: any) => {
      clearCart()
      navigate(`/orders/${data.data.id}/payment`)
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

  const shippingCost = 0 // TODO: Calculate from selected shipping
  const total = subtotal + shippingCost

  return (
    <>
      <Helmet>
        <title>Checkout - Toko Online</title>
      </Helmet>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Checkout</h1>

        {/* Stepper */}
        <div className="mb-8 flex gap-4">
          {(['address', 'shipping', 'summary'] as const).map((step, idx) => (
            <div key={step} className="flex items-center">
              <button
                onClick={() => {
                  if (step === 'address' || (step === 'shipping' && selectedAddressId)) {
                    setCurrentStep(step)
                  }
                }}
                className={`w-10 h-10 rounded-full font-bold flex items-center justify-center transition-colors ${
                  currentStep === step
                    ? 'bg-primary-600 text-white'
                    : step === 'address' || (step === 'shipping' && selectedAddressId)
                    ? 'bg-primary-100 text-primary-600 cursor-pointer'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {idx + 1}
              </button>
              <div className="text-sm font-medium ml-2">
                {step === 'address' && 'Alamat'}
                {step === 'shipping' && 'Pengiriman'}
                {step === 'summary' && 'Ringkasan'}
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
                              <p className="text-sm text-gray-600">{addr.phone}</p>
                            </div>
                            {addr.is_default && <Badge variant="info">Default</Badge>}
                          </div>
                          <p className="text-sm text-gray-700">{addr.address}</p>
                          <p className="text-sm text-gray-600">
                            {addr.district}, {addr.city}, {addr.province} {addr.postal_code}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}

                  <Button variant="secondary" fullWidth onClick={() => setIsAddressModalOpen(true)}>
                    + Tambah Alamat Baru
                  </Button>

                  {selectedAddressId && (
                    <Button
                      variant="primary"
                      fullWidth
                      className="mt-4"
                      onClick={() => setCurrentStep('shipping')}
                    >
                      Lanjut ke Pengiriman
                    </Button>
                  )}
                </CardBody>
              </Card>
            )}

            {/* Step 2: Shipping */}
            {currentStep === 'shipping' && (
              <Card>
                <CardBody>
                  <h2 className="text-xl font-bold mb-4">Pilih Pengiriman</h2>

                  {shippingLoading ? (
                    <Skeleton count={3} className="h-20 mb-2" />
                  ) : !shippingRates || shippingRates.data.length === 0 ? (
                    <ErrorState
                      title="Tidak Ada Pilihan Pengiriman"
                      message="Kurir tidak tersedia untuk area ini."
                    />
                  ) : (
                    <div className="space-y-3 mb-4">
                      {shippingRates.data.map((rate) => (
                        <button
                          key={`${rate.courier}-${rate.service}`}
                          onClick={() =>
                            setSelectedShipping({
                              courier: rate.courier,
                              service: rate.service,
                            })
                          }
                          className={`w-full text-left p-4 border rounded-lg transition-colors ${
                            selectedShipping?.courier === rate.courier &&
                            selectedShipping?.service === rate.service
                              ? 'border-primary-600 bg-primary-50'
                              : 'border-gray-300 hover:border-primary-600'
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="font-semibold">{rate.courier} - {rate.service}</p>
                              <p className="text-sm text-gray-600">Estimasi: {rate.etd}</p>
                            </div>
                            <p className="font-bold text-primary-600">{formatRupiah(rate.rate)}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button variant="secondary" fullWidth onClick={() => setCurrentStep('address')}>
                      Kembali
                    </Button>
                    <Button
                      variant="primary"
                      fullWidth
                      disabled={!selectedShipping}
                      onClick={() => setCurrentStep('summary')}
                    >
                      Lanjut ke Ringkasan
                    </Button>
                  </div>
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
                            <p className="text-sm text-gray-600">{item.variant_name} x {item.quantity}</p>
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
                      <div className="text-sm text-gray-700">
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
                      className="w-full p-3 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      rows={3}
                    />
                  </CardBody>
                </Card>

                <div className="flex gap-3">
                  <Button variant="secondary" fullWidth onClick={() => setCurrentStep('shipping')}>
                    Kembali
                  </Button>
                  <Button
                    variant="primary"
                    fullWidth
                    isLoading={createOrderMutation.isPending}
                    onClick={() => createOrderMutation.mutate()}
                  >
                    Buat Pesanan
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

      {/* Add Address Modal */}
      <Modal
        isOpen={isAddressModalOpen}
        onClose={() => setIsAddressModalOpen(false)}
        title="Tambah Alamat Baru"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsAddressModalOpen(false)}>
              Batal
            </Button>
            <Button variant="primary">Simpan Alamat</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input label="Nama Penerima" placeholder="John Doe" />
          <Input label="Nomor Telepon" placeholder="08123456789" />
          <Input label="Alamat Lengkap" placeholder="Jl. Contoh No. 123" />
          <Input label="Kecamatan" placeholder="Kelapa Gading" />
          <Input label="Kota" placeholder="Jakarta Utara" />
          <Input label="Provinsi" placeholder="DKI Jakarta" />
          <Input label="Kode Pos" placeholder="14150" />
        </div>
      </Modal>
    </>
  )
}
