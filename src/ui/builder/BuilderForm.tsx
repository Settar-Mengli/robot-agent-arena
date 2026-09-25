import { useState, type FormEvent } from "react";
import {
  AGENT_MODULES,
  MVP_SKILL_CATALOG,
  MVP_SKILL_SLOT_LIMIT,
  type AgentConfig,
  type AgentModule,
  type SkillId
} from "../../engine";
import { skillLabel } from "../copy/skill-label";
import { skillPlainDescription } from "../copy/skill-plain";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { buildAgentConfig } from "./buildAgentConfig";

const MODULE_LABELS: Record<AgentModule, string> = {
  coreIdentity: "Core Identity",
  memory: "Memory",
  sigilSecurity: "Sigil and Security",
  rules: "Rules",
  strategy: "Strategy"
};

const MODULE_HELP: Record<AgentModule, string> = {
  coreIdentity: "Who this robot is.",
  memory: "What it remembers between fights.",
  sigilSecurity: "Its protective sigil and guard habits.",
  rules: "Rules it refuses to break.",
  strategy: "How it chooses pressure in a fight."
};

type ModuleFields = Record<AgentModule, string>;

function emptyModules(): ModuleFields {
  return {
    coreIdentity: "",
    memory: "",
    sigilSecurity: "",
    rules: "",
    strategy: ""
  };
}

function modulesFromConfig(config: AgentConfig): ModuleFields {
  return {
    coreIdentity: config.modules.coreIdentity,
    memory: config.modules.memory,
    sigilSecurity: config.modules.sigilSecurity,
    rules: config.modules.rules,
    strategy: config.modules.strategy
  };
}

export type BuilderFormProps = {
  /** When set, fields and agentId are seeded from this config (no new UUID). */
  initialConfig?: AgentConfig | null;
  /** Called only from Continue — does not re-validate. */
  onContinue?: (config: AgentConfig) => void;
};

