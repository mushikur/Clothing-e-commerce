import { Router } from 'express'
import { authenticate } from '../../middleware/authenticate.js'
import { authorize } from '../../middleware/authorize.js'
import { requireBusiness } from '../../middleware/require-business.js'
import { validate } from '../../middleware/validate.js'
import { adminAnalyticsController, adminCustomersController, adminInventoryController, adminInventoryHistoryController } from './admin.controller.js'
import { analyticsSchema, customerListSchema, inventoryHistorySchema, inventoryListSchema } from './admin.validators.js'
import { deleteRecordController, restoreRecordController, trashListController } from './trash.controller.js'
import { trashActionSchema, trashListSchema } from './trash.validators.js'

const adminRouter = Router()
adminRouter.use(requireBusiness, (_request, response, next) => { response.setHeader('Cache-Control', 'private, no-store'); next() }, authenticate, authorize('admin', 'manager', 'staff'))
adminRouter.get('/analytics', validate(analyticsSchema), adminAnalyticsController)
adminRouter.get('/customers', validate(customerListSchema), adminCustomersController)
adminRouter.get('/trash', authorize('admin', 'manager'), validate(trashListSchema), trashListController)
adminRouter.delete('/trash/:kind/:key', authorize('admin', 'manager'), validate(trashActionSchema), deleteRecordController)
adminRouter.post('/trash/:kind/:key/restore', authorize('admin', 'manager'), validate(trashActionSchema), restoreRecordController)
adminRouter.get('/inventory', validate(inventoryListSchema), adminInventoryController)
adminRouter.get('/inventory/transactions', validate(inventoryHistorySchema), adminInventoryHistoryController)
export const adminAnalyticsRoutes = adminRouter
