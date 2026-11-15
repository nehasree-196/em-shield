// frontend/src/services/api.ts — the only module that talks to the FastAPI backend.
// Requests go through the Vite /api proxy (vite.config.ts, no rewrite).

export const API_BASE_URL = "/api";

export type MaterialCategory = "Conductor" | "Insulator" | "Semiconductor";

export interface MaterialProperties {
  conductivity_s_m: number | null;
  relative_permittivity: number | null;
  relative_permeability: number | null;
  dielectric_loss_tangent: number | null;
  magnetic_loss_tangent: number | null;
  mass_density: number | null;
}

export interface MaterialSource {
  property: string;
  reference: string;
  url?: string | null;
}

export interface FrequencyDependentProperties {
  frequency_hz: number;
  properties: MaterialProperties;
  temperature_c?: number | null;
  sources: MaterialSource[];
}

export interface Material {
  id: string;
  name: string;
  category: MaterialCategory;
  grade?: string | null;
  composition?: string | null;
  properties: MaterialProperties;
  reference_frequency_hz?: number | null;
  temperature_c?: number | null;
  valid_frequency_min_hz?: number | null;
  valid_frequency_max_hz?: number | null;
  sources: MaterialSource[];
  frequency_dependent_properties: FrequencyDependentProperties[];
}

export type MaterialCreate = Material;

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({} as any));
    const detail = Array.isArray(body?.detail)
      ? body.detail
          .map((d: any) => `${(d.loc || []).slice(1).join(".")}: ${d.msg}`)
          .join("; ")
      : body?.detail || `API request failed: ${response.status}`;
    throw new Error(detail);
  }

  return response.json() as Promise<T>;
}

// ---------------------------------------------------------
// MATERIALS
// ---------------------------------------------------------
export function getMaterials(
  name?: string,
  category?: MaterialCategory
): Promise<Material[]> {
  const params = new URLSearchParams();
  if (name) params.set("name", name);
  if (category) params.set("category", category);
  const q = params.toString();
  return request<Material[]>(`/materials${q ? `?${q}` : ""}`);
}

export function getMaterial(materialId: string): Promise<Material> {
  return request<Material>(`/materials/${encodeURIComponent(materialId)}`);
}

export function createMaterial(material: MaterialCreate): Promise<Material> {
  return request<Material>("/materials", {
    method: "POST",
    body: JSON.stringify(material),
  });
}

// ---------------------------------------------------------
// SIMULATION
// ---------------------------------------------------------
export const runSingleLayer = (body: unknown) =>
  request("/single-layer", { method: "POST", body: JSON.stringify(body) });

export const runMultilayer = (body: unknown) =>
  request("/multilayer", { method: "POST", body: JSON.stringify(body) });

export const runSweep = (body: unknown) =>
  request("/sweep", { method: "POST", body: JSON.stringify(body) });

export const runMultilayerAnalysis = (body: unknown) =>
  request("/multilayer/analysis", { method: "POST", body: JSON.stringify(body) });

export const runMultilayerDetails = (body: unknown) =>
  request("/multilayer/details", { method: "POST", body: JSON.stringify(body) });