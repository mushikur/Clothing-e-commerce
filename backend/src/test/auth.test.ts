import assert from 'node:assert/strict'
import { test } from 'node:test'
import jwt from 'jsonwebtoken'
import type { Request, Response } from 'express'
process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/fashion-commerce-test'
const { env } = await import('../config/env.js')
const { authenticate } = await import('../middleware/authenticate.js')
const { authorize } = await import('../middleware/authorize.js')
const { AccountToken, Business, RefreshSession, User } = await import('../models/index.js')
const { login, resetPassword, rotateSession } = await import('../modules/auth/auth.service.js')
const { AppError } = await import('../utils/app-error.js')
const { default: bcrypt } = await import('bcryptjs')
const { default: mongoose } = await import('mongoose')

function requestFor(business = new Business({ name: 'Test Store', slug: 'test-store' })): Request {
  return { business, get: () => undefined, ip: '127.0.0.1' } as unknown as Request
}

async function invoke(handler: (request: Request, response: Response, next: (error?: unknown) => void) => void, request: Request): Promise<unknown> {
  return new Promise((resolve) => handler(request, {} as Response, (error) => resolve(error)))
}

test('invalid login credentials return the same generic error for unknown emails', async () => {
  const original = User.findOne
  User.findOne = (() => ({ select: async () => null })) as unknown as typeof User.findOne
  try {
    await assert.rejects(login({ email: 'unknown@example.com', password: 'not-the-password' }, requestFor()), (error: unknown) => error instanceof AppError && error.code === 'invalid_credentials' && error.statusCode === 401)
  } finally { User.findOne = original }
})

test('expired access tokens are rejected before database access', async () => {
  const business = new Business({ name: 'Test Store', slug: 'test-store' })
  const accessToken = jwt.sign({ businessId: business.id, role: 'customer', tokenUse: 'access', exp: Math.floor(Date.now() / 1000) - 10 }, env.ACCESS_TOKEN_SECRET, { subject: '507f1f77bcf86cd799439011', issuer: 'fashion-commerce-api', audience: business.id })
  const request = { ...requestFor(business), get: (name: string) => name.toLowerCase() === 'authorization' ? `Bearer ${accessToken}` : undefined } as unknown as Request
  const error = await invoke(authenticate, request)
  assert.ok(error instanceof AppError)
  assert.equal((error as { code: string }).code, 'invalid_access_token')
})

test('missing or expired refresh sessions cannot renew access', async () => {
  const original = RefreshSession.findOne
  RefreshSession.findOne = (() => ({ select: async () => null })) as unknown as typeof RefreshSession.findOne
  try {
    await assert.rejects(rotateSession('expired-refresh-token', requestFor()), (error: unknown) => error instanceof AppError && error.statusCode === 401 && error.code === 'invalid_refresh_session')
  } finally { RefreshSession.findOne = original }
})

test('authorization blocks customers from staff roles and permits super admins', async () => {
  const roleGuard = authorize('admin', 'manager', 'staff')
  const missingUserError = await invoke(authorize('customer'), {} as Request)
  assert.ok(missingUserError instanceof AppError)
  assert.equal((missingUserError as { statusCode: number }).statusCode, 401)
  const customerRequest = { user: { id: '1', businessId: 'store', role: 'customer' } } as unknown as Request
  const customerError = await invoke(roleGuard, customerRequest)
  assert.ok(customerError instanceof AppError)
  assert.equal((customerError as { code: string }).code, 'permission_denied')
  let passed = false
  roleGuard({ user: { id: '2', businessId: 'store', role: 'super_admin' } } as unknown as Request, {} as Response, (error) => { if (!error) passed = true })
  assert.equal(passed, true)
})

test('unknown, expired, and consumed reset tokens are rejected', async () => {
  const original = AccountToken.findOne
  AccountToken.findOne = (() => ({ select: async () => null })) as unknown as typeof AccountToken.findOne
  try {
    await assert.rejects(resetPassword('expired-or-consumed-reset-token', 'a-strong-password-123', requestFor()), (error: unknown) => error instanceof AppError && error.statusCode === 400 && error.code === 'invalid_reset_token')
  } finally { AccountToken.findOne = original }
})

test('valid password reset stores a fresh hash and revokes existing sessions', async () => {
  const originals = { findToken: AccountToken.findOne, updateToken: AccountToken.updateOne, updateUser: User.updateOne, revokeSessions: RefreshSession.updateMany }
  const userId = new mongoose.Types.ObjectId()
  let savedPasswordHash = ''
  let revokedSessions = false
  AccountToken.findOne = (() => ({ select: async () => ({ _id: new mongoose.Types.ObjectId(), userId }) })) as unknown as typeof AccountToken.findOne
  AccountToken.updateOne = (async () => ({ modifiedCount: 1 })) as unknown as typeof AccountToken.updateOne
  User.updateOne = (async (_filter: unknown, update: { $set: { passwordHash: string } }) => { savedPasswordHash = update.$set.passwordHash; return { matchedCount: 1 } }) as unknown as typeof User.updateOne
  RefreshSession.updateMany = (async () => { revokedSessions = true; return { modifiedCount: 2 } }) as unknown as typeof RefreshSession.updateMany
  try {
    await resetPassword('valid-password-reset-token-value-123456789', 'new-secure-password-456', requestFor())
    assert.equal(await bcrypt.compare('new-secure-password-456', savedPasswordHash), true)
    assert.equal(revokedSessions, true)
  } finally {
    AccountToken.findOne = originals.findToken
    AccountToken.updateOne = originals.updateToken
    User.updateOne = originals.updateUser
    RefreshSession.updateMany = originals.revokeSessions
  }
})
