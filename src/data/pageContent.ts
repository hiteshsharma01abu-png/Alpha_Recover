import { icons } from '../lib/icons';
import { company, industries, services } from './content';

/** Hero illustrations cut from the brand asset sheet, exported at 2× for high-DPI screens (shown at most 360px wide). */
export const heroArt = {
  hdd: { src: '/assets/images/illustrations/page-hdd.webp', width: 722, height: 582 },
  laptop: { src: '/assets/images/illustrations/page-laptop.webp', width: 826, height: 558 },
  certificate: { src: '/assets/images/illustrations/page-certificate.webp', width: 670, height: 484 },
  account: { src: '/assets/images/illustrations/page-account.webp', width: 747, height: 438 },
};
export type HeroArt = (typeof heroArt)[keyof typeof heroArt];

export type FeatureItem = { icon: string; title: string; text?: string };
export type IconCardItem = { icon: string; title: string; text: string; cta: string; to: string };

const serviceCopy: Record<(typeof services)[number], { title: string; text: string; icon: string }> = {
  'CCTV / DVR drive data recovery': {
    title: 'CCTV / DVR Drive Data Recovery',
    text: 'Recover lost or deleted footage from CCTV, DVR, and surveillance storage devices.',
    icon: icons.cctv,
  },
  'Data destruction & wiping': {
    title: 'Data Destruction & Wiping',
    text: 'Secure and permanent data wiping with verified destruction methods.',
    icon: icons.shredder,
  },
  'Encrypted data recovery': {
    title: 'Encrypted Data Recovery',
    text: 'Recover inaccessible or encrypted data from hard drives, SSDs, and other devices.',
    icon: icons.lock,
  },
  'Flash data recovery': {
    title: 'Flash Data Recovery',
    text: 'Retrieve lost data from USB, pen drives, and other flash storage devices.',
    icon: icons.flash,
  },
  'Hard drive data recovery': {
    title: 'Hard Drive Data Recovery',
    text: 'Recover data from failed, damaged, or non-responsive hard drives.',
    icon: icons.hardDrive,
  },
  'Laptop repairing': {
    title: 'Laptop Repairing',
    text: 'Diagnosis and repair for data, hardware, and performance issues.',
    icon: icons.laptop,
  },
  'Mobile data recovery': {
    title: 'Mobile Data Recovery',
    text: 'Recover photos, videos, contacts, and other data from Android and iOS devices.',
    icon: icons.cellphone,
  },
  'Scrap hard disk repairing': {
    title: 'Scrap Hard Disk Repairing',
    text: 'Assess, repair, and recover data from scrap or unusable hard disks.',
    icon: icons.tools,
  },
  'SSD drive data recovery': {
    title: 'SSD Drive Data Recovery',
    text: 'Specialized recovery for SSDs, including failed, corrupted, or unbootable drives.',
    icon: icons.memory,
  },
};

export const servicesPage = {
  title: 'Our Data Recovery Services',
  sub: 'Professional and secure recovery solutions for all types of devices and data loss scenarios.',
  cards: services.map((s): IconCardItem => ({ ...serviceCopy[s], cta: 'Request Service', to: '/contact' })),
  features: [
    { icon: icons.users, title: 'Expert Technicians', text: 'Skilled and experienced team' },
    { icon: icons.shieldCheck, title: 'Safe & Secure', text: 'Your data is always protected' },
    { icon: icons.zap, title: 'Fast Turnaround', text: 'Time-bound recovery process' },
    { icon: icons.headphones, title: 'Dedicated Support', text: 'Guidance at every step' },
  ] satisfies FeatureItem[],
};

/** Per industry, in the order of `industries` in content.ts: display title, icon and where "Learn More" goes. */
const industryExtras = [
  { title: 'IT Repair Shops', icon: icons.laptop, to: '/training' },
  { title: 'Photography & Media', icon: icons.camera, to: '/services' },
  { title: 'Law & Compliance', icon: icons.scale, to: '/contact' },
  { title: 'Education Institutes', icon: icons.school, to: '/contact' },
  { title: 'Enterprises', icon: icons.domain, to: '/services' },
  { title: 'Home Users', icon: icons.home, to: '/blog' },
];

export const industriesPage = {
  title: 'Industries We Serve',
  sub: 'Specialized data recovery solutions and training for a wide range of industries, from IT and media to enterprises and home users.',
  cards: industries.map((ind, i): IconCardItem => ({ ...industryExtras[i], text: ind.text, cta: 'Learn More' })),
  features: [
    { icon: icons.layers, title: 'Industry-Specific Guidance' },
    { icon: icons.shieldCheck, title: 'Real-World Recovery Practices' },
    { icon: icons.zap, title: 'Expert-Led Training' },
    { icon: icons.headphones, title: 'Ongoing Support' },
  ] satisfies FeatureItem[],
};

export const blogPage = {
  title: `${company.name} Blog`,
  sub: 'Tips, guides, and best practices for reliable data recovery.',
  pageSize: 6,
  /** Decorative thumbnails, picked per post from the site's own photos (posts have no cover images yet). */
  thumbs: ['/assets/images/sections/hero-drive.webp', '/assets/images/sections/pcb.webp', '/assets/images/sections/logical.webp', '/assets/images/sections/mechanical.webp', '/assets/images/sections/firmware.webp', '/assets/images/sections/why-photo.webp'],
};

export const verifyPage = {
  title: 'Verify Certificate',
  sub: `Confirm the authenticity of your ${company.name} training certificate.`,
  cardTitle: 'Certificate Verification',
  cardText: 'Enter the certificate ID printed on the trainee’s certificate to verify its authenticity.',
  features: [
    { icon: icons.award, title: 'Authentic & Secure', text: `Verify genuine ${company.name} certificates` },
    { icon: icons.zap, title: 'Instant Results', text: 'Get verification status in seconds' },
    { icon: icons.shieldCheck, title: 'Trusted Training', text: 'Issued only for completed training programs' },
  ] satisfies FeatureItem[],
};

export const trackPage = {
  ctaTitle: 'Advance Your Recovery Skills',
  ctaText: 'Get complete, hands-on training with real case studies and expert guidance.',
};
