import mongoose from 'mongoose'
import { businessField, modelFor, schemaOptions } from './common.js'
const { Schema } = mongoose

const addressSnapshotSchema = new Schema({
  recipientName: { type: String, required: true }, phone: { type: String, required: true }, line1: { type: String, required: true },
  line2: String, city: { type: String, required: true }, region: String, division: String, district: String, area: String,
  deliveryLocationId: { type: Schema.Types.ObjectId, ref: 'DeliveryLocation' }, deliveryLocationName: String, deliveryZone: String,
  postalCode: String, countryCode: { type: String, required: true }, deliveryInstructions: String,
}, { _id: false, strict: 'throw' })
const deliverySnapshotSchema = new Schema({
  ruleId: { type: Schema.Types.ObjectId, ref: 'DeliveryRule' }, name: String, nameTranslations: { en: String, bn: String }, code: String, zone: String,
  courierCode: String, customerCharge: { type: Number, min: 0, validate: Number.isInteger }, courierCost: { type: Number, min: 0, validate: Number.isInteger },
  estimatedDelivery: String, method: String, paymentMethod: String,
}, { _id: false, strict: 'throw' })

const orderSchema = new Schema({
  deletedAt: Date,
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  businessId: businessField,
  orderNumber: { type: String, required: true, trim: true, uppercase: true, maxlength: 40 },
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  customer: {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, trim: true, lowercase: true, maxlength: 254 },
    phone: { type: String, required: true, trim: true, maxlength: 32 },
  },
  idempotencyKey: { type: String, maxlength: 160 },
  guestAccessTokenHash: { type: String, select: false },
  guestAccessExpiresAt: Date,
  status: { type: String, enum: ['pending', 'confirmed', 'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned', 'refunded'], default: 'pending', index: true },
  currency: { type: String, required: true, uppercase: true, minlength: 3, maxlength: 3 },
  subtotal: { type: Number, required: true, min: 0, validate: Number.isInteger },
  discountTotal: { type: Number, min: 0, validate: Number.isInteger, default: 0 },
  shippingTotal: { type: Number, min: 0, validate: Number.isInteger, default: 0 },
  deliveryOptionCode: { type: String, trim: true, maxlength: 40 },
  deliveryOptionLabel: { type: String, trim: true, maxlength: 80 },
  deliverySnapshot: { type: deliverySnapshotSchema },
  taxTotal: { type: Number, min: 0, validate: Number.isInteger, default: 0 },
  grandTotal: { type: Number, required: true, min: 0, validate: Number.isInteger },
  couponId: { type: Schema.Types.ObjectId, ref: 'Coupon' },
  couponCodeSnapshot: { type: String, maxlength: 40 },
  shippingAddress: { type: addressSnapshotSchema, required: true },
  billingAddress: { type: addressSnapshotSchema, required: true },
  paymentId: { type: Schema.Types.ObjectId, ref: 'Payment' },
  shipmentId: { type: Schema.Types.ObjectId, ref: 'Shipment' },
  placedAt: { type: Date },
  cancelledAt: { type: Date },
  timeline: [{ status: { type: String, required: true, maxlength: 40 }, note: { type: String, maxlength: 500 }, actorUserId: { type: Schema.Types.ObjectId, ref: 'User' }, occurredAt: { type: Date, default: Date.now } }],
  cancellationReason: { type: String, maxlength: 500 },
  returnRequest: { status: { type: String, enum: ['requested', 'approved', 'rejected', 'received'] }, reason: { type: String, maxlength: 500 }, requestedAt: Date, resolvedAt: Date, resolutionNote: { type: String, maxlength: 500 } },
  refundReference: { type: String, maxlength: 180 },
  refundedAt: Date,
  notes: { type: String, maxlength: 1000 },
}, { ...schemaOptions, optimisticConcurrency: true, versionKey: '__v' })

orderSchema.index({ businessId: 1, orderNumber: 1 }, { unique: true })
orderSchema.index({ businessId: 1, userId: 1, createdAt: -1 })
orderSchema.index({businessId:1,createdAt:-1,_id:-1})
orderSchema.index({ businessId: 1, status: 1, createdAt: -1 })
orderSchema.index({ businessId: 1, deletedAt: 1, createdAt: -1 })
orderSchema.index({ businessId: 1, idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } })
orderSchema.pre('validate', function () {
  const expected = this.subtotal - this.discountTotal + this.shippingTotal + this.taxTotal
  if (this.discountTotal > this.subtotal) this.invalidate('discountTotal', 'Discount cannot exceed subtotal')
  if (Number.isInteger(this.grandTotal) && this.grandTotal !== expected) this.invalidate('grandTotal', 'Grand total must equal subtotal minus discount plus shipping and tax')
})
export const Order = modelFor('Order', orderSchema)
