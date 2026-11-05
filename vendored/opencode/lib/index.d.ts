import { EventEmitter } from "node:events";
import Schema from "@deepseek-ai/schemastery";

//#region src/ip-pool-settings/namespace.d.ts

/**
 * cosmokit's volatile config reference, structurally typed.
 *
 * DSH wraps every `.volatile()` Config field in one of these and hands the
 * plugin a STABLE reference whose `get()` returns the current immutable
 * snapshot; the Loader commits saves into the same object and announces them
 * with `loader/volatile-update`. Declared structurally (rather than imported
 * from cosmokit/cordis) to keep the plugin independent of the host's exact
 * @deepseek-ai version, per the PluginContext discipline in src/index.ts.
 */
interface VolatileRef<T> {
  get(): T;
}
/** The resolved ip-pool settings value (schema defaults → base → user). */
interface IpPoolSettings {
  enabled: boolean;
  probeModels: string[];
  maxConcurrentProbes: number;
  free: {
    enabled: boolean;
    targetSize: number;
    blockedCountries: string[];
  };
  manual: string[];
  subscription: {
    urls: string[];
    refreshMs: number;
    userAgent: string;
  };
  singbox: {
    path: string;
  };
  pinnedExitId: string;
  pinnedStrict: boolean;
  proxyHosts: string[];
  maxRotateAttempts: number;
  probeIntervalMs: number;
}
//#endregion
//#region src/config.d.ts
/**
 * Plugin configuration (cordis config object, injected via cordis.patch.yml).
 */
interface Opencode2dshConfig {
  /**
   * Integration mode. `adapter` (default) registers a DSH LlmAdapter that
   * streams directly from the Zen anonymous lane — no child process. `sidecar`
   * (legacy, not bundled with the published package) spawns the Go agent
   * binary and registers an llm-pi-ai route to it; build the agent from
   * legacy/agent and pass agentPath.
   */
  mode?: 'adapter' | 'sidecar';
  /** Path to the agent binary (sidecar mode). Not bundled: build from legacy/agent. */
  agentPath?: string;
  /** Extra CLI args forwarded to the agent (after --config). */
  agentArgs?: string[];
  /** Provider route name registered into llm-pi-ai settings. */
  providerId?: string;
  /** Credential reference (env var name) holding the local agent token. */
  apiKeyEnv?: string;
  /** Model list refresh interval in seconds (agent refresh_seconds matches). */
  refreshSeconds?: number;
  /**
   * Model whitelist (issue #83): exact model ids the DSH picker exposes and
   * the serving gate allows. Omitted or empty keeps today's behavior (every
   * eligible free-lane model). Narrowing only: a whitelisted id that is
   * paid/deprecated/blocklisted/probe-refused stays hidden, and a direct
   * call to a non-whitelisted id is denied with source `not_in_whitelisted`.
   */
  allowedModels?: string[];
  /** Restart backoff: initial delay ms. */
  restartDelayMs?: number;
  /** Restart backoff: max delay ms. */
  restartMaxDelayMs?: number;
  /** Consecutive crash count that trips the circuit breaker. */
  maxConsecutiveCrashes?: number;
  /**
   * Watchdog: ms to wait for the first pi-ai stream event (issue #33). The
   * shipped window (zen-adapter.ts DEFAULT_FIRST_EVENT_MS) is the fallback
   * when unset, so nobody who does not set it sees a behavior change.
   */
  firstEventMs?: number;
  /** Watchdog: ms of body silence tolerated mid-stream (chat models). */
  bodyIdleMs?: number;
  /**
   * Watchdog: body-idle window for Responses models (muse-spark-*), whose
   * bursty reasoning needs the wider window (issue #7). Applied as a floor
   * over `bodyIdleMs`, never below it.
   */
  responsesBodyIdleMs?: number;
  /**
   * IP-pool exit routing (docs/ip-pool.md). Everything below is pure plugin
   * config; the settings page (IP-6) will own these live, this object is
   * the cordis.patch.yml seam.
   */
  ipPool?: IpPoolConfig;
  /**
   * Local OpenCode delegation (docs/delegation.md, issue #76). Opt-in: when
   * `enabled` is true the plugin custodies the user's opencode credential and,
   * on a persistent anonymous-lane refusal (direct + sibling both 403
   * FreeTierError), runs the turn through a managed local `opencode serve`.
   * Disabled/absent keeps the anonymous path byte-for-byte unchanged.
   */
  delegation?: DelegationConfig;
}
/**
 * Local OpenCode delegation settings (docs/delegation.md §config). Ordinary
 * plugin config (set via cordis.patch.yml), not a live settings form.
 */
