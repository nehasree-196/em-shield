import { useCallback, useMemo, useRef, useState } from "react";
import { PlayCircle } from "lucide-react";

import { runOptimization, filterRun } from "./api";
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

const ALL_CANDIDATES_LIMIT = 2000;

export default function Optimization() {
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
  const [loadingAll, setLoadingAll] = useState(false);

  // Only ever keep candidates that passed dense validation.
  const validCandidates = useMemo(
    () => (result?.candidates ?? []).filter((c) => c.passes_dense_validation),
    [result]
  );

  const selected = useMemo(
    () => validCandidates.find((c) => c.rank === selectedRank) ?? null,
    [validCandidates, selectedRank]
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
      // Select the first VALID candidate, not just the first.
      const firstValid = r.candidates.find((c) => c.passes_dense_validation);
      setSelectedRank(firstValid?.rank ?? null);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [req]);

  // Fetch the full candidate pool (up to 2000) from the backend on demand.
  const loadAllCandidates = useCallback(async () => {
    if (!result) return;
    setLoadingAll(true);
    setError(null);
    try {
      const res = await filterRun({
        run_id: result.run_id,
        include_ids: [],
        exclude_ids: [],
        sort_by: "objective",
        only_validated: true,
        top_k: ALL_CANDIDATES_LIMIT,
      });
      setResult({ ...result, candidates: res.candidates, distinct_candidates_found: res.candidates.length });
      const firstValid = res.candidates.find((c) => c.passes_dense_validation);
      setSelectedRank(firstValid?.rank ?? null);
      setShowAllCandidates(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoadingAll(false);
    }
  }, [result]);

  const toggleViewAll = useCallback(() => {
    if (showAllCandidates) {
      setShowAllCandidates(false);
      return;
    }
    if (validCandidates.length > (req.top_k || 10)) {
      setShowAllCandidates(true);
    } else {
      void loadAllCandidates();
    }
  }, [showAllCandidates, validCandidates.length, req.top_k, loadAllCandidates]);

  const displayedCandidates = useMemo(() => {
    if (showAllCandidates) return validCandidates;
    return validCandidates.slice(0, req.top_k || 10);
  }, [validCandidates, showAllCandidates, req.top_k]);

  // The button is available right after the first run, since the full pool
  // (up to 2000) can be fetched on demand even if the initial run returned
  // only top_k.
  const canViewMore =
    !!result &&
    validCandidates.length > 0 &&
    (validCandidates.length > (req.top_k || 10) || !showAllCandidates);

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

            {result && validCandidates.length > 0 && (
              <>
                <div className="section-heading" style={{ marginTop: 22 }}>
                  <h3>Filter results</h3>
                </div>
                <FilterPanel
                  runId={result.run_id}
                  availableMaterials={req.materials}
                  onFiltered={(candidates) => {
                    setResult({ ...result, candidates, distinct_candidates_found: candidates.length });
                    const firstValid = candidates.find((c) => c.passes_dense_validation);
                    setSelectedRank(firstValid?.rank ?? null);
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

            {result && validCandidates.length === 0 && (
              <div className="opt-banner is-error">
                ⚠️ No valid combinations were found for the current conditions.
                Try lowering the target SE, widening the frequency band, increasing
                max layers/thickness, or adjusting the safety margin.
              </div>
            )}

            {result && validCandidates.length > 0 && (
              <>
                <div className="opt-banner">{result.message}</div>
                <p className="opt-meta">
                  {result.solver_evaluations} solver evaluations · {result.runtime_s} s ·
                  search grid {result.search_grid.frequencies}×{result.search_grid.angles} ·
                  validation grid {result.validation_grid.frequencies}×
                  {result.validation_grid.angles} · {validCandidates.length} valid candidate
                  {validCandidates.length === 1 ? "" : "s"}
                </p>

                {selected && (
                  <div
                    style={{
                      position: "sticky",
                      top: 0,
                      zIndex: 10,
                      // Cap the pinned card so the table below always has room.
                      maxHeight: "38vh",
                      overflowY: "auto",
                      marginBottom: 12,
                      borderRadius: "14px",
                      background: "rgba(237, 240, 255, 0.95)",
                      backdropFilter: "blur(12px)",
                      WebkitBackdropFilter: "blur(12px)",
                      boxShadow: "0 8px 32px rgba(104, 65, 232, 0.15)",
                      border: "1px solid rgba(192, 202, 255, 0.5)",
                    }}
                  >
                    <div className="opt-detail-pinned">
                      <CandidateDetail candidate={selected} target={result.target_se_db} compact />
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

                {/* Bottom "view all" button — visible right after the first run. */}
                {canViewMore && (
                  <div style={{ textAlign: "center", marginTop: 16 }}>
                    <button
                      className="secondary-button"
                      onClick={toggleViewAll}
                      disabled={loadingAll}
                    >
                      {loadingAll
                        ? "Loading all candidates…"
                        : showAllCandidates
                          ? `Show top ${req.top_k || 10} only`
                          : `View top ${ALL_CANDIDATES_LIMIT} candidates`}
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