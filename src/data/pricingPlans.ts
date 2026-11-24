/** Static marketing + offline fallback for the three published training plans.
 * Kept separate from content.ts to avoid circular imports (content owns `pricing` + `company`). */

/** Refund window (days) — same owner decision as src/data/legal.ts `refundWindowDays`. */
const REFUND_DAYS = 3;

/** Static marketing + offline fallback for the three published training plans. */
export type StaticPlanDef = {
  slug: string;
  name: string;
  tagline: string;
  audience: string;
  /** Base price in INR rupees (not paise). */
  priceInr: number;
  /** Optional compare-at / sale “was” price in INR. */
  compareInr: number | null;
  /** Sale “now” price when a festival window is configured (Professional only today). */
  saleInr: number | null;
  saleLabel: string | null;
  saleStartsAt: string | null;
  saleEndsAt: string | null;
  features: string[];
  mobileFeatureOrder: number[] | null;
  /** Course slugs for plan_courses when grantsAllCourses is false. */
  courseSlugs: string[] | null;
  grantsAllCourses: boolean;
  ctaLabel: string;
  /** When true, pricing UI shows a disabled Coming soon control. */
  comingSoon: boolean;
  recommended?: boolean;
  sortOrder: number;
};

export const ESSENTIAL_FEATURES = [
  'Basic data recovery training',
  'Logical data recovery',
  'Basic information and logical values',
  'Basic electronics and component testing',
  'Lifetime access to purchased courses',
  'Lifetime updates for purchased courses',
  'Self-paced learning',
];

export const PROFESSIONAL_FEATURES = [
  '20+ hours of self-study video training',
  '120+ different data recovery solutions',
  'Lifetime web portal access',
  'Training certificate',
  'Hard disk firmware repairing software access',
  'Technical assistance on WhatsApp',
  'One-time pay, lifetime updates',
  'All upcoming course access',
  'Logical, mechanical & electrical (PCB) tracks',
  'Basic information and logical values',
  'Seagate & WD firmware failure training',
  'Basic electronics and component testing',
  'Case study videos & expert solutions',
  'Photo & video recovery training',
  'BitLocker encrypted drive recovery',
  'Advanced MRT introduction, Seagate, WD & extractor',
  'Access anytime — no seat limits',
];

/** Marketing extras for Expert (not sold until mentoring is operational). */
export const EXPERT_EXTRA_FEATURES = [
  'Everything included in the Professional Plan',
  'Advanced practical workshops (coming soon)',
  'Personal mentoring sessions (coming soon)',
  'Priority technical assistance (coming soon)',
  'Case-specific recovery guidance (coming soon)',
  'Advanced troubleshooting guidance (coming soon)',
];

/** Festival sale window shared with content.ts `pricing` (must stay in sync). */
export const PROFESSIONAL_SALE = {
  was: 5999,
  now: 2500,
  saleLabel: 'Festival Sale – Up to 60% Off',
  saleStartsAt: '2026-11-01T00:00:00+05:30',
  saleEndsAt: '2026-11-30T23:59:59+05:30',
  mobileFeatureOrder: [0, 2, 4, 6, 8, 10, 12, 14, 16],
} as const;

export const pricingPlans: StaticPlanDef[] = [
  {
    slug: 'essential',
    name: 'Essential',
    tagline: 'Start with the fundamentals',
    audience: 'Beginners, students and computer repair trainees.',
    priceInr: 999,
    compareInr: null,
    saleInr: null,
    saleLabel: null,
    saleStartsAt: null,
    saleEndsAt: null,
    features: ESSENTIAL_FEATURES,
    mobileFeatureOrder: null,
    courseSlugs: ['logical', 'basics', 'electronics'],
    grantsAllCourses: false,
    ctaLabel: 'Get Started',
    comingSoon: false,
    sortOrder: 0,
  },
  {
    slug: 'professional',
    name: 'Professional Plan',
    tagline: 'Complete training for working technicians',
    audience: 'Students and professionals who want full curriculum access.',
    priceInr: PROFESSIONAL_SALE.was,
    compareInr: PROFESSIONAL_SALE.was,
    saleInr: PROFESSIONAL_SALE.now,
    saleLabel: PROFESSIONAL_SALE.saleLabel,
    saleStartsAt: PROFESSIONAL_SALE.saleStartsAt,
    saleEndsAt: PROFESSIONAL_SALE.saleEndsAt,
    features: PROFESSIONAL_FEATURES,
    mobileFeatureOrder: [...PROFESSIONAL_SALE.mobileFeatureOrder],
    courseSlugs: null,
    grantsAllCourses: true,
    ctaLabel: 'Enroll Now',
    comingSoon: false,
    recommended: true,
    sortOrder: 1,
  },
  {
    slug: 'expert',
    name: 'Expert',
    tagline: 'For labs and senior technicians',
    audience: 'Experienced technicians, data recovery professionals and laboratory owners.',
    priceInr: 4999,
    compareInr: null,
    saleInr: null,
    saleLabel: null,
    saleStartsAt: null,
    saleEndsAt: null,
    features: [...PROFESSIONAL_FEATURES, ...EXPERT_EXTRA_FEATURES],
    mobileFeatureOrder: null,
    courseSlugs: null,
    grantsAllCourses: true,
    ctaLabel: 'Become an Expert',
    comingSoon: true,
    sortOrder: 2,
  },
];

