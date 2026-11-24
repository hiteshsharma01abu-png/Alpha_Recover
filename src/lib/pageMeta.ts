import { headTags, type PageSeo } from '../data/seo';

function upsert<T extends HTMLElement>(selector: string, create: () => T): T {
  return document.head.querySelector<T>(selector) ?? document.head.appendChild(create());
}

/** Puts a page's title, description, canonical, share-card and structured-data tags in <head> (client navigation). */
export function applyPageMeta(seo: PageSeo) {
  const tags = headTags(seo);
  document.title = tags.title;
  for (const m of tags.meta) {
    const [attr, key] = 'name' in m ? ['name', m.name] : ['property', m.property];
    upsert(`meta[${attr}="${key}"]`, () => {
      const el = document.createElement('meta');
      el.setAttribute(attr, key);
      return el;
    }).setAttribute('content', m.content);
  }

  const canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (tags.canonical) {
    (canonical ?? upsert('link[rel="canonical"]', () => Object.assign(document.createElement('link'), { rel: 'canonical' }))).href = tags.canonical;
  } else {
    canonical?.remove();
  }

  const ld = document.head.querySelector<HTMLScriptElement>('script[type="application/ld+json"]');
  if (tags.jsonLd) {
    (ld ?? upsert('script[type="application/ld+json"]', () => Object.assign(document.createElement('script'), { type: 'application/ld+json' }))).textContent =
      JSON.stringify(tags.jsonLd);
  } else {
    ld?.remove();
  }
}
