import { AppError } from '../../utils/app-error.js'

export type PaymentMethod = 'cash_on_delivery' | 'bkash' | 'nagad'
export type PaymentStart = { status: 'created' | 'requires_action'; publicInstructions?: string }

/** Provider boundary keeps gateway credentials and provider APIs on the server. */
export interface PaymentProviderAdapter {
  readonly code: PaymentMethod
  start(input: { amount: number; currency: string; idempotencyKey: string; merchantNumber?: string; accountType?: string; instructions?: string }): Promise<PaymentStart>
  verify(input: { customerReference?: string }): Promise<{ verified: boolean; providerReference?: string }>
  refund(input: { amount: number; reference?: string }): Promise<{ processed: boolean; reference?: string }>
}

class ManualProvider implements PaymentProviderAdapter {
  constructor(readonly code: 'bkash' | 'nagad') {}
  async start({ merchantNumber, accountType, instructions }: { amount: number; currency: string; idempotencyKey: string; merchantNumber?: string; accountType?: string; instructions?: string }): Promise<PaymentStart> {
    if (!merchantNumber) throw new AppError(422, 'payment_not_configured', `${this.code} is not configured for this store`)
    const providerName = this.code === 'bkash' ? 'bKash' : 'Nagad'
    const operation = accountType?.toLowerCase() === 'merchant' ? 'Payment' : 'Send Money'
    return { status: 'requires_action', publicInstructions: instructions || `Open ${providerName}, choose ${operation}, and send the exact order total to ${merchantNumber}. Enter the transaction ID below after sending. The store will verify the transaction before confirming payment.` }
  }
  async verify({ customerReference }: { customerReference?: string }) { return { verified: Boolean(customerReference?.trim()) } }
  async refund({ reference }: { amount: number; reference?: string }) { return { processed: Boolean(reference?.trim()), reference } }
}

class CashOnDeliveryProvider implements PaymentProviderAdapter {
  readonly code = 'cash_on_delivery' as const
  async start(): Promise<PaymentStart> { return { status: 'created' } }
  async verify() { return { verified: true } }
  async refund({ reference }: { amount: number; reference?: string }) { return { processed: Boolean(reference?.trim()), reference } }
}

const providers: Record<PaymentMethod, PaymentProviderAdapter> = {
  cash_on_delivery: new CashOnDeliveryProvider(),
  bkash: new ManualProvider('bkash'),
  nagad: new ManualProvider('nagad'),
}

export function paymentProvider(code: string): PaymentProviderAdapter {
  const provider = providers[code as PaymentMethod]
  if (!provider) throw new AppError(422, 'payment_provider_unavailable', 'This payment method is not supported')
  return provider
}
