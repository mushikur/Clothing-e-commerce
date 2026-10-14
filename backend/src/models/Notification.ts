import mongoose from 'mongoose'
import { businessField, modelFor, schemaOptions } from './common.js'
const { Schema } = mongoose

const notificationSchema = new Schema({
  businessId: businessField,
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  channel: { type: String, enum: ['email', 'sms', 'push', 'in_app'], required: true },
  type: { type: String, required: true, trim: true, maxlength: 100 },
  templateKey: { type: String, required: true, trim: true, maxlength: 120 },
  payload: { type: Map, of: Schema.Types.Mixed, default: {} },
  status: { type: String, enum: ['queued', 'sending', 'sent', 'failed'], default: 'queued', index: true },
  providerReference: { type: String, maxlength: 180 },
  attempts: { type: Number, min: 0, default: 0 },
  lastError: { type: String, maxlength: 500 },
  sentAt: { type: Date },
  readAt: { type: Date },
  expiresAt: { type: Date },
}, { ...schemaOptions })

notificationSchema.index({ businessId: 1, userId: 1, status: 1, createdAt: -1 })
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, sparse: true })
export const Notification = modelFor('Notification', notificationSchema)
