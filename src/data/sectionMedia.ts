/** Content-matched photos for home sections (local compressed WebP in `/assets/images/sections/`). */

import { icons } from '../lib/icons';

export const recoverySolutionImages: Record<string, string> = {
  logical: '/assets/images/sections/logical.webp',
  electrical: '/assets/images/sections/pcb.webp',
  mechanical: '/assets/images/sections/mechanical.webp',
  firmware: '/assets/images/sections/firmware.webp',
};

export const trainingTrackImages: Record<string, string> = {
  logical: '/assets/images/sections/logical.webp',
  electrical: '/assets/images/sections/pcb.webp',
  mechanical: '/assets/images/sections/mechanical.webp',
  'firmware-basic': '/assets/images/sections/firmware.webp',
  mrt: '/assets/images/sections/pro-electronics.webp',
  media: '/assets/images/sections/track-media.webp',
  electronics: '/assets/images/sections/pro-electronics.webp',
  basics: '/assets/images/sections/training.webp',
  bitlocker: '/assets/images/sections/demo-bitlocker.webp',
};

export const proTrainingImages: Record<string, string> = {
  recovery: '/assets/images/sections/hero-drive.webp',
  firmware: '/assets/images/sections/firmware.webp',
  electronics: '/assets/images/sections/pro-electronics.webp',
};

export { demoVideoImages } from '../components/visuals/demoVisuals';

export const fallbackSectionImage = '/assets/images/sections/training.webp';

/** Transparent card illustrations (alpha-recovery-six-assets package), trimmed to their content and exported at 2×. */
const WHY_LEARN = '/assets/images/illustrations/why-learn';
export const whyLearnImages: Record<string, string> = {
  cyber: `${WHY_LEARN}/01-cybersecurity-experts.webp`,
  photo: `${WHY_LEARN}/02-photographers.webp`,
  it: `${WHY_LEARN}/03-it-careers.webp`,
  online: `${WHY_LEARN}/04-online-advantages.webp`,
  assets: `${WHY_LEARN}/05-protect-personal-assets.webp`,
  institutes: `${WHY_LEARN}/06-computer-institutes.webp`,
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
