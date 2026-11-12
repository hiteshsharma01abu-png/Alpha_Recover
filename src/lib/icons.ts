/** Local Iconify SVGs in /public/icons — no CDN (avoids rate-limits / broken imgs). */
export const ICONIFY = '/icons';
export const ICON_MINT = 'mint';
export const ICON_WHITE = 'white';
export const ICON_DARK = 'dark';
export const ICON_IVORY = 'ivory';
export const ICON_WA = 'wa';

/** @deprecated kept for callers that still pass encoded hex colors */
const COLOR_ALIAS: Record<string, string> = {
  '%237DFFC0': 'mint',
  '%23FFFFFF': 'white',
  '%2306120E': 'dark',
  '%23F0EDE4': 'ivory',
  '%2325D366': 'wa',
  '#7DFFC0': 'mint',
  '#FFFFFF': 'white',
  '#06120E': 'dark',
  '#F0EDE4': 'ivory',
  '#25D366': 'wa',
  mint: 'mint',
  white: 'white',
  dark: 'dark',
  ivory: 'ivory',
  wa: 'wa',
};

export function iconSrc(name: string, color: string = ICON_MINT): string {
  const variant = COLOR_ALIAS[color] ?? 'mint';
  const file = `${name.replace('/', '__')}__${variant}.svg`;
  return `${ICONIFY}/${file}`;
}

export const icons = {
  school: iconSrc('lucide/graduation-cap'),
  shield: iconSrc('lucide/shield'),
  shieldCheck: iconSrc('lucide/shield-check'),
  headphones: iconSrc('lucide/headphones'),
  phone: iconSrc('lucide/phone'),
  mail: iconSrc('lucide/mail'),
  mapPin: iconSrc('lucide/map-pin'),
  layers: iconSrc('lucide/layers'),
  info: iconSrc('lucide/info'),
  link: iconSrc('lucide/link-2'),
  refresh: iconSrc('lucide/refresh-cw'),
  award: iconSrc('lucide/award'),
  share: iconSrc('lucide/share-2'),
  crown: iconSrc('lucide/crown', ICON_DARK),
  trendingUp: iconSrc('lucide/trending-up'),
  clock: iconSrc('lucide/clock'),
  play: iconSrc('lucide/play'),
  playDark: iconSrc('lucide/play', ICON_DARK),
  search: iconSrc('lucide/search'),
  hardDrive: iconSrc('lucide/hard-drive'),
  laptop: iconSrc('lucide/laptop'),
  cpu: iconSrc('lucide/cpu'),
  settings: iconSrc('lucide/settings'),
  folder: iconSrc('lucide/folder'),
  binary: iconSrc('lucide/binary'),
  database: iconSrc('lucide/database'),
  monitorPlay: iconSrc('lucide/monitor-play'),
  users: iconSrc('lucide/users'),
  fileBadge: iconSrc('lucide/file-badge'),
  camera: iconSrc('lucide/camera'),
  wrench: iconSrc('lucide/wrench'),
  globe: iconSrc('lucide/globe'),
  infinity: iconSrc('lucide/infinity'),
  bookOpen: iconSrc('lucide/book-open'),
  circuitBoard: iconSrc('lucide/circuit-board'),
  video: iconSrc('lucide/clapperboard'),
  portal: iconSrc('lucide/layout-dashboard'),
  lock: iconSrc('lucide/lock'),
  photo: iconSrc('lucide/image'),
  memory: iconSrc('lucide/memory-stick'),
  cctv: iconSrc('mdi/cctv'),
  shredder: iconSrc('mdi/shredder'),
  flash: iconSrc('mdi/usb-flash-drive'),
  cellphone: iconSrc('mdi/cellphone'),
  tools: iconSrc('mdi/hammer-wrench'),
  chip: iconSrc('mdi/chip'),
  blog: iconSrc('mdi/post-outline'),
  certificate: iconSrc('mdi/certificate-outline'),
  domain: iconSrc('mdi/domain'),
  tag: iconSrc('mdi/tag-outline'),
  youtube: iconSrc('mdi/youtube', ICON_WHITE),
  linkedin: iconSrc('mdi/linkedin', ICON_WHITE),
  facebook: iconSrc('mdi/facebook', ICON_WHITE),
  instagram: iconSrc('mdi/instagram', ICON_WHITE),
  gauge: iconSrc('lucide/gauge'),
  eye: iconSrc('lucide/eye'),
  calendar: iconSrc('lucide/calendar'),
  languages: iconSrc('lucide/languages'),
  fileText: iconSrc('lucide/file-text'),
  chevronRight: iconSrc('lucide/chevron-right'),
  arrowUp: iconSrc('lucide/arrow-up', ICON_DARK),
  whatsapp: iconSrc('mdi/whatsapp', ICON_WA),
  whatsappWhite: iconSrc('mdi/whatsapp', ICON_WHITE),
} as const;

/** White glyph for dark glass perk spheres */
export function whiteIcon(name: string): string {
  return iconSrc(name, ICON_WHITE);
}
