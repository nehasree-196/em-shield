
"""Request and response schemas for EM-Shield."""

from typing import Literal
from pydantic import BaseModel, Field, ConfigDict, model_validator


class SingleLayerInput(BaseModel):
    """Input model for a single-layer shielding simulation."""

    material_id: str = Field(
        ..., description="Identifier of the selected material"
    )
    frequency_hz: float = Field(
        ..., gt=0, description="Frequency in hertz"
    )
    thickness_m: float = Field(
        ..., gt=0, description="Layer thickness in metres"
    )



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
        ..., gt=0, description="Frequency in hertz"
    )

    properties: MaterialProperties

    temperature_c: float | None = None

    sources: list[MaterialSource] = Field(default_factory=list)



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

    # Material identification
    grade: str | None = None
    composition: str | None = None

    # General or reference electromagnetic properties
    properties: MaterialProperties

    # Conditions associated with the general properties
    reference_frequency_hz: float | None = Field(
        default=None,
        gt=0,
    )
    temperature_c: float | None = None

    # Frequency range supported by the available material data
    valid_frequency_min_hz: float | None = Field(
        default=None,
        gt=0,
        description="Minimum supported frequency in Hz",
    )
    valid_frequency_max_hz: float | None = Field(
        default=None,
        gt=0,
        description="Maximum supported frequency in Hz",
    )

    # Sources for the general properties
    sources: list[MaterialSource] = Field(
        default_factory=list
    )

    # Additional properties measured at specific frequencies
    frequency_dependent_properties: list[
        FrequencyDependentProperties
    ] = Field(default_factory=list)
