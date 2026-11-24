import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { REGISTER_COUNTRIES, type CountryCode } from '../../shared/countries';
import { AuthTopBar, LearnerShell } from '../components/layout/LearnerShell';
import { refreshSession, useAuth } from '../lib/auth';
import { timeAgo } from '../lib/demoVideos';
import { formErrors } from '../lib/leads';
import { getDashboard } from '../lib/learning';
import { learnerAssets } from '../lib/learnerAssets';
import {
  changePassword,
  clearAvatar,
  getProfile,
  listDevices,
  signOutDevice,
  updateProfile,
  uploadAvatar,
  type Device,
  type Profile,
} from '../lib/profile';
import './SimplePages.css';
import './Dashboard.css';

type FormState = { busy: boolean; error: string; ok: string; fields: Record<string, string> };
const idle: FormState = { busy: false, error: '', ok: '', fields: {} };

/** Runs a form action with busy / error / success messages. */
function useFormAction() {
  const [state, setState] = useState<FormState>(idle);
  const run = useCallback(async (action: () => Promise<unknown>, okMessage: string) => {
    setState({ ...idle, busy: true });
    try {
      await action();
      setState({ ...idle, ok: okMessage });
      return true;
    } catch (err) {
      const { fields, message } = formErrors(err);
      setState({ ...idle, error: message, fields });
      return false;
    }
  }, []);
  return [state, run] as const;
}

const Err = ({ msg }: { msg?: string }) => (msg ? <span className="field-error">{msg}</span> : null);

function Status({ state }: { state: FormState }) {
  if (state.error) return <p className="form-error" role="alert">{state.error}</p>;
  if (state.ok) return <p className="form-success" role="status">{state.ok}</p>;
  return null;
}

