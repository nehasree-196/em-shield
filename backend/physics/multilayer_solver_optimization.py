"""
multilayer_solver_optimization.py - reference (scalar) scattering-matrix solver, oblique TE/TM.

There is NO material database in this file. Materials are always passed in:

    materials = {"copper": {"sigma": 5.8e7, "epsilon_r": 1.0, "mu_r": 1.0,
                            "tan_delta_e": 0.0, "tan_delta_m": 0.0}, ...}
    layers    = [{"material": "copper", "thickness": 2e-4}, ...]      # or "material": {...inline dict...}
    calculate_se(freq_hz, layers, theta_rad, "TE", materials)

Build `materials` from the Page 2 library with optimization.se_evaluator.to_solver_materials().
The optimizer itself uses optimization/se_evaluator.py (same equations, vectorized, ~60x faster);
tests/optimization/test_se_evaluator.py checks that the two agree.
Convention: exp(+j*omega*t), so lossy permittivity = eps' - j*eps'' and mu = mu' - j*mu''.
"""
import numpy as np

EPS0 = 8.854187817e-12
MU0 = 4.0 * np.pi * 1e-7
ETA0 = np.sqrt(MU0 / EPS0)

AIR = {"sigma": 0.0, "epsilon_r": 1.0, "mu_r": 1.0}


def _material(layer, materials):
    """A layer's material: an inline dict, or an id looked up in the `materials` you passed."""
    ref = layer["material"]
    if isinstance(ref, dict):
        return ref
    if not materials or ref not in materials:
        raise ValueError(f"Unknown material: {ref}")
    return materials[ref]


def complex_permittivity(frequency, material):
    if frequency <= 0:
        raise ValueError("Frequency must be positive")
    omega = 2 * np.pi * frequency
    return (EPS0 * material["epsilon_r"] * (1 - 1j * material.get("tan_delta_e", 0.0))
            - 1j * material["sigma"] / omega)


def wave_properties(frequency, material, theta_incident, polarization):
    omega = 2 * np.pi * frequency
    eps = complex_permittivity(frequency, material)
    mu = MU0 * material["mu_r"] * (1 - 1j * material.get("tan_delta_m", 0.0))

    k0 = omega * np.sqrt(MU0 * EPS0)
    kx = k0 * np.sin(theta_incident)
    kz = np.sqrt(omega**2 * mu * eps - kx**2)

    # passive forward-wave branch for exp(+j omega t)
    if np.imag(kz) > 0:
        kz = -kz
    elif abs(np.imag(kz)) < 1e-12 and np.real(kz) < 0:
        kz = -kz

    if polarization.upper() == "TE":
        impedance = omega * mu / kz
    elif polarization.upper() == "TM":
        impedance = kz / (omega * eps)
    else:
        raise ValueError("Polarization must be TE or TM")
    return kz, impedance


def cascade(A, B):
    denominator = 1.0 - A[1, 1] * B[0, 0]
    if abs(denominator) < 1e-300:
        raise ArithmeticError("Numerical singularity in cascade")
    C = np.zeros((2, 2), dtype=complex)
    C[0, 0] = A[0, 0] + A[0, 1] * B[0, 0] * A[1, 0] / denominator
    C[0, 1] = A[0, 1] * B[0, 1] / denominator
    C[1, 0] = B[1, 0] * A[1, 0] / denominator
    C[1, 1] = B[1, 1] + B[1, 0] * A[1, 1] * B[0, 1] / denominator
    return C


def interface_matrix(eta_a, eta_b):
    denominator = eta_a + eta_b
    if abs(denominator) == 0:
        raise ArithmeticError("Invalid interface impedance")
    r_ab = (eta_b - eta_a) / denominator
    r_ba = -r_ab
    t_ab = 2.0 * eta_b / denominator
    t_ba = 2.0 * eta_a / denominator
    return np.array([[r_ab, t_ba], [t_ab, r_ba]], dtype=complex)


def propagation_matrix(kz, thickness):
    if thickness < 0:
        raise ValueError("Thickness cannot be negative")
    log_p = -1j * kz * thickness
    with np.errstate(under="ignore"):
        p = np.exp(log_p)
    return np.array([[0.0, p], [p, 0.0]], dtype=complex), log_p


def calculate_scattering(frequency, layers, theta_incident=0.0, polarization="TE", materials=None):
    _, eta_air = wave_properties(frequency, AIR, theta_incident, polarization)

    if not layers:
        return np.array([[0.0, 1.0], [1.0, 0.0]], dtype=complex), 0.0

    mats = []
    for layer in layers:
        if layer["thickness"] < 0:
            raise ValueError("Thickness cannot be negative")
        mats.append(_material(layer, materials))

    _, eta_first = wave_properties(frequency, mats[0], theta_incident, polarization)
    S = interface_matrix(eta_air, eta_first)
    log_transmission = np.log(abs(S[1, 0]))

    for i, layer in enumerate(layers):
        material = mats[i]
        next_material = mats[i + 1] if i + 1 < len(layers) else AIR

        kz, eta_current = wave_properties(frequency, material, theta_incident, polarization)
        P, log_p = propagation_matrix(kz, layer["thickness"])
        S = cascade(S, P)
        log_transmission += np.real(log_p)

        _, eta_next = wave_properties(frequency, next_material, theta_incident, polarization)
        I = interface_matrix(eta_current, eta_next)

        denominator = 1.0 - S[1, 1] * I[0, 0]
        if abs(denominator) < 1e-300:
            raise ArithmeticError("Numerical singularity at layer interface")
        log_transmission += np.log(abs(I[1, 0])) - np.log(abs(denominator))
        S = cascade(S, I)

    return S, log_transmission


def calculate_rt(frequency, layers, theta_incident=0.0, polarization="TE", materials=None):
    S, _ = calculate_scattering(frequency, layers, theta_incident, polarization, materials)
    return S[0, 0], S[1, 0]


def calculate_se(frequency, layers, theta_incident=0.0, polarization="TE", materials=None):
    """SE = -20 log10|t|, computed from log|t| so it never underflows."""
    _, log_transmission = calculate_scattering(frequency, layers, theta_incident, polarization, materials)
    return -20.0 * log_transmission / np.log(10.0)


def calculate_skin_depth(frequency, material):
    omega = 2 * np.pi * frequency
    mu = MU0 * material["mu_r"]
    sigma = material["sigma"]
    if sigma <= 0:
        return np.inf
    return np.sqrt(2.0 / (omega * mu * sigma))


def calculate_omnidirectional_se(layers, frequencies, angles_deg=(0, 25, 50, 75), materials=None):
    detailed_results, worst_case_se = {}, []
    for frequency in frequencies:
        results, values = {}, []
        for angle_deg in angles_deg:
            theta = np.radians(angle_deg)
            for polarization in ("TE", "TM"):
                se = calculate_se(frequency, layers, theta, polarization, materials)
                results[(angle_deg, polarization)] = se
                values.append(se)
        detailed_results[frequency] = results
        worst_case_se.append(min(values))
    return detailed_results, np.array(worst_case_se)