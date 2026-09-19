import { createHash } from "node:crypto";

export type FixtureRequestMeta = {
  host: string;
  model: unknown;
  messages: unknown;
  response_format?: unknown;
  temperature?: unknown;
};

export type FixtureRecord = {
  key: string;
  request: {
    host: string;
    model: unknown;
    messages: unknown;
  };
  response: unknown;
};

export type FixtureStore = {
  read: (key: string) => Promise<FixtureRecord | undefined>;
  write: (key: string, record: FixtureRecord) => Promise<void>;
};

export type RecordingFetchOptions = {
  force?: boolean;
};

export type RecordingFetchStats = {
  hits: number;
  recorded: number;
  skippedNon2xx: number;
  /** Wall durations (ms) of realFetch calls only — excludes cache hits. */
  liveLatenciesMs: number[];
};

export type RepeatAwareFetch = typeof fetch & {
  setRepeat: (n: number) => void;
};

export type RecordingFetch = typeof fetch & {
  stats: () => RecordingFetchStats;
  setRepeat: (n: number) => void;
};

const JUNK_TOP_LEVEL_KEYS = new Set(["id", "created"]);
const JUNK_NESTED_KEYS = new Set(["extra_content", "thought_signature"]);

/**
 * Strip volatile provider junk before persisting a fixture.
 * Does not mutate the live response object; never rewrites committed fixtures.
 */
export function sanitizeRecordedResponse(response: unknown): unknown {
  if (response === null || typeof response !== "object") {
    return response;
  }
  if (Array.isArray(response)) {
    return response.map((item) => sanitizeRecordedResponse(item));
  }
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(response as Record<string, unknown>)) {
    if (JUNK_TOP_LEVEL_KEYS.has(key) || JUNK_NESTED_KEYS.has(key)) {
      continue;
    }
    out[key] = sanitizeRecordedResponse(value);
  }
  return out;
}

/**
 * Hash host+model+messages+response_format+temperature.
 * Include `repeat` in the payload only when (repeat ?? 0) !== 0 so
 * repeat 0 stays byte-identical to legacy keys.
 */
export function fixtureKey(
  url: string,
  body: Record<string, unknown>,
  repeat?: number
): string {
  const payload: Record<string, unknown> = {
    host: new URL(url).host,
    model: body.model,
    messages: body.messages,
    response_format: body.response_format,
    temperature: body.temperature
  };
  if ((repeat ?? 0) !== 0) {
    payload.repeat = repeat;
  }
  return createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
}

export function createMemoryStore(
  initial: Iterable<[string, FixtureRecord]> = []
): FixtureStore & { map: Map<string, FixtureRecord> } {
  const map = new Map(initial);
  return {
    map,
    read: async (key) => map.get(key),
    write: async (key, record) => {
      map.set(key, record);
    }
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

export function createReplayFetch(store: FixtureStore): RepeatAwareFetch {
  let repeatSlot = 0;
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    const rawBody =
      init?.body === undefined
        ? {}
        : (JSON.parse(String(init.body)) as Record<string, unknown>);
    const key = fixtureKey(url, rawBody, repeatSlot);
    const hit = await store.read(key);
    if (hit === undefined) {
      return jsonResponse(599, { error: "fixture_miss", key });
    }
    return jsonResponse(200, hit.response);
  };

  return Object.assign(fetchImpl, {
    setRepeat: (n: number): void => {
      repeatSlot = n;
    }
  });
}

export function createRecordingFetch(
  realFetch: typeof fetch,
  store: FixtureStore,
  options: RecordingFetchOptions = {}
): RecordingFetch {
  const force = options.force === true;
  const counters: RecordingFetchStats = {
    hits: 0,
    recorded: 0,
    skippedNon2xx: 0,
    liveLatenciesMs: []
  };
  let repeatSlot = 0;

  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    const rawBody =
      init?.body === undefined
        ? {}
        : (JSON.parse(String(init.body)) as Record<string, unknown>);
    const key = fixtureKey(url, rawBody, repeatSlot);

    if (!force) {
      const cached = await store.read(key);
      if (cached !== undefined) {
        counters.hits += 1;
        return jsonResponse(200, cached.response);
      }
    }

    const started = performance.now();
    const response = await realFetch(input, init);
    counters.liveLatenciesMs.push(performance.now() - started);

    if (response.ok) {
      const parsed = (await response.clone().json()) as unknown;
      await store.write(key, {
        key,
        request: {
          host: new URL(url).host,
          model: rawBody.model,
          messages: rawBody.messages
        },
        response: sanitizeRecordedResponse(parsed)
      });
      counters.recorded += 1;
    } else {
      counters.skippedNon2xx += 1;
    }

    return response;
  };

  return Object.assign(fetchImpl, {
    stats: (): RecordingFetchStats => ({
      hits: counters.hits,
      recorded: counters.recorded,
      skippedNon2xx: counters.skippedNon2xx,
      liveLatenciesMs: [...counters.liveLatenciesMs]
    }),
    setRepeat: (n: number): void => {
      repeatSlot = n;
    }
  });
}
