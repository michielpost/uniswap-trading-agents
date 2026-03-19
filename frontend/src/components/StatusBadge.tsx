type Status = 'running' | 'stopped' | 'error'

const statusConfig: Record<Status, { label: string; dotClass: string; badgeClass: string }> = {
  running: {
    label: 'Running',
    dotClass: 'bg-green-400',
    badgeClass: 'bg-green-900/50 text-green-300 border-green-700',
  },
  stopped: {
    label: 'Stopped',
    dotClass: 'bg-gray-400',
    badgeClass: 'bg-gray-700/50 text-gray-300 border-gray-600',
  },
  error: {
    label: 'Error',
    dotClass: 'bg-red-400',
    badgeClass: 'bg-red-900/50 text-red-300 border-red-700',
  },
}

export default function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status as Status] ?? statusConfig.stopped
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.badgeClass}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dotClass}`} />
      {config.label}
    </span>
  )
}
