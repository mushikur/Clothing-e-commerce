import mongoose from 'mongoose'
import { businessField, modelFor, schemaOptions } from './common.js'
const { Schema } = mongoose

const accountTokenSchema = new Schema({
  businessId: businessField,
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  purpose: { type: String, enum: ['verify_email', 'password_reset'], required: true },
  tokenHash: { type: String, required: true, select: false },
  expiresAt: { type: Date, required: true },
  usedAt: { type: Date },
}, { ...schemaOptions })

accountTokenSchema.index({ tokenHash: 1 }, { unique: true })
accountTokenSchema.index({ businessId: 1, userId: 1, purpose: 1, usedAt: 1 })
accountTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export const AccountToken = modelFor('AccountToken', accountTokenSchema)
