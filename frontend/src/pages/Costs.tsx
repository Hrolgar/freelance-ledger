import { useEffect, useMemo, useState } from 'react'
import {
  createCost,
  createInvestment,
  deleteCost,
  deleteInvestment,
  getCosts,
  getEffectiveCosts,
  getExchangeRates,
  getInvestments,
  updateCost,
  updateInvestment,
} from '../api'
import { Modal } from '../components/Modal'
import {
  AppCard,
  Button,
  Checkbox,
  EmptyState,
  ErrorState,
  Field,
  Input,
  PageIntro,
  Select,
  SectionHeading,
  StatCard,
  Textarea,
} from '../components/ui'
import { formatCurrency, getRateForMonth } from '../lib/format'
import { useMainCurrency } from '../lib/useMainCurrency'
import type {
  Cost,
  CostInput,
  Currency,
  EffectiveCost,
  ExchangeRate,
  Investment,
  InvestmentCategory,
  InvestmentInput,
} from '../types'
import {
  COST_CATEGORIES_UI,
  CURRENCIES,
  INVESTMENT_CATEGORIES,
  MONTH_FULL_NAMES,
  MONTH_NAMES,
} from '../types'

const now = new Date()
const currentYear = now.getFullYear()
const currentMonth = now.getMonth() + 1
const threeMonthsAgo = currentYear * 12 + currentMonth - 3

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

function isCurrentlyActive(cost: Cost): boolean {
  if (!cost.recurring) return false
  if (cost.year * 12 + cost.month > currentYear * 12 + currentMonth) return false
  if (cost.endMonth && cost.endYear && cost.endYear * 12 + cost.endMonth < currentYear * 12 + currentMonth) return false
  return true
}

function activeForMonth(cost: Cost, m: number, y: number): boolean {
  if (!cost.recurring) return false
  const picked = y * 12 + m
  if (cost.year * 12 + cost.month > picked) return false
  if (!cost.endMonth || !cost.endYear) return true
  return cost.endYear * 12 + cost.endMonth >= picked
}

function CostMoney({ amount, currency, month, year, rates, mainCurrency, className = '' }: {
  amount: number
  currency: Currency
  month: number
  year: number
  rates: ExchangeRate[]
  mainCurrency: Currency
  className?: string
}) {
  if (currency === mainCurrency) {
    return <span className={`font-mono tabular-nums ${className}`}>{formatCurrency(amount, currency)}</span>
  }
  const fromRate = getRateForMonth(rates, currency, month, year)
  const toRate = mainCurrency === 'NOK' ? 1 : getRateForMonth(rates, mainCurrency as Currency, month, year)
  if (fromRate == null || toRate == null) {
    return <span className={`font-mono tabular-nums ${className}`}>{formatCurrency(amount, currency)}</span>
  }
  const converted = (amount * fromRate) / toRate
  return (
    <span className={`group relative cursor-help border-b border-dashed border-[var(--border-default)] font-mono tabular-nums ${className}`}>
      {formatCurrency(amount, currency)}
      <span className="pointer-events-none absolute bottom-full right-0 z-10 mb-1.5 whitespace-nowrap rounded bg-[var(--bg-elevated)] px-2 py-1 text-xs font-medium text-[var(--accent)] opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
        {formatCurrency(converted, mainCurrency)}
      </span>
    </span>
  )
}

