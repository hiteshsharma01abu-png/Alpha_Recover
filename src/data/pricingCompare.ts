import { ICON_BRASS, ICON_IVORY, ICON_MINT, iconSrc } from '../lib/icons';

/** 'yes' = Included, 'no' = not in the plan, 'soon' = Coming soon */
export type CompareValue = 'yes' | 'no' | 'soon';

export type CompareRow = {
  label: string;
  icon: string;
  essential: CompareValue;
  professional: CompareValue;
  expert: CompareValue;
};

export type CompareGroup = {
  id: string;
  label: string;
  /** Gold icon in the desktop table band */
  icon: string;
  /** Mint icon on the mobile accordion header */
  mobileIcon: string;
  rows: CompareRow[];
};

export const comparePlans = [
  { key: 'essential', label: 'Essential' },
  { key: 'professional', label: 'Professional' },
  { key: 'expert', label: 'Expert' },
] as const;

/** Compare Plans section on /pricing (desktop table + mobile accordion). */
export const compareGroups: CompareGroup[] = [
  {
    id: 'core',
    label: 'Core access',
    icon: iconSrc('lucide/layers', ICON_BRASS),
    mobileIcon: iconSrc('lucide/folder', ICON_MINT),
    rows: [
      { label: 'Logical / basics / electronics tracks', icon: iconSrc('lucide/monitor', ICON_IVORY), essential: 'yes', professional: 'yes', expert: 'yes' },
      { label: 'All published training tracks', icon: iconSrc('lucide/book-open', ICON_IVORY), essential: 'no', professional: 'yes', expert: 'yes' },
      { label: 'Lifetime access & course updates', icon: iconSrc('lucide/refresh-cw', ICON_IVORY), essential: 'yes', professional: 'yes', expert: 'yes' },
      { label: 'Self-paced learning', icon: iconSrc('lucide/circle-play', ICON_IVORY), essential: 'yes', professional: 'yes', expert: 'yes' },
    ],
  },
  {
    id: 'curriculum',
    label: 'Curriculum depth',
    icon: iconSrc('lucide/graduation-cap', ICON_BRASS),
    mobileIcon: iconSrc('lucide/layers', ICON_MINT),
    rows: [
      { label: 'Training certificate path', icon: iconSrc('lucide/award', ICON_IVORY), essential: 'no', professional: 'yes', expert: 'yes' },
      { label: 'Firmware repairing software access', icon: iconSrc('lucide/settings', ICON_IVORY), essential: 'no', professional: 'yes', expert: 'yes' },
      { label: 'Seagate & WD firmware training', icon: iconSrc('lucide/database', ICON_IVORY), essential: 'no', professional: 'yes', expert: 'yes' },
      { label: 'Case study videos', icon: iconSrc('lucide/square-play', ICON_IVORY), essential: 'no', professional: 'yes', expert: 'yes' },
      { label: 'BitLocker recovery training', icon: iconSrc('lucide/shield-check', ICON_IVORY), essential: 'no', professional: 'yes', expert: 'yes' },
      { label: 'MRT introduction & related modules', icon: iconSrc('lucide/layers', ICON_IVORY), essential: 'no', professional: 'yes', expert: 'yes' },
    ],
  },
  {
    id: 'support',
    label: 'Support',
    icon: iconSrc('lucide/headphones', ICON_BRASS),
    mobileIcon: iconSrc('lucide/headphones', ICON_MINT),
    rows: [
      { label: 'WhatsApp technical assistance', icon: iconSrc('mdi/whatsapp', ICON_IVORY), essential: 'no', professional: 'yes', expert: 'yes' },
      { label: 'Personal mentoring', icon: iconSrc('lucide/user', ICON_IVORY), essential: 'no', professional: 'no', expert: 'soon' },
      { label: 'Priority technical assistance', icon: iconSrc('lucide/star', ICON_IVORY), essential: 'no', professional: 'no', expert: 'soon' },
    ],
  },
];
