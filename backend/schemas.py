
"""Request schemas: the original placeholder plus the models for pages 3-5."""

from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator


class SingleLayerInput(BaseModel):
    """Example input model; not yet connected to a simulation."""

    material_id: str = Field(..., description="Identifier of the selected material")
    frequency_hz: float = Field(..., gt=0, description="Frequency in hertz")
    thickness_m: float = Field(..., gt=0, description="Layer thickness in metres")


class MaterialSpec(BaseModel):
    # either a library id, or all three custom properties (SI / dimensionless)
    material_id: Optional[str] = None
    sigma_s_per_m: Optional[float] = Field(default=None, ge=0)
    epsilon_r: Optional[float] = Field(default=None, ge=1)
    mu_r: Optional[float] = Field(default=None, ge=1)

    @model_validator(mode="after")
    def need_id_or_custom(self):
        custom = (self.sigma_s_per_m, self.epsilon_r, self.mu_r)
        if self.material_id is None and any(v is None for v in custom):
            raise ValueError("Give a material_id, or all of sigma_s_per_m, epsilon_r and mu_r")
        return self


class LayerSpec(BaseModel):
    material: MaterialSpec
    thickness_m: float = Field(gt=0, le=1.0)


class SingleLayerRequest(BaseModel):
    material: MaterialSpec
    thickness_m: float = Field(gt=0, le=1.0)
    frequency_hz: float = Field(gt=0, le=1e12)


class MultilayerRequest(BaseModel):
    layers: list[LayerSpec] = Field(min_length=1, max_length=20)  # order = incident side first
    frequency_hz: float = Field(gt=0, le=1e12)


class SweepRequest(BaseModel):
    layers: list[LayerSpec] = Field(min_length=1, max_length=20)  # one layer = single-layer design
    frequency_start_hz: float = Field(gt=0, le=1e12)
    frequency_end_hz: float = Field(gt=0, le=1e12)
    frequency_points: int = Field(ge=2, le=2000)
    spacing: Literal["log", "linear"] = "log"
    target_se_db: Optional[float] = Field(default=None, ge=0)

    @model_validator(mode="after")
    def start_below_end(self):
        if self.frequency_start_hz >= self.frequency_end_hz:
            raise ValueError("frequency_start_hz must be smaller than frequency_end_hz")
        return self
