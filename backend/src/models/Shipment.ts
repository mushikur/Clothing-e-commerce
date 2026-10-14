import mongoose from 'mongoose'
import { businessField, modelFor, schemaOptions } from './common.js'
const { Schema } = mongoose

const shipmentSchema = new Schema({
  businessId: businessField,
  orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
  provider: { type: String, required: true, trim: true, maxlength: 80 },
  trackingMode: { type: String, enum: ['real', 'manual', 'simulated'], default: 'real', index: true },
  shipmentId: { type: String, trim: true, maxlength: 160 },
  consignmentId: { type: String, trim: true, maxlength: 160 },
  status: { type: String, enum: ['pending', 'booked', 'picked_up', 'in_transit', 'delivered', 'failed', 'cancelled', 'returned'], default: 'pending', index: true },
  trackingNumber: { type: String, trim: true, maxlength: 120 },
  trackingUrl: { type: String, maxlength: 2048 },
  providerReference: { type: Schema.Types.Mixed, select: false },
  idempotencyKey: { type: String, maxlength: 180 },
  lastErrorCode: { type: String, maxlength: 80 },
  returnShipment: { provider: { type: String, maxlength: 80 }, status: { type: String, enum: ['requested', 'approved', 'booked', 'picked_up', 'in_transit', 'returned', 'inspection', 'complete', 'rejected', 'manual_required'] }, trackingNumber: { type: String, maxlength: 120 }, trackingUrl: { type: String, maxlength: 2048 }, limitation: { type: String, maxlength: 500 }, events: [{ code: { type: String, maxlength: 80 }, description: { type: String, maxlength: 500 }, occurredAt: Date, location: { type: String, maxlength: 160 } }] },
  shippingCost: { type: Number, min: 0, validate: Number.isInteger, default: 0 },
  currency: { type: String, uppercase: true, minlength: 3, maxlength: 3 },
  events: [{ code: { type: String, required: true, maxlength: 80 }, description: { type: String, maxlength: 500 }, occurredAt: { type: Date, required: true }, location: { type: String, maxlength: 160 } }],
  bookedAt: { type: Date }, deliveredAt: { type: Date },
}, { ...schemaOptions, optimisticConcurrency: true, versionKey: '__v' })

shipmentSchema.index({ businessId: 1, provider: 1, trackingNumber: 1 }, { unique: true, sparse: true })
shipmentSchema.index({ businessId: 1, orderId: 1 }, { unique: true })
shipmentSchema.index({ businessId: 1, idempotencyKey: 1 }, { unique: true, sparse: true })
shipmentSchema.index({ businessId: 1, status: 1, createdAt: -1 })
export const Shipment = modelFor('Shipment', shipmentSchema)
