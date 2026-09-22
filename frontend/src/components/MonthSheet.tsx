import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Button, cx } from './ui'
import { formatCurrency, formatDate, hoursLabel, todayIso } from '../lib/format'
import type { Project, ProjectRate, TimeEntry, TimeEntryInput } from '../types'
import { MONTH_FULL_NAMES } from '../types'
import { categoriesOf, categoryLabel, lastDayOfMonth, monthLabel, rateFor, shiftMonth } from '../lib/hours'

/// The month sheet: every day logged in one month, edited in place like a spreadsheet.
///
/// Unbilled rows ARE inputs, not text that turns into inputs on click. A row saves
/// itself when focus leaves it or on Enter, reverts on Escape, and keeps its draft
/// with the server's message underneath when the save is refused, so a typo can be
/// fixed rather than retyped. The pinned last row adds a day: Enter adds it, moves
/// the date on one, and puts the cursor back in Hours so a run of days is typed
/// without touching the mouse. Invoiced rows are locked and read as plain text.
///
/// When the project bills more than one rate category (OC: in-house and contracted
/// out) each row carries a Type column, and the totals split per category.

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() + days)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

/// Keeps the add-a-day date from wandering into the next month once it runs past the end.
function clampToMonth(dateStr: string, key: string): string {
  return dateStr.slice(0, 7) === key ? dateStr : lastDayOfMonth(key)
}

/// The day after the latest entry in the month, or today (clamped into the month)
/// when the month is still empty.
function defaultAddDate(key: string, list: TimeEntry[]): string {
  if (list.length === 0) return clampToMonth(todayIso(), key)
  const latest = list.reduce((max, e) => (e.periodEnd > max ? e.periodEnd : max), list[0].periodEnd)
  return clampToMonth(addDays(latest, 1), key)
}

type RowDraft = {
  periodStart: string
  periodEnd: string
  hours: string
  notes: string
  category: string
  error?: string
  saving?: boolean
}

function draftOf(entry: TimeEntry): RowDraft {
  return {
    periodStart: entry.periodStart,
    periodEnd: entry.periodEnd,
    hours: String(entry.hours),
    notes: entry.notes ?? '',
    category: entry.category ?? '',
  }
}

function isDirty(entry: TimeEntry, draft: RowDraft): boolean {
  return (
    draft.periodStart !== entry.periodStart ||
    draft.periodEnd !== entry.periodEnd ||
    Number(draft.hours) !== entry.hours ||
    draft.notes !== (entry.notes ?? '') ||
    draft.category !== (entry.category ?? '')
  )
}

// --- Cells. The inputs sit flush in the grid with no border until hovered or focused,
// so the sheet reads as a table you can type into rather than a stack of forms. ---
const CELL =
  'h-9 w-full min-w-0 rounded-md border border-transparent bg-transparent px-2 text-sm text-[var(--text-primary)] transition-colors hover:border-[var(--border-faint)] focus:border-[var(--accent)] focus:bg-[var(--bg-base)] focus:outline-none disabled:opacity-60'
const CELL_NUM = `${CELL} text-right font-mono tabular-nums`
const HEAD = 'px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]'
const TEXT = 'flex h-9 items-center px-2 text-sm'

