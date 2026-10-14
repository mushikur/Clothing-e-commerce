const apiBase = `${(import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '')}/api/v1`

type RefreshResult = { success: boolean; data?: { accessToken: string }; error?: { message?: string } }
let accessToken: string | null = null
let accessTokenExpiresAt = 0
let refreshInFlight: Promise<string | null> | null = null
let noSession = false
let sessionVersion = 0

/** Login and password-change responses update the same in-memory session used by every screen. */
export function installAccessToken(token:string):void {
  sessionVersion+=1;accessToken=token;noSession=false
  try { const payload=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))) as {exp?:number};accessTokenExpiresAt=typeof payload.exp==='number'?payload.exp*1000:Date.now()+5*60_000 }
  catch {accessTokenExpiresAt=Date.now()+5*60_000}
}

/** Shares refresh-token rotation across storefront components in this browser tab. */
export function getAccessToken(): Promise<string | null> {
  if (accessToken && accessTokenExpiresAt > Date.now() + 30_000) return Promise.resolve(accessToken)
  if (noSession) return Promise.resolve(null)
  if (refreshInFlight) return refreshInFlight
  const version=sessionVersion
  refreshInFlight = (async () => {
    const headers = new Headers()
    if (import.meta.env.VITE_BUSINESS_SLUG) headers.set('X-Business-Slug', import.meta.env.VITE_BUSINESS_SLUG)
    try {
      const response = await fetch(`${apiBase}/auth/refresh`, { method: 'POST', headers, credentials: 'include' })
      const result = await response.json() as RefreshResult
      if(version!==sessionVersion)return accessToken
      if (!response.ok || !result.success || !result.data?.accessToken) { noSession = response.status === 401 || response.status === 403; return null }
      accessToken = result.data.accessToken
      try {
        const payload = JSON.parse(atob(accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: number }
        accessTokenExpiresAt = typeof payload.exp === 'number' ? payload.exp * 1000 : Date.now() + 5 * 60_000
      } catch { accessTokenExpiresAt = Date.now() + 5 * 60_000 }
      noSession = false
      return accessToken
    } catch {
      if(version!==sessionVersion)return accessToken
      noSession = false
      return null
    } finally {
      refreshInFlight = null
    }
  })()
  return refreshInFlight
}

/** Keep long-lived account and admin screens from sending an expired access token. */
export async function fetchWithSession(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers)
  if (headers.has('Authorization')) {
    const current = await getAccessToken()
    if (current) headers.set('Authorization', `Bearer ${current}`)
    else headers.delete('Authorization')
  }
  return fetch(input, { ...init, headers })
}

export function clearAccessToken(): void {
  sessionVersion+=1
  accessToken = null
  accessTokenExpiresAt = 0
  noSession = false
}
