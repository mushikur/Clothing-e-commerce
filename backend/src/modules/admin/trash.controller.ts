import mongoose from 'mongoose'
import { Order } from '../../models/Order.js'
import { User } from '../../models/User.js'
import { Product } from '../../models/Product.js'
import { ProductVariant } from '../../models/ProductVariant.js'
import { CustomerArchive } from '../../models/CustomerArchive.js'
import { RefreshSession } from '../../models/RefreshSession.js'
import { archiveAdminProduct } from '../products/admin-products.service.js'
import { asyncHandler } from '../../utils/async-handler.js'
import { success } from '../../utils/api-response.js'
import { AppError } from '../../utils/app-error.js'

const identity = { $toString: { $ifNull: ['$userId', { $ifNull: ['$customer.email', { $ifNull: ['$customer.phone', '$_id'] }] }] } }
export function assertOrderCanBeDeleted(order: { status: string; returnRequest?: { status?: string } }) {
  if (!['cancelled', 'delivered', 'returned', 'refunded'].includes(order.status)) throw new AppError(409, 'order_still_open', 'Cancel or complete this order before deleting it. This keeps stock and payment records correct.')
  if (['requested', 'approved'].includes(order.returnRequest?.status || '')) throw new AppError(409, 'return_still_open', 'Resolve the return request before deleting this order.')
}
export const deleteRecordController = asyncHandler(async (request, response) => {
  const businessId = request.business!._id
  const { kind, key } = (request.validated as { params: { kind: string; key: string } }).params
  if (kind === 'product') { await archiveAdminProduct(businessId, key); success(response, { deleted: true }); return }
  const session = await mongoose.startSession()
  try {
    await session.withTransaction(async () => {
      if (kind === 'order') {
        const order = await Order.findOne({ businessId, _id: key, deletedAt: { $exists: false } }).session(session)
        if (!order) throw new AppError(404, 'order_not_found', 'Order was not found')
        assertOrderCanBeDeleted(order)
        order.deletedAt = new Date(); order.deletedBy = request.user!.id
        await order.save({ session })
      } else {
        const [customer] = await Order.aggregate([
          { $match: { businessId } }, { $addFields: { directoryKey: identity } }, { $match: { directoryKey: key } },
          { $sort: { createdAt: -1 } }, { $limit: 1 }, { $project: { customer: 1, userId: 1 } },
        ]).session(session)
        const user = customer?.userId ? await User.findOne({ businessId, _id: customer.userId }).session(session) : customer?.customer.email ? await User.findOne({ businessId, email: customer.customer.email }).session(session) : /^[a-f\d]{24}$/i.test(key) ? await User.findOne({ businessId, _id: key }).session(session) : null
        if (!customer && !user) throw new AppError(404, 'customer_not_found', 'Customer was not found')
        if (user && user.role !== 'customer') throw new AppError(403, 'protected_account', 'Administrator and staff accounts cannot be deleted from Customers.')
        const existing = await CustomerArchive.findOne({ businessId, key, restoredAt: { $exists: false } }).session(session)
        if (existing) throw new AppError(409, 'already_deleted', 'This customer is already in Trash.')
        await CustomerArchive.updateOne({ businessId, key }, { $set: { name: customer?.customer.name || user!.name, userId: user?._id, previousStatus: user?.status, deletedAt: new Date(), deletedBy: request.user!.id }, $unset: { restoredAt: 1 } }, { upsert: true, runValidators: true, session })
        if (user) {
          user.status = 'suspended'; await user.save({ session })
          await RefreshSession.updateMany({ businessId, userId: user._id, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } }, { session })
        }
      }
    })
  } finally { await session.endSession() }
  success(response, { deleted: true })
})

export const restoreRecordController = asyncHandler(async (request, response) => {
  const businessId = request.business!._id
  const { kind, key } = (request.validated as { params: { kind: string; key: string } }).params
  const session = await mongoose.startSession()
  try {
    await session.withTransaction(async () => {
      if (kind === 'order') {
        const result = await Order.updateOne({ businessId, _id: key, deletedAt: { $exists: true } }, { $unset: { deletedAt: 1, deletedBy: 1 } }, { session })
        if (!result.matchedCount) throw new AppError(404, 'order_not_found', 'Deleted order was not found')
      } else if (kind === 'product') {
        const result = await Product.updateOne({ businessId, _id: key, status: 'archived' }, { $set: { status: 'draft' } }, { session })
        if (!result.matchedCount) throw new AppError(404, 'product_not_found', 'Deleted product was not found')
        await ProductVariant.updateMany({ businessId, productId: key, archivedActive: true }, { $set: { isActive: true }, $unset: { archivedActive: 1 } }, { session })
      } else {
        const record = await CustomerArchive.findOne({ businessId, key, restoredAt: { $exists: false } }).session(session)
        if (!record) throw new AppError(404, 'customer_not_found', 'Deleted customer was not found')
        if (record.userId) await User.updateOne({ businessId, _id: record.userId, role: 'customer', status: 'suspended' }, { $set: { status: record.previousStatus || 'active' } }, { session })
        record.restoredAt = new Date(); await record.save({ session })
      }
    })
  } finally { await session.endSession() }
  success(response, { restored: true })
})

export const trashListController = asyncHandler(async (request, response) => {
  const businessId = request.business!._id
  const { kind, page, limit } = (request.validated as { query: { kind: string; page: number; limit: number } }).query
  const model = kind === 'order' ? Order : kind === 'product' ? Product : CustomerArchive
  const filter = { businessId, ...(kind === 'order' ? { deletedAt: { $exists: true } } : kind === 'product' ? { status: 'archived' } : { restoredAt: { $exists: false } }) }
  const [records, total] = await Promise.all([
    model.find(filter).select('name orderNumber customer.name key deletedAt updatedAt').sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), model.countDocuments(filter),
  ])
  success(response, { items: records.map((record: any) => ({ key: kind === 'customer' ? record.key : String(record._id), name: record.name || record.orderNumber, deletedAt: record.deletedAt || record.updatedAt })) }, 200, { page, limit, total, pages: Math.ceil(total / limit) })
})
