import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  createMilestone,
  createTip,
  deleteMilestone,
  deleteTip,
  getProject,
  getProjectSummary,
  updateMilestone,
  updateProject,
  updateTip,
} from '../api'
import { AppCard, Button, EmptyState, ErrorState, Field, Input, PageIntro, Select, SectionHeading, StatCard, Textarea } from '../components/ui'
import { formatCurrency, formatDate, getNextMilestoneOrder, isoDate, milestoneStatusTone, projectStatusTone } from '../lib/format'
import type { Milestone, MilestoneInput, Project, ProjectInput, ProjectSummary, Tip, TipInput } from '../types'
import { CURRENCIES, MILESTONE_STATUSES, PLATFORMS, PROJECT_STATUSES } from '../types'

const emptyProjectDraft: ProjectInput = {
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
  const [summary, setSummary] = useState<ProjectSummary | null>(null)
  const [projectDraft, setProjectDraft] = useState<ProjectInput>(emptyProjectDraft)
  const [milestoneDraft, setMilestoneDraft] = useState<MilestoneInput>(emptyMilestoneDraft)
  const [tipDraft, setTipDraft] = useState<TipInput>(emptyTipDraft)
  const [editingMilestoneId, setEditingMilestoneId] = useState<number | null>(null)
  const [editingTipId, setEditingTipId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingProject, setSavingProject] = useState(false)
  const [savingMilestone, setSavingMilestone] = useState(false)
  const [savingTip, setSavingTip] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)

    try {
      const [projectData, summaryData] = await Promise.all([
        getProject(projectId),
        getProjectSummary(projectId),
      ])

      const orderedMilestones = [...projectData.milestones].sort(
        (left, right) => left.sortOrder - right.sortOrder,
      )
      const orderedTips = [...projectData.tips].sort((left, right) =>
        right.date.localeCompare(left.date),
      )
      const hydrated = { ...projectData, milestones: orderedMilestones, tips: orderedTips }

      setProject(hydrated)
      setSummary(summaryData)
      setProjectDraft({
        clientName: hydrated.clientName,
        projectName: hydrated.projectName,
        platform: hydrated.platform,
        currency: hydrated.currency,
        feePercentage: hydrated.feePercentage,
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
      setTipDraft({
        ...emptyTipDraft,
        currency: hydrated.currency,
      })
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
      if (editingTipId) {
        await updateTip(projectId, editingTipId, tipDraft)
      } else {
        await createTip(projectId, tipDraft)
      }

      setEditingTipId(null)
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
    setTipDraft({
      amount: tip.amount,
      currency: tip.currency,
      date: tip.date,
      notes: tip.notes,
    })
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
    setTipDraft({
      ...emptyTipDraft,
      currency: project?.currency ?? 'USD',
    })
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
    return <div className="space-y-8"><div className="h-48 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-800/70" /></div>
  }

  if (error && !project) {
    return <ErrorState message={error} onRetry={() => void load()} />
  }

  if (!project) {
    return <ErrorState message="Project not found." onRetry={() => navigate('/projects')} />
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <Link to="/projects" className="hover:text-zinc-300">
          Projects
        </Link>
        <span>/</span>
        <span className="text-zinc-300">{project.projectName}</span>
      </div>

      <PageIntro
        title={project.projectName}
        description={`${project.clientName} · ${project.platform} · ${project.currency}`}
      />

      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

      {summary ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Paid Milestones" value={formatCurrency(summary.paidMilestoneTotal, summary.currency)} />
          <StatCard label="Tips" value={formatCurrency(summary.tipTotal, summary.currency)} />
          <StatCard label="Fees" value={formatCurrency(summary.fee, summary.currency)} />
          <StatCard label="Net Revenue" value={formatCurrency(summary.net, summary.currency)} />
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <AppCard>
          <SectionHeading title="Project Details" description="Editable client and bookkeeping metadata." />
          <form className="grid gap-4 p-5" onSubmit={handleProjectSave}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Client Name" required>
                <Input
                  required
                  value={projectDraft.clientName}
                  onChange={(event) =>
                    setProjectDraft((current) => ({ ...current, clientName: event.target.value }))
                  }
                />
              </Field>
              <Field label="Project Name" required>
                <Input
                  required
                  value={projectDraft.projectName}
                  onChange={(event) =>
                    setProjectDraft((current) => ({ ...current, projectName: event.target.value }))
                  }
                />
              </Field>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Platform">
                <Select
                  value={projectDraft.platform}
                  onChange={(event) =>
                    setProjectDraft((current) => ({ ...current, platform: event.target.value as Project['platform'] }))
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
                  value={projectDraft.currency}
                  onChange={(event) =>
                    setProjectDraft((current) => ({ ...current, currency: event.target.value as Project['currency'] }))
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
                  value={projectDraft.feePercentage}
                  onChange={(event) =>
                    setProjectDraft((current) => ({ ...current, feePercentage: Number(event.target.value) }))
                  }
                />
              </Field>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Status">
                <Select
                  value={projectDraft.status}
                  onChange={(event) =>
                    setProjectDraft((current) => ({ ...current, status: event.target.value as Project['status'] }))
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
                  value={isoDate(projectDraft.dateAwarded)}
                  onChange={(event) =>
                    setProjectDraft((current) => ({ ...current, dateAwarded: event.target.value || null }))
                  }
                />
              </Field>
              <Field label="Date Completed">
                <Input
                  type="date"
                  value={isoDate(projectDraft.dateCompleted)}
                  onChange={(event) =>
                    setProjectDraft((current) => ({ ...current, dateCompleted: event.target.value || null }))
                  }
                />
              </Field>
            </div>
            <Field label="Notes">
              <Textarea
                value={projectDraft.notes ?? ''}
                onChange={(event) =>
                  setProjectDraft((current) => ({ ...current, notes: event.target.value || null }))
                }
              />
            </Field>
            <div className="flex items-center justify-between gap-4">
              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${projectStatusTone(projectDraft.status)}`}>
                {projectDraft.status === 'InProgress' ? 'In Progress' : projectDraft.status}
              </span>
              <Button type="submit" disabled={savingProject}>
                {savingProject ? 'Saving…' : 'Save Project'}
              </Button>
            </div>
          </form>
        </AppCard>

        <AppCard className="p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">Revenue Summary</p>
          <dl className="mt-5 space-y-4 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-zinc-400">Awarded</dt>
              <dd className="text-zinc-100">{formatDate(project.dateAwarded)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-zinc-400">Completed</dt>
              <dd className="text-zinc-100">{formatDate(project.dateCompleted)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-zinc-400">Milestones</dt>
              <dd className="text-zinc-100">{project.milestones.length}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-zinc-400">Tips</dt>
              <dd className="text-zinc-100">{project.tips.length}</dd>
            </div>
            <div className="h-px bg-zinc-700/70" />
            <div className="flex items-center justify-between">
              <dt className="text-zinc-400">Current Net</dt>
              <dd
                className="text-lg font-semibold text-white"
                style={{ fontFamily: '"JetBrains Mono", monospace' }}
              >
                {summary ? formatCurrency(summary.net, summary.currency) : formatCurrency(0, project.currency)}
              </dd>
            </div>
          </dl>
        </AppCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <AppCard>
          <SectionHeading
            title="Milestones"
            description="Maintain payment stages, due dates, and released revenue."
            action={
              editingMilestoneId ? (
                <Button variant="secondary" onClick={resetMilestoneForm}>
                  Cancel edit
                </Button>
              ) : null
            }
          />
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-700/70 text-left text-xs uppercase tracking-[0.2em] text-zinc-500">
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Amount</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Due</th>
                  <th className="px-5 py-3 font-medium">Paid</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {project.milestones.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8">
                      <EmptyState
                        title="No milestones yet"
                        description="Add the payment stages for this project to track pipeline and settled revenue."
                      />
                    </td>
                  </tr>
                ) : (
                  project.milestones.map((milestone) => (
                    <tr key={milestone.id} className="border-b border-zinc-700/50 last:border-0">
                      <td className="px-5 py-4">
                        <p className="font-medium text-white">{milestone.name}</p>
                        {milestone.description ? (
                          <p className="mt-1 text-xs text-zinc-400">{milestone.description}</p>
                        ) : null}
                      </td>
                      <td
                        className="px-5 py-4 text-zinc-100"
                        style={{ fontFamily: '"JetBrains Mono", monospace' }}
                      >
                        {formatCurrency(milestone.amount, milestone.currency)}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${milestoneStatusTone(milestone.status)}`}>
                          {milestone.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-zinc-300">{formatDate(milestone.dateDue)}</td>
                      <td className="px-5 py-4 text-zinc-300">{formatDate(milestone.datePaid)}</td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" onClick={() => loadMilestoneIntoForm(milestone)}>
                            Edit
                          </Button>
                          <Button variant="danger" onClick={() => void handleMilestoneDelete(milestone.id)}>
                            Delete
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

        <AppCard>
          <SectionHeading
            title={editingMilestoneId ? 'Edit Milestone' : 'Add Milestone'}
            description="Each milestone becomes part of the project revenue lifecycle."
          />
          <form className="grid gap-4 p-5" onSubmit={handleMilestoneSave}>
            <Field label="Milestone Name" required>
              <Input
                required
                value={milestoneDraft.name}
                onChange={(event) =>
                  setMilestoneDraft((current) => ({ ...current, name: event.target.value }))
                }
              />
            </Field>
            <Field label="Description">
              <Textarea
                value={milestoneDraft.description ?? ''}
                onChange={(event) =>
                  setMilestoneDraft((current) => ({ ...current, description: event.target.value || null }))
                }
              />
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Amount">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={milestoneDraft.amount}
                  onChange={(event) =>
                    setMilestoneDraft((current) => ({ ...current, amount: Number(event.target.value) }))
                  }
                />
              </Field>
              <Field label="Currency">
                <Select
                  value={milestoneDraft.currency}
                  onChange={(event) =>
                    setMilestoneDraft((current) => ({ ...current, currency: event.target.value as Milestone['currency'] }))
                  }
                >
                  {CURRENCIES.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Status">
                <Select
                  value={milestoneDraft.status}
                  onChange={(event) =>
                    setMilestoneDraft((current) => ({ ...current, status: event.target.value as Milestone['status'] }))
                  }
                >
                  {MILESTONE_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Date Due">
                <Input
                  type="date"
                  value={isoDate(milestoneDraft.dateDue)}
                  onChange={(event) =>
                    setMilestoneDraft((current) => ({ ...current, dateDue: event.target.value || null }))
                  }
                />
              </Field>
              <Field label="Date Paid">
                <Input
                  type="date"
                  value={isoDate(milestoneDraft.datePaid)}
                  onChange={(event) =>
                    setMilestoneDraft((current) => ({ ...current, datePaid: event.target.value || null }))
                  }
                />
              </Field>
            </div>
            <Field label="Sort Order">
              <Input
                type="number"
                min="1"
                step="1"
                value={milestoneDraft.sortOrder}
                onChange={(event) =>
                  setMilestoneDraft((current) => ({ ...current, sortOrder: Number(event.target.value) }))
                }
              />
            </Field>
            <div className="flex justify-end gap-3">
              {editingMilestoneId ? (
                <Button type="button" variant="secondary" onClick={resetMilestoneForm}>
                  Cancel
                </Button>
              ) : null}
              <Button type="submit" disabled={savingMilestone}>
                {savingMilestone
                  ? 'Saving…'
                  : editingMilestoneId
                    ? 'Update Milestone'
                    : 'Add Milestone'}
              </Button>
            </div>
          </form>
        </AppCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <AppCard>
          <SectionHeading title="Tips" description="Track client gratuities and small bonuses separately." />
          <div className="divide-y divide-zinc-700/70">
            {project.tips.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  title="No tips recorded"
                  description="Tips recorded here are added to the final project revenue."
                />
              </div>
            ) : (
              project.tips.map((tip) => (
                <div key={tip.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p
                      className="text-base font-medium text-white"
                      style={{ fontFamily: '"JetBrains Mono", monospace' }}
                    >
                      {formatCurrency(tip.amount, tip.currency)}
                    </p>
                    <p className="mt-1 text-sm text-zinc-400">{formatDate(tip.date)}</p>
                    {tip.notes ? <p className="mt-2 text-sm text-zinc-500">{tip.notes}</p> : null}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => loadTipIntoForm(tip)}>
                      Edit
                    </Button>
                    <Button variant="danger" onClick={() => void handleTipDelete(tip.id)}>
                      Delete
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </AppCard>

        <AppCard>
          <SectionHeading
            title={editingTipId ? 'Edit Tip' : 'Add Tip'}
            description="Useful for bonuses, appreciation, and unstructured project income."
          />
          <form className="grid gap-4 p-5" onSubmit={handleTipSave}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Amount">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={tipDraft.amount}
                  onChange={(event) =>
                    setTipDraft((current) => ({ ...current, amount: Number(event.target.value) }))
                  }
                />
              </Field>
              <Field label="Currency">
                <Select
                  value={tipDraft.currency}
                  onChange={(event) =>
                    setTipDraft((current) => ({ ...current, currency: event.target.value as Tip['currency'] }))
                  }
                >
                  {CURRENCIES.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Date">
              <Input
                type="date"
                value={tipDraft.date}
                onChange={(event) => setTipDraft((current) => ({ ...current, date: event.target.value }))}
              />
            </Field>
            <Field label="Notes">
              <Textarea
                value={tipDraft.notes ?? ''}
                onChange={(event) =>
                  setTipDraft((current) => ({ ...current, notes: event.target.value || null }))
                }
              />
            </Field>
            <div className="flex justify-end gap-3">
              {editingTipId ? (
                <Button type="button" variant="secondary" onClick={resetTipForm}>
                  Cancel
                </Button>
              ) : null}
              <Button type="submit" disabled={savingTip}>
                {savingTip ? 'Saving…' : editingTipId ? 'Update Tip' : 'Add Tip'}
              </Button>
            </div>
          </form>
        </AppCard>
      </div>
    </div>
  )
}
