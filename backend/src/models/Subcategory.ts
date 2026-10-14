import mongoose from 'mongoose'
import { businessField, modelFor, schemaOptions, slugPattern } from './common.js'
const { Schema } = mongoose

const subcategorySchema = new Schema({
  businessId: businessField,
  categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  slug: { type: String, required: true, lowercase: true, trim: true, match: slugPattern },
  description: { type: String, trim: true, maxlength: 1000 },
  imageUrl: { type: String, maxlength: 2048 },
  sortOrder: { type: Number, min: 0, default: 0 },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  translations: { en: { name: { type: String, trim: true, maxlength: 100 }, description: { type: String, trim: true, maxlength: 1000 } }, bn: { name: { type: String, trim: true, maxlength: 100 }, description: { type: String, trim: true, maxlength: 1000 } } },
}, { ...schemaOptions })

subcategorySchema.index({ businessId: 1, categoryId: 1, slug: 1 }, { unique: true })
subcategorySchema.index({ businessId: 1, categoryId: 1, status: 1, sortOrder: 1 })
export const Subcategory = modelFor('Subcategory', subcategorySchema)
