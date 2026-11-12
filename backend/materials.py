"""Material-data access helpers: single source of truth = materials_final.json."""

import json
from pathlib import Path

from schemas import MaterialCreate

DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "materials_final.json"
DATA_DIR = DATA_FILE.parent


# =========================================================
# CORE LOADER (nested schema = materials_final.json)
# =========================================================

def load_page2_materials():
    """Load and validate the canonical material library."""

    if not DATA_FILE.exists():
        return []

    with DATA_FILE.open("r", encoding="utf-8") as file:
        materials = json.load(file)

    if not isinstance(materials, list):
        raise ValueError("Material database must be a JSON list.")

    for index, material in enumerate(materials):
        try:
            MaterialCreate.model_validate(material)
        except Exception as exc:
            raise ValueError(
                f"Invalid material at index {index}: {exc}"
            ) from exc

    return materials


def save_page2_materials(materials):
    """Persist the canonical material library."""

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    with DATA_FILE.open("w", encoding="utf-8") as file:
        json.dump(materials, file, indent=4)


def get_material(material_id):
    for material in load_page2_materials():
        if material["id"].lower() == material_id.lower():
            return material
    return None


def search_materials(name=None, category=None):
    materials = load_page2_materials()

    if name:
        materials = [m for m in materials if name.lower() in m["name"].lower()]

    if category:
        materials = [m for m in materials if m["category"].lower() == category.lower()]

    return materials


def add_material(material_data):
    material = MaterialCreate.model_validate(material_data)
    materials = load_page2_materials()

    if any(existing["id"].lower() == material.id.lower() for existing in materials):
        raise ValueError(f"Material ID '{material.id}' already exists.")

    new_material = material.model_dump()
    materials.append(new_material)
    save_page2_materials(materials)
    return new_material


# =========================================================
# PAGE 3-5 SIMULATION ADAPTER (flatten materials_final.json)
# =========================================================

def load_materials():
    """Flat view of the canonical library for the simulation solver."""

    flat = []
    for m in load_page2_materials():
        p = m.get("properties") or {}
        flat.append({
            "id": m["id"],
            "name": m["name"],
            "sigma_s_per_m": p.get("conductivity_s_m") or 0.0,
            "epsilon_r": p.get("relative_permittivity") or 1.0,
            "mu_r": p.get("relative_permeability") or 1.0,
        })
    return flat


def list_materials():
    return load_materials()


def resolve_material(spec):
    """Resolve a MaterialSpec -> (sigma, epsilon_r, mu_r, label)."""

    if spec.material_id:
        for material in load_materials():
            if material["id"].lower() == spec.material_id.lower():
                return (
                    material["sigma_s_per_m"],
                    material["epsilon_r"],
                    material["mu_r"],
                    material["name"],
                )
        raise KeyError(f"Unknown material_id '{spec.material_id}'")

    return (spec.sigma_s_per_m, spec.epsilon_r, spec.mu_r, "Custom material")


def save_materials(materials):
    """Kept for compatibility; writes to the canonical file."""
    save_page2_materials(materials)