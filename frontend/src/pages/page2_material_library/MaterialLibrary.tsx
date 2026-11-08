
import { useEffect, useState } from "react";
import {
  getMaterials,
  type Material,
  type MaterialCategory,
} from "../../services/api";

function formatProperty(value: number | null | undefined): string {
  return value == null ? "Not available" : value.toLocaleString();
}

export default function MaterialLibrary() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<MaterialCategory | "">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function fetchMaterials() {
      setLoading(true);
      setError("");

      try {
        const data = await getMaterials(
          search.trim() || undefined,
          category || undefined
        );

        if (!cancelled) {
          setMaterials(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load materials."
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
  }, [search, category]);

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
          <option value="conductor">Conductor</option>
          <option value="insulator">Insulator</option>
          <option value="semiconductor">Semiconductor</option>
          <option value="magnetic">Magnetic</option>
          <option value="other">Other</option>
        </select>
      </div>

      {loading && <p>Loading materials...</p>}

      {error && <p style={{ color: "red" }}>{error}</p>}

      {!loading && !error && materials.length === 0 && (
        <p>No materials found. Try another search or category.</p>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "16px",
        }}
      >
        {materials.map((material) => {
          // Safely handle missing nested properties.
          const properties = material.properties ?? {};
          const sources = material.sources ?? [];

          return (
            <div
              key={material.id}
              style={{
                border: "1px solid #ddd",
                borderRadius: "10px",
                padding: "18px",
              }}
            >
              <h2>{material.name}</h2>
              <p>Category: {material.category ?? "Not specified"}</p>

              <h3>Electromagnetic Properties</h3>

              <p>
                Conductivity:{" "}
                {formatProperty(properties.conductivity_s_m)}
                {properties.conductivity_s_m != null ? " S/m" : ""}
              </p>

              <p>
                Relative Permittivity:{" "}
                {formatProperty(properties.relative_permittivity)}
              </p>

              <p>
                Relative Permeability:{" "}
                {formatProperty(properties.relative_permeability)}
              </p>

              <p>
                Dielectric Loss Tangent:{" "}
                {formatProperty(properties.dielectric_loss_tangent)}
              </p>

              <p>
                Magnetic Loss Tangent:{" "}
                {formatProperty(properties.magnetic_loss_tangent)}
              </p>

              {material.reference_frequency_hz != null && (
                <p>
                  Reference Frequency:{" "}
                  {material.reference_frequency_hz.toLocaleString()} Hz
                </p>
              )}

              {sources.length > 0 && (
                <div>
                  <h3>Data Sources</h3>

                  {sources.map((source, index) => (
                    <p key={`${source.property}-${index}`}>
                      {source.property}:{" "}
                      {source.url ? (
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {source.reference}
                        </a>
                      ) : (
                        source.reference
                      )}
                    </p>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
