import { useEffect, useState } from 'react'
import {
  createInvoice,
  createProjectRate,
  deleteInvoice,
  deleteProjectRate,
  downloadInvoice,
  getInvoices,
  getProjectRates,
  getRetainerPeriods,
  patchMilestone,
  updateProjectRate,
} from '../api'
import { InvoiceList } from './InvoiceList'
import { Modal } from './Modal'
import { MilestoneStatusBadge } from './StatusBadge'
import { AppCard, Button, EmptyState, Field, Input, ModalActions, RowCard, SectionHeading, Select, Textarea } from './ui'
import { formatCurrency, formatDate, todayIso } from '../lib/format'
import type { Currency, Milestone, Project, ProjectRate, RetainerPeriod } from '../types'
import { MONTH_NAMES } from '../types'

const thisYear = new Date().getFullYear()

function periodLabel(period: RetainerPeriod): string {
  const [y, m] = period.periodStart.split('-').map(Number)
  return `${MONTH_NAMES[m - 1]} ${y}`
}

// --- Shared table classes, matching HourlyPanel and the rest of the app. ---
const TH = 'px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]'
const TH_RIGHT = `${TH} text-right`
const TR = 'border-b border-[var(--border-faint)] last:border-0 transition-colors hover:bg-[var(--bg-elevated)]'
const TD = 'px-4 py-3'
const TD_NUM = 'px-4 py-3 text-right font-mono tabular-nums'

