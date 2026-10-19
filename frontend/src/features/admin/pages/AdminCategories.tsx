import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Helmet } from 'react-helmet-async'
import {
  Badge,
  Button,
  Checkbox,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  Select,
  Skeleton,
} from '@/components/ui'
import {
  adminKeys,
  Category,
  CategoryInput,
  categoryOptions,
  createCategory,
  deleteCategory,
  descendantIds,
  fetchCategories,
  flattenCategories,
  parseApiError,
  updateCategory,
} from '@/lib/api/admin'

interface FormState {
  name: string
  parent_id: string
  slug: string
  sort_order: string
  is_active: boolean
}

const emptyForm: FormState = {
  name: '',
  parent_id: '',
  slug: '',
  sort_order: '0',
  is_active: true,
}

export default function AdminCategories() {
  const queryClient = useQueryClient()

  const {
    data: categories,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: adminKeys.categories,
    queryFn: fetchCategories,
  })

  const [notice, setNotice] = useState('')

  // Form tambah / ubah
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  // Konfirmasi hapus
  const [deleting, setDeleting] = useState<Category | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [deleteBusy, setDeleteBusy] = useState(false)

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(''), 4000)
    return () => clearTimeout(t)
  }, [notice])

  const rows = useMemo(() => flattenCategories(categories ?? []), [categories])

  // Induk tidak boleh dirinya sendiri atau turunannya
  const parentOptions = useMemo(() => {
    const list = categories ?? []
    const exclude = editing
      ? new Set<string>([editing.id, ...descendantIds(list, editing.id)])
      : undefined
    return categoryOptions(list, exclude)
  }, [categories, editing])

  const parentName = (id: string | null) =>
    id ? categories?.find((c) => c.id === id)?.name : undefined

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setFieldErrors({})
    setFormError('')
    setIsFormOpen(true)
  }

  const openEdit = (cat: Category) => {
    setEditing(cat)
    setForm({
      name: cat.name,
      parent_id: cat.parent_id ?? '',
      slug: cat.slug,
      sort_order: String(cat.sort_order),
      is_active: cat.is_active,
    })
    setFieldErrors({})
    setFormError('')
    setIsFormOpen(true)
  }

  const closeForm = () => {
    if (saving) return
    setIsFormOpen(false)
  }

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (fieldErrors[key]) {
      setFieldErrors((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError('')

    const errors: Record<string, string> = {}
    if (form.name.trim().length < 2) errors.name = 'Nama kategori minimal 2 karakter'
    const sortOrder = Number(form.sort_order === '' ? 0 : form.sort_order)
    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      errors.sort_order = 'Urutan harus bilangan bulat 0 atau lebih'
    }
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    const payload: CategoryInput = {
      parent_id: form.parent_id || null,
      name: form.name.trim(),
      slug: form.slug.trim(),
      sort_order: sortOrder,
      is_active: form.is_active,
    }

    setSaving(true)
    try {
      if (editing) {
        await updateCategory(editing.id, payload)
      } else {
        await createCategory(payload)
      }
      await queryClient.invalidateQueries({ queryKey: adminKeys.all })
      setIsFormOpen(false)
      setNotice(editing ? 'Kategori berhasil diperbarui' : 'Kategori berhasil ditambahkan')
    } catch (err) {
      const feedback = parseApiError(err)
      setFieldErrors(feedback.fields)
      if (Object.keys(feedback.fields).length === 0) setFormError(feedback.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    setDeleteError('')
    setDeleteBusy(true)
    try {
      await deleteCategory(deleting.id)
      await queryClient.invalidateQueries({ queryKey: adminKeys.all })
      setDeleting(null)
      setNotice('Kategori berhasil dihapus')
    } catch (err) {
      setDeleteError(parseApiError(err).message)
    } finally {
      setDeleteBusy(false)
    }
  }

  return (
    <>
      <Helmet>
        <title>Kategori - Admin Toko Online</title>
      </Helmet>

      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kategori</h1>
          <p className="text-gray-600 text-sm mt-1">
            Kelompokkan produk agar mudah dicari pembeli.
          </p>
        </div>
        <Button onClick={openCreate}>Tambah kategori</Button>
      </div>

      {notice && (
        <div
          role="status"
          className="mb-4 rounded border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-green-800"
        >
          {notice}
        </div>
      )}

      {isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" count={5} />
        </div>
      )}

      {isError && (
        <ErrorState
          title="Kategori gagal dimuat"
          message="Periksa koneksi lalu coba lagi."
          action={<Button onClick={() => refetch()}>Coba lagi</Button>}
        />
      )}

      {!isLoading && !isError && rows.length === 0 && (
        <EmptyState
          title="Belum ada kategori"
          description="Tambahkan kategori pertama sebelum membuat produk."
          action={<Button onClick={openCreate}>Tambah kategori</Button>}
        />
      )}

      {!isLoading && !isError && rows.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3 font-medium">Nama</th>
                <th className="px-4 py-3 font-medium">Slug</th>
                <th className="px-4 py-3 font-medium">Urutan</th>
                <th className="px-4 py-3 font-medium">Produk</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(({ category, depth }) => (
                <tr key={category.id}>
                  <td className="px-4 py-3">
                    <div style={{ paddingLeft: depth * 20 }}>
                      <span className="font-medium text-gray-900">
                        {depth > 0 && <span className="text-gray-400 mr-1">└</span>}
                        {category.name}
                      </span>
                      {category.parent_id && (
                        <span className="block text-xs text-gray-500">
                          di dalam {parentName(category.parent_id)}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{category.slug}</td>
                  <td className="px-4 py-3 text-gray-600">{category.sort_order}</td>
                  <td className="px-4 py-3 text-gray-600">{category.product_count}</td>
                  <td className="px-4 py-3">
                    <Badge variant={category.is_active ? 'success' : 'default'}>
                      {category.is_active ? 'Aktif' : 'Nonaktif'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button variant="secondary" size="sm" onClick={() => openEdit(category)}>
                        Ubah
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          setDeleteError('')
                          setDeleting(category)
                        }}
                      >
                        Hapus
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Form tambah / ubah */}
      <Modal
        isOpen={isFormOpen}
        onClose={closeForm}
        title={editing ? 'Ubah kategori' : 'Tambah kategori'}
        footer={
          <>
            <Button variant="secondary" onClick={closeForm} disabled={saving}>
              Batal
            </Button>
            <Button type="submit" form="category-form" isLoading={saving}>
              Simpan
            </Button>
          </>
        }
      >
        <form id="category-form" onSubmit={handleSubmit} noValidate className="space-y-4">
          {formError && (
            <div
              role="alert"
              className="rounded border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
            >
              {formError}
            </div>
          )}

          <Input
            label="Nama kategori"
            value={form.name}
            onChange={(e) => setField('name', e.target.value)}
            error={fieldErrors.name}
            disabled={saving}
            autoFocus
          />

          <Select
            label="Kategori induk (kosongkan untuk kategori utama)"
            value={form.parent_id}
            onChange={(e) => setField('parent_id', e.target.value)}
            options={parentOptions}
            error={fieldErrors.parent_id}
            disabled={saving}
          />

          <Input
            label="Slug"
            value={form.slug}
            onChange={(e) => setField('slug', e.target.value)}
            error={fieldErrors.slug}
            helperText={
              editing
                ? 'Mengubah slug akan mengubah alamat URL kategori'
                : 'Kosongkan untuk dibuat otomatis dari nama'
            }
            disabled={saving}
          />

          <Input
            label="Urutan tampil"
            type="number"
            inputMode="numeric"
            min={0}
            value={form.sort_order}
            onChange={(e) => setField('sort_order', e.target.value)}
            error={fieldErrors.sort_order}
            helperText="Angka kecil tampil lebih dulu"
            disabled={saving}
          />

          <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <Checkbox
              checked={form.is_active}
              onChange={(e) => setField('is_active', e.target.checked)}
              disabled={saving}
            />
            Aktif (tampil di toko)
          </label>
        </form>
      </Modal>

      {/* Konfirmasi hapus */}
      <Modal
        isOpen={deleting !== null}
        onClose={() => !deleteBusy && setDeleting(null)}
        title="Hapus kategori"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)} disabled={deleteBusy}>
              Batal
            </Button>
            <Button variant="danger" onClick={handleDelete} isLoading={deleteBusy}>
              Hapus
            </Button>
          </>
        }
      >
        <p className="text-gray-700">
          Hapus kategori <strong>{deleting?.name}</strong>? Tindakan ini tidak bisa dibatalkan.
        </p>
        {deleteError && (
          <div
            role="alert"
            className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
          >
            {deleteError}
          </div>
        )}
      </Modal>
    </>
  )
}