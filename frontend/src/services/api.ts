
export const API_BASE_URL = "http://localhost:8000";

// Material categories supported by the backend
export type MaterialCategory =
  | "Conductor"
  | "Insulator"
  | "Semiconductor"

// Electromagnetic properties of a material
export interface MaterialProperties {
  conductivity_s_m: number | null;
  relative_permittivity: number | null;
  relative_permeability: number | null;
  dielectric_loss_tangent: number | null;
  magnetic_loss_tangent: number | null;
}

// Source or reference for material data
export interface MaterialSource {
  property: string;
  reference: string;
  url?: string | null;
}

// Properties measured at a particular frequency
export interface FrequencyDependentProperties {
  frequency_hz: number;
  properties: MaterialProperties;
  temperature_c?: number | null;
  sources: MaterialSource[];
}

// Complete material structure
export interface Material {
  id: string;
  name: string;
  category: MaterialCategory;
  properties: MaterialProperties;
  reference_frequency_hz?: number | null;
  temperature_c?: number | null;
  sources: MaterialSource[];
  frequency_dependent_properties: FrequencyDependentProperties[];
}

// Data required to create a material
export type MaterialCreate = Material;

// Handle API responses and errors
async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(
      error?.detail || `API request failed: ${response.status}`
    );
  }

  return response.json() as Promise<T>;
}

// Fetch all materials, with optional filters
export function getMaterials(
  name?: string,
  category?: MaterialCategory
): Promise<Material[]> {
  const params = new URLSearchParams();

  if (name) params.set("name", name);
  if (category) params.set("category", category);

  const query = params.toString();
  return request<Material[]>(`/materials${query ? `?${query}` : ""}`);
}

// Fetch one material by its ID
export function getMaterial(materialId: string): Promise<Material> {
  return request<Material>(`/materials/${encodeURIComponent(materialId)}`);
}

// Add a custom material
export function createMaterial(material: MaterialCreate): Promise<Material> {
  return request<Material>("/materials", {
    method: "POST",
    body: JSON.stringify(material),
  });
}
