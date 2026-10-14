import mongoose from 'mongoose'
import { businessField, modelFor, schemaOptions } from './common.js'
const { Schema } = mongoose

const paymentSchema = new Schema({
  businessId: businessField,
  orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
  provider: { type: String, required: true, trim: true, maxlength: 80 },
  amount: { type: Number, required: true, min: 0, validate: Number.isInteger },
  currency: { type: String, required: true, uppercase: true, minlength: 3, maxlength: 3 },
  status: { type: String, enum: ['created', 'requires_action', 'authorized', 'captured', 'failed', 'refunded', 'cancelled'], default: 'created', index: true },
  providerReference: { type: String, trim: true, maxlength: 180 },
  customerReference: { type: String, trim: true, maxlength: 120 },
  submittedAt: Date,
  verifiedAt: Date,
  refundedAt: Date,
  refundReference: { type: String, trim: true, maxlength: 180 },
  publicInstructions: { type: String, maxlength: 1000 },
  collectionDetails: {
    merchantNumber: { type: String, trim: true, maxlength: 40 },
    accountType: { type: String, trim: true, maxlength: 40 },
    instructions: { type: String, trim: true, maxlength: 500 },
  },
  idempotencyKey: { type: String, required: true, maxlength: 160 },
  eventHistory: [{ providerEventId: { type: String, required: true }, type: { type: String, required: true }, receivedAt: { type: Date, default: Date.now }, processedAt: Date }],
  failureCode: { type: String, maxlength: 120 },
  failureMessage: { type: String, maxlength: 500 },
}, { ...schemaOptions, optimisticConcurrency: true, versionKey: '__v' })

paymentSchema.index({ businessId: 1, idempotencyKey: 1 }, { unique: true })
// A sparse compound index still indexes COD payments because businessId/provider
// are always present. Only real provider references need to be unique.
paymentSchema.index(
  { businessId: 1, provider: 1, providerReference: 1 },
  { unique: true, partialFilterExpression: { providerReference: { $type: 'string' } } },
)
paymentSchema.index({ businessId: 1, status: 1, createdAt: -1 })
export const Payment = modelFor('Payment', paymentSchema)
