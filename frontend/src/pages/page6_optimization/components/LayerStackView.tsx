import { getMaterialColor } from "../types";
import type { CandidateLayer } from "../types";

type Props = {
  layers: CandidateLayer[];
};

export function LayerStackView({ layers }: Props) {
  const total = layers.reduce((s, l) => s + l.thickness_m, 0) || 1;
  const title = layers
    .map((l) => `${l.material_name} ${(l.thickness_m * 1e3).toFixed(3)} mm`)
    .join(" / ");

  return (
    <div className="layer-stack" title={title}>
      {layers.map((l, i) => {
        const isFirst = i === 0;
        const isLast = i === layers.length - 1;
        const radius = layers.length === 1 
          ? "6px" 
          : isFirst 
            ? "6px 0 0 6px" 
            : isLast 
              ? "0 6px 6px 0" 
              : "0";

        return (
          <div
            key={l.order}
            style={{
              flexGrow: l.thickness_m / total,
              background: getMaterialColor(l.material_id),
              borderRadius: radius,
              borderRight: isLast ? "none" : "1px solid rgba(0,0,0,0.1)",
            }}
          >
            {layers.length <= 3 ? l.material_id.slice(0, 2).toUpperCase() : ""}
          </div>
        );
      })}
    </div>
  );
}