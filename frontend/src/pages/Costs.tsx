import { useState, useEffect } from 'react'
import { getCosts, createCost, updateCost, deleteCost, getInvestments, createInvestment, updateInvestment, deleteInvestment } from '../api'
import type { Cost, Investment } from '../types'
import { CURRENCIES, COST_CATEGORIES } from '../types'
import { Modal } from '../components/Modal'
import {
  AppCard, Button, SectionHeading, PageIntro, EmptyState, ErrorState, LoadingState,
  Input, Select, Field, Checkbox,
} from '../components/ui'
import { formatCurrency } from '../lib/format'

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][i],
}))
const YEARS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i)

interface CostForm {
  description: string; amount: string; category: string
  month: string; year: string; recurring: boolean; notes: string
}
const emptyCost = (): CostForm => ({
  description: '', amount: '', category: 'Software',
  month: String(new Date().getMonth() + 1),
  year: String(new Date().getFullYear()),
  recurring: false, notes: '',
})

interface InvForm {
  description: string; amount: string; currency: string; nokRate: string
  month: string; year: string; notes: string
}
const emptyInv = (): InvForm => ({
  description: '', amount: '', currency: 'USD', nokRate: '1',
  month: String(new Date().getMonth() + 1),
  year: String(new Date().getFullYear()),
  notes: '',
})

function DeleteConfirmModal({ type, onConfirm, onCancel }: { type: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <Modal title={`Delete ${type}`} onClose={onCancel} size="sm">
      <p className="text-sm text-zinc-400 mb-6">This will permanently delete this {type}.</p>
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button variant="danger" onClick={onConfirm}>Delete</Button>
      </div>
    </Modal>
  )
}

