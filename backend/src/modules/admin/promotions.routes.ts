import { Router } from 'express'
import { authenticate } from '../../middleware/authenticate.js'
import { authorize } from '../../middleware/authorize.js'
import { requireBusiness } from '../../middleware/require-business.js'
import { validate } from '../../middleware/validate.js'
import { adminPromotionCreateController, adminPromotionDeleteController, adminPromotionsController, adminPromotionUpdateController } from './promotions.controller.js'
import { promotionCreateSchema, promotionIdSchema, promotionListSchema, promotionUpdateSchema } from './promotions.validators.js'
export const adminPromotionRoutes = Router()
adminPromotionRoutes.use(requireBusiness, (_request, response, next) => { response.setHeader('Cache-Control', 'private, no-store'); next() }, authenticate, authorize('admin', 'manager'))
adminPromotionRoutes.get('/', validate(promotionListSchema), adminPromotionsController)
adminPromotionRoutes.post('/', validate(promotionCreateSchema), adminPromotionCreateController)
adminPromotionRoutes.put('/:promotionId', validate(promotionUpdateSchema), adminPromotionUpdateController)
adminPromotionRoutes.delete('/:promotionId', validate(promotionIdSchema), adminPromotionDeleteController)
