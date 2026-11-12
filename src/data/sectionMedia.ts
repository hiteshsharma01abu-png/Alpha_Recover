/** Content-matched photos for home sections (local compressed `/assets` WebP). */

import { icons } from '../lib/icons';

export const recoverySolutionImages: Record<string, string> = {
  logical: '/assets/logical.webp',
  electrical: '/assets/pcb.webp',
  mechanical: '/assets/mechanical.webp',
  firmware: '/assets/firmware.webp',
};

export const trainingTrackImages: Record<string, string> = {
  logical: '/assets/logical.webp',
  electrical: '/assets/pcb.webp',
  mechanical: '/assets/mechanical.webp',
  'firmware-basic': '/assets/firmware.webp',
  mrt: '/assets/pro-electronics.webp',
  media: '/assets/track-media.webp',
  electronics: '/assets/pro-electronics.webp',
  basics: '/assets/training.webp',
  bitlocker: '/assets/demo-bitlocker.webp',
};

export const proTrainingImages: Record<string, string> = {
  recovery: '/assets/hero-drive.webp',
  firmware: '/assets/firmware.webp',
  electronics: '/assets/pro-electronics.webp',
};

export { demoVideoImages } from '../components/visuals/demoVisuals';

export const fallbackSectionImage = '/assets/training.webp';

export const whyLearnImages: Record<string, string> = {
  cyber: '/assets/hero-drive.webp',
  photo: '/assets/why-photo.webp',
  it: '/assets/why-it.webp',
  online: '/assets/why-online.webp',
  assets: '/assets/hero-drive.webp',
  institutes: '/assets/why-institutes.webp',
};

export const whyLearnIconSrc: Record<string, string> = {
  cyber: icons.shield,
  photo: icons.camera,
  it: icons.wrench,
  online: icons.globe,
  assets: icons.shieldCheck,
  institutes: icons.cpu,
};

/** Floating accent badges over card product images (Iconify CDN). */
export const whyLearnBadgeSrc: Record<string, string | undefined> = {
  cyber: icons.shield,
  photo: undefined,
  it: icons.wrench,
  online: icons.whatsapp,
  assets: icons.shield,
  institutes: icons.school,
};
