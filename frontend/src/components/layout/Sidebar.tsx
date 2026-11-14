//this creates the navigation sidebar for the application

import { NavLink } from "react-router-dom";                         //creates the link for user to another page in the application
import {
  Activity,
  Atom,
  Boxes,
  FileCheck2,
  Gauge,
  Home,
  Layers3,
} from "lucide-react";

//this array contains all the seven elements that need to be created in the sidebar
const navigation = [

    //label - the name displayed to the user
    //path - url that open upon clicking this link
    //icon - icon to be displayed with the label
    //description - shown near the link

  {
    label: "Dashboard",
    path: "/",
    icon: Home,
    description: "Project overview",
  },
  {
    label: "Material Library",
    path: "/materials",
    icon: Atom,
    description: "Material properties",
  },
  {
    label: "Single-Layer",
    path: "/single-layer",
    icon: Layers3,
    description: "Individual slab analysis",
  },
  {
    label: "Multilayer Designer",
    path: "/multilayer",
    icon: Boxes,
    description: "Layer stack design",
  },
  {
    label: "Frequency Analysis",
    path: "/frequency-analysis",
    icon: Activity,
    description: "Frequency response",
  },
  {
    label: "Material Optimization",
    path: "/optimization",
    icon: Gauge,
    description: "Thickness & mass optimization",
  },
  {
    label: "Results & Export",
    path: "/results",
    icon: FileCheck2,
    description: "Validation and reports",
  },
];

export default function Sidebar() {

    //brand - this makes the brand icon clickable to navigate to the home page
    //the map part - this goes through each item in the array above and creates a corresponding react element
    
  return (
    <aside className="sidebar">
      <NavLink to="/" className="brand">
        <span className="brand-symbol">
          <Activity size={23} />
        </span>

        <span className="brand-copy">
          <strong>EM-SHIELD</strong>
          <small>Engineering simulator</small>
        </span>
      </NavLink>

      <div className="sidebar-section-label">WORKSPACE</div>

      <nav className="sidebar-nav" aria-label="Main navigation">
        {navigation.map(({ label, path, icon: Icon, description }) => (
          <NavLink
            key={path}
            to={path}
            end={path === "/"}
            className={({ isActive }) =>
              `nav-link${isActive ? " nav-link-active" : ""}`
            }
          >
            <Icon size={19} strokeWidth={1.8} />

            <span className="nav-link-copy">
              <span className="nav-link-title">{label}</span>
              <span className="nav-link-description">
                {description}
              </span>
            </span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}