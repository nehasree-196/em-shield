// MaterialSelect.jsx — pick a library material; exports a helper for the API payload.
// Custom σ / εᵣ / μᵣ entry has been removed: only library + session materials are selectable.
import { useWorkspace } from '../context/WorkspaceContext';

export const defaultMaterial = () => ({
  mode: 'library',
  id: 'copper',
  sigma: '5.8e7',
  epsR: '1',
  muR: '1',
});

// Convert the UI state into the MaterialSpec the backend expects.
// Every reachable selection is a library pick now, so this always returns a
// material_id. The custom branch is kept for backward compatibility but is
// unreachable from this UI.
export function toMaterialSpec(m) {
  return m.mode === 'library'
    ? { material_id: m.id }
    : {
        sigma_s_per_m: Number(m.sigma),
        epsilon_r: Number(m.epsR),
        mu_r: Number(m.muR),
      };
}

export const materialLabel = (m, materials) =>
  m.mode === 'library'
    ? materials.find((x) => x.id === m.id)?.name ?? m.id
    : 'Custom material';

export default function MaterialSelect({ value, onChange }) {
  const workspace = useWorkspace();
  const materials = Array.isArray(workspace?.materials)
    ? workspace.materials
    : [];
  const materialsError = workspace?.materialsError || '';

  // Defensive: if the current `value.id` is no longer in the list (e.g. a
  // session custom was removed while selected), fall back to the first
  // available material so the <select> doesn't show a phantom option.
  const currentId =
    value?.mode === 'library' && materials.some((m) => m.id === value.id)
      ? value.id
      : materials[0]?.id ?? '';

  return (
    <div className="em-field-group">
      <select
        className="em-input"
        value={currentId}
        onChange={(e) =>
          onChange({
            ...value,
            mode: 'library',
            id: e.target.value,
          })
        }
      >
        {materials.length === 0 && (
          <option value="" disabled>
            Loading materials…
          </option>
        )}
        {materials.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      {materialsError && (
        <p className="em-error">Could not load materials: {materialsError}</p>
      )}
    </div>
  );
}