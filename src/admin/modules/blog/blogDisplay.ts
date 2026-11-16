import type { BlogState } from '../../lib/adminApi';

export const BLOG_STATE_LABEL: Record<BlogState, string> = { draft: 'Draft', scheduled: 'Scheduled', published: 'Published' };
export const BLOG_STATE_TONE: Record<BlogState, 'warning' | 'info' | 'success'> = { draft: 'warning', scheduled: 'info', published: 'success' };

/** "How SSD TRIM works!" → "how-ssd-trim-works". */
export function slugify(title: string) {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
    .replace(/-+$/, '');
}
