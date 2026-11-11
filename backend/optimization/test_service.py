"""End-to-end tests of the optimizer. Run from backend/:  pytest optimization/"""
import pytest
from optimization import run_optimization, filter_candidates
from optimization.schemas import OptimizationRequest, ResultFilter


def mat(id, sigma, eps=1.0, mu=1.0, tan_e=None, tan_m=None, rho=None, **extra):
    return {"id": id, "name": id.title(),
            "properties": {"conductivity_s_m": sigma, "relative_permittivity": eps,
                           "relative_permeability": mu,
                           "dielectric_loss_tangent": tan_e,
                           "magnetic_loss_tangent": tan_m,
                           "mass_density_kg_m3": rho,
                           "magnetic_saturation_a_m": 4.8e5,
                           "lande_g_factor": 2.2, "delta_h_a_m": 1e3}, **extra}


MATERIALS = [
    mat("copper", 5.8e7, rho=8960),
    mat("aluminium", 3.5e7, rho=2700),
    mat("steel", 1.4e6, mu=100, tan_m=0.3, rho=7850, reference_frequency_hz=1e6),
    mat("fr4", 0.0, eps=4.4, tan_e=0.02, rho=1850, max_thickness_m=3e-3),
]


def request(**kw):
    base = dict(materials=MATERIALS, target_se_db=90,
                frequency_min_hz=1e6, frequency_max_hz=1e9,
                max_incidence_angle_deg=60, effort="quick", seed=1)
    return OptimizationRequest(**{**base, **kw})


def test_returns_ranked_validated_candidates():
    r = run_optimization(request())
    assert r["feasible_found"] and 1 <= len(r["candidates"]) <= 10
    th = [c["total_thickness_m"] for c in r["candidates"] if c["passes_dense_validation"]]
    assert th == sorted(th)
    assert all(c["worst_case_se_db"] >= 90
               for c in r["candidates"] if c["passes_dense_validation"])
    keys = {tuple(l["material_id"] for l in c["layers"]) + tuple(round(l["thickness_m"], 9)
                                                                 for l in c["layers"])
            for c in r["candidates"]}
    assert len(keys) == len(r["candidates"])


def test_respects_user_thickness_limits_and_layer_cap():
    mats = [dict(m, max_thickness_m=2e-4) if m["id"] == "copper" else m for m in MATERIALS]
    r = run_optimization(request(materials=mats, max_layers=2))
    for c in r["candidates"]:
        assert c["layer_count"] <= 2
        for l in c["layers"]:
            if l["material_id"] == "copper":
                assert l["thickness_m"] <= 2e-4 + 1e-12


def test_must_include_and_filter():
    r = run_optimization(request(must_include_ids=["fr4"], max_layers=3))
    assert all("fr4" in [l["material_id"] for l in c["layers"]] for c in r["candidates"])
    out = filter_candidates(r["run_id"], ResultFilter(exclude_ids=["steel"], max_layers=2))
    for c in out["candidates"]:
        ids = [l["material_id"] for l in c["layers"]]
        assert "steel" not in ids and len(ids) <= 2


def test_mass_objective_needs_density():
    bad = [dict(m, properties=dict(m["properties"], mass_density_kg_m3=None)) for m in MATERIALS]
    with pytest.raises(ValueError):
        run_optimization(request(materials=bad, objective="mass"))
    r = run_optimization(request(objective="mass"))
    m = [c["areal_mass_kg_m2"] for c in r["candidates"] if c["passes_dense_validation"]]
    assert m == sorted(m)


def test_impossible_target_returns_closest():
    r = run_optimization(request(target_se_db=5000, max_total_thickness_m=1e-3))
    assert not r["feasible_found"] and r["candidates"] and not r["candidates"][0]["passes_dense_validation"]


def test_bad_inputs_rejected():
    with pytest.raises(Exception):
        request(frequency_min_hz=1e9, frequency_max_hz=1e6)
    with pytest.raises(Exception):
        request(must_include_ids=["gold"])