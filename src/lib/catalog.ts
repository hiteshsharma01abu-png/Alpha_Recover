import { useEffect, useState } from 'react';
import { trainingTracks, type TrainingTrack } from '../data/content';
import { api } from './api';

type ApiLesson = { id: string; slug: string; title: string };
type ApiModule = { slug: string; title: string; lessons: ApiLesson[] };
type ApiCourse = { slug: string; title: string; summary: string; modules: ApiModule[] };

/** API course → the shape the UI already uses (slug becomes `id`, as in content.ts). */
function toTrack(c: ApiCourse): TrainingTrack {
  return {
    id: c.slug,
    title: c.title,
    summary: c.summary,
    modules: c.modules.map((m) => ({
      id: m.slug,
      title: m.title,
      lessons: m.lessons.map((l) => ({ id: l.slug, title: l.title })),
    })),
  };
}

let request: Promise<TrainingTrack[] | null> | null = null;

/** One shared request per page load; null when the API is unreachable (e.g. static hosting). */
function fetchTracks() {
  request ??= api
    .get<ApiCourse[]>('/courses?include=outline')
    .then((res) => (res.data.length ? res.data.map(toTrack) : null))
    .catch(() => null);
  return request;
}

/**
 * Training tracks for the UI. Renders the bundled static catalog immediately, then switches to the
 * live catalog from the API if it responds — so the site works with or without the backend.
 * `settled` turns true once the API has answered (or failed).
 */
export function useTrainingTracksState(): { tracks: TrainingTrack[]; settled: boolean } {
  const [state, setState] = useState({ tracks: trainingTracks, settled: false });
  useEffect(() => {
    let active = true;
    void fetchTracks().then((live) => {
      if (active) setState({ tracks: live ?? trainingTracks, settled: true });
    });
    return () => {
      active = false;
    };
  }, []);
  return state;
}

export function useTrainingTracks(): TrainingTrack[] {
  return useTrainingTracksState().tracks;
}
