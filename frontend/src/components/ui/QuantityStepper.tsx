import { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface QuantityStepperProps extends ButtonHTMLAttributes<HTMLDivElement> {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  disabled?: boolean
}

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 999,
  disabled = false,
  className,
  ...props
}: QuantityStepperProps) {
  const handleDecrement = () => {
    if (value > min && !disabled) {
      onChange(value - 1)
    }
  }

  const handleIncrement = () => {
    if (value < max && !disabled) {
      onChange(value + 1)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(e.target.value) || min
    if (newValue >= min && newValue <= max && !disabled) {
      onChange(newValue)
    }
  }

  return (
    <div
      className={cn(
        'flex items-center border border-gray-300 rounded w-fit',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      {...props}
    >
      <button
        onClick={handleDecrement}
        disabled={value <= min || disabled}
        className="px-3 py-2 hover:bg-gray-50 disabled:hover:bg-transparent disabled:cursor-not-allowed"
        aria-label="Kurangi jumlah"
      >
        −
      </button>
      <input
        type="number"
        value={value}
        onChange={handleInputChange}
        disabled={disabled}
        min={min}
        max={max}
        className="w-12 text-center border-0 outline-none"
      />
      <button
        onClick={handleIncrement}
        disabled={value >= max || disabled}
        className="px-3 py-2 hover:bg-gray-50 disabled:hover:bg-transparent disabled:cursor-not-allowed"
        aria-label="Tambah jumlah"
      >
        +
      </button>
    </div>
  )
}
