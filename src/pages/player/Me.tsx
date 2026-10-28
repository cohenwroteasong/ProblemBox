import { LogOut } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AGE_BANDS, CONSENT_BONUS_RATE, DIVISIONS, GENDERS, type User } from '../../../shared/types';
import { Switch } from '../../components/Switch';
import { api } from '../../lib/api';
import { useAuth, useUser } from '../../lib/auth';
import { useLive } from '../../lib/live';

export function Me() {
  const user = useUser();
  const { setUser, logout } = useAuth();
  const { popups, setPopups } = useLive();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: user.name, phone: user.phone, division: user.division, gender: user.gender, ageBand: user.ageBand });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pw, setPw] = useState({ current: '', next: '' });
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function patch(body: Record<string, unknown>) {
    const r = await api<{ user: User }>('/me', { method: 'PATCH', body });
    setUser(r.user);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      await patch(form);
      setMsg({ ok: true, text: 'Saved' });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'Could not save.' });
    }
  }

  return (
    <div className="animate-rise mx-auto flex max-w-2xl flex-col gap-6">
      <section>
        <p className="eyebrow">Me</p>
        <h1 className="mt-2 text-4xl">{user.name}</h1>
        <p className="text-muted">{user.email}</p>
      </section>

      <form className="card grid gap-4 p-6 sm:grid-cols-2" onSubmit={save}>
        <h2 className="text-xl sm:col-span-2">Profile</h2>
        <label className="sm:col-span-2">
          <span className="label">Name</span>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </label>
        <label className="sm:col-span-2">
          <span className="label">Mobile number (for bKash or recharge)</span>
          <input className="input tnum" inputMode="numeric" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
        </label>
        <Select label="Division" value={form.division} options={DIVISIONS} onChange={(division) => setForm({ ...form, division })} />
        <Select label="Gender" value={form.gender} options={GENDERS} onChange={(gender) => setForm({ ...form, gender })} />
        <Select label="Age" value={form.ageBand} options={AGE_BANDS} onChange={(ageBand) => setForm({ ...form, ageBand })} />
        <div className="flex items-center gap-3 sm:col-span-2">
          <button className="btn btn-amber">Save profile</button>
          {msg && <span className={`text-sm font-semibold ${msg.ok ? 'text-mint' : 'text-pink'}`}>{msg.text}</span>}
        </div>
      </form>

      <section className="card divide-y divide-line">
        <Toggle
          title="Share my contact details with the client"
          hint={`Companies may see your name, number and division so they can invite you to interviews or trials. Earns a ${Math.round(CONSENT_BONUS_RATE * 100)}% contact-consent bonus on each Box (sample rate). Off by default; turn it off any time.`}
          checked={user.consentContact}
          onChange={(v) => patch({ consentContact: v })}
        />
        <Toggle title="Pop-ups" hint="A card pops up when a new Box opens or your results are in. Saved for this browser." checked={popups} onChange={setPopups} />
        <Toggle
          title="Simulate activity"
          hint="While Kontho is open, sample players answer live Boxes and a demo release slot opens new Boxes, all marked Sample. Turn off to see only real activity."
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
          {pwMsg && <span className={`text-sm font-semibold ${pwMsg.ok ? 'text-mint' : 'text-pink'}`}>{pwMsg.text}</span>}
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

function Select({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange(v: string): void }) {
  return (
    <label>
      <span className="label">{label}</span>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}

export function Toggle({ title, hint, checked, onChange }: { title: string; hint: string; checked: boolean; onChange(v: boolean): void }) {
  return (
    <div className="flex items-start justify-between gap-6 p-5">
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-0.5 text-sm text-muted">{hint}</p>
      </div>
      <Switch checked={checked} onChange={onChange} label={title} />
    </div>
  );
}