interface DelegationConfig {
  /**
   * Master switch. Default false: the plugin stays a stateless anonymous
   * client and never touches the user's credential. Enabling makes the plugin a
   * credential custodian — read docs/delegation.md first.
   */
  enabled?: boolean;
  /**
   * Explicit path to an opencode binary. When set, the managed/global/npm
   * resolution is skipped and this binary is used (still version-checked).
   */
  opencodePath?: string;
  /** Lowest opencode version the delegate will use (default 1.18.0, the free-tier floor). */
  minVersion?: string;
  /** GOMEMLIMIT injected into the child (Go heap soft cap). Default 96MiB. */
  memLimit?: string;
  /** GOGC injected into the child. Default 30. */
  gcPercent?: number;
  /** EmptyWorkingSet memory-trim interval ms; 0 disables trimming. Default 60000. */
  trimIntervalMs?: number;
  /** Health-wait budget for the spawned server, ms. Default 60000. */
  startTimeoutMs?: number;
}
/** docs/ip-pool.md section 5.1 schema (subset owned by config today). */
interface IpPoolConfig {
  /** Master switch; false keeps the process exactly as today (direct). */
  enabled?: boolean;
  /** Manually added plain proxies: 'http://h:p' or 'socks5://h:p'. */
  manual?: string[];
  /** Fixed primary exit address (docs/ip-pool.md 3.6). */
  pinnedExitId?: string;
  /** Absolute pinning: never rotate, never direct-fallback (3.6). */
  pinnedStrict?: boolean;
  /** Hosts whose traffic goes through the pool (default opencode.ai). */
  proxyHosts?: string[];
  /** Free-source pool (docs/ip-pool.md 1.2 source 1, 3.5, 4.5). */
  free?: {
    enabled?: boolean;
    /** Target capacity for the free pool (docs 3.5). */
    targetSize?: number;
    /** Admission geo blocklist (country codes). */
    blockedCountries?: string[];
  };
  /** Airport/Clash subscriptions (docs 1.2 source 3, IP-3). */
  subscriptions?: string[];
  /** Subscription refresh interval ms (docs 4.6, default 30min) and the fetch
   *  User-Agent (airports gate on it; empty = built-in default). */
  subscription?: {
    refreshMs?: number;
    userAgent?: string;
  };
  /** Cross-exit probe concurrency cap (docs 4.1; same-exit always serial). */
  maxConcurrentProbes?: number;
  /** sing-box conversion core for encrypted nodes (docs 1.2.2, IP-4). */
  singbox?: {
    /** sing-box binary: PATH name or absolute path; unset parks encrypted
     *  nodes as pending-conversion. */
    path?: string;
  };
  /** Admission smoke model (docs 4.1 probeModels[0]). */
  probeModels?: string[];
  /** Same-request rotate attempts on pre-content failures (docs 3.4). */
  maxRotateAttempts?: number;
  /** Periodic health-probe tick in ms (docs 4.6 probeIntervalMs). */
  probeIntervalMs?: number;
}
type ResolvedConfig = Required<Pick<Opencode2dshConfig, 'providerId' | 'apiKeyEnv' | 'refreshSeconds' | 'restartDelayMs' | 'restartMaxDelayMs' | 'maxConsecutiveCrashes'>> & Opencode2dshConfig;
declare function resolveConfig(config?: Opencode2dshConfig): ResolvedConfig;
/**
 * The plugin's `Config` — the whole DSH settings contract in one schema.
 *
 * DSH 0.1.7 has no imperative `ctx.settings.register(ns, schema)`. A plugin
 * declares editable settings by exporting this schema, and dsh-settings derives
 * the served namespace from the Loader entry id. Two consequences drive this
 * shape:
 *
 *  - `ipPool` is ONE `.volatile()` node, so the entire ip-pool subtree is the
 *    settings form (dsh-settings' `volatileForm()` selects a node's whole plain
 *    schema once that node is volatile). Nesting `.volatile()` deeper is a hard
 *    schemastery error, and per-field marks would also fragment the card's
 *    form value into siblings instead of one `ipPool` object.
 *  - every other field is ORDINARY configuration. `volatileForm()` drops it
 *    from the form, which is the intent: these are set by the composition
 *    (`cordis.patch.yml`) or a hand-edited profile patch, never by the card.
 *
 * The reference is `dsh-llm-deepseek`'s `deepSeekConfigFields`.
 */
