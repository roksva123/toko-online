import { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface BreadcrumbItem {
  label: string
  href?: string
  isActive?: boolean
}

interface BreadcrumbProps extends HTMLAttributes<HTMLOListElement> {
  items: BreadcrumbItem[]
}

export function Breadcrumb({ items, className, ...props }: BreadcrumbProps) {
  return (
    <ol
      className={cn('flex items-center gap-2 text-sm', className)}
      {...props}
    >
      {items.map((item, index) => (
        <li key={index} className="flex items-center gap-2">
          {item.href && !item.isActive ? (
            <a href={item.href} className="text-primary-600 hover:text-primary-700">
              {item.label}
            </a>
          ) : (
            <span className={item.isActive ? 'text-gray-900 font-medium' : 'text-gray-600'}>
              {item.label}
            </span>
          )}
          {index < items.length - 1 && (
            <span className="text-gray-400">/</span>
          )}
        </li>
      ))}
    </ol>
  )
}
