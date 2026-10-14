import { Router } from 'express'
import { authenticate } from '../../middleware/authenticate.js'
import { requireBusiness } from '../../middleware/require-business.js'
import { validate } from '../../middleware/validate.js'
import { addressCreateSchema, addressIdSchema, addressUpdateSchema, listSchema, orderIdSchema, profileSchema, wishlistMoveSchema, wishlistProductIdSchema } from './users.validators.js'
import { customerPaymentReferenceController, customerReturnRequestController } from '../orders/orders.controller.js'
import { customerPaymentSchema, customerReturnSchema } from '../orders/orders.validators.js'
import { addressCreateController, addressDeleteController, addressListController, addressUpdateController, notificationsController, orderDetailController, orderTrackingController, ordersController, profileController, wishlistAddController, wishlistController, wishlistMoveController, wishlistRemoveController } from './users.controller.js'

export const userRoutes = Router()
userRoutes.use(requireBusiness, (_request, response, next) => { response.setHeader('Cache-Control', 'private, no-store'); next() }, authenticate)
userRoutes.patch('/me', validate(profileSchema), profileController)
userRoutes.get('/me/addresses', addressListController)
userRoutes.post('/me/addresses', validate(addressCreateSchema), addressCreateController)
userRoutes.patch('/me/addresses/:addressId', validate(addressIdSchema.merge(addressUpdateSchema)), addressUpdateController)
userRoutes.delete('/me/addresses/:addressId', validate(addressIdSchema), addressDeleteController)
userRoutes.get('/me/orders', validate(listSchema), ordersController)
userRoutes.get('/me/orders/:orderId', validate(orderIdSchema), orderDetailController)
userRoutes.get('/me/orders/:orderId/tracking', validate(orderIdSchema), orderTrackingController)
userRoutes.post('/me/orders/:orderId/payment-reference', validate(customerPaymentSchema), customerPaymentReferenceController)
userRoutes.post('/me/orders/:orderId/returns', validate(customerReturnSchema), customerReturnRequestController)
userRoutes.get('/me/wishlist', wishlistController)
userRoutes.post('/me/wishlist/:productId', validate(wishlistProductIdSchema), wishlistAddController)
userRoutes.post('/me/wishlist/:productId/move-to-cart', validate(wishlistMoveSchema), wishlistMoveController)
userRoutes.delete('/me/wishlist/:productId', validate(wishlistProductIdSchema), wishlistRemoveController)
userRoutes.get('/me/notifications', validate(listSchema), notificationsController)
