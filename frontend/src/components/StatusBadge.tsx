import type { BillingType, MilestoneStatus, ProjectStatus } from '../types'

const PROJECT_STATUS_DOT: Record<ProjectStatus, string> = {
  Quoted: 'bg-[var(--text-tertiary)]',
  Awarded: 'bg-[var(--pending)]',
  InProgress: 'bg-[var(--info)]',
  Completed: 'bg-[var(--paid)]',
  Paid: 'bg-[var(--paid)]',
  OnHold: 'bg-[var(--border-default)]',
}

const MILESTONE_STATUS_DOT: Record<MilestoneStatus, string> = {
  Pending: 'bg-[var(--text-tertiary)]',
  Funded: 'bg-[var(--pending)]',
  Released: 'bg-[var(--info)]',
  Paid: 'bg-[var(--paid)]',
  Disputed: 'bg-[var(--overdue)]',
}

/// A retainer has no beginning and no end the way a job does, so "In Progress" and
/// "Completed" read oddly on one. The STORED value is unchanged -- it still drives the
/// auto-raise sweep and the pipeline exclusion server-side -- only the wording differs.
export function projectStatusLabel(status: ProjectStatus, billingType?: BillingType): string {
  if (status === 'OnHold') return 'On hold'
  if (billingType === 'Retainer') {
    if (status === 'InProgress') return 'Active'
    if (status === 'Completed') return 'Ended'
  }
  return status === 'InProgress' ? 'In Progress' : status
}

export function ProjectStatusBadge({ status, billingType }: {
  status: ProjectStatus
  billingType?: BillingType
}) {
  const label = projectStatusLabel(status, billingType)
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
    >
      <span className={`size-1.5 rounded-full ${PROJECT_STATUS_DOT[status]}`} />
      {label}
    </span>
  )
}

export function MilestoneStatusBadge({ status }: { status: MilestoneStatus }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
    >
      <span className={`size-1.5 rounded-full ${MILESTONE_STATUS_DOT[status]}`} />
      {status}
    </span>
  )
}
