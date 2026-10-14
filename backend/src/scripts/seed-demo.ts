import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'node:crypto'
import mongoose, { type Model } from 'mongoose'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { Address } from '../models/Address.js'
import { Business } from '../models/Business.js'
import { Cart } from '../models/Cart.js'
import { Category } from '../models/Category.js'
import { ContentPage } from '../models/ContentPage.js'
import { Coupon } from '../models/Coupon.js'
import { CourierConfiguration } from '../models/CourierConfiguration.js'
import { HomepageSection } from '../models/HomepageSection.js'
import { Inventory } from '../models/Inventory.js'
import { InventoryTransaction } from '../models/InventoryTransaction.js'
import { LandingPage } from '../models/LandingPage.js'
import { Notification } from '../models/Notification.js'
import { Order } from '../models/Order.js'
import { OrderItem } from '../models/OrderItem.js'
import { Payment } from '../models/Payment.js'
import { Product } from '../models/Product.js'
import { ProductVariant } from '../models/ProductVariant.js'
import { ProductViewDaily } from '../models/ProductViewDaily.js'
import { Promotion } from '../models/Promotion.js'
import { Review } from '../models/Review.js'
import { Shipment } from '../models/Shipment.js'
import { Subcategory } from '../models/Subcategory.js'
import { Theme } from '../models/Theme.js'
import { User } from '../models/User.js'
import { WebsiteSettings } from '../models/WebsiteSettings.js'
import { Wishlist } from '../models/Wishlist.js'
import { uploadOptimizedImage } from '../modules/media/image-optimization.service.js'
import { ensureDeliveryDefaults } from '../modules/checkout/delivery.service.js'

type DocumentModel = Model<any>
const now = new Date()
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000)
const required = (key: string) => {
  const value = process.env[key]?.trim()
  if (!value) throw new Error(`${key} is required`)
  return value
}
const safeEmail = (value: string) => value.trim().toLowerCase()

async function upsert(model: DocumentModel, filter: Record<string, unknown>, values: Record<string, unknown>) {
  let document = await model.findOne(filter)
  if (!document) document = new model({ ...filter, ...values })
  else {
    const { createdAt: _createdAt, updatedAt: _updatedAt, ...mutableValues } = values
    Object.assign(document, mutableValues)
  }
  await document.save()
  return document
}

function bnProductName(name: string) {
  const terms: Array<[RegExp, string]> = [[/The Everyday/gi, 'প্রতিদিনের'], [/Everyday/gi, 'প্রতিদিনের'], [/Relaxed/gi, 'আরামদায়ক'], [/Heavyweight/gi, 'হেভিওয়েট'], [/Cotton/gi, 'কটন'], [/T-Shirt|Tee/gi, 'টি-শার্ট'], [/Shirt/gi, 'শার্ট'], [/Trouser|Pant/gi, 'প্যান্ট'], [/Denim|Jean/gi, 'ডেনিম'], [/Hoodie/gi, 'হুডি'], [/Jacket/gi, 'জ্যাকেট'], [/Panjabi/gi, 'পাঞ্জাবি'], [/Dress/gi, 'ড্রেস'], [/Blouse/gi, 'ব্লাউজ'], [/Saree/gi, 'শাড়ি'], [/Belted/gi, 'বেল্টযুক্ত'], [/Tote/gi, 'টোট ব্যাগ'], [/Scarf/gi, 'স্কার্ফ'], [/Linen/gi, 'লিনেন'], [/Modern/gi, 'আধুনিক'], [/Soft/gi, 'কোমল'], [/The /gi, '']]
  return terms.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), name).replace(/\s+/g, ' ').trim()
}

function imageSnapshot(asset: any, alt: string) {
  const primary = [...asset.variants].sort((a: any, b: any) => b.width - a.width)[0]
  return {
    url: primary.url, alt, width: asset.width, height: asset.height,
    responsiveVariants: asset.variants.map((variant: any) => ({ label: variant.label, width: variant.width, height: variant.height, format: variant.format, url: variant.url })),
  }
}

function productImages(asset: any, alt: string) {
  const image = imageSnapshot(asset, alt)
  return [{ ...image, sortOrder: 0 }]
}

