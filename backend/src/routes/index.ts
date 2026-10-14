import { Router } from 'express'
import { authRoutes } from '../modules/auth/auth.routes.js'
import { productRoutes } from '../modules/products/products.routes.js'
import { userRoutes } from '../modules/users/users.routes.js'
import { adminCategoryRoutes, categoryRoutes } from '../modules/products/categories.routes.js'
import { adminProductRoutes } from '../modules/products/admin-products.routes.js'
import { cartRoutes } from '../modules/cart/cart.routes.js'
import { healthRoutes } from './health.routes.js'
import { adminCheckoutRoutes, checkoutRoutes } from '../modules/checkout/checkout.routes.js'
import { adminCouponRoutes } from '../modules/checkout/coupons.routes.js'
import { adminOrderRoutes, adminPaymentSettingsRoutes } from '../modules/orders/orders.routes.js'
import { adminAnalyticsRoutes } from '../modules/admin/admin.routes.js'
import { adminPromotionRoutes } from '../modules/admin/promotions.routes.js'
import { adminContentRoutes, adminThemeRoutes } from '../modules/admin/customizer.routes.js'
import { storefrontRoutes } from '../modules/storefront/storefront.routes.js'
import { adminLandingPageRoutes, adminHomepageRoutes } from '../modules/admin/page-builder.routes.js'
import { adminCourierRoutes } from '../modules/couriers/couriers.routes.js'
import { seoRoutes } from '../modules/seo/seo.routes.js'
import { adminMediaRoutes } from '../modules/media/media.routes.js'
import { adminDeliveryRoutes, shippingRoutes } from '../modules/checkout/delivery.routes.js'

export const apiRoutes = Router()
apiRoutes.use('/health', healthRoutes)
apiRoutes.use('/auth', authRoutes)
apiRoutes.use('/users', userRoutes)
apiRoutes.use('/cart', cartRoutes)
apiRoutes.use('/checkout', checkoutRoutes)
apiRoutes.use('/shipping', shippingRoutes)
apiRoutes.use('/products', productRoutes)
apiRoutes.use('/categories', categoryRoutes)
apiRoutes.use('/admin/products', adminProductRoutes)
apiRoutes.use('/admin/categories', adminCategoryRoutes)
apiRoutes.use('/admin/settings', adminCheckoutRoutes)
apiRoutes.use('/admin/settings', adminDeliveryRoutes)
apiRoutes.use('/admin/coupons', adminCouponRoutes)
apiRoutes.use('/admin/orders', adminOrderRoutes)
apiRoutes.use('/admin/settings', adminPaymentSettingsRoutes)
apiRoutes.use('/admin', adminAnalyticsRoutes)
apiRoutes.use('/admin/promotions', adminPromotionRoutes)
apiRoutes.use('/admin/themes', adminThemeRoutes)
apiRoutes.use('/admin/content', adminContentRoutes)
apiRoutes.use('/admin/homepage', adminHomepageRoutes)
apiRoutes.use('/admin/landing-pages', adminLandingPageRoutes)
apiRoutes.use('/admin/couriers', adminCourierRoutes)
apiRoutes.use('/admin/media', adminMediaRoutes)
apiRoutes.use('/storefront', storefrontRoutes)
apiRoutes.use('/seo', seoRoutes)
