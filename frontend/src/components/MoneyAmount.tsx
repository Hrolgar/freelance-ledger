import { useEffect, useState } from 'react'
import { getExchangeRates } from '../api'
import { formatCurrency } from '../lib/format'
import { useMainCurrency } from '../lib/useMainCurrency'
import type { ExchangeRate } from '../types'

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
  const fromRate = fromCurrency === 'NOK' ? 1 : rates.find((r) => r.currency === fromCurrency)?.rate
  const toRate = toCurrency === 'NOK' ? 1 : rates.find((r) => r.currency === toCurrency)?.rate
  if (!fromRate || !toRate) return null
  return (amount * fromRate) / toRate
}

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
    return (
      <span className={`font-mono tabular-nums ${className}`} style={{ color: 'var(--text-primary)' }}>
        {formatCurrency(amount, currency)}
      </span>
    )
  }

  return (
    <span className={`group relative cursor-help font-mono tabular-nums ${className}`}>
      {formatCurrency(amount, currency)}
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
