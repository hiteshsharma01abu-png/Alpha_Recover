import type { ReactNode } from 'react';
import { icons } from '../../lib/icons';

const ASSET = '/assets';

export const globalStatsBg = `${ASSET}/global-stats-bg.webp`;
export const globalStatsGlobe = `${ASSET}/global-stats-globe.png`;
export const globalStatsWave = `${ASSET}/global-stats-wave.png`;

export const globalStatIcons: Record<string, string> = {
  Languages: `${ASSET}/stat-icon-languages.png`,
  Trainees: `${ASSET}/stat-icon-trainees.png`,
  'Cases / Year': `${ASSET}/stat-icon-cases.png`,
  'Remote Assists': `${ASSET}/stat-icon-remote.png`,
  Years: `${ASSET}/stat-icon-years.png`,
  'Privacy Focus': `${ASSET}/stat-icon-privacy.png`,
};

function iconImg(src: string, key: string, size = 16): ReactNode {
  return <img key={key} src={src} alt="" width={size} height={size} decoding="async" />;
}

export const heroHighlightIcons: Record<string, ReactNode> = {
  'hands-on': iconImg(icons.database, 'hands-on'),
  lifetime: iconImg(icons.monitorPlay, 'lifetime'),
  mentorship: iconImg(icons.users, 'mentorship'),
  skills: iconImg(icons.fileBadge, 'skills'),
};

export const quickActionIcons: Record<string, ReactNode> = {
  'Logical Recovery': iconImg(icons.laptop, 'logical', 22),
  'PCB Repair': iconImg(icons.settings, 'pcb', 22),
  'Firmware Tools': iconImg(icons.cpu, 'firmware', 22),
  'MRT Techniques': iconImg(icons.layers, 'mrt', 22),
};
