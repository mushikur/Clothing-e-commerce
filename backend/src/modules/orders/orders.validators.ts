import { z } from 'zod'
import { httpUrl } from '../../utils/http-url.js'
const id = z.string().regex(/^[a-f\d]{24}$/i)
const envelope = (body: z.ZodTypeAny, params: z.ZodTypeAny = z.object({}), query: z.ZodTypeAny = z.object({})) => z.object({ body, params, query }).strict()
export const orderAdminListSchema = envelope(z.object({}).strict(), z.object({}).strict(), z.object({
 page:z.coerce.number().int().min(1).default(1),limit:z.coerce.number().int().min(1).max(100).default(25),
 status:z.enum(['pending','confirmed','processing','packed','shipped','out_for_delivery','delivered','cancelled','returned','refunded']).optional(),
 q:z.string().trim().max(100).optional(),payment:z.enum(['cash_on_delivery','bkash','nagad']).optional(),courier:z.string().trim().regex(/^[a-z][a-z0-9_-]{1,39}$/).optional(),
 from:z.coerce.date().optional(),to:z.coerce.date().optional(),
}).strict().refine(value=>!value.from||!value.to||value.from<=value.to,{message:'Start date must precede end date',path:['to']}))
export const orderIdSchema = envelope(z.object({}).strict(), z.object({ orderId: id }).strict())
export const orderStatusSchema = envelope(z.object({ status: z.enum(['confirmed', 'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned']), note: z.string().trim().max(500).optional(), reason: z.string().trim().min(3).max(500).optional() }).strict(), z.object({ orderId: id }).strict())
export const paymentAdminSchema = envelope(z.object({ action: z.enum(['verify', 'fail', 'refund']), reference: z.string().trim().min(3).max(180).optional(), note: z.string().trim().max(500).optional() }).strict(), z.object({ orderId: id }).strict())
export const returnAdminSchema = envelope(z.object({ action: z.enum(['approve', 'reject']), note: z.string().trim().max(500).optional() }).strict(), z.object({ orderId: id }).strict())
export const customerPaymentSchema = envelope(z.object({ transactionId: z.string().trim().min(3).max(120) }).strict(), z.object({ orderId: id }).strict())
export const guestPaymentSchema = envelope(z.object({ transactionId: z.string().trim().min(3).max(120), guestAccessToken: z.string().regex(/^[a-f\d]{64}$/i) }).strict(), z.object({ orderId: id }).strict())
export const customerReturnSchema = envelope(z.object({ reason: z.string().trim().min(5).max(500) }).strict(), z.object({ orderId: id }).strict())
export const paymentSettingsSchema = envelope(z.object({ paymentMethods: z.array(z.object({ code: z.enum(['bkash', 'nagad']), enabled: z.boolean(), merchantNumber: z.string().trim().max(40).optional(), accountType: z.string().trim().max(40).optional(), instructions: z.string().trim().max(500).optional() }).strict()).max(2) }).strict())
export const shipmentUpsertSchema = envelope(z.object({ provider: z.string().trim().min(2).max(80), trackingNumber: z.string().trim().max(120).optional(), trackingUrl: httpUrl().optional(), status: z.enum(['pending', 'booked', 'picked_up', 'in_transit', 'delivered', 'failed', 'cancelled', 'returned']).optional(), events: z.array(z.object({ code: z.string().trim().min(1).max(80), description: z.string().trim().max(500).optional(), occurredAt: z.coerce.date(), location: z.string().trim().max(160).optional() }).strict()).max(100).optional() }).strict(), z.object({ orderId: id }).strict())
