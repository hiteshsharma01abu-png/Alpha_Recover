import { describe, expect, it } from 'vitest';
import { ago, formatIst, reasonLabel, sourceLabel, waDigits } from './leadDisplay';

describe('lead display helpers', () => {
  const now = Date.parse('2026-11-13T12:00:00Z');

  it('shows recent times in minutes and hours, older ones in days', () => {
    expect(ago('2026-11-13T11:59:40Z', now)).toBe('just now');
    expect(ago('2026-11-13T11:35:00Z', now)).toBe('25 minutes ago');
    expect(ago('2026-11-13T09:00:00Z', now)).toBe('3 hours ago');
    expect(ago('2026-11-12T12:00:00Z', now)).toBe('yesterday');
    expect(ago('2026-11-08T12:00:00Z', now)).toBe('5 days ago');
  });

  it('formats in India time regardless of the browser zone', () => {
    expect(formatIst('2026-11-13T18:30:00Z')).toMatch(/14 Nov 2026.*12:00\s?am IST/i);
  });

  it('maps codes to labels and phones to wa.me digits', () => {
    expect(reasonLabel('data_recovery_service')).toBe('Data Recovery services');
    expect(reasonLabel(null)).toBe('—');
    expect(sourceLabel('callback')).toBe('Callback request');
    expect(waDigits('+91 98123 45678')).toBe('919812345678');
  });
});
