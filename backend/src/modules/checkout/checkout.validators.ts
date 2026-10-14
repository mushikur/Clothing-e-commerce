import { z } from 'zod'

const id = z.string().regex(/^[a-f\d]{24}$/i)
const line = z.object({ variantId: id, quantity: z.number().int().min(1).max(99) }).strict()
const address = z.object({
  recipientName: z.string().trim().min(1).max(100), phone: z.string().trim().min(5).max(32),
  line1: z.string().trim().min(1).max(160), line2: z.string().trim().max(160).optional(), city: z.string().trim().min(1).max(100),
  region: z.string().trim().max(100).optional(), division: z.string().trim().max(80).optional(), district: z.string().trim().max(100).optional(), area: z.string().trim().max(100).optional(), deliveryLocationId: z.string().regex(/^[a-f\d]{24}$/i).optional(), deliveryLocationName: z.string().trim().max(100).optional(), deliveryZone: z.enum(['inside_dhaka','dhaka_nearby','outside_dhaka']).optional(), postalCode: z.string().trim().max(24).optional(), countryCode: z.string().trim().length(2),
  deliveryInstructions: z.string().trim().max(500).optional(),
}).strict()
const customer = z.object({ name: z.string().trim().min(1).max(100), email: z.string().trim().email().max(254).optional(), phone: z.string().trim().min(5).max(32) }).strict()
const checkoutFields = {
  items: z.array(line).min(1).max(50).refine((items) => new Set(items.map((item) => item.variantId)).size === items.length, 'Each product option can only appear once'),
  couponCode: z.string().trim().max(40).optional(), deliveryOptionCode: z.string().trim().min(1).max(40).optional(),
  deliveryAddress: z.object({ countryCode: z.string().length(2), city: z.string().max(100).optional(), region: z.string().max(100).optional(), division: z.string().max(80).optional(), district: z.string().max(100).optional(), area: z.string().max(100).optional(), deliveryLocationId: z.string().regex(/^[a-f\d]{24}$/i).optional() }).strict().optional(),
  paymentMethod: z.enum(['cash_on_delivery', 'bkash', 'nagad']).optional(), addressId: id.optional(), address: address.optional(), customer: customer.optional(),
  notes: z.string().trim().max(1000).optional(), saveAddress: z.boolean().optional(), idempotencyKey: z.string().trim().min(16).max(120).optional(),
  clearCart: z.boolean().optional(), expectedTotal: z.number().int().min(0).optional(),
}
const bodySchema = z.object(checkoutFields).strict()
  .refine((body) => Boolean(body.addressId || body.address), 'Select a saved address or provide a delivery address')
  .refine((body) => Boolean(body.addressId || body.address?.countryCode.toUpperCase() !== 'BD' || body.address.deliveryLocationId), { message: 'Choose a delivery location from the suggestions', path: ['address', 'deliveryLocationId'] })
const envelope = (body: z.ZodTypeAny) => z.object({ body, params: z.object({}), query: z.object({}) }).strict()

export const checkoutQuoteSchema = envelope(z.object({ items: checkoutFields.items, couponCode: checkoutFields.couponCode, deliveryOptionCode: checkoutFields.deliveryOptionCode, deliveryAddress: checkoutFields.deliveryAddress, paymentMethod: checkoutFields.paymentMethod }).strict())
export const checkoutOrderSchema = envelope(bodySchema)
export const checkoutPolicySchema = envelope(z.object({
  guestCheckoutEnabled: z.boolean(), cashOnDeliveryEnabled: z.boolean(),
  deliveryOptions: z.array(z.object({ code: z.string().trim().toLowerCase().regex(/^[a-z0-9_-]+$/).max(40), label: z.string().trim().min(1).max(80), fee: z.number().int().min(0), freeAbove: z.number().int().min(0).optional(), estimatedDays: z.string().trim().max(40).optional(), enabled: z.boolean() }).strict()).max(10),
}).strict().refine((body) => new Set(body.deliveryOptions.map((option) => option.code)).size === body.deliveryOptions.length, 'Delivery option codes must be unique'))
