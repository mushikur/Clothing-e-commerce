import { createHash } from 'node:crypto'
import mongoose from 'mongoose'
import path from 'node:path'
import sharp, { type Metadata } from 'sharp'
import { MediaAsset } from '../../models/MediaAsset.js'
import { WebsiteSettings } from '../../models/WebsiteSettings.js'
import { AppError } from '../../utils/app-error.js'
import { env } from '../../config/env.js'
import { storageProvider } from './storage-provider.js'

const mimeByFormat = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif' } as const
const mimeToFormat: Record<string, string> = { 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' }
type MediaFormat = keyof typeof mimeByFormat
type RenderedImage = { variants: Array<{ label: 'thumbnail' | 'small' | 'medium' | 'large' | 'xlarge'; width: number; height: number; size: number; format: MediaFormat; key: string; url: string }>; format: MediaFormat; width: number; height: number; optimizedSize: number; originalWidth: number; originalHeight: number; mimeType: string }
const safeOriginalName = (name: string) => path.basename(name.replace(/[\\/]/g, '_')).replace(/[^a-z\d._-]/gi, '-').slice(0, 255) || 'image'
export type OptimizationSettings = { enabled: boolean; quality: number; maxWidth: number; maxHeight: number; preferredFormat: 'webp' | 'avif'; generateThumbnails: boolean; generateResponsiveSizes: boolean; keepOriginal: boolean; deleteUnusedImages: boolean; lazyLoading: boolean }
export const defaultOptimizationSettings: OptimizationSettings = { enabled: true, quality: 88, maxWidth: 2000, maxHeight: 2000, preferredFormat: 'webp', generateThumbnails: true, generateResponsiveSizes: true, keepOriginal: false, deleteUnusedImages: false, lazyLoading: true }

function normalizedFormat(metadata: Metadata): MediaFormat | undefined {
  if (metadata.format === 'heif' && metadata.compression === 'av1') return 'avif'
  return metadata.format && metadata.format in mimeByFormat ? metadata.format as MediaFormat : undefined
}

export async function inspectImageInput(input: Buffer, declaredMimeType: string) {
  const metadata = await sharp(input, { limitInputPixels: 80_000_000, failOn: 'error', animated: false }).metadata().catch(() => null)
  const format = metadata ? normalizedFormat(metadata) : undefined
  if (!metadata || !format || !metadata.width || !metadata.height || (metadata.pages ?? 1) > 1) throw new AppError(422, 'unsupported_image', 'Upload a non-animated JPEG, PNG, WebP, or AVIF image')
  if (format !== mimeToFormat[declaredMimeType]) throw new AppError(422, 'image_signature_mismatch', 'The file content does not match its declared image type')
  if (metadata.width > 12_000 || metadata.height > 12_000 || metadata.width * metadata.height > 80_000_000) throw new AppError(422, 'image_dimensions_exceeded', 'Image dimensions exceed the safe processing limit')
  return { metadata, format }
}

export async function getOptimizationSettings(businessId: unknown): Promise<OptimizationSettings> {
  const settings = await WebsiteSettings.findOne({ businessId }).select('mediaOptimization').lean() as { mediaOptimization?: Partial<OptimizationSettings> } | null
  return { ...defaultOptimizationSettings, ...(settings?.mediaOptimization || {}) }
}

function outputFormat(format: 'webp' | 'avif', quality: number) {
  return format === 'avif' ? { avif: { quality, effort: 4, chromaSubsampling: '4:4:4' as const } } : { webp: { quality, effort: 5, smartSubsample: true } }
}
function variantsFor(sourceWidth: number, maxWidth: number, settings: OptimizationSettings) {
  const widths = settings.generateResponsiveSizes ? [600, 1000, 1600, maxWidth] : [maxWidth]
  if (settings.generateThumbnails) widths.unshift(300)
  const targetWidths = [...new Set(widths.map((width) => Math.min(width, maxWidth, sourceWidth)).filter((width) => width > 0))].sort((a, b) => a - b)
  return targetWidths.map((width, index) => ({ width, label: width <= 300 && settings.generateThumbnails ? 'thumbnail' as const : width <= 600 ? 'small' as const : width <= 1000 ? 'medium' as const : width <= 1600 ? 'large' as const : 'xlarge' as const, isLargest: index === targetWidths.length - 1 }))
}

export async function renderVariants(input: Buffer, settings: OptimizationSettings, assetPrefix: string): Promise<RenderedImage> {
  const metadata = await sharp(input, { limitInputPixels: 80_000_000, failOn: 'error', animated: false }).metadata()
  if (!normalizedFormat(metadata) || !metadata.width || !metadata.height || (metadata.pages ?? 1) > 1) {
    throw new AppError(422, 'unsupported_image', 'Upload a non-animated JPEG, PNG, WebP, or AVIF image')
  }
  if (metadata.width > 12_000 || metadata.height > 12_000 || metadata.width * metadata.height > 80_000_000) throw new AppError(422, 'image_dimensions_exceeded', 'Image dimensions exceed the safe processing limit')
  const format = settings.preferredFormat
  const maxWidth = Math.min(settings.maxWidth, 4000)
  const maxHeight = Math.min(settings.maxHeight, 4000)
  const fit = Math.min(maxWidth / metadata.width, maxHeight / metadata.height, 1)
  const resizedWidth = Math.max(1, Math.round(metadata.width * fit))
  const resizedHeight = Math.max(1, Math.round(metadata.height * fit))
  const widths = variantsFor(resizedWidth, resizedWidth, settings)
  const variants: RenderedImage['variants'] = []
  try { for (const item of widths) {
    let label = item.label
    const result = await sharp(input, { limitInputPixels: 80_000_000, failOn: 'error' }).rotate().resize({ width: item.width, height: Math.min(maxHeight, Math.round(item.width * resizedHeight / resizedWidth)), fit: 'inside', withoutEnlargement: true }).toFormat(format, outputFormat(format, settings.quality)[format]).toBuffer({ resolveWithObject: true })
    const key = `${assetPrefix}/${label}.${format}`
    await storageProvider.put({ key, body: result.data, contentType: mimeByFormat[format] })
    variants.push({ label, width: result.info.width, height: result.info.height, size: result.data.length, format, key, url: storageProvider.url(key) })
  } } catch (error) { await Promise.all(variants.map((variant) => storageProvider.delete(variant.key).catch(() => undefined))); throw error }
  const largest = variants.at(-1)
  if (!largest) throw new AppError(422, 'image_processing_failed', 'No optimized image sizes could be generated')
  return { variants, format, width: largest.width, height: largest.height, optimizedSize: variants.reduce((total, item) => total + item.size, 0), originalWidth: metadata.width, originalHeight: metadata.height, mimeType: mimeByFormat[format] }
}

export async function uploadOptimizedImage(input: { businessId: unknown; file: Express.Multer.File; quality?: number; altText?: string }) {
  if (input.file.size > env.MEDIA_MAX_UPLOAD_BYTES) throw new AppError(413, 'image_too_large', `Images must be smaller than ${Math.floor(env.MEDIA_MAX_UPLOAD_BYTES / 1_000_000)} MB`)
  const { metadata: detectedFormat, format: sourceFormat } = await inspectImageInput(input.file.buffer, input.file.mimetype)
  const hash = createHash('sha256').update(input.file.buffer).digest('hex')
  const previous = await MediaAsset.findOne({ businessId: input.businessId, contentHash: hash, deletedAt: { $exists: false } })
  if (previous) return { asset: previous, duplicate: true }
  const settings = await getOptimizationSettings(input.businessId)
  const assetId = new mongoose.Types.ObjectId()
  const prefix = `${String(input.businessId)}/${assetId}`
  const originalKey = settings.keepOriginal ? `${prefix}/original.${sourceFormat}` : undefined
  if (originalKey) await storageProvider.put({ key: originalKey, body: input.file.buffer, contentType: input.file.mimetype })
  let rendered: RenderedImage
  try {
    if (settings.enabled) rendered = await renderVariants(input.file.buffer, settings, prefix)
    else {
      const width = detectedFormat.width!; const height = detectedFormat.height!; const format = sourceFormat
      const key = `${prefix}/large.${format}`
      await storageProvider.put({ key, body: input.file.buffer, contentType: input.file.mimetype })
      rendered = { variants: [{ label: 'large', width, height, size: input.file.size, format, key, url: storageProvider.url(key) }], format, width, height, optimizedSize: input.file.size, originalWidth: width, originalHeight: height, mimeType: input.file.mimetype }
    }
  }
  catch (error) { if (originalKey) await storageProvider.delete(originalKey).catch(() => undefined); throw error }
  try {
    const asset = await MediaAsset.create({
      _id: assetId, businessId: input.businessId, contentHash: hash, originalName: safeOriginalName(input.file.originalname), mimeType: input.file.mimetype,
      format: rendered.format, width: rendered.width, height: rendered.height, originalWidth: rendered.originalWidth, originalHeight: rendered.originalHeight,
      originalSize: input.file.size, optimizedSize: rendered.optimizedSize, quality: input.quality ?? settings.quality, altText: input.altText?.trim().slice(0, 250) || '', originalKey,
      variants: rendered.variants, storageProvider: storageProvider.name,
    })
    return { asset, duplicate: false }
  } catch (error) {
    await Promise.all([...rendered.variants.map((variant) => storageProvider.delete(variant.key).catch(() => undefined)), ...(originalKey ? [storageProvider.delete(originalKey).catch(() => undefined)] : [])])
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
      const existing = await MediaAsset.findOne({ businessId: input.businessId, contentHash: hash, deletedAt: { $exists: false } })
      if (existing) return { asset: existing, duplicate: true }
    }
    throw error
  }
}