declare const Config: Schema<Schemastery.ObjectS<NoInfer<{
  /** Integration mode; `adapter` (default) is the shipped shape. */
  mode: Schema<"adapter" | "sidecar", "adapter" | "sidecar", "defined">;
  /** Path to the agent binary (sidecar mode only; not bundled). */
  agentPath: Schema<string, string, "plain">;
  /** Extra CLI args forwarded to the agent (after --config). */
  agentArgs: Schema<string[], string[], "defined">;
  /** Provider route name registered into llm-pi-ai settings (sidecar mode). */
  providerId: Schema<string, string, "defined">;
  /** Credential reference (env var name) holding the local agent token. */
  apiKeyEnv: Schema<string, string, "defined">;
  /** Model list refresh interval in seconds. */
  refreshSeconds: Schema<number, number, "defined">;
  /**
   * Model whitelist (issue #83), exact ids. Empty = every eligible free-lane
   * model; a set whitelist only narrows (paid/deprecated/blocklist/probe
   * rules still win). Ordinary config like the rest of this schema: edited in
   * the composition patch, dropped from the settings form, applied on plugin
   * reload.
   */
  allowedModels: Schema<string[], string[], "defined">;
  /** Restart backoff: initial delay ms. */
  restartDelayMs: Schema<number, number, "defined">;
  /** Restart backoff: max delay ms. */
  restartMaxDelayMs: Schema<number, number, "defined">;
  /** Consecutive crash count that trips the circuit breaker. */
  maxConsecutiveCrashes: Schema<number, number, "defined">;
  /**
   * Watchdog: ms to wait for the first stream event. No `.default()` on
   * purpose — the adapter owns those numbers (DEFAULT_FIRST_EVENT_MS &
   * friends), and duplicating them here would make two sources of truth for
   * one window. Undefined leaves the shipped value in force.
   */
  firstEventMs: Schema<number, number, "plain">;
  /** Watchdog: ms of body silence tolerated mid-stream (chat models). */
  bodyIdleMs: Schema<number, number, "plain">;
  /** Watchdog: body-idle floor for Responses models (muse-spark-*). */
  responsesBodyIdleMs: Schema<number, number, "plain">;
  /** The ip-pool settings form (docs/ip-pool.md §5.1); served as this entry. */
  ipPool: Schema<NoInfer<Schemastery.ObjectS<NoInfer<{
    enabled: Schema<boolean, boolean, "defined">;
    probeModels: Schema<string[], string[], "defined">;
    maxConcurrentProbes: Schema<number, number, "defined">;
    free: Schema<Schemastery.ObjectS<NoInfer<{
      enabled: Schema<boolean, boolean, "defined">;
      targetSize: Schema<number, number, "defined">;
      blockedCountries: Schema<string[], string[], "defined">;
    }>>, Schemastery.ObjectT<NoInfer<{
      enabled: Schema<boolean, boolean, "defined">;
      targetSize: Schema<number, number, "defined">;
      blockedCountries: Schema<string[], string[], "defined">;
    }>>, "plain">;
    manual: Schema<string[], string[], "defined">;
    subscriptions: Schema<string[], string[], "plain">;
    subscription: Schema<Schemastery.ObjectS<NoInfer<{
      urls: Schema<string[], string[], "defined">;
      refreshMs: Schema<number, number, "defined">;
      userAgent: Schema<string, string, "defined">;
    }>>, Schemastery.ObjectT<NoInfer<{
      urls: Schema<string[], string[], "defined">;
      refreshMs: Schema<number, number, "defined">;
      userAgent: Schema<string, string, "defined">;
    }>>, "plain">;
    singbox: Schema<Schemastery.ObjectS<NoInfer<{
      path: Schema<string, string, "defined">;
    }>>, Schemastery.ObjectT<NoInfer<{
      path: Schema<string, string, "defined">;
    }>>, "plain">;
    pinnedExitId: Schema<string, string, "defined">;
    pinnedStrict: Schema<boolean, boolean, "defined">;
    proxyHosts: Schema<string[], string[], "defined">;
    maxRotateAttempts: Schema<number, number, "defined">;
    probeIntervalMs: Schema<number, number, "defined">;
  }>>>, NoInfer<Schemastery.ObjectT<NoInfer<{
    enabled: Schema<boolean, boolean, "defined">;
    probeModels: Schema<string[], string[], "defined">;
    maxConcurrentProbes: Schema<number, number, "defined">;
    free: Schema<Schemastery.ObjectS<NoInfer<{
      enabled: Schema<boolean, boolean, "defined">;
      targetSize: Schema<number, number, "defined">;
      blockedCountries: Schema<string[], string[], "defined">;
    }>>, Schemastery.ObjectT<NoInfer<{
      enabled: Schema<boolean, boolean, "defined">;
      targetSize: Schema<number, number, "defined">;
      blockedCountries: Schema<string[], string[], "defined">;
    }>>, "plain">;
    manual: Schema<string[], string[], "defined">;
    subscriptions: Schema<string[], string[], "plain">;
    subscription: Schema<Schemastery.ObjectS<NoInfer<{
      urls: Schema<string[], string[], "defined">;
      refreshMs: Schema<number, number, "defined">;
      userAgent: Schema<string, string, "defined">;
    }>>, Schemastery.ObjectT<NoInfer<{
      urls: Schema<string[], string[], "defined">;
      refreshMs: Schema<number, number, "defined">;
      userAgent: Schema<string, string, "defined">;
    }>>, "plain">;
    singbox: Schema<Schemastery.ObjectS<NoInfer<{
      path: Schema<string, string, "defined">;
    }>>, Schemastery.ObjectT<NoInfer<{
      path: Schema<string, string, "defined">;
    }>>, "plain">;
    pinnedExitId: Schema<string, string, "defined">;
    pinnedStrict: Schema<boolean, boolean, "defined">;
    proxyHosts: Schema<string[], string[], "defined">;
    maxRotateAttempts: Schema<number, number, "defined">;
    probeIntervalMs: Schema<number, number, "defined">;
  }>>>, "volatile">;
  /**
   * Local OpenCode delegation (docs/delegation.md, issue #76). Ordinary config
   * (not a live settings form): flipping it means editing the profile patch, so
   * the credential-custody decision stays a deliberate, reviewed act rather
   * than a settings-page toggle. Absent = the anonymous path, unchanged.
   */
  delegation: Schema<Schemastery.ObjectS<NoInfer<{
    /** Master switch; default false keeps the plugin a stateless anonymous client. */
    enabled: Schema<boolean, boolean, "defined">;
    /** Explicit opencode binary path (skips managed/global/npm resolution). */
    opencodePath: Schema<string, string, "defined">;
    /** Lowest opencode version the delegate will use (free-tier floor). */
    minVersion: Schema<string, string, "defined">;
    /** GOMEMLIMIT injected into the child (Go heap soft cap). */
    memLimit: Schema<string, string, "defined">;
    /** GOGC injected into the child. */
    gcPercent: Schema<number, number, "defined">;
    /** EmptyWorkingSet memory-trim interval ms; 0 disables trimming. */
    trimIntervalMs: Schema<number, number, "defined">;
    /** Health-wait budget for the spawned server, ms. */
    startTimeoutMs: Schema<number, number, "defined">;
  }>>, Schemastery.ObjectT<NoInfer<{
    /** Master switch; default false keeps the plugin a stateless anonymous client. */
    enabled: Schema<boolean, boolean, "defined">;
    /** Explicit opencode binary path (skips managed/global/npm resolution). */
    opencodePath: Schema<string, string, "defined">;
    /** Lowest opencode version the delegate will use (free-tier floor). */
    minVersion: Schema<string, string, "defined">;
    /** GOMEMLIMIT injected into the child (Go heap soft cap). */
    memLimit: Schema<string, string, "defined">;
    /** GOGC injected into the child. */
    gcPercent: Schema<number, number, "defined">;
    /** EmptyWorkingSet memory-trim interval ms; 0 disables trimming. */
    trimIntervalMs: Schema<number, number, "defined">;
    /** Health-wait budget for the spawned server, ms. */
    startTimeoutMs: Schema<number, number, "defined">;
  }>>, "plain">;
}>>, Schemastery.ObjectT<NoInfer<{
  /** Integration mode; `adapter` (default) is the shipped shape. */
  mode: Schema<"adapter" | "sidecar", "adapter" | "sidecar", "defined">;
  /** Path to the agent binary (sidecar mode only; not bundled). */
  agentPath: Schema<string, string, "plain">;
  /** Extra CLI args forwarded to the agent (after --config). */
  agentArgs: Schema<string[], string[], "defined">;
  /** Provider route name registered into llm-pi-ai settings (sidecar mode). */
  providerId: Schema<string, string, "defined">;
  /** Credential reference (env var name) holding the local agent token. */
  apiKeyEnv: Schema<string, string, "defined">;
  /** Model list refresh interval in seconds. */
  refreshSeconds: Schema<number, number, "defined">;
  /**
   * Model whitelist (issue #83), exact ids. Empty = every eligible free-lane
   * model; a set whitelist only narrows (paid/deprecated/blocklist/probe
   * rules still win). Ordinary config like the rest of this schema: edited in
   * the composition patch, dropped from the settings form, applied on plugin
   * reload.
   */
  allowedModels: Schema<string[], string[], "defined">;
  /** Restart backoff: initial delay ms. */
  restartDelayMs: Schema<number, number, "defined">;
  /** Restart backoff: max delay ms. */
  restartMaxDelayMs: Schema<number, number, "defined">;
  /** Consecutive crash count that trips the circuit breaker. */
  maxConsecutiveCrashes: Schema<number, number, "defined">;
  /**
   * Watchdog: ms to wait for the first stream event. No `.default()` on
   * purpose — the adapter owns those numbers (DEFAULT_FIRST_EVENT_MS &
   * friends), and duplicating them here would make two sources of truth for
   * one window. Undefined leaves the shipped value in force.
   */
  firstEventMs: Schema<number, number, "plain">;
  /** Watchdog: ms of body silence tolerated mid-stream (chat models). */
  bodyIdleMs: Schema<number, number, "plain">;
  /** Watchdog: body-idle floor for Responses models (muse-spark-*). */
  responsesBodyIdleMs: Schema<number, number, "plain">;
  /** The ip-pool settings form (docs/ip-pool.md §5.1); served as this entry. */
  ipPool: Schema<NoInfer<Schemastery.ObjectS<NoInfer<{
    enabled: Schema<boolean, boolean, "defined">;
    probeModels: Schema<string[], string[], "defined">;
    maxConcurrentProbes: Schema<number, number, "defined">;
    free: Schema<Schemastery.ObjectS<NoInfer<{
      enabled: Schema<boolean, boolean, "defined">;
      targetSize: Schema<number, number, "defined">;
      blockedCountries: Schema<string[], string[], "defined">;
    }>>, Schemastery.ObjectT<NoInfer<{
      enabled: Schema<boolean, boolean, "defined">;
      targetSize: Schema<number, number, "defined">;
      blockedCountries: Schema<string[], string[], "defined">;
    }>>, "plain">;
    manual: Schema<string[], string[], "defined">;
    subscriptions: Schema<string[], string[], "plain">;
    subscription: Schema<Schemastery.ObjectS<NoInfer<{
      urls: Schema<string[], string[], "defined">;
      refreshMs: Schema<number, number, "defined">;
      userAgent: Schema<string, string, "defined">;
    }>>, Schemastery.ObjectT<NoInfer<{
      urls: Schema<string[], string[], "defined">;
      refreshMs: Schema<number, number, "defined">;
      userAgent: Schema<string, string, "defined">;
    }>>, "plain">;
    singbox: Schema<Schemastery.ObjectS<NoInfer<{
      path: Schema<string, string, "defined">;
    }>>, Schemastery.ObjectT<NoInfer<{
      path: Schema<string, string, "defined">;
    }>>, "plain">;
    pinnedExitId: Schema<string, string, "defined">;
    pinnedStrict: Schema<boolean, boolean, "defined">;
    proxyHosts: Schema<string[], string[], "defined">;
    maxRotateAttempts: Schema<number, number, "defined">;
    probeIntervalMs: Schema<number, number, "defined">;
  }>>>, NoInfer<Schemastery.ObjectT<NoInfer<{
    enabled: Schema<boolean, boolean, "defined">;
    probeModels: Schema<string[], string[], "defined">;
    maxConcurrentProbes: Schema<number, number, "defined">;
    free: Schema<Schemastery.ObjectS<NoInfer<{
      enabled: Schema<boolean, boolean, "defined">;
      targetSize: Schema<number, number, "defined">;
      blockedCountries: Schema<string[], string[], "defined">;
    }>>, Schemastery.ObjectT<NoInfer<{
      enabled: Schema<boolean, boolean, "defined">;
      targetSize: Schema<number, number, "defined">;
      blockedCountries: Schema<string[], string[], "defined">;
    }>>, "plain">;
    manual: Schema<string[], string[], "defined">;
    subscriptions: Schema<string[], string[], "plain">;
    subscription: Schema<Schemastery.ObjectS<NoInfer<{
      urls: Schema<string[], string[], "defined">;
      refreshMs: Schema<number, number, "defined">;
      userAgent: Schema<string, string, "defined">;
    }>>, Schemastery.ObjectT<NoInfer<{
      urls: Schema<string[], string[], "defined">;
      refreshMs: Schema<number, number, "defined">;
      userAgent: Schema<string, string, "defined">;
    }>>, "plain">;
    singbox: Schema<Schemastery.ObjectS<NoInfer<{
      path: Schema<string, string, "defined">;
    }>>, Schemastery.ObjectT<NoInfer<{
      path: Schema<string, string, "defined">;
    }>>, "plain">;
    pinnedExitId: Schema<string, string, "defined">;
    pinnedStrict: Schema<boolean, boolean, "defined">;
    proxyHosts: Schema<string[], string[], "defined">;
    maxRotateAttempts: Schema<number, number, "defined">;
    probeIntervalMs: Schema<number, number, "defined">;
  }>>>, "volatile">;
  /**
   * Local OpenCode delegation (docs/delegation.md, issue #76). Ordinary config
   * (not a live settings form): flipping it means editing the profile patch, so
   * the credential-custody decision stays a deliberate, reviewed act rather
   * than a settings-page toggle. Absent = the anonymous path, unchanged.
   */
  delegation: Schema<Schemastery.ObjectS<NoInfer<{
    /** Master switch; default false keeps the plugin a stateless anonymous client. */
    enabled: Schema<boolean, boolean, "defined">;
    /** Explicit opencode binary path (skips managed/global/npm resolution). */
    opencodePath: Schema<string, string, "defined">;
    /** Lowest opencode version the delegate will use (free-tier floor). */
    minVersion: Schema<string, string, "defined">;
    /** GOMEMLIMIT injected into the child (Go heap soft cap). */
    memLimit: Schema<string, string, "defined">;
    /** GOGC injected into the child. */
    gcPercent: Schema<number, number, "defined">;
    /** EmptyWorkingSet memory-trim interval ms; 0 disables trimming. */
    trimIntervalMs: Schema<number, number, "defined">;
    /** Health-wait budget for the spawned server, ms. */
    startTimeoutMs: Schema<number, number, "defined">;
  }>>, Schemastery.ObjectT<NoInfer<{
    /** Master switch; default false keeps the plugin a stateless anonymous client. */
    enabled: Schema<boolean, boolean, "defined">;
    /** Explicit opencode binary path (skips managed/global/npm resolution). */
    opencodePath: Schema<string, string, "defined">;
    /** Lowest opencode version the delegate will use (free-tier floor). */
    minVersion: Schema<string, string, "defined">;
    /** GOMEMLIMIT injected into the child (Go heap soft cap). */
    memLimit: Schema<string, string, "defined">;
    /** GOGC injected into the child. */
    gcPercent: Schema<number, number, "defined">;
    /** EmptyWorkingSet memory-trim interval ms; 0 disables trimming. */
    trimIntervalMs: Schema<number, number, "defined">;
    /** Health-wait budget for the spawned server, ms. */
    startTimeoutMs: Schema<number, number, "defined">;
  }>>, "plain">;
}>>, "plain">;
/**
 * What `apply()` receives once the Loader has resolved {@link Config}.
 *
 * `ipPool` is a STABLE reference, not a value: the Loader commits a settings
 * save into the same object and announces it with `loader/volatile-update`, so
 * consumers read `.get()` at the moment they need a snapshot and never cache
 * the object it returned.
 */
