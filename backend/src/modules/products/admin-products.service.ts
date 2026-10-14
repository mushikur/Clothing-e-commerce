import mongoose, { type Types } from 'mongoose'
import { Category } from '../../models/Category.js'
import { Inventory } from '../../models/Inventory.js'
import { InventoryTransaction } from '../../models/InventoryTransaction.js'
import { Product } from '../../models/Product.js'
import { ProductVariant } from '../../models/ProductVariant.js'
import { Subcategory } from '../../models/Subcategory.js'
import { AppError } from '../../utils/app-error.js'

type ProductInput = {
  name: string; slug: string; sku: string; categoryId: string; subcategoryId?: string; description?: string; shortDescription?: string; brand?: string; tags: string[];
  price: number; discountPercent: number; costPrice?: number; media: Array<{ kind: 'image' | 'video'; url: string; alt?: string; sortOrder: number; width?: number; height?: number; responsiveVariants?: Array<{ label: string; width: number; height: number; format: string; url: string }> }>;
  material?: string; fabric?: string; gender: 'women' | 'men' | 'unisex' | 'kids' | 'unspecified'; season?: string; collection?: string; status: 'draft' | 'published' | 'archived';
  seo?: { title?: string; description?: string; canonicalUrl?: string };
  translations?: { en?: { name?: string; shortDescription?: string; description?: string; slug?: string; seoTitle?: string; seoDescription?: string }; bn?: { name?: string; shortDescription?: string; description?: string; slug?: string; seoTitle?: string; seoDescription?: string } };
  variants: Array<{ sku: string; color: string; colorCode?: string; size: string; price: number; compareAtPrice?: number; currency: string; stock: number; images: Array<{ url: string; alt?: string; sortOrder: number; width?: number; height?: number; responsiveVariants?: Array<{ label: string; width: number; height: number; format: string; url: string }> }>; isActive: boolean }>
}

const combinationKey = (color: string, size: string) => `${color.trim().toLowerCase()}|${size.trim().toUpperCase()}`

async function ensureCategory(businessId: Types.ObjectId, categoryId: string, subcategoryId?: string, session?: mongoose.ClientSession): Promise<void> {
  const categoryQuery = Category.findOne({ _id: categoryId, businessId, status: 'active' })
  if (session) categoryQuery.session(session)
  const category = await categoryQuery
  if (!category) throw new AppError(422, 'invalid_category', 'Choose an active category in this storefront')
  if (subcategoryId) {
    const subcategoryQuery = Subcategory.findOne({ _id: subcategoryId, categoryId, businessId, status: 'active' })
    if (session) subcategoryQuery.session(session)
    if (!await subcategoryQuery) throw new AppError(422, 'invalid_subcategory', 'Choose an active subcategory under the selected category')
  }
}

async function transaction<T>(work: (session: mongoose.ClientSession) => Promise<T>): Promise<T> {
  const session = await mongoose.startSession()
  let result: T | undefined
  try {
    await session.withTransaction(async () => { result = await work(session) })
    if (result === undefined) throw new Error('The database transaction did not complete')
    return result
  } finally { await session.endSession() }
}

async function replaceVariants(businessId: Types.ObjectId, productId: Types.ObjectId, inputs: ProductInput['variants'], actorUserId: string, session: mongoose.ClientSession): Promise<void> {
  const existing = await ProductVariant.find({ businessId, productId }).session(session)
  const existingByKey = new Map(existing.map((item) => [combinationKey(item.color || item.attributes?.get?.('color') || '', item.size || item.attributes?.get?.('size') || ''), item]))
  const retained = new Set<string>()
  for (const input of inputs) {
    const key = combinationKey(input.color, input.size)
    retained.add(key)
    let variant = existingByKey.get(key)
    if (variant) {
      variant.set({ sku: input.sku, color: input.color, colorCode: input.colorCode, size: input.size, price: input.price, compareAtPrice: input.compareAtPrice, currency: input.currency, images: input.images, isActive: input.isActive, attributes: { color: input.color, size: input.size } })
      await variant.save({ session })
    } else {
      ;[variant] = await ProductVariant.create([{ businessId, productId, sku: input.sku, color: input.color, colorCode: input.colorCode, size: input.size, price: input.price, compareAtPrice: input.compareAtPrice, currency: input.currency, images: input.images, isActive: input.isActive, attributes: { color: input.color, size: input.size } }], { session })
    }
    let inventory = await Inventory.findOne({ businessId, variantId: variant._id, locationCode: 'DEFAULT' }).session(session)
    if (!inventory) {
      inventory = new Inventory({ businessId, variantId: variant._id, locationCode: 'DEFAULT', onHand: input.stock, reserved: 0 })
      await inventory.save({ session })
      if (input.stock > 0) await InventoryTransaction.create([{ businessId, inventoryId: inventory._id, variantId: variant._id, type: 'receipt', quantityDelta: input.stock, reason: 'Initial stock', sourceType: 'manual', actorUserId }], { session })
    } else if (inventory.onHand !== input.stock) {
      if (input.stock < inventory.reserved) throw new AppError(409, 'stock_below_reserved', 'Stock cannot be set below the quantity reserved for orders')
      const delta = input.stock - inventory.onHand
      inventory.onHand = input.stock
      await inventory.save({ session })
      await InventoryTransaction.create([{ businessId, inventoryId: inventory._id, variantId: variant._id, type: 'adjustment', quantityDelta: delta, reason: 'Product variant stock updated', sourceType: 'manual', actorUserId }], { session })
    }
  }
  for (const variant of existing) {
    const key = combinationKey(variant.color || variant.attributes?.get?.('color') || '', variant.size || variant.attributes?.get?.('size') || '')
    if (!retained.has(key) && variant.isActive) { variant.isActive = false; await variant.save({ session }) }
  }
}

