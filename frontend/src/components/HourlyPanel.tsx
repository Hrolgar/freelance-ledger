import { useEffect, useState, type ReactNode } from 'react'
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
  patchMilestone,
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

// --- Shared table classes, matching the rest of the app. Every other page builds its
// tables this way; the hourly panel had its own smaller padding and a border token
// that does not exist (--border), so its rows sat flush against the card edge with no
// rules between them. ---
const TH = 'px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]'
const TH_RIGHT = `${TH} text-right`
const TR = 'border-b border-[var(--border-faint)] last:border-0 transition-colors hover:bg-[var(--bg-elevated)]'
const TD = 'px-4 py-3'
const TD_NUM = 'px-4 py-3 text-right font-mono tabular-nums'

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
  const [notice, setNotice] = useState<string | null>(null)
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
    invoiceDate: todayIso(),
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

  // What the server would actually sweep for the range in the modal: same overlap rule
  // it uses. Shown live so you are not guessing what "Create" is about to bill.
  const sweep = unbilled.filter(
    (e) =>
      (!invoiceDraft.to || e.periodStart <= invoiceDraft.to) &&
      (!invoiceDraft.from || e.periodEnd >= invoiceDraft.from),
  )
  const sweepHours = sweep.reduce((sum, e) => sum + e.hours, 0)
  const sweepValue = sweep.reduce((sum, e) => sum + e.hours * e.rateApplied, 0)

  /// The due date the server will pick if the field is left blank: the client's pay day
  /// in the month after the last period covered.
  const suggestedDue = (): string => {
    const day = project.paymentDueDayOfMonth
    if (!day || sweep.length === 0) return ''
    const last = sweep.reduce((a, e) => (e.periodEnd > a ? e.periodEnd : a), sweep[0].periodEnd)
    const [y, m] = last.split('-').map(Number)
    const month = new Date(y, m, 1) // month index m == the month AFTER `last`
    const inMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
    const d = new Date(month.getFullYear(), month.getMonth(), Math.min(day, inMonth))
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
  }

  const openInvoiceModal = () => {
    // Default the range to everything currently unbilled, which is the common case.
    const from = unbilled.length ? unbilled[0].periodStart : ''
    const to = unbilled.length ? unbilled[unbilled.length - 1].periodEnd : ''
    setInvoiceDraft({
      from,
      to,
      invoiceNumber: '',
      invoiceDate: todayIso(),
      dateDue: '',
      description: project.invoiceWorkDescription ?? '',
    })
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

  const markInvoicePaid = (invoice: Milestone) =>
    run(() =>
      patchMilestone(invoice.id, {
        status: 'Paid',
        datePaid: invoice.datePaid ?? todayIso(),
        dateDue: invoice.dateDue ?? todayIso(),
      }),
    )

  return (
    <div className="space-y-4">
      {error && (
        <div
          className="rounded-md px-4 py-3 text-sm"
          style={{ border: '1px solid #c9726430', background: '#c9726410', color: 'var(--overdue)' }}
        >
          {error}
        </div>
      )}
      {notice && (
        <div
          className="rounded-md px-4 py-3 text-sm"
          style={{ border: '1px solid var(--border-faint)', background: 'var(--accent-soft)', color: 'var(--accent)' }}
        >
          {notice}
        </div>
      )}

      {/* --- Rates --- */}
      <AppCard>
        <SectionHeading
          title="Hourly rate"
          description="Raising the rate adds a row. Periods already logged keep the rate they were logged at."
          action={
            <Button variant="secondary" className="text-xs" onClick={() => {
              setRateDraft({
                rate: currentRate?.rate ?? 0,
                currency: currentRate?.currency ?? project.currency,
                effectiveFrom: todayIso(),
                notes: '',
              })
              setShowRateModal(true)
            }}>
              + Add rate
            </Button>
          }
        />
        {loading ? (
          <p className="px-4 py-6 text-sm" style={{ color: 'var(--text-secondary)' }}>Loading…</p>
        ) : rates.length === 0 ? (
          <div className="p-4">
            <EmptyState title="No rate set" description="Add an hourly rate before logging any time." />
          </div>
        ) : (
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-faint)] text-left">
                  <th className={TH}>Effective from</th>
                  <th className={TH_RIGHT}>Rate</th>
                  <th className={TH}>Notes</th>
                  <th className={TH} />
                </tr>
              </thead>
              <tbody>
                {rates.map((rate) => (
                  <tr key={rate.id} className={TR}>
                    <td className={`${TD} text-[var(--text-primary)]`}>
                      {formatDate(rate.effectiveFrom)}
                      {currentRate?.id === rate.id && (
                        <span
                          className="ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                          style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                        >
                          Current
                        </span>
                      )}
                    </td>
                    <td className={`${TD_NUM} text-[var(--text-primary)]`}>
                      {formatCurrency(rate.rate, rate.currency)}
                      <span className="text-[var(--text-tertiary)]"> /h</span>
                    </td>
                    <td className={`${TD} text-xs text-[var(--text-tertiary)]`}>{rate.notes ?? '—'}</td>
                    <td className={TD}>
                      <div className="flex justify-end">
                        <Button
                          variant="danger"
                          className="px-2 text-xs"
                          disabled={busy}
                          onClick={() => {
                            if (!confirm(`Delete the rate effective ${formatDate(rate.effectiveFrom)}?`)) return
                            void run(() => deleteProjectRate(project.id, rate.id))
                          }}
                        >
                          Del
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && rates.length > 0 && (
          <ul className="flex flex-col gap-2 p-4 lg:hidden">
            {rates.map((rate) => (
              <RowCard
                key={rate.id}
                title={formatDate(rate.effectiveFrom)}
                subtitle={rate.notes}
                amount={<>{formatCurrency(rate.rate, rate.currency)} /h</>}
                badge={currentRate?.id === rate.id ? (
                  <span
                    className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                    style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                  >
                    Current
                  </span>
                ) : undefined}
                actions={
                  <Button
                    variant="danger"
                    className="min-h-11 px-4 text-xs"
                    disabled={busy}
                    onClick={() => {
                      if (!confirm(`Delete the rate effective ${formatDate(rate.effectiveFrom)}?`)) return
                      void run(() => deleteProjectRate(project.id, rate.id))
                    }}
                  >
                    Del
                  </Button>
                }
              />
            ))}
          </ul>
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
            <div className="flex items-center gap-2">
              {project.cadence !== 'None' && (
                <Button variant="secondary" className="text-xs" onClick={() => setShowGenerateModal(true)}>
                  Generate
                </Button>
              )}
              <Button variant="secondary" className="text-xs" onClick={openNewEntry}>+ Log hours</Button>
            </div>
          }
        />

        {!loading && unbilled.length > 0 && (
          <div
            className="m-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg px-4 py-3 text-sm"
            style={{ border: '1px solid var(--border-faint)', background: 'var(--bg-elevated)' }}
          >
            <span style={{ color: 'var(--text-secondary)' }}>
              Unbilled{' '}
              <span className="font-mono tabular-nums font-semibold text-[var(--text-primary)]">
                {hoursLabel(unbilledHours)}h
              </span>
            </span>
            <span style={{ color: 'var(--text-secondary)' }}>
              Worth{' '}
              <span className="font-mono tabular-nums font-semibold" style={{ color: 'var(--accent)' }}>
                {formatCurrency(unbilledValue, unbilled[0].currency)}
              </span>
            </span>
            <Button className="ml-auto text-xs" onClick={openInvoiceModal}>Create invoice</Button>
          </div>
        )}

        {loading ? (
          <p className="px-4 py-6 text-sm" style={{ color: 'var(--text-secondary)' }}>Loading…</p>
        ) : entries.length === 0 ? (
          <div className="p-4">
            <EmptyState title="Nothing logged yet" description="Log a period, or generate them from the committed hours." />
          </div>
        ) : (
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-faint)] text-left">
                  <th className={TH}>Period</th>
                  <th className={TH_RIGHT}>Hours</th>
                  <th className={TH_RIGHT}>Rate</th>
                  <th className={TH_RIGHT}>Amount</th>
                  <th className={TH}>Status</th>
                  <th className={TH} />
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className={TR}>
                    <td className={`${TD} text-[var(--text-primary)]`}>
                      {periodLabel(entry)}
                      {entry.notes && (
                        <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">{entry.notes}</p>
                      )}
                    </td>
                    <td className={`${TD_NUM} text-[var(--text-primary)]`}>{hoursLabel(entry.hours)}</td>
                    <td className={`${TD_NUM} text-[var(--text-secondary)]`}>
                      {formatCurrency(entry.rateApplied, entry.currency)}
                    </td>
                    <td className={`${TD_NUM} text-[var(--text-primary)]`}>
                      {formatCurrency(entry.hours * entry.rateApplied, entry.currency)}
                    </td>
                    <td className={TD}>
                      {entry.invoiceMilestoneId ? (
                        <span
                          className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                          style={{ border: '1px solid var(--border-default)', color: 'var(--text-tertiary)' }}
                        >
                          Invoiced
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                          style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                        >
                          Unbilled
                        </span>
                      )}
                    </td>
                    <td className={TD}>
                      <div className="flex justify-end gap-1">
                        {!entry.invoiceMilestoneId && (
                          <>
                            <Button variant="ghost" className="px-2 text-xs" onClick={() => openEditEntry(entry)}>
                              Edit
                            </Button>
                            <Button
                              variant="danger"
                              className="px-2 text-xs"
                              disabled={busy}
                              onClick={() => {
                                if (!confirm(`Delete ${periodLabel(entry)}?`)) return
                                void run(() => deleteTimeEntry(project.id, entry.id))
                              }}
                            >
                              Del
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && entries.length > 0 && (
          <ul className="flex flex-col gap-2 p-4 lg:hidden">
            {entries.map((entry) => (
              <RowCard
                key={entry.id}
                title={periodLabel(entry)}
                subtitle={entry.notes}
                amount={formatCurrency(entry.hours * entry.rateApplied, entry.currency)}
                badge={entry.invoiceMilestoneId ? (
                  <span
                    className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                    style={{ border: '1px solid var(--border-default)', color: 'var(--text-tertiary)' }}
                  >
                    Invoiced
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                    style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                  >
                    Unbilled
                  </span>
                )}
                facts={[
                  ['Hours', <span className="font-mono tabular-nums">{hoursLabel(entry.hours)}</span>],
                  ['Rate', <span className="font-mono tabular-nums">{formatCurrency(entry.rateApplied, entry.currency)}</span>],
                ]}
                actions={entry.invoiceMilestoneId ? undefined : (
                  <>
                    <Button variant="ghost" className="min-h-11 px-4 text-xs" onClick={() => openEditEntry(entry)}>
                      Edit
                    </Button>
                    <Button
                      variant="danger"
                      className="min-h-11 px-4 text-xs"
                      disabled={busy}
                      onClick={() => {
                        if (!confirm(`Delete ${periodLabel(entry)}?`)) return
                        void run(() => deleteTimeEntry(project.id, entry.id))
                      }}
                    >
                      Del
                    </Button>
                  </>
                )}
              />
            ))}
          </ul>
        )}
      </AppCard>

      {/* --- Invoices --- */}
      <AppCard>
        <SectionHeading
          title="Invoices"
          description="An invoice is a milestone, so it counts as revenue the moment it is paid. A PDF is filed under Files as soon as it is raised."
          action={
            <Button className="text-xs" onClick={openInvoiceModal} disabled={unbilled.length === 0}>
              + New invoice
            </Button>
          }
        />
        {loading ? (
          <p className="px-4 py-6 text-sm" style={{ color: 'var(--text-secondary)' }}>Loading…</p>
        ) : invoices.length === 0 ? (
          <div className="p-4">
            <EmptyState title="No invoices yet" description="Log some hours, then raise one for any date range." />
          </div>
        ) : (
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-faint)] text-left">
                  <th className={TH}>Number</th>
                  <th className={TH}>Period</th>
                  <th className={TH_RIGHT}>Hours</th>
                  <th className={TH_RIGHT}>Amount</th>
                  <th className={TH}>Status</th>
                  <th className={TH}>Due</th>
                  <th className={TH} />
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className={TR}>
                    <td className={`${TD} font-mono font-medium text-[var(--text-primary)]`}>
                      {inv.invoiceNumber}
                    </td>
                    <td className={`${TD} text-xs text-[var(--text-secondary)]`}>
                      {formatDate(inv.periodStart)} to {formatDate(inv.periodEnd)}
                    </td>
                    <td className={`${TD_NUM} text-[var(--text-primary)]`}>
                      {inv.hours === null ? '—' : hoursLabel(inv.hours)}
                    </td>
                    <td className={`${TD_NUM} text-[var(--text-primary)]`}>
                      {formatCurrency(inv.amount, inv.currency)}
                    </td>
                    <td className={TD}><MilestoneStatusBadge status={inv.status} /></td>
                    <td className={`${TD} text-xs text-[var(--text-secondary)]`}>{formatDate(inv.dateDue)}</td>
                    <td className={TD}>
                      <div className="flex justify-end gap-1">
                        {inv.status !== 'Paid' && (
                          <Button
                            variant="ghost"
                            className="px-2 text-xs"
                            style={{ color: 'var(--paid)' }}
                            disabled={busy}
                            onClick={() => void markInvoicePaid(inv)}
                          >
                            Mark Paid
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          className="px-2 text-xs"
                          style={{ color: 'var(--accent)' }}
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
                        </Button>
                        <Button
                          variant="ghost"
                          className="px-2 text-xs"
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
                          MD
                        </Button>
                        {inv.status !== 'Paid' && (
                          <Button
                            variant="danger"
                            className="px-2 text-xs"
                            disabled={busy}
                            onClick={() => {
                              if (!confirm(`Delete ${inv.invoiceNumber}? Its periods go back to unbilled and the filed PDF is removed.`)) return
                              void run(() => deleteInvoice(project.id, inv.id))
                            }}
                          >
                            Del
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && invoices.length > 0 && (
          <ul className="flex flex-col gap-2 p-4 lg:hidden">
            {invoices.map((inv) => (
              <RowCard
                key={inv.id}
                title={inv.invoiceNumber ?? ''}
                subtitle={`${formatDate(inv.periodStart)} to ${formatDate(inv.periodEnd)}`}
                amount={formatCurrency(inv.amount, inv.currency)}
                badge={<MilestoneStatusBadge status={inv.status} />}
                facts={[
                  ['Hours', <span className="font-mono tabular-nums">{inv.hours === null ? '—' : hoursLabel(inv.hours)}</span>],
                  ['Due', formatDate(inv.dateDue)],
                ]}
                actions={
                  <>
                    {inv.status !== 'Paid' && (
                      <Button
                        variant="ghost"
                        className="min-h-11 px-4 text-xs"
                        style={{ color: 'var(--paid)' }}
                        disabled={busy}
                        onClick={() => void markInvoicePaid(inv)}
                      >
                        Mark Paid
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      className="min-h-11 px-4 text-xs"
                      style={{ color: 'var(--accent)' }}
                      disabled={busy}
                      onClick={() => {
                        setError(null)
                        void downloadInvoice(project.id, inv.id, 'pdf', `Invoice-${inv.invoiceNumber}.pdf`)
                          .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Download failed'))
                      }}
                    >
                      PDF
                    </Button>
                    {inv.status !== 'Paid' && (
                      <Button
                        variant="danger"
                        className="min-h-11 px-4 text-xs"
                        disabled={busy}
                        onClick={() => {
                          if (!confirm(`Delete ${inv.invoiceNumber}? Its periods go back to unbilled and the filed PDF is removed.`)) return
                          void run(() => deleteInvoice(project.id, inv.id))
                        }}
                      >
                        Del
                      </Button>
                    )}
                  </>
                }
              />
            ))}
          </ul>
        )}
      </AppCard>

      {/* --- Rate modal --- */}
      {showRateModal && (
      <Modal title="Add rate" onClose={() => setShowRateModal(false)}>
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
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
          </div>
          <Field label="Effective from" hint="Periods starting on or after this date use the new rate.">
            <Input
              type="date" value={rateDraft.effectiveFrom}
              onChange={(e) => setRateDraft({ ...rateDraft, effectiveFrom: e.target.value })}
            />
          </Field>
          <Field label="Notes">
            <Input
              value={rateDraft.notes}
              placeholder="Agreed in the SOW"
              onChange={(e) => setRateDraft({ ...rateDraft, notes: e.target.value })}
            />
          </Field>
          <ModalActions
            onCancel={() => setShowRateModal(false)}
            confirmLabel="Save rate"
            busy={busy}
            disabled={rateDraft.rate <= 0}
            onConfirm={async () => {
              const ok = await run(() => createProjectRate(project.id, {
                rate: rateDraft.rate,
                currency: rateDraft.currency,
                effectiveFrom: rateDraft.effectiveFrom,
                notes: rateDraft.notes || null,
              }))
              if (ok) setShowRateModal(false)
            }}
          />
        </div>
      </Modal>
      )}

      {/* --- Time entry modal --- */}
      {showEntryModal && (
      <Modal
        title={editingEntryId ? 'Edit period' : 'Log hours'}
        onClose={() => setShowEntryModal(false)}
      >
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Period start"
              hint={project.cadence === 'Weekly' ? 'Snaps to the Monday of that week.' : undefined}
            >
              <Input
                type="date" value={entryDraft.periodStart}
                onChange={(e) => setEntryDraft({ ...entryDraft, periodStart: e.target.value })}
              />
            </Field>
            <Field label="Period end" hint={project.cadence !== 'None' ? 'Blank uses the whole period.' : undefined}>
              <Input
                type="date" value={entryDraft.periodEnd}
                onChange={(e) => setEntryDraft({ ...entryDraft, periodEnd: e.target.value })}
              />
            </Field>
          </div>
          <Field
            label="Hours"
            hint={currentRate ? `Bills at ${formatCurrency(currentRate.rate, currentRate.currency)} an hour.` : 'No rate set yet.'}
          >
            <Input
              type="number" step="0.25" min="0" value={entryDraft.hours}
              onChange={(e) => setEntryDraft({ ...entryDraft, hours: Number(e.target.value) })}
            />
          </Field>
          <Field label="Notes">
            <Textarea
              rows={2} value={entryDraft.notes}
              onChange={(e) => setEntryDraft({ ...entryDraft, notes: e.target.value })}
            />
          </Field>
          <ModalActions
            onCancel={() => setShowEntryModal(false)}
            confirmLabel={editingEntryId ? 'Update' : 'Log'}
            busy={busy}
            disabled={entryDraft.hours <= 0}
            onConfirm={async () => {
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
          />
        </div>
      </Modal>
      )}

      {/* --- Generate modal --- */}
      {showGenerateModal && (
      <Modal title="Generate periods" onClose={() => setShowGenerateModal(false)}>
        <div className="grid gap-3">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Fills in every {project.cadence === 'Monthly' ? 'month' : 'week'} between these dates at the
            committed hours, skipping any already logged.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="From">
              <Input type="date" value={genDraft.from} onChange={(e) => setGenDraft({ ...genDraft, from: e.target.value })} />
            </Field>
            <Field label="To">
              <Input type="date" value={genDraft.to} onChange={(e) => setGenDraft({ ...genDraft, to: e.target.value })} />
            </Field>
          </div>
          <Field label="Hours per period" hint={project.committedHours ? `Blank uses ${hoursLabel(project.committedHours)}h.` : 'Set this or the project committed hours.'}>
            <Input
              type="number" step="0.25" min="0" value={genDraft.hours}
              placeholder={project.committedHours ? String(project.committedHours) : ''}
              onChange={(e) => setGenDraft({ ...genDraft, hours: e.target.value })}
            />
          </Field>
          <Field label="Notes">
            <Input value={genDraft.notes} onChange={(e) => setGenDraft({ ...genDraft, notes: e.target.value })} />
          </Field>
          <ModalActions
            onCancel={() => setShowGenerateModal(false)}
            confirmLabel="Generate"
            busy={busy}
            onConfirm={async () => {
              const ok = await run(() => generateTimeEntries(project.id, {
                from: genDraft.from,
                to: genDraft.to,
                hours: genDraft.hours ? Number(genDraft.hours) : null,
                notes: genDraft.notes || null,
              }))
              if (ok) setShowGenerateModal(false)
            }}
          />
        </div>
      </Modal>
      )}

      {/* --- Invoice modal --- */}
      {showInvoiceModal && (
      <Modal title="Create invoice" onClose={() => setShowInvoiceModal(false)} size="lg">
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {/* No hint under these two: the preview below spells out exactly what the
                range catches, and a wrapping hint under one of a pair of date fields
                pushes them out of line with each other. */}
            <Field label="Cover work from">
              <Input type="date" value={invoiceDraft.from} onChange={(e) => setInvoiceDraft({ ...invoiceDraft, from: e.target.value })} />
            </Field>
            <Field label="To">
              <Input type="date" value={invoiceDraft.to} onChange={(e) => setInvoiceDraft({ ...invoiceDraft, to: e.target.value })} />
            </Field>
          </div>

          {/* Exactly what Create is about to bill, so the range is checkable before it
              is committed rather than after the invoice number has been burned. */}
          <div
            className="rounded-lg px-4 py-3"
            style={{ border: '1px solid var(--border-faint)', background: 'var(--bg-base)' }}
          >
            {sweep.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--overdue)' }}>
                No unbilled periods in that range. Widen it, or log the hours first.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {sweep.length} period{sweep.length === 1 ? '' : 's'}
                  </span>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    <span className="font-mono tabular-nums font-semibold text-[var(--text-primary)]">
                      {hoursLabel(sweepHours)}h
                    </span>
                  </span>
                  <span className="ml-auto font-mono tabular-nums text-base font-semibold" style={{ color: 'var(--accent)' }}>
                    {formatCurrency(sweepValue, sweep[0].currency)}
                  </span>
                </div>
                <ul className="mt-2 space-y-0.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {sweep.slice(0, 6).map((e) => (
                    <li key={e.id} className="flex justify-between gap-4">
                      <span>{periodLabel(e)}</span>
                      <span className="font-mono tabular-nums">{hoursLabel(e.hours)}h</span>
                    </li>
                  ))}
                  {sweep.length > 6 && <li>and {sweep.length - 6} more</li>}
                </ul>
              </>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field
              label="Invoice number"
              hint={project.invoicePrefix ? `Blank numbers it ${project.invoicePrefix.toUpperCase()}-YYYY-NNN.` : 'Blank numbers it automatically.'}
            >
              <Input
                value={invoiceDraft.invoiceNumber}
                placeholder="auto"
                onChange={(e) => setInvoiceDraft({ ...invoiceDraft, invoiceNumber: e.target.value })}
              />
            </Field>
            <Field label="Invoice date" hint="Printed on the document.">
              <Input type="date" value={invoiceDraft.invoiceDate} onChange={(e) => setInvoiceDraft({ ...invoiceDraft, invoiceDate: e.target.value })} />
            </Field>
            <Field
              label="Due date"
              hint={
                invoiceDraft.dateDue || !suggestedDue()
                  ? 'Yours, not theirs. Never printed on the invoice.'
                  : `Blank uses ${formatDate(suggestedDue())}. Never printed on the invoice.`
              }
            >
              <Input type="date" value={invoiceDraft.dateDue} onChange={(e) => setInvoiceDraft({ ...invoiceDraft, dateDue: e.target.value })} />
            </Field>
          </div>

          <Field label="Work performed" hint="Printed above the table. Prefilled from the project's invoicing details.">
            <Textarea
              rows={3} value={invoiceDraft.description}
              onChange={(e) => setInvoiceDraft({ ...invoiceDraft, description: e.target.value })}
            />
          </Field>

          <ModalActions
            onCancel={() => setShowInvoiceModal(false)}
            confirmLabel={sweep.length === 0 ? 'Create' : `Create for ${formatCurrency(sweepValue, sweep[0].currency)}`}
            busy={busy}
            disabled={!invoiceDraft.from || !invoiceDraft.to || sweep.length === 0}
            onConfirm={async () => {
              setNotice(null)
              const ok = await run(() => createInvoice(project.id, {
                from: invoiceDraft.from,
                to: invoiceDraft.to,
                invoiceNumber: invoiceDraft.invoiceNumber || null,
                invoiceDate: invoiceDraft.invoiceDate || null,
                dateDue: invoiceDraft.dateDue || null,
                description: invoiceDraft.description || null,
              }))
              if (ok) {
                setShowInvoiceModal(false)
                setNotice('Invoice raised. The PDF is filed under Files further down this page.')
                setTimeout(() => setNotice(null), 6000)
              }
            }}
          />
        </div>
      </Modal>
      )}
    </div>
  )
}

/// One row of a table, as a card, for phone widths. The three tables here differ only
/// in which fields they show, so they share this shell: title line, an amount on the
/// right, a badge row, a small definition grid, then the actions.
function RowCard({
  title,
  subtitle,
  amount,
  badge,
  facts,
  actions,
}: {
  title: string
  subtitle?: string | null
  amount?: ReactNode
  badge?: ReactNode
  facts?: Array<[string, ReactNode]>
  actions?: ReactNode
}) {
  return (
    <li
      className="rounded-lg p-4"
      style={{ border: '1px solid var(--border-faint)', background: 'var(--bg-elevated)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{title}</p>
          {subtitle && (
            <p className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>{subtitle}</p>
          )}
        </div>
        {amount && (
          <div
            className="shrink-0 text-right font-mono text-sm font-semibold tabular-nums"
            style={{ color: 'var(--text-primary)' }}
          >
            {amount}
          </div>
        )}
      </div>
      {badge && <div className="mt-3 flex flex-wrap items-center gap-1.5">{badge}</div>}
      {facts && facts.length > 0 && (
        <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt className="uppercase tracking-[0.12em]" style={{ color: 'var(--text-tertiary)' }}>
                {label}
              </dt>
              <dd className="mt-1" style={{ color: 'var(--text-secondary)' }}>{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {actions && <div className="mt-4 flex flex-wrap justify-end gap-2">{actions}</div>}
    </li>
  )
}

/// The footer every modal on this page shares: sticks to the bottom on a phone, where
/// the form scrolls, and sits inline on a desktop. Copied from the milestone and tip
/// modals so all five behave the same way.
function ModalActions({
  onCancel,
  onConfirm,
  confirmLabel,
  busy,
  disabled,
}: {
  onCancel: () => void
  onConfirm: () => void | Promise<void>
  confirmLabel: string
  busy?: boolean
  disabled?: boolean
}) {
  return (
    <div className="sticky bottom-0 -mx-6 mt-2 flex justify-end gap-2 border-t border-[var(--border-faint)] bg-[var(--bg-elevated)] px-6 py-4 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0">
      <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
      <Button type="button" disabled={busy || disabled} onClick={() => void onConfirm()}>
        {busy ? 'Saving…' : confirmLabel}
      </Button>
    </div>
  )
}
