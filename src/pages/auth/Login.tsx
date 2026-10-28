import { ArrowRight, Building2, Eye, EyeOff, Sparkles } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { homeFor, useAuth } from '../../lib/auth';
import { AuthLayout } from './AuthLayout';

const DEMO_PASSWORD = 'demo1234';

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: string, p: string) {
    setBusy(true);
    setError(null);
    try {
      const user = await login(e, p);
      const next = params.get('next');
      const allowed = next && next.startsWith(user.role === 'org' ? '/org' : '/play') ? next : homeFor(user);
      navigate(allowed, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in.');
      setBusy(false);
    }
  }

  const demo = (address: string) => {
    setEmail(address);
    setPassword(DEMO_PASSWORD);
    void submit(address, DEMO_PASSWORD);
  };

  return (
    <AuthLayout>
      <p className="eyebrow">Sign in</p>
      <h1 className="mt-2 text-4xl">Welcome back</h1>
      <p className="mt-2 text-muted">Players and organisations sign in here with email and password.</p>

      <form
        className="mt-8 flex flex-col gap-4"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          void submit(email, password);
        }}
      >
        <label>
          <span className="label">Email</span>
          <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </label>
        <label>
          <span className="label">Password</span>
          <span className="relative block">
            <input className="input pr-12" type={show ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            <button type="button" className="absolute inset-y-0 right-0 grid w-12 place-items-center text-muted hover:text-fg" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </span>
        </label>
        {error && (
          <p role="alert" className="rounded-[14px] bg-crit-soft px-4 py-3 text-sm font-semibold text-crit">
            {error}
          </p>
        )}
        <button className="btn btn-primary btn-lg mt-1 w-full" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'} {!busy && <ArrowRight size={18} />}
        </button>
      </form>

      <div className="my-7 flex items-center gap-3 text-xs font-semibold tracking-wider text-muted uppercase">
        <span className="h-px flex-1 bg-line" /> or try a demo <span className="h-px flex-1 bg-line" />
      </div>

      <div className="grid gap-3">
        <button className="group flex items-center gap-4 rounded-[22px] bg-ink p-4 text-left text-cream transition-transform hover:-translate-y-0.5" disabled={busy} onClick={() => demo('player@kontho.app')}>
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-amber text-ink">
            <Sparkles size={19} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-lg font-extrabold">Explore as a player</span>
            <span className="block truncate text-sm text-[#b7c0cd]">Answer Boxes, earn, withdraw · player@kontho.app</span>
          </span>
          <ArrowRight size={18} className="text-amber transition-transform group-hover:translate-x-0.5" />
        </button>
        <button className="group flex items-center gap-4 rounded-[22px] border border-line bg-surface p-4 text-left transition-transform hover:-translate-y-0.5" disabled={busy} onClick={() => demo('org@kontho.app')}>
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-ink text-amber">
            <Building2 size={19} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-lg font-extrabold">Explore as an organisation</span>
            <span className="block truncate text-sm text-muted">Run Boxes, read live reports · org@kontho.app</span>
          </span>
          <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
        </button>
        <p className="text-center text-xs text-muted">Demo password: {DEMO_PASSWORD}</p>
      </div>

      <p className="mt-8 text-center text-sm">
        New to Kontho?{' '}
        <Link to="/signup" className="font-bold text-accent underline decoration-2 underline-offset-4">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
}
