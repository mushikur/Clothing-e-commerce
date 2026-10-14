import { CourierDocumentationRequiredError, type CourierCapabilities, type CourierOperation, type CourierProvider, type CourierProviderId } from './courier-provider.js'

const operations: CourierOperation[] = ['createShipment', 'getShipmentStatus', 'getTracking', 'cancelShipment', 'createReturn', 'getReturnStatus', 'getDeliveryHistory']
const capabilitySet = (): CourierCapabilities => Object.fromEntries(operations.map((operation) => [operation, { supported: false, verification: 'documentation_required', reason: 'The current official merchant API endpoint and contract are not available in public documentation.' }])) as CourierCapabilities

abstract class DocumentationRequiredProvider implements CourierProvider {
  abstract readonly id: CourierProviderId
  abstract readonly label: string
  readonly capabilities = capabilitySet()
  protected unavailable(operation: CourierOperation): never { throw new CourierDocumentationRequiredError(this.id, operation) }
  async createShipment() { return this.unavailable('createShipment') }
  async getShipmentStatus() { return this.unavailable('getShipmentStatus') }
  async getTracking() { return this.unavailable('getTracking') }
  async cancelShipment() { return this.unavailable('cancelShipment') }
  async createReturn() { return this.unavailable('createReturn') }
  async getReturnStatus() { return this.unavailable('getReturnStatus') }
  async getDeliveryHistory() { return this.unavailable('getDeliveryHistory') }
  async testConnection() { return this.unavailable('getShipmentStatus') }
}
export class SteadfastCourierProvider extends DocumentationRequiredProvider { readonly id = 'steadfast' as const; readonly label = 'Steadfast' }
export class PathaoCourierProvider extends DocumentationRequiredProvider { readonly id = 'pathao' as const; readonly label = 'Pathao' }
export class RedXCourierProvider extends DocumentationRequiredProvider { readonly id = 'redx' as const; readonly label = 'RedX' }
const providers: Record<CourierProviderId, CourierProvider> = { steadfast: new SteadfastCourierProvider(), pathao: new PathaoCourierProvider(), redx: new RedXCourierProvider() }
export function courierProvider(provider: CourierProviderId): CourierProvider { return providers[provider] }
