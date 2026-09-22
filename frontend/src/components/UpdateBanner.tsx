import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from './ui'

/// A deploy used to swap the service worker silently, so the first load after one
/// showed the previous bundle until a hard reload. Now the new worker waits and this
/// strip offers the reload.
export function UpdateBanner() {
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW()
  if (!needRefresh) return null
  return (
    <div
      role="status"
      className="flex items-center justify-between gap-3 px-4 py-2 text-sm lg:px-12"
      style={{ background: 'var(--accent-soft)', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-faint)' }}
    >
      <span>A new version of the ledger is ready.</span>
      <div className="flex gap-2">
        <Button variant="ghost" className="min-h-8 text-xs" onClick={() => setNeedRefresh(false)}>Later</Button>
        <Button className="min-h-8 text-xs" onClick={() => void updateServiceWorker(true)}>Reload</Button>
      </div>
    </div>
  )
}
