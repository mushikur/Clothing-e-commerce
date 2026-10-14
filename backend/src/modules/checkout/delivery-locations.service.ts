import type { Types } from 'mongoose'
import { DeliveryLocation } from '../../models/DeliveryLocation.js'
import { AppError } from '../../utils/app-error.js'

type LocationSeed = { name: string; bn: string; division: string; district: string; area: string; zone: 'inside_dhaka' | 'dhaka_nearby' | 'outside_dhaka'; aliases?: string[] }
const districts: Array<[string, string, string]> = [
  ['Dhaka','ঢাকা','Dhaka'],['Faridpur','ফরিদপুর','Dhaka'],['Gazipur','গাজীপুর','Dhaka'],['Gopalganj','গোপালগঞ্জ','Dhaka'],['Kishoreganj','কিশোরগঞ্জ','Dhaka'],['Madaripur','মাদারীপুর','Dhaka'],['Manikganj','মানিকগঞ্জ','Dhaka'],['Munshiganj','মুন্সীগঞ্জ','Dhaka'],['Narayanganj','নারায়ণগঞ্জ','Dhaka'],['Narsingdi','নরসিংদী','Dhaka'],['Rajbari','রাজবাড়ী','Dhaka'],['Shariatpur','শরীয়তপুর','Dhaka'],['Tangail','টাঙ্গাইল','Dhaka'],
  ['Chattogram','চট্টগ্রাম','Chattogram'],['Bandarban','বান্দরবান','Chattogram'],['Brahmanbaria','ব্রাহ্মণবাড়িয়া','Chattogram'],['Chandpur','চাঁদপুর','Chattogram'],['Cumilla','কুমিল্লা','Chattogram'],['Cox’s Bazar','কক্সবাজার','Chattogram'],['Feni','ফেনী','Chattogram'],['Khagrachhari','খাগড়াছড়ি','Chattogram'],['Lakshmipur','লক্ষ্মীপুর','Chattogram'],['Noakhali','নোয়াখালী','Chattogram'],['Rangamati','রাঙ্গামাটি','Chattogram'],
  ['Rajshahi','রাজশাহী','Rajshahi'],['Bogura','বগুড়া','Rajshahi'],['Chapainawabganj','চাঁপাইনবাবগঞ্জ','Rajshahi'],['Joypurhat','জয়পুরহাট','Rajshahi'],['Naogaon','নওগাঁ','Rajshahi'],['Natore','নাটোর','Rajshahi'],['Pabna','পাবনা','Rajshahi'],['Sirajganj','সিরাজগঞ্জ','Rajshahi'],
  ['Khulna','খুলনা','Khulna'],['Bagerhat','বাগেরহাট','Khulna'],['Chuadanga','চুয়াডাঙ্গা','Khulna'],['Jashore','যশোর','Khulna'],['Jhenaidah','ঝিনাইদহ','Khulna'],['Kushtia','কুষ্টিয়া','Khulna'],['Magura','মাগুরা','Khulna'],['Meherpur','মেহেরপুর','Khulna'],['Narail','নড়াইল','Khulna'],['Satkhira','সাতক্ষীরা','Khulna'],
  ['Barishal','বরিশাল','Barishal'],['Barguna','বরগুনা','Barishal'],['Bhola','ভোলা','Barishal'],['Jhalokati','ঝালকাঠি','Barishal'],['Patuakhali','পটুয়াখালী','Barishal'],['Pirojpur','পিরোজপুর','Barishal'],
  ['Sylhet','সিলেট','Sylhet'],['Habiganj','হবিগঞ্জ','Sylhet'],['Moulvibazar','মৌলভীবাজার','Sylhet'],['Sunamganj','সুনামগঞ্জ','Sylhet'],
  ['Rangpur','রংপুর','Rangpur'],['Dinajpur','দিনাজপুর','Rangpur'],['Gaibandha','গাইবান্ধা','Rangpur'],['Kurigram','কুড়িগ্রাম','Rangpur'],['Lalmonirhat','লালমনিরহাট','Rangpur'],['Nilphamari','নীলফামারী','Rangpur'],['Panchagarh','পঞ্চগড়','Rangpur'],['Thakurgaon','ঠাকুরগাঁও','Rangpur'],
  ['Mymensingh','ময়মনসিংহ','Mymensingh'],['Jamalpur','জামালপুর','Mymensingh'],['Netrokona','নেত্রকোনা','Mymensingh'],['Sherpur','শেরপুর','Mymensingh'],
]

