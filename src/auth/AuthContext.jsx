import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';

const AuthContext = createContext({
  user: null,
  profile: null,
  loading: true,
  error: null,
  profileError: null,
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
  const [profileError, setProfileError] = useState(null);
  const [retryAttempt, setRetryAttempt] = useState(0);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      setError('Supabase authentication is not configured.');
      return;
    }

    let isMounted = true;
    let profileRequestId = 0;
    let authEventVersion = 0;
    let currentUserId = null;
    let loadedProfileFor = null;

    const loadProfile = async (authUser) => {
      const requestId = ++profileRequestId;

      if (!authUser) {
        loadedProfileFor = null;
        setProfile(null);
        setProfileError(null);
        setLoading(false);
        return;
      }

      try {
        const { data, error: profileLoadError } = await supabase
          .from('profiles')
          .select('id, email, full_name, role, phone')
          .eq('id', authUser.id)
          .maybeSingle();

        if (!isMounted || requestId !== profileRequestId) return;
        loadedProfileFor = authUser.id;
        setProfile(data || null);
        setProfileError(profileLoadError?.message || null);
      } catch (profileLoadError) {
        if (!isMounted || requestId !== profileRequestId) return;
        loadedProfileFor = authUser.id;
        setProfile(null);
        setProfileError(profileLoadError.message || 'Unable to load your account profile.');
      } finally {
        if (isMounted && requestId === profileRequestId) setLoading(false);
      }
    };

    const applyUser = (authUser) => {
      const nextUserId = authUser?.id || null;
      const isSameUser = nextUserId && nextUserId === currentUserId;
      currentUserId = nextUserId;
      setUser(authUser || null);
      setError(null);

      if (!nextUserId) {
        void loadProfile(null);
        return;
      }

      if (isSameUser && loadedProfileFor === nextUserId) {
        setLoading(false);
        return;
      }

      setProfile(null);
      setProfileError(null);
      setLoading(true);
      void loadProfile(authUser);
    };

    const initializeAuth = async () => {
      const startupVersion = authEventVersion;
      try {
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (!isMounted || startupVersion !== authEventVersion) return;

        if (sessionError) {
          setUser(null);
          setProfile(null);
          setError(sessionError.message || 'Unable to verify your sign-in status.');
        } else {
          applyUser(data.session?.user ?? null);
        }
      } catch (authError) {
        if (!isMounted || startupVersion !== authEventVersion) return;
        setUser(null);
        setProfile(null);
        setError(authError.message || 'Unable to verify your sign-in status.');
      } finally {
        if (isMounted && startupVersion === authEventVersion && !currentUserId) setLoading(false);
      }
    };

    initializeAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      authEventVersion += 1;
      applyUser(session?.user ?? null);
    });

    return () => {
      isMounted = false;
      profileRequestId += 1;
      authListener.subscription.unsubscribe();
    };
  }, [retryAttempt]);

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      error,
      profileError,
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
    [user, profile, loading, error, profileError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
