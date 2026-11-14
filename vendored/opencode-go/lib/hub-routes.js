/**
 * Hub-facing HTTP routes for the vendored dsh-opencode-go host.
 *
 * The upstream plugin exposes its account operations through Typert remotes,
 * which only its own settings page can call. The unified hub in
 * dsh-model-accordion talks to connector hosts over same-origin HTTP, so we
 * add a thin loopback-only bridge here that forwards to the SAME
 * `GoAccountManager` the native settings page uses. No account logic is
 * duplicated: add/remove/select/replace-key/reorder/move/auto-switch all go
 * through `manager.execute(command)`.
 *
 * Routes (all POST, loopback-only, never return credential values):
 *   GET  /plugins/opencode-go/hub/accounts       -> account list + status
 *   POST /plugins/opencode-go/hub/accounts      -> forward an account command
 *
 * Extra:
 *   GET  /plugins/opencode-go/hub/models        -> live model directory summary
 *
 * Security:
 *   - loopback origin check (same rule as the other connector hosts)
 *   - request bodies bounded
 *   - responses never contain API keys, only masked presence flags
 */
import { randomBytes } from "node:crypto";

const HUB_PREFIX = "/plugins/opencode-go/hub";
const MAX_BODY = 64 * 1024;
/** Budget for the host catalog snapshot before falling back to a direct fetch. */
const CATALOG_TIMEOUT_MS = 8000;
/** Budget for the direct anonymous `/models` request. */
const DIRECT_TIMEOUT_MS = 15000;

function json(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(text);
}

function safeMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function loopbackOrigin(req) {
  const origin = req.headers.origin;
  if (origin === undefined) return true;
  try {
    const { hostname } = new URL(origin);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || hostname === "::1";
  } catch {
    return false;
  }
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.byteLength;
    if (size > MAX_BODY) throw new Error("request body too large");
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (text === "") return {};
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("body must be a JSON object");
    return parsed;
  } catch (error) {
    throw new Error(`invalid JSON body: ${safeMessage(error)}`);
  }
}

/**
 * Register the hub routes. `deps` carries the live host state:
 *   manager      - GoAccountManager (account commands)
 *   current      - () => resolved config
 *   credentials  - DSH credentials service (or undefined before inject)
 *   catalog      - OpencodeGoCatalog (go models)
 *   freeCatalog  - OpencodeGoCatalog (free models)
 *   enabled      - () => boolean
 */
export function registerHubRoutes(ctx, deps) {
  let dispose;
  try {
    dispose = ctx.webServer.register({
      kind: "exact",
      path: `${HUB_PREFIX}/accounts`,
      handler: async (req, res) => {
        if (!loopbackOrigin(req)) return json(res, 403, { error: "origin-not-trusted" });
        try {
          if (req.method === "GET") {
            const cfg = deps.current();
            const accounts = (cfg.accounts ?? []).map((a) => ({
              id: a.id,
              name: a.name,
              ref: a.apiKeyEnv,
              configured: false
            }));
            const selectedRef = cfg.apiKeyEnv || "";
            // Ask the credentials service whether each ref is configured,
            // without ever reading the value back into the response.
            // `credentialRef(name)` is an identity/brand helper, so `describe`
            // takes the bare ref string.
            const credentials = deps.credentials?.();
            if (credentials && typeof credentials.describe === "function") {
              for (const a of accounts) {
                try {
                  const info = await credentials.describe(a.ref);
                  a.configured = info?.configured === true;
                } catch {}
              }
            }
            return json(res, 200, {
              enabled: deps.enabled(),
              accounts,
              selectedRef,
              autoSwitch: cfg.autoSwitch === true,
              baseURL: cfg.baseURL
            });
          }
          if (req.method !== "POST") return json(res, 405, { error: "method not allowed" });
          const body = await readBody(req);
          if (typeof body.command !== "object" || body.command === null) {
            return json(res, 400, { error: "command is required" });
          }
          const result = await deps.manager.execute(body.command);
          return json(res, 200, { result });
        } catch (error) {
          return json(res, 400, { error: safeMessage(error) });
        }
      }
    });
  } catch (error) {
    ctx.logger?.warn?.(`opencode-go: hub accounts route unavailable: ${safeMessage(error)}`);
  }

  let disposeModels;
  try {
    disposeModels = ctx.webServer.register({
      kind: "exact",
      path: `${HUB_PREFIX}/models`,
      handler: async (req, res) => {
        if (!loopbackOrigin(req)) return json(res, 403, { error: "origin-not-trusted" });
        if (req.method !== "GET") return json(res, 405, { error: "method not allowed" });
        try {
          const result = await readModels(deps);
          return json(res, 200, result);
        } catch (error) {
          return json(res, 502, { error: safeMessage(error) });
        }
      }
    });
  } catch (error) {
    ctx.logger?.warn?.(`opencode-go: hub models route unavailable: ${safeMessage(error)}`);
  }

  ctx.effect?.(() => () => {
    try { dispose?.(); } catch {}
    try { disposeModels?.(); } catch {}
  });
}

