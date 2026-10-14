import { Router } from 'express'
import { z } from 'zod'
import { requireBusiness } from '../../middleware/require-business.js'
import { validate } from '../../middleware/validate.js'
import { storefrontConfigController, storefrontHomepageController, storefrontLandingPageController, storefrontPageController } from './storefront.controller.js'

const envelope = z.object({ body: z.object({}), params: z.object({}).strict(), query: z.object({}).strict() }).strict()
const pageSchema = z.object({ body: z.object({}), params: z.object({ slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80) }).strict(), query: z.object({}).strict() }).strict()
export const storefrontRoutes = Router()
storefrontRoutes.use(requireBusiness, (_request, response, next) => { response.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300'); next() })
storefrontRoutes.get('/config', validate(envelope), storefrontConfigController)
storefrontRoutes.get('/homepage', validate(envelope), storefrontHomepageController)
storefrontRoutes.get('/pages/:slug', validate(pageSchema), storefrontPageController)
storefrontRoutes.get('/landing/:slug', validate(pageSchema), storefrontLandingPageController)
