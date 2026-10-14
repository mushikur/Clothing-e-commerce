import mongoose from 'mongoose'
import { businessField, modelFor, schemaOptions } from './common.js'
const { Schema } = mongoose

const mediaOptimizationJobSchema = new Schema({
  businessId: businessField,
  type: { type: String, required: true, enum: ['optimize', 'delete_unused'] },
  status: { type: String, required: true, enum: ['queued', 'running', 'completed', 'failed'], default: 'queued', index: true },
  total: { type: Number, min: 0, default: 0 },
  processed: { type: Number, min: 0, default: 0 },
  failedCount: { type: Number, min: 0, default: 0 },
  lastAssetId: { type: Schema.Types.ObjectId },
  upperAssetId: { type: Schema.Types.ObjectId },
  targetAssetIds: [{ type: Schema.Types.ObjectId }],
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  workerId: { type: String, maxlength: 80 },
  leaseUntil: { type: Date },
  startedAt: { type: Date },
  completedAt: { type: Date },
  lastError: { type: String, maxlength: 500 },
}, { ...schemaOptions })

mediaOptimizationJobSchema.index({ status: 1, createdAt: 1 })
mediaOptimizationJobSchema.index({ businessId: 1, createdAt: -1 })
export const MediaOptimizationJob = modelFor('MediaOptimizationJob', mediaOptimizationJobSchema)
