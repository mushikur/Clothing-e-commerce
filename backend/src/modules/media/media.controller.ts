import type { Request } from 'express'
import mongoose from 'mongoose'
import { MediaAsset } from '../../models/MediaAsset.js'
import { MediaOptimizationJob } from '../../models/MediaOptimizationJob.js'
import { WebsiteSettings } from '../../models/WebsiteSettings.js'
import { AppError } from '../../utils/app-error.js'
import { asyncHandler } from '../../utils/async-handler.js'
import { success } from '../../utils/api-response.js'
import { defaultOptimizationSettings, getOptimizationSettings, mediaResponse, uploadOptimizedImage } from './image-optimization.service.js'
import { createMediaJob, deleteMediaAsset, mediaJobResponse, referencedMediaUrls, unusedMediaAssets } from './media.service.js'

function input<T>(request: Request): T { return request.validated as T }
function actor(request: Request) { if (!request.user) throw new AppError(401, 'authentication_required', 'Sign in is required'); return request.user.id }
function tenant(request: Request) { if (!request.business) throw new AppError(404, 'business_not_found', 'Storefront was not found'); return request.business }

export const mediaSettingsGetController = asyncHandler(async (request, response) => {
  success(response, { settings: await getOptimizationSettings(tenant(request)._id), storageProvider: process.env.MEDIA_STORAGE_PROVIDER || 'local' })
})

export const mediaSettingsUpdateController = asyncHandler(async (request, response) => {
  const business = tenant(request)
  const { body } = input<{ body: typeof defaultOptimizationSettings }>(request)
  await WebsiteSettings.findOneAndUpdate({ businessId: business._id }, {
    $set: { mediaOptimization: body },
    $setOnInsert: { businessId: business._id, displayName: business.name, currency: business.defaultCurrency },
  }, { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true })
  success(response, { settings: body })
})

export const mediaUploadController = asyncHandler(async (request, response) => {
  if (!request.file) throw new AppError(422, 'image_required', 'Choose an image to upload')
  const result = await uploadOptimizedImage({ businessId: tenant(request)._id, file: request.file, altText: request.body?.altText })
  success(response, { asset: mediaResponse(result.asset), duplicate: result.duplicate }, result.duplicate ? 200 : 201)
})

