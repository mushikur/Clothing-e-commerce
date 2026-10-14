import { z } from 'zod'
export const trashActionSchema = z.object({
  body: z.object({}).strict(), query: z.object({}).strict(),
  params: z.object({ kind: z.enum(['order', 'customer', 'product']), key: z.string().min(1).max(320).refine(key => !key.includes('\0'), 'Invalid record') }).strict(),
}).strict().refine(value => value.params.kind === 'customer' || /^[a-f\d]{24}$/i.test(value.params.key), 'Invalid record ID')
export const trashListSchema = z.object({
  body: z.object({}).strict(), params: z.object({}).strict(),
  query: z.object({ kind: z.enum(['order', 'customer', 'product']), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(50).default(20) }).strict(),
}).strict()
