import mongoose from 'mongoose'
import { businessField, modelFor, schemaOptions, slugPattern } from './common.js'
const { Schema } = mongoose

const landingPageSchema = new Schema({
  businessId: businessField,
  slug: { type: String, required: true, lowercase: true, trim: true, match: slugPattern, maxlength: 80 },
  title: { type: String, required: true, trim: true, maxlength: 160 },
  summary: { type: String, trim: true, maxlength: 500 },
  translations: { en: { title: { type: String, trim: true, maxlength: 160 }, summary: { type: String, trim: true, maxlength: 500 }, seoTitle: { type: String, trim: true, maxlength: 70 }, seoDescription: { type: String, trim: true, maxlength: 170 } }, bn: { title: { type: String, trim: true, maxlength: 160 }, summary: { type: String, trim: true, maxlength: 500 }, seoTitle: { type: String, trim: true, maxlength: 70 }, seoDescription: { type: String, trim: true, maxlength: 170 } } },
  status: { type: String, enum: ['draft', 'published'], default: 'draft', index: true },
  seo: { title: { type: String, trim: true, maxlength: 70 }, description: { type: String, trim: true, maxlength: 170 } },
  publishedAt: { type: Date },
}, { ...schemaOptions, optimisticConcurrency: true, versionKey: '__v' })

landingPageSchema.index({ businessId: 1, slug: 1 }, { unique: true })
landingPageSchema.index({ businessId: 1, status: 1, updatedAt: -1 })
export const LandingPage = modelFor('LandingPage', landingPageSchema)