export async function createAdminProduct(businessId: Types.ObjectId, actorUserId: string, input: ProductInput) {
  if (input.status === 'published' && !input.media.some((media) => media.kind === 'image') && !input.variants.some((variant) => variant.images.length > 0)) throw new AppError(422, 'product_image_required', 'Published products need at least one image')
  await ensureCategory(businessId, input.categoryId, input.subcategoryId)
  return transaction(async (session) => {
    const { variants, ...productFields } = input
    const [product] = await Product.create([{ ...productFields, businessId }], { session })
    await replaceVariants(businessId, product._id, variants, actorUserId, session)
    return product
  })
}

export async function updateAdminProduct(businessId: Types.ObjectId, productId: string, actorUserId: string, input: ProductInput) {
  if (input.status === 'published' && !input.media.some((media) => media.kind === 'image') && !input.variants.some((variant) => variant.images.length > 0)) throw new AppError(422, 'product_image_required', 'Published products need at least one image')
  await ensureCategory(businessId, input.categoryId, input.subcategoryId)
  return transaction(async (session) => {
    const product = await Product.findOne({ _id: productId, businessId }).session(session)
    if (!product) throw new AppError(404, 'product_not_found', 'Product was not found')
    const { variants, ...productFields } = input
    product.set({ ...productFields, businessId, publishedAt: input.status === 'published' ? product.publishedAt ?? new Date() : product.publishedAt })
    await product.save({ session })
    await replaceVariants(businessId, product._id, variants, actorUserId, session)
    return product
  })
}

export async function adminProductById(businessId: Types.ObjectId, productId: string) {
  const product = await Product.findOne({ _id: productId, businessId }).lean() as unknown as Record<string, any> | null
  if (!product) throw new AppError(404, 'product_not_found', 'Product was not found')
  const variants = await ProductVariant.find({ businessId, productId }).lean()
  const stock = await Inventory.find({ businessId, variantId: { $in: variants.map((variant) => variant._id) } }).select('variantId onHand reserved').lean()
  const stockMap = new Map(stock.map((item) => [String(item.variantId), item]))
  return { ...product, variants: variants.map((variant) => ({ ...variant, stock: stockMap.get(String(variant._id))?.onHand ?? 0, reserved: stockMap.get(String(variant._id))?.reserved ?? 0 })) }
}

