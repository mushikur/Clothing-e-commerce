import mongoose, { type Model, type Schema as MongooseSchema } from 'mongoose'
const { model, models, Schema } = mongoose

export const schemaOptions = { timestamps: true, strict: 'throw' as const, minimize: false, versionKey: false as const }
export const objectId = Schema.Types.ObjectId
export const businessField = { type: objectId, ref: 'Business', required: true, immutable: true, index: true }
export const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function normalizeEmail(value: string): string { return value.trim().toLowerCase() }
export function normalizeCode(value: string): string { return value.trim().toUpperCase() }
export function modelFor(name: string, schema: MongooseSchema): Model<any> {
  return (models[name] as Model<any> | undefined) ?? model(name, schema)
}
