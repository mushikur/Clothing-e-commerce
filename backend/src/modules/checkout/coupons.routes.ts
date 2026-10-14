import { Router } from 'express'
import { authenticate } from '../../middleware/authenticate.js'
import { authorize } from '../../middleware/authorize.js'
import { requireBusiness } from '../../middleware/require-business.js'
import { validate } from '../../middleware/validate.js'
import { adminCouponCreateController, adminCouponDeleteController, adminCouponsController, adminCouponStatusController, adminCouponUpdateController } from './coupons.controller.js'
import { couponCreateSchema, couponIdSchema, couponListSchema, couponStatusSchema, couponUpdateSchema } from './coupons.validators.js'

export const adminCouponRoutes = Router()
adminCouponRoutes.use(requireBusiness, (_request, response, next) => { response.setHeader('Cache-Control', 'private, no-store'); next() }, authenticate, authorize('admin', 'manager'))
adminCouponRoutes.get('/', validate(couponListSchema), adminCouponsController)
adminCouponRoutes.post('/', validate(couponCreateSchema), adminCouponCreateController)
adminCouponRoutes.patch('/:couponId/status', validate(couponStatusSchema), adminCouponStatusController)
adminCouponRoutes.put('/:couponId', validate(couponUpdateSchema), adminCouponUpdateController)
adminCouponRoutes.delete('/:couponId', validate(couponIdSchema), adminCouponDeleteController)
