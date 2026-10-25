import { useEffect, useState } from 'react'

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(date: string | Date, showTime = false): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date

  return new Intl.DateTimeFormat('id-ID', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...(showTime && {
      hour: '2-digit',
      minute: '2-digit',
    }),
  }).format(dateObj)
}

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => clearTimeout(handler)
  }, [value, delay])

  return debouncedValue
}

export function preventOpenRedirect(url: string): string {
  try {
    const urlObj = new URL(url, window.location.origin)
    // Hanya terima path internal (sama origin)
    if (urlObj.origin === window.location.origin) {
      return url
    }
  } catch {
    // Invalid URL
  }
  return '/'
}
