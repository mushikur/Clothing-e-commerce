import { Router } from 'express'
import { authenticate } from '../../middleware/authenticate.js'
import { authorize } from '../../middleware/authorize.js'
import { requireBusiness } from '../../middleware/require-business.js'
import { validate } from '../../middleware/validate.js'
import { adminCategoryListController, createCategoryController, createSubcategoryController, deactivateCategoryController, deactivateSubcategoryController, listCategoriesController, updateCategoryController, updateSubcategoryController } from './categories.controller.js'
import { categoryCreateSchema, categoryIdSchema, categoryUpdateSchema, subcategoryCreateSchema, subcategoryIdSchema, subcategoryUpdateSchema } from './products.validators.js'

export const categoryRoutes = Router()
categoryRoutes.use(requireBusiness)
categoryRoutes.get('/', listCategoriesController)

export const adminCategoryRoutes = Router()
adminCategoryRoutes.use(requireBusiness, authenticate, authorize('admin', 'manager', 'staff'))
adminCategoryRoutes.get('/', adminCategoryListController)
adminCategoryRoutes.post('/', validate(categoryCreateSchema), createCategoryController)
adminCategoryRoutes.patch('/:categoryId', validate(categoryUpdateSchema), updateCategoryController)
adminCategoryRoutes.delete('/:categoryId', validate(categoryIdSchema), deactivateCategoryController)
adminCategoryRoutes.post('/subcategories', validate(subcategoryCreateSchema), createSubcategoryController)
adminCategoryRoutes.patch('/subcategories/:subcategoryId', validate(subcategoryUpdateSchema), updateSubcategoryController)
adminCategoryRoutes.delete('/subcategories/:subcategoryId', validate(subcategoryIdSchema), deactivateSubcategoryController)
