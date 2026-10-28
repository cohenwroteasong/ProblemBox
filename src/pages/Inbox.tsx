import { Inbox as InboxIcon, MousePointerClick, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CATEGORIES, PRIORITIES, type Box, type ProblemList } from '../../shared/types';
import { EmptyState } from '../components/EmptyState';
import { ProblemDetail } from '../components/ProblemDetail';
import { ProblemRow } from '../components/ProblemRow';
import { Segmented } from '../components/Segmented';
import { PRIORITY_LABEL } from '../lib/format';
import { useLive } from '../lib/live';
import { useFetch } from '../lib/useFetch';

const PAGE = 50;

export function Inbox() {
  const { id } = useParams();
  const selected = id ? Number(id) : null;
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { tick, fresh } = useLive();
  const [limit, setLimit] = useState(PAGE);
  const [q, setQ] = useState(params.get('q') ?? '');

  const status = params.get('status') ?? 'open';
  const box = params.get('box') ?? '';
  const priority = params.get('priority') ?? '';
  const category = params.get('category') ?? '';
  const sort = params.get('sort') ?? 'newest';
  const search = params.get('q') ?? '';

  // Debounce typing into the URL.
  useEffect(() => {
    const t = setTimeout(() => update({ q }), 250);
    return () => clearTimeout(t);
    // Only the typed text should trigger this; `update` reads the latest params itself.
  }, [q]);

  function update(next: Record<string, string>) {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    if (p.toString() !== params.toString()) {
      setLimit(PAGE);
      setParams(p, { replace: true });
    }
  }

  const query = useMemo(() => {
    const p = new URLSearchParams({ status, sort, limit: String(limit) });
    if (box) p.set('box', box);
    if (priority) p.set('priority', priority);
    if (category) p.set('category', category);
    if (search) p.set('q', search);
    return `/problems?${p}`;
  }, [status, box, priority, category, sort, search, limit]);

  const list = useFetch<ProblemList>(query);
  const boxes = useFetch<{ boxes: Box[] }>('/boxes');

  useEffect(() => {
    if (tick) void list.reload();
  }, [tick, list.reload]);

  const counts = list.data?.counts;
  const filtered = !!(box || priority || category || search);
  const qs = params.toString() ? `?${params}` : '';

  return (
    <div className="animate-rise">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-[1.75rem]">Inbox</h1>
          <p className="mt-1 text-sm text-ink-2">Every problem from every box. New ones appear at the top as they arrive.</p>
        </div>
      </div>

      <div className="card grid min-h-[calc(100dvh-180px)] overflow-hidden lg:h-[calc(100dvh-160px)] lg:grid-cols-[minmax(340px,440px)_minmax(0,1fr)]">
        {/* List */}
        <div className={`flex min-h-0 flex-col border-line lg:border-r ${selected ? 'hidden lg:flex' : 'flex'}`}>
          <div className="flex flex-col gap-2.5 border-b border-line p-3">
            <div className="scroll-thin -mx-3 overflow-x-auto px-3 pb-0.5">
              <Segmented
                label="Status"
                value={status}
                onChange={(v) => update({ status: v })}
                options={[
                  { value: 'open', label: 'Open', count: counts ? counts.new + counts.in_progress : undefined },
                  { value: 'new', label: 'New', count: counts?.new },
                  { value: 'in_progress', label: 'In progress', count: counts?.in_progress },
                  { value: 'resolved', label: 'Resolved', count: counts?.resolved },
                  { value: 'all', label: 'All', count: counts?.all },
                ]}
              />
            </div>
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" />
              <input className="input input-sm pl-9" placeholder="Search problems…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search problems" />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
              <select className="input input-sm" value={box} onChange={(e) => update({ box: e.target.value })} aria-label="Box">
                <option value="">All boxes</option>
                {boxes.data?.boxes.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <select className="input input-sm" value={priority} onChange={(e) => update({ priority: e.target.value })} aria-label="Priority">
                <option value="">Any priority</option>
                <option value="urgent,high">Urgent + high</option>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABEL[p]}
                  </option>
                ))}
              </select>
              <select className="input input-sm" value={category} onChange={(e) => update({ category: e.target.value })} aria-label="Category">
                <option value="">Any category</option>
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <select className="input input-sm" value={sort} onChange={(e) => update({ sort: e.target.value })} aria-label="Sort">
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="priority">Priority</option>
                <option value="updated">Recently updated</option>
              </select>
            </div>
            {filtered && (
              <button
                className="self-start text-xs font-semibold text-brand-ink hover:underline"
                onClick={() => {
                  setQ('');
                  update({ box: '', priority: '', category: '', q: '' });
                }}
              >
                <X size={12} className="mr-0.5 inline" /> Clear filters
              </button>
            )}
          </div>

          <div className={`scroll-thin min-h-0 flex-1 overflow-y-auto transition-opacity ${list.loading && list.data ? 'opacity-70' : ''}`}>
            {list.error && !list.data && <p className="p-5 text-sm text-ink-2">{list.error}</p>}
            {!list.data && !list.error && <ListSkeleton />}
            {list.data && list.data.items.length === 0 && (
              <EmptyState icon={<InboxIcon size={22} />} title={filtered ? 'No matches' : status === 'open' ? 'Inbox zero' : 'Nothing here'}>
                {filtered ? 'Try a different search or clear the filters.' : status === 'open' ? 'Every problem has been handled. New ones will pop up here.' : 'No problems with this status yet.'}
              </EmptyState>
            )}
            <div className="divide-y divide-line">
              {list.data?.items.map((p) => (
                <ProblemRow key={p.id} problem={p} active={p.id === selected} fresh={fresh.has(p.id)} search={qs} />
              ))}
            </div>
            {list.data && list.data.total > list.data.items.length && (
              <div className="p-3">
                <button className="btn btn-secondary btn-sm w-full" onClick={() => setLimit((l) => l + PAGE)}>
                  Show more ({list.data.total - list.data.items.length} left)
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Detail */}
        <div className={`min-h-0 ${selected ? 'block' : 'hidden lg:block'}`}>
          {selected ? (
            <ProblemDetail key={selected} id={selected} onClose={() => navigate(`/inbox${qs}`)} onChange={() => list.reload()} />
          ) : (
            <div className="grid h-full place-items-center">
              <EmptyState icon={<MousePointerClick size={22} />} title="Pick a problem">
                Select a problem on the left to read it, change its status and leave notes for your team.
              </EmptyState>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="animate-pulse divide-y divide-line">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="px-4 py-3.5">
          <div className="mb-2 h-4 w-3/4 rounded bg-surface-3" />
          <div className="mb-3 h-3 w-1/2 rounded bg-surface-3" />
          <div className="h-4 w-1/3 rounded-full bg-surface-3" />
        </div>
      ))}
    </div>
  );
}
