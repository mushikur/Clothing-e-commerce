import { Router } from 'express'
import { authenticate } from '../../middleware/authenticate.js'
import { authorize } from '../../middleware/authorize.js'
import { requireBusiness } from '../../middleware/require-business.js'
import { validate } from '../../middleware/validate.js'
import { courierConnectionTestController, courierDefaultUpdateController, courierLogsController, courierProviderUpdateController, courierProvidersController, courierTrackingUpdateController } from './couriers.controller.js'
import { courierConfigSchema, courierDefaultSchema, courierEmptySchema, courierLogSchema, courierProviderParamsSchema, courierTrackingSchema } from './couriers.validators.js'

export const adminCourierRoutes = Router()
adminCourierRoutes.use(requireBusiness, (_request, response, next) => { response.setHeader('Cache-Control', 'private, no-store'); next() }, authenticate, authorize('admin', 'manager'))
adminCourierRoutes.get('/providers', validate(courierEmptySchema), courierProvidersController)
adminCourierRoutes.put('/tracking', validate(courierTrackingSchema), courierTrackingUpdateController)
adminCourierRoutes.put('/providers/default', validate(courierDefaultSchema), courierDefaultUpdateController)
adminCourierRoutes.put('/providers/:providerId', validate(courierConfigSchema), courierProviderUpdateController)
adminCourierRoutes.post('/providers/:providerId/test', validate(courierProviderParamsSchema), courierConnectionTestController)
adminCourierRoutes.get('/logs', validate(courierLogSchema), courierLogsController)
