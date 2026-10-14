import mongoose from 'mongoose'
import { businessField, modelFor, schemaOptions } from './common.js'
const { Schema } = mongoose

const productVariantSchema = new Schema({
  businessId: businessField,
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  sku: { type: String, required: true, trim: true, uppercase: true, maxlength: 80 },
  color: { type: String, required: true, trim: true, maxlength: 80 },
  colorCode: { type: String, trim: true, match: /^#[\da-f]{6}$/i },
  size: { type: String, required: true, trim: true, uppercase: true, maxlength: 24 },
  barcode: { type: String, trim: true, maxlength: 100 },
  attributes: { type: Map, of: { type: String, trim: true, maxlength: 80 }, default: {} },
  price: { type: Number, required: true, min: 0, validate: Number.isInteger },
  compareAtPrice: { type: Number, min: 0, validate: Number.isInteger },
  images: [{ url: { type: String, required: true, maxlength: 2048 }, alt: { type: String, maxlength: 250 }, sortOrder: { type: Number, min: 0, default: 0 }, width: { type: Number, min: 1 }, height: { type: Number, min: 1 }, responsiveVariants: [{ label: { type: String, enum: ['thumbnail', 'small', 'medium', 'large', 'xlarge'] }, width: { type: Number, min: 1 }, height: { type: Number, min: 1 }, format: { type: String, enum: ['jpeg', 'png', 'webp', 'avif'] }, url: { type: String, maxlength: 2048 } }] }],
  currency: { type: String, uppercase: true, minlength: 3, maxlength: 3, default: 'USD' },
  isActive: { type: Boolean, default: true, index: true },
  archivedActive: { type: Boolean, select: false },
}, { ...schemaOptions })

productVariantSchema.pre('validate', function () {
  if (this.compareAtPrice != null && this.price != null && this.compareAtPrice < this.price) {
    this.invalidate('compareAtPrice', 'Compare-at price must be at least the selling price')
  }
})
productVariantSchema.index({ businessId: 1, sku: 1 }, { unique: true })
productVariantSchema.index({ businessId: 1, productId: 1, isActive: 1 })
productVariantSchema.index({ businessId: 1, productId: 1, color: 1, size: 1 }, { unique: true })
productVariantSchema.index({ businessId: 1, barcode: 1 }, { unique: true, sparse: true })
export const ProductVariant = modelFor('ProductVariant', productVariantSchema)
