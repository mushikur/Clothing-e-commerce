import { Category } from '../../models/Category.js'
import { Subcategory } from '../../models/Subcategory.js'
import { asyncHandler } from '../../utils/async-handler.js'
import { AppError } from '../../utils/app-error.js'
import { success } from '../../utils/api-response.js'

export const listCategoriesController = asyncHandler(async (request, response) => {
  const categories = await Category.find({ businessId: request.business!._id, status: 'active' }).select('name slug description imageUrl sortOrder translations').sort({ sortOrder: 1, name: 1 }).lean()
  const subcategories = await Subcategory.find({ businessId: request.business!._id, status: 'active' }).select('categoryId name slug description imageUrl sortOrder translations').sort({ sortOrder: 1, name: 1 }).lean()
  const byCategory = new Map<string, typeof subcategories>()
  for (const item of subcategories) byCategory.set(String(item.categoryId), [...(byCategory.get(String(item.categoryId)) ?? []), item])
  success(response, { categories: categories.map((category) => ({ ...category, subcategories: byCategory.get(String(category._id)) ?? [] })) })
})

export const adminCategoryListController = asyncHandler(async (request, response) => {
  const categories = await Category.find({ businessId: request.business!._id }).sort({ sortOrder: 1, name: 1 }).lean()
  const subcategories = await Subcategory.find({ businessId: request.business!._id }).sort({ sortOrder: 1, name: 1 }).lean()
  success(response, { categories, subcategories })
})

export const createCategoryController = asyncHandler(async (request, response) => {
  const body = (request.validated as { body: Record<string, unknown> }).body
  const category = await Category.create({ ...body, businessId: request.business!._id })
  success(response, { category }, 201)
})

export const updateCategoryController = asyncHandler(async (request, response) => {
  const { categoryId } = (request.validated as { params: { categoryId: string } }).params
  const body = (request.validated as { body: Record<string, unknown> }).body
  const category = await Category.findOneAndUpdate({ _id: categoryId, businessId: request.business!._id }, { $set: body }, { new: true, runValidators: true })
  if (!category) throw new AppError(404, 'category_not_found', 'Category was not found')
  success(response, { category })
})

export const deactivateCategoryController = asyncHandler(async (request, response) => {
  const { categoryId } = (request.validated as { params: { categoryId: string } }).params
  const category = await Category.findOneAndUpdate({ _id: categoryId, businessId: request.business!._id }, { $set: { status: 'inactive' } }, { new: true })
  if (!category) throw new AppError(404, 'category_not_found', 'Category was not found')
  await Subcategory.updateMany({ businessId: request.business!._id, categoryId }, { $set: { status: 'inactive' } })
  success(response, { category, deactivated: true })
})

export const createSubcategoryController = asyncHandler(async (request, response) => {
  const body = (request.validated as { body: { categoryId: string } & Record<string, unknown> }).body
  const parent = await Category.findOne({ _id: body.categoryId, businessId: request.business!._id, status: 'active' })
  if (!parent) throw new AppError(400, 'invalid_category', 'Select an active category in this storefront')
  const subcategory = await Subcategory.create({ ...body, businessId: request.business!._id })
  success(response, { subcategory }, 201)
})

export const updateSubcategoryController = asyncHandler(async (request, response) => {
  const { subcategoryId } = (request.validated as { params: { subcategoryId: string } }).params
  const body = (request.validated as { body: Record<string, unknown> }).body
  const subcategory = await Subcategory.findOneAndUpdate({ _id: subcategoryId, businessId: request.business!._id }, { $set: body }, { new: true, runValidators: true })
  if (!subcategory) throw new AppError(404, 'subcategory_not_found', 'Subcategory was not found')
  success(response, { subcategory })
})

export const deactivateSubcategoryController = asyncHandler(async (request, response) => {
  const { subcategoryId } = (request.validated as { params: { subcategoryId: string } }).params
  const subcategory = await Subcategory.findOneAndUpdate({ _id: subcategoryId, businessId: request.business!._id }, { $set: { status: 'inactive' } }, { new: true })
  if (!subcategory) throw new AppError(404, 'subcategory_not_found', 'Subcategory was not found')
  success(response, { subcategory, deactivated: true })
})
