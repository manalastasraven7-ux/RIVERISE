import { beforeEach, describe, expect, it, vi } from 'vitest';
import { submitSosRequest } from '../services/riverDataService';

const { mockGetUser, mockRpc } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockRpc: vi.fn(),
}));

vi.mock('../services/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: { getUser: mockGetUser },
    rpc: mockRpc,
  },
  getSupabaseErrorMessage: vi.fn(),
}));

describe('submitSosRequest', () => {
  beforeEach(() => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'resident-1' } } });
    mockRpc.mockReset();
    mockRpc.mockResolvedValue({ data: { id: 'sos-1', status: 'PENDING' }, error: null });
  });

  it('submits a manually entered location without sharing coordinates', async () => {
    const result = await submitSosRequest({
      latitude: null,
      longitude: null,
      note: 'Purok 1, Barangay San Roque',
      locationShared: false,
    });

    expect(result.error).toBeNull();
    expect(mockRpc).toHaveBeenCalledWith('submit_own_sos', expect.objectContaining({
      sos_latitude: null,
      sos_longitude: null,
      sos_note: 'Purok 1, Barangay San Roque',
    }));
  });

  it('rejects missing GPS coordinates when GPS sharing was selected', async () => {
    const result = await submitSosRequest({ latitude: null, longitude: null, note: null, locationShared: true });

    expect(result.error?.message).toMatch(/enter a place name/i);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});