import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getProjects, createProject, deleteProject } from '../api'
import type { Project } from '../types'
import { CURRENCIES, PLATFORMS, PROJECT_STATUSES } from '../types'
import { ProjectStatusBadge } from '../components/StatusBadge'
import { Modal } from '../components/Modal'

function fmt(n: number) {
  return new Intl.NumberFormat('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
}

function projectRevenue(p: Project): number {
  const paidMs = p.milestones.filter(m => m.status === 'Paid').reduce((s, m) => s + m.amount, 0)
  const tips = p.tips.reduce((s, t) => s + t.amount, 0)
  const gross = paidMs + tips
  return gross - gross * (p.feePercentage / 100)
}

interface ProjectFormData {
  clientName: string
  projectName: string
  platform: string
  currency: string
  feePercentage: string
  status: string
  dateAwarded: string
  dateCompleted: string
  notes: string
}

const emptyForm: ProjectFormData = {
  clientName: '', projectName: '', platform: 'Direct', currency: 'USD',
  feePercentage: '0', status: 'Quoted', dateAwarded: '', dateCompleted: '', notes: '',
}

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState<ProjectFormData>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)

  const load = () => getProjects().then(setProjects).catch(e => setError(e.message)).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await createProject({
        clientName: form.clientName,
        projectName: form.projectName,
        platform: form.platform as Project['platform'],
        currency: form.currency as Project['currency'],
        feePercentage: parseFloat(form.feePercentage) || 0,
        status: form.status as Project['status'],
        dateAwarded: form.dateAwarded || undefined,
        dateCompleted: form.dateCompleted || undefined,
        notes: form.notes || undefined,
      })
      setShowAdd(false)
      setForm(emptyForm)
      load()
    } catch (e: unknown) {
      alert((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await deleteProject(id)
      setDeleteConfirm(null)
      setProjects(ps => ps.filter(p => p.id !== id))
    } catch (e: unknown) {
      alert((e as Error).message)
    }
  }

  const field = (key: keyof ProjectFormData) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value })),
  })

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">Projects</h1>
          <p className="mt-1 text-sm text-zinc-500">{projects.length} total</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Project
        </button>
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">{error}</div>}

      <div className="bg-zinc-800 border border-zinc-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-700 text-xs text-zinc-500 uppercase tracking-wider">
              <th className="text-left px-4 py-3 font-medium">Client</th>
              <th className="text-left px-4 py-3 font-medium">Project</th>
              <th className="text-left px-4 py-3 font-medium">Platform</th>
              <th className="text-left px-4 py-3 font-medium">Currency</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-right px-4 py-3 font-medium">Revenue</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {projects.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-zinc-500">
                  No projects yet. <button onClick={() => setShowAdd(true)} className="text-indigo-400 hover:text-indigo-300">Add one.</button>
                </td>
              </tr>
            ) : (
              projects.map((p) => (
                <tr key={p.id} className="border-b border-zinc-700/50 last:border-0 hover:bg-zinc-700/30 transition-colors group">
                  <td className="px-4 py-3 text-zinc-300">{p.clientName}</td>
                  <td className="px-4 py-3">
                    <Link to={`/projects/${p.id}`} className="text-zinc-100 hover:text-indigo-400 transition-colors font-medium">
                      {p.projectName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{p.platform}</td>
                  <td className="px-4 py-3 text-zinc-400 font-mono">{p.currency}</td>
                  <td className="px-4 py-3"><ProjectStatusBadge status={p.status} /></td>
                  <td className="px-4 py-3 text-right font-mono text-zinc-300">{fmt(projectRevenue(p))}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setDeleteConfirm(p.id)}
                      className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-all p-1"
                      aria-label="Delete project"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Project Modal */}
      {showAdd && (
        <Modal title="Add Project" onClose={() => setShowAdd(false)} size="lg">
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Client Name <span className="text-red-400">*</span></label>
                <input {...field('clientName')} required className={inputCls} placeholder="Acme Corp" />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Project Name <span className="text-red-400">*</span></label>
                <input {...field('projectName')} required className={inputCls} placeholder="Website Redesign" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Platform</label>
                <select {...field('platform')} className={selectCls}>
                  {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Currency</label>
                <select {...field('currency')} className={selectCls}>
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Fee %</label>
                <input {...field('feePercentage')} type="number" min="0" max="100" step="0.1" className={inputCls} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Status</label>
                <select {...field('status')} className={selectCls}>
                  {PROJECT_STATUSES.map(s => <option key={s} value={s}>{s === 'InProgress' ? 'In Progress' : s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Date Awarded</label>
                <input {...field('dateAwarded')} type="date" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Date Completed</label>
                <input {...field('dateCompleted')} type="date" className={inputCls} />
              </div>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Notes</label>
              <textarea {...field('notes')} rows={2} className={inputCls + ' resize-none'} />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowAdd(false)} className={btnSecondary}>Cancel</button>
              <button type="submit" disabled={saving} className={btnPrimary}>
                {saving ? 'Saving…' : 'Create Project'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete confirm */}
      {deleteConfirm !== null && (
        <Modal title="Delete Project" onClose={() => setDeleteConfirm(null)} size="sm">
          <p className="text-sm text-zinc-400 mb-6">This will permanently delete this project and all its milestones and tips.</p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setDeleteConfirm(null)} className={btnSecondary}>Cancel</button>
            <button onClick={() => handleDelete(deleteConfirm)} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-colors">
              Delete
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

const inputCls = 'w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30'
const selectCls = 'w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500'
const btnPrimary = 'px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors'
const btnSecondary = 'px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-sm font-medium rounded-lg transition-colors'
