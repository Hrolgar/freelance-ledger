import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  PropsWithChildren,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}

export function AppCard({
  children,
  className = '',
}: PropsWithChildren<{ className?: string }>) {
  return (
    <section
      className={cx('overflow-hidden rounded-lg', className)}
      style={{ border: '1px solid var(--border-faint)', background: 'var(--bg-surface)' }}
    >
      {children}
    </section>
  )
}

export function PageIntro({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <header className="flex items-start justify-between gap-6 mb-10">
      <div>
        <h1
          className="text-[36px] font-semibold tracking-tight leading-none"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
        >
          {title}
        </h1>
        {description && (
          <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{description}</p>
        )}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </header>
  )
}

export function SectionHeading({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <header
      className="flex items-end justify-between gap-4 px-5 pt-5 pb-4"
      style={{ borderBottom: '1px solid var(--border-faint)' }}
    >
      <div>
        <h2
          className="text-lg font-semibold tracking-tight"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
        >
          {title}
        </h2>
        {description && (
          <p className="mt-0.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>{description}</p>
        )}
      </div>
      {action}
    </header>
  )
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string
  value: ReactNode
  hint?: string
}) {
  return (
    <div
      className="rounded-lg p-5"
      style={{ border: '1px solid var(--border-faint)', background: 'var(--bg-surface)' }}
    >
      <p
        className="text-[11px] font-semibold uppercase tracking-[0.12em]"
        style={{ color: 'var(--text-tertiary)' }}
      >
        {label}
      </p>
      <p
        className="mt-2 text-[28px] font-semibold tracking-tight tnum"
        style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
      >
        {value}
      </p>
      {hint && (
        <p className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>{hint}</p>
      )}
    </div>
  )
}

export function Button({
  className,
  variant = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
}) {
  const base = 'inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none disabled:cursor-not-allowed select-none'

  const variants: Record<string, string> = {
    primary: '',
    secondary: '',
    ghost: '',
    danger: '',
  }

  const inlineStyles: Record<string, React.CSSProperties> = {
    primary: { background: 'var(--accent)', color: 'var(--bg-base)' },
    secondary: { border: '1px solid var(--border-default)', background: 'var(--bg-surface)', color: 'var(--text-primary)' },
    ghost: { background: 'transparent', color: 'var(--text-secondary)' },
    danger: { background: 'transparent', color: 'var(--overdue)' },
  }

  return (
    <button
      className={cx(base, variants[variant], className)}
      style={inlineStyles[variant]}
      {...props}
    />
  )
}

const inputBase = 'w-full rounded-md px-3 py-2 text-sm transition-colors focus:outline-none'

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cx('h-9', inputBase)}
      style={{
        border: '1px solid var(--border-default)',
        background: 'var(--bg-base)',
        color: 'var(--text-primary)',
      }}
      {...props}
    />
  )
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cx('h-9', inputBase)}
      style={{
        border: '1px solid var(--border-default)',
        background: 'var(--bg-base)',
        color: 'var(--text-primary)',
      }}
      {...props}
    />
  )
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={3}
      className={cx(inputBase, 'resize-y')}
      style={{
        border: '1px solid var(--border-default)',
        background: 'var(--bg-base)',
        color: 'var(--text-primary)',
      }}
      {...props}
    />
  )
}

export function Checkbox(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      className="h-4 w-4 cursor-pointer rounded-sm"
      style={{ border: '1px solid var(--border-default)', background: 'var(--bg-base)', accentColor: 'var(--accent)' }}
      {...props}
    />
  )
}

export function Field({
  label,
  required,
  children,
}: PropsWithChildren<{ label: string; required?: boolean }>) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
        {label}
        {required && <span className="ml-1" style={{ color: 'var(--overdue)' }}>*</span>}
      </label>
      {children}
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center py-8 text-center">
      <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{title}</p>
      {description && (
        <p className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string
  onRetry?: () => void
}) {
  return (
    <div
      className="flex items-center justify-between gap-4 rounded-md px-4 py-3"
      style={{ border: '1px solid #c9726430', background: '#c9726410' }}
    >
      <div className="flex items-center gap-2">
        <span style={{ color: 'var(--overdue)' }}>!</span>
        <p className="text-sm" style={{ color: 'var(--overdue)' }}>{message}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" className="shrink-0 text-xs" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  )
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div aria-label={label} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton h-[90px]" />
        ))}
      </div>
      <div className="skeleton h-[220px]" />
      <div className="grid gap-3 xl:grid-cols-2">
        <div className="skeleton h-[160px]" />
        <div className="skeleton h-[160px]" />
      </div>
    </div>
  )
}
