import { useState } from "react";
import { filterRun } from "../api";
import type { Candidate, Material } from "../types";

type Props = {
  runId: string;
  availableMaterials: Material[];
  onFiltered: (candidates: Candidate[]) => void;
};

export function FilterPanel({ runId, availableMaterials, onFiltered }: Props) {
  const [include, setInclude] = useState<string[]>([]);
  const [exclude, setExclude] = useState<string[]>([]);
  const [maxLayers, setMaxLayers] = useState<string>("");
  const [minMargin, setMinMargin] = useState<string>("");
  const [sortBy, setSortBy] = useState<"objective" | "thickness" | "mass" | "margin" | "layers">("objective");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply() {
    setBusy(true);
    setError(null);
    try {
      const res = await filterRun({
        run_id: runId,
        include_ids: include,
        exclude_ids: exclude,
        max_layers: maxLayers ? +maxLayers : undefined,
        min_margin_db: minMargin ? +minMargin : undefined,
        sort_by: sortBy,
        only_validated: true,
        top_k: 2000, // Request all 2000 from backend
      });
      onFiltered(res.candidates);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  const toggleInclude = (id: string) => {
    setInclude((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      setExclude((e) => e.filter((x) => !next.includes(x))); 
      return next;
    });
  };

  const toggleExclude = (id: string) => {
    setExclude((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      setInclude((i) => i.filter((x) => !next.includes(x))); 
      return next;
    });
  };

  return (
    <div className="opt-form-group" style={{ marginTop: 15 }}>
      <div className="opt-field">
        <span>Include (must contain ALL)</span>
        <div className="filter-checkbox-list">
          {availableMaterials.map((m) => (
            <label key={`inc-${m.id}`} className="filter-checkbox-label is-include">
              <input type="checkbox" checked={include.includes(m.id)} onChange={() => toggleInclude(m.id)} />
              <span>{m.name ?? m.id}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="opt-field">
        <span>Exclude (must contain NONE)</span>
        <div className="filter-checkbox-list">
          {availableMaterials.map((m) => (
            <label key={`exc-${m.id}`} className="filter-checkbox-label is-exclude">
              <input type="checkbox" checked={exclude.includes(m.id)} onChange={() => toggleExclude(m.id)} />
              <span>{m.name ?? m.id}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="opt-row">
        <label className="opt-field">
          <span>Max layers</span>
          <input type="number" min={1} value={maxLayers} onChange={(e) => setMaxLayers(e.target.value)} />
        </label>
        <label className="opt-field">
          <span>Min margin (dB)</span>
          <input type="number" min={0} value={minMargin} onChange={(e) => setMinMargin(e.target.value)} />
        </label>
      </div>

      <label className="opt-field">
        <span>Sort by</span>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
          <option value="objective">Objective</option>
          <option value="thickness">Thickness</option>
          <option value="mass">Mass</option>
          <option value="margin">Margin</option>
          <option value="layers">Layer count</option>
        </select>
      </label>

      <button type="button" className="secondary-button" onClick={apply} disabled={busy} style={{ marginTop: 10, width: "100%" }}>
        {busy ? "Filtering…" : "Apply filter"}
      </button>

      {error && <div className="opt-error" style={{ marginTop: 10 }}>{error}</div>}
    </div>
  );
}