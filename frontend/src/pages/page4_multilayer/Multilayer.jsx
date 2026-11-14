// Multilayer.jsx — Page 4: build an ordered layer stack, run the transfer-matrix solver, view design analysis.
import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { FileDown } from 'lucide-react';
import createPlotlyComponent from 'react-plotly.js/factory';
import Plotly from 'plotly.js-basic-dist';
import LayerEditor, { newLayer } from '../../components/LayerEditor';
import { materialLabel, toResolvableMaterialSpec } from '../../components/MaterialSelect';
import ResultCards from '../../components/ResultCards';
import { useWorkspace } from '../../context/WorkspaceContext';
import { runMultilayer, runMultilayerAnalysis } from '../../services/api';
import { FREQ_UNITS, THICKNESS_UNITS, formatFrequency, formatLength, formatSE, toSI } from '../../utils/units';
import '../../styles/pages345.css';

export default function Multilayer() {
  const { materials, sessionMaterials = [], setActiveStack, stageForReport } = useWorkspace();
  const navigate = useNavigate();
  const [layers, setLayers] = useState(() => [newLayer()]);
  const [freq, setFreq] = useState('1');
  const [freqUnit, setFreqUnit] = useState('GHz');
  const [bandStart, setBandStart] = useState('1');
  const [bandEnd, setBandEnd] = useState('10');
  const [bandUnit, setBandUnit] = useState('GHz');
  const [target, setTarget] = useState('60');
  const [result, setResult] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function buildApiLayers() {
    return layers.map((l) => ({
      material: toResolvableMaterialSpec(l.material, sessionMaterials),
      thickness_m: toSI(l.thickness, l.unit, THICKNESS_UNITS),
    }));
  }

  async function run() {
    setError('');
    setLoading(true);
    try {
      const apiLayers = buildApiLayers();
      const frequency_hz = toSI(freq, freqUnit, FREQ_UNITS);
      const [res, analysisRes] = await Promise.all([
        runMultilayer({ layers: apiLayers, frequency_hz }),
        runMultilayerAnalysis({
          layers: apiLayers,
          frequency_hz,
          frequency_start_hz: toSI(bandStart, bandUnit, FREQ_UNITS),
          frequency_end_hz: toSI(bandEnd, bandUnit, FREQ_UNITS),
          frequency_points: 201,
          spacing: 'log',
          target_se_db: Number(target),
        }),
      ]);
      setResult(res);
      setAnalysis({ ...analysisRes, band: { start: bandStart, end: bandEnd, unit: bandUnit } });
      setActiveStack({
        label: layers
          .map((l) => `${materialLabel(l.material, materials)} ${l.thickness} ${l.unit}`)
          .join(' / '),
        frequency_hz,
        layers: apiLayers,
      });
    } catch (e) {
      setError(e.message);
      setResult(null);
      setAnalysis(null);
    } finally {
      setLoading(false);
    }
  }

  function generateReport() {
    if (!result) return;
    const apiLayers = buildApiLayers();
    stageForReport('stack', {
      label: layers
        .map((l) => `${materialLabel(l.material, materials)} ${l.thickness} ${l.unit}`)
        .join(' / '),
      fixed_request: {
        layers: apiLayers,
        frequency_hz: toSI(freq, freqUnit, FREQ_UNITS),
      },
      analysis_request: {
        layers: apiLayers,
        frequency_hz: toSI(freq, freqUnit, FREQ_UNITS),
        frequency_start_hz: toSI(bandStart, bandUnit, FREQ_UNITS),
        frequency_end_hz: toSI(bandEnd, bandUnit, FREQ_UNITS),
        frequency_points: 201,
        spacing: 'log',
        target_se_db: Number(target),
      },
    });
    navigate('/results');
  }

  return (
    <div className="em-page">
      <h1>Multilayer Designer</h1>
      <div className="em-grid">
        <section className="em-panel" aria-label="Layer editor">
          <h2>Layer stack</h2>
          <LayerEditor layers={layers} onChange={setLayers} />
          <label>Evaluation frequency
            <div className="em-inline">
              <input className="em-input" value={freq} onChange={(e) => setFreq(e.target.value)} />
              <select className="em-input" value={freqUnit} onChange={(e) => setFreqUnit(e.target.value)}>
                {Object.keys(FREQ_UNITS).map((u) => <option key={u}>{u}</option>)}
              </select>
            </div>
          </label>
          <label>Band of interest
            <div className="em-inline">
              <input className="em-input" aria-label="Band start" value={bandStart} onChange={(e) => setBandStart(e.target.value)} />
              <input className="em-input" aria-label="Band end" value={bandEnd} onChange={(e) => setBandEnd(e.target.value)} />
              <select className="em-input" aria-label="Band unit" value={bandUnit} onChange={(e) => setBandUnit(e.target.value)}>
                {Object.keys(FREQ_UNITS).map((u) => <option key={u}>{u}</option>)}
              </select>
            </div>
          </label>
          <label>Target shielding (dB)
            <input className="em-input" value={target} onChange={(e) => setTarget(e.target.value)} />
          </label>
          <button type="button" className="em-btn" onClick={run} disabled={loading}>
            {loading ? 'Running…' : 'Run Simulation'}
          </button>
          {error && <p className="em-error" role="alert">{error}</p>}
          <p className="em-hint">Normal incidence, far-field plane wave, uniform planar layers, air on both sides.</p>
        </section>

        <div className="em-results">
          {!result && (
            <section className="em-panel">
              <p className="em-hint">Build a stack and select Run Simulation to see its performance.</p>
            </section>
          )}
          {result && (
            <>
              <section className="em-panel" aria-label="Overall performance">
                <h2>Overall performance — {result.layer_count} layer(s), total {formatLength(result.total_thickness_m)}</h2>
                <ResultCards result={result} />
              </section>
              <section className="em-panel" aria-label="Stack metadata">
                <h2>Stack summary</h2>
                <div className="em-table-wrap">
                  <table className="em-table">
                    <thead><tr><th>Layer</th><th>Material</th><th>Thickness</th><th>Skin depth</th></tr></thead>
                    <tbody>
                      {result.stack.map((s) => (
                        <tr key={s.order}>
                          <td>{s.order}</td>
                          <td>{s.material}</td>
                          <td>{formatLength(s.thickness_m)}</td>
                          <td>{formatLength(s.skin_depth_m)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
              {analysis && (
                <section className="em-panel" aria-label="Design analysis">
                  <h2>Design analysis — {analysis.band.start}–{analysis.band.end} {analysis.band.unit}, target {analysis.target_se_db} dB</h2>
                  <SummaryRow summary={analysis.summary} target={analysis.target_se_db} />
                  <AnalysisCharts a={analysis} />
                </section>
              )}
              <section className="em-panel" aria-label="Next step">
                <p className="em-hint">Your stack is saved. Continue to sweep it across a frequency band and check it against a target, or stage it in the report.</p>
                <Link
                  to="/frequency-analysis"
                  state={{ source: 'stack' }}
                  className="em-btn"
                  style={{ textDecoration: 'none', textAlign: 'center', display: 'block' }}
                >
                  Analyse frequency response →
                </Link>
                <button
                  type="button"
                  className="em-btn"
                  style={{ marginTop: 10 }}
                  onClick={generateReport}
                >
                  <FileDown size={16} />
                  Generate Report
                </button>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Charts and summary row
// ---------------------------------------------------------------------------
const factory = createPlotlyComponent.default || createPlotlyComponent;
const Plot = factory(Plotly.default || Plotly);
const C = { reflection: '#5b3df5', absorption: '#1f9d8a', multi: '#d98e04', total: '#e0457b', pass: '#1f9d8a', fail: '#dc2626' };
const LAYER_COLORS = ['#5b3df5', '#1f9d8a', '#d98e04', '#e0457b', '#2a7de1', '#8a5cf6', '#6b8e23', '#c2410c'];

function Chart({ title, data, layout = {}, height = 420, bottom = 160 }) {
  const { xaxis, yaxis, ...rest } = layout;
  const axis = (ax = {}) => ({
    automargin: true,
    ...ax,
    title: typeof ax.title === 'string' ? { text: ax.title, standoff: 12 } : ax.title,
  });
  const top = 50;
  const plotH = Math.max(height - top - bottom, 60);
  return (
    <Plot
      data={data}
      layout={{
        title: { text: title, font: { size: 15 } },
        autosize: true,
        height,
        margin: { l: 80, r: 30, t: top, b: bottom },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(255,255,255,0.6)',
        legend: { orientation: 'h', y: -95 / plotH },
        xaxis: axis(xaxis),
        yaxis: axis(yaxis),
        ...rest,
      }}
      config={{ responsive: true, displaylogo: false }}
      useResizeHandler
      style={{ width: '100%' }}
    />
  );
}

function SummaryRow({ summary, target }) {
  const meets = summary.margin_db >= 0;
  const lf = summary.longest_failing_range_hz;
  const pass = summary.pass_rate_percent;
  const items = [
    { label: 'Worst-case SE across band', value: `${formatSE(summary.worst_se_db)} @ ${formatFrequency(summary.worst_frequency_hz)}` },
    { label: `Margin vs ${target} dB target`, value: `${meets ? '+' : '−'}${Math.abs(summary.margin_db).toFixed(1)} dB`, tone: meets ? 'pass' : 'fail' },
    { label: 'Band pass rate', value: `${pass.toFixed(1)}% of band meets target`, tone: pass >= 100 ? 'pass' : pass >= 50 ? 'warn' : 'fail' },
    {
      label: 'Longest contiguous failing range',
      value: lf ? (lf.start_hz === lf.end_hz ? formatFrequency(lf.start_hz) : `${formatFrequency(lf.start_hz)} – ${formatFrequency(lf.end_hz)}`) : 'None',
      tone: lf ? 'fail' : 'pass',
    },
  ];
  return (
    <div className="em-summary-row" role="group" aria-label="Band summary">
      {items.map((it) => (
        <div className="em-summary-item" key={it.label}>
          <span className="em-card-label">{it.label}</span>
          <strong className={`em-summary-value${it.tone ? ` em-tone-${it.tone}` : ''}`}>{it.value}</strong>
        </div>
      ))}
    </div>
  );
}

function AnalysisCharts({ a }) {
  const unit = a.band.unit;
  const div = FREQ_UNITS[unit];
  const x = a.frequency_hz.map((f) => f / div);
  const freqAxis = { title: `Frequency (${unit})`, type: 'log', exponentformat: 'none' };

  const hover = (name) => `%{y:.1f} dB @ %{x:.4g} ${unit}<extra>${name}</extra>`;
  const line = (name, y, color, extra = {}) => ({ x, y, name, type: 'scatter', mode: 'lines', line: { color, width: 2, ...extra }, hovertemplate: hover(name) });
  const area = (name, y, color, fill) => ({ x, y, name, type: 'scatter', mode: 'lines', fill: 'tozeroy', fillcolor: fill, line: { color, width: 1 }, hovertemplate: hover(name) });

  const shapes = a.summary.failing_ranges_hz.map((r) => ({
    type: 'rect', xref: 'x', yref: 'paper', x0: r.start_hz / div, x1: r.end_hz / div, y0: 0, y1: 1,
    fillcolor: 'rgba(220,38,38,0.12)', line: { width: 0 },
  }));
  shapes.push({ type: 'line', xref: 'paper', yref: 'y', x0: 0, x1: 1, y0: a.target_se_db, y1: a.target_se_db, line: { color: C.fail, dash: 'dash', width: 1.5 } });

  const c = a.layer_contribution;
  const seg = (name, v, color) => ({
    type: 'bar', orientation: 'h', y: ['SE'], x: [v], name, marker: { color },
    hovertemplate: `${name}: %{x:.1f} dB<extra></extra>`,
  });

  const s = a.sensitivity;
  const pct = Math.round(s.delta_fraction * 100);
  const bar = (name, key, abs, color) => ({
    type: 'bar', orientation: 'h', name, y: s.rows.map((r) => r.label), x: s.rows.map((r) => r[key]),
    customdata: s.rows.map((r) => r[abs]), marker: { color },
    hovertemplate: `%{y}<br>${name}: %{x:+.1f} dB (worst-case SE %{customdata:.1f} dB)<extra></extra>`,
  });

  return (
    <>
      <Chart
        title="SE breakdown: reflection, absorption and total"
        data={[
          line('Reflection SE (R)', a.se_reflection_db, C.reflection),
          line('Absorption SE (A)', a.se_absorption_db, C.absorption),
          line('Multi-reflection correction (B)', a.se_multi_reflection_db, C.multi, { dash: 'dot', width: 1.5 }),
          line('Total SE = R + A + B', a.se_total_db, C.total, { width: 3 }),
        ]}
        layout={{ xaxis: freqAxis, yaxis: { title: 'SE (dB)' }, shapes }}
      />

      <Chart
        title={`Margin vs ${a.target_se_db} dB target`}
        data={[
          area('Headroom', a.margin_db.map((m) => Math.max(m, 0)), C.pass, 'rgba(31,157,138,0.35)'),
          area('Shortfall', a.margin_db.map((m) => Math.min(m, 0)), C.fail, 'rgba(220,38,38,0.35)'),
        ]}
        layout={{ xaxis: freqAxis, yaxis: { title: 'SE − target (dB)', zeroline: true, zerolinecolor: '#444' } }}
      />

      <Chart
        title={`Where the shielding comes from at ${formatFrequency(c.frequency_hz)} (total ${c.total_se_db.toFixed(1)} dB)`}
        height={400}
        bottom={210}
        data={[
          ...c.layers.map((l, i) => seg(`L${l.order} ${l.material} (absorption)`, l.absorption_db, LAYER_COLORS[i % LAYER_COLORS.length])),
          seg('Reflection & interfaces (R + B)', c.reflection_and_interface_db, '#9aa3d6'),
        ]}
        layout={{
          barmode: 'stack',
          xaxis: { title: 'Contribution to SE (dB)' },
          yaxis: { title: 'Shield stack', showticklabels: false },
        }}
      />

      <Chart
        title={`Tolerance sensitivity (±${pct}%) — nominal worst-case SE ${s.nominal_worst_se_db.toFixed(1)} dB`}
        height={Math.max(420, 230 + 40 * s.rows.length)}
        data={[
          bar(`−${pct}%`, 'delta_minus_db', 'worst_se_minus_db', C.total),
          bar(`+${pct}%`, 'delta_plus_db', 'worst_se_plus_db', C.absorption),
        ]}
        layout={{
          barmode: 'group',
          xaxis: { title: 'Change in worst-case SE vs nominal (dB)', zeroline: true, zerolinecolor: '#444' },
          yaxis: { title: 'Layer — parameter', autorange: 'reversed' },
        }}
      />
    </>
  );
}