interface ResolvedPluginConfig extends Omit<ResolvedConfig, 'ipPool'> {
  ipPool: VolatileRef<IpPoolSettings>;
}
/**
 * Everything the plugin persists next to the agent: the generated
 * agent-config.json (design.md section 8.3 template) and the local auth token.
 * The data directory doubles as the models.dev cache location for the agent.
 */
interface AgentConfigPaths {
  dataDir: string;
  configPath: string;
  tokenPath: string;
}
declare function configPaths(dataDir: string): AgentConfigPaths;
/**
 * Read the persisted token or generate and persist a fresh one.
 * Best-effort 0600 on POSIX; Windows profile dirs are user-scoped already.
 */
declare function ensureToken(paths: AgentConfigPaths): Promise<string>;
/**
 * Write agent-config.json atomically (tmp + rename) every plugin start, so a
 * version upgrade or option change reaches the next agent spawn. The agent
 * accepts JSON with comments; we emit plain JSON.
 */
declare function writeAgentConfig(paths: AgentConfigPaths, options: {
  token: string;
  refreshSeconds: number;
}): Promise<void>;
//#endregion
//#region src/agent-process.d.ts
/**
 * Drives the agent child process (design.md section 8.1-8.2):
 * spawn with piped stdio, READY-line handshake for the random port,
 * exponential-backoff restart on unexpected exit (1s -> 60s, circuit breaker
 * after N consecutive crashes), and graceful stop (SIGTERM -> 5s -> SIGKILL;
 * Windows uses taskkill /T because signals are not deliverable there).
 */
