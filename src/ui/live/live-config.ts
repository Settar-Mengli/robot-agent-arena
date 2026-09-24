import {
  DEFAULT_LIVE_MODEL_ID,
  type LiveModelId
} from "./live-models";

export type LiveOpponentConfig = {
  enabled: boolean;
  apiKey: string;
  modelId: LiveModelId;
};

export const EMPTY_LIVE_CONFIG: LiveOpponentConfig = {
  enabled: false,
  apiKey: "",
  modelId: DEFAULT_LIVE_MODEL_ID
};
