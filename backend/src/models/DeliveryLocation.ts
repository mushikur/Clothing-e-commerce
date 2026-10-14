import mongoose from 'mongoose'
import { businessField, modelFor, schemaOptions } from './common.js'
const { Schema } = mongoose

const deliveryLocationSchema = new Schema({
  businessId: businessField,
  code: { type: String, required: true, trim: true, lowercase: true, maxlength: 100 },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  nameTranslations: { en: { type: String, trim: true, maxlength: 100 }, bn: { type: String, trim: true, maxlength: 100 } },
  aliases: [{ type: String, trim: true, maxlength: 100 }],
  division: { type: String, required: true, trim: true, maxlength: 80 },
  district: { type: String, required: true, trim: true, maxlength: 100 },
  area: { type: String, required: true, trim: true, maxlength: 100 },
  zone: { type: String, enum: ['inside_dhaka', 'dhaka_nearby', 'outside_dhaka'], required: true },
  enabled: { type: Boolean, default: true },
  deletedAt: Date,
}, { ...schemaOptions })

deliveryLocationSchema.index({ businessId: 1, code: 1 }, { unique: true })
deliveryLocationSchema.index({ businessId: 1, enabled: 1, division: 1, district: 1, area: 1 })
export const DeliveryLocation = modelFor('DeliveryLocation', deliveryLocationSchema)
