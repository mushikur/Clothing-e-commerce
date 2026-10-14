import mongoose from 'mongoose'
import { businessField, modelFor, schemaOptions } from './common.js'
const { Schema } = mongoose

const homepageSectionSchema = new Schema({
  businessId: businessField,
  pageKey: { type: String, default: 'home', lowercase: true, trim: true, maxlength: 80, match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ },
  type: { type: String, enum: ['hero', 'banner', 'product_grid', 'product_carousel', 'categories', 'collections', 'lookbook', 'image_text', 'video', 'testimonials', 'reviews', 'instagram', 'newsletter', 'cta', 'custom_content', 'editorial', 'product_collection', 'promotion_banner', 'rich_text'], required: true },
  title: { type: String, trim: true, maxlength: 180 },
  translations: { en: { title: { type: String, trim: true, maxlength: 180 }, content: { type: Map, of: Schema.Types.Mixed, default: {} } }, bn: { title: { type: String, trim: true, maxlength: 180 }, content: { type: Map, of: Schema.Types.Mixed, default: {} } } },
  content: { type: Map, of: Schema.Types.Mixed, default: {} },
  sortOrder: { type: Number, min: 0, default: 0 },
  visible: { type: Boolean, default: true },
  startsAt: { type: Date },
  endsAt: { type: Date },
  publishedAt: { type: Date },
}, { ...schemaOptions })

homepageSectionSchema.pre('validate', function () {
  const requiredKeys: Record<string, string[]> = {
    hero: ['headline', 'imageUrl'],
    banner: ['headline'],
    product_grid: ['title'],
    product_carousel: ['title'],
    categories: ['title'],
    collections: ['title'],
    lookbook: ['headline', 'imageUrl'],
    image_text: ['headline'],
    video: ['videoUrl'],
    testimonials: ['title'],
    reviews: ['title'],
    instagram: ['title'],
    newsletter: ['title'],
    cta: ['headline'],
    custom_content: ['body'],
    editorial: ['headline', 'body'],
    product_collection: [],
    promotion_banner: ['headline'],
    rich_text: ['body'],
  }
  const required = requiredKeys[this.type] ?? []
  const content = this.content as Map<string, unknown> | undefined
  for (const key of required) {
    if (!content?.get(key)) this.invalidate(`content.${key}`, `Content key ${key} is required for ${this.type} sections`)
  }
  if (['product_collection', 'product_grid', 'product_carousel', 'categories', 'collections'].includes(this.type) && !content?.get('categoryId') && !content?.get('categoryIds') && !content?.get('productIds') && !content?.get('collectionKey')) {
    this.invalidate('content', 'A product collection needs a categoryId or productIds')
  }
})
homepageSectionSchema.index({ businessId: 1, pageKey: 1, visible: 1, sortOrder: 1 })
export const HomepageSection = modelFor('HomepageSection', homepageSectionSchema)
