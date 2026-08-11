import { useEffect, useState } from 'react'
import {
  createInvoice,
  createProjectRate,
  createTimeEntry,
  deleteInvoice,
  deleteProjectRate,
  deleteTimeEntry,
  downloadInvoice,
  generateTimeEntries,
  getInvoices,
  getProjectRates,
  getTimeEntries,
  updateTimeEntry,
} from '../api'
import { Modal } from './Modal'
import { MilestoneStatusBadge } from './StatusBadge'
import { AppCard, Button, EmptyState, Field, Input, SectionHeading, Select, Textarea } from './ui'
import { formatCurrency, formatDate } from '../lib/format'
import type { Currency, Milestone, Project, ProjectRate, TimeEntry } from '../types'
import { CURRENCIES } from '../types'

/// Today as YYYY-MM-DD in LOCAL time.
///
/// Not `new Date().toISOString()`: that is a full timestamp, which an
/// <input type="date"> rejects outright and renders blank, and it is UTC, which
/// reads as yesterday from Norway late in the evening.
function todayIso(): string {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10)
}

/// Monday of the week containing a date, matching the server's period rule.
/// Takes and returns YYYY-MM-DD.
function mondayOf(value: string): string {
  const d = new Date(`${value}T00:00:00`)
  if (Number.isNaN(d.getTime())) return value
  const offset = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - offset)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10)
}

function firstOfMonth(value: string): string {
  return `${value.slice(0, 7)}-01`
}

function periodLabel(entry: TimeEntry): string {
  return `${formatDate(entry.periodStart)} to ${formatDate(entry.periodEnd)}`
}

function hoursLabel(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)))
}

