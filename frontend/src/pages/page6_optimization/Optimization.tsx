import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PlayCircle } from "lucide-react";

import { fetchMaterials, runOptimization } from "./api";
import type { Material, OptimizationRequest, RunResult } from "./types";
import { MaterialPicker } from "./components/MaterialPicker";
import { ConditionsForm } from "./components/ConditionsForm";
import { CandidateTable } from "./components/CandidateTable";
import { CandidateDetail } from "./components/CandidateDetail";
import { FilterPanel } from "./components/FilterPanel";

const DEFAULTS: OptimizationRequest = {
  materials: [],
  target_se_db: 40,
  frequency_min_hz: 1e6,
  frequency_max_hz: 1e9,
  max_incidence_angle_deg: 0,
  max_layers: 3,
  objective: "thickness",
  must_include_ids: [],
  top_k: 10,
  effort: "normal",
  safety_margin_db: 1.0,
};

export default function Optimization() {
  const [library, setLibrary] = useState<Material[]>([]);
  const [req, setReq] = useState<OptimizationRequest>(DEFAULTS);
  const [result, setResult] = useState<RunResult | null>(null);
  const [selectedRank, setSelectedRank] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [showAllCandidates, setShowAllCandidates] = useState(false);

  useEffect(() => {
    fetchMaterials().then(setLibrary).catch((e) => setError(String(e)));
  }, []);

  const selected = useMemo(
    () => result?.candidates.find((c) => c.rank === selectedRank) ?? null,
    [result, selectedRank]
  );

  const run = useCallback(async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    setSelectedRank(null);
    setShowAllCandidates(false);
    
    setElapsed(0);
    const start = Date.now();
    timerRef.current = setInterval(() => setElapsed((Date.now() - start) / 1000), 100);

    try {
      const r = await runOptimization(req);
      setResult(r);
      setSelectedRank(r.candidates[0]?.rank ?? null);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [req]);

  const displayedCandidates = useMemo(() => {
    if (!result) return [];
    if (showAllCandidates) return result.candidates;
    return result.candidates.slice(0, req.top_k);
  }, [result, showAllCandidates, req.top_k]);

  return (
    <div className="dashboard">
      <header className="dashboard-heading">
        <div>
          <p className="eyebrow">PAGE 6</p>
          <h2>Material Optimization</h2>
          <p>
            Find the thinnest (or lightest) multilayer stack that reaches a target
            shielding effectiveness across a frequency band, incidence angles and
            both TE and TM polarizations.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px" }}>
          <button
            className="primary-button"
            disabled={busy || req.materials.length === 0}
            onClick={run}
            style={{ minWidth: "160px" }}
          >
            <PlayCircle size={18} />
            {busy ? "Searching..." : "Run optimization"}
          </button>
          
          {busy && (
            <div className="opt-timer">
              {elapsed.toFixed(1)}s
            </div>
          )}
        </div>
      </header>

      {error && <div className="opt-banner is-error">{error}</div>}

      <div style={{ maxWidth: "1300px", margin: "0 auto", width: "100%" }}>
        <div className="opt-layout">
          
          <aside className="opt-panel">
            <div className="section-heading">
              <h3>Materials</h3>
            </div>
            <MaterialPicker
              library={library}
              selected={req.materials}
              onChange={(materials) => setReq({ ...req, materials })}
            />

            <div className="section-heading" style={{ marginTop: 22 }}>
              <h3>Conditions</h3>
            </div>
            <ConditionsForm value={req} onChange={setReq} />

            {result && (
              <>
                <div className="section-heading" style={{ marginTop: 22 }}>
                  <h3>Filter results</h3>
                </div>
                <FilterPanel
                  runId={result.run_id}
                  availableMaterials={req.materials}
                  onFiltered={(candidates) => {
                    // Update the result with the newly filtered candidates
                    setResult({ ...result, candidates, distinct_candidates_found: candidates.length });
                    setSelectedRank(candidates[0]?.rank ?? null);
                    setShowAllCandidates(false); // Reset view to top K after filtering
                  }}
                />
              </>
            )}
          </aside>

          <main className="opt-panel" style={{ minWidth: 0 }}>
            {!result && (
              <p className="opt-hint">
                Choose at least one material from the library, set a target SE and a
                frequency band, then press <strong>Run optimization</strong>. Results are
                ranked with feasibility first, then by the selected objective.
              </p>
            )}

            {result && (
              <>
                <div className="opt-banner">{result.message}</div>
                <p className="opt-meta">
                  {result.solver_evaluations} solver evaluations · {result.runtime_s} s ·
                  search grid {result.search_grid.frequencies}×{result.search_grid.angles} ·
                  validation grid {result.validation_grid.frequencies}×
                  {result.validation_grid.angles}
                </p>

                {selected && <CandidateDetail candidate={selected} target={result.target_se_db} />}

                <div style={{ marginTop: 24 }}>
                  <CandidateTable
                    candidates={displayedCandidates}
                    selectedRank={selectedRank}
                    onSelect={setSelectedRank}
                    objective={result.objective}
                  />

                  {/* View All / View Less Button */}
                  {result.candidates.length > req.top_k && (
                    <div style={{ textAlign: "center", marginTop: 16 }}>
                      <button
                        className="secondary-button"
                        onClick={() => setShowAllCandidates(!showAllCandidates)}
                      >
                        {showAllCandidates 
                          ? `Show top ${req.top_k} only`
                          : `View all ${result.candidates.length} candidates`}
                      </button>
                    </div>
                  )}
                </div>

                <details style={{ marginTop: 24 }}>
                  <summary style={{ cursor: "pointer", color: "var(--muted)", fontSize: 12 }}>
                    Model notes
                  </summary>
                  <ul style={{ color: "var(--muted)", fontSize: 11, lineHeight: 1.7 }}>
                    {result.notes.map((n, i) => <li key={i}>{n}</li>)}
                  </ul>
                </details>
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}