export type Material = {
  id: string;
  name?: string;
  category?: string;
  properties: {
    conductivity_s_m: number;
    relative_permittivity: number;
    relative_permeability: number;
    dielectric_loss_tangent?: number;
    magnetic_loss_tangent?: number;
    mass_density_kg_m3?: number;
  };
  min_thickness_m?: number;
  max_thickness_m?: number;
  reference_frequency_hz?: number;
  frequency_dependent_properties?: unknown[];
};

export type OptimizationRequest = {
  materials: Material[];
  target_se_db?: number;
  frequency_min_hz?: number;
  frequency_max_hz?: number;
  max_incidence_angle_deg?: number;
  max_layers?: number;
  default_min_layer_thickness_m?: number;
  default_max_layer_thickness_m?: number;
  objective: "thickness" | "mass";
  max_mass_kg_m2?: number;
  must_include_ids: string[];
  top_k?: number;
  effort: "quick" | "normal" | "thorough";
  safety_margin_db?: number;
  seed?: number;
};

export type CandidateLayer = {
  order: number;
  material_id: string;
  material_name: string;
  thickness_m: number;
};

export type Candidate = {
  rank: number;
  layers: CandidateLayer[];
  layer_count: number;
  total_thickness_m: number;
  areal_mass_kg_m2: number | null;
  worst_case_se_db: number;
  margin_db: number;
  worst_case_frequency_hz: number;
  worst_case_angle_deg: number;
  worst_case_polarization: "TE" | "TM";
  passes_dense_validation: boolean;
  warnings: string[];
};

export type RunResult = {
  run_id: string;
  feasible_found: boolean;
  message: string;
  objective: "thickness" | "mass";
  target_se_db: number;
  solver_evaluations: number;
  runtime_s: number;
  search_grid: { frequencies: number; angles: number };
  validation_grid: { frequencies: number; angles: number };
  distinct_candidates_found: number;
  candidates: Candidate[];
  notes: string[];
};

export type FilterRequest = {
  run_id: string;
  include_ids?: string[];
  exclude_ids?: string[];
  max_layers?: number;
  max_total_thickness_m?: number;
  max_mass_kg_m2?: number;
  min_margin_db?: number;
  only_validated?: boolean;
  sort_by?: "objective" | "thickness" | "mass" | "margin" | "layers";
  top_k?: number;
};

export type FilterResponse = {
  run_id: string;
  matches: number;
  candidates: Candidate[];
};

export const MATERIAL_COLOR: Record<string, string> = {
  copper_c11000: "#d97706",
  aluminium_6061_t6: "#64748b",
  silver_pure: "#94a3b8",
  brass_c26000: "#ca8a04",
  nickel_200: "#475569",
  stainless_steel_304: "#334155",
  fr4_isola_185hr: "#059669",
  ptfe_virgin: "#10b981",
  copper: "#d97706",
  aluminium: "#64748b",
  aluminum: "#64748b",
  steel: "#334155",
  fr4: "#059669",
};

export function getMaterialColor(id: string) {
  const key = id.toLowerCase();
  if (MATERIAL_COLOR[key]) return MATERIAL_COLOR[key];
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = key.charCodeAt(i) + ((hash << 5) - hash);
  const c = (hash & 0x00ffffff).toString(16).toUpperCase();
  return "#" + "00000".substring(0, 6 - c.length) + c;
}