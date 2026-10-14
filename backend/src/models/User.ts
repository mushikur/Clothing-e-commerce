import mongoose from 'mongoose'
import { businessField, modelFor, normalizeEmail, schemaOptions } from './common.js'
const { Schema } = mongoose

const userSchema = new Schema({
  businessId: businessField,
  name: { type: String, required: true, trim: true, minlength: 1, maxlength: 100 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254, set: normalizeEmail },
  passwordHash: { type: String, required: true, select: false, minlength: 20 },
  phone: { type: String, trim: true, maxlength: 32 },
  role: { type: String, enum: ['customer', 'staff', 'manager', 'admin', 'super_admin'], default: 'customer', required: true },
  status: { type: String, enum: ['active', 'suspended', 'pending'], default: 'pending' },
  emailVerifiedAt: { type: Date },
  lastLoginAt: { type: Date },
  failedLoginCount: { type: Number, min: 0, default: 0, select: false },
  lockedUntil: { type: Date, select: false },
  addressIds: [{ type: Schema.Types.ObjectId, ref: 'Address' }],
}, { ...schemaOptions })

userSchema.index({ businessId: 1, email: 1 }, { unique: true })
userSchema.index({ businessId: 1, role: 1, status: 1 })
userSchema.index({ businessId: 1, emailVerifiedAt: 1, status: 1 })

export const User = modelFor('User', userSchema)
