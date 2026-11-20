import { icons, whiteIcon } from '../../lib/icons';

const U = (id: string, w = 1200, h = 360) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;

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

/** Open HDD actuator/platter — public Unsplash CDN (wide crop for pp-hero-visual). */
export const pricingHeroVisual = U('photo-1597852074816-d933c7d2b988');
export const pricingSectionBg = '/assets/images/backgrounds/pricing-bg.webp';

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
