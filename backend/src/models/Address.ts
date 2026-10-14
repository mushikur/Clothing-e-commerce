import mongoose from 'mongoose'
import { businessField, modelFor, schemaOptions } from './common.js'
const { Schema } = mongoose

const addressSchema = new Schema({
  businessId: businessField,
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  label: { type: String, trim: true, maxlength: 40 },
  recipientName: { type: String, required: true, trim: true, maxlength: 100 },
  phone: { type: String, required: true, trim: true, maxlength: 32 },
  line1: { type: String, required: true, trim: true, maxlength: 160 },
  line2: { type: String, trim: true, maxlength: 160 },
  city: { type: String, required: true, trim: true, maxlength: 100 },
  region: { type: String, trim: true, maxlength: 100 },
  division: { type: String, trim: true, maxlength: 80 },
  district: { type: String, trim: true, maxlength: 100 },
  area: { type: String, trim: true, maxlength: 100 },
  deliveryLocationId: { type: Schema.Types.ObjectId, ref: 'DeliveryLocation' },
  deliveryLocationName: { type: String, trim: true, maxlength: 100 },
  deliveryZone: { type: String, enum: ['inside_dhaka', 'dhaka_nearby', 'outside_dhaka'] },
  postalCode: { type: String, trim: true, maxlength: 24 },
  countryCode: { type: String, required: true, uppercase: true, minlength: 2, maxlength: 2 },
  deliveryInstructions: { type: String, trim: true, maxlength: 500 },
  isDefaultShipping: { type: Boolean, default: false },
  isDefaultBilling: { type: Boolean, default: false },
}, { ...schemaOptions })

addressSchema.index({ businessId: 1, userId: 1, createdAt: -1 })
addressSchema.index({ businessId: 1, userId: 1, isDefaultShipping: 1 }, { unique: true, partialFilterExpression: { isDefaultShipping: true } })
addressSchema.index({ businessId: 1, userId: 1, isDefaultBilling: 1 }, { unique: true, partialFilterExpression: { isDefaultBilling: true } })
export const Address = modelFor('Address', addressSchema)
