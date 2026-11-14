"""
service.py - the one entry point the rest of the backend calls.

    result = run_optimization(request)        # request: OptimizationRequest
    result = filter_candidates(run_id, filt)  # filt: ResultFilter, no new search
"""
import time
import uuid
from collections import OrderedDict

import numpy as np

from .optimizer import Problem, find_candidates
from .se_evaluator import SEEvaluator

EFFORT = {
    "quick":    {"restarts": 2, "max_gen": 60,  "refine_top": 10},
    "normal":   {"restarts": 3, "max_gen": 200, "refine_top": 20},
    "thorough": {"restarts": 5, "max_gen": 400, "refine_top": 40},
}
N_FREQ_SEARCH, N_FREQ_DENSE, N_ANGLE_SEARCH, N_ANGLE_DENSE = 12, 200, 4, 16
POOL_CAP = 2000
RUNS = OrderedDict()

MODEL_NOTES = [
    "Normally/obliquely incident plane wave on uniform planar layers, air on both sides, TE and TM.",
    "SE is validated on the listed grids only; it is not a proof for every frequency and angle.",
    "Material properties are held constant across the band unless a frequency table was supplied.",
    "Magnetic saturation, Lande g-factor and delta-H are stored but not used: the linear model has no "
    "resonance or saturation physics.",
]


def _resolve_properties(mat, fmin, fmax):
    """Return flat props for the optimizer, pulling from frequency_dependent_properties when needed."""
    props = dict(mat.get("properties") or {})

    needed = ("conductivity_s_m", "relative_permittivity", "relative_permeability")
    missing = [k for k in needed if props.get(k) is None]

    if missing:
        table = mat.get("frequency_dependent_properties") or []
        if table:
            target = (fmin + fmax) / 2
            entry = min(table, key=lambda e: abs(e.get("frequency_hz", target) - target))
            for k in missing:
                if entry.get("properties", {}).get(k) is not None:
                    props[k] = entry["properties"][k]

    still_missing = [k for k in needed if props.get(k) is None]
    if still_missing:
        raise ValueError(
            f"Material '{mat['id']}' is missing {', '.join(still_missing)}. "
            "Provide these directly or via frequency_dependent_properties."
        )

    # cast floats so the solver never sees a string
    for k in needed + ("dielectric_loss_tangent", "magnetic_loss_tangent", "mass_density_kg_m3"):
        if props.get(k) is not None:
            props[k] = float(props[k])

    return props


def run_optimization(req):
    t0 = time.time()
    mats = [m.model_dump() for m in req.materials]

    # resolve missing flat properties from the frequency-dependent table
    fmin, fmax = req.frequency_min_hz, req.frequency_max_hz
    for m in mats:
        m["properties"] = _resolve_properties(m, fmin, fmax)

    by_id = {m["id"]: m for m in mats}
    ids = list(by_id)

    limits = {}
    for m in mats:
        lo = m["min_thickness_m"] or req.default_min_layer_thickness_m
        hi = m["max_thickness_m"] or req.default_max_layer_thickness_m
        if lo > hi:
            raise ValueError(f"{m['id']}: minimum thickness is larger than maximum thickness")
        limits[m["id"]] = (lo, hi)

    if req.objective == "mass" or req.max_mass_kg_m2:
        if any(not m["properties"].get("mass_density_kg_m3") for m in mats):
            raise ValueError("mass objective / mass limit needs mass_density_kg_m3 for every material")

    amax = req.max_incidence_angle_deg
    f_search = np.logspace(np.log10(fmin), np.log10(fmax), N_FREQ_SEARCH)
    f_dense = np.logspace(np.log10(fmin), np.log10(fmax), N_FREQ_DENSE)
    a_search = np.linspace(0, amax, N_ANGLE_SEARCH) if amax > 0 else [0.0]
    a_dense = np.linspace(0, amax, N_ANGLE_DENSE) if amax > 0 else [0.0]
    search = SEEvaluator(mats, f_search, a_search)
    dense = SEEvaluator(mats, f_dense, a_dense)

    must = set(req.must_include_ids)

    def extra(stack):
        v = 100.0 * len(must - {m for m, _ in stack})
        if req.max_mass_kg_m2:
            mass = search.mass_cost(stack)
            if mass > req.max_mass_kg_m2:
                v += 100.0 * (mass / req.max_mass_kg_m2 )
        return v

    p = Problem(search.worst_se, ids, req.target_se_db + req.safety_margin_db, limits=limits,
                n_max=req.max_layers, total_max=req.max_total_thickness_m,
                cost_fn=search.mass_cost if req.objective == "mass" else None,
                extra_violation=extra)

    eff = EFFORT[req.effort]
    find_candidates(p, seed=req.seed or 0,
                    restarts=eff["restarts"], max_gen=eff["max_gen"], refine_top=eff["refine_top"])

    feasible_stacks = p.pool_stacks(True, top_k=POOL_CAP)
    stacks = feasible_stacks or p.pool_stacks(False, top_k=POOL_CAP)

    seen, entries = set(), []
    for _, s, _ in stacks:
        key = tuple(s)
        if key not in seen:
            seen.add(key)
            entries.append(s)
    entries = entries[:POOL_CAP]

    cands = [_describe(s, dense, by_id, req) for s in entries]
    cands.sort(key=lambda c: (not c["passes_dense_validation"],
                              _objective_value(c, req.objective),
                              c["total_thickness_m"]))
    for i, c in enumerate(cands, 1):
        c["rank"] = i

    if not feasible_stacks:
        msg = ("No stack reached the target with these limits. Showing the closest ones. Allow thicker "
               "layers, more layers, a lower target, or add materials.")
    elif not any(c["passes_dense_validation"] for c in cands):
        msg = ("Candidates met the target on the search grid but failed the dense re-check. "
               "Raise safety_margin_db.")
    else:
        msg = f"{sum(c['passes_dense_validation'] for c in cands)} validated candidate(s) found."

    run_id = uuid.uuid4().hex[:12]
    result = {
        "run_id": run_id,
        "feasible_found": bool(feasible_stacks),
        "message": msg,
        "objective": req.objective,
        "target_se_db": req.target_se_db,
        "solver_evaluations": p.evals,
        "runtime_s": round(time.time() - t0, 2),
        "search_grid": {"frequencies": N_FREQ_SEARCH, "angles": len(a_search)},
        "validation_grid": {"frequencies": N_FREQ_DENSE, "angles": len(a_dense)},
        "distinct_candidates_found": len(cands),
        "candidates": cands[: req.top_k],
        "notes": MODEL_NOTES,
    }
    RUNS[run_id] = {"candidates": cands, "objective": req.objective, "result": result}
    while len(RUNS) > 20:
        RUNS.popitem(last=False)
    return result


