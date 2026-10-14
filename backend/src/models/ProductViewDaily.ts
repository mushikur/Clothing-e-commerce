import mongoose from 'mongoose'
import { businessField, modelFor, schemaOptions } from './common.js'
const { Schema } = mongoose

const productViewDailySchema = new Schema({
  businessId: businessField,
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  day: { type: Date, required: true },
  views: { type: Number, required: true, min: 0, validate: Number.isInteger, default: 0 },
}, { ...schemaOptions })

productViewDailySchema.index({ businessId: 1, productId: 1, day: 1 }, { unique: true })
productViewDailySchema.index({ businessId: 1, day: -1, views: -1 })
export const ProductViewDaily = modelFor('ProductViewDaily', productViewDailySchema)
