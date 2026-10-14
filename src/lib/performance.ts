/** Local development diagnostics. No telemetry is stored or sent to a service. */
export function observeStorefrontPerformance() {
  if (!import.meta.env.DEV || !('PerformanceObserver' in window)) return
  let lcp = 0
  let cls = 0
  let shiftWindow = 0
  let firstShift = 0
  let lastShift = 0
  let interaction = 0
  let timer: number | undefined
  const report = () => {
    if (timer !== undefined) window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
      console.info('Storefront performance', JSON.stringify({
        lcpMs: Math.round(lcp), cls: Number(cls.toFixed(4)),
        slowestObservedInteractionMs: Math.round(interaction),
        responseStartMs: Math.round(navigation?.responseStart ?? 0),
        domContentLoadedMs: Math.round(navigation?.domContentLoadedEventEnd ?? 0),
        environment: 'local development',
      }))
    }, 200)
  }
  const observe = (type: string, callback: (entries: PerformanceEntry[]) => void) => {
    if (!PerformanceObserver.supportedEntryTypes.includes(type)) return
    const observer = new PerformanceObserver((list) => { callback(list.getEntries()); report() })
    observer.observe({ type, buffered: true, ...(type === 'event' ? { durationThreshold: 40 } : {}) })
  }
  observe('largest-contentful-paint', (entries) => { lcp = entries[entries.length - 1]?.startTime ?? lcp })
  observe('layout-shift', (entries) => {
    for (const entry of entries as Array<PerformanceEntry & { value: number; hadRecentInput: boolean }>) {
      if (entry.hadRecentInput) continue
      if (entry.startTime - lastShift > 1000 || entry.startTime - firstShift > 5000) { firstShift = entry.startTime; shiftWindow = 0 }
      shiftWindow += entry.value
      lastShift = entry.startTime
      cls = Math.max(cls, shiftWindow)
    }
  })
  observe('event', (entries) => {
    for (const entry of entries as Array<PerformanceEntry & { interactionId?: number }>) {
      if (entry.interactionId) interaction = Math.max(interaction, entry.duration)
    }
  })
  report()
}
