import assert from 'node:assert/strict'
import { test } from 'node:test'
import mongoose from 'mongoose'
import request from 'supertest'

process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/fashion-commerce-test'
const { app } = await import('../app.js')
const { AccountToken, Address, Business, Cart, Category, Coupon, DeliveryLocation, DeliveryRule, HomepageSection, Inventory, InventoryTransaction, Notification, Order, OrderItem, Payment, Product, ProductVariant, Promotion, RefreshSession, Review, Shipment, Subcategory, Theme, User, WebsiteSettings, Wishlist } = await import('../models/index.js')

test('liveness endpoint uses the shared response envelope and request id', async () => {
  const response = await request(app).get('/health/live')
  assert.equal(response.status, 200)
  assert.deepEqual(response.body, { success: true, data: { status: 'ok' } })
  assert.ok(response.headers['x-request-id'])
})

test('all commerce foundation models are registered', () => {
  const models = [AccountToken, Address, Business, Cart, Category, Coupon, DeliveryLocation, DeliveryRule, HomepageSection, Inventory, InventoryTransaction, Notification, Order, OrderItem, Payment, Product, ProductVariant, Promotion, RefreshSession, Review, Shipment, Subcategory, Theme, User, WebsiteSettings, Wishlist]
  assert.equal(models.length, 26)
  assert.equal(mongoose.modelNames().length >= models.length, true)
  for (const model of models) assert.equal(typeof model.schema.path('createdAt'), 'object', `${model.modelName} has timestamps`)
})

test('user credentials are private and tenant email uniqueness is indexed', () => {
  assert.equal(User.schema.paths.passwordHash?.options.select, false)
  assert.ok(User.schema.indexes().some(([keys, options]) => keys.businessId === 1 && keys.email === 1 && options.unique === true))
})

test('payment provider references are unique only when a real reference exists', () => {
  const index = Payment.schema.indexes().find(([keys]) => keys.businessId === 1 && keys.provider === 1 && keys.providerReference === 1)
  assert.ok(index)
  assert.equal(index[1].unique, true)
  assert.deepEqual(index[1].partialFilterExpression, { providerReference: { $type: 'string' } })
  assert.equal(index[1].sparse, undefined)
})

test('invalid product variant and inventory quantities fail validation', async () => {
  const businessId = new mongoose.Types.ObjectId()
  const productId = new mongoose.Types.ObjectId()
  const variant = new ProductVariant({ businessId, productId, sku: 'bad-price', price: 100, compareAtPrice: 90 })
  await assert.rejects(variant.validate())
  const fractional = new ProductVariant({ businessId, productId, sku: 'fractional-price', price: 10.5 })
  await assert.rejects(fractional.validate())
  const inventory = new Inventory({ businessId, variantId: new mongoose.Types.ObjectId(), onHand: 2, reserved: 3 })
  await assert.rejects(inventory.validate())
})

test('coupon date and percentage constraints are validated', async () => {
  const businessId = new mongoose.Types.ObjectId()
  const percentCoupon = new Coupon({ businessId, code: 'too-much', type: 'percent', value: 110, startsAt: new Date('2026-01-02'), endsAt: new Date('2026-01-01') })
  await assert.rejects(percentCoupon.validate())
})

test('homepage section and order totals enforce domain constraints', async () => {
  const businessId = new mongoose.Types.ObjectId()
  const section = new HomepageSection({ businessId, type: 'hero' })
  await assert.rejects(section.validate())
  const address = { recipientName: 'Test Customer', phone: '+10000000000', line1: '1 Main Street', city: 'City', countryCode: 'US' }
  const order = new Order({ businessId, orderNumber: 'ORD-1', userId: new mongoose.Types.ObjectId(), currency: 'USD', subtotal: 1000, discountTotal: 100, shippingTotal: 50, taxTotal: 25, grandTotal: 1000, shippingAddress: address, billingAddress: address })
  await assert.rejects(order.validate())
})

test('inventory transaction records are immutable and do not receive updatedAt', () => {
  assert.equal(InventoryTransaction.schema.paths.quantityDelta?.options.immutable, true)
  assert.equal(InventoryTransaction.schema.paths.updatedAt, undefined)
})
