import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { useCart } from '@/contexts/CartContext'
import { Button, Card, CardBody, QuantityStepper, EmptyState, Badge } from '@/components/ui'
import { formatRupiah } from '@/lib/utils'

export default function CartPage() {
  const { items, removeItem, updateQuantity, subtotal } = useCart()

  const shippingCost = 0 // TODO: Calculate based on address
  const total = subtotal + shippingCost

  return (
    <>
      <Helmet>
        <title>Keranjang - Toko Online</title>
      </Helmet>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Keranjang Belanja</h1>

        {items.length === 0 ? (
          <EmptyState
            icon="🛒"
            title="Keranjang Kosong"
            description="Belum ada produk di keranjang. Mari mulai berbelanja!"
            action={
              <Link to="/products">
                <Button variant="primary">Lanjut Belanja</Button>
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-4">
              {items.map((item) => (
                <Card key={`${item.product_id}-${item.variant_id}`}>
                  <CardBody>
                    <div className="flex gap-4">
                      {/* Image */}
                      <div className="w-24 h-24 bg-gray-200 rounded-lg flex-shrink-0 flex items-center justify-center">
                        <span className="text-gray-400 text-4xl">📦</span>
                      </div>

                      {/* Details */}
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{item.product_name}</h3>
                        <p className="text-sm text-gray-600">{item.variant_name}</p>
                        <p className="text-primary-600 font-bold mt-2">
                          {formatRupiah(item.price)} x {item.quantity} ={' '}
                          <span>{formatRupiah(item.price * item.quantity)}</span>
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col items-end justify-between">
                        <button
                          onClick={() => removeItem(item.product_id, item.variant_id)}
                          className="text-red-600 hover:text-red-700 text-sm font-medium"
                        >
                          Hapus
                        </button>
                        <QuantityStepper
                          value={item.quantity}
                          onChange={(qty) =>
                            updateQuantity(item.product_id, item.variant_id, qty)
                          }
                          min={1}
                          max={99}
                        />
                      </div>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>

            {/* Summary */}
            <div className="lg:col-span-1">
              <Card className="sticky top-24">
                <CardBody>
                  <h3 className="font-semibold text-lg mb-4">Ringkasan Pesanan</h3>

                  <div className="space-y-2 mb-4 pb-4 border-b border-gray-200">
                    <div className="flex justify-between text-gray-600">
                      <span>Subtotal ({items.length} produk)</span>
                      <span>{formatRupiah(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Ongkir</span>
                      <span className="text-yellow-600 font-medium">Hitung di checkout</span>
                    </div>
                  </div>

                  <div className="flex justify-between font-bold text-lg mb-6">
                    <span>Total</span>
                    <span>{formatRupiah(total)}</span>
                  </div>

                  <Link to="/checkout" className="block">
                    <Button variant="primary" fullWidth size="lg">
                      Lanjut Checkout
                    </Button>
                  </Link>

                  <Link to="/products" className="block mt-3">
                    <Button variant="ghost" fullWidth>
                      Lanjut Belanja
                    </Button>
                  </Link>
                </CardBody>
              </Card>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
