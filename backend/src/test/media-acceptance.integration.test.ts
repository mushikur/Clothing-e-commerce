import assert from 'node:assert/strict'
import { test } from 'node:test'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import sharp from 'sharp'

const integrationUri = process.env.MEDIA_INTEGRATION_MONGODB_URI
process.env.MONGODB_URI ||= integrationUri || 'mongodb://127.0.0.1:27017/fashion-commerce-test'
process.env.MEDIA_LOCAL_DIRECTORY ||= './uploads'
const { app } = await import('../app.js')
const { env } = await import('../config/env.js')
const { connectDatabase, disconnectDatabase } = await import('../config/database.js')
const { Business, Category, MediaAsset, User, WebsiteSettings } = await import('../models/index.js')
const { startMediaWorker } = await import('../modules/media/media-worker.js')
const { storageProvider } = await import('../modules/media/storage-provider.js')
const { default: mongoose } = await import('mongoose')

test('media upload, deduplication, re-optimization, references, and unused cleanup work end to end', { skip: !integrationUri }, async () => {
  await connectDatabase()
  let stopWorker: (() => Promise<void>) | undefined
  let businessId = ''
  try {
    const business = await Business.create({ name: 'Media Acceptance Store', slug: `media-acceptance-${Date.now()}` })
    businessId = business.id
    const user = await User.create({ businessId: business._id, name: 'Media Admin', email: `media-${Date.now()}@example.test`, passwordHash: 'x'.repeat(60), role: 'super_admin', status: 'active', emailVerifiedAt: new Date() })
    const token = jwt.sign({ businessId: business.id, role: user.role, tokenUse: 'access' }, env.ACCESS_TOKEN_SECRET, { subject: user.id, issuer: 'fashion-commerce-api', audience: business.id, expiresIn: '5m' })
    const headers = { Authorization: `Bearer ${token}`, 'X-Business-Slug': business.slug }
    const png = await sharp({ create: { width: 1400, height: 900, channels: 4, background: { r: 180, g: 95, b: 70, alpha: 0.5 } } }).png().toBuffer()
    const upload = () => request(app).post('/api/v1/admin/media/upload').set(headers).attach('file', png, { filename: 'lookbook.png', contentType: 'image/png' })
    const first = await upload()
    assert.equal(first.status, 201, JSON.stringify(first.body))
    assert.equal(first.body.data.duplicate, false)
    assert.ok(first.body.data.asset.variants.length > 1)
    assert.ok(first.body.data.asset.srcSet.includes('w'))
    const assetId = first.body.data.asset.id as string
    const stableUrl = first.body.data.asset.url as string
    const duplicate = await upload()
    assert.equal(duplicate.status, 200, JSON.stringify(duplicate.body))
    assert.equal(duplicate.body.data.duplicate, true)
    assert.equal(duplicate.body.data.asset.id, assetId)

    await Category.create({ businessId: business._id, name: 'Lookbook', slug: 'lookbook', imageUrl: stableUrl })
    const disabledCleanup = await request(app).post('/api/v1/admin/media/jobs').set(headers).send({ type: 'delete_unused' })
    assert.equal(disabledCleanup.status, 403)

    await WebsiteSettings.findOneAndUpdate({ businessId: business._id }, { $set: { mediaOptimization: { enabled: true, quality: 90, maxWidth: 2000, maxHeight: 2000, preferredFormat: 'webp', generateThumbnails: true, generateResponsiveSizes: true, keepOriginal: false, deleteUnusedImages: true, lazyLoading: true } }, $setOnInsert: { businessId: business._id, displayName: business.name, currency: 'USD' } }, { upsert: true, new: true, runValidators: true })
    const optimize = await request(app).post('/api/v1/admin/media/jobs').set(headers).send({ type: 'optimize', assetIds: [assetId] })
    assert.equal(optimize.status, 202, JSON.stringify(optimize.body))
    stopWorker = startMediaWorker()
    let job: { status: string } | undefined
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const result = await request(app).get(`/api/v1/admin/media/jobs/${optimize.body.data.id}`).set(headers)
      job = result.body.data
      if (job?.status === 'completed' || job?.status === 'failed') break
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
    assert.equal(job?.status, 'completed')
    const optimized = await request(app).get('/api/v1/admin/media').set(headers)
    assert.equal(optimized.status, 200)
    assert.equal(optimized.body.data.find((item: { id: string }) => item.id === assetId).url, stableUrl)
    const refreshed = await MediaAsset.findById(assetId)
    assert.ok(refreshed)
    assert.equal((refreshed!.variants as Array<{ width: number; url: string }>).find((variant: { width: number; url: string }) => variant.width === refreshed!.width)?.url, stableUrl)
    const storedCategory = await Category.findOne({ businessId: business._id, slug: 'lookbook' })
    assert.equal(storedCategory?.imageUrl, stableUrl)
    const deleteInUse = await request(app).delete(`/api/v1/admin/media/${assetId}`).set(headers)
    assert.equal(deleteInUse.status, 409)

    if (storedCategory) { storedCategory.imageUrl = undefined; await storedCategory.save() }
    const cleanup = await request(app).post('/api/v1/admin/media/jobs').set(headers).send({ type: 'delete_unused' })
    assert.equal(cleanup.status, 202, JSON.stringify(cleanup.body))
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const result = await request(app).get(`/api/v1/admin/media/jobs/${cleanup.body.data.id}`).set(headers)
      job = result.body.data
      if (job?.status === 'completed' || job?.status === 'failed') break
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
    assert.equal(job?.status, 'completed')
    assert.equal(await MediaAsset.exists({ _id: assetId }), null)
  } finally {
    if (stopWorker) await stopWorker()
    const assets = businessId ? await MediaAsset.find({ businessId }) : []
    await Promise.all(assets.flatMap((asset: { variants: Array<{ key: string }>; retiredObjects: Array<{ key: string }>; originalKey?: string }) => [...asset.variants.map((variant: { key: string }) => storageProvider.delete(variant.key)), ...(asset.retiredObjects as Array<{ key: string }>).map((object) => storageProvider.delete(object.key)), ...(asset.originalKey ? [storageProvider.delete(asset.originalKey)] : [])].map((promise) => promise.catch(() => undefined))))
    if (businessId) await mongoose.connection.dropDatabase()
    await disconnectDatabase()
  }
})
