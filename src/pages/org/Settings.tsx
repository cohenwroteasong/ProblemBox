import { LogOut } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { User } from '../../../shared/types';
import { api } from '../../lib/api';
import { useAuth, useUser } from '../../lib/auth';
import { useLive } from '../../lib/live';
import { Toggle } from '../player/Me';

export function OrgSettings() {
  const user = useUser();
  const { setUser, logout } = useAuth();
  const { popups, setPopups } = useLive();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: user.name, org: user.org });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pw, setPw] = useState({ current: '', next: '' });
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function patch(body: Record<string, unknown>) {
    const r = await api<{ user: User }>('/me', { method: 'PATCH', body });
    setUser(r.user);
  }

  return (
    <div className="animate-rise mx-auto flex max-w-3xl flex-col gap-6">
      <section>
        <p className="eyebrow">Settings</p>
        <h1 className="mt-2 text-4xl">{user.org}</h1>
        <p className="text-muted">{user.email}</p>
      </section>

      <form
        className="card grid gap-4 p-6 sm:grid-cols-2"
        onSubmit={async (e: FormEvent) => {
          e.preventDefault();
          setMsg(null);
          try {
            await patch(form);
            setMsg({ ok: true, text: 'Saved' });
          } catch (err) {
            setMsg({ ok: false, text: err instanceof Error ? err.message : 'Could not save.' });
          }
        }}
      >
        <h2 className="text-xl sm:col-span-2">Profile</h2>
        <label>
          <span className="label">Your name</span>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </label>
        <label>
          <span className="label">Organisation</span>
          <input className="input" value={form.org} onChange={(e) => setForm({ ...form, org: e.target.value })} required />
        </label>
        <div className="flex items-center gap-3 sm:col-span-2">
          <button className="btn btn-primary">Save</button>
          {msg && <span className={`text-sm font-semibold ${msg.ok ? 'text-good' : 'text-crit'}`}>{msg.text}</span>}
        </div>
      </form>

      <section className="card divide-y divide-line">
        <Toggle title="Pop-ups" hint="A card pops up for new verified answers (at most one every few seconds) and when a Box closes. Saved for this browser." checked={popups} onChange={setPopups} />
        <Toggle
          title="Simulate sample players"
          hint="While the console is open, sample players answer your live Boxes so you can watch a report fill in. Their answers are marked simulated. Turn off before you go live."
          checked={user.demoFeed}
          onChange={(v) => patch({ demoFeed: v })}
        />
      </section>

      <form
        className="card grid gap-4 p-6 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setPwMsg(null);
          try {
            await api('/me/password', { body: pw });
            setPw({ current: '', next: '' });
            setPwMsg({ ok: true, text: 'Password changed. Other devices were signed out.' });
          } catch (err) {
            setPwMsg({ ok: false, text: err instanceof Error ? err.message : 'Could not change password.' });
          }
        }}
      >
        <h2 className="text-xl sm:col-span-2">Password</h2>
        <label>
          <span className="label">Current password</span>
          <input className="input" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required />
        </label>
        <label>
          <span className="label">New password</span>
          <input className="input" type="password" autoComplete="new-password" minLength={8} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required />
        </label>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button className="btn btn-ghost">Change password</button>
          {pwMsg && <span className={`text-sm font-semibold ${pwMsg.ok ? 'text-good' : 'text-crit'}`}>{pwMsg.text}</span>}
        </div>
      </form>

      <button
        className="btn btn-ghost self-start"
        onClick={async () => {
          await logout();
          navigate('/login');
        }}
      >
        <LogOut size={17} /> Sign out
      </button>
    </div>
  );
}