interface ReadyInfo {
  port: number;
  version: string;
}
type AgentState = 'starting' | 'ready' | 'stopped' | 'tripped';
declare class AgentProcess extends EventEmitter {
  #private;
  private child;
  private state;
  private consecutiveCrashes;
  private restartTimer;
  private stopping;
  private disposed;
  private backoffMs;
  private readySinceMs;
  private readonly agentPath;
  private readonly args;
  private readonly options;
  constructor(agentPath: string, args: string[], options: {
    restartDelayMs: number;
    restartMaxDelayMs: number;
    maxConsecutiveCrashes: number;
    onLog?: (line: string) => void;
  });
  getState(): AgentState;
  get readyInfo(): ReadyInfo | null;
  /** Spawn the agent and resolve with the READY handshake result. */
  start(readyTimeoutMs?: number): Promise<ReadyInfo>;
  /** Read stdout until the READY line (design.md section 8.2). */
  private readReadyLine;
  private pipeLogs;
  private onExit;
  private detach;
  /** Graceful stop: terminate, wait, then force-kill the whole tree. */
  stop(): Promise<void>;
  /** Idempotent teardown: no more restarts after dispose. */
  dispose(): Promise<void>;
  private terminate;
  private killTree;
  private taskkill;
  private setState;
}
//#endregion
//#region src/provider.d.ts
interface PiAiModelEntry {
  id: string;
  name: string;
}
interface ProviderTarget {
  providerId: string;
  apiKeyEnv: string;
  port: number;
}
declare function providerBaseURL(port: number): string;
/**
 * Minimal settings/credentials seam so tests can run against fakes.
 *
 * `mutate` is optional because DSH 0.1.7's `SettingsForms` always has it while
 * a reduced composition (and the sidecar's degraded fallback) may not; every
 * caller checks before writing rather than throwing on a missing writer.
 * The read face is `describe()` on 0.1.7, with 0.1.1's `get(ns)` tolerated.
 */
