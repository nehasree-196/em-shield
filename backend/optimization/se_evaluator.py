"""
se_evaluator.py - vectorized worst-case shielding-effectiveness evaluator.

Wraps the multilayer physics for the optimizer. Given the user's materials and the
search / validation grids (frequencies x angles x {TE, TM}), exposes:

    SEEvaluator(materials, frequencies_hz, angles_deg)
        .worst_se(stack)             -> worst-case SE in dB over the whole grid
        .worst_case_info(stack)      -> dict with worst case and where it occurred
        .mass_cost(stack)            -> areal mass in kg/m^2 (needs mass_density_kg_m3)

    to_solver_materials(materials)   -> the dict expected by
                                        physics.multilayer_solver_optimization

Each stack is [(material_id, thickness_m), ...], ordered from the incident side.
The physics is the same scattering-matrix cascade as the reference solver; this
module exists to run it once over the whole grid without the Python loop overhead.
A dedicated test (test_physics_agreement.py) asserts the two agree.
"""
import numpy as np

from physics.multilayer_solver_optimization import calculate_se

EPS0 = 8.854187817e-12
MU0 = 4.0 * np.pi * 1e-7


def to_solver_materials(materials):
    """Optimization materials -> the dict the reference solver expects."""
    out = {}
    for m in materials:
        props = m["properties"]
        out[m["id"]] = {
            "sigma": float(props.get("conductivity_s_m") or 0.0),
            "epsilon_r": float(props.get("relative_permittivity") or 1.0),
            "mu_r": float(props.get("relative_permeability") or 1.0),
            "tan_delta_e": float(props.get("dielectric_loss_tangent") or 0.0),
            "tan_delta_m": float(props.get("magnetic_loss_tangent") or 0.0),
        }
    return out


class SEEvaluator:
    def __init__(self, materials, frequencies_hz, angles_deg):
        self.materials = list(materials)
        self.solver_materials = to_solver_materials(self.materials)
        self.densities = {m["id"]: m["properties"].get("mass_density_kg_m3")
                          for m in self.materials}

        self.frequencies = np.asarray(frequencies_hz, dtype=float)
        angles = np.asarray(angles_deg, dtype=float) if not np.isscalar(angles_deg) \
            else np.array([float(angles_deg)])
        self.angles_rad = np.radians(angles)
        self.angles_deg = angles
        self.polarizations = ("TE", "TM")

    # ------------------------------------------------------------------
    def _se_grid(self, stack):
        """SE[frequency, angle, polarization] for one stack."""
        layers = [{"material": m, "thickness": float(d)} for m, d in stack]
        se = np.empty((len(self.frequencies), len(self.angles_rad), 2))
        for i, f in enumerate(self.frequencies):
            for j, theta in enumerate(self.angles_rad):
                for k, pol in enumerate(self.polarizations):
                    se[i, j, k] = calculate_se(f, layers, theta, pol, self.solver_materials)
        return se

    # ------------------------------------------------------------------
    def worst_case_info(self, stack):
        se = self._se_grid(stack)
        idx = np.unravel_index(np.argmin(se), se.shape)
        i, j, k = idx
        return {
            "worst_se_db": float(se[i, j, k]),
            "frequency_hz": float(self.frequencies[i]),
            "angle_deg": float(self.angles_deg[j]),
            "polarization": self.polarizations[k],
        }

    def worst_se(self, stack):
        return self.worst_case_info(stack)["worst_se_db"]

    # ------------------------------------------------------------------
    def mass_cost(self, stack):
        total = 0.0
        for m, d in stack:
            rho = self.densities.get(m)
            if rho is None:
                raise ValueError(f"mass_density_kg_m3 missing for material '{m}'")
            total += d * rho
        return total