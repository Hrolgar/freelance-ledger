import { convertAmount, formatCurrency } from '../lib/format'
import { useMainCurrency } from '../lib/useMainCurrency'
import { useRates } from '../lib/rates'
import type { Currency } from '../types'

/// An amount in its own currency, with the display-currency equivalent on hover.
///
/// Pass `date` (YYYY-MM-DD) or `month`/`year` for money that belongs to a month, e.g.
/// a paid milestone, so it converts at THAT month's rate. Without one it converts at
/// the current month, which is right for money that is still outstanding. It used to
/// take whichever rate row came first in the list, i.e. the newest month, for every
/// amount regardless of when it was paid.
export function MoneyAmount({ amount, currency, className = '', date, month, year }: {
  amount: number
  currency: Currency
  className?: string
  date?: string | null
  month?: number
  year?: number
}) {
  const [mainCurrency] = useMainCurrency()
  const rates = useRates()
  const when = date ? { month: Number(date.slice(5, 7)), year: Number(date.slice(0, 4)) } : { month, year }
  const converted = currency === mainCurrency ? null : convertAmount(amount, currency, mainCurrency, rates, when.month, when.year)
  const hasConversion = converted !== null

  if (!hasConversion) {
    // Same footprint as the converted form, so the first paint (before the rate table
    // has loaded) does not shift the row when the glyph appears.
    return (
      <span className={`inline-flex items-baseline gap-1 font-mono tabular-nums ${className}`}>
        <span>{formatCurrency(amount, currency)}</span>
        {currency !== mainCurrency && <span className="text-[9px] leading-none opacity-0" aria-hidden="true">▾</span>}
      </span>
    )
  }

  return (
    <span className={`group relative inline-flex items-baseline gap-1 cursor-help font-mono tabular-nums ${className}`}>
      <span>{formatCurrency(amount, currency)}</span>
      <span className="text-[9px] leading-none opacity-60 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--accent)' }} aria-hidden="true">▾</span>
      <span
        className="pointer-events-none absolute bottom-full right-0 z-10 mb-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-mono tabular-nums shadow-xl opacity-0 transition-opacity group-hover:opacity-100"
        style={{
          border: '1px solid var(--border-default)',
          background: 'var(--bg-elevated)',
          color: 'var(--text-secondary)',
        }}
      >
        {formatCurrency(converted, mainCurrency)}
      </span>
    </span>
  )
}

/// The VAT and gross for an amount that has VAT applied, shown as a quiet second line.
/// `amount` stays the net figure everywhere else in the app -- this is additive, never a
/// replacement, and renders nothing at all when vatRate is null (no VAT charged).
export function VatNote({ vatRate, vatAmount, totalDue, currency }: {
  vatRate: number | null
  vatAmount: number | null
  totalDue: number
  currency: Currency
}) {
  if (vatRate === null) return null

  return (
    <p className="mt-0.5 text-xs font-normal" style={{ color: 'var(--text-tertiary)' }}>
      +{vatRate}% VAT {formatCurrency(vatAmount ?? 0, currency)} · Gross {formatCurrency(totalDue, currency)}
    </p>
  )
}
