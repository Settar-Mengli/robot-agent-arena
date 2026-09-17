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

export function fixtureKey(url: string, body: Record<string, unknown>): string {
  const payload = {
    host: new URL(url).host,
    model: body.model,
    messages: body.messages,
    response_format: body.response_format,
    temperature: body.temperature
  };
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

export function createReplayFetch(store: FixtureStore): typeof fetch {
  return async (input, init) => {
    const url = String(input);
    const rawBody =
      init?.body === undefined
        ? {}
        : (JSON.parse(String(init.body)) as Record<string, unknown>);
    const key = fixtureKey(url, rawBody);
    const hit = await store.read(key);
    if (hit === undefined) {
      return jsonResponse(599, { error: "fixture_miss", key });
    }
    return jsonResponse(200, hit.response);
  };
}

export function createRecordingFetch(
  realFetch: typeof fetch,
  store: FixtureStore
): typeof fetch {
  return async (input, init) => {
    const url = String(input);
    const rawBody =
      init?.body === undefined
        ? {}
        : (JSON.parse(String(init.body)) as Record<string, unknown>);
    const key = fixtureKey(url, rawBody);
    const response = await realFetch(input, init);
    if (response.ok) {
      const parsed = (await response.clone().json()) as unknown;
      await store.write(key, {
        key,
        request: {
          host: new URL(url).host,
          model: rawBody.model,
          messages: rawBody.messages
        },
        response: parsed
      });
    }
    return response;
  };
}
