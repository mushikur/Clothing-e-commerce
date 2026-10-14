import 'dotenv/config'
import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { Business } from '../models/Business.js'
import { User } from '../models/User.js'
import { logger } from '../utils/logger.js'

async function seed(): Promise<void> {
  const uri = process.env.MONGODB_URI
  const name = process.env.BOOTSTRAP_BUSINESS_NAME?.trim()
  const slug = process.env.BOOTSTRAP_BUSINESS_SLUG?.trim().toLowerCase()
  const domain = process.env.BOOTSTRAP_BUSINESS_DOMAIN?.trim().toLowerCase()
  const adminName = process.env.BOOTSTRAP_ADMIN_NAME?.trim()
  const adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase()
  const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD
  if (!uri || !name || !slug) throw new Error('MONGODB_URI, BOOTSTRAP_BUSINESS_NAME, and BOOTSTRAP_BUSINESS_SLUG are required')
  const adminValues = [adminName, adminEmail, adminPassword]
  if (adminValues.some(Boolean) && !adminValues.every(Boolean)) throw new Error('Set all BOOTSTRAP_ADMIN_* values together or leave all of them empty')
  if (adminPassword && Buffer.byteLength(adminPassword, 'utf8') > 72) throw new Error('BOOTSTRAP_ADMIN_PASSWORD must be no more than 72 bytes')

  await mongoose.connect(uri)
  let business = await Business.findOne({ slug })
  if (!business) business = await Business.create({ name, slug, domains: domain ? [domain] : [] })
  logger.info({ businessId: business.id, slug: business.slug }, 'Business is ready')

  if (adminEmail && adminName && adminPassword) {
    const existingAdmin = await User.exists({ businessId: business._id, email: adminEmail })
    if (existingAdmin) throw new Error('An account with BOOTSTRAP_ADMIN_EMAIL already exists in this business')
    if (adminPassword.length < 12) throw new Error('BOOTSTRAP_ADMIN_PASSWORD must contain at least 12 characters')
    const passwordHash = await bcrypt.hash(adminPassword, 12)
    const admin = await User.create({ businessId: business._id, name: adminName, email: adminEmail, passwordHash, role: 'super_admin', status: 'active', emailVerifiedAt: new Date() })
    logger.info({ userId: admin.id, email: admin.email }, 'Initial administrator created')
  }
}

void seed().catch((error: unknown) => {
  logger.error({ err: error }, 'Business bootstrap failed')
  process.exitCode = 1
}).finally(async () => { await mongoose.disconnect() })
