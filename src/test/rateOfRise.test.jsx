import { describe, expect, it } from 'vitest';
import { getCurrentRateOfRise, getEstimatedTimeToThreshold } from '../pages/HomePage';
import { getWaterLevelPredictions } from '../config/riverMetrics';

const tiedReadings = [
  { id: 'a', station_id: 'station-a', water_level: 1, recorded_at: '2026-09-29T10:00:00.000Z' },
  { id: 'z', station_id: 'station-a', water_level: 2, recorded_at: '2026-09-29T10:00:00.000Z' },
  { id: 'b', station_id: 'station-a', water_level: 4, recorded_at: '2026-09-29T11:00:00.000Z' },
  { id: 'c', station_id: 'station-a', water_level: 7, recorded_at: '2026-09-29T11:00:00.000Z' },
  { id: 'd', station_id: 'station-b', water_level: 100, recorded_at: '2026-09-29T12:00:00.000Z' },
];

describe('dashboard rate of rise', () => {
  it('uses deterministic ID ordering for timestamp ties and only compares the selected station', () => {
    const expected = { value: '+0.083 m/min', direction: 'rising', rateMPerMinute: 5 / 60 };

    expect(getCurrentRateOfRise(tiedReadings, 'station-a')).toEqual(expected);
    expect(getCurrentRateOfRise([...tiedReadings].reverse(), 'station-a')).toEqual(expected);
  });

  it('returns not enough data when readings have no strictly earlier timestamp', () => {
    expect(getCurrentRateOfRise(tiedReadings.slice(0, 2), 'station-a')).toEqual({
      value: 'Not enough data',
      direction: 'unknown',
      rateMPerMinute: null,
    });
  });

  it('returns not enough data when there is only one valid reading', () => {
    expect(getCurrentRateOfRise([tiedReadings[0]], 'station-a')).toEqual({
      value: 'Not enough data',
      direction: 'unknown',
      rateMPerMinute: null,
    });
  });

  it('does not present a historical rate or threshold estimate as current when the sensor is stale', () => {
    const rate = getCurrentRateOfRise(tiedReadings, 'station-a', true);

    expect(rate).toEqual({ value: 'Not available', direction: 'unknown', rateMPerMinute: null });
    expect(getEstimatedTimeToThreshold(2.45, rate.rateMPerMinute)).toBe('Estimate unavailable');
  });

  it('estimates time to the next threshold using the existing rate', () => {
    expect(getEstimatedTimeToThreshold(1, 0.5 / 90)).toBe('Estimated time to WATCH: 1h 30m');
  });

  it('targets the next threshold when the level is already at a threshold', () => {
    expect(getEstimatedTimeToThreshold(1.5, 0.1)).toBe('Estimated time to WARNING: 10m');
    expect(getEstimatedTimeToThreshold(2.5, 0.1)).toBe('Estimated time to CRITICAL: 15m');
  });

  it('returns unavailable for non-rising rates or when there is no higher threshold', () => {
    expect(getEstimatedTimeToThreshold(1, 0)).toBe('Estimate unavailable');
    expect(getEstimatedTimeToThreshold(1, -0.1)).toBe('Estimate unavailable');
    expect(getEstimatedTimeToThreshold(1, null)).toBe('Estimate unavailable');
    expect(getEstimatedTimeToThreshold(4, 0.1)).toBe('Estimate unavailable');
  });

  it('labels linear estimates and identifies projected threshold crossings', () => {
    const prediction = getWaterLevelPredictions(2.45, 0.001, 'WATCH');

    expect(prediction.trend).toBe('rising');
    expect(prediction.estimates[0]).toMatchObject({ hours: 1, risk: 'WARNING', crossesThreshold: true });
    expect(prediction.estimates[0].waterLevel).toBeCloseTo(2.51);
    expect(prediction.estimates[2]).toMatchObject({ hours: 3, risk: 'WARNING', crossesThreshold: true });
    expect(prediction.estimates[2].waterLevel).toBeCloseTo(2.63);
  });

  it('returns falling estimates and no prediction without a finite rate', () => {
    expect(getWaterLevelPredictions(2.6, -0.001, 'WARNING').trend).toBe('falling');
    expect(getWaterLevelPredictions(2.6, null, 'WARNING')).toBeNull();
  });
});