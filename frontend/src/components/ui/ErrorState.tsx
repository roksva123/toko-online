import { ReactNode } from 'react'

interface ErrorStateProps {
  icon?: ReactNode
  title: string
  message: string
  action?: ReactNode
}

export function ErrorState({
  icon = '⚠️',
  title,
  message,
  action,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="text-5xl mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 mb-6 max-w-sm">{message}</p>
      {action && <div>{action}</div>}
    </div>
  )
}
