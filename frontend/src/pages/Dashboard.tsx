import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getPipeline, getProjects, getYearOverview } from '../api'
import { ProjectStatusBadge } from '../components/StatusBadge'
import { AppCard, Button, EmptyState, ErrorState, LoadingState, SectionHeading, StatCard } from '../components/ui'
import { MoneyAmount } from '../components/MoneyAmount'
import { calculateProjectRevenue, formatCurrency, formatMonth } from '../lib/format'
import { useMainCurrency } from '../lib/useMainCurrency'
import type { Pipeline, Project, YearOverview } from '../types'

export default function Dashboard() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [overview, setOverview] = useState<YearOverview | null>(null)
  const [pipeline, setPipeline] = useState<Pipeline | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mainCurrency] = useMainCurrency()

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

  useEffect(() => { void load() }, [year])

  const recentProjects = useMemo(
    () => [...projects].sort((a, b) => b.id - a.id).slice(0, 5),
    [projects],
  )

  const activeProjectCount = useMemo(
    () => projects.filter(p => p.status === 'InProgress' || p.status === 'Awarded').length,
    [projects],
  )

  const highestMonth = Math.max(...(overview?.months.map((m) => m.revenue) ?? [1]), 1)

  const pipelineHint = useMemo(() => {
    if (!pipeline) return 'before fee'
    const parts: string[] = []
    const bs = pipeline.byStatus ?? {}
    if (bs.Quoted) parts.push(`${bs.Quoted} quoted`)
    if (bs.Awarded) parts.push(`${bs.Awarded} awarded`)
    if (bs.InProgress) parts.push(`${bs.InProgress} in progress`)
    if (bs.Completed) parts.push(`${bs.Completed} completed`)
    return parts.length ? parts.join(' · ') : 'before fee'
  }, [pipeline])

  return (
    <div>
      {/* Year nav */}
      <div className="flex items-center justify-between mb-12">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setYear(y => y - 1)}
            className="rounded-md px-2 py-1 text-sm transition-colors hover:bg-[var(--bg-surface)]"
            style={{ color: 'var(--text-tertiary)' }}
          >
            ‹
          </button>
          <span className="px-2 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{year}</span>
          <button
            onClick={() => setYear(y => y + 1)}
            className="rounded-md px-2 py-1 text-sm transition-colors hover:bg-[var(--bg-surface)]"
            style={{ color: 'var(--text-tertiary)' }}
          >
            ›
          </button>
        </div>
        <Link to="/projects">
          <Button>New project</Button>
        </Link>
      </div>

      {loading && <LoadingState label="Loading dashboard" />}
      {error && <ErrorState message={error} onRetry={() => void load()} />}

      {!loading && !error && overview && (
        <>
          {/* A. Hero — net profit at large scale */}
          <section className="mb-16">
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.16em] mb-3"
              style={{ color: 'var(--text-tertiary)' }}
            >
              Net profit · {year}
            </p>
            <p
              className="text-[72px] font-semibold tracking-tight leading-none tnum"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
            >
              {formatCurrency(overview.totalProfit, 'NOK')}
            </p>
            <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              Across {activeProjectCount} active project{activeProjectCount === 1 ? '' : 's'}.
              {pipeline && pipeline.totalPipelineGrossValue > 0 && (
                <> {formatCurrency(pipeline.totalPipelineGrossValue, 'NOK')} in unpaid pipeline.</>
              )}
            </p>
          </section>

          {/* B. Three-card row */}
          <section className="mb-12 grid gap-4 lg:grid-cols-3">
            <StatCard
              label="Revenue YTD"
              value={formatCurrency(overview.totalRevenue, 'NOK')}
              hint={`${overview.months.filter(m => m.revenue > 0).length} active months`}
            />
            <StatCard
              label="Costs YTD"
              value={formatCurrency(overview.totalCosts, 'NOK')}
              hint="recurring + one-time"
            />
            <StatCard
              label="Pipeline"
              value={formatCurrency(pipeline?.totalPipelineGrossValue ?? 0, 'NOK')}
              hint={pipelineHint}
            />
          </section>

          {/* C. Chart card */}
          <AppCard className="mb-12">
            <SectionHeading
              title="Monthly revenue"
              description={`Net NOK by month, ${year} — after fee, before costs`}
            />
            <div className="p-5">
              <div className="flex items-end gap-1.5" style={{ height: 192 }}>
                {overview.months.map((m) => {
                  const pct = Math.max((m.revenue / highestMonth) * 100, m.revenue > 0 ? 8 : 2)
                  return (
                    <div key={m.month} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                      {m.revenue > 0 && (
                        <span className="font-mono text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                          {Math.round(m.revenue / 1000)}k
                        </span>
                      )}
                      <div
                        className="w-full rounded-sm transition-all duration-300"
                        style={{
                          height: `${pct}%`,
                          background: m.revenue > 0 ? 'var(--accent)' : 'var(--bg-elevated)',
                        }}
                        title={`${formatMonth(m.month)}: ${formatCurrency(m.revenue, 'NOK')}`}
                      />
                      <span className="font-mono text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                        {formatMonth(m.month)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </AppCard>

          {/* D. Two-column: Recent projects + Pipeline */}
          <div className="grid gap-4 lg:grid-cols-[1.3fr_0.9fr]">
            <AppCard>
              <SectionHeading
                title="Recent projects"
                action={
                  <Link
                    to="/projects"
                    className="text-xs transition-colors"
                    style={{ color: 'var(--accent)' }}
                  >
                    View all →
                  </Link>
                }
              />
              {recentProjects.length === 0 ? (
                <div className="p-5">
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
                        className="transition-colors"
                        style={{ borderBottom: '1px solid var(--border-faint)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <td className="px-5 py-3.5">
                          <Link to={`/projects/${project.id}`} className="block">
                            <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                              {project.projectName}
                            </p>
                            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                              {project.clientName} · {project.platform?.name ?? '—'}
                            </p>
                          </Link>
                        </td>
                        <td className="px-5 py-3.5 align-middle">
                          <ProjectStatusBadge status={project.status} />
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono tabular-nums" style={{ color: 'var(--text-primary)' }}>
                          <MoneyAmount amount={calculateProjectRevenue(project)} currency={project.currency} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </AppCard>

            <AppCard>
              <SectionHeading
                title="Pipeline"
                description="Outstanding revenue across all open projects"
              />
              {!pipeline || pipeline.projects.length === 0 ? (
                <div className="p-5">
                  <EmptyState
                    title="Pipeline is clear"
                    description="No outstanding revenue across open projects."
                  />
                </div>
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    {pipeline.projects.map((project) => (
                      <tr
                        key={project.projectId}
                        className="transition-colors"
                        style={{ borderBottom: '1px solid var(--border-faint)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <td className="px-5 py-3.5">
                          <Link to={`/projects/${project.projectId}`} className="block">
                            <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                              {project.projectName}
                            </p>
                            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                              {project.clientName}
                            </p>
                          </Link>
                        </td>
                        <td className="px-5 py-3.5 align-middle">
                          <ProjectStatusBadge status={project.status} />
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono tabular-nums" style={{ color: 'var(--text-primary)' }}>
                          <MoneyAmount amount={project.unpaidNet} currency={project.currency} />
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
