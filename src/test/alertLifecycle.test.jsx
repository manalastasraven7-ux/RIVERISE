import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAlertStatus, isAlertExpired } from '../config/alertStatus';
import AlertsPage from '../pages/AlertsPage';

const testState = vi.hoisted(() => ({ alerts: [], now: Date.now() }));

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ isResponder: false }),
}));

vi.mock('../services/DataContext', () => ({
  useData: () => ({ alerts: testState.alerts, loading: false, error: null, demoMode: false, now: testState.now }),
}));

describe('alert expiry lifecycle', () => {
  beforeEach(() => {
    testState.alerts = [];
    testState.now = Date.now();
  });

  it('derives EXPIRED without changing the stored alert status', () => {
    const now = Date.parse('2026-10-02T12:00:00.000Z');
    const alert = {
      status: 'ACTIVE',
      is_active: true,
      expires_at: '2026-10-02T11:59:59.000Z',
    };

    expect(getAlertStatus(alert, now)).toBe('EXPIRED');
    expect(isAlertExpired(alert, now)).toBe(true);
    expect(alert.status).toBe('ACTIVE');
    expect(alert.is_active).toBe(true);
  });

  it('preserves stored statuses for alerts that have not expired', () => {
    const now = Date.parse('2026-10-02T12:00:00.000Z');

    expect(getAlertStatus({ status: 'ACTIVE', expires_at: '2026-10-02T12:00:01.000Z' }, now)).toBe('ACTIVE');
    expect(getAlertStatus({ status: 'ACKNOWLEDGED' }, now)).toBe('ACKNOWLEDGED');
    expect(getAlertStatus({ status: 'RESOLVED' }, now)).toBe('RESOLVED');
    expect(isAlertExpired({ expires_at: 'not-a-date' }, now)).toBe(false);
  });

  it('displays and filters an expired alert as EXPIRED', () => {
    const expiredAlert = {
      id: 'expired-alert',
      title: 'Expired flood alert',
      message: 'This alert has passed its expiry time.',
      severity: 'CRITICAL',
      status: 'ACTIVE',
      is_active: true,
      created_at: '2026-10-02T10:00:00.000Z',
      expires_at: new Date(Date.now() - 1000).toISOString(),
    };
    const activeAlert = {
      ...expiredAlert,
      id: 'active-alert',
      title: 'Current flood alert',
      expires_at: new Date(Date.now() + 60000).toISOString(),
    };
    testState.alerts = [expiredAlert, activeAlert];

    render(<MemoryRouter><AlertsPage /></MemoryRouter>);

    expect(screen.getByText('Expired flood alert').parentElement.parentElement).toHaveTextContent('EXPIRED');
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'EXPIRED' } });
    expect(screen.getByText('Expired flood alert')).toBeInTheDocument();
    expect(screen.queryByText('Current flood alert')).not.toBeInTheDocument();
  });

  it('removes an alert from the ACTIVE filter when it expires while the page is open', () => {
    const expiryTime = Date.now() + 60000;
    testState.now = expiryTime - 1000;
    testState.alerts = [{
      id: 'soon-expired',
      title: 'Alert expiring soon',
      message: 'This alert changes status when its expiry passes.',
      severity: 'WARNING',
      status: 'ACTIVE',
      is_active: true,
      created_at: new Date(Date.now() - 60000).toISOString(),
      expires_at: new Date(expiryTime).toISOString(),
    }];

    const { rerender } = render(<MemoryRouter><AlertsPage /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'ACTIVE' } });
    expect(screen.getByText('Alert expiring soon')).toBeInTheDocument();

    testState.now = expiryTime + 1;
    rerender(<MemoryRouter><AlertsPage /></MemoryRouter>);

    expect(screen.queryByText('Alert expiring soon')).not.toBeInTheDocument();
  });
});