import mongoose from 'mongoose'
import { businessField, modelFor, schemaOptions } from './common.js'
const { Schema } = mongoose

const promotionSchema = new Schema({
  businessId: businessField,
  kind: { type: String, enum: ['flash_sale', 'discount_campaign', 'featured_collection'], default: 'discount_campaign', index: true },
  title: { type: String, required: true, trim: true, maxlength: 160 },
  message: { type: String, trim: true, maxlength: 500 },
  translations: { en: { title: { type: String, trim: true, maxlength: 160 }, message: { type: String, trim: true, maxlength: 500 } }, bn: { title: { type: String, trim: true, maxlength: 160 }, message: { type: String, trim: true, maxlength: 500 } } },
  discountPercent: { type: Number, min: 0, max: 100, validate: Number.isInteger },
  collectionKey: { type: String, trim: true, lowercase: true, maxlength: 100 },
  placement: { type: String, enum: ['announcement', 'hero', 'collection', 'product'], required: true },
  status: { type: String, enum: ['draft', 'scheduled', 'active', 'ended', 'archived'], default: 'draft', index: true },
  startsAt: { type: Date },
  endsAt: { type: Date },
  targetUrl: { type: String, maxlength: 2048 },
  productIds: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
  couponId: { type: Schema.Types.ObjectId, ref: 'Coupon' },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { ...schemaOptions })

promotionSchema.path('endsAt').validate(function (value: Date | undefined) { return !value || !this.startsAt || value >= this.startsAt }, 'Promotion end must not precede its start')
promotionSchema.index({ businessId: 1, status: 1, startsAt: 1, endsAt: 1 })
export const Promotion = modelFor('Promotion', promotionSchema)
