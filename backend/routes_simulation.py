"""routes_simulation.py — FastAPI routes for pages 3-5 and 7; every number returned is computed here, never in the UI."""
from datetime import datetime, timezone

import numpy as np
from fastapi import APIRouter, HTTPException, Response

from exports import export_report_pdf
from materials import list_materials, resolve_material
from multilayer import analyse, stack_response, sweep
from schemas import (
    MultilayerAnalysisRequest, MultilayerRequest, ReportRequest,
    SingleLayerRequest, SweepRequest,
)
from simulation import (
    conductor_ratio, failing_ranges, single_layer, skin_depth,
    skin_depth_good_conductor,
)

router = APIRouter(prefix="/api")


def _num(x):
    """JSON cannot hold inf/nan: convert to None."""
    x = float(x)
    return x if np.isfinite(x) else None


def _resolve(layers):
    """Resolve a list of layers, raising a 404 if any material is missing from the DB."""
    stack = []
    labels = []
    for l in layers:
        try:
            s, e, m, label = resolve_material(l.material)
            stack.append((s, e, m, l.thickness_m))
            labels.append(label)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc))
    return stack, labels


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
        "profile_z_m": z.tolist(),
        "profile_relative_amplitude": np.exp(-alpha * z).tolist(),
    }


@router.post("/multilayer")
def run_multilayer(req: MultilayerRequest):
    """Fixed-frequency calculation for Page 4."""
    stack, labels = _resolve(req.layers)
    f = np.array([req.frequency_hz])
    res = stack_response(f, stack)
    stack_details = []
    for i, ((s, e, m, d), label) in enumerate(zip(stack, labels)):
        delta = skin_depth(f, s, e, m)[0]
        stack_details.append({
            "order": i + 1,
            "material": label,
            "thickness_m": d,
            "skin_depth_m": _num(delta),
        })
    return {
        "layer_count": len(stack),
        "total_thickness_m": float(sum(l[3] for l in stack)),
        "frequency_hz": req.frequency_hz,
        "reflection_power": float(res["reflection_power"][0]),
        "transmission_power": float(res["transmission_power"][0]),
        "absorption_power": float(res["absorption_power"][0]),
        "shielding_effectiveness_db": float(res["shielding_effectiveness_db"][0]),
        "stack": stack_details,
    }


@router.post("/sweep")
def run_sweep(req: SweepRequest):
    stack, _ = _resolve(req.layers)
    res = sweep(stack, req.frequency_start_hz, req.frequency_end_hz,
                req.frequency_points, req.spacing)
    out = {k: v.tolist() for k, v in res.items()}
    out["total_thickness_m"] = float(sum(l[3] for l in stack))
    out["target_se_db"] = req.target_se_db
    out["failing_ranges_hz"] = (
        [{"start_hz": a, "end_hz": b} for a, b in
         failing_ranges(res["frequency_hz"], res["shielding_effectiveness_db"],
                        req.target_se_db)]
        if req.target_se_db is not None else [])
    return out


@router.post("/multilayer/analysis")
def run_multilayer_analysis(req: MultilayerAnalysisRequest):
    stack, labels = _resolve(req.layers)
    return analyse(stack, labels,
                   req.frequency_start_hz, req.frequency_end_hz,
                   req.frequency_points, req.spacing, req.target_se_db,
                   req.frequency_hz)


