import { z } from 'zod'

export const httpUrl = (max = 2048) => z.string().url().max(max).refine((value) => {
  try { return ['http:', 'https:'].includes(new URL(value).protocol) } catch { return false }
}, 'Use an HTTP or HTTPS URL')

export const storefrontHref = z.string().trim().max(2048).refine((value) => {
  if (value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')) return true
  try { return ['http:', 'https:'].includes(new URL(value).protocol) } catch { return false }
}, 'Use a site path or an HTTP URL')
