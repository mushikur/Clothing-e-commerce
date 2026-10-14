import { connectDatabase, disconnectDatabase } from '../config/database.js'
import { Payment } from '../models/Payment.js'

const indexName = 'businessId_1_provider_1_providerReference_1'

try {
  await connectDatabase()
  const indexes = await Payment.collection.indexes()
  const existing = indexes.find((index) => index.name === indexName)
  const hasExpectedFilter = existing?.partialFilterExpression?.providerReference?.$type === 'string'

  if (existing && !hasExpectedFilter) {
    await Payment.collection.dropIndex(indexName)
    console.info(`Removed legacy payment reference index ${indexName}`)
  }

  await Payment.collection.createIndex(
    { businessId: 1, provider: 1, providerReference: 1 },
    { name: indexName, unique: true, partialFilterExpression: { providerReference: { $type: 'string' } } },
  )
  console.info(`Payment reference index is ready in ${Payment.db.name}`)
} finally {
  await disconnectDatabase()
}
