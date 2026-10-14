import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { test } from 'node:test'
import { checkoutOrderSchema, checkoutPolicySchema, checkoutQuoteSchema } from '../modules/checkout/checkout.validators.js'
import { couponCreateSchema } from '../modules/checkout/coupons.validators.js'
import { Order } from '../models/Order.js'
import { deliveryLocationCreateSchema, deliveryRuleCreateSchema } from '../modules/checkout/delivery.validators.js'

const variantId = '507f1f77bcf86cd799439011'
const quoteInput = (items: Array<{ variantId: string; quantity: number }>) => ({ body: { items, deliveryOptionCode: 'standard' }, params: {}, query: {} })

test('checkout quote rejects malformed variants, duplicate lines, and invalid quantities', () => {
  assert.equal(checkoutQuoteSchema.safeParse(quoteInput([{ variantId: 'bad-id', quantity: 1 }])).success, false)
  assert.equal(checkoutQuoteSchema.safeParse(quoteInput([{ variantId, quantity: 1 }, { variantId, quantity: 2 }])).success, false)
  assert.equal(checkoutQuoteSchema.safeParse(quoteInput([{ variantId, quantity: 0 }])).success, false)
})

test('checkout order requires a delivery address and supported payment method', () => {
  const validAddress = { recipientName: 'A. Customer', phone: '+8801555555555', line1: '10 Main Street', city: 'Dhaka', countryCode: 'BD', deliveryLocationId: '507f1f77bcf86cd799439012' }
  const base = { items: [{ variantId, quantity: 1 }], deliveryOptionCode: 'standard', idempotencyKey: 'test-checkout-key-0001', customer: { name: 'A. Customer', email: 'a@example.test', phone: '+8801555555555' }, address: validAddress }
  assert.equal(checkoutOrderSchema.safeParse({ body: base, params: {}, query: {} }).success, true)
  assert.equal(checkoutOrderSchema.safeParse({ body: { ...base, customer: { name: 'A. Customer', phone: '+8801555555555' } }, params: {}, query: {} }).success, true)
  assert.equal(checkoutOrderSchema.safeParse({ body: { ...base, paymentMethod: 'unconfigured_gateway' }, params: {}, query: {} }).success, false)
  assert.equal(checkoutOrderSchema.safeParse({ body: { ...base, address: { ...validAddress, deliveryLocationId: undefined } }, params: {}, query: {} }).success, false)
  assert.equal(checkoutOrderSchema.safeParse({ body: { ...base, address: undefined }, params: {}, query: {} }).success, false)
})

test('checkout policy requires unique delivery codes and integer fees', () => {
  const option = { code: 'standard', label: 'Standard delivery', fee: 800, enabled: true }
  const body = { guestCheckoutEnabled: true, cashOnDeliveryEnabled: true, deliveryOptions: [option] }
  assert.equal(checkoutPolicySchema.safeParse({ body, params: {}, query: {} }).success, true)
  assert.equal(checkoutPolicySchema.safeParse({ body: { ...body, deliveryOptions: [option, option] }, params: {}, query: {} }).success, false)
  assert.equal(checkoutPolicySchema.safeParse({ body: { ...body, deliveryOptions: [{ ...option, fee: 8.5 }] }, params: {}, query: {} }).success, false)
})

test('delivery rules validate geographic specificity, nonnegative prices, and ETA', () => {
  const base = { name: 'Mirpur delivery', code: 'mirpur', scope: 'area', countryCode: 'BD', division: 'Dhaka', district: 'Dhaka', area: 'Mirpur', fee: 6000, estimatedDelivery: '1–2 business days', enabled: true }
  const request = (body: object) => ({ body, params: {}, query: {} })
  assert.equal(deliveryRuleCreateSchema.safeParse(request(base)).success, true)
  assert.equal(deliveryRuleCreateSchema.safeParse(request({ ...base, fee: -1 })).success, false)
  assert.equal(deliveryRuleCreateSchema.safeParse(request({ ...base, area: '' })).success, false)
  assert.equal(deliveryRuleCreateSchema.safeParse(request({ ...base, estimatedDelivery: '' })).success, false)
  assert.equal(deliveryRuleCreateSchema.safeParse(request({ ...base, minimumSubtotal: 2000, maximumSubtotal: 1000 })).success, false)
  const zoneRule = { ...base, name: 'Dhaka nearby', code: 'dhaka-nearby', scope: 'zone', zone: 'dhaka_nearby', division: undefined, district: undefined, area: undefined }
  assert.equal(deliveryRuleCreateSchema.safeParse(request(zoneRule)).success, true)
  assert.equal(deliveryRuleCreateSchema.safeParse(request({ ...zoneRule, zone: 'unknown' })).success, false)
})

