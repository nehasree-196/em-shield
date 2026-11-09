
"""Request and response schemas for EM-Shield."""

from typing import Literal, Optional

from pydantic import BaseModel, Field, ConfigDict, model_validator


# =========================================================
# PAGE 2 — MATERIAL LIBRARY SCHEMAS
# =========================================================

class MaterialProperties(BaseModel):
    """Electromagnetic properties of a material."""

    conductivity_s_m: float | None = Field(
        default=None,
        ge=0,
        description="Electrical conductivity in S/m",
    )

    relative_permittivity: float | None = Field(
        default=None,
        gt=0,
        description="Relative permittivity",
    )

    relative_permeability: float | None = Field(
        default=None,
        gt=0,
        description="Relative permeability",
    )

    dielectric_loss_tangent: float | None = Field(
        default=None,
        ge=0,
        description="Dielectric loss tangent",
    )

    magnetic_loss_tangent: float | None = Field(
        default=None,
        ge=0,
        description="Magnetic loss tangent",
    )


class MaterialSource(BaseModel):
    """Reference used for material property data."""

    property: str = Field(..., min_length=1)
    reference: str = Field(..., min_length=1)
    url: str | None = None


class FrequencyDependentProperties(BaseModel):
    """Material properties measured at a particular frequency."""

    frequency_hz: float = Field(
        ...,
        gt=0,
        description="Frequency in hertz",
    )

    properties: MaterialProperties

    temperature_c: float | None = None

    sources: list[MaterialSource] = Field(
        default_factory=list
    )


class MaterialCreate(BaseModel):
    """Schema for adding a new material."""

    model_config = ConfigDict(str_strip_whitespace=True)

    id: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1)

    category: Literal[
        "conductor",
        "insulator",
        "semiconductor",
        "magnetic",
        "other",
    ]

    grade: str | None = None
    composition: str | None = None

    properties: MaterialProperties

    reference_frequency_hz: float | None = Field(
        default=None,
        gt=0,
    )

    temperature_c: float | None = None

    valid_frequency_min_hz: float | None = Field(
        default=None,
        gt=0,
    )

    valid_frequency_max_hz: float | None = Field(
        default=None,
        gt=0,
    )

    sources: list[MaterialSource] = Field(
        default_factory=list
    )

    frequency_dependent_properties: list[
        FrequencyDependentProperties
    ] = Field(default_factory=list)


# =========================================================
# PAGE 2 — SINGLE LAYER INPUT SCHEMA
# =========================================================

class SingleLayerInput(BaseModel):
    """Input model for a single-layer shielding simulation."""

    material_id: str = Field(
        ...,
        description="Identifier of the selected material",
    )

    frequency_hz: float = Field(
        ...,
        gt=0,
        description="Frequency in hertz",
    )

    thickness_m: float = Field(
        ...,
        gt=0,
        description="Layer thickness in metres",
    )


# =========================================================
# PAGES 3-5 — SIMULATION SCHEMAS
# =========================================================

class MaterialSpec(BaseModel):
    """
    Either a library material ID or all three custom properties.
    """

    material_id: Optional[str] = None

    sigma_s_per_m: Optional[float] = Field(
        default=None,
        ge=0,
    )

    epsilon_r: Optional[float] = Field(
        default=None,
        ge=1,
    )

    mu_r: Optional[float] = Field(
        default=None,
        gt=0,
    )

    @model_validator(mode="after")
    def need_id_or_custom(self):

        custom = (
            self.sigma_s_per_m,
            self.epsilon_r,
            self.mu_r,
        )

        if self.material_id is None and any(
            v is None for v in custom
        ):
            raise ValueError(
                "Give a material_id, or all of "
                "sigma_s_per_m, epsilon_r and mu_r"
            )

        return self


class LayerSpec(BaseModel):

    material: MaterialSpec

    thickness_m: float = Field(
        gt=0,
        le=1.0,
    )


class SingleLayerRequest(BaseModel):

    material: MaterialSpec

    thickness_m: float = Field(
        gt=0,
        le=1.0,
    )

    frequency_hz: float = Field(
        gt=0,
        le=1e12,
    )


class MultilayerRequest(BaseModel):

    layers: list[LayerSpec] = Field(
        min_length=1,
        max_length=20,
    )

    frequency_hz: float = Field(
        gt=0,
        le=1e12,
    )


class SweepRequest(BaseModel):

    layers: list[LayerSpec] = Field(
        min_length=1,
        max_length=20,
    )

    frequency_start_hz: float = Field(
        gt=0,
        le=1e12,
    )

    frequency_end_hz: float = Field(
        gt=0,
        le=1e12,
    )

    frequency_points: int = Field(
        ge=2,
        le=2000,
    )

    spacing: Literal["log", "linear"] = "log"

    target_se_db: Optional[float] = Field(
        default=None,
        ge=0,
    )

    @model_validator(mode="after")
    def start_below_end(self):

        if self.frequency_start_hz >= self.frequency_end_hz:
            raise ValueError(
                "frequency_start_hz must be smaller than frequency_end_hz"
            )

        return self
