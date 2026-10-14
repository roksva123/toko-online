export function Spinner({ fullscreen = false }: { fullscreen?: boolean }) {
  const content = (
    <div className="flex items-center justify-center gap-2">
      <div className="w-4 h-4 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
      <div className="w-4 h-4 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
      <div className="w-4 h-4 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
  )

  if (fullscreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm">
        {content}
      </div>
    )
  }

  return content
}
