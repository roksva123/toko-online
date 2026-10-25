import { Link } from 'react-router-dom'
import { Badge, Card, CardBody } from '@/components/ui'
import { formatRupiah, PublicProduct } from '@/lib/api/catalog'

export function ProductCard({ product }: { product: PublicProduct }) {
  const soldOut = product.total_stock === 0
  const price =
    product.price_min === product.price_max
      ? formatRupiah(product.price_min)
      : `Dari ${formatRupiah(product.price_min)}`

  return (
    <Link
      to={`/products/${product.slug}`}
      className="block h-full rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
    >
      <Card className="border border-slate-200 dark:border-slate-700 hover:border-primary-400 dark:hover:border-primary-400 hover:shadow-lg transition-shadow h-full overflow-hidden">
        <div className="relative bg-gray-100 dark:bg-gray-800 h-48 flex items-center justify-center">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              loading="lazy"
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-sm text-gray-400">Belum ada foto</span>
          )}
          {soldOut && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <Badge variant="danger">Stok habis</Badge>
            </div>
          )}
        </div>
        <CardBody>
          <p className="font-semibold text-gray-900 dark:text-gray-100 line-clamp-2 min-h-[3rem]">{product.name}</p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{product.category_name}</p>
          <div className="mt-2 flex items-center gap-1 text-sm">
            <span className="text-amber-500" aria-label={`Rating ${product.rating.toFixed(1)} dari 5`}>
              {'★'.repeat(Math.round(product.rating))}{'☆'.repeat(5 - Math.round(product.rating))}
            </span>
            {product.review_count > 0 && <span className="text-gray-500 dark:text-gray-400">({product.review_count})</span>}
          </div>
          <p className="text-primary-600 font-bold mt-2">{price}</p>
        </CardBody>
      </Card>
    </Link>
  )
}