# ---------------------------------------------------------------------------
# PAGE 7 — PDF REPORT
# ---------------------------------------------------------------------------
@router.post("/report")
def generate_report(req: ReportRequest):
    # ---- 1. Single-layer ----
    single_block = None
    if req.single is not None:
        try:
            s, e, m, label = resolve_material(req.single.material)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc))
        f = np.array([req.single.frequency_hz])
        res = single_layer(f, s, e, m, req.single.thickness_m)
        delta = skin_depth(f, s, e, m)[0]
        alpha = 1.0 / delta if np.isfinite(delta) else 0.0
        z = np.linspace(0.0, req.single.thickness_m, 100)
        single_block = {
            "material": label,
            "frequency_hz": req.single.frequency_hz,
            "thickness_m": req.single.thickness_m,
            "reflection_power": float(res["reflection_power"][0]),
            "transmission_power": float(res["transmission_power"][0]),
            "absorption_power": float(res["absorption_power"][0]),
            "shielding_effectiveness_db": float(res["shielding_effectiveness_db"][0]),
            "skin_depth_m": _num(delta),
            "skin_depth_good_conductor_m": _num(skin_depth_good_conductor(f, s, m)[0]),
            "thickness_over_skin_depth": _num(req.single.thickness_m / delta)
            if np.isfinite(delta) else None,
            "conductor_ratio": _num(conductor_ratio(f, s, e)[0]) if s > 0 else 0.0,
            "profile_z_m": z.tolist(),
            "profile_relative_amplitude": np.exp(-alpha * z).tolist(),
        }

    # ---- 2. Multilayer fixed-frequency ----
    stack_block = None
    if req.stack is not None:
        stack, labels = _resolve(req.stack.layers)
        f = np.array([req.stack.frequency_hz])
        res = stack_response(f, stack)
        stack_details = []
        for i, ((s, e, m, d), name) in enumerate(zip(stack, labels)):
            delta = skin_depth(f, s, e, m)[0]
            stack_details.append({
                "order": i + 1, "material": name, "thickness_m": d,
                "skin_depth_m": _num(delta),
            })
        stack_block = {
            "layer_count": len(stack),
            "total_thickness_m": float(sum(l[3] for l in stack)),
            "frequency_hz": req.stack.frequency_hz,
            "reflection_power": float(res["reflection_power"][0]),
            "transmission_power": float(res["transmission_power"][0]),
            "absorption_power": float(res["absorption_power"][0]),
            "shielding_effectiveness_db": float(res["shielding_effectiveness_db"][0]),
            "stack": stack_details,
        }

    # ---- 3. Multilayer band analysis ----
    analysis_block = None
    if req.stack_analysis is not None:
        stack, labels = _resolve(req.stack_analysis.layers)
        analysis_block = analyse(
            stack, labels,
            req.stack_analysis.frequency_start_hz,
            req.stack_analysis.frequency_end_hz,
            req.stack_analysis.frequency_points,
            req.stack_analysis.spacing,
            req.stack_analysis.target_se_db,
            req.stack_analysis.frequency_hz,
        )

    # ---- 4. Frequency sweep ----
    sweep_block = None
    sweep_sensitivity = None
    if req.sweep is not None:
        stack, _ = _resolve(req.sweep.layers)
        res = sweep(stack, req.sweep.frequency_start_hz, req.sweep.frequency_end_hz,
                    req.sweep.frequency_points, req.sweep.spacing)
        sweep_block = {k: v.tolist() for k, v in res.items()}
        sweep_block["total_thickness_m"] = float(sum(l[3] for l in stack))
        sweep_block["target_se_db"] = req.sweep.target_se_db
        sweep_block["failing_ranges_hz"] = (
            [{"start_hz": a, "end_hz": b} for a, b in
             failing_ranges(res["frequency_hz"], res["shielding_effectiveness_db"],
                            req.sweep.target_se_db)]
            if req.sweep.target_se_db is not None else [])
        if req.include_sensitivity and req.sweep.target_se_db is not None:
            sweep_sensitivity = _compute_sensitivity(stack, req.sweep)

    pdf = export_report_pdf(
        label=req.label,
        single=single_block,
        stack=stack_block,
        analysis=analysis_block,
        sweep=sweep_block,
        sweep_sensitivity=sweep_sensitivity,
        sweep_request=req.sweep.model_dump() if req.sweep else None,
        sweep_f_start_hz=req.sweep.frequency_start_hz if req.sweep else None,
        sweep_f_end_hz=req.sweep.frequency_end_hz if req.sweep else None,
        sweep_target_db=req.sweep.target_se_db if req.sweep else None,
    )
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M")
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="em-shield-report-{stamp}.pdf"',
        },
    )


def _compute_sensitivity(stack, sweep_req):
    """Four extra sweeps (thickness/conductivity × ∓10 %) mirroring Page 5."""
    f_start, f_end, n, sp = (sweep_req.frequency_start_hz, sweep_req.frequency_end_hz,
                             sweep_req.frequency_points, sweep_req.spacing)

    def perturb(kind, k):
        out = []
        for (s, e, m, d) in stack:
            if kind == "thickness":
                out.append((s, e, m, d * k))
            else:
                out.append((s * k, e, m, d))
        return out

    def one(ls):
        r = sweep(ls, f_start, f_end, n, sp)
        return {"shielding_effectiveness_db": r["shielding_effectiveness_db"].tolist()}

    return {
        "thickness":    {"lo": one(perturb("thickness", 0.9)),
                         "hi": one(perturb("thickness", 1.1))},
        "conductivity": {"lo": one(perturb("conductivity", 0.9)),
                         "hi": one(perturb("conductivity", 1.1))},
    }