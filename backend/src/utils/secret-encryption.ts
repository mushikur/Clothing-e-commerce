import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { env } from '../config/env.js'
import { AppError } from './app-error.js'

function key() {
  if (!env.COURIER_CREDENTIALS_ENCRYPTION_KEY) throw new AppError(503, 'courier_encryption_unavailable', 'Set COURIER_CREDENTIALS_ENCRYPTION_KEY before saving courier credentials')
  return Buffer.from(env.COURIER_CREDENTIALS_ENCRYPTION_KEY, 'hex')
}
export function encryptSecret(value: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return `v1.${iv.toString('hex')}.${cipher.getAuthTag().toString('hex')}.${encrypted.toString('hex')}`
}
export function decryptSecret(value: string): string {
  const [version, ivHex, tagHex, dataHex] = value.split('.')
  if (version !== 'v1' || !ivHex || !tagHex || !dataHex) throw new AppError(500, 'courier_credentials_invalid', 'Stored courier credentials could not be read')
  try {
    const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(ivHex, 'hex'))
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
    return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8')
  } catch { throw new AppError(500, 'courier_credentials_invalid', 'Stored courier credentials could not be decrypted; verify the configured encryption key') }
}
