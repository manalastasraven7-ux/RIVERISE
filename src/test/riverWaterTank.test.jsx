import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import RiverWaterTank, { RiverWater } from '../components/RiverWaterTank';
import { appConfig } from '../config/appConfig';
import { isRiverReadingStaleOrUnavailable } from '../pages/HomePage';

describe('RiverWaterTank', () => {
  it.each([
    ['NORMAL', 'rw-normal'],
    ['WATCH', 'rw-monitor'],
    ['WARNING', 'rw-warning'],
    ['CRITICAL', 'rw-critical'],
  ])('maps %s severity to the tank color class', (severity, className) => {
    const { container } = render(
      <RiverWaterTank level={2} severity={severity} isStale={false} />,
    );

    expect(container.querySelector('.rw-water')).toHaveClass(className);
    expect(container.querySelector('.rw-water')).toHaveStyle({ height: '50%' });
  });

  it('renders threshold labels and meter values from configured thresholds', () => {
    const { container } = render(
      <RiverWaterTank level={1} severity="NORMAL" isStale={false} />,
    );

    expect(container.querySelectorAll('.rw-line')).toHaveLength(3);
    expect(screen.getByText('WATCH 1.50 m')).toBeInTheDocument();
    expect(screen.getByText('WARNING 2.50 m')).toBeInTheDocument();
    expect(screen.getByText('CRITICAL 4.00 m')).toBeInTheDocument();
  });

  it('hides water and exposes a readable warning when stale', () => {
    const { container } = render(
      <RiverWaterTank level={2} severity="WATCH" isStale />,
    );

    expect(container.firstChild).toHaveClass('rw-stale');
    expect(container.querySelector('.rw-fail')).toHaveAttribute('aria-hidden', 'false');
    expect(screen.getByRole('alert')).toHaveTextContent('Reading may be stale.');
    expect(screen.getByRole('alert')).toHaveTextContent('Water level is hidden because current data may not be available.');
  });

  it('keeps water hidden when the reading is unavailable', () => {
    const { container } = render(
      <RiverWaterTank level={Number.NaN} severity="UNAVAILABLE" isStale />,
    );

    expect(container.querySelector('.rw-water')).toHaveStyle({ height: '0%' });
    expect(container.firstChild).toHaveClass('rw-stale');
    expect(screen.getByRole('alert')).toBeVisible();
  });

  it('treats an online sensor reading as stale when its timestamp exceeds the freshness window', () => {
    const now = Date.parse('2026-10-02T12:00:00.000Z');
    const reading = {
      water_level: 2,
      recorded_at: new Date(now - (appConfig.staleMinutes + 1) * 60000).toISOString(),
    };

    expect(isRiverReadingStaleOrUnavailable(reading, 'ONLINE', now)).toBe(true);
  });

  it('treats offline, missing, and invalid readings as unavailable', () => {
    const now = Date.parse('2026-10-02T12:00:00.000Z');
    const freshReading = { water_level: 2, recorded_at: new Date(now).toISOString() };

    expect(isRiverReadingStaleOrUnavailable(freshReading, 'OFFLINE', now)).toBe(true);
    expect(isRiverReadingStaleOrUnavailable(null, 'UNKNOWN', now)).toBe(true);
    expect(isRiverReadingStaleOrUnavailable({ water_level: 'invalid', recorded_at: new Date(now).toISOString() }, 'ONLINE', now)).toBe(true);
  });

  it('updates threshold lines and tank maximum through the module API', () => {
    const element = document.createElement('div');
    const water = document.createElement('div');
    const fail = document.createElement('div');
    water.className = 'rw-water';
    fail.className = 'rw-fail';
    element.append(water, fail);

    const tank = RiverWater.mount(element, {
      thresholds: [{ label: 'WATCH', value: 1 }],
      max: 4,
    });

    expect(element.querySelector('.rw-line')).toHaveStyle({ bottom: '25%' });

    tank.setThresholds([{ label: 'WARNING', value: 2 }], 8);
    tank.setLevel(2);

    expect(element.querySelectorAll('.rw-line')).toHaveLength(1);
    expect(element.querySelector('.rw-line')).toHaveTextContent('WARNING 2.00 m');
    expect(element.querySelector('.rw-line')).toHaveStyle({ bottom: '25%' });
    expect(water).toHaveStyle({ height: '25%' });

    tank.destroy();
    expect(element.querySelectorAll('.rw-line, .rw-dot')).toHaveLength(0);
    expect(element).not.toHaveClass('rw-tank');
  });

  it('updates water height and severity when the reading changes', () => {
    const { container, rerender } = render(
      <RiverWaterTank level={1} severity="NORMAL" isStale={false} />,
    );

    rerender(<RiverWaterTank level={3} severity="WARNING" isStale={false} />);

    expect(container.querySelector('.rw-water')).toHaveClass('rw-warning');
    expect(container.querySelector('.rw-water')).toHaveStyle({ height: '75%' });
  });
});