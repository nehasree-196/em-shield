"""test_multilayer.py — transfer-matrix checks: equivalence with the closed form, ordering, stability."""
import numpy as np
from multilayer import stack_response, sweep
from simulation import single_layer


def test_one_layer_stack_equals_closed_form():
    f = np.logspace(5, 10, 40)
    a = stack_response(f, [(5.8e7, 1.0, 1.0, 1e-4)])
    b = single_layer(f, 5.8e7, 1.0, 1.0, 1e-4)
    assert np.allclose(a["shielding_effectiveness_db"], b["shielding_effectiveness_db"], rtol=1e-8, atol=1e-8)
    assert np.allclose(a["reflection_power"], b["reflection_power"], atol=1e-10)


def test_lossless_stack_conserves_energy():
    f = np.linspace(1e8, 2e9, 30)
    r = stack_response(f, [(0.0, 4.0, 1.0, 2e-3), (0.0, 2.9, 1.0, 3e-3)])
    assert np.allclose(r["reflection_power"] + r["transmission_power"], 1.0, atol=1e-9)


def test_identical_adjacent_layers_merge():
    f = np.logspace(6, 9, 20)
    split = stack_response(f, [(5.8e7, 1, 1, 1e-4), (5.8e7, 1, 1, 1e-4)])
    whole = stack_response(f, [(5.8e7, 1, 1, 2e-4)])
    assert np.allclose(split["shielding_effectiveness_db"], whole["shielding_effectiveness_db"], rtol=1e-6)


def test_transmission_is_reciprocal_when_order_reversed():
    f = np.array([1e9])
    ab = stack_response(f, [(5.8e7, 1, 1, 1e-4), (0.0, 4.0, 1, 2e-3)])
    ba = stack_response(f, [(0.0, 4.0, 1, 2e-3), (5.8e7, 1, 1, 1e-4)])
    # reciprocity: transmission through a passive reciprocal stack is the same in both directions
    assert np.allclose(ab["transmission_power"], ba["transmission_power"], rtol=1e-6, atol=1e-30)


def test_very_thick_stack_no_overflow():
    r = stack_response(np.array([1e9, 1e10]), [(5.8e7, 1, 1, 0.05), (3.5e7, 1, 1, 0.05)])
    assert np.all(np.isfinite(r["shielding_effectiveness_db"]))
    assert not np.any(np.isnan(r["reflection_power"]))


def test_sweep_shape():
    r = sweep([(5.8e7, 1, 1, 1e-4)], 1e6, 1e9, 50)
    assert len(r["frequency_hz"]) == 50 and len(r["shielding_effectiveness_db"]) == 50
