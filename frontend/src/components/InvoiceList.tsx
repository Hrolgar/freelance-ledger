import { MilestoneStatusBadge } from './StatusBadge'
import { Button, EmptyState, RowCard } from './ui'
import { VatNote } from './MoneyAmount'
import { formatCurrency, formatDate, hoursLabel } from '../lib/format'
import type { Milestone } from '../types'

// Shared table classes, matching the rest of the app.
const TH = 'px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]'
const TH_RIGHT = `${TH} text-right`
const TR = 'border-b border-[var(--border-faint)] last:border-0 transition-colors hover:bg-[var(--bg-elevated)]'
const TD = 'px-4 py-3'
const TD_NUM = 'px-4 py-3 text-right font-mono tabular-nums'

/// The invoice table + mobile cards, shared by HourlyPanel and RetainerPanel: an invoice
/// is a Milestone either way, listed, paid, downloaded and deleted the same way regardless
/// of what billing type raised it. Download and its error handling stay with the caller
/// since each panel owns its own error banner.
export function InvoiceList({
  invoices,
  loading,
  busy,
  onMarkPaid,
  onDownload,
  onDelete,
  emptyTitle,
  emptyDescription,
}: {
  invoices: Milestone[]
  loading: boolean
  busy: boolean
  onMarkPaid: (invoice: Milestone) => void
  onDownload: (invoice: Milestone, format: 'pdf' | 'markdown') => void
  onDelete: (invoice: Milestone) => void
  emptyTitle: string
  emptyDescription: string
}) {
  if (loading) {
    return <p className="px-4 py-6 text-sm" style={{ color: 'var(--text-secondary)' }}>Loading…</p>
  }

  if (invoices.length === 0) {
    return (
      <div className="p-4">
        <EmptyState title={emptyTitle} description={emptyDescription} />
      </div>
    )
  }

  return (
    <>
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
                  <VatNote vatRate={inv.vatRate} vatAmount={inv.vatAmount} totalDue={inv.totalDue} currency={inv.currency} />
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
                        onClick={() => onMarkPaid(inv)}
                      >
                        Mark Paid
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      className="px-2 text-xs"
                      style={{ color: 'var(--accent)' }}
                      disabled={busy}
                      onClick={() => onDownload(inv, 'pdf')}
                    >
                      PDF
                    </Button>
                    <Button
                      variant="ghost"
                      className="px-2 text-xs"
                      disabled={busy}
                      onClick={() => onDownload(inv, 'markdown')}
                    >
                      MD
                    </Button>
                    {inv.status !== 'Paid' && (
                      <Button variant="danger" className="px-2 text-xs" disabled={busy} onClick={() => onDelete(inv)}>
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
      <ul className="flex flex-col gap-2 p-4 lg:hidden">
        {invoices.map((inv) => (
          <RowCard
            key={inv.id}
            title={inv.invoiceNumber ?? ''}
            subtitle={`${formatDate(inv.periodStart)} to ${formatDate(inv.periodEnd)}`}
            amount={
              <>
                {formatCurrency(inv.amount, inv.currency)}
                <VatNote vatRate={inv.vatRate} vatAmount={inv.vatAmount} totalDue={inv.totalDue} currency={inv.currency} />
              </>
            }
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
                    onClick={() => onMarkPaid(inv)}
                  >
                    Mark Paid
                  </Button>
                )}
                <Button
                  variant="ghost"
                  className="min-h-11 px-4 text-xs"
                  style={{ color: 'var(--accent)' }}
                  disabled={busy}
                  onClick={() => onDownload(inv, 'pdf')}
                >
                  PDF
                </Button>
                {inv.status !== 'Paid' && (
                  <Button variant="danger" className="min-h-11 px-4 text-xs" disabled={busy} onClick={() => onDelete(inv)}>
                    Del
                  </Button>
                )}
              </>
            }
          />
        ))}
      </ul>
    </>
  )
}
