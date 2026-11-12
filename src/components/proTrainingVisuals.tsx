import { icons } from '../lib/icons';

export const proTrainingHero = '/assets/training-hero.webp';
export const proTrainingBg = '/assets/training-bg.webp';

export const proTrainingBenefits = [
  {
    id: 'practical',
    label: 'Practical Hands-on',
    sub: 'Training',
    iconSrc: icons.play,
  },
  {
    id: 'lifetime',
    label: 'Lifetime',
    sub: 'Access',
    iconSrc: icons.infinity,
  },
  {
    id: 'notes',
    label: 'Study Notes',
    sub: '& Resources',
    iconSrc: icons.bookOpen,
  },
  {
    id: 'support',
    label: 'Expert Technical',
    sub: 'Support',
    iconSrc: icons.headphones,
  },
];

export const proTrainingMeta: Record<
  string,
  { hours: string; lessons: string; iconSrc: string }
> = {
  recovery: {
    hours: '18+ Hours',
    lessons: '50+ Lessons',
    iconSrc: icons.hardDrive,
  },
  firmware: {
    hours: '12+ Hours',
    lessons: '40+ Lessons',
    iconSrc: icons.cpu,
  },
  electronics: {
    hours: '10+ Hours',
    lessons: '30+ Lessons',
    iconSrc: icons.circuitBoard,
  },
};
