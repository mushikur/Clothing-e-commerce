import mongoose from 'mongoose'
import { businessField, modelFor, schemaOptions } from './common.js'
const { Schema } = mongoose

const deliveryRuleSchema = new Schema({
  businessId: businessField,
  name: { type: String, required: true, trim: true, maxlength: 100 },
  nameTranslations: { en: { type: String, trim: true, maxlength: 100 }, bn: { type: String, trim: true, maxlength: 100 } },
  code: { type: String, required: true, trim: true, lowercase: true, maxlength: 80 },
  scope: { type: String, enum: ['default', 'zone', 'division', 'district', 'area'], required: true, default: 'default' },
  countryCode: { type: String, uppercase: true, trim: true, maxlength: 2, default: 'BD' },
  division: { type: String, trim: true, maxlength: 80 },
  district: { type: String, trim: true, maxlength: 100 },
  area: { type: String, trim: true, maxlength: 100 },
  zone: { type: String, enum: ['inside_dhaka', 'dhaka_nearby', 'outside_dhaka'] },
  courierCode: { type: String, trim: true, lowercase: true, maxlength: 40 },
  fee: { type: Number, required: true, min: 0, validate: Number.isInteger },
  courierCost: { type: Number, min: 0, validate: Number.isInteger },
  freeAbove: { type: Number, min: 0, validate: Number.isInteger },
  minimumSubtotal: { type: Number, min: 0, validate: Number.isInteger },
  maximumSubtotal: { type: Number, min: 0, validate: Number.isInteger },
  codFee: { type: Number, min: 0, validate: Number.isInteger },
  onlineFee: { type: Number, min: 0, validate: Number.isInteger },
  estimatedDelivery: { type: String, required: true, trim: true, maxlength: 80 },
  enabled: { type: Boolean, default: true },
}, { ...schemaOptions })

deliveryRuleSchema.index({ businessId: 1, code: 1 }, { unique: true })
deliveryRuleSchema.index({ businessId: 1, enabled: 1, scope: 1, division: 1, district: 1, area: 1 })
export const DeliveryRule = modelFor('DeliveryRule', deliveryRuleSchema)
