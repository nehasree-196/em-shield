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
module runs it vectorized over the full (frequency, angle) grid with only the
2 polarizations looped in Python. test_physics_agreement.py asserts agreement
with physics/multilayer_solver_optimization.calculate_se.
"""
import numpy as np


EPS0 = 8.854187817e-12
MU0 = 4.0 * np.pi * 1e-7


AIR = {"sigma": 0.0, "epsilon_r": 1.0, "mu_r": 1.0,
       "tan_delta_e": 0.0, "tan_delta_m": 0.0}


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


# ---------------------------------------------------------------------------
# Vectorized scattering-matrix solver
# Mirrors physics/multilayer_solver_optimization.calculate_se but broadcasts
# over frequency and incidence angle. Same equations, array math.
# ---------------------------------------------------------------------------

def _complex_eps(f, mat):
    omega = 2.0 * np.pi * f
    return (EPS0 * mat["epsilon_r"] * (1.0 - 1j * mat.get("tan_delta_e", 0.0))
            - 1j * mat["sigma"] / omega)


def _wave_props(f, mat, theta, pol):
    """Broadcasted kz and eta for a material at (f, theta)."""
    omega = 2.0 * np.pi * f
    eps = _complex_eps(f, mat)
    mu = MU0 * mat["mu_r"] * (1.0 - 1j * mat.get("tan_delta_m", 0.0))
    k0 = omega * np.sqrt(MU0 * EPS0)
    kx = k0 * np.sin(theta)
    kz = np.sqrt(omega ** 2 * mu * eps - kx ** 2)

    # passive forward-wave branch (matches scalar solver)
    flip = np.imag(kz) > 0
    kz = np.where(flip, -kz, kz)
    low = (np.abs(np.imag(kz)) < 1e-12) & (np.real(kz) < 0)
    kz = np.where(low, -kz, kz)

    if pol == "TE":
        eta = omega * mu / kz
    else:  # TM
        eta = kz / (omega * eps)
    return kz, eta


def _interface(eta_a, eta_b):
    """S-parameter matrix for one interface (broadcasted)."""
    den = eta_a + eta_b
    r_ab = (eta_b - eta_a) / den
    t_ab = 2.0 * eta_b / den
    t_ba = 2.0 * eta_a / den
    r_ba = -r_ab
    S = np.empty(eta_a.shape + (2, 2), dtype=complex)
    S[..., 0, 0] = r_ab
    S[..., 0, 1] = t_ba
    S[..., 1, 0] = t_ab
    S[..., 1, 1] = r_ba
    return S


def _cascade(A, B):
    """Cascade two S-matrices (broadcasted)."""
    den = 1.0 - A[..., 1, 1] * B[..., 0, 0]
    C = np.empty(A.shape, dtype=complex)
    C[..., 0, 0] = A[..., 0, 0] + A[..., 0, 1] * B[..., 0, 0] * A[..., 1, 0] / den
    C[..., 0, 1] = A[..., 0, 1] * B[..., 0, 1] / den
    C[..., 1, 0] = B[..., 1, 0] * A[..., 1, 0] / den
    C[..., 1, 1] = B[..., 1, 1] + B[..., 1, 0] * A[..., 1, 1] * B[..., 0, 1] / den
    return C


def _vectorized_se(f, theta, stack, pol, materials):
    """SE in dB over the (f, theta) grid for one stack and one polarization."""
    f = np.asarray(f, dtype=float)
    theta = np.asarray(theta, dtype=float)

    # broadcast to common (Nf, Na) shape
    shape = np.broadcast_shapes(f.shape, theta.shape)
    f = np.broadcast_to(f, shape)
    theta = np.broadcast_to(theta, shape)

    _, eta_air = _wave_props(f, AIR, theta, pol)

    if not stack:
        return np.zeros(shape)

    mats = [materials[m] for m, _ in stack]

    _, eta_first = _wave_props(f, mats[0], theta, pol)
    S = _interface(eta_air, eta_first)
    log_t = np.log(np.abs(S[..., 1, 0]))

    for i, (_, d) in enumerate(stack):
        kz, eta_cur = _wave_props(f, mats[i], theta, pol)

        # propagation through layer i
        log_p = -1j * kz * d
        p = np.exp(log_p)
        P = np.zeros(shape + (2, 2), dtype=complex)
        P[..., 0, 1] = p
        P[..., 1, 0] = p
        S = _cascade(S, P)
        log_t = log_t + np.real(log_p)

        # interface to next medium (or air)
        nxt = mats[i + 1] if i + 1 < len(stack) else AIR
        _, eta_next = _wave_props(f, nxt, theta, pol)
        I = _interface(eta_cur, eta_next)
        den = 1.0 - S[..., 1, 1] * I[..., 0, 0]
        log_t = log_t + np.log(np.abs(I[..., 1, 0])) - np.log(np.abs(den))
        S = _cascade(S, I)

    return -20.0 * log_t / np.log(10.0)


# ---------------------------------------------------------------------------
# Evaluator
# ---------------------------------------------------------------------------

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
        """SE[frequency, angle, polarization] for one stack — fully vectorized
        over frequency and angle (loops only over the 2 polarizations)."""
        se = np.empty((len(self.frequencies), len(self.angles_rad), 2))
        for k, pol in enumerate(self.polarizations):
            se[:, :, k] = _vectorized_se(
                self.frequencies[:, None],        # (Nf, 1)
                self.angles_rad[None, :],         # (1,  Na)
                stack,
                pol,
                self.solver_materials,
            )
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