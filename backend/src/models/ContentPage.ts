import mongoose from 'mongoose'
import { businessField, modelFor, schemaOptions, slugPattern } from './common.js'
const { Schema } = mongoose

const contentPageSchema = new Schema({
  businessId: businessField,
  pageKey: { type: String, required: true, enum: ['about', 'contact', 'faq', 'privacy', 'terms', 'returns', 'refunds', 'shipping'], lowercase: true, trim: true },
  slug: { type: String, required: true, lowercase: true, trim: true, match: slugPattern },
  title: { type: String, required: true, trim: true, maxlength: 160 },
  summary: { type: String, trim: true, maxlength: 500 },
  body: { type: String, trim: true, maxlength: 50000, default: '' },
  faqs: [{ question: { type: String, trim: true, maxlength: 240 }, answer: { type: String, trim: true, maxlength: 4000 } }],
  status: { type: String, enum: ['draft', 'published'], default: 'draft', index: true },
  seo: { title: { type: String, trim: true, maxlength: 70 }, description: { type: String, trim: true, maxlength: 170 } },
  publishedAt: { type: Date },
  translations: { en: { title: { type: String, trim: true, maxlength: 160 }, summary: { type: String, trim: true, maxlength: 500 }, body: { type: String, trim: true, maxlength: 50000 }, faqs: [{ question: { type: String, trim: true, maxlength: 240 }, answer: { type: String, trim: true, maxlength: 4000 } }], seoTitle: { type: String, trim: true, maxlength: 70 }, seoDescription: { type: String, trim: true, maxlength: 170 } }, bn: { title: { type: String, trim: true, maxlength: 160 }, summary: { type: String, trim: true, maxlength: 500 }, body: { type: String, trim: true, maxlength: 50000 }, faqs: [{ question: { type: String, trim: true, maxlength: 240 }, answer: { type: String, trim: true, maxlength: 4000 } }], seoTitle: { type: String, trim: true, maxlength: 70 }, seoDescription: { type: String, trim: true, maxlength: 170 } } },
}, { ...schemaOptions, optimisticConcurrency: true, versionKey: '__v' })

contentPageSchema.index({ businessId: 1, pageKey: 1 }, { unique: true })
contentPageSchema.index({ businessId: 1, status: 1, slug: 1 })
export const ContentPage = modelFor('ContentPage', contentPageSchema)
