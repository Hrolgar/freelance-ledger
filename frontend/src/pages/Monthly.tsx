import { useEffect, useMemo, useState } from 'react'
import { getCosts, getProjects } from '../api'
import { AppCard, EmptyState, ErrorState, PageIntro, SectionHeading, Select, StatCard } from '../components/ui'
import { formatCurrency } from '../lib/format'
import type { Cost, Project } from '../types'
import { MONTH_FULL_NAMES } from '../types'

function projectRevenueForMonth(project: Project, year: number, month: number) {
  const milestoneRevenue = project.milestones
    .filter(
      (milestone) =>
        milestone.status === 'Paid' &&
        milestone.datePaid?.startsWith(`${year}-${String(month).padStart(2, '0')}`),
    )
    .reduce((sum, milestone) => sum + milestone.amount, 0)

  const tipRevenue = project.tips
    .filter((tip) => tip.date.startsWith(`${year}-${String(month).padStart(2, '0')}`))
    .reduce((sum, tip) => sum + tip.amount, 0)

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

  const years = Array.from({ length: 5 }, (_, index) => now.getFullYear() - 2 + index)

  const load = async () => {
    setLoading(true)
    setError(null)

    try {
      const [projectsData, costsData] = await Promise.all([getProjects(), getCosts({ month, year })])
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
        .map((project) => projectRevenueForMonth(project, year, month))
        .filter((project) => project.gross > 0)
        .sort((left, right) => right.net - left.net),
    [month, projects, year],
  )

  const totalRevenue = revenueRows.reduce((sum, row) => sum + row.net, 0)
  const totalCosts = costs.reduce((sum, cost) => sum + cost.amount, 0)
  const profit = totalRevenue - totalCosts

  return (
    <div className="space-y-8">
      <PageIntro
        title="Monthly P&L"
        description="Inspect one month at a time with direct revenue attribution, recorded operating costs, and final monthly profit."
        action={
          <div className="flex w-full gap-3 sm:w-auto">
            <Select value={month} onChange={(event) => setMonth(Number(event.target.value))}>
              {MONTH_FULL_NAMES.map((name, index) => (
                <option key={name} value={index + 1}>
                  {name}
                </option>
              ))}
            </Select>
            <Select value={year} onChange={(event) => setYear(Number(event.target.value))}>
              {years.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </div>
        }
      />

      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

      {!loading ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Revenue" value={formatCurrency(totalRevenue, 'NOK')} />
          <StatCard label="Costs" value={formatCurrency(totalCosts, 'NOK')} />
          <StatCard label="Net Profit" value={formatCurrency(profit, 'NOK')} />
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <AppCard>
          <SectionHeading
            title="Revenue Breakdown"
            description={`Net project revenue recorded in ${MONTH_FULL_NAMES[month - 1]} ${year}.`}
          />
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-700/70 text-left text-xs uppercase tracking-[0.2em] text-zinc-500">
                  <th className="px-5 py-3 font-medium">Project</th>
                  <th className="px-5 py-3 font-medium">Client</th>
                  <th className="px-5 py-3 text-right font-medium">Gross</th>
                  <th className="px-5 py-3 text-right font-medium">Fee</th>
                  <th className="px-5 py-3 text-right font-medium">Net</th>
                </tr>
              </thead>
              <tbody>
                {revenueRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10">
                      <EmptyState
                        title="No paid revenue this month"
                        description="Paid milestones and dated tips will appear here once they fall inside the selected month."
                      />
                    </td>
                  </tr>
                ) : (
                  revenueRows.map((row) => (
                    <tr key={row.projectId} className="border-b border-zinc-700/50 last:border-0">
                      <td className="px-5 py-4 font-medium text-white">{row.projectName}</td>
                      <td className="px-5 py-4 text-zinc-400">{row.clientName}</td>
                      <td
                        className="px-5 py-4 text-right text-zinc-200"
                        style={{ fontFamily: '"JetBrains Mono", monospace' }}
                      >
                        {formatCurrency(row.gross, row.currency)}
                      </td>
                      <td
                        className="px-5 py-4 text-right text-zinc-400"
                        style={{ fontFamily: '"JetBrains Mono", monospace' }}
                      >
                        {formatCurrency(row.fee, row.currency)}
                      </td>
                      <td
                        className="px-5 py-4 text-right text-white"
                        style={{ fontFamily: '"JetBrains Mono", monospace' }}
                      >
                        {formatCurrency(row.net, row.currency)}
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
            title="Costs"
            description="Operating costs recorded for the selected month."
          />
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-700/70 text-left text-xs uppercase tracking-[0.2em] text-zinc-500">
                  <th className="px-5 py-3 font-medium">Description</th>
                  <th className="px-5 py-3 font-medium">Category</th>
                  <th className="px-5 py-3 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {costs.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-5 py-10">
                      <EmptyState
                        title="No costs in this month"
                        description="Monthly costs will appear here as soon as you add them in the costs ledger."
                      />
                    </td>
                  </tr>
                ) : (
                  costs.map((cost) => (
                    <tr key={cost.id} className="border-b border-zinc-700/50 last:border-0">
                      <td className="px-5 py-4 text-white">{cost.description}</td>
                      <td className="px-5 py-4 text-zinc-400">{cost.category}</td>
                      <td
                        className="px-5 py-4 text-right text-zinc-100"
                        style={{ fontFamily: '"JetBrains Mono", monospace' }}
                      >
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
