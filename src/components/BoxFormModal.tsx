import { Check } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { BOX_COLORS, type Box } from '../../shared/types';
import { api } from '../lib/api';
import { Modal } from './Modal';

export function BoxFormModal({ box, onClose, onSaved }: { box?: Box; onClose(): void; onSaved(box: Box): void }) {
  const [name, setName] = useState(box?.name ?? '');
  const [description, setDescription] = useState(box?.description ?? '');
  const [color, setColor] = useState<string>(box?.color ?? BOX_COLORS[0]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = box
        ? await api<{ box: Box }>(`/boxes/${box.id}`, { method: 'PATCH', body: { name, description, color } })
        : await api<{ box: Box }>('/boxes', { body: { name, description, color } });
      onSaved(r.box);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the box.');
      setBusy(false);
    }
  }

  return (
    <Modal
      title={box ? 'Edit problem box' : 'New problem box'}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy || !name.trim()} onClick={() => submit()}>
            {box ? 'Save changes' : 'Create box'}
          </button>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <p className="text-sm text-ink-2">A box is a link you share with people. Anything they submit lands in your inbox, anonymously unless they choose to leave a name.</p>
        <label>
          <span className="label">Name</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Office facilities, Customer feedback" maxLength={60} required />
        </label>
        <label>
          <span className="label">
            What should people report here? <span className="font-normal text-ink-3">(shown on the public page)</span>
          </span>
          <textarea className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Broken equipment, cleanliness, safety concerns…" maxLength={240} />
        </label>
        <div>
          <span className="label">Colour</span>
          <div className="flex flex-wrap gap-2">
            {BOX_COLORS.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setColor(c)}
                className="grid size-8 place-items-center rounded-full ring-offset-2 ring-offset-[var(--surface)] transition-transform hover:scale-110"
                style={{ background: c, boxShadow: color === c ? `0 0 0 2px var(--surface), 0 0 0 4px ${c}` : undefined }}
                aria-label={`Colour ${c}`}
                aria-pressed={color === c}
              >
                {color === c && <Check size={15} color="#fff" strokeWidth={3} />}
              </button>
            ))}
          </div>
        </div>
        {error && <p className="text-[13px] font-medium text-[var(--pr-urgent)]">{error}</p>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
