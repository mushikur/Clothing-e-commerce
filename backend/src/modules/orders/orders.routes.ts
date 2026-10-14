import { Router } from 'express'
import { authenticate } from '../../middleware/authenticate.js'
import { authorize } from '../../middleware/authorize.js'
import { requireBusiness } from '../../middleware/require-business.js'
import { validate } from '../../middleware/validate.js'
import { adminOrderDetailController, adminOrderPaymentController, adminOrderReturnController, adminOrdersController, adminOrderStatusController, adminShipmentController, paymentSettingsController, updatePaymentSettingsController } from './orders.controller.js'
import { orderAdminListSchema, orderIdSchema, orderStatusSchema, paymentAdminSchema, paymentSettingsSchema, returnAdminSchema, shipmentUpsertSchema } from './orders.validators.js'
import { adminWebsiteSettingsController, adminWebsiteSettingsUpdateController } from '../admin/settings.controller.js'
import { websiteSettingsSchema } from '../admin/settings.validators.js'
import { adminCreateShipmentController, adminDemoShipmentController } from '../couriers/couriers.controller.js'
import { courierShipmentSchema, demoShipmentSchema, manualReturnShipmentSchema } from '../couriers/couriers.validators.js'
import { adminManualReturnShipmentController } from '../couriers/couriers.controller.js'

export const adminOrderRoutes = Router()
adminOrderRoutes.use(requireBusiness, (_request, response, next) => { response.setHeader('Cache-Control', 'private, no-store'); next() }, authenticate, authorize('admin', 'manager', 'staff'))
adminOrderRoutes.get('/', validate(orderAdminListSchema), adminOrdersController)
adminOrderRoutes.get('/:orderId', validate(orderIdSchema), adminOrderDetailController)
adminOrderRoutes.patch('/:orderId/status', validate(orderStatusSchema), adminOrderStatusController)
adminOrderRoutes.patch('/:orderId/payment', authorize('admin', 'manager'), validate(paymentAdminSchema), adminOrderPaymentController)
adminOrderRoutes.patch('/:orderId/returns', authorize('admin', 'manager'), validate(returnAdminSchema), adminOrderReturnController)
adminOrderRoutes.put('/:orderId/returns/shipment', authorize('admin', 'manager'), validate(manualReturnShipmentSchema), adminManualReturnShipmentController)
adminOrderRoutes.post('/:orderId/shipment/create', authorize('admin', 'manager'), validate(courierShipmentSchema), adminCreateShipmentController)
adminOrderRoutes.post('/:orderId/shipment/demo', authorize('admin', 'manager'), validate(demoShipmentSchema), adminDemoShipmentController)
adminOrderRoutes.put('/:orderId/shipment', authorize('admin', 'manager'), validate(shipmentUpsertSchema), adminShipmentController)
export const adminPaymentSettingsRoutes = Router()
adminPaymentSettingsRoutes.use(requireBusiness, (_request, response, next) => { response.setHeader('Cache-Control', 'private, no-store'); next() }, authenticate, authorize('admin', 'manager'))
adminPaymentSettingsRoutes.get('/payments', paymentSettingsController)
adminPaymentSettingsRoutes.put('/payments', validate(paymentSettingsSchema), updatePaymentSettingsController)
adminPaymentSettingsRoutes.get('/site', adminWebsiteSettingsController)
adminPaymentSettingsRoutes.put('/site', validate(websiteSettingsSchema), adminWebsiteSettingsUpdateController)
