// ResultsExport.tsx — Page 7: preview the staged report sections (single-layer,
// multilayer, sweep) and download them as a single PDF. Sections are staged by
// the "Generate Report" buttons on Pages 3, 4 and 5.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileDown, Trash2, Layers3, Boxes, Gauge, AlertTriangle, Check,
} from "lucide-react";
import ResultsChart from "../../components/ResultsChart";
import { useWorkspace } from "../../context/WorkspaceContext";
import { generateReport } from "../../services/api";
import "../../styles/pages345.css";

export default function ResultsExport() {
  const navigate = useNavigate();
  const { report, clearReport } = useWorkspace();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const single: any = report?.single;
  const stack: any = report?.stack;
  const sweep: any = report?.sweep;
  const any = !!(single || stack || sweep);

  async function download() {
    setError("");
    setLoading(true);
    try {
      const body: any = {
        label: "EM-Shield session report",
        include_sensitivity: true,
      };
      if (single) body.single = single.request;
      if (stack) {
        body.stack = stack.fixed_request;
        if (stack.analysis_request) body.stack_analysis = stack.analysis_request;
      }
      if (sweep) body.sweep = sweep.request;

      const blob = await generateReport(body);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 16);
      a.download = `em-shield-report-${stamp}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  const cards = [
    {
      key: "single", icon: Layers3, title: "Single-layer result",
      staged: single, label: single?.label, href: "/single-layer",
    },
    {
      key: "stack", icon: Boxes, title: "Multilayer result + band analysis",
      staged: stack, label: stack?.label, href: "/multilayer",
    },
    {
      key: "sweep", icon: Gauge, title: "Frequency sweep",
      staged: sweep, label: sweep?.label, href: "/frequency-analysis",
    },
  ];

  return (
    <div className="dashboard">
      <section className="dashboard-heading">
        <div>
          <p className="eyebrow">RESULTS EXPORT</p>
          <h2>Preview & Download Report</h2>
          <p>
            Sections below were staged by the "Generate Report" buttons on each
            simulation page. Preview them here, then download a single PDF.
          </p>
        </div>
        <button
          className="primary-button"
          onClick={download}
          disabled={!any || loading}
        >
          <FileDown size={18} />
          {loading ? "Generating…" : "Download PDF"}
        </button>
      </section>

      {error && (
        <section className="em-panel" aria-live="polite">
          <p className="em-error" role="alert">{error}</p>
        </section>
      )}

      <section aria-labelledby="staged-heading">
        <div className="section-heading">
          <h3 id="staged-heading">Staged sections</h3>
          {any && (
            <button
              className="secondary-button"
              onClick={clearReport}
              style={{ gap: 6 }}
            >
              <Trash2 size={14} />
              Clear report
            </button>
          )}
        </div>
        <div className="workspace-grid dashboard-workspace-grid">
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <div className="workspace-card dashboard-info-card" key={c.key}>
                <span className="workspace-icon">
                  {c.staged ? <Check size={22} /> : <Icon size={22} />}
                </span>
                <h4>{c.title}</h4>
                <p>
                  {c.staged
                    ? c.label
                    : "Not staged yet. Run the simulation and click Generate Report."}
                </p>
                {!c.staged && (
                  <button
                    className="secondary-button"
                    style={{ marginTop: 12 }}
                    onClick={() => navigate(c.href)}
                  >
                    Go to page
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {sweep && sweep.response && (
        <section className="em-panel" aria-label="Sweep preview">
          <ResultsChart
            title="Shielding effectiveness vs frequency (from the sweep)"
            x={sweep.response.frequency_hz}
            traces={[
              { name: "SE", y: sweep.response.shielding_effectiveness_db },
            ]}
            xTitle="Frequency (Hz)"
            yTitle="Shielding effectiveness, SE (dB)"
            logX={sweep.request?.spacing === "log"}
            target={sweep.response.target_se_db}
            failRanges={sweep.response.failing_ranges_hz}
          />
        </section>
      )}

      {single && single.response && (
        <section className="em-panel" aria-label="Single-layer preview">
          <ResultsChart
            title="Field attenuation through the slab (single pass)"
            x={single.response.profile_z_m.map((z: number) => z * 1e6)}
            traces={[
              { name: "|E(z)| / |E(0)|", y: single.response.profile_relative_amplitude },
            ]}
            xTitle="Depth into slab, z (µm)"
            yTitle="Relative field amplitude |E(z)| / |E(0)|"
          />
        </section>
      )}

      {!any && (
        <section className="em-panel">
          <div className="workspace-card dashboard-info-card" style={{ cursor: "default" }}>
            <span className="workspace-icon">
              <AlertTriangle size={22} />
            </span>
            <h4>Nothing staged yet</h4>
            <p>
              Run a simulation on Single-Layer, Multilayer, or Frequency-Response
              Analysis and click <strong>Generate Report</strong>. Sections
              you've staged will appear here.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}