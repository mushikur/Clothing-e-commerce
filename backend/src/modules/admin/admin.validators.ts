import { z } from 'zod'
const id = z.string().regex(/^[a-f\d]{24}$/i)
const envelope = (body: z.ZodTypeAny, params: z.ZodTypeAny, query: z.ZodTypeAny) => z.object({ body, params, query }).strict()
export const analyticsSchema = envelope(z.object({}).strict(), z.object({}).strict(), z.object({ from: z.coerce.date(), to: z.coerce.date() }).strict().refine((range) => range.to > range.from && range.to.getTime() - range.from.getTime() <= 367 * 24 * 60 * 60 * 1000, 'Date range must be positive and no longer than one year'))
export const customerListSchema = envelope(z.object({}).strict(), z.object({}).strict(), z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(30), q: z.string().trim().max(120).optional() }).strict())
export const inventoryListSchema = envelope(z.object({}).strict(), z.object({}).strict(), z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(30), filter: z.enum(['low', 'out']).optional(), q: z.string().trim().max(120).optional() }).strict())
export const inventoryHistorySchema = envelope(z.object({}).strict(), z.object({}).strict(), z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(50), variantId: id.optional() }).strict())
