import { useState, useEffect } from 'react'
import { getExchangeRates, upsertExchangeRate, deleteExchangeRate } from '../api'
import type { ExchangeRate } from '../types'
import { CURRENCIES } from '../types'
import { Modal } from '../components/Modal'
import {
  AppCard, Button, SectionHeading, PageIntro, EmptyState, ErrorState, LoadingState,
  Input, Select, Field,
} from '../components/ui'
import { formatCurrency } from '../lib/format'

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'][i],
}))
const YEARS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i)

interface RateForm {
  currency: string; month: string; year: string; rate: string
}
const emptyRate = (): RateForm => ({
  currency: 'USD',
  month: String(new Date().getMonth() + 1),
  year: String(new Date().getFullYear()),
  rate: '',
})

export default function Settings() {
  const [rates, setRates] = useState<ExchangeRate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<RateForm>(emptyRate())
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)

  const load = () => {
    setLoading(true)
    getExchangeRates()
      .then(setRates)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await upsertExchangeRate({
        currency: form.currency as ExchangeRate['currency'],
        month: parseInt(form.month),
        year: parseInt(form.year),
        rate: parseFloat(form.rate) || 0,
      })
      setModal(false)
      setForm(emptyRate())
      load()
    } catch (e: unknown) { alert((e as Error).message) }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    try {
      await deleteExchangeRate(id)
      setDeleteConfirm(null)
      load()
    } catch (e: unknown) { alert((e as Error).message) }
  }

  const openEdit = (r: ExchangeRate) => {
    setForm({ currency: r.currency, month: String(r.month), year: String(r.year), rate: String(r.rate) })
    setModal(true)
  }

  if (loading) return <LoadingState label="Loading exchange rates" />
  if (error) return <ErrorState message={error} onRetry={load} />

  // Group by year
  const byYear = rates.reduce<Record<number, ExchangeRate[]>>((acc, r) => {
    const year = r.year
    if (!acc[year]) acc[year] = []
    acc[year].push(r)
    return acc
  }, {})
  const sortedYears = Object.keys(byYear).map(Number).sort((a, b) => b - a)

  return (
    <div className="space-y-8">
      <PageIntro
        title="Settings"
        description="Manage exchange rates used for NOK conversions in reports."
        action={<Button onClick={() => { setForm(emptyRate()); setModal(true) }}>Add Exchange Rate</Button>}
      />

      {rates.length === 0 ? (
        <AppCard className="p-8">
          <EmptyState
            title="No exchange rates configured"
            description="Add exchange rates to convert foreign currency revenue into NOK for reporting."
            action={<Button onClick={() => { setForm(emptyRate()); setModal(true) }}>Add your first rate</Button>}
          />
        </AppCard>
      ) : (
        sortedYears.map(year => (
          <AppCard key={year}>
            <SectionHeading title={`Exchange Rates — ${year}`} />
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-700/70 text-xs text-zinc-500 uppercase tracking-wider">
                  <th className="text-left px-5 py-3 font-medium">Currency</th>
                  <th className="text-left px-5 py-3 font-medium">Month</th>
                  <th className="text-right px-5 py-3 font-medium">Rate to NOK</th>
                  <th className="text-right px-5 py-3 font-medium">Example (100 units)</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {byYear[year]
                  .sort((a, b) => a.month - b.month || a.currency.localeCompare(b.currency))
                  .map(r => (
                    <tr key={r.id} className="border-b border-zinc-700/50 last:border-0 hover:bg-zinc-700/20 transition-colors group">
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-2">
                          <span className="font-mono text-sm font-semibold text-indigo-300">{r.currency}</span>
                        </span>
                      </td>
                      <td className="px-5 py-3 text-zinc-400">
                        {MONTHS[r.month - 1].label}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-zinc-200">{r.rate.toFixed(4)}</td>
                      <td className="px-5 py-3 text-right font-mono text-zinc-500">
                        {formatCurrency(100 * r.rate, 'NOK')}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEdit(r)} className="p-1 text-zinc-500 hover:text-zinc-200 transition-colors rounded">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button onClick={() => setDeleteConfirm(r.id)} className="p-1 text-zinc-500 hover:text-rose-400 transition-colors rounded">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </AppCard>
        ))
      )}

      {modal && (
        <Modal title="Exchange Rate" onClose={() => setModal(false)} size="sm">
          <form onSubmit={handleSave} className="space-y-4">
            <p className="text-xs text-zinc-500 bg-zinc-800/60 rounded-lg px-3 py-2">
              If a rate already exists for this currency + month + year, it will be updated.
            </p>
            <Field label="Currency">
              <Select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                {CURRENCIES.filter(c => c !== 'NOK').map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Month">
                <Select value={form.month} onChange={e => setForm(f => ({ ...f, month: e.target.value }))}>
                  {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </Select>
              </Field>
              <Field label="Year">
                <Select value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))}>
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="Rate to NOK" required>
              <Input
                type="number" min="0" step="0.0001" required
                value={form.rate}
                onChange={e => setForm(f => ({ ...f, rate: e.target.value }))}
                placeholder="14.23"
              />
              {form.rate && (
                <p className="mt-1 text-xs text-zinc-500">
                  1 {form.currency} = {parseFloat(form.rate).toFixed(4)} NOK
                </p>
              )}
            </Field>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" type="button" onClick={() => setModal(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Rate'}</Button>
            </div>
          </form>
        </Modal>
      )}

      {deleteConfirm !== null && (
        <Modal title="Delete Exchange Rate" onClose={() => setDeleteConfirm(null)} size="sm">
          <p className="text-sm text-zinc-400 mb-6">This will permanently delete this exchange rate.</p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => handleDelete(deleteConfirm)}>Delete</Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