export default function Costs() {
  const [costs, setCosts] = useState<Cost[]>([])
  const [investments, setInvestments] = useState<Investment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [costModal, setCostModal] = useState<'add' | 'edit' | null>(null)
  const [costForm, setCostForm] = useState<CostForm>(emptyCost())
  const [editCostId, setEditCostId] = useState<number | null>(null)

  const [invModal, setInvModal] = useState<'add' | 'edit' | null>(null)
  const [invForm, setInvForm] = useState<InvForm>(emptyInv())
  const [editInvId, setEditInvId] = useState<number | null>(null)

  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'cost' | 'investment'; id: number } | null>(null)
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    Promise.all([getCosts(), getInvestments()])
      .then(([cs, inv]) => { setCosts(cs); setInvestments(inv) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const handleSaveCost = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const data: Omit<Cost, 'id'> = {
        description: costForm.description,
        amount: parseFloat(costForm.amount) || 0,
        category: costForm.category as Cost['category'],
        month: parseInt(costForm.month),
        year: parseInt(costForm.year),
        recurring: costForm.recurring,
        notes: costForm.notes || null,
      }
      if (costModal === 'edit' && editCostId) await updateCost(editCostId, data)
      else await createCost(data)
      setCostModal(null)
      setCostForm(emptyCost())
      load()
    } catch (e: unknown) { alert((e as Error).message) }
    finally { setSaving(false) }
  }

  const handleSaveInv = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const data: Omit<Investment, 'id'> = {
        description: invForm.description,
        amount: parseFloat(invForm.amount) || 0,
        currency: invForm.currency as Investment['currency'],
        nokRate: parseFloat(invForm.nokRate) || 1,
        month: parseInt(invForm.month),
        year: parseInt(invForm.year),
        notes: invForm.notes || null,
      }
      if (invModal === 'edit' && editInvId) await updateInvestment(editInvId, data)
      else await createInvestment(data)
      setInvModal(null)
      setInvForm(emptyInv())
      load()
    } catch (e: unknown) { alert((e as Error).message) }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!deleteConfirm) return
    try {
      if (deleteConfirm.type === 'cost') await deleteCost(deleteConfirm.id)
      else await deleteInvestment(deleteConfirm.id)
      setDeleteConfirm(null)
      load()
    } catch (e: unknown) { alert((e as Error).message) }
  }

  const openEditCost = (c: Cost) => {
    setCostForm({
      description: c.description, amount: String(c.amount), category: c.category,
      month: String(c.month), year: String(c.year), recurring: c.recurring, notes: c.notes ?? '',
    })
    setEditCostId(c.id)
    setCostModal('edit')
  }

  const openEditInv = (inv: Investment) => {
    setInvForm({
      description: inv.description, amount: String(inv.amount), currency: inv.currency,
      nokRate: String(inv.nokRate), month: String(inv.month), year: String(inv.year), notes: inv.notes ?? '',
    })
    setEditInvId(inv.id)
    setInvModal('edit')
  }

  if (loading) return <LoadingState label="Loading costs" />
  if (error) return <ErrorState message={error} onRetry={load} />

  const totalCosts = costs.reduce((s, c) => s + c.amount, 0)
  const totalInvestments = investments.reduce((s, i) => s + i.amount * i.nokRate, 0)

  const actionIcons = (onEdit: () => void, onDelete: () => void) => (
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <button onClick={onEdit} className="p-1 text-zinc-500 hover:text-zinc-200 transition-colors rounded">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
      </button>
      <button onClick={onDelete} className="p-1 text-zinc-500 hover:text-rose-400 transition-colors rounded">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
      </button>
    </div>
  )

  return (
    <div className="space-y-8">
      <PageIntro
        title="Costs"
        description="Recurring monthly expenses and one-time investments."
        action={
          <div className="flex gap-3">
            <Button onClick={() => { setCostForm(emptyCost()); setCostModal('add') }}>Add Cost</Button>
            <Button variant="secondary" onClick={() => { setInvForm(emptyInv()); setInvModal('add') }}>Add Investment</Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <AppCard className="p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">Total Costs (NOK)</p>
          <p className="mt-4 text-2xl font-semibold tracking-tight text-rose-300" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
            {formatCurrency(totalCosts, 'NOK')}
          </p>
          <p className="mt-2 text-sm text-zinc-400">{costs.length} entries</p>
        </AppCard>
        <AppCard className="p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">Total Investments (NOK)</p>
          <p className="mt-4 text-2xl font-semibold tracking-tight text-amber-300" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
            {formatCurrency(totalInvestments, 'NOK')}
          </p>
          <p className="mt-2 text-sm text-zinc-400">{investments.length} entries</p>
        </AppCard>
      </div>

      {/* Costs table */}
      <AppCard>
        <SectionHeading
          title="Recurring Costs"
          description="Monthly operating expenses."
          action={<Button onClick={() => { setCostForm(emptyCost()); setCostModal('add') }}>Add Cost</Button>}
        />
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-700/70 text-xs text-zinc-500 uppercase tracking-wider">
              <th className="text-left px-5 py-3 font-medium">Description</th>
              <th className="text-left px-5 py-3 font-medium">Category</th>
              <th className="text-left px-5 py-3 font-medium">Period</th>
              <th className="text-center px-5 py-3 font-medium">Recurring</th>
              <th className="text-right px-5 py-3 font-medium">Amount (NOK)</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {costs.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-8">
                <EmptyState title="No costs yet" description="Add your first operating expense." />
              </td></tr>
            ) : (
              costs.map(c => (
                <tr key={c.id} className="border-b border-zinc-700/50 last:border-0 hover:bg-zinc-700/20 transition-colors group">
                  <td className="px-5 py-3 text-zinc-200">{c.description}</td>
                  <td className="px-5 py-3 text-zinc-400">{c.category}</td>
                  <td className="px-5 py-3 font-mono text-xs text-zinc-500">{MONTHS[c.month - 1].label} {c.year}</td>
                  <td className="px-5 py-3 text-center">
                    {c.recurring
                      ? <span className="text-xs text-blue-300 bg-blue-500/10 ring-1 ring-inset ring-blue-400/30 px-2 py-0.5 rounded-full">Yes</span>
                      : <span className="text-xs text-zinc-600">—</span>}
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-zinc-300">{formatCurrency(c.amount, 'NOK')}</td>
                  <td className="px-5 py-3">{actionIcons(() => openEditCost(c), () => setDeleteConfirm({ type: 'cost', id: c.id }))}</td>
                </tr>
              ))
            )}
          </tbody>
          {costs.length > 0 && (
            <tfoot>
              <tr className="border-t border-zinc-700 bg-zinc-700/10">
                <td colSpan={4} className="px-5 py-3 text-xs font-medium text-zinc-500">Total</td>
                <td className="px-5 py-3 text-right font-mono font-semibold text-zinc-200">{formatCurrency(totalCosts, 'NOK')}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </AppCard>

      {/* Investments table */}
      <AppCard>
        <SectionHeading
          title="Investments"
          description="One-time purchases not included in monthly P&L."
          action={<Button onClick={() => { setInvForm(emptyInv()); setInvModal('add') }}>Add Investment</Button>}
        />
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-700/70 text-xs text-zinc-500 uppercase tracking-wider">
              <th className="text-left px-5 py-3 font-medium">Description</th>
              <th className="text-left px-5 py-3 font-medium">Period</th>
              <th className="text-right px-5 py-3 font-medium">Amount</th>
              <th className="text-right px-5 py-3 font-medium">NOK Rate</th>
              <th className="text-right px-5 py-3 font-medium">NOK Value</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {investments.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-8">
                <EmptyState title="No investments yet" description="Track one-time hardware, software, and equipment purchases." />
              </td></tr>
            ) : (
              investments.map(inv => (
                <tr key={inv.id} className="border-b border-zinc-700/50 last:border-0 hover:bg-zinc-700/20 transition-colors group">
                  <td className="px-5 py-3">
                    <p className="text-zinc-200">{inv.description}</p>
                    {inv.notes && <p className="text-xs text-zinc-500">{inv.notes}</p>}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-zinc-500">{MONTHS[inv.month - 1].label} {inv.year}</td>
                  <td className="px-5 py-3 text-right font-mono text-zinc-300">{inv.currency} {inv.amount.toFixed(2)}</td>
                  <td className="px-5 py-3 text-right font-mono text-zinc-500">{inv.nokRate.toFixed(2)}</td>
                  <td className="px-5 py-3 text-right font-mono text-zinc-300">{formatCurrency(inv.amount * inv.nokRate, 'NOK')}</td>
                  <td className="px-5 py-3">{actionIcons(() => openEditInv(inv), () => setDeleteConfirm({ type: 'investment', id: inv.id }))}</td>
                </tr>
              ))
            )}
          </tbody>
          {investments.length > 0 && (
            <tfoot>
              <tr className="border-t border-zinc-700 bg-zinc-700/10">
                <td colSpan={4} className="px-5 py-3 text-xs font-medium text-zinc-500">Total NOK</td>
                <td className="px-5 py-3 text-right font-mono font-semibold text-zinc-200">{formatCurrency(totalInvestments, 'NOK')}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </AppCard>

      {/* Cost Modal */}
      {costModal && (
        <Modal title={costModal === 'edit' ? 'Edit Cost' : 'Add Cost'} onClose={() => setCostModal(null)} size="md">
          <form onSubmit={handleSaveCost} className="space-y-4">
            <Field label="Description" required>
              <Input value={costForm.description} onChange={e => setCostForm(f => ({ ...f, description: e.target.value }))} required placeholder="GitHub Copilot" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Amount (NOK)" required>
                <Input type="number" min="0" step="0.01" required value={costForm.amount} onChange={e => setCostForm(f => ({ ...f, amount: e.target.value }))} />
              </Field>
              <Field label="Category">
                <Select value={costForm.category} onChange={e => setCostForm(f => ({ ...f, category: e.target.value }))}>
                  {COST_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Month">
                <Select value={costForm.month} onChange={e => setCostForm(f => ({ ...f, month: e.target.value }))}>
                  {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </Select>
              </Field>
              <Field label="Year">
                <Select value={costForm.year} onChange={e => setCostForm(f => ({ ...f, year: e.target.value }))}>
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </Select>
              </Field>
            </div>
            <label className="flex items-center gap-3 text-sm text-zinc-300">
              <Checkbox checked={costForm.recurring} onChange={e => setCostForm(f => ({ ...f, recurring: e.target.checked }))} />
              Recurring monthly cost
            </label>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" type="button" onClick={() => setCostModal(null)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : costModal === 'edit' ? 'Save Changes' : 'Add Cost'}</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Investment Modal */}
      {invModal && (
        <Modal title={invModal === 'edit' ? 'Edit Investment' : 'Add Investment'} onClose={() => setInvModal(null)} size="md">
          <form onSubmit={handleSaveInv} className="space-y-4">
            <Field label="Description" required>
              <Input value={invForm.description} onChange={e => setInvForm(f => ({ ...f, description: e.target.value }))} required placeholder="New laptop" />
            </Field>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Amount" required>
                <Input type="number" min="0" step="0.01" required value={invForm.amount} onChange={e => setInvForm(f => ({ ...f, amount: e.target.value }))} />
              </Field>
              <Field label="Currency">
                <Select value={invForm.currency} onChange={e => setInvForm(f => ({ ...f, currency: e.target.value }))}>
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </Select>
              </Field>
              <Field label="NOK Rate">
                <Input type="number" min="0" step="0.01" value={invForm.nokRate} onChange={e => setInvForm(f => ({ ...f, nokRate: e.target.value }))} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Month">
                <Select value={invForm.month} onChange={e => setInvForm(f => ({ ...f, month: e.target.value }))}>
                  {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </Select>
              </Field>
              <Field label="Year">
                <Select value={invForm.year} onChange={e => setInvForm(f => ({ ...f, year: e.target.value }))}>
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="Notes">
              <Input value={invForm.notes} onChange={e => setInvForm(f => ({ ...f, notes: e.target.value }))} />
            </Field>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" type="button" onClick={() => setInvModal(null)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : invModal === 'edit' ? 'Save Changes' : 'Add Investment'}</Button>
            </div>
          </form>
        </Modal>
      )}

      {deleteConfirm && (
        <DeleteConfirmModal
          type={deleteConfirm.type}
          onConfirm={handleDelete}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  )
}
