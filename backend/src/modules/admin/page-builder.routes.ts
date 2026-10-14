import { Router } from 'express'
import { authenticate } from '../../middleware/authenticate.js'
import { authorize } from '../../middleware/authorize.js'
import { requireBusiness } from '../../middleware/require-business.js'
import { validate } from '../../middleware/validate.js'
import { adminLandingPageCreateController, adminLandingPageDeleteController, adminLandingPageUpdateController, adminLandingPagesController, adminSectionCreateController, adminSectionDeleteController, adminSectionsController, adminSectionsReorderController, adminSectionUpdateController } from './page-builder.controller.js'
import { landingCreateSchema, landingListSchema, landingPageIdSchema, landingUpdateSchema, sectionCreateSchema, sectionIdSchema, sectionListSchema, sectionReorderSchema, sectionUpdateSchema } from './page-builder.validators.js'

function adminRouter() { const router = Router(); router.use(requireBusiness, (_request, response, next) => { response.setHeader('Cache-Control', 'private, no-store'); next() }, authenticate, authorize('admin', 'manager')); return router }

export const adminHomepageRoutes = adminRouter()
adminHomepageRoutes.get('/', validate(sectionListSchema), adminSectionsController)
adminHomepageRoutes.post('/reorder', validate(sectionReorderSchema), adminSectionsReorderController)
adminHomepageRoutes.post('/', validate(sectionCreateSchema), adminSectionCreateController)
adminHomepageRoutes.put('/:sectionId', validate(sectionUpdateSchema), adminSectionUpdateController)
adminHomepageRoutes.delete('/:sectionId', validate(sectionIdSchema), adminSectionDeleteController)

export const adminLandingPageRoutes = adminRouter()
adminLandingPageRoutes.get('/', validate(landingListSchema), adminLandingPagesController)
adminLandingPageRoutes.post('/', validate(landingCreateSchema), adminLandingPageCreateController)
adminLandingPageRoutes.put('/:landingPageId', validate(landingUpdateSchema), adminLandingPageUpdateController)
adminLandingPageRoutes.delete('/:landingPageId', validate(landingPageIdSchema), adminLandingPageDeleteController)
