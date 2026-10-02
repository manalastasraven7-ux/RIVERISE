import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import LoginPage from '../pages/LoginPage';

const { mockSignIn } = vi.hoisted(() => ({ mockSignIn: vi.fn() }));

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ user: null, loading: false, error: null, signIn: mockSignIn }),
}));

describe('LoginPage', () => {
  it('trims email whitespace, preserves the password, and maps invalid credentials', async () => {
    mockSignIn.mockResolvedValue({ error: { code: 'invalid_credentials', message: 'Invalid login credentials' } });
    render(<MemoryRouter><LoginPage /></MemoryRouter>);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: '  resident@example.com  ' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: '  exact password  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(mockSignIn).toHaveBeenCalledWith({
      email: 'resident@example.com',
      password: '  exact password  ',
    }));
    expect(await screen.findByText('Invalid email or password. Please check your credentials and try again.')).toBeInTheDocument();
  });
});
