import type { Request, Response } from 'express'
import { env } from '../../config/env.js'
import { User } from '../../models/User.js'
import { AppError } from '../../utils/app-error.js'
import { success } from '../../utils/api-response.js'
import { asyncHandler } from '../../utils/async-handler.js'
import { changePassword, login, register, requestPasswordReset, resendVerification, resetPassword, revokeSession, rotateSession, verifyEmail } from './auth.service.js'

const refreshCookie = 'refresh_token'
function cookieOptions() {
  return { httpOnly: true, secure: env.COOKIE_SECURE, sameSite: env.COOKIE_SAME_SITE, domain: env.COOKIE_DOMAIN, path: `${env.API_PREFIX}/auth`, maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000 } as const
}
function validated<T>(request: Request): T { return request.validated as T }
function setRefreshCookie(response: Response, token: string): void { response.cookie(refreshCookie, token, cookieOptions()) }
function clearRefreshCookie(response: Response): void {
  const options = cookieOptions()
  response.clearCookie(refreshCookie, { httpOnly: options.httpOnly, secure: options.secure, sameSite: options.sameSite, domain: options.domain, path: options.path })
}

export const registerController = asyncHandler(async (request, response) => {
  const result = await register(validated<{ body: { name: string; email: string; password: string } }>(request).body, request)
  success(response, result, 201)
})

export const loginController = asyncHandler(async (request, response) => {
  const result = await login(validated<{ body: { email: string; password: string } }>(request).body, request)
  setRefreshCookie(response, result.refreshToken)
  success(response, { user: result.user, accessToken: result.accessToken })
})

export const refreshController = asyncHandler(async (request, response) => {
  const result = await rotateSession(request.cookies?.[refreshCookie], request)
  setRefreshCookie(response, result.refreshToken)
  success(response, { user: result.user, accessToken: result.accessToken })
})

export const logoutController = asyncHandler(async (request, response) => {
  await revokeSession(request.cookies?.[refreshCookie], request.business!.id)
  clearRefreshCookie(response)
  success(response, { loggedOut: true })
})

export const meController = asyncHandler(async (request, response) => {
  if (!request.user) throw new AppError(401, 'authentication_required', 'Sign in is required')
  const user = await User.findOne({ _id: request.user.id, businessId: request.business!._id, status: 'active' }).select('name email phone role emailVerifiedAt createdAt')
  if (!user) throw new AppError(404, 'user_not_found', 'Account was not found')
  success(response, { user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role, emailVerifiedAt: user.emailVerifiedAt, createdAt: user.createdAt } })
})

export const verifyEmailController = asyncHandler(async (request, response) => {
  await verifyEmail(validated<{ body: { token: string } }>(request).body.token, request)
  success(response, { verified: true })
})
export const resendVerificationController = asyncHandler(async (request, response) => {
  await resendVerification(validated<{ body: { email: string } }>(request).body.email, request)
  success(response, { accepted: true })
})
export const forgotPasswordController = asyncHandler(async (request, response) => {
  await requestPasswordReset(validated<{ body: { email: string } }>(request).body.email, request)
  success(response, { accepted: true, message: 'If an account matches that address, reset instructions will be sent.' }, 202)
})
export const resetPasswordController = asyncHandler(async (request, response) => {
  const body = validated<{ body: { token: string; password: string } }>(request).body
  await resetPassword(body.token, body.password, request)
  success(response, { passwordReset: true })
})
export const changePasswordController = asyncHandler(async (request, response) => {
  if (!request.user) throw new AppError(401, 'authentication_required', 'Sign in is required')
  const body = validated<{ body: { currentPassword: string; newPassword: string } }>(request).body
  const result = await changePassword(body.currentPassword, body.newPassword, request.user.id, request)
  setRefreshCookie(response, result.refreshToken)
  success(response, { user: result.user, accessToken: result.accessToken })
})