async function main() {
  const uri = required('MONGODB_URI')
  const adminEmail = safeEmail(required('DEMO_ADMIN_EMAIL'))
  const adminPassword = required('DEMO_ADMIN_PASSWORD')
  const customerEmail = safeEmail(required('DEMO_CUSTOMER_EMAIL'))
  const customerPassword = required('DEMO_CUSTOMER_PASSWORD')
  const assetDirectory = path.resolve(required('DEMO_IMAGE_DIRECTORY'))
  const dbName = new URL(uri).pathname.replace(/^\//, '').split('?')[0]
  if (dbName !== 'fashion_commerce_demo') throw new Error('Demo seeding is restricted to the fashion_commerce_demo database')
  if (adminPassword.length < 12 || customerPassword.length < 12) throw new Error('Demo passwords must be at least 12 characters')
  if (Buffer.byteLength(adminPassword, 'utf8') > 72 || Buffer.byteLength(customerPassword, 'utf8') > 72) throw new Error('Demo passwords must be no more than 72 bytes')
  const businessSlug = 'aster-loom-demo'
  await mongoose.connect(uri)

  const business = await upsert(Business, { slug: businessSlug }, {
    name: 'Aster & Loom', domains: ['localhost', '127.0.0.1'], status: 'active', defaultLocale: 'en-BD', defaultCurrency: 'BDT',
    checkout: {
      guestCheckoutEnabled: true, cashOnDeliveryEnabled: true,
      paymentMethods: [
        { code: 'bkash', enabled: true, merchantNumber: 'DEMO-ONLY', accountType: 'Demo collection', instructions: 'SIMULATED DEMO ONLY. Do not send money. No payment is collected by this demo.' },
        { code: 'nagad', enabled: true, merchantNumber: 'DEMO-ONLY', accountType: 'Demo collection', instructions: 'SIMULATED DEMO ONLY. Do not send money. No payment is collected by this demo.' },
      ],
      deliveryOptions: [
        { code: 'dhaka', label: 'Inside Dhaka', fee: 6000, estimatedDays: '1–2 business days', enabled: true },
        { code: 'nationwide', label: 'Outside Dhaka', fee: 12000, estimatedDays: '2–5 business days', enabled: true },
      ],
    },
  })
  const businessId = business._id
  await ensureDeliveryDefaults(business)

  const adminHash = await bcrypt.hash(adminPassword, 12)
  const admin = await upsert(User, { businessId, email: adminEmail }, { name: 'Aster & Loom Demo Admin', passwordHash: adminHash, role: 'admin', status: 'active', emailVerifiedAt: now, phone: '+880 0000 000000' })

  const customerNames = ['Ari Nahar', 'Mira Chowdhury', 'Samin Rahman', 'Raina Kabir', 'Tariq Mahmud', 'Nila Sultana', 'Zayan Hossain', 'Anika Noor', 'Ishan Karim', 'Lina Ahmed', 'Rafi Hasan', 'Tisha Alam']
  const customerHashes = await Promise.all(customerNames.map((_, index) => bcrypt.hash(index === 0 ? customerPassword : randomBytes(24).toString('base64url'), 10)))
  const customers: any[] = []
  for (let index = 0; index < customerNames.length; index += 1) {
    const email = index === 0 ? customerEmail : `customer${String(index + 1).padStart(2, '0')}@aster-loom.example.test`
    customers.push(await upsert(User, { businessId, email }, { name: customerNames[index], passwordHash: customerHashes[index], role: 'customer', status: 'active', emailVerifiedAt: daysAgo(120 - index * 4), phone: `+880 0000 0000${String(100 + index).slice(-3)}` }))
  }
  const primaryCustomer = customers[0]

  const categoryDefinitions = [
    { name: 'Men', slug: 'men', description: 'Relaxed tailoring and considered everyday pieces.', imageIndex: 0 },
    { name: 'Women', slug: 'women', description: 'Expressive essentials with an easy point of view.', imageIndex: 3 },
    { name: 'Accessories', slug: 'accessories', description: 'Finishing touches, made to be reached for often.', imageIndex: 7 },
  ]
  const categories: Record<string, any> = {}
  for (let index = 0; index < categoryDefinitions.length; index += 1) {
    const definition = categoryDefinitions[index]!
    const categoryBn = { men: 'পুরুষ', women: 'নারী', accessories: 'অনুষঙ্গ' }[definition.slug] || definition.name
    categories[definition.slug] = await upsert(Category, { businessId, slug: definition.slug }, { name: definition.name, description: definition.description, translations: { en: { name: definition.name, description: definition.description }, bn: { name: categoryBn, description: `${categoryBn} কালেকশন থেকে যত্নে বেছে নেওয়া পোশাক।` } }, imageUrl: '', sortOrder: index, status: 'active', seo: { title: `${definition.name} | Aster & Loom`, description: definition.description } })
  }

  const subcategoryDefinitions = [
    ['men', 'T-Shirts', 't-shirts'], ['men', 'Shirts', 'shirts'], ['men', 'Trousers', 'trousers'], ['men', 'Denim', 'denim'], ['men', 'Knitwear', 'knitwear'], ['men', 'Jackets', 'jackets'], ['men', 'Panjabi', 'panjabi'],
    ['women', 'Dresses', 'dresses'], ['women', 'Blouses', 'blouses'], ['women', 'Sarees', 'sarees'], ['women', 'Outerwear', 'womens-outerwear'],
    ['accessories', 'Bags', 'bags'], ['accessories', 'Scarves', 'scarves'],
  ] as const
  const subcategories: Record<string, any> = {}
  for (let index = 0; index < subcategoryDefinitions.length; index += 1) {
    const [parentSlug, name, slug] = subcategoryDefinitions[index]!
    const bn = ({ 't-shirts': 'টি-শার্ট', shirts: 'শার্ট', trousers: 'ট্রাউজার', denim: 'ডেনিম', knitwear: 'নিটওয়্যার', jackets: 'জ্যাকেট', panjabi: 'পাঞ্জাবি', dresses: 'ড্রেস', blouses: 'ব্লাউজ', sarees: 'শাড়ি', 'womens-outerwear': 'নারীদের বাইরের পোশাক', bags: 'ব্যাগ', scarves: 'স্কার্ফ' } as Record<string, string>)[slug] || name
    subcategories[slug] = await upsert(Subcategory, { businessId, categoryId: categories[parentSlug]._id, slug }, { name, description: `${name} selected by Aster & Loom.`, translations: { en: { name, description: `${name} selected by Aster & Loom.` }, bn: { name: bn, description: `বাছাই করা ${bn} কালেকশন।` } }, sortOrder: index, status: 'active' })
  }

  const sourceImages = [
    'fashion-0.jpg', 'fashion-1.jpg', 'fashion-2.jpg', 'fashion-3.jpg',
    'fashion-4.jpg', 'fashion-5.jpg', 'fashion-6.jpg', 'fashion-7.jpg',
  ]
  const imageAlt = [
    'Tailored neutral look from the Aster & Loom collection', 'Modern fashion portrait in natural light', 'Everyday cotton essentials', 'Contemporary layered outfit',
    'Soft seasonal wardrobe styling', 'Relaxed shirt and tailored trousers', 'Textured outerwear styling', 'Accessories selected for everyday wear',
  ]
  const assets: any[] = []
  for (let index = 0; index < sourceImages.length; index += 1) {
    const filePath = path.join(assetDirectory, sourceImages[index]!)
    const buffer = await readFile(filePath)
    const result = await uploadOptimizedImage({ businessId, file: { buffer, size: buffer.length, mimetype: 'image/jpeg', originalname: sourceImages[index] } as Express.Multer.File, altText: imageAlt[index] })
    assets.push(result.asset)
  }
  for (let index = 0; index < categoryDefinitions.length; index += 1) {
    const definition = categoryDefinitions[index]!
    categories[definition.slug].imageUrl = imageSnapshot(assets[definition.imageIndex], `${definition.name} collection` ).url
    await categories[definition.slug].save()
  }

  type ProductSeed = { name: string; slug: string; subcategory: string; gender: 'men' | 'women' | 'unisex'; price: number; discount: number; colors: Array<{ name: string; code: string; image: number }>; description: string; material: string; brand: string; }
  const palette = [
    { name: 'Black', code: '#222222', image: 0 }, { name: 'Chalk', code: '#eee9df', image: 2 }, { name: 'Navy', code: '#24344d', image: 1 },
    { name: 'Olive', code: '#69705a', image: 4 }, { name: 'Sand', code: '#c7b69d', image: 5 }, { name: 'Oxblood', code: '#713a43', image: 6 },
    { name: 'Stone', code: '#aaa79e', image: 3 }, { name: 'Sage', code: '#a6b1a0', image: 7 },
  ]
  const seeds: ProductSeed[] = []
  const addSeries = (subcategory: string, gender: ProductSeed['gender'], price: number, names: string[], material: string, prefix: string) => names.forEach((name, index) => seeds.push({ name, slug: `${prefix}-${index + 1}`, subcategory, gender, price: price + (index % 3) * 8000, discount: index % 4 === 0 ? 15 : index % 7 === 0 ? 10 : 0, colors: [palette[index % palette.length]!, palette[(index + 3) % palette.length]!], material, brand: 'Aster & Loom', description: `${name} is designed around a clean silhouette, comfortable movement, and details that earn their place in a well-loved wardrobe. Made in ${material.toLowerCase()} with a considered finish.` }))
  addSeries('t-shirts', 'men', 69000, ['The Everyday Cotton Tee', 'Relaxed Heavyweight Tee', 'Ribbed Crew T-Shirt', 'Soft Structure Tee', 'The Weekend Tee', 'Mercerised Cotton Tee', 'Longline Essential Tee', 'Boxy Garment-Dyed Tee'], 'Organic cotton', 'everyday-tee')
  addSeries('shirts', 'men', 129000, ['Oxford Weekend Shirt', 'Linen Blend Camp Shirt', 'The Studio Poplin Shirt', 'Relaxed Chambray Shirt', 'Textured Resort Shirt', 'Easy-Care Cotton Shirt'], 'Cotton poplin', 'mens-shirt')
  addSeries('trousers', 'men', 159000, ['Pleated Everyday Trouser', 'Relaxed Tapered Chino', 'The Drawstring Trouser', 'Soft Twill Utility Pant', 'Tailored Travel Trouser'], 'Cotton twill', 'mens-trouser')
  addSeries('denim', 'men', 179000, ['Straight-Leg Selvedge Jean', 'Washed Indigo Denim', 'Relaxed Tapered Jean', 'Classic Five-Pocket Jean'], 'Cotton denim', 'mens-denim')
  addSeries('knitwear', 'men', 189000, ['Merino Blend Crewneck', 'Textured Cotton Hoodie', 'The Soft Loopback Hoodie'], 'Cotton and merino blend', 'mens-knit')
  addSeries('jackets', 'men', 249000, ['Lightweight Utility Jacket', 'The Modern Harrington', 'Unlined Canvas Overshirt'], 'Cotton canvas', 'mens-jacket')
  addSeries('panjabi', 'men', 219000, ['The Dhaka Panjabi', 'Cotton Jacquard Panjabi', 'Modern Collarless Panjabi'], 'Cotton jacquard', 'panjabi')
  addSeries('dresses', 'women', 189000, ['The Gathered Day Dress', 'Soft-Form Midi Dress', 'Linen Blend Shirt Dress', 'Easy Column Dress'], 'Linen blend', 'womens-dress')
  addSeries('blouses', 'women', 119000, ['Draped Studio Blouse', 'The Everyday Collar Blouse'], 'Viscose crepe', 'womens-blouse')
  addSeries('sarees', 'women', 329000, ['Handloom Cotton Saree', 'Evening Jacquard Saree'], 'Handloom cotton', 'womens-saree')
  addSeries('womens-outerwear', 'women', 269000, ['The Belted City Coat', 'Soft Tailored Blazer'], 'Wool blend', 'womens-outerwear')
  addSeries('bags', 'unisex', 149000, ['The Day-to-Day Canvas Tote'], 'Recycled cotton canvas', 'accessory-bag')
  addSeries('scarves', 'unisex', 79000, ['Lightweight Textured Scarf'], 'Cotton voile', 'accessory-scarf')

  const sizesFor = (subcategory: string) => ['bags', 'scarves'].includes(subcategory) ? ['ONE SIZE'] : ['S', 'M', 'L', 'XL', 'XXL']
  const products: any[] = []
  const variants: any[] = []
  const inventoryRows: any[] = []
  for (let index = 0; index < seeds.length; index += 1) {
    const seed = seeds[index]!
    const subcategory = subcategories[seed.subcategory]
    const category = categories[seed.gender === 'women' ? 'women' : seed.gender === 'unisex' ? 'accessories' : 'men']
    const productMedia = seed.colors.map((color, order) => ({ kind: 'image', ...imageSnapshot(assets[color.image], `${seed.name} in ${color.name}`), sortOrder: order }))
    const product = await upsert(Product, { businessId, slug: seed.slug }, {
      categoryId: category._id, subcategoryId: subcategory._id, name: seed.name, slug: seed.slug, sku: `AL-${String(index + 1).padStart(3, '0')}`,
      description: seed.description, shortDescription: `${seed.material} · considered everyday form`, brand: seed.brand, price: seed.price,
      discountPercent: seed.discount, costPrice: Math.round(seed.price * 0.42), material: seed.material, fabric: seed.material, gender: seed.gender,
      season: index % 2 ? 'Year-round' : 'Autumn / Winter', collection: index < 8 ? 'The Everyday Edit' : index < 20 ? 'Modern Essentials' : 'Quiet Forms',
      media: productMedia, tags: [seed.subcategory, seed.gender, 'aster-and-loom', 'new-season'], status: 'published', publishedAt: daysAgo(90 - (index % 70)),
      seo: { title: `${seed.name} | Aster & Loom`, description: seed.description.slice(0, 165) },
      translations: { en: { name: seed.name, slug: seed.slug, shortDescription: `${seed.material} · considered everyday form`, description: seed.description, seoTitle: `${seed.name} | Aster & Loom`, seoDescription: seed.description.slice(0, 165) }, bn: { name: bnProductName(seed.name), slug: seed.slug, shortDescription: `${seed.material} কাপড়ে তৈরি আরামদায়ক ${bnProductName(seed.name)}।`, description: `${bnProductName(seed.name)} তৈরি করা হয়েছে আরামদায়ক চলাচল, পরিপাটি কাট এবং প্রতিদিনের ব্যবহারের কথা ভেবে। যত্নশীল ফিনিশিংয়ে তৈরি এই পোশাকটি সহজেই আপনার দৈনন্দিন কালেকশনের সঙ্গে মানিয়ে যায়।`, seoTitle: `${bnProductName(seed.name)} | অ্যাস্টার অ্যান্ড লুম`, seoDescription: `আরামদায়ক কাট ও যত্নশীল ফিনিশিংয়ে তৈরি ${bnProductName(seed.name)} দেখুন।` } },
    })
    products.push(product)
    for (let colorIndex = 0; colorIndex < seed.colors.length; colorIndex += 1) {
      const color = seed.colors[colorIndex]!
      for (const size of sizesFor(seed.subcategory)) {
        const variantSku = `${product.sku}-${color.name.slice(0, 3).toUpperCase()}-${size.replace(/\s+/g, '')}`
        const variant = await upsert(ProductVariant, { businessId, sku: variantSku }, {
          productId: product._id, sku: variantSku, barcode: `ALBC-${variantSku}`, color: color.name, colorCode: color.code, size, price: seed.price + (size === 'XXL' ? 5000 : 0),
          compareAtPrice: seed.discount ? seed.price + 35000 : undefined, currency: 'BDT', isActive: true,
          attributes: { fit: seed.subcategory === 'dresses' ? 'Regular' : 'Relaxed', fabric: seed.material }, images: productImages(assets[color.image], `${seed.name} in ${color.name}`),
        })
        const stock = index === 3 && size === 'M' && colorIndex === 0 ? 0 : index % 11 === 0 && size === 'L' && colorIndex === 0 ? 2 : 12 + ((index * 7 + colorIndex * 9 + size.length * 3) % 35)
        const inventory = await upsert(Inventory, { businessId, variantId: variant._id, locationCode: 'DEFAULT' }, { onHand: stock, reserved: 0, reorderPoint: stock === 0 ? 5 : stock <= 3 ? 4 : 6, lastCountedAt: daysAgo(index % 15) })
        variants.push(variant)
        inventoryRows.push({ variant, inventory, stock, product, seed })
      }
    }
  }

  const addressRows: any[] = []
  for (let index = 0; index < customers.length; index += 1) {
    const customer = customers[index]!
    const address = await upsert(Address, { businessId, userId: customer._id, label: 'Demo home' }, {
      recipientName: customer.name, phone: customer.phone || '+880 0000 000000', line1: `Demo Avenue ${index + 1}`, line2: `Fictional Block ${String.fromCharCode(65 + index)}`,
      city: index % 3 === 0 ? 'Dhaka' : index % 3 === 1 ? 'Chattogram' : 'Sylhet', region: index % 2 ? 'Chattogram Division' : 'Dhaka Division', postalCode: `DEMO-${100 + index}`,
      countryCode: 'BD', deliveryInstructions: 'Fictional demo address; no real delivery.', isDefaultShipping: true, isDefaultBilling: true,
    })
    customer.addressIds = [address._id]
    await customer.save()
    addressRows.push(address)
  }

  const couponWelcome = await upsert(Coupon, { businessId, code: 'WELCOME10' }, { type: 'percent', value: 10, currency: 'BDT', minimumSubtotal: 50000, startsAt: daysAgo(2), endsAt: new Date(now.getTime() + 60 * 86_400_000), maxRedemptions: 1000, maxRedemptionsPerUser: 1, redemptionCount: 4, status: 'active' })
  const couponFashion = await upsert(Coupon, { businessId, code: 'FASHION20' }, { type: 'percent', value: 20, currency: 'BDT', minimumSubtotal: 100000, startsAt: daysAgo(120), endsAt: daysAgo(10), maxRedemptions: 500, maxRedemptionsPerUser: 1, redemptionCount: 33, status: 'inactive' })
  await upsert(Promotion, { businessId, title: 'The New Season Edit' }, { kind: 'discount_campaign', title: 'The New Season Edit', message: 'A considered selection, with 15% off selected pieces.', translations: { en: { title: 'The New Season Edit', message: 'A considered selection, with 15% off selected pieces.' }, bn: { title: 'নতুন মৌসুমের কালেকশন', message: 'নির্বাচিত পোশাকে বিশেষ ছাড় উপভোগ করুন।' } }, discountPercent: 15, placement: 'announcement', status: 'active', startsAt: daysAgo(1), endsAt: new Date(now.getTime() + 21 * 86_400_000), targetUrl: '/shop?sale=true', productIds: products.filter((_: any, index: number) => index % 4 === 0).slice(0, 8).map((product: any) => product._id), couponId: couponWelcome._id, createdBy: admin._id })
  await upsert(Promotion, { businessId, title: 'Archive Weekend' }, { kind: 'flash_sale', title: 'Archive Weekend', message: 'A previous seasonal promotion, retained in the campaign history.', translations: { en: { title: 'Archive Weekend', message: 'A previous seasonal promotion, retained in the campaign history.' }, bn: { title: 'মৌসুমি বিশেষ আয়োজন', message: 'আগের মৌসুমের বিশেষ ছাড়ের আয়োজন।' } }, discountPercent: 20, placement: 'collection', status: 'ended', startsAt: daysAgo(50), endsAt: daysAgo(45), targetUrl: '/shop', productIds: products.slice(10, 16).map((product: any) => product._id), createdBy: admin._id })
  await upsert(Promotion, { businessId, title: 'The Everyday Edit' }, { kind: 'featured_collection', title: 'The Everyday Edit', message: 'Pieces designed to return to.', translations: { en: { title: 'The Everyday Edit', message: 'Pieces designed to return to.' }, bn: { title: 'প্রতিদিনের পছন্দ', message: 'বারবার পরার উপযোগী পোশাক।' } }, collectionKey: 'the-everyday-edit', placement: 'hero', status: 'active', startsAt: daysAgo(5), endsAt: new Date(now.getTime() + 90 * 86_400_000), targetUrl: '/shop', productIds: products.slice(0, 8).map((product: any) => product._id), createdBy: admin._id })

  const orderStatuses = ['delivered', 'delivered', 'delivered', 'delivered', 'shipped', 'out_for_delivery', 'processing', 'packed', 'confirmed', 'pending', 'cancelled', 'returned', 'delivered', 'processing', 'delivered', 'out_for_delivery', 'cancelled', 'returned', 'shipped', 'delivered', 'pending', 'packed', 'returned', 'delivered']
  const ages = [3, 15, 45, 75, 1, 0, 2, 4, 5, 1, 18, 30, 90, 7, 14, 9, 60, 50, 3, 1, 0, 2, 80, 28]
  const orderIdsByCustomer = new Map<string, any[]>()
  const orderItemsForReviews: Array<{ order: any; item: any; product: any; user: any }> = []
  const orderShipments: any[] = []
  for (let index = 0; index < orderStatuses.length; index += 1) {
    const status = orderStatuses[index]!
    const user = customers[index % customers.length]!
    const createdAt = daysAgo(ages[index]!)
    const selectedProduct = products[(index * 5 + 2) % products.length]!
    const selectedSeed = seeds[(index * 5 + 2) % seeds.length]!
    const selectedVariants = variants.filter((variant: any) => String(variant.productId) === String(selectedProduct._id))
    const selectedVariant = selectedVariants[(index * 3) % selectedVariants.length]!
    const quantity = 1 + (index % 3)
    const unitPrice = Math.round(selectedVariant.price * (100 - selectedProduct.discountPercent) / 100)
    const lineSubtotal = unitPrice * quantity
    const coupon = index % 6 === 0 ? couponWelcome : null
    const discountTotal = coupon ? Math.round(lineSubtotal * 0.1) : 0
    const shippingTotal = index % 2 ? 12000 : 8000
    const grandTotal = lineSubtotal - discountTotal + shippingTotal
    const orderNumber = `AL-DEMO-${String(index + 1).padStart(5, '0')}`
    const address = addressRows[index % addressRows.length]!
    const snapshot = { recipientName: user.name, phone: user.phone, line1: address.line1, line2: address.line2, city: address.city, region: address.region, postalCode: address.postalCode, countryCode: 'BD', deliveryInstructions: 'Fictional demo address; no real delivery.' }
    const timelineStatuses = status === 'pending' ? ['pending'] : status === 'confirmed' ? ['pending', 'confirmed'] : status === 'cancelled' ? ['pending', 'confirmed', 'cancelled'] : status === 'returned' ? ['pending', 'confirmed', 'processing', 'packed', 'shipped', 'delivered', 'returned'] : status === 'delivered' ? ['pending', 'confirmed', 'processing', 'packed', 'shipped', 'delivered'] : status === 'out_for_delivery' ? ['pending', 'confirmed', 'processing', 'packed', 'shipped', 'out_for_delivery'] : status === 'shipped' ? ['pending', 'confirmed', 'processing', 'packed', 'shipped'] : ['pending', 'confirmed', ...(['processing', 'packed'].includes(status) ? ['processing', ...(status === 'packed' ? ['packed'] : [])] : [])]
    const timeline = timelineStatuses.map((timelineStatus, step) => ({ status: timelineStatus, note: `DEMO RECORD — simulated ${timelineStatus.replaceAll('_', ' ')} event; no real payment or courier action occurred.`, actorUserId: step === 0 ? user._id : admin._id, occurredAt: new Date(createdAt.getTime() + step * 3_600_000) }))
    const returnState = status === 'returned' ? 'received' : index === 15 ? 'requested' : index === 7 ? 'approved' : undefined
    const order = await upsert(Order, { businessId, orderNumber }, {
      userId: user._id, customer: { name: user.name, email: user.email, phone: user.phone }, status, currency: 'BDT', subtotal: lineSubtotal, discountTotal, shippingTotal, taxTotal: 0, grandTotal,
      deliveryOptionCode: index % 2 ? 'nationwide' : 'dhaka', deliveryOptionLabel: index % 2 ? 'Nationwide delivery' : 'Inside Dhaka', couponId: coupon?._id, couponCodeSnapshot: coupon?.code,
      shippingAddress: snapshot, billingAddress: snapshot, placedAt: createdAt, cancelledAt: status === 'cancelled' ? createdAt : undefined,
      returnRequest: returnState ? { status: returnState, reason: returnState === 'received' ? 'The fit was not quite right.' : 'Requesting a size exchange.', requestedAt: new Date(createdAt.getTime() + 86_400_000), resolvedAt: returnState === 'received' || returnState === 'approved' ? new Date(createdAt.getTime() + 3 * 86_400_000) : undefined, resolutionNote: returnState === 'received' ? 'Demo return received and restocked.' : undefined } : undefined,
      refundReference: status === 'returned' ? `DEMO-REFUND-${index + 1}` : undefined, refundedAt: status === 'returned' ? new Date(createdAt.getTime() + 5 * 86_400_000) : undefined,
      notes: 'DEMO ORDER — simulated history for browser demonstration. No customer delivery or payment was made.', timeline,
      createdAt,
    })
    const item = await upsert(OrderItem, { businessId, orderId: order._id, variantId: selectedVariant._id }, {
      productId: selectedProduct._id, variantId: selectedVariant._id, productNameSnapshot: selectedProduct.name, skuSnapshot: selectedVariant.sku,
      attributesSnapshot: { color: selectedVariant.color, size: selectedVariant.size }, unitPrice, costPriceSnapshot: selectedProduct.costPrice, quantity,
      discountAmount: 0, taxAmount: 0, lineTotal: lineSubtotal, createdAt,
    })
    const paymentMethod = index % 3 === 0 ? 'bkash' : index % 3 === 1 ? 'nagad' : 'cash_on_delivery'
    const paymentStatus = status === 'cancelled' ? 'cancelled' : status === 'returned' ? 'refunded' : status === 'delivered' ? 'captured' : paymentMethod === 'cash_on_delivery' ? 'created' : 'requires_action'
    const payment = await upsert(Payment, { businessId, orderId: order._id }, {
      provider: paymentMethod, amount: grandTotal, currency: 'BDT', status: paymentStatus,
      providerReference: `DEMO-${paymentMethod.toUpperCase()}-${String(index + 1).padStart(4, '0')}`,
      customerReference: paymentMethod === 'cash_on_delivery' ? undefined : `SIM-${String(index + 1).padStart(5, '0')}`,
      publicInstructions: paymentMethod === 'cash_on_delivery' ? undefined : 'SIMULATED DEMO PAYMENT. This transaction ID is fictitious. Do not send money.',
      idempotencyKey: `aster-demo-payment-${index + 1}`, verifiedAt: paymentStatus === 'captured' ? new Date(createdAt.getTime() + 2 * 3_600_000) : undefined,
      refundedAt: paymentStatus === 'refunded' ? new Date(createdAt.getTime() + 5 * 86_400_000) : undefined,
      refundReference: paymentStatus === 'refunded' ? `DEMO-REFUND-${index + 1}` : undefined,
      createdAt,
    })
    order.paymentId = payment._id
    await order.save()
    orderItemsForReviews.push({ order, item, product: selectedProduct, user })
    orderIdsByCustomer.set(String(user._id), [...(orderIdsByCustomer.get(String(user._id)) || []), order])

    if (['shipped', 'out_for_delivery', 'delivered', 'returned'].includes(status)) {
      const provider = ['steadfast', 'pathao', 'redx'][index % 3]!
      const shipmentStatus = status === 'delivered' || status === 'returned' ? 'delivered' : status === 'shipped' ? 'in_transit' : 'in_transit'
      const events = timelineStatuses.filter((entry) => ['shipped', 'out_for_delivery', 'delivered'].includes(entry)).map((entry, step) => ({ code: `demo_${entry}`, description: `DEMO / SIMULATED SHIPMENT — ${entry.replaceAll('_', ' ')}; no courier API was called.`, occurredAt: new Date(createdAt.getTime() + (step + 1) * 3_600_000), location: step === 0 ? 'Demo fulfillment desk' : 'Simulated route' }))
      const shipment = await upsert(Shipment, { businessId, orderId: order._id }, {
        idempotencyKey: `aster-demo-shipment-${index + 1}`,
        provider, trackingMode: 'simulated', shipmentId: `DEMO-${provider.toUpperCase()}-${String(index + 1).padStart(5, '0')}`, consignmentId: `SIM-${String(index + 1).padStart(5, '0')}`,
        status: shipmentStatus, trackingNumber: `DEMO-${provider.slice(0, 3).toUpperCase()}-${String(index + 1).padStart(6, '0')}`,
        trackingUrl: `http://localhost:5173/tracking/${order.orderNumber}`, shippingCost: shippingTotal, currency: 'BDT', events,
        bookedAt: new Date(createdAt.getTime() + 3_600_000), deliveredAt: shipmentStatus === 'delivered' ? new Date(createdAt.getTime() + 3 * 86_400_000) : undefined,
        lastErrorCode: 'DEMO_SIMULATED', createdAt,
        ...(status === 'returned' ? { returnShipment: { provider, status: 'returned', trackingNumber: `DEMO-RETURN-${String(index + 1).padStart(5, '0')}`, limitation: 'Simulated return shipment; no courier API was called.', events: [{ code: 'demo_returned', description: 'DEMO / SIMULATED — return received by the store.', occurredAt: new Date(createdAt.getTime() + 6 * 86_400_000), location: 'Demo fulfillment desk' }] } } : {}),
      })
      order.shipmentId = shipment._id
      await order.save()
      orderShipments.push(shipment)
    }
  }

  for (const entry of orderItemsForReviews.filter(({ order }) => order.status === 'delivered').slice(0, 5)) {
    await upsert(Review, { businessId, orderItemId: entry.item._id }, { productId: entry.product._id, userId: entry.user._id, orderItemId: entry.item._id, rating: 5 - (entry.order.orderNumber.endsWith('2') ? 1 : 0), title: 'A piece I reach for', body: 'The fabric feels comfortable, and the proportions work beautifully for everyday wear.', status: 'published', verifiedPurchase: true, moderatedAt: now, createdAt: entry.order.createdAt })
  }

  for (const row of inventoryRows) {
    if (row.stock > 0) await upsert(InventoryTransaction, { businessId, idempotencyKey: `aster-demo-receipt-${row.variant.sku}` }, { inventoryId: row.inventory._id, variantId: row.variant._id, type: 'receipt', quantityDelta: row.stock, reason: 'DEMO stock receipt for opening inventory', sourceType: 'purchase_order', sourceId: row.product._id, actorUserId: admin._id, createdAt: daysAgo(35) })
    else {
      await upsert(InventoryTransaction, { businessId, idempotencyKey: `aster-demo-receipt-${row.variant.sku}` }, { inventoryId: row.inventory._id, variantId: row.variant._id, type: 'receipt', quantityDelta: 8, reason: 'DEMO opening stock receipt', sourceType: 'purchase_order', sourceId: row.product._id, actorUserId: admin._id, createdAt: daysAgo(35) })
      await upsert(InventoryTransaction, { businessId, idempotencyKey: `aster-demo-count-${row.variant.sku}` }, { inventoryId: row.inventory._id, variantId: row.variant._id, type: 'adjustment', quantityDelta: -8, reason: 'DEMO cycle count marked this option out of stock', sourceType: 'manual', actorUserId: admin._id, createdAt: daysAgo(1) })
    }
  }
  for (const entry of orderItemsForReviews.filter(({ order }) => ['delivered', 'returned', 'cancelled'].includes(order.status)).slice(0, 30)) {
    await upsert(InventoryTransaction, { businessId, idempotencyKey: `aster-demo-sale-${entry.order.orderNumber}` }, { inventoryId: inventoryRows.find((row) => String(row.variant._id) === String(entry.item.variantId))!.inventory._id, variantId: entry.item.variantId, type: entry.order.status === 'returned' ? 'return' : entry.order.status === 'cancelled' ? 'release' : 'sale', quantityDelta: entry.order.status === 'returned' ? entry.item.quantity : -entry.item.quantity, reason: `DEMO order history ${entry.order.orderNumber}`, sourceType: entry.order.status === 'returned' ? 'return' : 'order', sourceId: entry.order._id, actorUserId: admin._id, createdAt: entry.order.createdAt })
  }

  const purchasedProductIds = [...new Map(orderItemsForReviews.map(({ product }) => [String(product._id), product])).values()].map((product: any) => product._id)
  await upsert(Wishlist, { businessId, userId: primaryCustomer._id }, { productIds: products.slice(0, 4).map((product: any) => product._id) })
  const cartVariants = variants.filter((variant: any) => String(variant.productId) === String(products[5]._id)).slice(0, 2)
  await upsert(Cart, { businessId, userId: primaryCustomer._id }, { items: cartVariants.map((variant: any) => ({ variantId: variant._id, quantity: 1 })), expiresAt: new Date(now.getTime() + 30 * 86_400_000), revision: 1 })
  for (const product of products.slice(0, 10)) await upsert(ProductViewDaily, { businessId, productId: product._id, day: daysAgo(1) }, { views: 42 + products.indexOf(product) * 7 })
  const latestOrder = orderIdsByCustomer.get(String(primaryCustomer._id))?.[0]
  if (latestOrder) {
    await upsert(Notification, { businessId, userId: primaryCustomer._id, templateKey: 'demo_order_update' }, { channel: 'in_app', type: 'order_update', templateKey: 'demo_order_update', payload: { title: 'Your order is on its way', body: `Demo order ${latestOrder.orderNumber} has a simulated tracking timeline.`, orderNumber: latestOrder.orderNumber }, status: 'sent', sentAt: now })
    await upsert(Notification, { businessId, userId: primaryCustomer._id, templateKey: 'demo_welcome' }, { channel: 'in_app', type: 'welcome', templateKey: 'demo_welcome', payload: { title: 'Welcome to Aster & Loom', body: 'Your demo profile and saved pieces are ready.' }, status: 'sent', sentAt: now })
  }

  const theme = await upsert(Theme, { businessId, version: 1 }, {
    name: 'Aster & Loom — Warm Editorial', preset: 'elegant', status: 'published', version: 1,
    colors: { primary: '#1c1c1a', secondary: '#716e67', accent: '#9c5742', background: '#f5f3ef', surface: '#fffefa', text: '#22211f', mutedText: '#706c66', border: '#dedbd4', success: '#41634c', warning: '#91601f', error: '#a4423c' },
    typography: { displayFont: 'editorial', bodyFont: 'sans' },
    components: { buttonStyle: 'solid', cardStyle: 'minimal', headerStyle: 'editorial', footerStyle: 'editorial', radius: 'soft', spacing: 'comfortable', backgroundStyle: 'warm' },
    publishedAt: now, createdBy: admin._id,
  })
  await upsert(WebsiteSettings, { businessId }, {
    displayName: 'Aster & Loom', faviconUrl: '', logoUrl: '',
    contact: { email: 'hello@asterandloom.example.test', phone: '+880 0000 000000', address: 'Demo Studio, Fictional Avenue, Dhaka, Bangladesh' },
    socialLinks: [{ platform: 'Instagram', url: 'https://www.instagram.com/' }, { platform: 'Pinterest', url: 'https://www.pinterest.com/' }],
    seo: { title: 'Aster & Loom — Considered Clothing for Everyday Life', description: 'Thoughtful form, natural texture, and clothing designed to be worn often.', defaultImageUrl: imageSnapshot(assets[0], imageAlt[0]!).url },
    locale: 'en-BD', defaultLanguage: 'en', enabledLocales: ['en', 'bn'], currency: 'BDT', defaultThemeId: theme._id,
    paymentProviders: [{ provider: 'cash_on_delivery', enabled: true, publicConfig: {} }, { provider: 'bkash', enabled: true, publicConfig: { demo: 'true' } }, { provider: 'nagad', enabled: true, publicConfig: { demo: 'true' } }],
    courierProviders: [{ provider: 'steadfast', enabled: false }, { provider: 'pathao', enabled: false }, { provider: 'redx', enabled: false }],
    mediaOptimization: { enabled: true, quality: 88, maxWidth: 2000, maxHeight: 2000, preferredFormat: 'webp', generateThumbnails: true, generateResponsiveSizes: true, keepOriginal: false, deleteUnusedImages: false, lazyLoading: true },
  })
  await upsert(CourierConfiguration, { businessId }, { defaultProvider: undefined, providers: ['steadfast', 'pathao', 'redx'].map((provider) => ({ provider, enabled: false, mode: 'sandbox', status: 'configuration_required', merchant: { storeName: 'Aster & Loom DEMO', contactName: 'Demo Operations' }, pickup: { name: 'Demo Fulfillment Desk', address: 'Fictional Demo Avenue, Dhaka', city: 'Dhaka' } })) })

  const pageSections = [
    { type: 'hero', title: 'A new perspective on essentials', content: { eyebrow: 'Aster & Loom · New season', headline: 'Wear what stays with you.', body: 'Thoughtful form. Natural texture. A wardrobe made to move through life with ease.', imageUrl: imageSnapshot(assets[0], imageAlt[0]!).url, imageAlt: imageAlt[0]!, buttonLabel: 'Discover the collection', buttonUrl: '/shop' } },
    { type: 'categories', title: 'Considered collections', content: { eyebrow: 'Find your form', title: 'Considered collections', body: 'Explore pieces shaped around the way you move.', categoryIds: [categories.men._id, categories.women._id, categories.accessories._id] } },
    { type: 'product_grid', title: 'Pieces to return to', content: { eyebrow: 'Just arrived', title: 'Pieces to return to.', body: 'New season pieces, chosen with care.', productIds: products.slice(0, 8).map((product: any) => product._id), limit: 8 } },
    { type: 'image_text', title: 'The considered edit', content: { eyebrow: 'Fewer pieces, more possibility', headline: 'Less, with more meaning.', body: 'We believe the best wardrobe is built slowly. Fewer pieces, chosen with care, made to become part of your everyday.', imageUrl: imageSnapshot(assets[1], imageAlt[1]!).url, imageAlt: imageAlt[1]!, buttonLabel: 'Read our approach', buttonUrl: '/about' } },
    { type: 'product_grid', title: 'The everyday edit', content: { eyebrow: 'The everyday edit', title: 'Modern essentials.', body: 'Easy to wear, considered in detail.', categoryId: categories.men._id, limit: 8 } },
    { type: 'promotion_banner', title: 'A considered welcome', content: { eyebrow: 'A little something', headline: 'A considered welcome.', body: 'Use WELCOME10 for 10% off your first demo order. No payment is collected.', buttonLabel: 'Explore the edit', buttonUrl: '/shop', backgroundColor: '#e8e1d8' } },
    { type: 'testimonials', title: 'Worn, loved, returned to', content: { eyebrow: 'Demo customer notes', title: 'A few words from the fitting room.', items: [{ title: 'Mira · Demo customer', body: 'The shirt has a lovely hand-feel and an easy shape I can wear all week.' }, { title: 'Tariq · Demo customer', body: 'A thoughtful fit and fabric. It feels like a piece I will keep reaching for.' }, { title: 'Nila · Demo customer', body: 'Beautifully simple, and the size guide made choosing easy.' }] } },
    { type: 'newsletter', title: 'A considered note', content: { eyebrow: 'The studio letter', title: 'Thoughtful things, occasionally.', body: 'New collections, material stories, and studio notes.', buttonLabel: 'Join the list' } },
  ]
  for (let index = 0; index < pageSections.length; index += 1) {
    const section = pageSections[index]!
    const bnCopy: Record<string, Record<string, string>> = {
      hero: { eyebrow: 'নতুন কালেকশন', headline: 'পোশাকের নিজস্ব ভাষায়, নিজের মতো করে', body: 'প্রতিদিনের জীবনের জন্য যত্নে বেছে নেওয়া পোশাক। স্বাচ্ছন্দ্য, কাপড় ও নকশায় থাকুক আপনার নিজস্বতা।', buttonLabel: 'কালেকশন দেখুন' },
      categories: { eyebrow: 'আপনার পছন্দের ধরন খুঁজুন', title: 'যত্নে বাছাই করা কালেকশন', body: 'আপনার দৈনন্দিন চলাফেরার কথা ভেবে তৈরি পোশাক দেখুন।' },
      product_grid: { eyebrow: 'নতুন এসেছে', title: 'বারবার পরার মতো পোশাক', body: 'নতুন মৌসুমের যত্নে বাছাই করা পোশাক।' },
      image_text: { eyebrow: 'কম পোশাকে বেশি সম্ভাবনা', headline: 'কম, তবে অর্থবহ।', body: 'যত্নে বেছে নেওয়া পোশাকেই গড়ে উঠুক আপনার প্রতিদিনের কালেকশন।', buttonLabel: 'আমাদের কথা জানুন' },
      promotion_banner: { eyebrow: 'ছোট্ট উপহার', headline: 'নতুন কালেকশনে স্বাগতম।', body: 'প্রথম ডেমো অর্ডারে ১০% ছাড় পেতে WELCOME10 ব্যবহার করুন। কোনো পেমেন্ট নেওয়া হবে না।', buttonLabel: 'কালেকশন দেখুন' },
      testimonials: { eyebrow: 'ডেমো ক্রেতাদের কথা', title: 'ক্রেতাদের ভালো লাগার গল্প।' },
      newsletter: { eyebrow: 'স্টুডিওর চিঠি', title: 'মাঝেমধ্যে কিছু সুন্দর খবর।', body: 'নতুন কালেকশন, কাপড়ের গল্প ও স্টুডিওর খবর।', buttonLabel: 'যুক্ত হোন' },
    }
    const bnContent = { ...section.content, ...bnCopy[section.type] }
    await upsert(HomepageSection, { businessId, pageKey: 'home', type: section.type, sortOrder: index }, { title: section.title, content: section.content, translations: { en: { title: section.title, content: section.content }, bn: { title: bnCopy[section.type]?.title || bnProductName(section.title), content: bnContent } }, visible: true, sortOrder: index, publishedAt: now })
  }
  for (const page of [
    { slug: 'about', pageKey: 'about', title: 'Made to become part of your everyday.', summary: 'Thoughtful pieces, chosen for the way you live.', body: 'Aster & Loom is a fictional independent clothing house for this interactive product demo.\n\nWe believe getting dressed should feel thoughtful and uncomplicated. Each collection balances easy silhouettes, natural texture, and details designed to last beyond a season.\n\nEvery customer, order, review, shipment, address, and payment reference in this environment is synthetic demonstration data.' },
    { slug: 'contact', pageKey: 'contact', title: 'We are here to help.', summary: 'Demo support details for exploring the customer experience.', body: 'This is a demo storefront. No message or order will be sent to a real business.\n\nEmail: hello@asterandloom.example.test\nPhone: +880 0000 000000\nStudio: Fictional Demo Avenue, Dhaka, Bangladesh' },
    { slug: 'faq', pageKey: 'faq', title: 'A few useful answers.', summary: 'Helpful information for your Aster & Loom demo.', body: '', faqs: [{ question: 'Are these products available to buy?', answer: 'No. The products, prices, account details, and orders are simulated records for exploring the demo.' }, { question: 'Will a payment be collected?', answer: 'No. bKash and Nagad references are simulated. Do not send money.' }, { question: 'Are courier tracking updates real?', answer: 'No. Tracking numbers and events are labeled DEMO / SIMULATED and are not sent to courier providers.' }, { question: 'How can I sign in?', answer: 'Use the demo customer credentials supplied with the project setup report.' }] },
    { slug: 'privacy', pageKey: 'privacy', title: 'Privacy in the demo.', summary: 'Synthetic demo data only.', body: 'This local demo uses fictional accounts, names, addresses, and order records. Do not enter real personal, payment, or contact information. No external payment or courier request is performed by the demo.' },
    { slug: 'terms', pageKey: 'terms', title: 'Demo terms of use.', summary: 'A non-transactional interactive preview.', body: 'This application is supplied as a software demonstration. Products are fictional, prices are illustrative, and no purchase, payment, shipment, or delivery will occur.' },
    { slug: 'returns', pageKey: 'returns', title: 'Returns and exchanges.', summary: 'Explore the simulated return workflow.', body: 'Return requests and their status history are simulated examples. They do not arrange a pickup or initiate a refund.' },
    { slug: 'shipping', pageKey: 'shipping', title: 'Shipping information.', summary: 'Explore delivery options and simulated tracking.', body: 'Delivery options and tracking events are demo data. No parcel will be shipped.' },
  ]) await upsert(ContentPage, { businessId, pageKey: page.pageKey }, { ...page, status: 'published', publishedAt: now, seo: { title: `${page.title} | Aster & Loom`, description: page.summary } })

  for (const landing of [
    { slug: 'summer-sale', title: 'The Summer Edit', summary: 'A lighter wardrobe for longer days.', seo: { title: 'The Summer Edit | Aster & Loom', description: 'Explore the Aster & Loom summer collection.' } },
    { slug: 'new-arrivals', title: 'New Arrivals', summary: 'Fresh forms, thoughtfully chosen.', seo: { title: 'New Arrivals | Aster & Loom', description: 'Discover the latest Aster & Loom pieces.' } },
    { slug: 'men', title: 'Menswear, considered.', summary: 'Everyday pieces with a relaxed point of view.', seo: { title: 'Menswear | Aster & Loom', description: 'Explore considered menswear from Aster & Loom.' } },
    { slug: 'women', title: 'Womenswear, considered.', summary: 'Easy shapes, thoughtful detail.', seo: { title: 'Womenswear | Aster & Loom', description: 'Explore considered womenswear from Aster & Loom.' } },
  ]) {
    await upsert(LandingPage, { businessId, slug: landing.slug }, { ...landing, translations: { en: { title: landing.title, summary: landing.summary, seoTitle: landing.seo.title, seoDescription: landing.seo.description }, bn: { title: bnProductName(landing.title), summary: 'যত্নে বেছে নেওয়া নতুন কালেকশন থেকে আপনার পছন্দ খুঁজে নিন।', seoTitle: `${bnProductName(landing.title)} | অ্যাস্টার অ্যান্ড লুম`, seoDescription: 'প্রতিদিনের জন্য আরামদায়ক পোশাকের কালেকশন দেখুন।' } }, status: 'published', publishedAt: now })
    const category = landing.slug === 'men' ? categories.men : landing.slug === 'women' ? categories.women : undefined
    const sectionSeed = landing.slug === 'summer-sale'
      ? { type: 'hero', title: landing.title, content: { eyebrow: 'Aster & Loom · Seasonal edit', headline: landing.title, body: landing.summary, imageUrl: imageSnapshot(assets[4], imageAlt[4]!).url, buttonLabel: 'Shop the edit', buttonUrl: '/shop' } }
      : { type: 'product_grid', title: landing.title, content: { eyebrow: 'Selected for you', title: landing.title, body: landing.summary, ...(category ? { categoryId: category._id } : { productIds: products.slice(0, 8).map((product: any) => product._id) }), limit: 8 } }
    await upsert(HomepageSection, { businessId, pageKey: landing.slug, type: sectionSeed.type, sortOrder: 0 }, { title: sectionSeed.title, content: sectionSeed.content, translations: { en: { title: sectionSeed.title, content: sectionSeed.content }, bn: { title: bnProductName(sectionSeed.title || landing.title), content: { ...sectionSeed.content, headline: `নতুন কালেকশন থেকে ${bnProductName(landing.title)} বেছে নিন`, title: bnProductName(landing.title), eyebrow: 'অ্যাস্টার অ্যান্ড লুম · মৌসুমি কালেকশন', body: 'প্রতিদিনের জন্য যত্নে বেছে নেওয়া পোশাক দেখুন।', buttonLabel: 'কালেকশন দেখুন' } } }, visible: true, sortOrder: 0, publishedAt: now })
  }

  console.log(JSON.stringify({
    business: { name: business.name, slug: business.slug, database: dbName },
    admin: { email: admin.email, role: admin.role }, customer: { email: primaryCustomer.email, role: primaryCustomer.role },
    products: products.length, variants: variants.length, customers: customers.length, orders: orderStatuses.length, shipments: orderShipments.length,
    returns: orderStatuses.filter((status) => status === 'returned').length + 2, optimizedImages: assets.length,
    categories: Object.keys(categories).length, coupons: [couponWelcome.code, couponFashion.code], homepageSections: pageSections.length,
    simulatedPaymentsAndShipments: true,
  }, null, 2))
  await mongoose.disconnect()
}

main().catch(async (error: unknown) => {
  console.error('Demo seed failed:', error)
  await mongoose.disconnect().catch(() => undefined)
  process.exitCode = 1
})
