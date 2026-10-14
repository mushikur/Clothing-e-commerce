import 'dotenv/config'
import mongoose from 'mongoose'
import { Business } from '../models/Business.js'
import { Category } from '../models/Category.js'
import { ContentPage } from '../models/ContentPage.js'
import { HomepageSection } from '../models/HomepageSection.js'
import { LandingPage } from '../models/LandingPage.js'
import { Product } from '../models/Product.js'
import { Promotion } from '../models/Promotion.js'
import { Subcategory } from '../models/Subcategory.js'
import { WebsiteSettings } from '../models/WebsiteSettings.js'

const terms: Array<[RegExp, string]> = [
  [/The Everyday/gi, 'প্রতিদিনের'], [/Everyday/gi, 'প্রতিদিনের'], [/Day-to-Day/gi, 'প্রতিদিনের'], [/Relaxed/gi, 'আরামদায়ক'], [/Heavyweight/gi, 'হেভিওয়েট'], [/Cotton/gi, 'কটন'], [/Organic/gi, 'অর্গানিক'], [/Ribbed/gi, 'রিবড'], [/Crewneck/gi, 'ক্রুনেক'], [/T-Shirt|Tee/gi, 'টি-শার্ট'], [/Oxford/gi, 'অক্সফোর্ড'], [/Weekend/gi, 'উইকএন্ড'], [/Linen/gi, 'লিনেন'], [/Blend/gi, 'মিশ্র কাপড়ের'], [/Studio/gi, 'স্টুডিও'], [/Poplin/gi, 'পপলিন'], [/Chambray/gi, 'শ্যামব্রে'], [/Textured/gi, 'টেক্সচার্ড'], [/Resort/gi, 'রিসোর্ট'], [/Shirt/gi, 'শার্ট'], [/Pleated/gi, 'প্লিটেড'], [/Tapered/gi, 'টেপার্ড'], [/Chino/gi, 'চিনো'], [/Drawstring/gi, 'ড্র-স্ট্রিং'], [/Twill/gi, 'টুইল'], [/Utility/gi, 'ইউটিলিটি'], [/Trouser|Pant/gi, 'প্যান্ট'], [/Straight-Leg/gi, 'স্ট্রেইট-লেগ'], [/Selvedge/gi, 'সেলভেজ'], [/Jean|Denim/gi, 'ডেনিম'], [/Washed/gi, 'ওয়াশড'], [/Classic/gi, 'ক্লাসিক'], [/Pocket/gi, 'পকেট'], [/Merino/gi, 'মেরিনো'], [/Hoodie/gi, 'হুডি'], [/Soft/gi, 'কোমল'], [/Loopback/gi, 'লুপব্যাক'], [/Lightweight/gi, 'হালকা'], [/Jacket/gi, 'জ্যাকেট'], [/Modern/gi, 'আধুনিক'], [/Harrington/gi, 'হ্যারিংটন'], [/Unlined/gi, 'আনলাইনড'], [/Canvas/gi, 'ক্যানভাস'], [/Overshirt/gi, 'ওভারশার্ট'], [/Dhaka/gi, 'ঢাকা'], [/Panjabi/gi, 'পাঞ্জাবি'], [/Jacquard/gi, 'জ্যাকার্ড'], [/Collarless/gi, 'কলারবিহীন'], [/Gathered/gi, 'গ্যাদার্ড'], [/Dress/gi, 'ড্রেস'], [/Midi/gi, 'মিডি'], [/Easy Column/gi, 'সহজ কাটের কলাম'], [/Draped/gi, 'ড্রেপড'], [/Blouse/gi, 'ব্লাউজ'], [/Handloom/gi, 'তাঁতের'], [/Saree/gi, 'শাড়ি'], [/Evening/gi, 'ইভনিং'], [/Belted/gi, 'বেল্টযুক্ত'], [/City Coat/gi, 'সিটি কোট'], [/Tailored/gi, 'টেইলরড'], [/Blazer/gi, 'ব্লেজার'], [/Tote/gi, 'টোট ব্যাগ'], [/Scarf/gi, 'স্কার্ফ'], [/The /gi, ''],
]
function bnName(name: string) {
  let value = name
  for (const [pattern, replacement] of terms) value = value.replace(pattern, replacement)
  return value.replace(/\s+/g, ' ').trim()
}
const taxonomyBn: Record<string, string> = {
  men: 'পুরুষ', women: 'নারী', accessories: 'অনুষঙ্গ', 't-shirts': 'টি-শার্ট', shirts: 'শার্ট', trousers: 'ট্রাউজার', denim: 'ডেনিম', knitwear: 'নিটওয়্যার', jackets: 'জ্যাকেট', panjabi: 'পাঞ্জাবি', dresses: 'ড্রেস', blouses: 'ব্লাউজ', sarees: 'শাড়ি', 'womens-outerwear': 'নারীদের বাইরের পোশাক', bags: 'ব্যাগ', scarves: 'স্কার্ফ',
}
const policyPages = {
  returns: {
    titleEn: 'Returns and exchanges', titleBn: 'রিটার্ন ও এক্সচেঞ্জ নীতি',
    en: `Return eligibility\n\nYou may request a return or exchange within 7 calendar days of delivery. Please contact our support team with your order number before sending anything back. Items bought on final sale, personalised items, and hygiene-sensitive products that have been opened cannot be returned.\n\nProduct condition\n\nItems must be unworn, unwashed, unaltered, and returned with original tags and packaging. Please include all accessories supplied with the item. We may decline a return if inspection finds signs of use, damage, or missing tags.\n\nExchange rules\n\nExchanges depend on available size and colour stock. If the requested option is unavailable, you may choose another eligible item or request a refund of the item price. Any price difference is collected or returned as appropriate.\n\nRefund rules and delivery charges\n\nAfter an approved return passes inspection, we refund the amount paid for the returned item. Original delivery charges are not refundable unless the return is due to an incorrect, damaged, or defective item. Return shipping is paid by the customer for a change of mind or size exchange; we cover reasonable return delivery for an item we sent incorrectly or damaged.\n\nDamaged or incorrect items\n\nPlease contact us within 48 hours of delivery and include clear photos of the item and parcel. We will arrange an eligible replacement, exchange, or refund after reviewing the report. Keep the item and packaging until we confirm the next step.\n\nHow to request a return\n\nSign in and open the order details, or contact the store using the support information on this site. Tell us the item, size, and reason. We will reply with return instructions. Please do not send a parcel before receiving approval and the return address.\n\nProcessing time and support\n\nInspection usually takes 2–3 business days after receipt. Approved refunds are initiated within 7–10 business days; your bank or payment provider may need additional time to show the funds. For help, contact the support details listed on this storefront.`,
    bn: `রিটার্নের যোগ্যতা\n\nপণ্য ডেলিভারির তারিখ থেকে ৭ ক্যালেন্ডার দিনের মধ্যে রিটার্ন বা এক্সচেঞ্জের অনুরোধ জানাতে পারবেন। পণ্য ফেরত পাঠানোর আগে অর্ডার নম্বরসহ আমাদের গ্রাহকসেবা দলের সঙ্গে যোগাযোগ করুন। চূড়ান্ত ছাড়ে কেনা, ব্যক্তিগতভাবে তৈরি এবং খোলা হলে স্বাস্থ্যবিধির কারণে ফেরত দেওয়া যায় না—এমন পণ্য রিটার্নযোগ্য নয়।\n\nপণ্যের অবস্থা\n\nপণ্যটি অব্যবহৃত, না-ধোয়া ও অপরিবর্তিত থাকতে হবে। মূল ট্যাগ ও প্যাকেজিংসহ ফেরত দিতে হবে এবং পণ্যের সঙ্গে দেওয়া সব অনুষঙ্গও যুক্ত করতে হবে। ব্যবহারের চিহ্ন, ক্ষতি বা ট্যাগ না থাকলে যাচাই শেষে রিটার্ন গ্রহণ করা নাও হতে পারে।\n\nএক্সচেঞ্জের নিয়ম\n\nসাইজ ও রঙের স্টক থাকা সাপেক্ষে এক্সচেঞ্জ করা যাবে। চাওয়া অপশনটি না থাকলে অন্য উপযুক্ত পণ্য বেছে নিতে পারেন অথবা পণ্যের মূল্য ফেরতের অনুরোধ করতে পারেন। দামের পার্থক্য থাকলে প্রয়োজন অনুযায়ী তা নেওয়া বা ফেরত দেওয়া হবে।\n\nরিফান্ড ও ডেলিভারি চার্জ\n\nঅনুমোদিত রিটার্নের পণ্য যাচাইয়ে উত্তীর্ণ হলে ফেরত দেওয়া পণ্যের পরিশোধিত মূল্য ফেরত দেওয়া হবে। ভুল, ক্ষতিগ্রস্ত বা ত্রুটিপূর্ণ পণ্যের ক্ষেত্রে ডেলিভারি চার্জও ফেরতযোগ্য; অন্য ক্ষেত্রে মূল ডেলিভারি চার্জ ফেরত দেওয়া হয় না। পছন্দ পরিবর্তন বা সাইজ বদলের জন্য ফেরত পাঠানোর খরচ ক্রেতাকে বহন করতে হবে। আমাদের ভুলে ভুল বা ক্ষতিগ্রস্ত পণ্য পাঠানো হলে যুক্তিসংগত ফেরত ডেলিভারি খরচ আমরা বহন করব।\n\nক্ষতিগ্রস্ত বা ভুল পণ্য\n\nডেলিভারির ৪৮ ঘণ্টার মধ্যে পণ্য ও পার্সেলের স্পষ্ট ছবি দিয়ে আমাদের জানান। বিষয়টি যাচাই করে প্রযোজ্য ক্ষেত্রে বদলি পণ্য, এক্সচেঞ্জ বা রিফান্ডের ব্যবস্থা করা হবে। পরবর্তী নির্দেশনা না পাওয়া পর্যন্ত পণ্য ও প্যাকেজিংটি রেখে দিন।\n\nরিটার্নের অনুরোধ\n\nঅ্যাকাউন্টে সাইন ইন করে অর্ডারের বিস্তারিত থেকে অনুরোধ জানান, অথবা এই ওয়েবসাইটে দেওয়া যোগাযোগের মাধ্যমে আমাদের লিখুন। কোন পণ্য, সাইজ এবং কী কারণে রিটার্ন করতে চান তা উল্লেখ করুন। রিটার্নের নির্দেশনা আমরা জানিয়ে দেব। অনুমোদন ও ফেরত পাঠানোর ঠিকানা পাওয়ার আগে পার্সেল পাঠাবেন না।\n\nযাচাইয়ের সময় ও সহায়তা\n\nপণ্য হাতে পাওয়ার পর সাধারণত ২–৩ কর্মদিবসের মধ্যে যাচাই সম্পন্ন হয়। অনুমোদিত রিফান্ড ৭–১০ কর্মদিবসের মধ্যে পাঠানো হয়; ব্যাংক বা পেমেন্ট সেবায় টাকা দেখা যেতে আরও সময় লাগতে পারে। সহায়তার জন্য এই স্টোরে দেওয়া যোগাযোগের তথ্য ব্যবহার করুন।`,
  },
  refunds: {
    titleEn: 'Refund policy', titleBn: 'রিফান্ড নীতি',
    en: `Refund eligibility\n\nRefunds are available for eligible returns after the item has been received and inspected. Refunds may also be issued when we cancel an order, cannot fulfil an item, or confirm that an item arrived damaged or incorrect. Items outside the return window or excluded by the return policy are not eligible.\n\nRefund method\n\nWe return funds to the original payment method where the provider supports it. For cash on delivery, the store will agree a traceable transfer method with the customer before processing. We never ask customers to share a PIN, password, or one-time code to receive a refund.\n\nInspection and timing\n\nReturned items are checked for eligibility and condition. We initiate an approved refund within 7–10 business days after inspection. Banks, mobile financial services, and card providers may take additional time to post the refund. We will share a reference when one is available.\n\nFailed delivery and payment issues\n\nIf an order cannot be delivered and returns to the store, we review the order and any delivery charge before arranging a refund. A failed or pending payment is not treated as a completed payment; contact support with the order number and provider reference so we can investigate. Duplicate charges are reviewed with the payment provider.\n\nQuestions\n\nFor help, contact the support details shown on this site and include the order number. Do not send full card details, account passwords, PINs, or verification codes.`,
    bn: `রিফান্ড পাওয়ার যোগ্যতা\n\nরিটার্নের পণ্য আমাদের কাছে পৌঁছে যাচাইয়ে উত্তীর্ণ হলে প্রযোজ্য রিফান্ড দেওয়া হয়। আমরা অর্ডার বাতিল করলে, কোনো পণ্য দিতে না পারলে, অথবা পণ্য ক্ষতিগ্রস্ত বা ভুল পাঠানোর বিষয়টি নিশ্চিত হলে রিফান্ড দেওয়া হতে পারে। রিটার্নের সময়সীমা পার হওয়া বা রিটার্ন নীতিতে বাদ পড়া পণ্যে রিফান্ড প্রযোজ্য নয়।\n\nযে মাধ্যমে টাকা ফেরত দেওয়া হবে\n\nসেবা প্রদানকারী সুবিধা দিলে মূল পেমেন্ট মাধ্যমেই টাকা ফেরত পাঠানো হবে। ক্যাশ অন ডেলিভারির ক্ষেত্রে টাকা পাঠানোর আগে ক্রেতার সঙ্গে যাচাইযোগ্য বিকল্প পদ্ধতিতে সম্মতি নেওয়া হবে। রিফান্ড পেতে আমরা কখনো পিন, পাসওয়ার্ড বা ওটিপি চাইব না।\n\nপণ্য যাচাই ও সময়\n\nরিটার্নের পণ্য নীতিমালা ও অবস্থা অনুযায়ী পরীক্ষা করা হবে। যাচাই শেষে অনুমোদিত রিফান্ড ৭–১০ কর্মদিবসের মধ্যে পাঠানো হবে। ব্যাংক, মোবাইল ফাইন্যান্সিয়াল সার্ভিস বা কার্ড সেবায় টাকা জমা হতে আরও সময় লাগতে পারে। রেফারেন্স নম্বর পাওয়া গেলে জানিয়ে দেওয়া হবে।\n\nডেলিভারি ব্যর্থতা ও পেমেন্ট সমস্যা\n\nঅর্ডার ডেলিভারি করা না গেলে এবং পণ্য দোকানে ফেরত এলে অর্ডার ও প্রযোজ্য ডেলিভারি চার্জ যাচাই করে রিফান্ডের ব্যবস্থা করা হবে। ব্যর্থ বা অপেক্ষমাণ পেমেন্টকে সম্পন্ন পেমেন্ট হিসেবে ধরা হয় না। যাচাইয়ের জন্য অর্ডার নম্বর ও সেবা প্রদানকারীর রেফারেন্সসহ গ্রাহকসেবায় যোগাযোগ করুন। একই পেমেন্ট একাধিকবার কাটা হলে পেমেন্ট সেবার সঙ্গে মিলিয়ে দেখা হবে।\n\nসহায়তা\n\nসহায়তার জন্য অর্ডার নম্বরসহ এই সাইটে দেওয়া যোগাযোগের ঠিকানায় লিখুন। কার্ডের সম্পূর্ণ তথ্য, পাসওয়ার্ড, পিন বা যাচাইকরণ কোড পাঠাবেন না।`,
  },
  terms: {
    titleEn: 'Terms and conditions', titleBn: 'ব্যবহারের শর্তাবলি',
    en: `Using this storefront\n\nBy browsing or placing an order, you agree to use this storefront lawfully and provide accurate account, delivery, and contact information. You must be at least 18 years old or have permission from a parent or guardian to place an order.\n\nProducts, prices, and availability\n\nWe make reasonable efforts to describe products, colours, sizes, prices, and stock accurately. Screen settings may affect how colours appear. An order is subject to stock confirmation and acceptance by the store. We may correct an obvious listing error or cancel and refund an affected order.\n\nOrders and payment\n\nPlease review your order details before placing it. Payment is collected only through the methods shown at checkout. Never share payment PINs or one-time codes. Cash-on-delivery orders are payable at delivery.\n\nDelivery, returns, and liability\n\nDelivery estimates are indicative and may change due to events outside our control. Returns and refunds follow the published policies. Nothing in these terms limits consumer rights that cannot legally be excluded.\n\nContact and updates\n\nWe may update these terms when our services change. The current version is shown on this page. For questions, contact the store using the details provided on this site.`,
    bn: `ওয়েবসাইট ব্যবহার\n\nএই ওয়েবসাইট দেখা বা অর্ডার করার মাধ্যমে আপনি আইনসম্মতভাবে সেবা ব্যবহার করতে এবং অ্যাকাউন্ট, ডেলিভারি ও যোগাযোগের সঠিক তথ্য দিতে সম্মত হচ্ছেন। অর্ডার করতে আপনার বয়স কমপক্ষে ১৮ বছর হতে হবে; এর কম হলে অভিভাবকের অনুমতি প্রয়োজন।\n\nপণ্য, দাম ও প্রাপ্যতা\n\nপণ্যের বিবরণ, রঙ, সাইজ, দাম ও স্টকের তথ্য নির্ভুল রাখতে আমরা যথাসাধ্য চেষ্টা করি। ডিভাইসের পর্দার কারণে রঙে কিছুটা পার্থক্য দেখা যেতে পারে। স্টক যাচাই ও দোকানের গ্রহণের পর অর্ডার নিশ্চিত হয়। তালিকায় স্পষ্ট ভুল থাকলে আমরা তা সংশোধন করতে বা সংশ্লিষ্ট অর্ডার বাতিল করে টাকা ফেরত দিতে পারি।\n\nঅর্ডার ও পেমেন্ট\n\nঅর্ডার দেওয়ার আগে সব তথ্য দেখে নিন। চেকআউটে দেখানো মাধ্যমেই পেমেন্ট নেওয়া হবে। পেমেন্টের পিন বা ওটিপি কারও সঙ্গে শেয়ার করবেন না। ক্যাশ অন ডেলিভারির অর্ডারের মূল্য পণ্য পৌঁছালে পরিশোধ করতে হবে।\n\nডেলিভারি, রিটার্ন ও দায়বদ্ধতা\n\nডেলিভারির সম্ভাব্য সময় একটি ধারণা; আমাদের নিয়ন্ত্রণের বাইরের কারণে তা পরিবর্তিত হতে পারে। রিটার্ন ও রিফান্ডের ক্ষেত্রে প্রকাশিত নীতিমালা প্রযোজ্য। আইন অনুযায়ী ক্রেতার যে অধিকার বাদ দেওয়া যায় না, এই শর্তাবলি তা সীমিত করে না।\n\nযোগাযোগ ও শর্ত হালনাগাদ\n\nসেবায় পরিবর্তন এলে আমরা এই শর্তাবলি হালনাগাদ করতে পারি। বর্তমান সংস্করণ এই পাতায় থাকবে। কোনো প্রশ্ন থাকলে সাইটে দেওয়া যোগাযোগের তথ্য ব্যবহার করুন।`,
  },
  privacy: {
    titleEn: 'Privacy policy', titleBn: 'গোপনীয়তা নীতি',
    en: `Information we collect\n\nWe collect information you provide when you create an account, place an order, save an address, contact support, or submit a review. This may include your name, email, phone number, delivery address, order details, and messages. Payment credentials are handled by the selected payment provider and are not stored as plain text by this storefront.\n\nHow we use information\n\nWe use information to operate your account, process orders and returns, arrange delivery, answer questions, prevent fraud, and meet legal obligations. We use limited service data to improve the site and troubleshoot technical issues.\n\nSharing and retention\n\nWe share only the information needed with service providers such as payment processors, delivery partners, and hosting providers. We do not sell personal information. We retain records for as long as needed to provide services, resolve disputes, and meet legal and accounting requirements.\n\nYour choices and security\n\nYou may request access, correction, or deletion of eligible account information by contacting the store. We use reasonable safeguards, but no online system can guarantee absolute security. Please use a unique password and never share verification codes.\n\nContact\n\nFor privacy questions or requests, contact the store using the details listed on this site.`,
    bn: `আমরা যে তথ্য সংগ্রহ করি\n\nঅ্যাকাউন্ট খোলা, অর্ডার করা, ঠিকানা সংরক্ষণ, গ্রাহকসেবায় যোগাযোগ বা রিভিউ দেওয়ার সময় আপনি যে তথ্য দেন তা আমরা সংগ্রহ করি। এর মধ্যে নাম, ইমেইল, ফোন নম্বর, ডেলিভারির ঠিকানা, অর্ডারের তথ্য ও বার্তা থাকতে পারে। নির্বাচিত পেমেন্ট সেবা পেমেন্টের গোপন তথ্য পরিচালনা করে; এই ওয়েবসাইটে তা সাধারণ টেক্সট হিসেবে সংরক্ষণ করা হয় না।\n\nতথ্য ব্যবহারের কারণ\n\nঅ্যাকাউন্ট পরিচালনা, অর্ডার ও রিটার্ন সম্পন্ন, ডেলিভারির ব্যবস্থা, প্রশ্নের উত্তর, জালিয়াতি প্রতিরোধ এবং আইনি দায়িত্ব পালনে তথ্য ব্যবহার করা হয়। ওয়েবসাইট উন্নত করা ও প্রযুক্তিগত সমস্যা সমাধানে সীমিত সেবা-সংক্রান্ত তথ্যও কাজে লাগতে পারে।\n\nতথ্য শেয়ার ও সংরক্ষণ\n\nপেমেন্ট সেবা, ডেলিভারি পার্টনার ও হোস্টিং সেবার মতো সহযোগীদের সঙ্গে কাজের জন্য যতটুকু দরকার ততটুকু তথ্যই শেয়ার করা হয়। ব্যক্তিগত তথ্য বিক্রি করা হয় না। সেবা, বিরোধ নিষ্পত্তি এবং আইন বা হিসাবের প্রয়োজন মেটাতে যত দিন দরকার, তত দিন রেকর্ড রাখা হয়।\n\nআপনার পছন্দ ও নিরাপত্তা\n\nযোগ্য অ্যাকাউন্ট তথ্য দেখা, সংশোধন বা মুছে ফেলার অনুরোধ জানাতে দোকানে যোগাযোগ করতে পারেন। তথ্য সুরক্ষায় যথাযথ ব্যবস্থা নেওয়া হলেও অনলাইন ব্যবস্থায় শতভাগ নিরাপত্তার নিশ্চয়তা দেওয়া যায় না। আলাদা ও শক্তিশালী পাসওয়ার্ড ব্যবহার করুন এবং যাচাইকরণ কোড কাউকে দেবেন না।\n\nযোগাযোগ\n\nগোপনীয়তা সম্পর্কে প্রশ্ন বা অনুরোধ জানাতে এই সাইটে দেওয়া যোগাযোগের তথ্য ব্যবহার করুন।`,
  },
}

