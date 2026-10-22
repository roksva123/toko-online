import { FormEvent, useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Modal, Button, Input, Checkbox } from '@/components/ui'
import {
  AddressInput,
  addressKeys,
  createAddress,
  parseApiError,
  SavedAddress,
  updateAddress,
} from '@/lib/api/addresses'

const PHONE_REGEX = /^(?:\+62|62|0)8\d{8,11}$/
const POSTAL_CODE_REGEX = /^\d{5}$/

const cleanPhone = (value: string) => value.replace(/[\s-]/g, '')

interface AddressFormModalProps {
  isOpen: boolean
  onClose: () => void
  address: SavedAddress | null // For editing
  isFirstAddress: boolean
  onSaved: () => void
}

export function AddressFormModal({
  isOpen,
  onClose,
  address,
  isFirstAddress,
  onSaved,
}: AddressFormModalProps) {
  const queryClient = useQueryClient()

  const [label, setLabel] = useState(address?.label ?? '')
  const [recipientName, setRecipientName] = useState(address?.recipient_name ?? '')
  const [phone, setPhone] = useState(address?.phone ?? '')
  const [addressLine, setAddressLine] = useState(address?.address ?? '')
  const [district, setDistrict] = useState(address?.district ?? '')
  const [city, setCity] = useState(address?.city ?? '')
  const [province, setProvince] = useState(address?.province ?? '')
  const [postalCode, setPostalCode] = useState(address?.postal_code ?? '')
  const [isDefault, setIsDefault] = useState(address?.is_default ?? isFirstAddress)

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [apiError, setApiError] = useState('')

  useEffect(() => {
    if (isOpen) {
      // Reset form when modal opens
      setLabel(address?.label ?? '')
      setRecipientName(address?.recipient_name ?? '')
      setPhone(address?.phone ?? '')
      setAddressLine(address?.address ?? '')
      setDistrict(address?.district ?? '')
      setCity(address?.city ?? '')
      setProvince(address?.province ?? '')
      setPostalCode(address?.postal_code ?? '')
      setIsDefault(address?.is_default ?? isFirstAddress)
      setErrors({})
      setApiError('')
    }
  }, [isOpen, address, isFirstAddress])

  const createMutation = useMutation({
    mutationFn: createAddress,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: addressKeys.all })
      onSaved()
      onClose()
    },
    onError: (err) => {
      const feedback = parseApiError(err)
      setErrors(feedback.fields)
      if (Object.keys(feedback.fields).length === 0) setApiError(feedback.message)
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; input: AddressInput }) => updateAddress(data.id, data.input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: addressKeys.all })
      onSaved()
      onClose()
    },
    onError: (err) => {
      const feedback = parseApiError(err)
      setErrors(feedback.fields)
      if (Object.keys(feedback.fields).length === 0) setApiError(feedback.message)
    },
  })

  const isLoading = createMutation.isPending || updateMutation.isPending

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrors({})
    setApiError('')

    const currentErrors: Record<string, string> = {}
    if (!label.trim()) currentErrors.label = 'Label alamat wajib diisi'
    if (!recipientName.trim()) currentErrors.recipient_name = 'Nama penerima wajib diisi'
    if (!PHONE_REGEX.test(cleanPhone(phone))) {
      currentErrors.phone = 'Gunakan nomor HP Indonesia, contoh 081234567890'
    }
    if (!addressLine.trim()) currentErrors.address = 'Alamat lengkap wajib diisi'
    if (!district.trim()) currentErrors.district = 'Kecamatan wajib diisi'
    if (!city.trim()) currentErrors.city = 'Kota wajib diisi'
    if (!province.trim()) currentErrors.province = 'Provinsi wajib diisi'
    if (!POSTAL_CODE_REGEX.test(postalCode)) {
      currentErrors.postal_code = 'Kode pos harus 5 digit angka'
    }

    setErrors(currentErrors)
    if (Object.keys(currentErrors).length > 0) return

    const input: AddressInput = {
      label: label.trim(),
      recipient_name: recipientName.trim(),
      phone: cleanPhone(phone),
      address: addressLine.trim(),
      district: district.trim(),
      city: city.trim(),
      province: province.trim(),
      postal_code: postalCode,
      is_default: isDefault,
    }

    if (address) {
      updateMutation.mutate({ id: address.id, input })
    } else {
      createMutation.mutate(input)
    }
  }

  const title = address ? 'Ubah Alamat' : 'Tambah Alamat Baru'

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="lg">
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {apiError && (
          <div role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            {apiError}
          </div>
        )}

        <Input
          label="Label Alamat"
          value={label}
          onChange={(e) => {
            setLabel(e.target.value)
            setErrors((prev) => ({ ...prev, label: '' }))
          }}
          error={errors.label}
          disabled={isLoading}
          helperText="Contoh: Rumah, Kantor, Apartemen"
        />

        <Input
          label="Nama Penerima"
          value={recipientName}
          onChange={(e) => {
            setRecipientName(e.target.value)
            setErrors((prev) => ({ ...prev, recipient_name: '' }))
          }}
          error={errors.recipient_name}
          disabled={isLoading}
        />

        <Input
          label="Nomor HP"
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value)
            setErrors((prev) => ({ ...prev, phone: '' }))
          }}
          error={errors.phone}
          disabled={isLoading}
          helperText="Contoh: 081234567890"
        />

        <Input
          label="Alamat Lengkap"
          value={addressLine}
          onChange={(e) => {
            setAddressLine(e.target.value)
            setErrors((prev) => ({ ...prev, address: '' }))
          }}
          error={errors.address}
          disabled={isLoading}
          textarea
          rows={3}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Kecamatan"
            value={district}
            onChange={(e) => {
              setDistrict(e.target.value)
              setErrors((prev) => ({ ...prev, district: '' }))
            }}
            error={errors.district}
            disabled={isLoading}
          />
          <Input
            label="Kota/Kabupaten"
            value={city}
            onChange={(e) => {
              setCity(e.target.value)
              setErrors((prev) => ({ ...prev, city: '' }))
            }}
            error={errors.city}
            disabled={isLoading}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Provinsi"
            value={province}
            onChange={(e) => {
              setProvince(e.target.value)
              setErrors((prev) => ({ ...prev, province: '' }))
            }}
            error={errors.province}
            disabled={isLoading}
          />
          <Input
            label="Kode Pos"
            inputMode="numeric"
            pattern="[0-9]{5}"
            value={postalCode}
            onChange={(e) => {
              setPostalCode(e.target.value)
              setErrors((prev) => ({ ...prev, postal_code: '' }))
            }}
            error={errors.postal_code}
            disabled={isLoading}
          />
        </div>

        <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <Checkbox
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            disabled={isLoading || address?.is_default} // Cannot unset default if it's already default for an existing address
          />
          Jadikan alamat utama
        </label>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isLoading}>
            Batal
          </Button>
          <Button type="submit" isLoading={isLoading}>
            {address ? 'Simpan Perubahan' : 'Tambah Alamat'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
