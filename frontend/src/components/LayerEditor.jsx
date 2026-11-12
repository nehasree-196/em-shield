// LayerEditor.jsx — add / remove / reorder layers and set material + thickness.
import MaterialSelect, { defaultMaterial } from './MaterialSelect';
import { THICKNESS_UNITS } from '../utils/units';

let nextId = 1;

export const newLayer = (material = defaultMaterial()) => ({
  id: nextId++,
  material,
  thickness: '0.1',
  unit: 'mm',
});

export default function LayerEditor({ layers, onChange }) {
  const update = (id, patch) =>
    onChange(layers.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= layers.length) return;
    const copy = [...layers];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    onChange(copy);
  };

  return (
    <div className="em-layers">
      <p className="em-hint">
        Layer 1 faces the incident wave; the last layer is on the exit side.
      </p>
      {layers.map((l, i) => (
        <div className="em-layer" key={l.id}>
          <span className="em-layer-index">{i + 1}</span>
          <MaterialSelect value={l.material} onChange={(material) => update(l.id, { material })} />
          <div className="em-inline">
            <input
              className="em-input"
              value={l.thickness}
              onChange={(e) => update(l.id, { thickness: e.target.value })}
              aria-label={`Thickness of layer ${i + 1}`}
            />
            <select
              className="em-input"
              value={l.unit}
              onChange={(e) => update(l.id, { unit: e.target.value })}
            >
              {Object.keys(THICKNESS_UNITS).map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </div>
          <div className="em-inline">
            <button type="button" className="em-btn-small" onClick={() => move(i, -1)} disabled={i === 0}>
              Move up
            </button>
            <button type="button" className="em-btn-small" onClick={() => move(i, 1)} disabled={i === layers.length - 1}>
              Move down
            </button>
            <button type="button" className="em-btn-small" onClick={() => onChange(layers.filter((x) => x.id !== l.id))} disabled={layers.length === 1}>
              Remove
            </button>
          </div>
        </div>
      ))}
      <button type="button" className="em-btn-secondary" onClick={() => onChange([...layers, newLayer()])}>
        Add layer
      </button>
    </div>
  );
}