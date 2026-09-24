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
          <div
            className="h-3 overflow-hidden rounded bg-stone-800"
            role="progressbar"
            aria-valuenow={props.health}
            aria-valuemin={0}
            aria-valuemax={props.maxHealth}
            aria-label={`${props.name} health`}
          >
            <div
              className="h-full bg-emerald-600 transition-[width] duration-300 motion-reduce:transition-none"
              style={{ width: `${hpPct}%` }}
            />
          </div>
        </div>
        <div>
          <div className="mb-1 flex justify-between text-xs text-stone-400">
            <span>Energy</span>
            <span>
              {props.energy} / {props.maxEnergy}
            </span>
          </div>
          <div
            className="h-3 overflow-hidden rounded bg-stone-800"
            role="progressbar"
            aria-valuenow={props.energy}
            aria-valuemin={0}
            aria-valuemax={props.maxEnergy}
            aria-label={`${props.name} energy`}
          >
            <div
              className="h-full bg-sky-600 transition-[width] duration-300 motion-reduce:transition-none"
              style={{ width: `${enPct}%` }}
            />
          </div>
        </div>
        <p className="text-sm text-stone-300">Defense {props.defense}</p>
      </div>
    </div>
  );
}
