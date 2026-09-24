export type CombatantBarsProps = {
  title: string;
  name: string;
  health: number;
  maxHealth: number;
  energy: number;
  maxEnergy: number;
  defense: number;
  motion?: "idle" | "hit" | "defend";
};

/** SVG bar fill — presentation attributes, not CSS style= (CSP style-src 'self'). */
function BarFill(props: {
  pct: number;
  fill: string;
  label: string;
  now: number;
  max: number;
}): React.JSX.Element {
  const width = Math.max(0, Math.min(100, props.pct));
  return (
    <div
      className="h-3 overflow-hidden rounded bg-stone-800"
      role="progressbar"
      aria-valuenow={props.now}
      aria-valuemin={0}
      aria-valuemax={props.max}
      aria-label={props.label}
    >
      <svg
        className="block h-full w-full"
        viewBox="0 0 100 12"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <rect x="0" y="0" width={width} height="12" fill={props.fill} />
      </svg>
    </div>
  );
}

export function CombatantBars(props: CombatantBarsProps): React.JSX.Element {
  const hpPct =
    props.maxHealth <= 0
      ? 0
      : Math.max(0, Math.min(100, (props.health / props.maxHealth) * 100));
  const enPct =
    props.maxEnergy <= 0
      ? 0
      : Math.max(0, Math.min(100, (props.energy / props.maxEnergy) * 100));

  return (
    <div className="rounded border border-stone-800 bg-stone-900/50 px-4 py-4">
      <p className="text-xs tracking-wide text-stone-400 uppercase">
        {props.title}
      </p>
      <p className="mt-1 text-lg font-medium text-stone-100">{props.name}</p>
      <div className="mt-3 space-y-3">
        <div>
          <div className="mb-1 flex justify-between text-xs text-stone-400">
            <span>HP</span>
            <span>
              {props.health} / {props.maxHealth}
            </span>
          </div>
          <BarFill
            pct={hpPct}
            fill="#059669"
            label={`${props.name} health`}
            now={props.health}
            max={props.maxHealth}
          />
        </div>
        <div>
          <div className="mb-1 flex justify-between text-xs text-stone-400">
            <span>Energy</span>
            <span>
              {props.energy} / {props.maxEnergy}
            </span>
          </div>
          <BarFill
            pct={enPct}
            fill="#0284c7"
            label={`${props.name} energy`}
            now={props.energy}
            max={props.maxEnergy}
          />
        </div>
        <p className="text-sm text-stone-300">Defense {props.defense}</p>
      </div>
    </div>
  );
}
