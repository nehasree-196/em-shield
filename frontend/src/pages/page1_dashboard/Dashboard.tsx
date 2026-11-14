import { useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  ArrowRight,
  Atom,
  Layers3,
  Boxes,
  Gauge,
  X,
  PlayCircle,
  Users,
} from "lucide-react";

const workspaces = [
  {
    title: "Single-Layer Simulation",
    description:
      "Analyse reflection, transmission, absorption, and shielding effectiveness of a single material slab.",
    icon: Layers3,
  },
  {
    title: "Multilayer Simulation",
    description:
      "Study electromagnetic shielding performance across an ordered combination of material layers.",
    icon: Boxes,
  },
  {
    title: "Material Optimization",
    description:
      "Identify material combinations that satisfy shielding requirements while minimizing total thickness.",
    icon: Gauge,
  },
];

const simulationModes = [
  {
    title: "Manage Materials",
    description: "Add custom materials or inspect the material library.",
    mode: "materials",
    path: "/materials",
    icon: Atom,
  },
  {
    title: "Single-Layer Simulation",
    description: "Analyse one material layer.",
    mode: "single-layer",
    path: "/single-layer",
    icon: Layers3,
  },
  {
    title: "Multilayer Simulation",
    description: "Design a stack of material layers.",
    mode: "multilayer",
    path: "/multilayer",
    icon: Boxes,
  },
  {
    title: "Material Optimization",
    description: "Find an optimized material configuration.",
    mode: "optimization",
    path: "/optimization",
    icon: Gauge,
  },
];

// Team members in the original order. Leader is indicated inline as "(Leader)".
const groupMembers = [
  { name: "Pragya Patni",             roll: "2401EE15", leader: true },
  { name: "Nimmagadda Kumuda Hasini", roll: "2401EE13", leader: false },
  { name: "Neha Sree Kuppam",         roll: "2402PC02", leader: false },
  { name: "Kodavath Yuvaraj Naik",    roll: "2401EE12", leader: false },
  
  { name: "Indurupati Prabhudeva",    roll: "2401EE27", leader: false },
];

export default function Dashboard() {
  const navigate = useNavigate();

  const [showPopup, setShowPopup] = useState(false);

  const handleSimulationSelection = (path: string) => {
    setShowPopup(false);
    navigate(path);
  };

  return (
    <div className="dashboard">

      {/* Dashboard Heading */}
      <section className="dashboard-heading">
        <div>
          <p className="eyebrow">
            ELECTROMAGNETIC SHIELDING ANALYSIS
          </p>

          <h2>Welcome to EM-Shield</h2>

          <p>
            Explore electromagnetic shielding performance,
            analyse material configurations, and investigate
            how frequency, material properties, and layer
            thickness influence wave transmission.
          </p>
        </div>

        <button
          className="primary-button"
          onClick={() => setShowPopup(true)}
        >
          <PlayCircle size={18} />
          Start Simulation
          <ArrowRight size={16} />
        </button>
      </section>

      {/* Three Workspace Information Cards */}
      <section aria-labelledby="workspace-heading">
        <div className="section-heading">
          <h3 id="workspace-heading">
            Simulation Workspaces
          </h3>

          <span>
            Explore the available simulation modules
          </span>
        </div>

        <div className="workspace-grid dashboard-workspace-grid">
          {workspaces.map((workspace) => {
            const Icon = workspace.icon;

            return (
              <div
                className="workspace-card dashboard-info-card"
                key={workspace.title}
              >
                <span className="workspace-icon">
                  <Icon size={22} />
                </span>

                <h4>{workspace.title}</h4>

                <p>{workspace.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Group Details — compact footer */}
      <section aria-labelledby="group-heading" className="group-footer">
        <div className="group-footer-heading">
          <Users size={14} />
          <h4 id="group-heading">Group Details</h4>
        </div>

        <ul className="group-footer-list">
          {groupMembers.map((member) => (
            <li key={member.roll} className="group-footer-item">
              <span className="group-footer-name">
                {member.name}
                {member.leader && " (Leader)"}
              </span>
              <span className="group-footer-roll">{member.roll}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Simulation Selection Popup */}
      {showPopup && (
        <div
          className="simulation-modal-overlay"
          onClick={() => setShowPopup(false)}
        >
          <div
            className="simulation-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="simulation-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="simulation-modal-header">
              <div>
                <p className="eyebrow">NEW SIMULATION</p>

                <h3 id="simulation-modal-title">
                  Choose Simulation Type
                </h3>

                <p>
                  Select how you want to analyse electromagnetic
                  shielding performance.
                </p>
              </div>

              <button
                className="modal-close-button"
                onClick={() => setShowPopup(false)}
                aria-label="Close popup"
              >
                <X size={19} />
              </button>
            </div>

            <div className="simulation-modal-options">
              {simulationModes.map((simulation) => {
                const Icon = simulation.icon;

                return (
                  <button
                    key={simulation.mode}
                    className="simulation-modal-option"
                    onClick={() =>
                      handleSimulationSelection(simulation.path)
                    }
                  >
                    <span className="simulation-option-icon">
                      <Icon size={23} />
                    </span>

                    <span className="simulation-option-content">
                      <strong>{simulation.title}</strong>
                      <small>{simulation.description}</small>
                    </span>

                    <ArrowRight
                      size={18}
                      className="simulation-option-arrow"
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}