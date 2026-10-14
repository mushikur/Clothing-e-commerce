import 'dotenv/config'
import { randomBytes } from 'node:crypto'
import { z } from 'zod'

const optionalSecret = z.string().optional().transform((value) => value?.trim() || undefined)
const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  HOST: z.string().trim().default('0.0.0.0'),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  API_PREFIX: z.string().default('/api/v1'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  API_PUBLIC_URL: z.string().url().default('http://localhost:4000'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_SECURE: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),
  TRUST_PROXY: z.union([z.enum(['true', 'false']), z.string().regex(/^\d+$/)]).default('0'),
  ACCESS_TOKEN_SECRET: optionalSecret,
  COURIER_CREDENTIALS_ENCRYPTION_KEY: optionalSecret,
  MEDIA_STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),
  MEDIA_LOCAL_DIRECTORY: z.string().trim().min(1).default('./uploads'),
  MEDIA_PUBLIC_BASE_URL: z.string().url().optional(),
  MEDIA_MAX_UPLOAD_BYTES: z.coerce.number().int().min(1_048_576).max(25_000_000).default(12_000_000),
  MEDIA_S3_BUCKET: z.string().trim().optional(),
  MEDIA_S3_REGION: z.string().trim().default('us-east-1'),
  MEDIA_S3_ENDPOINT: z.string().url().optional(),
  MEDIA_S3_ACCESS_KEY_ID: optionalSecret,
  MEDIA_S3_SECRET_ACCESS_KEY: optionalSecret,
  MEDIA_S3_FORCE_PATH_STYLE: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  ACCESS_TOKEN_TTL: z.string().regex(/^\d+(s|m|h|d)$/, 'Use a simple JWT duration such as 15m or 7d').default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  COOKIE_SECURE: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  COOKIE_SAME_SITE: z.enum(['strict', 'lax', 'none']).default('lax'),
  COOKIE_DOMAIN: z.string().optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(12),
  TENANT_HEADER: z.string().default('x-business-slug'),
  BOOTSTRAP_BUSINESS_NAME: z.string().optional(),
  BOOTSTRAP_BUSINESS_SLUG: z.string().optional(),
  BOOTSTRAP_BUSINESS_DOMAIN: z.string().optional(),
  BOOTSTRAP_ADMIN_NAME: z.string().optional(),
  BOOTSTRAP_ADMIN_EMAIL: z.string().optional(),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().optional(),
})

const parsed = environmentSchema.safeParse(process.env)
if (!parsed.success) {
  const summary = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('\n')
  throw new Error(`Invalid environment configuration:\n${summary}`)
}

const values = parsed.data
if (values.NODE_ENV === 'production' && (!values.ACCESS_TOKEN_SECRET || values.ACCESS_TOKEN_SECRET.length < 32)) {
  throw new Error('ACCESS_TOKEN_SECRET must be at least 32 characters in production')
}
if (values.NODE_ENV === 'production' && !values.COOKIE_SECURE) {
  throw new Error('COOKIE_SECURE=true is required in production for refresh-session cookies')
}
if (values.NODE_ENV === 'production') {
  const publicUrls = [values.FRONTEND_URL, values.API_PUBLIC_URL, ...values.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean)]
  if (publicUrls.some((value) => { try { const url = new URL(value); return url.protocol !== 'https:' || ['localhost', '127.0.0.1'].includes(url.hostname) } catch { return true } })) {
    throw new Error('FRONTEND_URL, API_PUBLIC_URL, and CORS_ORIGINS must use public HTTPS origins in production')
  }
}
if (values.COURIER_CREDENTIALS_ENCRYPTION_KEY && !/^[a-f\d]{64}$/i.test(values.COURIER_CREDENTIALS_ENCRYPTION_KEY)) throw new Error('COURIER_CREDENTIALS_ENCRYPTION_KEY must be 64 hexadecimal characters (32 bytes)')
if (values.MEDIA_STORAGE_PROVIDER === 's3' && !values.MEDIA_S3_BUCKET) throw new Error('MEDIA_S3_BUCKET is required when MEDIA_STORAGE_PROVIDER=s3')
if (Boolean(values.MEDIA_S3_ACCESS_KEY_ID) !== Boolean(values.MEDIA_S3_SECRET_ACCESS_KEY)) throw new Error('MEDIA_S3_ACCESS_KEY_ID and MEDIA_S3_SECRET_ACCESS_KEY must be configured together')
if (values.MEDIA_PUBLIC_BASE_URL && !['http:', 'https:'].includes(new URL(values.MEDIA_PUBLIC_BASE_URL).protocol)) throw new Error('MEDIA_PUBLIC_BASE_URL must use HTTP or HTTPS')
if (values.NODE_ENV === 'production' && values.MEDIA_PUBLIC_BASE_URL && new URL(values.MEDIA_PUBLIC_BASE_URL).protocol !== 'https:') throw new Error('MEDIA_PUBLIC_BASE_URL must use HTTPS in production')
if (values.COOKIE_SAME_SITE === 'none' && !values.COOKIE_SECURE) {
  throw new Error('COOKIE_SECURE=true is required when COOKIE_SAME_SITE=none')
}
const hasMailSettings = Boolean(values.SMTP_HOST || values.SMTP_USER || values.SMTP_PASSWORD || values.EMAIL_FROM)
if (hasMailSettings && (!values.SMTP_HOST || !values.EMAIL_FROM)) throw new Error('SMTP_HOST and EMAIL_FROM are required when configuring account email delivery')
if (Boolean(values.SMTP_USER) !== Boolean(values.SMTP_PASSWORD)) throw new Error('SMTP_USER and SMTP_PASSWORD must be configured together')

export const env = {
  ...values,
  API_PREFIX: values.API_PREFIX.startsWith('/') ? values.API_PREFIX : `/${values.API_PREFIX}`,
  CORS_ORIGINS: values.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean),
  FRONTEND_URL: values.FRONTEND_URL.replace(/\/$/, ''),
  API_PUBLIC_URL: values.API_PUBLIC_URL.replace(/\/$/, ''),
  ACCESS_TOKEN_SECRET: values.ACCESS_TOKEN_SECRET ?? randomBytes(32).toString('hex'),
  COOKIE_DOMAIN: values.COOKIE_DOMAIN || undefined,
  MEDIA_LOCAL_DIRECTORY: values.MEDIA_LOCAL_DIRECTORY,
}
