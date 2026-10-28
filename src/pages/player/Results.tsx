import { ArrowLeft, ArrowRight, Clock } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import type { BoxResults, MyResult } from '../../../shared/types';
import { RankBars } from '../../components/charts/RankBars';
import { clock, dateShort, FAIL_TEXT, num, timeLeft, tk } from '../../lib/format';
import { useLiveReload } from '../../lib/live';
import { useFetch } from '../../lib/useFetch';

export function Results() {
  const { data, reload } = useFetch<{ results: MyResult[] }>('/player/results');
  useLiveReload(reload);
  const results = data?.results ?? [];
  const pending = results.filter((r) => r.status === 'pending');
  const scored = results.filter((r) => r.status === 'scored');

  return (
    <div className="animate-rise flex flex-col gap-8">
      <section>
        <p className="eyebrow">Results</p>
        <h1 className="mt-2 text-4xl">How your voice counted</h1>
        <p className="mt-2 max-w-xl text-muted">When a Box closes, everyone’s ideas are grouped and ranked. The most common idea pays the most per person.</p>
      </section>

      {data && results.length === 0 && (
        <div className="card p-8 text-center">
          <h2 className="text-xl">No results yet</h2>
          <p className="mt-2 text-muted">Finish tonight’s Box to see how the crowd answered.</p>
          <Link to="/play" className="btn btn-amber mt-5">
            Go to tonight’s Boxes
          </Link>
        </div>
      )}

      {pending.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl">Waiting for the Box to close</h2>
          <ul className="card divide-y divide-line">
            {pending.map((r) => (
              <li key={r.boxId}>
                <Link to={`/play/results/${r.boxId}`} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-surface-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{r.title}</p>
                    <p className="text-sm text-muted">Submitted {dateShort(r.submittedAt)}</p>
                  </div>
                  <span className="tnum inline-flex shrink-0 items-center gap-1.5 text-sm text-amber">
                    <Clock size={14} /> {r.closesAt ? `Results at ${clock(r.closesAt)}` : 'Soon'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {scored.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl">Scored</h2>
          <ul className="card divide-y divide-line">
            {scored.map((r) => (
              <li key={r.boxId}>
                <Link to={`/play/results/${r.boxId}`} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-surface-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{r.title}</p>
                    <p className="text-sm text-muted">
                      {r.closedAt ? dateShort(r.closedAt) : ''} ·{' '}
                      {r.passed ? (r.rank ? `Your idea ranked #${r.rank}` : r.themeLabel === 'Other ideas' ? 'Your idea was in a smaller group' : `Your idea ranked below #3`) : (r.failReason && FAIL_TEXT[r.failReason]) || 'No points'}
                    </p>
                  </div>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="tnum font-display text-xl font-extrabold" style={{ color: r.total > 0 ? 'var(--amber)' : 'var(--muted)' }}>
                      {r.total > 0 ? `+${tk(r.total)}` : tk(0)}
                    </span>
                    <ArrowRight size={16} className="text-muted" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export function ResultDetail() {
  const boxId = Number(useParams().boxId);
  const { data, error, reload } = useFetch<BoxResults>(`/player/results/${boxId}`);
  useLiveReload(reload);

  if (error && !data) return <p className="text-muted">{error}</p>;
  if (!data) return <div className="card h-96 animate-pulse" />;
  const { box, mine } = data;
  const closed = box.status === 'closed';

  return (
    <div className="animate-rise flex flex-col gap-6">
      <Link to="/play/results" className="btn btn-quiet btn-sm -ml-3 self-start">
        <ArrowLeft size={16} /> All results
      </Link>
      <section>
        <p className="eyebrow">{box.title}</p>
        {box.titleBn && (
          <p lang="bn" className="text-muted">
            {box.titleBn}
          </p>
        )}
        <h1 className="mt-2 text-4xl">{closed ? `What ${num(data.verified)} players said` : 'Results when the Box closes'}</h1>
      </section>

      {!closed && (
        <div className="card flex flex-col gap-2 p-6" style={{ background: 'radial-gradient(120% 120% at 0% 0%, #3a2a0e 0%, var(--ink-raised) 58%)' }}>
          <p className="font-display text-2xl font-extrabold">{box.closesAt ? `Results at ${clock(box.closesAt)}` : 'Results soon'}</p>
          <p className="text-muted">
            {timeLeft(box.closesAt)}. Ideas are grouped and checked when the Box closes, and the ranking stays hidden until then so it can’t steer anyone’s answer. {num(box.verified)} verified answers so far.
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {closed && (
          <section className="card p-6">
            <h2 className="text-xl">The biggest ideas</h2>
            <p className="mb-5 text-sm text-muted">The most common idea pays the most per person. {data.perPoint ? `1 point = ${tk(data.perPoint)}.` : ''}</p>
            <RankBars themes={data.themes} mine={mine?.passed ? mine.themeLabel : null} />
          </section>
        )}

        {mine && (
          <section className="flex flex-col gap-4">
            {closed && (
              <div className="card p-6">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-xl">Your earnings</h2>
                  <span className="tnum font-display text-3xl font-extrabold" style={{ color: mine.total > 0 ? 'var(--amber)' : 'var(--muted)' }}>
                    {tk(mine.total)}
                  </span>
                </div>
                {mine.passed ? (
                  <dl className="mt-4 divide-y divide-line text-[15px]">
                    <Row label={mine.rank ? `Pool share · #${mine.rank} idea · ${mine.points} points` : `Pool share · ${mine.points} point${mine.points === 1 ? '' : 's'}`} value={mine.poolShare} />
                    <Row label={mine.predictionBonus ? 'Prediction bonus · you called the #1 idea' : 'Prediction bonus · missed this time'} value={mine.predictionBonus} />
                    <Row label={mine.consentBonus ? 'Contact-consent bonus' : 'Contact-consent bonus · switched off'} value={mine.consentBonus} />
                  </dl>
                ) : (
                  <p className="mt-3 text-muted">
                    {mine.failReason ? FAIL_TEXT[mine.failReason] : 'This answer didn’t pass the checks'}, so it earned 0 points this time. Read each question carefully next time. Penalties never take back money you’ve already earned.
                  </p>
                )}
                {mine.total > 0 && <p className="mt-4 text-sm text-muted">Added to your wallet when the Box closed.</p>}
              </div>
            )}
            {mine.idea && (
              <div className="card p-6">
                <p className="text-sm font-semibold text-muted">Your idea</p>
                <blockquote className="mt-2 border-l-[3px] border-amber pl-3 text-lg">“{mine.idea}”</blockquote>
                {closed && mine.themeLabel && <p className="mt-3 text-sm text-muted">Grouped under “{mine.themeLabel}”.</p>}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between gap-4 py-2.5">
      <dt className="text-muted">{label}</dt>
      <dd className="tnum font-semibold whitespace-nowrap" style={{ color: value > 0 ? 'var(--mint)' : 'var(--muted)' }}>
        +{tk(value)}
      </dd>
    </div>
  );
}