export async function reoptimizeAsset(asset: InstanceType<typeof MediaAsset>, settings: OptimizationSettings) {
  const sourceKey = asset.originalKey || [...asset.variants].sort((a, b) => b.width - a.width)[0]?.key
  if (!sourceKey) throw new AppError(422, 'media_source_missing', 'No source image is available to optimize')
  const source = await storageProvider.read(sourceKey)
  const prefix = `${String(asset.businessId)}/${String(asset._id)}`
  const rendered = await renderVariants(source, settings, prefix)
  const oldVariants = asset.variants
  const oldRetiredObjects = asset.retiredObjects as Array<{ key: string; url: string; size: number }>
  const oldFormat = asset.format
  const oldWidth = asset.width
  const oldHeight = asset.height
  const oldOptimizedSize = asset.optimizedSize
  const oldQuality = asset.quality
  const oldLastOptimizedAt = asset.lastOptimizedAt
  const oldKeys = (oldVariants as Array<{ key: string }>).map((variant) => variant.key)
  const renderedKeys = new Set(rendered.variants.map((variant) => variant.key))
  const retainedObjects = oldRetiredObjects.filter((retired) => !renderedKeys.has(retired.key))
  const retiredObjects = [...retainedObjects, ...(oldVariants as Array<{ key: string; url: string; size: number }>).filter((variant) => !renderedKeys.has(variant.key) && !retainedObjects.some((retired) => retired.key === variant.key)).map(({ key, url, size }) => ({ key, url, size }))]
  const oldOriginalKey = asset.originalKey
  if (settings.keepOriginal && !oldOriginalKey) {
    const originalFormat = mimeToFormat[asset.mimeType]
    const originalKey = `${String(asset.businessId)}/${String(asset._id)}/original.${originalFormat}`
    await storageProvider.put({ key: originalKey, body: source, contentType: asset.mimeType })
    asset.originalKey = originalKey
  } else if (!settings.keepOriginal && oldOriginalKey) asset.originalKey = undefined
  asset.variants = rendered.variants as typeof asset.variants
  asset.retiredObjects = retiredObjects as typeof asset.retiredObjects
  asset.format = rendered.format
  asset.width = rendered.width
  asset.height = rendered.height
  asset.optimizedSize = rendered.optimizedSize
  asset.quality = settings.quality
  asset.lastOptimizedAt = new Date()
  try { await asset.save() } catch (error) {
    await Promise.all([...rendered.variants.filter((variant) => !oldKeys.includes(variant.key)).map((variant) => storageProvider.delete(variant.key).catch(() => undefined)), ...(asset.originalKey && asset.originalKey !== oldOriginalKey ? [storageProvider.delete(asset.originalKey).catch(() => undefined)] : [])])
    asset.variants = oldVariants
    asset.retiredObjects = oldRetiredObjects
    asset.originalKey = oldOriginalKey
    asset.format = oldFormat
    asset.width = oldWidth
    asset.height = oldHeight
    asset.optimizedSize = oldOptimizedSize
    asset.quality = oldQuality
    asset.lastOptimizedAt = oldLastOptimizedAt
    throw error
  }
  await Promise.all([...(!settings.keepOriginal && oldOriginalKey ? [storageProvider.delete(oldOriginalKey).catch(() => undefined)] : [])])
}

