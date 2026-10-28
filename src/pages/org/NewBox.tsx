import { ArrowRight, Check } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Template } from '../../../shared/types';
import { api } from '../../lib/api';
import { useFetch } from '../../lib/useFetch';

const STEPS = [
  ['Brief', 'You tell us the question and who you need to hear from.'],
  ['Box built', 'It becomes a short Box in Bangla and English.'],
  ['Release slot', 'The Box goes live to matching players.'],
  ['Verified quota fills', 'Answers come in until the quota is met.'],
  ['Report', 'Ideas are grouped and ranked; you read the result.'],
];

export function NewBox() {
  const navigate = useNavigate();
  const { data } = useFetch<{ templates: Template[] }>('/org/templates');
  const [brief, setBrief] = useState('');
  const [template, setTemplate] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!template) return setError('Choose the ready-made Box closest to your question.');
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ id: number }>('/org/boxes', { body: { template, brief } });
      navigate(`/org/boxes/${r.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the Box.');
      setBusy(false);
    }
  }

  return (
    <form className="animate-rise flex flex-col gap-8" onSubmit={submit}>
      <section>
        <p className="eyebrow">New Box</p>
        <h1 className="mt-2 text-4xl sm:text-5xl">
          Hear Bangladesh, <span className="sl-underline">not just Dhaka</span>
        </h1>
        <p className="mt-3 max-w-2xl text-muted">Verified adults across all eight divisions answer your Box. Every answer is checked, and you get a report you can defend.</p>
      </section>

      <ol className="grid gap-3 md:grid-cols-5">
        {STEPS.map(([title, text], i) => (
          <li key={title} className="card relative p-5 pt-16">
            <span className="absolute top-5 left-5 grid size-9 place-items-center rounded-full bg-amber font-display font-extrabold text-ink">{i + 1}</span>
            <h3 className="text-lg">{title}</h3>
            <p className="mt-1 text-sm text-muted">{text}</p>
          </li>
        ))}
      </ol>

      <section className="card p-6">
        <label>
          <span className="text-xl font-extrabold">1. Your brief</span>
          <span className="mb-3 block text-sm text-muted">One paragraph is enough: the question, who you need to hear from, and when you need it.</span>
          <textarea className="input" rows={4} maxLength={2000} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="e.g. We want to know why families in Rajshahi and Rangpur switch cooking gas suppliers, and how much they pay." />
        </label>
      </section>

      <section>
        <h2 className="text-xl">2. Start from the closest ready-made Box</h2>
        <p className="mb-4 text-sm text-muted">Each one is a complete five-part Box: screener, measured questions, an idea question, a hidden check and a prediction. You can reword everything before launch.</p>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" role="radiogroup" aria-label="Ready-made Box">
          {!data && Array.from({ length: 6 }, (_, i) => <div key={i} className="card h-40 animate-pulse" />)}
          {data?.templates.map((t) => {
            const on = template === t.key;
            return (
              <button
                type="button"
                key={t.key}
                role="radio"
                aria-checked={on}
                onClick={() => setTemplate(t.key)}
                className="card relative p-5 text-left transition-colors hover:border-line-strong"
                style={on ? { borderColor: 'var(--ink)', boxShadow: '0 0 0 2px var(--ink)' } : undefined}
              >
                {on && (
                  <span className="absolute top-4 right-4 grid size-7 place-items-center rounded-full bg-ink text-cream">
                    <Check size={15} strokeWidth={3} />
                  </span>
                )}
                <span className="eyebrow">{t.topic}</span>
                <h3 className="mt-1 pr-8 text-xl">{t.title}</h3>
                <p lang="bn" className="text-muted">
                  {t.titleBn}
                </p>
                <p className="mt-2 text-sm text-muted">{t.description}</p>
              </button>
            );
          })}
        </div>
      </section>

      {error && <p className="text-sm font-semibold text-crit">{error}</p>}
      <div className="flex flex-wrap items-center gap-4">
        <button className="btn btn-primary btn-lg" disabled={busy}>
          {busy ? 'Building…' : 'Build draft Box'} <ArrowRight size={18} />
        </button>
        <p className="max-w-md text-sm text-muted">Nothing goes to players until you launch it.</p>
      </div>
    </form>
  );
}
