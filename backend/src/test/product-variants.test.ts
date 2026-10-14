import assert from 'node:assert/strict'
import { test } from 'node:test'
import { productCreateSchema } from '../modules/products/products.validators.js'

const productInput = (variants: Array<Record<string, unknown>>) => ({ body: {
  name: 'Essential cotton tee', slug: 'essential-cotton-tee', sku: 'TEE-01', categoryId: '507f1f77bcf86cd799439011', price: 4900,
  discountPercent: 0, tags: ['cotton'], gender: 'unisex', status: 'published', media: [], variants,
}, params: {}, query: {} })

test('all color and size matrix combinations validate with color-specific images', () => {
  const combinations = ['Black', 'White'].flatMap((color) => ['S', 'M', 'L', 'XL'].map((size) => ({
    sku: `TEE-${color}-${size}`, color, colorCode: color === 'Black' ? '#111111' : '#ffffff', size, price: 4900, currency: 'USD', stock: 5,
    images: [{ url: `https://cdn.example.test/tee-${color.toLowerCase()}.jpg`, sortOrder: 0 }], isActive: true,
  })))
  const parsed = productCreateSchema.safeParse(productInput(combinations))
  assert.equal(parsed.success, true)
  if (parsed.success) {
    assert.equal(parsed.data.body.variants.length, 8)
    assert.equal(parsed.data.body.variants.filter((variant) => variant.color === 'Black').length, 4)
    assert.equal(parsed.data.body.variants.filter((variant) => variant.color === 'White').length, 4)
  }
})

test('duplicate color and size pairs are rejected', () => {
  const duplicate = [
    { sku: 'TEE-BLK-S', color: 'Black', size: 'S', price: 4900, stock: 1, images: [{ url: 'https://cdn.example.test/black.jpg' }] },
    { sku: 'TEE-BLK-S-2', color: ' black ', size: 's', price: 4900, stock: 1, images: [{ url: 'https://cdn.example.test/black.jpg' }] },
  ]
  assert.equal(productCreateSchema.safeParse(productInput(duplicate)).success, false)
})

test('published apparel requires at least one common or variant image', () => {
  const noImages = [{ sku: 'TEE-BLK-S', color: 'Black', size: 'S', price: 4900, stock: 1, images: [] }]
  assert.equal(productCreateSchema.safeParse(productInput(noImages)).success, false)
})
