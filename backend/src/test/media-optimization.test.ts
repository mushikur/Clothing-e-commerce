import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import sharp from 'sharp'
import { defaultOptimizationSettings, inspectImageInput, renderVariants } from '../modules/media/image-optimization.service.js'
import { storageProvider } from '../modules/media/storage-provider.js'

const settings = { ...defaultOptimizationSettings, maxWidth: 1200, maxHeight: 1200 }

test('JPEG processing creates bounded responsive WebP variants with real metadata', async () => {
  const input = await sharp({ create: { width: 2400, height: 1200, channels: 3, background: '#c7433d' } }).jpeg({ quality: 96 }).toBuffer()
  const prefix = `test/${randomUUID()}`
  const result = await renderVariants(input, settings, prefix)
  try {
    assert.equal(result.format, 'webp')
    assert.equal(result.width, 1200)
    assert.equal(result.height, 600)
    assert.deepEqual(result.variants.map((variant) => variant.width), [300, 600, 1000, 1200])
    assert.ok(result.variants.every((variant) => variant.format === 'webp' && variant.size > 0))
    const largest = await storageProvider.read(result.variants.at(-1)!.key)
    assert.equal((await sharp(largest).metadata()).format, 'webp')
    assert.ok(result.optimizedSize > 0)
  } finally {
    await Promise.all(result.variants.map((variant) => storageProvider.delete(variant.key)))
  }
})

test('transparent PNG processing preserves alpha in WebP output', async () => {
  const input = await sharp({ create: { width: 24, height: 18, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer()
  const prefix = `test/${randomUUID()}`
  const result = await renderVariants(input, { ...settings, generateResponsiveSizes: false, generateThumbnails: false }, prefix)
  try {
    assert.equal(result.variants.length, 1)
    const metadata = await sharp(await storageProvider.read(result.variants[0]!.key)).metadata()
    assert.equal(metadata.format, 'webp')
    assert.equal(metadata.hasAlpha, true)
    assert.deepEqual([metadata.width, metadata.height], [24, 18])
  } finally { await Promise.all(result.variants.map((variant) => storageProvider.delete(variant.key))) }
})

test('WebP input is accepted and small images are never enlarged', async () => {
  const input = await sharp({ create: { width: 100, height: 80, channels: 3, background: '#263c64' } }).webp().toBuffer()
  const result = await renderVariants(input, settings, `test/${randomUUID()}`)
  try {
    assert.deepEqual(result.variants.map((variant) => [variant.width, variant.height]), [[100, 80]])
  } finally { await Promise.all(result.variants.map((variant) => storageProvider.delete(variant.key))) }
})

test('AVIF output is generated when the configured format is AVIF', async () => {
  const input = await sharp({ create: { width: 64, height: 48, channels: 3, background: '#6a6940' } }).jpeg().toBuffer()
  const result = await renderVariants(input, { ...settings, preferredFormat: 'avif', generateResponsiveSizes: false, generateThumbnails: false }, `test/${randomUUID()}`)
  try {
    assert.equal(result.format, 'avif')
    assert.equal((await sharp(await storageProvider.read(result.variants[0]!.key)).metadata()).format, 'heif')
  } finally { await Promise.all(result.variants.map((variant) => storageProvider.delete(variant.key))) }
})

test('AVIF uploads are recognized by AV1 signature and mismatched MIME declarations fail', async () => {
  const avif = await sharp({ create: { width: 40, height: 32, channels: 3, background: '#385a6e' } }).avif().toBuffer()
  assert.equal((await inspectImageInput(avif, 'image/avif')).format, 'avif')
  await assert.rejects(() => inspectImageInput(avif, 'image/jpeg'), /does not match/)
})

test('malformed or unsupported file data is rejected', async () => {
  await assert.rejects(() => renderVariants(Buffer.from('not an image'), settings, `test/${randomUUID()}`))
})

test('local storage safely writes, reads, and deletes objects', async () => {
  const key = `test/${randomUUID()}/fixture.txt`
  const body = Buffer.from('media storage fixture')
  await storageProvider.put({ key, body, contentType: 'text/plain' })
  const updatedBody = Buffer.from('updated media storage fixture')
  await storageProvider.put({ key, body: updatedBody, contentType: 'text/plain' })
  assert.deepEqual(await storageProvider.read(key), updatedBody)
  assert.match(storageProvider.url(key), /\/media\/test\//)
  await storageProvider.delete(key)
  await assert.rejects(() => storageProvider.read(key))
  await assert.rejects(() => storageProvider.put({ key: '../escape', body, contentType: 'text/plain' }), /Invalid internal media storage key/)
})
