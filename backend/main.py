"""FastAPI entry point for EM-Shield: Page 2 materials, pages 3-5 simulation, page 6 optimization."""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from materials import (
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

# allow the Vite dev server to call this API (added once)
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

# pages 3-5: single-layer, multilayer and sweep endpoints (under /api)
app.include_router(simulation_router)

# page 6: optimization endpoints (under /api/optimization)
app.include_router(optimization_router)


@app.get("/")
def root():
    return {
        "name": "EM-Shield API",
        "status": "ok",
        "message": "Simulation endpoints are under /api, materials under /materials. Docs at /docs.",
    }


# =========================================================
# PAGE 2 — MATERIAL LIBRARY API
# =========================================================

@app.get("/materials")
def page2_list_materials(
    name: str | None = Query(default=None),
    category: str | None = Query(default=None),
):
    """Return Page 2 materials (also the source list for the Page 6 optimizer)."""

    return search_materials(
        name=name,
        category=category,
    )


@app.get("/materials/{material_id}")
def page2_material_details(material_id: str):
    """Get a Page 2 material."""

    material = get_material(material_id)

    if material is None:
        raise HTTPException(
            status_code=404,
            detail="Material not found.",
        )

    return material


@app.post("/materials", status_code=201)
def page2_create_material(material_data: MaterialCreate):
    """Create a Page 2 material."""

    try:
        return add_material(material_data.model_dump())

    except ValueError as error:
        raise HTTPException(
            status_code=409,
            detail=str(error),
        )