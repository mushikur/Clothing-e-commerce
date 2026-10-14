import mongoose from 'mongoose'
import { businessField, modelFor, schemaOptions } from './common.js'
const { Schema } = mongoose

const providerSchema = new Schema({
  provider: { type: String, enum: ['steadfast', 'pathao', 'redx'], required: true },
  enabled: { type: Boolean, default: false },
  mode: { type: String, enum: ['sandbox', 'live'], default: 'live' },
  encryptedCredentials: { type: String, select: false },
  merchant: { storeName: { type: String, trim: true, maxlength: 120 }, contactName: { type: String, trim: true, maxlength: 100 }, phone: { type: String, trim: true, maxlength: 32 } },
  pickup: { locationId: { type: String, trim: true, maxlength: 100 }, name: { type: String, trim: true, maxlength: 120 }, address: { type: String, trim: true, maxlength: 500 }, city: { type: String, trim: true, maxlength: 100 }, phone: { type: String, trim: true, maxlength: 32 } },
  status: { type: String, enum: ['configuration_required', 'configured_unverified', 'connected', 'error'], default: 'configuration_required' },
  lastTestedAt: Date,
  lastErrorCode: { type: String, maxlength: 80 },
}, { _id: false, strict: 'throw' })
const courierConfigurationSchema = new Schema({
  businessId: { ...businessField, index: false },
  defaultProvider: { type: String, enum: ['steadfast', 'pathao', 'redx'] },
  customerTrackingEnabled: { type: Boolean, default: true },
  providers: { type: [providerSchema], default: [] },
}, { ...schemaOptions, optimisticConcurrency: true, versionKey: '__v' })
courierConfigurationSchema.index({ businessId: 1 }, { unique: true })
export const CourierConfiguration = modelFor('CourierConfiguration', courierConfigurationSchema)
