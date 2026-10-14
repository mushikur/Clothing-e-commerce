# Payment instructions and clothing size guides

## Payment changes

- Saved the requested `01314808678` as the personal collection number for both bKash and Nagad in the current store's Admin → Payment settings. Existing enabled statuses were retained.
- Selecting a wallet immediately shows its saved number, account type, Copy number action, amount guidance, app steps, dial steps and transaction-ID instructions.
- Customers place an order first and use the confirmed total. The existing transaction-ID submission and administrator verification flow remains in use.
- bKash uses the `*247#` mobile menu, documented by [bKash Send Money](https://www.bkash.com/index.php/en/products-services/send-money). Nagad supports Send Money in its [official app](https://play.google.com/store/apps/details?id=com.konasl.nagad) and the `*167#` menu identified by [Nagad's official account](https://www.linkedin.com/posts/mynagad_%E0%A6%A8%E0%A6%97%E0%A6%A6-%E0%A6%8F%E0%A6%95%E0%A6%89%E0%A6%A8%E0%A7%8D%E0%A6%9F-%E0%A6%96%E0%A7%8B%E0%A6%B2%E0%A6%BE-%E0%A6%B8%E0%A6%AC%E0%A6%9A%E0%A7%87%E0%A6%AF%E0%A6%BC%E0%A7%87-%E0%A6%B8%E0%A6%B9%E0%A6%9C-activity-6763454185322233856-VmNK). The guide follows menu labels rather than assuming fixed option numbers.
- Personal accounts show Send Money; merchant accounts show Payment. Both remain configurable in Admin. Leaving custom instructions blank enables the built-in bilingual guide.
- New payment records snapshot the collection number, account type and custom instructions. Confirmation, customer order details and guest order details receive the snapshot, preserving payment instructions when Admin later changes a number.
- Existing legacy payment records retain their stored text. The change does not perform an external transfer or add automatic wallet verification.

## Clothing size guide

- Replaced the placeholder modal with a reusable guide covering T-shirts/polos, shirts/blouses, sweaters, hoodies, jackets/coats, trousers/jeans, shorts, Panjabi/kurta, dresses/skirts, salwar sets, sarees/unstitched fabric, underwear and sleepwear.
- Provides adult men/unisex and women reference charts, plus height-based children's and babies' charts.
- Includes inches/centimetres conversion, measurement instructions, garment-specific fit advice and a contact action.
- Chooses an initial clothing type from the product category/name/slug and an initial range from its gender. Customers can choose other categories and ranges.
- Charts are approximate body-measurement references, not certified universal sizing or measured specifications of the store's garments. Exact garment sizing remains product-specific. Sarees, unstitched fabric and bra sizing have explicit guidance instead of a universal fit claim.
- The guide module and its styles load when opened. Existing modal focus, Escape and keyboard behavior are reused; tables have captions and scoped headers.
- All new labels and instructions use the existing central English/Bangla translation system.

## Verification

- Frontend TypeScript/production build and backend TypeScript build passed.
- Saved the supplied number through the actual Admin interface and confirmed the saved message.
- Browser checked bKash and Nagad selection, recipient display, app/dial expansion and copy confirmation.
- Browser checked adult and baby charts, clothing-type selection, centimetre conversion, English and Bangla rendering.
- Measured mobile layout at 390 CSS pixels: checkout page and size guide had no horizontal page overflow; modal and guide fit within the viewport. Temporary viewport overrides were reset.
- Fresh mobile checkout reported no browser console errors.
- No real payment was sent or falsely marked paid during verification.

## Screenshots

- `personal-payment-settings.png`
- `bkash-personal-instructions.png`
- `bkash-send-money-guide.png`
- `clothing-size-guide.png`
- `size-guide-mobile-bn.png`
- `nagad-mobile-bn.png`
