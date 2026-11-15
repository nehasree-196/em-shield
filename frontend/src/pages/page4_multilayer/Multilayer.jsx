// Multilayer.jsx — Page 4: build an ordered layer stack and see its performance at ONE evaluation frequency.
// Frequency sweeps / band analysis live on the Frequency Analysis page.
import { Link } from 'react-router-dom';
import { useState } from 'react';
import createPlotlyComponent from 'react-plotly.js/factory';
import Plotly from 'plotly.js-basic-dist';
import LayerEditor, { newLayer } from '../../components/LayerEditor';
import { materialLabel, toMaterialSpec } from '../../components/MaterialSelect';
import ResultCards from '../../components/ResultCards';
import { useWorkspace } from '../../context/WorkspaceContext';
import { runMultilayer, runMultilayerDetails } from '../../services/api';
import { FREQ_UNITS, THICKNESS_UNITS, formatFrequency, formatLength, toSI } from '../../utils/units';
import '../../styles/pages345.css';

export default function Multilayer() {
  const { materials, setActiveStack } = useWorkspace();
  const [layers, setLayers] = useState(() => [newLayer()]);
  const [freq, setFreq] = useState('1');
  const [freqUnit, setFreqUnit] = useState('GHz');
  const [result, setResult] = useState(null);
  const [details, setDetails] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function run() {
    setError('');
    setLoading(true);
    try {
      const apiLayers = layers.map((l) => ({
        material: toMaterialSpec(l.material),
        thickness_m: toSI(l.thickness, l.unit, THICKNESS_UNITS),
      }));
      const frequency_hz = toSI(freq, freqUnit, FREQ_UNITS);
      // headline numbers + field profile and ±10% sensitivity, all from the same backend solver at one frequency
      const [res, detailsRes] = await Promise.all([
        runMultilayer({ layers: apiLayers, frequency_hz }),
        runMultilayerDetails({ layers: apiLayers, frequency_hz }),
      ]);
      setResult(res);
      setDetails(detailsRes);
      // share this stack with Page 5 (Frequency-Response Analysis)
      setActiveStack({
        label: layers.map((l) => `${materialLabel(l.material, materials)} ${l.thickness} ${l.unit}`).join(' / '),
        frequency_hz,
        layers: apiLayers,
      });
    } catch (e) {
      setError(e.message);
      setResult(null);
      setDetails(null);
    } finally {
      setLoading(false);
    }
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
          <button type="button" className="em-btn" onClick={run} disabled={loading}>{loading ? 'Running…' : 'Run Simulation'}</button>
          {error && <p className="em-error" role="alert">{error}</p>}
          <p className="em-hint">Normal incidence, far-field plane wave, uniform planar layers, air on both sides.</p>
        </section>

        <div className="em-results">
          {!result && <section className="em-panel"><p className="em-hint">Build a stack and select Run Simulation to see its performance.</p></section>}
          {result && (
            <>
              <section className="em-panel" aria-label="Overall performance">
                <h2>Overall performance at {formatFrequency(result.frequency_hz)} — {result.layer_count} layer(s), total {formatLength(result.total_thickness_m)}</h2>
                <ResultCards result={result} />
              </section>
              <section className="em-panel" aria-label="Stack metadata">
                <h2>Skin depth per layer at {formatFrequency(result.frequency_hz)}</h2>
                <div className="em-table-wrap">
                  <table className="em-table">
                    <thead><tr><th>Layer</th><th>Material</th><th>Thickness</th><th>Skin depth (δ)</th></tr></thead>
                    <tbody>
                      {result.stack.map((s) => (
                        <tr key={s.order}><td>{s.order}</td><td>{s.material}</td><td>{formatLength(s.thickness_m)}</td><td>{formatLength(s.skin_depth_m)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
              {details && (
                <section className="em-panel" aria-label="Field and tolerance analysis">
                  <h2>Field and tolerance analysis at {formatFrequency(details.frequency_hz)}</h2>
                  <FieldChart d={details} />
                  <p className="em-hint">
                    Inside a conductor the field drops by 8.69 dB (to 37%) every skin depth δ; dotted lines mark one δ into each
                    conducting layer. The value at the back of the stack equals −SE.
                  </p>
                  <SensitivityChart d={details} />
                </section>
              )}
              <section className="em-panel" aria-label="Next step">
                <p className="em-hint">Your stack is saved. Continue to sweep it across a frequency band and check it against a target.</p>
                <Link
                  to="/frequency-analysis"
                  state={{ source: 'stack' }}
                  className="em-btn"
                  style={{ textDecoration: 'none', textAlign: 'center' }}
                >
                  Analyse frequency response →
                </Link>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Charts (plot backend data only; nothing is simulated here)
// ---------------------------------------------------------------------------
const factory = createPlotlyComponent.default || createPlotlyComponent;
const Plot = factory(Plotly.default || Plotly);
const C = { field: '#5b3df5', minus: '#e0457b', plus: '#1f9d8a' };
const SHADES = ['rgba(91,61,245,0.10)', 'rgba(31,157,138,0.12)', 'rgba(217,142,4,0.12)', 'rgba(224,69,123,0.10)', 'rgba(42,125,225,0.10)'];

// Big margins + automargin + standoff so the axis titles are never clipped; the legend sits below the x-axis title.
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

// Relative field amplitude through the stack, with layer bands and one-skin-depth markers
function FieldChart({ d }) {
  const fp = d.field_profile;
  const total = fp.layers[fp.layers.length - 1].end_m;
  const [div, unit] = total < 1e-3 ? [1e-6, 'µm'] : [1e-3, 'mm'];

  const shapes = [];
  const annotations = [];
  fp.layers.forEach((l, i) => {
    const x0 = l.start_m / div;
    const x1 = l.end_m / div;
    shapes.push({ type: 'rect', xref: 'x', yref: 'paper', x0, x1, y0: 0, y1: 1, fillcolor: SHADES[i % SHADES.length], line: { width: 0 }, layer: 'below' });
    annotations.push({
      x: (x0 + x1) / 2, y: 0.02, xref: 'x', yref: 'paper', yanchor: 'bottom', showarrow: false,
      text: `L${l.order} ${l.material}<br>${l.skin_depth_m ? `δ = ${formatLength(l.skin_depth_m)}` : 'lossless'}`,
      font: { size: 10 }, textangle: (x1 - x0) / (total / div) < 0.08 ? -90 : 0,
    });
    if (l.skin_depth_m && l.skin_depth_m < l.end_m - l.start_m) {
      const xd = (l.start_m + l.skin_depth_m) / div;
      shapes.push({ type: 'line', xref: 'x', yref: 'paper', x0: xd, x1: xd, y0: 0, y1: 1, line: { color: '#444', dash: 'dot', width: 1 } });
    }
  });

  return (
    <Chart
      title={`Relative field amplitude vs depth at ${formatFrequency(fp.frequency_hz)}`}
      height={440}
      data={[{
        x: fp.depth_m.map((z) => z / div), y: fp.relative_amplitude_db, type: 'scatter', mode: 'lines', name: 'Relative field amplitude',
        line: { color: C.field, width: 3 }, hovertemplate: `%{y:.2f} dB at %{x:.3g} ${unit}<extra></extra>`,
      }]}
      layout={{
        xaxis: { title: `Depth into the shield stack (${unit})`, range: [0, total / div] },
        yaxis: { title: 'Relative field amplitude 20·log₁₀(|E| / |E₀|)  (dB)' },
        shapes, annotations, showlegend: false,
      }}
    />
  );
}

// ±10% on thickness / conductivity of each layer: change in SE at the evaluation frequency
function SensitivityChart({ d }) {
  const s = d.sensitivity;
  const pct = Math.round(s.delta_fraction * 100);
  const bar = (name, key, abs, color) => ({
    type: 'bar', orientation: 'h', name, y: s.rows.map((r) => r.label), x: s.rows.map((r) => r[key]),
    customdata: s.rows.map((r) => r[abs]), marker: { color },
    hovertemplate: `%{y}<br>${name}: %{x:+.2f} dB (SE %{customdata:.1f} dB)<extra></extra>`,
  });
  return (
    <Chart
      title={`Tolerance sensitivity (±${pct}%) at ${formatFrequency(d.frequency_hz)} — nominal SE ${s.nominal_worst_se_db.toFixed(1)} dB`}
      height={Math.max(420, 230 + 40 * s.rows.length)}
      data={[bar(`−${pct}%`, 'delta_minus_db', 'worst_se_minus_db', C.minus), bar(`+${pct}%`, 'delta_plus_db', 'worst_se_plus_db', C.plus)]}
      layout={{
        barmode: 'group',
        xaxis: { title: 'Change in SE at the evaluation frequency (dB)', zeroline: true, zerolinecolor: '#444' },
        yaxis: { title: 'Layer — parameter', autorange: 'reversed' },
      }}
    />
  );
}