/** Countries offered on the register form (docs/API.md §1); stored as ISO-3166 alpha-2, ZZ = Other. */
export const REGISTER_COUNTRIES = [
  { code: 'IN', label: 'India' },
  { code: 'US', label: 'United States' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'AE', label: 'United Arab Emirates' },
  { code: 'ZZ', label: 'Other' },
] as const;

export type CountryCode = (typeof REGISTER_COUNTRIES)[number]['code'];
