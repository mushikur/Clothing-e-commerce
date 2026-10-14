import type { Types } from 'mongoose'
import { DeliveryRule } from '../../models/DeliveryRule.js'
import { CourierConfiguration } from '../../models/CourierConfiguration.js'
import { AppError } from '../../utils/app-error.js'
import { findDeliveryLocation } from './delivery-locations.service.js'

export type DeliveryAddress = { countryCode?: string; city?: string; region?: string; division?: string; district?: string; area?: string; deliveryLocationId?: string; deliveryZone?: string }
export type DeliveryRuleView = { _id: unknown; name: string; nameTranslations?: { en?: string; bn?: string }; code: string; scope: string; countryCode?: string; division?: string; district?: string; area?: string; zone?: string; courierCode?: string; fee: number; courierCost?: number; freeAbove?: number; minimumSubtotal?: number; maximumSubtotal?: number; codFee?: number; onlineFee?: number; estimatedDelivery: string; enabled: boolean }
const norm = (value?: string) => value?.normalize('NFKC').trim().toLocaleLowerCase('en').replace(/[^\p{L}\p{N}]+/gu, ' ') || ''

export async function ensureDeliveryDefaults(business: { _id: Types.ObjectId; checkout?: { deliveryOptions?: Array<{ code: string; label: string; fee: number; estimatedDays?: string; enabled: boolean }> } }) {
  const existing = await DeliveryRule.find({ businessId: business._id }).select('code zone fee').lean() as unknown as Array<{ code: string; zone?: string; fee: number }>
  const old = business.checkout?.deliveryOptions || []
  const inside = old.find((rule) => rule.code === 'dhaka')
  const outside = old.find((rule) => rule.code !== 'dhaka')
  const add = (code: string) => !existing.some((rule) => rule.code === code)
  const defaults = [
    { businessId: business._id, name: 'Inside Dhaka', nameTranslations: { en: 'Inside Dhaka', bn: 'ঢাকার ভিতরে' }, code: 'inside-dhaka', scope: 'zone', zone: 'inside_dhaka', countryCode: 'BD', fee: inside?.fee ?? 6000, estimatedDelivery: inside?.estimatedDays || '1–2 business days', enabled: inside?.enabled ?? true },
    { businessId: business._id, name: 'Dhaka Nearby', nameTranslations: { en: 'Dhaka Nearby', bn: 'ঢাকার আশেপাশে' }, code: 'dhaka-nearby', scope: 'zone', zone: 'dhaka_nearby', countryCode: 'BD', fee: existing.find((rule) => rule.zone === 'outside_dhaka')?.fee ?? outside?.fee ?? 12000, estimatedDelivery: '1–3 business days', enabled: true },
    { businessId: business._id, name: 'Outside Dhaka', nameTranslations: { en: 'Outside Dhaka', bn: 'ঢাকার বাইরে' }, code: 'outside-dhaka', scope: 'zone', zone: 'outside_dhaka', countryCode: 'BD', fee: outside?.fee ?? 12000, estimatedDelivery: outside?.estimatedDays || '2–5 business days', enabled: outside?.enabled ?? true },
    { businessId: business._id, name: 'Dhaka City', nameTranslations: { en: 'Dhaka City', bn: 'ঢাকা শহর' }, code: 'dhaka-city', scope: 'district', division: 'Dhaka', district: 'Dhaka', countryCode: 'BD', fee: inside?.fee ?? 6000, estimatedDelivery: '1–2 business days', enabled: true },
    { businessId: business._id, name: 'Savar', nameTranslations: { en: 'Savar', bn: 'সাভার' }, code: 'savar', scope: 'district', division: 'Dhaka', district: 'Savar', countryCode: 'BD', fee: 8000, estimatedDelivery: '1–3 business days', enabled: true },
    { businessId: business._id, name: 'Keraniganj', nameTranslations: { en: 'Keraniganj', bn: 'কেরানীগঞ্জ' }, code: 'keraniganj', scope: 'district', division: 'Dhaka', district: 'Keraniganj', countryCode: 'BD', fee: 8000, estimatedDelivery: '1–3 business days', enabled: true },
    { businessId: business._id, name: 'Chattogram', nameTranslations: { en: 'Chattogram', bn: 'চট্টগ্রাম' }, code: 'chattogram-division', scope: 'division', division: 'Chattogram', countryCode: 'BD', fee: outside?.fee ?? 12000, estimatedDelivery: '2–5 business days', enabled: true },
  ].filter((rule) => add(rule.code))
  if (defaults.length) await DeliveryRule.insertMany(defaults, { ordered: false })
}

export async function resolveDeliveryRule(businessId: Types.ObjectId, address: DeliveryAddress, subtotal: number, paymentMethod = 'cash_on_delivery', courierCode?: string) {
  const [rules, courierConfiguration] = await Promise.all([
    DeliveryRule.find({ businessId, enabled: true }).lean() as unknown as Promise<DeliveryRuleView[]>,
    CourierConfiguration.findOne({ businessId }).select('defaultProvider').lean() as unknown as Promise<{ defaultProvider?: string } | null>,
  ])
  const selectedCourier = courierCode || courierConfiguration?.defaultProvider
  const selectedLocation = address.deliveryLocationId ? await findDeliveryLocation(businessId, address.deliveryLocationId) as unknown as Record<string, any> : null
  const division = norm(selectedLocation?.division || address.division || address.region)
  const district = norm(selectedLocation?.district || address.district || address.city)
  const area = norm(selectedLocation?.area || address.area)
  const dhaka = division === 'dhaka' || district === 'dhaka'
  const zone = selectedLocation?.zone || (dhaka ? 'inside_dhaka' : 'outside_dhaka')
  const matches = rules.filter((rule) => {
    if (rule.countryCode && address.countryCode && rule.countryCode !== address.countryCode.toUpperCase()) return false
    if (rule.courierCode && rule.courierCode !== selectedCourier) return false
    if (rule.minimumSubtotal != null && subtotal < rule.minimumSubtotal) return false
    if (rule.maximumSubtotal != null && subtotal > rule.maximumSubtotal) return false
    if (rule.scope === 'area') return norm(rule.division) === division && norm(rule.district) === district && norm(rule.area) === area && Boolean(area)
    if (rule.scope === 'district') return norm(rule.division) === division && norm(rule.district) === district && Boolean(district)
    if (rule.scope === 'division') return norm(rule.division) === division && Boolean(division)
    if (rule.scope === 'zone') return rule.zone === zone
    return rule.scope === 'default'
  }).sort((a, b) => {
    const priority: Record<string, number> = { area: 5, district: 4, division: 3, zone: 2, default: 1 }
    const courierA = a.courierCode ? 1 : 0, courierB = b.courierCode ? 1 : 0
    return (priority[b.scope] || 0) - (priority[a.scope] || 0) || courierB - courierA || (b.minimumSubtotal ?? 0) - (a.minimumSubtotal ?? 0)
  })
  const rule = matches[0]
  if (!rule) throw new AppError(422, 'delivery_unavailable', 'Delivery is not currently available for this location')
  const methodFee = paymentMethod === 'cash_on_delivery' ? rule.codFee : rule.onlineFee
  let fee = methodFee ?? rule.fee
  if (rule.freeAbove != null && subtotal >= rule.freeAbove) fee = 0
  const label = rule.nameTranslations?.en || rule.name
  return { rule, fee, label, labelBn: rule.nameTranslations?.bn, zone, method: paymentMethod, courierCode: selectedCourier, estimatedDelivery: rule.estimatedDelivery }
}
