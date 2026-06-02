import { useEffect, type ReactNode } from 'react'

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
  nested?: boolean
}

export function Modal({ title, onClose, children, size = 'md', nested }: ModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const widths = { sm: 'lg:max-w-sm', md: 'lg:max-w-lg', lg: 'lg:max-w-2xl' }

  return (
    <div className={`fixed inset-0 flex items-stretch justify-center p-0 lg:items-center lg:p-4 ${nested ? 'z-[60]' : 'z-50'}`}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div className={`relative flex h-full w-full max-w-none flex-col rounded-none border shadow-2xl lg:h-auto lg:w-full ${widths[size]} lg:rounded-lg`} style={{ borderColor: 'var(--border-default)', background: 'var(--bg-elevated)' }}>
        <header className="flex shrink-0 items-center justify-between gap-4 px-6 py-4" style={{ borderBottom: '1px solid var(--border-faint)' }}>
          <h2 className="text-xl font-semibold tracking-tight" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>{title}</h2>
          <button
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-md transition-colors"
            style={{ color: 'var(--text-tertiary)' }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-overlay)';
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = '';
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-tertiary)'
            }}
            aria-label="Close"
          >
            ×
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-5 lg:flex-none lg:max-h-[70vh]">
          {children}
        </div>
      </div>
    </div>
  )
}
