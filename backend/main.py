"""FastAPI entry point for EM-Shield: Page 2 materials, pages 3-5 simulation, page 6 optimization."""

from fastapi import APIRouter, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from materials import (
    load_materials,
    get_material,
    search_materials,
    add_material,
)
from routes_optimization import router as optimization_router
from routes_simulation import router as simulation_router
from schemas import MaterialCreate


app = FastAPI(
    title="EM-Shield API",
    description="API for electromagnetic shielding simulations, material management and optimization.",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# MOUNT ROUTERS
# =========================================================
# routes_simulation.py declares its own prefix (APIRouter(prefix="/api")),
# so we must NOT add another prefix here or we get /api/api/... .
app.include_router(simulation_router)

# routes_optimization.py declares APIRouter(prefix="/api/optimization"),
# so again: no extra prefix.
app.include_router(optimization_router)


# =========================================================
# PAGE 2 — MATERIAL LIBRARY API (mounted under /api)
# =========================================================

materials_router = APIRouter()


@materials_router.get("/materials")
def page2_list_materials(
    name: str | None = Query(default=None),
    category: str | None = Query(default=None),
):
    """Return Page 2 materials (also the source list for the Page 6 optimizer)."""
    return search_materials(name=name, category=category)


@materials_router.get("/materials/{material_id}")
def page2_material_details(material_id: str):
    """Get a Page 2 material."""
    material = get_material(material_id)
    if material is None:
        raise HTTPException(status_code=404, detail="Material not found.")
    return material


@materials_router.post("/materials", status_code=201)
def page2_create_material(material_data: MaterialCreate):
    """Create a Page 2 material."""
    try:
        return add_material(material_data.model_dump())
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error))


app.include_router(materials_router, prefix="/api")


@app.get("/")
def root():
    return {
        "name": "EM-Shield API",
        "status": "ok",
        "message": (
            "All frontend endpoints are under /api "
            "(/api/materials, /api/single-layer, /api/multilayer, /api/sweep, "
            "/api/optimization/*). Docs at /docs."
        ),
    }