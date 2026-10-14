# API foundation

Node.js, Express, TypeScript, MongoDB, and Mongoose backend for the clothing commerce platform.

## Setup

1. Copy `.env.example` to `.env` and set `MONGODB_URI` plus an `ACCESS_TOKEN_SECRET` (at least 32 characters in production). Configure `FRONTEND_URL`, `API_PUBLIC_URL`, `CORS_ORIGINS`, `SMTP_HOST`, and `EMAIL_FROM`; SMTP authentication values depend on your provider. Production requires public HTTPS origins and `COOKIE_SECURE=true`.
2. Install dependencies with `npm install` from this directory.
3. Start MongoDB, then run `npm run dev`.
4. To create a tenant and optional initial admin, set the `BOOTSTRAP_*` values and run `npm run seed:business`.

## Local demo dataset

Run `npm run seed:demo` only against a dedicated `fashion_commerce_demo` database. The seed refuses to run against a database with any other name. Set `MONGODB_URI`, `DEMO_ADMIN_EMAIL`, `DEMO_ADMIN_PASSWORD`, `DEMO_CUSTOMER_EMAIL`, `DEMO_CUSTOMER_PASSWORD`, and `DEMO_IMAGE_DIRECTORY` in the process environment. Demo passwords must be 12–72 UTF-8 bytes. The seed creates fictional catalog, inventory, order, customer, CMS, theme, promotion, and media records. bKash/Nagad references and all courier events are marked simulated; the script does not call a payment provider or courier API.

For browser QA, set the frontend's `VITE_API_URL` to its own origin and run the Vite dev server with the `/api` and `/media` proxy configured in `vite.config.ts`. Keep demo passwords out of `.env.example`, source control, and deployed environments.

## Routes implemented

All endpoints are under `/api/v1`:

