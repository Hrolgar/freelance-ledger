import { useEffect, useState } from 'react'
import { deleteExchangeRate, getExchangeRates, upsertExchangeRate } from '../api'
import { AppCard, Button, EmptyState, ErrorState, Field, Input, PageIntro, Select, SectionHeading } from '../components/ui'
import type { ExchangeRateInput } from '../types'
import { CURRENCIES } from '../types'

const now = new Date()

const emptyRate: ExchangeRateInput = {
  currency: 'USD',
  month: now.getMonth() + 1,
  year: now.getFullYear(),
  rate: 0,
}

export default function Settings() {
  const [rates, setRates] = useState<Array<ExchangeRateInput & { id: number }>>([])
  const [draft, setDraft] = useState<ExchangeRateInput>(emptyRate)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getExchangeRates()
      setRates(data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to load exchange rates.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const handleUpsert = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    try {
      await upsertExchangeRate(draft)
      setDraft(emptyRate)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to save exchange rate.')
    }
  }

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this exchange rate?')) return
    try {
      await deleteExchangeRate(id)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to delete exchange rate.')
    }
  }

  return (
    <div className="space-y-6">
      <PageIntro
        title="Settings"
        description="Monthly exchange rates used when calculating NOK equivalents."
      />

      {error && <ErrorState message={error} onRetry={() => void load()} />}

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <AppCard>
          <SectionHeading
            title="Exchange Rates"
            description="One rate per currency, month, and year."
          />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-left">
                  <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Currency</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Month</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Year</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">Rate to NOK</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {!loading && rates.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8">
                      <EmptyState
                        title="No exchange rates configured"
                        description="Add rates so the ledger has NOK reference values for each month."
                      />
                    </td>
                  </tr>
                ) : null}
                {rates.map((rate) => (
                  <tr key={rate.id} className="border-b border-slate-700/50 last:border-0">
                    <td className="px-4 py-2.5 font-mono font-medium text-slate-100">{rate.currency}</td>
                    <td className="px-4 py-2.5 text-slate-400">{rate.month}</td>
                    <td className="px-4 py-2.5 text-slate-400">{rate.year}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-200">
                      {rate.rate.toFixed(4)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Button variant="danger" className="px-2 text-xs" onClick={() => void handleDelete(rate.id)}>
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AppCard>

        <AppCard>
          <SectionHeading title="Upsert Rate" description="Create or update the rate for a currency/month/year." />
          <form className="grid gap-3 p-4" onSubmit={handleUpsert}>
            <Field label="Currency">
              <Select
                value={draft.currency}
                onChange={(e) => setDraft((c) => ({ ...c, currency: e.target.value as ExchangeRateInput['currency'] }))}
              >
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
            <div className="grid gap-3 grid-cols-2">
              <Field label="Month">
                <Input
                  type="number"
                  min="1"
                  max="12"
                  value={draft.month}
                  onChange={(e) => setDraft((c) => ({ ...c, month: Number(e.target.value) }))}
                />
              </Field>
              <Field label="Year">
                <Input
                  type="number"
                  min="2020"
                  value={draft.year}
                  onChange={(e) => setDraft((c) => ({ ...c, year: Number(e.target.value) }))}
                />
              </Field>
            </div>
            <Field label="Rate to NOK">
              <Input
                type="number"
                min="0"
                step="0.0001"
                value={draft.rate}
                onChange={(e) => setDraft((c) => ({ ...c, rate: Number(e.target.value) }))}
              />
            </Field>
            <div className="flex justify-end">
              <Button type="submit">Upsert Rate</Button>
            </div>
          </form>
        </AppCard>
      </div>
    </div>
  )
}
