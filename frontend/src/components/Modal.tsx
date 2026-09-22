import { useEffect, useRef, type ReactNode } from 'react'
import { ErrorState } from './ui'

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  nested?: boolean
  /// Lets the body use most of the screen height, for sheet-like content that is
  /// scrolled through rather than a form that is read top to bottom.
  tall?: boolean
  /// The page's current error, shown INSIDE the modal. Every page keeps its error
  /// banner at the top of the page, which is behind the backdrop while a modal is
  /// open, so a refused save used to look like nothing happened.
  error?: string | null
}

/// Open modals, innermost last. Escape closes only the top one: with a listener per
/// instance, Escape in the nested New Client modal also closed Add Project underneath
/// it and dropped the draft.
const stack: symbol[] = []

const FOCUSABLE = 'input:not([type=hidden]), select, textarea, button:not([data-modal-close]), a[href], [tabindex]:not([tabindex="-1"])'

export function Modal({ title, onClose, children, size = 'md', nested, tall, error }: ModalProps) {
  const id = useRef(Symbol('modal')).current
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    stack.push(id)
    const previouslyFocused = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Focus the first field so typing can start at once, and Tab stays inside.
    const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)
    first?.focus()

    const handler = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== id) return
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current()
        return
      }
      if (e.key === 'Tab' && panelRef.current) {
        const items = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !el.hasAttribute('disabled'))
        if (items.length === 0) return
        const firstItem = items[0]
        const lastItem = items[items.length - 1]
        if (e.shiftKey && document.activeElement === firstItem) {
          e.preventDefault()
          lastItem.focus()
        } else if (!e.shiftKey && document.activeElement === lastItem) {
          e.preventDefault()
          firstItem.focus()
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
      stack.splice(stack.indexOf(id), 1)
      if (stack.length === 0) document.body.style.overflow = previousOverflow
      previouslyFocused?.focus?.()
    }
  }, [id])

  const widths = { sm: 'lg:max-w-sm', md: 'lg:max-w-lg', lg: 'lg:max-w-2xl', xl: 'lg:max-w-3xl', '2xl': 'lg:max-w-6xl' }

  return (
    <div className={`fixed inset-0 flex items-stretch justify-center p-0 lg:items-center lg:p-4 ${nested ? 'z-[60]' : 'z-50'}`}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative flex h-full w-full max-w-none flex-col rounded-none border shadow-2xl lg:h-auto lg:w-full ${widths[size]} lg:rounded-lg`}
        style={{ borderColor: 'var(--border-default)', background: 'var(--bg-elevated)' }}
      >
        <header className="flex shrink-0 items-center justify-between gap-4 px-6 py-4" style={{ borderBottom: '1px solid var(--border-faint)' }}>
          <h2 className="text-xl font-semibold tracking-tight" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>{title}</h2>
          <button
            type="button"
            data-modal-close
            onClick={onClose}
            className="flex size-11 items-center justify-center rounded-md text-xl leading-none transition-colors lg:size-8 lg:text-base"
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
        <div className={`flex-1 overflow-y-auto px-6 py-5 lg:flex-none ${tall ? 'lg:max-h-[86vh]' : 'lg:max-h-[70vh]'}`}>
          {error && <div className="mb-4"><ErrorState message={error} /></div>}
          {children}
        </div>
      </div>
    </div>
  )
}