function code(value: string) { return value.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') }
const defaults: LocationSeed[] = districts.map(([name,bn,division]) => ({ name, bn, division, district: name, area: name, zone: name === 'Dhaka' ? 'inside_dhaka' : 'outside_dhaka' }))
defaults.push(
  ...['Mirpur','Uttara','Gulshan','Banani','Dhanmondi','Mohammadpur','Badda','Jatrabari','Motijheel','Rampura'].map((area) => ({ name: area, bn: ({Mirpur:'মিরপুর',Uttara:'উত্তরা',Gulshan:'গুলশান',Banani:'বনানী',Dhanmondi:'ধানমন্ডি',Mohammadpur:'মোহাম্মদপুর',Badda:'বাড্ডা',Jatrabari:'যাত্রাবাড়ী',Motijheel:'মতিঝিল',Rampura:'রামপুরা'} as Record<string,string>)[area] || area, division:'Dhaka', district:'Dhaka', area, zone:'inside_dhaka' as const })),
  ...[['Savar','সাভার','Savar'],['Ashulia','আশুলিয়া','Savar'],['Keraniganj','কেরানীগঞ্জ','Dhaka'],['Tongi','টঙ্গী','Gazipur'],['Gazipur Sadar','গাজীপুর সদর','Gazipur'],['Narayanganj City','নারায়ণগঞ্জ শহর','Narayanganj'],['Fatullah','ফতুল্লা','Narayanganj'],['Siddhirganj','সিদ্ধিরগঞ্জ','Narayanganj']].map(([area,bn,district]) => ({ name:area || 'Dhaka area', bn:bn || area || 'এলাকা', division:'Dhaka', district:district || area || 'Dhaka', area:area || 'Dhaka', zone:'dhaka_nearby' as const })),
  ...[['Chattogram City','চট্টগ্রাম শহর','Chattogram'],['Sitakunda','সীতাকুণ্ড','Chattogram'],['Hathazari','হাটহাজারী','Chattogram'],['Patiya','পটিয়া','Chattogram']].map(([area,bn,district]) => ({ name:area || 'Chattogram area', bn:bn || area || 'এলাকা', division:'Chattogram', district:district || area || 'Chattogram', area:area || 'Chattogram', zone:'outside_dhaka' as const })),
)

export async function ensureDeliveryLocationDefaults(businessId: Types.ObjectId) {
  if (await DeliveryLocation.exists({ businessId })) return
  await DeliveryLocation.insertMany(defaults.map((item) => ({ businessId, code: `${code(item.division)}-${code(item.district)}-${code(item.area)}`, name: item.name, nameTranslations: { en: item.name, bn: item.bn }, aliases: [item.bn, item.area, item.district].filter(Boolean), division: item.division, district: item.district, area: item.area, zone: item.zone, enabled: true })), { ordered: false })
}

export async function findDeliveryLocation(businessId: Types.ObjectId, locationId: string) {
  const location = await DeliveryLocation.findOne({ _id: locationId, businessId, enabled: true, deletedAt: { $exists: false } }).lean() as unknown as Record<string, any> | null
  if (!location) throw new AppError(422, 'delivery_location_unavailable', 'Choose a delivery location from the suggestions')
  return location
}

export function locationAddress(location: Record<string, any>) {
  return { division: location.division, region: location.division, district: location.district, city: location.district, area: location.area, deliveryLocationId: location._id, deliveryLocationName: location.name, deliveryZone: location.zone }
}