async function main() {
  const uri = process.env.MONGODB_URI?.trim()
  if (!uri) throw new Error('MONGODB_URI is required')
  const dbName = new URL(uri).pathname.replace(/^\//, '').split('?')[0]
  if (dbName !== 'fashion_commerce_demo') throw new Error('Bilingual demo updates are restricted to fashion_commerce_demo')
  await mongoose.connect(uri)
  const business = await Business.findOne({ slug: 'aster-loom-demo' })
  if (!business) throw new Error('Demo business aster-loom-demo was not found')
  const businessId = business._id
  const categories = await Category.find({ businessId })
  for (const category of categories) {
    const bn = taxonomyBn[category.slug] || bnName(category.name)
    category.set('translations', { en: { name: category.name, description: category.description, seoTitle: category.seo?.title, seoDescription: category.seo?.description }, bn: { name: bn, description: `যত্নে বাছাই করা ${bn} কালেকশন।`, seoTitle: `${bn} কালেকশন | অ্যাস্টার অ্যান্ড লুম`, seoDescription: `${bn} পোশাকের কালেকশন দেখুন।` } })
    await category.save()
  }
  const subcategories = await Subcategory.find({ businessId })
  for (const sub of subcategories) {
    const bn = taxonomyBn[sub.slug] || bnName(sub.name)
    sub.set('translations', { en: { name: sub.name, description: sub.description }, bn: { name: bn, description: `বাছাই করা ${bn} কালেকশন।` } })
    await sub.save()
  }
  const products = await Product.find({ businessId })
  for (const product of products) {
    const name = bnName(product.name)
    const material = product.material || 'কটন'
    product.set('translations', { en: { name: product.name, slug: product.slug, shortDescription: product.shortDescription, description: product.description, seoTitle: product.seo?.title, seoDescription: product.seo?.description }, bn: { name, slug: product.slug, shortDescription: `${material} কাপড়ে তৈরি আরামদায়ক ${name}।`, description: `${name} তৈরি করা হয়েছে আরামদায়ক চলাচল, পরিপাটি কাট এবং প্রতিদিনের ব্যবহারের কথা ভেবে। ${material} কাপড় ও যত্নশীল ফিনিশিংয়ে তৈরি এই পোশাকটি সহজে আপনার দৈনন্দিন কালেকশনের সঙ্গে মানিয়ে যায়।`, seoTitle: `${name} | অ্যাস্টার অ্যান্ড লুম`, seoDescription: `আরামদায়ক কাট ও যত্নশীল ফিনিশিংয়ে তৈরি ${name} দেখুন।` } })
    await product.save()
  }
  const sections = await HomepageSection.find({ businessId })
  const sectionCopy: Record<string, { eyebrow?: string; title?: string; headline?: string; body?: string; buttonLabel?: string }> = {
    hero: { eyebrow: 'নতুন কালেকশন', headline: 'পোশাকের নিজস্ব ভাষায়, নিজের মতো করে', body: 'প্রতিদিনের জীবনের জন্য যত্নে বেছে নেওয়া পোশাক। স্বাচ্ছন্দ্য, কাপড় ও নকশায় থাকুক আপনার নিজস্বতা।', buttonLabel: 'কালেকশন দেখুন' },
    product_grid: { title: 'নতুন কালেকশন' }, product_carousel: { title: 'জনপ্রিয় পছন্দ' }, product_collection: { title: 'প্রতিদিনের প্রিয় পোশাক' }, categories: { title: 'ক্যাটাগরি অনুযায়ী দেখুন' },
    newsletter: { title: 'নতুন খবর সবার আগে জানুন', body: 'নতুন কালেকশন ও বিশেষ আয়োজনের খবর পেতে যুক্ত থাকুন।', buttonLabel: 'যুক্ত হোন' },
    promotion_banner: { headline: 'নতুন মৌসুমের বিশেষ আয়োজন', body: 'নির্বাচিত পোশাকে বিশেষ ছাড় উপভোগ করুন।', buttonLabel: 'কেনাকাটা করুন' },
    cta: { headline: 'আপনার পরের পছন্দটি খুঁজে নিন', buttonLabel: 'এখনই কিনুন' },
    reviews: { title: 'ক্রেতাদের ভালোবাসা' }, testimonials: { title: 'আমাদের ক্রেতারা যা বলেন' }, lookbook: { eyebrow: 'স্টাইলের গল্প', headline: 'নিজের মতো করে সাজুন' }, image_text: { headline: 'সহজ স্টাইল, যত্নে তৈরি' },
  }
  for (const section of sections) {
    const enContent = Object.fromEntries(section.content instanceof Map ? section.content : Object.entries(section.content || {}))
    const copy = sectionCopy[section.type] || {}
    const bnContent = { ...enContent, ...copy, ...(Array.isArray(enContent.items) ? { items: enContent.items.map((item: any) => ({ ...item, title: item.title ? bnName(item.title) : undefined, body: item.body ? 'যত্নে বেছে নেওয়া কালেকশনের অংশ।' : undefined })) } : {}) }
    section.set('translations', { en: { title: section.title, content: enContent }, bn: { title: copy.title || bnName(section.title || section.type), content: bnContent } })
    await section.save()
  }
  const promotions = await Promotion.find({ businessId })
  for (const promotion of promotions) {
    promotion.set('translations', { en: { title: promotion.title, message: promotion.message }, bn: { title: bnName(promotion.title), message: promotion.status === 'active' ? 'নির্বাচিত পোশাকে বিশেষ ছাড় উপভোগ করুন।' : 'মৌসুমি কালেকশনের বিশেষ আয়োজন।' } })
    await promotion.save()
  }
  const policyData = policyPages as Record<string, { titleEn: string; titleBn: string; en: string; bn: string }>
  for (const [pageKey, policy] of Object.entries(policyData)) {
    const demoNoteEn = '\n\nDemo notice\n\nThis is demonstration-store policy content. Replace it with terms reviewed for your business and applicable local law before launch. No real consumer rights or legal obligations are changed by this demo text.'
    const demoNoteBn = '\n\nডেমো নোট\n\nএটি ডেমো স্টোরের নীতিমালার নমুনা। চালুর আগে আপনার ব্যবসা ও প্রযোজ্য স্থানীয় আইন অনুযায়ী যাচাই করা নীতিমালা দিয়ে এটি প্রতিস্থাপন করুন। এই ডেমো লেখা দিয়ে ক্রেতার আইনগত অধিকার বা কোনো আইনি দায়িত্ব পরিবর্তিত হয় না।'
    const translations = { en: { title: policy.titleEn, body: policy.en + demoNoteEn, seoTitle: policy.titleEn, seoDescription: policy.titleEn }, bn: { title: policy.titleBn, body: policy.bn + demoNoteBn, seoTitle: policy.titleBn, seoDescription: policy.titleBn } }
    await ContentPage.findOneAndUpdate({ businessId, pageKey }, { $set: { pageKey, slug: pageKey, title: policy.titleEn, body: policy.en + demoNoteEn, summary: policy.titleEn, translations, status: 'published', seo: { title: policy.titleEn, description: policy.titleEn }, publishedAt: new Date() }, $setOnInsert: { businessId } }, { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true })
  }
  const faqEn = [
    { question: 'How do I choose the right size?', answer: 'Use the size guide on the product page and review the fit notes before selecting a size.' },
    { question: 'How long does delivery take?', answer: 'Delivery estimates are shown at checkout and depend on your location.' },
    { question: 'Can I exchange a size?', answer: 'You may request an exchange within 7 days of delivery, subject to the return policy and stock.' },
    { question: 'How can I track my order?', answer: 'Open Orders in your account to view order progress and available tracking updates.' },
    { question: 'How do I contact customer care?', answer: 'Use the phone or email details listed in the Contact page.' },
  ]
  const faqBn = [
    { question: 'সঠিক সাইজ কীভাবে বেছে নেব?', answer: 'পণ্যের পাতায় সাইজ গাইড ও ফিটের বিবরণ দেখে সাইজ নির্বাচন করুন।' },
    { question: 'ডেলিভারিতে কত দিন লাগে?', answer: 'চেকআউটে সম্ভাব্য ডেলিভারির সময় দেখানো হয়; আপনার অবস্থানের ওপর সময় নির্ভর করে।' },
    { question: 'সাইজ এক্সচেঞ্জ করা যাবে?', answer: 'রিটার্ন নীতি ও স্টক থাকা সাপেক্ষে ডেলিভারির ৭ দিনের মধ্যে এক্সচেঞ্জের অনুরোধ করতে পারবেন।' },
    { question: 'অর্ডার ট্র্যাক করব কীভাবে?', answer: 'অ্যাকাউন্টের অর্ডার অংশে অর্ডারের অগ্রগতি ও ট্র্যাকিং আপডেট দেখুন।' },
    { question: 'গ্রাহকসেবায় যোগাযোগ করব কীভাবে?', answer: 'যোগাযোগ পাতায় দেওয়া ফোন বা ইমেইলে লিখুন।' },
  ]
  await ContentPage.findOneAndUpdate({ businessId, pageKey: 'faq' }, { $set: { pageKey: 'faq', slug: 'faq', title: 'Frequently asked questions', summary: 'Helpful answers about sizing, delivery, orders and returns.', faqs: faqEn, translations: { en: { title: 'Frequently asked questions', summary: 'Helpful answers about sizing, delivery, orders and returns.', faqs: faqEn }, bn: { title: 'সাধারণ জিজ্ঞাসা', summary: 'সাইজ, ডেলিভারি, অর্ডার ও রিটার্ন নিয়ে দরকারি উত্তর।', faqs: faqBn } }, status: 'published', publishedAt: new Date() }, $setOnInsert: { businessId } }, { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true })
  const simplePages = [
    ['about', 'About Aster & Loom', 'আমাদের সম্পর্কে', 'আমাদের কালেকশন তৈরি হয় সহজে পরার মতো, যত্নে বাছাই করা পোশাক নিয়ে। কাপড়, কাট ও ফিনিশিংয়ে আমরা স্বাচ্ছন্দ্য এবং দীর্ঘদিন ব্যবহারের কথা ভাবি।'],
    ['contact', 'Contact', 'যোগাযোগ', 'অর্ডার বা পণ্য সম্পর্কে সহায়তার জন্য আমাদের সঙ্গে যোগাযোগ করুন।'],
    ['shipping', 'Shipping information', 'ডেলিভারি তথ্য', 'ডেলিভারি চার্জ ও সম্ভাব্য সময় চেকআউটে ঠিকানা দেওয়ার পর দেখানো হয়। অর্ডার পাঠানো হলে ট্র্যাকিং তথ্য পাওয়া যেতে পারে।'],
  ]
  for (const [pageKey, titleEn, titleBn, bnBody] of simplePages) {
    const existing = await ContentPage.findOne({ businessId, pageKey })
    const bodyEn = existing?.body || 'Our collection brings together considered clothing for everyday life. For current delivery and contact information, please use the options shown on this storefront.'
    const translations = pageKey === 'about' ? { en: { title: titleEn, body: bodyEn }, bn: { title: titleBn, body: bnBody } } : { en: { title: titleEn, body: bodyEn }, bn: { title: titleBn, body: bnBody } }
    await ContentPage.findOneAndUpdate({ businessId, pageKey }, { $set: { pageKey, slug: pageKey, title: titleEn, body: bodyEn, translations, status: 'published', publishedAt: new Date() }, $setOnInsert: { businessId } }, { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true })
  }
  const landings = await LandingPage.find({ businessId })
  for (const landing of landings) landing.set('translations', { en: { title: landing.title, summary: landing.summary, seoTitle: landing.seo?.title, seoDescription: landing.seo?.description }, bn: { title: bnName(landing.title), summary: 'যত্নে বেছে নেওয়া নতুন কালেকশন থেকে আপনার পছন্দ খুঁজে নিন।', seoTitle: `${bnName(landing.title)} | অ্যাস্টার অ্যান্ড লুম`, seoDescription: 'প্রতিদিনের জন্য আরামদায়ক ও যত্নে তৈরি পোশাক দেখুন।' } }), await landing.save()
  const settings = await WebsiteSettings.findOne({ businessId })
  if (settings) { settings.set('locale', 'en-BD'); settings.set('defaultLanguage', 'en'); settings.set('enabledLocales', ['en', 'bn']); await settings.save() }
  console.info(`Bilingual demo content saved for ${products.length} products, ${categories.length} categories, ${subcategories.length} subcategories, ${sections.length} homepage sections, and ${Object.keys(policyData).length + 4} content pages.`)
}

main().catch((error) => { console.error(error); process.exitCode = 1 }).finally(async () => { await mongoose.disconnect() })
