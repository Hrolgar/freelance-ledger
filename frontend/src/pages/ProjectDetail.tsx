import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getTimezoneOffset, useMyTimezone } from '../lib/useMyTimezone'

function ClientTimezone({ timezone }: { timezone: string }) {
  const [myTz] = useMyTimezone()
  const [time, setTime] = useState('')
  const [offset, setOffset] = useState('')
  useEffect(() => {
    const update = () => {
      try {
        const now = new Date()
        setTime(now.toLocaleTimeString('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', weekday: 'short' }))
        setOffset(getTimezoneOffset(timezone, myTz))
      } catch { setTime('') }
    }
    update()
    const id = setInterval(update, 30000)
    return () => clearInterval(id)
  }, [timezone, myTz])
  const city = timezone.split('/').pop()?.replace('_', ' ') ?? timezone
  return (
    <span className="group relative cursor-help rounded bg-slate-800 px-3 py-1.5 text-xs text-slate-400">
      {city} <span className="font-mono text-blue-300">{time}</span>
      {offset && (
        <span className="pointer-events-none absolute bottom-full right-0 z-10 mb-1.5 whitespace-nowrap rounded bg-slate-700 px-2 py-1 text-xs text-blue-300 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
          {offset}
        </span>
      )}
    </span>
  )
}
import {
  createMilestone,
  createTip,
  deleteMilestone,
  deleteTip,
  getClients,
  getProject,
  getProjectSummary,
  patchMilestone,
  updateMilestone,
  updateProject,
  updateTip,
} from '../api'
import { Modal } from '../components/Modal'
import { MoneyAmount } from '../components/MoneyAmount'
import { MilestoneStatusBadge } from '../components/StatusBadge'
import { AppCard, Button, EmptyState, ErrorState, Field, Input, PageIntro, Select, SectionHeading, StatCard, Textarea } from '../components/ui'
import { formatCurrency, formatDate, getNextMilestoneOrder, isMilestoneOverdue, isoDate } from '../lib/format'
import type { Client, Milestone, MilestoneInput, MilestonePatchRequest, Project, ProjectInput, ProjectSummary, Tip, TipInput } from '../types'
import { CURRENCIES, MILESTONE_STATUSES, PLATFORMS, PROJECT_STATUSES } from '../types'

const emptyProjectDraft: ProjectInput = {
  clientId: null,
  clientName: '',
  projectName: '',
  platform: 'Direct',
  currency: 'USD',
  feePercentage: 0,
  initialFullPrice: null,
  status: 'Quoted',
  dateAwarded: null,
  dateCompleted: null,
  notes: null,
}

const emptyMilestoneDraft: MilestoneInput = {
  name: '',
  description: null,
  amount: 0,
  currency: 'USD',
  status: 'Pending',
  dateDue: null,
  datePaid: null,
  sortOrder: 1,
}

const emptyTipDraft: TipInput = {
  amount: 0,
  currency: 'USD',
  date: new Date().toISOString().slice(0, 10),
  notes: null,
}

