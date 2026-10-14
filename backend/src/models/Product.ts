import mongoose from 'mongoose'
import { businessField, modelFor, schemaOptions, slugPattern } from './common.js'
const { Schema } = mongoose

const productSchema = new Schema({
  businessId: businessField,
  categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
  subcategoryId: { type: Schema.Types.ObjectId, ref: 'Subcategory' },
  name: { type: String, required: true, trim: true, minlength: 1, maxlength: 180 },
  slug: { type: String, required: true, lowercase: true, trim: true, match: slugPattern },
  sku: { type: String, trim: true, uppercase: true, maxlength: 80 },
  description: { type: String, trim: true, maxlength: 20_000 },
  shortDescription: { type: String, trim: true, maxlength: 500 },
  brand: { type: String, trim: true, maxlength: 100 },
  price: { type: Number, min: 0, validate: Number.isInteger },
  discountPercent: { type: Number, min: 0, max: 100, validate: Number.isInteger, default: 0 },
  costPrice: { type: Number, min: 0, validate: Number.isInteger },
  material: { type: String, trim: true, maxlength: 120 },
  fabric: { type: String, trim: true, maxlength: 120 },
  gender: { type: String, enum: ['women', 'men', 'unisex', 'kids', 'unspecified'], default: 'unspecified' },
  season: { type: String, trim: true, maxlength: 60 },
  collection: { type: String, trim: true, maxlength: 100 },
  media: [{ kind: { type: String, enum: ['image', 'video'], default: 'image' }, url: { type: String, required: true, maxlength: 2048 }, alt: { type: String, maxlength: 250 }, sortOrder: { type: Number, min: 0, default: 0 }, width: { type: Number, min: 1 }, height: { type: Number, min: 1 }, responsiveVariants: [{ label: { type: String, enum: ['thumbnail', 'small', 'medium', 'large', 'xlarge'] }, width: { type: Number, min: 1 }, height: { type: Number, min: 1 }, format: { type: String, enum: ['jpeg', 'png', 'webp', 'avif'] }, url: { type: String, maxlength: 2048 } }] }],
  tags: [{ type: String, trim: true, lowercase: true, maxlength: 40 }],
  status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft', index: true },
  publishedAt: { type: Date },
  seo: { title: { type: String, maxlength: 70 }, description: { type: String, maxlength: 170 }, canonicalUrl: { type: String, maxlength: 2048 } },
  translations: {
    en: { name: { type: String, trim: true, maxlength: 180 }, shortDescription: { type: String, trim: true, maxlength: 500 }, description: { type: String, trim: true, maxlength: 20_000 }, slug: { type: String, trim: true, lowercase: true, maxlength: 180 }, seoTitle: { type: String, trim: true, maxlength: 70 }, seoDescription: { type: String, trim: true, maxlength: 170 } },
    bn: { name: { type: String, trim: true, maxlength: 180 }, shortDescription: { type: String, trim: true, maxlength: 500 }, description: { type: String, trim: true, maxlength: 20_000 }, slug: { type: String, trim: true, maxlength: 180 }, seoTitle: { type: String, trim: true, maxlength: 70 }, seoDescription: { type: String, trim: true, maxlength: 170 } },
  },
}, { ...schemaOptions })

productSchema.index({ businessId: 1, slug: 1 }, { unique: true })
productSchema.index({ businessId: 1, sku: 1 }, { unique: true, sparse: true })
productSchema.index({ businessId: 1, status: 1, categoryId: 1, publishedAt: -1, _id: -1 })
productSchema.index({ businessId: 1, status: 1, name: 1 })
productSchema.index({ businessId: 1, tags: 1, status: 1 })
productSchema.index({ businessId: 1, name: 'text', description: 'text', 'translations.en.name': 'text', 'translations.bn.name': 'text', 'translations.en.description': 'text', 'translations.bn.description': 'text', tags: 'text' })
productSchema.pre('validate', function () {
  if (this.discountPercent && this.price == null) this.invalidate('price', 'A base price is required to apply a discount')
  if (this.status === 'published' && !this.publishedAt) this.publishedAt = new Date()
})
export const Product = modelFor('Product', productSchema)
