import { z } from 'zod'
import { httpUrl } from '../../utils/http-url.js'

const id = z.string().regex(/^[a-f\d]{24}$/i)
const responsiveVariantSchema = z.object({ label: z.enum(['thumbnail', 'small', 'medium', 'large', 'xlarge']), width: z.number().int().min(1).max(4000), height: z.number().int().min(1).max(4000), format: z.enum(['jpeg', 'png', 'webp', 'avif']), url: httpUrl() }).strict()
const responsiveImageFields = { width: z.number().int().min(1).max(12000).optional(), height: z.number().int().min(1).max(12000).optional(), responsiveVariants: z.array(responsiveVariantSchema).max(8).optional() }
const mediaSchema = z.object({ kind: z.enum(['image', 'video']).default('image'), url: httpUrl(), alt: z.string().max(250).optional(), sortOrder: z.number().int().min(0).default(0), ...responsiveImageFields }).strict()
const imageSchema = z.object({ url: httpUrl(), alt: z.string().max(250).optional(), sortOrder: z.number().int().min(0).default(0), ...responsiveImageFields }).strict()
const variantSchema = z.object({
  sku: z.string().trim().min(1).max(80), color: z.string().trim().min(1).max(80), colorCode: z.string().regex(/^#[\da-f]{6}$/i).optional(), size: z.string().trim().min(1).max(24),
  price: z.number().int().min(0), compareAtPrice: z.number().int().min(0).optional(), currency: z.string().length(3).default('USD'), stock: z.number().int().min(0), images: z.array(imageSchema).max(20).default([]), isActive: z.boolean().default(true),
}).strict()
const localizedProductFields = z.object({ name: z.string().trim().max(180).optional(), shortDescription: z.string().trim().max(500).optional(), description: z.string().max(20_000).optional(), slug: z.string().trim().max(180).optional(), seoTitle: z.string().trim().max(70).optional(), seoDescription: z.string().trim().max(170).optional() }).strict()
const productFields = {
  name: z.string().trim().min(1).max(180), slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(180), sku: z.string().trim().min(1).max(80),
  description: z.string().max(20_000).optional(), shortDescription: z.string().max(500).optional(), categoryId: id, subcategoryId: id.optional(), brand: z.string().trim().max(100).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(30).default([]), price: z.number().int().min(0), discountPercent: z.number().int().min(0).max(100).default(0), costPrice: z.number().int().min(0).optional(),
  media: z.array(mediaSchema).max(30).default([]), material: z.string().max(120).optional(), fabric: z.string().max(120).optional(), gender: z.enum(['women', 'men', 'unisex', 'kids', 'unspecified']).default('unspecified'),
  season: z.string().max(60).optional(), collection: z.string().max(100).optional(), status: z.enum(['draft', 'published', 'archived']).default('draft'),
  seo: z.object({ title: z.string().max(70).optional(), description: z.string().max(170).optional(), canonicalUrl: httpUrl().optional() }).strict().optional(),
  translations: z.object({ en: localizedProductFields.optional(), bn: localizedProductFields.optional() }).strict().optional(),
  variants: z.array(variantSchema).min(1).max(500),
}
const validateProduct = (value: { variants: Array<{ color: string; size: string; sku: string; images: Array<unknown> }>; status: string; media: Array<{ kind: string }>; discountPercent: number }) => {
  const combinations = value.variants.map((variant) => `${variant.color.trim().toLowerCase()}|${variant.size.trim().toUpperCase()}`)
  const skus = value.variants.map((variant) => variant.sku.trim().toUpperCase())
  if (new Set(combinations).size !== combinations.length) return false
  if (new Set(skus).size !== skus.length) return false
  if (value.status === 'published' && !value.media.some((item) => item.kind === 'image') && !value.variants.some((item) => item.images.length > 0)) return false
  return value.discountPercent >= 0
}

export const productListSchema = z.object({ body: z.object({}), params: z.object({}), query: z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1), limit: z.coerce.number().int().min(1).max(48).default(24), q: z.string().trim().min(1).max(80).optional(),
  categoryId: id.optional(), subcategoryId: id.optional(), color: z.string().trim().max(80).optional(), size: z.string().trim().max(24).optional(), brand: z.string().trim().max(100).optional(),
  gender: z.enum(['women', 'men', 'unisex', 'kids']).optional(), season: z.string().trim().max(60).optional(), minPrice: z.coerce.number().int().min(0).optional(), maxPrice: z.coerce.number().int().min(0).optional(), inStock: z.enum(['true', 'false']).optional(),
  discounted: z.enum(['true']).optional(),
  sort: z.enum(['newest', 'name_asc', 'name_desc', 'price_asc', 'price_desc']).default('newest'),
}).strict() }).strict()

