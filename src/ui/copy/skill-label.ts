import { MVP_SKILL_CATALOG, type SkillId } from "../../engine";

export function skillLabel(skillId: string): string {
  const skill = MVP_SKILL_CATALOG.skills.find((s) => s.skillId === skillId);
  return skill?.displayName ?? skillId;
}

export function skillCategoryLabel(skillId: string): string {
  const skill = MVP_SKILL_CATALOG.skills.find(
    (s) => s.skillId === (skillId as SkillId)
  );
  if (skill === undefined) return "Move";
  const cat = skill.effect.category;
  if (cat === "attack") return "Attack";
  if (cat === "defense") return "Defense";
  if (cat === "disrupt") return "Disrupt";
  if (cat === "recovery") return "Recover";
  return "Move";
}

/** Plain energy/category hint — no catalog flavor text. */
export function skillHint(skillId: string): string {
  const skill = MVP_SKILL_CATALOG.skills.find(
    (s) => s.skillId === (skillId as SkillId)
  );
  if (skill === undefined) return "";
  return `Cost ${skill.energyCost} energy · ${skillCategoryLabel(skillId)}`;
}
