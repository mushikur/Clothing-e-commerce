import mongoose from 'mongoose'
import { businessField, modelFor, schemaOptions } from './common.js'
const schema = new mongoose.Schema({
  businessId: businessField,
  key: { type: String, required: true, maxlength: 320 },
  name: { type: String, required: true, maxlength: 100 },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  previousStatus: { type: String, enum: ['active', 'pending', 'suspended'] },
  deletedAt: { type: Date, required: true },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  restoredAt: Date,
}, schemaOptions)
schema.index({ businessId: 1, key: 1 }, { unique: true })
schema.index({ businessId: 1, restoredAt: 1, deletedAt: -1 })
export const CustomerArchive = modelFor('CustomerArchive', schema)
