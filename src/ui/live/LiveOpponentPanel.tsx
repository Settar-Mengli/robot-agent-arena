import {
  LIVE_MODEL_IDS,
  type LiveModelId
} from "./live-models";
import type { LiveOpponentConfig } from "./live-config";

export type { LiveOpponentConfig } from "./live-config";
export { EMPTY_LIVE_CONFIG } from "./live-config";

export type LiveOpponentPanelProps = {
  /** App-owned session; panel only edits via onConfigChange (never wipes on unmount). */
  config: LiveOpponentConfig;
  onConfigChange: (config: LiveOpponentConfig) => void;
  /** Latest live failure notice from createLivePlayTurn. */
  notice?: string | null;
};

const TITLE = "Live AI opponent (OpenRouter). Key stays in memory only.";
const HONESTY =
  "Live AI — not recorded evidence; not on the leaderboard; answers can change.";

/**
 * Opt-in OpenRouter BYOK panel. Session is owned by App (memory only).
 * Unmount does not clear the session — App clears on Home / Leave / Load.
 */
export function LiveOpponentPanel({
  config,
  onConfigChange,
  notice
}: LiveOpponentPanelProps): React.JSX.Element {
  const { enabled, apiKey, modelId } = config;

  return (
    <fieldset
      className="mt-8 rounded border aa-border px-4 py-3"
      data-testid="live-opponent-panel"
    >
      <legend className="px-1 text-sm text-stone-300">{TITLE}</legend>

      <label className="mt-2 flex min-h-11 items-center gap-3 text-stone-200">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) =>
            onConfigChange({ ...config, enabled: e.target.checked })
          }
          data-testid="live-opponent-toggle"
        />
        <span>Enable live AI opponent (default off)</span>
      </label>

      {enabled ? (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-amber-200/90" role="note">
            {HONESTY}
          </p>
          <p className="text-sm text-stone-400" role="note">
            Model list not yet verified — if a model isn&apos;t available, the
            game switches to the simple computer and tells you.
          </p>

          <div>
            <label
              htmlFor="live-api-key"
              className="block text-sm text-stone-300"
            >
              OpenRouter API key
            </label>
            <input
              id="live-api-key"
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(e) =>
                onConfigChange({ ...config, apiKey: e.target.value })
              }
              className="mt-2 min-h-11 w-full rounded border aa-border bg-stone-900 px-3 py-2 text-stone-100"
              data-testid="live-api-key"
            />
            <p className="mt-2 text-sm text-stone-400" role="note">
              Tip: use a separate OpenRouter key with a low credit limit. The
              key stays in this tab&apos;s memory and is never saved.
            </p>
          </div>

          <div>
            <label
              htmlFor="live-model"
              className="block text-sm text-stone-300"
            >
              Model
            </label>
            <select
              id="live-model"
              value={modelId}
              onChange={(e) =>
                onConfigChange({
                  ...config,
                  modelId: e.target.value as LiveModelId
                })
              }
              className="mt-2 min-h-11 w-full rounded border aa-border bg-stone-900 px-3 py-2 text-stone-100"
              data-testid="live-model-select"
            >
              {LIVE_MODEL_IDS.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </div>

          {notice ? (
            <p
              className="text-sm text-amber-300"
              role="status"
              data-testid="live-opponent-notice"
            >
              {notice} Falling back to simple computer.
            </p>
          ) : null}
        </div>
      ) : null}
    </fieldset>
  );
}
