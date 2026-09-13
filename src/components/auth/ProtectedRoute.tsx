import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { ROUTES } from '@/routes/paths';

export function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return <p className="loading-text">Loading…</p>;
  }

  if (!user) {
    return <Navigate to={ROUTES.login} replace />;
  }

  return <Outlet />;
}
