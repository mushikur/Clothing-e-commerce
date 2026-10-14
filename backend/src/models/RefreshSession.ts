import mongoose from 'mongoose'
import { businessField, modelFor, schemaOptions } from './common.js'
const { Schema } = mongoose

const refreshSessionSchema = new Schema({
  businessId: businessField,
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tokenHash: { type: String, required: true, select: false },
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date },
  replacedBySessionId: { type: Schema.Types.ObjectId, ref: 'RefreshSession' },
  userAgent: { type: String, maxlength: 512 },
  ipHash: { type: String, maxlength: 128 },
}, { ...schemaOptions })

refreshSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
refreshSessionSchema.index({ businessId: 1, userId: 1, revokedAt: 1 })
refreshSessionSchema.index({ tokenHash: 1 }, { unique: true })

export const RefreshSession = modelFor('RefreshSession', refreshSessionSchema)
