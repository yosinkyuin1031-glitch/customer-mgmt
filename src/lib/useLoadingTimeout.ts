import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'

/**
 * ローディング状態にタイムアウトを追加するフック。
 * loading が true のまま timeoutMs を超えると isTimedOut が true になる。
 */
export function useLoadingTimeout(loading: boolean, timeoutMs: number = 10000) {
  const timedOutRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const listenersRef = useRef<Set<() => void>>(new Set())

  const notify = useCallback(() => {
    listenersRef.current.forEach(fn => fn())
  }, [])

  useEffect(() => {
    // Reset on loading change
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }

    if (loading) {
      timedOutRef.current = false
      notify()
      timerRef.current = setTimeout(() => {
        timedOutRef.current = true
        notify()
      }, timeoutMs)
    } else {
      if (timedOutRef.current) {
        timedOutRef.current = false
        notify()
      }
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [loading, timeoutMs, notify])

  const subscribe = useCallback((callback: () => void) => {
    listenersRef.current.add(callback)
    return () => { listenersRef.current.delete(callback) }
  }, [])

  const getSnapshot = useCallback(() => timedOutRef.current, [])

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
