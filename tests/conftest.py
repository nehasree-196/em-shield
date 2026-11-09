"""conftest.py — lets the tests import the flat backend modules and the backend.* package imports."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))  # flat imports used inside the tests
sys.path.insert(0, str(ROOT))              # lets backend.* imports resolve