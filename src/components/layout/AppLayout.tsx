import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { ROUTES } from '@/routes/paths';

export function AppLayout() {
  const { logout } = useAuth();

  return (
    <div className="app-shell">
      <header className="app-header">
        <NavLink to={ROUTES.home} className="brand-link">
          <p className="eyebrow">Secure incident documentation</p>
          <h1>EchoWitness</h1>
        </NavLink>
        <button type="button" className="text-button" onClick={() => void logout()}>
          Sign out
        </button>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
      <nav className="bottom-nav" aria-label="Primary">
        <NavLink to={ROUTES.home} end className={({ isActive }) => (isActive ? 'is-active' : '')}>
          Home
        </NavLink>
        <NavLink to={ROUTES.history} className={({ isActive }) => (isActive ? 'is-active' : '')}>
          History
        </NavLink>
      </nav>
    </div>
  );
}
