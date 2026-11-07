"""Placeholder FastAPI entry point for EM-Shield."""

from fastapi import FastAPI
from routes_simulation import router as routes_router
app = FastAPI(
    title="EM-Shield API",
    description="API scaffold for electromagnetic shielding simulations.",
    version="0.1.0",
)
app.include_router(routes_router)

@app.get("/")
def root():
    """Basic health endpoint placeholder."""
    return {
        "name": "EM-Shield API",
        "status": "placeholder",
        "message": "Simulation endpoints have not been implemented yet.",
    }
