import mongoose from 'mongoose'
import { businessField, modelFor, schemaOptions } from './common.js'
const { Schema } = mongoose

const mediaVariantSchema = new Schema({
  label: { type: String, required: true, enum: ['thumbnail', 'small', 'medium', 'large', 'xlarge'] },
  width: { type: Number, required: true, min: 1 },
  height: { type: Number, required: true, min: 1 },
  size: { type: Number, required: true, min: 1 },
  format: { type: String, required: true, enum: ['jpeg', 'png', 'webp', 'avif'] },
  key: { type: String, required: true, maxlength: 512 },
  url: { type: String, required: true, maxlength: 2048 },
}, { _id: false })
const retiredObjectSchema = new Schema({ key: { type: String, required: true, maxlength: 512 }, url: { type: String, required: true, maxlength: 2048 }, size: { type: Number, required: true, min: 1 } }, { _id: false })

const mediaAssetSchema = new Schema({
  businessId: businessField,
  contentHash: { type: String, required: true, match: /^[a-f\d]{64}$/i },
  originalName: { type: String, required: true, trim: true, maxlength: 255 },
  mimeType: { type: String, required: true, enum: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] },
  format: { type: String, required: true, enum: ['jpeg', 'png', 'webp', 'avif'] },
  width: { type: Number, required: true, min: 1 },
  height: { type: Number, required: true, min: 1 },
  originalWidth: { type: Number, required: true, min: 1 },
  originalHeight: { type: Number, required: true, min: 1 },
  originalSize: { type: Number, required: true, min: 1 },
  optimizedSize: { type: Number, required: true, min: 1 },
  quality: { type: Number, required: true, min: 70, max: 95 },
  altText: { type: String, trim: true, maxlength: 250, default: '' },
  originalKey: { type: String, maxlength: 512 },
  variants: { type: [mediaVariantSchema], required: true, validate: (value: unknown[]) => value.length > 0 },
  retiredObjects: { type: [retiredObjectSchema], default: [] },
  storageProvider: { type: String, required: true, enum: ['local', 's3'] },
  deletedAt: { type: Date },
  lastOptimizedAt: { type: Date, default: Date.now },
}, { ...schemaOptions })

mediaAssetSchema.index({ businessId: 1, contentHash: 1 }, { unique: true })
mediaAssetSchema.index({ businessId: 1, createdAt: -1, _id: -1 })
mediaAssetSchema.index({ businessId: 1, optimizedSize: -1 })
export const MediaAsset = modelFor('MediaAsset', mediaAssetSchema)
