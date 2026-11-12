// SingleLayer.jsx — Page 3: evaluate one uniform slab at one frequency.
// Defaults to the first material in the library.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

export default function SingleLayer() {
  const workspace = useWorkspace();
  const materials = Array.isArray(workspace?.materials)
    ? workspace.materials
    : [];
  const sessionMaterials = Array.isArray(workspace?.sessionMaterials)
    ? workspace.sessionMaterials
    : [];
  const setActiveSingle =
    typeof workspace?.setActiveSingle === 'function'
      ? workspace.setActiveSingle
      : () => {};

  const navigate = useNavigate();

  const [material, setMaterial] = useState(() =>
    materialToSelectValue(materials[0])
  );
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

  return (
    <div className="em-page">
      <h1>Single-Layer Simulator</h1>
      <div className="em-grid">
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

        <div className="em-results">
          <section className="em-panel" aria-label="Simulation control">
            <div className="em-slab">{materialLabel(material, materials)} slab, {thickness} {thicknessUnit}</div>
            <button type="button" className="em-btn" onClick={run} disabled={loading}>{loading ? 'Running…' : 'Run Simulation'}</button>
            {error && <p className="em-error" role="alert">{error}</p>}
          </section>

          {result && (
            <section className="em-panel" aria-label="Results">
              <h2>Results at {freq} {freqUnit}</h2>
              <ResultCards result={result} showSkinDepth />
              <p className="em-hint">
                Good-conductor skin depth √(2/ωμσ) = {formatLength(result.skin_depth_good_conductor_m)} (cross-check only).
                Thickness is {result.thickness_over_skin_depth === null ? 'n/a' : result.thickness_over_skin_depth.toFixed(2)} skin depths;
                σ/(ωε) = {result.conductor_ratio === null ? 'n/a' : result.conductor_ratio.toExponential(2)}.
                Very large SE values are capped in the display; real shields are limited by seams and apertures, which this model excludes.
                The attenuation plot is a single-pass envelope and ignores internal reflections.
              </p>

              <ResultsChart
                title="Field attenuation through the slab (single pass)"
                x={result.profile_z_m.map((z) => z * 1e6)}
                traces={[{ name: '|E(z)| / |E(0)|', y: result.profile_relative_amplitude }]}
                xTitle="Depth into slab (µm)" yTitle="Relative amplitude"
              />

              <div className="em-next-step">
                <button type="button" className="em-btn" onClick={() => navigate('/frequency-analysis')}>
                  Analyse frequency response →
                </button>
                <p className="em-hint">Sweeps this {materialLabel(material, materials)} slab across a frequency band.</p>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}