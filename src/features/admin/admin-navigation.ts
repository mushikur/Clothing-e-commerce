export function navigateAdmin(to: string): void {
  if (to.startsWith('/admin')) {
    window.history.pushState({}, '', to)
    window.dispatchEvent(new PopStateEvent('popstate'))
    return
  }
  window.location.assign(to)
}
