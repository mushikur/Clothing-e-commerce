import { useI18n } from './I18nProvider'
const en = {
  account:'Admin account', accountHelp:'Manage your personal name and sign-in security.', name:'Admin name', email:'Sign-in email', saveName:'Save name', nameSaved:'Your name has been updated.',
  password:'Change password', current:'Current password', next:'New password', confirm:'Confirm new password', passwordHelp:'Use at least 12 characters. Your other sessions will be signed out.', passwordSave:'Update password', passwordSaved:'Password updated. Your current session is secure.', mismatch:'The new passwords do not match.', passwordLength:'Use at least 12 characters and no more than 72 bytes.',
  delete:'Delete', cancel:'Cancel', deleting:'Deleting…', title:'Delete this record?', deleteHelp:'This record will move to Trash. You can restore it later. Existing order and invoice information is retained.', customerHelp:'Deleting a registered customer also disables their sign-in. Restore the customer to re-enable their previous account status.', productHelp:'The product will be removed from the storefront. Restoring it creates a draft for review before publishing.',
  trash:'Trash', trashHelp:'Restore records removed from your working lists.', orders:'Orders', customers:'Customers', products:'Products', record:'Record', deleted:'Deleted on', actions:'Actions', restore:'Restore', restored:'Record restored.', empty:'Trash is empty.', previous:'Previous', nextPage:'Next', loadError:'Unable to load these records. Please try again.', retry:'Retry', error:'The update could not be completed.',
  openOrder:'Cancel or complete this order before deleting it. This keeps stock and payment records correct.', openReturn:'Resolve the return request before deleting this order.', protected:'Administrator and staff accounts cannot be deleted from Customers.', denied:'Only an authorized administrator or manager can delete and restore records.', incorrect:'Current password is incorrect',
}
const bn: Record<keyof typeof en,string> = {
  account:'অ্যাডমিন অ্যাকাউন্ট', accountHelp:'আপনার নাম ও সাইন-ইন নিরাপত্তা পরিচালনা করুন।', name:'অ্যাডমিনের নাম', email:'সাইন-ইন ইমেইল', saveName:'নাম সংরক্ষণ করুন', nameSaved:'আপনার নাম আপডেট হয়েছে।',
  password:'পাসওয়ার্ড পরিবর্তন', current:'বর্তমান পাসওয়ার্ড', next:'নতুন পাসওয়ার্ড', confirm:'নতুন পাসওয়ার্ড নিশ্চিত করুন', passwordHelp:'কমপক্ষে ১২টি অক্ষর ব্যবহার করুন। অন্য সেশনগুলো থেকে সাইন আউট হবে।', passwordSave:'পাসওয়ার্ড আপডেট করুন', passwordSaved:'পাসওয়ার্ড আপডেট হয়েছে। আপনার বর্তমান সেশন সুরক্ষিত।', mismatch:'নতুন পাসওয়ার্ড দুটি মিলছে না।', passwordLength:'কমপক্ষে ১২টি অক্ষর এবং সর্বোচ্চ ৭২ বাইট ব্যবহার করুন।',
  delete:'মুছুন', cancel:'বাতিল', deleting:'মুছে ফেলা হচ্ছে…', title:'এই রেকর্ডটি মুছবেন?', deleteHelp:'রেকর্ডটি ট্র্যাশে যাবে। পরে পুনরুদ্ধার করতে পারবেন। অর্ডার ও ইনভয়েসের তথ্য সংরক্ষিত থাকবে।', customerHelp:'নিবন্ধিত ক্রেতা মুছে ফেললে তার সাইন-ইন বন্ধ হবে। পুনরুদ্ধার করলে অ্যাকাউন্টের আগের অবস্থা ফিরবে।', productHelp:'পণ্যটি ওয়েবসাইট থেকে সরানো হবে। পুনরুদ্ধারের পর খসড়া হিসেবে পর্যালোচনা করে প্রকাশ করুন।',
  trash:'ট্র্যাশ', trashHelp:'তালিকা থেকে সরানো রেকর্ড পুনরুদ্ধার করুন।', orders:'অর্ডার', customers:'ক্রেতা', products:'পণ্য', record:'রেকর্ড', deleted:'মুছে ফেলার তারিখ', actions:'কাজ', restore:'পুনরুদ্ধার', restored:'রেকর্ড পুনরুদ্ধার হয়েছে।', empty:'ট্র্যাশ খালি।', previous:'আগেরটি', nextPage:'পরেরটি', loadError:'রেকর্ড লোড হয়নি। আবার চেষ্টা করুন।', retry:'আবার চেষ্টা করুন', error:'আপডেট সম্পন্ন হয়নি।',
  openOrder:'মুছে ফেলার আগে অর্ডার বাতিল বা সম্পন্ন করুন। এতে স্টক ও পেমেন্টের হিসাব সঠিক থাকবে।', openReturn:'অর্ডার মুছে ফেলার আগে রিটার্নের অনুরোধ নিষ্পত্তি করুন।', protected:'ক্রেতার তালিকা থেকে অ্যাডমিন বা কর্মীর অ্যাকাউন্ট মুছে ফেলা যাবে না।', denied:'শুধু অনুমোদিত অ্যাডমিন বা ম্যানেজার রেকর্ড মুছতে ও পুনরুদ্ধার করতে পারেন।', incorrect:'বর্তমান পাসওয়ার্ড সঠিক নয়',
}
export function useAdminText() {
  const {locale} = useI18n()
  return (key: keyof typeof en) => (locale === 'bn' ? bn : en)[key]
}
export function managementError(code: string | undefined, message: string | undefined, text: ReturnType<typeof useAdminText>) {
  const keys: Record<string,keyof typeof en> = { order_still_open:'openOrder', return_still_open:'openReturn', protected_account:'protected', current_password_incorrect:'incorrect', forbidden:'denied', permission_denied:'denied' }
  return code && keys[code] ? text(keys[code]) : code && message ? message : text('error')
}
