import { z } from 'zod'
const id = z.string().regex(/^[a-f\d]{24}$/i)
export const cartItemSchema = z.object({ body: z.object({ variantId: id, quantity: z.number().int().min(1).max(99) }).strict(), params: z.object({}), query: z.object({}) }).strict()
export const cartUpdateSchema = z.object({ body: z.object({ quantity: z.number().int().min(1).max(99) }).strict(), params: z.object({ variantId: id }), query: z.object({}) }).strict()
export const cartVariantSchema = z.object({ body: z.object({}), params: z.object({ variantId: id }), query: z.object({}) }).strict()
