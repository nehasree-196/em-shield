//this defines the common layout that appears across all pages of the application

import { Outlet } from "react-router-dom";                             //Outlet - displays the current page in the shared layout
import Sidebar from "./Sidebar";

// pageTitles was only used by the (now removed) topbar; delete it too.

export default function AppLayout() {
  //the following defines the structure and content of the shared stuff like header, footer and sidebar
  return (
    <div className="app-shell">
      <Sidebar />

      <div className="app-main">
        <main className="page-content">
          <Outlet />
        </main>

        <footer className="app-footer">
          <span>EM-Shield</span>
        </footer>
      </div>
    </div>
  );
}