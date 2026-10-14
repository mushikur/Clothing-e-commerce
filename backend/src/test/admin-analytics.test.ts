import assert from 'node:assert/strict'
import { test } from 'node:test'
import mongoose from 'mongoose'
import type { Request, Response } from 'express'
import { adminAnalyticsController } from '../modules/admin/admin.controller.js'
import { Order } from '../models/Order.js'
import { OrderItem } from '../models/OrderItem.js'
import { Product } from '../models/Product.js'
import { Inventory } from '../models/Inventory.js'
import { ProductViewDaily } from '../models/ProductViewDaily.js'

test('analytics keeps selected-period totals distinct from today totals and retains profit coverage', async () => {
  const original = { orderAggregate: Order.aggregate, orderCount: Order.countDocuments, itemAggregate: OrderItem.aggregate, productCount: Product.countDocuments, inventoryAggregate: Inventory.aggregate, viewAggregate: ProductViewDaily.aggregate }
  Order.aggregate = (async (pipeline: any[]) => {
    const group = pipeline.find(stage => stage.$group)?.$group
    if (group?.completeCostRevenue) return [{ revenue: 50000, orders: 10, completeCostRevenue: 45000, costOfGoods: 20000, ordersWithCost: 10, ordersWithoutCost: 0 }]
    if (group?.emails) return [{ date: '2026-10-12', revenue: 50000, sales: 12, orders: 10, customers: 4 }]
    if (group?.revenue) return [{ revenue: 10000, orders: 2 }]
    return []
  }) as unknown as typeof Order.aggregate
  Order.countDocuments = (async () => 2) as unknown as typeof Order.countDocuments
  OrderItem.aggregate = (async () => []) as unknown as typeof OrderItem.aggregate
  Product.countDocuments = (async () => 20) as unknown as typeof Product.countDocuments
  Inventory.aggregate = (async () => []) as unknown as typeof Inventory.aggregate
  ProductViewDaily.aggregate = (async () => []) as unknown as typeof ProductViewDaily.aggregate
  try {
    const payload = await new Promise<any>((resolve, reject) => {
      const response = { status: () => response, json: resolve } as unknown as Response
      const request = { business: { _id: new mongoose.Types.ObjectId() }, validated: { query: { from: new Date('2026-10-12'), to: new Date('2026-10-14') } } } as unknown as Request
      adminAnalyticsController(request, response, reject)
    })
    assert.equal(payload.data.metrics.todaySales, 10000)
    assert.equal(payload.data.metrics.todayOrders, 2)
    assert.equal(payload.data.metrics.revenue, 50000)
    assert.equal(payload.data.metrics.orders, 10)
    assert.equal(payload.data.metrics.profit, 25000)
    assert.equal(payload.data.profitCoverage.complete, true)
    assert.equal(payload.data.series.reduce((sum: number, day: any) => sum + day.revenue, 0), payload.data.metrics.revenue)
  } finally {
    Order.aggregate = original.orderAggregate; Order.countDocuments = original.orderCount
    OrderItem.aggregate = original.itemAggregate; Product.countDocuments = original.productCount
    Inventory.aggregate = original.inventoryAggregate; ProductViewDaily.aggregate = original.viewAggregate
  }
})
