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

  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }

  return (
    <div className={`fixed inset-0 flex items-center justify-center p-4 ${nested ? 'z-[60]' : 'z-50'}`}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div className={`relative w-full ${widths[size]} rounded-lg border shadow-2xl`} style={{ borderColor: 'var(--border-default)', background: 'var(--bg-elevated)' }}>
        <header className="flex items-center justify-between gap-4 px-6 py-4" style={{ borderBottom: '1px solid var(--border-faint)' }}>
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
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
          {children}
        </div>
      </div>
    </div>
  )
}