function ProfileForm({ profile, onSaved }: { profile: Profile; onSaved: (p: Profile) => void }) {
  const fileId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    firstName: profile.firstName,
    lastName: profile.lastName ?? '',
    certificateName: profile.certificateName ?? '',
    phone: profile.phone ?? '',
    country: profile.country,
    whatsappOptIn: profile.whatsappOptIn,
  });
  const [state, run] = useFormAction();
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarNote, setAvatarNote] = useState<{ ok?: string; error?: string }>({});
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function onAvatarFile(file: File | undefined) {
    if (!file || avatarBusy || state.busy) return;
    setAvatarBusy(true);
    setAvatarNote({});
    try {
      const saved = await uploadAvatar(file);
      onSaved(saved);
      await refreshSession();
      setAvatarNote({ ok: 'Photo updated.' });
    } catch (err) {
      setAvatarNote({ error: formErrors(err).message });
    } finally {
      setAvatarBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function onRemoveAvatar() {
    if (avatarBusy || state.busy || !profile.image) return;
    setAvatarBusy(true);
    setAvatarNote({});
    try {
      const saved = await clearAvatar();
      onSaved(saved);
      await refreshSession();
      setAvatarNote({ ok: 'Photo removed.' });
    } catch (err) {
      setAvatarNote({ error: formErrors(err).message });
    } finally {
      setAvatarBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void run(async () => {
      const saved = await updateProfile({ ...form, phone: form.phone.trim() || null });
      onSaved(saved);
      // Show what the server stored (e.g. the phone in +91… format).
      setForm({
        firstName: saved.firstName,
        lastName: saved.lastName ?? '',
        certificateName: saved.certificateName ?? '',
        phone: saved.phone ?? '',
        country: saved.country,
        whatsappOptIn: saved.whatsappOptIn,
      });
      await refreshSession(); // header / greeting use the first name
    }, 'Profile saved.');
  }

  return (
    <form className="panel settings-panel" onSubmit={onSubmit}>
      <h2>Profile</h2>
      <div className="settings-avatar">
        <img
          className="settings-avatar-img"
          src={profile.image || learnerAssets.avatar}
          alt=""
          width={72}
          height={72}
        />
        <div className="settings-avatar-actions">
          <input
            ref={fileRef}
            id={fileId}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(e) => void onAvatarFile(e.target.files?.[0])}
          />
          <label
            className={`btn btn-ghost settings-avatar-upload${avatarBusy || state.busy ? ' is-disabled' : ''}`}
            htmlFor={avatarBusy || state.busy ? undefined : fileId}
            aria-disabled={avatarBusy || state.busy}
          >
            {avatarBusy ? 'Uploading…' : 'Upload photo'}
          </label>
          {profile.image ? (
            <button type="button" className="btn btn-ghost" disabled={avatarBusy || state.busy} onClick={() => void onRemoveAvatar()}>
              Remove
            </button>
          ) : null}
          <span className="settings-hint">JPEG, PNG or WebP, up to 2 MB.</span>
          {avatarNote.error ? (
            <p className="form-error" role="alert">
              {avatarNote.error}
            </p>
          ) : null}
          {avatarNote.ok ? (
            <p className="form-success" role="status">
              {avatarNote.ok}
            </p>
          ) : null}
        </div>
      </div>
      <div className="settings-grid">
        <div className="field">
          <label htmlFor="p-first">First name</label>
          <input id="p-first" required autoComplete="given-name" value={form.firstName} onChange={(e) => set('firstName', e.target.value)} />
          <Err msg={state.fields.firstName} />
        </div>
        <div className="field">
          <label htmlFor="p-last">Last name</label>
          <input id="p-last" autoComplete="family-name" value={form.lastName} onChange={(e) => set('lastName', e.target.value)} />
          <Err msg={state.fields.lastName} />
        </div>
        <div className="field settings-wide">
          <label htmlFor="p-cert">Name on your certificate</label>
          <input
            id="p-cert"
            placeholder={`${form.firstName} ${form.lastName}`.trim()}
            value={form.certificateName}
            onChange={(e) => set('certificateName', e.target.value)}
          />
          <span className="settings-hint">Leave empty to use your first and last name.</span>
          <Err msg={state.fields.certificateName} />
        </div>
        <div className="field settings-wide">
          <label htmlFor="p-email">Email</label>
          <input id="p-email" value={profile.email} readOnly disabled />
          <span className="settings-hint">{profile.emailVerified ? '✓ Verified' : 'Not verified yet'}</span>
        </div>
        <div className="field">
          <label htmlFor="p-phone">Phone</label>
          <input id="p-phone" type="tel" autoComplete="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          <Err msg={state.fields.phone} />
        </div>
        <div className="field">
          <label htmlFor="p-country">Country</label>
          <select id="p-country" value={form.country} onChange={(e) => set('country', e.target.value as CountryCode)}>
            {REGISTER_COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
          <Err msg={state.fields.country} />
        </div>
      </div>
      <label className="check">
        <input type="checkbox" checked={form.whatsappOptIn} onChange={(e) => set('whatsappOptIn', e.target.checked)} />
        <span>I agree to receive updates on WhatsApp / SMS</span>
      </label>
      <Status state={state} />
      <button className="btn btn-primary" type="submit" disabled={state.busy}>
        {state.busy ? 'Saving…' : 'Save profile'}
      </button>
    </form>
  );
}

function PasswordForm({ onChanged }: { onChanged: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [state, run] = useFormAction();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const ok = await run(() => changePassword(current, next, confirm), 'Password changed. Your other devices have been signed out.');
    if (ok) {
      setCurrent('');
      setNext('');
      setConfirm('');
      onChanged();
    }
  }

  return (
    <form className="panel settings-panel" onSubmit={onSubmit}>
      <h2>Change password</h2>
      <div className="settings-grid">
        <div className="field settings-wide">
          <label htmlFor="pw-current">Current password</label>
          <input id="pw-current" type="password" required autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          <Err msg={state.fields.currentPassword} />
        </div>
        <div className="field">
          <label htmlFor="pw-new">New password</label>
          <input id="pw-new" type="password" required minLength={8} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
          <Err msg={state.fields.password} />
        </div>
        <div className="field">
          <label htmlFor="pw-confirm">Confirm new password</label>
          <input id="pw-confirm" type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          <Err msg={state.fields.confirmPassword} />
        </div>
      </div>
      <Status state={state} />
      <button className="btn btn-primary" type="submit" disabled={state.busy}>
        {state.busy ? 'Saving…' : 'Change password'}
      </button>
    </form>
  );
}

function Devices({ devices, onChange }: { devices: Device[]; onChange: () => void }) {
  const [state, run] = useFormAction();
  const others = devices.filter((d) => !d.current);

  return (
    <section className="panel settings-panel">
      <h2>Your devices</h2>
      <p className="settings-hint">You can be signed in on up to 2 devices. Signing in on another one signs out the oldest.</p>
      <ul className="device-list">
        {devices.map((d) => (
          <li key={d.id}>
            <div>
              <strong>
                {d.device}
                {d.current ? <span className="device-badge">This device</span> : null}
              </strong>
              <span>
                Last active {timeAgo(d.lastActiveAt)}
                {d.ipAddress ? ` · ${d.ipAddress}` : ''}
              </span>
            </div>
            {d.current ? null : (
              <button type="button" className="btn btn-ghost" disabled={state.busy} onClick={() => void run(() => signOutDevice(d.id), 'Device signed out.').then(onChange)}>
                Sign out
              </button>
            )}
          </li>
        ))}
      </ul>
      {others.length > 1 ? (
        <button
          type="button"
          className="btn btn-ghost"
          disabled={state.busy}
          onClick={() => void run(() => Promise.all(others.map((d) => signOutDevice(d.id))), 'Signed out of all other devices.').then(onChange)}
        >
          Sign out of all other devices
        </button>
      ) : null}
      <Status state={state} />
    </section>
  );
}

/** /account/settings — profile, password and devices for a signed-in user. */
export function AccountSettings() {
  const auth = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loadError, setLoadError] = useState('');
  const [hasActiveEnrollment, setHasActiveEnrollment] = useState(false);

  const loadDevices = useCallback(() => {
    listDevices()
      .then(setDevices)
      .catch(() => setDevices([]));
  }, []);

  const userId = auth.user?.id;
  useEffect(() => {
    if (!userId) return;
    getProfile()
      .then(setProfile)
      .catch(() => setLoadError('We couldn’t load your profile. Please refresh the page.'));
    loadDevices();
    let live = true;
    getDashboard()
      .then((d) => {
        if (live) setHasActiveEnrollment(d.hasActiveEnrollment);
      })
      .catch(() => {
        if (live) setHasActiveEnrollment(false);
      });
    return () => {
      live = false;
    };
  }, [userId, loadDevices]);

  const body = (
    <div className="settings-stack">
      {!auth.loaded ? <div className="panel" aria-busy="true" /> : null}
      {loadError ? <p className="form-error">{loadError}</p> : null}
      {auth.user && profile ? (
        <div className="settings-forms">
          <ProfileForm profile={profile} onSaved={setProfile} />
          <div className="settings-side">
            <PasswordForm onChanged={loadDevices} />
            <Devices devices={devices} onChange={loadDevices} />
          </div>
        </div>
      ) : null}
    </div>
  );

  if (!auth.loaded) {
    return (
      <div className="dsh-gate">
        <AuthTopBar />
        <section className="dsh-gate-body">{body}</section>
      </div>
    );
  }

  if (!auth.user) {
    return <Navigate to="/account" replace />;
  }

  return (
    <LearnerShell title="Account settings" showUpgrade={!hasActiveEnrollment}>
      {body}
    </LearnerShell>
  );
}
