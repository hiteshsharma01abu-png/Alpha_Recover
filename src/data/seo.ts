import { blogPosts, company, trainingTracks } from './content';
import { legalPages } from './legal';
import { blogPage, industriesPage, servicesPage, verifyPage } from './pageContent';

/** Public site origin for canonical URLs, sitemap and share cards (set VITE_SITE_URL to the real domain at launch). */
export const SITE_URL = ((import.meta.env.VITE_SITE_URL as string | undefined) || 'https://alpharecovery-training.vercel.app').replace(/\/+$/, '');

export const OG_IMAGE = '/assets/brand/og-image.jpg';

export type PageSeo = {
  title: string;
  description: string;
  /** Path only; made absolute with SITE_URL. */
  path: string;
  noindex?: boolean;
  type?: 'website' | 'article';
  /** schema.org structured data for this page. */
  jsonLd?: Record<string, unknown>;
};

const DEFAULT_DESCRIPTION = 'Online data recovery training and recovery services from Ahmedabad: logical, electrical/PCB, mechanical and firmware recovery courses.';

const withBrand = (title: string) => `${title} | ${company.name}`;

const organization = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: company.name,
  url: SITE_URL,
  logo: `${SITE_URL}/assets/brand/favicon-512x512.png`,
  email: company.email,
  telephone: company.phoneDisplay,
  address: { '@type': 'PostalAddress', addressLocality: 'Ahmedabad', addressRegion: 'Gujarat', addressCountry: 'IN' },
};

/** Indexable pages with fixed content, by path. */
const STATIC_PAGES: Record<string, Omit<PageSeo, 'path'>> = {
  '/': {
    title: `${company.name} | Online Data Recovery Training`,
    description: `${company.tagline}. Learn logical, electrical/PCB, mechanical and firmware data recovery online, with real case demos, from ${company.address}.`,
    jsonLd: organization,
  },
  '/training': {
    title: withBrand('Data Recovery Training Courses'),
    description: `Every ${company.name} training track: logical recovery, PCB and electrical repair, mechanical recovery, firmware, MRT, BitLocker and more, with full lesson lists.`,
  },
  '/pricing': {
    title: withBrand('Pricing: Professional Plan'),
    description: 'One plan with lifetime access to every data recovery course, future updates and certificates. See what is included and the current price.',
  },
  '/demos': {
    title: withBrand('Demo Videos'),
    description: 'Preview real data recovery case workflows, troubleshooting and recovery processes before you buy the training.',
  },
  '/services': { title: withBrand(servicesPage.title), description: servicesPage.sub },
  '/industries': { title: withBrand(industriesPage.title), description: industriesPage.sub },
  '/blog': { title: withBrand('Blog'), description: `${blogPage.title}: ${blogPage.sub}` },
  '/about': {
    title: withBrand('About Us'),
    description: `${company.name} is a data recovery training and services business in ${company.address}, teaching hands-on recovery for technicians and IT teams.`,
  },
  '/contact': {
    title: withBrand('Contact'),
    description: `Questions about training, pricing or a data recovery job? Call ${company.phoneDisplay}, WhatsApp or email ${company.email}. ${company.replyNote}.`,
  },
  '/verify-certificate': { title: withBrand(verifyPage.title), description: verifyPage.sub },
  '/privacy-policy': { title: withBrand(legalPages.privacy.title), description: `How ${company.name} collects, uses and protects your personal information.` },
  '/terms': { title: withBrand(legalPages.terms.title), description: `The terms for using the ${company.name} website and training portal.` },
  '/refund-policy': { title: withBrand(legalPages.refund.title), description: `Refund and cancellation rules for ${company.name} training plans.` },
};

/** Signed-in or one-off pages: never indexed, never pre-rendered. */
const PRIVATE_PREFIXES = ['/account', '/dashboard', '/learn/', '/verify-email', '/reset-password', '/admin'];

const normalize = (pathname: string) => (pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname) || '/';

/** Head data for any path the site serves (unknown paths get the site defaults). */
export function pageSeo(pathname: string): PageSeo {
  const path = normalize(pathname);
  const fixed = STATIC_PAGES[path];
  if (fixed) return { ...fixed, path };

  if (PRIVATE_PREFIXES.some((p) => path === p.replace(/\/$/, '') || path.startsWith(p.endsWith('/') ? p : `${p}/`))) {
    return { title: company.name, description: DEFAULT_DESCRIPTION, path, noindex: true };
  }

  const track = path.startsWith('/training/') ? trainingTracks.find((t) => `/training/${t.id}` === path) : undefined;
  if (track) {
    return {
      title: withBrand(`${track.title} Course`),
      description: track.summary,
      path,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'Course',
        name: track.title,
        description: track.summary,
        url: `${SITE_URL}${path}`,
        provider: { '@type': 'Organization', name: company.name, sameAs: SITE_URL },
      },
    };
  }

  const post = path.startsWith('/blog/') ? blogPosts.find((p) => `/blog/${p.slug}` === path) : undefined;
  if (post) return blogPostSeo(post);

  return { title: STATIC_PAGES['/'].title, description: DEFAULT_DESCRIPTION, path, noindex: true };
}

/** Blog post head data; also used by the post page once a database-only post has loaded. */
export function blogPostSeo(post: { slug: string; title: string; excerpt: string; date: string; seoTitle?: string | null; seoDescription?: string | null }): PageSeo {
  const path = `/blog/${post.slug}`;
  const title = post.seoTitle || post.title;
  return {
    title: withBrand(title),
    description: post.seoDescription || post.excerpt,
    path,
    type: 'article',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: title,
      description: post.seoDescription || post.excerpt,
      datePublished: post.date,
      url: `${SITE_URL}${path}`,
      image: `${SITE_URL}${OG_IMAGE}`,
      author: { '@type': 'Organization', name: company.name },
      publisher: { '@type': 'Organization', name: company.name, logo: { '@type': 'ImageObject', url: `${SITE_URL}/assets/brand/favicon-512x512.png` } },
    },
  };
}

/** Every path written to static HTML at build time and listed in the sitemap. */
export function prerenderPaths(): string[] {
  return [...Object.keys(STATIC_PAGES), ...trainingTracks.map((t) => `/training/${t.id}`), ...blogPosts.map((p) => `/blog/${p.slug}`)];
}

/** The head tags a page needs, as data: rendered to HTML at build time and applied to the DOM on navigation. */
export function headTags(seo: PageSeo) {
  const url = `${SITE_URL}${seo.path === '/' ? '/' : seo.path}`;
  return {
    title: seo.title,
    meta: [
      { name: 'description', content: seo.description },
      { name: 'robots', content: seo.noindex ? 'noindex, nofollow' : 'index, follow' },
      { property: 'og:site_name', content: company.name },
      { property: 'og:type', content: seo.type ?? 'website' },
      { property: 'og:title', content: seo.title },
      { property: 'og:description', content: seo.description },
      { property: 'og:url', content: url },
      { property: 'og:image', content: `${SITE_URL}${OG_IMAGE}` },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { property: 'og:locale', content: 'en_IN' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: seo.title },
      { name: 'twitter:description', content: seo.description },
      { name: 'twitter:image', content: `${SITE_URL}${OG_IMAGE}` },
    ] as ({ name: string; content: string } | { property: string; content: string })[],
    canonical: seo.noindex ? null : url,
    jsonLd: seo.jsonLd ?? null,
  };
}
