import { useEffect, useMemo, useState } from 'react'
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
  updateProjectRate,
  updateTimeEntry,
} from '../api'
import { InvoiceList } from './InvoiceList'
import { Modal } from './Modal'
import { MonthSheet } from './MonthSheet'
import { categoriesOf, categoryLabel, lastDayOfMonth, monthLabel, rateFor } from '../lib/hours'
import { AppCard, Button, EmptyState, Field, Input, ModalActions, RowCard, SectionHeading, Select, Textarea } from './ui'
import { firstOfMonth, formatCurrency, formatDate, hoursLabel, todayIso } from '../lib/format'
import type { Currency, Milestone, Project, ProjectRate, TimeEntry } from '../types'
import { CURRENCIES } from '../types'

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

function periodLabel(entry: TimeEntry): string {
  return `${formatDate(entry.periodStart)} to ${formatDate(entry.periodEnd)}`
}

function monthKeyOf(dateStr: string): string {
  return dateStr.slice(0, 7)
}

type MonthStatus = 'Invoiced' | 'Unbilled' | 'Partly invoiced'

function monthStatus(list: TimeEntry[]): MonthStatus {
  const invoicedCount = list.filter((e) => e.invoiceMilestoneId !== null).length
  if (invoicedCount === 0) return 'Unbilled'
  if (invoicedCount === list.length) return 'Invoiced'
  return 'Partly invoiced'
}

