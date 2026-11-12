import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PlayCircle } from "lucide-react";

import { runOptimization } from "./api";
import type { Material, OptimizationRequest, RunResult } from "./types";
import { MaterialPicker } from "./components/MaterialPicker";
import { ConditionsForm } from "./components/ConditionsForm";
import { CandidateTable } from "./components/CandidateTable";
import { CandidateDetail } from "./components/CandidateDetail";
import { FilterPanel } from "./components/FilterPanel";
import { useWorkspace } from "../../context/WorkspaceContext";

const DEFAULTS: OptimizationRequest = {
  materials: [],
  target_se_db: undefined,
  frequency_min_hz: undefined,
  frequency_max_hz: undefined,
  max_incidence_angle_deg: 0,
  max_layers: 3,
  default_min_layer_thickness_m: undefined,
  default_max_layer_thickness_m: undefined,
  objective: "thickness",
  must_include_ids: [],
  top_k: 10,
  effort: "normal",
  safety_margin_db: 1.0,
};

export default function Optimization() {
  // Single source of truth: the shared context, which is the union of the
  // backend library and any session-only customs stored in sessionStorage.
  const workspace = useWorkspace();
  const library: Material[] = Array.isArray(workspace?.materials)
    ? workspace.materials
    : [];

  const [req, setReq] = useState<OptimizationRequest>(() => ({
    ...DEFAULTS,
    materials: [],
  }));
  const [result, setResult] = useState<RunResult | null>(null);
  const [selectedRank, setSelectedRank] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [showAllCandidates, setShowAllCandidates] = useState(false);

  // No local fetchMaterials() anymore — the context already loads the library
  // and merges in session customs.

  const selected = useMemo(
    () => result?.candidates.find((c) => c.rank === selectedRank) ?? null,
    [result, selectedRank]
  );

  const validateRequest = (): string | null => {
    if (!Array.isArray(req.materials) || req.materials.length === 0) {
      return "⚠️ Please select at least one material to optimize.";
    }

    const missing: string[] = [];
    if (req.target_se_db === undefined) missing.push("Target SE");
    if (req.frequency_min_hz === undefined) missing.push("F min");
    if (req.frequency_max_hz === undefined) missing.push("F max");
    if (req.max_incidence_angle_deg === undefined) missing.push("Max angle");
    if (req.max_layers === undefined) missing.push("Max layers");
    if (req.top_k === undefined) missing.push("Top K");
    if (req.safety_margin_db === undefined) missing.push("Safety margin");

    if (missing.length > 0) return `⚠️ Missing required fields: ${missing.join(", ")}.`;

    if (req.target_se_db! <= 0) return "⚠️ Target SE must be greater than 0 dB.";
    if (req.frequency_min_hz! <= 0 || req.frequency_max_hz! <= 0) return "⚠️ Frequencies must be positive numbers.";
    if (req.frequency_min_hz! >= req.frequency_max_hz!) return "⚠️ Minimum frequency cannot be greater than or equal to maximum frequency.";
    if (req.max_incidence_angle_deg! < 0 || req.max_incidence_angle_deg! > 85) return "⚠️ Max angle must be between 0° and 85°.";
    if (req.max_layers! < 1 || req.max_layers! > 6) return "⚠️ Max layers must be between 1 and 6.";
    if (req.top_k! < 1) return "⚠️ Top K must be at least 1.";

    if (req.default_min_layer_thickness_m !== undefined && req.default_min_layer_thickness_m <= 0) {
      return "⚠️ Min layer thickness must be greater than 0.";
    }
    if (req.default_max_layer_thickness_m !== undefined && req.default_max_layer_thickness_m <= 0) {
      return "⚠️ Max layer thickness must be greater than 0.";
    }
    if (
      req.default_min_layer_thickness_m !== undefined &&
      req.default_max_layer_thickness_m !== undefined &&
      req.default_min_layer_thickness_m > req.default_max_layer_thickness_m
    ) {
      return "⚠️ Min layer thickness cannot be greater than max layer thickness.";
    }

    return null;
  };

  const run = useCallback(async () => {
    const validationError = validateRequest();
    if (validationError) {
      setError(validationError);
      return;
    }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [req]);

  const displayedCandidates = useMemo(() => {
    if (!result) return [];
    if (showAllCandidates) return result.candidates;
    return result.candidates.slice(0, req.top_k || 10);
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
            disabled={busy}
            onClick={run}
            style={{ minWidth: "160px" }}
          >
            <PlayCircle size={18} />
            {busy ? "Searching..." : "Run optimization"}
          </button>

          {busy && <div className="opt-timer">{elapsed.toFixed(1)}s</div>}
        </div>
      </header>

      {error && <div className="opt-banner is-error" style={{ fontSize: "14px", fontWeight: 600 }}>{error}</div>}

      <div style={{ maxWidth: "1300px", margin: "0 auto", width: "100%" }}>
        <div className="opt-layout">

          <aside className="opt-panel">
            <div className="section-heading">
              <h3>Materials</h3>
            </div>
            <MaterialPicker
              library={library}
              selected={req.materials ?? []}
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
                    setResult({ ...result, candidates, distinct_candidates_found: candidates.length });
                    setSelectedRank(candidates[0]?.rank ?? null);
                    setShowAllCandidates(false);
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

                {selected && (
                  <div style={{ position: "sticky", top: 0, zIndex: 10 }}>
                    <div style={{
                      background: "rgba(237, 240, 255, 0.95)",
                      backdropFilter: "blur(12px)",
                      WebkitBackdropFilter: "blur(12px)",
                      borderRadius: "14px",
                      boxShadow: "0 8px 32px rgba(104, 65, 232, 0.15)",
                      border: "1px solid rgba(192, 202, 255, 0.5)",
                      overflow: "hidden",
                      marginBottom: "16px"
                    }}>
                      <CandidateDetail candidate={selected} target={result.target_se_db} />
                    </div>
                  </div>
                )}

                <div style={{
                  marginTop: 0,
                  maxHeight: showAllCandidates ? "calc(100vh - 350px)" : "none",
                  overflowY: showAllCandidates ? "auto" : "visible",
                  paddingRight: showAllCandidates ? "8px" : "0"
                }}>
                  <CandidateTable
                    candidates={displayedCandidates}
                    selectedRank={selectedRank}
                    onSelect={setSelectedRank}
                    objective={result.objective}
                  />
                </div>

                {result.candidates.length > (req.top_k || 10) && (
                  <div style={{ textAlign: "center", marginTop: 16 }}>
                    <button
                      className="secondary-button"
                      onClick={() => setShowAllCandidates(!showAllCandidates)}
                    >
                      {showAllCandidates
                        ? `Show top ${req.top_k || 10} only`
                        : `View all ${result.candidates.length} candidates`}
                    </button>
                  </div>
                )}

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