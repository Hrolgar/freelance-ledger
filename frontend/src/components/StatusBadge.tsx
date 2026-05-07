import type { MilestoneStatus, ProjectStatus } from '../types'

const PROJECT_STATUS_DOT: Record<ProjectStatus, string> = {
  Quoted: 'bg-[var(--text-tertiary)]',
  Awarded: 'bg-[var(--pending)]',
  InProgress: 'bg-[var(--info)]',
  Completed: 'bg-[var(--paid)]',
  Paid: 'bg-[var(--paid)]',
}

const MILESTONE_STATUS_DOT: Record<MilestoneStatus, string> = {
  Pending: 'bg-[var(--text-tertiary)]',
  Funded: 'bg-[var(--pending)]',
  Released: 'bg-[var(--info)]',
  Paid: 'bg-[var(--paid)]',
  Disputed: 'bg-[var(--overdue)]',
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const label = status === 'InProgress' ? 'In Progress' : status
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
