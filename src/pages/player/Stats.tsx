import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import type { MyResult, PlayerStats } from '../../../shared/types';
import { ColumnChart } from '../../components/charts/ColumnChart';
import { LogoMark } from '../../components/Logo';
import { dateShort, pct, tk, tk0 } from '../../lib/format';
import { useLiveReload } from '../../lib/live';
import { useFetch } from '../../lib/useFetch';

export function Stats() {
  const { data, reload } = useFetch<PlayerStats>('/player/stats');
  const results = useFetch<{ results: MyResult[] }>('/player/results');
  useLiveReload(reload);
  const lastVerified = results.data?.results.find((r) => r.status === 'scored' && r.passed);

  const tiles: [string, string, string?][] = data
    ? [
        ['Earned on Kontho', tk(data.totalEarned)],
        ['Boxes answered', String(data.boxes)],
        ['Verified answers', `${data.verified}`, data.boxes ? `${pct(data.verified / data.boxes)} passed every check` : undefined],
        ['Ideas in the #1 group', String(data.topIdeaHits), '6 points each time'],
        ['Predictions right', String(data.predictionHits), 'You called the most common idea'],
        ['Streak', `${data.streak} day${data.streak === 1 ? '' : 's'}`],
      ]
    : [];

  return (
    <div className="animate-rise flex flex-col gap-6">
      <section>
        <p className="eyebrow">My voice</p>
        <h1 className="mt-2 text-4xl">
          Heard, <span className="sl-underline">verified</span>, rewarded
        </h1>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        {!data && Array.from({ length: 6 }, (_, i) => <div key={i} className="card h-28 animate-pulse" />)}
        {tiles.map(([label, value, hint]) => (
          <div key={label} className="card p-5">
            <p className="text-sm font-semibold text-muted">{label}</p>
            <p className="mt-1 font-display text-3xl leading-tight font-extrabold">{value}</p>
            {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="card p-6">
          <h2 className="text-xl">Earned per week</h2>
          <p className="mb-4 text-sm text-muted">Last 10 weeks, Saturday to Friday. Earnings land when each Box closes.</p>
          {data ? (
            <ColumnChart data={data.weekly.map((w) => ({ label: w.week, value: w.earned }))} color="var(--amber)" unit="earned" format={(v) => tk0(v)} tickFormat={(l) => dateShort(Date.parse(`${l}T00:00:00`))} />
          ) : (
            <div className="h-[220px] animate-pulse rounded-2xl bg-surface-2" />
          )}
        </section>

        {lastVerified && <ProofCard result={lastVerified} />}
      </div>
    </div>
  );
}

/** Share cards celebrate being heard and verified — never money amounts. */
function ProofCard({ result }: { result: MyResult }) {
  const [copied, setCopied] = useState(false);
  const text = `My voice on “${result.title}” was verified on Kontho and added to the insight report. Real voices, verified.`;
  return (
    <section className="flex flex-col gap-3">
      <div className="card relative overflow-hidden p-6" style={{ background: 'var(--amber)', color: 'var(--ink)', borderColor: 'var(--amber)' }}>
        <div className="flex items-center gap-2">
          <LogoMark size={28} />
          <span className="text-xs font-bold tracking-[0.14em] uppercase">Verified voice</span>
        </div>
        <p className="mt-4 font-display text-2xl leading-snug font-extrabold">“My voice on {result.title} was verified on Kontho.”</p>
        <p lang="bn" className="mt-3 text-lg font-semibold">
          আপনার কণ্ঠ, আপনার আয়
        </p>
      </div>
      <button
        className="btn btn-ghost btn-sm self-start"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          } catch {
            // Clipboard blocked: nothing else to do.
          }
        }}
      >
        {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Copied' : 'Copy share text'}
      </button>
      <p className="text-xs text-muted">Share cards celebrate being heard, never money amounts.</p>
    </section>
  );
}
