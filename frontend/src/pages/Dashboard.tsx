import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getYearOverview, getPipeline, getProjects } from '../api'
import { AppCard, Button, EmptyState, ErrorState, LoadingState, PageIntro, SectionHeading, StatCard } from '../components/ui'
import { calculateProjectRevenue, formatCurrency, formatMonth, projectStatusTone } from '../lib/format'
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
    () => [...projects].sort((left, right) => right.id - left.id).slice(0, 5),
    [projects],
  )

  const highestMonth = Math.max(...(overview?.months.map((month) => month.revenue) ?? [1]), 1)

  return (
    <div className="space-y-8">
      <PageIntro
        title={`${year} Dashboard`}
        description="Track revenue, operating costs, and near-term pipeline from one yearly view."
        action={
          <Link to="/projects" className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto">Open project pipeline</Button>
          </Link>
        }
      />

      {loading ? <LoadingState label="Loading dashboard" /> : null}
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

      {!loading && !error && overview ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total Revenue" value={formatCurrency(overview.totalRevenue, 'NOK')} />
            <StatCard label="Total Costs" value={formatCurrency(overview.totalCosts, 'NOK')} />
            <StatCard label="Net Profit" value={formatCurrency(overview.totalProfit, 'NOK')} />
            <StatCard
              label="Pipeline Value"
              value={formatCurrency(pipeline?.totalPipelineValue ?? 0, 'NOK')}
              hint={pipeline ? `${pipeline.projects.length} pipeline projects` : 'No open pipeline'}
            />
          </div>

          <AppCard>
            <SectionHeading
              title="Monthly Revenue"
              description="Simple CSS bars show net revenue month by month."
            />
            <div className="p-5">
              <div className="grid h-72 grid-cols-12 gap-3 items-end">
                {overview.months.map((month) => {
                  const height = Math.max((month.revenue / highestMonth) * 100, month.revenue > 0 ? 8 : 3)
                  return (
                    <div key={month.month} className="flex h-full flex-col justify-end gap-3">
                      <div className="flex-1 rounded-2xl border border-zinc-700/70 bg-zinc-900/80 p-2">
                        <div className="flex h-full items-end">
                          <div
                            className="w-full rounded-xl bg-gradient-to-t from-indigo-500 to-indigo-300 transition-all duration-300"
                            style={{ height: `${height}%` }}
                            title={`${formatMonth(month.month)}: ${formatCurrency(month.revenue, 'NOK')}`}
                          />
                        </div>
                      </div>
                      <div className="space-y-1 text-center">
                        <p
                          className="text-xs text-zinc-300"
                          style={{ fontFamily: '"JetBrains Mono", monospace' }}
                        >
                          {formatCurrency(month.revenue, 'NOK')}
                        </p>
                        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                          {formatMonth(month.month)}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </AppCard>

          <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
            <AppCard>
              <SectionHeading
                title="Recent Projects"
                description="Latest created projects with current revenue and status."
                action={
                  <Link className="text-sm text-indigo-300 hover:text-indigo-200" to="/projects">
                    View all
                  </Link>
                }
              />
              <div className="divide-y divide-zinc-700/70">
                {recentProjects.length === 0 ? (
                  <div className="p-5">
                    <EmptyState
                      title="No projects yet"
                      description="Create your first freelance project to start tracking milestones, tips, and fees."
                      action={
                        <Link to="/projects">
                          <Button>Add project</Button>
                        </Link>
                      }
                    />
                  </div>
                ) : (
                  recentProjects.map((project) => (
                    <Link
                      key={project.id}
                      to={`/projects/${project.id}`}
                      className="grid gap-3 px-5 py-4 transition hover:bg-zinc-900/60 sm:grid-cols-[1fr_auto_auto]"
                    >
                      <div>
                        <p className="text-base font-medium text-white">{project.projectName}</p>
                        <p className="mt-1 text-sm text-zinc-400">
                          {project.clientName} · {project.platform}
                        </p>
                      </div>
                      <div className="self-center">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${projectStatusTone(project.status)}`}>
                          {project.status === 'InProgress' ? 'In Progress' : project.status}
                        </span>
                      </div>
                      <div
                        className="self-center text-sm text-zinc-200"
                        style={{ fontFamily: '"JetBrains Mono", monospace' }}
                      >
                        {formatCurrency(calculateProjectRevenue(project), project.currency)}
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </AppCard>

            <AppCard>
              <SectionHeading title="Pipeline" description="Quoted and awarded work awaiting conversion." />
              <div className="divide-y divide-zinc-700/70">
                {pipeline && pipeline.projects.length > 0 ? (
                  pipeline.projects.map((project) => (
                    <Link
                      key={project.projectId}
                      to={`/projects/${project.projectId}`}
                      className="block px-5 py-4 transition hover:bg-zinc-900/60"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-base font-medium text-white">{project.projectName}</p>
                          <p className="mt-1 text-sm text-zinc-400">{project.clientName}</p>
                        </div>
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${projectStatusTone(project.status)}`}>
                          {project.status}
                        </span>
                      </div>
                      <div
                        className="mt-3 text-sm text-zinc-200"
                        style={{ fontFamily: '"JetBrains Mono", monospace' }}
                      >
                        {formatCurrency(project.netValue, project.currency)}
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="p-5">
                    <EmptyState
                      title="Pipeline is clear"
                      description="Quoted and awarded projects will appear here once they exist."
                    />
                  </div>
                )}
              </div>
            </AppCard>
          </div>
        </>
      ) : null}
    </div>
  )
}
