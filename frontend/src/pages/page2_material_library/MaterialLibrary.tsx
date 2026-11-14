import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { type Material, type MaterialCategory } from "../../services/api";
import { useWorkspace } from "../../context/WorkspaceContext";

function formatProperty(value: number | null | undefined): string {
  return value == null ? "—" : value.toLocaleString();
}

export default function MaterialLibrary() {
  const mode = new URLSearchParams(window.location.search).get("mode");
  const navigate = useNavigate();

  const workspace = useWorkspace();
  const materials: Material[] = Array.isArray(workspace?.materials)
    ? workspace.materials
    : [];
  const sessionMaterials: Material[] = Array.isArray(workspace?.sessionMaterials)
    ? workspace.sessionMaterials
    : [];
  const addSessionMaterial =
    typeof workspace?.addSessionMaterial === "function"
      ? workspace.addSessionMaterial
      : () => {};
  const removeSessionMaterial =
    typeof workspace?.removeSessionMaterial === "function"
      ? workspace.removeSessionMaterial
      : () => {};
  const materialsError = workspace?.materialsError || "";

  const [showDestinationChoice, setShowDestinationChoice] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<MaterialCategory | "">("");
  const [expandedMaterials, setExpandedMaterials] = useState<Set<string>>(
    new Set()
  );

  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customCategory, setCustomCategory] =
    useState<MaterialCategory>("Conductor");
  const [conductivity, setConductivity] = useState("");
  const [permittivity, setPermittivity] = useState("");
  const [permeability, setPermeability] = useState("");
  const [dielectricLoss, setDielectricLoss] = useState("");
  const [magneticLoss, setMagneticLoss] = useState("");
  const [massDensity, setMassDensity] = useState("");
  const [formError, setFormError] = useState("");

  function toggleExpanded(materialId: string) {
    setExpandedMaterials((prev) => {
      const next = new Set(prev);
      next.has(materialId) ? next.delete(materialId) : next.add(materialId);
      return next;
    });
  }

  function resetCustomForm() {
    setCustomName("");
    setConductivity("");
    setPermittivity("");
    setPermeability("");
    setDielectricLoss("");
    setMagneticLoss("");
    setMassDensity("");
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
      massDensity,
    ].map(Number);

    const [
      conductivityValue,
      permittivityValue,
      permeabilityValue,
      dielectricLossValue,
      magneticLossValue,
      massDensityValue,
    ] = values;

    if (!name) return setFormError("Please enter a material name.");
    if (values.some((v) => !Number.isFinite(v)))
      return setFormError(
        "Please enter valid numerical values for all properties."
      );
    if (
      conductivityValue < 0 ||
      dielectricLossValue < 0 ||
      magneticLossValue < 0 ||
      massDensityValue < 0
    )
      return setFormError(
        "Conductivity, loss tangents, and mass density cannot be negative."
      );
    if (permittivityValue <= 0 || permeabilityValue <= 0)
      return setFormError(
        "Relative permittivity and permeability must be greater than zero."
      );
    if (materials.some((m) => m.name.toLowerCase() === name.toLowerCase()))
      return setFormError("A material with this name already exists.");

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const newMaterial: Material = {
      id: `custom-${slug}-${Date.now()}`,
      name,
      category: customCategory,
      properties: {
        conductivity_s_m: conductivityValue,
        relative_permittivity: permittivityValue,
        relative_permeability: permeabilityValue,
        dielectric_loss_tangent: dielectricLossValue,
        magnetic_loss_tangent: magneticLossValue,
        mass_density: massDensityValue,
      },
      sources: [],
      frequency_dependent_properties: [],
    };

    addSessionMaterial(newMaterial);

    setExpandedMaterials((prev) => {
      const next = new Set(prev);
      next.add(newMaterial.id);
      return next;
    });

    resetCustomForm();
    setCustomCategory("Conductor");
    setShowCustomForm(false);
    setSearch("");
    setCategory("");
  }

  const sessionIds = new Set(sessionMaterials.map((m) => m.id));

  const displayedMaterials = materials.filter((material) => {
    const matchesSearch = material.name
      .toLowerCase()
      .includes(search.trim().toLowerCase());
    const matchesCategory = !category || material.category === category;
    return matchesSearch && matchesCategory;
  });

  function handleNext() {
    if (mode === "single-layer") {
      navigate("/single-layer");
    } else if (mode === "multilayer") {
      navigate("/multilayer");
    } else if (mode === "optimization") {
      navigate("/optimization");
    } else {
      setShowDestinationChoice(true);
    }
  }

  return (
    <div className="dashboard">
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">MATERIAL DATABASE</p>
          <h2>Material Library</h2>
          <p>
            Browse, explore, and select materials based on their electromagnetic
            properties. You can also add custom materials to the library.
          </p>
        </div>
      </div>

      <div className="material-toolbar">
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
        </select>
        <button
    type="button"
    className="primary-button"
    onClick={() => {
      setShowCustomForm((previous) => !previous);
      setFormError("");
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
          <p>
            Enter the electromagnetic properties. Custom materials are available
            for this session only and are cleared when the tab closes.
          </p>
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
              Material Category *
              <select
                value={customCategory}
                onChange={(event) =>
                  setCustomCategory(event.target.value as MaterialCategory)
                }
                required
                style={{ display: "block", width: "100%", padding: "10px" }}
              >
                <option value="Conductor">Conductor</option>
                <option value="Insulator">Insulator</option>
                <option value="Semiconductor">Semiconductor</option>
              </select>
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
            <label>
              Mass Density *
              <input
                type="number"
                min="0"
                step="any"
                value={massDensity}
                onChange={(event) => setMassDensity(event.target.value)}
                required
                style={{ display: "block", width: "100%", padding: "10px" }}
              />
            </label>
          </div>

          {formError && <p style={{ color: "red" }}>{formError}</p>}

          <button
            type="button"
            className="primary-button"
            onClick={handleNext}
          >
            Add Material
          </button>
          <button
            type="button"
            onClick={() => {
              resetCustomForm();
              setShowCustomForm(false);
            }}
            style={{
              padding: "10px 16px",
              marginTop: "16px",
              marginLeft: "10px",
            }}
          >
            Cancel
          </button>
        </form>
      )}

      {materialsError && (
        <p style={{ color: "red" }}>Could not load materials: {materialsError}</p>
      )}
      {!materialsError && materials.length === 0 && <p>Loading materials...</p>}
      {!materialsError && materials.length > 0 && displayedMaterials.length === 0 && (
        <p>No materials found. Try another search or category.</p>
      )}

      <div className="workspace-grid">
        {displayedMaterials.map((material) => {
          const isExpanded = expandedMaterials.has(material.id);
          const isSession = sessionIds.has(material.id);

          return (
            <div
              key={material.id}
              className="workspace-card"
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

                {isSession && (
                  <button
                    type="button"
                    onClick={() => removeSessionMaterial(material.id)}
                    title="Remove this session material"
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "#c00",
                      cursor: "pointer",
                      fontSize: "12px",
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>

              <p>
                Category: {material.category}
                {isSession && (
                  <span
                    style={{
                      marginLeft: 8,
                      fontSize: 11,
                      color: "#0a7",
                      fontWeight: 600,
                    }}
                  >
                    (session only)
                  </span>
                )}
              </p>

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
                  <p>
                    Mass Density:{" "}
                    {formatProperty(material.properties.mass_density)}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: "28px", textAlign: "right" }}>
        <button
          type="button"
          className="primary-button"
          onClick={handleNext}
        >
          Next →
        </button>
      </div>

      {showDestinationChoice && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            style={{
              background: "white",
              padding: "28px",
              borderRadius: "12px",
              width: "min(90%, 420px)",
            }}
          >
            <h2>Choose Simulation Type</h2>
            <p>Where would you like to continue?</p>

            <div
              style={{ display: "flex", flexDirection: "column", gap: "12px" }}
            >
              <button type="button" onClick={() => navigate("/single-layer")}>
                Single-Layer Simulation
              </button>
              <button type="button" onClick={() => navigate("/multilayer")}>
                Multilayer Simulation
              </button>
              <button type="button" onClick={() => navigate("/optimization")}>
                Material Optimization
              </button>
              <button
                type="button"
                onClick={() => setShowDestinationChoice(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}