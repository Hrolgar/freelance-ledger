import type { Currency, Project } from './types'

export function formatMoney(value: number, currency: Currency | 'NOK' = 'NOK') {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatDate(value?: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

export function asInputDate(value?: string | null) {
  return value ?? ''
}

export function asOptionalDate(value: string) {
  return value.trim() ? value : null
}

export function asOptionalText(value: string) {
  return value.trim() ? value : null
}

export function computeProjectNetRevenue(project: Project) {
  const paidMilestones = project.milestones
    .filter((milestone) => milestone.status === 'Paid')
    .reduce((total, milestone) => total + milestone.amount, 0)
  const tips = project.tips.reduce((total, tip) => total + tip.amount, 0)
  const gross = paidMilestones + tips
  return gross - gross * (project.feePercentage / 100)
}

export function computeMonthlyProjectRevenue(
  project: Project,
  month: number,
  year: number,
) {
  const monthPrefix = `${year}-${String(month).padStart(2, '0')}`
  const paidMilestones = project.milestones
    .filter(
      (milestone) =>
        milestone.status === 'Paid' && milestone.datePaid?.startsWith(monthPrefix),
    )
    .reduce((total, milestone) => total + milestone.amount, 0)
  const tips = project.tips
    .filter((tip) => tip.date.startsWith(monthPrefix))
    .reduce((total, tip) => total + tip.amount, 0)
  const gross = paidMilestones + tips
  const fee = gross * (project.feePercentage / 100)

  return {
    paidMilestones,
    tips,
    gross,
    fee,
    net: gross - fee,
  }
}

export function statusClasses(value: string) {
  if (value === 'Paid' || value === 'Completed' || value === 'Released') {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
  }
  if (value === 'Awarded' || value === 'Funded') {
    return 'border-indigo-500/30 bg-indigo-500/10 text-indigo-200'
  }
  if (value === 'Quoted' || value === 'Pending') {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-200'
  }
  if (value === 'Disputed') {
    return 'border-rose-500/30 bg-rose-500/10 text-rose-200'
  }
  return 'border-zinc-700 bg-zinc-800 text-zinc-300'
}

export function sortByLatestProject(a: Project, b: Project) {
  return b.id - a.id
}
