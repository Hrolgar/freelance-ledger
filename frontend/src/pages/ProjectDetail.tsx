import { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  getProject, getProjectSummary, updateProject,
  createMilestone, updateMilestone, deleteMilestone, patchMilestone,
  createTip, updateTip, deleteTip,
} from '../api'
import type { Project, Milestone, Tip, ProjectSummary } from '../types'
import { CURRENCIES, PLATFORMS, PROJECT_STATUSES, MILESTONE_STATUSES } from '../types'
import { ProjectStatusBadge, MilestoneStatusBadge } from '../components/StatusBadge'
import { Modal } from '../components/Modal'

function fmt(n: number) {
  return new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

const inputCls = 'w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30'
const selectCls = 'w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500'
const btnPrimary = 'px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors'
const btnSecondary = 'px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-sm font-medium rounded-lg transition-colors'

// --- Milestone form ---
interface MilestoneFormData {
  name: string; description: string; amount: string; currency: string
  status: string; dateDue: string; datePaid: string; sortOrder: string
}
const emptyMilestone: MilestoneFormData = {
  name: '', description: '', amount: '', currency: 'USD',
  status: 'Pending', dateDue: '', datePaid: '', sortOrder: '0',
}

function milestoneFromForm(f: MilestoneFormData): Omit<Milestone, 'id' | 'projectId'> {
  return {
    name: f.name, description: f.description || undefined,
    amount: parseFloat(f.amount) || 0,
    currency: f.currency as Milestone['currency'],
    status: f.status as Milestone['status'],
    dateDue: f.dateDue || undefined, datePaid: f.datePaid || undefined,
    sortOrder: parseInt(f.sortOrder) || 0,
  }
}

// --- Tip form ---
interface TipFormData { amount: string; currency: string; date: string; notes: string }
const emptyTip: TipFormData = { amount: '', currency: 'USD', date: new Date().toISOString().slice(0, 10), notes: '' }

// --- Edit project form ---
interface ProjectEditData {
  clientName: string; projectName: string; platform: string; currency: string
  feePercentage: string; status: string; dateAwarded: string; dateCompleted: string; notes: string
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const projectId = parseInt(id!)
  const navigate = useNavigate()

  const [project, setProject] = useState<Project | null>(null)
  const [summary, setSummary] = useState<ProjectSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Modals
  const [editProject, setEditProject] = useState(false)
  const [addMilestone, setAddMilestone] = useState(false)
  const [editMilestone, setEditMilestone] = useState<Milestone | null>(null)
  const [addTip, setAddTip] = useState(false)
  const [editTipItem, setEditTipItem] = useState<Tip | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'milestone' | 'tip'; id: number } | null>(null)

  // Forms
  const [projectForm, setProjectForm] = useState<ProjectEditData | null>(null)
  const [milestoneForm, setMilestoneForm] = useState<MilestoneFormData>(emptyMilestone)
  const [tipForm, setTipForm] = useState<TipFormData>(emptyTip)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const [p, s] = await Promise.all([getProject(projectId), getProjectSummary(projectId)])
      setProject(p)
      setSummary(s)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { load() }, [load])

  const openEditProject = () => {
    if (!project) return
    setProjectForm({
      clientName: project.clientName, projectName: project.projectName,
      platform: project.platform, currency: project.currency,
      feePercentage: String(project.feePercentage), status: project.status,
      dateAwarded: project.dateAwarded?.slice(0, 10) ?? '',
      dateCompleted: project.dateCompleted?.slice(0, 10) ?? '',
      notes: project.notes ?? '',
    })
    setEditProject(true)
  }

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!projectForm) return
    setSaving(true)
    try {
      await updateProject(projectId, {
        clientName: projectForm.clientName, projectName: projectForm.projectName,
        platform: projectForm.platform as Project['platform'],
        currency: projectForm.currency as Project['currency'],
        feePercentage: parseFloat(projectForm.feePercentage) || 0,
        status: projectForm.status as Project['status'],
        dateAwarded: projectForm.dateAwarded || undefined,
        dateCompleted: projectForm.dateCompleted || undefined,
        notes: projectForm.notes || undefined,
      })
      setEditProject(false)
      load()
    } catch (e: unknown) { alert((e as Error).message) }
    finally { setSaving(false) }
  }

  const handleSaveMilestone = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editMilestone) {
        await updateMilestone(projectId, editMilestone.id, milestoneFromForm(milestoneForm))
        setEditMilestone(null)
      } else {
        await createMilestone(projectId, milestoneFromForm(milestoneForm))
        setAddMilestone(false)
      }
      setMilestoneForm(emptyMilestone)
      load()
    } catch (e: unknown) { alert((e as Error).message) }
    finally { setSaving(false) }
  }

  const handleSaveTip = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const data = {
        amount: parseFloat(tipForm.amount) || 0,
        currency: tipForm.currency as Tip['currency'],
        date: tipForm.date,
        notes: tipForm.notes || undefined,
      }
      if (editTipItem) {
        await updateTip(projectId, editTipItem.id, data)
        setEditTipItem(null)
      } else {
        await createTip(projectId, data)
        setAddTip(false)
      }
      setTipForm(emptyTip)
      load()
    } catch (e: unknown) { alert((e as Error).message) }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!deleteConfirm) return
    try {
      if (deleteConfirm.type === 'milestone') await deleteMilestone(projectId, deleteConfirm.id)
      else await deleteTip(projectId, deleteConfirm.id)
      setDeleteConfirm(null)
      load()
    } catch (e: unknown) { alert((e as Error).message) }
  }

  const openEditMilestone = (m: Milestone) => {
    setMilestoneForm({
      name: m.name, description: m.description ?? '',
      amount: String(m.amount), currency: m.currency, status: m.status,
      dateDue: m.dateDue?.slice(0, 10) ?? '', datePaid: m.datePaid?.slice(0, 10) ?? '',
      sortOrder: String(m.sortOrder),
    })
    setEditMilestone(m)
  }

  const openEditTip = (t: Tip) => {
    setTipForm({ amount: String(t.amount), currency: t.currency, date: t.date, notes: t.notes ?? '' })
    setEditTipItem(t)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (error || !project) return (
    <div className="p-8">
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">{error ?? 'Not found'}</div>
      <button onClick={() => navigate('/projects')} className="mt-4 text-sm text-indigo-400 hover:text-indigo-300">← Back to projects</button>
    </div>
  )

  const mField = (k: keyof MilestoneFormData) => ({
    value: milestoneForm[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setMilestoneForm(f => ({ ...f, [k]: e.target.value })),
  })
  const tField = (k: keyof TipFormData) => ({
    value: tipForm[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setTipForm(f => ({ ...f, [k]: e.target.value })),
  })
  const pField = (k: keyof ProjectEditData) => ({
    value: projectForm?.[k] ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setProjectForm(f => f ? { ...f, [k]: e.target.value } : f),
  })

  return (
    <div className="p-8 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <Link to="/projects" className="hover:text-zinc-300 transition-colors">Projects</Link>
        <span>/</span>
        <span className="text-zinc-300">{project.projectName}</span>
      </div>

      {/* Project header */}
      <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-semibold text-zinc-100">{project.projectName}</h1>
              <ProjectStatusBadge status={project.status} />
            </div>
            <p className="text-sm text-zinc-400">{project.clientName} · {project.platform} · {project.currency}</p>
            {project.notes && <p className="mt-3 text-sm text-zinc-500 leading-relaxed">{project.notes}</p>}
          </div>
          <button onClick={openEditProject} className="flex items-center gap-2 px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-sm rounded-lg transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit
          </button>
        </div>

        <div className="mt-4 pt-4 border-t border-zinc-700 grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-zinc-500">Fee</p>
            <p className="text-sm font-mono text-zinc-300 mt-0.5">{project.feePercentage}%</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Date Awarded</p>
            <p className="text-sm font-mono text-zinc-300 mt-0.5">{project.dateAwarded?.slice(0, 10) ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Date Completed</p>
            <p className="text-sm font-mono text-zinc-300 mt-0.5">{project.dateCompleted?.slice(0, 10) ?? '—'}</p>
          </div>
        </div>
      </div>

      {/* Revenue summary */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'Paid Milestones', value: fmt(summary.paidMilestoneTotal) },
            { label: 'Tips', value: fmt(summary.tipTotal) },
            { label: 'Gross', value: fmt(summary.gross) },
            { label: `Fee (${project.feePercentage}%)`, value: `−${fmt(summary.fee)}` },
            { label: 'Net Revenue', value: fmt(summary.net) },
          ].map(({ label, value }) => (
            <div key={label} className="bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3">
              <p className="text-xs text-zinc-500">{label}</p>
              <p className="text-sm font-mono font-semibold text-zinc-100 mt-1">{summary.currency} {value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Milestones */}
      <div className="bg-zinc-800 border border-zinc-700 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-700">
          <h2 className="text-sm font-semibold text-zinc-300">Milestones</h2>
          <button onClick={() => { setMilestoneForm(emptyMilestone); setAddMilestone(true) }}
            className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Milestone
          </button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-700 text-xs text-zinc-500 uppercase tracking-wider">
              <th className="text-left px-4 py-3 font-medium">Name</th>
              <th className="text-right px-4 py-3 font-medium">Amount</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Due</th>
              <th className="text-left px-4 py-3 font-medium">Paid</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {project.milestones.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-500 text-sm">No milestones yet.</td></tr>
            ) : (
              project.milestones.map((m) => (
                <tr key={m.id} className="border-b border-zinc-700/50 last:border-0 hover:bg-zinc-700/20 transition-colors group">
                  <td className="px-4 py-3">
                    <p className="text-zinc-200">{m.name}</p>
                    {m.description && <p className="text-xs text-zinc-500 mt-0.5">{m.description}</p>}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-zinc-300">{m.currency} {fmt(m.amount)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => {
                        const nextStatus = m.status === 'Pending' ? 'Funded'
                          : m.status === 'Funded' ? 'Released'
                          : m.status === 'Released' ? 'Paid'
                          : m.status
                        const datePaid = nextStatus === 'Paid' ? new Date().toISOString().slice(0, 10) : m.datePaid ?? null
                        patchMilestone(m.id, { status: nextStatus, datePaid }).then(load)
                      }}
                      title="Click to advance status"
                      className="hover:opacity-75 transition-opacity"
                    >
                      <MilestoneStatusBadge status={m.status} />
                    </button>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-500">{m.dateDue?.slice(0, 10) ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-500">{m.datePaid?.slice(0, 10) ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEditMilestone(m)} className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button onClick={() => setDeleteConfirm({ type: 'milestone', id: m.id })} className="p-1 text-zinc-500 hover:text-red-400 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Tips */}
      <div className="bg-zinc-800 border border-zinc-700 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-700">
          <h2 className="text-sm font-semibold text-zinc-300">Tips</h2>
          <button onClick={() => { setTipForm(emptyTip); setAddTip(true) }}
            className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Tip
          </button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-700 text-xs text-zinc-500 uppercase tracking-wider">
              <th className="text-left px-4 py-3 font-medium">Date</th>
              <th className="text-right px-4 py-3 font-medium">Amount</th>
              <th className="text-left px-4 py-3 font-medium">Notes</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {project.tips.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-zinc-500 text-sm">No tips yet.</td></tr>
            ) : (
              project.tips.map((t) => (
                <tr key={t.id} className="border-b border-zinc-700/50 last:border-0 hover:bg-zinc-700/20 transition-colors group">
                  <td className="px-4 py-3 font-mono text-xs text-zinc-400">{t.date}</td>
                  <td className="px-4 py-3 text-right font-mono text-zinc-300">{t.currency} {fmt(t.amount)}</td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">{t.notes ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEditTip(t)} className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button onClick={() => setDeleteConfirm({ type: 'tip', id: t.id })} className="p-1 text-zinc-500 hover:text-red-400 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Project Modal */}
      {editProject && projectForm && (
        <Modal title="Edit Project" onClose={() => setEditProject(false)} size="lg">
          <form onSubmit={handleSaveProject} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Client Name <span className="text-red-400">*</span></label>
                <input {...pField('clientName')} required className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Project Name <span className="text-red-400">*</span></label>
                <input {...pField('projectName')} required className={inputCls} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Platform</label>
                <select {...pField('platform')} className={selectCls}>
                  {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Currency</label>
                <select {...pField('currency')} className={selectCls}>
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Fee %</label>
                <input {...pField('feePercentage')} type="number" min="0" max="100" step="0.1" className={inputCls} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Status</label>
                <select {...pField('status')} className={selectCls}>
                  {PROJECT_STATUSES.map(s => <option key={s} value={s}>{s === 'InProgress' ? 'In Progress' : s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Date Awarded</label>
                <input {...pField('dateAwarded')} type="date" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Date Completed</label>
                <input {...pField('dateCompleted')} type="date" className={inputCls} />
              </div>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Notes</label>
              <textarea {...pField('notes')} rows={2} className={inputCls + ' resize-none'} />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setEditProject(false)} className={btnSecondary}>Cancel</button>
              <button type="submit" disabled={saving} className={btnPrimary}>{saving ? 'Saving…' : 'Save Changes'}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Add/Edit Milestone Modal */}
      {(addMilestone || editMilestone) && (
        <Modal title={editMilestone ? 'Edit Milestone' : 'Add Milestone'}
          onClose={() => { setAddMilestone(false); setEditMilestone(null) }} size="md">
          <form onSubmit={handleSaveMilestone} className="space-y-4">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Name <span className="text-red-400">*</span></label>
              <input {...mField('name')} required className={inputCls} placeholder="Initial payment" />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Description</label>
              <input {...mField('description')} className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Amount <span className="text-red-400">*</span></label>
                <input {...mField('amount')} type="number" min="0" step="0.01" required className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Currency</label>
                <select {...mField('currency')} className={selectCls}>
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Status</label>
                <select {...mField('status')} className={selectCls}>
                  {MILESTONE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Due Date</label>
                <input {...mField('dateDue')} type="date" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Date Paid</label>
                <input {...mField('datePaid')} type="date" className={inputCls} />
              </div>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Sort Order</label>
              <input {...mField('sortOrder')} type="number" className={inputCls} />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => { setAddMilestone(false); setEditMilestone(null) }} className={btnSecondary}>Cancel</button>
              <button type="submit" disabled={saving} className={btnPrimary}>{saving ? 'Saving…' : editMilestone ? 'Save Changes' : 'Add Milestone'}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Add/Edit Tip Modal */}
      {(addTip || editTipItem) && (
        <Modal title={editTipItem ? 'Edit Tip' : 'Add Tip'} onClose={() => { setAddTip(false); setEditTipItem(null) }} size="sm">
          <form onSubmit={handleSaveTip} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Amount <span className="text-red-400">*</span></label>
                <input {...tField('amount')} type="number" min="0" step="0.01" required className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Currency</label>
                <select {...tField('currency')} className={selectCls}>
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Date <span className="text-red-400">*</span></label>
              <input {...tField('date')} type="date" required className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Notes</label>
              <input {...tField('notes')} className={inputCls} />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => { setAddTip(false); setEditTipItem(null) }} className={btnSecondary}>Cancel</button>
              <button type="submit" disabled={saving} className={btnPrimary}>{saving ? 'Saving…' : editTipItem ? 'Save Changes' : 'Add Tip'}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <Modal title={`Delete ${deleteConfirm.type}`} onClose={() => setDeleteConfirm(null)} size="sm">
          <p className="text-sm text-zinc-400 mb-6">This will permanently delete this {deleteConfirm.type}.</p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setDeleteConfirm(null)} className={btnSecondary}>Cancel</button>
            <button onClick={handleDelete} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-colors">Delete</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
