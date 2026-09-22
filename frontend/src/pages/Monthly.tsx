import { useEffect, useMemo, useState } from 'react'
import { getEffectiveCosts, getExchangeRates, getProjects } from '../api'
import { AppCard, Button, EmptyState, ErrorState, PageIntro, SectionHeading, StatCard } from '../components/ui'
import { convertAmount, formatCurrency } from '../lib/format'
import { useMainCurrency } from '../lib/useMainCurrency'
import type { Currency, EffectiveCost, ExchangeRate, Project } from '../types'
import { MONTH_FULL_NAMES } from '../types'

function projectRevenueForMonth(project: Project, year: number, month: number) {
  const prefix = `${year}-${String(month).padStart(2, '0')}`
  const milestoneRevenue = project.milestones
    .filter((m) => m.status === 'Paid' && m.datePaid?.startsWith(prefix))
    .reduce((sum, m) => sum + m.amount, 0)
  const tipRevenue = project.tips
    .filter((t) => t.date.startsWith(prefix))
    .reduce((sum, t) => sum + t.amount, 0)
  const gross = milestoneRevenue + tipRevenue
  return {
    projectId: project.id,
    clientName: project.clientName,
    projectName: project.projectName,
    currency: project.currency,
    gross,
    fee: gross * (project.feePercentage / 100),
    net: gross - gross * (project.feePercentage / 100),
  }
}

function MoneyCell({ amount, currency, mainCurrency, rates, month, year, className = '' }: {
  amount: number
  currency: Currency
  mainCurrency: Currency
  rates: ExchangeRate[]
  month: number
  year: number
  className?: string
}) {
  // Exact month only: this page IS the month, so a neighbouring month's rate would be
  // a quiet lie. A missing rate shows the amount with no conversion, and the totals
  // above say which currency is missing.
  const converted = convertAmount(amount, currency, mainCurrency, rates, month, year, { exact: true })
  const hasConversion = converted !== null && currency !== mainCurrency
  return (
    <td className={`px-4 py-3 text-right font-mono tabular-nums ${className}`}>
      {hasConversion ? (
        <span className="group relative cursor-help border-b border-dashed border-[var(--border-default)]">
          {formatCurrency(amount, currency)}
          <span className="pointer-events-none absolute bottom-full right-0 z-10 mb-1.5 whitespace-nowrap rounded bg-[var(--bg-elevated)] px-2 py-1 text-xs font-medium text-[var(--accent)] opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
            {formatCurrency(converted, mainCurrency)}
          </span>
        </span>
      ) : (
        formatCurrency(amount, currency)
      )}
    </td>
  )
}

function MoneyLine({ label, amount, currency, mainCurrency, rates, month, year }: {
  label: string
  amount: number
  currency: Currency
  mainCurrency: Currency
  rates: ExchangeRate[]
  month: number
  year: number
}) {
  const converted = convertAmount(amount, currency, mainCurrency, rates, month, year, { exact: true })
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span style={{ color: 'var(--text-tertiary)' }}>{label}</span>
      <span className="text-right font-mono tabular-nums" style={{ color: 'var(--text-primary)' }}>
        {formatCurrency(amount, currency)}
        {converted !== null && currency !== mainCurrency && (
          <span className="ml-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>{formatCurrency(converted, mainCurrency)}</span>
        )}
      </span>
    </div>
  )
}

