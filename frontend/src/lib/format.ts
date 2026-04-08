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
  if (!value) return 'Not set'

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

export function projectStatusTone(status: ProjectStatus) {
  switch (status) {
    case 'Paid':
      return 'bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-400/30'
    case 'Completed':
      return 'bg-sky-500/15 text-sky-300 ring-1 ring-inset ring-sky-400/30'
    case 'InProgress':
      return 'bg-indigo-500/15 text-indigo-100 ring-1 ring-inset ring-indigo-400/30'
    case 'Awarded':
      return 'bg-amber-500/15 text-amber-200 ring-1 ring-inset ring-amber-400/30'
    default:
      return 'bg-zinc-700/70 text-zinc-200 ring-1 ring-inset ring-zinc-600'
  }
}

export function milestoneStatusTone(status: MilestoneStatus) {
  switch (status) {
    case 'Paid':
      return 'bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-400/30'
    case 'Released':
      return 'bg-amber-500/15 text-amber-200 ring-1 ring-inset ring-amber-400/30'
    case 'Funded':
      return 'bg-sky-500/15 text-sky-300 ring-1 ring-inset ring-sky-400/30'
    case 'Disputed':
      return 'bg-rose-500/15 text-rose-200 ring-1 ring-inset ring-rose-400/30'
    default:
      return 'bg-zinc-700/70 text-zinc-200 ring-1 ring-inset ring-zinc-600'
  }
}
