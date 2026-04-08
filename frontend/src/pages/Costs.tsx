import { useEffect, useState } from 'react'
import {
  createCost,
  createInvestment,
  deleteCost,
  deleteInvestment,
  getCosts,
  getInvestments,
  updateCost,
  updateInvestment,
} from '../api'
import { AppCard, Button, Checkbox, EmptyState, ErrorState, Field, Input, PageIntro, Select, SectionHeading, Textarea } from '../components/ui'
import { formatCurrency } from '../lib/format'
import type { Cost, CostInput, Investment, InvestmentInput } from '../types'
import { COST_CATEGORIES, CURRENCIES, MONTH_NAMES } from '../types'

const now = new Date()

const emptyCost: CostInput = {
  description: '',
  amount: 0,
  category: 'Software',
  month: now.getMonth() + 1,
  year: now.getFullYear(),
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
  month: now.getMonth() + 1,
  year: now.getFullYear(),
  notes: null,
}

function formatPeriod(cost: Cost) {
  const start = `${MONTH_NAMES[cost.month - 1]} ${cost.year}`
  if (!cost.recurring) return start
  if (cost.endMonth && cost.endYear) {
    return `${start} → ${MONTH_NAMES[cost.endMonth - 1]} ${cost.endYear}`
  }
  return `${start} → ongoing`
}

export default function Costs() {
  const [costs, setCosts] = useState<Cost[]>([])
  const [investments, setInvestments] = useState<Investment[]>([])
  const [costDraft, setCostDraft] = useState<CostInput>(emptyCost)
  const [investmentDraft, setInvestmentDraft] = useState<InvestmentInput>(emptyInvestment)
  const [editingCostId, setEditingCostId] = useState<number | null>(null)
  const [editingInvestmentId, setEditingInvestmentId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

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

  const recurringCosts = costs.filter((c) => c.recurring)
  const oneTimeCosts = costs.filter((c) => !c.recurring)

  const handleCostSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    try {
      if (editingCostId) {
        await updateCost(editingCostId, costDraft)
      } else {
        await createCost(costDraft)
      }
      setEditingCostId(null)
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
    })
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

      {/* Cost form + recurring table */}
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <AppCard>
          <SectionHeading title="Recurring Costs" description="Auto-applied to every month from start date." />
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
                ) : recurringCosts.map((cost) => (
                  <tr key={cost.id} className="border-b border-slate-700/50 last:border-0">
                    <td className="px-4 py-2.5 text-slate-200">{cost.description}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{cost.category}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-400">{formatPeriod(cost)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-200">{formatCurrency(cost.amount, 'NOK')}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" className="px-2 text-xs" onClick={() => editCost(cost)}>Edit</Button>
                        <Button variant="danger" className="px-2 text-xs" onClick={() => void removeCost(cost.id)}>Del</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* One-time costs below recurring */}
          {oneTimeCosts.length > 0 && (
            <>
              <SectionHeading title="One-Time Costs" description="Charged to a specific month only." />
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
                        <td className="px-4 py-2.5 text-slate-200">{cost.description}</td>
                        <td className="px-4 py-2.5 text-xs text-slate-500">{cost.category}</td>
                        <td className="px-4 py-2.5 text-xs text-slate-400">{MONTH_NAMES[cost.month - 1]} {cost.year}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-slate-200">{formatCurrency(cost.amount, 'NOK')}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" className="px-2 text-xs" onClick={() => editCost(cost)}>Edit</Button>
                            <Button variant="danger" className="px-2 text-xs" onClick={() => void removeCost(cost.id)}>Del</Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </AppCard>

        {/* Add/edit form */}
        <AppCard className="h-fit">
          <SectionHeading title={editingCostId ? 'Edit Cost' : 'Add Cost'} />
          <form className="grid gap-3 p-4" onSubmit={handleCostSave}>
            <Field label="Description" required>
              <Input required value={costDraft.description} onChange={(e) => setCostDraft((c) => ({ ...c, description: e.target.value }))} />
            </Field>
            <div className="grid gap-3 grid-cols-2">
              <Field label="Amount (NOK/mo)">
                <Input type="number" min="0" step="0.01" value={costDraft.amount} onChange={(e) => setCostDraft((c) => ({ ...c, amount: Number(e.target.value) }))} />
              </Field>
              <Field label="Category">
                <Select value={costDraft.category} onChange={(e) => setCostDraft((c) => ({ ...c, category: e.target.value as Cost['category'] }))}>
                  {COST_CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
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
            <div className="flex justify-end gap-2">
              {editingCostId && (
                <Button type="button" variant="secondary" onClick={() => { setEditingCostId(null); setCostDraft(emptyCost) }}>Cancel</Button>
              )}
              <Button type="submit">{editingCostId ? 'Update' : 'Add Cost'}</Button>
            </div>
          </form>
        </AppCard>
      </div>

      {/* Investments */}
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <AppCard>
          <SectionHeading title="Investments" description="One-time purchases, not in monthly P&L." />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-left">
                  <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Description</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Month</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">Amount</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">NOK</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {investments.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8">
                    <EmptyState title="No investments" description="Track exam fees, hardware, etc." />
                  </td></tr>
                ) : investments.map((inv) => (
                  <tr key={inv.id} className="border-b border-slate-700/50 last:border-0">
                    <td className="px-4 py-2.5 text-slate-200">{inv.description}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-400">{MONTH_NAMES[inv.month - 1]} {inv.year}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-200">{formatCurrency(inv.amount, inv.currency)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs text-slate-400">{formatCurrency(inv.amount * inv.nokRate, 'NOK')}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" className="px-2 text-xs" onClick={() => editInvestment(inv)}>Edit</Button>
                        <Button variant="danger" className="px-2 text-xs" onClick={() => void removeInvestment(inv.id)}>Del</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AppCard>

        <AppCard className="h-fit">
          <SectionHeading title={editingInvestmentId ? 'Edit Investment' : 'Add Investment'} />
          <form className="grid gap-3 p-4" onSubmit={handleInvestmentSave}>
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
            <div className="grid gap-3 grid-cols-3">
              <Field label="NOK Rate">
                <Input type="number" min="0" step="0.0001" value={investmentDraft.nokRate} onChange={(e) => setInvestmentDraft((c) => ({ ...c, nokRate: Number(e.target.value) }))} />
              </Field>
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
            <div className="flex justify-end gap-2">
              {editingInvestmentId && (
                <Button type="button" variant="secondary" onClick={() => { setEditingInvestmentId(null); setInvestmentDraft(emptyInvestment) }}>Cancel</Button>
              )}
              <Button type="submit">{editingInvestmentId ? 'Update' : 'Add Investment'}</Button>
            </div>
          </form>
        </AppCard>
      </div>
    </div>
  )
}
