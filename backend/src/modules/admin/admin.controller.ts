import type { Request } from 'express'
import type { PipelineStage } from 'mongoose'
import { Inventory } from '../../models/Inventory.js'
import { InventoryTransaction } from '../../models/InventoryTransaction.js'
import { Order } from '../../models/Order.js'
import { OrderItem } from '../../models/OrderItem.js'
import { Product } from '../../models/Product.js'
import { ProductVariant } from '../../models/ProductVariant.js'
import { ProductViewDaily } from '../../models/ProductViewDaily.js'
import { User } from '../../models/User.js'
import { CustomerArchive } from '../../models/CustomerArchive.js'
import { asyncHandler } from '../../utils/async-handler.js'
import { success } from '../../utils/api-response.js'
import { AppError } from '../../utils/app-error.js'
const customerIdentity = { $ifNull: ['$userId', { $ifNull: ['$customer.email', { $ifNull: ['$customer.phone', '$_id'] }] }] }
function input<T>(request: Request): T { return request.validated as T }
function businessId(request: Request) { if (!request.business) throw new AppError(404, 'business_not_found', 'Storefront was not found'); return request.business._id }

export const adminAnalyticsController = asyncHandler(async (request, response) => {
  const tenant = businessId(request)
  const { from, to } = input<{ query: { from: Date; to: Date } }>(request).query
  const valid = { $nin: ['cancelled', 'refunded', 'returned'] }
  const rangeFilter = { businessId: tenant, deletedAt: { $exists: false }, createdAt: { $gte: from, $lt: to }, status: valid }
  const orderRange = { businessId: tenant, deletedAt: { $exists: false }, createdAt: { $gte: from, $lt: to } }
  const todayStart = new Date(); todayStart.setUTCHours(0, 0, 0, 0)
  const itemSales = [
    { $match: { businessId: tenant } },
    { $lookup: { from: Order.collection.name, let: { orderId: '$orderId' }, pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$_id', '$$orderId'] }, { $eq: ['$businessId', tenant] }, { $eq: [{ $ifNull: ['$deletedAt', null] }, null] }, { $gte: ['$createdAt', from] }, { $lt: ['$createdAt', to] }, { $not: [{ $in: ['$status', ['cancelled', 'refunded', 'returned']] }] }] } } }], as: 'order' } },
    { $unwind: '$order' },
    { $addFields: { netLineRevenue: { $subtract: ['$lineTotal', { $round: [{ $multiply: [{ $ifNull: ['$order.discountTotal', 0] }, { $divide: ['$lineTotal', { $max: ['$order.subtotal', 1] }] }] }, 0] }] } } },
  ] as any[]
  const [seriesRows, todayRows, totalsRows, productCount, pendingOrders, stockStats, productSales, worstProductSales, variantSales, customers, views, lowStockProducts] = await Promise.all([
    Order.aggregate([
      { $match: orderRange },
      { $lookup: { from: OrderItem.collection.name, localField: '_id', foreignField: 'orderId', as: 'lines' } },
      { $addFields: { day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' } }, eligible: { $not: [{ $in: ['$status', ['cancelled', 'refunded', 'returned']] }] }, soldUnits: { $sum: '$lines.quantity' } } },
      { $group: { _id: '$day', sales: { $sum: { $cond: ['$eligible', '$soldUnits', 0] } }, revenue: { $sum: { $cond: ['$eligible', '$grandTotal', 0] } }, orders: { $sum: { $cond: ['$eligible', 1, 0] } }, emails: { $addToSet: { $cond: ['$eligible', customerIdentity, null] } } } },
      { $project: { _id: 0, date: '$_id', sales: 1, revenue: 1, orders: 1, customers: { $size: { $filter: { input: '$emails', as: 'email', cond: { $and: [{ $ne: ['$$email', null] }, { $ne: ['$$email', ''] }] } } } } } },
      { $sort: { date: 1 } },
    ]),
    Order.aggregate([{ $match: { businessId: tenant, deletedAt: { $exists: false }, createdAt: { $gte: todayStart }, status: valid } }, { $group: { _id: null, revenue: { $sum: '$grandTotal' }, orders: { $sum: 1 } } }]),
    Order.aggregate([
      { $match: orderRange },
      { $lookup: { from: OrderItem.collection.name, localField: '_id', foreignField: 'orderId', as: 'lines' } },
      { $addFields: { eligible: { $not: [{ $in: ['$status', ['cancelled', 'refunded', 'returned']] }] }, hasCostGaps: { $anyElementTrue: { $map: { input: '$lines', as: 'line', in: { $eq: [{ $ifNull: ['$$line.costPriceSnapshot', null] }, null] } } } }, cogs: { $sum: { $map: { input: '$lines', as: 'line', in: { $multiply: [{ $ifNull: ['$$line.costPriceSnapshot', 0] }, '$$line.quantity'] } } } } } },
      { $group: { _id: null, revenue: { $sum: { $cond: ['$eligible', '$grandTotal', 0] } }, orders: { $sum: { $cond: ['$eligible', 1, 0] } }, completeCostRevenue: { $sum: { $cond: [{ $and: ['$eligible', { $not: ['$hasCostGaps'] }] }, { $subtract: ['$subtotal', '$discountTotal'] }, 0] } }, costOfGoods: { $sum: { $cond: [{ $and: ['$eligible', { $not: ['$hasCostGaps'] }] }, '$cogs', 0] } }, ordersWithCost: { $sum: { $cond: [{ $and: ['$eligible', { $not: ['$hasCostGaps'] }] }, 1, 0] } }, ordersWithoutCost: { $sum: { $cond: [{ $and: ['$eligible', '$hasCostGaps'] }, 1, 0] } } } },
    ]),
    Product.countDocuments({ businessId: tenant, status: { $ne: 'archived' } }),
    Order.countDocuments({ businessId: tenant, deletedAt: { $exists: false }, status: { $in: ['pending', 'confirmed'] } }),
    Inventory.aggregate([{ $match: { businessId: tenant } }, { $addFields: { available: { $subtract: ['$onHand', '$reserved'] } } }, { $group: { _id: null, units: { $sum: '$available' }, lowStock: { $sum: { $cond: [{ $and: [{ $gt: ['$reorderPoint', 0] }, { $gt: ['$available', 0] }, { $lte: ['$available', '$reorderPoint'] }] }, 1, 0] } } } }]),
    OrderItem.aggregate([...itemSales, { $group: { _id: '$productId', units: { $sum: '$quantity' }, revenue: { $sum: '$netLineRevenue' } } }, { $sort: { units: -1, _id: 1 } }, { $limit: 50 }, { $lookup: { from: Product.collection.name, let: { id: '$_id' }, pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$_id', '$$id'] }, { $eq: ['$businessId', tenant] }] } } }, { $project: { name: 1, sku: 1, slug: 1 } }], as: 'product' } }, { $unwind: '$product' }, { $project: { _id: 0, productId: '$_id', name: '$product.name', sku: '$product.sku', slug: '$product.slug', units: 1, revenue: 1 } }]),
    OrderItem.aggregate([...itemSales, { $group: { _id: '$productId', units: { $sum: '$quantity' }, revenue: { $sum: '$netLineRevenue' } } }, { $sort: { units: 1, _id: 1 } }, { $limit: 10 }, { $lookup: { from: Product.collection.name, let: { id: '$_id' }, pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$_id', '$$id'] }, { $eq: ['$businessId', tenant] }] } } }, { $project: { name: 1, sku: 1, slug: 1 } }], as: 'product' } }, { $unwind: '$product' }, { $project: { _id: 0, productId: '$_id', name: '$product.name', sku: '$product.sku', slug: '$product.slug', units: 1, revenue: 1 } }]),
    OrderItem.aggregate([...itemSales, { $lookup: { from: ProductVariant.collection.name, let: { id: '$variantId' }, pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$_id', '$$id'] }, { $eq: ['$businessId', tenant] }] } } }, { $project: { color: 1, size: 1 } }], as: 'variant' } }, { $unwind: '$variant' }, { $facet: { sizes: [{ $group: { _id: '$variant.size', units: { $sum: '$quantity' } } }, { $sort: { units: -1, _id: 1 } }, { $limit: 10 }, { $project: { _id: 0, label: '$_id', units: 1 } }], colors: [{ $group: { _id: '$variant.color', units: { $sum: '$quantity' } } }, { $sort: { units: -1, _id: 1 } }, { $limit: 10 }, { $project: { _id: 0, label: '$_id', units: 1 } }] } }]),
    Order.aggregate([{ $match: rangeFilter }, { $group: { _id: customerIdentity, name: { $last: '$customer.name' }, email: { $last: '$customer.email' }, orders: { $sum: 1 }, spend: { $sum: '$grandTotal' }, lastOrderAt: { $max: '$createdAt' } } }, { $lookup: { from: Order.collection.name, let: { identity: '$_id' }, pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$businessId', tenant] }, { $eq: [customerIdentity, '$$identity'] }, { $lt: ['$createdAt', from] }, { $not: [{ $in: ['$status', ['cancelled', 'refunded', 'returned']] }] }] } } }, { $limit: 1 }, { $project: { _id: 1 } }], as: 'priorOrder' } }, { $addFields: { isReturning: { $gt: [{ $size: '$priorOrder' }, 0] } } }, { $facet: { top: [{ $sort: { spend: -1, _id: 1 } }, { $limit: 10 }, { $project: { priorOrder: 0 } }], summary: [{ $group: { _id: null, new: { $sum: { $cond: ['$isReturning', 0, 1] } }, returning: { $sum: { $cond: ['$isReturning', 1, 0] } } } }] } }]),
    ProductViewDaily.aggregate([{ $match: { businessId: tenant, day: { $gte: new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())), $lt: to } } }, { $group: { _id: '$productId', views: { $sum: '$views' } } }, { $sort: { views: -1, _id: 1 } }, { $limit: 10 }, { $lookup: { from: Product.collection.name, let: { id: '$_id' }, pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$_id', '$$id'] }, { $eq: ['$businessId', tenant] }] } } }, { $project: { name: 1, sku: 1, slug: 1 } }], as: 'product' } }, { $unwind: '$product' }, { $project: { _id: 0, productId: '$_id', name: '$product.name', sku: '$product.sku', slug: '$product.slug', views: 1 } }]),
    Inventory.aggregate([{ $match: { businessId: tenant } }, { $addFields: { available: { $subtract: ['$onHand', '$reserved'] } } }, { $match: { available: { $gt: 0 }, reorderPoint: { $gt: 0 }, $expr: { $lte: ['$available', '$reorderPoint'] } } }, { $lookup: { from: ProductVariant.collection.name, let: { id: '$variantId' }, pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$_id', '$$id'] }, { $eq: ['$businessId', tenant] }] } } }, { $project: { sku: 1, color: 1, size: 1, productId: 1 } }], as: 'variant' } }, { $unwind: '$variant' }, { $lookup: { from: Product.collection.name, let: { id: '$variant.productId' }, pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$_id', '$$id'] }, { $eq: ['$businessId', tenant] }] } } }, { $project: { name: 1 } }], as: 'product' } }, { $unwind: '$product' }, { $project: { _id: 0, productId: '$variant.productId', productName: '$product.name', sku: '$variant.sku', color: '$variant.color', size: '$variant.size', available: 1, reorderPoint: 1 } }, { $sort: { available: 1, productName: 1 } }, { $limit: 10 }]),
  ])
  const orderedSeries = seriesRows as Array<{ date: string; sales: number; revenue: number; orders: number; customers: number }>
  const dayBuckets = new Map(orderedSeries.map((row) => [row.date, row]))
  const filledSeries = []
  for (let time = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()), end = to.getTime(); time < end; time += 86400000) {
    const date = new Date(time).toISOString().slice(0, 10)
    filledSeries.push(dayBuckets.get(date) ?? { date, sales: 0, revenue: 0, orders: 0, customers: 0 })
  }
  const totals = totalsRows[0] ?? { revenue: 0, orders: 0, completeCostRevenue: 0, costOfGoods: 0, ordersWithCost: 0, ordersWithoutCost: 0 }
  const customerStats = (customers[0]?.summary?.[0] ?? { new: 0, returning: 0 }) as { new: number; returning: number }
  const customerRows = (customers[0]?.top ?? []) as Array<Record<string, any>>
  const newCustomers = customerStats.new
  const returningCustomers = customerStats.returning
  const profit = totals.ordersWithCost ? totals.completeCostRevenue - totals.costOfGoods : null
  const today = todayRows[0] ?? { revenue: 0, orders: 0 }
  success(response, {
    metrics: { todaySales: today.revenue, todayOrders: today.orders, revenue: totals.revenue, orders: totals.orders, averageOrderValue: totals.orders ? Math.round(totals.revenue / totals.orders) : 0, profit, profitMargin: profit !== null && totals.completeCostRevenue ? profit / totals.completeCostRevenue * 100 : null, customers: newCustomers + returningCustomers, newCustomers, returningCustomers, products: productCount, pendingOrders, lowStock: stockStats[0]?.lowStock ?? 0, stockUnits: stockStats[0]?.units ?? 0 },
    profitCoverage: { ordersWithCost: totals.ordersWithCost, ordersWithoutCost: totals.ordersWithoutCost, complete: totals.ordersWithoutCost === 0 },
    series: filledSeries,
    products: { bestSellers: (productSales as Array<Record<string, any>>).slice(0, 10), worstSellers: worstProductSales, mostViewed: views, lowStock: lowStockProducts },
    variants: variantSales[0] ?? { sizes: [], colors: [] },
    customers: { new: newCustomers, returning: returningCustomers, top: customerRows },
    viewsCoverage: { enabled: true, message: 'Product views are recorded from the date analytics tracking was enabled.' },
  })
})

export const adminCustomersController = asyncHandler(async (request, response) => {
  const tenant = businessId(request)
  const { page, limit, q } = input<{ query: { page: number; limit: number; q?: string } }>(request).query
  const escaped = q?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const aggregate: PipelineStage[] = [
    { $match: { businessId: tenant, deletedAt: { $exists: false } } },
    { $sort: { createdAt: 1, _id: 1 } },
    { $lookup: { from: User.collection.name, localField: 'customer.email', foreignField: 'email', pipeline: [{ $match: { businessId: tenant } }, { $project: { _id: 1 } }], as: 'customerAccount' } },
    { $group: { _id: { $ifNull: ['$userId', { $ifNull: [{ $arrayElemAt: ['$customerAccount._id', 0] }, customerIdentity] }] }, name: { $last: '$customer.name' }, email: { $last: '$customer.email' }, phone: { $last: '$customer.phone' }, orders: { $sum: 1 }, totalSpent: { $sum: { $cond: [{ $in: ['$status', ['cancelled', 'refunded', 'returned']] }, 0, '$grandTotal'] } }, lastOrderAt: { $max: '$createdAt' } } },
    { $unionWith: { coll: User.collection.name, pipeline: [
      { $match: { businessId: tenant, role: 'customer' } },
      { $project: { name: 1, email: 1, phone: 1, orders: { $literal: 0 }, totalSpent: { $literal: 0 }, lastOrderAt: { $literal: null } } },
    ] } },
    { $group: { _id: '$_id', name: { $last: '$name' }, email: { $last: '$email' }, phone: { $last: '$phone' }, orders: { $sum: '$orders' }, totalSpent: { $sum: '$totalSpent' }, lastOrderAt: { $max: '$lastOrderAt' } } },
    { $addFields: { directoryKey: { $toString: '$_id' } } },
    { $lookup: { from: CustomerArchive.collection.name, localField: 'directoryKey', foreignField: 'key', pipeline: [{ $match: { businessId: tenant, restoredAt: { $exists: false } } }], as: 'archive' } },
    { $match: { 'archive.0': { $exists: false } } },
    { $unset: ['archive', 'directoryKey'] },
    ...(escaped ? [{ $match: { $or: [{ name: { $regex: escaped, $options: 'i' } }, { email: { $regex: escaped, $options: 'i' } }, { phone: { $regex: escaped, $options: 'i' } }] } } as PipelineStage] : []),
    { $facet: { rows: [{ $sort: { lastOrderAt: -1 } }, { $skip: (page - 1) * limit }, { $limit: limit }], total: [{ $count: 'value' }] } },
  ]
  const [result] = await Order.aggregate(aggregate)
  const rows = result?.rows ?? []
  const total = result?.total?.[0]?.value ?? 0
  // Guest checkout allows no email. Never pass null to the User email setter.
  const emails = rows.map((row: Record<string, any>) => row.email).filter((email: unknown): email is string => typeof email === 'string' && email.trim().length > 0)
  const userRecords = emails.length ? await User.find({ businessId: tenant, email: { $in: emails } }).select('email status role').lean() : []
  const statusByEmail = new Map(userRecords.map((user) => [user.email, user.status]))
  const roleByEmail = new Map(userRecords.map((user) => [user.email, user.role]))
  success(response, { customers: rows.map((row: Record<string, any>) => ({ ...row, status: statusByEmail.get(row.email) || 'guest', role: roleByEmail.get(row.email) || 'customer' })) }, 200, { page, limit, total, pages: Math.ceil(total / limit) })
})

export const adminInventoryController = asyncHandler(async (request, response) => {
  const tenant = businessId(request)
  const { page, limit, filter, q } = input<{ query: { page: number; limit: number; filter?: 'low' | 'out'; q?: string } }>(request).query
  const escaped = q?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pipeline: PipelineStage[] = [
    { $match: { businessId: tenant } }, { $addFields: { available: { $subtract: ['$onHand', '$reserved'] } } },
    { $lookup: { from: ProductVariant.collection.name, let: { id: '$variantId' }, pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$_id', '$$id'] }, { $eq: ['$businessId', tenant] }] } } }, { $project: { sku: 1, color: 1, size: 1, productId: 1 } }], as: 'variant' } }, { $unwind: '$variant' },
    { $lookup: { from: Product.collection.name, let: { id: '$variant.productId' }, pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$_id', '$$id'] }, { $eq: ['$businessId', tenant] }] } } }, { $project: { name: 1 } }], as: 'product' } }, { $unwind: '$product' },
  ]
  if (filter === 'out') pipeline.push({ $match: { available: { $lte: 0 } } })
  if (filter === 'low') pipeline.push({ $match: { available: { $gt: 0 }, reorderPoint: { $gt: 0 }, $expr: { $lte: ['$available', '$reorderPoint'] } } })
  if (escaped) pipeline.push({ $match: { $or: [{ 'product.name': { $regex: escaped, $options: 'i' } }, { 'variant.sku': { $regex: escaped, $options: 'i' } }, { 'variant.color': { $regex: escaped, $options: 'i' } }, { 'variant.size': { $regex: escaped, $options: 'i' } }] } })
  const [result, statsRows] = await Promise.all([
    Inventory.aggregate([...pipeline, { $facet: { items: [{ $sort: { available: 1, _id: 1 } }, { $skip: (page - 1) * limit }, { $limit: limit }], total: [{ $count: 'value' }] } }]),
    Inventory.aggregate([{ $match: { businessId: tenant } }, { $addFields: { available: { $subtract: ['$onHand', '$reserved'] } } }, { $group: { _id: null, totalStock: { $sum: '$available' }, lowStock: { $sum: { $cond: [{ $and: [{ $gt: ['$reorderPoint', 0] }, { $gt: ['$available', 0] }, { $lte: ['$available', '$reorderPoint'] }] }, 1, 0] } }, outOfStock: { $sum: { $cond: [{ $lte: ['$available', 0] }, 1, 0] } } } }]),
  ])
  const rows = result[0]?.items ?? []
  const total = result[0]?.total?.[0]?.value ?? 0
  const stats = statsRows[0] ?? { totalStock: 0, lowStock: 0, outOfStock: 0 }
  success(response, { items: rows, stats }, 200, { page, limit, total, pages: Math.ceil(total / limit) })
})

export const adminInventoryHistoryController = asyncHandler(async (request, response) => {
  const tenant = businessId(request)
  const { page, limit, variantId } = input<{ query: { page: number; limit: number; variantId?: string } }>(request).query
  const filter = { businessId: tenant, ...(variantId ? { variantId } : {}) }
  const [transactions, total] = await Promise.all([
    InventoryTransaction.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), InventoryTransaction.countDocuments(filter),
  ])
  const variants = await ProductVariant.find({ businessId: tenant, _id: { $in: transactions.map((item) => item.variantId) } }).select('sku color size productId').lean() as unknown as Array<Record<string, any>>
  const products = await Product.find({ businessId: tenant, _id: { $in: variants.map((item) => item.productId) } }).select('name').lean() as unknown as Array<Record<string, any>>
  const variantMap = new Map(variants.map((item) => [String(item._id), item]))
  const productMap = new Map(products.map((item) => [String(item._id), item]))
  success(response, { transactions: transactions.map((item) => { const variant = variantMap.get(String(item.variantId)); return { ...item, variant: variant ? { ...variant, productName: productMap.get(String(variant.productId))?.name } : undefined } }) }, 200, { page, limit, total, pages: Math.ceil(total / limit) })
})

