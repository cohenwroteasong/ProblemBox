import { ChartColumn, Inbox, Package } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import type { Priority } from '../../shared/types';
import { BoxChip, PriorityBadge } from '../components/Badges';
import { Logo } from '../components/Logo';

const SAMPLES: { box: string; color: string; title: string; priority: Priority }[] = [
  { box: 'IT & Wi-Fi', color: '#6250d6', title: 'Wi-Fi keeps dropping on the 3rd floor', priority: 'high' },
  { box: 'Hostels', color: '#eb6834', title: 'No hot water in Padma Hall since yesterday', priority: 'high' },
  { box: 'Transport', color: '#e87ba4', title: 'Bus 7 is consistently 20 minutes late', priority: 'normal' },
  { box: 'Campus Facilities', color: '#2a78d6', title: 'Exposed wires next to the notice board', priority: 'urgent' },
  { box: 'Cafeteria', color: '#eda100', title: 'Lunch queue takes 30+ minutes', priority: 'normal' },
  { box: 'Library', color: '#1baf7a', title: 'Not enough seats during exam week', priority: 'low' },
];

/** Problems "arriving" one after another, the same way they pop into the real inbox. */
function ArrivingCards() {
  const [n, setN] = useState(3);
  useEffect(() => {
    const t = setInterval(() => setN((x) => x + 1), 2600);
    return () => clearInterval(t);
  }, []);
  const visible = [n, n - 1, n - 2, n - 3].map((i) => ({ i, s: SAMPLES[((i % SAMPLES.length) + SAMPLES.length) % SAMPLES.length] }));

  return (
    <div className="relative h-[300px] w-full max-w-[420px]" aria-hidden>
      {visible.map(({ i, s }, pos) => (
        <div
          key={i}
          className={`absolute inset-x-0 rounded-2xl border border-white/10 bg-[#211e2c] p-4 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.6)] transition-all duration-700 ease-out ${pos === 0 ? 'animate-pop' : ''}`}
          style={{
            top: pos * 74,
            opacity: pos === 3 ? 0 : 1 - pos * 0.22,
            transform: `scale(${1 - pos * 0.035})`,
            zIndex: 10 - pos,
          }}
        >
          <div className="mb-2 flex items-center gap-2 text-xs">
            {pos === 0 ? <span className="live-dot" /> : <span className="size-2 rounded-full bg-white/20" />}
            <span className="font-semibold text-white/70">{pos === 0 ? 'Just now' : `${pos * 4} min ago`}</span>
            <span className="text-white/30">·</span>
            <span className="[&_span]:text-white/70">
              <BoxChip name={s.box} color={s.color} />
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-[15px] font-semibold text-white">{s.title}</p>
            {(s.priority === 'urgent' || s.priority === 'high') && <PriorityBadge priority={s.priority} size="sm" />}
          </div>
        </div>
      ))}
    </div>
  );
}

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <section
        className="relative hidden overflow-hidden bg-side px-12 py-10 text-side-ink lg:flex lg:flex-col"
        style={{ backgroundImage: 'radial-gradient(900px 500px at 15% 110%, rgba(108,76,245,0.35), transparent 60%), radial-gradient(600px 400px at 100% 0%, rgba(143,120,255,0.14), transparent 60%)' }}
      >
        <Logo light />
        <div className="my-auto max-w-[520px] py-10">
          <h1 className="text-[2.6rem] leading-[1.08] font-bold tracking-tight text-balance text-white">
            Every voice heard.
            <br />
            <span className="text-[#b9a9ff]">Every problem handled.</span>
          </h1>
          <p className="mt-4 max-w-[440px] text-[15px] leading-relaxed text-side-ink-2">
            Share a problem box with the people you serve. Reports land in a live inbox the moment they’re sent, and the analytics show whether things are getting better.
          </p>
          <div className="mt-10">
            <ArrivingCards />
          </div>
        </div>
        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-side-ink-2">
          <li className="inline-flex items-center gap-2">
            <Package size={15} className="text-[#b9a9ff]" /> Anonymous problem boxes
          </li>
          <li className="inline-flex items-center gap-2">
            <Inbox size={15} className="text-[#b9a9ff]" /> Live triage inbox
          </li>
          <li className="inline-flex items-center gap-2">
            <ChartColumn size={15} className="text-[#b9a9ff]" /> Response analytics
          </li>
        </ul>
      </section>

      <section className="flex flex-col px-5 py-8 sm:px-10">
        <div className="lg:hidden">
          <Logo />
        </div>
        <div className="mx-auto my-auto w-full max-w-[400px] py-10">{children}</div>
      </section>
    </div>
  );
}
