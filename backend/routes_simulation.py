"""routes_simulation.py — FastAPI routes for pages 3-5; every number returned is computed here, never in the UI."""
import numpy as np
from fastapi import APIRouter, HTTPException


from materials import list_materials, resolve_material
from multilayer import stack_response, sweep
from schemas import MultilayerRequest, SingleLayerRequest, SweepRequest
from simulation import (conductor_ratio, failing_ranges, single_layer, skin_depth,
                        skin_depth_good_conductor)

router = APIRouter(prefix="/api")


def _num(x):
    """JSON cannot hold inf/nan: convert to None."""
    x = float(x)
    return x if np.isfinite(x) else None


def _resolve(layers):
    try:
        return [(*resolve_material(l.material)[:3], l.thickness_m) for l in layers], \
               [resolve_material(l.material)[3] for l in layers]
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.get("/materials")
def get_materials():
    return list_materials()  # delete this route if Page 2 already provides it


@router.post("/single-layer")
def run_single_layer(req: SingleLayerRequest):
    try:
        s, e, m, label = resolve_material(req.material)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    f = np.array([req.frequency_hz])
    res = single_layer(f, s, e, m, req.thickness_m)
    delta = skin_depth(f, s, e, m)[0]
    alpha = 1.0 / delta if np.isfinite(delta) else 0.0
    z = np.linspace(0.0, req.thickness_m, 100)
    return {
        "material": label,
        "frequency_hz": req.frequency_hz,
        "thickness_m": req.thickness_m,
        "reflection_power": float(res["reflection_power"][0]),
        "transmission_power": float(res["transmission_power"][0]),
        "absorption_power": float(res["absorption_power"][0]),
        "shielding_effectiveness_db": float(res["shielding_effectiveness_db"][0]),
        "skin_depth_m": _num(delta),
        "skin_depth_good_conductor_m": _num(skin_depth_good_conductor(f, s, m)[0]),
        "thickness_over_skin_depth": _num(req.thickness_m / delta) if np.isfinite(delta) else None,
        "conductor_ratio": _num(conductor_ratio(f, s, e)[0]) if s > 0 else 0.0,
        # single-pass envelope exp(-alpha z): ignores internal reflections, label it that way in the UI
        "profile_z_m": z.tolist(),
        "profile_relative_amplitude": np.exp(-alpha * z).tolist(),
    }


@router.post("/multilayer")
def run_multilayer(req: MultilayerRequest):
    stack, labels = _resolve(req.layers)
    res = stack_response(np.array([req.frequency_hz]), stack)
    meta = []
    for i, ((s, e, m, d), name) in enumerate(zip(stack, labels), start=1):
        delta = skin_depth(np.array([req.frequency_hz]), s, e, m)[0]
        meta.append({"order": i, "material": name, "thickness_m": d, "skin_depth_m": _num(delta)})
    return {
        "frequency_hz": req.frequency_hz,
        "layer_count": len(stack),
        "total_thickness_m": float(sum(l[3] for l in stack)),
        "stack": meta,
        "reflection_power": float(res["reflection_power"][0]),
        "transmission_power": float(res["transmission_power"][0]),
        "absorption_power": float(res["absorption_power"][0]),
        "shielding_effectiveness_db": float(res["shielding_effectiveness_db"][0]),
    }


@router.post("/sweep")
def run_sweep(req: SweepRequest):
    stack, _ = _resolve(req.layers)
    res = sweep(stack, req.frequency_start_hz, req.frequency_end_hz, req.frequency_points, req.spacing)
    out = {k: v.tolist() for k, v in res.items()}
    out["total_thickness_m"] = float(sum(l[3] for l in stack))
    out["target_se_db"] = req.target_se_db
    out["failing_ranges_hz"] = (
        [{"start_hz": a, "end_hz": b} for a, b in
         failing_ranges(res["frequency_hz"], res["shielding_effectiveness_db"], req.target_se_db)]
        if req.target_se_db is not None else [])
    return out
