import { describe, it, expect } from 'vitest';
import { getRiskLevel, getSensorStatus } from '../config/appConfig';

describe('river risk thresholds', () => {
  it('uses the configured watch, warning, and critical boundaries without overlap', () => {
    expect(getRiskLevel(1.49)).toBe('NORMAL');
    expect(getRiskLevel(1.5)).toBe('WATCH');
    expect(getRiskLevel(2.49)).toBe('WATCH');
    expect(getRiskLevel(2.5)).toBe('WARNING');
    expect(getRiskLevel(3.99)).toBe('WARNING');
    expect(getRiskLevel(4)).toBe('CRITICAL');
    expect(getRiskLevel(5)).toBe('CRITICAL');
  });

  it('marks old readings stale and preserves offline or unknown sensor states', () => {
    const now = Date.parse('2026-10-02T12:15:00.000Z');
    const recent = { recorded_at: '2026-10-02T12:01:00.000Z', sensor_status: 'ONLINE' };

    expect(getSensorStatus(recent, 15, now)).toBe('ONLINE');
    expect(getSensorStatus({ ...recent, recorded_at: '2026-10-02T11:59:00.000Z' }, 15, now)).toBe('STALE');
    expect(getSensorStatus({ ...recent, sensor_status: 'OFFLINE' }, 15, now)).toBe('OFFLINE');
    expect(getSensorStatus({ ...recent, recorded_at: 'invalid' }, 15, now)).toBe('UNKNOWN');
  });
});
