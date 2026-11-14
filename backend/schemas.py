"""Request and response schemas for EM-Shield."""

from typing import Literal, Optional

from pydantic import BaseModel, Field, ConfigDict, model_validator, AliasChoices


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
    mass_density: float | None = Field(
        default=None,
        ge=0,
        description="Mass density in kg/m³",
    )


class MaterialSource(BaseModel):
    property: str = Field(..., min_length=1)
    reference: str = Field(..., min_length=1)
    url: str | None = None


class FrequencyDependentProperties(BaseModel):
    frequency_hz: float = Field(..., gt=0)
    properties: MaterialProperties
    temperature_c: float | None = None
    sources: list[MaterialSource] = Field(default_factory=list)


class MaterialCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    id: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1)

    category: Literal[
        "Conductor",
        "Insulator",
        "Semiconductor",
    ]

    # Material identification
    grade: str | None = None
    composition: str | None = None

    properties: MaterialProperties

    reference_frequency_hz: float | None = Field(default=None, gt=0)
    temperature_c: float | None = None
    valid_frequency_min_hz: float | None = Field(default=None, gt=0)
    valid_frequency_max_hz: float | None = Field(default=None, gt=0)
    sources: list[MaterialSource] = Field(default_factory=list)
    frequency_dependent_properties: list[FrequencyDependentProperties] = Field(default_factory=list)


# =========================================================
# PAGE 2 — SINGLE LAYER INPUT SCHEMA
# =========================================================

class SingleLayerInput(BaseModel):
    material_id: str = Field(..., description="Identifier of the selected material")
    frequency_hz: float = Field(..., gt=0)
    thickness_m: float = Field(..., gt=0)


# =========================================================
# PAGES 3-5 — SIMULATION SCHEMAS
# =========================================================

class MaterialSpec(BaseModel):
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
    layers: list[LayerSpec] = Field(min_length=1, max_length=20)
    frequency_hz: float = Field(gt=0, le=1e12)


class SweepRequest(BaseModel):
    layers: list[LayerSpec] = Field(min_length=1, max_length=20)
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

class MultilayerAnalysisRequest(BaseModel):
    """Band + target analysis for the Multilayer page."""
    layers: list[LayerSpec] = Field(min_length=1, max_length=20)
    frequency_hz: float = Field(gt=0, le=1e12)            # evaluation frequency for per-layer contribution
    frequency_start_hz: float = Field(gt=0, le=1e12)
    frequency_end_hz: float = Field(gt=0, le=1e12)
    frequency_points: int = Field(default=201, ge=2, le=1000)
    spacing: Literal["log", "linear"] = "log"
    target_se_db: float = Field(ge=0)

    @model_validator(mode="after")
    def start_below_end(self):
        if self.frequency_start_hz >= self.frequency_end_hz:
            raise ValueError("frequency_start_hz must be smaller than frequency_end_hz")
        return self
# =========================================================
# PAGE 6 — OPTIMIZATION SCHEMAS
# =========================================================

class OptMaterialProperties(BaseModel):
    """The material properties. Allowed to be None here, resolved by the service."""
    model_config = ConfigDict(extra="ignore")

    conductivity_s_m: Optional[float] = Field(default=None, ge=0)
    relative_permittivity: Optional[float] = Field(default=None, gt=0)
    relative_permeability: Optional[float] = Field(default=None, gt=0)
    dielectric_loss_tangent: Optional[float] = Field(default=None, ge=0)
    magnetic_loss_tangent: Optional[float] = Field(default=None, ge=0)
    mass_density_kg_m3: Optional[float] = Field(default=None, gt=0, validation_alias=AliasChoices("mass_density_kg_m3", "mass_density"),)    
    magnetic_saturation_a_m: Optional[float] = Field(default=None, ge=0)
    lande_g_factor: Optional[float] = Field(default=None, gt=0)
    delta_h_a_m: Optional[float] = Field(default=None, ge=0)


class OptMaterial(BaseModel):
    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)

    id: str = Field(min_length=1)
    name: Optional[str] = None
    properties: OptMaterialProperties
    reference_frequency_hz: Optional[float] = Field(default=None, gt=0)
    frequency_dependent_properties: list[dict] = Field(default_factory=list)
    min_thickness_m: Optional[float] = Field(default=None, gt=0)
    max_thickness_m: Optional[float] = Field(default=None, gt=0)


class OptimizationRequest(BaseModel):
    materials: list[OptMaterial] = Field(min_length=1, max_length=40)
    target_se_db: float = Field(gt=0)
    frequency_min_hz: float = Field(gt=0, le=1e12)
    frequency_max_hz: float = Field(gt=0, le=1e12)
    max_incidence_angle_deg: float = Field(default=0.0, ge=0, le=85)
    max_layers: int = Field(default=3, ge=1, le=6)
    max_total_thickness_m: Optional[float] = Field(default=None, gt=0)
    default_min_layer_thickness_m: float = Field(default=1e-5, gt=0)
    default_max_layer_thickness_m: float = Field(default=2e-3, gt=0)
    objective: Literal["thickness", "mass"] = "thickness"
    max_mass_kg_m2: Optional[float] = Field(default=None, gt=0)
    must_include_ids: list[str] = Field(default_factory=list)
    top_k: int = Field(default=10, ge=1, le=50)
    effort: Literal["quick", "normal", "thorough"] = "normal"
    safety_margin_db: float = Field(default=1.0, ge=0)
    seed: Optional[int] = None

    @model_validator(mode="after")
    def _check(self):
        if self.frequency_min_hz > self.frequency_max_hz:
            raise ValueError("frequency_min_hz must not exceed frequency_max_hz")
        ids = [m.id.lower() for m in self.materials]
        if len(set(ids)) != len(ids):
            raise ValueError("material ids must be unique")
        missing = [i for i in self.must_include_ids if i.lower() not in ids]
        if missing:
            raise ValueError(f"must_include_ids not in the material list: {missing}")
        if len(set(self.must_include_ids)) > self.max_layers:
            raise ValueError("more must-include materials than max_layers")
        return self


class ResultFilter(BaseModel):
    include_ids: list[str] = Field(default_factory=list)
    exclude_ids: list[str] = Field(default_factory=list)
    max_layers: Optional[int] = Field(default=None, ge=1)
    max_total_thickness_m: Optional[float] = Field(default=None, gt=0)
    max_mass_kg_m2: Optional[float] = Field(default=None, gt=0)
    min_margin_db: Optional[float] = Field(default=None, ge=0)
    only_validated: bool = True
    sort_by: Literal["objective", "thickness", "mass", "margin", "layers"] = "objective"
    top_k: int = Field(default=10, ge=1, le=2000)


class FilterRequest(ResultFilter):
    run_id: str