import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createProject, deleteProject, getProjects } from '../api'
import { AppCard, Button, EmptyState, ErrorState, Field, Input, PageIntro, Select, SectionHeading, Textarea } from '../components/ui'
import { calculateProjectRevenue, formatCurrency, isoDate, projectStatusTone } from '../lib/format'
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
    () => [...projects].sort((left, right) => right.id - left.id),
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
    const confirmed = window.confirm('Delete this project and all related milestones and tips?')
    if (!confirmed) return

    try {
      await deleteProject(id)
      setProjects((current) => current.filter((project) => project.id !== id))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to delete project.')
    }
  }

  return (
    <div className="space-y-8">
      <PageIntro
        title="Projects"
        description="Track all client work, platform fees, milestone progress, and paid revenue from a single ledger."
      />

      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <AppCard>
          <SectionHeading
            title="Project Registry"
            description={`${projects.length} project${projects.length === 1 ? '' : 's'} in the ledger.`}
          />
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-700/70 text-left text-xs uppercase tracking-[0.2em] text-zinc-500">
                  <th className="px-5 py-3 font-medium">Client</th>
                  <th className="px-5 py-3 font-medium">Project</th>
                  <th className="px-5 py-3 font-medium">Platform</th>
                  <th className="px-5 py-3 font-medium">Currency</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Revenue</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {!loading && sortedProjects.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-10">
                      <EmptyState
                        title="No projects yet"
                        description="Create a project to start tracking milestones, tips, and final net revenue."
                      />
                    </td>
                  </tr>
                ) : null}
                {sortedProjects.map((project) => (
                  <tr
                    key={project.id}
                    className="cursor-pointer border-b border-zinc-700/50 transition hover:bg-zinc-900/60"
                    onClick={() => navigate(`/projects/${project.id}`)}
                  >
                    <td className="px-5 py-4 text-zinc-200">{project.clientName}</td>
                    <td className="px-5 py-4 font-medium text-white">{project.projectName}</td>
                    <td className="px-5 py-4 text-zinc-400">{project.platform}</td>
                    <td
                      className="px-5 py-4 text-zinc-300"
                      style={{ fontFamily: '"JetBrains Mono", monospace' }}
                    >
                      {project.currency}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${projectStatusTone(project.status)}`}>
                        {project.status === 'InProgress' ? 'In Progress' : project.status}
                      </span>
                    </td>
                    <td
                      className="px-5 py-4 text-right text-zinc-100"
                      style={{ fontFamily: '"JetBrains Mono", monospace' }}
                    >
                      {formatCurrency(calculateProjectRevenue(project), project.currency)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Button
                        variant="ghost"
                        className="px-3"
                        onClick={(event) => {
                          event.stopPropagation()
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

        <AppCard>
          <SectionHeading title="Add Project" description="Create a new project entry and start tracking revenue." />
          <form className="grid gap-4 p-5" onSubmit={handleCreate}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Client Name" required>
                <Input
                  value={draft.clientName}
                  onChange={(event) => setDraft((current) => ({ ...current, clientName: event.target.value }))}
                  required
                />
              </Field>
              <Field label="Project Name" required>
                <Input
                  value={draft.projectName}
                  onChange={(event) => setDraft((current) => ({ ...current, projectName: event.target.value }))}
                  required
                />
              </Field>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Platform">
                <Select
                  value={draft.platform}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, platform: event.target.value as Project['platform'] }))
                  }
                >
                  {PLATFORMS.map((platform) => (
                    <option key={platform} value={platform}>
                      {platform}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Currency">
                <Select
                  value={draft.currency}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, currency: event.target.value as Project['currency'] }))
                  }
                >
                  {CURRENCIES.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Fee Percentage">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={draft.feePercentage}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, feePercentage: Number(event.target.value) }))
                  }
                />
              </Field>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Status">
                <Select
                  value={draft.status}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, status: event.target.value as Project['status'] }))
                  }
                >
                  {PROJECT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status === 'InProgress' ? 'In Progress' : status}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Date Awarded">
                <Input
                  type="date"
                  value={isoDate(draft.dateAwarded)}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, dateAwarded: event.target.value || null }))
                  }
                />
              </Field>
              <Field label="Date Completed">
                <Input
                  type="date"
                  value={isoDate(draft.dateCompleted)}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, dateCompleted: event.target.value || null }))
                  }
                />
              </Field>
            </div>
            <Field label="Notes">
              <Textarea
                value={draft.notes ?? ''}
                onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value || null }))}
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