- `GET /health/live` and `GET /health/ready`
- `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `POST /auth/refresh`, `GET /auth/me`
- `POST /auth/verify-email`, `POST /auth/resend-verification`, `POST /auth/forgot-password`, `POST /auth/reset-password`, `POST /auth/change-password`
- `PATCH /users/me`, `GET/POST /users/me/addresses`, `PATCH/DELETE /users/me/addresses/:addressId`
- `GET /users/me/orders`, `GET /users/me/orders/:orderId`, `GET /users/me/orders/:orderId/tracking`, `POST /users/me/orders/:orderId/payment-reference`, `POST /users/me/orders/:orderId/returns`, `GET /users/me/wishlist`, and `GET /users/me/notifications`
- `GET /products`, `GET /products/:slug`, `GET /products/:slug/reviews`, `GET /products/reviews/highlights`, `GET /products/best-sellers`, and `GET /products/trending`
- `GET /categories`
- `GET/POST /cart`, `POST /cart/items`, `PATCH/DELETE /cart/items/:variantId`
- `POST/DELETE /users/me/wishlist/:productId`
- `POST /users/me/wishlist/:productId/move-to-cart` validates the selected variant and atomically moves the saved product into the customer cart
- `GET /checkout/config`, `POST /checkout/quote`, and `POST /checkout/orders` for guest or authenticated checkout, server-calculated coupons and delivery, cash on delivery and manual bKash/Nagad collection, idempotency, and transactional inventory reservations
- `POST /checkout/orders/:orderId/payment-reference` accepts a guest transaction ID using a short-lived order access token returned only at guest order creation
- `PATCH /admin/settings/checkout` to configure guest checkout, cash on delivery, and delivery fees per business
- `GET/POST /admin/coupons` and `PATCH /admin/coupons/:couponId/status` for coupon management
- `PUT/DELETE /admin/coupons/:couponId` for coupon edits and safe removal (redeemed coupons are archived)
- `/admin/products` for catalog listing, create, update, duplicate, archive, bulk edits, and stock adjustments
- `/admin/categories` and `/admin/categories/subcategories` for tenant-scoped category maintenance
- `/admin/orders` for order review, lifecycle status changes, payment verification, return decisions, and shipment tracking
- `GET/PUT /admin/settings/payments` for per-business bKash/Nagad merchant instructions; the settings response never includes provider secrets
- `GET /admin/analytics`, `/admin/customers`, `/admin/inventory`, and `/admin/inventory/transactions` for tenant-scoped dashboard reporting, customer summaries, stock levels, and inventory history
- `GET/POST/PUT/DELETE /admin/promotions` for flash sales, discount campaigns, and featured collections
- `GET/PUT /admin/settings/site` for business identity, contact, currency, social links, and SEO settings
- `/admin/themes` for business-scoped theme drafts, eight preset families, validated design tokens, and atomic publishing
- `/admin/content` for draft/published About, Contact, FAQ, Privacy, Terms, Returns, and Shipping pages
- `GET /storefront/config` and `GET /storefront/pages/:slug` for public, tenant-scoped brand settings, published theme tokens, and published CMS content
- `/admin/homepage` for structured homepage and landing-page sections, including ordering and visibility controls
- `/admin/landing-pages` for tenant-scoped landing page drafts, publishing, SEO, and section ownership
- `GET /storefront/homepage` and `GET /storefront/landing/:slug` for published, tenant-scoped page composition
- `/admin/couriers/providers` for encrypted courier credentials, enablement, environment, pickup details, and default provider
- `/admin/couriers/providers/:providerId/test` and `/admin/couriers/logs` for explicit connection readiness and safe integration logs
- `POST /admin/orders/:orderId/shipment/create` for idempotency-protected shipment orchestration. Provider dispatch stays disabled until current official API contracts are verified.

Authentication is tenant-scoped. Resolve a tenant by its configured request domain or set the configured `x-business-slug` header for local API use. Access tokens are short-lived bearer JWTs; rotating refresh tokens are opaque, hashed in MongoDB, and delivered through an HTTP-only cookie. Refresh sessions are revoked after password reset or change. Account verification and reset links use single-use, hashed, expiring tokens. Roles are `super_admin`, `admin`, `manager`, `staff`, and `customer`; even a super admin token remains scoped to its selected storefront.

Courier credentials are encrypted with AES-256-GCM before being stored. Set `COURIER_CREDENTIALS_ENCRYPTION_KEY` to a dedicated 32-byte key encoded as 64 hexadecimal characters. Back it up in your secret manager and keep it stable; changing it makes stored credentials unreadable. Steadfast, Pathao, and RedX are intentionally shown as Configuration Required until the current API contracts are verified from official merchant documentation. Connection-test requests and shipment creation are not sent in this state. Manual carrier/tracking entry remains available in order management.

The included rate-limit store is process-local. Configure a shared store before running multiple API instances so the limit is consistent across replicas.

Public tenant-scoped SEO routes are available at `/robots.txt`, `/sitemap.xml`, `/sitemap-pages.xml`, and `/sitemap-products/:page.xml`, plus their `/api/v1/seo` equivalents. A storefront host that is separate from this API should reverse-proxy the root SEO paths to the API so crawlers find them at the canonical storefront origin. Helmet applies the API content security policy; static storefront hosting must set its own equivalent response headers. Product, category, landing-page, and content-page metadata is currently generated in the browser, so use server rendering or prerendering when sharing previews must work for crawlers that do not execute JavaScript.

Login, refresh, and logout enforce an allowlisted browser `Origin` because they create, rotate, or revoke cookie-backed sessions. Other authenticated APIs require a short-lived bearer access token. Uploaded files are not accepted by this API; CMS and product media use validated HTTP(S) URLs. Theme text colors are rejected when they do not meet the configured 4.5:1 contrast threshold against the theme background.

Product, variant, category, inventory, and immutable inventory transaction workflows are implemented. Product prices are stored as integer minor units; stock changes are recorded in the inventory ledger. Multi-document catalog and stock mutations use MongoDB transactions, so local MongoDB must run as a single-node replica set or use MongoDB Atlas. Payment and courier credentials should be stored in a secret manager; settings documents hold references rather than secret values.

Checkout reserves inventory in the same transaction as order, payment, and coupon redemption records. Order transitions are audited in a customer-visible timeline; shipping consumes reserved stock, cancellation releases it, and received returns restock it. The payment-provider interface supports cash on delivery and manual bKash/Nagad collection. Manual wallet payments display business-configured merchant instructions and require a store admin to verify the submitted transaction ID. Refunds must first be processed with the provider and then recorded by an admin. Live bKash/Nagad gateway APIs, Stripe, SSLCommerz, PayPal, and courier booking are not connected. Add server-side provider adapters and credentials before enabling automated gateway flows.

## Checks

`npm test` compiles the backend and runs the Node test suite. Tests use model validation and the liveness endpoint and do not require a running MongoDB server.

## Image media

Image uploads are available at `/api/v1/admin/media/upload`; the tenant-scoped library, settings, storage statistics, and background jobs live under `/api/v1/admin/media`. Configure the provider with `MEDIA_STORAGE_PROVIDER=local|s3`, `MEDIA_LOCAL_DIRECTORY`, `MEDIA_PUBLIC_BASE_URL`, and `MEDIA_MAX_UPLOAD_BYTES`. S3-compatible storage also uses `MEDIA_S3_BUCKET`, `MEDIA_S3_REGION`, optional `MEDIA_S3_ENDPOINT` / `MEDIA_S3_FORCE_PATH_STYLE`, and optional paired credentials. For local storage, persist and serve the configured directory; API static delivery is mounted at `/media`. For S3, configure public reads through a CDN or bucket policy and set `MEDIA_PUBLIC_BASE_URL` to that public HTTPS origin. Image codecs, local storage, and the HTTP media lifecycle are covered by automated tests; a live S3 integration requires deployment credentials and was not exercised here. Set `MEDIA_INTEGRATION_MONGODB_URI` to run the end-to-end acceptance test against a disposable MongoDB database. Workers claim queued jobs with atomic MongoDB leases, so API replicas must share the same durable database.

