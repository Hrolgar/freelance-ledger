import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getVatSummary } from '../api'
import { MilestoneStatusBadge } from '../components/StatusBadge'
import { AppCard, EmptyState, ErrorState, LoadingState, PageIntro, SectionHeading, StatCard } from '../components/ui'
import { formatCurrency, formatDate } from '../lib/format'
import { MONTH_NAMES } from '../types'
import type { VatSummary, VatTerm } from '../types'

function terminLabel(term: VatTerm) {
  return `${term.term} · ${MONTH_NAMES[term.fromMonth - 1]}–${MONTH_NAMES[term.toMonth - 1]}`
}

function isTerminDue(term: VatTerm, year: number, today: Date): boolean {
  const termEnd = new Date(year, term.toMonth, 0)
  const deadline = new Date(term.reportingDeadline)
  return today > termEnd && today <= deadline
}

export default function Vat() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [summary, setSummary] = useState<VatSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      setSummary(await getVatSummary(year))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to load VAT summary.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [year])

  const currentTerm = year === now.getFullYear() ? Math.ceil((now.getMonth() + 1) / 2) : null

  return (
    <div>
      <PageIntro
        title="MVA"
        description="Output VAT per termin, for reporting to Skatteetaten. Invoiced is what goes on the return; collected is what has actually been paid."
        action={
          <div className="flex items-center gap-1">
            <button
              onClick={() => setYear(y => y - 1)}
              className="rounded-md px-2 py-1 text-sm transition-colors hover:bg-[var(--bg-surface)]"
              style={{ color: 'var(--text-tertiary)' }}
            >
              ‹
            </button>
            <span className="px-2 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{year}</span>
            <button
              onClick={() => setYear(y => y + 1)}
              className="rounded-md px-2 py-1 text-sm transition-colors hover:bg-[var(--bg-surface)]"
              style={{ color: 'var(--text-tertiary)' }}
            >
              ›
            </button>
          </div>
        }
      />

      {loading && <LoadingState label="Loading VAT summary" />}
      {error && <ErrorState message={error} onRetry={() => void load()} />}

      {!loading && !error && summary && (
        summary.invoices.length === 0 ? (
          <AppCard>
            <div className="p-5">
              <EmptyState
                title={`No VAT invoiced in ${year}`}
                description="Only invoices raised on projects with a VAT rate appear here."
              />
            </div>
          </AppCard>
        ) : (
          <>
            <section className="mb-8 grid gap-4 sm:grid-cols-3">
              <StatCard label="VAT invoiced" value={formatCurrency(summary.totalVatNok, 'NOK')} />
              <StatCard label="VAT collected" value={formatCurrency(summary.paidVatNok, 'NOK')} hint="paid invoices only" />
              <StatCard label="Net invoiced" value={formatCurrency(summary.totalNetNok, 'NOK')} />
            </section>

            <AppCard className="mb-8">
              <SectionHeading title="Per termin" description="Six two-month VAT reporting periods" />
              <div className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border-faint)] text-left">
                      <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Termin</th>
                      <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Invoices</th>
                      <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Net</th>
                      <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">VAT invoiced</th>
                      <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">VAT collected</th>
                      <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Deadline</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.terms.map((term) => (
                      <tr
                        key={term.term}
                        className="border-b border-[var(--border-faint)] last:border-0"
                        style={term.term === currentTerm ? { background: 'var(--accent-soft)' } : undefined}
                      >
                        <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>{terminLabel(term)}</td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums" style={{ color: 'var(--text-secondary)' }}>{term.invoiceCount}</td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(term.netNok, 'NOK')}</td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums font-medium" style={{ color: 'var(--text-primary)' }}>{formatCurrency(term.vatNok, 'NOK')}</td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(term.paidVatNok, 'NOK')}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {formatDate(term.reportingDeadline)}
                            {isTerminDue(term, summary.year, now) && (
                              <span className="inline-flex items-center rounded border border-amber-500/40 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                                Due
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </AppCard>

            <AppCard>
              <SectionHeading title="Invoices" description={`VAT invoices raised in ${year}`} />
              <div className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border-faint)] text-left">
                      <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Date</th>
                      <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Invoice</th>
                      <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Client / Project</th>
                      <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Amount</th>
                      <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Rate</th>
                      <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">VAT (NOK)</th>
                      <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.invoices.map((invoice) => (
                      <tr key={invoice.invoiceId} className="border-b border-[var(--border-faint)] last:border-0 transition-colors hover:bg-[var(--bg-elevated)]">
                        <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{formatDate(invoice.invoiceDate)}</td>
                        <td className="px-4 py-3 font-mono" style={{ color: 'var(--text-primary)' }}>{invoice.invoiceNumber}</td>
                        <td className="px-4 py-3">
                          <Link to={`/projects/${invoice.projectId}`} className="block">
                            <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{invoice.clientName}</p>
                            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{invoice.projectName}</p>
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                          {formatCurrency(invoice.amount, invoice.currency)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
                          {invoice.vatRate}%
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums font-medium" style={{ color: 'var(--text-primary)' }}>
                          {formatCurrency(invoice.vatNok, 'NOK')}
                        </td>
                        <td className="px-4 py-3">
                          <MilestoneStatusBadge status={invoice.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </AppCard>
          </>
        )
      )}
    </div>
  )
}