interface DshSeams {
  credentials: {
    set(ref: string, value: string): Promise<void>;
  };
  settings: {
    describe?(options?: {
      redactSecrets?: boolean;
    }): unknown;
    get?(ns: string): unknown;
    mutate?(ns: string, ops: Array<{
      op: 'set' | 'unset';
      path: Array<string | number>;
      value?: unknown;
    }>, expectedRevision?: number): Promise<void>;
  };
  logger: {
    info(message: string): void;
    warn(message: string): void;
  };
}
/** Parse the agent's OpenAI-shaped /v1/models reply into pi-ai model entries. */
declare function toPiAiModels(data: unknown): PiAiModelEntry[];
declare function fetchModels(port: number, token: string, timeoutMs?: number): Promise<PiAiModelEntry[]>;
/** GET /healthz (no auth); throws on transport failure or non-2xx. */
declare function fetchHealth(port: number, timeoutMs?: number): Promise<unknown>;
/**
 * Ensure the credential and the llm-pi-ai provider route reflect the running
 * agent. Safe to call repeatedly (every refresh): writes are no-ops when the
 * stored shape already matches, and mutate keeps other namespaces/routes
 * untouched because it edits only the opencode2dsh subtree.
 */
declare function registerProvider(seams: DshSeams, target: ProviderTarget, token: string, models: PiAiModelEntry[]): Promise<void>;
//#endregion
//#region src/index.d.ts
/**
 * opencode2dsh DSH cordis plugin entry.
 *
 * Two modes (config.mode, default `adapter`):
 *  - adapter: register a DSH LlmAdapter streaming directly from the Zen
 *    anonymous lane (marketplace shape: no child process, no binary).
 *  - sidecar (legacy/dev): prepare data dir + token + agent-config.json,
 *    spawn the Go agent, wait for READY, register the llm-pi-ai provider
 *    route, schedule model refresh.
 *
 * Settings: the editable surface is the `ipPool` field of {@link Config},
 * marked volatile. DSH 0.1.7 serves it under this entry's Loader id and
 * commits saves into the same reference, announcing them with
 * `loader/volatile-update`; there is no `ctx.settings.register()`.
 *
 * dispose(): stop timers/catalog, terminate the agent tree (sidecar mode).
 * The cordis fiber disposal guarantees this runs on plugin reload/unload and
 * on DSH shutdown.
 */
