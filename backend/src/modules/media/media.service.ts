import mongoose from 'mongoose'
import { Category } from '../../models/Category.js'
import { ContentPage } from '../../models/ContentPage.js'
import { HomepageSection } from '../../models/HomepageSection.js'
import { LandingPage } from '../../models/LandingPage.js'
import { MediaAsset } from '../../models/MediaAsset.js'
import { Product } from '../../models/Product.js'
import { ProductVariant } from '../../models/ProductVariant.js'
import { Subcategory } from '../../models/Subcategory.js'
import { WebsiteSettings } from '../../models/WebsiteSettings.js'
import { AppError } from '../../utils/app-error.js'
import { MediaOptimizationJob } from '../../models/MediaOptimizationJob.js'
import { storageProvider } from './storage-provider.js'

function addUrls(value: unknown, urls: Set<string>) {
  if (!value || typeof value !== 'object') return
  if (Array.isArray(value)) { for (const item of value) addUrls(item, urls); return }
  if (value instanceof Map) { for (const item of value.values()) addUrls(item, urls); return }
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === 'string' && (key === 'url' || key === 'imageUrl' || key === 'logoUrl' || key === 'faviconUrl' || key === 'defaultImageUrl')) urls.add(item)
    else addUrls(item, urls)
  }
}

export async function referencedMediaUrls(businessId: unknown) {
  const [products, variants, categories, subcategories, site, sections, contentPages] = await Promise.all([
    Product.find({ businessId }).select('media').lean(), ProductVariant.find({ businessId }).select('images').lean(),
    Category.find({ businessId }).select('imageUrl').lean(), Subcategory.find({ businessId }).select('imageUrl').lean(),
    WebsiteSettings.findOne({ businessId }).select('logoUrl faviconUrl seo.defaultImageUrl').lean(), HomepageSection.find({ businessId }).select('content').lean(),
    ContentPage.find({ businessId }).select('body').lean(),
  ])
  const urls = new Set<string>()
  for (const value of [products, variants, categories, subcategories, site, sections, contentPages]) addUrls(value, urls)
  return urls
}

export async function mediaIsUsed(asset: InstanceType<typeof MediaAsset>, references?: Set<string>) {
  const urlSet = references || await referencedMediaUrls(asset.businessId)
  return [...(asset.variants as Array<{ url: string }>), ...(asset.retiredObjects as Array<{ url: string }> || [])].some((variant) => urlSet.has(variant.url))
}

export async function unusedMediaAssets(businessId: unknown) {
  const references = await referencedMediaUrls(businessId)
  const assets = await MediaAsset.find({ businessId, deletedAt: { $exists: false } }).sort({ _id: 1 }).lean()
  return assets.filter((asset) => ![...(asset.variants as Array<{ url: string }>), ...(asset.retiredObjects as Array<{ url: string }> || [])].some((variant) => references.has(variant.url)))
}

export async function deleteMediaAsset(asset: InstanceType<typeof MediaAsset>, references?: Set<string>) {
  if (await mediaIsUsed(asset, references)) throw new AppError(409, 'media_in_use', 'This image is still used by storefront content and cannot be deleted')
  await Promise.all([...(asset.variants as Array<{ key: string }>).map((variant) => storageProvider.delete(variant.key)), ...(asset.retiredObjects as Array<{ key: string }>).map((object) => storageProvider.delete(object.key)), ...(asset.originalKey ? [storageProvider.delete(asset.originalKey)] : [])])
  await MediaAsset.deleteOne({ _id: asset._id, businessId: asset.businessId })
}

export async function createMediaJob(businessId: unknown, actorId: string, type: 'optimize' | 'delete_unused', assetIds?: string[]) {
  let targetAssetIds: mongoose.Types.ObjectId[] | undefined
  let total = 0
  let upperAssetId: mongoose.Types.ObjectId | undefined
  if (assetIds?.length) {
    targetAssetIds = assetIds.map((id) => new mongoose.Types.ObjectId(id))
    targetAssetIds.sort((left, right) => left.toString().localeCompare(right.toString()))
    total = await MediaAsset.countDocuments({ businessId, _id: { $in: targetAssetIds }, deletedAt: { $exists: false } })
    if (total !== assetIds.length) throw new AppError(404, 'media_not_found', 'One or more selected images were not found')
    upperAssetId = targetAssetIds.reduce((largest, id) => id.toString() > largest.toString() ? id : largest)
  } else if (type === 'optimize') total = await MediaAsset.countDocuments({ businessId, deletedAt: { $exists: false } })
  else total = (await unusedMediaAssets(businessId)).length
  if (!upperAssetId) upperAssetId = (await MediaAsset.findOne({ businessId, deletedAt: { $exists: false } }).sort({ _id: -1 }).select('_id').lean() as { _id?: mongoose.Types.ObjectId } | null)?._id
  if (type === 'delete_unused' && total === 0) throw new AppError(409, 'no_unused_media', 'There are no unused images to delete')
  return MediaOptimizationJob.create({ businessId, type, status: 'queued', total, processed: 0, failedCount: 0, createdBy: actorId, targetAssetIds, upperAssetId })
}

export function mediaJobResponse(job: InstanceType<typeof MediaOptimizationJob>) {
  return { id: job.id, type: job.type, status: job.status, total: job.total, processed: job.processed, failedCount: job.failedCount, progress: job.total ? Math.round(job.processed / job.total * 100) : 100, lastError: job.lastError, createdAt: job.createdAt, startedAt: job.startedAt, completedAt: job.completedAt }
}

export function isMediaId(value: string) { return mongoose.isValidObjectId(value) }
