import { z } from 'zod'
const id = z.string().regex(/^[a-f\d]{24}$/i)
const envelope = (body: z.ZodTypeAny, query: z.ZodTypeAny = z.object({}), params: z.ZodTypeAny = z.object({})) => z.object({ body, params, query }).strict()
const coupon = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,40}$/), type: z.enum(['percent', 'fixed']), value: z.number().positive(), currency: z.string().trim().toUpperCase().length(3).optional(),
  minimumSubtotal: z.number().int().min(0).default(0), startsAt: z.coerce.date(), endsAt: z.coerce.date(), maxRedemptions: z.number().int().min(1).optional(),
  maxRedemptionsPerUser: z.number().int().min(1).default(1), productIds: z.array(id).max(100).default([]), categoryIds: z.array(id).max(100).default([]),
}).strict().superRefine((value, context) => {
  if (value.endsAt < value.startsAt) context.addIssue({ code: z.ZodIssueCode.custom, path: ['endsAt'], message: 'End date must follow the start date' })
  if (value.type === 'percent' && value.value > 100) context.addIssue({ code: z.ZodIssueCode.custom, path: ['value'], message: 'Percent discount cannot exceed 100' })
  if (value.type === 'fixed' && !value.currency) context.addIssue({ code: z.ZodIssueCode.custom, path: ['currency'], message: 'Fixed discounts require a currency' })
  if (new Set(value.productIds).size !== value.productIds.length || new Set(value.categoryIds).size !== value.categoryIds.length) context.addIssue({ code: z.ZodIssueCode.custom, message: 'Product and category selections must be unique' })
})
export const couponCreateSchema = envelope(coupon)
export const couponListSchema = envelope(z.object({}), z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(30), status: z.enum(['active', 'inactive']).optional() }).strict())
export const couponStatusSchema = envelope(z.object({ status: z.enum(['active', 'inactive']) }).strict(), z.object({}), z.object({ couponId: id }).strict())
export const couponIdSchema = envelope(z.object({}).strict(), z.object({}), z.object({ couponId: id }).strict())
export const couponUpdateSchema = envelope(coupon, z.object({}), z.object({ couponId: id }).strict())
