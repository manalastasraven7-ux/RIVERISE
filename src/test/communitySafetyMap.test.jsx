import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import CommunitySafetyMapPage from '../pages/CommunitySafetyMapPage';

vi.mock('react-leaflet', () => ({
  CircleMarker: ({ children }) => <div>{children}</div>,
  MapContainer: ({ children }) => <div data-testid="map">{children}</div>,
  Popup: ({ children }) => <div>{children}</div>,
  TileLayer: () => null,
  useMap: () => ({ setView: vi.fn() }),
}));

const mockGeolocation = (implementation) => {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: implementation,
  });
};

vi.mock('../services/DataContext', () => ({
  useData: () => ({
    emergencyContacts: [],
    sensors: [],
    latestReading: null,
    loading: false,
    error: null,
  }),
}));

vi.mock('../services/CommunitySosContext', () => ({
  useCommunitySos: () => {
    const [viewerLocation, setViewerLocation] = useState(null);
    const [locationError, setLocationError] = useState(null);
    const [locationPermissionState, setLocationPermissionState] = useState('Not requested');

    const requestViewerLocation = () => {
      if (!navigator.geolocation) {
        setLocationPermissionState('Unsupported');
        setLocationError('Location services are not supported by this browser.');
        return;
      }
      setLocationPermissionState('Requesting');
      navigator.geolocation?.getCurrentPosition(
        (position) => {
          setViewerLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
          setLocationPermissionState('Granted');
        },
        (error) => {
          setLocationPermissionState('Error');
          setLocationError(error.code === 1
            ? 'Location permission was denied. Please allow location access and try again.'
            : error.code === 3
              ? 'Location request timed out. Try again.'
              : 'Your current location could not be determined.');
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
      );
    };

    return {
      viewerLocation,
      locationPermissionState,
      locationError,
      nearbySos: [],
      rpcError: null,
      requestViewerLocation,
    };
  },
}));

describe('CommunitySafetyMapPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete navigator.geolocation;
  });

  it('shows the current-location prompt before permission is granted', () => {
    render(<CommunitySafetyMapPage />);

    expect(screen.getByText(/Location permission is required to receive nearby SOS alerts/i)).toBeInTheDocument();
    expect(screen.queryByText(/Nearby Safety Locations/i)).not.toBeInTheDocument();
  });

  it('requests the real device location only after the user clicks the location button', () => {
    const getCurrentPosition = vi.fn();
    mockGeolocation({ getCurrentPosition });
    render(<CommunitySafetyMapPage />);

    expect(getCurrentPosition).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /use my current location/i }));
    expect(getCurrentPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      expect.objectContaining({ enableHighAccuracy: true, maximumAge: 0 }),
    );
  });

  it('shows coordinates as secondary details and allows a readable place label', () => {
    const getCurrentPosition = vi.fn((success) => success({ coords: { latitude: 10.1234, longitude: 124.5678 } }));
    mockGeolocation({ getCurrentPosition });
    render(<CommunitySafetyMapPage />);

    fireEvent.click(screen.getByRole('button', { name: /use my current location/i }));

    expect(screen.getByText(/Coordinates: 10\.1234, 124\.5678/i)).toBeInTheDocument();
    expect(screen.getByText('You are here')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Place name or landmark/i), { target: { value: 'Purok 1, Barangay San Roque' } });
    expect(screen.getByText('Purok 1, Barangay San Roque')).toBeInTheDocument();
  });

  it.each([
    [1, /Location permission was denied/i],
    [2, /current location could not be determined/i],
    [3, /Location request timed out/i],
  ])('shows the correct message for geolocation error code %s', (code, message) => {
    const getCurrentPosition = vi.fn((_success, failure) => failure({ code }));
    mockGeolocation({ getCurrentPosition });
    render(<CommunitySafetyMapPage />);

    fireEvent.click(screen.getByRole('button', { name: /use my current location/i }));

    expect(screen.getAllByText(message).length).toBeGreaterThan(0);
  });

  it('handles a browser without geolocation support', () => {
    render(<CommunitySafetyMapPage />);

    fireEvent.click(screen.getByRole('button', { name: /use my current location/i }));

    expect(screen.getAllByText(/Location services are not supported by this browser/i).length).toBeGreaterThan(0);
  });
});
