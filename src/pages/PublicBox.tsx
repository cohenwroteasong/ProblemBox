import { ArrowRight, CircleCheck, EyeOff, Lock, Send, UserRound } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CATEGORIES, type Category, type PublicBox as Box } from '../../shared/types';
import { LogoMark } from '../components/Logo';
import { api } from '../lib/api';
import { useFetch } from '../lib/useFetch';

/** The page anyone with a box link sees. No account needed. */
export function PublicBox() {
  const { slug = '' } = useParams();
  const { data, error } = useFetch<{ box: Box }>(`/public/boxes/${encodeURIComponent(slug)}`);
  const box = data?.box;

  return (
    <div className="flex min-h-dvh flex-col bg-page">
      <div className="h-1.5" style={{ background: box?.color ?? 'var(--brand)' }} />
      <main className="mx-auto w-full max-w-[600px] flex-1 px-4 py-8 sm:py-14">
        {error && !box && (
          <div className="card p-8 text-center">
            <h1 className="text-lg font-bold">Box not found</h1>
            <p className="mt-2 text-sm text-ink-2">{error}</p>
          </div>
        )}
        {!box && !error && <div className="card h-[420px] animate-pulse" />}
        {box && <Form box={box} slug={slug} />}
      </main>
      <footer className="flex items-center justify-center gap-2 pb-8 text-xs text-ink-3">
        <LogoMark size={16} /> Powered by <span className="font-semibold text-ink-2">Kontho</span>
      </footer>
    </div>
  );
}

function Form({ box, slug }: { box: Box; slug: string }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<Category | ''>('');
  const [anonymous, setAnonymous] = useState(true);
  const [author, setAuthor] = useState('');
  const [contact, setContact] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`/public/boxes/${encodeURIComponent(slug)}/problems`, {
        body: { title, body, category: category || 'Other', author: anonymous ? '' : author, contact: anonymous ? '' : contact, website },
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="card animate-pop p-8 text-center sm:p-10">
        <span className="mx-auto grid size-14 place-items-center rounded-full" style={{ background: 'var(--st-resolved-soft)', color: 'var(--st-resolved)' }}>
          <CircleCheck size={28} />
        </span>
        <h1 className="mt-5 text-2xl font-bold tracking-tight">Thank you — it’s been sent</h1>
        <p className="mx-auto mt-2 max-w-sm text-[15px] text-ink-2">
          Your problem is now in front of {box.org ? <span className="font-semibold text-ink">{box.org}</span> : 'the team'}. {anonymous ? 'It was sent anonymously.' : ''}
        </p>
        <button
          className="btn btn-secondary mt-6"
          onClick={() => {
            setSent(false);
            setTitle('');
            setBody('');
            setCategory('');
          }}
        >
          Report something else <ArrowRight size={15} />
        </button>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <header className="border-b border-line px-6 pt-7 pb-6 sm:px-8">
        {box.org && <div className="eyebrow mb-2">{box.org}</div>}
        <h1 className="text-[1.65rem] leading-tight font-bold tracking-tight">{box.name}</h1>
        {box.description && <p className="mt-2 text-[15px] text-ink-2">{box.description}</p>}
      </header>

      {!box.isOpen ? (
        <div className="flex items-start gap-3 px-6 py-8 sm:px-8">
          <Lock size={18} className="mt-0.5 shrink-0 text-ink-3" />
          <p className="text-[15px] text-ink-2">This box isn’t accepting new problems right now. Please check back later.</p>
        </div>
      ) : (
        <form className="flex flex-col gap-5 px-6 py-6 sm:px-8" onSubmit={submit}>
          <label>
            <span className="label">What’s the problem?</span>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. The lift in Block B is stuck again" required minLength={4} maxLength={140} />
          </label>
          <label>
            <span className="label">
              Tell us more <span className="font-normal text-ink-3">(optional)</span>
            </span>
            <textarea className="input" rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Where is it, when did it start, who is affected?" maxLength={4000} />
          </label>
          <fieldset>
            <legend className="label">What is it about?</legend>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setCategory(category === c ? '' : c)}
                  aria-pressed={category === c}
                  className={`h-9 rounded-full border px-3.5 text-[13px] font-semibold transition-colors ${category === c ? 'border-brand bg-brand-soft text-brand-ink' : 'border-line-strong text-ink-2 hover:border-ink-3 hover:text-ink'}`}
                >
                  {c}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="rounded-2xl border border-line bg-surface-2 p-4">
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between sm:gap-4">
              <div className="flex gap-3">
                <span className="mt-0.5 text-ink-2">{anonymous ? <EyeOff size={18} /> : <UserRound size={18} />}</span>
                <div>
                  <div className="text-sm font-semibold">{anonymous ? 'Sending anonymously' : 'Sending with your name'}</div>
                  <div className="mt-0.5 text-[13px] text-ink-3">{anonymous ? 'Your name isn’t attached unless you choose to add it.' : 'Add a way to reach you if you’d like a follow-up.'}</div>
                </div>
              </div>
              <button type="button" className="btn btn-secondary btn-sm ml-8 shrink-0 sm:ml-0" onClick={() => setAnonymous((a) => !a)}>
                {anonymous ? 'Add my name' : 'Stay anonymous'}
              </button>
            </div>
            {!anonymous && (
              <div className="animate-rise mt-4 grid gap-3 sm:grid-cols-2">
                <input className="input input-sm" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Your name" maxLength={80} aria-label="Your name" />
                <input className="input input-sm" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Email or phone (optional)" maxLength={120} aria-label="Email or phone" />
              </div>
            )}
          </div>

          {/* Hidden from people; bots that fill every field get silently ignored. */}
          <input type="text" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} className="absolute -left-[9999px] size-px opacity-0" aria-hidden />

          {error && (
            <p role="alert" className="rounded-xl px-3 py-2.5 text-[13px] font-medium" style={{ background: 'var(--pr-urgent-soft)', color: 'var(--pr-urgent)' }}>
              {error}
            </p>
          )}

          <button className="btn btn-primary h-12 text-[15px]" disabled={busy || title.trim().length < 4}>
            <Send size={17} /> {busy ? 'Sending…' : 'Send problem'}
          </button>
        </form>
      )}
    </div>
  );
}

export function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-4 text-center">
      <div>
        <LogoMark size={40} />
        <h1 className="mt-5 text-2xl font-bold">Page not found</h1>
        <p className="mt-2 text-sm text-ink-2">The link may be broken or the page may have moved.</p>
        <Link to="/" className="btn btn-primary mt-6">
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
