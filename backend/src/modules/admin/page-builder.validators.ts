import { z } from 'zod'
import { httpUrl, storefrontHref } from '../../utils/http-url.js'

const id = z.string().regex(/^[a-f\d]{24}$/i)
const slug = z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80)
const landingSlug = slug.refine((value) => !new Set(['about', 'contact', 'faq', 'privacy', 'terms', 'returns', 'shipping', 'policies', 'shop', 'search', 'admin', 'account', 'cart', 'checkout', 'wishlist', 'orders', 'tracking', 'category', 'subcategory', 'products']).has(value), 'This path is reserved for a storefront page')
const envelope = (body: z.ZodTypeAny, params: z.ZodTypeAny = z.object({}), query: z.ZodTypeAny = z.object({})) => z.object({ body, params, query }).strict()
const item = z.object({ title: z.string().trim().max(160).optional(), body: z.string().trim().max(2000).optional(), imageUrl: httpUrl().optional(), imageAlt: z.string().trim().max(250).optional(), url: storefrontHref.optional(), rating: z.number().int().min(1).max(5).optional() }).strict()
const content = z.object({
  eyebrow: z.string().trim().max(100).optional(), title: z.string().trim().max(180).optional(), headline: z.string().trim().max(240).optional(), body: z.string().max(12000).optional(),
  imageUrl: httpUrl().optional(), imageAlt: z.string().trim().max(250).optional(), videoUrl: httpUrl().optional(),
  buttonLabel: z.string().trim().max(80).optional(), buttonUrl: storefrontHref.optional(), secondaryButtonLabel: z.string().trim().max(80).optional(), secondaryButtonUrl: storefrontHref.optional(),
  backgroundColor: z.string().regex(/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i).optional(), textColor: z.string().regex(/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i).optional(),
  categoryId: id.optional(), categoryIds: z.array(id).max(24).optional(), productIds: z.array(id).max(48).optional(), collectionKey: slug.optional(), limit: z.number().int().min(1).max(24).optional(),
  items: z.array(item).max(30).optional(),
}).strict()
const sectionTranslation = z.object({ title: z.string().trim().max(180).optional(), content: content.optional() }).strict()
const sectionTranslations = z.object({ en: sectionTranslation.optional(), bn: sectionTranslation.optional() }).strict().optional()
const sectionTypes = ['hero', 'banner', 'product_grid', 'product_carousel', 'categories', 'collections', 'lookbook', 'image_text', 'video', 'testimonials', 'reviews', 'instagram', 'newsletter', 'cta', 'custom_content', 'editorial', 'product_collection', 'promotion_banner', 'rich_text'] as const
const section = z.object({ pageKey: z.union([z.literal('home'), slug]), type: z.enum(sectionTypes), title: z.string().trim().max(180).optional(), content, translations: sectionTranslations, sortOrder: z.number().int().min(0).max(500).optional(), visible: z.boolean().default(true) }).strict().superRefine((value, context) => {
  const needsHeadline = ['hero', 'banner', 'lookbook', 'image_text', 'cta', 'editorial', 'promotion_banner'].includes(value.type)
  const headline = value.content.headline || (value.type === 'image_text' ? value.content.title : undefined)
  if (needsHeadline && !headline) context.addIssue({ code: z.ZodIssueCode.custom, path: ['content', 'headline'], message: 'Add a headline for this section' })
  if (['product_grid', 'product_carousel', 'categories', 'collections', 'testimonials', 'reviews', 'instagram', 'newsletter'].includes(value.type) && !value.content.title) context.addIssue({ code: z.ZodIssueCode.custom, path: ['content', 'title'], message: 'Add a title for this section' })
  if (value.type === 'hero' && !value.content.imageUrl) context.addIssue({ code: z.ZodIssueCode.custom, path: ['content', 'imageUrl'], message: 'Hero sections need an image' })
  if (value.type === 'lookbook' && !value.content.imageUrl) context.addIssue({ code: z.ZodIssueCode.custom, path: ['content', 'imageUrl'], message: 'Lookbook sections need an image' })
  if (value.type === 'video' && !value.content.videoUrl) context.addIssue({ code: z.ZodIssueCode.custom, path: ['content', 'videoUrl'], message: 'Video sections need a video URL' })
  if (value.type === 'custom_content' && !value.content.body) context.addIssue({ code: z.ZodIssueCode.custom, path: ['content', 'body'], message: 'Add content for this section' })
  if (['product_grid', 'product_carousel', 'product_collection', 'categories', 'collections'].includes(value.type) && !value.content.categoryId && !value.content.categoryIds?.length && !value.content.productIds?.length && !value.content.collectionKey) context.addIssue({ code: z.ZodIssueCode.custom, path: ['content'], message: 'Choose categories, products, or a collection key' })
})
export const sectionListSchema = envelope(z.object({}).strict(), z.object({}), z.object({ pageKey: z.union([z.literal('home'), slug]).default('home') }).strict())
export const sectionCreateSchema = envelope(section)
export const sectionUpdateSchema = envelope(section, z.object({ sectionId: id }).strict())
export const sectionIdSchema = envelope(z.object({}).strict(), z.object({ sectionId: id }).strict())
export const sectionReorderSchema = envelope(z.object({ pageKey: z.union([z.literal('home'), slug]), sectionIds: z.array(id).min(1).max(100) }).strict().refine((value) => new Set(value.sectionIds).size === value.sectionIds.length, 'Section IDs must be unique'))

const landingTranslation = z.object({ title: z.string().trim().max(160).optional(), summary: z.string().trim().max(500).optional(), seoTitle: z.string().trim().max(70).optional(), seoDescription: z.string().trim().max(170).optional() }).strict()
const landingPage = z.object({ slug: landingSlug, title: z.string().trim().min(2).max(160), summary: z.string().trim().max(500).optional(), translations: z.object({ en: landingTranslation.optional(), bn: landingTranslation.optional() }).strict().optional(), status: z.enum(['draft', 'published']), seo: z.object({ title: z.string().trim().max(70).optional(), description: z.string().trim().max(170).optional() }).strict() }).strict()
export const landingListSchema = envelope(z.object({}).strict(), z.object({}), z.object({}).strict())
export const landingCreateSchema = envelope(landingPage)
export const landingUpdateSchema = envelope(landingPage, z.object({ landingPageId: id }).strict())
export const landingPageIdSchema = envelope(z.object({}).strict(), z.object({ landingPageId: id }).strict())
export const landingSlugSchema = envelope(z.object({}).strict(), z.object({ slug }).strict())
