import { ArrowRight, Eye, EyeOff, Sparkles } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { AuthLayout } from './AuthLayout';

const DEMO = { email: 'demo@kontho.app', password: 'demo1234' };

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const next = params.get('next');
  const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';

  async function submit(e: string, p: string) {
    setBusy(true);
    setError(null);
    try {
      await login(e, p);
      navigate(target, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in.');
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <h2 className="text-[1.75rem] font-bold tracking-tight">Welcome back</h2>
      <p className="mt-1.5 text-[15px] text-ink-2">Sign in to see what people are telling you.</p>

      <form
        className="mt-8 flex flex-col gap-4"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          void submit(email, password);
        }}
      >
        <label>
          <span className="label">Email</span>
          <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@organisation.com" />
        </label>
        <label>
          <span className="label">Password</span>
          <span className="relative block">
            <input
              className="input pr-11"
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
            <button type="button" className="absolute inset-y-0 right-0 grid w-11 place-items-center text-ink-3 hover:text-ink" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
              {show ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </span>
        </label>

        {error && (
          <p role="alert" className="rounded-xl px-3 py-2.5 text-[13px] font-medium" style={{ background: 'var(--pr-urgent-soft)', color: 'var(--pr-urgent)' }}>
            {error}
          </p>
        )}

        <button className="btn btn-primary mt-1 h-11 w-full" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
          {!busy && <ArrowRight size={16} />}
        </button>
      </form>

      <div className="my-6 flex items-center gap-3 text-xs text-ink-3">
        <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
      </div>

      <button
        className="group flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-4 text-left transition-colors hover:border-brand hover:bg-brand-soft"
        disabled={busy}
        onClick={() => {
          setEmail(DEMO.email);
          setPassword(DEMO.password);
          void submit(DEMO.email, DEMO.password);
        }}
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand group-hover:bg-surface">
          <Sparkles size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Explore the demo workspace</span>
          <span className="block truncate text-[13px] text-ink-3">
            {DEMO.email} · {DEMO.password}
          </span>
        </span>
        <ArrowRight size={16} className="text-ink-3 transition-transform group-hover:translate-x-0.5 group-hover:text-brand" />
      </button>

      <p className="mt-8 text-center text-sm text-ink-2">
        New to Kontho?{' '}
        <Link to="/signup" className="font-semibold text-brand-ink hover:underline">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
}
