import { Check, LogOut, Monitor, Moon, Sun } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { User } from '../../shared/types';
import { PageHeader } from '../components/PageHeader';
import { Switch } from '../components/Switch';
import { api } from '../lib/api';
import { useAuth, useUser } from '../lib/auth';
import { useLive } from '../lib/live';
import { useTheme, type ThemePref } from '../lib/theme';

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="card grid gap-5 p-5 sm:p-6 md:grid-cols-[260px_minmax(0,1fr)] md:gap-8">
      <div>
        <h2 className="text-[15px] font-bold">{title}</h2>
        <p className="mt-1 text-[13px] text-ink-3">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function Notice({ kind, children }: { kind: 'ok' | 'error'; children: ReactNode }) {
  return (
    <p
      role={kind === 'error' ? 'alert' : 'status'}
      className="inline-flex items-center gap-1.5 text-[13px] font-medium"
      style={{ color: kind === 'ok' ? 'var(--st-resolved)' : 'var(--pr-urgent)' }}
    >
      {kind === 'ok' && <Check size={14} />}
      {children}
    </p>
  );
}

export function Settings() {
  const user = useUser();
  const { setUser, logout } = useAuth();
  const { popups, setPopups } = useLive();
  const [theme, setTheme] = useTheme();
  const navigate = useNavigate();

  const [profile, setProfile] = useState({ name: user.name, org: user.org });
  const [profileMsg, setProfileMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [pw, setPw] = useState({ current: '', next: '' });
  const [pwMsg, setPwMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setBusy('profile');
    setProfileMsg(null);
    try {
      const r = await api<{ user: User }>('/me', { method: 'PATCH', body: profile });
      setUser(r.user);
      setProfileMsg({ kind: 'ok', text: 'Saved' });
    } catch (err) {
      setProfileMsg({ kind: 'error', text: err instanceof Error ? err.message : 'Could not save.' });
    } finally {
      setBusy(null);
    }
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    setBusy('password');
    setPwMsg(null);
    try {
      await api('/me/password', { body: pw });
      setPw({ current: '', next: '' });
      setPwMsg({ kind: 'ok', text: 'Password changed. Other devices have been signed out.' });
    } catch (err) {
      setPwMsg({ kind: 'error', text: err instanceof Error ? err.message : 'Could not change password.' });
    } finally {
      setBusy(null);
    }
  }

  async function setDemoFeed(on: boolean) {
    const r = await api<{ user: User }>('/me', { method: 'PATCH', body: { demoFeed: on } });
    setUser(r.user);
  }

  const themes: { value: ThemePref; label: string; icon: typeof Sun }[] = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'Match system', icon: Monitor },
  ];

  return (
    <div className="animate-rise flex flex-col gap-4">
      <PageHeader title="Settings" subtitle="Your profile, sign-in and how Kontho notifies you." />

      <Section title="Profile" description="Your organisation name is shown on every public problem box page.">
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={saveProfile}>
          <label>
            <span className="label">Name</span>
            <input className="input" value={profile.name} onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))} required />
          </label>
          <label>
            <span className="label">Organisation</span>
            <input className="input" value={profile.org} onChange={(e) => setProfile((p) => ({ ...p, org: e.target.value }))} />
          </label>
          <label className="sm:col-span-2">
            <span className="label">Email</span>
            <input className="input bg-surface-2 text-ink-2" value={user.email} readOnly />
          </label>
          <div className="flex items-center gap-3 sm:col-span-2">
            <button className="btn btn-primary" disabled={busy === 'profile'}>
              Save profile
            </button>
            {profileMsg && <Notice kind={profileMsg.kind}>{profileMsg.text}</Notice>}
          </div>
        </form>
      </Section>

      <Section title="Password" description="Changing your password signs you out everywhere else.">
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={changePassword}>
          <label>
            <span className="label">Current password</span>
            <input className="input" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))} required />
          </label>
          <label>
            <span className="label">New password</span>
            <input className="input" type="password" autoComplete="new-password" minLength={8} value={pw.next} onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))} placeholder="At least 8 characters" required />
          </label>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <button className="btn btn-secondary" disabled={busy === 'password'}>
              Change password
            </button>
            {pwMsg && <Notice kind={pwMsg.kind}>{pwMsg.text}</Notice>}
          </div>
        </form>
      </Section>

      <Section title="Notifications" description="How new problems get your attention while Kontho is open.">
        <div className="flex flex-col divide-y divide-line rounded-xl border border-line">
          <Toggle label="Pop-up for each new problem" hint="A card slides in at the bottom-right corner. Saved for this browser." checked={popups} onChange={setPopups} />
          <Toggle
            label="Simulate incoming problems"
            hint="While a dashboard is open, realistic sample problems arrive every 10–20 seconds, marked “Simulated”. Handy for demos; turn it off when you go live."
            checked={user.demoFeed}
            onChange={setDemoFeed}
          />
        </div>
      </Section>

      <Section title="Appearance" description="Saved for this browser.">
        <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Theme">
          {themes.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              role="radio"
              aria-checked={theme === value}
              onClick={() => setTheme(value)}
              className={`flex h-12 items-center gap-2.5 rounded-xl border px-4 text-sm font-semibold transition-colors ${theme === value ? 'border-brand bg-brand-soft text-brand-ink' : 'border-line text-ink-2 hover:border-line-strong'}`}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Session" description={`Signed in as ${user.email}.`}>
        <button
          className="btn btn-secondary"
          onClick={async () => {
            await logout();
            navigate('/login');
          }}
        >
          <LogOut size={16} /> Sign out
        </button>
      </Section>
    </div>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange(v: boolean): void }) {
  return (
    <div className="flex items-start justify-between gap-6 p-4">
      <div>
        <div className="text-sm font-semibold">{label}</div>
        <div className="mt-0.5 text-[13px] text-ink-3">{hint}</div>
      </div>
      <div className="pt-0.5">
        <Switch checked={checked} onChange={onChange} label={label} />
      </div>
    </div>
  );
}
