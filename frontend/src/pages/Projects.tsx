import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createProject, deleteProject, getProjects } from '../api'
import { ProjectStatusBadge } from '../components/StatusBadge'
import { AppCard, Button, EmptyState, ErrorState, Field, Input, PageIntro, Select, SectionHeading, Textarea } from '../components/ui'
import { calculateProjectRevenue, formatCurrency, isoDate } from '../lib/format'
import type { Project, ProjectInput } from '../types'
import { CURRENCIES, PLATFORMS, PROJECT_STATUSES } from '../types'

const emptyProject: ProjectInput = {
  clientName: '',
  projectName: '',
  platform: 'Direct',
  currency: 'USD',
  feePercentage: 0,
  status: 'Quoted',
  dateAwarded: null,
  dateCompleted: null,
  notes: null,
}

export default function Projects() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [draft, setDraft] = useState<ProjectInput>(emptyProject)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getProjects()
      setProjects(data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to load projects.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => b.id - a.id),
    [projects],
  )

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    try {
      const project = await createProject(draft)
      setProjects((current) => [project, ...current])
      setDraft(emptyProject)
      navigate(`/projects/${project.id}`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to create project.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this project and all related milestones and tips?')) return
    try {
      await deleteProject(id)
      setProjects((current) => current.filter((p) => p.id !== id))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to delete project.')
    }
  }

  return (
    <div className="space-y-6">
      <PageIntro
        title="Projects"
        description={`${projects.length} project${projects.length === 1 ? '' : 's'} in the ledger.`}
      />

      {error && <ErrorState message={error} onRetry={() => void load()} />}

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        {/* Projects table */}
        <AppCard>
          <SectionHeading title="All Projects" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-left">
                  <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Client</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Project</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Platform</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Cur</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Status</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">Revenue</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {!loading && sortedProjects.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8">
                      <EmptyState
                        title="No projects yet"
                        description="Create a project to start tracking milestones, tips, and fees."
                      />
                    </td>
                  </tr>
                ) : null}
                {sortedProjects.map((project) => (
                  <tr
                    key={project.id}
                    className="cursor-pointer border-b border-slate-700/50 last:border-0 transition-colors hover:bg-slate-700/30"
                    onClick={() => navigate(`/projects/${project.id}`)}
                  >
                    <td className="px-4 py-2.5 text-slate-300">{project.clientName}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-100">{project.projectName}</td>
                    <td className="px-4 py-2.5 text-slate-500">{project.platform}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-400">{project.currency}</td>
                    <td className="px-4 py-2.5">
                      <ProjectStatusBadge status={project.status} />
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-200">
                      {formatCurrency(calculateProjectRevenue(project), project.currency)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Button
                        variant="ghost"
                        className="px-2 text-xs"
                        onClick={(e) => {
                          e.stopPropagation()
                          void handleDelete(project.id)
                        }}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AppCard>

        {/* Add project form */}
        <AppCard>
          <SectionHeading title="Add Project" />
          <form className="grid gap-3 p-4" onSubmit={handleCreate}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Client Name" required>
                <Input
                  value={draft.clientName}
                  onChange={(e) => setDraft((c) => ({ ...c, clientName: e.target.value }))}
                  required
                />
              </Field>
              <Field label="Project Name" required>
                <Input
                  value={draft.projectName}
                  onChange={(e) => setDraft((c) => ({ ...c, projectName: e.target.value }))}
                  required
                />
              </Field>
            </div>
            <div className="grid gap-3 grid-cols-3">
              <Field label="Platform">
                <Select
                  value={draft.platform}
                  onChange={(e) => setDraft((c) => ({ ...c, platform: e.target.value as Project['platform'] }))}
                >
                  {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
                </Select>
              </Field>
              <Field label="Currency">
                <Select
                  value={draft.currency}
                  onChange={(e) => setDraft((c) => ({ ...c, currency: e.target.value as Project['currency'] }))}
                >
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </Field>
              <Field label="Fee %">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={draft.feePercentage}
                  onChange={(e) => setDraft((c) => ({ ...c, feePercentage: Number(e.target.value) }))}
                />
              </Field>
            </div>
            <div className="grid gap-3 grid-cols-3">
              <Field label="Status">
                <Select
                  value={draft.status}
                  onChange={(e) => setDraft((c) => ({ ...c, status: e.target.value as Project['status'] }))}
                >
                  {PROJECT_STATUSES.map((s) => (
                    <option key={s} value={s}>{s === 'InProgress' ? 'In Progress' : s}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Awarded">
                <Input
                  type="date"
                  value={isoDate(draft.dateAwarded)}
                  onChange={(e) => setDraft((c) => ({ ...c, dateAwarded: e.target.value || null }))}
                />
              </Field>
              <Field label="Completed">
                <Input
                  type="date"
                  value={isoDate(draft.dateCompleted)}
                  onChange={(e) => setDraft((c) => ({ ...c, dateCompleted: e.target.value || null }))}
                />
              </Field>
            </div>
            <Field label="Notes">
              <Textarea
                value={draft.notes ?? ''}
                onChange={(e) => setDraft((c) => ({ ...c, notes: e.target.value || null }))}
              />
            </Field>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving ? 'Creating…' : 'Add Project'}
              </Button>
            </div>
          </form>
        </AppCard>
      </div>
    </div>
  )
}
