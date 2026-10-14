import { Router } from 'express'
import { authenticate } from '../../middleware/authenticate.js'
import { authorize } from '../../middleware/authorize.js'
import { requireBusiness } from '../../middleware/require-business.js'
import { validate } from '../../middleware/validate.js'
import { adminContentPageDeleteController, adminContentPageSaveController, adminContentPagesController, adminThemeCreateController, adminThemePublishController, adminThemeUpdateController, adminThemesController, adminThemesDeleteController } from './customizer.controller.js'
import { contentListSchema, contentPageIdSchema, contentUpsertSchema, themeCreateSchema, themeIdSchema, themeListSchema, themeUpdateSchema } from './customizer.validators.js'

export const adminThemeRoutes = Router()
adminThemeRoutes.use(requireBusiness, (_request, response, next) => { response.setHeader('Cache-Control', 'private, no-store'); next() }, authenticate, authorize('admin', 'manager'))
adminThemeRoutes.get('/', validate(themeListSchema), adminThemesController)
adminThemeRoutes.post('/', validate(themeCreateSchema), adminThemeCreateController)
adminThemeRoutes.put('/:themeId', validate(themeUpdateSchema), adminThemeUpdateController)
adminThemeRoutes.post('/:themeId/publish', validate(themeIdSchema), adminThemePublishController)
adminThemeRoutes.delete('/:themeId', validate(themeIdSchema), adminThemesDeleteController)

export const adminContentRoutes = Router()
adminContentRoutes.use(requireBusiness, (_request, response, next) => { response.setHeader('Cache-Control', 'private, no-store'); next() }, authenticate, authorize('admin', 'manager'))
adminContentRoutes.get('/', validate(contentListSchema), adminContentPagesController)
adminContentRoutes.put('/:pageKey', validate(contentUpsertSchema), adminContentPageSaveController)
adminContentRoutes.delete('/:pageKey', validate(contentPageIdSchema), adminContentPageDeleteController)
