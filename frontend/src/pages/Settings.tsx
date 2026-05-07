import { useEffect, useState } from 'react'
import { autoFetchRates, createPlatform, deletePlatform, getExchangeRates, getPlatforms, updatePlatform } from '../api'
import { AppCard, Button, ErrorState, Field, Input, PageIntro, SectionHeading, Select } from '../components/ui'
import { Modal } from '../components/Modal'
import { useMainCurrency } from '../lib/useMainCurrency'
import { useMyTimezone } from '../lib/useMyTimezone'
import type { ExchangeRate, Platform, PlatformInput } from '../types'
import { CURRENCIES, MONTH_NAMES, TIMEZONES } from '../types'

const emptyPlatform: PlatformInput = { name: '', defaultFeePercentage: 0, isLocked: false, notes: null }

export default function Settings() {
  const [rates, setRates] = useState<ExchangeRate[]>([])
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fetching, setFetching] = useState<string | null>(null)
  const [mainCurrency, setMainCurrency] = useMainCurrency()
  const [myTimezone, setMyTimezone] = useMyTimezone()
  const [exportYear, setExportYear] = useState(new Date().getFullYear())
  const [showPlatformModal, setShowPlatformModal] = useState(false)
  const [editingPlatform, setEditingPlatform] = useState<Platform | null>(null)
  const [platformDraft, setPlatformDraft] = useState<PlatformInput>(emptyPlatform)
  const [savingPlatform, setSavingPlatform] = useState(false)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [ratesData, platformsData] = await Promise.all([getExchangeRates(), getPlatforms()])
      setRates(ratesData)
      setPlatforms(platformsData)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to load settings.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const openAddPlatform = () => {
    setEditingPlatform(null)
    setPlatformDraft(emptyPlatform)
    setShowPlatformModal(true)
  }

  const openEditPlatform = (p: Platform) => {
    setEditingPlatform(p)
    setPlatformDraft({ name: p.name, defaultFeePercentage: p.defaultFeePercentage, isLocked: p.isLocked, notes: p.notes })
    setShowPlatformModal(true)
  }

  const handleSavePlatform = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingPlatform(true)
    try {
      if (editingPlatform) {
        const updated = await updatePlatform(editingPlatform.id, platformDraft)
        setPlatforms(prev => prev.map(p => p.id === updated.id ? updated : p))
      } else {
        const created = await createPlatform(platformDraft)
        setPlatforms(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
      }
      setShowPlatformModal(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to save platform.')
    } finally {
      setSavingPlatform(false)
    }
  }

  const handleDeletePlatform = async (p: Platform) => {
    if (!window.confirm(`Delete platform '${p.name}'?`)) return
    try {
      await deletePlatform(p.id)
      setPlatforms(prev => prev.filter(pl => pl.id !== p.id))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to delete platform.')
    }
  }

  const grouped = rates.reduce<Record<string, ExchangeRate[]>>((acc, r) => {
    const key = `${r.year}-${String(r.month).padStart(2, '0')}`
    ;(acc[key] ??= []).push(r)
    return acc
  }, {})

  const sortedKeys = Object.keys(grouped).sort().reverse()

  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()

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
            <p className="text-xs text-[var(--text-tertiary)] mb-1.5">Display Currency</p>
            <Select
              value={mainCurrency}
              onChange={(e) => setMainCurrency(e.target.value as typeof mainCurrency)}
              className="w-full"
            >
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
            <p className="mt-1 text-xs text-[var(--text-tertiary)]">Totals and conversions use this currency.</p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-tertiary)] mb-1.5">My Timezone</p>
            <Select
              value={myTimezone}
              onChange={(e) => setMyTimezone(e.target.value)}
              className="w-full"
            >
              {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </Select>
            <p className="mt-1 text-xs text-[var(--text-tertiary)]">Client clocks show offset relative to this.</p>
          </div>
        </div>
      </AppCard>

      {/* Platforms */}
      {showPlatformModal && (
        <Modal title={editingPlatform ? 'Edit Platform' : 'Add Platform'} onClose={() => setShowPlatformModal(false)} size="md">
          <form className="grid gap-3" onSubmit={handleSavePlatform}>
            <Field label="Name" required>
              <Input required value={platformDraft.name} onChange={(e) => setPlatformDraft(d => ({ ...d, name: e.target.value }))} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Default Fee %">
                <Input type="number" min="0" max="100" step="0.1" value={platformDraft.defaultFeePercentage} onChange={(e) => setPlatformDraft(d => ({ ...d, defaultFeePercentage: Number(e.target.value) }))} />
              </Field>
              <Field label="Lock fee for new projects">
                <div className="flex items-center gap-2 pt-2">
                  <input type="checkbox" id="isLocked" checked={platformDraft.isLocked} onChange={(e) => setPlatformDraft(d => ({ ...d, isLocked: e.target.checked }))} className="h-4 w-4 accent-[var(--accent)]" />
                  <label htmlFor="isLocked" className="text-sm text-[var(--text-secondary)]">Locked</label>
                </div>
              </Field>
            </div>
            <Field label="Notes">
              <Input value={platformDraft.notes ?? ''} onChange={(e) => setPlatformDraft(d => ({ ...d, notes: e.target.value || null }))} />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setShowPlatformModal(false)}>Cancel</Button>
              <Button type="submit" disabled={savingPlatform}>{savingPlatform ? 'Saving...' : editingPlatform ? 'Save' : 'Add Platform'}</Button>
            </div>
          </form>
        </Modal>
      )}

      <AppCard>
        <SectionHeading title="Platforms" description="Editable list of platforms with default fees." action={<Button onClick={openAddPlatform}>+ Add Platform</Button>} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-faint)] text-left">
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Name</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Default Fee %</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Locked</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Notes</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {platforms.length === 0 && !loading && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-[var(--text-tertiary)]">No platforms yet.</td></tr>
              )}
              {platforms.map((p) => (
                <tr key={p.id} className="border-b border-[var(--border-faint)] last:border-0 transition-colors hover:bg-[var(--bg-elevated)]">
                  <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{p.name}</td>
                  <td className="px-4 py-3 font-mono tabular-nums text-[var(--text-secondary)]">{p.defaultFeePercentage}%</td>
                  <td className="px-4 py-3">
                    {p.isLocked
                      ? <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-xs text-amber-300">Locked</span>
                      : <span className="text-[var(--text-tertiary)] text-xs">—</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">{p.notes ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" className="px-2 text-xs" onClick={() => openEditPlatform(p)}>Edit</Button>
                    <Button variant="ghost" className="px-2 text-xs text-[var(--text-tertiary)] hover:text-[#c97264]" onClick={() => void handleDeletePlatform(p)}>×</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AppCard>

      {/* Export */}
      <AppCard>
        <SectionHeading
          title="Export"
          description="Download a CSV of all paid milestones and tips for a given year. Hand it to your accountant."
        />
        <div className="flex items-end gap-3 p-4">
          <Field label="Year">
            <Input
              type="number"
              min="2020"
              max="2099"
              value={exportYear}
              onChange={(e) => setExportYear(Number(e.target.value))}
              className="w-28"
            />
          </Field>
          <Button
            variant="secondary"
            onClick={() => window.open(`/api/export/year/${exportYear}/paid-milestones.csv`, '_blank')}
          >
            Download CSV
          </Button>
        </div>
      </AppCard>

      {/* Exchange rates */}
      <AppCard>
        <SectionHeading
          title="Exchange Rates"
          description="Auto-fetched from ECB via frankfurter.app. Rates are final for past months."
          action={
            fetchableMonths.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-[var(--text-tertiary)] mr-1">Fetch missing:</span>
                {fetchableMonths.slice(0, 12).map(({ month, year, label }) => (
                  <Button
                    key={`${year}-${month}`}
                    variant="secondary"
                    className="px-2 py-1 text-xs"
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
              <tr className="border-b border-[var(--border-faint)] text-left">
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Month</th>
                {['GBP', 'USD', 'EUR', 'CAD', 'INR'].map((c) => (
                  <th key={c} className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                    1 {c} =
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-sm text-[var(--text-tertiary)]">Loading...</td></tr>
              )}
              {!loading && sortedKeys.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-sm text-[var(--text-tertiary)]">No rates yet. Click a fetch button above.</td></tr>
              )}
              {sortedKeys.map((key) => {
                const group = grouped[key]
                const [y, m] = key.split('-').map(Number)
                const rateMap = Object.fromEntries(group.map((r) => [r.currency, r.rate]))
                return (
                  <tr key={key} className="border-b border-[var(--border-faint)] last:border-0 transition-colors hover:bg-[var(--bg-elevated)]">
                    <td className="px-4 py-3 font-medium text-[var(--text-primary)]">
                      {MONTH_NAMES[m - 1]} {y}
                    </td>
                    {['GBP', 'USD', 'EUR', 'CAD', 'INR'].map((c) => (
                      <td key={c} className="px-4 py-3 text-right font-mono tabular-nums text-[var(--text-secondary)]">
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
