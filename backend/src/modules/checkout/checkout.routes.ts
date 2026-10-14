import { Router } from 'express'
import { authenticate } from '../../middleware/authenticate.js'
import { authorize } from '../../middleware/authorize.js'
import { optionalAuthenticate } from '../../middleware/optional-authenticate.js'
import { requireBusiness } from '../../middleware/require-business.js'
import { validate } from '../../middleware/validate.js'
import { checkoutConfigController, createOrderController, quoteCheckoutController, updateCheckoutPolicyController } from './checkout.controller.js'
import { checkoutOrderSchema, checkoutPolicySchema, checkoutQuoteSchema } from './checkout.validators.js'
import { guestPaymentReferenceController } from '../orders/orders.controller.js'
import { guestPaymentSchema } from '../orders/orders.validators.js'
import { orderIdSchema } from '../users/users.validators.js'
import { guestOrderDetailController } from './checkout.controller.js'

export const checkoutRoutes = Router()
checkoutRoutes.use(requireBusiness, (_request, response, next) => { response.setHeader('Cache-Control', 'private, no-store'); next() })
checkoutRoutes.get('/config', checkoutConfigController)
checkoutRoutes.post('/quote', optionalAuthenticate, validate(checkoutQuoteSchema), quoteCheckoutController)
checkoutRoutes.post('/orders', optionalAuthenticate, validate(checkoutOrderSchema), createOrderController)
checkoutRoutes.get('/orders/:orderId/guest', validate(orderIdSchema), guestOrderDetailController)
checkoutRoutes.post('/orders/:orderId/payment-reference', validate(guestPaymentSchema), guestPaymentReferenceController)

export const adminCheckoutRoutes = Router()
adminCheckoutRoutes.use(requireBusiness, (_request, response, next) => { response.setHeader('Cache-Control', 'private, no-store'); next() }, authenticate, authorize('admin', 'manager'))
adminCheckoutRoutes.patch('/checkout', validate(checkoutPolicySchema), updateCheckoutPolicyController)
