import { useEffect, useRef } from 'react';
import { appConfig } from '../config/appConfig';

const thresholdLines = Object.entries(appConfig.statusThresholds)
  .filter(([severity, threshold]) => severity !== 'NORMAL' && Number.isFinite(threshold.min))
  .map(([label, threshold]) => ({ label, value: threshold.min }));

const tankMaximum = Math.max(...thresholdLines.map((threshold) => threshold.value));
const wavePath = 'M0 9 Q150 0 300 9 T600 9 T900 9 T1200 9 V18 H0Z';

export const RiverWater = {
  mount(element, options = {}) {
    if (!element) return null;

    const water = element.querySelector('.rw-water');
    const fail = element.querySelector('.rw-fail');
    if (!water || !fail) return null;

    let maximum = Number(options.max) > 0 ? Number(options.max) : tankMaximum;
    let thresholds = Array.isArray(options.thresholds) ? options.thresholds : [];
    const dots = [];
    let lines = [];

    const percentage = (value) => Math.max(0, Math.min(100, (value / maximum) * 100));

    const drawLines = () => {
      lines.forEach((line) => line.remove());
      lines = [];

      thresholds.forEach((threshold) => {
        const value = Number(threshold.value);
        if (!Number.isFinite(value)) return;

        const line = element.ownerDocument.createElement('div');
        const label = String(threshold.label || 'Threshold');
        const lineClass = label.toLowerCase().replace(/[^a-z0-9-]/g, '-');
        line.className = `rw-line rw-line--${lineClass}`;
        line.style.bottom = `${percentage(value)}%`;
        line.setAttribute('aria-label', `${label}: ${value.toFixed(2)} meters`);

        const lineLabel = element.ownerDocument.createElement('span');
        lineLabel.textContent = `${label} ${value.toFixed(2)} m`;
        line.appendChild(lineLabel);
        element.appendChild(line);
        lines.push(line);
      });
    };

    element.classList.add('rw-tank');

    for (let index = 0; index < 8; index += 1) {
      const dot = element.ownerDocument.createElement('i');
      dot.className = 'rw-dot';
      dot.setAttribute('aria-hidden', 'true');
      dot.style.left = `${8 + index * 12}%`;
      dot.style.animationDelay = `${-index * 0.3}s`;
      water.appendChild(dot);
      dots.push(dot);
    }

    drawLines();

    return {
      setLevel(value) {
        const level = Number(value);
        water.style.height = Number.isFinite(level) ? `${percentage(level)}%` : '0%';
      },

      setSeverity(severity) {
        water.classList.remove('rw-normal', 'rw-monitor', 'rw-warning', 'rw-critical');
        const classBySeverity = {
          NORMAL: 'rw-normal',
          WATCH: 'rw-monitor',
          MONITOR: 'rw-monitor',
          WARNING: 'rw-warning',
          CRITICAL: 'rw-critical',
        };
        const severityClass = classBySeverity[String(severity || '').toUpperCase()];
        if (severityClass) water.classList.add(severityClass);
      },

      setStale(isStale) {
        const stale = Boolean(isStale);
        element.classList.toggle('rw-stale', stale);
        fail.setAttribute('aria-hidden', String(!stale));
      },

      setThresholds(nextThresholds, nextMaximum) {
        thresholds = Array.isArray(nextThresholds) ? nextThresholds : [];
        if (Number.isFinite(Number(nextMaximum)) && Number(nextMaximum) > 0) {
          maximum = Number(nextMaximum);
        }
        drawLines();
      },

      destroy() {
        lines.forEach((line) => line.remove());
        dots.forEach((dot) => dot.remove());
        water.classList.remove('rw-normal', 'rw-monitor', 'rw-warning', 'rw-critical');
        water.style.removeProperty('height');
        element.classList.remove('rw-tank', 'rw-stale');
        fail.setAttribute('aria-hidden', 'true');
      },
    };
  },
};

export default function RiverWaterTank({ level, severity, isStale }) {
  const tankRef = useRef(null);
  const tankApiRef = useRef(null);

  useEffect(() => {
    tankApiRef.current = RiverWater.mount(tankRef.current, {
      thresholds: thresholdLines,
      max: tankMaximum,
    });

    return () => {
      tankApiRef.current?.destroy();
      tankApiRef.current = null;
    };
  }, []);

  useEffect(() => {
    tankApiRef.current?.setLevel(level);
  }, [level]);

  useEffect(() => {
    tankApiRef.current?.setSeverity(severity);
  }, [severity]);

  useEffect(() => {
    tankApiRef.current?.setStale(isStale);
  }, [isStale]);

  useEffect(() => {
    tankApiRef.current?.setThresholds(thresholdLines, tankMaximum);
  }, []);

  return (
    <div className="rw-tank" ref={tankRef} role="group" aria-label="River water level tank">
      <div className="rw-water" aria-hidden="true">
        <svg className="rw-wave rw-back" viewBox="0 0 1200 18" preserveAspectRatio="none" aria-hidden="true">
          <path d={wavePath} />
        </svg>
        <svg className="rw-wave" viewBox="0 0 1200 18" preserveAspectRatio="none" aria-hidden="true">
          <path d={wavePath} />
        </svg>
      </div>
      <div className="rw-fail" role="alert" aria-live="assertive" aria-hidden="true">
        <strong>Reading may be stale.</strong>
        <span>Water level is hidden because current data may not be available.</span>
      </div>
    </div>
  );
}