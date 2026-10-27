"""Placeholder material-data access helpers."""

import json
from pathlib import Path


DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "materials.json"


def load_materials():
    """Load the initial JSON material list."""
    if not DATA_FILE.exists():
        return []
    with DATA_FILE.open("r", encoding="utf-8") as file:
        return json.load(file)
