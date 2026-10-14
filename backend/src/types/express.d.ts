import type { Business } from '../models/Business.js'

declare global {
  namespace Express {
    interface Request {
      requestId: string
      business?: InstanceType<typeof Business>
      user?: { id: string; businessId: string; role: 'customer' | 'staff' | 'manager' | 'admin' | 'super_admin' }
      validated?: unknown
    }
  }
}

export {}
