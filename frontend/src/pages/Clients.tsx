import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { getClients, getClient, createClient, updateClient, deleteClient } from '../api'
import { AppCard, Button, EmptyState, ErrorState, Field, Input, PageIntro, Select, SectionHeading, Textarea } from '../components/ui'
import { ProjectStatusBadge } from '../components/StatusBadge'
import { MoneyAmount } from '../components/MoneyAmount'
import { formatDate } from '../lib/format'
import { COUNTRIES } from '../lib/countries'
import { getTimezoneOffset, useMyTimezone } from '../lib/useMyTimezone'
import type { Client, ClientInput } from '../types'
import { TIMEZONES } from '../types'

function ClientClock({ timezone }: { timezone: string }) {
  const [myTz] = useMyTimezone()
  const [time, setTime] = useState('')
  const [offset, setOffset] = useState('')

  useEffect(() => {
    const update = () => {
      try {
        const now = new Date()
        const timeStr = now.toLocaleTimeString('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit' })
        const dateStr = now.toLocaleDateString('en-GB', { timeZone: timezone, weekday: 'short' })
        setTime(`${dateStr} ${timeStr}`)
        setOffset(getTimezoneOffset(timezone, myTz))
      } catch { setTime(timezone) }
    }
    update()
    const interval = setInterval(update, 30000)
    return () => clearInterval(interval)
  }, [timezone, myTz])

  return (
    <span className="group relative rounded bg-[var(--bg-surface)] px-3 py-1.5 text-sm text-[var(--text-secondary)] cursor-help">
      <span className="text-[var(--text-tertiary)]">{timezone.split('/').pop()?.replace('_', ' ')}</span>
      <span className="ml-2 font-mono text-[var(--accent)]">{time}</span>
      {offset && (
        <span className="pointer-events-none absolute bottom-full left-0 z-10 mb-1.5 whitespace-nowrap rounded bg-[var(--bg-elevated)] px-2 py-1 text-xs text-[var(--accent)] opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
          {offset}
        </span>
      )}
    </span>
  )
}

const emptyClient: ClientInput = {
  name: '', email: null, phone: null, country: null, timezone: null,
  freelancerId: null, upworkId: null, notes: null, aliases: null,
}

