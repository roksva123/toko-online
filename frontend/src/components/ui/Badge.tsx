import { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type BadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'pending'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-gray-100 text-gray-800',
  success: 'bg-green-100 text-green-800',
  warning: 'bg-yellow-100 text-yellow-800',
  danger: 'bg-red-100 text-red-800',
  info: 'bg-blue-100 text-blue-800',
  pending: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  shipped: 'bg-cyan-100 text-cyan-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-800',
}

export function Badge({ variant = 'default', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-block px-2.5 py-1 text-xs font-medium rounded-full',
        variantStyles[variant],
        className
      )}
      {...props}
    />
  )
}

// Status badge untuk order/payment
export function StatusBadge({ status }: { status: string }) {
  const statusMap: Record<string, BadgeVariant> = {
    pending_payment: 'pending',
    waiting_confirmation: 'pending',
    processing: 'processing',
    shipped: 'shipped',
    delivered: 'delivered',
    cancelled: 'cancelled',
    confirmed: 'success',
    rejected: 'danger',
  }

  const statusLabelMap: Record<string, string> = {
    pending_payment: 'Menunggu Pembayaran',
    waiting_confirmation: 'Menunggu Konfirmasi',
    processing: 'Diproses',
    shipped: 'Dikirim',
    delivered: 'Tiba',
    cancelled: 'Dibatalkan',
    confirmed: 'Terkonfirmasi',
    rejected: 'Ditolak',
  }

  return (
    <Badge variant={statusMap[status] || 'default'}>
      {statusLabelMap[status] || status}
    </Badge>
  )
}
