import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';

const AuthContext = createContext({
  user: null,
  profile: null,
  loading: true,
  error: null,
  isResponder: false,
  retry: () => {},
  signIn: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryAttempt, setRetryAttempt] = useState(0);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      setError('Supabase authentication is not configured.');
      return;
    }

    let isMounted = true;

    const initializeAuth = async () => {
      try {
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (!isMounted) return;

        if (sessionError) {
          setUser(null);
          setProfile(null);
          setError(sessionError.message || 'Unable to verify your sign-in status.');
        } else {
          setUser(data.session?.user ?? null);
          setProfile(null);
          setError(null);
        }
      } catch (authError) {
        if (!isMounted) return;
        setUser(null);
        setProfile(null);
        setError(authError.message || 'Unable to verify your sign-in status.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initializeAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      setUser(session?.user ?? null);
      setProfile(null);
      setError(null);
      setLoading(false);
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [retryAttempt]);

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      error,
      isResponder: profile?.role === 'responder' || profile?.role === 'admin',
      retry: () => {
        setError(null);
        setLoading(true);
        setRetryAttempt((attempt) => attempt + 1);
      },
      signIn: async ({ email, password }) => {
        if (!supabase) return { data: { user: null, session: null }, error: new Error('Supabase is not configured.') };

        try {
          const result = await supabase.auth.signInWithPassword({ email: email.trim(), password });
          if (result.error) {
            setError(result.error.message || 'Unable to sign in.');
            return result;
          }

          if (!result.data?.session || !result.data.user) {
            const sessionError = new Error('Supabase did not return a valid authentication session.');
            setError(sessionError.message);
            return { ...result, error: sessionError };
          }

          setUser(result.data.user);
          setProfile(null);
          setError(null);
          return result;
        } catch (authError) {
          const result = { data: { user: null, session: null }, error: authError };
          setError(authError.message || 'Unable to sign in.');
          return result;
        }
      },
      signOut: async () => {
        if (!supabase) return { error: new Error('Supabase is not configured.') };
        const result = await supabase.auth.signOut();
        if (!result.error) {
          setUser(null);
          setProfile(null);
          setError(null);
        }
        return result;
      },
    }),
    [user, profile, loading, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
