// SingleLayer.jsx — Page 3: evaluate one uniform slab at one frequency.
// Defaults to the first material in the library.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileDown } from 'lucide-react';
import MaterialSelect, {
  defaultMaterial,
  materialLabel,
  toResolvableMaterialSpec,
} from '../../components/MaterialSelect';
import ResultCards from '../../components/ResultCards';
import ResultsChart from '../../components/ResultsChart';
import { useWorkspace } from '../../context/WorkspaceContext';
import { runSingleLayer } from '../../services/api';
import { FREQ_UNITS, THICKNESS_UNITS, formatLength, toSI } from '../../utils/units';
import '../../styles/pages345.css';

const materialToSelectValue = (m) =>
  m
    ? { mode: 'library', id: m.id, sigma: '', epsR: '', muR: '' }
    : defaultMaterial();

const SLAB_COLORS = {
  aluminium: ['#9aa7bd', '#5f6f8a'],
  bakelite: ['#8b5a3c', '#4a2c18'],
  brass: ['#d4a73a', '#8f6a12'],
  bronze: ['#b9733a', '#6b3b14'],
  copper: ['#e08a5a', '#a24a1e'],
  ferrite: ['#4b4f5c', '#1f2230'],
  fr4: ['#3f9a5a', '#1c5a30'],
  gold: ['#f0c02e', '#b8860b'],
  graphite: ['#5a5f6b', '#2a2d35'],
  nickel: ['#8fa3a8', '#566a70'],
  platinum: ['#a9b4c0', '#6b7886'],
  pvc_plastic: ['#4aa3d8', '#1f6a9a'],
  silicone: ['#d96fa8', '#9a3a72'],
  silver: ['#b5bec9', '#7a8696'],
  stainless_steel: ['#7f8c99', '#46525e'],
  zinc: ['#7aa0b8', '#3f6580'],
};
const CATEGORY_COLORS = {
  Conductor: ['#7b63ff', '#4a2fd1'],
  Insulator: ['#3f9a5a', '#1c5a30'],
  Semiconductor: ['#1f9d8a', '#0f5f54'],
};
const DEFAULT_SLAB = ['#7b63ff', '#4a2fd1'];

function slabStyle(material, materials) {
  const id = material?.mode === 'library' ? material.id : null;
  const category = materials.find((m) => m.id === id)?.category;
  const [a, b] = SLAB_COLORS[id] || CATEGORY_COLORS[category] || DEFAULT_SLAB;
  return { background: `linear-gradient(90deg, ${a}, ${b})` };
}

