import { useEffect, useState } from 'react';
import { company as staticCompany, socialLinks as staticSocialLinks, type SocialPlatform } from '../data/content';
import { api } from './api';

export type Company = typeof staticCompany;
export type SiteSettings = { company: Company; socialLinks: { platform: SocialPlatform; url: string }[] };

const fallback: SiteSettings = { company: staticCompany, socialLinks: staticSocialLinks };

let request: Promise<Partial<SiteSettings> | null> | null = null;

/** Contact details and social links: content.ts fallback first, then site_settings from the API. */
export function useSiteSettings(): SiteSettings {
  const [settings, setSettings] = useState<SiteSettings>(fallback);
  useEffect(() => {
    let active = true;
    request ??= api
      .get<Partial<SiteSettings>>('/settings/public')
      .then((res) => res.data)
      .catch(() => null);
    void request.then((live) => {
      if (active && live) {
        setSettings({ company: { ...staticCompany, ...live.company }, socialLinks: live.socialLinks ?? staticSocialLinks });
      }
    });
    return () => {
      active = false;
    };
  }, []);
  return settings;
}
