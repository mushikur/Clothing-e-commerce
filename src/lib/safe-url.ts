export function safeWebUrl(value?: string) {
  if (!value) return undefined
  try {
    const parsed = new URL(value, window.location.origin)
    return ['http:', 'https:'].includes(parsed.protocol) ? value : undefined
  } catch { return undefined }
}

export function safeHref(value?: string) {
  if (!value) return undefined
  if (value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')) return value
  if (value.startsWith('#')) return value
  return safeWebUrl(value)
}
