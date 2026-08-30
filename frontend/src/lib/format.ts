import type { Currency, ExchangeRate, Milestone, MilestoneStatus, Project, ProjectStatus } from '../types'

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

// These are only used as fallback inline in pages that haven't been updated to use StatusBadge components
export function projectStatusTone(status: ProjectStatus) {
  switch (status) {
    case 'Paid':
      return 'bg-green-500/15 text-green-400 border border-green-500/30'
    case 'Completed':
      return 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
    case 'InProgress':
      return 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
    case 'Awarded':
      return 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30'
    default:
      return 'bg-slate-700/60 text-slate-400 border border-slate-600/50'
  }
}

export function milestoneStatusTone(status: MilestoneStatus) {
  switch (status) {
    case 'Paid':
      return 'bg-green-500/15 text-green-400 border border-green-500/30'
    case 'Released':
      return 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
    case 'Funded':
      return 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30'
    case 'Disputed':
      return 'bg-red-500/15 text-red-400 border border-red-500/30'
    default:
      return 'bg-slate-700/60 text-slate-400 border border-slate-600/50'
  }
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
 * Look up a rate for a specific month/year. Falls back to the most recent
 * available rate for that currency if the specific month isn't in the dataset.
 */
export function getRateForMonth(
  rates: ExchangeRate[],
  currency: Currency,
  month: number,
  year: number,
): number | null {
  if (currency === 'NOK') return 1
  const exact = rates.find(r => r.currency === currency && r.month === month && r.year === year)
  if (exact) return exact.rate
  const matches = rates.filter(r => r.currency === currency)
  if (matches.length === 0) return null
  matches.sort((a, b) => (b.year * 12 + b.month) - (a.year * 12 + a.month))
  return matches[0].rate
}
