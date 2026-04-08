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

// Surface card — solid bg, 6px radius, no glassmorphism
export function AppCard({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) {
  return (
    <section
      className={cx(
        'overflow-hidden rounded-md border border-slate-700 bg-slate-800',
        className,
      )}
    >
      {children}
    </section>
  )
}

// Page title — no "Freelance operations" subtitle, no huge text
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
    <div className="flex items-center justify-between gap-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-100">{title}</h1>
        {description ? <p className="mt-0.5 text-sm text-slate-400">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

// Section heading inside a card — tight, no over-sized text
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
    <div className="flex items-center justify-between gap-4 border-b border-slate-700 px-4 py-3">
      <div>
        <p className="text-sm font-medium text-slate-200">{title}</p>
        {description ? <p className="mt-0.5 text-xs text-slate-400">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

// Compact stat — no oversized numbers, tight padding
export function StatCard({
  label,
  value,
  hint,
}: {
  label: string
  value: React.ReactNode
  hint?: string
}) {
  return (
    <div className="rounded-md border border-slate-700 bg-slate-800 px-4 py-3">
      <p className="text-xs text-slate-400">{label}</p>
      <div className="mt-1 font-mono text-base font-semibold text-slate-100">{value}</div>
      {hint ? <p className="mt-0.5 text-xs text-slate-500">{hint}</p> : null}
    </div>
  )
}

// Button — 36px min height, 6px radius, proper states
export function Button({
  className,
  variant = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
}) {
  const variants: Record<string, string> = {
    primary:
      'bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700 disabled:bg-blue-500/40',
    secondary:
      'border border-slate-600 bg-slate-700 text-slate-200 hover:bg-slate-600 active:bg-slate-500 disabled:opacity-50',
    ghost:
      'text-slate-400 hover:text-slate-200 hover:bg-slate-700 active:bg-slate-600 disabled:opacity-40',
    danger:
      'text-red-400 hover:text-white hover:bg-red-600 active:bg-red-700 disabled:opacity-40',
  }

  return (
    <button
      className={cx(
        'inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f1117] disabled:cursor-not-allowed select-none',
        variants[variant],
        className,
      )}
      {...props}
    />
  )
}

// Input — bg matches page bg for contrast against card bg
export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className="h-9 w-full rounded-md border border-slate-700 bg-[#0f1117] px-3 text-sm text-slate-200 placeholder:text-slate-500 transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 disabled:opacity-50"
      {...props}
    />
  )
}

// Select
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className="h-9 w-full rounded-md border border-slate-700 bg-[#0f1117] px-3 text-sm text-slate-200 transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 disabled:opacity-50"
      {...props}
    />
  )
}

// Textarea
export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={3}
      className="w-full rounded-md border border-slate-700 bg-[#0f1117] px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 disabled:opacity-50 resize-y"
      {...props}
    />
  )
}

// Checkbox
export function Checkbox(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      className="h-4 w-4 cursor-pointer rounded-sm border border-slate-600 bg-[#0f1117] accent-blue-500 focus:ring-blue-500/40"
      {...props}
    />
  )
}

// Field — visible label above input, not just placeholder
export function Field({
  label,
  required,
  children,
}: PropsWithChildren<{ label: string; required?: boolean }>) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-slate-400">
        {label}
        {required ? <span className="ml-1 text-red-400">*</span> : null}
      </label>
      {children}
    </div>
  )
}

// Empty state — helpful message, action
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
      <p className="text-sm font-medium text-slate-300">{title}</p>
      {description ? (
        <p className="mt-1 text-xs text-slate-500">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

// Error state — red border, what went wrong, retry button
export function ErrorState({
  message,
  onRetry,
}: {
  message: string
  onRetry?: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="text-red-400">!</span>
        <p className="text-sm text-red-300">{message}</p>
      </div>
      {onRetry ? (
        <Button variant="secondary" className="shrink-0 text-xs" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  )
}

// Loading skeleton — shimmer, not bouncing pulse cards
export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div aria-label={label} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-[64px]" />
        ))}
      </div>
      <div className="skeleton h-[160px]" />
      <div className="grid gap-3 xl:grid-cols-2">
        <div className="skeleton h-[120px]" />
        <div className="skeleton h-[120px]" />
      </div>
    </div>
  )
}
