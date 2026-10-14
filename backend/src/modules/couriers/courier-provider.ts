export type CourierProviderId = 'steadfast' | 'pathao' | 'redx'
export type CourierOperation = 'createShipment' | 'getShipmentStatus' | 'getTracking' | 'cancelShipment' | 'createReturn' | 'getReturnStatus' | 'getDeliveryHistory'
export type CourierCapability = { supported: boolean; verification: 'officially_verified' | 'documentation_required'; reason?: string }
export type CourierCapabilities = Record<CourierOperation, CourierCapability>
export type ShipmentRequest = { orderNumber: string; recipientName: string; recipientPhone: string; recipientAddress: string; city: string; region?: string; postalCode?: string; codAmount: number; currency: string; note?: string; parcelDescription: string; weightKg?: number; pickupLocationId?: string }
export type ShipmentResult = { shipmentId?: string; consignmentId?: string; trackingId?: string; trackingUrl?: string; status: string; providerReference?: Record<string, unknown> }
export type TrackingResult = { status: string; events: Array<{ code: string; description?: string; occurredAt: Date; location?: string }>; trackingUrl?: string }

export interface CourierProvider {
  readonly id: CourierProviderId
  readonly label: string
  readonly capabilities: CourierCapabilities
  createShipment(request: ShipmentRequest, idempotencyKey: string): Promise<ShipmentResult>
  getShipmentStatus(reference: string): Promise<TrackingResult>
  getTracking(reference: string): Promise<TrackingResult>
  cancelShipment(reference: string, reason?: string): Promise<void>
  createReturn(reference: string, reason: string): Promise<ShipmentResult>
  getReturnStatus(reference: string): Promise<TrackingResult>
  getDeliveryHistory(reference: string): Promise<TrackingResult['events']>
  testConnection(): Promise<void>
}

export class CourierDocumentationRequiredError extends Error {
  readonly code = 'official_api_specification_required'
  constructor(provider: CourierProviderId, operation: CourierOperation) {
    super(`${provider} ${operation} is unavailable until the current official merchant API specification is verified`)
    this.name = 'CourierDocumentationRequiredError'
  }
}