export const mediaListController = asyncHandler(async (request, response) => {
  const businessId = tenant(request)._id
  const { query } = input<{ query: { page: number; limit: number; q?: string; sort: 'newest' | 'largest'; filter: 'all' | 'unused' } }>(request)
  const filter: Record<string, unknown> = { businessId, deletedAt: { $exists: false } }
  if (query.q) filter.originalName = { $regex: query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' }
  const sort: Record<string, 1 | -1> = query.sort === 'largest' ? { optimizedSize: -1, _id: -1 } : { createdAt: -1, _id: -1 }
  if (query.filter === 'unused') {
    const unused = await unusedMediaAssets(businessId)
    const ids = unused.map((asset) => asset._id)
    filter._id = { $in: ids }
  }
  const [assets, total] = await Promise.all([
    MediaAsset.find(filter).sort(sort).skip((query.page - 1) * query.limit).limit(query.limit),
    MediaAsset.countDocuments(filter),
  ])
  const references = await referencedMediaUrls(businessId)
  const result = assets.map((asset) => ({ ...mediaResponse(asset), isUsed: [...(asset.variants as Array<{ url: string }>), ...(asset.retiredObjects as Array<{ url: string }> || [])].some((variant) => references.has(variant.url)) }))
  success(response, result, 200, { page: query.page, limit: query.limit, total, pages: Math.ceil(total / query.limit) })
})

export const mediaStatsController = asyncHandler(async (request, response) => {
  const businessId = tenant(request)._id
  const [rows, totalImages, unused] = await Promise.all([
    MediaAsset.aggregate([{ $match: { businessId, deletedAt: { $exists: false } } }, { $group: { _id: null, totalImages: { $sum: 1 }, originalStorage: { $sum: '$originalSize' }, optimizedStorage: { $sum: { $add: ['$optimizedSize', { $cond: [{ $ifNull: ['$originalKey', false] }, '$originalSize', 0] }, { $reduce: { input: { $ifNull: ['$retiredObjects', []] }, initialValue: 0, in: { $add: ['$$value', '$$this.size'] } } }] } }, largest: { $max: '$originalSize' } } }]),
    MediaAsset.countDocuments({ businessId, deletedAt: { $exists: false } }), unusedMediaAssets(businessId),
  ])
  const row = rows[0] || { totalImages: 0, originalStorage: 0, optimizedStorage: 0, largest: 0 }
  const saved = Math.max(0, row.originalStorage - row.optimizedStorage)
  const largest = await MediaAsset.find({ businessId, deletedAt: { $exists: false } }).sort({ originalSize: -1 }).limit(5)
  success(response, { totalImages, originalStorage: row.originalStorage, optimizedStorage: row.optimizedStorage, storageSaved: saved, storageSavedPercentage: row.originalStorage ? Math.round(saved / row.originalStorage * 1000) / 10 : 0, unusedImages: unused.length, largestImages: largest.map(mediaResponse) })
})

export const mediaAltUpdateController = asyncHandler(async (request, response) => {
  const { params, body } = input<{ params: { mediaId: string }; body: { altText: string } }>(request)
  const asset = await MediaAsset.findOneAndUpdate({ _id: params.mediaId, businessId: tenant(request)._id, deletedAt: { $exists: false } }, { $set: { altText: body.altText } }, { new: true, runValidators: true })
  if (!asset) throw new AppError(404, 'media_not_found', 'Image was not found')
  success(response, { asset: mediaResponse(asset) })
})

export const mediaDeleteController = asyncHandler(async (request, response) => {
  const { mediaId } = input<{ params: { mediaId: string } }>(request).params
  if (!(await getOptimizationSettings(tenant(request)._id)).deleteUnusedImages) throw new AppError(403, 'cleanup_disabled', 'Enable unused image cleanup in media settings first')
  const asset = await MediaAsset.findOne({ _id: mediaId, businessId: tenant(request)._id, deletedAt: { $exists: false } })
  if (!asset) throw new AppError(404, 'media_not_found', 'Image was not found')
  await deleteMediaAsset(asset)
  success(response, { deleted: true, id: mediaId })
})

export const mediaJobCreateController = asyncHandler(async (request, response) => {
  const { body } = input<{ body: { type: 'optimize' | 'delete_unused'; assetIds?: string[] } }>(request)
  if (body.type === 'delete_unused' && !(await getOptimizationSettings(tenant(request)._id)).deleteUnusedImages) throw new AppError(403, 'cleanup_disabled', 'Enable unused image cleanup in media settings first')
  const job = body.type === 'delete_unused'
    ? await (async () => {
      const unusedAssets = await unusedMediaAssets(tenant(request)._id)
      if (!unusedAssets.length) throw new AppError(409, 'no_unused_media', 'There are no unused images to delete')
      const targetAssetIds = unusedAssets.map((asset) => new mongoose.Types.ObjectId(String(asset._id)))
      const upperAssetId = targetAssetIds.reduce((largest, id) => id.toString() > largest.toString() ? id : largest)
      return MediaOptimizationJob.create({ businessId: tenant(request)._id, type: 'delete_unused', status: 'queued', total: unusedAssets.length, createdBy: actor(request), upperAssetId, targetAssetIds })
    })()
    : await createMediaJob(tenant(request)._id, actor(request), body.type, body.assetIds)
  success(response, mediaJobResponse(job), 202)
})

export const mediaJobGetController = asyncHandler(async (request, response) => {
  const { jobId } = input<{ params: { jobId: string } }>(request).params
  if (!mongoose.isValidObjectId(jobId)) throw new AppError(404, 'media_job_not_found', 'Optimization job was not found')
  const job = await MediaOptimizationJob.findOne({ _id: jobId, businessId: tenant(request)._id })
  if (!job) throw new AppError(404, 'media_job_not_found', 'Optimization job was not found')
  success(response, mediaJobResponse(job))
})
