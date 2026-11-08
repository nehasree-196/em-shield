// units.js — unit tables and display formatting; the backend only ever receives SI units.
export const FREQ_UNITS = { Hz: 1, kHz: 1e3, MHz: 1e6, GHz: 1e9 };
export const THICKNESS_UNITS = { 'µm': 1e-6, mm: 1e-3, cm: 1e-2, m: 1 };

// convert a typed value + chosen unit into SI
export const toSI = (value, unit, table) => Number(value) * table[unit];

// show very large shielding values as a capped number (real shields are limited by seams/apertures, not modelled here)
export function formatSE(se) {
  if (se === null || se === undefined) return '—';
  return se > 300 ? '> 300 dB' : `${se.toFixed(2)} dB`;
}

export function formatPercent(fraction) {
  if (fraction === null || fraction === undefined) return '—';
  const p = fraction * 100;
  return p !== 0 && p < 0.001 ? `${p.toExponential(2)} %` : `${p.toFixed(3)} %`;
}

export function formatLength(m) {
  if (m === null || m === undefined) return '∞ (lossless)';
  if (m >= 1) return `${m.toFixed(3)} m`;
  if (m >= 1e-3) return `${(m * 1e3).toFixed(3)} mm`;
  return `${(m * 1e6).toFixed(3)} µm`;
}

export function formatFrequency(hz) {
  if (hz >= 1e9) return `${(hz / 1e9).toPrecision(4)} GHz`;
  if (hz >= 1e6) return `${(hz / 1e6).toPrecision(4)} MHz`;
  if (hz >= 1e3) return `${(hz / 1e3).toPrecision(4)} kHz`;
  return `${hz.toPrecision(4)} Hz`;
}