export const productBySlugSchema = z.object({ body: z.object({}), params: z.object({ slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(180) }), query: z.object({}) }).strict()
export const productReviewsSchema = z.object({ body: z.object({}), params: z.object({ slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(180) }), query: z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(50).default(10) }) }).strict()
export const productAdminListSchema = z.object({ body: z.object({}), params: z.object({}), query: z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(30), q: z.string().trim().max(80).optional(), status: z.enum(['draft', 'published', 'archived']).optional(), sort: z.enum(['updated_desc', 'name_asc', 'name_desc', 'price_asc', 'price_desc']).default('updated_desc') }).strict() }).strict()
export const productIdSchema = z.object({ body: z.object({}), params: z.object({ productId: id }), query: z.object({}) }).strict()
export const productCreateSchema = z.object({ body: z.object(productFields).strict().refine(validateProduct, 'Variants must have unique color and size combinations and SKUs; published products need images'), params: z.object({}), query: z.object({}) }).strict()
export const productUpdateSchema = z.object({ body: z.object(productFields).strict().refine(validateProduct, 'Variants must have unique color and size combinations and SKUs; published products need images'), params: z.object({ productId: id }), query: z.object({}) }).strict()
export const stockSchema = z.object({ body: z.object({ quantity: z.number().int().min(0), reason: z.string().trim().min(3).max(300) }).strict(), params: z.object({ productId: id, variantId: id }), query: z.object({}) }).strict()
export const duplicateSchema = z.object({ body: z.object({ slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(180), sku: z.string().trim().min(1).max(80) }).strict(), params: z.object({ productId: id }), query: z.object({}) }).strict()
export const bulkEditSchema = z.object({ body: z.object({ productIds: z.array(id).min(1).max(100), changes: z.object({ brand: z.string().max(100).optional(), collection: z.string().max(100).optional(), tags: z.array(z.string().max(40)).max(30).optional(), status: z.enum(['draft', 'published', 'archived']).optional(), discountPercent: z.number().int().min(0).max(100).optional(), categoryId: id.optional(), material: z.string().max(120).optional(), season: z.string().max(60).optional() }).strict() }).strict().refine((body) => Object.keys(body.changes).length > 0), params: z.object({}), query: z.object({}) }).strict()
const localizedTaxonomy = z.object({ name: z.string().trim().max(100).optional(), description: z.string().trim().max(1000).optional() }).strict()
const taxonomyTranslations = z.object({ en: localizedTaxonomy.optional(), bn: localizedTaxonomy.optional() }).strict().optional()
export const categoryCreateSchema = z.object({ body: z.object({ name: z.string().trim().min(1).max(100), slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100), description: z.string().max(1000).optional(), translations: taxonomyTranslations, imageUrl: httpUrl().optional(), sortOrder: z.number().int().min(0).optional() }).strict(), params: z.object({}), query: z.object({}) }).strict()
export const categoryUpdateSchema = z.object({ body: z.object({ name: z.string().trim().min(1).max(100).optional(), slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100).optional(), description: z.string().max(1000).optional(), translations: taxonomyTranslations, imageUrl: httpUrl().optional(), sortOrder: z.number().int().min(0).optional(), status: z.enum(['active', 'inactive']).optional() }).strict().refine((body) => Object.keys(body).length > 0), params: z.object({ categoryId: id }), query: z.object({}) }).strict()
export const subcategoryCreateSchema = z.object({ body: z.object({ categoryId: id, name: z.string().trim().min(1).max(100), slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100), description: z.string().max(1000).optional(), translations: taxonomyTranslations, imageUrl: httpUrl().optional(), sortOrder: z.number().int().min(0).optional() }).strict(), params: z.object({}), query: z.object({}) }).strict()
export const subcategoryUpdateSchema = z.object({ body: z.object({ name: z.string().trim().min(1).max(100).optional(), slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100).optional(), description: z.string().max(1000).optional(), translations: taxonomyTranslations, imageUrl: httpUrl().optional(), sortOrder: z.number().int().min(0).optional(), status: z.enum(['active', 'inactive']).optional() }).strict().refine((body) => Object.keys(body).length > 0), params: z.object({ subcategoryId: id }), query: z.object({}) }).strict()
export const categoryIdSchema = z.object({ body: z.object({}), params: z.object({ categoryId: id }), query: z.object({}) }).strict()
export const subcategoryIdSchema = z.object({ body: z.object({}), params: z.object({ subcategoryId: id }), query: z.object({}) }).strict()
