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
  className,
}: PropsWithChildren<{ className?: string }>) {
  return (
    <section
      className={cx(
        'rounded-2xl border border-zinc-700/80 bg-zinc-800/80 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.85)] backdrop-blur',
        className,
      )}
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
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-300">
          Freelance operations
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">{title}</h1>
        <p className="max-w-3xl text-sm leading-6 text-zinc-400 sm:text-base">{description}</p>
      </div>
      {action}
    </div>
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
    <div className="flex flex-col gap-4 border-b border-zinc-700/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-white">{title}</h2>
        {description ? <p className="mt-1 text-sm text-zinc-400">{description}</p> : null}
      </div>
      {action}
    </div>
  )
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <AppCard className="p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">{label}</p>
      <p
        className="mt-4 text-2xl font-semibold tracking-tight text-white sm:text-3xl"
        style={{ fontFamily: '"JetBrains Mono", monospace' }}
      >
        {value}
      </p>
      {hint ? <p className="mt-2 text-sm text-zinc-400">{hint}</p> : null}
    </AppCard>
  )
}

export function Button({
  className,
  variant = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
}) {
  const variants = {
    primary:
      'bg-indigo-500 text-white hover:bg-indigo-400 focus-visible:outline-indigo-300 disabled:bg-indigo-500/40',
    secondary:
      'bg-zinc-700 text-zinc-100 hover:bg-zinc-600 focus-visible:outline-zinc-300 disabled:bg-zinc-700/60',
    ghost:
      'bg-transparent text-zinc-200 hover:bg-zinc-800 focus-visible:outline-zinc-300 disabled:text-zinc-500',
    danger:
      'bg-rose-500/90 text-white hover:bg-rose-400 focus-visible:outline-rose-300 disabled:bg-rose-500/40',
  }

  return (
    <button
      className={cx(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed',
        variants[variant],
        className,
      )}
      {...props}
    />
  )
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className="min-h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950/80 px-3 py-2 text-sm text-white outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30"
      {...props}
    />
  )
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className="min-h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950/80 px-3 py-2 text-sm text-white outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30"
      {...props}
    />
  )
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className="min-h-28 w-full rounded-xl border border-zinc-700 bg-zinc-950/80 px-3 py-2 text-sm text-white outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30"
      {...props}
    />
  )
}

export function Checkbox(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      className="h-5 w-5 rounded border-zinc-600 bg-zinc-900 text-indigo-500 focus:ring-indigo-500/40"
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
    <label className="space-y-2 text-sm text-zinc-300">
      <span className="block">
        {label} {required ? <span className="text-indigo-300">*</span> : null}
      </span>
      {children}
    </label>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/60 px-6 py-10 text-center">
      <h3 className="text-base font-medium text-white">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-zinc-400">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
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
    <AppCard className="border-rose-500/30 bg-rose-500/10 p-5">
      <p className="text-sm font-medium text-rose-100">{message}</p>
      {onRetry ? (
        <Button className="mt-4" variant="secondary" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </AppCard>
  )
}

export function LoadingState({ label = 'Loading data…' }: { label?: string }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          aria-label={label}
          className="h-32 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-800/70"
        />
      ))}
    </div>
  )
}
