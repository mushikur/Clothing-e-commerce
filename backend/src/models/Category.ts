import mongoose from 'mongoose'
import { businessField, modelFor, schemaOptions, slugPattern } from './common.js'
const { Schema } = mongoose

const categorySchema = new Schema({
  businessId: businessField,
  name: { type: String, required: true, trim: true, maxlength: 100 },
  slug: { type: String, required: true, lowercase: true, trim: true, match: slugPattern },
  description: { type: String, trim: true, maxlength: 1000 },
  imageUrl: { type: String, maxlength: 2048 },
  sortOrder: { type: Number, min: 0, default: 0 },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  seo: { title: { type: String, maxlength: 70 }, description: { type: String, maxlength: 170 } },
  translations: { en: { name: { type: String, trim: true, maxlength: 100 }, description: { type: String, trim: true, maxlength: 1000 }, seoTitle: { type: String, maxlength: 70 }, seoDescription: { type: String, maxlength: 170 } }, bn: { name: { type: String, trim: true, maxlength: 100 }, description: { type: String, trim: true, maxlength: 1000 }, seoTitle: { type: String, maxlength: 70 }, seoDescription: { type: String, maxlength: 170 } } },
}, { ...schemaOptions })

categorySchema.index({ businessId: 1, slug: 1 }, { unique: true })
categorySchema.index({ businessId: 1, status: 1, sortOrder: 1 })
export const Category = modelFor('Category', categorySchema)
