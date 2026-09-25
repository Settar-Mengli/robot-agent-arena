import { MVP_SKILL_CATALOG, type SkillEffect } from "../../engine";

type MoveFactsProps = {
  skillId: string;
  /** A recorded situation's cost takes precedence over the current catalog. */
  energyCost?: number;
};

const CATEGORY_LABELS: Record<SkillEffect["category"], string> = {
  attack: "Attack",
  defense: "Defense",
  recovery: "Healing",
  disrupt: "Disrupt"
};

function effectText(effect: SkillEffect): string {
  switch (effect.category) {
    case "attack":
      return `Attack power ${effect.basePower}`;
    case "defense":
      return `Add up to ${effect.defenseAmount} defense`;
    case "recovery":
      return `Restore up to ${effect.recoveryAmount} HP`;
    case "disrupt":
      return `Attack power ${effect.basePower} · Drain up to ${effect.energyDamage} opponent energy`;
  }
}

/** Catalog facts only: no projected damage, scoring, or recommended choice. */
export function MoveFacts({
  skillId,
  energyCost
}: MoveFactsProps): React.JSX.Element | null {
  const skill = MVP_SKILL_CATALOG.skills.find((s) => s.skillId === skillId);
  const cost = energyCost ?? skill?.energyCost;
  if (skill === undefined && cost === undefined) return null;

  return (
    <span className="aa-move-facts mt-2 block text-sm font-normal text-stone-300">
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {skill ? (
          <span className="rounded bg-stone-800 px-2 py-0.5 text-xs font-medium text-stone-200">
            {CATEGORY_LABELS[skill.effect.category]}
          </span>
        ) : null}
        {cost !== undefined ? (
          <span className="tabular-nums">Cost: {cost} energy</span>
        ) : null}
      </span>
      {skill ? <span className="mt-1 block">{effectText(skill.effect)}</span> : null}
    </span>
  );
}
