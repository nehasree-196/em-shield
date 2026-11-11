"""conftest.py — lets the tests import the flat backend modules (simulation, multilayer, ...)."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))
