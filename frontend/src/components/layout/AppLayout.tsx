//this defines the common layout that appears across all pages of the application

import { Outlet, useLocation } from "react-router-dom";                             //Outlet - displays the current page in the shared layout
import Sidebar from "./Sidebar";                                                    

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/materials": "Material Library",
  "/single-layer": "Single-Layer Simulator",
  "/multilayer": "Multilayer Designer",
  "/frequency-analysis": "Frequency Analysis",
  "/optimization": "Material Optimization",
  "/results": "Results & Validation",
};

export default function AppLayout() {
  const location = useLocation();                                               //gets the URL of the current page
  const pageTitle = pageTitles[location.pathname] ?? "EM-Shield";               //adds the title to each page

  //the following defines the structure and content of the shared stuff like header, footer and sidebar
  return (
    <div className="app-shell">                                                
      <Sidebar />                                                               

      <div className="app-main">
        <header className="topbar">
          <div>
            <p className="eyebrow">EM-SHIELD WORKSPACE</p>
            <h1 className="topbar-title">{pageTitle}</h1>
          </div>

          <div className="topbar-status">
            <span className="status-dot" />
            <span>Development environment</span>
          </div>
        </header>

        <main className="page-content">
          <Outlet />
        </main>

        <footer className="app-footer">
          <span>EM-Shield</span>
          <span>
            Preliminary engineering analysis · Plane-wave model
          </span>
        </footer>
      </div>
    </div>
  );
}
