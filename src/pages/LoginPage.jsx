import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

function getLoginErrorMessage(authError) {
  if (!authError) return 'Unable to sign in.';
  if (authError.code === 'invalid_credentials' || /invalid login credentials/i.test(authError.message || '')) {
    return 'Invalid email or password. Please check your credentials and try again.';
  }
  return authError.message || 'Unable to sign in.';
}

export default function LoginPage() {
  const { user, loading, error: authError, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!loading && user) {
      navigate(location.state?.from || '/', { replace: true });
    }
  }, [loading, location.state, navigate, user]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await signIn({ email: email.trim(), password });
    if (result.error) {
      setError(getLoginErrorMessage(result.error));
    }
    setSubmitting(false);
  };

  const displayedError = error || (authError ? getLoginErrorMessage({ message: authError }) : null);

  if (loading) {
    return <section className="auth-page"><div className="empty-state">Checking sign-in status...</div></section>;
  }

  return (
    <section className="auth-page">
      <div className="panel auth-panel">
        <p className="eyebrow">RIVERISE access</p>
        <h2>Sign in</h2>
        <p className="muted">Use your authenticated RIVERISE account to access safety actions and monitoring tools.</p>

        {displayedError ? <div className="error-box">{displayedError}</div> : null}

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <button className="auth-submit" type="submit" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </section>
  );
}
