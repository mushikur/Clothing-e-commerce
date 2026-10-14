import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { ReactNode } from 'react'
import { Icon } from './Icon'
import { Badge, Button, IconButton, Modal } from './ui'
import { storefrontImageLoading } from '../lib/images'
import { useI18n } from '../i18n/I18nProvider'

export type ResponsiveImageVariant = { label: string; url: string; width: number; height: number; format?: string }
export type ProductImage = { url?: string; src?: string; alt?: string; sortOrder?: number; width?: number; height?: number; responsiveVariants?: ResponsiveImageVariant[] }
export type ProductVariant = { id: string; sku: string; color: string; colorCode?: string; size: string; price: number; compareAtPrice?: number; currency: string; stock: number; available: boolean; images?: ProductImage[] }
export type Product = {
  id: string; name: string; category: string; price: number; currency?: string; discountPercent?: number; compareAt?: number; rating?: number; reviews?: number
  image: string; alt: string; imageWidth?: number; imageHeight?: number; imageResponsiveVariants?: ResponsiveImageVariant[]; colors?: { name: string; value: string; images?: ProductImage[] }[]; label?: string; description?: string; material?: string; fabric?: string; brand?: string; gender?: string; season?: string; slug?: string; variants?: ProductVariant[]; images?: ProductImage[]
}

export function Price({ amount, compareAt, currency = 'USD', locale = 'en-US' }: { amount: number; compareAt?: number; currency?: string; locale?: string }) {
  const { locale: selectedLocale } = useI18n()
  const formatter = new Intl.NumberFormat(locale === 'en-US' ? selectedLocale === 'bn' ? 'bn-BD' : 'en-BD' : locale, { style: 'currency', currency })
  return <span className="price"><span>{formatter.format(amount)}</span>{compareAt && compareAt > amount ? <><span className="price__old">{formatter.format(compareAt)}</span></> : null}</span>
}
export function Rating({ value, count }: { value: number; count?: number }) {
  const { t } = useI18n()
  return <span className="rating" aria-label={t('delight.rating', { value: value.toFixed(1), count: count || 0 })}><span aria-hidden="true">★</span>{value.toFixed(1)}{count !== undefined && <span className="rating__count">({count})</span>}</span>
}
export function ColorSelector({ colors, value, onChange }: { colors: Product['colors']; value?: string; onChange?: (name: string) => void }) {
  const { t } = useI18n()
  if (!colors?.length) return null
  return <div className="color-selector" role="group" aria-label={t('product.color')}>{colors.map((color) => <button key={color.name} className={`color-selector__swatch ${value === color.name ? 'is-selected' : ''}`} style={{ '--swatch': color.value } as CSSProperties} aria-label={color.name} aria-pressed={value === color.name} onClick={() => onChange?.(color.name)}><span /></button>)}</div>
}
export function SizeSelector({ sizes, value, onChange, disabledSizes = [] }: { sizes: string[]; value?: string; onChange?: (size: string) => void; disabledSizes?: string[] }) {
  const { t } = useI18n()
  return <div className="size-selector" role="group" aria-label={t('delight.chooseSize')}>{sizes.map((size) => <button key={size} disabled={disabledSizes.includes(size)} className={`size-selector__item ${value === size ? 'is-selected' : ''}`} aria-pressed={value === size} onClick={() => onChange?.(size)}>{size}</button>)}</div>
}
export function AddToCartButton({ onClick, added = false, disabled = false, loading = false }: { onClick?: () => void; added?: boolean; disabled?: boolean; loading?: boolean }) {
  const { t } = useI18n()
  return <Button className="add-to-cart" onClick={onClick} disabled={disabled} loading={loading}>{added ? <><Icon name="check" /> {t('product.added')}</> : <>{loading ? t('product.adding') : t('product.addToCart')} {!loading && <Icon name="bag" />}</>}</Button>
}
export function WishlistButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  const { t } = useI18n()
  return <IconButton className={`wishlist-button ${active ? 'is-wished' : ''}`} icon="heart" label={active ? t('delight.removeWishlist') : t('common.wishlist')} aria-pressed={active} onClick={onClick} />
}

