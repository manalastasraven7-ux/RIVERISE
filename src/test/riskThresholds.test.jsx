import { describe, it, expect } from 'vitest';
import { getRiskLevel } from '../config/appConfig';

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
});
