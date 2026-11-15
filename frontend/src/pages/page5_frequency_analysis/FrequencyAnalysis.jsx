// FrequencyAnalysis.jsx — Page 5: sweep the active single-layer design or stack across a band and flag SE below target.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileDown } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import ResultsChart from '../../components/ResultsChart';
import { useWorkspace } from '../../context/WorkspaceContext';
import { runSweep } from '../../services/api';
import { FREQ_UNITS, formatFrequency, formatSE, toSI } from '../../utils/units';
import '../../styles/pages345.css';

const MAX_TABLE_ROWS = 200;

function summarize(res) {
  const f = res.frequency_hz;
  const se = res.shielding_effectiveness_db;
  const target = res.target_se_db;
  let worst = 0;
  se.forEach((v, i) => { if (v < se[worst]) worst = i; });
  const passCount = se.filter((v) => v >= target).length;
  const longest = res.failing_ranges_hz.reduce(
    (best, r) => (!best || r.end_hz - r.start_hz > best.end_hz - best.start_hz ? r : best),
    null
  );
  return {
    worstSE: se[worst],
    worstF: f[worst],
    margin: se[worst] - target,
    passRate: (100 * passCount) / se.length,
    longest,
  };
}

function withSigma(spec, materials, k) {
  let p = spec;
  if (spec.material_id !== undefined && spec.sigma_s_per_m === undefined) {
    const props = materials.find((m) => m.id === spec.material_id)?.properties;
    if (!props) return spec;
    p = {
      sigma_s_per_m: props.conductivity_s_m ?? 0,
      epsilon_r: props.relative_permittivity ?? 1,
      mu_r: props.relative_permeability ?? 1,
    };
  }
  return { ...p, sigma_s_per_m: p.sigma_s_per_m * k };
}

async function runSensitivity(layers, body, materials) {
  const thick = (k) => layers.map((l) => ({ ...l, thickness_m: l.thickness_m * k }));
  const sigma = (k) => layers.map((l) => ({ ...l, material: withSigma(l.material, materials, k) }));
  const call = (ls) => runSweep({ ...body, layers: ls });
  const [tLo, tHi, sLo, sHi] = await Promise.all([
    call(thick(0.9)), call(thick(1.1)), call(sigma(0.9)), call(sigma(1.1)),
  ]);
  return { thickness: { lo: tLo, hi: tHi }, conductivity: { lo: sLo, hi: sHi } };
}

