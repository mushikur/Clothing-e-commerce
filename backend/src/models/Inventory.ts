import mongoose from 'mongoose'
import { businessField, modelFor, schemaOptions } from './common.js'
const { Schema } = mongoose

const inventorySchema = new Schema({
  businessId: businessField,
  variantId: { type: Schema.Types.ObjectId, ref: 'ProductVariant', required: true },
  locationCode: { type: String, required: true, trim: true, uppercase: true, default: 'DEFAULT', maxlength: 50 },
  onHand: { type: Number, required: true, min: 0, validate: Number.isInteger },
  reserved: { type: Number, min: 0, validate: Number.isInteger, default: 0 },
  reorderPoint: { type: Number, min: 0, validate: Number.isInteger, default: 0 },
  lastCountedAt: { type: Date },
}, { ...schemaOptions, optimisticConcurrency: true, versionKey: '__v' })

inventorySchema.path('reserved').validate(function (reserved: number) { return reserved <= this.onHand }, 'Reserved quantity cannot exceed on-hand quantity')
inventorySchema.index({ businessId: 1, variantId: 1, locationCode: 1 }, { unique: true })
inventorySchema.index({ businessId: 1, reorderPoint: 1, onHand: 1 })
export const Inventory = modelFor('Inventory', inventorySchema)
