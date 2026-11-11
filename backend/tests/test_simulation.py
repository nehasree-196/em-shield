"""test_simulation.py — single-layer physics checks against analytical reference cases."""
import numpy as np
from simulation import ETA0, MU0, EPS0, C0, single_layer, skin_depth, skin_depth_good_conductor


def test_good_conductor_skin_depth_matches_approximation():
    f = np.array([1e6, 1e9])
    exact = skin_depth(f, 5.8e7, 1.0, 1.0)
    approx = skin_depth_good_conductor(f, 5.8e7, 1.0)
    assert np.allclose(exact, approx, rtol=1e-3)


def test_lossless_slab_conserves_energy():
    f = np.linspace(1e8, 3e9, 50)
    r = single_layer(f, 0.0, 4.0, 1.0, 5e-3)
    assert np.allclose(r["reflection_power"] + r["transmission_power"], 1.0, atol=1e-9)
    assert np.allclose(r["absorption_power"], 0.0, atol=1e-9)


def test_quarter_and_half_wave_dielectric_slab():
    n, f0 = 2.0, 1e9                                     # eps_r = 4 -> n = 2
    lam_in = C0 / f0 / n
    quarter = single_layer(np.array([f0]), 0.0, 4.0, 1.0, lam_in / 4)
    half = single_layer(np.array([f0]), 0.0, 4.0, 1.0, lam_in / 2)
    assert np.isclose(quarter["reflection_power"][0], ((n**2 - 1) / (n**2 + 1)) ** 2, atol=1e-9)  # 0.36
    assert np.isclose(half["reflection_power"][0], 0.0, atol=1e-9)


def test_thick_copper_is_finite():
    r = single_layer(np.array([1e9, 1e10]), 5.8e7, 1.0, 1.0, 0.05)
    assert np.all(np.isfinite(r["shielding_effectiveness_db"]))
    assert np.all(r["shielding_effectiveness_db"] > 1000)


def test_schelkunoff_thick_conductor():
    # thick good conductor: SE ~ R + A, R = 20log10(eta0/(4|eta|)), A = 8.686 d/delta (B ~ 0)
    f, sigma, d = 1e6, 5.8e7, 1e-3
    w = 2 * np.pi * f
    eta_mag = np.sqrt(w * MU0 / sigma)
    delta = np.sqrt(2 / (w * MU0 * sigma))
    expected = 20 * np.log10(ETA0 / (4 * eta_mag)) + 8.686 * d / delta
    got = single_layer(np.array([f]), sigma, 1.0, 1.0, d)["shielding_effectiveness_db"][0]
    assert abs(got - expected) < 0.5
