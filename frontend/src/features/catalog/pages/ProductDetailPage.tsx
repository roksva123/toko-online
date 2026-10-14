import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import { useAuth } from '@/contexts/AuthContext'
import { useCart } from '@/contexts/CartContext'
import { Button, Breadcrumb, Card, CardBody, Badge, Skeleton, QuantityStepper, ErrorState, EmptyState } from '@/components/ui'
import { formatRupiah } from '@/lib/utils'

interface ProductVariant {
  id: string
  sku: string
  name: string
  price: number
  stock: number
  is_active: boolean
}

interface ProductImage {
  id: string
  image_url: string
  alt_text: string
}

interface ProductDetail {
  id: string
  slug: string
  name: string
  description: string
  category_name: string
  base_price: number
  is_active: boolean
  images: ProductImage[]
  variants: ProductVariant[]
}

export default function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const { addItem } = useCart()
  const [quantity, setQuantity] = useState(1)
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null)
  const [addedToCart, setAddedToCart] = useState(false)

  const { data: product, isLoading, error } = useQuery({
    queryKey: ['product', slug],
    queryFn: async () => {
      const response = await apiClient.get<ProductDetail>(`/products/${slug}`)
      return response.data
    },
  })

  const handleAddToCart = () => {
    if (!isAuthenticated) {
      navigate(`/login?redirect=/products/${slug}`)
      return
    }

    if (!selectedVariant) {
      alert('Pilih varian terlebih dahulu')
      return
    }

    if (selectedVariant.stock === 0) {
      alert('Produk tidak tersedia')
      return
    }

    addItem({
      product_id: product!.id,
      product_name: product!.name,
      variant_id: selectedVariant.id,
      variant_name: selectedVariant.name,
      price: selectedVariant.price,
      quantity,
      image_url: product!.images[0]?.image_url || '/placeholder.jpg',
    })

    setAddedToCart(true)
    setTimeout(() => setAddedToCart(false), 3000)
  }

  if (error && !isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <ErrorState
          title="Produk Tidak Ditemukan"
          message="Produk yang Anda cari tidak tersedia."
          action={<Button size="sm" variant="primary" onClick={() => navigate('/products')}>Kembali ke Produk</Button>}
        />
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <Skeleton className="h-8 w-48 mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Skeleton className="h-96 w-full" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <EmptyState title="Produk Tidak Ditemukan" description="Silakan kembali ke halaman produk." />
      </div>
    )
  }

  const mainImage = product.images[0]?.image_url || '/placeholder.jpg'
  const activeVariants = product.variants.filter((v) => v.is_active)
  const displayPrice = selectedVariant ? selectedVariant.price : product.base_price

  return (
    <>
      <Helmet>
        <title>{product.name} - Toko Online</title>
        <meta name="description" content={product.description} />
        <meta property="og:title" content={product.name} />
        <meta property="og:description" content={product.description} />
        <meta property="og:image" content={mainImage} />
      </Helmet>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            { label: 'Beranda', href: '/' },
            { label: 'Produk', href: '/products' },
            { label: product.name, isActive: true },
          ]}
          className="mb-8"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Gallery */}
          <div>
            <div className="bg-gray-200 rounded-lg overflow-hidden mb-4 h-96 flex items-center justify-center">
              <Skeleton className="w-full h-full" />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {product.images.slice(0, 4).map((image) => (
                <div
                  key={image.id}
                  className="bg-gray-200 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary-600"
                >
                  <Skeleton className="w-full h-24" />
                </div>
              ))}
            </div>
          </div>

          {/* Details */}
          <div>
            <h1 className="text-2xl md:text-3xl font-bold mb-2">{product.name}</h1>
            <p className="text-gray-600 text-sm mb-4">{product.category_name}</p>

            {!product.is_active && (
              <Badge variant="danger" className="mb-4">
                Produk Tidak Tersedia
              </Badge>
            )}

            <p className="text-3xl font-bold text-primary-600 mb-6">{formatRupiah(displayPrice)}</p>

            {/* Variants */}
            {activeVariants.length > 0 && (
              <Card className="mb-6">
                <CardBody>
                  <h3 className="font-semibold mb-3">Pilih Varian</h3>
                  <div className="space-y-2">
                    {activeVariants.map((variant) => (
                      <button
                        key={variant.id}
                        onClick={() => setSelectedVariant(variant)}
                        disabled={variant.stock === 0}
                        className={`w-full text-left p-3 border rounded transition-colors ${
                          selectedVariant?.id === variant.id
                            ? 'border-primary-600 bg-primary-50'
                            : 'border-gray-300 hover:border-primary-600'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{variant.name}</span>
                          <span className="text-sm text-gray-600">
                            {variant.stock > 0 ? `${variant.stock} tersedia` : 'Habis'}
                          </span>
                        </div>
                        <p className="text-primary-600 font-semibold">{formatRupiah(variant.price)}</p>
                      </button>
                    ))}
                  </div>
                </CardBody>
              </Card>
            )}

            {/* Stock Info */}
            {selectedVariant && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-700">
                  {selectedVariant.stock > 0
                    ? `${selectedVariant.stock} produk tersedia`
                    : 'Produk sedang tidak tersedia'}
                </p>
              </div>
            )}

            {/* Success Message */}
            {addedToCart && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-700">✓ Produk berhasil ditambahkan ke keranjang!</p>
              </div>
            )}

            {/* Quantity & Add to Cart */}
            <div className="flex gap-4 mb-6">
              <QuantityStepper
                value={quantity}
                onChange={setQuantity}
                max={selectedVariant?.stock || 1}
                disabled={!selectedVariant || selectedVariant.stock === 0}
              />
              <Button
                variant="primary"
                size="lg"
                onClick={handleAddToCart}
                disabled={!selectedVariant || selectedVariant.stock === 0}
                className="flex-1"
              >
                Tambah ke Keranjang
              </Button>
            </div>

            {/* Description */}
            <Card>
              <CardBody>
                <h3 className="font-semibold mb-3">Deskripsi</h3>
                <p className="text-gray-700 whitespace-pre-wrap">{product.description}</p>
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    </>
  )
}
