import mongoose from 'mongoose'
import { businessField, modelFor, schemaOptions } from './common.js'
const { Schema } = mongoose

const websiteSettingsSchema = new Schema({
  businessId: { ...businessField, index: false },
  displayName: { type: String, required: true, trim: true, maxlength: 120 },
  logoUrl: { type: String, maxlength: 2048 },
  faviconUrl: { type: String, maxlength: 2048 },
  contact: { email: { type: String, trim: true, lowercase: true, maxlength: 254 }, phone: { type: String, trim: true, maxlength: 32 }, address: { type: String, trim: true, maxlength: 500 } },
  socialLinks: [{ platform: { type: String, required: true, maxlength: 40 }, url: { type: String, required: true, maxlength: 2048 } }],
  seo: { title: { type: String, maxlength: 70 }, description: { type: String, maxlength: 170 }, defaultImageUrl: { type: String, maxlength: 2048 } },
  locale: { type: String, default: 'en', maxlength: 16 },
  defaultLanguage: { type: String, enum: ['en', 'bn'], default: 'en' },
  enabledLocales: { type: [{ type: String, enum: ['en', 'bn'] }], default: ['en'] },
  currency: { type: String, required: true, uppercase: true, minlength: 3, maxlength: 3, default: 'USD' },
  paymentProviders: [{ provider: { type: String, required: true, maxlength: 80 }, enabled: { type: Boolean, default: false }, credentialRef: { type: String, maxlength: 200 }, publicConfig: { type: Map, of: String, default: {} } }],
  courierProviders: [{ provider: { type: String, required: true, maxlength: 80 }, enabled: { type: Boolean, default: false }, credentialRef: { type: String, maxlength: 200 }, publicConfig: { type: Map, of: String, default: {} } }],
  defaultThemeId: { type: Schema.Types.ObjectId, ref: 'Theme' },
  mediaOptimization: {
    enabled: { type: Boolean, default: true },
    quality: { type: Number, min: 70, max: 95, default: 88 },
    maxWidth: { type: Number, min: 300, max: 4000, default: 2000 },
    maxHeight: { type: Number, min: 300, max: 4000, default: 2000 },
    preferredFormat: { type: String, enum: ['webp', 'avif'], default: 'webp' },
    generateThumbnails: { type: Boolean, default: true },
    generateResponsiveSizes: { type: Boolean, default: true },
    keepOriginal: { type: Boolean, default: false },
    deleteUnusedImages: { type: Boolean, default: false },
    lazyLoading: { type: Boolean, default: true },
  },
}, { ...schemaOptions, optimisticConcurrency: true, versionKey: '__v' })

websiteSettingsSchema.index({ businessId: 1 }, { unique: true })
export const WebsiteSettings = modelFor('WebsiteSettings', websiteSettingsSchema)
