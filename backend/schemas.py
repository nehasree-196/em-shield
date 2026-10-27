"""Placeholder request/response schemas."""

from pydantic import BaseModel, Field


class SingleLayerInput(BaseModel):
    """Example input model; not yet connected to a simulation."""

    material_id: str = Field(..., description="Identifier of the selected material")
    frequency_hz: float = Field(..., gt=0, description="Frequency in hertz")
    thickness_m: float = Field(..., gt=0, description="Layer thickness in metres")
