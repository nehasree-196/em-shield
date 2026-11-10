"""Assert the vectorized evaluator agrees with the reference solver.

Run from backend/:  pytest optimization/test_physics_agreement.py
"""
import numpy as np
import pytest

from optimization.se_evaluator import SEEvaluator, to_solver_materials
from physics.multilayer_solver_optimization import calculate_se


def _mat(id_, sigma, eps=1.0, mu=1.0, tan_e=0.0, tan_m=0.0):
    return {"id": id_, "name": id_.title(),
            "properties": {"conductivity_s_m": sigma, "relative_permittivity": eps,
                           "relative_permeability": mu,
                           "dielectric_loss_tangent": tan_e,
                           "magnetic_loss_tangent": tan_m,
                           "mass_density_kg_m3": 1000.0}}


MATERIALS = [
    _mat("copper", 5.8e7),
    _mat("steel", 1.4e6, mu=100, tan_m=0.3),
    _mat("fr4", 0.0, eps=4.4, tan_e=0.02),
]

STACKS = [
    [("copper", 2e-4)],
    [("copper", 1e-4), ("steel", 5e-4)],
    [("steel", 3e-4), ("fr4", 1e-3), ("copper", 5e-5)],
]

FREQS = [1e6, 1e7, 1e8, 1e9]
ANGLES = [0.0, 30.0, 60.0]


@pytest.mark.parametrize("stack", STACKS)
def test_vectorized_matches_reference(stack):
    ev = SEEvaluator(MATERIALS, FREQS, ANGLES)
    solver_mats = to_solver_materials(MATERIALS)
    layers = [{"material": m, "thickness": d} for m, d in stack]

    ref_min = min(
        calculate_se(f, layers, np.radians(a), pol, solver_mats)
        for f in FREQS for a in ANGLES for pol in ("TE", "TM")
    )
    vec = ev.worst_se(stack)
    assert abs(vec - ref_min) < 1e-6, f"vectorized {vec} vs reference {ref_min}"


def test_worst_case_info_fields():
    ev = SEEvaluator(MATERIALS, FREQS, ANGLES)
    info = ev.worst_case_info([("copper", 2e-4)])
    assert set(info) == {"worst_se_db", "frequency_hz", "angle_deg", "polarization"}
    assert info["polarization"] in ("TE", "TM")
    assert info["frequency_hz"] in FREQS
    assert info["angle_deg"] in ANGLES