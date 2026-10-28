import { ArrowLeft, CircleAlert, Lock, Plus, Rocket, Square, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { DIVISIONS, type BoxReport as Report, type Distribution, type OrgBox, type Theme } from '../../../shared/types';
import { ColumnChart } from '../../components/charts/ColumnChart';
import { DistBars } from '../../components/charts/DistBars';
import { Funnel } from '../../components/charts/Funnel';
import { RankBars } from '../../components/charts/RankBars';
import { Modal } from '../../components/Modal';
import { Segmented } from '../../components/Segmented';
import { api } from '../../lib/api';
import { dateTime, num, pct, ROLE_ORG, timeLeft, tk } from '../../lib/format';
import { useLiveReload } from '../../lib/live';
import { useFetch } from '../../lib/useFetch';
import { Kpi, LiveFeed } from './Overview';
import { StatusPill } from './parts';

export function BoxReport() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const { data, error, reload, setData } = useFetch<Report>(`/org/boxes/${id}`);
  useLiveReload(reload);
  const [confirm, setConfirm] = useState<'launch' | 'close' | 'delete' | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (error && !data) return <p className="text-muted">{error}</p>;
  if (!data) return <div className="card h-96 animate-pulse" />;
  const { box, kpis } = data;

  async function act(kind: 'launch' | 'close' | 'delete') {
    setBusy(true);
    setActionError(null);
    try {
      if (kind === 'delete') {
        await api(`/org/boxes/${id}`, { method: 'DELETE', body: {} });
        navigate('/org');
        return;
      }
      setData(await api<Report>(`/org/boxes/${id}/${kind}`, { body: {} }));
      setConfirm(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="animate-rise flex flex-col gap-6">
      <Link to="/org" className="btn btn-quiet btn-sm -ml-3 self-start">
        <ArrowLeft size={16} /> All Boxes
      </Link>

      <section className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <StatusPill status={box.status} />
            <span className="eyebrow">{box.topic}</span>
            {box.sample && <span className="example">Sample data</span>}
          </div>
          <h1 className="text-4xl">{box.title}</h1>
          {box.titleBn && (
            <p lang="bn" className="text-lg text-muted">
              {box.titleBn}
            </p>
          )}
          <p className="mt-1 text-sm text-muted">
            {box.status === 'live' && box.closesAt && `Released ${dateTime(box.releasedAt!)} · closes ${dateTime(box.closesAt)} (${timeLeft(box.closesAt)}) or when the quota fills`}
            {box.status === 'closed' && box.closedAt && `Ran ${dateTime(box.releasedAt!)} – ${dateTime(box.closedAt)} · scored and paid`}
            {box.status === 'draft' && 'Draft. Edit anything below, then launch it to players.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {box.status === 'draft' && (
            <>
              <button className="btn btn-ghost" onClick={() => setConfirm('delete')}>
                <Trash2 size={17} /> Delete draft
              </button>
              <button className="btn btn-primary" onClick={() => setConfirm('launch')}>
                <Rocket size={17} /> Launch to players
              </button>
            </>
          )}
          {box.status === 'live' && (
            <button className="btn btn-ghost" onClick={() => setConfirm('close')}>
              <Square size={16} /> Close and score now
            </button>
          )}
        </div>
      </section>

      {box.status === 'draft' ? (
        <DraftEditor box={box} onSaved={setData} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <Kpi label="Verified answers" value={num(kpis.verified)} sub={`of ${num(kpis.received)} received · ${pct(kpis.passRate)} passed every check`} />
            <div className="card p-5">
              <p className="eyebrow !text-muted">Verified quota</p>
              <p className="tnum mt-2 font-display text-4xl leading-none font-extrabold">{pct(Math.min(1, kpis.verified / box.target))}</p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-off">
                <span className="block h-full rounded-full bg-amber transition-[width] duration-700" style={{ width: `${Math.min(1, kpis.verified / box.target) * 100}%` }} />
              </div>
              <p className="tnum mt-2 text-[13px] text-muted">
                {num(kpis.verified)} of {num(box.target)}
              </p>
            </div>
            <Kpi label="Median time" value={kpis.medianMinutes ? `${kpis.medianMinutes.toFixed(1)} min` : '—'} sub={`Box estimate ~${box.minutes} min`} />
            <Kpi label="Reward pool" value={tk(box.pool)} sub={kpis.perPoint ? `1 point ${box.status === 'closed' ? '=' : '≈'} ${tk(kpis.perPoint)}` : 'Split by rank points at close'} />
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
            <section className="card p-6">
              <h2 className="text-xl">What people said, ranked</h2>
              <p className="mb-5 text-sm text-muted">
                {box.status === 'live' ? 'Standings so far. They become final, and pay out, when the Box closes.' : 'Final ranking. Answers in each group earned the points shown.'} Ideas are grouped by keyword in this build.
              </p>
              {data.themes.length ? <RankBars themes={data.themes} /> : <p className="text-muted">No verified ideas yet.</p>}
            </section>
            {box.status === 'live' ? (
              <LiveFeed initial={data.recent} boxId={box.id} title="Answers, live" />
            ) : (
              <section className="card p-6">
                <h2 className="text-xl">In their words</h2>
                <p className="mb-4 text-sm text-muted">Quotes from the top three idea groups.</p>
                <Quotes quotes={data.quotes} />
              </section>
            )}
          </div>

          {box.status === 'live' && data.quotes.length > 0 && (
            <section className="card p-6">
              <h2 className="mb-4 text-xl">In their words</h2>
              <Quotes quotes={data.quotes} columns />
            </section>
          )}

          <section>
            <h2 className="mb-3 text-xl">Measured questions</h2>
            <div className="grid gap-4 lg:grid-cols-3">
              {data.measured.map((m) => (
                <div key={m.id} className="card p-5">
                  <p className="eyebrow !text-muted">Measured · never scored</p>
                  <h3 className="mt-1 mb-4 font-sans text-[15px] leading-snug font-bold tracking-normal">{m.text}</h3>
                  {m.median !== null && (
                    <p className="mb-3 text-sm text-muted">
                      Median <b className="tnum font-display text-xl font-extrabold text-fg">{m.unit === '৳' ? tk(Math.round(m.median)) : `${Math.round(m.median)} ${m.unit ?? ''}`}</b>
                    </p>
                  )}
                  <DistBars rows={m.rows} labelWidth={m.type === 'number' ? 120 : 150} />
                </div>
              ))}
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="card p-6">
              <h2 className="text-xl">How answers became verified</h2>
              <p className="mb-5 text-sm text-muted">Every check runs as answers arrive.</p>
              <Funnel steps={data.funnel} />
            </section>
            <Quotas quotas={data.quotas} />
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
            <section className="card p-6">
              <h2 className="text-xl">Verified answers over time</h2>
              <p className="mb-4 text-sm text-muted">{data.timeline.length > 1 && data.timeline[0].label.includes(':') ? 'Per hour, Bangladesh time' : 'Per day'}</p>
              <ColumnChart data={data.timeline.map((t) => ({ label: t.label, value: t.count }))} color="var(--ink)" unit="verified answers" />
            </section>
            <section className="card p-6">
              <h2 className="text-xl">Who players think will win</h2>
              <p className="mb-4 text-sm text-muted">Prediction question. Players who named the #1 idea get the prediction bonus.</p>
              <DistBars rows={data.predictions} labelWidth={150} color="var(--amber)" />
            </section>
          </div>

          <BoxContent box={box} />
        </>
      )}

      {confirm && (
        <Modal
          theme="t-org"
          title={confirm === 'launch' ? 'Launch this Box?' : confirm === 'close' ? 'Close and score now?' : 'Delete this draft?'}
          onClose={() => setConfirm(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setConfirm(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" disabled={busy} onClick={() => act(confirm)}>
                {confirm === 'launch' ? 'Launch' : confirm === 'close' ? 'Close and pay players' : 'Delete'}
              </button>
            </>
          }
        >
          <p className="text-muted">
            {confirm === 'launch' &&
              `It pops up for every player straight away and stays open for ${box.durationHours} hours, or until ${num(box.target)} verified answers are in. Questions are locked once it’s live.`}
            {confirm === 'close' && `Answers stop, ideas are ranked, and ${tk(box.pool)} is shared out by rank points to every verified player. This can’t be undone.`}
            {confirm === 'delete' && 'The draft is removed. Nothing has been sent to players yet.'}
          </p>
          {actionError && <p className="mt-3 text-sm font-semibold text-crit">{actionError}</p>}
        </Modal>
      )}
    </div>
  );
}

function Quotes({ quotes, columns = false }: { quotes: Report['quotes']; columns?: boolean }) {
  if (!quotes.length) return <p className="text-muted">No quotes yet.</p>;
  return (
    <div className={`grid gap-4 ${columns ? 'md:grid-cols-3' : ''}`}>
      {quotes.map((q, i) => (
        <blockquote key={i} className="border-l-[3px] border-amber py-1 pl-3">
          <p className="text-[15px] leading-relaxed">“{q.text}”</p>
          <footer className="mt-1 text-xs text-muted">
            {q.themeLabel} · {q.division}
          </footer>
        </blockquote>
      ))}
    </div>
  );
}

function Quotas({ quotas }: { quotas: Report['quotas'] }) {
  const [by, setBy] = useState<'division' | 'gender' | 'age'>('division');
  const rows: Distribution[] = quotas[by];
  const max = Math.max(0.0001, ...rows.map((r) => r.share));
  return (
    <section className="card p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl">Who answered</h2>
          <p className="text-sm text-muted">Verified answers by quota group</p>
        </div>
        <Segmented<'division' | 'gender' | 'age'>
          label="Quota group"
          value={by}
          onChange={setBy}
          options={[
            { value: 'division', label: 'Division' },
            { value: 'gender', label: 'Gender' },
            { value: 'age', label: 'Age' },
          ]}
        />
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs tracking-wider text-muted uppercase">
            <th className="py-2 font-semibold">{by === 'division' ? 'Division' : by === 'gender' ? 'Gender' : 'Age'}</th>
            <th className="py-2 text-right font-semibold">Verified</th>
            <th className="py-2 pl-4 font-semibold">Share</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-line last:border-0">
              <td className="py-2.5">{r.label}</td>
              <td className="tnum py-2.5 text-right font-semibold">{num(r.count)}</td>
              <td className="py-2.5 pl-4">
                <span className="inline-block h-2 rounded-full bg-amber align-middle" style={{ width: `${(r.share / max) * 72}px` }} />
                <span className="tnum ml-2 text-muted">{pct(r.share)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {by === 'division' && rows.filter((r) => r.count > 0).length === DIVISIONS.length && <p className="mt-3 text-xs text-muted">All eight divisions heard.</p>}
    </section>
  );
}

/** The Box as players see it, question by question. */
function BoxContent({ box }: { box: OrgBox }) {
  return (
    <details className="card group p-6">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-xl font-extrabold">
          <Lock size={18} className="text-muted" /> The Box as players saw it
        </span>
        <span className="text-sm font-semibold text-muted group-open:hidden">Show {box.questions.length} questions</span>
      </summary>
      <ol className="mt-5 flex flex-col gap-4">
        {box.questions.map((q, i) => (
          <li key={q.id} className="grid gap-1 border-t border-line pt-4 sm:grid-cols-[180px_minmax(0,1fr)]">
            <span className="eyebrow pt-0.5">
              {i + 1}. {ROLE_ORG[q.role]}
            </span>
            <div>
              <p className="font-semibold">{q.text}</p>
              {q.options && (
                <p className="mt-1 text-sm text-muted">
                  {q.options.map((o, k) => (
                    <span key={o}>
                      {k > 0 && ' · '}
                      <span className={q.correct === k || q.disqualify?.includes(k) ? 'font-semibold text-fg' : ''}>{o}</span>
                      {q.correct === k && ' (correct)'}
                      {q.disqualify?.includes(k) && ' (ends the Box)'}
                    </span>
                  ))}
                </p>
              )}
              {q.type === 'scale' && (
                <p className="mt-1 text-sm text-muted">
                  1 {q.low} → 5 {q.high}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </details>
  );
}

function DraftEditor({ box, onSaved }: { box: OrgBox; onSaved(r: Report): void }) {
  const [form, setForm] = useState({
    title: box.title,
    titleBn: box.titleBn,
    description: box.description,
    brief: box.brief,
    pool: String(box.pool),
    target: String(box.target),
    minutes: String(box.minutes),
    durationHours: String(box.durationHours),
  });
  const [questions, setQuestions] = useState(box.questions.map((q) => ({ id: q.id, role: q.role, type: q.type, text: q.text, options: q.options ? [...q.options] : undefined, correct: q.correct, disqualify: q.disqualify })));
  const [themes, setThemes] = useState<(Theme & { kw: string })[]>(box.themes.map((t) => ({ ...t, kw: t.keywords.join(', ') })));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<Report>(`/org/boxes/${box.id}`, {
        method: 'PATCH',
        body: {
          ...form,
          pool: Number(form.pool),
          target: Number(form.target),
          minutes: Number(form.minutes),
          durationHours: Number(form.durationHours),
          questions: questions.filter((q) => q.role !== 'prediction').map((q) => ({ id: q.id, text: q.text, options: q.options })),
          themes: themes.map((t) => ({ id: t.id, label: t.label, keywords: t.kw.split(',') })),
        },
      });
      onSaved(r);
      setMsg({ ok: true, text: 'Draft saved' });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'Could not save.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {box.brief && (
        <div className="card flex gap-3 border-l-[6px] p-5" style={{ borderLeftColor: 'var(--amber)' }}>
          <div>
            <p className="eyebrow">Your brief</p>
            <p className="mt-1">{box.brief}</p>
            <p className="mt-2 text-sm text-muted">Built from the closest ready-made Box. The production console drafts it from the brief with AI, and you approve it before launch.</p>
          </div>
        </div>
      )}

      <section className="card grid gap-4 p-6 md:grid-cols-2">
        <h2 className="text-xl md:col-span-2">Box details</h2>
        <Field label="Title (English)">
          <input className="input" value={form.title} onChange={set('title')} maxLength={80} />
        </Field>
        <Field label="Title (Bangla)">
          <input className="input" lang="bn" value={form.titleBn} onChange={set('titleBn')} maxLength={80} />
        </Field>
        <Field label="What players see before they start" wide>
          <input className="input" value={form.description} onChange={set('description')} maxLength={240} />
        </Field>
        <div className="grid grid-cols-2 gap-4 md:col-span-2 lg:grid-cols-4">
          <Field label="Reward pool (৳)">
            <input className="input tnum" type="number" min={500} value={form.pool} onChange={set('pool')} />
          </Field>
          <Field label="Verified answers needed">
            <input className="input tnum" type="number" min={20} value={form.target} onChange={set('target')} />
          </Field>
          <Field label="Minutes to answer">
            <input className="input tnum" type="number" min={1} max={30} value={form.minutes} onChange={set('minutes')} />
          </Field>
          <Field label="Open for (hours)">
            <input className="input tnum" type="number" min={1} max={168} value={form.durationHours} onChange={set('durationHours')} />
          </Field>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="text-xl">Questions</h2>
        <p className="mb-5 text-sm text-muted">Every Box has the same five parts. Reword anything; the prediction question always offers your first five themes.</p>
        <ol className="flex flex-col gap-5">
          {questions.map((q, i) => (
            <li key={q.id} className="grid gap-2 border-t border-line pt-5 md:grid-cols-[180px_minmax(0,1fr)]">
              <span className="eyebrow pt-3">
                {i + 1}. {ROLE_ORG[q.role]}
              </span>
              <div className="flex flex-col gap-2">
                {q.role === 'prediction' ? (
                  <p className="pt-2.5 font-semibold">
                    {q.text} <span className="font-normal text-muted">({themes.slice(0, 5).map((t) => t.label).join(' · ')})</span>
                  </p>
                ) : (
                  <input className="input" value={q.text} aria-label={`Question ${i + 1}`} onChange={(e) => setQuestions(questions.map((x) => (x.id === q.id ? { ...x, text: e.target.value } : x)))} />
                )}
                {q.options && q.role !== 'prediction' && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {q.options.map((o, k) => (
                      <input
                        key={k}
                        className="input input-sm"
                        value={o}
                        aria-label={`Question ${i + 1} option ${k + 1}`}
                        onChange={(e) => setQuestions(questions.map((x) => (x.id === q.id ? { ...x, options: x.options!.map((y, j) => (j === k ? e.target.value : y)) } : x)))}
                        style={q.correct === k || q.disqualify?.includes(k) ? { borderColor: 'var(--amber)' } : undefined}
                        title={q.correct === k ? 'Correct answer to the check' : q.disqualify?.includes(k) ? 'Ends the Box' : undefined}
                      />
                    ))}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="card p-6">
        <h2 className="text-xl">Idea themes</h2>
        <p className="mb-5 text-sm text-muted">The groups ideas are sorted into, with the words that put an answer in each (English and Bangla). Anything that matches none goes to “Other ideas” and earns 1 point.</p>
        <ul className="flex flex-col gap-3">
          {themes.map((t, i) => (
            <li key={t.id} className="grid gap-2 md:grid-cols-[240px_minmax(0,1fr)_44px]">
              <input className="input input-sm font-semibold" value={t.label} aria-label={`Theme ${i + 1} name`} onChange={(e) => setThemes(themes.map((x) => (x.id === t.id ? { ...x, label: e.target.value } : x)))} />
              <input className="input input-sm" value={t.kw} aria-label={`Theme ${i + 1} keywords`} placeholder="keywords, comma separated" onChange={(e) => setThemes(themes.map((x) => (x.id === t.id ? { ...x, kw: e.target.value } : x)))} />
              <button className="btn btn-quiet btn-sm px-2" disabled={themes.length <= 3} onClick={() => setThemes(themes.filter((x) => x.id !== t.id))} aria-label={`Remove theme ${t.label}`}>
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
        <button className="btn btn-ghost btn-sm mt-4" disabled={themes.length >= 10} onClick={() => setThemes([...themes, { id: `t${Date.now()}`, label: 'New theme', keywords: [], kw: '' }])}>
          <Plus size={16} /> Add theme
        </button>
      </section>

      <div className="sticky bottom-4 z-10 flex flex-wrap items-center gap-3 rounded-full border border-line bg-surface/95 p-2 pl-5 shadow-[var(--shadow-pop)] backdrop-blur">
        <span className="flex-1 text-sm text-muted">{msg ? <span className={`inline-flex items-center gap-1.5 font-semibold ${msg.ok ? 'text-good' : 'text-crit'}`}>{!msg.ok && <CircleAlert size={15} />}{msg.text}</span> : 'Changes save to the draft. Launch when it’s ready.'}</span>
        <button className="btn btn-primary" disabled={busy} onClick={save}>
          {busy ? 'Saving…' : 'Save draft'}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={wide ? 'md:col-span-2' : ''}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}