export default function SingleLayer() {
  const workspace = useWorkspace();
  const materials = Array.isArray(workspace?.materials) ? workspace.materials : [];
  const sessionMaterials = Array.isArray(workspace?.sessionMaterials)
    ? workspace.sessionMaterials
    : [];
  const setActiveSingle =
    typeof workspace?.setActiveSingle === 'function' ? workspace.setActiveSingle : () => {};
  const stageForReport =
    typeof workspace?.stageForReport === 'function' ? workspace.stageForReport : () => {};

  const navigate = useNavigate();

  const [material, setMaterial] = useState(() => materialToSelectValue(materials[0]));
  const [freq, setFreq] = useState('1');
  const [freqUnit, setFreqUnit] = useState('GHz');
  const [thickness, setThickness] = useState('1');
  const [thicknessUnit, setThicknessUnit] = useState('mm');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function run() {
    setError('');
    setLoading(true);
    try {
      const materialSpec = toResolvableMaterialSpec(material, sessionMaterials);
      const body = {
        material: materialSpec,
        thickness_m: toSI(thickness, thicknessUnit, THICKNESS_UNITS),
        frequency_hz: toSI(freq, freqUnit, FREQ_UNITS),
      };
      const res = await runSingleLayer(body);
      setResult(res);
      setActiveSingle({
        label: `${materialLabel(material, materials)}, ${thickness} ${thicknessUnit}`,
        frequency_hz: body.frequency_hz,
        layers: [{ material: materialSpec, thickness_m: body.thickness_m }],
      });
    } catch (e) {
      setError(e.message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  function generateReport() {
    if (!result) return;
    const materialSpec = toResolvableMaterialSpec(material, sessionMaterials);
    stageForReport('single', {
      label: `${materialLabel(material, materials)}, ${thickness} ${thicknessUnit}`,
      request: {
        material: materialSpec,
        thickness_m: toSI(thickness, thicknessUnit, THICKNESS_UNITS),
        frequency_hz: toSI(freq, freqUnit, FREQ_UNITS),
      },
      response: result,
    });
    navigate('/results');
  }

  return (
    <div className="em-page">
      <h1>Single-Layer Simulator</h1>
      <div className="em-grid">
        <div className="em-side">
          <section className="em-panel" aria-label="Simulation inputs">
            <h2>Inputs</h2>
            <MaterialSelect value={material} onChange={setMaterial} />
            <label>Frequency
              <div className="em-inline">
                <input className="em-input" value={freq} onChange={(e) => setFreq(e.target.value)} />
                <select className="em-input" value={freqUnit} onChange={(e) => setFreqUnit(e.target.value)}>
                  {Object.keys(FREQ_UNITS).map((u) => <option key={u}>{u}</option>)}
                </select>
              </div>
            </label>
            <label>Thickness
              <div className="em-inline">
                <input className="em-input" value={thickness} onChange={(e) => setThickness(e.target.value)} />
                <select className="em-input" value={thicknessUnit} onChange={(e) => setThicknessUnit(e.target.value)}>
                  {Object.keys(THICKNESS_UNITS).map((u) => <option key={u}>{u}</option>)}
                </select>
              </div>
            </label>
            <h2>Wave assumptions</h2>
            <ul className="em-assumptions">
              <li>Normally incident, far-field plane wave</li>
              <li>Uniform, infinite planar slab in air</li>
              <li>Constant material properties</li>
              <li>No apertures, seams or edges</li>
            </ul>
          </section>
          {result && (
            <section className="em-panel" aria-label="Key numbers and model notes">
              <h2>Key numbers</h2>
              <ul className="em-keynums">
                <li>
                  <span>Skin depth, δ = √(2/ωμσ)</span>
                  <strong>{formatLength(result.skin_depth_good_conductor_m)}</strong>
                  <small>Cross-check only</small>
                </li>
                <li>
                  <span>Thickness in skin depths (t/δ)</span>
                  <strong>{result.thickness_over_skin_depth === null ? 'n/a' : result.thickness_over_skin_depth.toFixed(2)}</strong>
                </li>
                <li>
                  <span>Conduction ratio, σ/(ωε)</span>
                  <strong>{result.conductor_ratio === null ? 'n/a' : result.conductor_ratio.toExponential(2)}</strong>
                </li>
              </ul>
              <h2>Model notes</h2>
              <ul className="em-assumptions">
                <li>Very large SE values are capped in the display.</li>
                <li>Real shields are limited by seams and apertures, which this model excludes.</li>
                <li>The attenuation plot is a single-pass envelope and ignores internal reflections.</li>
              </ul>
            </section>
          )}
        </div>

        <div className="em-results">
          <section className="em-panel" aria-label="Simulation control">
            <div className="em-slab" style={slabStyle(material, materials)}>
              {materialLabel(material, materials)} slab, {thickness} {thicknessUnit}
            </div>
            <button type="button" className="em-btn" onClick={run} disabled={loading}>
              {loading ? 'Running…' : 'Run Simulation'}
            </button>
            {error && <p className="em-error" role="alert">{error}</p>}
          </section>

          {result && (
            <section className="em-panel" aria-label="Results">
              <h2>Results at {freq} {freqUnit}</h2>
              <ResultCards result={result} showSkinDepth />

              <ResultsChart
                title="Field attenuation through the slab (single pass)"
                x={result.profile_z_m.map((z) => z * 1e6)}
                traces={[{ name: '|E(z)| / |E(0)|', y: result.profile_relative_amplitude }]}
                xTitle="Depth into slab, z (µm)"
                yTitle="Relative field amplitude |E(z)| / |E(0)| (unitless)"
              />

              <div className="em-next-step">
                <button
                  type="button"
                  className="em-btn"
                  onClick={() => navigate('/frequency-analysis', { state: { source: 'single' } })}
                >
                  Analyse frequency response →
                </button>
                <button
                  type="button"
                  className="em-btn"
                  onClick={generateReport}
                >
                  <FileDown size={16} />
                  Generate Report
                </button>
                <p className="em-hint">
                  Sweeps this {materialLabel(material, materials)} slab across a frequency band.
                  The Generate Report button stages this result and takes you to the report preview.
                </p>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}