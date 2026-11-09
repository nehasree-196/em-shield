// FrequencyAnalysis.jsx — Page 5: sweep the active single-layer design or stack across a band and flag SE below target.
import { useState } from 'react';
import ResultsChart from '../../components/ResultsChart';
import { useWorkspace } from '../../context/WorkspaceContext';
import { runSweep } from '../../services/api';
import { FREQ_UNITS, formatFrequency, toSI } from '../../utils/units';
import '../../styles/pages345.css';

const MAX_TABLE_ROWS = 200;

export default function FrequencyAnalysis() {
  const { activeSingle, activeStack, setLastSweep } = useWorkspace();
  const [source, setSource] = useState('single');
  const [fStart, setFStart] = useState('1');
  const [fEnd, setFEnd] = useState('10');
  const [unit, setUnit] = useState('GHz');
  const [points, setPoints] = useState('201');
  const [spacing, setSpacing] = useState('log');
  const [target, setTarget] = useState('60');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const design = source === 'single' ? activeSingle : activeStack;

  async function run() {
    setError('');
    setLoading(true);
    try {
      const body = {
        layers: design.layers,
        frequency_start_hz: toSI(fStart, unit, FREQ_UNITS),
        frequency_end_hz: toSI(fEnd, unit, FREQ_UNITS),
        frequency_points: Number(points),
        spacing,
        target_se_db: Number(target),
      };
      const res = await runSweep(body);
      setResult(res);
      setLastSweep({ source: design.label, request: body, response: res }); // read by Page 7
    } catch (e) {
      setError(e.message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="em-page">
      <h1>Frequency-Response Analysis</h1>
      <div className="em-grid">
        <section className="em-panel" aria-label="Sweep settings">
          <h2>Sweep settings</h2>
          <label>Design source
            <select className="em-input" value={source} onChange={(e) => { setSource(e.target.value); setResult(null); }}>
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
          <button type="button" className="em-btn" onClick={run} disabled={loading || !design}>{loading ? 'Running…' : 'Run Sweep'}</button>
          {error && <p className="em-error" role="alert">{error}</p>}
        </section>

        <div className="em-results">
          {!result && <section className="em-panel"><p className="em-hint">Choose a design and a band, then select Run Sweep.</p></section>}
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
                            <tr key={i}><td>{formatFrequency(r.start_hz)}</td><td>{formatFrequency(r.end_hz)}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
              </section>
              <section className="em-panel" aria-label="Response curves">
                <ResultsChart title="Shielding effectiveness vs frequency" x={result.frequency_hz}
                  traces={[{ name: 'SE', y: result.shielding_effectiveness_db }]} xTitle="Frequency" yTitle="SE (dB)"
                  logX={spacing === 'log'} target={result.target_se_db} failRanges={result.failing_ranges_hz} />
                <ResultsChart title="Reflection, transmission and absorption" x={result.frequency_hz}
                  traces={[{ name: 'R', y: result.reflection_power }, { name: 'T', y: result.transmission_power }, { name: 'A', y: result.absorption_power }]}
                  xTitle="Frequency" yTitle="Power fraction" logX={spacing === 'log'} />
              </section>
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
