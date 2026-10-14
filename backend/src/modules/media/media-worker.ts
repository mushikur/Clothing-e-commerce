import { randomUUID } from 'node:crypto'
import { MediaAsset } from '../../models/MediaAsset.js'
import { MediaOptimizationJob } from '../../models/MediaOptimizationJob.js'
import { logger } from '../../utils/logger.js'
import { getOptimizationSettings, reoptimizeAsset } from './image-optimization.service.js'
import { deleteMediaAsset, mediaIsUsed } from './media.service.js'

const workerId = randomUUID()
let working = false
let stopped = false
let timer: NodeJS.Timeout | undefined
let activeWork: Promise<void> | undefined

async function processJob(jobId: string) {
  while (!stopped) {
    const job = await MediaOptimizationJob.findOne({ _id: jobId, workerId, status: 'running' })
    if (!job) return
    const idFilter: Record<string, unknown> = {}
    if (job.upperAssetId) idFilter.$lte = job.upperAssetId
    if (job.lastAssetId) idFilter.$gt = job.lastAssetId
    if (job.targetAssetIds?.length) idFilter.$in = job.targetAssetIds
    const query: Record<string, unknown> = { businessId: job.businessId, deletedAt: { $exists: false }, ...(Object.keys(idFilter).length ? { _id: idFilter } : {}) }
    const asset = await MediaAsset.findOne(query).sort({ _id: 1 })
    if (!asset) {
      job.status = 'completed'; job.completedAt = new Date(); job.leaseUntil = undefined
      await job.save()
      return
    }
    try {
      if (job.type === 'optimize') await reoptimizeAsset(asset, await getOptimizationSettings(job.businessId))
      else if (!await mediaIsUsed(asset)) await deleteMediaAsset(asset)
    } catch (error) {
      job.failedCount += 1
      job.lastError = error instanceof Error ? error.message.slice(0, 500) : 'Media operation failed'
      logger.error({ jobId, mediaId: String(asset._id), err: error }, 'Media background operation failed')
    }
    job.processed += 1
    job.lastAssetId = asset._id
    job.leaseUntil = new Date(Date.now() + 5 * 60_000)
    await job.save()
  }
}

async function workOnce() {
  if (working || stopped) return
  working = true
  const run = (async () => { try {
    const now = new Date()
    const job = await MediaOptimizationJob.findOneAndUpdate({ $or: [{ status: 'queued' }, { status: 'running', leaseUntil: { $lt: now } }] }, { $set: { status: 'running', workerId, leaseUntil: new Date(Date.now() + 5 * 60_000), startedAt: now } }, { sort: { createdAt: 1 }, new: true })
    if (job) await processJob(job.id)
  } catch (error) {
    logger.error({ err: error }, 'Media job worker iteration failed')
  } finally { working = false } })()
  activeWork = run
  try { await run } finally { if (activeWork === run) activeWork = undefined }
}

export function startMediaWorker() {
  stopped = false
  void workOnce()
  timer = setInterval(() => { void workOnce() }, 1500)
  timer.unref()
  return async () => { stopped = true; if (timer) clearInterval(timer); await activeWork }
}
