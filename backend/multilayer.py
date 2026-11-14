"""multilayer.py — transfer-matrix method for stacks of uniform planar layers (normal incidence, air on both sides)."""
import numpy as np
from simulation import ETA0, LN10, failing_ranges, layer_properties, pack_result

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


# ---------------------------------------------------------------------------
# Design analysis for the Multilayer page
# ---------------------------------------------------------------------------
DB_PER_NEPER = 20.0 / LN10


def se_components(f, stack, res):
    """Schelkunoff split: SE_total = SE_R + SE_A + SE_B (dB arrays).
    SE_R = -20log10 prod|tau_i| (interfaces), SE_A = 8.686*sum(alpha_i d_i), SE_B = remainder (multiple reflections)."""
    f = np.atleast_1d(np.asarray(f, dtype=float))
    props = [layer_properties(f, s, e, m) for (s, e, m, _) in stack]
    etas = [np.full(len(f), ETA0, dtype=complex)] + [p[1] for p in props] + [np.full(len(f), ETA0, dtype=complex)]
    ln_tau = sum(np.log(np.abs(2.0 * etas[i + 1] / (etas[i] + etas[i + 1]))) for i in range(len(stack) + 1))
    se_r = -ln_tau * DB_PER_NEPER
    se_a = sum(DB_PER_NEPER * p[0].real * layer[3] for p, layer in zip(props, stack))
    se_t = np.asarray(res["shielding_effectiveness_db"])
    return se_r, se_a, se_t - se_r - se_a, se_t


def band_weights(f):
    """Bandwidth (Hz) owned by each sample."""
    f = np.asarray(f, dtype=float)
    edges = np.empty(len(f) + 1)
    edges[1:-1] = 0.5 * (f[1:] + f[:-1])
    edges[0] = f[0] - 0.5 * (f[1] - f[0])
    edges[-1] = f[-1] + 0.5 * (f[-1] - f[-2])
    return np.diff(edges)


def summarize(f, se_db, target_db):
    f = np.asarray(f, dtype=float)
    se_db = np.asarray(se_db, dtype=float)
    i = int(np.argmin(se_db))
    w = band_weights(f)
    ranges = failing_ranges(f, se_db, target_db)
    longest = max(ranges, key=lambda r: r[1] - r[0]) if ranges else None
    return {
        "worst_se_db": float(se_db[i]),
        "worst_frequency_hz": float(f[i]),
        "margin_db": float(se_db[i] - target_db),
        "pass_rate_percent": float(100.0 * w[se_db >= target_db].sum() / w.sum()),
        "failing_ranges_hz": [{"start_hz": a, "end_hz": b} for a, b in ranges],
        "longest_failing_range_hz": None if longest is None else {"start_hz": longest[0], "end_hz": longest[1]},
    }


def layer_contribution(freq_hz, stack, labels):
    """Per-layer absorption plus the remainder (R + B); the parts add up to the total SE."""
    f = np.array([freq_hz])
    total = float(stack_response(f, stack)["shielding_effectiveness_db"][0])
    layers, absorbed = [], 0.0
    for i, ((s, e, m, d), name) in enumerate(zip(stack, labels), start=1):
        a_db = DB_PER_NEPER * float(layer_properties(f, s, e, m)[0].real[0]) * d
        absorbed += a_db
        layers.append({"order": i, "material": name, "absorption_db": a_db})
    return {"frequency_hz": freq_hz, "total_se_db": total, "layers": layers,
            "reflection_and_interface_db": total - absorbed}


def _worst_se(f, stack):
    return float(np.min(stack_response(f, stack)["shielding_effectiveness_db"]))


def sensitivity(f, stack, labels, delta=0.10):
    """Worst-case band SE at -delta/+delta on thickness and conductivity, per layer and for all layers."""
    nominal = _worst_se(f, stack)

    def perturbed(which, idx, k):
        out = []
        for j, layer in enumerate(stack):
            layer = list(layer)
            if which is None or j == which:
                layer[idx] *= k
            out.append(tuple(layer))
        return out

    rows = []
    targets = [(j, f"L{j + 1} {labels[j]}") for j in range(len(stack))]
    if len(stack) > 1:
        targets.append((None, "All layers"))
    for which, name in targets:
        for pname, idx in (("thickness", 3), ("conductivity", 0)):
            if idx == 0 and which is not None and stack[which][0] == 0:
                continue                                   # lossless layer: nothing to vary
            if idx == 0 and which is None and all(l[0] == 0 for l in stack):
                continue
            lo = _worst_se(f, perturbed(which, idx, 1.0 - delta))
            hi = _worst_se(f, perturbed(which, idx, 1.0 + delta))
            rows.append({
                "label": f"{name} — {pname}", "layer": None if which is None else which + 1, "parameter": pname,
                "worst_se_minus_db": lo, "worst_se_plus_db": hi,
                "delta_minus_db": lo - nominal, "delta_plus_db": hi - nominal,
                "impact_db": max(abs(lo - nominal), abs(hi - nominal)),
            })
    rows.sort(key=lambda r: r["impact_db"], reverse=True)
    return {"delta_fraction": delta, "nominal_worst_se_db": nominal, "rows": rows}


def analyse(stack, labels, f_start, f_end, n_points, spacing, target_db, eval_freq_hz):
    f = (np.logspace(np.log10(f_start), np.log10(f_end), n_points) if spacing == "log"
         else np.linspace(f_start, f_end, n_points))
    se_r, se_a, se_b, se_t = se_components(f, stack, stack_response(f, stack))
    return {
        "frequency_hz": f.tolist(),
        "se_total_db": se_t.tolist(),
        "se_reflection_db": se_r.tolist(),
        "se_absorption_db": se_a.tolist(),
        "se_multi_reflection_db": se_b.tolist(),
        "margin_db": (se_t - target_db).tolist(),
        "target_se_db": target_db,
        "summary": summarize(f, se_t, target_db),
        "layer_contribution": layer_contribution(eval_freq_hz, stack, labels),
        "sensitivity": sensitivity(f, stack, labels),
    }