import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Helmet } from 'react-helmet-async'
import { Badge, Button, ErrorState, Skeleton } from '@/components/ui'
import { fetchPublicProduct, formatRupiah, isNotFound } from '@/lib/api/catalog'

export default function ProductDetailPage() {
  const { slug = '' } = useParams()

  const {
    data: product,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['product', slug],
    queryFn: () => fetchPublicProduct(slug),
    // Produk yang memang tidak ada tidak perlu dicoba ulang
    retry: (failureCount: number, err: unknown) => !isNotFound(err) && failureCount < 2,
  })

  const [variantId, setVariantId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [imageIndex, setImageIndex] = useState(0)
  const [notice, setNotice] = useState('')

  // Setiap membuka produk baru: pilih varian pertama yang stoknya ada
  const productId = product?.id
  useEffect(() => {
    if (!product) return
    const first = product.variants.find((v) => v.stock > 0) ?? product.variants[0]
    setVariantId(first?.id ?? '')
    setQuantity(1)
    setImageIndex(0)
    setNotice('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId])

  const variant = useMemo(
    () => product?.variants.find((v) => v.id === variantId),
    [product, variantId]
  )

  const priceLabel = useMemo(() => {
    if (!product) return ''
    if (variant) return formatRupiah(variant.price)
    const prices = product.variants.map((v) => v.price)
    const min = Math.min(...prices)
    const max = Math.max(...prices)
    return min === max ? formatRupiah(min) : `${formatRupiah(min)} - ${formatRupiah(max)}`
  }, [product, variant])

  const selectVariant = (id: string) => {
    setVariantId(id)
    setNotice('')
    const stock = product?.variants.find((v) => v.id === id)?.stock ?? 1
    setQuantity((q) => Math.min(q, Math.max(1, stock)))
  }

  const handleAddToCart = () => {
    // TODO: sambungkan ke CartContext setelah kontrak keranjang selesai
    setNotice('Keranjang belum tersambung. Tombol ini akan diaktifkan di langkah berikutnya.')
  }

  // ---------- Loading / error ----------

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 md:grid-cols-2 gap-8">
        <Skeleton className="aspect-square w-full" />
        <div className="space-y-4">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    )
  }

  if (isError || !product) {
    const notFound = isNotFound(error)
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <ErrorState
          title={notFound ? 'Produk tidak ditemukan' : 'Produk gagal dimuat'}
          message={
            notFound
              ? 'Produk ini tidak tersedia atau sudah tidak dijual.'
              : 'Periksa koneksi lalu coba lagi.'
          }
          action={
            notFound ? (
              <Link to="/products">
                <Button>Lihat semua produk</Button>
              </Link>
            ) : (
              <Button onClick={() => refetch()}>Coba lagi</Button>
            )
          }
        />
      </div>
    )
  }

  // ---------- Tampilan ----------

  const images = product.images.filter((img) => img.url)
  const currentImage = images[imageIndex]
  const stock = variant?.stock ?? 0
  const outOfStock = !variant || stock === 0

  return (
    <>
      <Helmet>
        <title>{product.name} - Toko Online</title>
        <meta name="description" content={product.description.slice(0, 160)} />
      </Helmet>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="text-sm text-gray-500 mb-6">
          <Link to="/" className="hover:text-primary-600">
            Beranda
          </Link>
          <span className="mx-2">›</span>
          <Link to="/products" className="hover:text-primary-600">
            Produk
          </Link>
          <span className="mx-2">›</span>
          <Link
            to={`/products?category=${encodeURIComponent(product.category_slug)}`}
            className="hover:text-primary-600"
          >
            {product.category_name}
          </Link>
          <span className="mx-2">›</span>
          <span className="text-gray-900">{product.name}</span>
        </nav>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
          {/* Galeri */}
          <div>
            <div className="aspect-square w-full overflow-hidden rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center">
              {currentImage ? (
                <img
                  src={currentImage.url}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-gray-400 text-sm">Belum ada foto</span>
              )}
            </div>

            {images.length > 1 && (
              <div className="flex gap-2 mt-3 overflow-x-auto">
                {images.map((img, i) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => setImageIndex(i)}
                    aria-label={`Lihat foto ${i + 1}`}
                    className={`w-20 h-20 flex-shrink-0 overflow-hidden rounded border-2 ${
                      i === imageIndex ? 'border-primary-600' : 'border-transparent'
                    }`}
                  >
                    <img src={img.url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div>
            <p className="text-sm text-primary-600 font-medium mb-1">{product.category_name}</p>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{product.name}</h1>

            <p className="text-3xl font-bold text-primary-600 mt-4">{priceLabel}</p>

            {/* Varian */}
            {product.variants.length > 1 && (
              <div className="mt-6">
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Pilih varian
                  {variant && <span className="font-normal text-gray-500">: {variant.name}</span>}
                </p>
                <div className="flex flex-wrap gap-2">
                  {product.variants.map((v) => {
                    const selected = v.id === variantId
                    const habis = v.stock === 0
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => selectVariant(v.id)}
                        aria-pressed={selected}
                        className={`px-4 py-2 rounded border text-sm transition-colors ${
                          selected
                            ? 'border-primary-600 bg-primary-50 text-primary-700 font-medium'
                            : 'border-gray-300 text-gray-700 hover:border-gray-400'
                        } ${habis ? 'opacity-50 line-through' : ''}`}
                      >
                        {v.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Stok */}
            <div className="mt-4 text-sm">
              {outOfStock ? (
                <Badge variant="danger">Stok habis</Badge>
              ) : stock <= 5 ? (
                <Badge variant="warning">Sisa {stock}</Badge>
              ) : (
                <span className="text-gray-600">Stok tersedia: {stock}</span>
              )}
            </div>

            {/* Jumlah */}
            <div className="mt-6">
              <p className="text-sm font-medium text-gray-700 mb-2">Jumlah</p>
              <div className="inline-flex items-center border border-gray-300 rounded">
                <button
                  type="button"
                  aria-label="Kurangi jumlah"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={outOfStock || quantity <= 1}
                  className="w-11 h-11 text-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  −
                </button>
                <span className="w-12 text-center font-medium" aria-live="polite">
                  {outOfStock ? 0 : quantity}
                </span>
                <button
                  type="button"
                  aria-label="Tambah jumlah"
                  onClick={() => setQuantity((q) => Math.min(stock, q + 1))}
                  disabled={outOfStock || quantity >= stock}
                  className="w-11 h-11 text-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  +
                </button>
              </div>
              {!outOfStock && variant && (
                <p className="text-sm text-gray-600 mt-2">
                  Subtotal:{' '}
                  <span className="font-semibold text-gray-900">
                    {formatRupiah(variant.price * quantity)}
                  </span>
                </p>
              )}
            </div>

            {notice && (
              <div
                role="status"
                className="mt-4 rounded border border-yellow-200 bg-yellow-50 px-3 py-2.5 text-sm text-yellow-800"
              >
                {notice}
              </div>
            )}

            <div className="mt-6">
              <Button size="lg" fullWidth disabled={outOfStock} onClick={handleAddToCart}>
                {outOfStock ? 'Stok habis' : 'Tambah ke keranjang'}
              </Button>
            </div>

            {variant && (
              <p className="text-xs text-gray-500 mt-4">
                SKU: {variant.sku}
                {variant.weight_gram > 0 && ` · Berat: ${variant.weight_gram} gram`}
              </p>
            )}
          </div>
        </div>

        {/* Deskripsi */}
        <section className="mt-12 max-w-3xl">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Deskripsi produk</h2>
          {product.description ? (
            <p className="text-gray-700 whitespace-pre-line leading-relaxed">
              {product.description}
            </p>
          ) : (
            <p className="text-gray-500">Belum ada deskripsi untuk produk ini.</p>
          )}
        </section>
      </div>
    </>
  )
}