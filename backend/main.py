"""Placeholder FastAPI entry point for EM-Shield."""

from backend.routes_simulation import router as simulation_router
"""FastAPI entry point for EM-Shield."""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from backend.materials import (
    load_materials,
    get_material,
    search_materials,
    add_material,
)
from backend.schemas import MaterialCreate
app = FastAPI(
    title="EM-Shield API",
    description="API for electromagnetic shielding simulations and material management.",
    version="0.1.0",
)
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
    """Basic health endpoint."""

    return {
        "name": "EM-Shield API",
        "status": "running",
        "message": "EM-Shield backend is working.",
    }


@app.get("/materials")
def list_materials(
    name: str | None = Query(default=None),
    category: str | None = Query(default=None),
):
    """List, search, or filter materials."""

    return search_materials(name=name, category=category)


@app.get("/materials/{material_id}")
def material_details(material_id: str):
    """Get details of a particular material."""

    material = get_material(material_id)

    if material is None:
        raise HTTPException(
            status_code=404,
            detail="Material not found.",
        )

    return material


@app.post("/materials", status_code=201)
def create_material(material_data: MaterialCreate):
    """Add a new custom material."""

    try:
        return add_material(material_data.model_dump())
    except ValueError as error:
        raise HTTPException(
            status_code=409,
            detail=str(error),
        )
