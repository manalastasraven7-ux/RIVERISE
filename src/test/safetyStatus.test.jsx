import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SafetyStatusPage from '../pages/SafetyStatusPage';

const {
  mockSaveResidentSafetyStatus,
  mockSubmitSosRequest,
  mockGetResidentSafetyStatus,
  mockRefresh,
  mockSosRequests,
} = vi.hoisted(() => ({
  mockSaveResidentSafetyStatus: vi.fn(),
  mockSubmitSosRequest: vi.fn(),
  mockGetResidentSafetyStatus: vi.fn(),
  mockRefresh: vi.fn(),
  mockSosRequests: [],
}));

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, loading: false }),
}));

vi.mock('../services/DataContext', () => ({
  useData: () => ({ sosRequests: mockSosRequests, refresh: mockRefresh }),
}));

vi.mock('../services/supabaseClient', () => ({ supabase: null }));

vi.mock('../services/riverDataService', () => ({
  getResidentSafetyStatus: mockGetResidentSafetyStatus,
  saveResidentSafetyStatus: mockSaveResidentSafetyStatus,
  submitSosRequest: mockSubmitSosRequest,
}));

describe('SafetyStatusPage', () => {
  beforeEach(() => {
    mockSosRequests.length = 0;
    mockSaveResidentSafetyStatus.mockClear();
    mockSubmitSosRequest.mockClear();
    mockGetResidentSafetyStatus.mockClear();
    mockRefresh.mockClear();
    mockGetResidentSafetyStatus.mockResolvedValue({ data: null, error: null });
    mockSaveResidentSafetyStatus.mockResolvedValue({
      data: { status: 'SAFE', updated_at: '2026-09-23T12:00:00.000Z' },
      error: null,
    });
    mockSubmitSosRequest.mockResolvedValue({ data: { id: 'sos-1', status: 'PENDING' }, error: null });
    mockRefresh.mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: vi.fn((success) => success({ coords: { latitude: 10.1234, longitude: 124.5678 } })),
      },
    });
  });

  it('persists SAFE through the existing safety-status service', async () => {
    render(<SafetyStatusPage />);

    fireEvent.click(screen.getByRole('button', { name: 'I AM SAFE' }));

    await waitFor(() => expect(mockSaveResidentSafetyStatus).toHaveBeenCalledWith({
      status: 'SAFE',
      latitude: null,
      longitude: null,
      notes: null,
    }));
    expect(await screen.findByText('Your safety status has been updated to SAFE.')).toBeInTheDocument();
    expect(mockSubmitSosRequest).not.toHaveBeenCalled();
  });

  it('confirms SOS and submits the real coordinates after location sharing is accepted', async () => {
    vi.spyOn(window, 'confirm').mockReturnValueOnce(true).mockReturnValueOnce(true);
    render(<SafetyStatusPage />);

    fireEvent.click(screen.getByRole('button', { name: 'SOS / NEED HELP' }));

    await waitFor(() => expect(mockSubmitSosRequest).toHaveBeenCalledWith({
      latitude: 10.1234,
      longitude: 124.5678,
      note: null,
      locationShared: true,
    }));
    expect(await screen.findByText(/Emergency services have not been contacted automatically/i)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Status: SOS');
    expect(screen.getByRole('status')).toHaveTextContent('Time:');
  });

  it('does not create a community SOS when location sharing is declined without a place name', async () => {
    vi.spyOn(window, 'confirm').mockReturnValueOnce(true).mockReturnValueOnce(false);
    render(<SafetyStatusPage />);

    fireEvent.click(screen.getByRole('button', { name: 'SOS / NEED HELP' }));

    await waitFor(() => expect(screen.getByText(/Enter a place name or allow current location sharing/i)).toBeInTheDocument());
    expect(mockSubmitSosRequest).not.toHaveBeenCalled();
  });

  it('submits a manual place when the resident does not share GPS coordinates', async () => {
    vi.spyOn(window, 'confirm').mockReturnValueOnce(true).mockReturnValueOnce(false);
    render(<SafetyStatusPage />);
    fireEvent.change(screen.getByLabelText(/Place name or landmark/i), { target: { value: 'Purok 1, Barangay San Roque' } });

    fireEvent.click(screen.getByRole('button', { name: 'SOS / NEED HELP' }));

    await waitFor(() => expect(mockSubmitSosRequest).toHaveBeenCalledWith({
      latitude: undefined,
      longitude: undefined,
      note: 'Purok 1, Barangay San Roque',
      locationShared: false,
    }));
    expect(screen.getByRole('status')).toHaveTextContent('Location: Purok 1, Barangay San Roque');
  });

  it('keeps both actions interactive when an active SOS already exists', async () => {
    mockSosRequests.push({ user_id: 'user-1', status: 'PENDING' });
    render(<SafetyStatusPage />);

    const sosButton = screen.getByRole('button', { name: 'SOS ACTIVE' });
    expect(sosButton).toBeEnabled();
    expect(screen.getByRole('button', { name: 'I AM SAFE' })).toBeEnabled();

    fireEvent.click(sosButton);

    expect(await screen.findByText(/Your help request is currently active \(PENDING\)/i)).toBeInTheDocument();
    expect(mockSubmitSosRequest).not.toHaveBeenCalled();
  });
});
