import { asyncHandler } from '../../utils/async-handler.js'
import { success } from '../../utils/api-response.js'
import { AppError } from '../../utils/app-error.js'
import { archiveAdminProduct, adminProductById, bulkEditAdminProducts, createAdminProduct, duplicateAdminProduct, listAdminProducts, setVariantStock, updateAdminProduct } from './admin-products.service.js'

const validated = <T,>(request: { validated?: unknown }) => request.validated as T
function actor(request: { user?: { id: string } }): string {
  if (!request.user) throw new AppError(401, 'authentication_required', 'Sign in is required')
  return request.user.id
}

export const adminProductsListController = asyncHandler(async (request, response) => {
  const { query } = validated<{ query: { page: number; limit: number; q?: string; status?: string; sort?: string } }>(request)
  const result = await listAdminProducts(request.business!._id, query)
  success(response, result.products, 200, { page: result.page, limit: result.limit, total: result.total, pages: result.pages })
})

export const adminProductGetController = asyncHandler(async (request, response) => {
  const { params: { productId } } = validated<{ params: { productId: string } }>(request)
  success(response, await adminProductById(request.business!._id, productId))
})

export const adminProductCreateController = asyncHandler(async (request, response) => {
  const { body } = validated<{ body: Parameters<typeof createAdminProduct>[2] }>(request)
  const product = await createAdminProduct(request.business!._id, actor(request), body)
  success(response, await adminProductById(request.business!._id, product.id), 201)
})

export const adminProductUpdateController = asyncHandler(async (request, response) => {
  const { body, params: { productId } } = validated<{ body: Parameters<typeof updateAdminProduct>[3]; params: { productId: string } }>(request)
  const product = await updateAdminProduct(request.business!._id, productId, actor(request), body)
  success(response, await adminProductById(request.business!._id, product.id))
})

export const adminProductDeleteController = asyncHandler(async (request, response) => {
  const { params: { productId } } = validated<{ params: { productId: string } }>(request)
  const product = await archiveAdminProduct(request.business!._id, productId)
  success(response, { productId: product.id, status: product.status, archived: true })
})

export const adminProductDuplicateController = asyncHandler(async (request, response) => {
  const { params: { productId }, body: { slug, sku } } = validated<{ params: { productId: string }; body: { slug: string; sku: string } }>(request)
  const product = await duplicateAdminProduct(request.business!._id, productId, actor(request), slug, sku)
  success(response, await adminProductById(request.business!._id, product.id), 201)
})

export const adminProductBulkEditController = asyncHandler(async (request, response) => {
  const { body } = validated<{ body: { productIds: string[]; changes: Record<string, unknown> } }>(request)
  success(response, await bulkEditAdminProducts(request.business!._id, body.productIds, body.changes))
})

export const adminProductStockController = asyncHandler(async (request, response) => {
  const { params, body } = validated<{ params: { productId: string; variantId: string }; body: { quantity: number; reason: string } }>(request)
  const result = await setVariantStock(request.business!._id, params.productId, params.variantId, body.quantity, body.reason, actor(request))
  success(response, result)
})
