import { createHash } from 'node:crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import type { Request } from 'express'
import { env } from '../../config/env.js'
import { AccountToken } from '../../models/AccountToken.js'
import { RefreshSession } from '../../models/RefreshSession.js'
import { User } from '../../models/User.js'
import { AppError } from '../../utils/app-error.js'
import { createOpaqueToken, hashToken } from '../../utils/security.js'
import { assertAccountEmailConfigured, sendAccountEmail } from '../../utils/mailer.js'
import { logger } from '../../utils/logger.js'

type Role = 'customer' | 'staff' | 'manager' | 'admin' | 'super_admin'
type AuthUser = { id: string; name: string; email: string; role: Role }
type AuthResult = { user: AuthUser; accessToken: string; refreshToken: string }
let dummyPasswordHash: Promise<string> | undefined
const tokenLifetimeMs = 60 * 60 * 1000

function publicUser(user: InstanceType<typeof User>): AuthUser {
  return { id: user.id, name: user.name, email: user.email, role: user.role as Role }
}

function accessToken(user: InstanceType<typeof User>, businessId: string): string {
  return jwt.sign({ businessId, role: user.role, tokenUse: 'access' }, env.ACCESS_TOKEN_SECRET, {
    subject: user.id,
    expiresIn: env.ACCESS_TOKEN_TTL as jwt.SignOptions['expiresIn'],
    issuer: 'fashion-commerce-api', audience: businessId,
  })
}

async function createSession(user: InstanceType<typeof User>, businessId: string, request: Request): Promise<AuthResult> {
  const refreshToken = createOpaqueToken()
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000)
  await RefreshSession.create({ businessId, userId: user._id, tokenHash: hashToken(refreshToken), expiresAt,
    userAgent: request.get('user-agent')?.slice(0, 512),
    ipHash: request.ip ? createHash('sha256').update(request.ip).digest('hex') : undefined })
  return { user: publicUser(user), accessToken: accessToken(user, businessId), refreshToken }
}

async function issueAccountToken(user: InstanceType<typeof User>, purpose: 'verify_email' | 'password_reset'): Promise<string> {
  const token = createOpaqueToken()
  await AccountToken.updateMany({ businessId: user.businessId, userId: user._id, purpose, usedAt: { $exists: false } }, { $set: { usedAt: new Date() } })
  await AccountToken.create({ businessId: user.businessId, userId: user._id, purpose, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + tokenLifetimeMs) })
  return token
}

function accountLink(path: string, token: string): string {
  return `${env.FRONTEND_URL}${path}?token=${encodeURIComponent(token)}`
}

export async function register(input: { name: string; email: string; password: string }, request: Request): Promise<{ user: AuthUser; verificationRequired: true }> {
  assertAccountEmailConfigured()
  const businessId = request.business!._id
  const email = input.email.trim().toLowerCase()
  if (await User.exists({ businessId, email })) throw new AppError(409, 'account_exists', 'An account with this email already exists')
  const passwordHash = await bcrypt.hash(input.password, 12)
  const user = await User.create({ businessId, name: input.name, email, passwordHash, role: 'customer', status: 'pending' })
  const token = await issueAccountToken(user, 'verify_email')
  await sendAccountEmail(email, 'Verify your email address', `Complete your account setup: ${accountLink('/account/verify-email', token)}\n\nThis link expires in one hour.`)
  return { user: publicUser(user), verificationRequired: true }
}

export async function login(input: { email: string; password: string }, request: Request): Promise<AuthResult> {
  const businessId = request.business!._id
  const user = await User.findOne({ businessId, email: input.email.trim().toLowerCase() }).select('+passwordHash +failedLoginCount +lockedUntil')
  const now = new Date()
  if (!user) dummyPasswordHash ??= bcrypt.hash(createOpaqueToken(), 12)
  const passwordHash = user?.passwordHash ?? await dummyPasswordHash!
  const valid = await bcrypt.compare(input.password, passwordHash)
  const locked = Boolean(user?.lockedUntil && user.lockedUntil > now)
  if (!user || user.status !== 'active' || locked || !valid) {
    if (user && user.status === 'active' && !locked && !valid) {
      user.failedLoginCount = (user.failedLoginCount ?? 0) + 1
      if (user.failedLoginCount >= 10) user.lockedUntil = new Date(now.getTime() + 15 * 60 * 1000)
      await user.save()
    }
    if (user?.status === 'pending') throw new AppError(403, 'email_verification_required', 'Verify your email before signing in')
    throw new AppError(401, 'invalid_credentials', 'Email or password is incorrect')
  }
  user.failedLoginCount = 0
  user.lockedUntil = undefined
  user.lastLoginAt = now
  await user.save()
  return createSession(user, request.business!.id, request)
}

