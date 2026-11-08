// Multilayer.jsx — Page 4: build an ordered layer stack, run the transfer-matrix solver, view broadband response.
import { useState } from 'react';
import LayerEditor, { newLayer } from '../../components/LayerEditor';
import { materialLabel, toMaterialSpec } from '../../components/MaterialSelect';
import ResultCards from '../../components/ResultCards';
import ResultsChart from '../../components/ResultsChart';
import { useWorkspace } from '../../context/WorkspaceContext';
import { runMultilayer, runSweep } from '../../services/api';
import { FREQ_UNITS, THICKNESS_UNITS, formatLength, toSI } from '../../utils/units';
import '../../styles/pages345.css';

export default function Multilayer() {
  const { materials, setActiveStack } = useWorkspace();
  const [layers, setLayers] = useState(() => [newLayer()]);
  const [freq, setFreq] = useState('1');
  const [freqUnit, setFreqUnit] = useState('GHz');
  const [result, setResult] = useState(null);
  const [curve, setCurve] = useState(null);
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
      // fixed-frequency result and a broadband curve (100 kHz – 10 GHz) from the same backend solver
      const [res, sweepRes] = await Promise.all([
        runMultilayer({ layers: apiLayers, frequency_hz }),
        runSweep({ layers: apiLayers, frequency_start_hz: 1e5, frequency_end_hz: 1e10, frequency_points: 201, spacing: 'log' }),
      ]);
      setResult(res);
      setCurve(sweepRes);
      // share this stack with Page 5 (Frequency-Response Analysis)
      setActiveStack({
        label: layers.map((l) => `${materialLabel(l.material, materials)} ${l.thickness} ${l.unit}`).join(' / '),
        frequency_hz,
        layers: apiLayers,
      });
    } catch (e) {
      setError(e.message);
      setResult(null);
      setCurve(null);
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
                        <tr key={s.order}><td>{s.order}</td><td>{s.material}</td><td>{formatLength(s.thickness_m)}</td><td>{formatLength(s.skin_depth_m)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
              {curve && (
                <section className="em-panel" aria-label="Broadband response">
                  <h2>Broadband response</h2>
                  <ResultsChart title="Shielding effectiveness vs frequency" x={curve.frequency_hz}
                    traces={[{ name: 'SE', y: curve.shielding_effectiveness_db }]} xTitle="Frequency" yTitle="SE (dB)" logX />
                  <ResultsChart title="Reflection, transmission and absorption" x={curve.frequency_hz}
                    traces={[{ name: 'R', y: curve.reflection_power }, { name: 'T', y: curve.transmission_power }, { name: 'A', y: curve.absorption_power }]}
                    xTitle="Frequency" yTitle="Power fraction" logX />
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
