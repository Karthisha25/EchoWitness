import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { ROUTES } from '@/routes/paths';

export function LoginScreen() {
  const { user, loading, signInAnonymous } = useAuth();

  if (!loading && user) {
    return <Navigate to={ROUTES.home} replace />;
  }

  return (
    <div className="login-shell">
      <section className="screen-card hero-card">
        <p className="eyebrow">EchoWitness</p>
        <h2>Document safely. Speak when you are ready.</h2>
        <p className="muted">
          Anonymous sign-in keeps your account private. All incident data stays in
          your Firestore account only.
        </p>
        <button
          type="button"
          className="primary-button"
          disabled={loading}
          onClick={() => void signInAnonymous()}
        >
          Continue anonymously
        </button>
      </section>
    </div>
  );
}
