import { useCallback, useSyncExternalStore } from 'react'

const KEY = 'freelance-ledger:myTimezone'
const DEFAULT = 'Europe/Oslo'

function getSnapshot(): string {
  return localStorage.getItem(KEY) || DEFAULT
}

function subscribe(callback: () => void) {
  window.addEventListener('storage', callback)
  window.addEventListener('myTimezoneChanged', callback)
  return () => {
    window.removeEventListener('storage', callback)
    window.removeEventListener('myTimezoneChanged', callback)
  }
}

export function useMyTimezone() {
  const timezone = useSyncExternalStore(subscribe, getSnapshot)

  const setTimezone = useCallback((tz: string) => {
    localStorage.setItem(KEY, tz)
    window.dispatchEvent(new Event('myTimezoneChanged'))
  }, [])

  return [timezone, setTimezone] as const
}

/** Get the hour offset between two timezones right now */
export function getTimezoneOffset(clientTz: string, myTz: string): string {
  try {
    const now = new Date()
    const clientTime = new Date(now.toLocaleString('en-US', { timeZone: clientTz }))
    const myTime = new Date(now.toLocaleString('en-US', { timeZone: myTz }))
    const diffMs = clientTime.getTime() - myTime.getTime()
    const diffHours = Math.round(diffMs / (1000 * 60 * 60) * 2) / 2 // round to 0.5h
    if (diffHours === 0) return 'Same time as you'
    const sign = diffHours > 0 ? '+' : ''
    const suffix = Math.abs(diffHours) === 1 ? 'hour' : 'hours'
    return `${sign}${diffHours} ${suffix} from you`
  } catch {
    return ''
  }
}
