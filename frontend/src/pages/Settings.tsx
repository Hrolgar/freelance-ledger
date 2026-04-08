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
    <div className="space-y-8">
      <PageIntro
        title="Settings"
        description="Manage monthly exchange rates used by the ledger when revenue and investments need NOK context."
      />

      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <AppCard>
          <SectionHeading title="Exchange Rates" description="One rate per currency, month, and year." />
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-700/70 text-left text-xs uppercase tracking-[0.2em] text-zinc-500">
                  <th className="px-5 py-3 font-medium">Currency</th>
                  <th className="px-5 py-3 font-medium">Month</th>
                  <th className="px-5 py-3 font-medium">Year</th>
                  <th className="px-5 py-3 text-right font-medium">Rate to NOK</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {!loading && rates.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10">
                      <EmptyState
                        title="No exchange rates configured"
                        description="Upsert rates here so the ledger has a reliable NOK reference for each month."
                      />
                    </td>
                  </tr>
                ) : null}
                {rates.map((rate) => (
                  <tr key={rate.id} className="border-b border-zinc-700/50 last:border-0">
                    <td className="px-5 py-4 text-white">{rate.currency}</td>
                    <td className="px-5 py-4 text-zinc-300">{rate.month}</td>
                    <td className="px-5 py-4 text-zinc-300">{rate.year}</td>
                    <td
                      className="px-5 py-4 text-right text-zinc-100"
                      style={{ fontFamily: '"JetBrains Mono", monospace' }}
                    >
                      {rate.rate.toFixed(4)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Button variant="danger" onClick={() => void handleDelete(rate.id)}>
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
          <SectionHeading title="Upsert Rate" description="Create a new monthly rate or update the existing one for that period." />
          <form className="grid gap-4 p-5" onSubmit={handleUpsert}>
            <Field label="Currency">
              <Select
                value={draft.currency}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, currency: event.target.value as ExchangeRateInput['currency'] }))
                }
              >
                {CURRENCIES.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Month">
                <Input
                  type="number"
                  min="1"
                  max="12"
                  value={draft.month}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, month: Number(event.target.value) }))
                  }
                />
              </Field>
              <Field label="Year">
                <Input
                  type="number"
                  min="2020"
                  value={draft.year}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, year: Number(event.target.value) }))
                  }
                />
              </Field>
            </div>
            <Field label="Rate to NOK">
              <Input
                type="number"
                min="0"
                step="0.0001"
                value={draft.rate}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, rate: Number(event.target.value) }))
                }
              />
            </Field>
            <div className="flex justify-end">
              <Button type="submit">Upsert Exchange Rate</Button>
            </div>
          </form>
        </AppCard>
      </div>
    </div>
  )
}
