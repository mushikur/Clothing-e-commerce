import mongoose from 'mongoose'
import { businessField, modelFor, schemaOptions } from './common.js'
const { Schema } = mongoose

const reviewSchema = new Schema({
  businessId: businessField,
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  orderItemId: { type: Schema.Types.ObjectId, ref: 'OrderItem' },
  rating: { type: Number, required: true, min: 1, max: 5, validate: Number.isInteger },
  title: { type: String, trim: true, maxlength: 120 },
  body: { type: String, required: true, trim: true, minlength: 5, maxlength: 5000 },
  status: { type: String, enum: ['pending', 'published', 'rejected'], default: 'pending', index: true },
  verifiedPurchase: { type: Boolean, default: false },
  moderatedAt: { type: Date },
}, { ...schemaOptions })

reviewSchema.index({ businessId: 1, productId: 1, status: 1, createdAt: -1 })
reviewSchema.index({ businessId: 1, productId: 1, userId: 1 }, { unique: true, partialFilterExpression: { orderItemId: { $exists: false } } })
reviewSchema.index({ businessId: 1, orderItemId: 1 }, { unique: true, partialFilterExpression: { orderItemId: { $exists: true } } })
export const Review = modelFor('Review', reviewSchema)
