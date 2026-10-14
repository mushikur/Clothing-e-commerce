import mongoose from 'mongoose'
import { businessField, modelFor, schemaOptions } from './common.js'
const { Schema } = mongoose

const wishlistSchema = new Schema({
  businessId: businessField,
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  productIds: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
}, { ...schemaOptions })

wishlistSchema.index({ businessId: 1, userId: 1 }, { unique: true })
export const Wishlist = modelFor('Wishlist', wishlistSchema)
