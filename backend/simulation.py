"""simulation.py — single-layer physics: layer wave properties, closed-form slab R/T/A, SE, skin depth."""
import numpy as np

# --- Physical constants (SI) ---
C0 = 299_792_458.0                 # speed of light, m/s
MU0 = 4e-7 * np.pi                 # vacuum permeability, H/m
EPS0 = 1.0 / (MU0 * C0 ** 2)       # vacuum permittivity, F/m
ETA0 = float(np.sqrt(MU0 / EPS0))  # free-space wave impedance, ohm (~376.73)
LN10 = float(np.log(10.0))


def layer_properties(freq_hz, sigma, eps_r, mu_r):
    """Return complex propagation constant gamma = alpha + j*beta (1/m) and wave impedance eta (ohm)."""
    f = np.atleast_1d(np.asarray(freq_hz, dtype=float))
    w = 2.0 * np.pi * f
    mu = MU0 * mu_r
    eps = EPS0 * eps_r
    # gamma^2 = j*w*mu*(sigma + j*w*eps) covers conductors and lossy dielectrics in one formula
    gamma = np.sqrt(1j * w * mu * (sigma + 1j * w * eps))
    # choose the root with Re(gamma) >= 0 (wave decays in +z); handles the lossless -0.0 imaginary edge case
    flip = (gamma.real < 0) | ((gamma.real == 0) & (gamma.imag < 0))
    gamma = np.where(flip, -gamma, gamma)
    eta = 1j * w * mu / gamma
    return gamma, eta


def skin_depth(freq_hz, sigma, eps_r, mu_r):
    """Skin depth delta = 1/alpha from the general gamma (np.inf for a lossless layer)."""
    gamma, _ = layer_properties(freq_hz, sigma, eps_r, mu_r)
    alpha = gamma.real
    return np.divide(1.0, alpha, out=np.full_like(alpha, np.inf), where=alpha > 0)


def skin_depth_good_conductor(freq_hz, sigma, mu_r):
    """Good-conductor approximation delta = sqrt(2/(w*mu*sigma)); used only as a cross-check."""
    w = 2.0 * np.pi * np.atleast_1d(np.asarray(freq_hz, dtype=float))
    return np.sqrt(2.0 / (w * MU0 * mu_r * sigma)) if sigma > 0 else np.full_like(w, np.inf)


def conductor_ratio(freq_hz, sigma, eps_r):
    """sigma/(w*eps): much greater than 1 means the good-conductor approximation is justified."""
    w = 2.0 * np.pi * np.atleast_1d(np.asarray(freq_hz, dtype=float))
    return sigma / (w * EPS0 * eps_r)


def single_layer(freq_hz, sigma, eps_r, mu_r, thickness_m):
    """Normal-incidence slab in air on both sides (closed form, overflow-safe).

    t = (1 - rho^2) e^{-gamma d} / (1 - rho^2 e^{-2 gamma d}),  r = rho (1 - e^{-2 gamma d}) / (1 - rho^2 e^{-2 gamma d})
    SE is computed from log|t| so it stays finite even when T underflows to 0.
    """
    f = np.atleast_1d(np.asarray(freq_hz, dtype=float))
    gamma, eta = layer_properties(f, sigma, eps_r, mu_r)
    rho = (eta - ETA0) / (eta + ETA0)                 # air -> slab amplitude reflection
    one_minus_rho2 = 4.0 * eta * ETA0 / (eta + ETA0) ** 2   # exact 1 - rho^2 (avoids cancellation)
    e2 = np.exp(-2.0 * gamma * thickness_m)           # decaying exponential only
    den = 1.0 - rho ** 2 * e2
    log_t = np.log(np.abs(one_minus_rho2)) - gamma.real * thickness_m - np.log(np.abs(den))
    r = rho * (1.0 - e2) / den
    return pack_result(f, np.abs(r) ** 2, log_t)


def pack_result(f, R, log_abs_t):
    """Build R, T, A, SE from |r|^2 and ln|t| (air on both sides, so T = |t|^2)."""
    T = np.exp(2.0 * log_abs_t)
    A = np.clip(1.0 - R - T, 0.0, 1.0)                # clip only removes round-off below 0
    se_db = -20.0 * log_abs_t / LN10                  # SE_T = -10 log10(T) = -20 log10|t|
    return {"frequency_hz": f, "reflection_power": R, "transmission_power": T,
            "absorption_power": A, "shielding_effectiveness_db": se_db}


def failing_ranges(f, se_db, target_db):
    """Contiguous frequency ranges where SE < target (list of (f_start, f_end))."""
    below = np.asarray(se_db) < target_db
    ranges, start = [], None
    for i, flag in enumerate(below):
        if flag and start is None:
            start = i
        if start is not None and (not flag or i == len(below) - 1):
            end = i if flag else i - 1
            ranges.append((float(f[start]), float(f[end])))
            start = None
    return ranges