export type FaqCategoryId = 'general' | 'pricing' | 'access' | 'technical';

export type PricingFaqItem = {
  id: string;
  category: FaqCategoryId;
  question: string;
  /** Plain text answer; may include a path like /refund-policy for the UI to link. */
  answer: string;
};

export const faqCategories: { id: FaqCategoryId; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'pricing', label: 'Pricing & Payments' },
  { id: 'access', label: 'Course Access' },
  { id: 'technical', label: 'Technical Support' },
];

export const pricingFaqs: PricingFaqItem[] = [
  {
    id: 'g1',
    category: 'general',
    question: 'What is Alpha Recovery training?',
    answer:
      'Alpha Recovery offers online data recovery training from Ahmedabad — logical, PCB, mechanical, firmware and MRT paths — with lifetime portal access to the courses included in your plan.',
  },
  {
    id: 'g2',
    category: 'general',
    question: 'Who should enroll in this training?',
    answer:
      'Computer repair trainees, IT technicians, photography and media specialists, institute instructors, and anyone who wants practical disk-level recovery skills beyond consumer software.',
  },
  {
    id: 'g3',
    category: 'general',
    question: 'Do I need previous data recovery experience?',
    answer:
      'No. Essential is designed for beginners. Professional and Expert assume you can follow technical lessons; prior repair-shop experience helps but is not required.',
  },
  {
    id: 'g4',
    category: 'general',
    question: 'Can I learn at my own pace?',
    answer: 'Yes. Training is self-paced with lifetime access to the courses included in your purchased plan.',
  },
  {
    id: 'g5',
    category: 'general',
    question: 'What equipment do I need to start learning?',
    answer:
      'A computer with a modern browser and a stable internet connection is enough to watch lessons. For hands-on practice, many learners use spare or donor hard drives; exact lab kits are not mandated on this site — ask on WhatsApp if you need a starter checklist.',
  },
  {
    id: 'p1',
    category: 'pricing',
    question: 'What is the difference between Essential, Professional and Expert plans?',
    answer:
      'Essential covers logical recovery plus basic information/logical values and basic electronics. Professional unlocks the full curriculum (all tracks, certificate path, firmware tools access as listed, WhatsApp technical assistance, and lifetime updates). Expert is planned to include everything in Professional plus mentoring and priority support — those extras are Coming soon and not available for purchase yet.',
  },
  {
    id: 'p2',
    category: 'pricing',
    question: 'Is this a one-time payment?',
    answer: 'Yes. Plans are a one-time purchase, not a subscription.',
  },
  {
    id: 'p3',
    category: 'pricing',
    question: 'Are there any recurring subscription fees?',
    answer: 'No. There are no recurring subscription fees for training plans.',
  },
  {
    id: 'p4',
    category: 'pricing',
    question: 'Can I upgrade my plan later?',
    answer:
      'In-app plan upgrades are not available yet. Contact us on WhatsApp if you need a higher tier; we will confirm options manually until self-serve upgrades ship.',
  },
  {
    id: 'p5',
    category: 'pricing',
    question: 'What payment methods are accepted?',
    answer:
      'Online checkout is being connected. When payments go live, available methods will be shown at checkout. Our refund policy already covers common methods such as card, UPI, net banking and wallet for refunds once a payment exists.',
  },
  {
    id: 'p6',
    category: 'pricing',
    question: 'Are there any additional charges?',
    answer:
      'The plan price is what you pay for the listed training entitlements. Taxes or gateway fees, if any, will be shown clearly at checkout when payments are enabled — we do not invent hidden fees here.',
  },
  {
    id: 'p7',
    category: 'pricing',
    question: 'How do festival discounts and coupons work?',
    answer:
      'Festival pricing is a time-bound promotion on the Professional Plan (for example the Festival Sale window). The live price and countdown come from the server when available. There is no separate public coupon code system on the site today.',
  },
  {
    id: 'p8',
    category: 'pricing',
    question: 'What is the refund and cancellation policy?',
    answer: `You can ask for a full refund within ${REFUND_DAYS} days of purchase, for any reason. After that window, refunds follow the cases listed in our Refund & Cancellation Policy. See /refund-policy for full details.`,
  },
  {
    id: 'p9',
    category: 'pricing',
    question: 'What happens if my payment fails?',
    answer:
      'If a payment attempt fails, you are not enrolled. Retry when checkout is available, or contact us on WhatsApp with any receipt or error details so we can help.',
  },
  {
    id: 'a1',
    category: 'access',
    question: 'How do I access my training after purchasing?',
    answer:
      'Sign in to your student account and open My Learning / the dashboard. When online checkout is live, successful payment grants course access automatically; until then, access is granted by our team after payment confirmation.',
  },
  {
    id: 'a2',
    category: 'access',
    question: 'How long can I access my purchased courses?',
    answer: 'Plans are sold with lifetime access to the courses included in that plan (no access end date).',
  },
  {
    id: 'a3',
    category: 'access',
    question: 'Are upcoming courses included in my plan?',
    answer:
      'Professional and Expert grant access to all published training tracks, including upcoming courses added to the catalog. Essential includes only the logical, basics and electronics tracks listed for that plan.',
  },
  {
    id: 'a4',
    category: 'access',
    question: 'Can I access training on mobile devices?',
    answer: 'Yes. The training portal works in a modern mobile browser. Some lab tools discussed in lessons may still require a desktop PC.',
  },
  {
    id: 'a5',
    category: 'access',
    question: 'Can I watch training videos multiple times?',
    answer: 'Yes. You can rewatch lessons as often as you need during your lifetime access.',
  },
  {
    id: 'a6',
    category: 'access',
    question: 'Are practical case studies included?',
    answer:
      'Professional (and Expert, when available) include case study videos and expert solutions as listed in the plan features. Essential focuses on foundational logical and electronics lessons.',
  },
  {
    id: 'a7',
    category: 'access',
    question: 'Will I receive a training certificate?',
    answer:
      'Professional Plan includes a training certificate after you meet the course completion criteria. Anyone can check a certificate on our Verify Certificate page. Essential does not list a certificate as an entitlement.',
  },
  {
    id: 'a8',
    category: 'access',
    question: 'Can I access training from multiple devices?',
    answer:
      'Yes, you can sign in from more than one device. For account security we limit concurrent student sessions; if you are signed out elsewhere, sign in again on the device you are using.',
  },
  {
    id: 't1',
    category: 'technical',
    question: 'Which types of data recovery are covered?',
    answer:
      'Depending on your plan: logical/software recovery, electrical (PCB) work, mechanical recovery, firmware repairing, photo/video recovery, BitLocker cases and MRT-oriented workflows are covered in the full Professional curriculum. Essential covers the foundational logical and electronics tracks.',
  },
  {
    id: 't2',
    category: 'technical',
    question: 'Is hard disk firmware repairing software access included?',
    answer:
      'It is listed as an entitlement of the Professional Plan (and Expert when sold). Exact tool licensing terms are provided with your enrollment materials — we do not expand those terms here.',
  },
  {
    id: 't3',
    category: 'technical',
    question: 'Does the training cover Seagate and Western Digital drives?',
    answer: 'Yes. Professional includes Seagate and WD firmware failure training and related MRT-oriented modules.',
  },
  {
    id: 't4',
    category: 'technical',
    question: 'Is PCB repair and component testing included?',
    answer:
      'Electrical (PCB) Failure Data Recovery and basic electronics / component testing are part of the Professional curriculum. Essential includes basic electronics and component testing; full PCB recovery tracks are on Professional.',
  },
  {
    id: 't5',
    category: 'technical',
    question: 'Is BitLocker encrypted drive recovery covered?',
    answer: 'Yes, on the Professional Plan (BitLocker encrypted drive recovery is listed in the plan features).',
  },
  {
    id: 't6',
    category: 'technical',
    question: 'Does the training cover MRT tools?',
    answer:
      'Professional includes advanced MRT introduction, Seagate, WD and extractor topics. Essential does not include the MRT track.',
  },
  {
    id: 't7',
    category: 'technical',
    question: 'How can I receive technical assistance?',
    answer:
      'Professional Plan includes technical assistance on WhatsApp. Use Ask on WhatsApp on this page or the site contact details to reach the team during published business hours.',
  },
  {
    id: 't8',
    category: 'technical',
    question: 'Is personal mentoring available?',
    answer:
      'Personal mentoring is planned for the Expert tier and is Coming soon. It is not available for purchase or delivery yet.',
  },
  {
    id: 't9',
    category: 'technical',
    question: 'What is the difference between standard and priority technical support?',
    answer:
      'Professional includes WhatsApp technical assistance as listed. Priority technical assistance is a proposed Expert benefit and is not available yet.',
  },
];
