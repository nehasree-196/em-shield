import { createContext, useContext, useEffect, useState } from 'react';
import { getMaterials } from '../services/api';

const WorkspaceContext = createContext(null);
const SESSION_MATERIALS_KEY = 'emShield.sessionMaterials';

function readSessionMaterials() {
  try {
    const raw = sessionStorage.getItem(SESSION_MATERIALS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSessionMaterials(list) {
  try {
    sessionStorage.setItem(SESSION_MATERIALS_KEY, JSON.stringify(list));
  } catch { /* ignore */ }
}

const EMPTY_WORKSPACE = {
  materials: [],
  materialsError: '',
  sessionMaterials: [],
  addSessionMaterial: () => {},
  removeSessionMaterial: () => {},
  activeSingle: null,
  setActiveSingle: () => {},
  activeStack: null,
  setActiveStack: () => {},
  lastSweep: null,
  setLastSweep: () => {},
  report: { single: null, stack: null, sweep: null },
  stageForReport: () => {},
  clearReport: () => {},
};

export function WorkspaceProvider({ children }) {
  const [backendMaterials, setBackendMaterials] = useState([]);
  const [materialsError, setMaterialsError] = useState('');
  const [sessionMaterials, setSessionMaterials] = useState(readSessionMaterials);
  const [activeSingle, setActiveSingle] = useState(null);
  const [activeStack, setActiveStack] = useState(null);
  const [lastSweep, setLastSweep] = useState(null);
  const [report, setReport] = useState({ single: null, stack: null, sweep: null });

  useEffect(() => {
    getMaterials()
      .then((list) => setBackendMaterials(Array.isArray(list) ? list : []))
      .catch((e) => setMaterialsError(e?.message || String(e)));
  }, []);

  const addSessionMaterial = (material) => {
    setSessionMaterials((prev) => {
      const next = [...prev.filter((m) => m.id !== material.id), material];
      writeSessionMaterials(next);
      return next;
    });
  };

  const removeSessionMaterial = (id) => {
    setSessionMaterials((prev) => {
      const next = prev.filter((m) => m.id !== id);
      writeSessionMaterials(next);
      return next;
    });
  };

  const stageForReport = (key, value) => {
    setReport((prev) => ({ ...prev, [key]: value }));
  };

  const clearReport = () => setReport({ single: null, stack: null, sweep: null });

  const sessionIds = new Set(sessionMaterials.map((m) => m.id));
  const materials = [
    ...sessionMaterials,
    ...backendMaterials.filter((m) => !sessionIds.has(m.id)),
  ];

  const value = {
    materials,
    materialsError,
    sessionMaterials,
    addSessionMaterial,
    removeSessionMaterial,
    activeSingle,
    setActiveSingle,
    activeStack,
    setActiveStack,
    lastSweep,
    setLastSweep,
    report,
    stageForReport,
    clearReport,
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export const useWorkspace = () => {
  const ctx = useContext(WorkspaceContext);
  return ctx ?? EMPTY_WORKSPACE;
};