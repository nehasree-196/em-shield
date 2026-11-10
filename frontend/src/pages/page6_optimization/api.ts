// api.ts
import type { Material, OptimizationRequest, RunResult, FilterRequest } from "./types";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export const fetchMaterials = () =>
  fetch(`${API}/materials`).then((r) => json<Material[]>(r));

export const fetchMaterial = (id: string) =>
  fetch(`${API}/materials/${encodeURIComponent(id)}`).then((r) => json<Material>(r));

export const runOptimization = (req: OptimizationRequest) =>
  fetch(`${API}/api/optimization/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  }).then((r) => json<RunResult>(r));

export const filterRun = (req: FilterRequest) =>
  fetch(`${API}/api/optimization/filter`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  }).then((r) => json<{ run_id: string; matches: number; candidates: Candidate[] }>(r));