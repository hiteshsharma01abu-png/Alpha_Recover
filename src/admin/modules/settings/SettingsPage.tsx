import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { company as defaultCompany, socialLinks as defaultSocialLinks } from '../../../data/content';
import type { SocialPlatform } from '../../../data/content';
import { ApiError } from '../../../lib/api';
import type { Company } from '../../../lib/settings';
import { useAdminSession } from '../../auth/adminSessionContext';
import { ErrorState, Skeleton } from '../../components/States';
import { adminApi } from '../../lib/adminApi';
import type { AdminSettings, SettingEntry } from '../../lib/adminApi';
import { ago, formatIst } from '../../lib/format';
import { useResource } from '../../lib/useResource';
import './Settings.css';

/** Built-in values the code uses while a key is unset (keep in sync with getSetting() fallbacks). */
const DEFAULT_LEAD_EMAILS = ['info@alpharecover.com'];
const DEFAULT_MAX_SESSIONS = 2;
const PLATFORMS: { id: SocialPlatform; label: string; placeholder: string }[] = [
  { id: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@yourchannel' },
  { id: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/company/…' },
  { id: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/…' },
  { id: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/…' },
];

type Tab = 'site' | 'notifications' | 'policies';

const errorsFrom = (err: unknown) => (err instanceof ApiError ? Object.fromEntries(err.details.map((d) => [d.path.replace(/^value\.?/, ''), d.message])) : {});

/** /admin/settings[/notifications|/policies] — values stored in site_settings, one save per section. */
export function SettingsPage() {
  const { tab = 'site' } = useParams();
  const settings = useResource('settings', adminApi.settings.get);

  return (
    <div>
      <nav className="adm-tabs" aria-label="Settings sections">
        <NavLink to="/admin/settings" end>
          Site &amp; contact
        </NavLink>
        <NavLink to="/admin/settings/notifications">Notifications</NavLink>
        <NavLink to="/admin/settings/policies">Policies</NavLink>
      </nav>
      {settings.error && !settings.data ? (
        <ErrorState message="Settings could not be loaded." requestId={settings.error.requestId} onRetry={settings.reload} />
      ) : !settings.data ? (
        <Skeleton height={360} />
      ) : (
        <SettingsTab key={tab} tab={tab as Tab} s={settings.data} reload={settings.reload} />
      )}
    </div>
  );
}

function SettingsTab({ tab, s, reload }: { tab: Tab; s: AdminSettings; reload: () => void }) {
  if (tab === 'notifications') return <LeadEmailsSection entry={s.lead_notification_emails} reload={reload} />;
  if (tab === 'policies') return <PoliciesSection entry={s.max_student_sessions} certificates={s.certificate_criteria} reload={reload} />;
  return (
    <div className="adm-settings">
      <CompanySection entry={s.company} reload={reload} />
      <SocialSection entry={s.social_links} reload={reload} />
    </div>
  );
}

/** One card with its own Save button, status line and errors. */
function Section<T>({
  title,
  intro,
  entry,
  canEdit,
  readOnlyNote,
  onSave,
  children,
}: {
  title: string;
  intro: ReactNode;
  entry: SettingEntry<T>;
  canEdit: boolean;
  readOnlyNote: string;
  onSave: () => Promise<{ changed: boolean }> | null;
  children: (errors: Record<string, string>) => ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const task = onSave();
    if (!task) return;
    setBusy(true);
    setErrors({});
    setError('');
    setNotice('');
    task
      .then(
        (r) => setNotice(r.changed ? (entry.isPublic ? 'Saved. The website shows it within 5 minutes.' : 'Saved.') : 'Nothing changed.'),
        (err: unknown) => {
          setErrors(errorsFrom(err));
          setError(err instanceof ApiError ? err.message : 'Could not save. Please try again.');
        },
      )
      .finally(() => setBusy(false));
  };

  return (
    <form className="adm-panel adm-settings-card" onSubmit={submit}>
      <div className="adm-panel-head">
        <h3>{title}</h3>
        <span className="adm-muted adm-small">
          {entry.updatedAt ? (
            <>
              Changed <time title={formatIst(entry.updatedAt)}>{ago(entry.updatedAt)}</time>
              {entry.updatedBy?.firstName ? ` by ${entry.updatedBy.firstName}` : ''}
            </>
          ) : (
            'Using the built-in default'
          )}
        </span>
      </div>
      <p className="adm-muted adm-settings-intro">{intro}</p>
      <fieldset disabled={!canEdit || busy}>{children(errors)}</fieldset>
      {notice ? (
        <p className="adm-notice" role="status">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="adm-error" role="alert">
          {error}
        </p>
      ) : null}
      {canEdit ? (
        <div className="adm-settings-save">
          <button type="submit" className="adm-btn adm-btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      ) : (
        <p className="adm-muted adm-small">{readOnlyNote}</p>
      )}
    </form>
  );
}

const COMPANY_FIELDS: { group: string; fields: { key: keyof Company; label: string; hint?: string; wide?: boolean }[] }[] = [
  {
    group: 'Business',
    fields: [
      { key: 'name', label: 'Business name' },
      { key: 'shortName', label: 'Short name' },
      { key: 'tagline', label: 'Tagline', wide: true },
      { key: 'cin', label: 'CIN' },
      { key: 'gst', label: 'GST number' },
    ],
  },
  {
    group: 'Contact',
    fields: [
      { key: 'email', label: 'Email' },
      { key: 'phoneDisplay', label: 'Phone as shown', hint: 'e.g. +91 63551 97917' },
      { key: 'phone', label: 'Phone (digits)', hint: 'e.g. 6355197917' },
      { key: 'phoneHref', label: 'Call link', hint: 'tel: plus the full number, e.g. tel:+916355197917' },
      { key: 'whatsapp', label: 'WhatsApp link', hint: 'e.g. https://wa.me/916355197917', wide: true },
      { key: 'replyNote', label: 'Reply promise', hint: 'e.g. We reply within 24 hours' },
    ],
  },
  {
    group: 'Address & hours',
    fields: [
      { key: 'address', label: 'Short address', hint: 'City, state, country' },
      { key: 'hours', label: 'Opening hours' },
      { key: 'addressFull', label: 'Full address', wide: true },
      { key: 'visitNote', label: 'Visit note', wide: true },
    ],
  },
];

function CompanySection({ entry, reload }: { entry: SettingEntry<Company>; reload: () => void }) {
  const { can } = useAdminSession();
  const [value, setValue] = useState<Company>({ ...defaultCompany, ...entry.value });
  return (
    <Section
      title="Contact details"
      intro="Shown in the header, footer, contact page and WhatsApp buttons across the website."
      entry={entry}
      canEdit={can('settings.edit')}
      readOnlyNote="Only Admins can change contact details."
      onSave={() => adminApi.settings.save('company', value).then((r) => (reload(), r))}
    >
      {(errors) =>
        COMPANY_FIELDS.map((g) => (
          <div key={g.group} className="adm-settings-group">
            <h4>{g.group}</h4>
            <div className="adm-settings-grid">
              {g.fields.map((f) => (
                <label key={f.key} className={f.wide ? 'adm-settings-wide' : undefined}>
                  {f.label}
                  <input required={f.key !== 'cin' && f.key !== 'gst'} maxLength={300} value={value[f.key]} onChange={(e) => setValue((v) => ({ ...v, [f.key]: e.target.value }))} />
                  {errors[f.key] ? <span className="adm-field-error">{errors[f.key]}</span> : f.hint ? <span className="adm-muted adm-small">{f.hint}</span> : null}
                </label>
              ))}
            </div>
          </div>
        ))
      }
    </Section>
  );
}

function SocialSection({ entry, reload }: { entry: SettingEntry<{ platform: SocialPlatform; url: string }[]>; reload: () => void }) {
  const { can } = useAdminSession();
  const current = entry.value ?? defaultSocialLinks;
  const [urls, setUrls] = useState<Record<SocialPlatform, string>>(
    () => Object.fromEntries(PLATFORMS.map((p) => [p.id, current.find((l) => l.platform === p.id)?.url ?? ''])) as Record<SocialPlatform, string>,
  );
  const links = PLATFORMS.filter((p) => urls[p.id].trim()).map((p) => ({ platform: p.id, url: urls[p.id].trim() }));
  return (
    <Section
      title="Social links"
      intro="Icons in the website footer. Leave a field empty to hide that icon."
      entry={entry}
      canEdit={can('settings.edit')}
      readOnlyNote="Only Admins can change social links."
      onSave={() => adminApi.settings.save('social_links', links).then((r) => (reload(), r))}
    >
      {(errors) => (
        <div className="adm-settings-grid">
          {PLATFORMS.map((p) => {
            const err = errors[String(links.findIndex((l) => l.platform === p.id))] ?? errors[`${links.findIndex((l) => l.platform === p.id)}.url`];
            return (
              <label key={p.id}>
                {p.label}
                <input type="url" placeholder={p.placeholder} value={urls[p.id]} onChange={(e) => setUrls((u) => ({ ...u, [p.id]: e.target.value }))} />
                {err ? <span className="adm-field-error">{err}</span> : null}
              </label>
            );
          })}
        </div>
      )}
    </Section>
  );
}

function LeadEmailsSection({ entry, reload }: { entry: SettingEntry<string[]>; reload: () => void }) {
  const { can } = useAdminSession();
  const [text, setText] = useState((entry.value ?? DEFAULT_LEAD_EMAILS).join('\n'));
  const emails = text
    .split(/[\n,]/)
    .map((e) => e.trim())
    .filter(Boolean);
  return (
    <div className="adm-settings">
      <Section
        title="New lead alerts"
        intro="Every contact-form and callback request is emailed to these addresses (up to 10)."
        entry={entry}
        canEdit={can('settings.edit')}
        readOnlyNote="Only Admins can change who gets lead alerts."
        onSave={() => adminApi.settings.save('lead_notification_emails', emails).then((r) => (reload(), r))}
      >
        {(errors) => (
          <label className="adm-settings-field">
            Email addresses, one per line
            <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} />
            {Object.values(errors)[0] ? <span className="adm-field-error">{Object.values(errors)[0]}</span> : null}
          </label>
        )}
      </Section>
    </div>
  );
}

type CertificateCriteria = { type: 'all_lessons_completed' | 'manual' };

function PoliciesSection({ entry, certificates, reload }: { entry: SettingEntry<number>; certificates: SettingEntry<CertificateCriteria>; reload: () => void }) {
  const { can } = useAdminSession();
  const [max, setMax] = useState(String(entry.value ?? DEFAULT_MAX_SESSIONS));
  const [criteria, setCriteria] = useState<CertificateCriteria['type']>(certificates.value?.type ?? 'all_lessons_completed');
  return (
    <div className="adm-settings">
      <Section
        title="Student device limit"
        intro="How many devices a student can be signed in on at once. Signing in on one more signs out the oldest device, which discourages shared logins. Staff accounts are not affected."
        entry={entry}
        canEdit={can('settings.edit_policies')}
        readOnlyNote="Only a Super Admin can change policies."
        onSave={() => {
          const n = Number(max);
          return adminApi.settings.save('max_student_sessions', n).then((r) => (reload(), r));
        }}
      >
        {(errors) => (
          <label className="adm-settings-field adm-settings-narrow">
            Devices per student
            <input type="number" min={1} max={10} required value={max} onChange={(e) => setMax(e.target.value)} />
            {Object.values(errors)[0] ? <span className="adm-field-error">{Object.values(errors)[0]}</span> : <span className="adm-muted adm-small">1–10. Applies from each student&apos;s next sign-in.</span>}
          </label>
        )}
      </Section>
      <Section
        title="Certificates"
        intro="When students get their course certificate. Automatic: issued (and emailed) the moment a student completes every lesson of a course. Manual: only the certificates staff issue from the Certificates page. Certificates already issued are not affected."
        entry={certificates}
        canEdit={can('settings.edit_policies')}
        readOnlyNote="Only a Super Admin can change policies."
        onSave={() => adminApi.settings.save('certificate_criteria', { type: criteria }).then((r) => (reload(), r))}
      >
        {(errors) => (
          <label className="adm-settings-field adm-settings-medium">
            Issue certificates
            <select value={criteria} onChange={(e) => setCriteria(e.target.value as CertificateCriteria['type'])}>
              <option value="all_lessons_completed">Automatically, when all lessons are complete</option>
              <option value="manual">Only when staff issue them</option>
            </select>
            {Object.values(errors)[0] ? <span className="adm-field-error">{Object.values(errors)[0]}</span> : null}
          </label>
        )}
      </Section>
    </div>
  );
}
