// ResultCards.jsx — the R / T / A / SE (and optional skin depth) cards shared by pages 3 and 4.
import { formatLength, formatPercent, formatSE } from '../utils/units';

export default function ResultCards({ result, showSkinDepth = false }) {
  const items = [
    ['Shielding effectiveness', formatSE(result.shielding_effectiveness_db)],
    ['Reflection (R)', formatPercent(result.reflection_power)],
    ['Transmission (T)', formatPercent(result.transmission_power)],
    ['Absorption (A)', formatPercent(result.absorption_power)],
  ];
  if (showSkinDepth) items.push(['Skin depth (δ)', formatLength(result.skin_depth_m)]);
  return (
    <div className="em-cards">
      {items.map(([label, value]) => (
        <div className="em-card" key={label}>
          <span className="em-card-label">{label}</span>
          <strong className="em-card-value">{value}</strong>
        </div>
      ))}
    </div>
  );
}
