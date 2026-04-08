import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { getClients, getClient, createClient, updateClient, deleteClient } from '../api'
import { AppCard, Button, EmptyState, ErrorState, Field, Input, PageIntro, SectionHeading, Textarea } from '../components/ui'
import { ProjectStatusBadge } from '../components/StatusBadge'
import { MoneyAmount } from '../components/MoneyAmount'
import { formatCurrency, formatDate } from '../lib/format'
import type { Client, ClientInput } from '../types'
import { TIMEZONES } from '../types'

function ClientClock({ timezone }: { timezone: string }) {
  const [time, setTime] = useState('')

  useEffect(() => {
    const update = () => {
      try {
        const now = new Date()
        const timeStr = now.toLocaleTimeString('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit' })
        const dateStr = now.toLocaleDateString('en-GB', { timeZone: timezone, weekday: 'short' })
        setTime(`${dateStr} ${timeStr}`)
      } catch { setTime(timezone) }
    }
    update()
    const interval = setInterval(update, 30000)
    return () => clearInterval(interval)
  }, [timezone])

  return (
    <span className="rounded bg-slate-800 px-3 py-1.5 text-slate-300">
      <span className="text-slate-500">{timezone.split('/').pop()?.replace('_', ' ')}</span>
      <span className="ml-2 font-mono text-blue-300">{time}</span>
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
              <Input value={draft.country ?? ''} onChange={(e) => setDraft(d => ({ ...d, country: e.target.value || null }))} />
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
        <div className="text-sm text-slate-500">Loading...</div>
      ) : clients.length === 0 ? (
        <EmptyState title="No clients yet" description="Add a client to start tracking." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {clients.map((client) => {
            const paid = client.projects.flatMap(p => p.milestones).filter(m => m.status === 'Paid').reduce((s, m) => s + m.amount, 0)
            const mainCurrency = client.projects[0]?.currency ?? 'NOK'
            return (
              <Link key={client.id} to={`/clients/${client.id}`}>
                <AppCard className="p-4 transition-colors hover:border-blue-500/50">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-100">{client.name}</h3>
                      {client.aliases && (
                        <p className="mt-0.5 text-xs text-slate-500">{client.aliases}</p>
                      )}
                    </div>
                    {client.country && (
                      <span className="text-xs text-slate-500">{client.country}</span>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {client.projects.length} project{client.projects.length !== 1 ? 's' : ''}
                    {client.freelancerId && ' · Freelancer'}
                    {client.upworkId && ' · Upwork'}
                  </p>
                  <div className="mt-3 font-mono text-lg font-semibold text-slate-100">
                    {formatCurrency(paid, mainCurrency)}
                    <span className="ml-1 text-xs font-normal text-slate-500">paid</span>
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
    if (!window.confirm(`Delete client "${client?.name}"? Projects will keep their data.`)) return
    try { await deleteClient(Number(id)); navigate('/clients') }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to delete.') }
  }

  if (loading) return <div className="p-8 text-sm text-slate-500">Loading...</div>
  if (error || !client) return <ErrorState message={error ?? 'Client not found.'} />

  return (
    <div className="space-y-6">
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
              <Input value={draft.country ?? ''} onChange={(e) => setDraft(d => ({ ...d, country: e.target.value || null }))} />
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

      {/* Contact info cards */}
      <div className="flex flex-wrap gap-4 text-sm">
        {client.email && <span className="rounded bg-slate-800 px-3 py-1.5 text-slate-300">{client.email}</span>}
        {client.phone && <span className="rounded bg-slate-800 px-3 py-1.5 text-slate-300">{client.phone}</span>}
        {client.timezone && <ClientClock timezone={client.timezone} />}
        {client.freelancerId && <span className="rounded bg-slate-800 px-3 py-1.5 text-slate-400">Freelancer: {client.freelancerId}</span>}
        {client.upworkId && <span className="rounded bg-slate-800 px-3 py-1.5 text-slate-400">Upwork: {client.upworkId}</span>}
      </div>

      {client.notes && (
        <AppCard className="p-4 text-sm text-slate-400">{client.notes}</AppCard>
      )}

      {/* Projects */}
      <AppCard>
        <SectionHeading title="Projects" description={`${client.projects.length} total`} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-left">
                <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Project</th>
                <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Status</th>
                <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Platform</th>
                <th className="px-4 py-2.5 text-xs font-medium text-slate-500">Awarded</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">Milestones</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">Paid</th>
              </tr>
            </thead>
            <tbody>
              {client.projects.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8">
                  <EmptyState title="No projects" description="Link projects to this client." />
                </td></tr>
              ) : client.projects.map((p) => {
                const paid = p.milestones.filter(m => m.status === 'Paid').reduce((s, m) => s + m.amount, 0)
                return (
                  <tr key={p.id} className="border-b border-slate-700/50 last:border-0">
                    <td className="px-4 py-2.5">
                      <Link to={`/projects/${p.id}`} className="font-medium text-slate-100 hover:text-blue-400">{p.projectName}</Link>
                    </td>
                    <td className="px-4 py-2.5"><ProjectStatusBadge status={p.status} /></td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{p.platform}</td>
                    <td className="px-4 py-2.5 text-sm text-slate-400">{formatDate(p.dateAwarded)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-400">
                      {p.milestones.filter(m => m.status === 'Paid').length}/{p.milestones.length}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-medium text-slate-200">
                      <MoneyAmount amount={paid} currency={p.currency} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
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
