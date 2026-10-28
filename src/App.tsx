import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { Role } from '../shared/types';
import { LogoMark } from './components/Logo';
import { AuthProvider, homeFor, useAuth } from './lib/auth';
import { LiveProvider } from './lib/live';
import { Login } from './pages/auth/Login';
import { Signup } from './pages/auth/Signup';

// Each audience's app (and the chart library) loads only when needed.
const PlayerShell = lazy(() => import('./components/PlayerShell').then((m) => ({ default: m.PlayerShell })));
const Tonight = lazy(() => import('./pages/player/Tonight').then((m) => ({ default: m.Tonight })));
const BoxPlay = lazy(() => import('./pages/player/BoxPlay').then((m) => ({ default: m.BoxPlay })));
const Results = lazy(() => import('./pages/player/Results').then((m) => ({ default: m.Results })));
const ResultDetail = lazy(() => import('./pages/player/Results').then((m) => ({ default: m.ResultDetail })));
const Wallet = lazy(() => import('./pages/player/Wallet').then((m) => ({ default: m.Wallet })));
const Stats = lazy(() => import('./pages/player/Stats').then((m) => ({ default: m.Stats })));
const Me = lazy(() => import('./pages/player/Me').then((m) => ({ default: m.Me })));
const OrgShell = lazy(() => import('./components/OrgShell').then((m) => ({ default: m.OrgShell })));
const OrgOverview = lazy(() => import('./pages/org/Overview').then((m) => ({ default: m.OrgOverview })));
const BoxReport = lazy(() => import('./pages/org/BoxReport').then((m) => ({ default: m.BoxReport })));
const NewBox = lazy(() => import('./pages/org/NewBox').then((m) => ({ default: m.NewBox })));
const OrgSettings = lazy(() => import('./pages/org/Settings').then((m) => ({ default: m.OrgSettings })));

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <div className="animate-pulse">
        <LogoMark size={44} />
      </div>
    </div>
  );
}

/** Signed-in users of the right role only; everyone else goes to sign-in or their own home. */
function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  if (user === undefined) return <Splash />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (user.role !== role) return <Navigate to={homeFor(user)} replace />;
  return <LiveProvider role={role}>{children}</LiveProvider>;
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (user === undefined) return <Splash />;
  if (user) return <Navigate to={homeFor(user)} replace />;
  return <>{children}</>;
}

function Home() {
  const { user } = useAuth();
  if (user === undefined) return <Splash />;
  return <Navigate to={user ? homeFor(user) : '/login'} replace />;
}

function NotFound() {
  return (
    <div className="t-org grid min-h-dvh place-items-center px-4 text-center">
      <div>
        <p className="font-display text-[7rem] leading-none font-extrabold text-amber">404</p>
        <h1 className="mt-2 text-3xl">This page went quiet</h1>
        <p className="mt-2 text-muted">The link may be broken or the page may have moved.</p>
        <Link to="/" className="btn btn-primary mt-6">
          Go home
        </Link>
      </div>
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<Splash />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
            <Route path="/signup" element={<GuestOnly><Signup /></GuestOnly>} />
            <Route path="/play" element={<RequireRole role="player"><PlayerShell /></RequireRole>}>
              <Route index element={<Tonight />} />
              <Route path="box/:id" element={<BoxPlay />} />
              <Route path="results" element={<Results />} />
              <Route path="results/:boxId" element={<ResultDetail />} />
              <Route path="wallet" element={<Wallet />} />
              <Route path="stats" element={<Stats />} />
              <Route path="me" element={<Me />} />
            </Route>
            <Route path="/org" element={<RequireRole role="org"><OrgShell /></RequireRole>}>
              <Route index element={<OrgOverview />} />
              <Route path="new" element={<NewBox />} />
              <Route path="boxes/:id" element={<BoxReport />} />
              <Route path="settings" element={<OrgSettings />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
