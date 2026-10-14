# Fashion commerce platform foundation

This repository contains a theme-ready React storefront UI and a separate Node.js/Express/MongoDB API. Authentication, profile, addresses, catalog, apparel variants, category browsing, product management, guest and customer carts, wishlist moves, coupon quotes, inventory-reserved order placement, order lifecycle, customer order history, and shipment tracking are connected to the API. Payments support cash on delivery and manual bKash/Nagad collection with admin verification. Live gateway APIs and courier booking are not connected.

## Run locally

```sh
npm install
npm run dev
```

Create a production bundle with `npm run build`.

## Backend

Copy `.env.example` to `backend/.env`, configure MongoDB and deployment secrets, then run `npm install` and `npm run dev` from `backend/`. Create a business and optional initial admin with `npm run seed:business`. Run backend checks with `npm test` from `backend/`.

Email verification and password recovery require SMTP settings (`SMTP_HOST`, `EMAIL_FROM`, and, when required by the provider, `SMTP_USER` and `SMTP_PASSWORD`). Set `FRONTEND_URL` to the storefront origin used in account links. The storefront can use `VITE_API_URL`, `VITE_BUSINESS_SLUG`, `VITE_BUSINESS_NAME`, and `VITE_BUSINESS_CURRENCY` in a root `.env.local` when the API is hosted separately or needs an explicit tenant header. Product and inventory mutations use MongoDB transactions; use a replica set for local development or MongoDB Atlas.

Production deployments must set `COOKIE_SECURE=true`, use public HTTPS values for `FRONTEND_URL`, `API_PUBLIC_URL`, and every `CORS_ORIGINS` entry, and keep secrets in a deployment secret manager. The backend serves tenant-aware `robots.txt` and sitemap endpoints at `/robots.txt`, `/sitemap.xml`, `/sitemap-pages.xml`, and `/sitemap-products/:page.xml`; when the storefront and API use separate hosts, route those root paths through the storefront host to the API. The SPA updates canonical, Open Graph, and product metadata after it loads; use server rendering or prerendering if social crawlers that do not execute JavaScript must receive product previews. The API applies Helmet to API responses; configure equivalent headers at the static storefront host. Use a shared rate-limit store before scaling the API to multiple instances.

## Design system

- Global color, typography, spacing, radius, shadow, width, and motion tokens live in `src/styles/tokens.css`.
- Shared accessible controls and patterns live in `src/components/ui.tsx`.
- Storefront-specific product primitives live in `src/components/commerce.tsx`.
- The route shell lives in `src/App.tsx`; customer storefront composition lives in `src/features/storefront/CustomerSite.tsx` and its responsive styles.
- Admin theme editing and preview live at `/admin/theme`; draft/published business pages are managed at `/admin/content`.
- Homepage composition and reusable landing pages are managed at `/admin/pages`; section content is schema-validated and published at `/` or its configured `/:slug` path.
- Courier configuration is available at `/admin/couriers`; provider credentials use an application encryption key, and shipment booking remains disabled until official provider API contracts are verified.
- Published business branding, theme tokens, and CMS pages are served by the tenant-scoped `/api/v1/storefront` endpoints and applied by `src/features/storefront/StorefrontConfig.tsx`.
- Component styles are separated into `src/styles/components.css`.

To theme a business, provide its settings through configuration and map supported design values to the CSS custom properties. The `[data-theme="dark"]` token set demonstrates theme overrides; it is not tied to a particular merchant identity.

## Scope

The five-step checkout supports guests and signed-in customers, saved or new delivery addresses, per-business delivery options, coupons, order notes, and the enabled payment methods. Prices and stock are revalidated by the API; successful orders reserve inventory transactionally. Configure delivery and guest/COD availability with `PATCH /api/v1/admin/settings/checkout`, mobile wallet merchant instructions with `PUT /api/v1/admin/settings/payments`, and manage coupon codes under `/api/v1/admin/coupons`. `/admin/orders` manages the order lifecycle, payment verification, returns, refunds, and shipment tracking. Mobile wallet collection is manual; live gateway APIs and courier booking still need provider integration. Product admin and inventory ledger workflows are available under `/admin/products` for authorized staff roles.

## Image storage and optimization

Admin image uploads are managed at `/admin/media`, and product image uploads are available from `/admin/products`. The API validates upload size, declared MIME type, decoded image format, dimensions, and animation before processing JPEG, PNG, WebP, or AVIF images. SVG and other active formats are not accepted. Uploads are converted to tenant-scoped responsive WebP or AVIF variants, with optional originals, thumbnails, deduplication, alt text, and background re-optimization. Product cards and galleries use generated `srcset` metadata while legacy HTTP(S) image URLs remain supported.

Local storage is intended for development or a deployment with a persistent shared volume. Set `MEDIA_LOCAL_DIRECTORY` to that volume and `MEDIA_PUBLIC_BASE_URL` to its public CDN URL when applicable. For S3-compatible storage, set `MEDIA_STORAGE_PROVIDER=s3`, `MEDIA_S3_BUCKET`, `MEDIA_S3_REGION`, and optional endpoint/path-style settings. Credentials can come from the standard AWS credential chain or the paired `MEDIA_S3_ACCESS_KEY_ID` / `MEDIA_S3_SECRET_ACCESS_KEY` variables. Set `MEDIA_PUBLIC_BASE_URL` to a public bucket/CDN origin so storefront browsers can read optimized images. The application does not make private S3 objects public; configure bucket/CDN access separately. Background jobs are stored in MongoDB and claimed with atomic worker leases, so API replicas must share the same durable MongoDB database.

