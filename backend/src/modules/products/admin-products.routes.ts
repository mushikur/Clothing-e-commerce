import { Router } from 'express'
import { authenticate } from '../../middleware/authenticate.js'
import { authorize } from '../../middleware/authorize.js'
import { requireBusiness } from '../../middleware/require-business.js'
import { validate } from '../../middleware/validate.js'
import { adminProductBulkEditController, adminProductCreateController, adminProductDeleteController, adminProductDuplicateController, adminProductGetController, adminProductsListController, adminProductStockController, adminProductUpdateController } from './admin-products.controller.js'
import { bulkEditSchema, duplicateSchema, productAdminListSchema, productCreateSchema, productIdSchema, productUpdateSchema, stockSchema } from './products.validators.js'

export const adminProductRoutes = Router()
adminProductRoutes.use(requireBusiness, (_request, response, next) => { response.setHeader('Cache-Control', 'private, no-store'); next() }, authenticate, authorize('admin', 'manager', 'staff'))
adminProductRoutes.get('/', validate(productAdminListSchema), adminProductsListController)
adminProductRoutes.post('/', validate(productCreateSchema), adminProductCreateController)
adminProductRoutes.post('/bulk-edit', validate(bulkEditSchema), adminProductBulkEditController)
adminProductRoutes.post('/:productId/duplicate', validate(duplicateSchema), adminProductDuplicateController)
adminProductRoutes.patch('/:productId/variants/:variantId/stock', validate(stockSchema), adminProductStockController)
adminProductRoutes.get('/:productId', validate(productIdSchema), adminProductGetController)
adminProductRoutes.put('/:productId', validate(productUpdateSchema), adminProductUpdateController)
adminProductRoutes.delete('/:productId', authorize('admin', 'manager'), validate(productIdSchema), adminProductDeleteController)