/**
 * Read the go-channel model directory for the hub.
 *
 * Order of preference:
 *   1. the host catalog's snapshot, bounded by a timeout (it shares the host's
 *      proxy transport, so it can be slow when a proxy is configured);
 *   2. a direct anonymous GET of `<baseURL>/models`.
 *
 * Step 2 exists because discovery on that endpoint is unauthenticated — an
 * appkey is only needed to *call* a model, never to list it. So the hub can
 * always show a directory even while the host catalog is still warming up or
 * its transport is stuck, which is exactly what the "fill an appkey, pull the
 * model list" flow needs.
 */
async function readModels(deps) {
  const byCatalog = await catalogModels(deps).catch(() => undefined);
  if (byCatalog && byCatalog.count > 0) return byCatalog;
  const direct = await directModels(deps).catch(() => undefined);
  if (direct && direct.count > 0) return direct;
  return byCatalog ?? direct ?? { source: "go", live: false, count: 0, models: [] };
}

/** Project the host catalog snapshot; never waits longer than CATALOG_TIMEOUT_MS. */
async function catalogModels(deps) {
  const catalog = deps.catalog?.();
  if (!catalog || typeof catalog.snapshot !== "function") return undefined;
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(undefined), CATALOG_TIMEOUT_MS);
  });
  const snap = await Promise.race([catalog.snapshot(true), timeout]).finally(() => clearTimeout(timer));
  if (!snap) return { source: "go", live: false, count: 0, models: [] };
  const models = (snap.models instanceof Map ? [...snap.models.values()] : snap.models ?? [])
    .map((m) => ({
      id: m.id ?? m.key ?? "",
      name: m.name ?? m.displayName ?? m.id ?? "",
      contextWindow: m.contextWindow,
      maxTokens: m.maxTokens
    }))
    .filter((m) => m.id !== "");
  return {
    source: "go",
    live: snap.live === true,
    count: models.length,
    ...snap.fetchedAtMs === undefined ? {} : { fetchedAtMs: snap.fetchedAtMs },
    ...snap.failure ? { failure: safeMessage(snap.failure) } : {},
    ...snap.warning ? { warning: String(snap.warning) } : {},
    models
  };
}

/** Fetch `<baseURL>/models` directly (anonymous; no credential is sent). */
async function directModels(deps) {
  const cfg = deps.current?.();
  const base = typeof cfg?.baseURL === "string" ? cfg.baseURL.replace(/\/+$/, "") : "";
  if (!base) return undefined;
  const response = await fetch(`${base}/models`, {
    method: "GET",
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(DIRECT_TIMEOUT_MS),
    redirect: "error"
  });
  if (!response.ok) throw new Error(`GET ${base}/models -> HTTP ${response.status}`);
  const body = await response.json();
  const rows = Array.isArray(body?.data) ? body.data : [];
  const models = rows
    .map((m) => ({
      id: typeof m?.id === "string" ? m.id : "",
      name: typeof m?.name === "string" ? m.name : typeof m?.id === "string" ? m.id : "",
      contextWindow: typeof m?.limit?.context === "number" ? m.limit.context : undefined,
      maxTokens: typeof m?.limit?.output === "number" ? m.limit.output : undefined
    }))
    .filter((m) => m.id !== "");
  return { source: "go", live: true, count: models.length, fetchedAtMs: Date.now(), direct: true, models };
}

/** Generate the 32-hex account id that `parseAccountCommand` requires. */
export function newAccountId() {
  return randomBytes(16).toString("hex");
}
