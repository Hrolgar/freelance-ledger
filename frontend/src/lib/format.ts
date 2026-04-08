import type { Currency, Milestone, MilestoneStatus, Project, ProjectStatus } from '../types'

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
