import type { SVGProps } from 'react'

export type IconName = 'search' | 'user' | 'bag' | 'heart' | 'menu' | 'close' | 'arrow' | 'chevron' | 'plus' | 'minus' | 'check' | 'filter' | 'truck' | 'sparkle' | 'document' | 'grid' | 'chart' | 'box' | 'settings' | 'palette' | 'image' | 'tag'

const paths: Record<IconName, React.ReactNode> = {
  document: <><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h4M9 12h6M9 16h6"/></>,
  grid: <><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/></>,
  chart: <><path d="M4 3v18h17M8 16v-5M13 16V7M18 16V4"/></>,
  box: <><path d="m3 7 9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10M8 5l9 4"/></>,
  settings: <><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="10" cy="18" r="2"/></>,
  palette: <><path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 0-4h-1a2 2 0 0 1 0-4h5a4 4 0 0 0 4-4c0-3-4-6-9-6Z"/><path d="M7 8h.01M11 6h.01M16 7h.01M6 13h.01"/></>,
  image: <><path d="M3 3h18v18H3zM3 17l6-6 4 4 3-3 5 5"/><circle cx="16" cy="7" r="1"/></>,
  tag: <><path d="m3 3 8 0 10 10-8 8L3 11z"/><circle cx="7" cy="7" r="1"/></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  bag: <><path d="M5 8h14l1 13H4L5 8Z" /><path d="M9 8a3 3 0 0 1 6 0" /></>,
  heart: <path d="M20.8 8.8c0 5.1-8.8 10-8.8 10s-8.8-4.9-8.8-10a4.6 4.6 0 0 1 8.8-1.7 4.6 4.6 0 0 1 8.8 1.7Z" />,
  menu: <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>,
  close: <><path d="m6 6 12 12" /><path d="M18 6 6 18" /></>,
  arrow: <><path d="M4 12h15" /><path d="m13 5 7 7-7 7" /></>,
  chevron: <path d="m7 10 5 5 5-5" />,
  plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  minus: <path d="M5 12h14" />,
  check: <path d="m5 12 4 4L19 6" />,
  filter: <><path d="M4 7h16" /><path d="M7 12h10" /><path d="M10 17h4" /></>,
  truck: <><path d="M3 6h11v12H3z" /><path d="M14 10h4l3 3v5h-7" /><circle cx="7.5" cy="18" r="1.5" /><circle cx="17.5" cy="18" r="1.5" /></>,
  sparkle: <><path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z" /><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z" /></>,
}

export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  const { className, ...svgProps } = props
  return <svg viewBox="0 0 24 24" aria-hidden="true" {...svgProps} className={`icon-svg ${className ?? ''}`}>{paths[name]}</svg>
}
