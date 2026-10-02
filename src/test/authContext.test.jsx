import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '../auth/AuthContext';

const { mockGetSession, mockOnAuthStateChange, mockUnsubscribe, authCallbacks } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockOnAuthStateChange: vi.fn(),
  mockUnsubscribe: vi.fn(),
  authCallbacks: [],
}));

vi.mock('../services/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
    },
  },
}));

function AuthProbe() {
  const { user, loading, error } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="user">{user?.id || 'signed-out'}</span>
      <span data-testid="error">{error || 'none'}</span>
    </div>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockOnAuthStateChange.mockReset();
    mockUnsubscribe.mockReset();
    authCallbacks.length = 0;
    mockOnAuthStateChange.mockImplementation((callback) => {
      authCallbacks.push(callback);
      return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
    });
  });

  it('resolves to signed-out when Supabase has no session', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    render(<AuthProvider><AuthProbe /></AuthProvider>);

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('user')).toHaveTextContent('signed-out');
    expect(screen.getByTestId('error')).toHaveTextContent('none');
  });

  it('resolves to an auth error when session verification rejects', async () => {
    mockGetSession.mockRejectedValue(new Error('Network unavailable'));
    render(<AuthProvider><AuthProbe /></AuthProvider>);

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('user')).toHaveTextContent('signed-out');
    expect(screen.getByTestId('error')).toHaveTextContent('Network unavailable');
  });

  it('updates the shared user when Supabase emits a signed-in session', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    render(<AuthProvider><AuthProbe /></AuthProvider>);

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    await act(async () => {
      authCallbacks[0]('SIGNED_IN', { user: { id: 'signed-in-user' } });
    });

    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('signed-in-user'));
  });
});
