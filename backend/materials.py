
"""Material data access for Page 2 and Page 3.

Page 2 uses the nested MaterialCreate schema.
Page 3 uses the flat electromagnetic material format.
"""

import json
from pathlib import Path

from schemas import MaterialCreate


BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"

# Separate databases
PAGE2_DATA_FILE = DATA_DIR / "materials_page2.json"
PAGE3_DATA_FILE = DATA_DIR / "materials.json"


# =========================================================
# PAGE 2 — MATERIAL LIBRARY
# =========================================================

def load_page2_materials():
    """Load and validate Page 2 materials."""

    if not PAGE2_DATA_FILE.exists():
        return []

    with PAGE2_DATA_FILE.open("r", encoding="utf-8") as file:
        materials = json.load(file)

    if not isinstance(materials, list):
        raise ValueError("Page 2 material database must be a JSON list.")

    for index, material in enumerate(materials):
        try:
            MaterialCreate.model_validate(material)
        except Exception as exc:
            raise ValueError(
                f"Invalid Page 2 material at index {index}: {exc}"
            ) from exc

    return materials


def save_page2_materials(materials):
    """Save Page 2 materials."""

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    with PAGE2_DATA_FILE.open("w", encoding="utf-8") as file:
        json.dump(materials, file, indent=4)


def get_material(material_id):
    """Get a Page 2 material by ID."""

    for material in load_page2_materials():
        if material["id"].lower() == material_id.lower():
            return material

    return None


def search_materials(name=None, category=None):
    """Search Page 2 materials."""

    materials = load_page2_materials()

    if name:
        materials = [
            m for m in materials
            if name.lower() in m["name"].lower()
        ]

    if category:
        materials = [
            m for m in materials
            if m["category"].lower() == category.lower()
        ]

    return materials


def add_material(material_data):
    """Add a material to Page 2 only."""

    material = MaterialCreate.model_validate(material_data)

    materials = load_page2_materials()

    if any(
        existing["id"].lower() == material.id.lower()
        for existing in materials
    ):
        raise ValueError(
            f"Material ID '{material.id}' already exists."
        )

    new_material = material.model_dump()

    materials.append(new_material)

    save_page2_materials(materials)

    return new_material


# =========================================================
# PAGE 3 — SIMULATION MATERIAL LIBRARY
# =========================================================

def load_materials():
    """Load Page 3 flat-format materials."""

    if not PAGE3_DATA_FILE.exists():
        return []

    with PAGE3_DATA_FILE.open("r", encoding="utf-8") as file:
        materials = json.load(file)

    if not isinstance(materials, list):
        raise ValueError(
            "Page 3 material database must be a JSON list."
        )

    required_fields = {
        "id",
        "name",
        "sigma_s_per_m",
        "epsilon_r",
        "mu_r",
    }

    for index, material in enumerate(materials):

        if not isinstance(material, dict):
            raise ValueError(
                f"Invalid Page 3 material at index {index}."
            )

        missing = required_fields - material.keys()

        if missing:
            raise ValueError(
                f"Page 3 material {index} missing fields: {missing}"
            )

    return materials


def list_materials():
    """List Page 3 simulation materials."""

    return load_materials()


def resolve_material(spec):
    """
    Resolve a Page 3 MaterialSpec.

    Returns:
        (sigma, epsilon_r, mu_r, label)
    """

    if spec.material_id:

        for material in load_materials():

            if material["id"].lower() == spec.material_id.lower():

                return (
                    material["sigma_s_per_m"],
                    material["epsilon_r"],
                    material["mu_r"],
                    material["name"],
                )

        raise KeyError(
            f"Unknown material_id '{spec.material_id}'"
        )

    return (
        spec.sigma_s_per_m,
        spec.epsilon_r,
        spec.mu_r,
        "Custom material",
    )


def save_materials(materials):
    """Save Page 3 simulation materials."""

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    with PAGE3_DATA_FILE.open("w", encoding="utf-8") as file:
        json.dump(materials, file, indent=4)
