import { useEffect, useMemo, useState } from 'react'
import { getCosts, getProjects } from '../api'
import { AppCard, EmptyState, ErrorState, PageIntro, SectionHeading, Select, StatCard } from '../components/ui'
import { formatCurrency } from '../lib/format'
import type { Cost, Project } from '../types'
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

export default function Monthly() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [projects, setProjects] = useState<Project[]>([])
  const [costs, setCosts] = useState<Cost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [projectsData, costsData] = await Promise.all([
        getProjects(),
        getCosts({ month, year }),
      ])
      setProjects(projectsData)
      setCosts(costsData)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to load monthly view.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [month, year])

  const revenueRows = useMemo(
    () =>
      projects
        .map((p) => projectRevenueForMonth(p, year, month))
        .filter((r) => r.gross > 0)
        .sort((a, b) => b.net - a.net),
    [month, projects, year],
  )

  const totalRevenue = revenueRows.reduce((sum, r) => sum + r.net, 0)
  const totalCosts = costs.reduce((sum, c) => sum + c.amount, 0)
  const profit = totalRevenue - totalCosts

  return (
    <div className="space-y-6">
      <PageIntro
        title="Monthly P&L"
        description="Revenue attribution, costs, and profit for a single month."
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
          <StatCard label="Revenue" value={formatCurrency(totalRevenue, 'NOK')} />
          <StatCard label="Costs" value={formatCurrency(totalCosts, 'NOK')} />
          <StatCard label="Net Profit" value={formatCurrency(profit, 'NOK')} />
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        {/* Revenue breakdown */}
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
                        description="Paid milestones and dated tips appear here once inside the selected month."
                      />
                    </td>
                  </tr>
                ) : (
                  revenueRows.map((row) => (
                    <tr key={row.projectId} className="border-b border-slate-700/50 last:border-0">
                      <td className="px-4 py-2.5 font-medium text-slate-100">{row.projectName}</td>
                      <td className="px-4 py-2.5 text-slate-400">{row.clientName}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-300">
                        {formatCurrency(row.gross, row.currency)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-500">
                        {formatCurrency(row.fee, row.currency)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-medium text-slate-100">
                        {formatCurrency(row.net, row.currency)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </AppCard>

        {/* Costs */}
        <AppCard>
          <SectionHeading title="Costs" description="Operating costs for the selected month." />
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
                      <EmptyState
                        title="No costs this month"
                        description="Monthly costs appear here once added in the costs ledger."
                      />
                    </td>
                  </tr>
                ) : (
                  costs.map((cost) => (
                    <tr key={cost.id} className="border-b border-slate-700/50 last:border-0">
                      <td className="px-4 py-2.5 text-slate-200">{cost.description}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-500">{cost.category}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-300">
                        {formatCurrency(cost.amount, 'NOK')}
                      </td>
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
