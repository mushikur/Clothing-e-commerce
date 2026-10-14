import { Router } from 'express'
import { authenticate } from '../../middleware/authenticate.js'
import { requireBusiness } from '../../middleware/require-business.js'
import { validate } from '../../middleware/validate.js'
import { addCartItemController, getCartController, removeCartItemController, updateCartItemController } from './cart.controller.js'
import { cartItemSchema, cartUpdateSchema, cartVariantSchema } from './cart.validators.js'

export const cartRoutes = Router()
cartRoutes.use(requireBusiness, (_request, response, next) => { response.setHeader('Cache-Control', 'private, no-store'); next() }, authenticate)
cartRoutes.get('/', getCartController)
cartRoutes.post('/items', validate(cartItemSchema), addCartItemController)
cartRoutes.patch('/items/:variantId', validate(cartUpdateSchema), updateCartItemController)
cartRoutes.delete('/items/:variantId', validate(cartVariantSchema), removeCartItemController)
