import { Router } from 'express'
import { authenticate } from '../../middleware/authenticate.js'
import { requireBusiness } from '../../middleware/require-business.js'
import { validate } from '../../middleware/validate.js'
import { authRateLimit } from '../../middleware/rate-limits.js'
import { verifyBrowserOrigin } from '../../middleware/verify-browser-origin.js'
import { changePasswordSchema, emailSchema, loginSchema, registerSchema, resetPasswordSchema, tokenSchema } from './auth.validators.js'
import { changePasswordController, forgotPasswordController, loginController, logoutController, meController, refreshController, registerController, resendVerificationController, resetPasswordController, verifyEmailController } from './auth.controller.js'

export const authRoutes = Router()
authRoutes.use(requireBusiness)
authRoutes.use((_request, response, next) => { response.setHeader('Cache-Control', 'no-store'); next() })
authRoutes.post('/register', authRateLimit, validate(registerSchema), registerController)
authRoutes.post('/login', verifyBrowserOrigin, authRateLimit, validate(loginSchema), loginController)
authRoutes.post('/verify-email', authRateLimit, validate(tokenSchema), verifyEmailController)
authRoutes.post('/resend-verification', authRateLimit, validate(emailSchema), resendVerificationController)
authRoutes.post('/forgot-password', authRateLimit, validate(emailSchema), forgotPasswordController)
authRoutes.post('/reset-password', authRateLimit, validate(resetPasswordSchema), resetPasswordController)
authRoutes.post('/refresh', verifyBrowserOrigin, authRateLimit, refreshController)
authRoutes.post('/logout', verifyBrowserOrigin, authRateLimit, logoutController)
authRoutes.get('/me', authenticate, meController)
authRoutes.post('/change-password', verifyBrowserOrigin, authRateLimit, authenticate, validate(changePasswordSchema), changePasswordController)
