import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { S3Client, DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { env } from '../../config/env.js'

export type StoredObject = { key: string; body: Buffer; contentType: string; cacheControl?: string }
export interface StorageProvider {
  readonly name: 'local' | 's3'
  put(object: StoredObject): Promise<void>
  read(key: string): Promise<Buffer>
  delete(key: string): Promise<void>
  url(key: string): string
}

function assertSafeKey(key: string) {
  const parts = key.replace(/\\/g, '/').split('/')
  if (!key || key.startsWith('/') || parts.some((part) => !part || part === '.' || part === '..')) throw new Error('Invalid internal media storage key')
}
function encodedPath(key: string) { return key.split('/').map(encodeURIComponent).join('/') }

class LocalStorageProvider implements StorageProvider {
  readonly name = 'local' as const
  readonly root = path.resolve(env.MEDIA_LOCAL_DIRECTORY)
  private resolveKey(key: string) {
    assertSafeKey(key)
    const destination = path.resolve(this.root, ...key.replace(/\\/g, '/').split('/'))
    if (!destination.startsWith(`${this.root}${path.sep}`)) throw new Error('Invalid media storage path')
    return destination
  }
  async put(object: StoredObject) {
    const destination = this.resolveKey(object.key)
    await mkdir(path.dirname(destination), { recursive: true })
    const temporary = `${destination}.${randomUUID()}.tmp`
    try { await writeFile(temporary, object.body, { flag: 'wx' }); await rename(temporary, destination) }
    catch (error) { await rm(temporary, { force: true }).catch(() => undefined); throw error }
  }
  async read(key: string) {
    return readFile(this.resolveKey(key))
  }
  async delete(key: string) {
    await rm(this.resolveKey(key), { force: true })
  }
  url(key: string) {
    return `${(env.MEDIA_PUBLIC_BASE_URL || `${env.API_PUBLIC_URL}/media`).replace(/\/$/, '')}/${encodedPath(key)}`
  }
}

class S3StorageProvider implements StorageProvider {
  readonly name = 's3' as const
  private readonly bucket = env.MEDIA_S3_BUCKET!
  private readonly client = new S3Client({
    region: env.MEDIA_S3_REGION,
    ...(env.MEDIA_S3_ENDPOINT ? { endpoint: env.MEDIA_S3_ENDPOINT, forcePathStyle: env.MEDIA_S3_FORCE_PATH_STYLE } : {}),
    ...(env.MEDIA_S3_ACCESS_KEY_ID && env.MEDIA_S3_SECRET_ACCESS_KEY ? { credentials: { accessKeyId: env.MEDIA_S3_ACCESS_KEY_ID, secretAccessKey: env.MEDIA_S3_SECRET_ACCESS_KEY } } : {}),
  })
  async put(object: StoredObject) {
    assertSafeKey(object.key)
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: object.key, Body: object.body, ContentType: object.contentType, CacheControl: object.cacheControl || 'public, max-age=3600, stale-while-revalidate=86400' }))
  }
  async read(key: string) {
    assertSafeKey(key)
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }))
    if (!result.Body) throw new Error('Media object has no body')
    return Buffer.from(await result.Body.transformToByteArray())
  }
  async delete(key: string) {
    assertSafeKey(key)
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
  }
  url(key: string) {
    const base = env.MEDIA_PUBLIC_BASE_URL
    if (base) return `${base.replace(/\/$/, '')}/${encodedPath(key)}`
    if (env.MEDIA_S3_ENDPOINT && env.MEDIA_S3_FORCE_PATH_STYLE) return `${env.MEDIA_S3_ENDPOINT.replace(/\/$/, '')}/${encodeURIComponent(this.bucket)}/${encodedPath(key)}`
    if (env.MEDIA_S3_ENDPOINT) {
      const endpoint = new URL(env.MEDIA_S3_ENDPOINT)
      return `${endpoint.protocol}//${this.bucket}.${endpoint.host}/${encodedPath(key)}`
    }
    return `https://${this.bucket}.s3.${env.MEDIA_S3_REGION}.amazonaws.com/${encodedPath(key)}`
  }
}

export const storageProvider: StorageProvider = env.MEDIA_STORAGE_PROVIDER === 's3' ? new S3StorageProvider() : new LocalStorageProvider()
export const localMediaDirectory = storageProvider.name === 'local' ? (storageProvider as LocalStorageProvider).root : undefined
