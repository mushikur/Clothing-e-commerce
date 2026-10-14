import mongoose from 'mongoose'
import { modelFor, schemaOptions, slugPattern } from './common.js'
const { Schema } = mongoose

const businessSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  slug: { type: String, required: true, lowercase: true, trim: true, match: slugPattern },
  domains: [{ type: String, lowercase: true, trim: true, maxlength: 253 }],
  status: { type: String, enum: ['active', 'suspended'], default: 'active', index: true },
  defaultLocale: { type: String, default: 'en' },
  defaultCurrency: { type: String, uppercase: true, default: 'USD', minlength: 3, maxlength: 3 },
  checkout: {
    guestCheckoutEnabled: { type: Boolean, default: true },
    cashOnDeliveryEnabled: { type: Boolean, default: true },
    paymentMethods: [{
      code: { type: String, enum: ['bkash', 'nagad'], required: true },
      enabled: { type: Boolean, default: false },
      merchantNumber: { type: String, trim: true, maxlength: 40 },
      accountType: { type: String, trim: true, maxlength: 40 },
      instructions: { type: String, trim: true, maxlength: 500 },
    }],
    deliveryOptions: [{
      code: { type: String, required: true, trim: true, lowercase: true, maxlength: 40 },
      label: { type: String, required: true, trim: true, maxlength: 80 },
      fee: { type: Number, required: true, min: 0, validate: Number.isInteger },
      freeAbove: { type: Number, min: 0, validate: Number.isInteger },
      estimatedDays: { type: String, trim: true, maxlength: 40 },
      enabled: { type: Boolean, default: true },
    }],
  },
  planKey: { type: String, default: 'standard' },
  featureFlags: { type: Map, of: Boolean, default: {} },
}, { ...schemaOptions })

businessSchema.index({ slug: 1 }, { unique: true })
businessSchema.index({ domains: 1 }, { unique: true, sparse: true })

export const Business = modelFor('Business', businessSchema)
