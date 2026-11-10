"""routes_optimization.py - FastAPI routes for Page 6. All numbers come from the Python optimizer."""
from fastapi import APIRouter, HTTPException

from optimization import filter_candidates, run_optimization
from optimization.schemas import FilterRequest, OptimizationRequest

router = APIRouter(prefix="/api/optimization")


@router.post("/run")
def run(req: OptimizationRequest):
    """Search, rank, return the top_k validated stacks (+ run_id for filtering)."""
    try:
        return run_optimization(req)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.post("/filter")
def filter_run(req: FilterRequest):
    """Re-filter / re-sort the candidates of an earlier run without searching again."""
    try:
        return filter_candidates(req.run_id, req)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc))