import { useEffect, useState } from 'react'
import {
  createCost,
  createInvestment,
  deleteCost,
  deleteInvestment,
  getCosts,
  getEffectiveCosts,
  getInvestments,
  updateCost,
  updateInvestment,
} from '../api'
import { Modal } from '../components/Modal'
import { AppCard, Button, Checkbox, EmptyState, ErrorState, Field, Input, PageIntro, Select, SectionHeading, StatCard, Textarea } from '../components/ui'
import { formatCurrency } from '../lib/format'
import { useMainCurrency } from '../lib/useMainCurrency'
import type { Cost, CostInput, EffectiveCost, Investment, InvestmentInput, InvestmentCategory } from '../types'
import { COST_CATEGORIES_UI, CURRENCIES, INVESTMENT_CATEGORIES, MONTH_NAMES } from '../types'

const now = new Date()
const currentYear = now.getFullYear()
const currentMonth = now.getMonth() + 1

const emptyCost: CostInput = {
  description: '',
  amount: 0,
  currency: 'USD',
  category: 'Software',
  month: currentMonth,
  year: currentYear,
  recurring: true,
  endMonth: null,
  endYear: null,
  notes: null,
}

const emptyInvestment: InvestmentInput = {
  description: '',
  amount: 0,
  currency: 'USD',
  nokRate: 0,
  month: currentMonth,
  year: currentYear,
  notes: null,
  category: 'Other',
}

function formatPeriod(cost: Cost) {
  const start = `${MONTH_NAMES[cost.month - 1]} ${cost.year}`
  if (!cost.recurring) return start
  if (cost.endMonth && cost.endYear) {
    return `${start} → ${MONTH_NAMES[cost.endMonth - 1]} ${cost.endYear}`
  }
  return `${start} → ongoing`
}

function isEnded(cost: Cost): boolean {
  if (!cost.endMonth || !cost.endYear) return false
  return cost.endYear * 12 + cost.endMonth < currentYear * 12 + currentMonth
}

function isActiveRecurring(cost: Cost): boolean {
  if (!cost.recurring) return false
  if (!cost.endMonth || !cost.endYear) return true
  return cost.endYear * 12 + cost.endMonth >= currentYear * 12 + currentMonth
}

export default function Costs() {
  const [costs, setCosts] = useState<Cost[]>([])
  const [investments, setInvestments] = useState<Investment[]>([])
  const [costDraft, setCostDraft] = useState<CostInput>(emptyCost)
  const [investmentDraft, setInvestmentDraft] = useState<InvestmentInput>(emptyInvestment)
  const [editingCostId, setEditingCostId] = useState<number | null>(null)
  const [editingInvestmentId, setEditingInvestmentId] = useState<number | null>(null)
  const [showCostModal, setShowCostModal] = useState(false)
  const [showInvestmentModal, setShowInvestmentModal] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ytdCostsNok, setYtdCostsNok] = useState<number>(0)
  const [mainCurrency] = useMainCurrency()

  const load = async () => {
    setError(null)
    try {
      const [costData, investmentData] = await Promise.all([
        getCosts(),
        getInvestments(),
      ])
      setCosts(costData)
      setInvestments(investmentData)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to load costs.')
    }
  }

  useEffect(() => { void load() }, [])

  // Load YTD costs in parallel (months 1..currentMonth)
  useEffect(() => {
    const months = Array.from({ length: currentMonth }, (_, i) => i + 1)
    void Promise.allSettled(months.map((m) => getEffectiveCosts(m, currentYear))).then(
      (results) => {
        const total = results
          .filter((r): r is PromiseFulfilledResult<EffectiveCost[]> => r.status === 'fulfilled')
          .flatMap((r) => r.value)
          .reduce((s, c) => s + c.amountNok, 0)
        setYtdCostsNok(total)
      }
    )
  }, [])

  const recurringCosts = costs.filter((c) => c.recurring)
  const oneTimeCosts = costs.filter((c) => !c.recurring)

  // KPI computations from local data
  const activeRecurring = costs.filter(isActiveRecurring)
  const recurringMonthMain = activeRecurring
    .filter((c) => c.currency === mainCurrency)
    .reduce((s, c) => s + c.amount, 0)
  const activeSubCount = activeRecurring.length
  const ytdInvestmentsNok = investments
    .filter((i) => i.year === currentYear)
    .reduce((s, i) => s + i.amount * i.nokRate, 0)

  const handleCostSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    try {
      if (editingCostId) {
        await updateCost(editingCostId, costDraft)
      } else {
        await createCost(costDraft)
      }
      setEditingCostId(null)
      setShowCostModal(false)
      setCostDraft(emptyCost)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to save cost.')
    }
  }

  const handleInvestmentSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    try {
      if (editingInvestmentId) {
        await updateInvestment(editingInvestmentId, investmentDraft)
      } else {
        await createInvestment(investmentDraft)
      }
      setEditingInvestmentId(null)
      setShowInvestmentModal(false)
      setInvestmentDraft(emptyInvestment)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to save investment.')
    }
  }

  const editCost = (cost: Cost) => {
    setEditingCostId(cost.id)
    setCostDraft({
      description: cost.description,
      amount: cost.amount,
      currency: cost.currency,
      category: cost.category,
      month: cost.month,
      year: cost.year,
      recurring: cost.recurring,
      endMonth: cost.endMonth,
      endYear: cost.endYear,
      notes: cost.notes,
    })
  }

  const editInvestment = (inv: Investment) => {
    setEditingInvestmentId(inv.id)
    setInvestmentDraft({
      description: inv.description,
      amount: inv.amount,
      currency: inv.currency,
      nokRate: inv.nokRate,
      month: inv.month,
      year: inv.year,
      notes: inv.notes,
      category: inv.category,
    })
  }

  const handleEndNow = async (cost: Cost) => {
    const today = new Date()
    if (!window.confirm(`End '${cost.description}' as of ${MONTH_NAMES[today.getMonth()]} ${today.getFullYear()}?`)) return
    try {
      await updateCost(cost.id, {
        description: cost.description,
        amount: cost.amount,
        currency: cost.currency,
        category: cost.category,
        month: cost.month,
        year: cost.year,
        recurring: cost.recurring,
        endMonth: today.getMonth() + 1,
        endYear: today.getFullYear(),
        notes: cost.notes,
      })
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to end cost.')
    }
  }

  const removeCost = async (id: number) => {
    if (!window.confirm('Delete this cost?')) return
    try { await deleteCost(id); await load() }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Failed to delete.') }
  }

  const removeInvestment = async (id: number) => {
    if (!window.confirm('Delete this investment?')) return
    try { await deleteInvestment(id); await load() }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Failed to delete.') }
  }

  return (
    <div className="space-y-6">
      <PageIntro
        title="Costs & Investments"
        description="Manage recurring subscriptions, one-time costs, and capital investments."
      />

      {error && <ErrorState message={error} onRetry={() => void load()} />}

      {/* KPI strip */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={`Recurring/mo (${mainCurrency})`}
          value={formatCurrency(recurringMonthMain, mainCurrency)}
          hint={`${activeSubCount} active subscription${activeSubCount !== 1 ? 's' : ''}`}
        />
        <StatCard
          label="YTD costs"
          value={formatCurrency(ytdCostsNok, 'NOK')}
          hint={`Jan–${MONTH_NAMES[currentMonth - 1]} ${currentYear}`}
        />
        <StatCard
          label="YTD investments"
          value={formatCurrency(ytdInvestmentsNok, 'NOK')}
          hint={`${currentYear}`}
        />
        <StatCard
          label="Active subscriptions"
          value={activeSubCount}
        />
      </div>

      {/* Recurring costs */}
      <AppCard>
        <SectionHeading title="Recurring Costs" description="Auto-applied to every month from start date."
          action={<Button variant="secondary" className="text-xs" onClick={() => { setEditingCostId(null); setCostDraft({ ...emptyCost, recurring: true }); setShowCostModal(true) }}>+ Add</Button>}
        />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-left">
                  <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Description</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Category</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Period</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">Amount/mo</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {recurringCosts.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8">
                    <EmptyState title="No recurring costs" description="Add subscriptions like Claude Max, Freelancer Plus, etc." />
                  </td></tr>
                ) : recurringCosts.map((cost) => {
                  const ended = isEnded(cost)
                  return (
                    <tr key={cost.id} className={`border-b border-slate-700/50 last:border-0${ended ? ' opacity-50' : ''}`}>
                      <td className="px-4 py-2.5 text-slate-200">
                        {cost.description}
                        {ended && (
                          <span className="ml-2 inline-flex items-center rounded border border-slate-600/50 bg-slate-700/40 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">Ended</span>
                        )}
                        {cost.notes && (
                          <span title={cost.notes} className="ml-2 inline-flex items-center rounded bg-blue-500/15 px-1 text-[10px] font-bold text-blue-300 cursor-help">i</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-500">{cost.category}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-400">{formatPeriod(cost)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-200">{formatCurrency(cost.amount, cost.currency)}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex justify-end gap-1">
                          {cost.recurring && !cost.endMonth && (
                            <Button
                              variant="ghost"
                              className="px-2 text-xs text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
                              onClick={() => void handleEndNow(cost)}
                            >
                              End now
                            </Button>
                          )}
                          <Button variant="ghost" className="px-2 text-xs" onClick={() => { editCost(cost); setShowCostModal(true) }}>Edit</Button>
                          <Button variant="danger" className="px-2 text-xs" onClick={() => void removeCost(cost.id)}>Del</Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {recurringCosts.length > 0 && (() => {
                  const byCurrency = recurringCosts.reduce<Record<string, number>>((acc, c) => {
                    acc[c.currency] = (acc[c.currency] ?? 0) + c.amount
                    return acc
                  }, {})
                  return Object.entries(byCurrency).map(([currency, total]) => (
                    <tr key={currency} className="border-t-2 border-slate-700 bg-slate-800/30">
                      <td className="px-4 py-2.5 text-xs font-medium text-slate-400" colSpan={3}>Total / month</td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-100">
                        {formatCurrency(total, currency as Cost['currency'])}
                      </td>
                      <td />
                    </tr>
                  ))
                })()}
              </tbody>
            </table>
          </div>

        {/* One-time costs below recurring */}
        {oneTimeCosts.length > 0 && (
          <>
            <SectionHeading title="One-Time Costs" description="Charged to a specific month only."
              action={<Button variant="secondary" className="text-xs" onClick={() => { setEditingCostId(null); setCostDraft({ ...emptyCost, recurring: false }); setShowCostModal(true) }}>+ Add</Button>}
            />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 text-left">
                      <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Description</th>
                      <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Category</th>
                      <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Month</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">Amount</th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {oneTimeCosts.map((cost) => (
                      <tr key={cost.id} className="border-b border-slate-700/50 last:border-0">
                        <td className="px-4 py-2.5 text-slate-200">
                          {cost.description}
                          {cost.notes && (
                            <span title={cost.notes} className="ml-2 inline-flex items-center rounded bg-blue-500/15 px-1 text-[10px] font-bold text-blue-300 cursor-help">i</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-500">{cost.category}</td>
                        <td className="px-4 py-2.5 text-xs text-slate-400">{MONTH_NAMES[cost.month - 1]} {cost.year}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-slate-200">{formatCurrency(cost.amount, cost.currency)}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" className="px-2 text-xs" onClick={() => { editCost(cost); setShowCostModal(true) }}>Edit</Button>
                            <Button variant="danger" className="px-2 text-xs" onClick={() => void removeCost(cost.id)}>Del</Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {(() => {
                      const byCurrency = oneTimeCosts.reduce<Record<string, number>>((acc, c) => {
                        acc[c.currency] = (acc[c.currency] ?? 0) + c.amount
                        return acc
                      }, {})
                      return Object.entries(byCurrency).map(([currency, total]) => (
                        <tr key={currency} className="border-t-2 border-slate-700 bg-slate-800/30">
                          <td className="px-4 py-2.5 text-xs font-medium text-slate-400" colSpan={3}>Total</td>
                          <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-100">
                            {formatCurrency(total, currency as Cost['currency'])}
                          </td>
                          <td />
                        </tr>
                      ))
                    })()}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </AppCard>

      {showCostModal && (
        <Modal title={editingCostId ? 'Edit Cost' : 'Add Cost'} onClose={() => { setShowCostModal(false); setEditingCostId(null); setCostDraft(emptyCost) }}>
          <form className="grid gap-3" onSubmit={handleCostSave}>
            <Field label="Description" required>
              <Input required value={costDraft.description} onChange={(e) => setCostDraft((c) => ({ ...c, description: e.target.value }))} />
            </Field>
            <div className="grid gap-3 grid-cols-3">
              <Field label="Amount">
                <Input type="number" min="0" step="0.01" value={costDraft.amount} onChange={(e) => setCostDraft((c) => ({ ...c, amount: Number(e.target.value) }))} />
              </Field>
              <Field label="Currency">
                <Select value={costDraft.currency} onChange={(e) => setCostDraft((c) => ({ ...c, currency: e.target.value as Cost['currency'] }))}>
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </Field>
              <Field label="Category">
                <Select value={costDraft.category} onChange={(e) => setCostDraft((c) => ({ ...c, category: e.target.value as Cost['category'] }))}>
                  {COST_CATEGORIES_UI.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                </Select>
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <Checkbox checked={costDraft.recurring} onChange={(e) => setCostDraft((c) => ({ ...c, recurring: e.target.checked, endMonth: null, endYear: null }))} />
              Recurring monthly
            </label>
            <div className="grid gap-3 grid-cols-2">
              <Field label={costDraft.recurring ? 'Start month' : 'Month'}>
                <Select value={costDraft.month} onChange={(e) => setCostDraft((c) => ({ ...c, month: Number(e.target.value) }))}>
                  {MONTH_NAMES.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}
                </Select>
              </Field>
              <Field label="Year">
                <Input type="number" min="2020" value={costDraft.year} onChange={(e) => setCostDraft((c) => ({ ...c, year: Number(e.target.value) }))} />
              </Field>
            </div>
            {costDraft.recurring && (
              <div className="grid gap-3 grid-cols-2">
                <Field label="End month (blank = ongoing)">
                  <Select value={costDraft.endMonth ?? ''} onChange={(e) => setCostDraft((c) => ({ ...c, endMonth: e.target.value ? Number(e.target.value) : null }))}>
                    <option value="">Ongoing</option>
                    {MONTH_NAMES.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}
                  </Select>
                </Field>
                <Field label="End year">
                  <Input type="number" min="2020" value={costDraft.endYear ?? ''} onChange={(e) => setCostDraft((c) => ({ ...c, endYear: e.target.value ? Number(e.target.value) : null }))} />
                </Field>
              </div>
            )}
            <Field label="Notes">
              <Textarea value={costDraft.notes ?? ''} onChange={(e) => setCostDraft((c) => ({ ...c, notes: e.target.value || null }))} />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => { setShowCostModal(false); setEditingCostId(null); setCostDraft(emptyCost) }}>Cancel</Button>
              <Button type="submit">{editingCostId ? 'Update' : 'Add Cost'}</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Investments */}
      <AppCard>
        <SectionHeading title="Investments" description="One-time purchases, not in monthly P&L."
          action={<Button variant="secondary" className="text-xs" onClick={() => { setEditingInvestmentId(null); setInvestmentDraft(emptyInvestment); setShowInvestmentModal(true) }}>+ Add</Button>}
        />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-left">
                  <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Description</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Category</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Month</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">Amount</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">NOK at purchase</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {investments.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8">
                    <EmptyState title="No investments" description="Track exam fees, hardware, etc." />
                  </td></tr>
                ) : investments.map((inv) => (
                  <tr key={inv.id} className="border-b border-slate-700/50 last:border-0">
                    <td className="px-4 py-2.5 text-slate-200">
                      {inv.description}
                      {inv.notes && (
                        <span title={inv.notes} className="ml-2 inline-flex items-center rounded bg-blue-500/15 px-1 text-[10px] font-bold text-blue-300 cursor-help">i</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{inv.category}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-400">{MONTH_NAMES[inv.month - 1]} {inv.year}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-200">{formatCurrency(inv.amount, inv.currency)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs text-slate-400">{formatCurrency(inv.amount * inv.nokRate, 'NOK')}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" className="px-2 text-xs" onClick={() => { editInvestment(inv); setShowInvestmentModal(true) }}>Edit</Button>
                        <Button variant="danger" className="px-2 text-xs" onClick={() => void removeInvestment(inv.id)}>Del</Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {investments.length > 0 && (() => {
                  const nokTotal = investments.reduce((s, inv) => s + inv.amount * inv.nokRate, 0)
                  return (
                    <tr className="border-t-2 border-slate-700 bg-slate-800/30">
                      <td className="px-4 py-2.5 text-xs font-medium text-slate-400" colSpan={4}>Total (NOK at purchase)</td>
                      <td className="px-4 py-2.5 text-right font-mono text-sm font-semibold text-slate-300">
                        {formatCurrency(nokTotal, 'NOK')}
                      </td>
                      <td />
                    </tr>
                  )
                })()}
              </tbody>
            </table>
          </div>
      </AppCard>

      {showInvestmentModal && (
        <Modal title={editingInvestmentId ? 'Edit Investment' : 'Add Investment'} onClose={() => { setShowInvestmentModal(false); setEditingInvestmentId(null); setInvestmentDraft(emptyInvestment) }} size="md">
          <form className="grid gap-3" onSubmit={handleInvestmentSave}>
            <Field label="Description" required>
              <Input required value={investmentDraft.description} onChange={(e) => setInvestmentDraft((c) => ({ ...c, description: e.target.value }))} />
            </Field>
            <div className="grid gap-3 grid-cols-2">
              <Field label="Amount">
                <Input type="number" min="0" step="0.01" value={investmentDraft.amount} onChange={(e) => setInvestmentDraft((c) => ({ ...c, amount: Number(e.target.value) }))} />
              </Field>
              <Field label="Currency">
                <Select value={investmentDraft.currency} onChange={(e) => setInvestmentDraft((c) => ({ ...c, currency: e.target.value as Investment['currency'] }))}>
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </Field>
            </div>
            <div className="grid gap-3 grid-cols-2">
              <Field label="Category">
                <Select value={investmentDraft.category} onChange={(e) => setInvestmentDraft((c) => ({ ...c, category: e.target.value as InvestmentCategory }))}>
                  {INVESTMENT_CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                </Select>
              </Field>
              <Field label="NOK Rate">
                <Input type="number" min="0" step="0.0001" value={investmentDraft.nokRate} onChange={(e) => setInvestmentDraft((c) => ({ ...c, nokRate: Number(e.target.value) }))} />
              </Field>
            </div>
            <div className="grid gap-3 grid-cols-2">
              <Field label="Month">
                <Select value={investmentDraft.month} onChange={(e) => setInvestmentDraft((c) => ({ ...c, month: Number(e.target.value) }))}>
                  {MONTH_NAMES.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}
                </Select>
              </Field>
              <Field label="Year">
                <Input type="number" min="2020" value={investmentDraft.year} onChange={(e) => setInvestmentDraft((c) => ({ ...c, year: Number(e.target.value) }))} />
              </Field>
            </div>
            <Field label="Notes">
              <Textarea value={investmentDraft.notes ?? ''} onChange={(e) => setInvestmentDraft((c) => ({ ...c, notes: e.target.value || null }))} />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => { setShowInvestmentModal(false); setEditingInvestmentId(null); setInvestmentDraft(emptyInvestment) }}>Cancel</Button>
              <Button type="submit">{editingInvestmentId ? 'Update' : 'Add Investment'}</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
