import { Check, Copy, Download, Ellipsis, ExternalLink, Inbox, Lock, LockOpen, Package, Pencil, Plus, QrCode, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Box } from '../../shared/types';
import { BoxFormModal } from '../components/BoxFormModal';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { api } from '../lib/api';
import { timeAgo } from '../lib/format';
import { useLive } from '../lib/live';
import { useFetch } from '../lib/useFetch';

const publicUrl = (slug: string) => `${window.location.origin}/b/${slug}`;

export function Boxes() {
  const { data, reload, error } = useFetch<{ boxes: Box[] }>('/boxes');
  const { tick } = useLive();
  const [editing, setEditing] = useState<Box | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Box | null>(null);
  const [qr, setQr] = useState<Box | null>(null);

  useEffect(() => {
    if (tick) void reload();
  }, [tick, reload]);

  async function toggleOpen(box: Box) {
    await api(`/boxes/${box.id}`, { method: 'PATCH', body: { isOpen: !box.isOpen } });
    void reload();
  }

  return (
    <div className="animate-rise">
      <PageHeader
        title="Problem boxes"
        subtitle="Each box has its own public link. Share it anywhere — people can report a problem without signing up."
        actions={
          <button className="btn btn-primary" onClick={() => setEditing('new')}>
            <Plus size={17} /> New box
          </button>
        }
      />

      {error && !data && <p className="text-sm text-ink-2">{error}</p>}
      {data && data.boxes.length === 0 && (
        <div className="card">
          <EmptyState
            icon={<Package size={22} />}
            title="No boxes yet"
            action={
              <button className="btn btn-primary" onClick={() => setEditing('new')}>
                <Plus size={17} /> Create your first box
              </button>
            }
          >
            Create a box for each topic or place you want to hear about.
          </EmptyState>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {data?.boxes.map((b) => (
          <BoxCard key={b.id} box={b} onEdit={() => setEditing(b)} onDelete={() => setDeleting(b)} onToggle={() => toggleOpen(b)} onQr={() => setQr(b)} />
        ))}
      </div>

      {editing && (
        <BoxFormModal
          box={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void reload();
          }}
        />
      )}
      {deleting && <DeleteModal box={deleting} onClose={() => setDeleting(null)} onDeleted={() => (setDeleting(null), void reload())} />}
      {qr && <QrModal box={qr} onClose={() => setQr(null)} />}
    </div>
  );
}

function BoxCard({ box: b, onEdit, onDelete, onToggle, onQr }: { box: Box; onEdit(): void; onDelete(): void; onToggle(): void; onQr(): void }) {
  const [copied, setCopied] = useState(false);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const url = publicUrl(b.slug);
  const rate = b.total ? Math.round((b.resolved / b.total) * 100) : null;

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setMenu(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menu]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard blocked (insecure origin): select the text so it can be copied by hand.
      const input = document.getElementById(`url-${b.id}`) as HTMLInputElement | null;
      input?.select();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <article className={`card flex flex-col overflow-hidden ${b.isOpen ? '' : 'opacity-80'}`}>
      <div className="h-1.5" style={{ background: b.color }} />
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl" style={{ background: `color-mix(in srgb, ${b.color} 14%, transparent)`, color: b.color }}>
            <Package size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-bold">{b.name}</h2>
            <span className={`mt-0.5 inline-flex items-center gap-1 text-xs font-semibold ${b.isOpen ? 'text-[var(--st-resolved)]' : 'text-ink-3'}`}>
              {b.isOpen ? <LockOpen size={12} /> : <Lock size={12} />}
              {b.isOpen ? 'Accepting problems' : 'Closed to new problems'}
            </span>
          </div>
          <div className="relative" ref={menuRef}>
            <button className="btn btn-ghost btn-sm -mr-2 px-2" onClick={() => setMenu((m) => !m)} aria-label="Box actions" aria-expanded={menu}>
              <Ellipsis size={18} />
            </button>
            {menu && (
              <div className="animate-fade absolute top-full right-0 z-20 mt-1 w-48 rounded-xl border border-line bg-surface p-1 shadow-pop" role="menu">
                <MenuItem icon={Pencil} label="Edit" onClick={() => (setMenu(false), onEdit())} />
                <MenuItem icon={b.isOpen ? Lock : LockOpen} label={b.isOpen ? 'Close box' : 'Reopen box'} onClick={() => (setMenu(false), onToggle())} />
                <MenuItem icon={Trash2} label="Delete" danger onClick={() => (setMenu(false), onDelete())} />
              </div>
            )}
          </div>
        </div>

        {b.description && <p className="mt-3 line-clamp-2 text-sm text-ink-2">{b.description}</p>}

        <dl className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-surface-2 p-3 text-center">
          <div>
            <dt className="text-[11px] font-semibold text-ink-3 uppercase">Open</dt>
            <dd className="mt-0.5 text-lg font-bold">{b.open}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold text-ink-3 uppercase">Total</dt>
            <dd className="mt-0.5 text-lg font-bold">{b.total}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold text-ink-3 uppercase">Resolved</dt>
            <dd className="mt-0.5 text-lg font-bold">{rate === null ? '—' : `${rate}%`}</dd>
          </div>
        </dl>

        <div className="mt-4">
          <label className="label" htmlFor={`url-${b.id}`}>
            Public link
          </label>
          <div className="flex gap-2">
            <input id={`url-${b.id}`} className="input input-sm min-w-0 flex-1 bg-surface-2 text-[13px] text-ink-2" readOnly value={url} onFocus={(e) => e.target.select()} />
            <button className="btn btn-secondary btn-sm h-9 w-9 shrink-0 p-0" onClick={copy} aria-label="Copy link" title="Copy link">
              {copied ? <Check size={15} className="text-[var(--st-resolved)]" /> : <Copy size={15} />}
            </button>
            <button className="btn btn-secondary btn-sm h-9 w-9 shrink-0 p-0" onClick={onQr} aria-label="QR code" title="QR code">
              <QrCode size={15} />
            </button>
          </div>
        </div>

        <div className="mt-auto flex items-center justify-between gap-2 pt-4">
          <span className="text-xs text-ink-3">{b.lastProblemAt ? `Last problem ${timeAgo(b.lastProblemAt)}` : 'No problems yet'}</span>
          <div className="flex gap-1">
            <a href={`/b/${b.slug}`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
              <ExternalLink size={14} /> Open page
            </a>
            <Link to={`/inbox?box=${b.id}&status=all`} className="btn btn-ghost btn-sm">
              <Inbox size={14} /> Inbox
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

function MenuItem({ icon: Icon, label, onClick, danger }: { icon: typeof Pencil; label: string; onClick(): void; danger?: boolean }) {
  return (
    <button role="menuitem" onClick={onClick} className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium hover:bg-surface-3 ${danger ? 'text-[var(--pr-urgent)]' : 'text-ink'}`}>
      <Icon size={15} />
      {label}
    </button>
  );
}

function DeleteModal({ box, onClose, onDeleted }: { box: Box; onClose(): void; onDeleted(): void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal
      title="Delete this box?"
      onClose={onClose}
      width={420}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-danger"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api(`/boxes/${box.id}`, { method: 'DELETE', body: {} });
                onDeleted();
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Could not delete.');
                setBusy(false);
              }
            }}
          >
            <Trash2 size={15} /> Delete box
          </button>
        </>
      }
    >
      <p className="text-sm text-ink-2">
        <span className="font-semibold text-ink">{box.name}</span> and its {box.total} problem{box.total === 1 ? '' : 's'} will be permanently deleted, and its public link will stop working. If you only want to stop new
        submissions, close the box instead.
      </p>
      {error && <p className="mt-3 text-[13px] font-medium text-[var(--pr-urgent)]">{error}</p>}
    </Modal>
  );
}

function QrModal({ box, onClose }: { box: Box; onClose(): void }) {
  const [svg, setSvg] = useState<string | null>(null);
  const url = publicUrl(box.slug);

  useEffect(() => {
    import('qrcode').then((QRCode) => QRCode.toString(url, { type: 'svg', margin: 1, width: 240, color: { dark: '#17151f', light: '#ffffff' } })).then(setSvg);
  }, [url]);

  function download() {
    if (!svg) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    a.download = `kontho-${box.slug}-qr.svg`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <Modal title="Share with a QR code" onClose={onClose} width={400}>
      <p className="text-sm text-ink-2">Print this on a notice board or poster. Scanning it opens the {box.name} box.</p>
      <div className="mx-auto mt-5 w-[240px] rounded-2xl border border-line bg-white p-3">{svg ? <div dangerouslySetInnerHTML={{ __html: svg }} /> : <div className="aspect-square animate-pulse rounded-lg bg-surface-3" />}</div>
      <p className="mt-3 truncate text-center text-xs text-ink-3">{url}</p>
      <button className="btn btn-primary mt-5 w-full" onClick={download} disabled={!svg}>
        <Download size={16} /> Download SVG
      </button>
    </Modal>
  );
}