export function ProductCard({ product, wished = false, onWishlist, onAdd, onBuyNow, onQuickView }: { product: Product; wished?: boolean; onWishlist?: () => void; onAdd?: (product: Product, variant?: ProductVariant) => void; onBuyNow?: (product: Product, variant?: ProductVariant) => void; onQuickView?: () => void }) {
  const { t } = useI18n()
  const [quickOpen, setQuickOpen] = useState(false)
  const [selectedColor, setSelectedColor] = useState(product.colors?.[0]?.name)
  const openQuickView = () => { setQuickOpen(true); onQuickView?.() }
  const colorImage = product.colors?.find((color) => color.name === selectedColor)?.images?.[0]
  const colorImages = product.colors?.find((color) => color.name === selectedColor)?.images
  const primaryImage = colorImage || product.images?.[0] || { src: product.image, alt: product.alt, width: product.imageWidth, height: product.imageHeight, responsiveVariants: product.imageResponsiveVariants }
  const secondaryImage = colorImages?.length ? colorImages[1] : product.images?.[1]
  const primarySrc = primaryImage.url || primaryImage.src || product.image
  const primarySrcSet = primaryImage.responsiveVariants?.map((variant) => `${variant.url} ${variant.width}w`).join(', ')
  const secondarySrc = secondaryImage?.url || secondaryImage?.src
  const unavailable = Boolean(product.variants?.length && !product.variants.some((variant) => variant.available))
  const discount = product.compareAt && product.compareAt > product.price ? Math.round((1 - product.price / product.compareAt) * 100) : 0
  return <article className="product-card">
    <div className={`product-card__media${secondarySrc ? ' has-secondary-image' : ''}`}><a className="product-card__image-link" href={product.slug ? `/products/${product.slug}` : "/shop"} aria-label={product.name}><img className="product-card__image-main" src={primarySrc} srcSet={primarySrcSet} sizes="(max-width: 640px) 50vw, (max-width: 1200px) 33vw, 25vw" width={primaryImage.width} height={primaryImage.height} alt={primaryImage.alt || product.alt} loading={storefrontImageLoading()} decoding="async" />{secondarySrc && <img className="product-card__image-alternate" src={secondarySrc} alt="" aria-hidden="true" loading="lazy" decoding="async" />}</a>{discount > 0 && <span className="product-card__sale">{t("delight.sale", { percent: discount })}</span>}{unavailable && <span className="product-card__stock">{t("delight.soldOut")}</span>}{product.label && <Badge tone={product.label === 'New arrival' ? 'neutral' : 'accent'}>{product.label}</Badge>}<WishlistButton active={wished} onClick={onWishlist ?? (() => undefined)} /><button className="product-card__quick" onClick={openQuickView}>{t('delight.quickView')}</button></div>
    <div className="product-card__info"><div className="product-card__meta"><span>{product.category}</span>{product.rating && <Rating value={product.rating} count={product.reviews} />}</div><a className="product-card__name" href={product.slug ? `/products/${product.slug}` : '#product'}>{product.name}</a><Price amount={product.price} compareAt={product.compareAt} currency={product.currency} /><ColorSelector colors={product.colors} value={selectedColor} onChange={setSelectedColor} /><button className="product-card__add" onClick={openQuickView}>{t('delight.selectOptions')} <Icon name="arrow" /></button></div>
    <QuickView product={product} initialColor={selectedColor} open={quickOpen} onClose={() => setQuickOpen(false)} onAdd={(variant) => onAdd?.(product, variant)} onBuyNow={(variant) => onBuyNow?.(product, variant)} />
  </article>
}
export function ProductGrid({ products, onAdd, onBuyNow, wished = [], onWishlist }: { products: Product[]; onAdd?: (product: Product, variant?: ProductVariant) => void; onBuyNow?: (product: Product, variant?: ProductVariant) => void; wished?: string[]; onWishlist?: (product: Product) => void }) {
  return <div className="product-grid">{products.map((product) => <ProductCard key={product.id} product={product} wished={wished.includes(product.id)} onWishlist={() => onWishlist?.(product)} onAdd={onAdd} onBuyNow={onBuyNow} />)}</div>
}
export function ProductGallery({ images, name, allowZoom = true }: { images: ProductImage[]; name: string; allowZoom?: boolean }) {
  const { t } = useI18n()
  const [active, setActive] = useState(0)
  const [zoomOpen, setZoomOpen] = useState(false)
  const touchStart = useRef<number | null>(null)
  const ImageSurface = allowZoom ? 'button' : 'div'
  useEffect(() => { setActive(0) }, [images])
  const current = images[active] || images[0]
  const src = (image?: ProductImage) => image?.url || image?.src || ''
  const srcSet = current?.responsiveVariants?.map((variant) => `${variant.url} ${variant.width}w`).join(', ')
  const move = (direction: number) => { if (images.length > 1) setActive((value) => (value + direction + images.length) % images.length) }
  const controls = images.length > 1 ? <div className="gallery__controls"><IconButton icon="arrow" label={t('delight.previousImage')} className="gallery__previous" onClick={() => move(-1)} /><span aria-live="polite">{t('delight.imageCount', { current: active + 1, total: images.length })}</span><IconButton icon="arrow" label={t('delight.nextImage')} onClick={() => move(1)} /></div> : null
  return <><div className="gallery" onKeyDown={(event) => { if (event.key === 'ArrowRight') { event.preventDefault(); move(1) } if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1) } }}><ImageSurface className={`gallery__main${allowZoom ? "" : " gallery__main--static"}`} onClick={() => { if (allowZoom) setZoomOpen(true) }} aria-label={allowZoom ? t('product.zoom') : t('product.image')} onTouchStart={(event) => { touchStart.current = event.changedTouches[0].clientX }} onTouchEnd={(event) => { if (touchStart.current !== null) { const distance = event.changedTouches[0].clientX - touchStart.current; if (Math.abs(distance) > 45) { event.preventDefault(); move(distance < 0 ? 1 : -1) } touchStart.current = null } }}><img key={src(current)} src={src(current)} srcSet={srcSet} sizes="(max-width: 900px) 100vw, 55vw" width={current?.width} height={current?.height} alt={current?.alt || name} decoding="async" {...{ fetchpriority: 'high' }} /></ImageSurface>{controls}<div className="gallery__thumbs" role="group" aria-label={`${name} ${t('product.images')}`}>{images.map((image, index) => <button key={`${src(image)}-${index}`} className={active === index ? 'is-active' : ''} aria-label={`${t('product.showImage')} ${index + 1}`} aria-pressed={active === index} onClick={() => setActive(index)}><img src={src(image)} alt="" loading="lazy" decoding="async" /></button>)}</div></div><Modal open={zoomOpen} onClose={() => setZoomOpen(false)} title={`${name} ${t('product.image')}`} className="gallery-zoom"><div onKeyDown={(event) => { if (event.key === 'ArrowRight') move(1); if (event.key === 'ArrowLeft') move(-1) }}><img src={src(current)} srcSet={srcSet} sizes="90vw" alt={current?.alt || name} decoding="async" />{controls}</div></Modal></>
}
export function QuickView({ product, initialColor, open, onClose, onAdd, onBuyNow }: { product: Product; initialColor?: string; open: boolean; onClose: () => void; onAdd?: (variant?: ProductVariant) => void; onBuyNow?: (variant?: ProductVariant) => void }) {
  const { t } = useI18n()
  const [selectedColor, setSelectedColor] = useState(product.colors?.[0]?.name)
  const [selectedSize, setSelectedSize] = useState<string>()
  useEffect(() => { if (open) { setSelectedColor(initialColor || product.colors?.[0]?.name); setSelectedSize(undefined) } }, [open, initialColor, product.id])
  const variants = product.variants ?? []
  const sizes = [...new Set(variants.filter((variant) => !selectedColor || variant.color === selectedColor).map((variant) => variant.size))]
  const selectedVariant = variants.find((variant) => variant.color === selectedColor && variant.size === selectedSize)
  const color = product.colors?.find((item) => item.name === selectedColor)
  const images = color?.images?.length ? color.images : product.images?.length ? product.images : [{ src: product.image, alt: product.alt }]
  const variantBasePrice = selectedVariant ? selectedVariant.price / 100 : product.price
  const variantPrice = selectedVariant && product.discountPercent ? Math.round(selectedVariant.price * (100 - product.discountPercent) / 100) / 100 : variantBasePrice
  const variantCompareAt = selectedVariant?.compareAtPrice ? selectedVariant.compareAtPrice / 100 : selectedVariant && product.discountPercent ? variantBasePrice : product.compareAt
  const currency = selectedVariant?.currency || product.currency
  return <Modal open={open} onClose={onClose} title={t('delight.quickView')} className="quick-view"><div className="quick-view__image"><ProductGallery key={`${product.id}-${selectedColor}`} images={images} name={product.name} allowZoom={false} /></div><div className="quick-view__content"><p className="eyebrow">{product.category}</p><h3>{product.name}</h3>{product.rating && <Rating value={product.rating} count={product.reviews} />}<Price amount={variantPrice} compareAt={variantCompareAt} currency={currency} /><p className="muted">{product.description ?? ''}</p>{product.colors?.length ? <><p className="eyebrow">{t('product.color')} · {selectedColor}</p><ColorSelector colors={product.colors} value={selectedColor} onChange={(value) => { setSelectedColor(value); setSelectedSize(undefined) }} /></> : null}<p className="eyebrow">{t('delight.chooseSize')}</p><SizeSelector sizes={sizes} value={selectedSize} disabledSizes={sizes.filter((size) => !variants.some((variant) => variant.color === selectedColor && variant.size === size && variant.available))} onChange={setSelectedSize} />{!selectedVariant?.available && selectedSize && <p className="muted">{t('product.outOfStock')}</p>}<details className="size-guide"><summary>{t('product.sizeGuide')}</summary><p>{t('delight.sizeHelpCopy')}</p></details><AddToCartButton disabled={!selectedVariant?.available} onClick={() => { onAdd?.(selectedVariant); onClose() }} /><button className="quick-view__buy" disabled={!selectedVariant?.available} onClick={() => { onBuyNow?.(selectedVariant); onClose() }}>{t('product.buyNow')} <Icon name="arrow" /></button><a className="link-arrow" href={product.slug ? `/products/${product.slug}` : '#product'} onClick={onClose}>{t('product.viewDetails')} <Icon name="arrow" /></a></div></Modal>
}

export function FeatureNote({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) { return <div className="feature-note"><span>{icon}</span><div><strong>{title}</strong><p>{children}</p></div></div> }
