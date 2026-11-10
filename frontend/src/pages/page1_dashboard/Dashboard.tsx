import { useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  ArrowRight,
  Layers3,
  Boxes,
  Gauge,
  X,
  PlayCircle,
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
    title: "Single-Layer Simulation",
    description: "Analyse one material layer.",
    mode: "single-layer",
    icon: Layers3,
  },
  {
    title: "Multilayer Simulation",
    description: "Design a stack of material layers.",
    mode: "multilayer",
    icon: Boxes,
  },
  {
    title: "Material Optimization",
    description: "Find an optimized material configuration.",
    mode: "optimization",
    icon: Gauge,
  },
];

export default function Dashboard() {
  const navigate = useNavigate();

  const [showPopup, setShowPopup] = useState(false);

  const handleSimulationSelection = (mode: string) => {
    setShowPopup(false);

    // Route optimization directly to the Page 6 optimizer
    if (mode === "optimization") {
      navigate("/optimization");
    } else {
      // For single-layer and multilayer, go to material selection first
      navigate(`/materials?mode=${mode}`);
    }
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
                      handleSimulationSelection(simulation.mode)
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

            <div className="simulation-modal-footer">
              <span>
                You will select your materials in the next step.
              </span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}