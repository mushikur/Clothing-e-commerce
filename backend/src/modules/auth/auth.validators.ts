import { z } from 'zod'

const passwordSchema = z.string().min(12).max(72).refine((password) => Buffer.byteLength(password, 'utf8') <= 72, 'Password must be no more than 72 bytes')

export const registerSchema = z.object({
  body: z.object({ name: z.string().trim().min(1).max(100), email: z.string().trim().email().max(254), password: passwordSchema }).strict(),
  params: z.object({}), query: z.object({}),
})

export const loginSchema = z.object({
  body: z.object({ email: z.string().trim().email().max(254), password: z.string().min(1).max(72) }).strict(),
  params: z.object({}), query: z.object({}),
})

const envelope = (body: z.ZodTypeAny) => z.object({ body, params: z.object({}), query: z.object({}) })
export const emailSchema = envelope(z.object({ email: z.string().trim().email().max(254) }).strict())
export const tokenSchema = envelope(z.object({ token: z.string().min(32).max(256) }).strict())
export const resetPasswordSchema = envelope(z.object({ token: z.string().min(32).max(256), password: passwordSchema }).strict())
export const changePasswordSchema = envelope(z.object({ currentPassword: z.string().min(1).max(72), newPassword: passwordSchema }).strict())
