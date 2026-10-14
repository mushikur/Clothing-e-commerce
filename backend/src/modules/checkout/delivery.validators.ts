import { z } from 'zod'
const id = z.string().regex(/^[a-f\d]{24}$/i)
const rule = z.object({
  name: z.string().trim().min(2).max(100), nameTranslations: z.object({ en: z.string().trim().max(100).optional(), bn: z.string().trim().max(100).optional() }).strict().optional(),
  code: z.string().trim().toLowerCase().regex(/^[a-z0-9-]+$/).max(80), scope: z.enum(['default', 'zone', 'division', 'district', 'area']),
  countryCode: z.string().trim().toUpperCase().length(2).optional(), division: z.string().trim().max(80).optional(), district: z.string().trim().max(100).optional(), area: z.string().trim().max(100).optional(), zone: z.enum(['inside_dhaka', 'dhaka_nearby', 'outside_dhaka']).optional(),
  courierCode: z.string().trim().toLowerCase().max(40).optional(), fee: z.number().int().min(0), courierCost: z.number().int().min(0).optional(), freeAbove: z.number().int().min(0).optional(), minimumSubtotal: z.number().int().min(0).optional(), maximumSubtotal: z.number().int().min(0).optional(), codFee: z.number().int().min(0).optional(), onlineFee: z.number().int().min(0).optional(), estimatedDelivery: z.string().trim().min(1).max(80), enabled: z.boolean(),
}).strict().superRefine((data, context) => {
  if (data.scope === 'zone' && !data.zone) context.addIssue({ code: z.ZodIssueCode.custom, path: ['zone'], message: 'Choose a delivery zone' })
  if (['division', 'district', 'area'].includes(data.scope) && !data.division) context.addIssue({ code: z.ZodIssueCode.custom, path: ['division'], message: 'Division is required for this rule' })
  if (['district', 'area'].includes(data.scope) && !data.district) context.addIssue({ code: z.ZodIssueCode.custom, path: ['district'], message: 'District is required for this rule' })
  if (data.scope === 'area' && !data.area) context.addIssue({ code: z.ZodIssueCode.custom, path: ['area'], message: 'Area is required for this rule' })
  if (data.minimumSubtotal != null && data.maximumSubtotal != null && data.maximumSubtotal < data.minimumSubtotal) context.addIssue({ code: z.ZodIssueCode.custom, path: ['maximumSubtotal'], message: 'Maximum order value must be above the minimum' })
})
const envelope = (body: z.ZodTypeAny, params = z.object({}).strict(), query = z.object({}).strict()) => z.object({ body, params, query }).strict()
export const deliveryRuleCreateSchema = envelope(rule)
export const deliveryRuleUpdateSchema = envelope(rule, z.object({ ruleId: id }).strict())
export const deliveryRuleIdSchema = envelope(z.object({}).strict(), z.object({ ruleId: id }).strict())
export const deliveryRuleStatusSchema = envelope(z.object({ enabled: z.boolean() }).strict(), z.object({ ruleId: id }).strict())
export const deliveryQuoteSchema = envelope(z.object({ address: z.object({ countryCode: z.string().length(2), city: z.string().max(100).optional(), region: z.string().max(100).optional(), division: z.string().max(80).optional(), district: z.string().max(100).optional(), area: z.string().max(100).optional(), deliveryLocationId: z.string().regex(/^[a-f\d]{24}$/i).optional() }).strict(), subtotal: z.number().int().min(0), paymentMethod: z.enum(['cash_on_delivery', 'bkash', 'nagad']).optional(), courierCode: z.string().max(40).optional() }).strict())

const locationBody = z.object({ code: z.string().trim().toLowerCase().regex(/^[a-z0-9-]+$/).max(100), name: z.string().trim().min(1).max(100), nameTranslations: z.object({ en: z.string().trim().max(100).optional(), bn: z.string().trim().max(100).optional() }).strict().optional(), aliases: z.array(z.string().trim().min(1).max(100)).max(20).optional(), division: z.string().trim().min(1).max(80), district: z.string().trim().min(1).max(100), area: z.string().trim().min(1).max(100), zone: z.enum(['inside_dhaka','dhaka_nearby','outside_dhaka']), enabled: z.boolean() }).strict()
export const deliveryLocationSearchSchema = envelope(z.object({}).strict(), z.object({}).strict(), z.object({ q: z.string().trim().max(100).default('') }).strict())
export const deliveryLocationCreateSchema = envelope(locationBody)
export const deliveryLocationUpdateSchema = envelope(locationBody, z.object({ locationId: z.string().regex(/^[a-f\d]{24}$/i) }).strict())
export const deliveryLocationStatusSchema = envelope(z.object({ enabled: z.boolean() }).strict(), z.object({ locationId: z.string().regex(/^[a-f\d]{24}$/i) }).strict())
export const deliveryLocationIdSchema = envelope(z.object({}).strict(), z.object({ locationId: z.string().regex(/^[a-f\d]{24}$/i) }).strict())