export async function verifyEmail(token: string, request: Request): Promise<void> {
  const businessId = request.business!._id
  const record = await AccountToken.findOne({ businessId, purpose: 'verify_email', tokenHash: hashToken(token), expiresAt: { $gt: new Date() }, usedAt: { $exists: false } }).select('+tokenHash')
  if (!record) throw new AppError(400, 'invalid_verification_token', 'Verification link is invalid or expired')
  const updated = await AccountToken.updateOne({ _id: record._id, usedAt: { $exists: false } }, { $set: { usedAt: new Date() } })
  if (updated.modifiedCount !== 1) throw new AppError(400, 'invalid_verification_token', 'Verification link is invalid or expired')
  await User.updateOne({ _id: record.userId, businessId, status: 'pending' }, { $set: { status: 'active', emailVerifiedAt: new Date() } })
}

export async function resendVerification(email: string, request: Request): Promise<void> {
  assertAccountEmailConfigured()
  const user = await User.findOne({ businessId: request.business!._id, email: email.trim().toLowerCase(), status: 'pending' })
  if (!user) return
  const token = await issueAccountToken(user, 'verify_email')
  try { await sendAccountEmail(user.email, 'Verify your email address', `Complete your account setup: ${accountLink('/account/verify-email', token)}\n\nThis link expires in one hour.`) }
  catch (error) { logger.error({ err: error, businessId: request.business!.id }, 'Verification email delivery failed') }
}

export async function requestPasswordReset(email: string, request: Request): Promise<void> {
  assertAccountEmailConfigured()
  const user = await User.findOne({ businessId: request.business!._id, email: email.trim().toLowerCase(), status: 'active' })
  if (!user) return
  const token = await issueAccountToken(user, 'password_reset')
  try { await sendAccountEmail(user.email, 'Reset your password', `Choose a new password: ${accountLink('/account/reset-password', token)}\n\nThis link expires in one hour.`) }
  catch (error) { logger.error({ err: error, businessId: request.business!.id }, 'Password reset email delivery failed') }
}

export async function resetPassword(token: string, password: string, request: Request): Promise<void> {
  const businessId = request.business!._id
  const record = await AccountToken.findOne({ businessId, purpose: 'password_reset', tokenHash: hashToken(token), expiresAt: { $gt: new Date() }, usedAt: { $exists: false } }).select('+tokenHash')
  if (!record) throw new AppError(400, 'invalid_reset_token', 'Password reset link is invalid or expired')
  const consumed = await AccountToken.updateOne({ _id: record._id, usedAt: { $exists: false }, expiresAt: { $gt: new Date() } }, { $set: { usedAt: new Date() } })
  if (consumed.modifiedCount !== 1) throw new AppError(400, 'invalid_reset_token', 'Password reset link is invalid or expired')
  const passwordHash = await bcrypt.hash(password, 12)
  await User.updateOne({ _id: record.userId, businessId, status: 'active' }, { $set: { passwordHash } })
  await RefreshSession.updateMany({ businessId, userId: record.userId, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } })
}

export async function changePassword(currentPassword: string, newPassword: string, userId: string, request: Request): Promise<AuthResult> {
  const user = await User.findOne({ _id: userId, businessId: request.business!._id, status: 'active' }).select('+passwordHash')
  if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) throw new AppError(400, 'current_password_incorrect', 'Current password is incorrect')
  user.passwordHash = await bcrypt.hash(newPassword, 12)
  await user.save()
  await RefreshSession.updateMany({ businessId: request.business!._id, userId: user._id, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } })
  return createSession(user, request.business!.id, request)
}

export async function rotateSession(token: string | undefined, request: Request): Promise<AuthResult> {
  if (!token) throw new AppError(401, 'refresh_required', 'A refresh session is required')
  const businessId = request.business!._id
  const session = await RefreshSession.findOne({ businessId, tokenHash: hashToken(token), expiresAt: { $gt: new Date() }, revokedAt: { $exists: false } }).select('+tokenHash')
  if (!session) throw new AppError(401, 'invalid_refresh_session', 'Refresh session is invalid or expired')
  const user = await User.findOne({ _id: session.userId, businessId, status: 'active' })
  if (!user) throw new AppError(401, 'invalid_refresh_session', 'Refresh session is invalid or expired')
  const replacement = createOpaqueToken()
  const replacementId = (await RefreshSession.create({ businessId, userId: user._id, tokenHash: hashToken(replacement), expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000), userAgent: request.get('user-agent')?.slice(0, 512), ipHash: request.ip ? createHash('sha256').update(request.ip).digest('hex') : undefined }))._id
  const revoked = await RefreshSession.updateOne({ _id: session._id, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date(), replacedBySessionId: replacementId } })
  if (revoked.modifiedCount !== 1) {
    await RefreshSession.updateOne({ _id: replacementId }, { $set: { revokedAt: new Date() } })
    throw new AppError(401, 'invalid_refresh_session', 'Refresh session has already been rotated')
  }
  return { user: publicUser(user), accessToken: accessToken(user, request.business!.id), refreshToken: replacement }
}

export async function revokeSession(token: string | undefined, businessId: string): Promise<void> {
  if (token) await RefreshSession.updateOne({ businessId, tokenHash: hashToken(token), revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } })
}