export async function listAdminProducts(businessId: Types.ObjectId, input: { page: number; limit: number; q?: string; status?: string; sort?: string }) {
  const filter: Record<string, unknown> = { businessId, status: { $ne: 'archived' } }
  if (input.status) filter.status = input.status
  if (input.q) filter.$or = [{ name: new RegExp(input.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }, { sku: new RegExp(input.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }]
  const sorts: Record<string, Record<string, 1 | -1>> = { updated_desc: { updatedAt: -1 }, name_asc: { name: 1 }, name_desc: { name: -1 }, price_asc: { price: 1, name: 1 }, price_desc: { price: -1, name: 1 } }
  const [products, total] = await Promise.all([Product.find(filter).select('name slug sku categoryId brand price status updatedAt').sort(sorts[input.sort || 'updated_desc']).skip((input.page - 1) * input.limit).limit(input.limit).populate({ path: 'categoryId', select: 'name', match: { businessId } }).lean(), Product.countDocuments(filter)])
  return { products, page: input.page, limit: input.limit, total, pages: Math.ceil(total / input.limit) }
}

export async function archiveAdminProduct(businessId: Types.ObjectId, productId: string) {
  return transaction(async (session) => {
    const product = await Product.findOneAndUpdate({ _id: productId, businessId }, { $set: { status: 'archived' } }, { new: true, session })
    if (!product) throw new AppError(404, 'product_not_found', 'Product was not found')
    await ProductVariant.updateMany({ businessId, productId, isActive: true }, { $set: { isActive: false, archivedActive: true } }, { session })
    return product
  })
}

export async function duplicateAdminProduct(businessId: Types.ObjectId, productId: string, actorUserId: string, slug: string, sku: string) {
  const source = await adminProductById(businessId, productId) as Record<string, any>
  const variants = (source.variants as Array<Record<string, any>>).map((variant) => ({ sku: `${sku}-${variant.color}-${variant.size}`.toUpperCase().replace(/[^A-Z0-9-]/g, '-').slice(0, 80), color: variant.color, colorCode: variant.colorCode, size: variant.size, price: variant.price, compareAtPrice: variant.compareAtPrice, currency: variant.currency, stock: 0, images: variant.images ?? [], isActive: variant.isActive }))
  return createAdminProduct(businessId, actorUserId, { name: `${source.name} copy`, slug, sku, categoryId: String(source.categoryId), subcategoryId: source.subcategoryId ? String(source.subcategoryId) : undefined, description: source.description, shortDescription: source.shortDescription, brand: source.brand, tags: source.tags ?? [], price: source.price, discountPercent: source.discountPercent ?? 0, costPrice: source.costPrice, media: source.media ?? [], material: source.material, fabric: source.fabric, gender: source.gender ?? 'unspecified', season: source.season, collection: source.collection, status: 'draft', seo: source.seo, variants } as ProductInput)
}

export async function bulkEditAdminProducts(businessId: Types.ObjectId, productIds: string[], changes: Record<string, unknown>) {
  if (typeof changes.categoryId === 'string') await ensureCategory(businessId, changes.categoryId)
  return transaction(async (session) => {
    const products = await Product.find({ businessId, _id: { $in: productIds } }).session(session)
    if (products.length !== new Set(productIds).size) throw new AppError(404, 'products_not_found', 'One or more products were not found in this storefront')
    if (changes.status === 'published') {
      for (const product of products) {
        const variants = await ProductVariant.find({ businessId, productId: product._id, isActive: true }).session(session)
        if (!(product.media as Array<{ kind?: string }>).some((item) => item.kind === 'image') && !variants.some((variant) => variant.images.length > 0)) throw new AppError(422, 'product_image_required', `Add product images before publishing ${product.name}`)
      }
    }
    for (const product of products) { product.set({ ...changes, ...(typeof changes.categoryId === 'string' ? { subcategoryId: undefined } : {}) }); await product.save({ session }) }
    if (changes.status === 'archived') await ProductVariant.updateMany({ businessId, productId: { $in: productIds } }, { $set: { isActive: false } }, { session })
    return { updated: products.length }
  })
}

export async function setVariantStock(businessId: Types.ObjectId, productId: string, variantId: string, quantity: number, reason: string, actorUserId: string) {
  return transaction(async (session) => {
    const variant = await ProductVariant.findOne({ _id: variantId, productId, businessId }).session(session)
    if (!variant) throw new AppError(404, 'variant_not_found', 'Product variant was not found')
    let inventory = await Inventory.findOne({ businessId, variantId, locationCode: 'DEFAULT' }).session(session)
    if (!inventory) inventory = new Inventory({ businessId, variantId, locationCode: 'DEFAULT', onHand: 0, reserved: 0 })
    if (quantity < inventory.reserved) throw new AppError(409, 'stock_below_reserved', 'Stock cannot be set below the quantity reserved for orders')
    const delta = quantity - inventory.onHand
    if (delta === 0) return { variantId, quantity, available: quantity - inventory.reserved }
    inventory.onHand = quantity
    await inventory.save({ session })
    await InventoryTransaction.create([{ businessId, inventoryId: inventory._id, variantId, type: 'adjustment', quantityDelta: delta, reason, sourceType: 'manual', actorUserId }], { session })
    return { variantId, quantity, available: quantity - inventory.reserved }
  })
}
