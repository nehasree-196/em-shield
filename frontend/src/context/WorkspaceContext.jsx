// WorkspaceContext.jsx — shared state: material list, active single-layer design, active stack, latest sweep.
import { createContext, useContext, useEffect, useState } from 'react';
import { getMaterials } from '../services/api';

const WorkspaceContext = createContext(null);

export function WorkspaceProvider({ children }) {
  const [materials, setMaterials] = useState([]);
  const [materialsError, setMaterialsError] = useState('');
  const [activeSingle, setActiveSingle] = useState(null); // {layers:[{material,thickness_m}], label, frequency_hz}
  const [activeStack, setActiveStack] = useState(null);   // {layers:[...], label, frequency_hz}
  const [lastSweep, setLastSweep] = useState(null);       // read by Page 7

  // load the material library once for all pages
  useEffect(() => {
    getMaterials().then(setMaterials).catch((e) => setMaterialsError(e.message));
  }, []);

  const value = { materials, materialsError, activeSingle, setActiveSingle, activeStack, setActiveStack, lastSweep, setLastSweep };
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export const useWorkspace = () => useContext(WorkspaceContext);
