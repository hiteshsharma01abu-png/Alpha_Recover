import { api } from './api';

/** Lesson in the public course outline (`GET /courses/:slug`). The video id is never sent. */
export type OutlineLesson = { id: string; slug: string; title: string; durationSeconds: number | null; isPreview: boolean; hasVideo: boolean };
export type OutlineModule = { slug: string; title: string; lessons: OutlineLesson[] };
export type CourseOutline = { slug: string; title: string; summary: string; modules: OutlineModule[] };

export type CourseProgress = {
  enrolled: boolean;
  lessons: Record<string, { positionSeconds: number; completed: boolean }>;
  lessonsTotal: number;
  lessonsCompleted: number;
  progressPct: number;
};

export type LessonRef = { lessonId: string; moduleSlug: string; lessonSlug: string; lessonTitle: string };
export type Dashboard = {
  courses: { slug: string; title: string; lessonsTotal: number; lessonsCompleted: number; progressPct: number; next: LessonRef | null }[];
  continue: (LessonRef & { courseSlug: string; positionSeconds: number }) | null;
  certificates: { code: string; programTitle: string; issuedAt: string }[];
  hasActiveEnrollment: boolean;
};

export const lessonPath = (courseSlug: string, moduleSlug: string, lessonSlug: string) => `/learn/${courseSlug}/${moduleSlug}/${lessonSlug}`;

export const getCourseOutline = (slug: string) => api.get<CourseOutline>(`/courses/${slug}`).then((r) => r.data);
export const getCourseProgress = (slug: string) => api.get<CourseProgress>(`/me/progress?course=${slug}`).then((r) => r.data);
export const getDashboard = () => api.get<Dashboard>('/me/dashboard').then((r) => r.data);
export const getPlayback = (lessonId: string) =>
  api.post<{ embedUrl: string; expiresAt: string; resumeAt: number }>(`/lessons/${lessonId}/playback`).then((r) => r.data);
export const saveProgress = (lessonId: string, body: { positionSeconds?: number; watchedSeconds?: number; completed?: boolean }) =>
  api.put<{ completedAt: string | null; courseProgressPct: number }>(`/me/progress/${lessonId}`, body).then((r) => r.data);
