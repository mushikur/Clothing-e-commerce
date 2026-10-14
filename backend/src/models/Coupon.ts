import mongoose from 'mongoose'
import { businessField, modelFor, normalizeCode, schemaOptions } from './common.js'
const { Schema } = mongoose

const couponSchema = new Schema({
  businessId: businessField,
  code: { type: String, required: true, trim: true, uppercase: true, set: normalizeCode, maxlength: 40 },
  type: { type: String, enum: ['percent', 'fixed'], required: true },
  value: { type: Number, required: true, min: 0, validate: function (value: number) { return this.type === 'percent' || Number.isInteger(value) } },
  currency: { type: String, uppercase: true, minlength: 3, maxlength: 3 },
  minimumSubtotal: { type: Number, min: 0, validate: Number.isInteger, default: 0 },
  startsAt: { type: Date, required: true },
  endsAt: { type: Date, required: true },
  maxRedemptions: { type: Number, min: 1 },
  maxRedemptionsPerUser: { type: Number, min: 1, default: 1 },
  redemptionCount: { type: Number, min: 0, default: 0 },
  productIds: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
  categoryIds: [{ type: Schema.Types.ObjectId, ref: 'Category' }],
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
}, { ...schemaOptions })

couponSchema.path('value').validate(function (value: number) { return this.type !== 'percent' || value <= 100 }, 'Percent coupon cannot exceed 100')
couponSchema.path('endsAt').validate(function (value: Date) { return !this.startsAt || value >= this.startsAt }, 'Coupon end must not precede its start')
couponSchema.index({ businessId: 1, code: 1 }, { unique: true })
couponSchema.index({ businessId: 1, status: 1, startsAt: 1, endsAt: 1 })
export const Coupon = modelFor('Coupon', couponSchema)
