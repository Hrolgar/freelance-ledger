import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getPipeline, getProjects, getYearOverview } from '../api'
import { ProjectStatusBadge } from '../components/StatusBadge'
import { AppCard, Button, EmptyState, ErrorState, LoadingState, PageIntro, SectionHeading, StatCard } from '../components/ui'
import { calculateProjectRevenue, formatCurrency, formatMonth } from '../lib/format'
import type { Pipeline, Project, YearOverview } from '../types'

export default function Dashboard() {
  const year = new Date().getFullYear()
  const [overview, setOverview] = useState<YearOverview | null>(null)
  const [pipeline, setPipeline] = useState<Pipeline | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)

    try {
      const [overviewData, pipelineData, projectsData] = await Promise.all([
        getYearOverview(year),
        getPipeline(),
        getProjects(),
      ])
      setOverview(overviewData)
      setPipeline(pipelineData)
      setProjects(projectsData)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to load dashboard.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [year])

  const recentProjects = useMemo(
    () => [...projects].sort((a, b) => b.id - a.id).slice(0, 5),
    [projects],
  )

  const highestMonth = Math.max(...(overview?.months.map((m) => m.revenue) ?? [1]), 1)

  return (
    <div className="space-y-6">
      <PageIntro
        title={`${year} Dashboard`}
        description="Revenue, costs, and pipeline for the current year."
        action={
          <Link to="/projects">
            <Button>New project</Button>
          </Link>
        }
      />

      {loading && <LoadingState label="Loading dashboard" />}
      {error && <ErrorState message={error} onRetry={() => void load()} />}

      {!loading && !error && overview && (
        <>
          {/* Stat row */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Revenue" value={formatCurrency(overview.totalRevenue, 'NOK')} />
            <StatCard label="Costs" value={formatCurrency(overview.totalCosts, 'NOK')} />
            <StatCard label="Net Profit" value={formatCurrency(overview.totalProfit, 'NOK')} />
            <StatCard
              label="Pipeline"
              value={formatCurrency(pipeline?.totalPipelineValue ?? 0, 'NOK')}
              hint={pipeline ? `${pipeline.projects.length} open projects` : undefined}
            />
          </div>

          {/* Monthly revenue chart */}
          <AppCard>
            <SectionHeading title="Monthly Revenue" description={`Net NOK by month, ${year}`} />
            <div className="p-4">
              <div className="flex h-48 items-end gap-1.5">
                {overview.months.map((m) => {
                  const pct = Math.max((m.revenue / highestMonth) * 100, m.revenue > 0 ? 6 : 2)
                  return (
                    <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
                      <div className="flex w-full flex-1 items-end">
                        <div
                          className="w-full rounded-sm bg-blue-500/70 transition-all duration-300 hover:bg-blue-400"
                          style={{ height: `${pct}%` }}
                          title={`${formatMonth(m.month)}: ${formatCurrency(m.revenue, 'NOK')}`}
                        />
                      </div>
                      <span className="font-mono text-[10px] text-slate-500">
                        {formatMonth(m.month)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </AppCard>

          {/* Recent projects + pipeline */}
          <div className="grid gap-4 xl:grid-cols-[1.3fr_0.9fr]">
            <AppCard>
              <SectionHeading
                title="Recent Projects"
                action={
                  <Link className="text-xs text-blue-400 hover:text-blue-300" to="/projects">
                    View all
                  </Link>
                }
              />
              {recentProjects.length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    title="No projects yet"
                    description="Create a project to start tracking milestones and revenue."
                    action={
                      <Link to="/projects">
                        <Button>Add project</Button>
                      </Link>
                    }
                  />
                </div>
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    {recentProjects.map((project) => (
                      <tr
                        key={project.id}
                        className="border-b border-slate-700/50 last:border-0 hover:bg-slate-700/30 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <Link to={`/projects/${project.id}`} className="block">
                            <p className="font-medium text-slate-100">{project.projectName}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{project.clientName} · {project.platform}</p>
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <ProjectStatusBadge status={project.status} />
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm text-slate-300">
                          {formatCurrency(calculateProjectRevenue(project), project.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </AppCard>

            <AppCard>
              <SectionHeading title="Pipeline" description="Quoted and awarded work." />
              {!pipeline || pipeline.projects.length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    title="Pipeline is clear"
                    description="Quoted and awarded projects appear here."
                  />
                </div>
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    {pipeline.projects.map((project) => (
                      <tr
                        key={project.projectId}
                        className="border-b border-slate-700/50 last:border-0 hover:bg-slate-700/30 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <Link to={`/projects/${project.projectId}`} className="block">
                            <p className="font-medium text-slate-100">{project.projectName}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{project.clientName}</p>
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <ProjectStatusBadge status={project.status} />
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm text-slate-300">
                          {formatCurrency(project.netValue, project.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </AppCard>
          </div>
        </>
      )}
    </div>
  )
}
