import { z } from 'zod'

const id = z.string().regex(/^[a-f\d]{24}$/i)
const envelope = (body: z.ZodTypeAny, params: z.ZodTypeAny = z.object({}), query: z.ZodTypeAny = z.object({})) => z.object({ body, params, query }).strict()
const colors = z.object({
  primary: z.string().regex(/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i), secondary: z.string().regex(/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i), accent: z.string().regex(/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i),
  background: z.string().regex(/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i), surface: z.string().regex(/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i), text: z.string().regex(/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i),
  mutedText: z.string().regex(/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i), border: z.string().regex(/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i), success: z.string().regex(/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i), warning: z.string().regex(/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i), error: z.string().regex(/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i),
}).strict()
function luminance(hex: string) {
  const value = hex.slice(1)
  const expanded = value.length === 3 ? value.split('').map((character) => character + character).join('') : value
  const channels = expanded.match(/.{2}/g)!.map((channel) => parseInt(channel, 16) / 255).map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!
}
function contrastRatio(first: string, second: string) { const a = luminance(first); const b = luminance(second); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) }
const theme = z.object({
  name: z.string().trim().min(2).max(100), preset: z.enum(['luxury', 'minimal', 'modern', 'streetwear', 'elegant', 'classic', 'dark_fashion', 'premium_boutique']),
  colors, typography: z.object({ displayFont: z.enum(['serif', 'sans', 'editorial']), bodyFont: z.enum(['sans', 'serif']) }).strict(),
  components: z.object({ buttonStyle: z.enum(['solid', 'outline', 'soft']), cardStyle: z.enum(['minimal', 'bordered', 'soft']), headerStyle: z.enum(['clean', 'editorial']), footerStyle: z.enum(['minimal', 'editorial']), radius: z.enum(['sharp', 'soft', 'rounded']), spacing: z.enum(['compact', 'comfortable', 'relaxed']), backgroundStyle: z.enum(['flat', 'warm', 'cool']) }).strict(),
}).strict().superRefine((value, context) => {
  for (const key of ['text', 'mutedText', 'secondary', 'accent', 'success', 'warning', 'error'] as const) {
    if (contrastRatio(value.colors[key], value.colors.background) < 4.5) context.addIssue({ code: z.ZodIssueCode.custom, path: ['colors', key], message: `${key} must have at least 4.5:1 contrast against the theme background` })
  }
})
export const themeListSchema = envelope(z.object({}).strict(), z.object({}), z.object({}).strict())
export const themeCreateSchema = envelope(theme)
export const themeUpdateSchema = envelope(theme, z.object({ themeId: id }).strict())
export const themeIdSchema = envelope(z.object({}).strict(), z.object({ themeId: id }).strict())

const pageKeys = ['about', 'contact', 'faq', 'privacy', 'terms', 'returns', 'refunds', 'shipping'] as const
const pageTranslation = z.object({ title: z.string().trim().max(160).optional(), summary: z.string().trim().max(500).optional(), body: z.string().max(50000).optional(), faqs: z.array(z.object({ question: z.string().trim().max(240), answer: z.string().trim().max(4000) }).strict()).max(100).optional(), seoTitle: z.string().trim().max(70).optional(), seoDescription: z.string().trim().max(170).optional() }).strict()
const contentPage = z.object({
  pageKey: z.enum(pageKeys), slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
  title: z.string().trim().min(2).max(160), summary: z.string().trim().max(500).optional(), body: z.string().max(50000).default(''),
  translations: z.object({ en: pageTranslation.optional(), bn: pageTranslation.optional() }).strict().optional(),
  faqs: z.array(z.object({ question: z.string().trim().min(2).max(240), answer: z.string().trim().min(1).max(4000) }).strict()).max(100).default([]),
  status: z.enum(['draft', 'published']), seo: z.object({ title: z.string().trim().max(70).optional(), description: z.string().trim().max(170).optional() }).strict(),
}).strict().superRefine((value, context) => { if (value.slug !== value.pageKey) context.addIssue({ code: z.ZodIssueCode.custom, path: ['slug'], message: 'Use the storefront URL reserved for this page' }) })
export const contentListSchema = envelope(z.object({}).strict(), z.object({}), z.object({}).strict())
export const contentUpsertSchema = envelope(contentPage)
export const contentPageIdSchema = envelope(z.object({}).strict(), z.object({ pageKey: z.enum(pageKeys) }).strict())
