import mongoose from 'mongoose'
import { businessField, modelFor, schemaOptions } from './common.js'
const { Schema } = mongoose

const cartSchema = new Schema({
  businessId: businessField,
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  items: [{ variantId: { type: Schema.Types.ObjectId, ref: 'ProductVariant', required: true }, quantity: { type: Number, required: true, min: 1, max: 99 } }],
  expiresAt: { type: Date },
  revision: { type: Number, min: 0, default: 0 },
}, { ...schemaOptions, optimisticConcurrency: true, versionKey: '__v' })

cartSchema.index({ businessId: 1, userId: 1 }, { unique: true })
cartSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, sparse: true })
export const Cart = modelFor('Cart', cartSchema)