export default function ProjectDetail() {
  const navigate = useNavigate()
  const { id } = useParams()
  const projectId = Number(id)

  const [project, setProject] = useState<Project | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [summary, setSummary] = useState<ProjectSummary | null>(null)
  const [projectDraft, setProjectDraft] = useState<ProjectInput>(emptyProjectDraft)
  const [milestoneDraft, setMilestoneDraft] = useState<MilestoneInput>(emptyMilestoneDraft)
  const [tipDraft, setTipDraft] = useState<TipInput>(emptyTipDraft)
  const [editingMilestoneId, setEditingMilestoneId] = useState<number | null>(null)
  const [editingTipId, setEditingTipId] = useState<number | null>(null)
  const [showMilestoneModal, setShowMilestoneModal] = useState(false)
  const [showTipModal, setShowTipModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [savingProject, setSavingProject] = useState(false)
  const [savingMilestone, setSavingMilestone] = useState(false)
  const [savingTip, setSavingTip] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [projectData, summaryData, clientsData] = await Promise.all([
        getProject(projectId),
        getProjectSummary(projectId),
        getClients(),
      ])
      setClients(clientsData)

      const orderedMilestones = [...projectData.milestones].sort((a, b) => a.sortOrder - b.sortOrder)
      const orderedTips = [...projectData.tips].sort((a, b) => b.date.localeCompare(a.date))
      const hydrated = { ...projectData, milestones: orderedMilestones, tips: orderedTips }

      setProject(hydrated)
      setSummary(summaryData)
      setProjectDraft({
        clientId: hydrated.clientId,
        clientName: hydrated.clientName,
        projectName: hydrated.projectName,
        platform: hydrated.platform,
        currency: hydrated.currency,
        feePercentage: hydrated.feePercentage,
        initialFullPrice: hydrated.initialFullPrice,
        status: hydrated.status,
        dateAwarded: hydrated.dateAwarded,
        dateCompleted: hydrated.dateCompleted,
        notes: hydrated.notes,
      })
      setMilestoneDraft({
        ...emptyMilestoneDraft,
        currency: hydrated.currency,
        sortOrder: getNextMilestoneOrder(orderedMilestones),
      })
      setTipDraft({ ...emptyTipDraft, currency: hydrated.currency })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to load project.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!Number.isFinite(projectId)) {
      setError('Invalid project id.')
      setLoading(false)
      return
    }
    void load()
  }, [projectId])

  const handleProjectSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSavingProject(true)
    try {
      await updateProject(projectId, projectDraft)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to save project.')
    } finally {
      setSavingProject(false)
    }
  }

  const handleMilestoneSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSavingMilestone(true)
    try {
      if (editingMilestoneId) {
        await updateMilestone(projectId, editingMilestoneId, milestoneDraft)
      } else {
        await createMilestone(projectId, milestoneDraft)
      }
      setEditingMilestoneId(null)
      setShowMilestoneModal(false)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to save milestone.')
    } finally {
      setSavingMilestone(false)
    }
  }

  const handleTipSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSavingTip(true)
    try {
      if (editingTipId != null) {
        await updateTip(projectId, editingTipId, tipDraft)
      } else {
        await createTip(projectId, tipDraft)
      }
      setEditingTipId(null)
      setShowTipModal(false)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to save tip.')
    } finally {
      setSavingTip(false)
    }
  }

  const loadMilestoneIntoForm = (milestone: Milestone) => {
    setEditingMilestoneId(milestone.id)
    setMilestoneDraft({
      name: milestone.name,
      description: milestone.description,
      amount: milestone.amount,
      currency: milestone.currency,
      status: milestone.status,
      dateDue: milestone.dateDue,
      datePaid: milestone.datePaid,
      sortOrder: milestone.sortOrder,
    })
  }

  const loadTipIntoForm = (tip: Tip) => {
    setEditingTipId(tip.id)
    setTipDraft({ amount: tip.amount, currency: tip.currency, date: tip.date, notes: tip.notes })
  }

  const resetMilestoneForm = () => {
    setEditingMilestoneId(null)
    setMilestoneDraft({
      ...emptyMilestoneDraft,
      currency: project?.currency ?? 'USD',
      sortOrder: getNextMilestoneOrder(project?.milestones ?? []),
    })
  }

  const resetTipForm = () => {
    setEditingTipId(null)
    setTipDraft({ ...emptyTipDraft, currency: project?.currency ?? 'USD' })
  }

  const handleMilestoneDelete = async (milestoneId: number) => {
    if (!window.confirm('Delete this milestone?')) return
    try {
      await deleteMilestone(projectId, milestoneId)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to delete milestone.')
    }
  }

  const handleTipDelete = async (tipId: number) => {
    if (!window.confirm('Delete this tip?')) return
    try {
      await deleteTip(projectId, tipId)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to delete tip.')
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-16" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-16" />)}
        </div>
      </div>
    )
  }

  if (error && !project) {
    return <ErrorState message={error} onRetry={() => void load()} />
  }

  if (!project) {
    return <ErrorState message="Project not found." onRetry={() => navigate('/projects')} />
  }

  const feeIsLocked = projectDraft.platform === 'Freelancer' || projectDraft.platform === 'Upwork'
  const paidCount = project.milestones.filter(m => m.status === 'Paid').length

  const handleQuickMarkPaid = async (milestone: Milestone) => {
    const today = new Date().toISOString().slice(0, 10)
    const patch: MilestonePatchRequest = {
      status: 'Paid',
      datePaid: milestone.datePaid ?? today,
      dateDue: milestone.dateDue ?? today,
    }
    try {
      await patchMilestone(milestone.id, patch)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to mark paid.')
    }
  }

  const handleMarkProjectPaid = async () => {
    if (!project) return
    setSavingProject(true)
    try {
      await updateProject(projectId, {
        ...projectDraft,
        status: 'Paid',
        dateCompleted: projectDraft.dateCompleted ?? new Date().toISOString().slice(0, 10),
      })
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to update status.')
    } finally {
      setSavingProject(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to="/projects" className="hover:text-slate-300 transition-colors">Projects</Link>
        <span>/</span>
        <span className="text-slate-300">{project.projectName}</span>
      </div>

      <PageIntro
        title={project.projectName}
        description={`${project.client?.name ?? project.clientName} · ${project.platform} · ${project.currency} · ${project.feePercentage}% fee`}
        action={project.client?.timezone ? <ClientTimezone timezone={project.client.timezone} /> : undefined}
      />

      {error && <ErrorState message={error} onRetry={() => void load()} />}

      {/* Summary stats */}
      {summary && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <StatCard label="Paid" value={<MoneyAmount amount={summary.paidMilestoneTotal + summary.tipTotal} currency={summary.currency} />} hint="before fee" />
          <StatCard label="Outstanding" value={<MoneyAmount amount={summary.outstanding} currency={summary.currency} />} hint="before fee" />
          <StatCard label="Pipeline Total" value={<MoneyAmount amount={summary.pipelineTotal} currency={summary.currency} />} hint="before fee" />
          <StatCard label="Fees" value={<MoneyAmount amount={summary.fee} currency={summary.currency} />} hint="deducted" />
          <StatCard label="Net Revenue" value={<MoneyAmount amount={summary.net} currency={summary.currency} />} hint="after fee" />
        </div>
      )}

      {project.milestones.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Milestone progress</span>
            <span className="font-mono">{paidCount} / {project.milestones.length}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded bg-slate-800">
            <div
              className="h-full rounded bg-emerald-500 transition-all"
              style={{ width: `${(paidCount / project.milestones.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {(() => {
        const initial = summary?.initialFullPrice
        const pipelineTotal = summary?.pipelineTotal ?? 0
        if (initial == null || initial <= 0) return null
        const diff = pipelineTotal - initial
        const budgetState = Math.abs(diff) < 0.01
          ? { tone: 'matches' as const, amount: 0 }
          : diff < 0
            ? { tone: 'under' as const, amount: Math.abs(diff) }
            : { tone: 'over' as const, amount: diff }
        return (
          <div className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${
            budgetState.tone === 'matches' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' :
            budgetState.tone === 'under' ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' :
            'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
          }`}>
            <div className="flex items-center gap-2">
              <span className="font-medium">Initial budget:</span>
              <span className="font-mono">{formatCurrency(initial, summary!.currency)}</span>
              <span className="text-slate-400">·</span>
              <span>Allocated:</span>
              <span className="font-mono">{formatCurrency(pipelineTotal, summary!.currency)}</span>
            </div>
            {budgetState.tone !== 'matches' && (
              <div className="font-mono font-semibold">
                {budgetState.tone === 'over' ? '+' : ''}{formatCurrency(budgetState.amount, summary!.currency)} {budgetState.tone === 'under' ? 'left to allocate' : 'upsell — beyond initial'}
              </div>
            )}
            {budgetState.tone === 'matches' && (
              <div className="text-xs uppercase tracking-wide">Fully allocated</div>
            )}
          </div>
        )
      })()}

      {/* Project details + summary */}
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <AppCard>
          <SectionHeading title="Project Details" />
          <form className="grid gap-3 p-4" onSubmit={handleProjectSave}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Client" required>
                <Select
                  value={projectDraft.clientId ?? ''}
                  onChange={(e) => {
                    const id = Number(e.target.value)
                    const client = clients.find(c => c.id === id)
                    setProjectDraft(d => ({ ...d, clientId: id || null, clientName: client?.name ?? '' }))
                  }}
                  required
                >
                  <option value="">Select client...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
              <Field label="Project Name" required>
                <Input
                  required
                  value={projectDraft.projectName}
                  onChange={(e) => setProjectDraft((c) => ({ ...c, projectName: e.target.value }))}
                />
              </Field>
            </div>
            <div className="grid gap-3 grid-cols-3">
              <Field label="Platform">
                <Select
                  value={projectDraft.platform}
                  onChange={(e) => {
                    const platform = e.target.value as Project['platform']
                    setProjectDraft((c) => {
                      const next = { ...c, platform }
                      if (platform === 'Freelancer' || platform === 'Upwork') next.feePercentage = 10
                      return next
                    })
                  }}
                >
                  {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
                </Select>
              </Field>
              <Field label="Currency">
                <Select
                  value={projectDraft.currency}
                  onChange={(e) => setProjectDraft((c) => ({ ...c, currency: e.target.value as Project['currency'] }))}
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
                  value={projectDraft.feePercentage}
                  disabled={feeIsLocked}
                  onChange={(e) => setProjectDraft((c) => ({ ...c, feePercentage: Number(e.target.value) }))}
                />
                {feeIsLocked && <p className="mt-1 text-xs text-slate-500">Locked at 10% for Freelancer/Upwork.</p>}
              </Field>
            </div>
            <div className="grid gap-3 grid-cols-3">
              <Field label="Initial Full Price (optional)">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={projectDraft.initialFullPrice ?? ''}
                  onChange={(e) => setProjectDraft((c) => ({ ...c, initialFullPrice: e.target.value === '' ? null : Number(e.target.value) }))}
                />
              </Field>
            </div>
            <div className="grid gap-3 grid-cols-3">
              <Field label="Status">
                <Select
                  value={projectDraft.status}
                  onChange={(e) => setProjectDraft((c) => ({ ...c, status: e.target.value as Project['status'] }))}
                >
                  {PROJECT_STATUSES.map((s) => (
                    <option key={s} value={s}>{s === 'InProgress' ? 'In Progress' : s}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Awarded">
                <Input
                  type="date"
                  value={isoDate(projectDraft.dateAwarded)}
                  onChange={(e) => setProjectDraft((c) => ({ ...c, dateAwarded: e.target.value || null }))}
                />
              </Field>
              <Field label="Completed">
                <Input
                  type="date"
                  value={isoDate(projectDraft.dateCompleted)}
                  onChange={(e) => setProjectDraft((c) => ({ ...c, dateCompleted: e.target.value || null }))}
                />
              </Field>
            </div>
            <Field label="Notes">
              <Textarea
                value={projectDraft.notes ?? ''}
                onChange={(e) => setProjectDraft((c) => ({ ...c, notes: e.target.value || null }))}
              />
            </Field>
            <div className="flex justify-end">
              <Button type="submit" disabled={savingProject}>
                {savingProject ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </AppCard>

        {/* Revenue summary */}
        <AppCard>
          <SectionHeading title="Revenue Summary" />
          <dl className="divide-y divide-slate-700/50 px-4 text-sm">
            <div className="flex items-center justify-between py-2.5">
              <dt className="text-slate-400">Awarded</dt>
              <dd className="text-slate-200">{formatDate(project.dateAwarded)}</dd>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <dt className="text-slate-400">Completed</dt>
              <dd className="text-slate-200">{formatDate(project.dateCompleted)}</dd>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <dt className="text-slate-400">Milestones</dt>
              <dd className="text-slate-200">
                {paidCount} / {project.milestones.length} paid
              </dd>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <dt className="text-slate-400">Tips</dt>
              <dd className="text-slate-200">{project.tips.length}</dd>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <dt className="text-slate-400">Net Revenue</dt>
              <dd className="font-mono font-semibold text-slate-100">
                {summary ? <MoneyAmount amount={summary.net} currency={summary.currency} /> : '—'}
              </dd>
            </div>
          </dl>
        </AppCard>
      </div>

      {project.milestones.length > 0 &&
        project.milestones.every(m => m.status === 'Paid') &&
        project.status !== 'Paid' && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
            <p className="text-sm text-emerald-300">
              All milestones paid. Mark project as Paid?
            </p>
            <Button
              variant="secondary"
              className="text-xs"
              onClick={() => void handleMarkProjectPaid()}
            >
              Mark Paid
            </Button>
          </div>
        )}

      {/* Milestones */}
      <AppCard>
        <SectionHeading
          title="Milestones"
          action={
            <Button variant="secondary" className="text-xs" onClick={() => { resetMilestoneForm(); setShowMilestoneModal(true) }}>
              + Add
            </Button>
          }
        />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-left">
                  <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Name</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Amount</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Status</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Due</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Paid</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {project.milestones.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8">
                      <EmptyState
                        title="No milestones yet"
                        description="Add payment stages to track pipeline and settled revenue."
                      />
                    </td>
                  </tr>
                ) : (
                  project.milestones.map((milestone) => (
                    <tr
                      key={milestone.id}
                      className={`border-b border-slate-700/50 last:border-0 ${
                        isMilestoneOverdue(milestone) ? 'bg-amber-500/5 border-l-2 border-l-amber-500/60' : ''
                      }`}
                    >
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-slate-100">{milestone.name}</p>
                        {milestone.description && (
                          <p className="mt-0.5 text-xs text-slate-500">{milestone.description}</p>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-slate-200">
                        <MoneyAmount amount={milestone.amount} currency={milestone.currency} />
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <MilestoneStatusBadge status={milestone.status} />
                          {isMilestoneOverdue(milestone) && (
                            <span className="inline-flex items-center rounded border border-amber-500/40 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                              Overdue
                            </span>
                          )}
                        </div>
                      </td>
                      <td className={`px-4 py-2.5 text-xs ${
                        isMilestoneOverdue(milestone) ? 'text-amber-400 font-medium' : 'text-slate-400'
                      }`}>{formatDate(milestone.dateDue)}</td>
                      <td className="px-4 py-2.5 text-slate-400 text-xs">{formatDate(milestone.datePaid)}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex justify-end gap-1">
                          {milestone.status !== 'Paid' && (
                            <Button
                              variant="ghost"
                              className="px-2 text-xs text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
                              onClick={() => void handleQuickMarkPaid(milestone)}
                            >
                              Mark Paid
                            </Button>
                          )}
                          <Button variant="ghost" className="px-2 text-xs" onClick={() => { loadMilestoneIntoForm(milestone); setShowMilestoneModal(true) }}>
                            Edit
                          </Button>
                          <Button variant="danger" className="px-2 text-xs" onClick={() => void handleMilestoneDelete(milestone.id)}>
                            Del
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
      </AppCard>

      {showMilestoneModal && (
        <Modal title={editingMilestoneId ? 'Edit Milestone' : 'Add Milestone'} onClose={() => { setShowMilestoneModal(false); resetMilestoneForm() }}>
          <form className="grid gap-3" onSubmit={handleMilestoneSave}>
            <Field label="Name" required>
              <Input required value={milestoneDraft.name} onChange={(e) => setMilestoneDraft((c) => ({ ...c, name: e.target.value }))} />
            </Field>
            <Field label="Description">
              <Textarea value={milestoneDraft.description ?? ''} onChange={(e) => setMilestoneDraft((c) => ({ ...c, description: e.target.value || null }))} />
            </Field>
            <div className="grid gap-3 grid-cols-2">
              <Field label="Amount">
                <Input type="number" min="0" step="0.01" value={milestoneDraft.amount} onChange={(e) => setMilestoneDraft((c) => ({ ...c, amount: Number(e.target.value) }))} />
              </Field>
              <Field label="Currency">
                <Select value={milestoneDraft.currency} onChange={(e) => setMilestoneDraft((c) => ({ ...c, currency: e.target.value as Milestone['currency'] }))}>
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </Field>
            </div>
            <div className="grid gap-3 grid-cols-3">
              <Field label="Status">
                <Select value={milestoneDraft.status} onChange={(e) => {
                  const status = e.target.value as Milestone['status']
                  setMilestoneDraft((c) => {
                    const next = { ...c, status }
                    if (status === 'Paid') {
                      const today = new Date().toISOString().slice(0, 10)
                      if (!next.datePaid) next.datePaid = today
                      if (!next.dateDue) next.dateDue = today
                    }
                    return next
                  })
                }}>
                  {MILESTONE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
              </Field>
              <Field label="Due">
                <Input type="date" value={isoDate(milestoneDraft.dateDue)} onChange={(e) => setMilestoneDraft((c) => ({ ...c, dateDue: e.target.value || null }))} />
              </Field>
              <Field label="Paid">
                <Input type="date" value={isoDate(milestoneDraft.datePaid)} onChange={(e) => setMilestoneDraft((c) => ({ ...c, datePaid: e.target.value || null }))} />
              </Field>
            </div>
            <Field label="Sort Order">
              <Input type="number" min="1" value={milestoneDraft.sortOrder} onChange={(e) => setMilestoneDraft((c) => ({ ...c, sortOrder: Number(e.target.value) }))} />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => { setShowMilestoneModal(false); resetMilestoneForm() }}>Cancel</Button>
              <Button type="submit" disabled={savingMilestone}>{savingMilestone ? 'Saving...' : editingMilestoneId ? 'Update' : 'Add'}</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Tips */}
      <AppCard>
        <SectionHeading
          title="Tips"
          action={
            <Button variant="secondary" className="text-xs" onClick={() => { resetTipForm(); setShowTipModal(true) }}>
              + Add
            </Button>
          }
        />
          {project.tips.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="No tips recorded"
                description="Tips are added to the final project revenue."
              />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-left">
                  <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Amount</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Date</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Notes</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {project.tips.map((tip) => (
                  <tr key={tip.id} className="border-b border-slate-700/50 last:border-0">
                    <td className="px-4 py-2.5 font-medium text-slate-100">
                      <MoneyAmount amount={tip.amount} currency={tip.currency} />
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-400">{formatDate(tip.date)}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{tip.notes ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" className="px-2 text-xs" onClick={() => { loadTipIntoForm(tip); setShowTipModal(true) }}>
                          Edit
                        </Button>
                        <Button variant="danger" className="px-2 text-xs" onClick={() => void handleTipDelete(tip.id)}>
                          Del
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </AppCard>

      {showTipModal && (
        <Modal title={editingTipId ? 'Edit Tip' : 'Add Tip'} onClose={() => { setShowTipModal(false); resetTipForm() }} size="sm">
          <form className="grid gap-3" onSubmit={handleTipSave}>
            <div className="grid gap-3 grid-cols-2">
              <Field label="Amount">
                <Input type="number" min="0" step="0.01" value={tipDraft.amount} onChange={(e) => setTipDraft((c) => ({ ...c, amount: Number(e.target.value) }))} />
              </Field>
              <Field label="Currency">
                <Select value={tipDraft.currency} onChange={(e) => setTipDraft((c) => ({ ...c, currency: e.target.value as Tip['currency'] }))}>
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="Date">
              <Input type="date" value={tipDraft.date} onChange={(e) => setTipDraft((c) => ({ ...c, date: e.target.value }))} />
            </Field>
            <Field label="Notes">
              <Textarea value={tipDraft.notes ?? ''} onChange={(e) => setTipDraft((c) => ({ ...c, notes: e.target.value || null }))} />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => { setShowTipModal(false); resetTipForm() }}>Cancel</Button>
              <Button type="submit" disabled={savingTip}>{savingTip ? 'Saving...' : editingTipId ? 'Update' : 'Add'}</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
