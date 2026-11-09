"""FastAPI entry point for EM-Shield; simulation routes for pages 3-5 are registered below."""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from routes_simulation import router as simulation_router

from materials import (
    load_page2_materials,
    get_material,
    search_materials,
    add_material,
)

from schemas import MaterialCreate


app = FastAPI(
    title="EM-Shield API",
    description="API for electromagnetic shielding simulations and material management.",
    version="0.1.0",
)

# allow the Vite dev server (port 5173) to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# single-layer, multilayer and sweep endpoints
app.include_router(simulation_router)


# Page 3 simulation routes
app.include_router(simulation_router)


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


@app.get("/")
def root():
    return {
        "name": "EM-Shield API",
        "status": "placeholder",
        "message": "Simulation endpoints are available under /api.",
    }


# =========================================================
# PAGE 2 — MATERIAL LIBRARY API
# =========================================================

@app.get("/materials")
def page2_list_materials(
    name: str | None = Query(default=None),
    category: str | None = Query(default=None),
):
    """Return Page 2 materials only."""

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