function DonutChart({ revenue, costs, profit, currency }: {
  revenue: number
  costs: number
  profit: number
  currency: Currency
}) {
  const total = revenue + costs
  if (total === 0) return null

  const revPct = revenue / total
  const costPct = costs / total
  const r = 52
  const circ = 2 * Math.PI * r
  const revLen = circ * revPct
  const costLen = circ * costPct

  return (
    <div className="flex items-center gap-6">
      <div className="relative h-36 w-36 shrink-0">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          {/* Revenue arc */}
          <circle cx="60" cy="60" r={r} fill="none" stroke="#6ba299" strokeWidth="12"
            strokeDasharray={`${revLen} ${circ}`} strokeLinecap="round" />
          {/* Costs arc */}
          <circle cx="60" cy="60" r={r} fill="none" stroke="#c97264" strokeWidth="12"
            strokeDasharray={`${costLen} ${circ}`} strokeDashoffset={-revLen} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[10px] font-medium text-[var(--text-tertiary)]">Profit</span>
          <span
            className="font-mono tabular-nums text-sm font-semibold"
            style={{ color: profit >= 0 ? 'var(--paid)' : 'var(--overdue)' }}
          >
            {formatCurrency(profit, currency)}
          </span>
        </div>
      </div>
      <div className="grid gap-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#6ba299]" />
          <span className="text-[var(--text-secondary)]">Revenue</span>
          <span className="ml-auto font-mono tabular-nums text-[var(--text-primary)]">{formatCurrency(revenue, currency)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#c97264]" />
          <span className="text-[var(--text-secondary)]">Costs</span>
          <span className="ml-auto font-mono tabular-nums text-[var(--text-primary)]">{formatCurrency(costs, currency)}</span>
        </div>
        <div className="mt-1 border-t border-[var(--border-faint)] pt-2 flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#5fad7e]" />
          <span className="text-[var(--text-secondary)]">Net Profit</span>
          <span
            className="ml-auto font-mono tabular-nums font-medium"
            style={{ color: profit >= 0 ? 'var(--paid)' : 'var(--overdue)' }}
          >
            {formatCurrency(profit, currency)}
          </span>
        </div>
      </div>
    </div>
  )
}

export default function Monthly() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [projects, setProjects] = useState<Project[]>([])
  const [costs, setCosts] = useState<EffectiveCost[]>([])
  const [rates, setRates] = useState<ExchangeRate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mainCurrency] = useMainCurrency()

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [projectsData, costsData, ratesData] = await Promise.all([
        getProjects(),
        getEffectiveCosts(month, year),
        getExchangeRates({ month, year }),
      ])
      setProjects(projectsData)
      setCosts(costsData)
      setRates(ratesData)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to load monthly view.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [month, year])

  const prev = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  const next = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }
  const prevYear = () => setYear(y => y - 1)
  const nextYear = () => setYear(y => y + 1)

  const revenueRows = useMemo(
    () =>
      projects
        .map((p) => projectRevenueForMonth(p, year, month))
        .filter((r) => r.gross > 0)
        .sort((a, b) => b.net - a.net),
    [month, projects, year],
  )

  // A row whose currency has no rate this month is LEFT OUT of the total and named
  // in the warning. It used to be added in unconverted, so a USD figure sat inside a
  // number labelled NOK.
  const unconvertible = new Set<string>()
  const totalRevenueMain = revenueRows.reduce((sum, r) => {
    const c = convertAmount(r.net, r.currency, mainCurrency, rates, month, year, { exact: true })
    if (c === null) {
      unconvertible.add(r.currency)
      return sum
    }
    return sum + c
  }, 0)
  const totalCostsNok = costs.reduce((sum, c) => sum + c.amountNok, 0)
  const totalCostsMain = (() => {
    if (mainCurrency === 'NOK') return totalCostsNok
    const c = convertAmount(totalCostsNok, 'NOK', mainCurrency, rates, month, year, { exact: true })
    if (c === null) {
      unconvertible.add(mainCurrency)
      return 0
    }
    return c
  })()
  const profit = totalRevenueMain - totalCostsMain
  const missing = [...unconvertible].sort()

  return (
    <div className="space-y-6">
      <PageIntro
        title="Monthly P&L"
        description={`Hover amounts to see ${mainCurrency} equivalent.`}
        action={
          <div className="flex items-center gap-1">
            <Button variant="ghost" className="px-2" onClick={prev}>
              <span className="text-lg">‹</span>
            </Button>
            <span className="min-w-[140px] text-center text-sm font-medium text-[var(--text-primary)]">
              {MONTH_FULL_NAMES[month - 1]}{' '}
              <span className="inline-flex items-center gap-0.5">
                <button onClick={prevYear} className="cursor-pointer text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors px-0.5">‹</button>
                <span className="text-[var(--text-secondary)]">{year}</span>
                <button onClick={nextYear} className="cursor-pointer text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors px-0.5">›</button>
              </span>
            </span>
            <Button variant="ghost" className="px-2" onClick={next}>
              <span className="text-lg">›</span>
            </Button>
          </div>
        }
      />

      {error && <ErrorState message={error} onRetry={() => void load()} />}
      {!loading && missing.length > 0 && (
        <div
          className="rounded-md px-4 py-3 text-sm"
          style={{ border: '1px solid rgba(245, 158, 11, 0.4)', background: 'rgba(245, 158, 11, 0.12)', color: 'var(--text-primary)' }}
        >
          No {mainCurrency} rate on file for {missing.map((c) => (c === mainCurrency ? 'the NOK costs' : c)).join(', ')} in {MONTH_FULL_NAMES[month - 1]} {year}. Those amounts are shown in their own currency and left out of the totals, so the profit figure is incomplete. Fetch the month in Settings.
        </div>
      )}

      {/* Summary row: donut + stat cards */}
      {!loading && (
        <div className="grid gap-4 xl:grid-cols-[auto_1fr]">
          {(totalRevenueMain > 0 || totalCostsMain > 0) && (
            <AppCard className="p-5">
              <DonutChart revenue={totalRevenueMain} costs={totalCostsMain} profit={profit} currency={mainCurrency} />
            </AppCard>
          )}
          <div className="grid content-start gap-3 sm:grid-cols-3">
            <StatCard label="Revenue" value={formatCurrency(totalRevenueMain, mainCurrency)} />
            <StatCard label="Costs" value={formatCurrency(totalCostsMain, mainCurrency)} />
            <StatCard label="Net Profit" value={formatCurrency(profit, mainCurrency)} hint={
              totalRevenueMain > 0 ? `${Math.round((profit / totalRevenueMain) * 100)}% margin` : undefined
            } />
          </div>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <AppCard>
          <SectionHeading
            title="Revenue Breakdown"
            description={`${MONTH_FULL_NAMES[month - 1]} ${year}`}
          />
          <ul className="flex flex-col gap-2 p-4 lg:hidden">
            {revenueRows.length === 0 && (
              <EmptyState title="No paid revenue this month" description="Paid milestones and tips appear here." />
            )}
            {revenueRows.map((row) => (
              <li key={row.projectId} className="rounded-lg p-4" style={{ border: '1px solid var(--border-faint)', background: 'var(--bg-elevated)' }}>
                <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{row.projectName}</p>
                <p className="mb-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>{row.clientName}</p>
                <MoneyLine label="Gross" amount={row.gross} currency={row.currency} mainCurrency={mainCurrency} rates={rates} month={month} year={year} />
                <MoneyLine label="Fee" amount={row.fee} currency={row.currency} mainCurrency={mainCurrency} rates={rates} month={month} year={year} />
                <MoneyLine label="Net" amount={row.net} currency={row.currency} mainCurrency={mainCurrency} rates={rates} month={month} year={year} />
              </li>
            ))}
          </ul>
          <div className="hidden lg:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-faint)] text-left">
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Project</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Client</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Gross</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Fee</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Net</th>
                </tr>
              </thead>
              <tbody>
                {revenueRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8">
                      <EmptyState title="No paid revenue this month" description="Paid milestones and tips appear here." />
                    </td>
                  </tr>
                ) : (
                  revenueRows.map((row) => (
                    <tr key={row.projectId} className="border-b border-[var(--border-faint)] last:border-0 transition-colors hover:bg-[var(--bg-elevated)]">
                      <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{row.projectName}</td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{row.clientName}</td>
                      <MoneyCell amount={row.gross} currency={row.currency} mainCurrency={mainCurrency} rates={rates} month={month} year={year} className="text-[var(--text-secondary)]" />
                      <MoneyCell amount={row.fee} currency={row.currency} mainCurrency={mainCurrency} rates={rates} month={month} year={year} className="text-[var(--text-tertiary)]" />
                      <MoneyCell amount={row.net} currency={row.currency} mainCurrency={mainCurrency} rates={rates} month={month} year={year} className="font-medium text-[var(--text-primary)]" />
                    </tr>
                  ))
                )}
                {revenueRows.length > 0 && (() => {
                  const totalsByCurrency = revenueRows.reduce<Partial<Record<Currency, {gross: number; fee: number; net: number}>>>((acc, r) => {
                    const e = acc[r.currency] ??= {gross: 0, fee: 0, net: 0}
                    e.gross += r.gross; e.fee += r.fee; e.net += r.net
                    return acc
                  }, {})
                  return (Object.entries(totalsByCurrency) as Array<[Currency, {gross: number; fee: number; net: number}]>).map(([currency, t]) => (
                    <tr key={currency} className="border-t-2 border-[var(--border-default)] bg-[var(--bg-surface)]">
                      <td className="px-4 py-2.5 text-xs font-medium text-[var(--text-secondary)]" colSpan={2}>Total ({currency})</td>
                      <MoneyCell amount={t.gross} currency={currency} mainCurrency={mainCurrency} rates={rates} month={month} year={year} className="font-semibold text-[var(--text-primary)]" />
                      <MoneyCell amount={t.fee} currency={currency} mainCurrency={mainCurrency} rates={rates} month={month} year={year} className="font-semibold text-[var(--text-secondary)]" />
                      <MoneyCell amount={t.net} currency={currency} mainCurrency={mainCurrency} rates={rates} month={month} year={year} className="font-semibold text-[var(--text-primary)]" />
                    </tr>
                  ))
                })()}
              </tbody>
            </table>
          </div>
        </AppCard>

        <AppCard>
          <SectionHeading title="Costs" />
          <ul className="flex flex-col gap-2 p-4 lg:hidden">
            {costs.length === 0 && <EmptyState title="No costs this month" description="Add costs in the Costs page." />}
            {costs.map((cost) => (
              <li key={cost.id} className="flex items-baseline justify-between gap-3 rounded-lg p-4 text-sm" style={{ border: '1px solid var(--border-faint)', background: 'var(--bg-elevated)' }}>
                <span>
                  <span style={{ color: 'var(--text-primary)' }}>{cost.description}</span>
                  <span className="ml-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>{cost.category}</span>
                </span>
                <span className="font-mono tabular-nums" style={{ color: 'var(--text-primary)' }}>{formatCurrency(cost.amount, cost.currency)}</span>
              </li>
            ))}
          </ul>
          <div className="hidden lg:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-faint)] text-left">
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Description</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Cat</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Amount</th>
                </tr>
              </thead>
              <tbody>
                {costs.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8">
                      <EmptyState title="No costs this month" description="Add costs in the Costs page." />
                    </td>
                  </tr>
                ) : (
                  costs.map((cost) => (
                    <tr key={cost.id} className="border-b border-[var(--border-faint)] last:border-0 transition-colors hover:bg-[var(--bg-elevated)]">
                      <td className="px-4 py-3 text-[var(--text-primary)]">{cost.description}</td>
                      <td className="px-4 py-3 text-xs text-[var(--text-tertiary)]">{cost.category}</td>
                      <MoneyCell amount={cost.amount} currency={cost.currency} mainCurrency={mainCurrency} rates={rates} month={month} year={year} className="text-[var(--text-secondary)]" />
                    </tr>
                  ))
                )}
                {costs.length > 0 && (() => {
                  const costsByCurrency = costs.reduce<Partial<Record<Currency, number>>>((acc, c) => {
                    acc[c.currency] = (acc[c.currency] ?? 0) + c.amount
                    return acc
                  }, {})
                  return (Object.entries(costsByCurrency) as Array<[Currency, number]>).map(([currency, total]) => (
                    <tr key={currency} className="border-t-2 border-[var(--border-default)] bg-[var(--bg-surface)]">
                      <td className="px-4 py-2.5 text-xs font-medium text-[var(--text-secondary)]" colSpan={2}>Total ({currency})</td>
                      <MoneyCell amount={total} currency={currency} mainCurrency={mainCurrency} rates={rates} month={month} year={year} className="font-semibold text-[var(--text-primary)]" />
                    </tr>
                  ))
                })()}
              </tbody>
            </table>
          </div>
        </AppCard>
      </div>
    </div>
  )
}
