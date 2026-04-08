import type { MilestoneStatus, ProjectStatus } from '../types'

// Color coding per spec:
// green = paid, yellow = pending/funded, red = disputed, blue = in-progress, gray = quoted/awarded

const PROJECT_STATUS_STYLES: Record<ProjectStatus, string> = {
  Quoted: 'bg-slate-700/60 text-slate-400 border-slate-600/50',
  Awarded: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  InProgress: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  Completed: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  Paid: 'bg-green-500/15 text-green-400 border-green-500/30',
}

const MILESTONE_STATUS_STYLES: Record<MilestoneStatus, string> = {
  Pending: 'bg-slate-700/60 text-slate-400 border-slate-600/50',
  Funded: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  Released: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  Paid: 'bg-green-500/15 text-green-400 border-green-500/30',
  Disputed: 'bg-red-500/15 text-red-400 border-red-500/30',
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const label = status === 'InProgress' ? 'In Progress' : status
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${PROJECT_STATUS_STYLES[status]}`}
    >
      {label}
    </span>
  )
}

export function MilestoneStatusBadge({ status }: { status: MilestoneStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${MILESTONE_STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  )
}
