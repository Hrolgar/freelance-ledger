import type { ProjectStatus, MilestoneStatus } from '../types'

const PROJECT_STATUS_STYLES: Record<ProjectStatus, string> = {
  Quoted: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30',
  Awarded: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
  InProgress: 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30',
  Completed: 'bg-teal-500/15 text-teal-400 border border-teal-500/30',
  Paid: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
}

const MILESTONE_STATUS_STYLES: Record<MilestoneStatus, string> = {
  Pending: 'bg-zinc-700/50 text-zinc-400 border border-zinc-600',
  Funded: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
  Released: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30',
  Paid: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
  Disputed: 'bg-red-500/15 text-red-400 border border-red-500/30',
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const label = status === 'InProgress' ? 'In Progress' : status
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${PROJECT_STATUS_STYLES[status]}`}>
      {label}
    </span>
  )
}

export function MilestoneStatusBadge({ status }: { status: MilestoneStatus }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${MILESTONE_STATUS_STYLES[status]}`}>
      {status}
    </span>
  )
}
