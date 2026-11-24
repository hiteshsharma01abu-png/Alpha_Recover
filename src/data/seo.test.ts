import { describe, expect, it } from 'vitest';
import { blogPosts, trainingTracks } from './content';
import { headTags, pageSeo, prerenderPaths, SITE_URL } from './seo';

describe('page SEO', () => {
  it('pre-renders every public page once, each with its own title and description', () => {
    const paths = prerenderPaths();
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths).toEqual(expect.arrayContaining(['/', '/pricing', ...trainingTracks.map((t) => `/training/${t.id}`), ...blogPosts.map((p) => `/blog/${p.slug}`)]));
    const seos = paths.map(pageSeo);
    expect(seos.every((s) => !s.noindex && s.title && s.description)).toBe(true);
    expect(new Set(seos.map((s) => s.title)).size).toBe(paths.length);
    expect(new Set(seos.map((s) => s.description)).size).toBe(paths.length);
  });

  it('never indexes signed-in or one-off pages, and drops their canonical', () => {
    for (const path of ['/account', '/account/settings', '/dashboard', '/learn/logical/a/b', '/verify-email', '/reset-password', '/admin/leads', '/unknown']) {
      const seo = pageSeo(path);
      expect(seo.noindex, path).toBe(true);
      expect(headTags(seo).canonical).toBeNull();
    }
    expect(pageSeo('/accounting').noindex).toBe(true); // unknown path, not a prefix match on /account
    expect(prerenderPaths().some((p) => pageSeo(p).noindex)).toBe(false);
  });

  it('treats a trailing slash as the same page and builds absolute URLs', () => {
    expect(pageSeo('/pricing/')).toEqual(pageSeo('/pricing'));
    const tags = headTags(pageSeo('/training/logical'));
    expect(tags.canonical).toBe(`${SITE_URL}/training/logical`);
    expect(tags.meta).toContainEqual({ property: 'og:image', content: `${SITE_URL}/assets/brand/og-image.jpg` });
    expect(tags.jsonLd).toMatchObject({ '@type': 'Course' });
    expect(headTags(pageSeo('/')).canonical).toBe(`${SITE_URL}/`);
  });
});
