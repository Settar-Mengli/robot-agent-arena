import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_LIVE_MODEL_ID,
  LIVE_MODEL_IDS,
  type LiveModelId
} from "./live-models";

export type LiveOpponentConfig = {
  enabled: boolean;
  apiKey: string;
  modelId: LiveModelId;
};

export type LiveOpponentPanelProps = {
  /** Fired on every config change (toggle / key / model). */
  onConfigChange: (config: LiveOpponentConfig) => void;
  /** Latest live failure notice from createLivePlayTurn. */
  notice?: string | null;
};

const TITLE = "Live AI opponent (OpenRouter). Key stays in memory only.";
const HONESTY =
  "Live AI — not recorded evidence; not on the leaderboard; answers can change.";

/**
 * Opt-in OpenRouter BYOK panel. API key is useState only — cleared on unmount/reload.
 */
export function LiveOpponentPanel({
  onConfigChange,
  notice
}: LiveOpponentPanelProps): React.JSX.Element {
  const [enabled, setEnabled] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [modelId, setModelId] = useState<LiveModelId>(DEFAULT_LIVE_MODEL_ID);
  const onConfigChangeRef = useRef(onConfigChange);
  onConfigChangeRef.current = onConfigChange;

  useEffect(() => {
    onConfigChangeRef.current({ enabled, apiKey, modelId });
  }, [enabled, apiKey, modelId]);

  useEffect(() => {
    return () => {
      onConfigChangeRef.current({
        enabled: false,
        apiKey: "",
        modelId: DEFAULT_LIVE_MODEL_ID
      });
    };
  }, []);

  return (
    <fieldset
      className="mt-8 rounded border border-stone-700 px-4 py-3"
      data-testid="live-opponent-panel"
    >
      <legend className="px-1 text-sm text-stone-300">{TITLE}</legend>

      <label className="mt-2 flex min-h-11 items-center gap-3 text-stone-200">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          data-testid="live-opponent-toggle"
        />
        <span>Enable live AI opponent (default off)</span>
      </label>

      {enabled ? (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-amber-200/90" role="note">
            {HONESTY}
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
              onChange={(e) => setApiKey(e.target.value)}
              className="mt-2 min-h-11 w-full rounded border border-stone-700 bg-stone-900 px-3 py-2 text-stone-100"
              data-testid="live-api-key"
            />
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
              onChange={(e) => setModelId(e.target.value as LiveModelId)}
              className="mt-2 min-h-11 w-full rounded border border-stone-700 bg-stone-900 px-3 py-2 text-stone-100"
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