def _objective_value(c, objective):
    if objective == "mass" and c["areal_mass_kg_m2"] is not None:
        return c["areal_mass_kg_m2"]
    return c["total_thickness_m"]


def _describe(stack, dense, by_id, req):
    info = dense.worst_case_info(stack)
    dens = [by_id[m]["properties"].get("mass_density_kg_m3") for m, _ in stack]
    mass = sum(d * r for (_, d), r in zip(stack, dens)) if all(dens) else None

    warnings = []
    for mid in dict.fromkeys(m for m, _ in stack):
        mat = by_id[mid]
        ref = mat.get("reference_frequency_hz")
        if ref and not mat.get("frequency_dependent_properties") and (
                req.frequency_min_hz < ref / 10 or req.frequency_max_hz > ref * 10):
            warnings.append(f"{mid}: properties measured at {ref:.3g} Hz, band extends over a decade "
                            f"away; values are held constant.")

    return {
        "rank": None,
        "layers": [{"order": i, "material_id": m, "material_name": by_id[m].get("name") or m,
                    "thickness_m": d} for i, (m, d) in enumerate(stack, 1)],
        "layer_count": len(stack),
        "total_thickness_m": sum(d for _, d in stack),
        "areal_mass_kg_m2": mass,
        "worst_case_se_db": info["worst_se_db"],
        "margin_db": info["worst_se_db"] - req.target_se_db,
        "worst_case_frequency_hz": info["frequency_hz"],
        "worst_case_angle_deg": info["angle_deg"],
        "worst_case_polarization": info["polarization"],
        "passes_dense_validation": info["worst_se_db"] >= req.target_se_db,
        "warnings": warnings,
    }


def filter_candidates(run_id, f):
    run = RUNS.get(run_id)
    if run is None:
        raise KeyError(f"Unknown or expired run_id '{run_id}'")
    inc, exc = {i.lower() for i in f.include_ids}, {i.lower() for i in f.exclude_ids}

    def keep(c):
        used = {l["material_id"].lower() for l in c["layers"]}
        return (inc <= used and not (exc & used)
                and (not f.only_validated or c["passes_dense_validation"])
                and (f.max_layers is None or c["layer_count"] <= f.max_layers)
                and (f.max_total_thickness_m is None or c["total_thickness_m"] <= f.max_total_thickness_m)
                and (f.min_margin_db is None or c["margin_db"] >= f.min_margin_db)
                and (f.max_mass_kg_m2 is None or (c["areal_mass_kg_m2"] is not None
                                                  and c["areal_mass_kg_m2"] <= f.max_mass_kg_m2)))

    keys = {"objective": lambda c: _objective_value(c, run["objective"]),
            "thickness": lambda c: c["total_thickness_m"],
            "mass": lambda c: c["areal_mass_kg_m2"] if c["areal_mass_kg_m2"] is not None else float("inf"),
            "margin": lambda c: -c["margin_db"],
            "layers": lambda c: (c["layer_count"], c["total_thickness_m"])}
    out = sorted((c for c in run["candidates"] if keep(c)), key=keys[f.sort_by])
    out = [dict(c, rank=i) for i, c in enumerate(out[: f.top_k], 1)]
    return {"run_id": run_id, "matches": len(out), "candidates": out}