import type { Currency, ExchangeRate, Milestone, Project } from '../types'

const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'short' })

export function formatCurrency(amount: number, currency: Currency | 'NOK') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(value: string | null | undefined) {
  if (!value) return '—'

  return new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))
}

export function formatMonth(month: number) {
  return monthFormatter.format(new Date(2026, month - 1, 1))
}

export function isoDate(value: string | null | undefined) {
  return value ?? ''
}

/// Today as YYYY-MM-DD in LOCAL time.
///
/// Not `new Date().toISOString()`: that is a full timestamp, which an
/// <input type="date"> rejects outright and renders blank, and it is UTC, which
/// reads as yesterday from Norway late in the evening.
export function todayIso(): string {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10)
}

export function firstOfMonth(value: string): string {
  return `${value.slice(0, 7)}-01`
}

export function hoursLabel(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)))
}

export function calculateProjectRevenue(project: Project) {
  const paidMilestones = project.milestones
    .filter((milestone) => milestone.status === 'Paid')
    .reduce((sum, milestone) => sum + milestone.amount, 0)
  const tips = project.tips.reduce((sum, tip) => sum + tip.amount, 0)
  const gross = paidMilestones + tips

  return gross - gross * (project.feePercentage / 100)
}

export function calculatePipelineValue(project: Project) {
  const gross =
    project.milestones.reduce((sum, milestone) => sum + milestone.amount, 0) +
    project.tips.reduce((sum, tip) => sum + tip.amount, 0)

  return gross - gross * (project.feePercentage / 100)
}

/** Gross paid: paid milestones + tips, no fee deducted. */
export function calculateProjectGrossPaid(project: Project) {
  const paidMilestones = project.milestones
    .filter((m) => m.status === 'Paid')
    .reduce((sum, m) => sum + m.amount, 0)
  const tips = project.tips.reduce((sum, t) => sum + t.amount, 0)
  return paidMilestones + tips
}

/** Gross pipeline: all milestones (any status) + tips, no fee deducted. */
export function calculateProjectGrossPipeline(project: Project) {
  const milestones = project.milestones.reduce((sum, m) => sum + m.amount, 0)
  const tips = project.tips.reduce((sum, t) => sum + t.amount, 0)
  return milestones + tips
}

export function getNextMilestoneOrder(milestones: Milestone[]) {
  return milestones.reduce((max, milestone) => Math.max(max, milestone.sortOrder), 0) + 1
}



/** True if a milestone has a due date in the past and is not yet Paid. */
export function isMilestoneOverdue(milestone: Milestone, today = new Date()): boolean {
  if (milestone.status === 'Paid') return false
  if (!milestone.dateDue) return false
  const due = new Date(milestone.dateDue)
  // Compare date-only (strip time)
  due.setHours(0, 0, 0, 0)
  const now = new Date(today)
  now.setHours(0, 0, 0, 0)
  return due.getTime() < now.getTime()
}

/** Count overdue milestones on a project. */
export function projectOverdueCount(project: Project): number {
  return project.milestones.filter(m => isMilestoneOverdue(m)).length
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/**
 * Look up a rate for a specific month/year. Unless `exact` is set it falls back to
 * the nearest month on file (the latest one at or before the requested month, else
 * the earliest after it), which is what a hover tooltip wants; a total that goes on
 * a report should ask for `exact` and say when a month has no rate.
 */
export function getRateForMonth(
  rates: ExchangeRate[],
  currency: Currency,
  month: number,
  year: number,
  options?: { exact?: boolean },
): number | null {
  if (currency === 'NOK') return 1
  const exact = rates.find(r => r.currency === currency && r.month === month && r.year === year)
  if (exact) return exact.rate
  if (options?.exact) return null
  const wanted = year * 12 + month
  const matches = rates.filter(r => r.currency === currency)
  if (matches.length === 0) return null
  const before = matches.filter(r => r.year * 12 + r.month <= wanted).sort((a, b) => (b.year * 12 + b.month) - (a.year * 12 + a.month))
  if (before.length > 0) return before[0].rate
  const after = matches.sort((a, b) => (a.year * 12 + a.month) - (b.year * 12 + b.month))
  return after[0].rate
}

/**
 * THE conversion rule for the frontend. Every page used to carry its own copy with
 * its own month handling, so one payment showed three NOK values. Month and year
 * default to the current month, which is right for money that is still outstanding;
 * paid money passes the month it was paid in.
 */
export function convertAmount(
  amount: number,
  from: Currency,
  to: Currency,
  rates: ExchangeRate[],
  month?: number,
  year?: number,
  options?: { exact?: boolean },
): number | null {
  if (from === to) return amount
  const now = new Date()
  const m = month ?? now.getMonth() + 1
  const y = year ?? now.getFullYear()
  // Both sides are read at ONE month. With a non-NOK display currency and a month
  // that has only one of the two rates, looking each side up independently paired an
  // exact rate with a neighbouring month's, which is a cross rate from nowhere.
  const at = resolveMonth(rates, from, to, m, y, options)
  if (at === null) return null
  const fromRate = getRateForMonth(rates, from, at.month, at.year, { exact: true })
  const toRate = getRateForMonth(rates, to, at.month, at.year, { exact: true })
  if (fromRate === null || toRate === null) return null
  return (amount * fromRate) / toRate
}

/// The month to convert at: the requested one when it has both currencies, else the
/// nearest month that does (latest before, then earliest after), else null.
function resolveMonth(
  rates: ExchangeRate[],
  from: Currency,
  to: Currency,
  month: number,
  year: number,
  options?: { exact?: boolean },
): { month: number; year: number } | null {
  const has = (c: Currency, mm: number, yy: number) =>
    c === 'NOK' || rates.some((r) => r.currency === c && r.month === mm && r.year === yy)
  if (has(from, month, year) && has(to, month, year)) return { month, year }
  if (options?.exact) return null
  const keys = new Set<number>()
  for (const r of rates) keys.add(r.year * 12 + r.month)
  const wanted = year * 12 + month
  const candidates = [...keys]
    .map((k) => ({ month: ((k - 1) % 12) + 1, year: Math.floor((k - 1) / 12), key: k }))
    .filter((c) => has(from, c.month, c.year) && has(to, c.month, c.year))
  const before = candidates.filter((c) => c.key <= wanted).sort((a, b) => b.key - a.key)
  if (before.length > 0) return before[0]
  const after = candidates.sort((a, b) => a.key - b.key)
  return after.length > 0 ? after[0] : null
}
