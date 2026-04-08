import { useEffect, useMemo, useState } from 'react'
import { getCosts, getExchangeRates, getProjects } from '../api'
import { AppCard, EmptyState, ErrorState, PageIntro, SectionHeading, Select, StatCard } from '../components/ui'
import { formatCurrency } from '../lib/format'
import { useMainCurrency } from '../lib/useMainCurrency'
import type { Cost, ExchangeRate, Project } from '../types'
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

/** Convert an amount from one currency to the main currency using rates */
function convert(amount: number, fromCurrency: string, mainCurrency: string, rates: ExchangeRate[]): number | null {
  if (fromCurrency === mainCurrency) return amount
  // rates are: 1 <currency> = X NOK
  const fromRate = fromCurrency === 'NOK' ? 1 : rates.find((r) => r.currency === fromCurrency)?.rate
  const toRate = mainCurrency === 'NOK' ? 1 : rates.find((r) => r.currency === mainCurrency)?.rate
  if (!fromRate || !toRate) return null
  // amount in NOK, then to target
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

export default function Monthly() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [projects, setProjects] = useState<Project[]>([])
  const [costs, setCosts] = useState<Cost[]>([])
  const [rates, setRates] = useState<ExchangeRate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mainCurrency] = useMainCurrency()

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [projectsData, costsData, ratesData] = await Promise.all([
        getProjects(),
        getCosts({ month, year }),
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

  const revenueRows = useMemo(
    () =>
      projects
        .map((p) => projectRevenueForMonth(p, year, month))
        .filter((r) => r.gross > 0)
        .sort((a, b) => b.net - a.net),
    [month, projects, year],
  )

  // Convert totals to main currency
  const totalRevenueMain = revenueRows.reduce((sum, r) => {
    const c = convert(r.net, r.currency, mainCurrency, rates)
    return sum + (c ?? r.net)
  }, 0)
  const totalCosts = costs.reduce((sum, c) => sum + c.amount, 0)
  // Costs are already in NOK
  const totalCostsMain = mainCurrency === 'NOK'
    ? totalCosts
    : (() => {
        const nokRate = rates.find((r) => r.currency === mainCurrency)?.rate
        return nokRate ? totalCosts / nokRate : totalCosts
      })()
  const profit = totalRevenueMain - totalCostsMain

  return (
    <div className="space-y-6">
      <PageIntro
        title="Monthly P&L"
        description={`Revenue, costs, and profit for ${MONTH_FULL_NAMES[month - 1]} ${year}. Hover amounts to see ${mainCurrency} equivalent.`}
        action={
          <div className="flex gap-2">
            <Select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="w-36">
              {MONTH_FULL_NAMES.map((name, i) => (
                <option key={name} value={i + 1}>{name}</option>
              ))}
            </Select>
            <Select value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-24">
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </Select>
          </div>
        }
      />

      {error && <ErrorState message={error} onRetry={() => void load()} />}

      {!loading && (
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Revenue" value={formatCurrency(totalRevenueMain, mainCurrency)} />
          <StatCard label="Costs" value={formatCurrency(totalCostsMain, mainCurrency)} />
          <StatCard label="Net Profit" value={formatCurrency(profit, mainCurrency)} />
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
                      <EmptyState
                        title="No paid revenue this month"
                        description="Paid milestones and tips appear here."
                      />
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
          <SectionHeading title="Costs" description="Operating costs (NOK)." />
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
                      <MoneyCell amount={cost.amount} currency="NOK" mainCurrency={mainCurrency} rates={rates} className="text-slate-300" />
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
