import { LogOut, Plus } from 'lucide-react';
import { useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, useUser } from '../lib/auth';
import { useLive } from '../lib/live';
import { Logo } from './Logo';
import { Toasts } from './Toasts';

const NAV = [
  { to: '/org', label: 'Boxes', end: true },
  { to: '/org/new', label: 'New Box', end: false },
  { to: '/org/settings', label: 'Settings', end: false },
];

export function OrgShell() {
  const user = useUser();
  const { logout } = useAuth();
  const { connected } = useLive();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    document.body.className = 't-org';
    return () => {
      document.body.className = '';
    };
  }, []);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="t-org min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-surface">
        <div className="mx-auto flex min-h-16 max-w-[1240px] flex-wrap items-center gap-x-8 gap-y-1 px-4 py-2 sm:px-6">
          <Link to="/org" className="flex items-center gap-2" aria-label="Kontho console home">
            <Logo height={26} />
            <span className="eyebrow pt-1">Console</span>
          </Link>
          <nav className="order-3 -mx-1 flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto" aria-label="Main">
            {NAV.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) => `inline-flex min-h-10 items-center rounded-full px-4 text-[15px] font-semibold whitespace-nowrap ${isActive ? 'bg-ink text-cream' : 'text-fg hover:bg-off'}`}
              >
                {to === '/org/new' && <Plus size={16} className="mr-1" />}
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-4">
            <span className="hidden items-center gap-2 text-sm font-semibold text-muted md:inline-flex">
              <span className="live-dot" data-off={!connected} aria-hidden />
              {connected ? 'Live' : 'Reconnecting…'}
            </span>
            <span className="hidden min-w-0 text-right leading-tight sm:block">
              <span className="block truncate text-sm font-bold">{user.org}</span>
              <span className="block truncate text-xs text-muted">{user.name}</span>
            </span>
            <button
              className="btn btn-quiet btn-sm px-2"
              aria-label="Sign out"
              title="Sign out"
              onClick={async () => {
                await logout();
                navigate('/login');
              }}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1240px] px-4 pt-7 pb-16 sm:px-6">
        <Outlet />
      </main>
      <Toasts />
    </div>
  );
}
