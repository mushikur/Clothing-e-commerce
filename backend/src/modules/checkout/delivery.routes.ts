import { Router } from 'express'
import { authenticate } from '../../middleware/authenticate.js'
import { authorize } from '../../middleware/authorize.js'
import { requireBusiness } from '../../middleware/require-business.js'
import { validate } from '../../middleware/validate.js'
import { adminDeliveryLocationsController, adminDeliveryRulesController, calculateDeliveryController, createDeliveryLocationController, createDeliveryRuleController, deleteDeliveryLocationController, deleteDeliveryRuleController, deliveryLocationSuggestionsController, updateDeliveryLocationController, updateDeliveryLocationStatusController, updateDeliveryRuleController, updateDeliveryRuleStatusController } from './delivery.controller.js'
import { deliveryLocationCreateSchema, deliveryLocationIdSchema, deliveryLocationSearchSchema, deliveryLocationStatusSchema, deliveryLocationUpdateSchema, deliveryQuoteSchema, deliveryRuleCreateSchema, deliveryRuleIdSchema, deliveryRuleStatusSchema, deliveryRuleUpdateSchema } from './delivery.validators.js'
export const shippingRoutes = Router()
shippingRoutes.use(requireBusiness, (_request, response, next) => { response.setHeader('Cache-Control', 'no-store'); next() })
shippingRoutes.get('/locations', validate(deliveryLocationSearchSchema), deliveryLocationSuggestionsController)
shippingRoutes.post('/calculate', validate(deliveryQuoteSchema), calculateDeliveryController)
export const adminDeliveryRoutes = Router()
adminDeliveryRoutes.use(requireBusiness, (_request, response, next) => { response.setHeader('Cache-Control', 'private, no-store'); next() }, authenticate, authorize('super_admin', 'admin', 'manager'))
adminDeliveryRoutes.get('/delivery-locations', adminDeliveryLocationsController)
adminDeliveryRoutes.post('/delivery-locations', validate(deliveryLocationCreateSchema), createDeliveryLocationController)
adminDeliveryRoutes.put('/delivery-locations/:locationId', validate(deliveryLocationUpdateSchema), updateDeliveryLocationController)
adminDeliveryRoutes.delete('/delivery-locations/:locationId', validate(deliveryLocationIdSchema), deleteDeliveryLocationController)
adminDeliveryRoutes.patch('/delivery-locations/:locationId/status', validate(deliveryLocationStatusSchema), updateDeliveryLocationStatusController)
adminDeliveryRoutes.get('/delivery-rules', adminDeliveryRulesController)
adminDeliveryRoutes.post('/delivery-rules', validate(deliveryRuleCreateSchema), createDeliveryRuleController)
adminDeliveryRoutes.put('/delivery-rules/:ruleId', validate(deliveryRuleUpdateSchema), updateDeliveryRuleController)
adminDeliveryRoutes.delete('/delivery-rules/:ruleId', validate(deliveryRuleIdSchema), deleteDeliveryRuleController)
adminDeliveryRoutes.patch('/delivery-rules/:ruleId/status', validate(deliveryRuleStatusSchema), updateDeliveryRuleStatusController)
