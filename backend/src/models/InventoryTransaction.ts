import mongoose from 'mongoose'
import { businessField, modelFor, schemaOptions } from './common.js'
const { Schema } = mongoose

const inventoryTransactionSchema = new Schema({
  businessId: { ...businessField, immutable: true },
  inventoryId: { type: Schema.Types.ObjectId, ref: 'Inventory', required: true, immutable: true },
  variantId: { type: Schema.Types.ObjectId, ref: 'ProductVariant', required: true, immutable: true },
  type: { type: String, enum: ['receipt', 'reservation', 'release', 'sale', 'return', 'adjustment'], required: true, immutable: true },
  quantityDelta: { type: Number, required: true, validate: Number.isInteger, immutable: true },
  reason: { type: String, required: true, trim: true, maxlength: 300, immutable: true },
  sourceType: { type: String, enum: ['order', 'purchase_order', 'manual', 'return'], required: true, immutable: true },
  sourceId: { type: Schema.Types.ObjectId, immutable: true },
  idempotencyKey: { type: String, maxlength: 160, immutable: true },
  actorUserId: { type: Schema.Types.ObjectId, ref: 'User', immutable: true },
}, { ...schemaOptions, timestamps: { createdAt: true, updatedAt: false } })

inventoryTransactionSchema.path('quantityDelta').validate((value: number) => value !== 0, 'Inventory transaction delta cannot be zero')
inventoryTransactionSchema.index({ businessId: 1, inventoryId: 1, createdAt: -1 })
inventoryTransactionSchema.index({ businessId: 1, idempotencyKey: 1 }, { unique: true, sparse: true })
inventoryTransactionSchema.index({ businessId: 1, sourceType: 1, sourceId: 1 })
export const InventoryTransaction = modelFor('InventoryTransaction', inventoryTransactionSchema)
