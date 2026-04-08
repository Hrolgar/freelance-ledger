import { useEffect, useState } from 'react'
import { getExchangeRates } from '../api'
import { formatCurrency } from '../lib/format'
import { useMainCurrency } from '../lib/useMainCurrency'
import type { ExchangeRate } from '../types'

// Module-level cache so we don't refetch rates on every render
const rateCache: Record<string, ExchangeRate[]> = {}

function useRates() {
  const [rates, setRates] = useState<ExchangeRate[]>([])

  useEffect(() => {
    const key = 'all'
    if (rateCache[key]) {
      setRates(rateCache[key])
      return
    }
    getExchangeRates().then((data) => {
      rateCache[key] = data
      setRates(data)
    }).catch(() => {})
  }, [])

  return rates
}

function convert(amount: number, fromCurrency: string, toCurrency: string, rates: ExchangeRate[]): number | null {
  if (fromCurrency === toCurrency) return null
  // Find rates for any month (use the latest available)
  const fromRate = fromCurrency === 'NOK' ? 1 : rates.find((r) => r.currency === fromCurrency)?.rate
  const toRate = toCurrency === 'NOK' ? 1 : rates.find((r) => r.currency === toCurrency)?.rate
  if (!fromRate || !toRate) return null
  return (amount * fromRate) / toRate
}

/** Inline money display with hover tooltip showing main currency conversion */
export function MoneyAmount({ amount, currency, className = '' }: {
  amount: number
  currency: string
  className?: string
}) {
  const [mainCurrency] = useMainCurrency()
  const rates = useRates()
  const converted = convert(amount, currency, mainCurrency, rates)
  const hasConversion = converted !== null

  if (!hasConversion) {
    return <span className={`font-mono ${className}`}>{formatCurrency(amount, currency)}</span>
  }

  return (
    <span className={`group relative cursor-help border-b border-dashed border-slate-600 font-mono ${className}`}>
      {formatCurrency(amount, currency)}
      <span className="pointer-events-none absolute bottom-full right-0 z-10 mb-1.5 whitespace-nowrap rounded bg-slate-700 px-2 py-1 text-xs font-medium text-blue-300 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
        {formatCurrency(converted, mainCurrency)}
      </span>
    </span>
  )
}
