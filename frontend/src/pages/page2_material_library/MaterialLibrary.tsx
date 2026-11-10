
import { useEffect, useState, type FormEvent } from "react";
import {
  getMaterials,
  type Material,
  type MaterialCategory,
} from "../../services/api";

function formatProperty(value: number | null | undefined): string {
  return value == null ? "—" : value.toLocaleString();
}

export default function MaterialLibrary() {
  const mode = new URLSearchParams(window.location.search).get("mode");
  const [materials, setMaterials] = useState<Material[]>([]);
  const [customMaterials, setCustomMaterials] = useState<Material[]>([]);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<MaterialCategory | "">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [expandedMaterials, setExpandedMaterials] = useState<Set<string>>(
    new Set()
  );
  const [selectedMaterials, setSelectedMaterials] = useState<Set<string>>(
    new Set()
  );

  // Custom material form
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState("");
  const [conductivity, setConductivity] = useState("");
  const [permittivity, setPermittivity] = useState("");
  const [permeability, setPermeability] = useState("");
  const [dielectricLoss, setDielectricLoss] = useState("");
  const [magneticLoss, setMagneticLoss] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function fetchMaterials() {
      setLoading(true);
      setError("");

      try {
        const data = await getMaterials();

        if (!cancelled) {
          setMaterials(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load materials."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchMaterials();

    return () => {
      cancelled = true;
    };
  }, []);

  function toggleExpanded(materialId: string) {
    setExpandedMaterials((previous) => {
      const updated = new Set(previous);

      if (updated.has(materialId)) {
        updated.delete(materialId);
      } else {
        updated.add(materialId);
      }

      return updated;
    });
  }

  function toggleSelected(materialId: string) {
    setSelectedMaterials((previous) => {
      const updated = new Set(previous);

      if (updated.has(materialId)) {
        updated.delete(materialId);
      } else {
        updated.add(materialId);
      }

      return updated;
    });
  }

  function resetCustomForm() {
    setCustomName("");
    setConductivity("");
    setPermittivity("");
    setPermeability("");
    setDielectricLoss("");
    setMagneticLoss("");
    setFormError("");
  }

  function addCustomMaterial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    const name = customName.trim();

    const values = [
      conductivity,
      permittivity,
      permeability,
      dielectricLoss,
      magneticLoss,
    ].map(Number);

    const [
      conductivityValue,
      permittivityValue,
      permeabilityValue,
      dielectricLossValue,
      magneticLossValue,
    ] = values;

    if (!name) {
      setFormError("Please enter a material name.");
      return;
    }

    if (values.some((value) => !Number.isFinite(value))) {
      setFormError("Please enter valid numerical values for all properties.");
      return;
    }

    if (
      conductivityValue < 0 ||
      dielectricLossValue < 0 ||
      magneticLossValue < 0
    ) {
      setFormError("Conductivity and loss tangents cannot be negative.");
      return;
    }

    if (permittivityValue <= 0 || permeabilityValue <= 0) {
      setFormError(
        "Relative permittivity and permeability must be greater than zero."
      );
      return;
    }

    const duplicateName = [...materials, ...customMaterials].some(
      (material) => material.name.toLowerCase() === name.toLowerCase()
    );

    if (duplicateName) {
      setFormError("A material with this name already exists.");
      return;
    }

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const newMaterial: Material = {
      id: `custom-${slug}-${Date.now()}`,
      name,
      category: "Custom",
      properties: {
        conductivity_s_m: conductivityValue,
        relative_permittivity: permittivityValue,
        relative_permeability: permeabilityValue,
        dielectric_loss_tangent: dielectricLossValue,
        magnetic_loss_tangent: magneticLossValue,
      },
      sources: [],
      frequency_dependent_properties: [],
    };

    // Keep the custom material in temporary React state.
    setCustomMaterials((previous) => [...previous, newMaterial]);

    // Automatically select the newly added material.
    setSelectedMaterials((previous) => {
      const updated = new Set(previous);
      updated.add(newMaterial.id);
      return updated;
    });

    // Automatically expand its properties.
    setExpandedMaterials((previous) => {
      const updated = new Set(previous);
      updated.add(newMaterial.id);
      return updated;
    });

    resetCustomForm();
    setShowCustomForm(false);
    setSearch("");
    setCategory("");
  }

  // Filter predefined materials locally.
const filteredPredefinedMaterials = materials.filter((material) => {
  const matchesSearch = material.name
    .toLowerCase()
    .includes(search.trim().toLowerCase());

  const matchesCategory =
    !category || material.category === category;

  return matchesSearch && matchesCategory;
});

// Filter custom materials.
const filteredCustomMaterials = customMaterials.filter((material) => {
  const matchesSearch = material.name
    .toLowerCase()
    .includes(search.trim().toLowerCase());

  const matchesCategory = !category || category === "Custom";

  return matchesSearch && matchesCategory;
});

const displayedMaterials = [
  ...(category === "Custom" ? [] : filteredPredefinedMaterials),
  ...filteredCustomMaterials,
];

// Combine predefined and custom materials.
const allMaterials = [...materials, ...customMaterials];

// Check which selected materials actually exist.
const selectedMaterialDetails = allMaterials.filter((material) =>
  selectedMaterials.has(material.id)
);

// Validate the selection according to the entry mode.
const canContinue =
  selectedMaterials.size > 0 &&
  (
    mode === "single-layer"
      ? selectedMaterials.size === 1
      : mode === "multilayer"
        ? selectedMaterials.size >= 2
        : true
  );

// Navigate to the correct page.
function handleNext() {
  const selected = selectedMaterialDetails;

  if (selected.length === 0) return;

  if (mode === "single-layer" && selected.length !== 1) return;
  if (mode === "multilayer" && selected.length < 2) return;

  // Temporarily store selected material details for the next page.
  sessionStorage.setItem(
    "emShield.selectedMaterials",
    JSON.stringify(selected)
  );

  sessionStorage.setItem(
    "emShield.selectedMaterialIds",
    JSON.stringify(selected.map((material) => material.id))
  );

  // Choose the destination automatically.
  const destination =
    selected.length === 1 ? "/single-layer" : "/multilayer";

  window.location.assign(destination);
}
  return (
    <div style={{ padding: "24px" }}>
      <h1>Material Library</h1>
      <p>Browse and explore electromagnetic material properties.</p>

      <div
        style={{
          display: "flex",
          gap: "12px",
          flexWrap: "wrap",
          margin: "24px 0",
        }}
      >
        <input
          type="text"
          placeholder="Search materials by name..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          style={{ padding: "10px", minWidth: "220px" }}
        />

        <select
          value={category}
          onChange={(event) =>
            setCategory(event.target.value as MaterialCategory | "")
          }
          style={{ padding: "10px" }}
        >
          <option value="">All categories</option>
          <option value="Conductor">Conductor</option>
          <option value="Insulator">Insulator</option>
          <option value="Semiconductor">Semiconductor</option>
          <option value="Custom">Custom</option>
        </select>

        <button
          type="button"
          onClick={() => {
            setShowCustomForm((previous) => !previous);
            setFormError("");
          }}
          style={{
            padding: "10px 16px",
            cursor: "pointer",
          }}
        >
          {showCustomForm ? "Close Form" : "+ Add Custom Material"}
        </button>
      </div>

      {showCustomForm && (
        <form
          onSubmit={addCustomMaterial}
          style={{
            border: "1px solid #ddd",
            borderRadius: "10px",
            padding: "20px",
            marginBottom: "24px",
          }}
        >
          <h2>Add Custom Material</h2>
          <p>Enter the electromagnetic properties of your material.</p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "16px",
            }}
          >
            <label>
              Material Name *
              <input
                type="text"
                value={customName}
                onChange={(event) => setCustomName(event.target.value)}
                required
                style={{ display: "block", width: "100%", padding: "10px" }}
              />
            </label>

            <label>
              Conductivity (S/m) *
              <input
                type="number"
                min="0"
                step="any"
                value={conductivity}
                onChange={(event) => setConductivity(event.target.value)}
                required
                style={{ display: "block", width: "100%", padding: "10px" }}
              />
            </label>

            <label>
              Relative Permittivity *
              <input
                type="number"
                min="0.000001"
                step="any"
                value={permittivity}
                onChange={(event) => setPermittivity(event.target.value)}
                required
                style={{ display: "block", width: "100%", padding: "10px" }}
              />
            </label>

            <label>
              Relative Permeability *
              <input
                type="number"
                min="0.000001"
                step="any"
                value={permeability}
                onChange={(event) => setPermeability(event.target.value)}
                required
                style={{ display: "block", width: "100%", padding: "10px" }}
              />
            </label>

            <label>
              Dielectric Loss Tangent *
              <input
                type="number"
                min="0"
                step="any"
                value={dielectricLoss}
                onChange={(event) => setDielectricLoss(event.target.value)}
                required
                style={{ display: "block", width: "100%", padding: "10px" }}
              />
            </label>

            <label>
              Magnetic Loss Tangent *
              <input
                type="number"
                min="0"
                step="any"
                value={magneticLoss}
                onChange={(event) => setMagneticLoss(event.target.value)}
                required
                style={{ display: "block", width: "100%", padding: "10px" }}
              />
            </label>
          </div>

          {formError && (
            <p style={{ color: "red" }}>{formError}</p>
          )}

          <button type="submit" style={{ padding: "10px 16px", marginTop: "16px" }}>
            Add Material
          </button>

          <button
            type="button"
            onClick={() => {
              resetCustomForm();
              setShowCustomForm(false);
            }}
            style={{ padding: "10px 16px", marginTop: "16px", marginLeft: "10px" }}
          >
            Cancel
          </button>
        </form>
      )}

      <p>
        Selected materials: <strong>{selectedMaterials.size}</strong>
      </p>

      {loading && <p>Loading materials...</p>}

      {error && <p style={{ color: "red" }}>{error}</p>}

      {!loading && !error && displayedMaterials.length === 0 && (
        <p>No materials found. Try another search or category.</p>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "16px",
        }}
      >
        {displayedMaterials.map((material) => {
          const isExpanded = expandedMaterials.has(material.id);
          const isSelected = selectedMaterials.has(material.id);

          return (
            <div
              key={material.id}
              style={{
                border: isSelected ? "2px solid #2563eb" : "1px solid #ddd",
                borderRadius: "10px",
                padding: "18px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <button
                  type="button"
                  onClick={() => toggleExpanded(material.id)}
                  aria-expanded={isExpanded}
                  style={{
                    border: "none",
                    background: "transparent",
                    padding: 0,
                    cursor: "pointer",
                    fontSize: "1.25rem",
                    fontWeight: 600,
                    textAlign: "left",
                    color: "inherit",
                  }}
                >
                  {material.name} {isExpanded ? "▲" : "▼"}
                </button>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelected(material.id)}
                  />
                  Select
                </label>
              </div>

              <p>Category: {material.category}</p>

              {isExpanded && (
                <div>
                  <h3>Electromagnetic Properties</h3>

                  <p>
                    Conductivity:{" "}
                    {formatProperty(material.properties.conductivity_s_m)} S/m
                  </p>

                  <p>
                    Relative Permittivity:{" "}
                    {formatProperty(material.properties.relative_permittivity)}
                  </p>

                  <p>
                    Relative Permeability:{" "}
                    {formatProperty(material.properties.relative_permeability)}
                  </p>

                  <p>
                    Dielectric Loss Tangent:{" "}
                    {formatProperty(material.properties.dielectric_loss_tangent)}
                  </p>

                  <p>
                    Magnetic Loss Tangent:{" "}
                    {formatProperty(material.properties.magnetic_loss_tangent)}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: "28px", textAlign: "right" }}>
  {mode === "single-layer" && selectedMaterials.size > 1 && (
    <p style={{ color: "red" }}>
      Single-layer simulation requires exactly one material.
    </p>
  )}

  {mode === "multilayer" && selectedMaterials.size === 1 && (
    <p style={{ color: "red" }}>
      Multilayer simulation requires at least two materials.
    </p>
  )}

  {selectedMaterials.size === 0 && (
    <p>Please select at least one material to continue.</p>
  )}

  <button
    type="button"
    onClick={handleNext}
    disabled={!canContinue || loading || !!error}
    style={{
      padding: "12px 28px",
      fontSize: "16px",
      cursor: canContinue ? "pointer" : "not-allowed",
      opacity: canContinue ? 1 : 0.5,
    }}
  >
    Next →
  </button>
</div>
    </div>
  );
}
