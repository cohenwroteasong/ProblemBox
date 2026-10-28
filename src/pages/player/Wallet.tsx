import { ArrowDownLeft, ArrowUpRight, ShieldCheck, Smartphone, Wallet as WalletIcon } from 'lucide-react';
import { useState } from 'react';
import { BKASH_MIN, RECHARGE_MIN, type Wallet as WalletData } from '../../../shared/types';
import { Modal } from '../../components/Modal';
import { api } from '../../lib/api';
import { useUser } from '../../lib/auth';
import { dateShort, tk } from '../../lib/format';
import { useLive, useLiveReload } from '../../lib/live';
import { useFetch } from '../../lib/useFetch';
import { Threshold } from './Tonight';

const mask = (phone: string) => (phone.length === 11 ? `${phone.slice(0, 3)}••••••${phone.slice(-3)}` : phone);

export function Wallet() {
  const user = useUser();
  const { data, reload, setData } = useFetch<WalletData>('/player/wallet');
  useLiveReload(reload);
  const { notify } = useLive();
  const [method, setMethod] = useState<'recharge' | 'bkash' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const balance = data?.balance ?? 0;

  async function withdraw() {
    if (!method) return;
    setBusy(true);
    setError(null);
    try {
      const w = await api<WalletData>('/player/withdraw', { body: { method } });
      setData(w);
      notify({ eyebrow: 'Withdrawal queued', title: `${tk(balance)} ${method === 'bkash' ? 'to bKash' : 'as mobile recharge'}`, body: 'Goes out in today’s batch · no fees', tone: 'mint' });
      setMethod(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not withdraw.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="animate-rise grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex min-w-0 flex-col gap-6">
        <section>
          <p className="eyebrow">Wallet</p>
          <h1 className="mt-2 text-4xl">Small amounts add up</h1>
        </section>

        <div className="card flex flex-col gap-5 p-6">
          <div>
            <p className="text-sm font-semibold text-muted">Wallet balance</p>
            <p className="tnum font-display text-6xl leading-none font-extrabold">{data ? tk(balance) : '৳—'}</p>
            {data && <p className="mt-2 text-sm text-muted">{tk(data.totalEarned)} earned on Kontho so far</p>}
          </div>
          <Threshold label="Mobile recharge" min={RECHARGE_MIN} balance={balance} />
          <Threshold label="bKash" min={BKASH_MIN} balance={balance} />
          <div className="grid gap-2 sm:grid-cols-2">
            <button className="btn btn-ghost" disabled={balance < RECHARGE_MIN} onClick={() => setMethod('recharge')}>
              <Smartphone size={17} /> Mobile recharge
            </button>
            <button className="btn btn-amber" disabled={balance < BKASH_MIN} onClick={() => setMethod('bkash')}>
              <WalletIcon size={17} /> Withdraw to bKash
            </button>
          </div>
          <p className="text-sm text-muted">Withdrawals go out in one daily batch, only to your own number ({mask(user.phone)}). No fees, ever.</p>
        </div>

        <section className="card p-6">
          <h2 className="mb-2 text-xl">History</h2>
          {data && data.entries.length === 0 && <p className="text-muted">No earnings yet. Finish tonight’s Box to start.</p>}
          <ul className="divide-y divide-line">
            {data?.entries.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-4 py-3">
                <span className="flex min-w-0 items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full" style={{ background: e.amount > 0 ? 'color-mix(in srgb, var(--mint) 16%, transparent)' : 'var(--surface-2)', color: e.amount > 0 ? 'var(--mint)' : 'var(--muted)' }}>
                    {e.amount > 0 ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{e.kind === 'box' ? `Box · ${e.label}` : e.label}</span>
                    <span className="block text-xs text-muted">{dateShort(e.createdAt)}</span>
                  </span>
                </span>
                <span className="tnum shrink-0 font-bold" style={{ color: e.amount > 0 ? 'var(--fg)' : 'var(--muted)' }}>
                  {e.amount > 0 ? '+' : '−'}
                  {tk(Math.abs(e.amount))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <aside className="flex flex-col gap-4">
        {data && data.withdrawals.length > 0 && (
          <div className="card p-5">
            <h2 className="mb-2 text-lg">Withdrawals</h2>
            <ul className="divide-y divide-line">
              {data.withdrawals.map((w) => (
                <li key={w.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span>
                    <span className="block font-semibold">{w.method === 'bkash' ? 'bKash' : 'Mobile recharge'}</span>
                    <span className="text-muted">{dateShort(w.createdAt)}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="tnum font-bold">{tk(w.amount)}</span>
                    <span className={`sticker sticker-flat !px-2 !py-0.5 !text-[11px] ${w.status === 'queued' ? 'sticker-amber' : ''}`}>{w.status === 'queued' ? 'In today’s batch' : 'Sent'}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="card p-5">
          <h2 className="mb-3 flex items-center gap-2 text-lg">
            <ShieldCheck size={20} className="text-pink" /> Stay safe
          </h2>
          <ol className="flex flex-col gap-3 text-sm">
            <li>
              <b>1.</b> Kontho never asks for your bKash PIN, OTP or bank password.
            </li>
            <li>
              <b>2.</b> Players never pay a fee, a deposit or for a “higher tier”.
            </li>
            <li>
              <b>3.</b> A reserve equal to every player’s balance is held at all times.
            </li>
            <li>
              <b>4.</b> Our Community Host is a real person; the in-app helper is always labelled as AI.
            </li>
          </ol>
        </div>
      </aside>

      {method && (
        <Modal
          theme="t-player"
          title={method === 'bkash' ? 'Withdraw to bKash' : 'Send as mobile recharge'}
          onClose={() => setMethod(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setMethod(null)}>
                Cancel
              </button>
              <button className="btn btn-amber" disabled={busy} onClick={withdraw}>
                {busy ? 'Queueing…' : `Withdraw ${tk(balance)}`}
              </button>
            </>
          }
        >
          <p className="text-muted">
            Your whole balance of <b className="text-fg">{tk(balance)}</b> goes to <b className="text-fg">{mask(user.phone)}</b> in today’s batch. There’s no fee.
          </p>
          {error && <p className="mt-3 text-sm font-semibold text-pink">{error}</p>}
        </Modal>
      )}
    </div>
  );
}