export function BuilderForm({
  initialConfig = null,
  onContinue
}: BuilderFormProps) {
  const [agentId] = useState(
    () => initialConfig?.agentId ?? crypto.randomUUID()
  );
  const [displayName, setDisplayName] = useState(
    () => initialConfig?.displayName ?? ""
  );
  const [modules, setModules] = useState<ModuleFields>(() =>
    initialConfig ? modulesFromConfig(initialConfig) : emptyModules()
  );
  const [skillIds, setSkillIds] = useState<SkillId[]>(
    () => initialConfig?.skillIds ?? []
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [validated, setValidated] = useState<AgentConfig | null>(null);

  function invalidateResults() {
    setValidated(null);
    setErrors([]);
  }

  function updateDisplayName(value: string) {
    invalidateResults();
    setDisplayName(value);
  }

  function updateModule(key: AgentModule, value: string) {
    invalidateResults();
    setModules((current) => ({ ...current, [key]: value }));
  }

  function toggleSkill(skillId: SkillId) {
    invalidateResults();
    setSkillIds((current) => {
      if (current.includes(skillId)) {
        return current.filter((id) => id !== skillId);
      }
      if (current.length >= MVP_SKILL_SLOT_LIMIT) {
        return current;
      }
      return [...current, skillId];
    });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = buildAgentConfig({
      agentId,
      displayName,
      modules,
      skillIds
    });
    if (result.ok) {
      setErrors([]);
      setValidated(result.config);
      return;
    }
    setValidated(null);
    setErrors(result.errors);
  }

  return (
    <section aria-labelledby="builder-heading">
      <h1
        id="builder-heading"
        tabIndex={-1}
        className="text-2xl font-semibold text-stone-100"
      >
        Build your own robot
      </h1>
      <p className="mt-2 text-stone-400">
        Name your robot and pick two moves. Story notes are optional and only
        used in recorded AI prompts; free play uses a simple computer opponent.
      </p>

      <form className="mt-8 space-y-8" onSubmit={onSubmit} noValidate>
        <div>
          <label htmlFor="displayName" className="block text-sm text-stone-300">
            Display name
          </label>
          <input
            id="displayName"
            name="displayName"
            type="text"
            value={displayName}
            onChange={(event) => updateDisplayName(event.target.value)}
            className="mt-2 min-h-11 w-full rounded border aa-border bg-stone-900 px-3 py-2 text-stone-100"
            autoComplete="off"
          />
        </div>

        <fieldset>
          <legend className="text-sm text-stone-300">
            Equipped moves (max {MVP_SKILL_SLOT_LIMIT})
          </legend>
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {MVP_SKILL_CATALOG.skills.map((skill) => {
              const checked = skillIds.includes(skill.skillId);
              const atLimit =
                !checked && skillIds.length >= MVP_SKILL_SLOT_LIMIT;
              return (
                <li key={skill.skillId}>
                  <label
                    className={
                      checked
                        ? "flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-amber-600 bg-amber-950/40 px-3 py-3 text-amber-50"
                        : atLimit
                          ? "flex min-h-11 cursor-not-allowed items-start gap-3 rounded-lg border aa-border bg-stone-950/40 px-3 py-3 text-stone-500 opacity-60"
                          : "flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border aa-border bg-stone-950/40 px-3 py-3 text-stone-200 hover:border-stone-500"
                    }
                    data-selected={checked ? "true" : "false"}
                  >
                    <input
                      type="checkbox"
                      name="skillIds"
                      value={skill.skillId}
                      checked={checked}
                      disabled={atLimit}
                      onChange={() => toggleSkill(skill.skillId)}
                      className="mt-1"
                    />
                    <span>
                      <span className="font-medium">{skill.displayName}</span>
                      <span className="block text-sm text-stone-400">
                        {skillPlainDescription(skill.skillId)}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>

        <Card className="p-0">
          <details className="px-4 py-3">
            <summary className="cursor-pointer text-sm text-stone-300">
              Story notes (used in recorded AI prompts)
            </summary>
            <p className="mt-2 text-xs text-stone-400">
              Stored on the robot for recorded AI prompts. Not used by the
              simple computer opponent in free play.
            </p>
            <div className="mt-3 space-y-4">
              {AGENT_MODULES.map((key) => (
                <div key={key}>
                  <label
                    htmlFor={`module-${key}`}
                    className="block text-sm text-stone-400"
                  >
                    {MODULE_LABELS[key]}
                  </label>
                  <p className="mt-0.5 text-xs text-stone-500">
                    {MODULE_HELP[key]}
                  </p>
                  <input
                    id={`module-${key}`}
                    name={`module-${key}`}
                    type="text"
                    value={modules[key]}
                    onChange={(event) => updateModule(key, event.target.value)}
                    className="mt-2 min-h-11 w-full rounded border aa-border bg-stone-900 px-3 py-2 text-stone-100"
                    autoComplete="off"
                  />
                </div>
              ))}
            </div>
          </details>
        </Card>

        <Button type="submit" variant="primary">
          Check robot
        </Button>
      </form>

      {errors.length > 0 ? (
        <div
          role="alert"
          className="mt-6 rounded border border-red-800 bg-red-950/40 px-4 py-3 text-red-200"
        >
          <p className="font-medium">Robot is invalid</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {validated !== null ? (
        <div
          role="status"
          className="mt-6 rounded border border-emerald-800 bg-emerald-950/30 px-4 py-3 text-emerald-100"
          data-testid="validated-config"
        >
          <p className="font-medium">Ready</p>
          <dl className="mt-3 space-y-2 text-sm">
            <div>
              <dt className="text-emerald-400">Display name</dt>
              <dd>{validated.displayName}</dd>
            </div>
            <div>
              <dt className="text-emerald-400">Moves</dt>
              <dd>{validated.skillIds.map(skillLabel).join(", ")}</dd>
            </div>
          </dl>
          {onContinue ? (
            <Button
              variant="primary"
              className="mt-4 bg-emerald-600 hover:bg-emerald-500"
              onClick={() => onContinue(validated)}
            >
              Continue to battle setup
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
