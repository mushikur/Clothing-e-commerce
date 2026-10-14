import assert from 'node:assert/strict'
import { test } from 'node:test'
import mongoose from 'mongoose'
import type { Request, Response } from 'express'
import { Order } from '../models/Order.js'
import { User } from '../models/User.js'
import { adminCustomersController } from '../modules/admin/admin.controller.js'

test('customer management accepts guest orders without email and keeps guest identities separate', async () => {
  const aggregate = Order.aggregate, find = User.find
  let query: any, pipeline: any[] = []
  Order.aggregate = (async (stages: any[]) => {
    pipeline = stages
    return [{ rows: [{ _id: 'guest-phone', email: null, name: 'Guest' }, { _id: 'signed-in', email: 'customer@example.test' }], total: [{ value: 2 }] }]
  }) as unknown as typeof Order.aggregate
  User.find = ((filter: any) => { query = filter; return { select: () => ({ lean: async () => [{ email: 'customer@example.test', status: 'active' }] }) } }) as unknown as typeof User.find
  try {
    const payload = await new Promise<any>((resolve, reject) => {
      const response = { status: () => response, json: resolve } as unknown as Response
      const request = { business: { _id: new mongoose.Types.ObjectId() }, validated: { query: { page: 1, limit: 20 } } } as unknown as Request
      adminCustomersController(request, response, reject)
    })
    assert.deepEqual(query.email.$in, ['customer@example.test'])
    assert.equal(payload.data.customers[0].status, 'guest')
    assert.equal(payload.data.customers[1].status, 'active')
    assert.equal(payload.meta.total, 2)
    assert.ok(JSON.stringify(pipeline.find(stage => stage.$group).$group._id).includes('$customer.phone'))
  } finally { Order.aggregate = aggregate; User.find = find }
})
