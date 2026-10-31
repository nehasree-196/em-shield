//this is just a test file


import { Link } from "react-router-dom";
import {
  ArrowRight,
  Atom,
  Activity,
  Layers3,
  Boxes,
  Gauge,
  Clock3,
  ShieldCheck,
  Waves,
  ChartNoAxesCombined,
} from "lucide-react";

const workspaces = [
  {
    title: "Material Library",
    description:
      "Browse documented material properties or prepare custom material definitions.",
    path: "/materials",
    icon: Atom,
    action: "Explore materials",
  },
  {
    title: "Single-Layer Simulator",
    description:
      "Study the shielding response of an individual uniform material slab.",
    path: "/single-layer",
    icon: Layers3,
    action: "Open simulator",
  },
  {
    title: "Multilayer Designer",
    description:
      "Build an ordered stack of material layers and study its combined response.",
    path: "/multilayer",
    icon: Boxes,
    action: "Design a stack",
  },
  {
    title: "Frequency Analysis",
    description:
      "Examine reflection, transmission, and shielding effectiveness over a frequency band.",
    path: "/frequency-analysis",
    icon: Activity,
    action: "Analyze frequency",
  },
  {
    title: "Material Optimization",
    description:
      "Search candidate material stacks against shielding and thickness constraints.",
    path: "/optimization",
    icon: Gauge,
    action: "Open optimizer",
  },
  {
    title: "Results & Validation",
    description:
      "Review calculated results, validation checks, and report export options.",
    path: "/results",
    icon: ChartNoAxesCombined,
    action: "View results",
  },
];

export default function Dashboard() {
  return (
    <div className="dashboard">
      <section className="dashboard-heading">
        <div>
          <p className="eyebrow">ELECTROMAGNETIC COMPATIBILITY</p>
          <h2>Welcome to EM-Shield</h2>
          <p>
            Explore electromagnetic shielding performance, compare material
            configurations, and investigate how frequency and layer thickness
            influence wave transmission.
          </p>
        </div>

        <Link to="/single-layer" className="primary-button">
          <Activity size={17} />
          New Simulation
          <ArrowRight size={16} />
        </Link>
      </section>

      <section aria-labelledby="workspace-heading">
        <div className="section-heading">
          <h3 id="workspace-heading">Simulation workspaces</h3>
          <span>Choose a module to get started</span>
        </div>

        <div className="workspace-grid">
          {workspaces.map((workspace) => {
            const Icon = workspace.icon;

            return (
              <Link
                to={workspace.path}
                className="workspace-card"
                key={workspace.path}
              >
                <span className="workspace-icon">
                  <Icon size={21} />
                </span>

                <h4>{workspace.title}</h4>
                <p>{workspace.description}</p>

                <span className="card-link">
                  {workspace.action}
                  <ArrowRight size={14} />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="dashboard-lower-grid">
        <section className="panel" aria-labelledby="recent-heading">
          <div className="section-heading">
            <h3 id="recent-heading">Recent simulations</h3>
            <Clock3 size={17} />
          </div>

          <div className="empty-state">
            <span className="empty-state-icon">
              <Waves size={21} />
            </span>

            <strong>No saved simulations yet</strong>

            <p>
              Your recent work can appear here once simulation history and
              local persistence have been implemented.
            </p>

            <Link to="/single-layer" className="secondary-button">
              Start your first simulation
            </Link>
          </div>
        </section>

        <section className="panel" aria-labelledby="model-heading">
          <div className="section-heading">
            <h3 id="model-heading">About the physical model</h3>
            <ShieldCheck size={18} />
          </div>

          <div className="model-list">
            <div className="model-item">
              <ShieldCheck size={17} />
              <div>
                <strong>Wave propagation theory</strong>
                <p>
                  The planned calculation engine models electromagnetic
                  waves interacting with material boundaries.
                </p>
              </div>
            </div>

            <div className="model-item">
              <Layers3 size={17} />
              <div>
                <strong>Single and multilayer structures</strong>
                <p>
                  The intended scope is normally incident plane waves
                  interacting with uniform planar layers.
                </p>
              </div>
            </div>

            <div className="model-item">
              <ChartNoAxesCombined size={17} />
              <div>
                <strong>Numerical analysis</strong>
                <p>
                  The planned Python engine will calculate reflection,
                  transmission, absorption, and shielding effectiveness.
                </p>
              </div>
            </div>
          </div>

          <div className="model-note">
            Development status: the interface is being initialized.
            Numerical results will be available after the calculation
            engine is implemented and validated.
          </div>
        </section>
      </div>
    </div>
  );
}
