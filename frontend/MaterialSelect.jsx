// MaterialSelect.jsx — pick a library material or enter custom sigma / eps_r / mu_r; exports a helper for the API payload.
import { useWorkspace } from '../context/WorkspaceContext';

export const defaultMaterial = () => ({ mode: 'library', id: 'copper', sigma: '5.8e7', epsR: '1', muR: '1' });

// convert the UI state into the MaterialSpec the backend expects
export function toMaterialSpec(m) {
  return m.mode === 'library'
    ? { material_id: m.id }
    : { sigma_s_per_m: Number(m.sigma), epsilon_r: Number(m.epsR), mu_r: Number(m.muR) };
}

export const materialLabel = (m, materials) =>
  m.mode === 'library' ? (materials.find((x) => x.id === m.id)?.name ?? m.id) : 'Custom material';

export default function MaterialSelect({ value, onChange }) {
  const { materials, materialsError } = useWorkspace();
  const set = (patch) => onChange({ ...value, ...patch });
  return (
    <div className="em-field-group">
      <select
        className="em-input"
        value={value.mode === 'library' ? value.id : 'custom'}
        onChange={(e) => (e.target.value === 'custom' ? set({ mode: 'custom' }) : set({ mode: 'library', id: e.target.value }))}
      >
        {materials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        <option value="custom">Custom material…</option>
      </select>
      {materialsError && <p className="em-error">Could not load materials: {materialsError}</p>}
      {value.mode === 'custom' && (
        <div className="em-custom-row">
          <label>σ (S/m)<input className="em-input" value={value.sigma} onChange={(e) => set({ sigma: e.target.value })} /></label>
          <label>εr<input className="em-input" value={value.epsR} onChange={(e) => set({ epsR: e.target.value })} /></label>
          <label>μr<input className="em-input" value={value.muR} onChange={(e) => set({ muR: e.target.value })} /></label>
        </div>
      )}
    </div>
  );
}
