import { ArrowRight, Clock, ShieldCheck, Sparkles, Trophy, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BKASH_MIN, RECHARGE_MIN, type PlayerBoxCard, type PlayerHome } from '../../../shared/types';
import { VoiceWave } from '../../components/VoiceWave';
import { useUser } from '../../lib/auth';
import { clock, greeting, num, timeLeft, tk } from '../../lib/format';
import { useLive, useLiveReload } from '../../lib/live';
import { useFetch } from '../../lib/useFetch';

/** Re-render every 30 s so "closes in" labels stay true. */
function useNow(ms = 30_000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export function Tonight() {
  const user = useUser();
  const { data, reload } = useFetch<PlayerHome>('/player/home');
  useLiveReload(reload);
  const { freshBoxes } = useLive();
  const now = useNow();

  return (
    <div className="animate-rise grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-8">
        <section>
          <p className="eyebrow" lang="bn">
            আপনার কণ্ঠ, আপনার আয়
          </p>
          <h1 className="mt-2 text-[2.25rem] sm:text-5xl">
            {greeting()}, {user.name.split(' ')[0]}.
          </h1>
          <p className="mt-2 max-w-xl text-muted">Answer a Box, say what life is really like, and earn when it closes. Your name stays private unless you choose otherwise.</p>
        </section>

        <section aria-labelledby="open-h">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow" lang="bn">
                আজ রাতের বক্স
              </p>
              <h2 id="open-h" className="mt-1 text-2xl">
                Open now {data && <span className="tnum text-muted">· {data.open.length}</span>}
              </h2>
            </div>
          </div>

          {data && data.open.length === 0 && (
            <div className="card flex flex-col items-center gap-4 px-6 py-10 text-center">
              <VoiceWave bars={14} height={44} className="w-40" />
              <h3 className="text-xl">You’re all caught up</h3>
              <p className="max-w-sm text-muted">New Boxes open in release slots through the day. The moment one opens, it pops up right here.</p>
            </div>
          )}
          <div className="flex flex-col gap-4">
            {!data && <div className="card h-56 animate-pulse" />}
            {data?.open.map((b, i) => (
              <BoxCard key={b.id} box={b} fresh={freshBoxes.has(b.id)} lamp={i === 0} now={now} />
            ))}
          </div>
        </section>

        {data && data.waiting.length > 0 && (
          <section aria-labelledby="wait-h">
            <h2 id="wait-h" className="mb-3 text-xl">
              Waiting for results
            </h2>
            <ul className="card divide-y divide-line">
              {data.waiting.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-4 px-5 py-4">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{b.title}</p>
                    <p className="text-sm text-muted">Submitted · results when the Box closes</p>
                  </div>
                  <span className="shrink-0 text-right text-sm">
                    <span className="block font-semibold text-amber">{b.closesAt ? clock(b.closesAt) : ''}</span>
                    <span className="tnum block text-muted">{timeLeft(b.closesAt, now)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {data && data.recent.length > 0 && (
          <section aria-labelledby="res-h">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="res-h" className="text-xl">
                Latest results
              </h2>
              <Link to="/play/results" className="btn btn-quiet btn-sm">
                All results <ArrowRight size={15} />
              </Link>
            </div>
            <ul className="card divide-y divide-line">
              {data.recent.map((r) => (
                <li key={r.boxId}>
                  <Link to={`/play/results/${r.boxId}`} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-surface-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{r.title}</p>
                      <p className="text-sm text-muted">{r.passed ? (r.rank ? `Your idea ranked #${r.rank} · ${r.points} points` : `${r.points} point${r.points === 1 ? '' : 's'}`) : 'No points this time'}</p>
                    </div>
                    <span className="tnum shrink-0 font-display text-xl font-extrabold" style={{ color: r.total > 0 ? 'var(--amber)' : 'var(--muted)' }}>
                      {r.total > 0 ? `+${tk(r.total)}` : tk(0)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <aside className="flex min-w-0 flex-col gap-4">
        <WalletCard balance={data?.balance ?? null} />
        <div className="card flex items-center gap-4 p-5">
          <span className="sticker sticker-pink shrink-0">🔥 {data?.streak ?? 0}-day streak</span>
          <p className="text-sm text-muted">Days in a row you’ve answered a Box. Keep it going tonight.</p>
        </div>
        <div className="card p-5">
          <h3 className="mb-3 text-lg">How rewards work</h3>
          <ul className="ticks text-[15px]">
            <li>Answers are grouped by idea. The biggest group earns 6 points, the next 4, then 3. Every other real answer earns 1.</li>
            <li>The pool is divided by total points, so every point is worth the same.</li>
            <li>Predict the most common idea for a bonus.</li>
            <li>Your first Box pays {tk(20)} straight away.</li>
          </ul>
        </div>
        <div className="card flex gap-3 border-l-[6px] p-5" style={{ borderLeftColor: 'var(--pink)' }}>
          <ShieldCheck size={22} className="mt-0.5 shrink-0 text-pink" />
          <p className="text-sm">
            <b>We never ask for money, a fee, or your bKash PIN or OTP.</b> Joining is free, always.
          </p>
        </div>
      </aside>
    </div>
  );
}

function BoxCard({ box: b, fresh, lamp, now }: { box: PlayerBoxCard; fresh: boolean; lamp: boolean; now: number }) {
  const isNew = b.releasedAt !== null && now - b.releasedAt < 15 * 60_000;
  const soon = b.closesAt !== null && b.closesAt - now < 60 * 60_000;
  const fill = Math.min(1, b.verified / b.target);
  return (
    <article
      className={`card relative overflow-hidden p-5 sm:p-6 ${fresh ? 'animate-pop' : ''}`}
      style={
        lamp || fresh
          ? { background: 'radial-gradient(120% 120% at 0% 0%, #3a2a0e 0%, var(--ink-raised) 58%)', borderColor: fresh ? 'var(--amber)' : '#4a3a1c' }
          : undefined
      }
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {isNew && <span className="sticker">New</span>}
          {soon && <span className="sticker sticker-pink">Closes soon</span>}
          <span className="pill bg-surface-2 text-muted">{b.topic}</span>
          {b.sample && <span className="example">Sample</span>}
        </div>
        <span className="tnum inline-flex items-center gap-1.5 text-sm text-muted">
          <Clock size={14} /> {timeLeft(b.closesAt, now)}
        </span>
      </div>

      <h3 className="text-2xl">{b.title}</h3>
      {b.titleBn && (
        <p lang="bn" className="text-[17px] font-semibold text-amber">
          {b.titleBn}
        </p>
      )}
      <p className="mt-2 text-muted">{b.description}</p>

      <dl className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-[14px] bg-surface-2 px-3 py-2.5">
          <dt className="text-[11px] font-semibold tracking-wider text-muted uppercase">Pool</dt>
          <dd className="tnum font-display text-lg font-extrabold">{tk(b.pool)}</dd>
        </div>
        <div className="rounded-[14px] bg-surface-2 px-3 py-2.5">
          <dt className="text-[11px] font-semibold tracking-wider text-muted uppercase">Time</dt>
          <dd className="font-display text-lg font-extrabold">~{b.minutes} min</dd>
        </div>
        <div className="rounded-[14px] bg-surface-2 px-3 py-2.5">
          <dt className="text-[11px] font-semibold tracking-wider text-muted uppercase">Questions</dt>
          <dd className="font-display text-lg font-extrabold">{b.questionCount}</dd>
        </div>
      </dl>

      <div className="mt-4">
        <div className="mb-1.5 flex justify-between text-sm">
          <span className="inline-flex items-center gap-1.5 text-muted">
            <Users size={14} /> Verified quota
          </span>
          <span className="tnum font-semibold">
            {num(b.verified)} / {num(b.target)}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-off">
          <span className="block h-full rounded-full bg-amber transition-[width] duration-700" style={{ width: `${fill * 100}%` }} />
        </div>
      </div>

      <Link to={`/play/box/${b.id}`} className="btn btn-amber btn-lg mt-5 w-full sm:w-auto">
        Start this Box <ArrowRight size={18} />
      </Link>
    </article>
  );
}

function WalletCard({ balance }: { balance: number | null }) {
  const b = balance ?? 0;
  return (
    <div className="card flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-muted">Wallet</p>
          <p className="tnum font-display text-[2.5rem] leading-none font-extrabold">{balance === null ? '৳—' : tk(b)}</p>
        </div>
        <Trophy size={22} className="text-amber" />
      </div>
      <Threshold label="Mobile recharge" min={RECHARGE_MIN} balance={b} />
      <Threshold label="bKash" min={BKASH_MIN} balance={b} />
      <Link to="/play/wallet" className="btn btn-ghost btn-sm self-start">
        <Sparkles size={15} /> Open wallet
      </Link>
    </div>
  );
}

export function Threshold({ label, min, balance }: { label: string; min: number; balance: number }) {
  const ready = balance >= min;
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="text-muted">
          {label} from {tk(min)}
        </span>
        <span className="tnum font-semibold" style={{ color: ready ? 'var(--mint)' : 'var(--fg)' }}>
          {ready ? 'Ready' : `${tk(Math.min(balance, min))} / ${tk(min)}`}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-off">
        <span className="block h-full rounded-full bg-amber" style={{ width: `${Math.min(1, balance / min) * 100}%` }} />
      </div>
    </div>
  );
}
