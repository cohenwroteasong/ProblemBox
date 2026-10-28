import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { LogoMark } from './components/Logo';
import { AuthProvider, useAuth } from './lib/auth';
import { LiveProvider } from './lib/live';
import { ThemeProvider } from './lib/theme';
import { Login } from './pages/Login';
import { NotFound, PublicBox } from './pages/PublicBox';
import { Signup } from './pages/Signup';

// The dashboard (and its chart library) loads separately, so the public box page
// people open from a QR code on their phone stays small.
const AppShell = lazy(() => import('./components/AppShell').then((m) => ({ default: m.AppShell })));
const Overview = lazy(() => import('./pages/Overview').then((m) => ({ default: m.Overview })));
const Inbox = lazy(() => import('./pages/Inbox').then((m) => ({ default: m.Inbox })));
const Boxes = lazy(() => import('./pages/Boxes').then((m) => ({ default: m.Boxes })));
const Analytics = lazy(() => import('./pages/Analytics').then((m) => ({ default: m.Analytics })));
const Settings = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings })));

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <div className="animate-pulse">
        <LogoMark size={40} />
      </div>
    </div>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  if (user === undefined) return <Splash />;
  if (!user) {
    const next = location.pathname + location.search;
    return <Navigate to={next === '/' ? '/login' : `/login?next=${encodeURIComponent(next)}`} replace />;
  }
  return <>{children}</>;
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (user === undefined) return <Splash />;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<Splash />}>
            <Routes>
              <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
              <Route path="/signup" element={<GuestOnly><Signup /></GuestOnly>} />
              <Route path="/b/:slug" element={<PublicBox />} />
              <Route
                element={
                  <RequireAuth>
                    <LiveProvider>
                      <AppShell />
                    </LiveProvider>
                  </RequireAuth>
                }
              >
                <Route index element={<Overview />} />
                <Route path="inbox" element={<Inbox />} />
                <Route path="inbox/:id" element={<Inbox />} />
                <Route path="boxes" element={<Boxes />} />
                <Route path="analytics" element={<Analytics />} />
                <Route path="settings" element={<Settings />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
