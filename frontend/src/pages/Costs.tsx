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
import { COST_CATEGORIES, CURRENCIES } from '../types'

const now = new Date()

const emptyCost: CostInput = {
  description: '',
  amount: 0,
  category: 'Software',
  month: now.getMonth() + 1,
  year: now.getFullYear(),
  recurring: true,
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
        getInvestments({ year: new Date().getFullYear() }),
      ])
      setCosts(costData)
      setInvestments(investmentData)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to load costs.')
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const recurringCosts = costs.filter((c) => c.recurring)

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
      notes: cost.notes,
    })
  }

  const editInvestment = (investment: Investment) => {
    setEditingInvestmentId(investment.id)
    setInvestmentDraft({
      description: investment.description,
      amount: investment.amount,
      currency: investment.currency,
      nokRate: investment.nokRate,
      month: investment.month,
      year: investment.year,
      notes: investment.notes,
    })
  }

  const removeCost = async (id: number) => {
    if (!window.confirm('Delete this cost entry?')) return
    try {
      await deleteCost(id)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to delete cost.')
    }
  }

  const removeInvestment = async (id: number) => {
    if (!window.confirm('Delete this investment entry?')) return
    try {
      await deleteInvestment(id)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to delete investment.')
    }
  }

  return (
    <div className="space-y-6">
      <PageIntro
        title="Costs"
        description="Operating costs and one-time investments."
      />

      {error && <ErrorState message={error} onRetry={() => void load()} />}

      {/* Recurring costs */}
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <AppCard>
          <SectionHeading title="Recurring Costs" description="Monthly operating expenses." />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-left">
                  <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Description</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Category</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Period</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">Amount</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {recurringCosts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8">
                      <EmptyState
                        title="No recurring costs yet"
                        description="Add subscriptions and operating costs to keep monthly P&L accurate."
                      />
                    </td>
                  </tr>
                ) : (
                  recurringCosts.map((cost) => (
                    <tr key={cost.id} className="border-b border-slate-700/50 last:border-0">
                      <td className="px-4 py-2.5 text-slate-200">{cost.description}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-500">{cost.category}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-400">
                        {cost.month}/{cost.year}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-200">
                        {formatCurrency(cost.amount, 'NOK')}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" className="px-2 text-xs" onClick={() => editCost(cost)}>
                            Edit
                          </Button>
                          <Button variant="danger" className="px-2 text-xs" onClick={() => void removeCost(cost.id)}>
                            Del
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </AppCard>

        <AppCard>
          <SectionHeading title={editingCostId ? 'Edit Cost' : 'Add Cost'} />
          <form className="grid gap-3 p-4" onSubmit={handleCostSave}>
            <Field label="Description" required>
              <Input
                required
                value={costDraft.description}
                onChange={(e) => setCostDraft((c) => ({ ...c, description: e.target.value }))}
              />
            </Field>
            <div className="grid gap-3 grid-cols-2">
              <Field label="Amount (NOK)">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={costDraft.amount}
                  onChange={(e) => setCostDraft((c) => ({ ...c, amount: Number(e.target.value) }))}
                />
              </Field>
              <Field label="Category">
                <Select
                  value={costDraft.category}
                  onChange={(e) => setCostDraft((c) => ({ ...c, category: e.target.value as Cost['category'] }))}
                >
                  {COST_CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                </Select>
              </Field>
            </div>
            <div className="grid gap-3 grid-cols-2">
              <Field label="Month">
                <Input
                  type="number"
                  min="1"
                  max="12"
                  value={costDraft.month}
                  onChange={(e) => setCostDraft((c) => ({ ...c, month: Number(e.target.value) }))}
                />
              </Field>
              <Field label="Year">
                <Input
                  type="number"
                  min="2020"
                  value={costDraft.year}
                  onChange={(e) => setCostDraft((c) => ({ ...c, year: Number(e.target.value) }))}
                />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <Checkbox
                checked={costDraft.recurring}
                onChange={(e) => setCostDraft((c) => ({ ...c, recurring: e.target.checked }))}
              />
              Recurring monthly cost
            </label>
            <Field label="Notes">
              <Textarea
                value={costDraft.notes ?? ''}
                onChange={(e) => setCostDraft((c) => ({ ...c, notes: e.target.value || null }))}
              />
            </Field>
            <div className="flex justify-end gap-2">
              {editingCostId && (
                <Button type="button" variant="secondary" onClick={() => { setEditingCostId(null); setCostDraft(emptyCost) }}>
                  Cancel
                </Button>
              )}
              <Button type="submit">{editingCostId ? 'Update Cost' : 'Add Cost'}</Button>
            </div>
          </form>
        </AppCard>
      </div>

      {/* Investments */}
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <AppCard>
          <SectionHeading title="Investments" description="One-time purchases tracked outside monthly P&L." />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-left">
                  <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Description</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Period</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">Amount</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">NOK Rate</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {investments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8">
                      <EmptyState
                        title="No investments yet"
                        description="Track hardware and equipment separately from monthly running costs."
                      />
                    </td>
                  </tr>
                ) : (
                  investments.map((inv) => (
                    <tr key={inv.id} className="border-b border-slate-700/50 last:border-0">
                      <td className="px-4 py-2.5 text-slate-200">{inv.description}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-400">
                        {inv.month}/{inv.year}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-200">
                        {formatCurrency(inv.amount, inv.currency)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs text-slate-400">
                        {inv.nokRate.toFixed(4)}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" className="px-2 text-xs" onClick={() => editInvestment(inv)}>
                            Edit
                          </Button>
                          <Button variant="danger" className="px-2 text-xs" onClick={() => void removeInvestment(inv.id)}>
                            Del
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </AppCard>

        <AppCard>
          <SectionHeading title={editingInvestmentId ? 'Edit Investment' : 'Add Investment'} />
          <form className="grid gap-3 p-4" onSubmit={handleInvestmentSave}>
            <Field label="Description" required>
              <Input
                required
                value={investmentDraft.description}
                onChange={(e) => setInvestmentDraft((c) => ({ ...c, description: e.target.value }))}
              />
            </Field>
            <div className="grid gap-3 grid-cols-2">
              <Field label="Amount">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={investmentDraft.amount}
                  onChange={(e) => setInvestmentDraft((c) => ({ ...c, amount: Number(e.target.value) }))}
                />
              </Field>
              <Field label="Currency">
                <Select
                  value={investmentDraft.currency}
                  onChange={(e) => setInvestmentDraft((c) => ({ ...c, currency: e.target.value as Investment['currency'] }))}
                >
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </Field>
            </div>
            <div className="grid gap-3 grid-cols-3">
              <Field label="NOK Rate">
                <Input
                  type="number"
                  min="0"
                  step="0.0001"
                  value={investmentDraft.nokRate}
                  onChange={(e) => setInvestmentDraft((c) => ({ ...c, nokRate: Number(e.target.value) }))}
                />
              </Field>
              <Field label="Month">
                <Input
                  type="number"
                  min="1"
                  max="12"
                  value={investmentDraft.month}
                  onChange={(e) => setInvestmentDraft((c) => ({ ...c, month: Number(e.target.value) }))}
                />
              </Field>
              <Field label="Year">
                <Input
                  type="number"
                  min="2020"
                  value={investmentDraft.year}
                  onChange={(e) => setInvestmentDraft((c) => ({ ...c, year: Number(e.target.value) }))}
                />
              </Field>
            </div>
            <Field label="Notes">
              <Textarea
                value={investmentDraft.notes ?? ''}
                onChange={(e) => setInvestmentDraft((c) => ({ ...c, notes: e.target.value || null }))}
              />
            </Field>
            <div className="flex justify-end gap-2">
              {editingInvestmentId && (
                <Button type="button" variant="secondary" onClick={() => { setEditingInvestmentId(null); setInvestmentDraft(emptyInvestment) }}>
                  Cancel
                </Button>
              )}
              <Button type="submit">{editingInvestmentId ? 'Update Investment' : 'Add Investment'}</Button>
            </div>
          </form>
        </AppCard>
      </div>
    </div>
  )
}
