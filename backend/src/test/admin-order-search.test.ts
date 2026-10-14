import assert from 'node:assert/strict'
import { test } from 'node:test'
import { orderAdminListSchema } from '../modules/orders/orders.validators.js'
const input=(query:object)=>({body:{},params:{},query})
test('admin order list validates search, date, courier and payment filters',()=>{
 const result=orderAdminListSchema.parse(input({q:'  ORD-[demo]  ',payment:'bkash',courier:'steadfast',from:'2026-10-01T00:00:00Z',to:'2026-10-13T23:59:59Z',page:'2',limit:'12'}))
 assert.equal(result.query.q,'ORD-[demo]');assert.equal(result.query.page,2);assert.equal(result.query.limit,12);assert.ok(result.query.from instanceof Date)
})
test('admin order list rejects malformed filters and injection objects',()=>{
 for(const query of [{q:{$ne:null}},{limit:1000},{payment:'unknown'},{courier:'$where'},{from:'not-a-date'},{q:'x'.repeat(101)}])assert.equal(orderAdminListSchema.safeParse(input(query)).success,false)
})
test('admin order list rejects reversed date range',()=>{
 assert.equal(orderAdminListSchema.safeParse(input({from:'2026-10-13',to:'2026-10-01'})).success,false)
})