export function HourlyPanel({
  project,
  onChanged,
}: {
  project: Project
  onChanged: () => void
}) {
  const [rates, setRates] = useState<ProjectRate[]>([])
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [invoices, setInvoices] = useState<Milestone[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [showRateModal, setShowRateModal] = useState(false)
  const [rateDraft, setRateDraft] = useState({
    rate: 0,
    currency: project.currency as Currency,
    effectiveFrom: todayIso(),
    notes: '',
  })

  const [showEntryModal, setShowEntryModal] = useState(false)
  const [editingEntryId, setEditingEntryId] = useState<number | null>(null)
  const [entryDraft, setEntryDraft] = useState({
    periodStart: todayIso(),
    periodEnd: '',
    hours: project.committedHours ?? 0,
    notes: '',
  })

  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [genDraft, setGenDraft] = useState({
    from: todayIso(),
    to: todayIso(),
    hours: '' as string,
    notes: '',
  })

  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [invoiceDraft, setInvoiceDraft] = useState({
    from: '',
    to: '',
    invoiceNumber: '',
    dateDue: '',
    description: '',
  })

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [r, e, i] = await Promise.all([
        getProjectRates(project.id),
        getTimeEntries(project.id),
        getInvoices(project.id),
      ])
      setRates(r)
      setEntries(e)
      setInvoices(i)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load hourly data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id])

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await action()
      await load()
      onChanged()
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      return false
    } finally {
      setBusy(false)
    }
  }

  const unbilled = entries.filter((e) => e.invoiceMilestoneId === null)
  const unbilledHours = unbilled.reduce((sum, e) => sum + e.hours, 0)
  const unbilledValue = unbilled.reduce((sum, e) => sum + e.hours * e.rateApplied, 0)
  const currentRate = rates
    .filter((r) => r.effectiveFrom <= todayIso())
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0]

  const openInvoiceModal = () => {
    // Default the range to everything currently unbilled, which is the common case.
    const from = unbilled.length ? unbilled[0].periodStart : ''
    const to = unbilled.length ? unbilled[unbilled.length - 1].periodEnd : ''
    setInvoiceDraft({ from, to, invoiceNumber: '', dateDue: '', description: '' })
    setShowInvoiceModal(true)
  }

  const openNewEntry = () => {
    setEditingEntryId(null)
    const today = todayIso()
    const start =
      project.cadence === 'Weekly' ? mondayOf(today)
      : project.cadence === 'Monthly' ? firstOfMonth(today)
      : today
    setEntryDraft({
      periodStart: start,
      periodEnd: '',
      hours: project.committedHours ?? 0,
      notes: '',
    })
    setShowEntryModal(true)
  }

  const openEditEntry = (entry: TimeEntry) => {
    setEditingEntryId(entry.id)
    setEntryDraft({
      periodStart: entry.periodStart,
      periodEnd: entry.periodEnd,
      hours: entry.hours,
      notes: entry.notes ?? '',
    })
    setShowEntryModal(true)
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* --- Rates --- */}
      <AppCard>
        <SectionHeading
          title="Hourly rate"
          description="Raising the rate adds a new row. Periods already logged keep the rate they were logged at."
          action={
            <Button variant="secondary" onClick={() => {
              setRateDraft({
                rate: currentRate?.rate ?? 0,
                currency: currentRate?.currency ?? project.currency,
                effectiveFrom: todayIso(),
                notes: '',
              })
              setShowRateModal(true)
            }}>
              Add rate
            </Button>
          }
        />
        {loading ? (
          <p className="text-sm text-[var(--text-secondary)]">Loading…</p>
        ) : rates.length === 0 ? (
          <EmptyState
            title="No rate set"
            description="Add an hourly rate before logging any time."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--text-secondary)]">
                  <th className="py-2 pr-4">Effective from</th>
                  <th className="py-2 pr-4">Rate</th>
                  <th className="py-2 pr-4">Notes</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {rates.map((rate) => (
                  <tr key={rate.id} className="border-b border-[var(--border)]/50">
                    <td className="py-2 pr-4">
                      {formatDate(rate.effectiveFrom)}
                      {currentRate?.id === rate.id && (
                        <span className="ml-2 rounded bg-[var(--accent)]/15 px-1.5 py-0.5 text-xs text-[var(--accent)]">
                          current
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4 font-mono">
                      {formatCurrency(rate.rate, rate.currency)} / h
                    </td>
                    <td className="py-2 pr-4 text-[var(--text-secondary)]">{rate.notes ?? '—'}</td>
                    <td className="py-2 text-right">
                      <button
                        className="text-xs text-red-400 hover:text-red-300"
                        disabled={busy}
                        onClick={() => {
                          if (!confirm(`Delete the rate effective ${formatDate(rate.effectiveFrom)}?`)) return
                          void run(() => deleteProjectRate(project.id, rate.id))
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AppCard>

      {/* --- Logged hours --- */}
      <AppCard>
        <SectionHeading
          title={project.cadence === 'Monthly' ? 'Hours by month' : project.cadence === 'Weekly' ? 'Hours by week' : 'Logged hours'}
          description={
            project.committedHours
              ? `${hoursLabel(project.committedHours)}h committed per ${project.cadence === 'Monthly' ? 'month' : 'week'}. Generate fills them in; edit any period before invoicing.`
              : 'Log a period of hours. Invoiced periods lock.'
          }
          action={
            <div className="flex gap-2">
              {project.cadence !== 'None' && (
                <Button variant="secondary" onClick={() => setShowGenerateModal(true)}>
                  Generate
                </Button>
              )}
              <Button variant="secondary" onClick={openNewEntry}>Log hours</Button>
            </div>
          }
        />

        {!loading && unbilled.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-4 rounded-lg bg-[var(--bg-surface)] px-4 py-3 text-sm">
            <span className="text-[var(--text-secondary)]">
              Unbilled: <span className="font-mono text-[var(--text-primary)]">{hoursLabel(unbilledHours)}h</span>
            </span>
            <span className="text-[var(--text-secondary)]">
              Value: <span className="font-mono text-[var(--accent)]">{formatCurrency(unbilledValue, unbilled[0].currency)}</span>
            </span>
            <button className="ml-auto text-sm text-[var(--accent)] hover:underline" onClick={openInvoiceModal}>
              Create invoice →
            </button>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-[var(--text-secondary)]">Loading…</p>
        ) : entries.length === 0 ? (
          <EmptyState title="Nothing logged yet" description="Log a period, or generate them from the committed hours." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--text-secondary)]">
                  <th className="py-2 pr-4">Period</th>
                  <th className="py-2 pr-4 text-right">Hours</th>
                  <th className="py-2 pr-4 text-right">Rate</th>
                  <th className="py-2 pr-4 text-right">Amount</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-[var(--border)]/50">
                    <td className="py-2 pr-4">{periodLabel(entry)}</td>
                    <td className="py-2 pr-4 text-right font-mono">{hoursLabel(entry.hours)}</td>
                    <td className="py-2 pr-4 text-right font-mono text-[var(--text-secondary)]">
                      {formatCurrency(entry.rateApplied, entry.currency)}
                    </td>
                    <td className="py-2 pr-4 text-right font-mono">
                      {formatCurrency(entry.hours * entry.rateApplied, entry.currency)}
                    </td>
                    <td className="py-2 pr-4">
                      {entry.invoiceMilestoneId ? (
                        <span className="text-xs text-[var(--text-secondary)]">
                          invoiced
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--accent)]">unbilled</span>
                      )}
                    </td>
                    <td className="py-2 text-right whitespace-nowrap">
                      {!entry.invoiceMilestoneId && (
                        <>
                          <button
                            className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                            onClick={() => openEditEntry(entry)}
                          >
                            Edit
                          </button>
                          <button
                            className="ml-3 text-xs text-red-400 hover:text-red-300"
                            disabled={busy}
                            onClick={() => {
                              if (!confirm(`Delete ${periodLabel(entry)}?`)) return
                              void run(() => deleteTimeEntry(project.id, entry.id))
                            }}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AppCard>

      {/* --- Invoices --- */}
      <AppCard>
        <SectionHeading
          title="Invoices"
          description="An invoice is a milestone, so it flows into revenue and the monthly P&L. Download it any time."
          action={<Button onClick={openInvoiceModal} disabled={unbilled.length === 0}>New invoice</Button>}
        />
        {loading ? (
          <p className="text-sm text-[var(--text-secondary)]">Loading…</p>
        ) : invoices.length === 0 ? (
          <EmptyState title="No invoices yet" description="Log some hours, then raise one for any date range." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--text-secondary)]">
                  <th className="py-2 pr-4">Number</th>
                  <th className="py-2 pr-4">Period</th>
                  <th className="py-2 pr-4 text-right">Hours</th>
                  <th className="py-2 pr-4 text-right">Amount</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-[var(--border)]/50">
                    <td className="py-2 pr-4 font-mono">{inv.invoiceNumber}</td>
                    <td className="py-2 pr-4">
                      {formatDate(inv.periodStart)} to {formatDate(inv.periodEnd)}
                    </td>
                    <td className="py-2 pr-4 text-right font-mono">
                      {inv.hours === null ? '—' : hoursLabel(inv.hours)}
                    </td>
                    <td className="py-2 pr-4 text-right font-mono">
                      {formatCurrency(inv.amount, inv.currency)}
                    </td>
                    <td className="py-2 pr-4"><MilestoneStatusBadge status={inv.status} /></td>
                    <td className="py-2 text-right whitespace-nowrap">
                      <button
                        className="text-xs text-[var(--accent)] hover:underline"
                        disabled={busy}
                        onClick={() => {
                          setError(null)
                          void downloadInvoice(
                            project.id, inv.id, 'pdf', `Invoice-${inv.invoiceNumber}.pdf`,
                          ).catch((err: unknown) =>
                            setError(err instanceof Error ? err.message : 'Download failed'),
                          )
                        }}
                      >
                        PDF
                      </button>
                      <button
                        className="ml-3 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        disabled={busy}
                        onClick={() => {
                          setError(null)
                          void downloadInvoice(
                            project.id, inv.id, 'markdown', `Invoice-${inv.invoiceNumber}.md`,
                          ).catch((err: unknown) =>
                            setError(err instanceof Error ? err.message : 'Download failed'),
                          )
                        }}
                      >
                        Markdown
                      </button>
                      {inv.status !== 'Paid' && (
                        <button
                          className="ml-3 text-xs text-red-400 hover:text-red-300"
                          disabled={busy}
                          onClick={() => {
                            if (!confirm(`Delete ${inv.invoiceNumber}? Its periods go back to unbilled.`)) return
                            void run(() => deleteInvoice(project.id, inv.id))
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AppCard>

      {/* --- Rate modal --- */}
      {showRateModal && (
      <Modal title="Add rate" onClose={() => setShowRateModal(false)}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Rate per hour">
            <Input
              type="number" step="0.01" min="0" value={rateDraft.rate}
              onChange={(e) => setRateDraft({ ...rateDraft, rate: Number(e.target.value) })}
            />
          </Field>
          <Field label="Currency">
            <Select
              value={rateDraft.currency}
              onChange={(e) => setRateDraft({ ...rateDraft, currency: e.target.value as Currency })}
            >
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Effective from" hint="Periods starting on or after this date use the new rate.">
            <Input
              type="date" value={rateDraft.effectiveFrom}
              onChange={(e) => setRateDraft({ ...rateDraft, effectiveFrom: e.target.value })}
            />
          </Field>
          <Field label="Notes">
            <Input
              value={rateDraft.notes}
              onChange={(e) => setRateDraft({ ...rateDraft, notes: e.target.value })}
            />
          </Field>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setShowRateModal(false)}>Cancel</Button>
          <Button
            disabled={busy || rateDraft.rate <= 0}
            onClick={async () => {
              const ok = await run(() => createProjectRate(project.id, {
                rate: rateDraft.rate,
                currency: rateDraft.currency,
                effectiveFrom: rateDraft.effectiveFrom,
                notes: rateDraft.notes || null,
              }))
              if (ok) setShowRateModal(false)
            }}
          >
            Save rate
          </Button>
        </div>
      </Modal>
      )}

      {/* --- Time entry modal --- */}
      {showEntryModal && (
      <Modal
        title={editingEntryId ? 'Edit period' : 'Log hours'}
        onClose={() => setShowEntryModal(false)}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Period start"
            hint={project.cadence === 'Weekly' ? 'Snaps to the Monday of that week.' : undefined}
          >
            <Input
              type="date" value={entryDraft.periodStart}
              onChange={(e) => setEntryDraft({ ...entryDraft, periodStart: e.target.value })}
            />
          </Field>
          <Field label="Period end" hint={project.cadence !== 'None' ? 'Leave blank to use the whole period.' : undefined}>
            <Input
              type="date" value={entryDraft.periodEnd}
              onChange={(e) => setEntryDraft({ ...entryDraft, periodEnd: e.target.value })}
            />
          </Field>
          <Field label="Hours">
            <Input
              type="number" step="0.25" min="0" value={entryDraft.hours}
              onChange={(e) => setEntryDraft({ ...entryDraft, hours: Number(e.target.value) })}
            />
          </Field>
        </div>
        <Field label="Notes">
          <Textarea
            rows={2} value={entryDraft.notes}
            onChange={(e) => setEntryDraft({ ...entryDraft, notes: e.target.value })}
          />
        </Field>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setShowEntryModal(false)}>Cancel</Button>
          <Button
            disabled={busy || entryDraft.hours <= 0}
            onClick={async () => {
              const payload = {
                periodStart: entryDraft.periodStart,
                ...(entryDraft.periodEnd ? { periodEnd: entryDraft.periodEnd } : {}),
                hours: entryDraft.hours,
                notes: entryDraft.notes || null,
              }
              const ok = await run(() =>
                editingEntryId
                  ? updateTimeEntry(project.id, editingEntryId, {
                      ...payload,
                      periodEnd: entryDraft.periodEnd || entryDraft.periodStart,
                    })
                  : createTimeEntry(project.id, payload),
              )
              if (ok) setShowEntryModal(false)
            }}
          >
            Save
          </Button>
        </div>
      </Modal>
      )}

      {/* --- Generate modal --- */}
      {showGenerateModal && (
      <Modal title="Generate periods" onClose={() => setShowGenerateModal(false)}>
        <p className="mb-4 text-sm text-[var(--text-secondary)]">
          Fills in every {project.cadence === 'Monthly' ? 'month' : 'week'} between these dates at the
          committed hours, skipping any already logged.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="From">
            <Input type="date" value={genDraft.from} onChange={(e) => setGenDraft({ ...genDraft, from: e.target.value })} />
          </Field>
          <Field label="To">
            <Input type="date" value={genDraft.to} onChange={(e) => setGenDraft({ ...genDraft, to: e.target.value })} />
          </Field>
          <Field label="Hours per period" hint={project.committedHours ? `Defaults to ${hoursLabel(project.committedHours)}h.` : 'Set this or the project committed hours.'}>
            <Input
              type="number" step="0.25" min="0" value={genDraft.hours}
              placeholder={project.committedHours ? String(project.committedHours) : ''}
              onChange={(e) => setGenDraft({ ...genDraft, hours: e.target.value })}
            />
          </Field>
          <Field label="Notes">
            <Input value={genDraft.notes} onChange={(e) => setGenDraft({ ...genDraft, notes: e.target.value })} />
          </Field>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setShowGenerateModal(false)}>Cancel</Button>
          <Button
            disabled={busy}
            onClick={async () => {
              const ok = await run(() => generateTimeEntries(project.id, {
                from: genDraft.from,
                to: genDraft.to,
                hours: genDraft.hours ? Number(genDraft.hours) : null,
                notes: genDraft.notes || null,
              }))
              if (ok) setShowGenerateModal(false)
            }}
          >
            Generate
          </Button>
        </div>
      </Modal>
      )}

      {/* --- Invoice modal --- */}
      {showInvoiceModal && (
      <Modal title="Create invoice" onClose={() => setShowInvoiceModal(false)}>
        <p className="mb-4 text-sm text-[var(--text-secondary)]">
          Sweeps every unbilled period overlapping this range into one invoice.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="From">
            <Input type="date" value={invoiceDraft.from} onChange={(e) => setInvoiceDraft({ ...invoiceDraft, from: e.target.value })} />
          </Field>
          <Field label="To">
            <Input type="date" value={invoiceDraft.to} onChange={(e) => setInvoiceDraft({ ...invoiceDraft, to: e.target.value })} />
          </Field>
          <Field
            label="Invoice number"
            hint={project.invoicePrefix ? `Blank auto-numbers as ${project.invoicePrefix}-YYYY-NNN.` : 'Blank auto-numbers it.'}
          >
            <Input
              value={invoiceDraft.invoiceNumber}
              placeholder="auto"
              onChange={(e) => setInvoiceDraft({ ...invoiceDraft, invoiceNumber: e.target.value })}
            />
          </Field>
          <Field label="Due date">
            <Input type="date" value={invoiceDraft.dateDue} onChange={(e) => setInvoiceDraft({ ...invoiceDraft, dateDue: e.target.value })} />
          </Field>
        </div>
        <Field label="Description" hint="Printed above the table on the invoice.">
          <Textarea
            rows={2} value={invoiceDraft.description}
            onChange={(e) => setInvoiceDraft({ ...invoiceDraft, description: e.target.value })}
          />
        </Field>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setShowInvoiceModal(false)}>Cancel</Button>
          <Button
            disabled={busy || !invoiceDraft.from || !invoiceDraft.to}
            onClick={async () => {
              const ok = await run(() => createInvoice(project.id, {
                from: invoiceDraft.from,
                to: invoiceDraft.to,
                invoiceNumber: invoiceDraft.invoiceNumber || null,
                dateDue: invoiceDraft.dateDue || null,
                description: invoiceDraft.description || null,
              }))
              if (ok) setShowInvoiceModal(false)
            }}
          >
            Create
          </Button>
        </div>
      </Modal>
      )}
    </div>
  )
}
