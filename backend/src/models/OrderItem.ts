import mongoose from 'mongoose'
import { businessField, modelFor, schemaOptions } from './common.js'
const { Schema } = mongoose

const orderItemSchema = new Schema({
  businessId: businessField,
  orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: Schema.Types.ObjectId, ref: 'ProductVariant', required: true },
  productNameSnapshot: { type: String, required: true, maxlength: 180 },
  productNameTranslations: { en: { type: String, trim: true, maxlength: 180 }, bn: { type: String, trim: true, maxlength: 180 } },
  skuSnapshot: { type: String, required: true, maxlength: 80 },
  attributesSnapshot: { type: Map, of: String, default: {} },
  unitPrice: { type: Number, required: true, min: 0, validate: Number.isInteger },
  costPriceSnapshot: { type: Number, min: 0, validate: Number.isInteger },
  quantity: { type: Number, required: true, min: 1, max: 99 },
  discountAmount: { type: Number, min: 0, validate: Number.isInteger, default: 0 },
  taxAmount: { type: Number, min: 0, validate: Number.isInteger, default: 0 },
  lineTotal: { type: Number, required: true, min: 0, validate: Number.isInteger },
}, { ...schemaOptions })

orderItemSchema.index({ businessId: 1, orderId: 1 })
orderItemSchema.index({ businessId: 1, productId: 1, createdAt: -1 })
orderItemSchema.pre('validate', function () {
  const expected = this.unitPrice * this.quantity - this.discountAmount + this.taxAmount
  if (this.discountAmount > this.unitPrice * this.quantity) this.invalidate('discountAmount', 'Line discount cannot exceed line subtotal')
  if (Number.isInteger(this.lineTotal) && this.lineTotal !== expected) this.invalidate('lineTotal', 'Line total must equal subtotal minus discount plus tax')
})
export const OrderItem = modelFor('OrderItem', orderItemSchema)
