import { Router, type Request, type Response, type NextFunction } from 'express'
import multer, { MulterError } from 'multer'
import { authenticate } from '../../middleware/authenticate.js'
import { authorize } from '../../middleware/authorize.js'
import { requireBusiness } from '../../middleware/require-business.js'
import { validate } from '../../middleware/validate.js'
import { AppError } from '../../utils/app-error.js'
import { env } from '../../config/env.js'
import { mediaAltSchema, mediaIdSchema, mediaJobCreateSchema, mediaJobIdSchema, mediaListSchema, mediaSettingsUpdateSchema } from './media.validators.js'
import { mediaAltUpdateController, mediaDeleteController, mediaJobCreateController, mediaJobGetController, mediaListController, mediaSettingsGetController, mediaSettingsUpdateController, mediaStatsController, mediaUploadController } from './media.controller.js'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MEDIA_MAX_UPLOAD_BYTES, files: 1, fields: 2, parts: 3 },
  fileFilter(_request, file, callback) {
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.mimetype)) { callback(new AppError(422, 'unsupported_image', 'Upload a JPEG, PNG, WebP, or AVIF image')) ; return }
    callback(null, true)
  },
})
function parseImageUpload(request: Request, response: Response, next: NextFunction) {
  upload.single('file')(request, response, (error?: unknown) => {
    if (!error) { next(); return }
    if (error instanceof MulterError && error.code === 'LIMIT_FILE_SIZE') { next(new AppError(413, 'image_too_large', 'Image exceeds the configured upload size limit')); return }
    if (error instanceof MulterError) { next(new AppError(422, 'invalid_image_upload', 'Upload one supported image file')); return }
    next(error)
  })
}

export const adminMediaRoutes = Router()
adminMediaRoutes.use(requireBusiness, (_request, response, next) => { response.setHeader('Cache-Control', 'private, no-store'); next() }, authenticate, authorize('admin', 'manager', 'staff'))
adminMediaRoutes.get('/settings', mediaSettingsGetController)
adminMediaRoutes.put('/settings', authorize('admin', 'manager'), validate(mediaSettingsUpdateSchema), mediaSettingsUpdateController)
adminMediaRoutes.get('/stats', mediaStatsController)
adminMediaRoutes.get('/', validate(mediaListSchema), mediaListController)
adminMediaRoutes.post('/upload', parseImageUpload, mediaUploadController)
adminMediaRoutes.post('/jobs', authorize('admin', 'manager'), validate(mediaJobCreateSchema), mediaJobCreateController)
adminMediaRoutes.get('/jobs/:jobId', validate(mediaJobIdSchema), mediaJobGetController)
adminMediaRoutes.patch('/:mediaId', validate(mediaAltSchema), mediaAltUpdateController)
adminMediaRoutes.delete('/:mediaId', validate(mediaIdSchema), authorize('admin', 'manager'), mediaDeleteController)