export default function FrequencyAnalysis() {
  const { activeSingle, activeStack, setLastSweep, stageForReport, materials = [] } = useWorkspace();
  const navigate = useNavigate();
  const location = useLocation();
  const [source, setSource] = useState(
    location.state?.source ?? (!activeSingle && activeStack ? 'stack' : 'single')
  );
  const [fStart, setFStart] = useState('1');
  const [fEnd, setFEnd] = useState('10');
  const [unit, setUnit] = useState('GHz');
  const [points, setPoints] = useState('201');
  const [spacing, setSpacing] = useState('log');
  const [target, setTarget] = useState('60');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sens, setSens] = useState(null);
  const [sensParam, setSensParam] = useState('thickness');

  const design = source === 'single' ? activeSingle : activeStack;
  const summary = result && result.target_se_db != null ? summarize(result) : null;

  function buildBody() {
    return {
      layers: design.layers,
      frequency_start_hz: toSI(fStart, unit, FREQ_UNITS),
      frequency_end_hz: toSI(fEnd, unit, FREQ_UNITS),
      frequency_points: Number(points),
      spacing,
      target_se_db: Number(target),
    };
  }

  async function run() {
    setError('');
    setLoading(true);
    try {
      const body = buildBody();
      const res = await runSweep(body);
      setResult(res);
      setLastSweep({ source: design.label, request: body, response: res });
      setSens(null);
      runSensitivity(design.layers, body, materials).then(setSens).catch(() => setSens(null));
    } catch (e) {
      setError(e.message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  function generateReport() {
    if (!design) return;
    stageForReport('sweep', {
      label: design.label,
      request: buildBody(),
      response: result,
    });
    navigate('/results');
  }

  return (
    <div className="em-page">
      <h1>Frequency-Response Analysis</h1>
      <div className="em-grid">
        <section className="em-panel" aria-label="Sweep settings">
          <h2>Sweep settings</h2>
          <label>Design source
            <select
              className="em-input"
              value={source}
              onChange={(e) => { setSource(e.target.value); setResult(null); setSens(null); }}
            >
              <option value="single">Single-layer slab (Page 3)</option>
              <option value="stack">Multilayer stack (Page 4)</option>
            </select>
          </label>
          {design
            ? <p className="em-hint">Using: {design.label}</p>
            : <div className="em-notice">No design yet. Run a simulation on {source === 'single' ? 'the Single-Layer Simulator' : 'the Multilayer Designer'} first.</div>}
          <label>Start frequency<input className="em-input" value={fStart} onChange={(e) => setFStart(e.target.value)} /></label>
          <label>End frequency<input className="em-input" value={fEnd} onChange={(e) => setFEnd(e.target.value)} /></label>
          <label>Frequency unit
            <select className="em-input" value={unit} onChange={(e) => setUnit(e.target.value)}>
              {Object.keys(FREQ_UNITS).map((u) => <option key={u}>{u}</option>)}
            </select>
          </label>
          <label>Number of points (N, max 2000)<input className="em-input" value={points} onChange={(e) => setPoints(e.target.value)} /></label>
          <label>Spacing
            <select className="em-input" value={spacing} onChange={(e) => setSpacing(e.target.value)}>
              <option value="log">Logarithmic</option>
              <option value="linear">Linear</option>
            </select>
          </label>
          <label>Target shielding threshold (dB)<input className="em-input" value={target} onChange={(e) => setTarget(e.target.value)} /></label>
          <button type="button" className="em-btn" onClick={run} disabled={loading || !design}>
            {loading ? 'Running…' : 'Run Sweep'}
          </button>
          {result && (
            <button
              type="button"
              className="em-btn"
              style={{ marginTop: 10 }}
              onClick={generateReport}
            >
              <FileDown size={16} />
              Generate Report
            </button>
          )}
          {error && <p className="em-error" role="alert">{error}</p>}
        </section>

        <div className="em-results">
          {!result && (
            <section className="em-panel">
              <p className="em-hint">Choose a design and a band, then select Run Sweep.</p>
            </section>
          )}
          {result && (
            <>
              <section className="em-panel" aria-label="Failure ranges">
                <h2>Frequencies below the {result.target_se_db} dB target</h2>
                {result.failing_ranges_hz.length === 0
                  ? <p className="em-hint">The design meets the target across the whole band.</p>
                  : (
                    <div className="em-table-wrap">
                      <table className="em-table">
                        <thead><tr><th>From</th><th>To</th></tr></thead>
                        <tbody>
                          {result.failing_ranges_hz.map((r, i) => (
                            <tr key={i}>
                              <td>{formatFrequency(r.start_hz)}</td>
                              <td>{formatFrequency(r.end_hz)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
              </section>
              {summary && (
                <section className="em-panel" aria-label="Summary">
                  <div className="em-summary-row">
                    <div className="em-summary-card">
                      <span className="em-summary-label">Worst-case SE across band</span>
                      <strong>{formatSE(summary.worstSE)} @ {formatFrequency(summary.worstF)}</strong>
                    </div>
                    <div className="em-summary-card">
                      <span className="em-summary-label">Margin vs target</span>
                      <strong className={summary.margin >= 0 ? 'em-pass' : 'em-fail'}>
                        {summary.margin >= 0 ? '+' : '−'}{Math.abs(summary.margin).toFixed(2)} dB
                      </strong>
                    </div>
                    <div className="em-summary-card">
                      <span className="em-summary-label">Band pass rate</span>
                      <strong>{summary.passRate.toFixed(1)}% of band meets target</strong>
                    </div>
                    <div className="em-summary-card">
                      <span className="em-summary-label">Longest failing range</span>
                      <strong>
                        {summary.longest
                          ? `${formatFrequency(summary.longest.start_hz)} – ${formatFrequency(summary.longest.end_hz)}`
                          : 'None'}
                      </strong>
                    </div>
                  </div>
                </section>
              )}
              <section className="em-panel" aria-label="Response curves">
                <ResultsChart
                  title="Shielding effectiveness vs frequency"
                  x={result.frequency_hz}
                  traces={[{ name: 'SE', y: result.shielding_effectiveness_db }]}
                  xTitle="Frequency (Hz)"
                  yTitle="Shielding effectiveness, SE (dB)"
                  logX={spacing === 'log'}
                  target={result.target_se_db}
                  failRanges={result.failing_ranges_hz}
                />
                <ResultsChart
                  title="Reflection, transmission and absorption"
                  x={result.frequency_hz}
                  traces={[
                    { name: 'R', y: result.reflection_power },
                    { name: 'T', y: result.transmission_power },
                    { name: 'A', y: result.absorption_power },
                  ]}
                  xTitle="Frequency (Hz)"
                  yTitle="Power fraction (unitless, 0–1)"
                  logX={spacing === 'log'}
                />
              </section>
              {sens && (
                <section className="em-panel" aria-label="Sensitivity">
                  <label>Vary
                    <select className="em-input" value={sensParam} onChange={(e) => setSensParam(e.target.value)}>
                      <option value="thickness">Thickness ±10%</option>
                      <option value="conductivity">Conductivity ±10%</option>
                    </select>
                  </label>
                  <ResultsChart
                    title={`SE sensitivity: ${sensParam} ±10%`}
                    x={result.frequency_hz}
                    traces={[
                      { name: '−10%', y: sens[sensParam].lo.shielding_effectiveness_db },
                      { name: 'Nominal', y: result.shielding_effectiveness_db },
                      { name: '+10%', y: sens[sensParam].hi.shielding_effectiveness_db },
                    ]}
                    xTitle="Frequency (Hz)"
                    yTitle="Shielding effectiveness, SE (dB)"
                    logX={spacing === 'log'}
                    target={result.target_se_db}
                  />
                </section>
              )}
              <section className="em-panel" aria-label="Data table">
                <h2>Data (first {Math.min(MAX_TABLE_ROWS, result.frequency_hz.length)} of {result.frequency_hz.length} rows; full export on Page 7)</h2>
                <div className="em-table-wrap">
                  <table className="em-table">
                    <thead><tr><th>f</th><th>R</th><th>T</th><th>A</th><th>SE (dB)</th></tr></thead>
                    <tbody>
                      {result.frequency_hz.slice(0, MAX_TABLE_ROWS).map((f, i) => (
                        <tr key={i}>
                          <td>{formatFrequency(f)}</td>
                          <td>{result.reflection_power[i].toFixed(5)}</td>
                          <td>{result.transmission_power[i].toExponential(3)}</td>
                          <td>{result.absorption_power[i].toFixed(5)}</td>
                          <td>{result.shielding_effectiveness_db[i].toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}