export function mediaResponse(asset: InstanceType<typeof MediaAsset>) {
  const variants = [...asset.variants].sort((a, b) => a.width - b.width)
  const large = variants.at(-1)
  const storageBytes = asset.optimizedSize + (asset.originalKey ? asset.originalSize : 0) + (asset.retiredObjects as Array<{ key: string; url: string; size: number }>).reduce((total, object) => total + object.size, 0)
  const storageSaved = Math.max(0, asset.originalSize - storageBytes)
  return { id: asset.id, originalName: asset.originalName, mimeType: asset.mimeType, format: asset.format, width: asset.width, height: asset.height, originalWidth: asset.originalWidth, originalHeight: asset.originalHeight, originalSize: asset.originalSize, optimizedSize: asset.optimizedSize, storageBytes, storageSaved, storageSavedPercentage: asset.originalSize ? Math.max(0, Math.round(storageSaved / asset.originalSize * 1000) / 10) : 0, quality: asset.quality, altText: asset.altText, originalUrl: asset.originalKey ? storageProvider.url(asset.originalKey) : undefined, url: large?.url, thumbnailUrl: variants.find((variant) => variant.label === 'thumbnail')?.url || variants[0]?.url, srcSet: variants.map((variant) => `${variant.url} ${variant.width}w`).join(', '), sizes: '(max-width: 640px) 100vw, (max-width: 1200px) 50vw, 1000px', variants: variants.map(({ label, width, height, size, format, url }) => ({ label, width, height, size, format, url })), createdAt: asset.createdAt, lastOptimizedAt: asset.lastOptimizedAt }
}
