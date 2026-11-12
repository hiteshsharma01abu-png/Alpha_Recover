import { ICONIFY, icons } from '../lib/icons';

const U = (id: string, w = 1200) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

/** Topic-matched Unsplash covers for each demo video heading/content */
export const demoVideoImages: Record<string, string> = {
  d1: U('photo-1597872200969-2b65d56bd16b'),
  d2: U('photo-1498050108023-c5249f4df085'),
  d3: U('photo-1518770660439-4636190af475'),
  d4: U('photo-1555617981-dac3880eac6e'),
  d5: U('photo-1581092160562-40aa08e78837'),
  d6: U('photo-1563986768609-322da13575f3'),
};

export const demoSectionBg = '';
export const demoPlayIcon = icons.playDark;
export const demoPlayIconMint = icons.play;
export const demoSearchIcon = icons.search;

export const demoCategoryIconSrc: Record<string, string> = {
  logical: icons.folder,
  electrical: icons.cpu,
  mechanical: icons.settings,
  firmware: icons.binary,
  'Native Solution': icons.database,
  Logical: icons.folder,
  Electrical: icons.cpu,
  Mechanical: icons.settings,
  Firmware: icons.binary,
};

export const demoHeroHighlights = [
  {
    id: 'cases',
    label: 'Real Case Examples',
    icon: icons.hardDrive,
  },
  {
    id: 'steps',
    label: 'Step-by-Step Process',
    icon: demoPlayIconMint,
  },
  {
    id: 'preview',
    label: 'Training Preview',
    icon: icons.school,
  },
];

export { ICONIFY };
