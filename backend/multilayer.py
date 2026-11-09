"""multilayer.py — transfer-matrix method for stacks of uniform planar layers (normal incidence, air on both sides)."""
import numpy as np
from backend.simulation import ETA0, layer_properties, pack_result


def stack_response(freq_hz, layers):
    """layers: ordered list of (sigma, eps_r, mu_r, thickness_m) from the incident side to the exit side.

    Amplitudes [incident; reflected] = M [transmitted; 0], M = D01 P1 D12 P2 ... Dn,exit.
    M is rescaled after every product and the scale is tracked as a log, so thick conductors cannot overflow.
    """
    f = np.atleast_1d(np.asarray(freq_hz, dtype=float))
    n = len(f)
    props = [layer_properties(f, s, e, m) for (s, e, m, _) in layers]
    etas = [np.full(n, ETA0, dtype=complex)] + [p[1] for p in props] + [np.full(n, ETA0, dtype=complex)]

    M = np.broadcast_to(np.eye(2, dtype=complex), (n, 2, 2)).copy()
    log_scale = np.zeros(n)

    def renorm(M, log_scale):
        m = np.max(np.abs(M), axis=(1, 2))
        return M / m[:, None, None], log_scale + np.log(m)

    for i in range(len(layers) + 1):
        ea, eb = etas[i], etas[i + 1]
        gam = (eb - ea) / (eb + ea)                    # interface amplitude reflection
        tau = 2.0 * eb / (ea + eb)                     # interface amplitude transmission
        D = np.zeros((n, 2, 2), dtype=complex)         # interface matrix (1/tau)[[1,G],[G,1]]
        D[:, 0, 0] = D[:, 1, 1] = 1.0 / tau
        D[:, 0, 1] = D[:, 1, 0] = gam / tau
        M, log_scale = renorm(M @ D, log_scale)

        if i < len(layers):                            # propagation through layer i+1
            gamma, _ = props[i]
            d = layers[i][3]
            P = np.zeros((n, 2, 2), dtype=complex)
            # e^{gamma d} = e^{alpha d} e^{j beta d}: the e^{alpha d} part goes into log_scale
            P[:, 0, 0] = np.exp(1j * gamma.imag * d)
            P[:, 1, 1] = np.exp(1j * gamma.imag * d) * np.exp(-2.0 * gamma * d)
            log_scale = log_scale + gamma.real * d
            M, log_scale = renorm(M @ P, log_scale)

    t_log = -log_scale - np.log(np.abs(M[:, 0, 0]))    # ln|t| (exit medium = incident medium)
    r = M[:, 1, 0] / M[:, 0, 0]
    return pack_result(f, np.abs(r) ** 2, t_log)


def sweep(layers, f_start, f_end, n_points, spacing="log"):
    """Frequency response of a stack; log spacing is the default because EMI bands span decades."""
    if spacing == "log":
        f = np.logspace(np.log10(f_start), np.log10(f_end), n_points)
    else:
        f = np.linspace(f_start, f_end, n_points)
    return stack_response(f, layers)
