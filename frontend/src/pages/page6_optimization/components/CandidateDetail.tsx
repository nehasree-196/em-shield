import type { Candidate } from "../types";
import { formatThickness } from "../types"; // Import the helper
import { LayerStackView } from "./LayerStackView";

type Props = {
  candidate: Candidate;
  target: number;
  compact?: boolean;
};

export function CandidateDetail({ candidate, target, compact = false }: Props) {
  const c = candidate;
  return (
    <div className="opt-detail">
      <h4>Rank {c.rank} — {c.layer_count} layer{c.layer_count === 1 ? "" : "s"}</h4>

      <div style={{ marginBottom: compact ? 10 : 20, padding: compact ? 0 : "4px 0" }}>
        <LayerStackView layers={c.layers} />
      </div>

      {compact && (
        <div className="opt-detail-layers-inline">
          {c.layers.map((l) => (
            <span key={l.order} className="opt-detail-layer-chip">
              <strong>{l.material_name}</strong>
              <span>{formatThickness(l.thickness_m)}</span>
            </span>
          ))}
        </div>
      )}

      <div className="opt-detail-grid">
        <div>
          <span>Total thickness</span>
          <strong>{formatThickness(c.total_thickness_m)}</strong>
        </div>
        {c.areal_mass_kg_m2 !== null && (
          <div>
            <span>Areal mass</span>
            <strong>{c.areal_mass_kg_m2.toFixed(3)} kg/m²</strong>
          </div>
        )}
        <div>
          <span>Worst-case SE</span>
          <strong>{c.worst_case_se_db.toFixed(2)} dB</strong>
        </div>
        <div>
          <span>Margin over target</span>
          <strong>{c.margin_db.toFixed(2)} dB <span style={{ color: "var(--muted)", fontWeight: 400 }}>(target {target.toFixed(1)})</span></strong>
        </div>
        <div>
          <span>Worst frequency</span>
          <strong>{(c.worst_case_frequency_hz / 1e6).toFixed(3)} MHz</strong>
        </div>
        <div>
          <span>Worst angle</span>
          <strong>{c.worst_case_angle_deg.toFixed(1)}°</strong>
        </div>
        <div>
          <span>Worst polarization</span>
          <strong>{c.worst_case_polarization}</strong>
        </div>
      </div>

      {!compact && (
        <div style={{ marginTop: 20 }}>
          <span style={{ color: "var(--muted)", fontSize: "10px", fontWeight: 700, letterSpacing: "1.2px", textTransform: "uppercase" }}>
            Layer breakdown
          </span>
          <ol style={{ margin: "8px 0 0 0", paddingLeft: "20px", fontSize: "12px", color: "var(--deep-purple)", lineHeight: 1.6 }}>
            {c.layers.map((l) => (
              <li key={l.order}>
                <strong>{l.material_name}</strong> — {formatThickness(l.thickness_m)}
              </li>
            ))}
          </ol>
        </div>
      )}

      {c.warnings.length > 0 && (
        <>
          <h4 style={{ marginTop: compact ? 12 : 20 }}>Warnings</h4>
          <ul className="opt-warnings">
            {c.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}