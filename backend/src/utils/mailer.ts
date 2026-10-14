import nodemailer from 'nodemailer'
import { env } from '../config/env.js'
import { AppError } from './app-error.js'

export function assertAccountEmailConfigured(): void {
  if (!env.SMTP_HOST || !env.EMAIL_FROM) throw new AppError(503, 'email_delivery_unavailable', 'Account email delivery is not configured')
}

export async function sendAccountEmail(to: string, subject: string, text: string): Promise<void> {
  assertAccountEmailConfigured()
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    ...(env.SMTP_USER ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD ?? '' } } : {}),
  })
  await transport.sendMail({ from: env.EMAIL_FROM, to, subject, text })
}
