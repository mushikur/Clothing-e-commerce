import mongoose from 'mongoose'
import { businessField, modelFor, schemaOptions } from './common.js'
const { Schema } = mongoose

const hexColor = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i
const themeSchema = new Schema({
  businessId: businessField,
  name: { type: String, required: true, trim: true, maxlength: 100 },
  preset: { type: String, enum: ['luxury', 'minimal', 'modern', 'streetwear', 'elegant', 'classic', 'dark_fashion', 'premium_boutique'], default: 'luxury', index: true },
  status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft', index: true },
  version: { type: Number, min: 1, default: 1 },
  colors: {
    primary: { type: String, match: hexColor, default: '#1c1c1a' }, secondary: { type: String, match: hexColor, default: '#716e67' },
    accent: { type: String, match: hexColor, default: '#9c5742' }, background: { type: String, match: hexColor, default: '#f5f3ef' },
    surface: { type: String, match: hexColor, default: '#fffefa' }, text: { type: String, match: hexColor, default: '#22211f' },
    mutedText: { type: String, match: hexColor, default: '#706c66' }, border: { type: String, match: hexColor, default: '#dedbd4' },
    success: { type: String, match: hexColor, default: '#41634c' }, warning: { type: String, match: hexColor, default: '#91601f' },
    error: { type: String, match: hexColor, default: '#a4423c' },
  },
  typography: {
    displayFont: { type: String, enum: ['serif', 'sans', 'editorial'], default: 'editorial' },
    bodyFont: { type: String, enum: ['sans', 'serif'], default: 'sans' },
  },
  components: {
    buttonStyle: { type: String, enum: ['solid', 'outline', 'soft'], default: 'solid' },
    cardStyle: { type: String, enum: ['minimal', 'bordered', 'soft'], default: 'minimal' },
    headerStyle: { type: String, enum: ['clean', 'editorial'], default: 'clean' },
    footerStyle: { type: String, enum: ['minimal', 'editorial'], default: 'minimal' },
    radius: { type: String, enum: ['sharp', 'soft', 'rounded'], default: 'soft' },
    spacing: { type: String, enum: ['compact', 'comfortable', 'relaxed'], default: 'comfortable' },
    backgroundStyle: { type: String, enum: ['flat', 'warm', 'cool'], default: 'warm' },
  },
  componentSettings: { type: Map, of: Schema.Types.Mixed, default: {} },
  publishedAt: { type: Date },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { ...schemaOptions, optimisticConcurrency: true, versionKey: '__v' })

themeSchema.index({ businessId: 1, status: 1, updatedAt: -1 })
themeSchema.index({ businessId: 1, version: 1 }, { unique: true })
export const Theme = modelFor('Theme', themeSchema)
