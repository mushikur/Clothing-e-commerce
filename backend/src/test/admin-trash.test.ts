import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assertOrderCanBeDeleted } from '../modules/admin/trash.controller.js'
import { trashActionSchema, trashListSchema } from '../modules/admin/trash.validators.js'
test('delete validates kinds, IDs, pagination and empty request bodies', () => {
  assert.equal(trashActionSchema.safeParse({ body:{}, query:{}, params:{kind:'order',key:'6ace1a76a0e80bba6ff528f0'} }).success,true)
  assert.equal(trashActionSchema.safeParse({ body:{}, query:{}, params:{kind:'customer',key:'+8800000000000'} }).success,true)
  for (const params of [{kind:'user',key:'admin'},{kind:'order',key:'invalid'},{kind:'product',key:{$ne:null}}]) assert.equal(trashActionSchema.safeParse({body:{},query:{},params}).success,false)
  assert.equal(trashActionSchema.safeParse({body:{businessId:'other'},query:{},params:{kind:'customer',key:'guest@example.test'}}).success,false)
  assert.equal(trashListSchema.safeParse({body:{},params:{},query:{kind:'order',limit:500}}).success,false)
})
test('open orders and unresolved returns cannot be deleted', () => {
  for(const status of ['pending','confirmed','processing','packed','shipped','out_for_delivery']) assert.throws(()=>assertOrderCanBeDeleted({status}),/Cancel or complete/)
  for(const status of ['requested','approved']) assert.throws(()=>assertOrderCanBeDeleted({status:'delivered',returnRequest:{status}}),/Resolve the return/)
  for(const status of ['cancelled','delivered','returned','refunded']) assert.doesNotThrow(()=>assertOrderCanBeDeleted({status}))
})
