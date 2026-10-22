
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Badge, Button, EmptyState, ErrorState, Modal, Skeleton } from '@/components/ui'
import {
  addressKeys,
  deleteAddress,
  fetchAddresses,
  parseApiError,
  SavedAddress,
  setDefaultAddress,
} from '@/lib/api/addresses'
import { AddressFormModal } from '../components/AddressFormModal'

const MAX_ADDRESSES = 10

export default function AddressesPage() {
  const queryClient = useQueryClient()

  const {
  data: addresses = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: addressKeys.all,
    queryFn: fetchAddresses,
  })

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editing, setEditing] = useState<SavedAddress | null>(null)

  const [deleting, setDeleting] = useState<SavedAddress | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const [defaultBusyId, setDefaultBusyId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 4000)
    return () => clearTimeout(t)
  }, [notice])

  const atLimit = addresses.length >= MAX_ADDRESSES

  const openCreate = () => {
    setEditing(null)
    setIsFormOpen(true)
  }

  const openEdit = (address: SavedAddress) => {
    setEditing(address)
    setIsFormOpen(true)
  }

  const handleSetDefault = async (address: SavedAddress) => {
    setDefaultBusyId(address.id)
    try {
      await setDefaultAddress(address.id)
      await queryClient.invalidateQueries({ queryKey: addressKeys.all })
      setNotice({ type: 'success', text: 'Alamat utama diperbarui' })
    } catch (err) {
      setNotice({ type: 'error', text: parseApiError(err).message })
    } finally {
      setDefaultBusyId(null)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    setDeleteError('')
    setDeleteBusy(true)
    try {
      await deleteAddress(deleting.id)
      await queryClient.invalidateQueries({ queryKey: addressKeys.all })
      setDeleting(null)
      setNotice({ type: 'success', text: 'Alamat berhasil dihapus' })
    } catch (err) {
      setDeleteError(parseApiError(err).message)
    } finally {
      setDeleteBusy(false)
    }
  }

  return (
    <>
      <Helmet>
        <title>Alamat Saya - Toko Online</title>
      </Helmet>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link to="/account" className="text-sm text-primary-600 hover:underline">
          ← Kembali ke akun
        </Link>

        <div className="flex items-start justify-between gap-4 mt-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Alamat Saya</h1>
            <p className="text-sm text-gray-600 mt-1">
              {addresses.length > 0
                ? `${addresses.length} dari ${MAX_ADDRESSES} alamat tersimpan`
                : 'Simpan alamat agar checkout lebih cepat.'}
            </p>
          </div>
          {addresses.length > 0 && (
            <Button onClick={openCreate} disabled={atLimit}>
              Tambah Alamat
            </Button>
          )}
        </div>

        {notice && (
          <div
            role={notice.type === 'error' ? 'alert' : 'status'}
            className={`mb-4 rounded border px-3 py-2.5 text-sm ${
              notice.type === 'success'
                ? 'border-green-200 bg-green-50 text-green-800'
                : 'border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {notice.text}
          </div>
        )}

        {isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-36 w-full" count={2} />
          </div>
        )}

        {isError && (
          <ErrorState
            title="Alamat gagal dimuat"
            message="Periksa koneksi lalu coba lagi."
            action={<Button onClick={() => refetch()}>Coba lagi</Button>}
          />
        )}

        {!isLoading && !isError && addresses.length === 0 && (
          <EmptyState
            icon="📍"
            title="Belum ada alamat"
            description="Tambahkan alamat pengiriman pertamamu."
            action={<Button onClick={openCreate}>Tambah Alamat</Button>}
          />
        )}

        {addresses.length > 0 && (
          <ul className="space-y-3">
            {addresses.map((a) => (
              <li
                key={a.id}
                className={`bg-white rounded-lg border p-5 ${
                  a.is_default ? 'border-primary-300 ring-1 ring-primary-200' : 'border-gray-200'
                }`}
              >
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <Badge variant="info">{a.label}</Badge>
                  {a.is_default && <Badge variant="success">Utama</Badge>}
                </div>

                <p className="font-semibold text-gray-900">
                  {a.recipient_name} <span className="font-normal text-gray-500">· {a.phone}</span>
                </p>
                <p className="text-sm text-gray-700 mt-1">{a.address}</p>
                <p className="text-sm text-gray-700">
                  {a.district}, {a.city}, {a.province} {a.postal_code}
                </p>

                <div className="flex flex-wrap gap-2 mt-4">
                  <Button variant="secondary" size="sm" onClick={() => openEdit(a)}>
                    Ubah
                  </Button>
                  {!a.is_default && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSetDefault(a)}
                      isLoading={defaultBusyId === a.id}
                    >
                      Jadikan utama
                    </Button>
                  )}
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      setDeleteError('')
                      setDeleting(a)
                    }}
                  >
                    Hapus
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {atLimit && (
          <p className="text-sm text-gray-500 mt-4">
            Kamu sudah mencapai batas {MAX_ADDRESSES} alamat. Hapus salah satu untuk menambah yang
            baru.
          </p>
        )}
      </div>

      <AddressFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        address={editing}
        isFirstAddress={addresses.length === 0}
        onSaved={() => setNotice({ type: 'success', text: 'Alamat berhasil disimpan' })}
      />

      <Modal
        isOpen={deleting !== null}
        onClose={() => !deleteBusy && setDeleting(null)}
        title="Hapus alamat"
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
          Hapus alamat <strong>{deleting?.label}</strong> atas nama{' '}
          <strong>{deleting?.recipient_name}</strong>?
        </p>
        {deleting?.is_default && addresses.length > 1 && (
          <p className="text-sm text-gray-500 mt-2">
            Alamat terbaru yang tersisa akan menjadi alamat utama.
          </p>
        )}
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