interface PluginContext {
  logger: {
    info(...args: unknown[]): void;
    warn(...args: unknown[]): void;
    error(...args: unknown[]): void;
  };
  llm?: {
    registerAdapter(providers: string[], adapter: unknown): unknown;
  };
  credentials?: {
    set(ref: string, value: string): Promise<void>;
  };
  /**
   * DSH 0.1.7 `SettingsForms` (dsh-settings). Read face for the sidecar's
   * namespace writes; `configure` is how a plugin claims its own settings
   * page instead of letting the domain auto-generate one. The 0.1.1
   * `register()/watch()` scope seam is gone and deliberately not re-declared.
   */
  settings?: {
    describe?(options?: {
      redactSecrets?: boolean;
    }): unknown;
    get?(ns: string): unknown;
    mutate?(ns: string, ops: Array<{
      op: 'set' | 'unset';
      path: Array<string | number>;
      value?: unknown;
    }>, expectedRevision?: number): Promise<void>;
    configure?(presentation: {
      auto?: boolean;
    }, owner?: unknown): () => void;
  };
  /** Web route registration (dsh-host-webserver service, docs §5.3). */
  webServer?: {
    register(route: {
      kind: 'exact' | 'prefix';
      path: string;
      handler: (req: unknown, res: unknown) => void | Promise<void>;
    }): () => void;
  };
  /** cordis fiber injection: run the callback once every listed service is up. */
  inject?(services: string[], callback: (ctx: PluginContext) => void | Promise<void>): unknown;
  effect?(fn: () => () => void): unknown;
  on?(event: string, listener: (...args: never[]) => unknown): () => void;
  emit?(event: string): unknown;
}
declare const name = "opencode2dsh";
/**
 * Only `llm` gates this fiber, because adapter mode (the shipped default) uses
 * nothing else: the Zen lane's credential is the literal `'public'`, and the
 * ip-pool settings ride the `Config` volatile reference. DSH 0.1.7 composes
 * `ctx.settings` as `SettingsForms`, which itself injects
 * `['configEditor', 'profileContext']` and ships disabled wherever no
 * `profileContext` exists (headless/CLI) — demanding it here kept the whole
 * fiber from ever activating, and with it the provider route. Sidecar mode and
 * the `configure({ auto: false })` page claim ask for the extra seams through
 * `ctx.inject` instead.
 */
