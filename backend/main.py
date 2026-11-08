"""FastAPI entry point for EM-Shield; simulation routes for pages 3-5 are registered below."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes_simulation import router as simulation_router

app = FastAPI(
    title="EM-Shield API",
    description="API scaffold for electromagnetic shielding simulations.",
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


@app.get("/")
def root():
    """Basic health endpoint placeholder."""
    return {
        "name": "EM-Shield API",
        "status": "placeholder",
        "message": "Simulation endpoints are available under /api.",
    }
