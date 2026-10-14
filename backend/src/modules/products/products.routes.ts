import { Router } from 'express'
import { requireBusiness } from '../../middleware/require-business.js'
import { validate } from '../../middleware/validate.js'
import { bestSellersController, getProductController, listProductsController, productReviewsController, reviewHighlightsController, trendingProductsController } from './products.controller.js'
import { productBySlugSchema, productListSchema, productReviewsSchema } from './products.validators.js'

export const productRoutes = Router()
productRoutes.use(requireBusiness)
productRoutes.get('/', validate(productListSchema), listProductsController)
productRoutes.get('/reviews/highlights', reviewHighlightsController)
productRoutes.get('/best-sellers', bestSellersController)
productRoutes.get('/trending', trendingProductsController)
productRoutes.get('/:slug/reviews', validate(productReviewsSchema), productReviewsController)
productRoutes.get('/:slug', validate(productBySlugSchema), getProductController)