test('delivery location mappings require a valid Bangladesh zone and structured district', () => {
  const body = { code: 'dhaka-dhaka-mirpur', name: 'Mirpur', nameTranslations: { en: 'Mirpur', bn: 'মিরপুর' }, aliases: ['মিরপুর'], division: 'Dhaka', district: 'Dhaka', area: 'Mirpur', zone: 'inside_dhaka', enabled: true }
  const request = { body, params: {}, query: {} }
  assert.equal(deliveryLocationCreateSchema.safeParse(request).success, true)
  assert.equal(deliveryLocationCreateSchema.safeParse({ ...request, body: { ...body, zone: 'unknown' } }).success, false)
  assert.equal(deliveryLocationCreateSchema.safeParse({ ...request, body: { ...body, area: '' } }).success, false)
})

test('coupon configuration rejects invalid discounts and date ranges', () => {
  const body = { code: 'SAVE10', type: 'percent', value: 10, startsAt: '2026-10-01T00:00:00.000Z', endsAt: '2026-10-31T00:00:00.000Z' }
  assert.equal(couponCreateSchema.safeParse({ body, params: {}, query: {} }).success, true)
  assert.equal(couponCreateSchema.safeParse({ body: { ...body, value: 101 }, params: {}, query: {} }).success, false)
  assert.equal(couponCreateSchema.safeParse({ body: { ...body, type: 'fixed', value: 500 }, params: {}, query: {} }).success, false)
  assert.equal(couponCreateSchema.safeParse({ body: { ...body, startsAt: '2026-11-01T00:00:00.000Z' }, params: {}, query: {} }).success, false)
})

test('guest order snapshots validate without a customer account and retain exact totals', async () => {
  const order = new Order({
    businessId: new mongoose.Types.ObjectId(), orderNumber: 'ORD-20261012-ABCD1234', idempotencyKey: 'guest-checkout-key-0001',
    customer: { name: 'A. Customer', email: 'a@example.test', phone: '+8801555555555' }, status: 'pending', currency: 'USD',
    subtotal: 5000, discountTotal: 500, shippingTotal: 800, grandTotal: 5300,
    deliveryOptionCode: 'standard', deliveryOptionLabel: 'Standard delivery', deliverySnapshot: { name: 'Inside Dhaka', code: 'inside-dhaka', zone: 'inside_dhaka', customerCharge: 800, estimatedDelivery: '1–2 business days', method: 'cash_on_delivery' },
    shippingAddress: { recipientName: 'A. Customer', phone: '+8801555555555', line1: '10 Main Street', city: 'Dhaka', countryCode: 'BD' },
    billingAddress: { recipientName: 'A. Customer', phone: '+8801555555555', line1: '10 Main Street', city: 'Dhaka', countryCode: 'BD' },
  })
  await order.validate()
  assert.equal(order.grandTotal, order.subtotal - order.discountTotal + order.shippingTotal)
  assert.equal(order.deliverySnapshot?.customerCharge, 800)
})

test('guest order can be saved without an email address', async () => {
  const order = new Order({
    businessId: new mongoose.Types.ObjectId(), orderNumber: 'ORD-20261013-EMAIL0001',
    customer: { name: 'A. Customer', phone: '+8801555555555' }, status: 'pending', currency: 'BDT',
    subtotal: 5000, shippingTotal: 600, grandTotal: 5600,
    shippingAddress: { recipientName: 'A. Customer', phone: '+8801555555', line1: 'House 12, Road 5', city: 'Dhaka', region: 'Dhaka', division: 'Dhaka', district: 'Dhaka', area: 'Mirpur', countryCode: 'BD' },
    billingAddress: { recipientName: 'A. Customer', phone: '+8801555555', line1: 'House 12, Road 5', city: 'Dhaka', region: 'Dhaka', division: 'Dhaka', district: 'Dhaka', area: 'Mirpur', countryCode: 'BD' },
  })
  await order.validate()
  assert.equal(order.customer.email, undefined)
  assert.equal(order.shippingAddress.area, 'Mirpur')
})
