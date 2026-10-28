import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { AuthLayout } from './AuthLayout';

export function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', org: '', email: '', password: '' });
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signup(form);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create your account.');
      setBusy(false);
    }
  }

  const strength = form.password.length === 0 ? null : form.password.length < 8 ? 'Too short' : form.password.length < 12 ? 'Good' : 'Strong';

  return (
    <AuthLayout>
      <h2 className="text-[1.75rem] font-bold tracking-tight">Create your workspace</h2>
      <p className="mt-1.5 text-[15px] text-ink-2">Set up your first problem box in under a minute.</p>

      <form className="mt-8 flex flex-col gap-4" onSubmit={submit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="label">Your name</span>
            <input className="input" autoComplete="name" required value={form.name} onChange={set('name')} placeholder="Ayesha Rahman" />
          </label>
          <label>
            <span className="label">
              Organisation <span className="font-normal text-ink-3">(optional)</span>
            </span>
            <input className="input" autoComplete="organization" value={form.org} onChange={set('org')} placeholder="Your company or campus" />
          </label>
        </div>
        <label>
          <span className="label">Work email</span>
          <input className="input" type="email" autoComplete="email" required value={form.email} onChange={set('email')} placeholder="you@organisation.com" />
        </label>
        <label>
          <span className="label">Password</span>
          <span className="relative block">
            <input className="input pr-11" type={show ? 'text' : 'password'} autoComplete="new-password" required minLength={8} value={form.password} onChange={set('password')} placeholder="At least 8 characters" />
            <button type="button" className="absolute inset-y-0 right-0 grid w-11 place-items-center text-ink-3 hover:text-ink" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
              {show ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </span>
          {strength && (
            <span className="mt-1.5 block text-xs font-medium" style={{ color: strength === 'Too short' ? 'var(--pr-high)' : 'var(--st-resolved)' }}>
              {strength}
            </span>
          )}
        </label>

        {error && (
          <p role="alert" className="rounded-xl px-3 py-2.5 text-[13px] font-medium" style={{ background: 'var(--pr-urgent-soft)', color: 'var(--pr-urgent)' }}>
            {error}
          </p>
        )}

        <button className="btn btn-primary mt-1 h-11 w-full" disabled={busy}>
          {busy ? 'Creating your workspace…' : 'Create account'}
          {!busy && <ArrowRight size={16} />}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-ink-2">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-brand-ink hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
