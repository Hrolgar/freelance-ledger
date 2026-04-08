import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import {
  currencies,
  milestoneStatuses,
  platforms,
  projectStatuses,
  type MilestonePayload,
  type Project,
  type ProjectPayload,
  type ProjectSummary,
  type Tip,
  type TipPayload,
} from '../types'
import {
  asInputDate,
  asOptionalDate,
  asOptionalText,
  formatDate,
  formatMoney,
  statusClasses,
} from '../utils'

const defaultMilestoneForm: MilestonePayload = {
  name: '',
  description: null,
  amount: 0,
  currency: 'NOK',
  status: 'Pending',
  dateDue: null,
  datePaid: null,
  sortOrder: 0,
}

const defaultTipForm: TipPayload = {
  amount: 0,
  currency: 'NOK',
  date: new Date().toISOString().slice(0, 10),
  notes: null,
}

export function ProjectDetailPage() {
  const { id } = useParams()
  const projectId = Number(id)
  const [project, setProject] = useState<Project | null>(null)
  const [summary, setSummary] = useState<ProjectSummary | null>(null)
  const [projectForm, setProjectForm] = useState<ProjectPayload | null>(null)
  const [milestoneForm, setMilestoneForm] = useState<MilestonePayload>(defaultMilestoneForm)
  const [tipForm, setTipForm] = useState<TipPayload>(defaultTipForm)
  const [editingMilestoneId, setEditingMilestoneId] = useState<number | null>(null)
  const [editingTipId, setEditingTipId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingProject, setSavingProject] = useState(false)
  const [savingMilestone, setSavingMilestone] = useState(false)
  const [savingTip, setSavingTip] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadProject() {
    setLoading(true)
    setError(null)
    try {
      const [projectResponse, summaryResponse] = await Promise.all([
        api.getProject(projectId),
        api.getProjectSummary(projectId),
      ])
      setProject(projectResponse)
      setSummary(summaryResponse)
      setProjectForm({
        clientName: projectResponse.clientName,
        projectName: projectResponse.projectName,
        platform: projectResponse.platform,
        currency: projectResponse.currency,
        feePercentage: projectResponse.feePercentage,
        status: projectResponse.status,
        dateAwarded: projectResponse.dateAwarded ?? null,
        dateCompleted: projectResponse.dateCompleted ?? null,
        notes: projectResponse.notes ?? null,
      })
      setMilestoneForm({
        ...defaultMilestoneForm,
        currency: projectResponse.currency,
        sortOrder: projectResponse.milestones.length + 1,
      })
      setTipForm({
        ...defaultTipForm,
        currency: projectResponse.currency,
      })
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load project')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (Number.isNaN(projectId)) {
      setError('Invalid project id.')
      setLoading(false)
      return
    }

    void loadProject()
  }, [projectId])

  async function handleSaveProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!projectForm) return

    setSavingProject(true)
    setError(null)
    try {
      await api.updateProject(projectId, projectForm)
      await loadProject()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to update project')
    } finally {
      setSavingProject(false)
    }
  }

  async function handleSaveMilestone(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSavingMilestone(true)
    setError(null)

    try {
      if (editingMilestoneId) {
        await api.updateMilestone(projectId, editingMilestoneId, milestoneForm)
      } else {
        await api.createMilestone(projectId, milestoneForm)
      }
      setEditingMilestoneId(null)
      setMilestoneForm({
        ...defaultMilestoneForm,
        currency: project?.currency ?? 'NOK',
        sortOrder: (project?.milestones.length ?? 0) + 1,
      })
      await loadProject()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save milestone')
    } finally {
      setSavingMilestone(false)
    }
  }

  async function handleSaveTip(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSavingTip(true)
    setError(null)

    try {
      if (editingTipId) {
        await api.updateTip(projectId, editingTipId, tipForm)
      } else {
        await api.createTip(projectId, tipForm)
      }
      setEditingTipId(null)
      setTipForm({
        ...defaultTipForm,
        currency: project?.currency ?? 'NOK',
      })
      await loadProject()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save tip')
    } finally {
      setSavingTip(false)
    }
  }

  async function handleDeleteMilestone(milestoneId: number) {
    if (!window.confirm('Delete this milestone?')) return
    try {
      await api.deleteMilestone(projectId, milestoneId)
      await loadProject()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete milestone')
    }
  }

  async function handleDeleteTip(tipId: number) {
    if (!window.confirm('Delete this tip?')) return
    try {
      await api.deleteTip(projectId, tipId)
      await loadProject()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete tip')
    }
  }

  if (loading) {
    return <StateBox title="Loading project" description="Fetching project, milestone, and summary data." />
  }

  if (error && !project) {
    return <StateBox title="Project unavailable" description={error} error />
  }

  if (!project || !projectForm || !summary) {
    return <StateBox title="Project unavailable" description="No project data returned." error />
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link to="/projects" className="text-sm text-indigo-300 transition hover:text-indigo-200">
            ← Back to projects
          </Link>
          <h2 className="mt-3 text-3xl font-semibold text-zinc-50">
            {project.clientName} / {project.projectName}
          </h2>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Net revenue</p>
          <p className="mt-2 font-mono text-2xl text-indigo-200">
            {formatMoney(summary.net, summary.currency)}
          </p>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <form
          onSubmit={handleSaveProject}
          className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Project</p>
              <h3 className="mt-2 text-xl font-semibold text-zinc-50">Editable details</h3>
            </div>
            <button
              type="submit"
              disabled={savingProject}
              className="inline-flex min-h-11 items-center rounded-xl border border-indigo-500 bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              {savingProject ? 'Saving...' : 'Save Project'}
            </button>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Field label="Client name">
              <input
                required
                className={inputClass}
                value={projectForm.clientName}
                onChange={(event) =>
                  setProjectForm((current) =>
                    current ? { ...current, clientName: event.target.value } : current,
                  )
                }
              />
            </Field>
            <Field label="Project name">
              <input
                required
                className={inputClass}
                value={projectForm.projectName}
                onChange={(event) =>
                  setProjectForm((current) =>
                    current ? { ...current, projectName: event.target.value } : current,
                  )
                }
              />
            </Field>
            <Field label="Platform">
              <select
                className={inputClass}
                value={projectForm.platform}
                onChange={(event) =>
                  setProjectForm((current) =>
                    current
                      ? {
                          ...current,
                          platform: event.target.value as ProjectPayload['platform'],
                        }
                      : current,
                  )
                }
              >
                {platforms.map((platform) => (
                  <option key={platform} value={platform}>
                    {platform}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Currency">
              <select
                className={inputClass}
                value={projectForm.currency}
                onChange={(event) =>
                  setProjectForm((current) =>
                    current
                      ? {
                          ...current,
                          currency: event.target.value as ProjectPayload['currency'],
                        }
                      : current,
                  )
                }
              >
                {currencies.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Fee percentage">
              <input
                type="number"
                min="0"
                step="0.1"
                className={inputClass}
                value={projectForm.feePercentage}
                onChange={(event) =>
                  setProjectForm((current) =>
                    current ? { ...current, feePercentage: Number(event.target.value) } : current,
                  )
                }
              />
            </Field>
            <Field label="Status">
              <select
                className={inputClass}
                value={projectForm.status}
                onChange={(event) =>
                  setProjectForm((current) =>
                    current
                      ? {
                          ...current,
                          status: event.target.value as ProjectPayload['status'],
                        }
                      : current,
                  )
                }
              >
                {projectStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Date awarded">
              <input
                type="date"
                className={inputClass}
                value={asInputDate(projectForm.dateAwarded)}
                onChange={(event) =>
                  setProjectForm((current) =>
                    current
                      ? { ...current, dateAwarded: asOptionalDate(event.target.value) }
                      : current,
                  )
                }
              />
            </Field>
            <Field label="Date completed">
              <input
                type="date"
                className={inputClass}
                value={asInputDate(projectForm.dateCompleted)}
                onChange={(event) =>
                  setProjectForm((current) =>
                    current
                      ? { ...current, dateCompleted: asOptionalDate(event.target.value) }
                      : current,
                  )
                }
              />
            </Field>
            <Field label="Notes" className="md:col-span-2">
              <textarea
                rows={4}
                className={inputClass}
                value={projectForm.notes ?? ''}
                onChange={(event) =>
                  setProjectForm((current) =>
                    current ? { ...current, notes: asOptionalText(event.target.value) } : current,
                  )
                }
              />
            </Field>
          </div>
        </form>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Revenue Summary</p>
          <div className="mt-5 space-y-4">
            <SummaryRow label="Paid milestones" value={formatMoney(summary.paidMilestoneTotal, summary.currency)} />
            <SummaryRow label="Tips" value={formatMoney(summary.tipTotal, summary.currency)} />
            <SummaryRow label="Gross" value={formatMoney(summary.gross, summary.currency)} />
            <SummaryRow label="Fee" value={formatMoney(summary.fee, summary.currency)} />
            <SummaryRow label="Net" value={formatMoney(summary.net, summary.currency)} accent />
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Milestones</p>
            <h3 className="mt-2 text-xl font-semibold text-zinc-50">Timeline and payments</h3>
          </div>

          <div className="mt-5 overflow-x-auto">
            {project.milestones.length === 0 ? (
              <StateBox title="No milestones" description="Add the first milestone below." />
            ) : (
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.25em] text-zinc-500">
                  <tr>
                    <th className="pb-3">Name</th>
                    <th className="pb-3">Amount</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3">Date paid</th>
                    <th className="pb-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {project.milestones.map((milestone) => (
                    <tr key={milestone.id}>
                      <td className="py-4">
                        <p className="font-medium text-zinc-100">{milestone.name}</p>
                        {milestone.description ? (
                          <p className="mt-1 text-xs text-zinc-500">{milestone.description}</p>
                        ) : null}
                      </td>
                      <td className="py-4 font-mono text-zinc-200">
                        {formatMoney(milestone.amount, milestone.currency)}
                      </td>
                      <td className="py-4">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs ${statusClasses(milestone.status)}`}
                        >
                          {milestone.status}
                        </span>
                      </td>
                      <td className="py-4 text-zinc-400">{formatDate(milestone.datePaid)}</td>
                      <td className="py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            className={secondaryButtonClass}
                            onClick={() => {
                              setEditingMilestoneId(milestone.id)
                              setMilestoneForm({
                                name: milestone.name,
                                description: milestone.description ?? null,
                                amount: milestone.amount,
                                currency: milestone.currency,
                                status: milestone.status,
                                dateDue: milestone.dateDue ?? null,
                                datePaid: milestone.datePaid ?? null,
                                sortOrder: milestone.sortOrder,
                              })
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className={dangerButtonClass}
                            onClick={() => void handleDeleteMilestone(milestone.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <form onSubmit={handleSaveMilestone} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Milestone Form</p>
              <h3 className="mt-2 text-lg font-semibold text-zinc-50">
                {editingMilestoneId ? 'Edit milestone' : 'Add milestone'}
              </h3>
            </div>
            {editingMilestoneId ? (
              <button
                type="button"
                onClick={() => {
                  setEditingMilestoneId(null)
                  setMilestoneForm({
                    ...defaultMilestoneForm,
                    currency: project.currency,
                    sortOrder: project.milestones.length + 1,
                  })
                }}
                className={secondaryButtonClass}
              >
                Cancel
              </button>
            ) : null}
          </div>

          <div className="mt-5 grid gap-4">
            <Field label="Name">
              <input
                required
                className={inputClass}
                value={milestoneForm.name}
                onChange={(event) =>
                  setMilestoneForm((current) => ({ ...current, name: event.target.value }))
                }
              />
            </Field>
            <Field label="Description">
              <textarea
                rows={3}
                className={inputClass}
                value={milestoneForm.description ?? ''}
                onChange={(event) =>
                  setMilestoneForm((current) => ({
                    ...current,
                    description: asOptionalText(event.target.value),
                  }))
                }
              />
            </Field>
            <Field label="Amount">
              <input
                type="number"
                min="0"
                step="0.01"
                className={inputClass}
                value={milestoneForm.amount}
                onChange={(event) =>
                  setMilestoneForm((current) => ({ ...current, amount: Number(event.target.value) }))
                }
              />
            </Field>
            <Field label="Currency">
              <select
                className={inputClass}
                value={milestoneForm.currency}
                onChange={(event) =>
                  setMilestoneForm((current) => ({
                    ...current,
                    currency: event.target.value as MilestonePayload['currency'],
                  }))
                }
              >
                {currencies.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select
                className={inputClass}
                value={milestoneForm.status}
                onChange={(event) =>
                  setMilestoneForm((current) => ({
                    ...current,
                    status: event.target.value as MilestonePayload['status'],
                  }))
                }
              >
                {milestoneStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Date due">
              <input
                type="date"
                className={inputClass}
                value={asInputDate(milestoneForm.dateDue)}
                onChange={(event) =>
                  setMilestoneForm((current) => ({
                    ...current,
                    dateDue: asOptionalDate(event.target.value),
                  }))
                }
              />
            </Field>
            <Field label="Date paid">
              <input
                type="date"
                className={inputClass}
                value={asInputDate(milestoneForm.datePaid)}
                onChange={(event) =>
                  setMilestoneForm((current) => ({
                    ...current,
                    datePaid: asOptionalDate(event.target.value),
                  }))
                }
              />
            </Field>
            <Field label="Sort order">
              <input
                type="number"
                min="0"
                className={inputClass}
                value={milestoneForm.sortOrder}
                onChange={(event) =>
                  setMilestoneForm((current) => ({
                    ...current,
                    sortOrder: Number(event.target.value),
                  }))
                }
              />
            </Field>
            <button
              type="submit"
              disabled={savingMilestone}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-indigo-500 bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              {savingMilestone ? 'Saving...' : editingMilestoneId ? 'Update milestone' : 'Add milestone'}
            </button>
          </div>
        </form>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Tips</p>
            <h3 className="mt-2 text-xl font-semibold text-zinc-50">Bonuses and extras</h3>
          </div>

          <div className="mt-5 space-y-3">
            {project.tips.length === 0 ? (
              <StateBox title="No tips yet" description="Tips will appear here once logged." />
            ) : (
              project.tips.map((tip) => (
                <TipCard
                  key={tip.id}
                  tip={tip}
                  onEdit={(selectedTip) => {
                    setEditingTipId(selectedTip.id)
                    setTipForm({
                      amount: selectedTip.amount,
                      currency: selectedTip.currency,
                      date: selectedTip.date,
                      notes: selectedTip.notes ?? null,
                    })
                  }}
                  onDelete={handleDeleteTip}
                />
              ))
            )}
          </div>
        </div>

        <form onSubmit={handleSaveTip} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Tip Form</p>
              <h3 className="mt-2 text-lg font-semibold text-zinc-50">
                {editingTipId ? 'Edit tip' : 'Add tip'}
              </h3>
            </div>
            {editingTipId ? (
              <button
                type="button"
                onClick={() => {
                  setEditingTipId(null)
                  setTipForm({
                    ...defaultTipForm,
                    currency: project.currency,
                  })
                }}
                className={secondaryButtonClass}
              >
                Cancel
              </button>
            ) : null}
          </div>

          <div className="mt-5 grid gap-4">
            <Field label="Amount">
              <input
                type="number"
                min="0"
                step="0.01"
                className={inputClass}
                value={tipForm.amount}
                onChange={(event) =>
                  setTipForm((current) => ({ ...current, amount: Number(event.target.value) }))
                }
              />
            </Field>
            <Field label="Currency">
              <select
                className={inputClass}
                value={tipForm.currency}
                onChange={(event) =>
                  setTipForm((current) => ({
                    ...current,
                    currency: event.target.value as TipPayload['currency'],
                  }))
                }
              >
                {currencies.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Date">
              <input
                type="date"
                className={inputClass}
                value={tipForm.date}
                onChange={(event) =>
                  setTipForm((current) => ({ ...current, date: event.target.value }))
                }
              />
            </Field>
            <Field label="Notes">
              <textarea
                rows={3}
                className={inputClass}
                value={tipForm.notes ?? ''}
                onChange={(event) =>
                  setTipForm((current) => ({
                    ...current,
                    notes: asOptionalText(event.target.value),
                  }))
                }
              />
            </Field>
            <button
              type="submit"
              disabled={savingTip}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-indigo-500 bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              {savingTip ? 'Saving...' : editingTipId ? 'Update tip' : 'Add tip'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

function TipCard({
  tip,
  onEdit,
  onDelete,
}: {
  tip: Tip
  onEdit: (tip: Tip) => void
  onDelete: (tipId: number) => void
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-lg text-indigo-200">{formatMoney(tip.amount, tip.currency)}</p>
          <p className="mt-1 text-sm text-zinc-400">{formatDate(tip.date)}</p>
          {tip.notes ? <p className="mt-3 text-sm text-zinc-500">{tip.notes}</p> : null}
        </div>
        <div className="flex gap-2">
          <button type="button" className={secondaryButtonClass} onClick={() => onEdit(tip)}>
            Edit
          </button>
          <button type="button" className={dangerButtonClass} onClick={() => void onDelete(tip.id)}>
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

function SummaryRow({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-800 bg-zinc-950/70 px-4 py-3">
      <span className="text-sm text-zinc-400">{label}</span>
      <span className={`font-mono text-lg ${accent ? 'text-indigo-200' : 'text-zinc-100'}`}>
        {value}
      </span>
    </div>
  )
}

function Field({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <label className={`block ${className ?? ''}`}>
      <span className="mb-2 block text-sm font-medium text-zinc-300">{label}</span>
      {children}
    </label>
  )
}

function StateBox({
  title,
  description,
  error,
}: {
  title: string
  description: string
  error?: boolean
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <p className={`text-lg font-semibold ${error ? 'text-rose-100' : 'text-zinc-100'}`}>{title}</p>
      <p className="mt-2 text-sm text-zinc-400">{description}</p>
    </div>
  )
}

const inputClass =
  'min-h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/40'
const secondaryButtonClass =
  'inline-flex min-h-11 items-center rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 transition hover:border-zinc-600 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500'
const dangerButtonClass =
  'inline-flex min-h-11 items-center rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100 transition hover:bg-rose-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500'
