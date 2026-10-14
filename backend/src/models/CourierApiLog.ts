import mongoose from 'mongoose'
import { businessField, modelFor, schemaOptions } from './common.js'
const { Schema } = mongoose
const courierApiLogSchema = new Schema({
  businessId: businessField,
  provider: { type: String, enum: ['steadfast', 'pathao', 'redx'], required: true, index: true },
  operation: { type: String, required: true, maxlength: 60 },
  orderId: { type: Schema.Types.ObjectId, ref: 'Order' },
  outcome: { type: String, enum: ['success', 'error', 'unavailable'], required: true },
  statusCode: { type: Number, min: 100, max: 599 },
  errorCode: { type: String, maxlength: 80 },
  message: { type: String, maxlength: 500 },
  durationMs: { type: Number, min: 0 },
}, { ...schemaOptions })
courierApiLogSchema.index({ businessId: 1, createdAt: -1 })
export const CourierApiLog = modelFor('CourierApiLog', courierApiLogSchema)
