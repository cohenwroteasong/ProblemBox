import { useEffect, useState, type ReactNode } from 'react';
import { Logo } from '../../components/Logo';
import { VoiceWave } from '../../components/VoiceWave';

const BOXES = [
  { title: 'Everyday market problems', bn: 'বাজারের সমস্যা', pool: '৳25,000', min: 6 },
  { title: 'Mobile data & internet packs', bn: 'মোবাইল ডাটা', pool: '৳20,000', min: 5 },
  { title: 'Your daily trip', bn: 'প্রতিদিনের যাতায়াত', pool: '৳30,000', min: 6 },
  { title: 'Health costs', bn: 'চিকিৎসা খরচ', pool: '৳20,000', min: 6 },
  { title: 'Cooking gas', bn: 'রান্নার গ্যাস', pool: '৳15,000', min: 5 },
];

/** Boxes opening one after another, the way they pop up in the player app. */
function OpeningBoxes() {
  const [n, setN] = useState(2);
  useEffect(() => {
    const t = setInterval(() => setN((x) => x + 1), 2800);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="relative h-[330px] w-full max-w-[400px]" aria-hidden>
      {[n, n - 1, n - 2].map((i, pos) => {
        const b = BOXES[i % BOXES.length];
        return (
          <div
            key={i}
            className={`absolute inset-x-0 rounded-[22px] border p-4 transition-all duration-700 ${pos === 0 ? 'animate-pop' : ''}`}
            style={{
              top: pos * 112,
              opacity: 1 - pos * 0.28,
              transform: `scale(${1 - pos * 0.04})`,
              zIndex: 10 - pos,
              background: pos === 0 ? 'radial-gradient(120% 120% at 0% 0%, #3a2a0e 0%, #222e44 58%)' : '#222e44',
              borderColor: pos === 0 ? '#e9a23b' : '#34425f',
            }}
          >
            <div className="mb-2 flex items-center gap-2">
              {pos === 0 ? <span className="sticker !text-xs">New Box</span> : <span className="text-xs font-semibold text-muted">Opened earlier</span>}
              <span className="ml-auto text-xs font-semibold text-muted">
                {b.pool} · ~{b.min} min
              </span>
            </div>
            <p className="font-display text-lg leading-tight font-extrabold text-cream">{b.title}</p>
            <p lang="bn" className="text-sm font-semibold text-amber">
              {b.bn}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export function AuthLayout({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.body.className = 't-org';
  }, []);
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <section className="t-player relative hidden flex-col overflow-hidden px-12 py-10 lg:flex">
        <Logo reversed height={32} />
        <div className="my-auto py-10">
          <div className="mb-6 flex flex-wrap gap-2">
            <span className="sticker">18+ only</span>
            <span className="sticker sticker-pink">Players never pay a fee</span>
          </div>
          <p lang="bn" className="text-[3.6rem] leading-[1.1] font-bold text-balance">
            আপনার কণ্ঠ, <span className="text-amber">আপনার আয়</span>
          </p>
          <p className="mt-3 font-display text-[2.4rem] leading-none font-extrabold tracking-[-0.035em]">
            Real voices, <span className="sl-underline">verified.</span>
          </p>
          <p className="mt-5 max-w-[440px] text-muted">Bangladeshi adults answer short Boxes by voice or text and earn rewards. Organisations get verified insight from all eight divisions.</p>
          <div className="mt-8">
            <OpeningBoxes />
          </div>
        </div>
        <VoiceWave bars={30} height={40} className="w-full opacity-60" />
      </section>

      <section className="t-org flex flex-col px-5 py-8 sm:px-10">
        <div className="lg:hidden">
          <Logo height={28} />
        </div>
        <div className="mx-auto my-auto w-full max-w-[440px] py-10">{children}</div>
        <p className="text-center text-xs text-muted">Kontho never asks for your bKash PIN or OTP.</p>
      </section>
    </div>
  );
}
