import { icons, whiteIcon } from '../../lib/icons';

/** Icon image paths aligned 1:1 with `pricing.features` order in content.ts */
export const pricingFeatureIcons: string[] = [
  icons.video,
  icons.layers,
  icons.portal,
  icons.award,
  icons.binary,
  icons.headphones,
  icons.refresh,
  icons.bookOpen,
  icons.settings,
  icons.fileText,
  icons.hardDrive,
  icons.circuitBoard,
  icons.share,
  icons.photo,
  icons.lock,
  icons.cpu,
  icons.infinity,
];

/** Open HDD on a repair workbench: transparent cutout, shown uncropped in pp-hero-visual. */
export const pricingHeroVisual = { src: '/assets/images/sections/hdd-repair-workbench.webp', width: 960, height: 704 };

export const pricingPerks = [
  {
    id: 'lifetime',
    label: 'Lifetime Access',
    text: 'Pay Once. Use Forever. No Extra Costs.',
    iconSrc: whiteIcon('lucide/link-2'),
  },
  {
    id: 'updates',
    label: 'Regular Updates',
    text: 'Always Get the Latest Features & Updates.',
    iconSrc: whiteIcon('lucide/refresh-cw'),
  },
  {
    id: 'support',
    label: 'Expert Support',
    text: 'Expert Support, Whenever You Need It.',
    iconSrc: whiteIcon('lucide/headphones'),
  },
  {
    id: 'certificate',
    label: 'Certificate Provided',
    text: 'Earn a Verified Certificate Upon Completion.',
    iconSrc: whiteIcon('lucide/award'),
  },
  {
    id: 'workflows',
    label: 'Real Case Workflows',
    text: 'Learn Through Real-World Examples & Hands-On Workflows.',
    iconSrc: whiteIcon('lucide/share-2'),
  },
];