declare const inject: readonly ["llm"];
declare function apply(ctx: PluginContext, config?: ResolvedPluginConfig | Opencode2dshConfig): void;
/**
 * The host's configured default model, best effort (issue #83's startup
 * warn): the `llm` namespace's model field (`defaultModel`/`default`/`model`),
 * as `provider/id`. Advisory ONLY — an unrecognized host shape (other ns,
 * other key, bare id, non-string) reads as unknown and the caller skips the
 * warn; this must never throw, crash, or touch host config.
 */
declare function hostDefaultModelId(settings: NonNullable<PluginContext['settings']>): string | undefined;
/**
 * One startup warn (issue #83) when allowedModels is set and excludes the
 * model the host saved as its default: the picker will stop offering it, so
 * say so — once, naming the id. No crash, no auto-rewrite of host config;
 * the host keeps its selection and can fix the whitelist itself. Fires only
 * for ids under this plugin's provider (`opencode2dsh/...`), so another
 * provider's default can never trip it.
 */
declare function warnHiddenDefaultModel(settings: NonNullable<PluginContext['settings']>, allowedModels: string[] | undefined, logger: PluginContext['logger']): void;
/**
 * Locate the agent binary (sidecar mode, legacy — the published package does
 * not bundle it): explicit config wins; then a sibling `legacy/agent` dev
 * build; then a bare name on PATH.
 */
declare function defaultAgentPath(): string;
//#endregion
export { AgentProcess, Config, type DshSeams, type Opencode2dshConfig, PluginContext, apply, configPaths, defaultAgentPath, ensureToken, fetchHealth, fetchModels, hostDefaultModelId, inject, name, providerBaseURL, registerProvider, resolveConfig, toPiAiModels, warnHiddenDefaultModel, writeAgentConfig };