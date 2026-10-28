import { BarChart3, Home, Trophy, UserRound, Wallet } from 'lucide-react';
import { useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import type { PlayerHome } from '../../shared/types';
import { useUser } from '../lib/auth';
import { tk } from '../lib/format';
import { useLiveReload } from '../lib/live';
import { useFetch } from '../lib/useFetch';
import { Logo } from './Logo';
import { Toasts } from './Toasts';

const NAV = [
  { to: '/play', label: 'Tonight', icon: Home, end: true },
  { to: '/play/results', label: 'Results', icon: Trophy },
  { to: '/play/wallet', label: 'Wallet', icon: Wallet },
  { to: '/play/stats', label: 'My voice', icon: BarChart3 },
];

export function PlayerShell() {
  const user = useUser();
  const { pathname } = useLocation();
  const home = useFetch<PlayerHome>('/player/home');
  useLiveReload(home.reload);
  const focus = pathname.startsWith('/play/box/');

  useEffect(() => {
    document.body.className = 't-player';
    return () => {
      document.body.className = '';
    };
  }, []);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="t-player min-h-dvh">
      {!focus && (
        <header className="sticky top-0 z-30 border-b border-line bg-ink/95 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-[1120px] items-center gap-6 px-4 sm:px-6">
            <Link to="/play" aria-label="Kontho home">
              <Logo reversed height={28} />
            </Link>
            <nav className="hidden flex-1 items-center gap-6 lg:flex" aria-label="Main">
              {NAV.map(({ to, label, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `inline-flex min-h-11 items-center text-[15px] font-semibold ${isActive ? 'text-amber underline decoration-2 underline-offset-[6px]' : 'text-cream hover:text-amber'}`
                  }
                >
                  {label}
                </NavLink>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-2">
              <Link to="/play/wallet" className="tnum inline-flex min-h-10 items-center gap-2 rounded-full border-2 border-line-strong px-4 text-sm font-bold hover:border-amber">
                <Wallet size={16} className="text-amber" />
                {home.data ? tk(home.data.balance) : '৳—'}
              </Link>
              <NavLink
                to="/play/me"
                aria-label="My profile"
                className={({ isActive }) => `grid size-10 place-items-center rounded-full text-sm font-bold ${isActive ? 'bg-amber text-ink' : 'bg-ink-raised text-cream hover:bg-off'}`}
              >
                {user.name
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((p) => p[0])
                  .join('')
                  .toUpperCase()}
              </NavLink>
            </div>
          </div>
        </header>
      )}

      <main className={`mx-auto w-full ${focus ? 'max-w-[640px]' : 'max-w-[1120px]'} px-4 pt-6 pb-28 sm:px-6 lg:pb-16`}>
        <Outlet />
      </main>

      {!focus && (
        <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t-2 border-amber bg-ink pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="Main">
          {[...NAV, { to: '/play/me', label: 'Me', icon: UserRound, end: false }].map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold ${isActive ? 'text-amber' : 'text-muted'}`}>
              <Icon size={20} />
              {label}
            </NavLink>
          ))}
        </nav>
      )}
      <Toasts />
    </div>
  );
}