function StatusBadge({ status }: { status: MonthStatus }) {
  if (status === 'Invoiced') {
    return (
      <span
        className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
        style={{ border: '1px solid var(--border-default)', color: 'var(--text-tertiary)' }}
      >
        Invoiced
      </span>
    )
  }
  if (status === 'Partly invoiced') {
    return (
      <span className="inline-flex items-center rounded border border-amber-500/40 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
        Partly invoiced
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
      style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
    >
      Unbilled
    </span>
  )
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
const STANDARD_PLACEHOLDER = 'Standard rate'

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
  const [rateEditId, setRateEditId] = useState<number | null>(null)
  const [rateDraft, setRateDraft] = useState({
    rate: 0,
    currency: project.currency as Currency,
    effectiveFrom: todayIso(),
    notes: '',
    category: '',
  })

  const [showEntryModal, setShowEntryModal] = useState(false)
  const [entryDraft, setEntryDraft] = useState({
    periodStart: todayIso(),
    periodEnd: '',
    hours: project.committedHours ?? 0,
    notes: '',
    category: '',
  })

  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [genDraft, setGenDraft] = useState({
    from: todayIso(),
    to: todayIso(),
    hours: '' as string,
    notes: '',
    category: '',
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

  const [logMonthKey, setLogMonthKey] = useState(monthKeyOf(todayIso()))
  const [openMonthKey, setOpenMonthKey] = useState<string | null>(null)

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

  /// Like `run`, but throws instead of parking the message in the panel's error
  /// banner. The month sheet shows a failure on the row it belongs to, which is
  /// behind the modal the banner would otherwise be hidden under.
  const apply = async (action: () => Promise<unknown>) => {
    setBusy(true)
    try {
      await action()
      await load()
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  const unbilled = entries.filter((e) => e.invoiceMilestoneId === null)
  const unbilledHours = unbilled.reduce((sum, e) => sum + e.hours, 0)
  const unbilledValue = unbilled.reduce((sum, e) => sum + e.hours * e.rateApplied, 0)
  const categories = useMemo(() => categoriesOf(rates), [rates])
  const hasTypes = categories.length > 0
  const typeOptions = ['', ...categories]
  /// The rate in force today, per category: the row that gets the Current badge.
  const currentRateIds = new Set(
    typeOptions
      .map((c) => rateFor(rates, c, todayIso())?.id)
      .filter((id): id is number => id !== undefined),
  )
  const currentRate = rateFor(rates, '', todayIso())

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
      category: '',
    })
    setShowEntryModal(true)
  }

  const openRateModal = (rate?: ProjectRate) => {
    setRateEditId(rate?.id ?? null)
    setRateDraft({
      rate: rate?.rate ?? currentRate?.rate ?? 0,
      currency: rate?.currency ?? currentRate?.currency ?? project.currency,
      effectiveFrom: rate?.effectiveFrom ?? todayIso(),
      notes: rate?.notes ?? '',
      category: rate?.category ?? '',
    })
    setShowRateModal(true)
  }

  const markInvoicePaid = (invoice: Milestone) =>
    run(() =>
      patchMilestone(invoice.id, {
        status: 'Paid',
        datePaid: invoice.datePaid ?? todayIso(),
        dateDue: invoice.dateDue ?? todayIso(),
      }),
    )

  const monthGroups = useMemo(() => {
    const map = new Map<string, TimeEntry[]>()
    for (const entry of entries) {
      const key = monthKeyOf(entry.periodStart)
      const list = map.get(key)
      if (list) list.push(entry)
      else map.set(key, [entry])
    }
    return [...map.entries()]
      .map(([key, list]) => ({
        key,
        label: monthLabel(key),
        entries: [...list].sort((a, b) => a.periodStart.localeCompare(b.periodStart)),
      }))
      .sort((a, b) => b.key.localeCompare(a.key))
  }, [entries])

  const openMonth = openMonthKey
    ? monthGroups.find((g) => g.key === openMonthKey) ?? { key: openMonthKey, label: monthLabel(openMonthKey), entries: [] as TimeEntry[] }
    : null

  const openMonthModal = (key: string) => setOpenMonthKey(key)

  const openInvoiceModalForMonth = (key: string) => {
    setInvoiceDraft({
      from: `${key}-01`,
      to: lastDayOfMonth(key),
      invoiceNumber: '',
      invoiceDate: todayIso(),
      dateDue: '',
      description: project.invoiceWorkDescription ?? '',
    })
    setOpenMonthKey(null)
    setShowInvoiceModal(true)
  }

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
            <Button variant="secondary" className="text-xs" onClick={() => openRateModal()}>
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
                  {hasTypes && <th className={TH}>Applies to</th>}
                  <th className={TH}>Effective from</th>
                  <th className={TH_RIGHT}>Rate</th>
                  <th className={TH}>Notes</th>
                  <th className={TH} />
                </tr>
              </thead>
              <tbody>
                {rates.map((rate) => (
                  <tr key={rate.id} className={TR}>
                    {hasTypes && (
                      <td className={`${TD} text-[var(--text-primary)]`}>{categoryLabel(rate.category)}</td>
                    )}
                    <td className={`${TD} text-[var(--text-primary)]`}>
                      {formatDate(rate.effectiveFrom)}
                      {currentRateIds.has(rate.id) && (
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
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" className="px-2 text-xs" disabled={busy} onClick={() => openRateModal(rate)}>
                          Edit
                        </Button>
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
                title={hasTypes ? `${categoryLabel(rate.category)} from ${formatDate(rate.effectiveFrom)}` : formatDate(rate.effectiveFrom)}
                subtitle={rate.notes}
                amount={<>{formatCurrency(rate.rate, rate.currency)} /h</>}
                badge={currentRateIds.has(rate.id) ? (
                  <span
                    className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                    style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                  >
                    Current
                  </span>
                ) : undefined}
                actions={
                  <>
                    <Button variant="secondary" className="min-h-11 px-4 text-xs" disabled={busy} onClick={() => openRateModal(rate)}>
                      Edit
                    </Button>
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
                  </>
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
            <div className="flex flex-wrap items-center gap-2">
              {project.cadence !== 'None' && (
                <Button variant="secondary" className="text-xs" onClick={() => setShowGenerateModal(true)}>
                  Generate
                </Button>
              )}
              <Input
                type="month"
                aria-label="Month to log hours for"
                className="h-9 w-auto text-xs"
                value={logMonthKey}
                onChange={(e) => setLogMonthKey(e.target.value || monthKeyOf(todayIso()))}
              />
              <Button className="text-xs" onClick={() => openMonthModal(logMonthKey)}>
                + Log hours
              </Button>
              <Button variant="ghost" className="text-xs" onClick={openNewEntry}>Log a period</Button>
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
        ) : monthGroups.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="Nothing logged yet"
              description="Log a period, or generate them from the committed hours."
              action={
                <Button onClick={() => openMonthModal(monthKeyOf(todayIso()))}>Log hours</Button>
              }
            />
          </div>
        ) : (
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-faint)] text-left">
                  <th className={TH}>Month</th>
                  <th className={TH_RIGHT}>Days</th>
                  <th className={TH_RIGHT}>Hours</th>
                  <th className={TH_RIGHT}>Amount</th>
                  <th className={TH}>Status</th>
                  <th className={TH} />
                </tr>
              </thead>
              <tbody>
                {monthGroups.map((group) => {
                  const hours = group.entries.reduce((sum, e) => sum + e.hours, 0)
                  const amount = group.entries.reduce((sum, e) => sum + e.hours * e.rateApplied, 0)
                  const days = new Set(group.entries.map((e) => e.periodStart)).size
                  return (
                    <tr key={group.key} className={TR}>
                      <td className={`${TD} text-[var(--text-primary)]`}>{group.label}</td>
                      <td className={`${TD_NUM} text-[var(--text-secondary)]`}>{days}</td>
                      <td className={`${TD_NUM} text-[var(--text-primary)]`}>{hoursLabel(hours)}</td>
                      <td className={`${TD_NUM} text-[var(--text-primary)]`}>
                        {formatCurrency(amount, group.entries[0].currency)}
                      </td>
                      <td className={TD}><StatusBadge status={monthStatus(group.entries)} /></td>
                      <td className={TD}>
                        <div className="flex justify-end">
                          <Button variant="secondary" className="px-2 text-xs" onClick={() => openMonthModal(group.key)}>
                            Open
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {!loading && monthGroups.length > 0 && (
          <ul className="flex flex-col gap-2 p-4 lg:hidden">
            {monthGroups.map((group) => {
              const hours = group.entries.reduce((sum, e) => sum + e.hours, 0)
              const amount = group.entries.reduce((sum, e) => sum + e.hours * e.rateApplied, 0)
              return (
                <RowCard
                  key={group.key}
                  title={group.label}
                  amount={formatCurrency(amount, group.entries[0].currency)}
                  badge={<StatusBadge status={monthStatus(group.entries)} />}
                  facts={[
                    ['Days', new Set(group.entries.map((e) => e.periodStart)).size],
                    ['Hours', <span className="font-mono tabular-nums">{hoursLabel(hours)}</span>],
                  ]}
                  actions={
                    <Button variant="secondary" className="min-h-11 px-4 text-xs" onClick={() => openMonthModal(group.key)}>
                      Open
                    </Button>
                  }
                />
              )
            })}
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
        <InvoiceList
          invoices={invoices}
          loading={loading}
          busy={busy}
          emptyTitle="No invoices yet"
          emptyDescription="Log some hours, then raise one for any date range."
          onMarkPaid={(inv) => void markInvoicePaid(inv)}
          onDownload={(inv, format) => {
            setError(null)
            const filename = format === 'pdf' ? `Invoice-${inv.invoiceNumber}.pdf` : `Invoice-${inv.invoiceNumber}.md`
            void downloadInvoice(project.id, inv.id, format, filename).catch((err: unknown) =>
              setError(err instanceof Error ? err.message : 'Download failed'),
            )
          }}
          onDelete={(inv) => {
            if (!confirm(`Delete ${inv.invoiceNumber}? Its periods go back to unbilled and the filed PDF is removed.`)) return
            void run(() => deleteInvoice(project.id, inv.id))
          }}
        />
      </AppCard>

      {/* --- Rate modal --- */}
      {showRateModal && (
      <Modal title={rateEditId === null ? 'Add rate' : 'Edit rate'} onClose={() => setShowRateModal(false)}>
        <div className="grid gap-3">
          <Field
            label="Applies to"
            hint="Blank is the standard rate. Name a second kind of work, e.g. Contracted out, to bill some hours at another rate. The name prints on the invoice when both kinds are on it."
          >
            <Input
              list="rate-categories"
              value={rateDraft.category}
              placeholder={STANDARD_PLACEHOLDER}
              onChange={(e) => setRateDraft({ ...rateDraft, category: e.target.value })}
            />
            <datalist id="rate-categories">
              {categories.map((c) => <option key={c} value={c} />)}
            </datalist>
          </Field>
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
              const input = {
                rate: rateDraft.rate,
                currency: rateDraft.currency,
                effectiveFrom: rateDraft.effectiveFrom,
                notes: rateDraft.notes || null,
                category: rateDraft.category.trim() || null,
              }
              const ok = await run(() =>
                rateEditId === null
                  ? createProjectRate(project.id, input)
                  : updateProjectRate(project.id, rateEditId, input),
              )
              if (ok) setShowRateModal(false)
            }}
          />
        </div>
      </Modal>
      )}

      {/* --- Time entry modal --- */}
      {showEntryModal && (
      <Modal
        title="Log hours"
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
            <Field label="Period end" hint={project.cadence !== 'None' ? 'Blank uses the whole period.' : 'Blank logs a single day.'}>
              <Input
                type="date" value={entryDraft.periodEnd}
                onChange={(e) => setEntryDraft({ ...entryDraft, periodEnd: e.target.value })}
              />
            </Field>
          </div>
          {hasTypes && (
            <Field label="Type of work">
              <Select value={entryDraft.category} onChange={(e) => setEntryDraft({ ...entryDraft, category: e.target.value })}>
                {typeOptions.map((c) => <option key={c} value={c}>{categoryLabel(c)}</option>)}
              </Select>
            </Field>
          )}
          <Field
            label="Hours"
            hint={(() => {
              const r = rateFor(rates, entryDraft.category, entryDraft.periodStart || todayIso())
              return r ? `Bills at ${formatCurrency(r.rate, r.currency)} an hour.` : 'No rate in force for that date.'
            })()}
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
            confirmLabel="Log"
            busy={busy}
            disabled={entryDraft.hours <= 0}
            onConfirm={async () => {
              const ok = await run(() =>
                createTimeEntry(project.id, {
                  periodStart: entryDraft.periodStart,
                  ...(entryDraft.periodEnd ? { periodEnd: entryDraft.periodEnd } : {}),
                  hours: entryDraft.hours,
                  notes: entryDraft.notes || null,
                  category: entryDraft.category || null,
                }),
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
          {hasTypes && (
            <Field label="Type of work">
              <Select value={genDraft.category} onChange={(e) => setGenDraft({ ...genDraft, category: e.target.value })}>
                {typeOptions.map((c) => <option key={c} value={c}>{categoryLabel(c)}</option>)}
              </Select>
            </Field>
          )}
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
                category: genDraft.category || null,
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

      {/* --- Month sheet --- */}
      {openMonth && (
      <Modal title="Logged hours" onClose={() => setOpenMonthKey(null)} size="2xl" tall>
        <MonthSheet
          project={project}
          monthKey={openMonth.key}
          entries={openMonth.entries}
          rates={rates}
          busy={busy}
          onMonthChange={setOpenMonthKey}
          onCreate={(input) => apply(() => createTimeEntry(project.id, input))}
          onUpdate={(id, input) => apply(() => updateTimeEntry(project.id, id, input))}
          onDelete={(id) => apply(() => deleteTimeEntry(project.id, id))}
          onInvoice={openInvoiceModalForMonth}
          onClose={() => setOpenMonthKey(null)}
        />
      </Modal>
      )}
    </div>
  )
}
