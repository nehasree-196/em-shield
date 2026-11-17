import type { Candidate } from "../types";
import { formatThickness } from "../types"; // Import the helper
import { LayerStackView } from "./LayerStackView";

type Props = {
  candidates: Candidate[];
  selectedRank: number | null;
  onSelect: (rank: number) => void;
  objective: "thickness" | "mass";
};

export function CandidateTable({
  candidates,
  selectedRank,
  onSelect,
  objective,
}: Props) {
  if (candidates.length === 0) {
    return <p className="opt-hint" style={{ padding: "20px" }}>No candidates to display.</p>;
  }

  return (
    <table className="opt-table">
      <thead>
        <tr>
          <th style={{ width: "40px", textAlign: "center" }}>#</th>
          <th>Stack</th>
          <th style={{ width: "60px", textAlign: "center" }}>Layers</th>
          <th style={{ width: "90px" }}>
            {objective === "mass" ? "kg/m²" : "Thickness"}
          </th>
          <th style={{ width: "100px" }}>Worst SE dB</th>
          <th style={{ width: "80px" }}>Margin</th>
        </tr>
      </thead>
      <tbody>
        {candidates.map((c) => {
          const selected = c.rank === selectedRank;
          return (
            <tr
              key={c.rank}
              className={selected ? "is-selected" : ""}
              onClick={() => onSelect(c.rank)}
            >
              <td style={{ textAlign: "center" }}>{c.rank}</td>
              <td>
                <LayerStackView layers={c.layers} />
              </td>
              <td style={{ textAlign: "center" }}>{c.layer_count}</td>
              <td>
                {objective === "mass" && c.areal_mass_kg_m2 !== null
                  ? c.areal_mass_kg_m2.toFixed(3)
                  : formatThickness(c.total_thickness_m)}
              </td>
              <td>{c.worst_case_se_db.toFixed(2)}</td>
              <td>{c.margin_db.toFixed(2)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}