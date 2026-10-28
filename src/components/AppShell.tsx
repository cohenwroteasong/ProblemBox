import { ChartColumn, Inbox, LayoutDashboard, LogOut, Menu, Monitor, Moon, Package, Settings, Sun, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, useUser } from '../lib/auth';
import { initials } from '../lib/format';
import { useLive } from '../lib/live';
import { useTheme, type ThemePref } from '../lib/theme';
import { Logo } from './Logo';
import { Toasts } from './Toasts';

const NAV = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/inbox', label: 'Inbox', icon: Inbox },
  { to: '/boxes', label: 'Problem boxes', icon: Package },
  { to: '/analytics', label: 'Analytics', icon: ChartColumn },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function AppShell() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { unseen, markSeen } = useLive();

  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    if (location.pathname.startsWith('/inbox')) markSeen();
  }, [location.pathname, unseen, markSeen]);

  return (
    <div className="min-h-dvh lg:pl-[248px]">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] lg:block">
        <Sidebar />
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-side-line bg-side px-4 lg:hidden">
        <Logo size={28} light />
        <button className="grid size-10 place-items-center rounded-xl text-side-ink hover:bg-white/10" onClick={() => setOpen(true)} aria-label="Open menu">
          <span className="relative">
            <Menu size={22} />
            {unseen > 0 && <span className="absolute -top-1 -right-1 size-2.5 rounded-full bg-brand ring-2 ring-side" />}
          </span>
        </button>
      </header>
      {open && (
        <div className="animate-fade fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setOpen(false)}>
          <aside className="animate-sheet absolute inset-y-0 right-0 w-[280px] max-w-[85vw]" onClick={(e) => e.stopPropagation()}>
            <button className="absolute top-3 right-3 z-10 grid size-9 place-items-center rounded-lg text-side-ink-2 hover:bg-white/10" onClick={() => setOpen(false)} aria-label="Close menu">
              <X size={20} />
            </button>
            <Sidebar />
          </aside>
        </div>
      )}

      <main className="mx-auto w-full max-w-[1400px] px-4 pt-5 pb-16 sm:px-6 lg:px-8 lg:pt-7">
        <Outlet />
      </main>
      <Toasts />
    </div>
  );
}

function Sidebar() {
  const user = useUser();
  const { logout } = useAuth();
  const { unseen, connected } = useLive();
  const navigate = useNavigate();

  return (
    <div className="flex h-full flex-col bg-side text-side-ink">
      <div className="px-5 pt-5 pb-4">
        <Logo light />
      </div>
      {user.org && (
        <div className="mx-3 mb-3 rounded-xl border border-side-line bg-side-2 px-3 py-2.5">
          <div className="text-[11px] font-semibold tracking-wider text-side-ink-2 uppercase">Workspace</div>
          <div className="truncate text-sm font-semibold">{user.org}</div>
        </div>
      )}
      <nav className="flex flex-col gap-0.5 px-3" aria-label="Main">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `group flex h-10 items-center gap-3 rounded-xl px-3 text-[14px] font-medium transition-colors ${isActive ? 'bg-white/10 text-white' : 'text-side-ink-2 hover:bg-white/5 hover:text-side-ink'}`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={18} strokeWidth={isActive ? 2.3 : 2} className={isActive ? 'text-[#b9a9ff]' : ''} />
                <span className="flex-1">{label}</span>
                {to === '/inbox' && unseen > 0 && (
                  <span key={unseen} className="animate-bump tnum grid h-5 min-w-5 place-items-center rounded-full bg-brand-solid px-1.5 text-[11px] font-bold text-white">
                    {unseen > 99 ? '99+' : unseen}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-3 p-3">
        <div className="flex items-center gap-2 px-2 text-xs text-side-ink-2">
          <span className="live-dot" data-off={!connected} aria-hidden />
          {connected ? 'Live — new problems appear instantly' : 'Reconnecting…'}
        </div>
        <ThemeSwitch />
        <div className="flex items-center gap-3 rounded-xl border border-side-line bg-side-2 p-2.5">
          <div className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#8f78ff] to-[#6c4cf5] text-[13px] font-bold text-white">{initials(user.name)}</div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold">{user.name}</div>
            <div className="truncate text-xs text-side-ink-2">{user.email}</div>
          </div>
          <button
            className="grid size-8 place-items-center rounded-lg text-side-ink-2 hover:bg-white/10 hover:text-white"
            title="Sign out"
            aria-label="Sign out"
            onClick={async () => {
              await logout();
              navigate('/login');
            }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function ThemeSwitch() {
  const [pref, setPref] = useTheme();
  const options: { value: ThemePref; icon: typeof Sun; label: string }[] = [
    { value: 'light', icon: Sun, label: 'Light' },
    { value: 'system', icon: Monitor, label: 'System' },
    { value: 'dark', icon: Moon, label: 'Dark' },
  ];
  return (
    <div className="grid grid-cols-3 rounded-xl border border-side-line bg-side-2 p-0.5" role="radiogroup" aria-label="Theme">
      {options.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          role="radio"
          aria-checked={pref === value}
          title={label}
          onClick={() => setPref(value)}
          className={`flex h-7 items-center justify-center gap-1.5 rounded-[9px] text-xs font-medium ${pref === value ? 'bg-white/12 text-white' : 'text-side-ink-2 hover:text-side-ink'}`}
        >
          <Icon size={13} />
          {label}
        </button>
      ))}
    </div>
  );
}
