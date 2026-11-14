import { useState } from "react";
import type { OptimizationRequest } from "../types";

type Props = {
  value: OptimizationRequest;
  onChange: (v: OptimizationRequest) => void;
};

const FREQ_UNITS = { Hz: 1, kHz: 1e3, MHz: 1e6, GHz: 1e9 };
const LEN_UNITS = { m: 1, mm: 1e-3, "µm": 1e-6, nm: 1e-9 };

const toStr = (num: number | undefined) => (num === undefined ? "" : num.toString());

// Clamp a parsed numeric input to >= 0. Returns undefined for empty/invalid.
const clampNonNegative = (val: string): number | undefined => {
  if (val === "") return undefined;
  const num = parseFloat(val);
  if (isNaN(num)) return undefined;
  return num < 0 ? 0 : num;
};

export function ConditionsForm({ value, onChange }: Props) {
  const [fminUnit, setFminUnit] = useState<keyof typeof FREQ_UNITS>("Hz");
  const [fmaxUnit, setFmaxUnit] = useState<keyof typeof FREQ_UNITS>("Hz");
  const [minLenUnit, setMinLenUnit] = useState<keyof typeof LEN_UNITS>("µm");
  const [maxLenUnit, setMaxLenUnit] = useState<keyof typeof LEN_UNITS>("µm");

  const [targetVal, setTargetVal] = useState(toStr(value.target_se_db));
  const [fminVal, setFminVal] = useState(toStr(value.frequency_min_hz));
  const [fmaxVal, setFmaxVal] = useState(toStr(value.frequency_max_hz));
  const [minLenVal, setMinLenVal] = useState(toStr(value.default_min_layer_thickness_m));
  const [maxLenVal, setMaxLenVal] = useState(toStr(value.default_max_layer_thickness_m));

  const set = <K extends keyof OptimizationRequest>(key: K, v: OptimizationRequest[K]) =>
    onChange({ ...value, [key]: v });

  const handleTarget = (val: string) => {
    setTargetVal(val);
    set("target_se_db", clampNonNegative(val));
  };

  const handleFreq = (field: "frequency_min_hz" | "frequency_max_hz", val: string, unit: number) => {
    if (field === "frequency_min_hz") setFminVal(val);
    else setFmaxVal(val);

    const clamped = clampNonNegative(val);
    set(field, clamped === undefined ? undefined : clamped * unit);
  };

  const handleLen = (field: "default_min_layer_thickness_m" | "default_max_layer_thickness_m", val: string, unit: number) => {
    if (field === "default_min_layer_thickness_m") setMinLenVal(val);
    else setMaxLenVal(val);

    const clamped = clampNonNegative(val);
    set(field, clamped === undefined ? undefined : clamped * unit);
  };

  const changeFminUnit = (newUnit: keyof typeof FREQ_UNITS) => {
    setFminUnit(newUnit);
    handleFreq("frequency_min_hz", fminVal, FREQ_UNITS[newUnit]);
  };

  const changeFmaxUnit = (newUnit: keyof typeof FREQ_UNITS) => {
    setFmaxUnit(newUnit);
    handleFreq("frequency_max_hz", fmaxVal, FREQ_UNITS[newUnit]);
  };

  const changeMinLenUnit = (newUnit: keyof typeof LEN_UNITS) => {
    setMinLenUnit(newUnit);
    handleLen("default_min_layer_thickness_m", minLenVal, LEN_UNITS[newUnit]);
  };

  const changeMaxLenUnit = (newUnit: keyof typeof LEN_UNITS) => {
    setMaxLenUnit(newUnit);
    handleLen("default_max_layer_thickness_m", maxLenVal, LEN_UNITS[newUnit]);
  };

  return (
    <div className="opt-form-group">
      <label className="opt-field">
        <span>Target SE (dB) *</span>
        <input
          type="number" min={0} value={targetVal}
          onChange={(e) => handleTarget(e.target.value)}
        />
      </label>

      <div className="opt-row">
        <label className="opt-field">
          <span>F min *</span>
          <div className="opt-input-unit">
            <input
              type="number" min={0} value={fminVal}
              onChange={(e) => handleFreq("frequency_min_hz", e.target.value, FREQ_UNITS[fminUnit])}
            />
            <select value={fminUnit} onChange={(e) => changeFminUnit(e.target.value as any)}>
              {Object.keys(FREQ_UNITS).map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </label>
        <label className="opt-field">
          <span>F max *</span>
          <div className="opt-input-unit">
            <input
              type="number" min={0} value={fmaxVal}
              onChange={(e) => handleFreq("frequency_max_hz", e.target.value, FREQ_UNITS[fmaxUnit])}
            />
            <select value={fmaxUnit} onChange={(e) => changeFmaxUnit(e.target.value as any)}>
              {Object.keys(FREQ_UNITS).map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </label>
      </div>

      <div className="opt-row">
        <label className="opt-field">
          <span>Min layer thick.</span>
          <div className="opt-input-unit">
            <input
              type="number" min={0} value={minLenVal}
              onChange={(e) => handleLen("default_min_layer_thickness_m", e.target.value, LEN_UNITS[minLenUnit])}
            />
            <select value={minLenUnit} onChange={(e) => changeMinLenUnit(e.target.value as any)}>
              {Object.keys(LEN_UNITS).map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </label>
        <label className="opt-field">
          <span>Max layer thick.</span>
          <div className="opt-input-unit">
            <input
              type="number" min={0} value={maxLenVal}
              onChange={(e) => handleLen("default_max_layer_thickness_m", e.target.value, LEN_UNITS[maxLenUnit])}
            />
            <select value={maxLenUnit} onChange={(e) => changeMaxLenUnit(e.target.value as any)}>
              {Object.keys(LEN_UNITS).map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </label>
      </div>

      <div className="opt-row">
        <label className="opt-field">
          <span>Max angle (°) *</span>
          <input
            type="number" min={0} max={85} value={toStr(value.max_incidence_angle_deg)}
            onChange={(e) => set("max_incidence_angle_deg", e.target.value === "" ? undefined : Number(e.target.value))}
          />
        </label>
        <label className="opt-field">
          <span>Max layers *</span>
          <input
            type="number" min={1} max={6} value={toStr(value.max_layers)}
            onChange={(e) => set("max_layers", e.target.value === "" ? undefined : Number(e.target.value))}
          />
        </label>
      </div>

      <div className="opt-row">
        <label className="opt-field">
          <span>Objective</span>
          <select value={value.objective} onChange={(e) => set("objective", e.target.value as any)}>
            <option value="thickness">Minimize thickness</option>
            <option value="mass">Minimize areal mass</option>
          </select>
        </label>
        <label className="opt-field">
          <span>Effort</span>
          <select value={value.effort} onChange={(e) => set("effort", e.target.value as any)}>
            <option value="quick">Quick</option>
            <option value="normal">Normal</option>
            <option value="thorough">Thorough</option>
          </select>
        </label>
      </div>

      <div className="opt-row">
        <label className="opt-field">
          <span>Top K *</span>
          <input
            type="number" min={1} max={50} value={toStr(value.top_k)}
            onChange={(e) => set("top_k", e.target.value === "" ? undefined : Number(e.target.value))}
          />
        </label>
        <label className="opt-field">
          <span>Safety margin (dB) *</span>
          <input
            type="number" min={0} step={0.5} value={toStr(value.safety_margin_db)}
            onChange={(e) => set("safety_margin_db", e.target.value === "" ? undefined : Number(e.target.value))}
          />
        </label>
      </div>
    </div>
  );
}