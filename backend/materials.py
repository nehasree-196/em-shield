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

"""Material data access and management for EM-Shield."""

from backend.schemas import MaterialCreate


def load_materials():
    """Load and validate all materials from the JSON database."""

    if not DATA_FILE.exists():
        return []

    with DATA_FILE.open("r", encoding="utf-8") as file:
        materials = json.load(file)

    if not isinstance(materials, list):
        raise ValueError("Material database must contain a JSON list.")

    for index, material in enumerate(materials):
        try:
            MaterialCreate.model_validate(material)
        except Exception as exc:
            raise ValueError(
                f"Invalid material record at index {index}: {exc}"
            ) from exc

    return materials



def save_materials(materials):
    """Save the complete material list to the JSON database."""

    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)

    with DATA_FILE.open("w", encoding="utf-8") as file:
        json.dump(materials, file, indent=4)


def get_material(material_id):
    """Find a material using its unique ID."""

    materials = load_materials()

    for material in materials:
        if material["id"].lower() == material_id.lower():
            return material

    return None


def search_materials(name=None, category=None):
    """Search materials by name and/or category."""

    materials = load_materials()

    if name:
        materials = [
            material for material in materials
            if name.lower() in material["name"].lower()
        ]

    if category:
        materials = [
            material for material in materials
            if material["category"].lower() == category.lower()
        ]

    return materials


def add_material(material_data):
    """Validate and add a new custom material."""

    material = MaterialCreate.model_validate(material_data)

    materials = load_materials()

    if any(
        existing["id"].lower() == material.id.lower()
        for existing in materials
    ):
        raise ValueError(f"Material ID '{material.id}' already exists.")

    new_material = material.model_dump()

    materials.append(new_material)
    save_materials(materials)

    return new_material
