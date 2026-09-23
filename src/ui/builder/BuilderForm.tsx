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
import { buildAgentConfig } from "./buildAgentConfig";

const MODULE_LABELS: Record<AgentModule, string> = {
  coreIdentity: "Core Identity",
  memory: "Memory",
  sigilSecurity: "Sigil and Security",
  rules: "Rules",
  strategy: "Strategy"
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
        Name your robot, fill its modules, and pick two moves. Module text is
        stored for recorded AI prompts; free play uses a simple computer foe.
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
            className="mt-2 w-full rounded border border-stone-700 bg-stone-900 px-3 py-2 text-stone-100"
            autoComplete="off"
          />
        </div>

        <fieldset>
          <legend className="text-sm text-stone-300">Modules</legend>
          <p className="mt-1 text-xs text-stone-500">
            Stored on the robot for recorded AI prompts. Not used by the
            simple computer foe in free play.
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
                <input
                  id={`module-${key}`}
                  name={`module-${key}`}
                  type="text"
                  value={modules[key]}
                  onChange={(event) => updateModule(key, event.target.value)}
                  className="mt-2 w-full rounded border border-stone-700 bg-stone-900 px-3 py-2 text-stone-100"
                  autoComplete="off"
                />
              </div>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm text-stone-300">
            Equipped skills (max {MVP_SKILL_SLOT_LIMIT})
          </legend>
          <ul className="mt-3 space-y-2">
            {MVP_SKILL_CATALOG.skills.map((skill) => {
              const checked = skillIds.includes(skill.skillId);
              const atLimit =
                !checked && skillIds.length >= MVP_SKILL_SLOT_LIMIT;
              return (
                <li key={skill.skillId}>
                  <label className="flex items-start gap-3 text-stone-200">
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
                      <span className="block text-sm text-stone-500">
                        {skill.summary}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>

        <button
          type="submit"
          className="rounded bg-amber-600 px-4 py-2 font-medium text-stone-950 hover:bg-amber-500"
        >
          Check robot
        </button>
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
            <button
              type="button"
              className="mt-4 min-h-11 rounded bg-emerald-600 px-4 py-2 font-medium text-stone-950 hover:bg-emerald-500"
              onClick={() => onContinue(validated)}
            >
              Continue to battle setup
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
