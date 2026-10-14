import { z } from 'zod'
import { httpUrl } from '../../utils/http-url.js'
const envelope = (body: z.ZodTypeAny) => z.object({ body, params: z.object({}), query: z.object({}) }).strict()
export const websiteSettingsSchema = envelope(z.object({
  displayName: z.string().trim().min(2).max(120), logoUrl: httpUrl().optional(), faviconUrl: httpUrl().optional(),
  contact: z.object({ email: z.string().email().max(254).optional(), phone: z.string().trim().max(32).optional(), address: z.string().trim().max(500).optional() }).strict(),
  socialLinks: z.array(z.object({ platform: z.string().trim().min(2).max(40), url: httpUrl() }).strict()).max(12),
  seo: z.object({ title: z.string().trim().max(70).optional(), description: z.string().trim().max(170).optional(), defaultImageUrl: httpUrl().optional() }).strict(),
  locale: z.string().trim().min(2).max(16), defaultLanguage: z.enum(['en', 'bn']).default('en'), enabledLocales: z.array(z.enum(['en', 'bn'])).min(1).max(2).default(['en']), currency: z.string().trim().toUpperCase().length(3),
}).strict().superRefine((value, context) => {
  if (!value.enabledLocales.includes(value.defaultLanguage)) context.addIssue({ code: z.ZodIssueCode.custom, path: ['defaultLanguage'], message: 'Default language must be enabled for this storefront' })
}))
