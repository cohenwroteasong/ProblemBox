import { ArrowLeft, ArrowRight, Building2, Mic } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AGE_BANDS, CONSENT_BONUS_RATE, DIVISIONS, GENDERS, type Role } from '../../../shared/types';
import { homeFor, useAuth } from '../../lib/auth';
import { AuthLayout } from './AuthLayout';

export function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState<Role | null>(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', org: '', phone: '', division: '', gender: '', ageBand: '' });
  const [adult, setAdult] = useState(false);
  const [terms, setTerms] = useState(false);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!role) return;
    setBusy(true);
    setError(null);
    try {
      const user = await signup({ role, ...form, adult, terms, consentContact: consent });
      navigate(homeFor(user), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create your account.');
      setBusy(false);
    }
  }

  if (!role) {
    return (
      <AuthLayout>
        <p className="eyebrow">Create an account</p>
        <h1 className="mt-2 text-4xl">How will you use Kontho?</h1>
        <div className="mt-8 grid gap-3">
          <button className="group rounded-[22px] bg-ink p-6 text-left text-cream transition-transform hover:-translate-y-0.5" onClick={() => setRole('player')}>
            <span className="grid size-11 place-items-center rounded-full bg-amber text-ink">
              <Mic size={20} />
            </span>
            <span className="mt-4 block font-display text-2xl font-extrabold">I want to answer Boxes</span>
            <span lang="bn" className="block text-lg font-semibold text-amber">
              আপনার কণ্ঠ, আপনার আয়
            </span>
            <span className="mt-1 block text-sm text-[#b7c0cd]">Share what life is really like and earn mobile rewards. 18+ only. Free, always.</span>
          </button>
          <button className="group rounded-[22px] border border-line bg-surface p-6 text-left transition-transform hover:-translate-y-0.5" onClick={() => setRole('org')}>
            <span className="grid size-11 place-items-center rounded-full bg-ink text-amber">
              <Building2 size={20} />
            </span>
            <span className="mt-4 block font-display text-2xl font-extrabold">We’re an organisation</span>
            <span className="mt-1 block text-sm text-muted">Run Boxes and get verified insight from all eight divisions. For brands, NGOs, researchers and agencies.</span>
          </button>
        </div>
        <p className="mt-8 text-center text-sm">
          Already have an account?{' '}
          <Link to="/login" className="font-bold text-accent underline decoration-2 underline-offset-4">
            Sign in
          </Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <button className="btn btn-quiet btn-sm -ml-3 mb-4" onClick={() => setRole(null)}>
        <ArrowLeft size={16} /> Back
      </button>
      <p className="eyebrow">{role === 'player' ? 'Join as a player' : 'Organisation account'}</p>
      <h1 className="mt-2 text-4xl">{role === 'player' ? 'Join Kontho' : 'Set up your console'}</h1>

      <form className="mt-7 grid gap-4 sm:grid-cols-2" onSubmit={submit}>
        <label className="sm:col-span-2">
          <span className="label">Your name</span>
          <input className="input" autoComplete="name" required value={form.name} onChange={set('name')} />
        </label>
        {role === 'org' && (
          <label className="sm:col-span-2">
            <span className="label">Organisation</span>
            <input className="input" autoComplete="organization" required value={form.org} onChange={set('org')} placeholder="Brand, NGO, university or agency" />
          </label>
        )}
        <label className="sm:col-span-2">
          <span className="label">Email</span>
          <input className="input" type="email" autoComplete="email" required value={form.email} onChange={set('email')} />
        </label>
        <label className="sm:col-span-2">
          <span className="label">Password</span>
          <input className="input" type="password" autoComplete="new-password" required minLength={8} value={form.password} onChange={set('password')} placeholder="At least 8 characters" />
        </label>

        {role === 'player' && (
          <>
            <label className="sm:col-span-2">
              <span className="label">Mobile number (for bKash or recharge)</span>
              <input className="input tnum" inputMode="numeric" autoComplete="tel" required value={form.phone} onChange={set('phone')} placeholder="01XXXXXXXXX" />
            </label>
            <Pick label="Division" value={form.division} options={DIVISIONS} onChange={(division) => setForm({ ...form, division })} />
            <Pick label="Age" value={form.ageBand} options={AGE_BANDS} onChange={(ageBand) => setForm({ ...form, ageBand })} />
            <div className="sm:col-span-2">
              <Pick label="Gender" value={form.gender} options={GENDERS} onChange={(gender) => setForm({ ...form, gender })} />
            </div>
            <div className="flex flex-col gap-3 rounded-[22px] border border-line bg-surface p-4 sm:col-span-2">
              <Check checked={adult} onChange={setAdult}>
                I am 18 or older.
              </Check>
              <Check checked={terms} onChange={setTerms}>
                I agree to the player terms and reward rules. My answers can be used in anonymous reports.
              </Check>
              <Check checked={consent} onChange={setConsent}>
                <b>Optional:</b> companies may see my name, number and division to invite me to interviews or trials. Earns a {Math.round(CONSENT_BONUS_RATE * 100)}% bonus per Box (sample rate). I can turn this off any time.
              </Check>
            </div>
            <p className="text-sm font-semibold sm:col-span-2">We never ask you for money, a fee or your PIN. Joining is free, always.</p>
          </>
        )}

        {error && (
          <p role="alert" className="rounded-[14px] bg-crit-soft px-4 py-3 text-sm font-semibold text-crit sm:col-span-2">
            {error}
          </p>
        )}
        <button className="btn btn-primary btn-lg w-full sm:col-span-2" disabled={busy || (role === 'player' && (!adult || !terms))}>
          {busy ? 'Creating your account…' : role === 'player' ? 'Join Kontho' : 'Create console'} {!busy && <ArrowRight size={18} />}
        </button>
      </form>
    </AuthLayout>
  );
}

function Pick({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange(v: string): void }) {
  return (
    <label>
      <span className="label">{label}</span>
      <select className="input" required value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="" disabled>
          Choose…
        </option>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}

function Check({ checked, onChange, children }: { checked: boolean; onChange(v: boolean): void; children: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-sm">
      <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-[var(--ink)]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}
