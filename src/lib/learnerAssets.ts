/** Paths under public/assets/images/learner (prefer .webp). */
const BASE = '/assets/images/learner';

export const learnerAssets = {
  bgDesktop: `${BASE}/background-desktop.webp`,
  bgMobile: `${BASE}/background-mobile.webp`,
  heroBg: `${BASE}/hero-background.webp`,
  hardDrive: `${BASE}/hard-drive-transparent.webp`,
  ssd: `${BASE}/ssd-transparent.webp`,
  courseHdd: `${BASE}/course-hdd.webp`,
  courseSsd: `${BASE}/course-ssd.webp`,
  glow: `${BASE}/glow-overlay.webp`,
  wave: `${BASE}/wave-overlay.webp`,
  avatar: `${BASE}/avatar-placeholder.webp`,
  iconHome: `${BASE}/icon-home.webp`,
  iconCourses: `${BASE}/icon-courses.webp`,
  iconProgress: `${BASE}/icon-progress.webp`,
  iconCertificate: `${BASE}/icon-certificate.webp`,
  iconResources: `${BASE}/icon-resources.webp`,
  iconSupport: `${BASE}/icon-support.webp`,
  iconLogout: `${BASE}/icon-logout.webp`,
  iconCrown: `${BASE}/icon-crown.webp`,
  iconBell: `${BASE}/icon-bell.webp`,
  iconMenu: `${BASE}/icon-menu.webp`,
  iconMore: `${BASE}/icon-more.webp`,
  iconPlay: `${BASE}/icon-play.webp`,
  iconTrophy: `${BASE}/icon-trophy.webp`,
  iconTarget: `${BASE}/icon-target.webp`,
  iconCheck: `${BASE}/icon-check.webp`,
  iconGraduation: `${BASE}/icon-graduation.webp`,
  iconChevron: `${BASE}/icon-chevron.webp`,
  iconArrow: `${BASE}/icon-arrow.webp`,
  iconUser: `${BASE}/icon-user.webp`,
  iconUserPlus: `${BASE}/icon-user-plus.webp`,
  iconEmail: `${BASE}/icon-email.webp`,
  iconLock: `${BASE}/icon-lock.webp`,
  iconEye: `${BASE}/icon-eye.webp`,
  iconPhone: `${BASE}/icon-phone.webp`,
} as const;

/** Decorative course thumbnail alternating by index (API has no thumbnails). */
export function courseThumb(index: number): string {
  return index % 2 === 0 ? learnerAssets.courseHdd : learnerAssets.courseSsd;
}