function TypeBadge({ type }: { type: 'Subscription' | 'Expense' | 'Investment' }) {
  const styles = {
    Subscription: 'bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent)]/20',
    Expense: 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-faint)]',
    Investment: 'bg-[var(--paid)]/15 text-[var(--paid)] border-[var(--paid)]/20',
  }
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${styles[type]}`}>
      {type}
    </span>
  )
}

function NotesChip({ notes }: { notes: string }) {
  return (
    <span title={notes} className="ml-2 inline-flex cursor-help items-center rounded bg-[var(--accent-soft)] px-1 text-[10px] font-bold text-[var(--accent)]">
      ⓘ
    </span>
  )
}

export default function Costs() {
  const [costs, setCosts] = useState<Cost[]>([])
  const [investments, setInvestments] = useState<Investment[]>([])
  const [rates, setRates] = useState<ExchangeRate[]>([])
  const [costDraft, setCostDraft] = useState<CostInput>(emptyCost)
  const [investmentDraft, setInvestmentDraft] = useState<InvestmentInput>(emptyInvestment)
  const [editingCostId, setEditingCostId] = useState<number | null>(null)
  const [editingInvestmentId, setEditingInvestmentId] = useState<number | null>(null)
  const [showCostModal, setShowCostModal] = useState(false)
  const [showInvestmentModal, setShowInvestmentModal] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [month, setMonth] = useState(currentMonth)
  const [year, setYear] = useState(currentYear)
  const [showArchived, setShowArchived] = useState(false)
  const [ytdCostsOnlyNok, setYtdCostsOnlyNok] = useState(0)
  const [mainCurrency] = useMainCurrency()

  const load = async () => {
    setError(null)
    try {
      const [costData, investmentData, ratesData] = await Promise.all([
        getCosts(),
        getInvestments(),
        getExchangeRates(),
      ])
      setCosts(costData)
      setInvestments(investmentData)
      setRates(ratesData)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to load costs.')
    }
  }

  useEffect(() => { void load() }, [])

  // YTD costs via effective costs API (handles recurring expansion and NOK conversion server-side)
  useEffect(() => {
    const months = Array.from({ length: currentMonth }, (_, i) => i + 1)
    void Promise.allSettled(months.map((m) => getEffectiveCosts(m, currentYear))).then((results) => {
      const total = results
        .filter((r): r is PromiseFulfilledResult<EffectiveCost[]> => r.status === 'fulfilled')
        .flatMap((r) => r.value)
        .reduce((s, c) => s + c.amountNok, 0)
      setYtdCostsOnlyNok(total)
    })
  }, [])

  const activeRecurring = useMemo(() => costs.filter(isCurrentlyActive), [costs])

  // KPI 1: active monthly burn in NOK
  const activeBurnNok = useMemo(
    () => activeRecurring.reduce((s, c) => {
      const rate = getRateForMonth(rates, c.currency as Currency, currentMonth, currentYear)
      return s + (rate !== null ? c.amount * rate : 0)
    }, 0),
    [activeRecurring, rates],
  )

  const thisMonthRecurring = useMemo(() => costs.filter((c) => activeForMonth(c, month, year)), [costs, month, year])
  const thisMonthOneTime = useMemo(
    () => costs.filter((c) => !c.recurring && c.month === month && c.year === year),
    [costs, month, year],
  )
  const thisMonthInvestments = useMemo(
    () => investments.filter((i) => i.month === month && i.year === year),
    [investments, month, year],
  )

  // KPI 2: this month's spend in NOK
  const thisMonthNok = useMemo(() => {
    const costNok = [...thisMonthRecurring, ...thisMonthOneTime].reduce((s, c) => {
      const rate = getRateForMonth(rates, c.currency as Currency, month, year)
      return s + (rate !== null ? c.amount * rate : 0)
    }, 0)
    const invNok = thisMonthInvestments.reduce((s, i) => s + i.amount * i.nokRate, 0)
    return costNok + invNok
  }, [thisMonthRecurring, thisMonthOneTime, thisMonthInvestments, rates, month, year])

  const ytdInvestmentsNok = useMemo(
    () => investments
      .filter((i) => i.year === currentYear && i.month <= currentMonth)
      .reduce((s, i) => s + i.amount * i.nokRate, 0),
    [investments],
  )
  const ytdTotalNok = ytdCostsOnlyNok + ytdInvestmentsNok

  const archivedRecurring = useMemo(
    () => costs.filter((c) => c.recurring && c.endMonth && c.endYear && c.endYear * 12 + c.endMonth < currentYear * 12 + currentMonth),
    [costs],
  )
  const archivedOneTime = useMemo(
    () => costs.filter((c) => !c.recurring && c.year * 12 + c.month < threeMonthsAgo),
    [costs],
  )
  const archivedInvestments = useMemo(
    () => investments.filter((i) => i.year * 12 + i.month < threeMonthsAgo),
    [investments],
  )
  const totalArchived = archivedRecurring.length + archivedOneTime.length + archivedInvestments.length

  const prev = () => {
    if (month === 1) { setMonth(12); setYear((y) => y - 1) }
    else setMonth((m) => m - 1)
  }
  const next = () => {
    if (month === 12) { setMonth(1); setYear((y) => y + 1) }
    else setMonth((m) => m + 1)
  }

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

  function thisMonthFooter() {
    const byCurrency: Record<string, number> = {}
    for (const c of [...thisMonthRecurring, ...thisMonthOneTime]) {
      byCurrency[c.currency] = (byCurrency[c.currency] ?? 0) + c.amount
    }
    for (const i of thisMonthInvestments) {
      byCurrency[i.currency] = (byCurrency[i.currency] ?? 0) + i.amount
    }
    return (
      <>
        {Object.entries(byCurrency).map(([currency, total]) => (
          <tr key={currency} className="border-t border-[var(--border-faint)] bg-[var(--bg-surface)]/50">
            <td className="px-4 py-2 text-xs text-[var(--text-tertiary)]" colSpan={3}>{currency} total</td>
            <td className="px-4 py-2 text-right">
              <CostMoney amount={total} currency={currency as Currency} month={month} year={year} rates={rates} mainCurrency={mainCurrency as Currency} />
            </td>
            <td />
          </tr>
        ))}
        <tr className="border-t-2 border-[var(--border-default)] bg-[var(--bg-surface)]">
          <td className="px-4 py-2.5 text-xs font-medium text-[var(--text-secondary)]" colSpan={3}>Total (NOK)</td>
          <td className="px-4 py-2.5 text-right font-mono tabular-nums font-semibold text-[var(--text-primary)]">
            {formatCurrency(thisMonthNok, 'NOK')}
          </td>
          <td />
        </tr>
      </>
    )
  }

  return (
    <div className="space-y-6">
      <PageIntro
        title="Costs & Investments"
        description="Subscriptions, one-time expenses, and investments."
        action={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="text-xs"
              onClick={() => { setEditingCostId(null); setCostDraft({ ...emptyCost, recurring: true }); setShowCostModal(true) }}
            >
              + Subscription
            </Button>
            <Button
              variant="secondary"
              className="text-xs"
              onClick={() => { setEditingCostId(null); setCostDraft({ ...emptyCost, recurring: false }); setShowCostModal(true) }}
            >
              + Expense
            </Button>
            <Button
              variant="secondary"
              className="text-xs"
              onClick={() => { setEditingInvestmentId(null); setInvestmentDraft(emptyInvestment); setShowInvestmentModal(true) }}
            >
              + Investment
            </Button>
          </div>
        }
      />

      {error && <ErrorState message={error} onRetry={() => void load()} />}

      {/* KPI strip */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active monthly burn"
          value={formatCurrency(activeBurnNok, 'NOK')}
          hint={`${activeRecurring.length} subscription${activeRecurring.length !== 1 ? 's' : ''}`}
        />
        <StatCard
          label="This month's spend"
          value={formatCurrency(thisMonthNok, 'NOK')}
          hint="subscriptions + expenses + investments"
        />
        <StatCard
          label="YTD spend"
          value={formatCurrency(ytdTotalNok, 'NOK')}
          hint="year to date"
        />
        <StatCard
          label="Active subscriptions"
          value={activeRecurring.length}
          hint="currently billing"
        />
      </div>

      {/* Section 1: This Month */}
      <AppCard>
        <div className="flex items-center justify-between border-b border-[var(--border-faint)] px-4 py-3">
          <p className="text-sm font-medium text-[var(--text-primary)]">This Month</p>
          <div className="flex items-center gap-1">
            <Button variant="ghost" className="px-2" onClick={prev}>
              <span className="text-lg">‹</span>
            </Button>
            <span className="min-w-[130px] text-center text-sm font-medium text-[var(--text-primary)]">
              {MONTH_FULL_NAMES[month - 1]} {year}
            </span>
            <Button variant="ghost" className="px-2" onClick={next}>
              <span className="text-lg">›</span>
            </Button>
          </div>
        </div>

        {thisMonthRecurring.length === 0 && thisMonthOneTime.length === 0 && thisMonthInvestments.length === 0 ? (
          <div className="px-4 py-8">
            <EmptyState title="Nothing this month" description="No subscriptions, expenses, or investments for this period." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-faint)] text-left">
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Description</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Type</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Category</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Amount</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {thisMonthRecurring.map((cost) => (
                  <tr key={`r-${cost.id}`} className="border-b border-[var(--border-faint)] last:border-0 transition-colors hover:bg-[var(--bg-elevated)]">
                    <td className="px-4 py-3 text-[var(--text-primary)]">
                      {cost.description}
                      {cost.notes && <NotesChip notes={cost.notes} />}
                    </td>
                    <td className="px-4 py-3"><TypeBadge type="Subscription" /></td>
                    <td className="px-4 py-3 text-xs text-[var(--text-tertiary)]">{cost.category}</td>
                    <td className="px-4 py-3 text-right">
                      <CostMoney amount={cost.amount} currency={cost.currency as Currency} month={month} year={year} rates={rates} mainCurrency={mainCurrency as Currency} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" className="px-2 text-xs" onClick={() => { editCost(cost); setShowCostModal(true) }}>Edit</Button>
                        <Button variant="danger" className="px-2 text-xs" onClick={() => void removeCost(cost.id)}>Del</Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {thisMonthOneTime.map((cost) => (
                  <tr key={`o-${cost.id}`} className="border-b border-[var(--border-faint)] last:border-0 transition-colors hover:bg-[var(--bg-elevated)]">
                    <td className="px-4 py-3 text-[var(--text-primary)]">
                      {cost.description}
                      {cost.notes && <NotesChip notes={cost.notes} />}
                    </td>
                    <td className="px-4 py-3"><TypeBadge type="Expense" /></td>
                    <td className="px-4 py-3 text-xs text-[var(--text-tertiary)]">{cost.category}</td>
                    <td className="px-4 py-3 text-right">
                      <CostMoney amount={cost.amount} currency={cost.currency as Currency} month={cost.month} year={cost.year} rates={rates} mainCurrency={mainCurrency as Currency} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" className="px-2 text-xs" onClick={() => { editCost(cost); setShowCostModal(true) }}>Edit</Button>
                        <Button variant="danger" className="px-2 text-xs" onClick={() => void removeCost(cost.id)}>Del</Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {thisMonthInvestments.map((inv) => (
                  <tr key={`i-${inv.id}`} className="border-b border-[var(--border-faint)] last:border-0 transition-colors hover:bg-[var(--bg-elevated)]">
                    <td className="px-4 py-3 text-[var(--text-primary)]">
                      {inv.description}
                      {inv.notes && <NotesChip notes={inv.notes} />}
                    </td>
                    <td className="px-4 py-3"><TypeBadge type="Investment" /></td>
                    <td className="px-4 py-3 text-xs text-[var(--text-tertiary)]">{inv.category}</td>
                    <td className="px-4 py-3 text-right">
                      <CostMoney amount={inv.amount} currency={inv.currency as Currency} month={inv.month} year={inv.year} rates={rates} mainCurrency={mainCurrency as Currency} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" className="px-2 text-xs" onClick={() => { editInvestment(inv); setShowInvestmentModal(true) }}>Edit</Button>
                        <Button variant="danger" className="px-2 text-xs" onClick={() => void removeInvestment(inv.id)}>Del</Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {thisMonthFooter()}
              </tbody>
            </table>
          </div>
        )}
      </AppCard>

      {/* Section 2: Active Subscriptions */}
      <AppCard>
        <SectionHeading title="Active Subscriptions" description="Currently billing every month." />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-faint)] text-left">
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Description</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Category</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Started</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Amount/mo</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {activeRecurring.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8">
                    <EmptyState title="No active subscriptions" description="Add subscriptions like Claude Max, Freelancer Plus, etc." />
                  </td>
                </tr>
              ) : (
                activeRecurring.map((cost) => (
                  <tr key={cost.id} className="border-b border-[var(--border-faint)] last:border-0 transition-colors hover:bg-[var(--bg-elevated)]">
                    <td className="px-4 py-3 text-[var(--text-primary)]">
                      {cost.description}
                      {cost.notes && <NotesChip notes={cost.notes} />}
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--text-tertiary)]">{cost.category}</td>
                    <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">{MONTH_NAMES[cost.month - 1]} {cost.year}</td>
                    <td className="px-4 py-3 text-right">
                      <CostMoney amount={cost.amount} currency={cost.currency as Currency} month={currentMonth} year={currentYear} rates={rates} mainCurrency={mainCurrency as Currency} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {!cost.endMonth && (
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
                ))
              )}
              {activeRecurring.length > 0 && (() => {
                const byCurrency = activeRecurring.reduce<Record<string, number>>((acc, c) => {
                  acc[c.currency] = (acc[c.currency] ?? 0) + c.amount
                  return acc
                }, {})
                return Object.entries(byCurrency).map(([currency, total]) => (
                  <tr key={currency} className="border-t-2 border-[var(--border-default)] bg-[var(--bg-surface)]">
                    <td className="px-4 py-2.5 text-xs font-medium text-[var(--text-secondary)]" colSpan={3}>Total / month</td>
                    <td className="px-4 py-2.5 text-right">
                      <CostMoney amount={total} currency={currency as Currency} month={currentMonth} year={currentYear} rates={rates} mainCurrency={mainCurrency as Currency} />
                    </td>
                    <td />
                  </tr>
                ))
              })()}
            </tbody>
          </table>
        </div>
      </AppCard>

      {/* Section 3: Archived (hidden if empty) */}
      {totalArchived > 0 && (
        <AppCard>
          <button
            className="flex w-full items-center justify-between border-b border-[var(--border-faint)] px-4 py-3 text-left transition-colors hover:bg-[var(--bg-elevated)]"
            onClick={() => setShowArchived((v) => !v)}
          >
            <p className="text-sm font-medium text-[var(--text-secondary)]">Archived ({totalArchived} items)</p>
            <span className="text-xs text-[var(--text-tertiary)]">{showArchived ? 'hide' : 'show'}</span>
          </button>
          {showArchived && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-faint)] text-left">
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Description</th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Type</th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Category</th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Period</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Amount</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {archivedRecurring.map((cost) => (
                    <tr key={`ar-${cost.id}`} className="border-b border-[var(--border-faint)] last:border-0 transition-colors hover:bg-[var(--bg-elevated)]">
                      <td className="px-4 py-3 text-[var(--text-tertiary)]">
                        {cost.description}
                        {cost.notes && <NotesChip notes={cost.notes} />}
                      </td>
                      <td className="px-4 py-3"><TypeBadge type="Subscription" /></td>
                      <td className="px-4 py-3 text-xs text-[var(--text-tertiary)]">{cost.category}</td>
                      <td className="px-4 py-3 text-xs text-[var(--text-tertiary)]">{formatPeriod(cost)}</td>
                      <td className="px-4 py-3 text-right">
                        <CostMoney amount={cost.amount} currency={cost.currency as Currency} month={currentMonth} year={currentYear} rates={rates} mainCurrency={mainCurrency as Currency} className="text-[var(--text-tertiary)]" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" className="px-2 text-xs" onClick={() => { editCost(cost); setShowCostModal(true) }}>Edit</Button>
                          <Button variant="danger" className="px-2 text-xs" onClick={() => void removeCost(cost.id)}>Del</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {archivedOneTime.map((cost) => (
                    <tr key={`ao-${cost.id}`} className="border-b border-[var(--border-faint)] last:border-0 transition-colors hover:bg-[var(--bg-elevated)]">
                      <td className="px-4 py-3 text-[var(--text-tertiary)]">
                        {cost.description}
                        {cost.notes && <NotesChip notes={cost.notes} />}
                      </td>
                      <td className="px-4 py-3"><TypeBadge type="Expense" /></td>
                      <td className="px-4 py-3 text-xs text-[var(--text-tertiary)]">{cost.category}</td>
                      <td className="px-4 py-3 text-xs text-[var(--text-tertiary)]">{MONTH_NAMES[cost.month - 1]} {cost.year}</td>
                      <td className="px-4 py-3 text-right">
                        <CostMoney amount={cost.amount} currency={cost.currency as Currency} month={cost.month} year={cost.year} rates={rates} mainCurrency={mainCurrency as Currency} className="text-[var(--text-tertiary)]" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" className="px-2 text-xs" onClick={() => { editCost(cost); setShowCostModal(true) }}>Edit</Button>
                          <Button variant="danger" className="px-2 text-xs" onClick={() => void removeCost(cost.id)}>Del</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {archivedInvestments.map((inv) => (
                    <tr key={`ai-${inv.id}`} className="border-b border-[var(--border-faint)] last:border-0 transition-colors hover:bg-[var(--bg-elevated)]">
                      <td className="px-4 py-3 text-[var(--text-tertiary)]">
                        {inv.description}
                        {inv.notes && <NotesChip notes={inv.notes} />}
                      </td>
                      <td className="px-4 py-3"><TypeBadge type="Investment" /></td>
                      <td className="px-4 py-3 text-xs text-[var(--text-tertiary)]">{inv.category}</td>
                      <td className="px-4 py-3 text-xs text-[var(--text-tertiary)]">{MONTH_NAMES[inv.month - 1]} {inv.year}</td>
                      <td className="px-4 py-3 text-right">
                        <CostMoney amount={inv.amount} currency={inv.currency as Currency} month={inv.month} year={inv.year} rates={rates} mainCurrency={mainCurrency as Currency} className="text-[var(--text-tertiary)]" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" className="px-2 text-xs" onClick={() => { editInvestment(inv); setShowInvestmentModal(true) }}>Edit</Button>
                          <Button variant="danger" className="px-2 text-xs" onClick={() => void removeInvestment(inv.id)}>Del</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AppCard>
      )}

      {showCostModal && (
        <Modal
          title={editingCostId ? 'Edit Cost' : 'Add Cost'}
          onClose={() => { setShowCostModal(false); setEditingCostId(null); setCostDraft(emptyCost) }}
        >
          <form className="grid gap-3" onSubmit={handleCostSave}>
            <Field label="Description" required>
              <Input required value={costDraft.description} onChange={(e) => setCostDraft((c) => ({ ...c, description: e.target.value }))} />
            </Field>
            <div className="grid grid-cols-3 gap-3">
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
            <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <Checkbox checked={costDraft.recurring} onChange={(e) => setCostDraft((c) => ({ ...c, recurring: e.target.checked, endMonth: null, endYear: null }))} />
              Recurring monthly
            </label>
            <div className="grid grid-cols-2 gap-3">
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
              <div className="grid grid-cols-2 gap-3">
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

      {showInvestmentModal && (
        <Modal
          title={editingInvestmentId ? 'Edit Investment' : 'Add Investment'}
          onClose={() => { setShowInvestmentModal(false); setEditingInvestmentId(null); setInvestmentDraft(emptyInvestment) }}
          size="md"
        >
          <form className="grid gap-3" onSubmit={handleInvestmentSave}>
            <Field label="Description" required>
              <Input required value={investmentDraft.description} onChange={(e) => setInvestmentDraft((c) => ({ ...c, description: e.target.value }))} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount">
                <Input type="number" min="0" step="0.01" value={investmentDraft.amount} onChange={(e) => setInvestmentDraft((c) => ({ ...c, amount: Number(e.target.value) }))} />
              </Field>
              <Field label="Currency">
                <Select value={investmentDraft.currency} onChange={(e) => setInvestmentDraft((c) => ({ ...c, currency: e.target.value as Investment['currency'] }))}>
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Category">
                <Select value={investmentDraft.category} onChange={(e) => setInvestmentDraft((c) => ({ ...c, category: e.target.value as InvestmentCategory }))}>
                  {INVESTMENT_CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                </Select>
              </Field>
              <Field label="NOK Rate">
                <Input type="number" min="0" step="0.0001" value={investmentDraft.nokRate} onChange={(e) => setInvestmentDraft((c) => ({ ...c, nokRate: Number(e.target.value) }))} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
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
