import { useEffect, useState } from 'react'
import { autoFetchRates, getExchangeRates } from '../api'
import { AppCard, Button, ErrorState, PageIntro, SectionHeading, Select } from '../components/ui'
import { useMainCurrency } from '../lib/useMainCurrency'
import { useMyTimezone } from '../lib/useMyTimezone'
import type { ExchangeRate } from '../types'
import { CURRENCIES, MONTH_NAMES, TIMEZONES } from '../types'

export default function Settings() {
  const [rates, setRates] = useState<ExchangeRate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fetching, setFetching] = useState<string | null>(null)
  const [mainCurrency, setMainCurrency] = useMainCurrency()
  const [myTimezone, setMyTimezone] = useMyTimezone()

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      setRates(await getExchangeRates())
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to load rates.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  // Group rates by year-month
  const grouped = rates.reduce<Record<string, ExchangeRate[]>>((acc, r) => {
    const key = `${r.year}-${String(r.month).padStart(2, '0')}`
    ;(acc[key] ??= []).push(r)
    return acc
  }, {})

  const sortedKeys = Object.keys(grouped).sort().reverse()

  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()

  // Months that could be fetched (current and past, up to 12 months back)
  const fetchableMonths: Array<{ month: number; year: number; label: string }> = []
  for (let i = 0; i < 12; i++) {
    const d = new Date(currentYear, currentMonth - 1 - i, 1)
    const m = d.getMonth() + 1
    const y = d.getFullYear()
    const key = `${y}-${String(m).padStart(2, '0')}`
    if (!grouped[key] || grouped[key].length < 5) {
      fetchableMonths.push({ month: m, year: y, label: `${MONTH_NAMES[m - 1]} ${y}` })
    }
  }

  const handleFetch = async (month: number, year: number) => {
    const key = `${year}-${month}`
    setFetching(key)
    try {
      await autoFetchRates(month, year)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to fetch rates.')
    } finally {
      setFetching(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageIntro
        title="Settings"
        description="Exchange rates and display preferences."
      />

      {error && <ErrorState message={error} onRetry={() => void load()} />}

      {/* Preferences */}
      <AppCard>
        <SectionHeading title="Preferences" />
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-slate-500 mb-1.5">Display Currency</p>
            <Select
              value={mainCurrency}
              onChange={(e) => setMainCurrency(e.target.value as typeof mainCurrency)}
              className="w-full"
            >
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
            <p className="mt-1 text-xs text-slate-500">Totals and conversions use this currency.</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1.5">My Timezone</p>
            <Select
              value={myTimezone}
              onChange={(e) => setMyTimezone(e.target.value)}
              className="w-full"
            >
              {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </Select>
            <p className="mt-1 text-xs text-slate-500">Client clocks show offset relative to this.</p>
          </div>
        </div>
      </AppCard>

      {/* Exchange rates */}
      <AppCard>
        <SectionHeading
          title="Exchange Rates"
          description="Auto-fetched from ECB via frankfurter.app. Rates are final for past months."
          action={
            fetchableMonths.length > 0 ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Fetch missing:</span>
                {fetchableMonths.slice(0, 3).map(({ month, year, label }) => (
                  <Button
                    key={`${year}-${month}`}
                    variant="secondary"
                    className="text-xs"
                    disabled={fetching !== null}
                    onClick={() => void handleFetch(month, year)}
                  >
                    {fetching === `${year}-${month}` ? 'Fetching...' : label}
                  </Button>
                ))}
              </div>
            ) : null
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-left">
                <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Month</th>
                {['GBP', 'USD', 'EUR', 'CAD', 'INR'].map((c) => (
                  <th key={c} className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">
                    1 {c} =
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-500">Loading...</td></tr>
              )}
              {!loading && sortedKeys.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-500">No rates yet. Click a fetch button above.</td></tr>
              )}
              {sortedKeys.map((key) => {
                const group = grouped[key]
                const [y, m] = key.split('-').map(Number)
                const rateMap = Object.fromEntries(group.map((r) => [r.currency, r.rate]))
                return (
                  <tr key={key} className="border-b border-slate-700/50 last:border-0">
                    <td className="px-4 py-2.5 font-medium text-slate-200">
                      {MONTH_NAMES[m - 1]} {y}
                    </td>
                    {['GBP', 'USD', 'EUR', 'CAD', 'INR'].map((c) => (
                      <td key={c} className="px-4 py-2.5 text-right font-mono text-slate-300">
                        {rateMap[c] !== undefined ? `${rateMap[c].toFixed(4)} NOK` : '—'}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </AppCard>
    </div>
  )
}
