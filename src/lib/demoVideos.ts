import { useEffect, useState } from 'react';
import { demoVideoImages } from '../components/visuals/demoVisuals';
import { demoVideos as staticDemoVideos, type DemoCategory } from '../data/content';
import { fallbackSectionImage } from '../data/sectionMedia';
import { api } from './api';

/** The shape the demo pages render (same as content.ts entries). */
export type DemoVideo = {
  id: string;
  title: string;
  tag: string;
  category: DemoCategory;
  duration: string;
  durationLong: string;
  tags: string[];
  description: string;
  level: string;
  views: string;
  uploaded: string;
  featured?: boolean;
  /** Uploaded thumbnail (API); otherwise the bundled image for this id is used. */
  thumbnail?: string | null;
};

type ApiDemoVideo = {
  slug: string;
  title: string;
  tag: string;
  category: DemoCategory;
  level: string;
  description: string;
  tags: string[];
  durationSeconds: number;
  viewCount: number;
  publishedAt: string | null;
  isFeatured: boolean;
  thumbnailUrl: string | null;
};

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/** "2026-09-13T…" → "2 months ago". */
export function timeAgo(iso: string | null, now = Date.now()): string {
  if (!iso) return '';
  const days = Math.max(0, Math.round((now - Date.parse(iso)) / 86_400_000));
  if (days < 7) return relative.format(-days, 'day');
  if (days < 31) return relative.format(-Math.round(days / 7), 'week');
  if (days < 365) return relative.format(-Math.round(days / 30), 'month');
  return relative.format(-Math.round(days / 365), 'year');
}

function toDemoVideo(v: ApiDemoVideo): DemoVideo {
  const mins = Math.floor(v.durationSeconds / 60);
  const secs = v.durationSeconds % 60;
  return {
    id: v.slug,
    title: v.title,
    tag: v.tag,
    category: v.category,
    duration: `${Math.max(1, Math.round(v.durationSeconds / 60))} min`,
    durationLong: `${mins}:${String(secs).padStart(2, '0')}`,
    tags: v.tags,
    description: v.description,
    level: v.level.charAt(0).toUpperCase() + v.level.slice(1),
    views: v.viewCount.toLocaleString('en-IN'),
    uploaded: timeAgo(v.publishedAt),
    featured: v.isFeatured,
    thumbnail: v.thumbnailUrl,
  };
}

/** Thumbnail: uploaded image → bundled image for the id → generic fallback. */
export function demoThumb(v: DemoVideo): string {
  return v.thumbnail || demoVideoImages[v.id] || fallbackSectionImage;
}

let request: Promise<DemoVideo[] | null> | null = null;

/** Featured video first, then the rest (the catalog is small, so the site loads it whole). */
function fetchDemoVideos() {
  request ??= Promise.all([
    api.get<ApiDemoVideo | null>('/demo-videos/featured'),
    api.get<ApiDemoVideo[]>('/demo-videos?pageSize=100'),
  ])
    .then(([featured, list]) => {
      const all = [...(featured.data ? [featured.data] : []), ...list.data];
      return all.length ? all.map(toDemoVideo) : null;
    })
    .catch(() => null);
  return request;
}

/** Demo videos: content.ts fallback first, then the live catalog from the API. */
export function useDemoVideos(): DemoVideo[] {
  const [videos, setVideos] = useState<DemoVideo[]>(staticDemoVideos);
  useEffect(() => {
    let active = true;
    void fetchDemoVideos().then((live) => {
      if (active && live) setVideos(live);
    });
    return () => {
      active = false;
    };
  }, []);
  return videos;
}
