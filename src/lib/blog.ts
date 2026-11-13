import { useEffect, useState } from 'react';
import { blogPosts as staticPosts } from '../data/content';
import { api } from './api';

export type BlogPostSummary = { slug: string; title: string; excerpt: string; date: string };
export type BlogPost = BlogPostSummary & { bodyMarkdown: string; seoTitle: string | null; seoDescription: string | null };

type ApiSummary = { slug: string; title: string; excerpt: string; publishedAt: string };
type ApiPost = ApiSummary & { bodyMarkdown: string; seoTitle: string | null; seoDescription: string | null };

/** "2026-08-12T03:30:00Z" → "2026-08-12" in India time (the format the blog already shows). */
const toDate = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

const fromStatic = (slug: string): BlogPost | undefined => {
  const p = staticPosts.find((x) => x.slug === slug);
  return p && { ...p, bodyMarkdown: p.excerpt, seoTitle: null, seoDescription: null };
};

let listRequest: Promise<BlogPostSummary[] | null> | null = null;

/** Blog list: content.ts fallback first, then published posts from the API. */
export function useBlogPosts(): BlogPostSummary[] {
  const [posts, setPosts] = useState<BlogPostSummary[]>(staticPosts);
  useEffect(() => {
    let active = true;
    listRequest ??= api
      .get<ApiSummary[]>('/blog?pageSize=50')
      .then((res) => res.data.map((p) => ({ slug: p.slug, title: p.title, excerpt: p.excerpt, date: toDate(p.publishedAt) })))
      .catch(() => null);
    void listRequest.then((live) => {
      if (active && live) setPosts(live);
    });
    return () => {
      active = false;
    };
  }, []);
  return posts;
}

/**
 * One post. `settled` turns true once the API answered or failed, so a post that exists only
 * in the database doesn't flash "not found".
 */
export function useBlogPost(slug: string | undefined): { post: BlogPost | undefined; settled: boolean } {
  const [state, setState] = useState(() => ({ slug, post: slug ? fromStatic(slug) : undefined, settled: false }));
  useEffect(() => {
    if (!slug) return;
    let active = true;
    api
      .get<ApiPost>(`/blog/${slug}`)
      .then((res) => {
        const p = res.data;
        if (active) {
          setState({
            slug,
            settled: true,
            post: { slug: p.slug, title: p.title, excerpt: p.excerpt, date: toDate(p.publishedAt), bodyMarkdown: p.bodyMarkdown, seoTitle: p.seoTitle, seoDescription: p.seoDescription },
          });
        }
      })
      .catch((err: unknown) => {
        // 404 from a live API means it really doesn't exist; any other failure keeps the fallback.
        const gone = (err as { status?: number }).status === 404;
        if (active) setState({ slug, settled: true, post: gone ? undefined : fromStatic(slug) });
      });
    return () => {
      active = false;
    };
  }, [slug]);
  // Navigating between posts: until the new request settles, show that post's fallback.
  if (state.slug !== slug) return { post: slug ? fromStatic(slug) : undefined, settled: false };
  return { post: state.post, settled: state.settled };
}
