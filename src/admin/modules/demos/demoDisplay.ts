import type { DemoCategory, SkillLevel } from '../../lib/adminApi';

export const CATEGORY_LABEL: Record<DemoCategory, string> = { logical: 'Logical', electrical: 'Electrical', mechanical: 'Mechanical', firmware: 'Firmware' };
export const LEVEL_LABEL: Record<SkillLevel, string> = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };

/** 754 → "12:34". */
export const mmss = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/** "12:34" or "12" (minutes) → seconds, or null. */
export function parseMmss(text: string): number | null {
  const m = /^\s*(\d{1,3})(?::([0-5]\d))?\s*$/.exec(text);
  if (!m) return null;
  const total = Number(m[1]) * 60 + Number(m[2] ?? 0);
  return total > 0 ? total : null;
}
