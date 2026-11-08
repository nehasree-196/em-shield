
"""Material-data access helpers: load the JSON library and resolve a material reference."""

import json
from pathlib import Path


DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "materials.json"


def load_materials():
    """Load the initial JSON material list."""
    if not DATA_FILE.exists():
        return []
    with DATA_FILE.open("r", encoding="utf-8") as file:
        return json.load(file)


def list_materials():
    """Used by GET /api/materials."""
    return load_materials()


def resolve_material(spec):
    """spec is a MaterialSpec: library id OR custom (sigma, eps_r, mu_r). Returns (sigma, eps_r, mu_r, label)."""
    if spec.material_id:
        for m in load_materials():
            if m["id"] == spec.material_id:
                return m["sigma_s_per_m"], m["epsilon_r"], m["mu_r"], m["name"]
        raise KeyError(f"Unknown material_id '{spec.material_id}'")
    return spec.sigma_s_per_m, spec.epsilon_r, spec.mu_r, "Custom material"
