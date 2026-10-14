export type PageMetadata = {
  title: string
  description?: string
  canonical?: string
  image?: string
  type?: 'website' | 'product' | 'article'
  robots?: string
  structuredData?: Record<string, unknown>
}

function meta(selector: string, attribute: 'name' | 'property', key: string, content: string | undefined) {
  let node = document.head.querySelector<HTMLMetaElement>(selector)
  if (!content) { node?.remove(); return }
  if (!node) { node = document.createElement('meta'); node.setAttribute(attribute, key); document.head.append(node) }
  node.content = content
}

export function setPageMetadata(data: PageMetadata) {
  document.title = data.title
  meta('meta[name="description"]', 'name', 'description', data.description)
  meta('meta[name="robots"]', 'name', 'robots', data.robots || 'index,follow')
  meta('meta[property="og:title"]', 'property', 'og:title', data.title)
  meta('meta[property="og:description"]', 'property', 'og:description', data.description)
  meta('meta[property="og:type"]', 'property', 'og:type', data.type || 'website')
  meta('meta[property="og:url"]', 'property', 'og:url', data.canonical)
  meta('meta[property="og:image"]', 'property', 'og:image', data.image)
  meta('meta[name="twitter:card"]', 'name', 'twitter:card', data.image ? 'summary_large_image' : 'summary')
  meta('meta[name="twitter:title"]', 'name', 'twitter:title', data.title)
  meta('meta[name="twitter:description"]', 'name', 'twitter:description', data.description)
  meta('meta[name="twitter:image"]', 'name', 'twitter:image', data.image)

  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (data.canonical) {
    if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.append(canonical) }
    canonical.href = data.canonical
  } else canonical?.remove()

  let structured = document.getElementById('storefront-structured-data') as HTMLScriptElement | null
  if (data.structuredData) {
    if (!structured) { structured = document.createElement('script'); structured.id = 'storefront-structured-data'; structured.type = 'application/ld+json'; document.head.append(structured) }
    structured.textContent = JSON.stringify(data.structuredData)
  } else structured?.remove()
}

export function absoluteStorefrontUrl(path: string) { return new URL(path, window.location.origin).toString() }
