import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createClient, createProject, deleteProject, getClients, getProjects } from '../api'
import { ProjectStatusBadge } from '../components/StatusBadge'
import { Modal } from '../components/Modal'
import { AppCard, Button, EmptyState, ErrorState, Field, Input, PageIntro, Select, SectionHeading, Textarea } from '../components/ui'
import { MoneyAmount } from '../components/MoneyAmount'
import { calculateProjectGrossPaid, calculateProjectGrossPipeline, calculatePipelineValue, calculateProjectRevenue, formatDate, isoDate } from '../lib/format'
import type { Client, ClientInput, Project, ProjectInput } from '../types'
import { CURRENCIES, PLATFORMS, PROJECT_STATUSES } from '../types'

const emptyProject: ProjectInput = {
  clientId: null,
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

const emptyNewClient: ClientInput = {
  name: '', email: null, phone: null, country: null, timezone: null,
  freelancerId: null, upworkId: null, notes: null, aliases: null,
}

export default function Projects() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [draft, setDraft] = useState<ProjectInput>(emptyProject)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAddProject, setShowAddProject] = useState(false)
  const [showNewClient, setShowNewClient] = useState(false)
  const [newClient, setNewClient] = useState<ClientInput>(emptyNewClient)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [projectData, clientData] = await Promise.all([getProjects(), getClients()])
      setProjects(projectData)
      setClients(clientData)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to load projects.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const created = await createClient(newClient)
      setClients(prev => [...prev, created])
      setDraft(d => ({ ...d, clientId: created.id, clientName: created.name }))
      setShowNewClient(false)
      setNewClient(emptyNewClient)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to create client.')
    }
  }

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

  const handleDelete = async (project: Project) => {
    if (!window.confirm(`Delete '${project.projectName}'? This removes ALL milestones and tips for this project. Cannot be undone.`)) return
    try {
      await deleteProject(project.id)
      setProjects((current) => current.filter((p) => p.id !== project.id))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to delete project.')
    }
  }

  return (
    <div className="space-y-6">
      <PageIntro
        title="Projects"
        description={`${projects.length} project${projects.length === 1 ? '' : 's'} in the ledger.`}
        action={<Button onClick={() => setShowAddProject(true)}>+ Add Project</Button>}
      />

      {error && <ErrorState message={error} onRetry={() => void load()} />}

      {showNewClient && (
        <Modal title="New Client" onClose={() => setShowNewClient(false)} size="md" nested>
          <form className="grid gap-3" onSubmit={handleCreateClient}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name" required>
                <Input required value={newClient.name} onChange={(e) => setNewClient(d => ({ ...d, name: e.target.value }))} />
              </Field>
              <Field label="Email">
                <Input type="email" value={newClient.email ?? ''} onChange={(e) => setNewClient(d => ({ ...d, email: e.target.value || null }))} />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Freelancer ID">
                <Input value={newClient.freelancerId ?? ''} onChange={(e) => setNewClient(d => ({ ...d, freelancerId: e.target.value || null }))} placeholder="e.g. nick111nick111" />
              </Field>
              <Field label="Upwork ID">
                <Input value={newClient.upworkId ?? ''} onChange={(e) => setNewClient(d => ({ ...d, upworkId: e.target.value || null }))} />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Country">
                <Input value={newClient.country ?? ''} onChange={(e) => setNewClient(d => ({ ...d, country: e.target.value || null }))} />
              </Field>
              <Field label="Aliases (comma-separated)">
                <Input value={newClient.aliases ?? ''} onChange={(e) => setNewClient(d => ({ ...d, aliases: e.target.value || null }))} />
              </Field>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setShowNewClient(false)}>Cancel</Button>
              <Button type="submit">Create Client</Button>
            </div>
          </form>
        </Modal>
      )}

      <AppCard>
        <SectionHeading title="All Projects" description="Amounts shown before platform fee." />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-left">
                <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Client</th>
                <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Project</th>
                <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Platform</th>
                <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Cur</th>
                <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Status</th>
                <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Awarded</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">Paid</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">Pipeline</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {!loading && sortedProjects.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8">
                    <EmptyState title="No projects yet" description="Click '+ Add Project' to get started." />
                  </td>
                </tr>
              ) : null}
              {sortedProjects.map((project) => (
                <tr key={project.id} className="cursor-pointer border-b border-slate-700/50 last:border-0 transition-colors hover:bg-slate-700/30" onClick={() => navigate(`/projects/${project.id}`)}>
                  <td className="px-4 py-2.5 text-slate-300">{project.client?.name ?? project.clientName}</td>
                  <td className="px-4 py-2.5 font-medium text-slate-100">{project.projectName}</td>
                  <td className="px-4 py-2.5 text-slate-500">{project.platform}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-400">{project.currency}</td>
                  <td className="px-4 py-2.5"><ProjectStatusBadge status={project.status} /></td>
                  <td className="px-4 py-2.5 text-xs text-slate-400">{formatDate(project.dateAwarded)}</td>
                  <td className="px-4 py-2.5 text-right"><MoneyAmount amount={calculateProjectGrossPaid(project)} currency={project.currency} /></td>
                  <td className="px-4 py-2.5 text-right"><MoneyAmount amount={calculateProjectGrossPipeline(project)} currency={project.currency} /></td>
                  <td className="px-4 py-2.5 text-right">
                    <button className="px-2 text-xs text-slate-500 hover:text-red-400" onClick={(e) => { e.stopPropagation(); void handleDelete(project) }}>×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AppCard>

      {showAddProject && (
        <Modal title="Add Project" onClose={() => setShowAddProject(false)} size="lg">
          <form className="grid gap-3" onSubmit={handleCreate}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Client" required>
                <div className="flex gap-1.5">
                  <Select value={draft.clientId ?? ''} onChange={(e) => { const id = Number(e.target.value); const cl = clients.find(c => c.id === id); setDraft(d => ({ ...d, clientId: id || null, clientName: cl?.name ?? '' })) }} required className="flex-1">
                    <option value="">Select client...</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </Select>
                  <Button type="button" variant="secondary" className="shrink-0 px-2.5" onClick={() => setShowNewClient(true)}>+</Button>
                </div>
              </Field>
              <Field label="Project Name" required>
                <Input value={draft.projectName} onChange={(e) => setDraft((c) => ({ ...c, projectName: e.target.value }))} required />
              </Field>
            </div>
            <div className="grid gap-3 grid-cols-3">
              <Field label="Platform">
                <Select value={draft.platform} onChange={(e) => {
                  const platform = e.target.value as Project['platform']
                  setDraft((c) => {
                    const next = { ...c, platform }
                    if (platform === 'Freelancer' || platform === 'Upwork') next.feePercentage = 10
                    return next
                  })
                }}>
                  {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
                </Select>
              </Field>
              <Field label="Currency">
                <Select value={draft.currency} onChange={(e) => setDraft((c) => ({ ...c, currency: e.target.value as Project['currency'] }))}>
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </Field>
              <Field label="Fee %">
                <Input type="number" min="0" max="100" step="0.1" value={draft.feePercentage} disabled={draft.platform === 'Freelancer' || draft.platform === 'Upwork'} onChange={(e) => setDraft((c) => ({ ...c, feePercentage: Number(e.target.value) }))} />
                {(draft.platform === 'Freelancer' || draft.platform === 'Upwork') && <p className="mt-1 text-xs text-slate-500">Locked at 10% for Freelancer/Upwork.</p>}
              </Field>
            </div>
            <div className="grid gap-3 grid-cols-3">
              <Field label="Status">
                <Select value={draft.status} onChange={(e) => setDraft((c) => ({ ...c, status: e.target.value as Project['status'] }))}>
                  {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{s === 'InProgress' ? 'In Progress' : s}</option>)}
                </Select>
              </Field>
              <Field label="Awarded">
                <Input type="date" value={isoDate(draft.dateAwarded)} onChange={(e) => setDraft((c) => ({ ...c, dateAwarded: e.target.value || null }))} />
              </Field>
              <Field label="Completed">
                <Input type="date" value={isoDate(draft.dateCompleted)} onChange={(e) => setDraft((c) => ({ ...c, dateCompleted: e.target.value || null }))} />
              </Field>
            </div>
            <Field label="Notes">
              <Textarea value={draft.notes ?? ''} onChange={(e) => setDraft((c) => ({ ...c, notes: e.target.value || null }))} />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setShowAddProject(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Creating...' : 'Add Project'}</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
