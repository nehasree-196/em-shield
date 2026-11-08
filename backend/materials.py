"""materials.py — loads data/materials.json and resolves a material reference into (sigma, eps_r, mu_r).
NOTE: Page 2 owner may already have this file; merge the two functions below instead of overwriting."""
import json
from pathlib import Path

DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "materials.json"


def list_materials():
    with open(DATA_FILE, encoding="utf-8") as fh:
        return json.load(fh)


def resolve_material(spec):
    """spec is a MaterialSpec: library id OR custom (sigma, eps_r, mu_r). Returns (sigma, eps_r, mu_r, label)."""
    if spec.material_id:
        for m in list_materials():
            if m["id"] == spec.material_id:
                return m["sigma_s_per_m"], m["epsilon_r"], m["mu_r"], m["name"]
        raise KeyError(f"Unknown material_id '{spec.material_id}'")
    return spec.sigma_s_per_m, spec.epsilon_r, spec.mu_r, "Custom material"
