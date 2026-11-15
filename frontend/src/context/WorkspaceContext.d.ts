// Type declarations for WorkspaceContext.jsx
// Lets .tsx files import typed values from the JS module without converting it.
import type { ReactNode } from "react";
import type { Material } from "../services/api";

export interface ActiveDesign {
  label: string;
  frequency_hz?: number;
  layers: Array<{ material: unknown; thickness_m: number }>;
}

export interface StagedSingle {
  label: string;
  request: unknown;
  response: unknown;
}

export interface StagedStack {
  label: string;
  fixed_request: unknown;
  analysis_request?: unknown;
}

export interface StagedSweep {
  label: string;
  request: { spacing?: "log" | "linear"; [k: string]: unknown };
  response: unknown;
}

export interface ReportPayload {
  single?: StagedSingle;
  stack?: StagedStack;
  sweep?: StagedSweep;
}

export interface WorkspaceContextValue {
  materials: Material[];
  sessionMaterials: Material[];
  materialsError: string;
  addSessionMaterial: (material: Material) => void;
  removeSessionMaterial: (materialId: string) => void;
  activeSingle: ActiveDesign | null;
  setActiveSingle: (design: ActiveDesign) => void;
  activeStack: ActiveDesign | null;
  setActiveStack: (design: ActiveDesign) => void;
  lastSweep: unknown;
  setLastSweep: (sweep: unknown) => void;
  stageForReport: (kind: string, payload: StagedSingle | StagedStack | StagedSweep) => void;
  report: ReportPayload | null;
  clearReport: () => void;
}

export function WorkspaceProvider(props: { children: ReactNode }): JSX.Element;
export function useWorkspace(): WorkspaceContextValue;