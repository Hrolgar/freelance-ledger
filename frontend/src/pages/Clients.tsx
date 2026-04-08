import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getProjects } from '../api'
import { AppCard, Button, EmptyState, ErrorState, PageIntro, SectionHeading, StatCard } from '../components/ui'
import { ProjectStatusBadge } from '../components/StatusBadge'
import { formatCurrency, formatDate } from '../lib/format'
import type { Project } from '../types'

function groupByClient(projects: Project[]): Record<string, Project[]> {
  const groups: Record<string, Project[]> = {}
  for (const p of projects) {
    ;(groups[p.clientName] ??= []).push(p)
  }
  return groups
}

function clientStats(projects: Project[]) {
  let totalGross = 0
  let totalFee = 0
  let totalTips = 0
  let paidCount = 0
  for (const p of projects) {
    const paid = p.milestones.filter((m) => m.status === 'Paid').reduce((s, m) => s + m.amount, 0)
    const tips = p.tips.reduce((s, t) => s + t.amount, 0)
    const fee = (paid + tips) * (p.feePercentage / 100)
    totalGross += paid + tips
    totalFee += fee
    totalTips += tips
    if (p.status === 'Paid' || p.status === 'Completed') paidCount++
  }
  return { totalGross, totalFee, totalNet: totalGross - totalFee, totalTips, paidCount }
}

/** Client list page */
function ClientList({ projects }: { projects: Project[] }) {
  const grouped = useMemo(() => groupByClient(projects), [projects])
  const clients = useMemo(
    () =>
      Object.entries(grouped)
        .map(([name, projs]) => ({ name, projects: projs, ...clientStats(projs) }))
        .sort((a, b) => b.totalNet - a.totalNet),
    [grouped],
  )

  return (
    <div className="space-y-6">
      <PageIntro title="Clients" description="All clients grouped with their project history." />

      {clients.length === 0 ? (
        <EmptyState title="No clients yet" description="Clients appear here once you add projects." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {clients.map((client) => (
            <Link key={client.name} to={`/clients/${encodeURIComponent(client.name)}`}>
              <AppCard className="p-4 transition-colors hover:border-blue-500/50">
                <h3 className="text-sm font-semibold text-slate-100">{client.name}</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {client.projects.length} project{client.projects.length !== 1 ? 's' : ''} · {client.paidCount} completed
                </p>
                <div className="mt-3 flex items-baseline gap-3">
                  <span className="font-mono text-lg font-semibold text-slate-100">
                    {formatCurrency(client.totalNet, client.projects[0].currency)}
                  </span>
                  <span className="text-xs text-slate-500">net earned</span>
                </div>
              </AppCard>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

/** Client detail page */
function ClientDetail({ clientName, projects }: { clientName: string; projects: Project[] }) {
  const stats = useMemo(() => clientStats(projects), [projects])

  return (
    <div className="space-y-6">
      <PageIntro
        title={clientName}
        description={`${projects.length} project${projects.length !== 1 ? 's' : ''}`}
        action={<Link to="/clients"><Button variant="secondary">All Clients</Button></Link>}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Total Gross" value={formatCurrency(stats.totalGross, projects[0]?.currency ?? 'NOK')} />
        <StatCard label="Total Net" value={formatCurrency(stats.totalNet, projects[0]?.currency ?? 'NOK')} />
        <StatCard label="Tips" value={formatCurrency(stats.totalTips, projects[0]?.currency ?? 'NOK')} />
      </div>

      <AppCard>
        <SectionHeading title="Projects" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-left">
                <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Project</th>
                <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Status</th>
                <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Platform</th>
                <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Awarded</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">Milestones</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">Paid</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => {
                const paid = p.milestones.filter((m) => m.status === 'Paid').reduce((s, m) => s + m.amount, 0)
                return (
                  <tr key={p.id} className="border-b border-slate-700/50 last:border-0">
                    <td className="px-4 py-2.5">
                      <Link to={`/projects/${p.id}`} className="font-medium text-slate-100 hover:text-blue-400">
                        {p.projectName}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5"><ProjectStatusBadge status={p.status} /></td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{p.platform}</td>
                    <td className="px-4 py-2.5 text-sm text-slate-400">{formatDate(p.dateAwarded)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-400">
                      {p.milestones.filter((m) => m.status === 'Paid').length}/{p.milestones.length}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-medium text-slate-200">
                      {formatCurrency(paid, p.currency)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </AppCard>
    </div>
  )
}

export default function Clients() {
  const { name } = useParams<{ name?: string }>()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    getProjects()
      .then(setProjects)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-8 text-sm text-slate-500">Loading...</div>
  if (error) return <ErrorState message={error} />

  if (name) {
    const decoded = decodeURIComponent(name)
    const clientProjects = projects.filter((p) => p.clientName === decoded)
    if (clientProjects.length === 0) {
      return <EmptyState title="Client not found" description={`No projects for "${decoded}".`} />
    }
    return <ClientDetail clientName={decoded} projects={clientProjects} />
  }

  return <ClientList projects={projects} />
}