export function MonthSheet({
  project,
  monthKey,
  entries,
  rates,
  busy,
  onMonthChange,
  onCreate,
  onUpdate,
  onDelete,
  onInvoice,
  onClose,
}: {
  project: Project
  monthKey: string
  entries: TimeEntry[]
  rates: ProjectRate[]
  busy: boolean
  onMonthChange: (key: string) => void
  /// These throw on failure with the server's message; the sheet shows it on the row.
  onCreate: (input: TimeEntryInput) => Promise<void>
  onUpdate: (id: number, input: TimeEntryInput) => Promise<void>
  onDelete: (id: number) => Promise<void>
  onInvoice: (key: string) => void
  onClose: () => void
}) {
  const categories = useMemo(() => categoriesOf(rates), [rates])
  const hasTypes = categories.length > 0
  const typeOptions = ['', ...categories]

  const [drafts, setDrafts] = useState<Record<number, RowDraft>>({})
  const [adding, setAdding] = useState(() => ({
    date: defaultAddDate(monthKey, entries),
    category: '',
    hours: '',
    notes: '',
    error: '' as string,
  }))
  const [addingBusy, setAddingBusy] = useState(false)
  const [lastMonthKey, setLastMonthKey] = useState(monthKey)
  const addHoursRef = useRef<HTMLInputElement>(null)

  // Moving to another month resets the add row to that month; drafts belong to rows
  // by id, so they survive (a half-edited row in August is still there if you come back).
  if (lastMonthKey !== monthKey) {
    setLastMonthKey(monthKey)
    setAdding({ date: defaultAddDate(monthKey, entries), category: adding.category, hours: '', notes: '', error: '' })
  }

  const sorted = useMemo(
    () => [...entries].sort((a, b) => a.periodStart.localeCompare(b.periodStart) || (a.category ?? '').localeCompare(b.category ?? '') || a.id - b.id),
    [entries],
  )
  const currency = sorted[0]?.currency ?? rates[0]?.currency ?? project.currency
  const days = new Set(sorted.map((e) => e.periodStart)).size
  const totalHours = sorted.reduce((sum, e) => sum + e.hours, 0)
  const totalAmount = sorted.reduce((sum, e) => sum + e.hours * e.rateApplied, 0)
  const unbilledCount = sorted.filter((e) => e.invoiceMilestoneId === null).length
  const status = unbilledCount === 0 ? (sorted.length === 0 ? 'Empty' : 'Invoiced') : unbilledCount === sorted.length ? 'Unbilled' : 'Partly invoiced'

  const perCategory = useMemo(() => {
    if (!hasTypes) return []
    return typeOptions
      .map((c) => {
        const list = sorted.filter((e) => (e.category ?? '') === c)
        return { category: c, hours: list.reduce((s, e) => s + e.hours, 0), amount: list.reduce((s, e) => s + e.hours * e.rateApplied, 0) }
      })
      .filter((c) => c.hours > 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorted, hasTypes, categories])

  const setDraft = (id: number, patch: Partial<RowDraft>, entry: TimeEntry) =>
    setDrafts((d) => ({ ...d, [id]: { ...(d[id] ?? draftOf(entry)), ...patch } }))

  const revert = (id: number) =>
    setDrafts((d) => {
      const next = { ...d }
      delete next[id]
      return next
    })

  const commit = async (entry: TimeEntry) => {
    const draft = drafts[entry.id]
    if (!draft || draft.saving) return
    if (!isDirty(entry, draft)) {
      revert(entry.id)
      return
    }
    const hours = Number(draft.hours)
    if (!(hours > 0)) {
      setDraft(entry.id, { error: 'Hours must be more than zero.' }, entry)
      return
    }
    setDraft(entry.id, { saving: true, error: undefined }, entry)
    try {
      await onUpdate(entry.id, {
        periodStart: draft.periodStart,
        periodEnd: draft.periodEnd || draft.periodStart,
        hours,
        notes: draft.notes || null,
        category: draft.category || null,
      })
      revert(entry.id)
    } catch (err) {
      setDraft(entry.id, { saving: false, error: err instanceof Error ? err.message : 'Could not save this row.' }, entry)
    }
  }

  const add = async () => {
    const hours = Number(adding.hours)
    if (!adding.date || !(hours > 0) || addingBusy) return
    setAddingBusy(true)
    setAdding((a) => ({ ...a, error: '' }))
    try {
      await onCreate({
        periodStart: adding.date,
        periodEnd: adding.date,
        hours,
        notes: adding.notes || null,
        category: adding.category || null,
      })
      setAdding((a) => ({ ...a, date: clampToMonth(addDays(a.date, 1), monthKey), hours: '', notes: '', error: '' }))
      addHoursRef.current?.focus()
    } catch (err) {
      setAdding((a) => ({ ...a, error: err instanceof Error ? err.message : 'Could not add that day.' }))
    } finally {
      setAddingBusy(false)
    }
  }

  const remove = async (entry: TimeEntry) => {
    if (!confirm(`Delete ${formatDate(entry.periodStart)}${entry.category ? ` (${entry.category})` : ''}, ${hoursLabel(entry.hours)}h?`)) return
    try {
      await onDelete(entry.id)
      revert(entry.id)
    } catch (err) {
      setDraft(entry.id, { error: err instanceof Error ? err.message : 'Could not delete this row.' }, entry)
    }
  }

  const rowKeys = (entry: TimeEntry) => (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      void commit(entry)
    } else if (e.key === 'Escape') {
      e.stopPropagation()
      revert(entry.id)
    }
  }

  const addKeys = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      void add()
    }
  }

  const gridCols = hasTypes
    ? 'lg:grid-cols-[9.5rem_11rem_5.5rem_minmax(0,1fr)_7.5rem_4.5rem]'
    : 'lg:grid-cols-[9.5rem_5.5rem_minmax(0,1fr)_7.5rem_4.5rem]'
  // Phone: line one is date | hours | amount | actions, line two is type | notes,
  // placed with `order` so the DOM (and tab order) stays date, type, hours, notes.
  const ROW = `grid grid-cols-[minmax(0,1fr)_4.5rem_6rem_3rem] items-center gap-x-1 gap-y-1 px-2 py-1.5 lg:gap-y-0 lg:py-1 ${gridCols}`
  const O_DATE = 'order-1 lg:order-none'
  const O_TYPE = 'order-5 lg:order-none'
  const O_HOURS = 'order-2 lg:order-none'
  const O_NOTES = 'order-6 col-span-3 lg:order-none lg:col-span-1'
  const O_AMOUNT = 'order-3 lg:order-none'
  const O_ACTIONS = 'order-4 lg:order-none'
  const O_ERROR = 'order-7 col-span-4 lg:order-none lg:col-span-full'

  // A render function, not a nested component: a component declared inside render
  // gets a new identity every render, which remounts the select and drops focus
  // mid-tab.
  const typeSelect = ({ value, onChange, onKeyDown, disabled }: {
    value: string
    onChange: (v: string) => void
    onKeyDown?: (e: KeyboardEvent) => void
    disabled?: boolean
  }) => (
    <select
      aria-label="Type of work"
      className={cx(CELL, 'appearance-none')}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
    >
      {typeOptions.map((c) => (
        <option key={c} value={c}>{categoryLabel(c)}</option>
      ))}
    </select>
  )

  const amountCell = (value: ReactNode, tone: 'normal' | 'muted' | 'draft' = 'normal') => (
    <div
      className={cx(TEXT, O_AMOUNT, 'justify-end font-mono tabular-nums')}
      style={{ color: tone === 'muted' ? 'var(--text-tertiary)' : tone === 'draft' ? 'var(--accent)' : 'var(--text-primary)' }}
    >
      {value}
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      {/* --- Header: month navigation, status, totals --- */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-1">
          <Button variant="ghost" className="min-h-9 px-2" aria-label="Previous month" onClick={() => onMonthChange(shiftMonth(monthKey, -1))}>
            ‹
          </Button>
          <h3 className="min-w-[10.5rem] text-center text-lg font-semibold tracking-tight" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
            {monthLabel(monthKey)}
          </h3>
          <Button variant="ghost" className="min-h-9 px-2" aria-label="Next month" onClick={() => onMonthChange(shiftMonth(monthKey, 1))}>
            ›
          </Button>
        </div>
        <StatusPill status={status} />
        <div className="ml-auto flex flex-wrap items-baseline gap-x-5 gap-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span>{days} {days === 1 ? 'day' : 'days'}</span>
          <span><span className="font-mono tabular-nums font-semibold text-[var(--text-primary)]">{hoursLabel(totalHours)}h</span></span>
          <span className="font-mono tabular-nums text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            {formatCurrency(totalAmount, currency)}
          </span>
        </div>
      </div>

      {/* --- The sheet --- */}
      <div className="rounded-lg" style={{ border: '1px solid var(--border-faint)', background: 'var(--bg-surface)' }}>
        <div className={cx(ROW, 'hidden border-b border-[var(--border-faint)] py-2 lg:grid')}>
          <div className={HEAD}>Date</div>
          {hasTypes && <div className={HEAD}>Type</div>}
          <div className={cx(HEAD, 'text-right')}>Hours</div>
          <div className={HEAD}>Notes</div>
          <div className={cx(HEAD, 'text-right')}>Amount</div>
          <div />
        </div>

        {sorted.length === 0 && (
          <p className="px-4 py-5 text-sm" style={{ color: 'var(--text-tertiary)' }}>
            Nothing logged in {monthLabel(monthKey)} yet. Type the first day on the line below.
          </p>
        )}

        {sorted.map((entry) => {
          const invoiced = entry.invoiceMilestoneId !== null
          const draft = drafts[entry.id]
          const dirty = draft ? isDirty(entry, draft) : false
          const view = draft ?? draftOf(entry)
          const previewRate = dirty ? rateFor(rates, view.category, view.periodStart) : undefined
          const previewAmount = dirty
            ? previewRate ? Number(view.hours) * previewRate.rate : null
            : entry.hours * entry.rateApplied
          const isRange = entry.periodStart !== entry.periodEnd

          if (invoiced) {
            return (
              <div key={entry.id} className={cx(ROW, 'border-b border-[var(--border-faint)] last:border-0')} style={{ color: 'var(--text-secondary)' }}>
                <div className={cx(TEXT, O_DATE)}>{isRange ? `${formatDate(entry.periodStart)} to ${formatDate(entry.periodEnd)}` : formatDate(entry.periodStart)}</div>
                {hasTypes && <div className={cx(TEXT, O_TYPE)}>{categoryLabel(entry.category)}</div>}
                <div className={cx(TEXT, O_HOURS, 'justify-end font-mono tabular-nums')}>{hoursLabel(entry.hours)}</div>
                <div className={cx(TEXT, O_NOTES, 'truncate text-xs')} style={{ color: 'var(--text-tertiary)' }}>{entry.notes ?? ''}</div>
                {amountCell(formatCurrency(entry.hours * entry.rateApplied, entry.currency), 'muted')}
                <div className={cx(O_ACTIONS, 'flex justify-end pr-1')}>
                  <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Billed</span>
                </div>
              </div>
            )
          }

          return (
            <div
              key={entry.id}
              className={cx(ROW, 'border-b border-[var(--border-faint)] last:border-0', draft?.saving && 'opacity-60')}
              style={dirty ? { boxShadow: 'inset 3px 0 0 var(--accent)' } : undefined}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) void commit(entry)
              }}
            >
              {isRange ? (
                <div className={cx(O_DATE, 'flex min-w-0 items-center gap-1')}>
                  <input type="date" aria-label="Period start" className={CELL} value={view.periodStart}
                    onChange={(e) => setDraft(entry.id, { periodStart: e.target.value }, entry)} onKeyDown={rowKeys(entry)} />
                  <input type="date" aria-label="Period end" className={CELL} value={view.periodEnd}
                    onChange={(e) => setDraft(entry.id, { periodEnd: e.target.value }, entry)} onKeyDown={rowKeys(entry)} />
                </div>
              ) : (
                <input type="date" aria-label="Date" className={cx(CELL, O_DATE)} value={view.periodStart}
                  onChange={(e) => setDraft(entry.id, { periodStart: e.target.value, periodEnd: e.target.value }, entry)} onKeyDown={rowKeys(entry)} />
              )}
              {hasTypes && (
                <div className={O_TYPE}>
                  {typeSelect({ value: view.category, onChange: (v) => setDraft(entry.id, { category: v }, entry), onKeyDown: rowKeys(entry) })}
                </div>
              )}
              <input type="number" step="0.25" min="0" aria-label="Hours" className={cx(CELL_NUM, O_HOURS)} value={view.hours}
                onChange={(e) => setDraft(entry.id, { hours: e.target.value }, entry)} onKeyDown={rowKeys(entry)} />
              <input aria-label="Notes" placeholder="Notes" className={cx(CELL, O_NOTES)} value={view.notes}
                onChange={(e) => setDraft(entry.id, { notes: e.target.value }, entry)} onKeyDown={rowKeys(entry)} />
              {amountCell(
                previewAmount === null ? 'no rate' : formatCurrency(previewAmount, previewRate?.currency ?? entry.currency),
                dirty ? 'draft' : 'normal',
              )}
              <div className={cx(O_ACTIONS, 'flex items-center justify-end gap-0.5')}>
                {dirty && !draft?.saving && (
                  <button type="button" className="rounded px-1.5 text-xs" style={{ color: 'var(--text-tertiary)' }} title="Discard changes (Esc)" onMouseDown={(e) => e.preventDefault()} onClick={() => revert(entry.id)}>
                    undo
                  </button>
                )}
                <button
                  type="button"
                  aria-label={`Delete ${formatDate(entry.periodStart)}`}
                  title="Delete this line"
                  className="flex size-8 items-center justify-center rounded-md text-base leading-none transition-colors hover:bg-[var(--bg-elevated)]"
                  style={{ color: 'var(--text-tertiary)' }}
                  disabled={busy}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => void remove(entry)}
                >
                  ×
                </button>
              </div>
              {draft?.error && (
                <p className={cx(O_ERROR, 'px-2 pb-1 text-xs')} style={{ color: 'var(--overdue)' }}>{draft.error}</p>
              )}
            </div>
          )
        })}

        {/* --- Add a day, pinned last --- */}
        <div className={cx(ROW, 'border-t border-[var(--border-default)] py-2')} style={{ background: 'var(--bg-elevated)' }}>
          <input
            type="date" aria-label="Date to add" className={cx(CELL, O_DATE)}
            value={adding.date} min={`${monthKey}-01`} max={lastDayOfMonth(monthKey)}
            onChange={(e) => setAdding({ ...adding, date: e.target.value })} onKeyDown={addKeys}
          />
          {hasTypes && (
            <div className={O_TYPE}>
              {typeSelect({ value: adding.category, onChange: (v) => setAdding({ ...adding, category: v }), onKeyDown: addKeys })}
            </div>
          )}
          <input
            ref={addHoursRef}
            type="number" step="0.25" min="0" aria-label="Hours to add" placeholder="Hours" className={cx(CELL_NUM, O_HOURS)}
            value={adding.hours} onChange={(e) => setAdding({ ...adding, hours: e.target.value })} onKeyDown={addKeys}
          />
          <input
            aria-label="Notes for the new day" placeholder="What was done" className={cx(CELL, O_NOTES)}
            value={adding.notes} onChange={(e) => setAdding({ ...adding, notes: e.target.value })} onKeyDown={addKeys}
          />
          {amountCell(
            (() => {
              const r = rateFor(rates, adding.category, adding.date || `${monthKey}-01`)
              const h = Number(adding.hours)
              return r && h > 0 ? formatCurrency(h * r.rate, r.currency) : r ? `${formatCurrency(r.rate, r.currency)}/h` : 'no rate'
            })(),
            'muted',
          )}
          <div className={cx(O_ACTIONS, 'flex justify-end')}>
            <Button className="min-h-8 px-2 text-xs" disabled={addingBusy || !adding.date || !(Number(adding.hours) > 0)} onClick={() => void add()}>
              {addingBusy ? '…' : 'Add'}
            </Button>
          </div>
          {adding.error && (
            <p className={cx(O_ERROR, 'px-2 text-xs')} style={{ color: 'var(--overdue)' }}>{adding.error}</p>
          )}
        </div>
      </div>

      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
        Rows save when you leave them or press Enter. Esc puts a row back. Enter on the last line adds the day and moves the date on.
      </p>

      {/* --- Footer: per-type split, then the actions. Sticky, like ModalActions, so
          a long month scrolls under it and the invoice button is always in reach. --- */}
      <div className="sticky bottom-0 -mx-6 -mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[var(--border-faint)] px-6 py-3 text-sm" style={{ background: 'var(--bg-elevated)' }}>
        {perCategory.map((c) => (
          <span key={c.category} className="rounded-md px-2.5 py-1" style={{ border: '1px solid var(--border-faint)', color: 'var(--text-secondary)' }}>
            {categoryLabel(c.category)}{' '}
            <span className="font-mono tabular-nums text-[var(--text-primary)]">{hoursLabel(c.hours)}h</span>
            {' · '}
            <span className="font-mono tabular-nums text-[var(--text-primary)]">{formatCurrency(c.amount, currency)}</span>
          </span>
        ))}
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Close</Button>
          {unbilledCount > 0 && (
            <Button type="button" onClick={() => onInvoice(monthKey)}>Create invoice for {MONTH_FULL_NAMES[Number(monthKey.slice(5, 7)) - 1]}</Button>
          )}
        </div>
      </div>
    </div>
  )
}

function StatusPill({ status }: { status: 'Empty' | 'Invoiced' | 'Unbilled' | 'Partly invoiced' }) {
  if (status === 'Empty') return null
  if (status === 'Unbilled') {
    return (
      <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
        Unbilled
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
    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ border: '1px solid var(--border-default)', color: 'var(--text-tertiary)' }}>
      Invoiced
    </span>
  )
}