export function RetainerPanel({
  project,
  onChanged,
}: {
  project: Project
  onChanged: () => void
}) {
  const [rates, setRates] = useState<ProjectRate[]>([])
  const [periods, setPeriods] = useState<RetainerPeriod[]>([])
  const [invoices, setInvoices] = useState<Milestone[]>([])
  const [year, setYear] = useState(new Date().getFullYear())
  const [firstMonth, setFirstMonth] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [showFeeModal, setShowFeeModal] = useState(false)
  const [editingFeeId, setEditingFeeId] = useState<number | null>(null)
  const [feeDraft, setFeeDraft] = useState({
    rate: 0,
    currency: project.currency as Currency,
    effectiveFrom: todayIso(),
    notes: '',
  })

  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [invoicePeriod, setInvoicePeriod] = useState<RetainerPeriod | null>(null)
  const [invoiceDraft, setInvoiceDraft] = useState({
    invoiceNumber: '',
    invoiceDate: todayIso(),
    dateDue: '',
    description: '',
  })

  // One calendar year at a time. A retainer that runs for years would otherwise grow an
  // unbounded list, and the months furthest down are the ones you never look at.
  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [r, p, i] = await Promise.all([
        getProjectRates(project.id),
        getRetainerPeriods(project.id, { from: `${year}-01-01`, to: `${year}-12-31` }),
        getInvoices(project.id),
      ])
      setRates(r)
      setFirstMonth(p.firstMonth)
      setPeriods(p.months)
      setInvoices(i)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load retainer data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, year])

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

  // Only used to badge the fee history list -- the Months list below never uses this,
  // it always shows the fee the SERVER resolved for that period.
  const currentFee = rates
    .filter((r) => r.effectiveFrom <= todayIso())
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0]

  const sortedPeriods = [...periods].sort((a, b) => b.periodStart.localeCompare(a.periodStart))

  const openAddFee = () => {
    setEditingFeeId(null)
    setFeeDraft({
      rate: currentFee?.rate ?? 0,
      currency: currentFee?.currency ?? project.currency,
      effectiveFrom: todayIso(),
      notes: '',
    })
    setShowFeeModal(true)
  }

  const openEditFee = (fee: ProjectRate) => {
    setEditingFeeId(fee.id)
    setFeeDraft({
      rate: fee.rate,
      currency: fee.currency,
      effectiveFrom: fee.effectiveFrom,
      notes: fee.notes ?? '',
    })
    setShowFeeModal(true)
  }

  const openRaiseInvoice = (period: RetainerPeriod) => {
    setInvoicePeriod(period)
    setInvoiceDraft({
      invoiceNumber: '',
      invoiceDate: todayIso(),
      dateDue: '',
      description: project.invoiceWorkDescription ?? '',
    })
    setShowInvoiceModal(true)
  }

  /// The due date the server will pick if the field is left blank: the client's pay day
  /// in the month after the invoiced period. Same rule HourlyPanel shows.
  const suggestedDue = (() => {
    if (!invoicePeriod) return ''
    const day = project.paymentDueDayOfMonth
    if (!day) return ''
    const [y, m] = invoicePeriod.periodEnd.split('-').map(Number)
    const month = new Date(y, m, 1) // month index m == the month AFTER periodEnd
    const inMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
    const d = new Date(month.getFullYear(), month.getMonth(), Math.min(day, inMonth))
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
  })()

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

      {/* --- Monthly fee history --- */}
      <AppCard>
        <SectionHeading
          title="Monthly fee"
          description="Raising the fee adds a row, effective from that date. Invoices already raised keep the fee they were raised at."
          action={
            <Button variant="secondary" className="text-xs" onClick={openAddFee}>
              + Add fee
            </Button>
          }
        />
        {loading ? (
          <p className="px-4 py-6 text-sm" style={{ color: 'var(--text-secondary)' }}>Loading…</p>
        ) : rates.length === 0 ? (
          <div className="p-4">
            <EmptyState title="No fee set" description="Add a monthly fee before any month can be invoiced." />
          </div>
        ) : (
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-faint)] text-left">
                  <th className={TH}>Effective from</th>
                  <th className={TH_RIGHT}>Fee</th>
                  <th className={TH}>Notes</th>
                  <th className={TH} />
                </tr>
              </thead>
              <tbody>
                {rates.map((rate) => (
                  <tr key={rate.id} className={TR}>
                    <td className={`${TD} text-[var(--text-primary)]`}>
                      {formatDate(rate.effectiveFrom)}
                      {currentFee?.id === rate.id && (
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
                      <span className="text-[var(--text-tertiary)]"> /mo</span>
                    </td>
                    <td className={`${TD} text-xs text-[var(--text-tertiary)]`}>{rate.notes ?? '—'}</td>
                    <td className={TD}>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" className="px-2 text-xs" onClick={() => openEditFee(rate)}>
                          Edit
                        </Button>
                        <Button
                          variant="danger"
                          className="px-2 text-xs"
                          disabled={busy}
                          onClick={() => {
                            if (!confirm(`Delete the fee effective ${formatDate(rate.effectiveFrom)}?`)) return
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
                amount={<>{formatCurrency(rate.rate, rate.currency)} /mo</>}
                badge={currentFee?.id === rate.id ? (
                  <span
                    className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                    style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                  >
                    Current
                  </span>
                ) : undefined}
                actions={
                  <>
                    <Button variant="ghost" className="min-h-11 px-4 text-xs" onClick={() => openEditFee(rate)}>
                      Edit
                    </Button>
                    <Button
                      variant="danger"
                      className="min-h-11 px-4 text-xs"
                      disabled={busy}
                      onClick={() => {
                        if (!confirm(`Delete the fee effective ${formatDate(rate.effectiveFrom)}?`)) return
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

      {/* --- Months --- */}
      <AppCard>
        <SectionHeading
          title="Months"
          description="One row per calendar month, with the fee the server resolved for it. Raise the invoice once the month is done."
          action={
            // Only worth a nav when there is somewhere to go. A retainer that started
            // this year has exactly one year, and arrows that cannot move are worse
            // than no arrows.
            firstMonth && Number(firstMonth.slice(0, 4)) < thisYear ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setYear((y) => y - 1)}
                  disabled={year <= Number(firstMonth.slice(0, 4))}
                  className="rounded-md px-2 py-1 text-sm transition-colors hover:bg-[var(--bg-surface)] disabled:cursor-not-allowed disabled:opacity-30"
                  style={{ color: 'var(--text-tertiary)' }}
                  aria-label="Previous year"
                >
                  ‹
                </button>
                <span className="px-2 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{year}</span>
                <button
                  onClick={() => setYear((y) => y + 1)}
                  disabled={year >= thisYear}
                  className="rounded-md px-2 py-1 text-sm transition-colors hover:bg-[var(--bg-surface)] disabled:cursor-not-allowed disabled:opacity-30"
                  style={{ color: 'var(--text-tertiary)' }}
                  aria-label="Next year"
                >
                  ›
                </button>
              </div>
            ) : undefined
          }
        />
        {loading ? (
          <p className="px-4 py-6 text-sm" style={{ color: 'var(--text-secondary)' }}>Loading…</p>
        ) : sortedPeriods.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title={firstMonth ? `Nothing in ${year}` : 'No months yet'}
              description={
                firstMonth
                  ? 'This retainer had not started yet in that year.'
                  : 'Add a monthly fee above. Months start from the fee’s effective date.'
              }
            />
          </div>
        ) : (
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-faint)] text-left">
                  <th className={TH}>Month</th>
                  <th className={TH_RIGHT}>Fee</th>
                  <th className={TH}>Invoice</th>
                  <th className={TH} />
                </tr>
              </thead>
              <tbody>
                {sortedPeriods.map((period) => (
                  <tr key={period.periodStart} className={TR}>
                    <td className={`${TD} text-[var(--text-primary)]`}>{periodLabel(period)}</td>
                    <td className={`${TD_NUM} text-[var(--text-primary)]`}>
                      {period.fee === null || period.currency === null ? (
                        <span style={{ color: 'var(--overdue)' }}>No fee set</span>
                      ) : (
                        formatCurrency(period.fee, period.currency)
                      )}
                    </td>
                    <td className={TD}>
                      {period.invoiceNumber ? (
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs text-[var(--text-primary)]">{period.invoiceNumber}</span>
                          {period.status && <MilestoneStatusBadge status={period.status} />}
                        </div>
                      ) : (
                        <span
                          className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                          style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                        >
                          Not invoiced
                        </span>
                      )}
                    </td>
                    <td className={TD}>
                      <div className="flex justify-end">
                        {!period.invoiceNumber && (
                          <Button
                            variant="secondary"
                            className="px-2 text-xs"
                            disabled={busy || period.fee === null}
                            title={period.fee === null ? 'No fee set for this month yet — add one above first.' : undefined}
                            onClick={() => openRaiseInvoice(period)}
                          >
                            Raise invoice
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
        {!loading && sortedPeriods.length > 0 && (
          <ul className="flex flex-col gap-2 p-4 lg:hidden">
            {sortedPeriods.map((period) => (
              <RowCard
                key={period.periodStart}
                title={periodLabel(period)}
                amount={period.fee === null || period.currency === null ? '—' : formatCurrency(period.fee, period.currency)}
                badge={period.invoiceNumber ? (
                  <>
                    <span className="font-mono text-xs" style={{ color: 'var(--text-primary)' }}>{period.invoiceNumber}</span>
                    {period.status && <MilestoneStatusBadge status={period.status} />}
                  </>
                ) : (
                  <span
                    className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                    style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                  >
                    Not invoiced
                  </span>
                )}
                actions={!period.invoiceNumber ? (
                  <Button
                    variant="secondary"
                    className="min-h-11 px-4 text-xs"
                    disabled={busy || period.fee === null}
                    onClick={() => openRaiseInvoice(period)}
                  >
                    {period.fee === null ? 'No fee set' : 'Raise invoice'}
                  </Button>
                ) : undefined}
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
        />
        <InvoiceList
          invoices={invoices}
          loading={loading}
          busy={busy}
          emptyTitle="No invoices yet"
          emptyDescription="Raise one for an uninvoiced month above."
          onMarkPaid={(inv) => void markInvoicePaid(inv)}
          onDownload={(inv, format) => {
            setError(null)
            const filename = format === 'pdf' ? `Invoice-${inv.invoiceNumber}.pdf` : `Invoice-${inv.invoiceNumber}.md`
            void downloadInvoice(project.id, inv.id, format, filename).catch((err: unknown) =>
              setError(err instanceof Error ? err.message : 'Download failed'),
            )
          }}
          onDelete={(inv) => {
            if (!confirm(`Delete ${inv.invoiceNumber}? Its month goes back to not invoiced and the filed PDF is removed.`)) return
            void run(() => deleteInvoice(project.id, inv.id))
          }}
        />
      </AppCard>

      {/* --- Fee modal --- */}
      {showFeeModal && (
      <Modal error={error} title={editingFeeId ? 'Edit fee' : 'Add fee'} onClose={() => setShowFeeModal(false)}>
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Monthly fee">
              <Input
                type="number" step="0.01" min="0" value={feeDraft.rate}
                onChange={(e) => setFeeDraft({ ...feeDraft, rate: Number(e.target.value) })}
              />
            </Field>
            <Field label="Currency" hint="Always the project's currency.">
              <Select value={project.currency} disabled>
                <option value={project.currency}>{project.currency}</option>
              </Select>
            </Field>
          </div>
          <Field label="Effective from" hint="Months starting on or after this date use the new fee.">
            <Input
              type="date" value={feeDraft.effectiveFrom}
              onChange={(e) => setFeeDraft({ ...feeDraft, effectiveFrom: e.target.value })}
            />
          </Field>
          <Field label="Notes">
            <Input
              value={feeDraft.notes}
              placeholder="Agreed rate increase"
              onChange={(e) => setFeeDraft({ ...feeDraft, notes: e.target.value })}
            />
          </Field>
          <ModalActions
            onCancel={() => setShowFeeModal(false)}
            confirmLabel={editingFeeId ? 'Update fee' : 'Save fee'}
            busy={busy}
            disabled={feeDraft.rate <= 0}
            onConfirm={async () => {
              const payload = {
                rate: feeDraft.rate,
                currency: feeDraft.currency,
                effectiveFrom: feeDraft.effectiveFrom,
                notes: feeDraft.notes || null,
              }
              const ok = await run(() =>
                editingFeeId
                  ? updateProjectRate(project.id, editingFeeId, payload)
                  : createProjectRate(project.id, payload),
              )
              if (ok) setShowFeeModal(false)
            }}
          />
        </div>
      </Modal>
      )}

      {/* --- Raise invoice modal --- */}
      {showInvoiceModal && invoicePeriod && (
      <Modal error={error} title={`Raise invoice — ${periodLabel(invoicePeriod)}`} onClose={() => setShowInvoiceModal(false)} size="lg">
        <div className="grid gap-3">
          <div
            className="rounded-lg px-4 py-3"
            style={{ border: '1px solid var(--border-faint)', background: 'var(--bg-base)' }}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 text-sm">
              <span style={{ color: 'var(--text-secondary)' }}>
                {formatDate(invoicePeriod.periodStart)} to {formatDate(invoicePeriod.periodEnd)}
              </span>
              <span className="font-mono tabular-nums text-base font-semibold" style={{ color: 'var(--accent)' }}>
                {invoicePeriod.fee !== null && invoicePeriod.currency
                  ? formatCurrency(invoicePeriod.fee, invoicePeriod.currency)
                  : '—'}
              </span>
            </div>
          </div>

          <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
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
                invoiceDraft.dateDue || !suggestedDue
                  ? 'Yours, not theirs. Never printed on the invoice.'
                  : `Blank uses ${formatDate(suggestedDue)}. Never printed on the invoice.`
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
            confirmLabel={
              invoicePeriod.fee !== null && invoicePeriod.currency
                ? `Raise for ${formatCurrency(invoicePeriod.fee, invoicePeriod.currency)}`
                : 'Raise invoice'
            }
            busy={busy}
            disabled={invoicePeriod.fee === null}
            onConfirm={async () => {
              setNotice(null)
              const ok = await run(() => createInvoice(project.id, {
                from: invoicePeriod.periodStart,
                to: invoicePeriod.periodEnd,
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
