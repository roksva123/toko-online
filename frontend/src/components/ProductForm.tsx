import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Checkbox, ErrorState, Input, Select, Skeleton, Textarea } from '@/components/ui'
import {
  adminKeys,
  categoryOptions,
  createProduct,
  fetchCategories,
  fetchProduct,
  parseApiError,
  ProductInput,
  updateProduct,
} from '@/lib/api/admin'

interface VariantRow {
  key: string // hanya untuk React, tidak dikirim ke server
  id?: string
  sku: string
  name: string
  price: string
  stock: string
  weight_gram: string
  is_active: boolean
}

interface ProductFormProps {
  productId: string | null // null = produk baru
  onCancel: () => void
  onSaved: (message: string) => void
}

const SKU_REGEX = /^[A-Za-z0-9._-]{1,100}$/

let rowCounter = 0
const newKey = () => `row-${++rowCounter}`

const emptyRow = (): VariantRow => ({
  key: newKey(),
  sku: '',
  name: '',
  price: '',
  stock: '0',
  weight_gram: '0',
  is_active: true,
})

const toNumber = (value: string) => (value.trim() === '' ? NaN : Number(value))

export function ProductForm({ productId, onCancel, onSaved }: ProductFormProps) {
  const queryClient = useQueryClient()
  const isEdit = productId !== null

  const { data: categories } = useQuery({
    queryKey: adminKeys.categories,
    queryFn: fetchCategories,
  })

  const {
    data: product,
    isLoading: isProductLoading,
    isError: isProductError,
    refetch,
  } = useQuery({
    queryKey: [...adminKeys.products, 'detail', productId],
    queryFn: () => fetchProduct(productId as string),
    enabled: isEdit,
    refetchOnWindowFocus: false,
  })

  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [rows, setRows] = useState<VariantRow[]>(() => [emptyRow()])

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  // Isi form dari data server sekali saja, supaya refetch tidak menimpa ketikan admin
  const initialized = useRef(false)
  useEffect(() => {
    if (!product || initialized.current) return
    initialized.current = true
    setName(product.name)
    setCategoryId(product.category_id)
    setSlug(product.slug)
    setDescription(product.description)
    setIsActive(product.is_active)
    setRows(
      product.variants.length > 0
        ? product.variants.map((v) => ({
            key: newKey(),
            id: v.id,
            sku: v.sku,
            name: v.name,
            price: String(v.price),
            stock: String(v.stock),
            weight_gram: String(v.weight_gram),
            is_active: v.is_active,
          }))
        : [emptyRow()]
    )
  }, [product])

  const options = useMemo(() => categoryOptions(categories ?? []), [categories])

  const clearError = (key: string) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const updateRow = (index: number, patch: Partial<VariantRow>) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))
    for (const field of Object.keys(patch)) clearError(`variants.${index}.${field}`)
  }

  const removeRow = (index: number) => {
    setRows((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev))
    setFieldErrors({})
  }

  const validate = (): Record<string, string> => {
    const errors: Record<string, string> = {}

    if (name.trim().length < 2) errors.name = 'Nama produk minimal 2 karakter'
    if (!categoryId) errors.category_id = 'Pilih kategori'

    const seen = new Set<string>()
    rows.forEach((row, i) => {
      const key = (field: string) => `variants.${i}.${field}`
      const sku = row.sku.trim()

      if (!SKU_REGEX.test(sku)) {
        errors[key('sku')] = 'SKU wajib diisi (huruf, angka, titik, _ atau -)'
      } else if (seen.has(sku)) {
        errors[key('sku')] = 'SKU kembar di produk ini'
      }
      seen.add(sku)

      if (row.name.trim() === '') errors[key('name')] = 'Nama varian wajib diisi'

      const price = toNumber(row.price)
      if (!Number.isInteger(price) || price <= 0) errors[key('price')] = 'Harga harus lebih dari 0'

      const stock = toNumber(row.stock)
      if (!Number.isInteger(stock) || stock < 0) errors[key('stock')] = 'Stok 0 atau lebih'

      const weight = toNumber(row.weight_gram)
      if (!Number.isInteger(weight) || weight < 0) errors[key('weight_gram')] = 'Berat 0 atau lebih'
    })

    return errors
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError('')

    const errors = validate()
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    const payload: ProductInput = {
      category_id: categoryId,
      name: name.trim(),
      slug: slug.trim(),
      description: description.trim(),
      is_active: isActive,
      variants: rows.map((row) => ({
        ...(row.id ? { id: row.id } : {}),
        sku: row.sku.trim(),
        name: row.name.trim(),
        price: Number(row.price),
        stock: Number(row.stock),
        weight_gram: Number(row.weight_gram),
        is_active: row.is_active,
      })),
    }

    setSaving(true)
    try {
      if (isEdit) {
        await updateProduct(productId as string, payload)
      } else {
        await createProduct(payload)
      }
      await queryClient.invalidateQueries({ queryKey: adminKeys.all })
      onSaved(isEdit ? 'Produk berhasil diperbarui' : 'Produk berhasil ditambahkan')
    } catch (err) {
      const feedback = parseApiError(err)
      setFieldErrors(feedback.fields)
      if (Object.keys(feedback.fields).length === 0) setFormError(feedback.message)
      setSaving(false)
    }
  }

  if (isEdit && isProductLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-12 w-full" count={4} />
      </div>
    )
  }

  if (isEdit && isProductError) {
    return (
      <ErrorState
        title="Produk gagal dimuat"
        message="Produk tidak ditemukan atau koneksi bermasalah."
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onCancel}>
              Kembali
            </Button>
            <Button onClick={() => refetch()}>Coba lagi</Button>
          </div>
        }
      />
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="max-w-4xl space-y-8">
      <div>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="text-sm text-primary-600 hover:underline mb-2"
        >
          ← Kembali ke daftar produk
        </button>
        <h1 className="text-2xl font-bold text-gray-900">
          {isEdit ? 'Ubah produk' : 'Tambah produk'}
        </h1>
      </div>

      {formError && (
        <div
          role="alert"
          className="rounded border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
        >
          {formError}
        </div>
      )}

      {/* Informasi produk */}
      <section className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Informasi produk</h2>

        <Input
          label="Nama produk"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            clearError('name')
          }}
          error={fieldErrors.name}
          disabled={saving}
          autoFocus={!isEdit}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Kategori"
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value)
              clearError('category_id')
            }}
            options={options}
            error={fieldErrors.category_id}
            disabled={saving}
          />
          <Input
            label="Slug"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value)
              clearError('slug')
            }}
            error={fieldErrors.slug}
            helperText={
              isEdit
                ? 'Mengubah slug akan mengubah alamat URL produk'
                : 'Kosongkan untuk dibuat otomatis dari nama'
            }
            disabled={saving}
          />
        </div>

        <Textarea
          label="Deskripsi"
          rows={4}
          value={description}
          onChange={(e) => {
            setDescription(e.target.value)
            clearError('description')
          }}
          error={fieldErrors.description}
          disabled={saving}
        />

        <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <Checkbox
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            disabled={saving}
          />
          Aktif (tampil di toko)
        </label>
      </section>

      {/* Varian */}
      <section className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Varian</h2>
            <p className="text-sm text-gray-600">
              Harga, stok, dan berat diatur per varian (misalnya ukuran atau warna).
              {isEdit && ' Varian yang dihapus dari daftar akan dinonaktifkan.'}
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setRows((prev) => [...prev, emptyRow()])}
            disabled={saving}
          >
            Tambah varian
          </Button>
        </div>

        {fieldErrors.variants && (
          <p role="alert" className="text-sm text-red-600">
            {fieldErrors.variants}
          </p>
        )}

        {rows.map((row, i) => (
          <div
            key={row.key}
            className="bg-white rounded-lg border border-gray-200 p-4 space-y-3"
          >
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Input
                label="SKU"
                value={row.sku}
                onChange={(e) => updateRow(i, { sku: e.target.value })}
                error={fieldErrors[`variants.${i}.sku`]}
                disabled={saving}
              />
              <Input
                label="Nama varian"
                placeholder="mis. M / Hitam"
                value={row.name}
                onChange={(e) => updateRow(i, { name: e.target.value })}
                error={fieldErrors[`variants.${i}.name`]}
                disabled={saving}
              />
              <Input
                label="Harga (Rp)"
                type="number"
                inputMode="numeric"
                min={0}
                value={row.price}
                onChange={(e) => updateRow(i, { price: e.target.value })}
                error={fieldErrors[`variants.${i}.price`]}
                disabled={saving}
              />
              <Input
                label="Stok"
                type="number"
                inputMode="numeric"
                min={0}
                value={row.stock}
                onChange={(e) => updateRow(i, { stock: e.target.value })}
                error={fieldErrors[`variants.${i}.stock`]}
                disabled={saving}
              />
              <Input
                label="Berat (gram)"
                type="number"
                inputMode="numeric"
                min={0}
                value={row.weight_gram}
                onChange={(e) => updateRow(i, { weight_gram: e.target.value })}
                error={fieldErrors[`variants.${i}.weight_gram`]}
                disabled={saving}
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <Checkbox
                  checked={row.is_active}
                  onChange={(e) => updateRow(i, { is_active: e.target.checked })}
                  disabled={saving}
                />
                Varian aktif
              </label>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => removeRow(i)}
                disabled={saving || rows.length === 1}
              >
                Hapus varian
              </Button>
            </div>
          </div>
        ))}
      </section>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
          Batal
        </Button>
        <Button type="submit" isLoading={saving}>
          Simpan produk
        </Button>
      </div>
    </form>
  )
}