import { z } from 'zod'
const id = z.string().regex(/^[a-f\d]{24}$/i)
const envelope = (body: z.ZodTypeAny = z.object({}).strict(), params: z.ZodTypeAny = z.object({}).strict(), query: z.ZodTypeAny = z.object({}).strict()) => z.object({ body, params, query }).strict()
const optimizationSettings = z.object({
  enabled: z.boolean(), quality: z.number().int().min(80).max(95), maxWidth: z.number().int().min(300).max(4000), maxHeight: z.number().int().min(300).max(4000),
  preferredFormat: z.enum(['webp', 'avif']), generateThumbnails: z.boolean(), generateResponsiveSizes: z.boolean(), keepOriginal: z.boolean(), deleteUnusedImages: z.boolean(), lazyLoading: z.boolean(),
}).strict()
export const mediaSettingsUpdateSchema = envelope(optimizationSettings)
export const mediaListSchema = envelope(undefined, undefined, z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(30), q: z.string().trim().max(120).optional(), sort: z.enum(['newest', 'largest']).default('newest'), filter: z.enum(['all', 'unused']).default('all') }).strict())
export const mediaAltSchema = envelope(z.object({ altText: z.string().trim().max(250) }).strict(), z.object({ mediaId: id }).strict())
export const mediaIdSchema = envelope(undefined, z.object({ mediaId: id }).strict())
export const mediaJobCreateSchema = envelope(z.object({ type: z.enum(['optimize', 'delete_unused']), assetIds: z.array(id).max(250).optional() }).strict().superRefine((value, context) => {
  if (value.type === 'optimize' && value.assetIds?.length === 0) context.addIssue({ code: z.ZodIssueCode.custom, path: ['assetIds'], message: 'Select at least one image or leave the field out to optimize all media' })
  if (value.type === 'delete_unused' && value.assetIds) context.addIssue({ code: z.ZodIssueCode.custom, path: ['assetIds'], message: 'Unused image cleanup runs against all unreferenced media' })
}), undefined, undefined)
export const mediaJobIdSchema = envelope(undefined, z.object({ jobId: id }).strict())
