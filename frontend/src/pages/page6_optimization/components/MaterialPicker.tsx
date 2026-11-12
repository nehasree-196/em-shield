import type { Material } from "../types";

type Props = {
  library: Material[];
  selected: Material[];
  onChange: (materials: Material[]) => void;
};

export function MaterialPicker({ library, selected, onChange }: Props) {
  // Defensive: coerce to arrays so a missing/partial provider or a stale
  // initial state can never crash this component.
  const libraryList: Material[] = Array.isArray(library) ? library : [];
  const selectedList: Material[] = Array.isArray(selected) ? selected : [];

  const selectedIds = new Set(selectedList.map((m) => m.id));
  const available = libraryList.filter((m) => !selectedIds.has(m.id));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "15px" }}>
      {selectedList.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {selectedList.map((m) => (
            <span key={m.id} className="opt-chip">
              {m.name ?? m.id}
              <button
                type="button"
                aria-label={`Remove ${m.name ?? m.id}`}
                onClick={() =>
                  onChange(selectedList.filter((x) => x.id !== m.id))
                }
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <select
        value=""
        onChange={(e) => {
          const m = libraryList.find((x) => x.id === e.target.value);
          if (m && !selectedIds.has(m.id)) {
            onChange([...selectedList, m]);
          }
        }}
        disabled={available.length === 0}
        style={{
          width: "100%",
          padding: "10px",
          borderRadius: "8px",
          border: "1px solid var(--border)",
          background: "#f5f5ff",
          color: "var(--text)",
          fontSize: "12px",
          cursor: "pointer",
        }}
      >
        <option value="">
          {available.length === 0
            ? "All materials selected"
            : "+ Add material from library..."}
        </option>
        {available.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name ?? m.id}
          </option>
        ))}
      </select>
    </div>
  );
}