function ClientList() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [draft, setDraft] = useState<ClientInput>(emptyClient)

  const load = async () => {
    setLoading(true)
    try { setClients(await getClients()) }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to load.') }
    finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createClient(draft)
      setDraft(emptyClient)
      setShowForm(false)
      await load()
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to create.') }
  }

  return (
    <div className="space-y-6">
      <PageIntro
        title="Clients"
        description="Client profiles with contact info and project history."
        action={<Button onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : 'Add Client'}</Button>}
      />

      {error && <ErrorState message={error} onRetry={() => void load()} />}

      {showForm && (
        <AppCard className="p-4">
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" onSubmit={handleCreate}>
            <Field label="Name" required>
              <Input required value={draft.name} onChange={(e) => setDraft(d => ({ ...d, name: e.target.value }))} />
            </Field>
            <Field label="Email">
              <Input type="email" value={draft.email ?? ''} onChange={(e) => setDraft(d => ({ ...d, email: e.target.value || null }))} />
            </Field>
            <Field label="Country">
              <Select value={draft.country ?? ''} onChange={(e) => {
                const name = e.target.value
                const country = COUNTRIES.find(c => c.name === name)
                setDraft(d => ({
                  ...d,
                  country: name || null,
                  timezone: d.timezone ?? country?.timezone ?? null,
                }))
              }}>
                <option value="">Not set</option>
                {COUNTRIES.map(c => <option key={c.code} value={c.name}>{c.name}</option>)}
              </Select>
            </Field>
            <Field label="Freelancer ID">
              <Input value={draft.freelancerId ?? ''} onChange={(e) => setDraft(d => ({ ...d, freelancerId: e.target.value || null }))} placeholder="e.g. nick111nick111" />
            </Field>
            <Field label="Upwork ID">
              <Input value={draft.upworkId ?? ''} onChange={(e) => setDraft(d => ({ ...d, upworkId: e.target.value || null }))} />
            </Field>
            <Field label="Aliases (comma-separated)">
              <Input value={draft.aliases ?? ''} onChange={(e) => setDraft(d => ({ ...d, aliases: e.target.value || null }))} placeholder="nick111, NickO" />
            </Field>
            <div className="flex items-end sm:col-span-2 lg:col-span-3">
              <Button type="submit">Create Client</Button>
            </div>
          </form>
        </AppCard>
      )}

      {loading ? (
        <div className="text-sm text-[var(--text-tertiary)]">Loading...</div>
      ) : clients.length === 0 ? (
        <EmptyState title="No clients yet" description="Add a client to start tracking." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {clients.map((client) => {
            const projectCurrency = client.projects[0]?.currency ?? 'NOK'
            const paid = client.projects.flatMap(p => p.milestones).filter(m => m.status === 'Paid').reduce((s, m) => s + m.amount, 0)
            return (
              <Link key={client.id} to={`/clients/${client.id}`} className="group">
                <AppCard className="h-full p-4 transition-colors hover:border-[var(--accent)]">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3
                        className="text-sm font-semibold text-[var(--text-primary)]"
                        style={{ fontFamily: 'var(--font-display)' }}
                      >
                        {client.name}
                      </h3>
                      {client.aliases && (
                        <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">{client.aliases}</p>
                      )}
                    </div>
                    {client.country && (
                      <span className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">{client.country}</span>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-[var(--text-tertiary)]">
                    {client.projects.length} project{client.projects.length !== 1 ? 's' : ''}
                    {client.freelancerId && ' · Freelancer'}
                    {client.upworkId && ' · Upwork'}
                  </p>
                  <div className="mt-3 flex items-baseline gap-1.5 font-mono tabular-nums text-lg font-semibold text-[var(--text-primary)]">
                    <MoneyAmount amount={paid} currency={projectCurrency} />
                    <span className="text-xs font-normal text-[var(--text-tertiary)]">paid</span>
                  </div>
                </AppCard>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ClientDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [client, setClient] = useState<Client | null>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<ClientInput>(emptyClient)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const c = await getClient(Number(id))
      setClient(c)
      setDraft({
        name: c.name, email: c.email, phone: c.phone, country: c.country,
        timezone: c.timezone, freelancerId: c.freelancerId, upworkId: c.upworkId,
        notes: c.notes, aliases: c.aliases,
      })
    } catch (e) { setError(e instanceof Error ? e.message : 'Not found.') }
    finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [id])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await updateClient(Number(id), draft)
      setEditing(false)
      await load()
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to update.') }
  }

  const handleDelete = async () => {
    if (!window.confirm(`Delete client "${client?.name}" and all their projects?`)) return
    try { await deleteClient(Number(id)); navigate('/clients') }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to delete.') }
  }

  if (loading) return <div className="p-8 text-sm text-[var(--text-tertiary)]">Loading...</div>
  if (error || !client) return <ErrorState message={error ?? 'Client not found.'} />

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
        <Link to="/clients" className="hover:text-[var(--text-primary)] transition-colors">Clients</Link>
        <span>/</span>
        <span className="text-[var(--text-secondary)]">{client.name}</span>
      </div>

      <PageIntro
        title={client.name}
        description={[client.aliases, client.country].filter(Boolean).join(' · ') || 'Client profile'}
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setEditing(!editing)}>{editing ? 'Cancel' : 'Edit'}</Button>
            <Button variant="danger" onClick={() => void handleDelete()}>Delete</Button>
            <Link to="/clients"><Button variant="ghost">All Clients</Button></Link>
          </div>
        }
      />

      {editing && (
        <AppCard className="p-4">
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" onSubmit={handleSave}>
            <Field label="Name" required>
              <Input required value={draft.name} onChange={(e) => setDraft(d => ({ ...d, name: e.target.value }))} />
            </Field>
            <Field label="Email">
              <Input type="email" value={draft.email ?? ''} onChange={(e) => setDraft(d => ({ ...d, email: e.target.value || null }))} />
            </Field>
            <Field label="Phone">
              <Input value={draft.phone ?? ''} onChange={(e) => setDraft(d => ({ ...d, phone: e.target.value || null }))} />
            </Field>
            <Field label="Country">
              <Select value={draft.country ?? ''} onChange={(e) => {
                const name = e.target.value
                const country = COUNTRIES.find(c => c.name === name)
                setDraft(d => ({
                  ...d,
                  country: name || null,
                  timezone: d.timezone ?? country?.timezone ?? null,
                }))
              }}>
                <option value="">Not set</option>
                {COUNTRIES.map(c => <option key={c.code} value={c.name}>{c.name}</option>)}
              </Select>
            </Field>
            <Field label="Timezone">
              <Select value={draft.timezone ?? ''} onChange={(e) => setDraft(d => ({ ...d, timezone: e.target.value || null }))}>
                <option value="">Not set</option>
                {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
              </Select>
            </Field>
            <Field label="Freelancer ID">
              <Input value={draft.freelancerId ?? ''} onChange={(e) => setDraft(d => ({ ...d, freelancerId: e.target.value || null }))} />
            </Field>
            <Field label="Upwork ID">
              <Input value={draft.upworkId ?? ''} onChange={(e) => setDraft(d => ({ ...d, upworkId: e.target.value || null }))} />
            </Field>
            <Field label="Aliases (comma-separated)">
              <Input value={draft.aliases ?? ''} onChange={(e) => setDraft(d => ({ ...d, aliases: e.target.value || null }))} />
            </Field>
            <Field label="Notes">
              <Textarea value={draft.notes ?? ''} onChange={(e) => setDraft(d => ({ ...d, notes: e.target.value || null }))} />
            </Field>
            <div className="flex items-end">
              <Button type="submit">Save</Button>
            </div>
          </form>
        </AppCard>
      )}

      {/* Contact info chips */}
      <div className="flex flex-wrap gap-2 text-sm">
        {client.email && <span className="rounded-full bg-[var(--bg-surface)] px-3 py-1 text-[var(--text-secondary)]">{client.email}</span>}
        {client.phone && <span className="rounded-full bg-[var(--bg-surface)] px-3 py-1 text-[var(--text-secondary)]">{client.phone}</span>}
        {client.timezone && <ClientClock timezone={client.timezone} />}
        {client.freelancerId && <span className="rounded-full bg-[var(--bg-surface)] px-3 py-1 text-[var(--text-secondary)]">Freelancer: {client.freelancerId}</span>}
        {client.upworkId && <span className="rounded-full bg-[var(--bg-surface)] px-3 py-1 text-[var(--text-secondary)]">Upwork: {client.upworkId}</span>}
      </div>

      {client.notes && (
        <AppCard className="p-4 text-sm text-[var(--text-secondary)]">{client.notes}</AppCard>
      )}

      {/* Projects */}
      <AppCard>
        <SectionHeading title="Projects" description={`${client.projects.length} total`} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-faint)] text-left">
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Project</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Status</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Platform</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Awarded</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Milestones</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Pipeline</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Outstanding</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Paid</th>
              </tr>
            </thead>
            <tbody>
              {client.projects.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8">
                  <EmptyState title="No projects" description="Link projects to this client." />
                </td></tr>
              ) : client.projects.map((p) => {
                const pipelineGross = p.milestones.reduce((s, m) => s + m.amount, 0) + p.tips.reduce((s, t) => s + t.amount, 0)
                const paidGross = p.milestones.filter(m => m.status === 'Paid').reduce((s, m) => s + m.amount, 0) + p.tips.reduce((s, t) => s + t.amount, 0)
                const outstandingGross = pipelineGross - paidGross
                return (
                  <tr key={p.id} className="border-b border-[var(--border-faint)] last:border-0 transition-colors hover:bg-[var(--bg-elevated)]">
                    <td className="px-4 py-3">
                      <Link to={`/projects/${p.id}`} className="font-medium text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors">{p.projectName}</Link>
                    </td>
                    <td className="px-4 py-3"><ProjectStatusBadge status={p.status} /></td>
                    <td className="px-4 py-3 text-xs text-[var(--text-tertiary)]">{p.platform?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{formatDate(p.dateAwarded)}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-[var(--text-secondary)]">
                      {p.milestones.filter(m => m.status === 'Paid').length}/{p.milestones.length}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-[var(--text-primary)]">
                      <MoneyAmount amount={pipelineGross} currency={p.currency} />
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-[var(--text-primary)]">
                      <MoneyAmount amount={outstandingGross} currency={p.currency} />
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums font-medium text-[var(--paid)]">
                      <MoneyAmount amount={paidGross} currency={p.currency} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {client.projects.length > 0 && (() => {
              const byCurrency = new Map<string, { pipeline: number; outstanding: number; paid: number }>()
              for (const p of client.projects) {
                const cur = p.currency
                const pipelineGross = p.milestones.reduce((s, m) => s + m.amount, 0) + p.tips.reduce((s, t) => s + t.amount, 0)
                const paidGross = p.milestones.filter(m => m.status === 'Paid').reduce((s, m) => s + m.amount, 0) + p.tips.reduce((s, t) => s + t.amount, 0)
                const outstandingGross = pipelineGross - paidGross
                const existing = byCurrency.get(cur) ?? { pipeline: 0, outstanding: 0, paid: 0 }
                byCurrency.set(cur, {
                  pipeline: existing.pipeline + pipelineGross,
                  outstanding: existing.outstanding + outstandingGross,
                  paid: existing.paid + paidGross,
                })
              }
              return (
                <tfoot>
                  {[...byCurrency.entries()].map(([currency, totals]) => (
                    <tr key={currency} className="border-t-2 border-[var(--border-default)] bg-[var(--bg-surface)]">
                      <td className="px-4 py-2.5 text-xs font-semibold text-[var(--text-secondary)]">
                        {byCurrency.size > 1 ? `Total (${currency})` : 'Total'}
                      </td>
                      <td colSpan={4} />
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums font-semibold text-[var(--text-primary)]">
                        <MoneyAmount amount={totals.pipeline} currency={currency} />
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums font-semibold text-[var(--text-primary)]">
                        <MoneyAmount amount={totals.outstanding} currency={currency} />
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums font-semibold text-[var(--paid)]">
                        <MoneyAmount amount={totals.paid} currency={currency} />
                      </td>
                    </tr>
                  ))}
                </tfoot>
              )
            })()}
          </table>
        </div>
      </AppCard>
    </div>
  )
}

export default function Clients() {
  const { id } = useParams<{ id?: string }>()
  return id ? <ClientDetail /> : <ClientList />
}
