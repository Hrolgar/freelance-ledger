import { useEffect, useMemo, useState } from 'react'
import { getEffectiveCosts, getExchangeRates, getProjects } from '../api'
import { AppCard, Button, EmptyState, ErrorState, PageIntro, SectionHeading, StatCard } from '../components/ui'
import { formatCurrency } from '../lib/format'
import { useMainCurrency } from '../lib/useMainCurrency'
import type { EffectiveCost, ExchangeRate, Project } from '../types'
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

function convert(amount: number, fromCurrency: string, mainCurrency: string, rates: ExchangeRate[]): number | null {
  if (fromCurrency === mainCurrency) return amount
  const fromRate = fromCurrency === 'NOK' ? 1 : rates.find((r) => r.currency === fromCurrency)?.rate
  const toRate = mainCurrency === 'NOK' ? 1 : rates.find((r) => r.currency === mainCurrency)?.rate
  if (!fromRate || !toRate) return null
  return (amount * fromRate) / toRate
}

function MoneyCell({ amount, currency, mainCurrency, rates, className = '' }: {
  amount: number
  currency: string
  mainCurrency: string
  rates: ExchangeRate[]
  className?: string
}) {
  const converted = convert(amount, currency, mainCurrency, rates)
  const hasConversion = converted !== null && currency !== mainCurrency
  return (
    <td className={`px-4 py-2.5 text-right font-mono ${className}`}>
      {hasConversion ? (
        <span className="group relative cursor-help border-b border-dashed border-slate-600">
          {formatCurrency(amount, currency)}
          <span className="pointer-events-none absolute bottom-full right-0 z-10 mb-1.5 whitespace-nowrap rounded bg-slate-700 px-2 py-1 text-xs font-medium text-blue-300 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
            {formatCurrency(converted, mainCurrency)}
          </span>
        </span>
      ) : (
        formatCurrency(amount, currency)
      )}
    </td>
  )
}

/** Simple donut chart using SVG */
function DonutChart({ revenue, costs, profit, currency }: {
  revenue: number
  costs: number
  profit: number
  currency: string
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
          <circle cx="60" cy="60" r={r} fill="none" stroke="#3b82f6" strokeWidth="12"
            strokeDasharray={`${revLen} ${circ}`} strokeLinecap="round" />
          {/* Costs arc */}
          <circle cx="60" cy="60" r={r} fill="none" stroke="#ef4444" strokeWidth="12"
            strokeDasharray={`${costLen} ${circ}`} strokeDashoffset={-revLen} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[10px] font-medium text-slate-500">Profit</span>
          <span className="font-mono text-sm font-semibold text-slate-100">{formatCurrency(profit, currency)}</span>
        </div>
      </div>
      <div className="grid gap-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
          <span className="text-slate-400">Revenue</span>
          <span className="ml-auto font-mono text-slate-200">{formatCurrency(revenue, currency)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
          <span className="text-slate-400">Costs</span>
          <span className="ml-auto font-mono text-slate-200">{formatCurrency(costs, currency)}</span>
        </div>
        <div className="mt-1 border-t border-slate-700 pt-2 flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          <span className="text-slate-400">Net Profit</span>
          <span className={`ml-auto font-mono font-medium ${profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
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

  const totalRevenueMain = revenueRows.reduce((sum, r) => {
    const c = convert(r.net, r.currency, mainCurrency, rates)
    return sum + (c ?? r.net)
  }, 0)
  const totalCostsNok = costs.reduce((sum, c) => sum + c.amountNok, 0)
  const totalCostsMain = mainCurrency === 'NOK'
    ? totalCostsNok
    : (() => {
        const nokRate = rates.find((r) => r.currency === mainCurrency)?.rate
        return nokRate ? totalCostsNok / nokRate : totalCostsNok
      })()
  const profit = totalRevenueMain - totalCostsMain

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
            <span className="min-w-[140px] text-center text-sm font-medium text-slate-200">
              {MONTH_FULL_NAMES[month - 1]}{' '}
              <span className="inline-flex items-center gap-0.5">
                <button onClick={prevYear} className="cursor-pointer text-slate-500 hover:text-blue-400 transition-colors px-0.5">‹</button>
                <span className="text-slate-400">{year}</span>
                <button onClick={nextYear} className="cursor-pointer text-slate-500 hover:text-blue-400 transition-colors px-0.5">›</button>
              </span>
            </span>
            <Button variant="ghost" className="px-2" onClick={next}>
              <span className="text-lg">›</span>
            </Button>
          </div>
        }
      />

      {error && <ErrorState message={error} onRetry={() => void load()} />}

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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-left">
                  <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Project</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Client</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">Gross</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">Fee</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">Net</th>
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
                    <tr key={row.projectId} className="border-b border-slate-700/50 last:border-0">
                      <td className="px-4 py-2.5 font-medium text-slate-100">{row.projectName}</td>
                      <td className="px-4 py-2.5 text-slate-400">{row.clientName}</td>
                      <MoneyCell amount={row.gross} currency={row.currency} mainCurrency={mainCurrency} rates={rates} className="text-slate-300" />
                      <MoneyCell amount={row.fee} currency={row.currency} mainCurrency={mainCurrency} rates={rates} className="text-slate-500" />
                      <MoneyCell amount={row.net} currency={row.currency} mainCurrency={mainCurrency} rates={rates} className="font-medium text-slate-100" />
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </AppCard>

        <AppCard>
          <SectionHeading title="Costs" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-left">
                  <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Description</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Cat</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">Amount</th>
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
                    <tr key={cost.id} className="border-b border-slate-700/50 last:border-0">
                      <td className="px-4 py-2.5 text-slate-200">{cost.description}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-500">{cost.category}</td>
                      <MoneyCell amount={cost.amount} currency={cost.currency} mainCurrency={mainCurrency} rates={rates} className="text-slate-300" />
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </AppCard>
      </div>
    </div>
  )
}
