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
    } finally {
      // No view-level spinner; errors and table empty states cover the load lifecycle.
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const recurringCosts = costs.filter((cost) => cost.recurring)

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
    <div className="space-y-8">
      <PageIntro
        title="Costs"
        description="Separate monthly operating costs from one-time investments so the ledger reflects both P&L and strategic spending."
      />

      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <AppCard>
          <SectionHeading title="Recurring Costs" description="Software, internet, office, and other monthly operating expenses." />
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-700/70 text-left text-xs uppercase tracking-[0.2em] text-zinc-500">
                  <th className="px-5 py-3 font-medium">Description</th>
                  <th className="px-5 py-3 font-medium">Category</th>
                  <th className="px-5 py-3 font-medium">Month</th>
                  <th className="px-5 py-3 text-right font-medium">Amount</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {recurringCosts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10">
                      <EmptyState
                        title="No recurring costs yet"
                        description="Add subscriptions and operating costs to keep the monthly P&L complete."
                      />
                    </td>
                  </tr>
                ) : (
                  recurringCosts.map((cost) => (
                    <tr key={cost.id} className="border-b border-zinc-700/50 last:border-0">
                      <td className="px-5 py-4 text-white">{cost.description}</td>
                      <td className="px-5 py-4 text-zinc-400">{cost.category}</td>
                      <td className="px-5 py-4 text-zinc-300">{`${cost.month}/${cost.year}`}</td>
                      <td
                        className="px-5 py-4 text-right text-zinc-100"
                        style={{ fontFamily: '"JetBrains Mono", monospace' }}
                      >
                        {formatCurrency(cost.amount, 'NOK')}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" onClick={() => editCost(cost)}>
                            Edit
                          </Button>
                          <Button variant="danger" onClick={() => void removeCost(cost.id)}>
                            Delete
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
          <SectionHeading
            title={editingCostId ? 'Edit Cost' : 'Add Cost'}
            description="Store the month, category, and whether the cost recurs."
          />
          <form className="grid gap-4 p-5" onSubmit={handleCostSave}>
            <Field label="Description" required>
              <Input
                required
                value={costDraft.description}
                onChange={(event) =>
                  setCostDraft((current) => ({ ...current, description: event.target.value }))
                }
              />
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Amount (NOK)">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={costDraft.amount}
                  onChange={(event) =>
                    setCostDraft((current) => ({ ...current, amount: Number(event.target.value) }))
                  }
                />
              </Field>
              <Field label="Category">
                <Select
                  value={costDraft.category}
                  onChange={(event) =>
                    setCostDraft((current) => ({ ...current, category: event.target.value as Cost['category'] }))
                  }
                >
                  {COST_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Month">
                <Input
                  type="number"
                  min="1"
                  max="12"
                  value={costDraft.month}
                  onChange={(event) =>
                    setCostDraft((current) => ({ ...current, month: Number(event.target.value) }))
                  }
                />
              </Field>
              <Field label="Year">
                <Input
                  type="number"
                  min="2020"
                  value={costDraft.year}
                  onChange={(event) =>
                    setCostDraft((current) => ({ ...current, year: Number(event.target.value) }))
                  }
                />
              </Field>
            </div>
            <label className="flex items-center gap-3 text-sm text-zinc-300">
              <Checkbox
                checked={costDraft.recurring}
                onChange={(event) =>
                  setCostDraft((current) => ({ ...current, recurring: event.target.checked }))
                }
              />
              Recurring monthly cost
            </label>
            <Field label="Notes">
              <Textarea
                value={costDraft.notes ?? ''}
                onChange={(event) =>
                  setCostDraft((current) => ({ ...current, notes: event.target.value || null }))
                }
              />
            </Field>
            <div className="flex justify-end gap-3">
              {editingCostId ? (
                <Button type="button" variant="secondary" onClick={() => {
                  setEditingCostId(null)
                  setCostDraft(emptyCost)
                }}>
                  Cancel
                </Button>
              ) : null}
              <Button type="submit">{editingCostId ? 'Update Cost' : 'Add Cost'}</Button>
            </div>
          </form>
        </AppCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <AppCard>
          <SectionHeading title="Investments" description="One-time purchases tracked outside the monthly operating ledger." />
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-700/70 text-left text-xs uppercase tracking-[0.2em] text-zinc-500">
                  <th className="px-5 py-3 font-medium">Description</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 text-right font-medium">Amount</th>
                  <th className="px-5 py-3 text-right font-medium">NOK Rate</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {investments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10">
                      <EmptyState
                        title="No investments yet"
                        description="Track large one-time purchases separately from monthly running costs."
                      />
                    </td>
                  </tr>
                ) : (
                  investments.map((investment) => (
                    <tr key={investment.id} className="border-b border-zinc-700/50 last:border-0">
                      <td className="px-5 py-4 text-white">{investment.description}</td>
                      <td className="px-5 py-4 text-zinc-300">{`${investment.month}/${investment.year}`}</td>
                      <td
                        className="px-5 py-4 text-right text-zinc-100"
                        style={{ fontFamily: '"JetBrains Mono", monospace' }}
                      >
                        {formatCurrency(investment.amount, investment.currency)}
                      </td>
                      <td
                        className="px-5 py-4 text-right text-zinc-400"
                        style={{ fontFamily: '"JetBrains Mono", monospace' }}
                      >
                        {investment.nokRate.toFixed(4)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" onClick={() => editInvestment(investment)}>
                            Edit
                          </Button>
                          <Button variant="danger" onClick={() => void removeInvestment(investment.id)}>
                            Delete
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
          <SectionHeading
            title={editingInvestmentId ? 'Edit Investment' : 'Add Investment'}
            description="Use this for hardware, equipment, or capital purchases."
          />
          <form className="grid gap-4 p-5" onSubmit={handleInvestmentSave}>
            <Field label="Description" required>
              <Input
                required
                value={investmentDraft.description}
                onChange={(event) =>
                  setInvestmentDraft((current) => ({ ...current, description: event.target.value }))
                }
              />
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Amount">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={investmentDraft.amount}
                  onChange={(event) =>
                    setInvestmentDraft((current) => ({ ...current, amount: Number(event.target.value) }))
                  }
                />
              </Field>
              <Field label="Currency">
                <Select
                  value={investmentDraft.currency}
                  onChange={(event) =>
                    setInvestmentDraft((current) => ({
                      ...current,
                      currency: event.target.value as Investment['currency'],
                    }))
                  }
                >
                  {CURRENCIES.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="NOK Rate">
                <Input
                  type="number"
                  min="0"
                  step="0.0001"
                  value={investmentDraft.nokRate}
                  onChange={(event) =>
                    setInvestmentDraft((current) => ({ ...current, nokRate: Number(event.target.value) }))
                  }
                />
              </Field>
              <Field label="Month">
                <Input
                  type="number"
                  min="1"
                  max="12"
                  value={investmentDraft.month}
                  onChange={(event) =>
                    setInvestmentDraft((current) => ({ ...current, month: Number(event.target.value) }))
                  }
                />
              </Field>
              <Field label="Year">
                <Input
                  type="number"
                  min="2020"
                  value={investmentDraft.year}
                  onChange={(event) =>
                    setInvestmentDraft((current) => ({ ...current, year: Number(event.target.value) }))
                  }
                />
              </Field>
            </div>
            <Field label="Notes">
              <Textarea
                value={investmentDraft.notes ?? ''}
                onChange={(event) =>
                  setInvestmentDraft((current) => ({ ...current, notes: event.target.value || null }))
                }
              />
            </Field>
            <div className="flex justify-end gap-3">
              {editingInvestmentId ? (
                <Button type="button" variant="secondary" onClick={() => {
                  setEditingInvestmentId(null)
                  setInvestmentDraft(emptyInvestment)
                }}>
                  Cancel
                </Button>
              ) : null}
              <Button type="submit">{editingInvestmentId ? 'Update Investment' : 'Add Investment'}</Button>
            </div>
          </form>
        </AppCard>
      </div>
    </div>
  )
}
