import assert from 'node:assert/strict'
import { test } from 'node:test'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import request from 'supertest'
import mongoose from 'mongoose'

const uri = process.env.ADMIN_INTEGRATION_MONGODB_URI
process.env.MONGODB_URI ||= uri || 'mongodb://127.0.0.1:27017/fashion-commerce-test'
const { app } = await import('../app.js')
const { env } = await import('../config/env.js')
const { Business, Category, CustomerArchive, Order, Product, ProductVariant, RefreshSession, User } = await import('../models/index.js')

test('admin account and recoverable deletion work with real database records', { skip: !uri }, async () => {
  await mongoose.connect(uri!)
  let tenant: mongoose.Types.ObjectId | undefined
  try {
    const business = await Business.create({ name: 'Disposable admin acceptance store', slug: `admin-qa-${Date.now()}` })
    tenant = business._id
    const admin = await User.create({ businessId: tenant, name: 'Test administrator', email: 'admin@example.test', role: 'admin', status: 'active', passwordHash: await bcrypt.hash('fixture-current-password', 12) })
    const customer = await User.create({ businessId: tenant, name: 'Test customer', email: 'customer@example.test', role: 'customer', status: 'active', passwordHash: 'x'.repeat(60) })
    const noOrders = await User.create({ businessId: tenant, name: 'Customer without orders', email: 'no-orders@example.test', role: 'customer', status: 'active', passwordHash: 'x'.repeat(60) })
    const staff = await User.create({ businessId: tenant, name: 'Test staff', email: 'staff@example.test', role: 'staff', status: 'active', passwordHash: 'x'.repeat(60) })
    const headersFor = (user: typeof admin) => ({ Authorization: `Bearer ${jwt.sign({ businessId: business.id, role: user.role, tokenUse: 'access' }, env.ACCESS_TOKEN_SECRET, { subject: user.id, issuer: 'fashion-commerce-api', audience: business.id, expiresIn: '5m' })}`, 'X-Business-Slug': business.slug })
    const headers = headersFor(admin)
    const address = { recipientName: 'Fixture Customer', phone: '00000000000', line1: 'Test address', city: 'Dhaka', countryCode: 'BD' }
    const order = await Order.create({ businessId: tenant, userId: customer._id, orderNumber: 'QA-CANCELLED', customer: { name: customer.name, email: customer.email, phone: '00000000000' }, status: 'cancelled', currency: 'BDT', subtotal: 10000, shippingTotal: 6000, grandTotal: 16000, shippingAddress: address, billingAddress: address })
    const open = await Order.create({ businessId: tenant, orderNumber: 'QA-OPEN', customer: { name: 'Guest', phone: '00000000001' }, currency: 'BDT', subtotal: 10000, grandTotal: 10000, shippingAddress: address, billingAddress: address })
    const protectedOrder = await Order.create({ businessId: tenant, userId: admin._id, orderNumber: 'QA-PROTECTED', customer: { name: admin.name, email: admin.email, phone: '00000000002' }, status: 'cancelled', currency: 'BDT', subtotal: 10000, grandTotal: 10000, shippingAddress: address, billingAddress: address })
    const category = await Category.create({ businessId: tenant, name: 'Fixture clothing', slug: 'fixture-clothing' })
    const product = await Product.create({ businessId: tenant, categoryId: category._id, name: 'Disposable product', slug: 'disposable-product', sku: 'QA-PRODUCT', price: 10000 })
    const variant = await ProductVariant.create({ businessId: tenant, productId: product._id, sku: 'QA-PRODUCT-BLACK-M', color: 'Black', size: 'M', price: 10000, currency: 'BDT', isActive: true })
    const del = (kind: string, key: string) => request(app).delete(`/api/v1/admin/trash/${kind}/${key}`).set(headers)
    const restore = (kind: string, key: string) => request(app).post(`/api/v1/admin/trash/${kind}/${key}/restore`).set(headers)
    const expectStatus = (result: { status: number; body: unknown }, code: number) => assert.equal(result.status, code, JSON.stringify(result.body))
    expectStatus(await del('order', open.id), 409)
    expectStatus(await request(app).delete(`/api/v1/admin/trash/order/${order.id}`).set(headersFor(staff)), 403)
    expectStatus(await request(app).delete(`/api/v1/admin/trash/order/${order.id}`).set(headersFor(customer)), 403)
    expectStatus(await del('customer', admin.id), 403)
    expectStatus(await del('order', order.id), 200)
    const trash = await request(app).get('/api/v1/admin/trash?kind=order').set(headers)
    expectStatus(trash, 200); assert.equal(trash.body.data.items[0].key, order.id)
    const list = await request(app).get('/api/v1/admin/orders').set(headers)
    expectStatus(list, 200); assert.equal(list.body.data.orders.some((row: any) => row._id === order.id), false)
    expectStatus(await request(app).get(`/api/v1/users/me/orders/${order.id}`).set(headersFor(customer)), 404)
    expectStatus(await restore('order', order.id), 200)
    assert.equal((await Order.findById(order.id))!.shippingTotal, 6000)
    expectStatus(await del('customer', customer.id), 200)
    assert.equal((await User.findById(customer.id))!.status, 'suspended')
    const directory = await request(app).get('/api/v1/admin/customers').set(headers)
    expectStatus(directory, 200); assert.equal(directory.body.data.customers.some((row: any) => row._id === customer.id), false)
    expectStatus(await restore('customer', customer.id), 200)
    assert.equal((await User.findById(customer.id))!.status, 'active')
    const allCustomers = await request(app).get('/api/v1/admin/customers').set(headers)
    assert.equal(allCustomers.body.data.customers.some((row: any) => row._id === noOrders.id && row.orders === 0), true)
    expectStatus(await del('customer', noOrders.id), 200)
    expectStatus(await restore('customer', noOrders.id), 200)
    await Order.updateOne({ _id: order._id }, { $unset: { userId: 1 } })
    const guestMerged = await request(app).get('/api/v1/admin/customers').set(headers)
    assert.equal(guestMerged.body.data.customers.filter((row: any) => row.email === customer.email).length, 1)
    expectStatus(await del('customer', customer.id), 200)
    const hiddenMerged = await request(app).get('/api/v1/admin/customers').set(headers)
    assert.equal(hiddenMerged.body.data.customers.some((row: any) => row.email === customer.email), false)
    expectStatus(await restore('customer', customer.id), 200)
    expectStatus(await del('product', product.id), 200)
    assert.equal((await Product.findById(product.id))!.status, 'archived')
    assert.equal((await ProductVariant.findById(variant.id))!.isActive, false)
    expectStatus(await restore('product', product.id), 200)
    assert.equal((await Product.findById(product.id))!.status, 'draft')
    assert.equal((await ProductVariant.findById(variant.id))!.isActive, true)
    expectStatus(await request(app).patch('/api/v1/users/me').set(headers).send({ name: 'Updated administrator' }), 200)
    assert.equal((await User.findById(admin.id))!.name, 'Updated administrator')
    const password = (currentPassword: string) => request(app).post('/api/v1/auth/change-password').set(headers).set('Origin', 'http://localhost:5173').send({ currentPassword, newPassword: 'fixture-updated-password' })
    expectStatus(await password('incorrect-password'), 400)
    expectStatus(await password('fixture-current-password'), 200)
    assert.equal(await bcrypt.compare('fixture-updated-password', (await User.findById(admin.id).select('+passwordHash'))!.passwordHash), true)
    assert.equal(await Order.countDocuments({ businessId: tenant }), 3)
    assert.ok(protectedOrder)
  } finally {
    if (tenant) {
      for (const model of [Order, ProductVariant, Product, Category, CustomerArchive, RefreshSession, User]) await model.deleteMany({ businessId: tenant })
      await Business.deleteOne({ _id: tenant })
    }
    await mongoose.disconnect()
  }
})
