import { z } from 'zod'

const bodyEnvelope = (body: z.ZodTypeAny) => z.object({ body, params: z.object({}), query: z.object({}) })
const addressFields = {
  label: z.string().trim().max(40).optional(), recipientName: z.string().trim().min(1).max(100), phone: z.string().trim().min(5).max(32),
  line1: z.string().trim().min(1).max(160), line2: z.string().trim().max(160).optional(), city: z.string().trim().min(1).max(100),
  region: z.string().trim().max(100).optional(), division: z.string().trim().max(80).optional(), district: z.string().trim().max(100).optional(), area: z.string().trim().max(100).optional(), postalCode: z.string().trim().max(24).optional(), countryCode: z.string().trim().length(2),
  deliveryInstructions: z.string().trim().max(500).optional(), isDefaultShipping: z.boolean().optional(), isDefaultBilling: z.boolean().optional(),
}
export const profileSchema = bodyEnvelope(z.object({ name: z.string().trim().min(1).max(100).optional(), phone: z.string().trim().max(32).optional() }).strict().refine((body) => Object.keys(body).length > 0, 'Provide at least one profile field'))
export const addressCreateSchema = bodyEnvelope(z.object(addressFields).strict())
export const addressUpdateSchema = bodyEnvelope(z.object(addressFields).partial().strict())
export const addressIdSchema = z.object({ body: z.object({}), params: z.object({ addressId: z.string().regex(/^[a-f\d]{24}$/i) }), query: z.object({}) })
export const orderIdSchema = z.object({ body: z.object({}), params: z.object({ orderId: z.string().regex(/^[a-f\d]{24}$/i) }), query: z.object({}) })
export const wishlistProductIdSchema = z.object({ body: z.object({}), params: z.object({ productId: z.string().regex(/^[a-f\d]{24}$/i) }), query: z.object({}) })
export const wishlistMoveSchema = z.object({ body: z.object({ variantId: z.string().regex(/^[a-f\d]{24}$/i), quantity: z.number().int().min(1).max(99).default(1) }).strict(), params: z.object({ productId: z.string().regex(/^[a-f\d]{24}$/i) }), query: z.object({}) }).strict()
export const listSchema = z.object({ body: z.object({}), params: z.object({}), query: z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(50).default(20) }) })
