import z from "@deepseek-ai/schemastery";
import { Context, ProviderStreams } from "@earendil-works/pi-ai";
import { PiAiAdapter } from "@deepseek-ai/dsh-llm-pi-ai";
import { Context as Context$1 } from "@deepseek-ai/cordis";
import { AttachmentStore } from "@deepseek-ai/dsh-attachment";
//#region src/promo.d.ts
/** One price pair, as upstream published it. Rates are credits per Mtoken. */
interface TraePromoPrice {
  /** Undiscounted rate. */
  beforeRate?: number;
  /** Discounted rate, when upstream stated one for this branch. */
  rate?: number;
  /**
   * Pay ratio in percent, straight from `discount`: 100 = full price, 50 = 五折,
   * 25 = 二五折. NOT a 0–1 multiplier — read literally, the way it is written.
   */
  discountPercent?: number;
}
/** One `off_peak` window: ISO weekdays 1(Monday)–7(Sunday), minutes 0–1440. */
interface TraePromoWindow {
  weekdays: number[];
  /** Inclusive. */
  startMinute: number;
  /** Exclusive; 1440 is upstream's way of writing "end of day". */
  endMinute: number;
}
/** The whole `activity_discount` document, kept unflattened on purpose. */
interface TraeActivityDiscount {
  /** Upstream's machine name for the campaign, e.g. `subsidy_member_discount`. */
  subKey?: string;
  /** Upstream's own "right now" verdict. */
  current?: TraePromoPrice & {
    discountType?: string;
  };
  /** Subscription price — hover material only, see the module note. */
  member?: TraePromoPrice;
  /** Recurring cheap hours, judged locally against each model's own zone. */
  offPeak?: TraePromoPrice & {
    timeZone?: string;
    windows: TraePromoWindow[];
  };
  /** Subsidy branch, when upstream names it separately from `current`. */
  subsidy?: TraePromoPrice;
}
//#endregion
//#region src/reasoning.d.ts
/**
 * The DSH thinking levels this plugin can carry, in ascending order.
 *
 * `max` is the fifth level Trae's own client advertises — its bundle ships the
 * i18n keys `trae-chat-core.model.reasoning_effort.{low,medium,high,extra_high,max}`
 * and `ai.model.reasoning_effort.{low,medium,high,xhigh,max}`, and publishes the
 * per-model list from a remote config (`AI.agent.model.reasoning_effort_level_by_agent_model_v2`).
 * Leaving it out of this list meant a level the vendor could start serving was
 * filtered away at PARSE time, before anything downstream could decide (issue
 * #60). Listing it does not fabricate the level: `supported` is still built
 * only from what the upstream response actually contains, so a model that does
 * not advertise `max` never offers it.
 *
 * `minimal` is kept for the same reason in reverse — it is a DSH level, so the
 * type must be able to represent it even though no CN model has advertised it.
 */
declare const TRAE_REASONING_EFFORTS: readonly ["minimal", "low", "medium", "high", "xhigh", "max"];
type TraeReasoningEffort = typeof TRAE_REASONING_EFFORTS[number];
interface TraeReasoningCapability {
  supported: readonly TraeReasoningEffort[];
  defaultEffort?: TraeReasoningEffort;
}
declare function parseReasoningCapability(value: unknown): TraeReasoningCapability | undefined;
/** Add effort only when the selected model advertises that exact value. */
declare function applyReasoningEffort<T extends Record<string, unknown>>(body: T, effort: TraeReasoningEffort | undefined, capability: TraeReasoningCapability | undefined): T & {
  reasoning_effort?: TraeReasoningEffort;
};
//#endregion
//#region src/model-metadata.d.ts
interface TraeDiscoveredReasoning {
  supported: TraeReasoningEffort[];
  defaultEffort?: TraeReasoningEffort;
}
interface TraeDiscoveredModel {
  id: string;
  name: string;
  multimodal: boolean;
  contextWindow?: number;
  maxContextWindow?: number;
  creditMultiplier?: number;
  reasoningSupported: boolean;
  reasoning?: TraeDiscoveredReasoning;
  /**
   * The directory group the model was seen under (`data.list[].function`).
   *
   * The Remote `/models` answer is grouped by SOLO function and the group is
   * the authoritative statement of which function the model belongs to — the
   * `config_name` the gateway accepts is isolated per function, so a model in
   * `solo_work_remote` answers 4001 when asked through `solo_work_lite`. The
   * wire join (see `mergeTraeModelSources`) prefers its own
   * `get_detail_param` function and uses this as the fallback when the roster
   * has nothing to say (restricted networks often return an empty
   * `config_info_list` for the chat functions).
   */
  function?: string;
  /**
   * Trae's discount rule for this row (`features.activity_discount`), kept whole
   * so the card can judge it against the clock at paint time (src/promo.ts).
   */
  activityDiscount?: TraeActivityDiscount;
}
/**
 * Parse only capabilities explicitly advertised by Trae's remote model API.
 *
 * @param groupFunction The `data.list[].function` of the group this raw row
 * was read from; attached verbatim so downstream can replay the model's own
 * function instead of the `llm_utils_chat` default (see
 * {@link TraeDiscoveredModel.function}).
 */
declare function parseTraeRemoteModel(value: unknown, groupFunction?: string): TraeDiscoveredModel | undefined;
//#endregion
//#region src/paths.d.ts
type TraeEdition = 'cn' | 'sg' | 'solo' | 'solo-sg';
/**
 * Where a local sign-in was persisted. `desktop` candidates hold an Electron
 * `globalStorage/storage.json` whose auth value is encrypted; `cli` candidates
 * hold a bare JWT written by the Trae CLI, which needs no decryption.
 */
type TraeCredentialSource = 'desktop' | 'cli';
interface TraeStorageCandidate {
  edition: TraeEdition;
  path: string;
  source: TraeCredentialSource;
}
/**
 * One edition's plausible Windows directory spellings, in probe order.
 *
 * Exported so the identity reader and the credential scanner probe the SAME
 * names: the two resolve different files (the install's `product.json` vs the
 * per-user `storage.json`) but they describe one installation, and a spelling
 * that works for one but not the other is a bug rather than a preference.
 */
declare function traeWindowsAppNames(edition: TraeEdition): readonly string[];
declare function traeStorageCandidates(platform?: NodeJS.Platform, home?: string, env?: NodeJS.ProcessEnv): TraeStorageCandidate[];
//#endregion
//#region src/region.d.ts
/** Storage/routing bucket: the CN service or the international (ai) service. */
type TraeRegion = 'cn' | 'ai';
/**
 * The service a credential's own claims name.
 *
 * WIDER than {@link TraeRegion} on purpose. The US cluster is a real,
 * distinguishable Trae service — `userRegion: "US"` and hosts under
 * `*.traeapi.us` (issue #66, measured on an international 3.6.4 install:
 * `grow-normal.traeapi.us` answers the pay endpoint with 200 where the SG
 * gateway answers 401) — but this plugin does not serve it yet.
 *
 * Naming it as its own value is the whole fix: while the US claim was
 * unrecognised, `regionOfCredential` fell through to the edition label (`sg` →
 * `ai`) and shipped a US token to `*.trae.ai`, where every read answered 401
 * and the card reported it as a generic "refresh failed". A value the type
 * system carries forces every gateway site to say out loud what it does with a
 * region it cannot serve, instead of silently inheriting the SG routing.
 */
type TraeServiceRegion = 'cn' | 'ai' | 'us';
/**
 * One section of the plugin card: a provider the user can switch, bind an
 * account to, and pick models for, INDEPENDENTLY.
 *
 * A panel is not a region. `cn` and `ai` happen to be one-to-one with regions,
 * but the CN enterprise pool shares the `cn` credential while billing a
 * different account and serving a different roster — it needs its own switch,
 * its own account binding and its own model selection, which is exactly what a
 * panel is. Keeping panels a separate concept from regions is what lets
 * `enterprise` be handled by the same settings plumbing with no new storage
 * shape: each panel is just one more slot in the `regions` map.
 */
type TraePanel = 'cn' | 'ai' | 'enterprise';
/** Every panel, in card tab order. */
declare const TRAE_PANELS: readonly TraePanel[];
/** The region whose credential/account pool a panel draws on. */
declare function regionOfPanel(panel: TraePanel): TraeRegion;
/** The provider id a panel publishes. */
declare function providerOfPanel(panel: TraePanel): string;
/** The panel that owns a provider id, or undefined for an unknown id. */
declare function panelOfProvider(provider: string): TraePanel | undefined;
/** Narrow a stored settings key to a panel. */
declare function panelOfKey(value: unknown): TraePanel | undefined;
/** One region's upstream gateway bases. */
interface TraeRegionGateways {
  /** Chat + agent API base (the `llm_utils_chat` / raw-chat family). */
  readonly chat: string;
  /** SOLO remote model directory base (`/api/remote/v1`). */
  readonly remote: string;
  /** Pay/status API base; the credential's own host is preferred when known. */
  readonly pay: string;
}
/**
 * Verified gateway bases per region (docs/INTL_SG_EVIDENCE.md §2).
 * The AI gateway is shared by both international installs (Trae desktop and
 * TRAE SOLO); its mchost shards (`api16/api22-normal-alisg.mchost.guru`)
 * answer the same bytes but stay internal — `coresg-normal.trae.ai` is the
 * single stable entry point.
 */
declare const REGION_GATEWAYS: Readonly<Record<TraeRegion, TraeRegionGateways>>;
/** Region for an edition label: the international installs belong to `ai`. */
declare function regionOfEdition(edition: TraeEdition): TraeRegion;
/**
 * Region from the credential's `userRegion` claim. The desktop storage spells
 * it as an object (`{"region":"CN","_aiRegion":"CN"}`); the app logs also
 * spell the bare value lowercase (`"sg"`). Both are accepted, case-blind.
 *
 * `"US"` is recognized as its own region (issue #66). It used to fall through
 * this function unrecognised, which is what let a US credential inherit the SG
 * routing from the edition label.
 */
declare function regionOfUserRegion(value: unknown): TraeServiceRegion | undefined;
/**
 * Region from a credential host (`.trae.ai` → ai, `.trae.cn`/`.trae.com.cn` →
 * cn, `.traeapi.us` → us).
 *
 * The US suffix is checked explicitly. It is NOT a special case of
 * `.trae.ai`: `grow-normal.traeapi.us` is a different cluster with its own
 * pay/pay-status endpoints, and the plugin's SG gateways answer a US token
 * with 401 (issue #66).
 */
declare function regionOfHost(host: string | undefined): TraeServiceRegion | undefined;
/**
 * Region of a credential: the `userRegion` claim wins, the host suffix is the
 * fallback, and the edition label is the last resort. Every level is derived
 * from data the credential itself carries, so no user configuration is needed.
 *
 * The edition fallback is only ever reached by a credential that carries
 * NEITHER a claim NOR a resolvable host (a CLI token). That matters: it is the
 * reason a US credential no longer becomes `ai` — its own claim resolves first.
 */
declare function regionOfCredential(credential: {
  edition: TraeEdition;
  host?: string;
  userRegion?: string;
}): TraeServiceRegion;
//#endregion
//#region src/catalog.d.ts
type TraeInputModality = 'text' | 'image';
/**
 * One model the adapter exposes. `contextWindow` is the effective DSH context
 * after the user's budget; `maxContextWindow` is the native Max window Trae
 * advertises (capability display only — never a second model entry).
 */
interface TraeModelInfo {
  id: string;
  name: string;
  contextWindow?: number;
  maxTokens?: number;
  input?: TraeInputModality[];
  creditMultiplier?: number;
  reasoningSupported?: boolean;
  reasoning?: TraeDiscoveredReasoning;
  reasoningEfforts?: Partial<Record<TraeReasoningEffort, string | null>>;
  maxContextWindow?: number;
  /** The `config_name` `llm_utils_chat` accepts; absent means `id` is already the wire id. */
  wireConfigName?: string;
  /** The directory function this model must be called through (see {@link TraeWireModel.function}). */
  wireFunction?: string;
  /**
   * Trae's own `multimodal` flag for this model, carried through from the
   * directory that advertised it. It is the upstream's answer to "does this
   * model read images", and {@link applyImageSelection} unions it with the
   * user's explicit opt-ins.
   *
   * Deliberately NOT the same thing as `input`: `input` is what DSH is told
   * this route accepts, while this field records what Trae said. Keeping both
   * lets a future refresh re-derive `input` without losing the upstream fact,
   * and lets the card explain WHY a model is image-capable.
   *
   * Absent means the directory did not say (an older `lastCatalog` saved before
   * this field existed, a fallback row, or a directory entry that omitted the
   * key). Absent is treated as false, never as "assume capable": sending an
   * image to a model that cannot read one burns credits for a silent failure.
   */
  multimodal?: boolean;
  /**
   * Trae's discount RULE for this model, exactly as published (see src/promo.ts).
   *
   * Kept unflattened and unjudged: whether a badge is painted depends on the
   * clock, so the card judges it at paint time rather than trusting a verdict
   * frozen into a saved catalog. Absent means the model carries no promotion
   * document — including every `ai` (international) row, whose subscription
   * models publish no `consumption_rate` at all.
   */
  activityDiscount?: TraeActivityDiscount;
}
/**
 * Conservative context capacity used when a row must be advertised with a
 * number but states no usable one of its own. Every fallback row and every
 * live Trae row is expected to carry its real window; this is the backstop
 * that keeps one unsized row from failing the entire provider route
 * (`INVALID_MODEL_CONTEXT`).
 *
 * APPLIED AT EVERY EXIT TOWARD DSH, NOT ONLY IN THE ADAPTER. The pi-ai
 * profile's `defaultContextWindow` is read by the kernel's catalog-resolution
 * step, which this plugin never runs: it builds its provider BY HAND through
 * `createProvider({ models })`, so `Models.getModel()` returns the raw
 * `toPiModel` row with no defaulting applied anywhere. Leaving the fallback on
 * the profile alone is what produced
 * `adapter returned invalid context metadata for provider "trae" model
 * "doubao_1.8"` — a row the live directory published without a window reached
 * DSH unsized and took the whole `trae` route down (#70).
 *
 * The model-DISCOVERY callback is a second exit with no adapter in between
 * (#72): the host passes its rows through UNVALIDATED, and a settings surface
 * adopts one verbatim into a `models` entry, where the schema demands a
 * positive integer. So this rule guards the row PRODUCERS here as well.
 */
declare const FALLBACK_CONTEXT_WINDOW = 200000;
/**
 * The window a row is actually advertised with.
 *
 * Positive integers pass through untouched — a row's own window is never
 * second-guessed. Anything else (missing, `NaN`, `0`, a negative or a
 * fractional count from a malformed directory entry) falls back, because DSH
 * accepts ONLY a positive integer and rejects the entire provider otherwise.
 *
 * The fractional case is not hypothetical: the parsers that fill these rows
 * gate the field through `finitePositive`, which checks
 * `Number.isFinite && > 0` and nothing about integer-ness, so a directory or
 * wire roster publishing `200000.5` reaches here intact.
 */
declare function servedContextWindow(info: Pick<TraeModelInfo, 'contextWindow'>): number;
/**
 * Bootstrap catalog: identity only where current Trae metadata has not been
 * fetched yet.
 *
 * Every id here must be a `config_name` that `llm_utils_chat` actually accepts,
 * because this list is served verbatim before the first live refresh lands and
 * it is NOT filtered against the wire map (the wire map can only confirm ids it
 * happens to know, so filtering would delete the safety net exactly when it is
 * needed — see `fallbackModels` in index.ts). The current CN roster was
 * verified against the live remote directory on 2026-09-15
 * (docs/DS41_CALLABILITY.md): `DeepSeek-V4-Flash-Official` and
 * `DeepSeek-V4-Pro-Official` carry the `-Official` suffix, and there is no
 * `auto` config_name — an `auto` row was previously served here and would have
 * failed on selection.
 *
 * Every row MUST also carry a positive-integer `contextWindow`. DSH rejects an
 * adapter whose model has no usable context (`INVALID_MODEL_CONTEXT`), and that
 * failure is per-provider — one bad row takes the whole region offline. These
 * rows are exactly the ones served when no live directory is available (no
 * install for that region, signed out, or a failed refresh), which is precisely
 * when the fallback is doing its job, so a missing field here is fatal rather
 * than cosmetic. See docs/ISSUE8_DIAGNOSIS.md.
 */
declare const FALLBACK_TRAE_MODELS: readonly TraeModelInfo[];
/**
 * Bootstrap catalog for the international (ai) region, captured from the
 * live `coresg-normal.trae.ai/api/remote/v1/models` directory on 2026-09-15
 * (docs/INTL_SG_EVIDENCE.md §3). The two rosters barely overlap (the CN list
 * has no Gemini/GPT/MiniMax entries), so an international account must never
 * be seeded with the CN list. Like the CN fallback it is replaced by the live
 * refresh; image input stays the user's explicit opt-in (`imageModelIds`).
 *
 * The `contextWindow` values are the measured ones from that same capture
 * (`docs/INTL_SG_EVIDENCE.md` §3) and are required for the same reason as the
 * CN fallback: without them the whole `trae-global` provider fails to load.
 */
declare const FALLBACK_TRAE_MODELS_AI: readonly TraeModelInfo[];
/**
 * Static fallback directory for a region. Each region keeps its own model
 * slot in settings; the fallback must match the region so an account never
 * shows the other region's roster.
 */
declare function fallbackModelsFor(region: TraeRegion): readonly TraeModelInfo[];
/** Exact DSH modalities for one catalog entry; absent metadata is text-only. */
declare function traeInputModalities(model: Pick<TraeModelInfo, 'input'>): TraeInputModality[];
/**
 * Compose the DSH-facing model name: Trae's own model picker renders each
 * entry as `Name · x<rate>`, so the credit multiplier is shown inside the
 * name. `TraeModelInfo.name` keeps the pure Trae display name — every join
 * (wire resolution, callable-key filtering) must keep matching the
 * undecorated name; only the model rows handed to DSH (adapter catalog and
 * model discovery) use this decorated name.
 *
 * `withRate` is false for the ENTERPRISE panel. The multiplier is a
 * consumer-pool figure — personal credits per token, read from the consumer
 * directory — and the tenant pool does not bill against it, so printing it in
 * the model picker would price a model the tenant is not charged for. The rate
 * is part of the NAME that reaches DSH, which is why this is a parameter here
 * and not a rendering decision downstream.
 */
declare function traeModelDisplayName(model: Pick<TraeModelInfo, 'name' | 'creditMultiplier'>, withRate?: boolean): string;
/** Apply the user's explicit image opt-ins plus Trae's own multimodal flag. */
declare function applyImageSelection(models: readonly TraeModelInfo[], selected: ReadonlySet<string>): TraeModelInfo[];
/** One row from `get_detail_param`: the authoritative llm_utils_chat wire id + display name. */
interface TraeWireModel {
  id: string;
  name: string;
  contextWindow?: number;
  maxTokens?: number;
  reasoning?: TraeReasoningCapability;
  /**
   * Effective (post-discount) credit multiplier, read from the row's
   * `display_contact_config` — the figure the Trae IDE renders (see
   * `wireCreditMultiplier` in solo.ts). Wins over the Remote directory's own
   * `consumption_rate`, which reports the undiscounted value.
   */
  creditMultiplier?: number;
  /**
   * The `get_detail_param` function this config_name came from. Trae splits its
   * callable roster across several functions (SOLO modes), and a model is only
   * callable through the function that actually lists it — glm-5.3 answers
   * `solo_work_remote` but rejects `solo_work_lite` with 4001. The chat call
   * therefore has to replay the directory's own function.
   */
  function?: string;
  /**
   * The row's own `activity_discount`, read from `display_contact_config`.
   *
   * The wire roster is the richer of the two directories (8 rows carrying a
   * discount vs the Remote directory's 4), and the same model can name a
   * different campaign on each side, so this value wins over the Remote one
   * during the merge — the precedence `creditMultiplier` already follows.
   */
  activityDiscount?: TraeActivityDiscount;
  /**
   * Upstream's `usage` for this config — what the config is FOR.
   *
   * Read from `get_detail_param`'s top-level `usage` field (verified
   * 2026-10-22 on a live CN credential): `chat_completion` for a real model,
   * `custom_model` for a user's own custom model, and one value per built-in
   * tool config (`summary`, `title_generation`, `fast_apply`,
   * `input_optimization`, …).
   *
   * It is the discriminator that separates a MODEL from a TOOL, and
   * {@link mergeTraeModelSources} needs it to decide which wire-only rows may
   * be promoted into the catalog (issue #46). Absent means "upstream did not
   * say" — never "assume it is a tool", and never "assume it is a model".
   */
  usage?: string;
  /**
   * Upstream's `config_source` for this config.
   *
   * `1` is a Trae preset; `3` is the account's own custom model (it carries a
   * `custom_config` with the user's own base_url and key). The plugin does not
   * serve a user's custom model, so a `3` row is never promoted (issue #46).
   * Absent means "upstream did not say".
   */
  configSource?: number;
}
/**
 * Whether a wire row is a USER-FACING MODEL that the catalog may expose.
 *
 * Issue #46: the Remote directory is the catalog's SKELETON, but the wire
 * roster knows models the skeleton does not — and the skeleton systematically
 * omits one whole CLASS of them: the dated snapshot configs
 * (`kimi-k2-0905`, `seed-code-pro-0430`, …). Measured 2026-10-22 on a live
 * CN credential, the Remote skeleton carried **zero** dated config_names
 * while the wire roster carried three, so every one of them was dropped by
 * the join and the user could not reach the snapshot the IDE offered them.
 *
 * A row qualifies only when ALL of the following hold — each test is an
 * upstream signal, none of them invented:
 *
 *  - `usage === 'chat_completion'` — it is a model, not a tool config. The
 *    wire roster mixes models with the IDE's own helpers (`summary`,
 *    `title_generation`, `fast_apply`, `input_optimization`) and with the
 *    account's custom models (`usage: 'custom_model'`); none of those belong
 *    in a model picker. Measured: this one test removed 23 of 50 wire-only
 *    rows, and every row it removed was a tool or a custom model.
 *  - `config_source === 1` — a Trae preset, not the account's own custom
 *    model (source 3, which carries the user's own base_url and key). The
 *    plugin must not offer to bill a model it does not host.
 *  - a REAL display name — not empty, not the upstream placeholder `-`, not a
 *    bare config identifier (`search_agent_qwen_fast`,
 *    `computer_use_subagent`), and not the config's OWN id. A model with no
 *    name has nothing to show in the picker.
 *
 * The display-name-collision test lives in the merge itself (it needs the
 * Remote rows to compare against); see {@link mergeTraeModelSources}. It is a
 * CAPABILITY test there, not a name test: a collision only suppresses a row
 * when the equally-named row is at least as capable.
 *
 * The survivors are exactly the models a user would recognise and the IDE
 * offers but the plugin hid: `kimi-k2` / `kimi-k2-0905`, `glm-4.6`,
 * `glm-4.7`, `glm-5-turbo`, `minimax-m2`, `minimax-m2.1`, `qwen3-coder`,
 * `seed-code-pro-0430`.
 */
declare function isPromotableWireModel(model: TraeWireModel): boolean;
/**
 * Merge the two Trae model sources into one authoritative catalog.
 *
 * `remote` (the solo.trae.cn `/models` directory) is the authoritative model
 * skeleton: it supplies the display id, display name, context windows, credit
 * multiplier, reasoning and multimodal flags. `wire` (from `get_detail_param`)
 * supplies the real `llm_utils_chat` `config_name` — the only id the chat
 * endpoint actually accepts — plus the authoritative post-discount credit
 * multiplier when `display_contact_config` carries one.
 *
 * A remote row with no wire match is STILL KEPT (decision 2026-10-02, issue
 * #19). It previously was dropped, on the reasoning that a row with no
 * `config_name` is sent as an invalid one and rejected with 4001. That
 * reasoning holds only for the accounts and functions we can measure, and
 * measuring is the problem: whether a roster contains a model is ACCOUNT-
 * SCOPED, so "no wire entry on a free account" cannot prove a paying account
 * cannot call it. Dropping on that evidence silently denied those users models
 * their own Trae IDE offers. The row therefore ships, and its call fails
 * honestly: the bridge now translates the in-stream refusal into a readable
 * error (`4001` → "Trae does not serve this model under the SOLO function the
 * request used", `4011` → "Trae throttled the SOLO channel for this account",
 * the second one corrected by issue #33 — 4011 is a rate limit, see
 * src/solo-bridge.ts), so a user who picks an unusable model is told why instead
 * of seeing nothing. This reverses the 2026-08-30 note about `Doubao-Seed-Code`,
 * which later turned out to be callable under `chat_v3`.
 *
 * Credit multiplier precedence: the wire's `display_contact_config` rate wins
 * whenever present (it is the post-discount figure the Trae IDE renders — the
 * Remote directory can report up to 10x the undiscounted value, see
 * `wireCreditMultiplier` in solo.ts); the Remote `consumption_rate` is the
 * fallback when the wire row carries none.
 *
 * Joining is two-tier, in priority order:
 *  1. `wire.id` (the `config_name`) equals the remote id — the model's display
 *     id is already its wire id (the common case: glm-5.2,
 *     DeepSeek-V4-Flash-Official, kimi-k3, …).
 *  2. `wire.name` (the `display_name`) equals the remote display name — for
 *     models whose display id differs from the wire id across Trae versions.
 * When the matched wire `config_name` differs from the remote id it is recorded
 * as `wireConfigName`; otherwise it is left undefined (id is already the wire id).
 *
 * The DISPLAY NAME stays the Remote skeleton's (issue #46). The wire roster
 * was measured as a name source and REJECTED: it disagrees with the Trae
 * IDE's own roster on 32 of 81 ids, while the skeleton disagrees on 3 of 33.
 * The wire roster is function-scoped — the same id carries a different
 * `display_name` per function — and the plugin's wire client reads the CHAT
 * functions, so it can land on a name the IDE's picker never shows. The wire
 * keeps its own roles: the `config_name`, the function, the output cap, the
 * multiplier and the promotion rule.
 *
 * Rows the Remote skeleton does not know but the wire roster does are
 * PROMOTED (issue #46) — subject to {@link isPromotableWireModel}. The
 * skeleton systematically omits the dated snapshot configs, so without
 * promotion every snapshot the IDE offers is unreachable from the plugin.
 */
declare function mergeTraeModelSources(remote: readonly TraeDiscoveredModel[], wire: readonly TraeWireModel[]): TraeModelInfo[];
/**
 * Demote a NON-chat `wireFunction` to "no function", keeping the row.
 *
 * A row pinned to an IDE/Remote-agent roster — `solo_agent`, `builder_v3` — is
 * not callable through `llm_utils_chat` by THAT function: asking answers
 * 4011/4001 (measured 2026-10-01, issue #19). Dropping the row is not the fix,
 * though, and was a regression: a model can carry a non-chat function for a
 * reason that says nothing about its chat availability. The directory lists
 * `gpt-5.5`, `gpt-5.6-*`, `gpt-6-astra`, `glm-5.2`, `kimi-k2.7-code`,
 * `Dola-Seed-2.0-Code` and `deepseek-v4-flash-0731` under `solo_agent` ALONE
 * (docs/ISSUE19_DIAGNOSIS.md), yet the same models answer normally under
 * `solo_work_remote` / `solo_work_lite` / `solo_agent_remote` — they are
 * exactly the models issue #19's fix was opened to expose. Dropping them
 * re-hid the whole set on the restricted networks this fallback targets, where
 * the wire roster is empty and the directory group is the only attribution.
 *
 * Keeping the row with the function CLEARED preserves both facts: the model
 * stays visible (issue #19), and the bridge sends the region's DEFAULT chat
 * function instead of one that is guaranteed to refuse. That is the pre-change
 * behaviour for these rows — a genuinely unreachable model still fails with a
 * readable upstream message rather than a silent absence.
 *
 * `chatFunctions` must be the region's own `TRAE_DIRECTORY_FUNCTIONS` list —
 * the functions `llm_utils_chat` accepts. Callers should log the demoted rows:
 * "which function did it lose, and why" deserves an answer.
 */
declare function withChatCallableFunctions(rows: readonly TraeModelInfo[], chatFunctions: readonly string[]): TraeModelInfo[];
/** Local DSH context budget per model; a value may only select an advertised window. */
type TraeContextBudget = number;
/**
 * Apply the saved local budget. Trae advertises a dev window and a Max window
 * per model, and the card may also offer the 500K middle step (see
 * {@link contextBudgetOptions}), so a budget may only switch a model to a
 * window that model actually offers — never to a fabricated number, and never
 * to something wider than its Max (a saved 500K for a model later refreshed
 * down to a 256K Max must fall back, not overflow). Everything else keeps the
 * dev window.
 */
declare function applyContextBudgets(catalog: readonly TraeModelInfo[], budgets?: Readonly<Record<string, TraeContextBudget | undefined>>): TraeModelInfo[];
/** Convert Trae metadata into catalog rows; image input is decided by {@link applyImageSelection}. */
declare function discoveredCatalog(models: readonly TraeDiscoveredModel[]): TraeModelInfo[];
/**
 * Drop rows saved by older releases that generated `@1m` variant models, so a
 * stale configuration cannot resurrect a variant the runtime no longer builds.
 */
declare function sanitizeCatalog(catalog: readonly TraeModelInfo[]): TraeModelInfo[];
/**
 * Derive the runtime catalog from the last refreshed Trae directory plus the
 * user's explicit selection and context budgets. An empty selection falls back
 * to the whole directory: a plugin that has never been configured must still
 * serve models rather than nothing. This is the single source of truth for
 * what DSH actually exposes, so saving only the selection and budgets is
 * enough to rebuild it after a restart.
 */
declare function deriveCatalog(catalog: readonly TraeModelInfo[], enabled: ReadonlySet<string>, budgets?: Readonly<Record<string, TraeContextBudget | undefined>>): TraeModelInfo[];
declare class TraeCatalog {
  private models;
  /**
   * @param region Seeds the static fallback for this region; each region's
   * provider must never serve the other region's roster before its first live
   * refresh lands.
   */
  constructor(region?: TraeRegion);
  current(): readonly TraeModelInfo[];
  set(models: readonly TraeModelInfo[]): void;
}
//#endregion
//#region src/status-paths.d.ts
/** Plugin-owned usage endpoint consumed by its browser half. */
declare const TRAE_USAGE_PATH = "/plugins/dsh-connect-trae/usage";
/**
 * Plugin-owned availability probe: POST the model ids to test, get one verdict
 * per model. Unlike every read-only sibling this route SPENDS quota — a real
 * (minimal) chat call per model — so it is user-initiated only, and the card
 * labels the button as consuming a small amount.
 */
declare const TRAE_MODELS_TEST_PATH = "/plugins/dsh-connect-trae/models/test";
/**
 * Per-account status (check-in / credits / subscription) for the account table.
 *
 * Each row of the account table reads its OWN state through this route — a CN
 * row carries its check-in state and balance, an ai row its subscription.
 * POST with the accountId in the body: one upstream read per account, paid
 * only when the table is actually shown.
 */
declare const TRAE_ACCOUNT_STATUS_PATH = "/plugins/dsh-connect-trae/account-status";
/**
 * Plugin-owned daily check-in claim endpoint. POST, loopback-only, and the only
 * route in this plugin that changes upstream account state. The accountId in
 * the body names WHICH account to claim for, so the button can sit in each
 * account row.
 */
declare const TRAE_CHECKIN_PATH = "/plugins/dsh-connect-trae/checkin";
/**
 * Outcome vocabulary of one account probe, shared by the Host and the card.
 *
 * Mirrors `TraePoolOutcome` in `./account-pool.ts`, and is DECLARED again here
 * rather than imported for the same reason workbuddy repeats it: this module is
 * the node-free bridge for the browser build target and must not pull in the
 * Host-side pool module (which imports the credential type). The two lists must
 * stay in step — the card renders one label per value, and a value Host can send
 * that the card has no label for renders as the raw token.
 *
 * `plan-gated` is Trae-only (upstream `1005`: this ACCOUNT's plan does not cover
 * the model) and has no workbuddy counterpart.
 */
type TraeWebPoolOutcome = 'ok' | 'rate-limited' |
/**
 * The MODEL is loaded, not the account.
 *
 * Kept apart from `rate-limited` because the two need OPPOSITE advice:
 * `rate-limited` is this account's volume wall (wait, or bill another account),
 * while `model-busy` follows the model everywhere — every account hits the same
 * wall, so switching only spends a request per account to learn what the first
 * already said.
 */
'model-busy' | 'out-of-credit' | 'credential-rejected' | 'policy-rejected' | 'plan-gated' | 'unavailable' | 'not-found' | 'failed';
/** Why one account is currently out of the pool. */
type TraeWebPoolExclusion = 'unusable' | 'rate-limited' | 'model-busy' | 'out-of-credit' | 'credential-rejected' | 'policy-rejected' | 'plan-gated' | 'not-found' | 'unavailable' | 'failed';
/**
 * One account's row in the pool, as the card renders it.
 *
 * Ties together the three facts the card shows per account — credits, the last
 * test, and whether it can serve right now — so the ranking the card displays
 * comes from ONE Host answer rather than being re-derived in the browser. The
 * browser re-deriving it is how a card ends up calling an excluded account "in
 * use", which is the inconsistency this document exists to prevent.
 */
interface TraeWebPoolAccount {
  accountId: string;
  accountName: string;
  /** Total remaining credit, absent when this account's balance read failed. */
  credits?: number;
  /**
   * The GENERAL bucket — the credit this plugin's chat can actually spend.
   *
   * Trae-only, because a Trae balance is TWO buckets and SOLO chat only drains
   * General (measured on the live `available_endpoint` split). A row whose total
   * looks rich but whose General reads zero cannot serve a request, which is the
   * same trap workbuddy hit with its expiry rule: a ranking keyed on a figure that
   * the billing path cannot reach is not a ranking. The card shows both.
   */
  generalAvailable?: number;
  /** The WORK bucket, kept for display: this plugin's chat never spends it. */
  workAvailable?: number;
  /** Credit lapsing inside 3 days. Zero means "measured, nothing at risk". */
  expiringSoon?: number;
  /** When the nearest pack lapses, epoch ms. */
  nearestExpiryMs?: number;
  /**
   * This account's stored access token has lapsed, so its balance cannot be read
   * until it is refreshed or the user signs in again.
   *
   * A reason for the dash, not a second dash: without it "0 credit" and "cannot
   * read the balance" look identical on the card, and only one of them is the
   * user's problem to fix.
   */
  tokenExpired?: boolean;
  /**
   * The last test of this account, absent when never tested.
   *
   * `modelId` lives INSIDE the measurement rather than being assumed from the
   * row's current setting: the setting can change after the test, and a result
   * must keep naming what it actually measured.
   */
  probe?: {
    outcome: TraeWebPoolOutcome;
    atMs: number;
    /**
     * What wrote this measurement, so the card can explain a change the user
     * watched happen: `test-batch` is a deliberate test, `live-request` is a real
     * request that failed and overwrote it. ABSENT for records written before the
     * field existed — the card must then say "unknown", not guess.
     */
    source?: 'test-batch' | 'live-request';
    /** WHICH model this measurement is about; absent = unknown scope. */
    modelId?: string;
    /** Only when the upstream named a time; never invented locally. */
    retryAtMs?: number;
    /** Upstream's own words, already redacted. Absent on success. */
    message?: string;
  };
  /** Set when this account cannot serve right now. */
  excludedBy?: TraeWebPoolExclusion;
  /**
   * Whether this is the account billing traffic for this panel RIGHT NOW.
   *
   * The pool's runtime pick when enabled, else the saved selection. It is the
   * HOST's answer, not the card's guess: a card that derived "in use" from the
   * saved setting would contradict the pool after a rotation.
   */
  current: boolean;
  /**
   * Whether the user checked this account into this panel's pool.
   *
   * Listed rows include UNCHECKED accounts so the card can offer them to check:
   * membership is an explicit opt-in and a user can only opt in to something they
   * can see. Only checked rows can bill or be batched.
   */
  member: boolean;
  /**
   * Whether this machine still holds a usable sign-in for the account.
   *
   * `false` marks a GHOST: checked or listed, but no local credential resolves, so
   * a batch can neither test it nor check it in. It is kept as a row (rather than
   * filtered out) because the only way to stop carrying a broken entry is to see
   * it and remove it — a filtered row would leave the saved list permanently dirty
   * with nothing on screen to explain why the pool runs on fewer accounts than the
   * checkbox count says.
   */
  reachable?: boolean;
  /**
   * Today's check-in state for this account.
   *
   * ABSENT means it was not read — the card must then say so rather than render a
   * definite "not checked in", which would contradict a claim the user just
   * watched succeed.
   */
  checkedInToday?: boolean;
  /**
   * Whether today's check-in is spent on this MACHINE for this account.
   *
   * Trae-only, because Trae keys the daily claim to `x-device-id` (code `9095`).
   * `checkedInToday === false` together with this true is the "switched account"
   * case the check-in card already documents: this device has no claim left.
   */
  deviceCheckedIn?: boolean;
}
/**
 * The pool's state for one panel.
 *
 * `targetModelId`/`targetModelSource` exist so the card can state WHICH model a
 * test would use and WHERE that choice came from. `none` is a real, common
 * answer for Trae — the CN static fallback catalog carries no `creditMultiplier`
 * at all until its first live refresh, and "missing multiplier ≠ free" means the
 * card must render "no free model" rather than silently substituting a paid one.
 */
interface TraeWebPool {
  enabled: boolean;
  /**
   * Whether this panel offers the daily check-in at all.
   *
   * Only `cn` does. The ai gateways answer 404 for the whole `/trae/api/v2/ug/*`
   * family (probed 2026-09-24) and the enterprise panel has no personal reward,
   * so the card hides the action entirely rather than rendering a button whose
   * only outcome is a refusal.
   */
  checkinSupported: boolean;
  /**
   * Whether this panel offers the destructive per-row Delete at all.
   *
   * The client bundle updates on REFRESH but the Host only on RESTART, so a card
   * shipping before the Host gains `deleteAccountOf` must hide the button rather
   * than render one whose only outcome is a 503. Absent means the legacy Host
   * predates the feature, and the destructive Delete is not offered.
   */
  deleteSupported?: boolean;
  /**
   * Where this panel's credential copies live, and how many the plugin holds.
   *
   * The user's recurring doubt is "there is no real copy file, it just follows
   * the app" — which no amount of prose answers. Reporting the path and the count
   * lets the card show the actual file, so "a copy exists" is something the user
   * can verify on disk. Absent means a Host that predates this report.
   */
  copies?: {
    path: string;
    count: number;
  };
  /** The model a test would use right now; absent when none can be resolved. */
  targetModelId?: string;
  /**
   * Where the target came from. `'stale'` means the SAVED id is no longer in the
   * catalog — a distinct state from `'none'` (no free model exists), because the
   * two need opposite advice (offer a way back to automatic / say there is no
   * free model at all).
   */
  targetModelSource: 'preferred' | 'free' | 'none' | 'stale';
  /**
   * How much text a pool test sends (0 = the minimal probe). Always a number so
   * the card's select has a value to show; the saved preference is the default.
   */
  probeInputTokens: number;
  /** The saved target id that this panel's catalog no longer offers. */
  staleTargetModelId?: string;
  /** The account ids the user has checked into this panel's pool. */
  memberAccountIds?: readonly string[];
  /**
   * The subset of {@link TraeWebPool.memberAccountIds} that resolves to a real
   * local credential — i.e. what a batch actually runs on.
   *
   * Sent so the card never re-derives it. Counting the raw saved list is what
   * lets a UI claim "1 of 1 selected" and enable both buttons while the Host ran
   * on ZERO accounts and reported success.
   */
  effectiveMemberAccountIds?: readonly string[];
  /**
   * Last measured display name per saved member id, including members that have
   * since stopped resolving.
   *
   * A member whose sign-in disappeared would otherwise be listed as a bare id
   * and an unexplained count, and the user could not tell WHICH one they unchecked.
   */
  memberNames?: Record<string, string>;
  /** Rows in the Host's ranking order: candidates first, excluded rows last. */
  accounts: readonly TraeWebPoolAccount[];
  /**
   * Why the pool could not pick anybody, when it could not.
   *
   * Set when every member is excluded, so the card can explain that traffic is
   * going to the saved selection rather than leaving the user to assume the pool
   * is serving the top row.
   */
  noCandidate?: TraeWebPoolExclusion | 'empty';
}
/**
 * The pool's saved preferences for one panel, as stored in `regions[panel].pool`.
 *
 * Declared in the node-free bridge because BOTH halves touch it: the Host reads
 * it to decide membership and ranking, the card drafts and saves it. Keeping one
 * declaration is what stops the card from writing a field the Host ignores (or
 * vice versa) — the failure workbuddy hit when its client and Host each had a
 * private copy of this shape.
 *
 * Every field is optional because this is a user-edited draft: a partially filled
 * slot must still load, and a missing `enabled` means OFF rather than ON.
 */
interface TraePoolPreferences {
  /** Whether this panel bills through the pool at all. Default OFF. */
  enabled?: boolean;
  /**
   * The model a test batch probes. Absent or `''` means "automatic": pick the
   * free model (see `pickFreeModel` in `./account-pool.ts`). An id this panel no
   * longer offers is PRESERVED so the user's choice survives a catalog blip, and
   * reported as `stale` rather than silently replaced.
   */
  targetModelId?: string;
  /**
   * The accounts the user checked into this panel's pool, in the order they were
   * checked.
   *
   * Explicit opt-in with NO default: an account never joins the pool because it
   * exists. Order is only a display hint — the ranking is the Host's.
   *
   * A MUTABLE array, not `readonly`: this interface is also the shape the
   * settings schema declares (`z.array(z.string())`), and the schema rebuilds the
   * config document on every save — a readonly type there is a compile-time
   * mismatch that would take the whole Config schema down. Readers still treat it
   * as immutable; only the owner of a draft copies it.
   */
  memberAccountIds?: string[];
  /**
   * How much text a pool TEST sends, in tokens. `0` (the default) keeps the
   * minimal one-word probe.
   *
   * Exists because a verdict earned by a one-word request says nothing about the
   * long turn the user is about to send: an upstream that refuses large requests
   * answers the small one happily. Padding the probe therefore buys a truthful
   * "works at my size" answer at the cost of spending real credit per test.
   */
  probeInputTokens?: number;
}
/** Query parameter naming the region a card request addresses. */
declare const TRAE_REGION_PARAM = "region";
/** Every region, in card tab order. */
declare const TRAE_REGIONS: readonly TraeRegion[];
/**
 * Address one region's status route. The two regions are separate provider
 * stacks; every card request carries the region whose tab the user is on.
 */
declare function withTraeRegion(path: string, panel: TraePanel): string;
/**
 * Read the region parameter off a status-route URL. Absent means the domestic
 * tab (`cn`); a present-but-unknown value returns undefined so the route can
 * answer 400 instead of guessing.
 */
declare function regionOfTraeStatusUrl(url: string): TraePanel | undefined;
/** One credit pack and its remaining credit. */
interface TraeWebCreditAccount {
  displayDesc: string;
  remain: number;
  size: number;
  /**
   * When this pack lapses, in epoch milliseconds, taken from the upstream's own
   * `end_time`. Absent when the upstream reported no usable time (0 / missing),
   * so a consumer can tell "no date" apart from "1970".
   */
  expiresAtMs?: number;
  /**
   * Raw upstream `available_endpoint`: which bucket this pack lives in.
   *
   * Measured on the live response — `0` is the GENERAL bucket that SOLO chat
   * actually spends, `1` is the WORK bucket it cannot reach. The projection
   * dropped this field until the account pool needed it: the pool ranks accounts
   * by what they can SERVE, and credit lapsing in the WORK bucket is not a
   * reason to bill that account first, because nothing here can ever spend it.
   * Absent, not guessed, when the upstream omits it.
   */
  endpoint?: number;
}
/** Credit lapsing inside one horizon, as the card reports it. */
interface TraeWebExpiringCredits {
  /** Sum of the contributing packs' remaining credit. */
  total: number;
  /** How many packs contribute. */
  packs: number;
  /** Soonest expiry among them, epoch milliseconds. */
  earliestExpiresAtMs?: number;
}
/**
 * Credit at risk, bucketed by how soon it lapses.
 *
 * Only present when at least one pack carried a usable `expiresAtMs` — a card
 * must never read "we were not told when anything expires" as "nothing is
 * about to lapse".
 *
 * The three forward buckets are NESTED and CUMULATIVE: `within24h` ⊆
 * `within3d` ⊆ `within7d`, each counting every pack inside its own horizon.
 * So each bucket answers "how much lapses within N" and the copy states that
 * bucket's own figure — which is why ONE bucket's number is always true on
 * its own terms, and why the reader never has to add two figures together (the
 * notice shows exactly one tier at a time).
 */
interface TraeWebCreditExpiry {
  within24h: TraeWebExpiringCredits;
  within3d: TraeWebExpiringCredits;
  within7d: TraeWebExpiringCredits;
  /** Packs already past their end time but still carrying credit. */
  expired: TraeWebExpiringCredits;
}
/** Aggregated usage/credit answer rendered by the plugin card. */
interface TraeWebCredits {
  total: number;
  consumed: number;
  available: number;
  workAvailable: number;
  generalAvailable: number;
  accounts: readonly TraeWebCreditAccount[];
  /**
   * Credit lapsing soon, for the card's warning banner.
   *
   * Derived from the per-pack {@link TraeWebCreditAccount.expiresAtMs} the
   * `/usage` route already carries, so it costs no extra upstream read.
   */
  expiry?: TraeWebCreditExpiry;
}
/** Editable Trae model row rendered by the plugin-owned settings card. */
interface TraeWebModel {
  id: string;
  name: string;
  contextWindow?: number;
  maxTokens?: number;
  input?: ('text' | 'image')[];
  creditMultiplier?: number;
  reasoningSupported?: boolean;
  reasoning?: {
    supported: string[];
    defaultEffort?: string;
  };
  maxContextWindow?: number;
  /**
   * The directory function this row is called through, and the `config_name`
   * that function accepts (issue #52).
   *
   * Carried on the wire document because it is the ONLY thing that explains the
   * catalog's shape to the person looking at it: the plugin serves the union of
   * a dozen Trae channels, so 34 rows are 34 rows only until they are grouped by
   * the channel each one will actually run on. Absent on rows the merge could
   * not attribute (those fall back to the default chat function) and on catalogs
   * saved before these fields existed.
   */
  wireFunction?: string;
  wireConfigName?: string;
  /**
   * Trae's own image-capability flag, as the runtime catalog carries it. The
   * card renders these rows with their image checkbox already ticked so the
   * control matches what DSH is actually told (issue #16); absent means the
   * directory did not declare it, which is not a capability claim either way.
   */
  multimodal?: boolean;
  /**
   * The availability verdict from the one-click test, when this card session
   * has run one. Absent = not tested. Deliberately NOT persisted with the
   * settings: it describes one moment on one account, and a stale verdict shown
   * as current is worse than a blank field.
   */
  probe?: TraeModelProbeVerdict;
  /** Upstream's own words for the verdict, when it gave any. */
  probeDetail?: string;
  /**
   * Trae's discount rule for this row, straight from the directory that
   * advertised it (see src/promo.ts). The CARD decides whether it is live right
   * now: the rule carries weekday/time windows in an upstream-declared zone, so
   * a verdict baked in here would be stale by the next morning.
   */
  activityDiscount?: TraeActivityDiscount;
}
/**
 * One model's availability verdict from the one-click test.
 *
 * `unknown` is a first-class outcome, not a failure: a timeout, a proxy drop or
 * a throttle says nothing about the model, and reporting it as unusable would
 * make the user delete a model that works. Only an upstream refusal is negative.
 */
type TraeModelProbeVerdict = 'available' | 'gated' | 'unsupported' | 'rate_limited' | 'auth' | 'unknown';
/** What the probe route answers with. */
interface TraeModelsTestResponse {
  /** One entry per model tested, in the order they were sent. */
  results: {
    id: string;
    verdict: TraeModelProbeVerdict;
    detail: string;
  }[];
  /** Models skipped because the region has no live catalog row for them. */
  skipped?: string[];
}
/**
 * Daily check-in state rendered below the credit stats.
 *
 * The two booleans answer DIFFERENT questions and must never be collapsed into
 * one "done" flag — doing that was a shipped bug (see CHANGELOG 2.3.1):
 *
 *  - `checkedIn` is ACCOUNT-level: today's reward pack exists for this account,
 *    so there is nothing left to claim and the balance already includes it.
 *  - `didCheckedIn` is DEVICE-level: this MACHINE already spent its one
 *    check-in for the day, whichever account spent it. The upstream keys it on
 *    the `x-device-id` in the request and answers it per device, not per
 *    account (measured 2026-09-26: the same account and Beijing day answered
 *    `false` with the header omitted, with a synthetic id, and with another
 *    install's id, and `true` for the device that actually claimed).
 *
 * So `didCheckedIn && !checkedIn` is the "switched account" case: the device's
 * daily check-in is used up, but THIS account was never rewarded. Claiming
 * again is refused upstream (business code 9095, "该设备今日已参与签到"), so
 * the card disables the button — but it must say that, not "claimed today".
 */
interface TraeWebCheckin {
  checkedIn: boolean;
  didCheckedIn: boolean;
  credits: number;
  enabled: boolean;
  extraCredits?: number;
}
/** The claim route's answer, so the card can report a business refusal verbatim. */
interface TraeWebCheckinClaim {
  /** False when the upstream answered a non-zero business code (e.g. 9004). */
  claimed: boolean;
  /**
   * True only when THIS ACCOUNT's reward for today already exists, so nothing
   * was sent upstream. Distinct from {@link TraeWebCheckinClaim.deviceCheckedIn}:
   * a device that already claimed for another account leaves this false.
   */
  alreadyCheckedIn: boolean;
  /**
   * True when today's check-in was already spent on this DEVICE (by this or
   * another account), so no claim was sent or the upstream refused it with
   * 9095. Not an error: it is the truthful answer to "can this account claim
   * here today?" — no, and the reason is the machine, not the account.
   */
  deviceCheckedIn?: boolean;
  code?: number;
  message?: string;
  /** The refreshed check-in state, present whenever the claim path ran. */
  checkin?: TraeWebCheckin;
}
/** One reward activity rule (name + work/general credits when present). */
interface TraeWebActivity {
  activityId: string;
  enabled: boolean;
  workCredits?: number;
  generalCredits?: number;
}
interface TraeWebAccount {
  id: string;
  accountName: string;
  edition: 'cn' | 'sg' | 'solo' | 'solo-sg';
  /**
   * Whether this account belongs to a Trae tenant, i.e. may bill the enterprise
   * pool. The enterprise tab lists only these, because the tenant gateway
   * serves a directory to any CN token but refuses a personal account's chat
   * with `4019` — so nothing else reveals the difference until a turn fails.
   */
  enterprise: boolean;
  /** Routing bucket of this account, derived from its credential. */
  region: TraeRegion;
  source: 'desktop' | 'dsh' | 'cli';
  tokenExpiresAtMs: number;
  /**
   * When this account's REFRESH token expires, when the credential carries one.
   *
   * The access token above is renewed automatically — the plugin refreshes it
   * five minutes before it lapses — so by itself it answers "when does this
   * need attention", which is "never, while the refresh token lives". The
   * refresh token is the real horizon: once IT expires the automatic renewal
   * stops working and the user must sign in to Trae again. Before this field the
   * card could only say "auto-renewal", which stays true right up to the moment
   * it silently stops being true.
   */
  refreshExpiresAtMs?: number;
  selected: boolean;
}
/**
 * The per-account state shown inside an account row of the card's table.
 *
 * Every locally detected account in a region is rendered as a row; the
 * interesting per-account facts differ by region, which is why this is a union
 * of the three surfaces the card previously showed only for the BOUND account:
 *
 *  - CN rows carry their own check-in state (Trae keys the daily reward per
 *    ACCOUNT, and the one-per-device tally per DEVICE, see {@link TraeWebCheckin})
 *    and their Work/General balances.
 *  - ai rows carry their own subscription / trial status.
 *
 * Each field is optional: a read that fails keeps the row visible (perhaps
 * without a figure) rather than dropping the account and its switch.
 */
interface TraeWebAccountState {
  /** The account this state belongs to. */
  id: string;
  /** CN: today's check-in state of this account (absent for ai rows). */
  checkin?: TraeWebCheckin;
  /** CN: this account's Work/General balances (absent for ai rows). */
  credits?: TraeWebCredits;
  /** ai: this account's subscription / trial status (absent for CN rows). */
  payStatus?: TraeWebPayStatus;
}
interface TraeWebCreditAlternative {
  id: string;
  accountName: string;
  edition: TraeWebAccount['edition'];
  workAvailable: number;
  generalAvailable: number;
}
/** One probed candidate path and why it did not yield an account. */
interface TraeWebSearchPath {
  path: string;
  edition: 'cn' | 'sg' | 'solo' | 'solo-sg';
  source: 'desktop' | 'cli';
  reason: 'missing' | 'unreadable' | 'invalid';
  message?: string;
}
/**
 * A plugin-owned credential copy that was found unreadable and moved aside.
 *
 * Since 4.4.6 such a copy is quarantined (renamed aside, bytes intact)
 * instead of being merged over, because merging over it would erase every
 * account it carried. The copy then exists ONLY in that quarantine file — so
 * the card says so, instead of the user discovering it by noticing accounts
 * missing (issue #56).
 *
 * Only facts about the plugin's own file cross to the browser: its path, the
 * size of the quarantine copy, and how many accounts it still shows. No token
 * material, and no path outside DSH's own home.
 */
interface TraeWebQuarantine {
  /** The live path the copy had before it was moved aside. */
  file: string;
  /** The quarantine copy's path; its name carries the moment it was taken. */
  quarantinedAs: string;
  /** Size of the quarantined copy in bytes (`0` when it could not be read). */
  bytes: number;
  /** Accounts the copy still shows, when it could be read as JSON. */
  accounts?: number;
}
/**
 * Peel ONE `{get(): T}` live reference, the shape DSH 0.1.7 delivers a
 * volatile-marked settings field as (see {@link unwrapVolatileDeep}).
 */
declare function unwrapVolatile<T>(value: T): T;
/**
 * Deep copy of a value with every `{get(): T}` live reference replaced by the
 * value it resolves to.
 *
 * DSH 0.1.7 hands volatile-marked fields back as live references, and a live
 * reference is still `typeof === 'object'` — so it passes a naive object check
 * and every lookup on it is `undefined`. Worse, spreading one (`{ ...ref }`)
 * does NOT read the field: it produces `{ get: <function> }`. Any merge that
 * spreads a resolved field to preserve its siblings — the card's "write one
 * region, keep the other" write, or the account map's spread — would otherwise
 * DROP every sibling and leak a function into the document.
 *
 * Both halves therefore unwrap before touching a resolved field. This lives in
 * the node-free host↔client bridge because the browser half needs it too.
 *
 * Non-reference values are recursed into so a nested volatile field is caught
 * as well; arrays and objects are rebuilt rather than mutated, so the caller's
 * value is never touched.
 */
declare function unwrapVolatileDeep<T>(value: T): T;
/**
 * Read the per-region account selections out of a settings value.
 *
 * SHARED because `accounts` now has TWO writers: the card, and the composer
 * panel's account table (2.14.0). Two writers of one field must use one merge
 * rule, or they drift — and the rule is not obvious.
 *
 * Deep-unwraps first: on DSH 0.1.7 a volatile field arrives as a `{get(): T}`
 * live reference, which passes the `typeof === 'object'` check and would be
 * returned as if it were the map. Every lookup on it is then `undefined`, and
 * the merge (`{ ...configured, [region]: id }`) would spread a reference into
 * `{get: <function>}` — dropping the other region's selection and leaking a
 * function into the settings document.
 */
declare function configuredAccountsOf(configured: unknown): Record<string, string>;
/**
 * Build the next `regions` settings value for the card's save. The write
 * targets ONLY the signed-in account's region slot; every other region's slot
 * is carried over untouched, so switching accounts never clobbers the other
 * region's picks. Tolerates any stored shape (absent, non-object) by starting
 * from an empty document.
 */
declare function nextRegionSlots<Slot extends object>(regions: unknown, panel: TraePanel, slot: Slot): Record<string, unknown>;
/**
 * Whether one region's provider is switched on. Opt-out semantics: only an
 * explicit `false` disables it, so a config written before this switch existed
 * (and the pre-region-split flat fields, which never carry `enabled`) keep both
 * providers running exactly as before. The Host reads the same rule through
 * `regionStateOf`, so card and Host can never disagree about a region's state.
 *
 * `value` may be the whole settings section or the `regions` map (see
 * {@link regionsMapOf}).
 */
declare function regionEnabledOf(value: unknown, panel: TraePanel): boolean;
/**
 * Build the next `regions` settings value for a provider on/off toggle. ONLY
 * the target region's `enabled` flag changes: every other field of that slot
 * (its directory, selection, image opt-ins, context budgets) and every other
 * region's slot are carried over verbatim, so switching a provider off never
 * discards the user's model picks and switching it back on restores them.
 *
 * This is deliberately separate from {@link nextRegionSlots}: that helper
 * writes a whole slot from a signed-in tab's draft, while this one must work
 * for a region that is signed OUT — which is precisely the region a user wants
 * to switch off (no international install, no international account).
 *
 * `value` may be the whole settings section or the `regions` map; the RETURN
 * value is always the `regions` map, i.e. exactly what `settingsScope.set(
 * 'regions', ...)` needs.
 */
declare function nextRegionEnabled(value: unknown, panel: TraePanel, enabled: boolean): Record<string, unknown>;
/**
 * The two seats this region's credit readout can occupy.
 *
 * `composer` is the composer row (`conversation.input.right`, rendered just before
 * the model picker); `stats` is
 * the ambient dock below the composer card (`conversation.composer.dock`),
 * beside the shell's own round/step/token pills.
 *
 * WHY THE SEAT IS A CHOICE AT ALL (learned from dsh-connect-workbuddy issue
 * #62): the composer tool row is a LIST seat, so it is shared not only with the
 * shell's own controls but with any other plugin that registers there — and a
 * list seat cannot promise that every occupant is visible. The report behind
 * that issue is exactly that: with a third-party plugin installed the readout
 * stopped appearing. A fixed seat therefore lets one plugin's presence decide
 * another's, so the seat belongs to the user.
 *
 * Named as a union rather than a boolean because a third seat is plausible and
 * a `showAtTop: boolean` would have to be MIGRATED rather than extended.
 */
type TraeCreditPosition = 'composer' | 'stats';
/**
 * Which seat one region's readout uses, defaulting to the composer row.
 *
 * Anything other than an explicit `'stats'` reads as `'composer'`, which covers
 * the two cases that matter: a profile written BEFORE this setting existed (the
 * composer row was the only seat, so an upgrade moves nothing on screen), and a
 * hand-edited value the schema does not know. Falling back rather than
 * rendering nowhere is deliberate — an unrecognized value must not make the
 * readout disappear, which is the very defect this setting exists to fix.
 *
 * `value` may be the whole settings section or the `regions` map (see
 * {@link regionsMapOf}).
 */
declare function regionCreditPositionOf(value: unknown, panel: TraePanel): TraeCreditPosition;
/**
 * Build the next `regions` settings value for one region's credit seat.
 *
 * Same merge rule as every sibling region write: only the target region's
 * `creditPosition` changes, so a seat change cannot drop that slot's model
 * directory, selection, budgets or enabled flag, nor touch the other region.
 *
 * `value` may be the whole settings section or the `regions` map; the RETURN
 * value is always the `regions` map, i.e. exactly what `settingsScope.set(
 * 'regions', ...)` needs.
 */
declare function nextRegionCreditPosition(value: unknown, panel: TraePanel, position: TraeCreditPosition): Record<string, unknown>;
/** Subscription status of an international (ai) account, rendered instead of the CN credit packs. */
interface TraeWebPayStatus {
  isDollarUsageBilling: boolean;
  hasPackage: boolean;
  isPayFreshman: boolean;
  inTrial: boolean;
  trialEndTimeMs: number;
  enableSoloLite: boolean;
  enableSoloBuilder: boolean;
  enableSoloCoder: boolean;
  enableSoloWeb: boolean;
  /** Trae's authoritative tier number (`user_pay_identity`); `0` means Free. */
  payIdentity?: number;
  /** Trae's authoritative tier label (`user_pay_identity_str`), e.g. `Free`. */
  payIdentityStr?: string;
  fission?: {
    startTimeMs: number;
    expireTimeMs: number;
    maxUsage: number;
  };
}
/**
 * A credential on this machine that names a region this build cannot serve yet
 * (issue #66: the US cluster).
 *
 * Carried on BOTH shapes: the panel that shows it is normally signed OUT —
 * the credential is deliberately excluded from billing — so the signed-out
 * document is the only place the user can learn that a real sign-in is sitting
 * on disk and why it is not being used.
 */
interface TraeWebUnsupportedRegion {
  region: 'us';
  /** Display names of the credentials carrying that claim; never token material. */
  accounts: readonly string[];
}
/** The JSON document the plugin card renders. */
type TraeWebUsage = {
  status: 'signed-out';
  accounts: readonly TraeWebAccount[];
  message?: string;
  searched?: readonly TraeWebSearchPath[];
  /**
   * Copies that were found unreadable and moved aside. Present on BOTH
   * shapes on purpose: the signed-out screen is exactly where a user lands
   * after a lost copy, so that is where the notice has to be.
   */
  quarantined?: readonly TraeWebQuarantine[];
  /** A recognized-but-unserved region on this machine (issue #66). */
  unsupportedRegion?: TraeWebUnsupportedRegion;
  enabled?: boolean;
} | {
  status: 'signed-in';
  accountId: string;
  accountName: string;
  tokenExpiresAtMs: number;
  /**
   * When the BOUND account's refresh token expires (absent when the credential
   * carries none). See {@link TraeWebAccount.refreshExpiresAtMs} — this is the
   * horizon that actually matters, because the access token above renews
   * itself until this one lapses.
   */
  refreshExpiresAtMs?: number;
  /** Which per-region model directory and selection this account owns. */
  region: TraeRegion;
  /** Whether this region's provider is currently offered to DSH. */
  enabled?: boolean;
  accounts: readonly TraeWebAccount[];
  models: readonly TraeWebModel[];
  enabledModelIds: readonly string[];
  /**
   * Copies that were found unreadable and moved aside. Present on BOTH
   * shapes on purpose: the signed-out screen is exactly where a user lands
   * after a lost copy, so that is where the notice has to be.
   */
  quarantined?: readonly TraeWebQuarantine[];
  rawChat?: {
    state: 'disabled' | 'unchecked' | 'available' | 'protocol-gated' | 'authentication' | 'credit' | 'rate' | 'transport' | 'server';
    checkedAtMs?: number;
    status?: number;
  };
  credits?: TraeWebCredits;
  creditsError?: string;
  /**
   * Set when this panel has no readable balance by design, rather than by
   * failure. Only `enterprise` does: a tenant's spend is not reported by any
   * endpoint the plugin can reach (every tenant quota path answers 404), so
   * the figure exists solely in the enterprise console. The card must say so
   * instead of rendering the consumer packs, which belong to the personal
   * balance and would be read as the tenant's.
   */
  creditsUnavailable?: 'enterprise';
  /**
   * Present only when the bound account is out of credit AND another account
   * on this machine has some (issue #25). The card then offers a one-click
   * switch instead of leaving a permanently empty panel. Absent in every
   * other case so a healthy account never pays for the extra read.
   */
  alternatives?: readonly TraeWebCreditAlternative[];
  /**
   * Daily check-in state (CN only). Absent on the international region,
   * whose check-in surface does not exist — probed 2026-09-24: the
   * `/trae/api/v2/ug/*` family answers 404 on every ai gateway, so the card
   * shows no claim button there rather than a button that cannot work.
   */
  checkin?: TraeWebCheckin;
  checkinError?: string;
  /** Subscription status of an international account (region ai only). */
  payStatus?: TraeWebPayStatus;
  payStatusError?: string;
  /**
   * A recognized-but-unserved region on this machine (issue #66). Present
   * alongside a working account when the machine also holds e.g. a US
   * login — that account is not billed, but the panel still says so.
   */
  unsupportedRegion?: TraeWebUnsupportedRegion;
  /**
   * This panel's account-pool state, when the Host build supports it.
   *
   * Absent on a Host without pool support, so the card renders no pool section
   * instead of an empty one. Assembled LAST in the status document and never
   * allowed to fail it: the pool reads per-account credit, and one dead account
   * must not blank out the panel the user is looking at.
   */
  pool?: TraeWebPool;
} | {
  status: 'error';
  message: string;
};
//#endregion
//#region src/pi-ai-runtime.d.ts
/**
 * Which `@earendil-works/pi-ai` copy THIS plugin resolves at runtime, and which
 * context shape that copy consumes (issue #27).
 *
 * WHY THIS EXISTS. The plugin declares pi-ai as a peer, so the module it
 * imports is whatever the install provides — and the two generations consume
 * DIFFERENT context shapes:
 *
 * - **modern** (0.86+): every public entry point calls `normalizeContext()`
 *   once, so what reaches a provider is a normalized *transcript*:
 *   `{ messages: [ { role: 'system', content, toolsAdded }, … ] }`. The system
 *   prompt and the tool declarations live ONLY on that leading system message;
 *   the top-level `systemPrompt` / `tools` fields are gone, and the api never
 *   reads them back.
 * - **legacy** (≤0.85): expects `{ systemPrompt, tools, messages }` and has no
 *   branch for a `system` message inside `messages` at all. Its token estimator
 *   crashes on one — `estimateMessageTokens` iterates the string `content`
 *   character by character and reads `.name` off a character — and its wire
 *   converter silently drops it.
 *
 * The mismatch is reachable in BOTH directions, because DSH itself spans both
 * generations (`dsh-llm-pi-ai` ≤0.2.0-rc.1 declares `^0.85.1`; 0.2.0-rc.2 and
 * later declare `^0.87.1`, 0.2.1-alpha.2 declares `^1.0.2`, and 0.2.1-rc.1 —
 * the current desktop host — declares **`^1.1.0`**, which also stopped reading
 * the top-level fields entirely), while this plugin accepts the whole range
 * (`>=0.1.7-rc.1 <0.3.0-0`). Whichever side is newer, the other one is wrong:
 *
 * | host | resolved api | outcome |
 * |---|---|---|
 * | legacy | legacy | fine |
 * | legacy | modern | no crash, but prompt + tools silently LOST |
 * | modern | legacy | CRASH: `Cannot read properties of undefined (reading 'length')` |
 * | modern | modern | fine |
 *
 * THE BOUNDARY IS 0.86, NOT 0.87. Checked against the published tarballs:
 * `dist/utils/transcript.js` — and with it `normalizeContext`, the
 * `role === 'system'` estimator branch, and the switch away from reading
 * `systemPrompt`/`tools` — first appears in **0.86.0**. A `>= 0.87` gate
 * misclassifies 0.86.x as legacy and folds a context the modern api consumes
 * natively, which deletes the only carrier of the prompt and the tools.
 *
 * HOW the generation is decided, in order:
 *
 * 1. **The manifest version** of the copy this plugin resolved. Numeric semver
 *    comparison (`minor >= 86`), so `0.86.0` and the already-shipped `1.x` line
 *    both land on modern, and `0.9.0` correctly sorts below `0.86.0`.
 * 2. **The package's own layout**, when no version could be read: the transcript
 *    module sits at `dist/utils/transcript.js` (the exports map's
 *    `"./utils/*" → "./dist/utils/*.js"` convention is identical in every
 *    published generation, 0.82 through 1.x).
 *
 * Both checks are deliberately resolver-independent. `import.meta.resolve()` is
 * NOT used to answer this question: bundler-style resolvers (vite, and equally
 * `vitest` under it) expand the `"./utils/*"` wildcard to a path and return it
 * WITHOUT checking that the file exists, so a probe built on it answers "modern"
 * for 0.85.1 — the exact false positive that would leave issue #27 unfixed while
 * claiming to be capability-based. Reading the package directory cannot be
 * fooled that way.
 *
 * The version is therefore the primary signal, and it also keeps the gate
 * forward-compatible for free: a future 2.x needs no change here, whereas a
 * file-name check alone would have to know about it.
 *
 * @module dsh-connect-trae/pi-ai-runtime
 */
/** The context generation a resolved pi-ai api module speaks. */
type PiAiGeneration = 'legacy' | 'modern';
/** What {@link piAiRuntimeInfo} reports about the resolved pi-ai copy. */
interface PiAiRuntimeInfo {
  /** `modern` (0.86+: consumes normalized transcripts) or `legacy` (≤0.85 shape). */
  generation: PiAiGeneration;
  /** Version of the resolved copy, when the manifest could be read. */
  version: string | undefined;
  /** Package directory of the resolved copy, when it could be located. */
  resolvedFrom: string | undefined;
  /**
   * Whether the copy could be inspected at all. `false` means pi-ai does not
   * resolve from this plugin — the normal state of a market install probed
   * OUTSIDE the DSH host, where the host supplies the module at plugin runtime.
   * Inside DSH the copy is always inspectable: a nested one shadows host
   * injection, and without a nested one the host supplies its own.
   */
  inspected: boolean;
}
/** Resolve (once) which pi-ai copy this plugin runs against. */
declare function piAiRuntimeInfo(): PiAiRuntimeInfo;
/**
 * The generation decision table, exported so every branch is pinned by tests
 * rather than by a comment here — including the two this development tree can
 * never reach (no local copy, and a copy with no readable version), which are
 * exactly the states a market install founds its gate on.
 *
 * @param version - manifest version of the resolved copy, if readable.
 * @param transcriptPresent - whether that copy actually ships
 *   `dist/utils/transcript.js`; `undefined` when nothing was inspected.
 */
declare function decidePiAiGeneration(version: string | undefined, transcriptPresent: boolean | undefined): PiAiGeneration;
/**
 * The generation a version string belongs to, or `undefined` when the string
 * cannot be read as a version at all.
 *
 * Only the minor of the `0.x` line matters for the boundary, and `major >= 1`
 * is modern by definition (1.0.x is already in use by `dsh-llm-pi-ai@0.2.1-alpha.2`
 * and consumes transcripts natively).
 */
declare function generationOf(version: string | undefined): PiAiGeneration | undefined;
//#endregion
//#region src/upstream.d.ts
type TraeUpstreamErrorKind = 'authentication' | 'hard_credit' | 'soft_rate' | 'not_found' | 'server' | 'client' | 'unconfigured';
type TraeChatResult = {
  ok: true;
  response: Response;
} | {
  ok: false;
  status: number;
  kind: TraeUpstreamErrorKind;
  message: string;
};
interface TraeUpstreamClient {
  chatStream(bodyJson: string, signal?: AbortSignal): Promise<TraeChatResult>;
}
/**
 * Safe first-stage upstream. Real Trae traffic stays disabled until one
 * edition-specific endpoint and wire codec are verified with fixtures.
 */
declare class UnconfiguredTraeUpstreamClient implements TraeUpstreamClient {
  chatStream(_bodyJson: string, _signal?: AbortSignal): Promise<TraeChatResult>;
}
//#endregion
//#region src/shim.d.ts
interface ShimLogger {
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}
interface TraeShim {
  ready: Promise<void>;
  baseUrl(): string;
  token(): string;
  /** Bearer secret of one named route (defaults to the first route). */
  tokenOf(label?: string): string;
  close(): Promise<void>;
}
/** One bearer-authenticated chat route served by the shim. */
interface TraeShimRoute {
  /** Stable label used to look the route's secret up (`solo` | `enterprise`). */
  label: string;
  client: TraeUpstreamClient;
  /**
   * Account-pool hooks for this route (issue #44). Absent means "one fixed
   * account, no rotation and no failover" — the behaviour before the pool
   * existed, and still the behaviour when the pool is switched off.
   */
  pool?: TraeShimPool;
}
/**
 * What an account pool tells the shim around one chat attempt.
 *
 * The shim owns the HTTP surface and the pool owns "who bills", so the two meet
 * here: the pool may re-point the next request, hand back a client for a
 * different account after a failure, and hear about failures that only a real
 * request — not a probe — can produce.
 *
 * Every method must resolve rather than throw: a pool failure must never turn a
 * chat request into a 500 when a plain answer was possible.
 */
interface TraeShimPool {
  /**
   * Choose the account for this request and report which one it is. Called once,
   * before the first attempt; `undefined` means "the pool chose nobody", which
   * leaves the route's own client to bill the bound account.
   */
  prepare(): Promise<string | undefined>;
  /**
   * The client for the next account worth trying after the current one failed,
   * or `undefined` when the pool has nothing left to try.
   *
   * The returned client must be bound to that account's OWN credential:
   * failing over is not a rebind, so it must not move the account the user
   * selected (the same rule per-account probes already follow).
   */
  next(tried: readonly string[]): Promise<{
    accountId: string;
    client: TraeUpstreamClient;
  } | undefined>;
  /** Record a real request's failure against the account that hit it. */
  failed(accountId: string, kind: TraeUpstreamErrorKind, message: string): Promise<void>;
  /** One clause naming why no other account can serve, for the error text. */
  shortfall(tried: readonly string[]): Promise<string | undefined>;
}
interface TraeShimOptions {
  catalog: TraeCatalog;
  /**
   * Single-route form, kept for the existing call sites and tests.
   *
   * A shim serves exactly as many chat routes as the region publishes provider
   * ids, and they must not be interchangeable: the consumer and enterprise
   * pools bill different accounts, so the route is chosen by the bearer token
   * the adapter was built with, and an unknown token is rejected rather than
   * defaulting to "some" pool.
   */
  client?: TraeUpstreamClient;
  routes?: readonly TraeShimRoute[];
  logger?: ShimLogger;
}
declare function createTraeShim(options: TraeShimOptions): TraeShim;
//#endregion
//#region src/adapter.d.ts
/** Provider route this bundle owns for the domestic (CN) gateway. */
declare const TRAE_PROVIDER = "trae";
/**
 * Provider route this bundle owns for the CN **enterprise (tenant)** gateway.
 *
 * A separate provider id, not a mode switch, because the two pools bill
 * differently: a tenant account (`tob_online`) is served by BOTH gateways with
 * the SAME credential, and only the enterprise one draws on the enterprise
 * pool. Exposing one id would force a per-call guess about who pays.
 *
 * It never falls back to the consumer pool: picking this provider is the user
 * saying "bill the tenant", so a refusal is reported as an error instead of
 * being silently re-run against the personal quota.
 */
declare const TRAE_ENTERPRISE_PROVIDER = "trae-enterprise";
/**
 * Provider route this bundle owns for the international (trae.ai) gateway.
 * Named `-global` to match the plugin family's convention (`workbuddy-global`);
 * the internal region bucket stays `ai`, which is the gateway/protocol name.
 */
declare const TRAE_AI_PROVIDER = "trae-global";
/** The provider ids one region publishes, in model-picker order. */
declare const TRAE_PROVIDER_IDS: Readonly<Record<TraeRegion, readonly string[]>>;
/** Each region's default (first) provider id. */
declare const TRAE_PROVIDERS: Readonly<Record<TraeRegion, string>>;
/**
 * Which chat pool a provider bills against.
 *
 * `trae` and `trae-global` keep the behaviour they always had (the consumer
 * SOLO pool); `trae-enterprise` is the only id that reaches the tenant gateway.
 */
type TraeProviderRoute = 'solo' | 'enterprise';
declare const TRAE_PROVIDER_ROUTES: Readonly<Record<string, TraeProviderRoute>>;
/** Chat pool a provider id bills against; `undefined` for an unknown id. */
declare function routeOfTraeProvider(provider: string): TraeProviderRoute | undefined;
/** Human-readable provider names, shown in the DSH model picker. */
declare const TRAE_PROVIDER_DISPLAY_NAMES: Readonly<Record<TraeRegion, string>>;
/** Display name per provider id (the region table above only names the default). */
declare const TRAE_PROVIDER_ID_DISPLAY_NAMES: Readonly<Record<string, string>>;
/** Display name of a provider id. */
declare function displayNameOfTraeProvider(provider: string): string;
/** Region a provider route id belongs to. */
declare function regionOfTraeProvider(provider: string): TraeRegion | undefined;
declare const TRAE_STREAM_IDLE_TIMEOUT_MS = 300000;
/**
 * Fold a NORMALIZED transcript back into the `{ systemPrompt, tools, messages }`
 * shape a LEGACY (≤0.85) api consumes — issue #27's crash and its two silent
 * siblings.
 *
 * WHY (issue #27). 0.86+ normalizes at every public entry point, and DSH's host
 * calls `Models.streamSimple()`, so on a modern host the context arriving here
 * ALWAYS carries its prompt and its tool declarations on a leading system
 * message — the top-level fields are gone. A legacy api has no branch for that
 * message: `estimateMessageTokens` iterates the string `content` character by
 * character and reads `.name` off a character, throwing
 * `Cannot read properties of undefined (reading 'length')` before the request
 * is even built. That is what surfaced as `PI_AI_ERROR` with all-zero usage.
 *
 * The fold must carry MORE than the prompt. `toolsAdded` is the ONLY remaining
 * carrier of the tool declarations once `normalizeContext` has run, and a
 * legacy api reads tools exclusively from `context.tools` — so lifting the text
 * alone would trade a loud crash for a silent one: a model that can never emit
 * a `toolCall` because the request declared no tools.
 *
 * Shape-guarded, not version-guarded: it asks "is there a system message inside
 * `messages`?" rather than "which pi-ai is loaded?". A version test would be
 * wrong the moment either side moves, and this predicate is an identity for the
 * legacy shape, so the ordinary path stays byte-for-byte untouched. WHICH
 * branch runs at all IS generation-gated — see {@link withContextAdaptation}.
 *
 * Returns the SAME object when there is nothing to fold, so a legacy host
 * (which never normalizes) pays one `Array.some` and nothing else.
 */
declare function adaptLegacyPiAiContext(context: Context): Context;
/**
 * Lift the legacy `{ systemPrompt, tools, messages }` shape into the normalized
 * transcript a MODERN (0.86+) api consumes — the reverse mismatch, and just as
 * silent.
 *
 * WHY. DSH spans both generations (`dsh-llm-pi-ai` ≤0.2.0-rc.1 pins `^0.85.1`,
 * while the 0.2.1-rc.1 desktop host pins `^1.1.0` and still emits the legacy
 * envelope from its own `piContext()`)
 * while this plugin may resolve a newer copy than its host. A LEGACY host never
 * normalizes, so it hands the api the legacy shape; a modern api reads the
 * prompt from a leading system message and the tools from its `toolsAdded`, and
 * never looks at the top-level fields — so both are dropped without a sound.
 * Verified against the published tarballs: the request that reaches the wire
 * carries no system turn and `tools: []`. This is exactly the shape that
 * `dsh-llm-pi-ai@0.2.1-rc.1` + `pi-ai@1.1.0` would hit unaided, which is why
 * the wire-level matrix in `tests/pi-ai-context.spec.ts` pins both directions.
 *
 * Identity for anything already in transcript shape, and for a context with
 * neither a prompt nor tools (pi-ai's own `createInitialSystemMessage` returns
 * `undefined` there, keeping an empty transcript empty).
 */
declare function adaptModernPiAiContext(context: Context): Context;
/**
 * Wrap one pi-ai API module so BOTH stream entry points receive a context its
 * own generation can consume.
 *
 * The gate is the copy THIS plugin resolved (see {@link piAiRuntimeInfo}) —
 * what the host runs says nothing about it, because a nested copy on disk
 * shadows host injection and vice versa. The wrapping is cheap and lazy: only
 * `stream`/`streamSimple` are intercepted, the deferred-fetch entry points take
 * no context and are passed through untouched, and each adapter function is an
 * identity unless the context is actually the other generation's shape. So a
 * healthy install does one `Array.some` per request.
 *
 * THE CAST IS THE CONTRACT (pi-ai 1.1.0). From 1.1.0 `ProviderStreams` takes
 * `TranscriptContext`, a BRANDED type whose `unique symbol` member only
 * `normalizeContext()` can produce — so a `Context` is no longer assignable and
 * `tsc` reports `TS2345` at both call sites below. The brand cannot be acquired
 * honestly here, for two reasons that are both deliberate:
 *
 * 1. This wrapper sits BELOW the normalizer. `Models.stream()`/`streamSimple()`
 *    call `normalizeContext()` and hand a real transcript to the provider;
 *    `createProvider()` passes it straight through to `api.stream`. So on the
 *    modern path `adapt()` is an identity and the value already IS a branded
 *    transcript at runtime — the type just cannot see it across that boundary.
 * 2. The legacy path REQUIRES an unbranded shape. pi-ai ≤0.85 has no
 *    `normalizeContext` and no transcript type at all, so its api expects
 *    exactly the `{ systemPrompt, tools, messages }` object `adapt()` returns.
 *
 * So the value handed to `api` is "a context of the generation that api
 * speaks", which no single edition's declared type names. Casting at this one
 * boundary is what makes both generations expressible; deriving the type from
 * the resolved copy instead would make the wrapper uncompilable against the
 * other generation, which is the whole point of having it.
 */
declare function withContextAdaptation(api: ProviderStreams, generation: PiAiGeneration): ProviderStreams;
interface TraeAdapterOptions {
  shim: TraeShim;
  catalog: TraeCatalog;
  /** Provider route id this instance serves; defaults to the CN route. */
  provider?: string;
  /** pi-ai provider name and profile display name; defaults to the CN name. */
  displayName?: string;
  /**
   * Bearer secret this provider presents to the shim.
   *
   * A region can publish more than one provider (consumer + enterprise), and
   * the shim picks the billing pool from that bearer. Defaults to the shim's
   * first route, which keeps the single-provider case unchanged.
   */
  secret?: string;
  resolveAttachments?: () => AttachmentStore | undefined;
  /**
   * Override the resolved pi-ai generation (see {@link withContextAdaptation});
   * tests use it to exercise the combination this machine does not have
   * installed.
   */
  piAiGeneration?: PiAiGeneration;
}
interface TraeAdapter {
  adapter: PiAiAdapter;
  invalidate(): void;
}
declare function createTraeAdapter(options: TraeAdapterOptions): TraeAdapter;
//#endregion
//#region src/trae-process.d.ts
/** Which editions' Electron apps are currently running, best effort. */
type RunningProbe = () => Promise<ReadonlySet<TraeEdition>>;
//#endregion
//#region src/auth.d.ts
interface TraeCredential {
  accessToken: string;
  refreshToken?: string;
  userId: string;
  accountName?: string;
  /**
   * Trae tenant this account belongs to (`account.tenant_id`, e.g. `272193024`
   * for a `tob_online` enterprise), absent for a personal account.
   *
   * This is what decides whether the ENTERPRISE pool can serve the account at
   * all. The tenant gateway accepts any CN token for its DIRECTORY read — a
   * personal account gets the full 49-model roster back — so "the roster
   * loaded" proves nothing about billing rights. Its chat endpoint is what
   * refuses: a personal account answers `4019` (risk control), a tenant account
   * streams normally. Because the two are indistinguishable from the roster,
   * the account list itself has to carry the flag.
   */
  tenantId?: string;
  host: string;
  /**
   * Region claim from the decrypted storage document (`userRegion.region`,
   * 'CN' | 'SG', possibly lowercase). Drives the routing bucket together with
   * `host`; see `regionOfCredential`.
   */
  userRegion?: string;
  expiresAtMs: number;
  refreshExpiresAtMs?: number;
  edition: TraeEdition;
  source: 'desktop' | 'dsh' | 'cli';
}
interface TraeRefreshOutcome {
  accessToken: string;
  refreshToken?: string;
  expiresAtMs: number;
  refreshExpiresAtMs?: number;
  host?: string;
}
interface TraeCredentialStoreOptions {
  storagePath?: string;
  edition?: TraeEdition | 'auto';
  accountId?: string;
  ownPath?: string;
  /**
   * Region this store serves. When set, only credentials whose own claim maps
   * to this region are discovered, selected, or refreshed — the two regions'
   * stores run side by side without seeing each other's accounts.
   */
  region?: TraeRegion;
  /**
   * Only consider credentials that belong to a Trae tenant.
   *
   * The enterprise panel's store runs with this on: a personal account cannot
   * bill that pool, and because the tenant gateway still serves it a directory,
   * binding it here would fail only at the first chat (`4019`). With the flag
   * set, an explicit binding to a personal account falls through to the preferred
   * TENANT account instead of being silently honoured.
   */
  requireTenant?: boolean;
  /**
   * Withhold TENANT (enterprise) accounts from this store's account list.
   *
   * Set on the consumer panels: an enterprise login belongs to the enterprise
   * panel, and offering it here would let a tenant account be bound to the
   * personal pool without the user ever seeing which pool they picked. A
   * machine that has ONLY a tenant login still resolves it — an empty list must
   * not turn a working install into "signed out" — so the filter is applied to
   * the OFFERED list, never to the resolved credential.
   */
  hideTenantAccounts?: boolean;
  /** Legacy single-copy path read as a migration source; injectable for tests. */
  legacyOwnPath?: string;
  refresh: (credential: TraeCredential) => Promise<TraeRefreshOutcome>;
  refreshMarginMs?: number;
  /**
   * Which Trae desktop apps are running right now. Injectable so the deletion
   * tests never depend on the machine they run on; defaults to the real probe.
   */
  runningApps?: RunningProbe;
}
interface TraeAccountChoice {
  id: string;
  accountName: string;
  edition: TraeEdition;
  /**
   * Whether this account may bill the CN ENTERPRISE pool.
   *
   * Derived from the credential's own tenant claim, because nothing else can
   * tell: the tenant gateway answers a directory read for ANY CN token, so a
   * personal account looks perfectly serviceable right up to its first chat,
   * which it answers with `4019`. The enterprise panel filters its account list
   * and its default binding on this flag.
   */
  enterprise: boolean;
  /** Routing bucket of this account (`cn` | `ai`), derived from its credential. */
  region: TraeRegion;
  source: 'desktop' | 'dsh' | 'cli';
  tokenExpiresAtMs: number;
  /**
   * When this account's refresh token lapses, when the credential carries one.
   * The access token above renews itself automatically until this expires; see
   * the mirror field on `TraeWebAccount` in status-paths.ts for why the card
   * needs it.
   */
  refreshExpiresAtMs?: number;
  selected: boolean;
}
/**
 * A credential on this machine that names a region this build cannot serve yet
 * (issue #66: the US cluster).
 *
 * Reported so the card can explain a signed-out panel that a user knows is
 * signed in. It is never selectable and never billed: `readAll()` skips these,
 * so they cannot reach a gateway at all.
 */
interface TraeUnsupportedCredential {
  region: Exclude<TraeServiceRegion, TraeRegion>;
  /** Display identity of the credential — never token material. */
  accountName: string;
}
/**
 * Why one candidate path did not yield an account. These are safe to surface:
 * they carry paths and error text, never token material.
 */
interface TraeCandidateFailure {
  path: string;
  edition: TraeEdition;
  source: TraeCredentialSource;
  reason: 'missing' | 'unreadable' | 'invalid';
  message?: string;
}
/**
 * A plugin-owned copy that was found UNREADABLE and therefore moved aside.
 *
 * Since 4.4.6 a copy this build cannot parse is never merged over: it is
 * renamed to `<file>.corrupt-<stamp>` (bytes intact, recoverable) and the merge
 * restarts from a clean file. That trade — a quarantined copy instead of a
 * silently emptied one — is only fair if the USER can see it happened, because
 * the accounts the copy carried are, from that moment on, only in the
 * quarantine file.
 *
 * This notice is what makes that visible: the card's diagnostics panel shows
 * it, and so does the signed-out screen — which is exactly the state a user
 * lands in after the loss (issue #56).
 */
interface TraeQuarantineNotice {
  /** The live path the copy had before it was moved aside. */
  file: string;
  /** The quarantine copy's full path; its name carries the moment it was taken. */
  quarantinedAs: string;
  /** Size of the quarantined copy in bytes (`0` when it could not be read). */
  bytes: number;
  /**
   * How many accounts the quarantined copy held, when it could still be read
   * as JSON. A copy quarantined for being TORN cannot be counted, and this is
   * then absent rather than guessed.
   */
  accounts?: number;
}
/**
 * Plugin-owned copy path for one region. Each region's store refreshes into
 * its own file so two simultaneously signed-in regions never overwrite each
 * other's refreshed token.
 */
declare function traeOwnAuthPath(region: TraeRegion): string;
/**
 * Pre-dual-provider single-copy path. Still read as a migration source (a
 * legacy credential serves the region it belongs to until that region's own
 * first refresh writes the per-region file), and removed by `logout`.
 */
declare function legacyTraeOwnAuthPath(): string;
declare function normalizeTraeCredential(raw: unknown, edition: TraeEdition, source: TraeCredential['source']): TraeCredential | undefined;
/**
 * Whether this account belongs to a Trae tenant, i.e. may bill the enterprise
 * pool.
 *
 * Evidence (2026-10-17, live): the tenant's own account carries
 * `account.tenant_id` / `tenant_name` and `scope: 'saas'`; the personal SOLO
 * account carries neither and reports `scope: 'marscode'`. Only the tenant one
 * streams on the enterprise gateway — the other answers `4019` risk control.
 */
declare function isEnterpriseAccount(credential: Pick<TraeCredential, 'tenantId'> | undefined): boolean;
declare class TraeCredentialStore {
  private storagePathOverride;
  private edition;
  private accountId;
  private readonly region;
  private readonly requireTenant;
  private readonly hideTenantAccounts;
  private readonly ownPathExplicit;
  private readonly legacyOwnPath;
  private readonly legacyOwnPathExplicit;
  private readonly refresh;
  private readonly refreshMarginMs;
  private readonly runningApps;
  private inflight;
  /**
   * In-flight refreshes of individual accounts, one per account id.
   *
   * The card reads every member's balance in one poll and each balance can
   * decide to refresh, so without this dedupe the same account would exchange
   * its token several times in a second and the last writer would win over a
   * copy another read already holds.
   */
  private readonly inflightByAccount;
  /**
   * When a per-account refresh last FAILED, so a dead refresh token is not
   * exchanged again on every poll.
   *
   * The card reads every member's balance on each refresh, and a revoked refresh
   * token fails forever: without this memo each poll would spend two upstream
   * calls (the current contract and the superseded one) on an account no retry
   * can fix. Five minutes keeps a transient network failure cheap to retry while
   * a revoked sign-in costs almost nothing.
   */
  private readonly refreshFailedAtMs;
  /**
   * The account the NEXT request should bill, when a pool — not the user's
   * binding — is choosing (issue #44).
   *
   * Runtime only, never persisted: the binding in settings is what a save
   * writes and what the card's account table reports as selected, while this is
   * "who serves right now". Keeping them apart is what lets the pool rotate
   * without silently rewriting the user's choice, and what makes turning the
   * pool off restore the bound account with no rebind at all.
   */
  private rotatedAccountId;
  constructor(options: TraeCredentialStoreOptions);
  /** Whether a credential's own claim belongs to this store's region. */
  private matchesRegion;
  /**
   * The path this store refreshes into: the per-region file for a
   * region-scoped store, the legacy single file otherwise, or an explicitly
   * injected path in tests.
   */
  ownAuthPath(): string;
  /**
   * Every plugin-owned copy to read, most preferred first. A region-scoped
   * store reads the legacy single copy as its migration source (readAll's
   * region filter drops it when it carries the other region's credential); an
   * unscoped store reads everything so diagnostics see both regions.
   *
   * With an explicitly injected own path the legacy source is read ONLY when
   * it was injected too — a test that pins one file must not accidentally see
   * the real machine's legacy copy.
   */
  private ownCandidates;
  /**
   * Where the "deleted copy" tombstones live for this store.
   *
   * Derived from the store's own copy path, so a test that pins `ownPath` also
   * pins the tombstones and can never touch the real `~/.dsh` file.
   */
  deletedPath(): string;
  /**
   * The account ids whose copy the user deleted on purpose.
   *
   * Read defensively: a missing, unreadable, or hand-edited file means "no
   * tombstones", never a failing store — losing the list only re-mirrors an
   * account, it never locks the user out.
   */
  private readTombstones;
  /**
   * Read, mutate, and write the tombstone list under ONE lock.
   *
   * The tombstone file is read-modify-write state shared by two flows that run
   * concurrently: `mirrorLocalLogins` (drops tombstones whose logins are gone)
   * and `deleteAccount` (adds the id just deleted). A read OUTSIDE the write's
   * lock loses updates in both directions — a dropped-add resurrects a deleted
   * account on the next mirror, a dropped-drop keeps a tombstone forever and
   * hides every future sign-in of that account. The mutator therefore runs on
   * the freshly-read set INSIDE the lock, and what it returns is what gets
   * written, with no window in between.
   *
   * Fire-and-forget safe: a failed update only delays a tombstone change until
   * the next mirror or delete, so errors are swallowed like the readers'.
   */
  private updateTombstones;
  /**
   * Read the plugin-owned file as the merge base for a read-modify-write.
   *
   * This is the fail-safe that keeps one unreadable file from erasing every
   * account: `parseOwn` now distinguishes a VALID empty file (`[]`) from one
   * this build cannot parse (`undefined`), and only the former may serve as a
   * merge base. For the latter the file is quarantined — renamed aside with
   * its bytes intact — and the merge then starts from nothing, so the action
   * the user pressed still succeeds and the lost entries are recoverable from
   * the quarantine copy instead of being overwritten silently. A quarantine
   * that fails (an exotic filesystem, a name collision) aborts the write
   * instead: losing one refresh is recoverable by pressing it again, losing
   * every account is not.
   *
   * Every caller must hold the {@link withFileLock} of `path` across BOTH the
   * read and the subsequent write — this does not lock by itself.
   */
  private readOwnForMerge;
  /**
   * Copy every local Trae sign-in into this store's own file, once.
   *
   * The plugin presents COPIES, not the app's live login: the app has a single
   * sign-in slot that the next Trae login overwrites, so an account could only
   * ever be billed until the user switched apps. Keeping a copy per account is
   * what makes a multi-account pool survive those switches.
   *
   * This runs on every `accounts()` read — the card's refresh, the pool's member
   * read, the "detect accounts" press — and is additive:
   *   - an account that already has a copy is left exactly as it is (the copy
   *     may hold a token this plugin refreshed, which is fresher than the app's);
   *   - an account the user DELETED stays deleted while it is still signed in to
   *     the app, via a tombstone that is dropped once the app no longer holds it
   *     (so a later sign-in is mirrored again).
   */
  private mirrorLocalLogins;
  setSource(storagePath: string | undefined, edition?: TraeEdition | 'auto', accountId?: string): void;
  selectAccount(accountId: string | undefined): void;
  candidates(): TraeStorageCandidate[];
  /**
   * Deterministic default when no account is explicitly selected: the account
   * the Trae desktop app is signed in to RIGHT NOW, else the first discovered
   * one. This is NOT credit-seeking — it never reorders accounts to find one
   * with general credits. The plugin bills exactly the account the user
   * selected, the app's current sign-in when nothing has been selected, and
   * only then the first account.
   *
   * The app's live sign-in outranks the plugin's own refreshed copies (issue
   * #29): after the user switches accounts in Trae, the desktop storage file
   * holds the NEW login while the plugin's copy of the old one still resolves,
   * so a bare `credentials[0]` kept defaulting to a sign-in the app has
   * abandoned — and `dsh-connect-workbuddy`, whose `preferred()` ranks the live
   * file first, followed the app instead. Ordering only: the VALUE behind an
   * account id is still whichever copy expires later (`readAll`), so a refresh
   * the plugin performed is never discarded by this preference.
   */
  private preferred;
  /**
   * The accounts this store is willing to OFFER.
   *
   * Scoped to who this store may bill:
   *   - a consumer store withholds tenant accounts (the enterprise pool is a
   *     separate tab and a separate billing decision), and
   *   - a tenant store withholds personal accounts (they cannot bill that
   *     pool; the tenant gateway answers their chat with 4019).
   *
   * Either filter backs off when it would hide EVERYTHING, so a machine whose
   * only login is on the other side keeps working instead of reading as
   * "signed out".
   */
  private offered;
  accounts(): Promise<TraeAccountChoice[]>;
  /**
   * The credential this store bills, given every credential it can see.
   *
   * This is the ONE resolution rule, and it exists so that `current()` and
   * `accounts()` cannot disagree: `current()` applies it to `readAll()`, and
   * `accounts()` applies the SAME verdict to decide which row reads as
   * `selected`. Deriving that flag independently is exactly how the two drifted
   * apart — and a card that marks a different account than the one the chat
   * bills is worse than no card at all, because a press that "saves the
   * selected account" then rewrites the binding to the account that was only
   * ever DISPLAYED.
   *
   * Order of business:
   *   1. No binding — the detected default (`preferred`) is in use, chosen from
   *      the OFFERED list rather than from every login on the machine. A
   *      consumer store that withholds tenant accounts must not default its
   *      billing to the tenant pool merely because that login sorts first;
   *      withholding is a billing decision, not a display detail.
   *   2. A binding — honour it verbatim, even when the OFFERED list hides that
   *      account. Resolution is never scoped by `hideTenantAccounts`: the user's
   *      explicit choice outranks a display filter.
   *   3. A tenant-scoped store cannot bill through a personal account, and the
   *      tenant gateway only reveals that at the first chat (`4019`). Honour the
   *      binding when it is eligible; otherwise fall back to the preferred
   *      tenant account, which is the one the user's enterprise tab is meant to
   *      use.
   *   4. A saved account can disappear when Trae replaces its local login. Do
   *      NOT silently fall back to a different account: that would bill a
   *      different account than the one the user explicitly selected. Return
   *      undefined so the caller surfaces "no signed-in account" and the user
   *      can re-select, instead of the plugin quietly switching accounts behind
   *      their back.
   */
  private inUse;
  /**
   * Point this store at one specific account for the NEXT request, without
   * touching the user's saved binding (issue #44).
   *
   * Called by the account pool before each chat request. `undefined` clears the
   * override, which is how switching the pool off immediately restores the
   * binding — no rebind, no settings write, nothing to undo.
   *
   * A rotation is a REQUEST, not an assertion: `current()` honours it only when
   * the account still exists locally and this store's own eligibility rules
   * allow it, and otherwise falls back to the binding. So a rotation can never
   * invent a credential that {@link current} would refuse.
   */
  setRotatedAccount(accountId: string | undefined): void;
  /** The rotation currently in effect, for diagnostics and the pool's own card. */
  rotatedAccount(): string | undefined;
  /**
   * The credential a rotation points at, or `undefined` when it cannot be
   * honoured (the login was removed from this machine, or a tenant-scoped store
   * refuses a personal account).
   *
   * Never substitutes a different account here: the caller then applies the
   * user's binding, which is the honest answer when the pool's choice is gone.
   */
  private rotated;
  current(): Promise<TraeCredential | undefined>;
  /**
   * The stored credential of one specific account, without changing which
   * account this store is bound to (issue #25).
   *
   * The card needs to answer "the account I am bound to has run out of credits
   * — is another account on this machine usable?" and {@link resolve} cannot
   * help: it always returns the BOUND account, and switching the bound account
   * just to read one number would race every in-flight chat request sharing
   * this store, and would persist a selection the user never made.
   *
   * So this is a pure lookup: read-only, no refresh side effects (a stale token
   * is returned as-is and the caller's request then fails honestly), and
   * `accountId` is left untouched. An unknown id yields undefined rather than a
   * fallback, for the same reason {@link current} refuses to fall back.
   */
  credentialOf(accountId: string): Promise<TraeCredential | undefined>;
  /**
   * The PLUGIN'S OWN COPY of one account — never the Trae app's credential.
   *
   * {@link credentialOf} answers from the merged view (copies plus the app's
   * logins) and prefers whichever is fresher. That is right for placing a
   * request, but wrong for HANDING CREDENTIALS OUT: an export must carry the
   * copies this plugin owns and refreshes, not whatever the app happens to have
   * on disk. The two are normally identical — the copy is mirrored from the app
   * — but only the copy is ours, and an account with no copy is not ours to
   * export at all (undefined, no fallback to the app's login).
   */
  copyOf(accountId: string): Promise<TraeCredential | undefined>;
  /**
   * A SPECIFIC account's credential, refreshed when its access token is due.
   *
   * {@link credentialOf} is a pure lookup and hands back an expired token as-is,
   * which is right for the chat path (that request fails honestly) but wrong for
   * a READ of that account's own data: Trae's access token lives for days while
   * the refresh token lives for months, so a pooled account the user has not
   * used this week reads as "no balance" — the card showed a bare `—` for an
   * account whose refresh token was still good. Only the refresh margin decides
   * here, and a FAILED refresh still yields the stored credential so the caller
   * reports the failure it actually hit instead of inventing "not signed in".
   *
   * This never touches the binding or the rotation: refreshing account B must
   * not make B the account the next chat request bills.
   */
  resolveCredentialOf(accountId: string): Promise<TraeCredential | undefined>;
  /**
   * Store imported credentials (issue #37), replacing any entry with the same
   * account id and leaving every other entry alone.
   *
   * Why an additive write rather than the refresh path: an imported credential
   * has NO desktop file behind it, so unlike a refresh result it cannot be
   * rediscovered from the machine. If it were written the way a refresh is —
   * as the whole document — importing account B would delete account A, and a
   * later refresh would delete both. `readAll`'s desktop-first preference is
   * therefore also not enough on its own: these entries survive only because
   * `readOwns` reads them back and the dedupe keeps the longest-lived copy.
   *
   * Returns the account ids actually written, so the caller can report how many
   * landed without re-reading the store.
   */
  importAccounts(credentials: readonly Omit<TraeCredential, 'source'>[]): Promise<string[]>;
  resolve(): Promise<TraeCredential>;
  status(): Promise<{
    state: 'signed-in' | 'signed-out';
    edition?: TraeEdition;
    expiresAtMs?: number;
    source?: TraeCredential['source'];
  }>;
  /**
   * Credentials this machine holds for a region this build cannot serve yet.
   *
   * Issue #66: a US credential used to resolve to `ai`, so the panel billed it
   * against the SG gateway and every read answered 401. Now it is excluded from
   * resolution (see `readAll`), which would leave the panel saying "not signed
   * in" on a machine the user knows IS signed in — so the exclusion has to be
   * explainable. This reads exactly the credentials `readAll` refuses to
   * RESOLVE and reports their display identity; nothing here is selectable,
   * billable, or sent anywhere.
   *
   * Scoped to the international bucket: a US install is an international
   * install, so only the `ai` panel (and an unscoped diagnostic store) can be
   * the one missing an account because of it.
   */
  unsupportedCredentials(): Promise<TraeUnsupportedCredential[]>;
  desktopFilePresent(): Promise<boolean>;
  /**
   * Remove every plugin-owned copy this store could read (per-region file,
   * legacy single file, and their lock siblings); the desktop storage files
   * are untouched. A region store's logout therefore also clears the legacy
   * migration source — deliberate: `logout` is the user's "forget what the
   * plugin stored" action, not a per-account toggle.
   */
  logout(): Promise<void>;
  /**
   * Remove ONE account from the plugin-owned copy (per-region file, legacy
   * single file), where this store can rewrite the shape it wrote.
   *
   * The desktop storage files are deliberately untouched: their credential is
   * a Trae app login that only Trae can rewrite, so a plugin removing it would
   * corrupt an application state it does not own. `deleteAccount` therefore
   * only ever commits what this plugin persisted — the refreshed copy the
   * store owns — and reports what it did.
   *
   * `stillSignedIn` is true when the SAME account id still resolves to a
   * desktop storage copy, i.e. the account will keep appearing (from Trae's own
   * login) even after the plugin's copy is gone. The card then shows the user
   * where the account really lives instead of implying a deletion that did not
   * take: the account is still signed in Trae, and Trae is the only writer that
   * can remove it.
   *
   * @returns `{ deleted: boolean; stillSignedIn: boolean }` — `deleted` is
   * whether a plugin-owned copy of this account was actually removed;
   * `stillSignedIn` reports a TRAE-owned login that survives it.
   */
  /**
   * Erases this account's login from Trae's OWN storage files.
   *
   * Deleting only the plugin's copy of an account the app itself is signed in to
   * changes nothing the user can see: the app keeps reporting the account, the
   * row comes back on the next poll, and "delete" looks broken. The only real
   * deletion therefore has to rewrite the app's `storage.json`, which means
   * (a) re-encrypting the values that stay, with Trae's own scheme, and (b)
   * refusing while that app runs — its in-memory state would be flushed back
   * over the file and undo the edit.
   *
   * A backup of every rewritten file is left beside it (`.dsh-backup-<stamp>`),
   * because signing a user's editor out is not something to do without a way back.
   */
  deleteDesktopLogins(accountId: string): Promise<{
    signedOut: TraeEdition[];
    blocked: TraeEdition[];
  }>;
  /**
   * Delete this store's COPY of one account.
   *
   * What the plugin shows and bills is the copy, so that is the first thing
   * "delete" removes. The copy alone is not enough: the same login usually also
   * lives in the app's own `storage.json`, and the app keeps reporting it, so
   * the delete then erases that login too (see `deleteDesktopLogins`, which
   * refuses while the app runs and leaves a backup beside every file it
   * rewrites).
   *
   * The catch is the mirror: `accounts()` recreates a copy from any local login
   * that lacks one, so deleting the copy of an account still signed in to Trae
   * would resurrect it on the next poll. A TOMBSTONE records the deletion for
   * exactly that id; the mirror skips it while the app still holds the login and
   * drops the tombstone once it does not, so signing in again later mirrors it
   * again. That is why `stillSignedIn` is reported: it explains that the account
   * still lives in Trae even though the plugin no longer shows it.
   *
   * @returns `{ deleted, stillSignedIn, hadCopy, signedOutApps, blockedApps }` —
   * `deleted` is "this machine no longer carries the account anywhere" (true
   * even when there was never a copy, so a ghost member can be cleared);
   * `stillSignedIn` answers "is it still a live Trae login here?"; `hadCopy` is
   * "did a file actually change?"; `signedOutApps` names the apps whose login
   * was erased; `blockedApps` names the apps that were running, in which case
   * nothing was erased and `deleted` is false.
   */
  deleteAccount(accountId: string): Promise<{
    deleted: boolean;
    stillSignedIn: boolean;
    hadCopy: boolean;
    signedOutApps: TraeEdition[];
    blockedApps: TraeEdition[];
  }>;
  /**
   * Every local credential of this store's region, deduplicated by account id.
   * A region-scoped store sees only its own region's credentials: the other
   * region's accounts are invisible to selection, refresh, and status alike,
   * which is what keeps the two regions' providers from cross-billing.
   */
  private readAll;
  /**
   * Which paths were tried and why each one failed. Read-only and token-free:
   * it exists so a signed-out card can explain itself instead of showing a bare
   * "not signed in", which is undiagnosable on a machine whose layout differs
   * from the ones the plugin was written against.
   */
  diagnose(): Promise<{
    tried: TraeStorageCandidate[];
    failures: TraeCandidateFailure[];
  }>;
  /** Parse one candidate file's text into a credential, or throw. */
  private credentialFrom;
  private readDesktopAll;
  /**
   * Every readable plugin-owned copy, in candidate order; absent or corrupt
   * files are skipped rather than propagated.
   */
  private readOwns;
  /**
   * The copies that were found unreadable and moved aside.
   *
   * SCANNED, not remembered: the quarantine file is itself the durable
   * record (its name carries the moment it was taken), so the plugin does not
   * keep a second, parallel ledger that could disagree with the disk. The
   * notice therefore appears exactly as long as the evidence does — and
   * disappears when the user deletes the quarantined copy, which is what
   * "I have dealt with it" means.
   *
   * A notice is a FACT about the user's disk, never about their credentials:
   * it names a path, a size and a count, and the path is the one the plugin
   * owns (inside DSH's own home), never a Trae application directory.
   */
  quarantinedCopies(): Promise<TraeQuarantineNotice[]>;
  private refreshNow;
}
//#endregion
//#region src/decrypt.d.ts
declare function decryptTraeStorageValue(encoded: string): string;
declare function parseTraeAuthValue(value: string): unknown;
declare function parseTraeStorageDocument(text: string): unknown;
//#endregion
//#region src/identity.d.ts
/**
 * The per-install ECDSA P-256 keypair the official client registers with the
 * device, and signs its token-refresh proof with.
 *
 * It lives in the same `storage.json` as the credential, under
 * `iCubeAuthInfo://icube-dc:<deviceId>`, encrypted with the same codec — so the
 * key that PROVES a device is the key stored beside the login it protects.
 * Without it the new refresh contract cannot be satisfied at all (the server
 * rejects a proof signed by any other key with `20403 Token device not match`).
 */
interface TraeDeviceKeyPair {
  privateKeyPEM: string;
  publicKeyPEM: string;
}
interface TraeIdentity {
  edition: TraeEdition;
  machineId: string;
  deviceId: string;
  appVersion?: string;
  buildVersion?: string;
  deviceBrand?: string;
  deviceCpu?: string;
  osVersion?: string;
  /**
   * Device display name; the official client sends the OS account's full name.
   * Optional because the new refresh contract does not read it.
   */
  deviceName?: string;
  /** Device model, e.g. `MacBookPro18,2`. Optional; not required by the server. */
  deviceModel?: string;
  /** The install's registered device keypair, when `storage.json` carries one. */
  deviceKeyPair?: TraeDeviceKeyPair;
  platform: NodeJS.Platform;
}
interface TraeIdentityReadOptions {
  /** Platform override for testing; defaults to process.platform. */
  platform?: NodeJS.Platform;
  /** Home-directory override for testing; defaults to homedir(). */
  home?: string;
  /** Environment override for testing; defaults to process.env. */
  env?: NodeJS.ProcessEnv;
}
/** Read stable identity from Trae-owned files without generating impersonated IDs. */
declare function readTraeIdentity(candidate: TraeStorageCandidate, options?: TraeIdentityReadOptions): Promise<TraeIdentity>;
/**
 * Try candidates in order and return the first that yields a valid identity;
 * fail hard only when none do. Mirrors the credential store's skip-missing
 * semantics so a machine with only SOLO (no CN install) resolves correctly
 * instead of pinning the first candidate and throwing on a missing file.
 * When every candidate is absent from disk the error names all tried paths;
 * a candidate that exists but fails to parse still surfaces its own error.
 */
declare function pickTraeStorageIdentity(candidates: readonly TraeStorageCandidate[], options?: TraeIdentityReadOptions): Promise<TraeIdentity>;
/**
 * Deterministic identity for a machine that only has the Trae CLI (`traecli`).
 *
 * A CLI-only machine has no desktop `storage.json`, so the desktop identity
 * reader has nothing to read — yet the request headers still need stable
 * machine/device ids. Everything here comes from identifiers the CLI itself
 * persists (never a per-request random value):
 *
 *   - `argv.json`'s `crash-reporter-id` — a stable per-install UUID the CLI
 *     writes on first run; used directly as the device id.
 *   - `builtin/ide_version.json`'s `version` — the CLI build, sent as
 *     `x-app-version` (the desktop reader gets this from `product.json`).
 *   - a SHA-256 over the device id, host name and user name for `machineId`,
 *     matching the 64-char hex shape the official clients send.
 *
 * When `crash-reporter-id` is absent the device id falls back to the same
 * hash (still deterministic). A machine with no CLI home at all keeps failing
 * loudly — a fabricated identity is worse than a visible "not signed in".
 */
declare function readTraeCliIdentity(edition: TraeEdition, options?: TraeIdentityReadOptions): Promise<TraeIdentity>;
/**
 * Resolve the request identity for one region: the desktop storage identity
 * when any desktop install exists, otherwise the CLI home's deterministic
 * identity (see {@link readTraeCliIdentity}).
 *
 * This is the seam the WSL2 / CLI-only case needs: `traecli` writes its token
 * to `~/.trae-cn/trae-jwt-token` and no `storage.json` exists anywhere, so
 * desktop-only resolution used to fail every directory refresh and chat
 * request even though the account itself was found.
 */
declare function resolveTraeIdentity(candidates: readonly TraeStorageCandidate[], edition: TraeEdition, options?: TraeIdentityReadOptions): Promise<TraeIdentity>;
/** Headers derived from actual persisted identity, never a new random identity per request. */
declare function identityHeaders(identity: TraeIdentity): Record<string, string>;
//#endregion
//#region src/model-config.d.ts
interface TraeObservedModelConfig {
  configName: string;
  modelName: string;
  promptSet?: string;
  abVersion?: string;
  rawChatFunction?: string;
}
/**
 * Parse a secret-free CustomModel debug line emitted by Trae. Optional values
 * remain absent when Trae prints None; we must not invent defaults for them.
 */
declare function parseObservedModelConfig(line: string): TraeObservedModelConfig | undefined;
//#endregion
//#region src/model-cache.d.ts
/** Basename of the SQLite cache sitting beside the credential document. */
declare const TRAE_STATE_DB_FILENAME = "state.vscdb";
interface TraeCachedModelConfig {
  name: string;
  customConfig?: Record<string, unknown>;
  promptMaxTokens?: number;
  maxTokens?: number;
  maxTurn?: number;
  multimodal?: boolean;
  modelType?: string;
}
/** Parse a safe subset of one cached model entry; credentials and endpoints are intentionally omitted. */
declare function parseTraeCachedModel(value: unknown): TraeCachedModelConfig | undefined;
interface TraeCachedModelReadOptions {
  /** Platform override for testing; defaults to process.platform. */
  platform?: NodeJS.Platform;
  /** Home-directory override for testing; defaults to homedir(). */
  home?: string;
  /** Environment override for testing; defaults to process.env. */
  env?: NodeJS.ProcessEnv;
  /**
   * The credential candidate whose account is being read. Supplying it pins the
   * lookup to the installation the credential actually came from, which is the
   * only way to stay correct when several editions are installed: `storage.json`
   * and `state.vscdb` live in the SAME `globalStorage` directory, so the cache
   * belongs to whichever candidate yielded the sign-in.
   */
  candidate?: TraeStorageCandidate;
  /** Injectable for tests; defaults to node:fs existsSync. */
  exists?: (path: string) => boolean;
  /**
   * Injectable `sqlite3` runner for tests; defaults to promisified `execFile`.
   * Mirrors the `fetchImpl` injection used elsewhere in this plugin, and exists
   * so a test can assert the exact argv — in particular WHICH database path was
   * chosen, which no assertion on the candidate list alone can prove.
   */
  runSqlite?: (database: string, sql: string) => Promise<{
    stdout: string;
  }>;
}
/**
 * The cache paths to try, most-specific first.
 *
 * `state.vscdb` is a SIBLING of the credential document (both sit in
 * `globalStorage`), so a candidate's own path is the authority for its cache —
 * this is why the database is derived from {@link traeStorageCandidates} rather
 * than re-spelled here.
 *
 * It previously hardcoded the single macOS spelling `Trae CN`, which was wrong
 * in two ways on Windows: `paths.ts` probes `Trae CN` AND `trae-cn`, and the
 * edition actually installed is often SOLO (`TRAE SOLO CN`). This module would
 * then point at a directory that does not exist. That went unnoticed only
 * because the Windows `sqlite3` dependency is absent, so the lookup failed and
 * callers fell back — masking the wrong path behind a different error. Sharing
 * one path table means a spelling that works for sign-in also works for the
 * cache.
 */
declare function traeStateDatabaseCandidates(options?: TraeCachedModelReadOptions): string[];
/**
 * Read Trae's own current user's model map via sqlite3 without exposing
 * secrets. The sqlite3 command line is a macOS prerequisite; on Windows it is
 * typically absent, so the call fails and callers fall back gracefully.
 *
 * Every candidate database is tried in order and the first that EXISTS is
 * queried. Existence is checked before spawning because a missing file and a
 * missing `sqlite3` binary are different problems: choosing the wrong directory
 * would otherwise surface as a confusing `sqlite3` failure, hiding a path bug
 * behind a dependency error.
 */
declare function readTraeCachedModel(functionName: string, modelName: string, userId: string, options?: TraeCachedModelReadOptions): Promise<TraeCachedModelConfig | undefined>;
//#endregion
//#region src/model-extra-config.d.ts
interface TraeRawChatBehaviorConfig {
  passBackReasoning?: boolean;
  nativeFunctionCall?: boolean;
  useV2Process?: boolean;
  maxModeEnabled?: boolean;
  maxToolcallChars?: number;
  streamThrottleEnabled?: boolean;
}
/** Parse only Raw Chat behavior switches observed in Trae's model_extra_config. */
declare function parseTraeRawChatBehaviorConfig(value: unknown): TraeRawChatBehaviorConfig;
/** Extract the JSON object from one native model_extra_config parse log line. */
declare function parseTraeModelExtraConfigLogLine(line: string): TraeRawChatBehaviorConfig | undefined;
//#endregion
//#region src/model-detail.d.ts
declare const TRAE_MODEL_DETAIL_PATH = "/api/ide/v1/batch_get_detail_param";
declare const TRAE_MODEL_DETAIL_FUNCTIONS: readonly ["ui_builder_v2", "solo_coder", "chat_v3", "solo_builder", "builder_v3", "builder", "chat", "inline_chat", "git_ai", "custom_agent_generation", "utils", "code_reviewer", "code_review_summary", "solo_agent", "solo_agent_remote", "solo_work_remote", "solo_agent_lite", "solo_work_lite", "solo_design_lite", "solo_design_remote", "multimodal", "system_diagnosis"];
interface TraeModelDetailRequest {
  functions: string[];
  agent_type: '' | 'solo_agent';
  current_config_info: {
    config_name: string;
    is_custom_model: boolean;
  };
  mode_type: 0;
  access_type: 0;
  ab_force_vids: '';
  ab_autotest_advanced_mode: 0;
}
/** Build the exact request shape observed in successful current Trae CN logs. */
declare function buildTraeModelDetailRequest(configName?: string, custom?: boolean): TraeModelDetailRequest;
//#endregion
//#region src/official-roster.d.ts
/**
 * The IDE's own roster: what the Trae picker is WILLING TO SHOW, per function.
 *
 * Issue #52. The plugin lists the UNION of every directory function (46 rows on
 * a live CN credential, 2026-10-23) while the Trae client renders ONE function's
 * list at a time (14–24 rows). Two different questions were being answered by
 * one list, and the user saw the difference as "why are there so many models".
 *
 * This module answers the second question with the third upstream signal the
 * catalog was missing. `isPromotableWireModel` (src/catalog.ts) asks "can this
 * config be called"; this one asks "does the vendor's own picker offer it", read
 * from `is_invisible_to_user` on the SAME `batch_get_detail_param` document the
 * IDE renders. Both are upstream facts; neither is invented.
 *
 * The flag is PER (config, function), not per config — measured 2026-10-23:
 * `glm-4.7` is visible under `code_review_summary` and hidden under `solo_coder`
 * and `solo_work_remote`. A row's visibility therefore only means something
 * together with the function the chat call will replay, which is why the
 * decision below takes BOTH and why the answer cannot be merged as a bare field
 * the way `contextWindow` is.
 */
/** One (config, function) pair exactly as the IDE roster published it. */
interface TraeOfficialChannel {
  /** The `function_configs[].function` this row was listed under. */
  function: string;
  /**
   * Upstream's `usage` for the config under this function: `chat_completion`
   * for a real model, one value per built-in tool config (`summary`,
   * `fast_apply`, …), `custom_model` for the account's own model. Empty when
   * upstream did not say.
   */
  usage: string;
  /** `config_switch`: false means upstream marked the config OFF on this function. */
  enabled: boolean;
  /** `is_invisible_to_user`: true means the vendor's picker does not list it here. */
  invisible: boolean;
}
/** What the IDE roster knows about one `config_name`. */
interface TraeOfficialRoster {
  /** Lower-cased `config_name` → every (function, visibility) pair published. */
  channels: ReadonlyMap<string, readonly TraeOfficialChannel[]>;
  /** Number of distinct configs and pairs, for diagnostics only. */
  size: {
    configs: number;
    pairs: number;
  };
}
/**
 * Parse a `batch_get_detail_param` answer into a per-(config, function) index.
 *
 * Tolerant on purpose: this document is 1.8 MB of upstream-owned shape
 * (`function_configs[] → config_info_list[] → model_detail_list[]`), and the
 * plugin must not lose the whole refresh because one nested field changed
 * spelling. Rows that cannot be read are skipped; a document with no
 * `function_configs` at all yields an empty roster, which the filter reads as
 * "nothing to say" rather than "hide everything".
 *
 * Duplicate pairs are collapsed first-wins, matching the rest of the catalog's
 * convention (`mergeTraeModelSources`). Two functions can both list a config,
 * and those are DIFFERENT pairs, so both are kept.
 */
declare function parseTraeOfficialRoster(payload: unknown): TraeOfficialRoster;
/**
 * What the roster says to do with one catalog row.
 *
 * `is_invisible_to_user` is a per-(config, function) MODE roster, not a
 * lifecycle flag. Measured 2026-10-23 on a live CN account: `DeepSeek-V4-Pro` is
 * hidden under `solo_work_remote` (where that mode's picker shows
 * `DeepSeek-V4-Pro-Official`) while `solo_coder`, `chat_v3` and `chat` all list
 * it as visible; `glm-5` is hidden under `solo_work_remote` and
 * `solo_agent_remote` and visible under `solo_work_lite` and `solo_coder`.
 *
 * Reading the flag as "this model is retired" would have deleted six models that
 * are in current use. Reading it as "this config is not the one THIS mode
 * offers" yields the two verdicts below: a config no chat function offers any
 * more is retired (hide), and a config offered somewhere else is mis-pinned
 * (re-pin to the function the vendor itself uses). Both replace a guess — the
 * union of twelve directories — with an upstream answer.
 */
type TraeOfficialVerdict =
/** Visible on the function it would be called through, or the roster says nothing. */
{
  kind: 'keep';
} |
/** Invisible on EVERY chat function that lists it: the vendor retired it as a chat model. */
{
  kind: 'hide';
  function: string | undefined;
  listedBy: string[];
} |
/** Invisible on its own function while another chat function offers it. */
{
  kind: 'repin';
  from: string | undefined;
  to: string;
  listedBy: string[];
};
/**
 * Decide one row from the roster.
 *
 * `chatFunctions` is the region's own `TRAE_DIRECTORY_FUNCTIONS` list, in
 * priority order: only those functions can carry a VERDICT, because only those
 * are functions `llm_utils_chat` accepts. A config the vendor shows under
 * `code_review_summary` alone is not offered as a chat model at all — that is
 * exactly the `glm-4.7` case, and it is a "hide", not a "re-pin".
 *
 * The verdict is `keep` when the roster cannot speak: no entry for the config
 * (measured 2026-10-23: `kimi-k2.8-preview` and `qwen3.8-flash` exist only in
 * the Remote directory's `chat_v3` group), only tool rows (`usage: 'summary'`,
 * `fast_apply`, …), or no chat function at all. Silence is never a verdict.
 */
declare function officialVerdictOf(model: {
  id: string;
  wireConfigName?: string;
  wireFunction?: string;
}, roster: TraeOfficialRoster, chatFunctions: readonly string[]): TraeOfficialVerdict;
interface TraeOfficialFilterResult<T> {
  /** Rows the catalog should keep, in their original order. */
  rows: T[];
  /** Rows removed, with the function that hid them, for the log and the tests. */
  hidden: Array<{
    id: string;
    function: string | undefined;
  }>;
  /** Rows kept but moved to the chat function the vendor offers them on. */
  repinned: Array<{
    id: string;
    from: string | undefined;
    to: string;
  }>;
}
/**
 * Apply the roster: retire what no chat function offers any more, and re-pin
 * what the vendor offers under a different channel.
 *
 * FAIL-OPEN BY CONSTRUCTION, which is the whole safety argument for applying
 * this by default:
 *
 *  - `undefined` roster (transport failure, restricted network, a credential
 *    that cannot read the IDE document) keeps EVERY row. A refresh must never
 *    lose models because a second, optional endpoint was unreachable.
 *  - `keep` covers every ambiguity — no entry, tool-only entries, a channel the
 *    roster does not name. Only an explicit "the vendor shows this nowhere we
 *    can call it" removes a row.
 *  - `config_switch === false` alone does NOT remove a row: the flag is
 *    recorded on {@link TraeOfficialChannel} but not used as a verdict, because
 *    its semantics are unmeasured and "disabled" there may describe a function
 *    override rather than the model itself.
 *
 * This is deliberately NOT "match the Trae client": the client renders one
 * function, the plugin serves the union, and issue #46's reporter wants the
 * dated snapshots the union carries. What changes here is only the class where
 * the union is provably wrong — twelve retired configs that made up the reported
 * "tail of old models", plus rows pinned to a channel their own vendor hides
 * them on (the "code model on a solo channel" risk of issue #52).
 */
declare function applyOfficialRoster<T extends {
  id: string;
  wireConfigName?: string;
  wireFunction?: string;
}>(rows: readonly T[], roster: TraeOfficialRoster | undefined, chatFunctions: readonly string[]): TraeOfficialFilterResult<T>;
interface TraeOfficialRosterOptions {
  credential(): Promise<TraeCredential>;
  identity(): Promise<TraeIdentity>;
  fetchImpl?: typeof fetch;
  /** Pins the host (tests, diagnostics). Defaults to the credential region's chat gateway. */
  baseUrl?: string;
  /** Pin the tenant pool's gateway, exactly like `TraeSoloUpstreamClient`. */
  route?: 'solo' | 'enterprise';
  log?: (message: string, detail?: unknown) => void;
  now?: () => number;
}
/**
 * Reads the IDE's roster once per cache window and never throws.
 *
 * `undefined` is a first-class answer: it is what a caller sees when the
 * document could not be read, and {@link applyOfficialRoster} treats it as "no
 * opinion". Silence on failure is intentional — this is a refinement of a
 * refresh that already succeeded, so a strict error would turn a usable catalog
 * into a failed refresh.
 */
declare class TraeOfficialRosterClient {
  private readonly options;
  private readonly fetchImpl;
  private readonly now;
  private cached;
  /** The last failure, so a repeatedly-broken endpoint is not re-probed on every refresh. */
  private failedAt;
  constructor(options: TraeOfficialRosterOptions);
  /** Cached roster, without any network I/O. */
  cachedRoster(): TraeOfficialRoster | undefined;
  fetch(signal?: AbortSignal): Promise<TraeOfficialRoster | undefined>;
}
/** Where the client asks for the roster; re-exported so diagnostics do not hard-code it. */
declare const TRAE_OFFICIAL_ROSTER_PATH = "/api/ide/v1/batch_get_detail_param";
//#endregion
//#region src/model-order.d.ts
/**
 * Wire name of the default SOLO chat function.
 *
 * Lives here rather than in `solo.ts` so this module stays importable from the
 * client; `solo.ts` re-exports it, so there is still exactly one definition.
 */
declare const TRAE_SOLO_FUNCTION = "solo_work_lite";
/**
 * The chat functions of one region, in PRIORITY order.
 *
 * Two consumers read it, and both mean "priority", which is why they can share
 * one array: the wire asks these functions in order and the first to list a
 * config owns it (`solo.ts`), and the card draws the groups in the same order so
 * the row a user sees first is the one the resolver prefers.
 */
declare const TRAE_CHANNEL_PRIORITY: Readonly<Record<TraeRegion, readonly string[]>>;
/** The subset of a catalog row this module needs. */
interface TraeOrderableModel {
  id: string;
  name: string;
  /** The directory function the row will be called through; absent = default. */
  wireFunction?: string;
  /** The `config_name` to actually send; absent means `id` is the wire id. */
  wireConfigName?: string;
}
/**
 * The catalog in display order: channel priority first, then name.
 *
 * Total and stable — ties fall through to `id`, so two rows with the same name
 * in the same channel still get one fixed order rather than the order they
 * arrived in.
 */
declare function orderTraeModels<T extends TraeOrderableModel>(rows: readonly T[], region?: TraeRegion): T[];
/** One rendered group: the channel and the rows attributed to it. */
interface TraeModelGroup<T> {
  /** `undefined` for rows whose call function is unknown (they use the default). */
  channel: string | undefined;
  rows: T[];
}
/**
 * Split rows into channel groups, in display order.
 *
 * Ordering is re-applied here rather than trusted from the caller: a group list
 * built from an unsorted input would put the groups in arrival order, which is
 * the exact instability this module exists to remove.
 */
declare function groupTraeModels<T extends TraeOrderableModel>(rows: readonly T[], region?: TraeRegion): TraeModelGroup<T>[];
/**
 * Does one row match a search query?
 *
 * Matches the display name, the display id and the WIRE config name — the last
 * one because a user debugging a `4001 config_name rejected` arrives with the
 * upstream name in hand, and the two differ exactly on the rows that carry a
 * suffix (`DeepSeek-V4-Flash` vs `DeepSeek-V4-Flash-Official`).
 */
declare function traeModelMatchesQuery(model: TraeOrderableModel, query: string): boolean;
/** Filter by {@link traeModelMatchesQuery}, preserving order. */
declare function filterTraeModels<T extends TraeOrderableModel>(rows: readonly T[], query: string): T[];
/**
 * The channels a NORMAL Trae chat session actually runs on: the `solo_work_*`
 * family, i.e. the panel's own chat modes.
 *
 * Deliberately not "every channel we can call". After issue #52 P1 the catalog
 * is 34 rows and 10 of them are reachable only through a SPECIALIST channel:
 * `solo_coder` (7: `Doubao-Seed-2.0-Code`, `glm-5.1`, `glm-5v-turbo`,
 * `kimi-k2.5`, `minimax-m2.7`, `qwen-3.5`, `qwen-3.6-plus`), `chat_v3` (2:
 * `kimi-k2.8-preview`, `qwen3.8-flash`) and `solo_agent_remote` (1:
 * `Doubao-Seed-Code`). Measured 2026-10-23 on a live CN account. Those rows work
 * — that is why P1 kept them — but they are not what Trae's main chat offers,
 * and mixing them into the default view is exactly the "a code model answering a
 * solo request" shape issue #52 asked about.
 */
declare const TRAE_COMMON_FUNCTIONS: Readonly<Record<TraeRegion, readonly string[]>>;
/**
 * The function a request for this row will NAME.
 *
 * A row with no `wireFunction` is not "unknown to the wire": the bridge sends
 * the region default (`TRAE_SOLO_FUNCTION`), so for every question about where
 * the turn goes, the default is the answer. The distinction still matters for
 * DISPLAY (`groupTraeModels` keeps these in their own group, because their
 * provenance — which directory group advertised them — really is unknown), but
 * not for scope: a `solo_work_lite` turn is a normal chat turn either way.
 */
declare function traeModelCallChannel(model: TraeOrderableModel): string;
/** Which slice of the catalog a view asks for. */
type TraeModelView =
/** Rows a normal chat turn can reach: {@link TRAE_COMMON_FUNCTIONS}. */
'common' |
/** Every callable row, specialist channels included. */
'all';
/**
 * Does this row belong to the view?
 *
 * Judged on {@link traeModelCallChannel}, never on `wireFunction` directly:
 * otherwise the one row without a function (`doubao_1_8`, measured 2026-10-23)
 * would fall OUT of the common view while being called through exactly the
 * common channel it belongs to.
 */
declare function traeModelInView(model: TraeOrderableModel, view: TraeModelView, region?: TraeRegion): boolean;
/** Keep the rows a view asks for, preserving order. */
declare function scopeTraeModels<T extends TraeOrderableModel>(rows: readonly T[], view: TraeModelView, region?: TraeRegion): T[];
//#endregion
//#region src/redact.d.ts
/**
 * Redaction helpers for diagnostics that a user may paste into a public issue.
 *
 * A verification report is only useful if it can be shared, and it is only safe
 * to share if it carries no personal identifiers. Paths are the hard case:
 * `C:\Users\<real name>\AppData\Roaming\Trae CN\...` contains both a real
 * account name AND the single most diagnostic token in the whole report (the
 * Trae data directory spelling). Redacting the whole path would make the report
 * worthless; printing it whole would leak the user's name. So the user segment
 * is replaced and the meaningful tail is preserved.
 *
 * @module dsh-connect-trae/redact
 */
/**
 * Replace the user segment of a path with `<user>`, keeping the rest intact.
 *
 * Handles the shapes a Trae install can produce:
 *   - `C:\Users\<name>\...` and `C:\Documents and Settings\<name>\...` (Windows)
 *   - `/Users/<name>/...` and `/home/<name>/...` (macOS / Linux)
 *
 * Anything after that segment — edition directory, `User\globalStorage`,
 * `storage.json` — is preserved verbatim, because that is what a report is
 * actually read for. Cross-platform on purpose: the function is called by
 * Windows-focused diagnostics, but the same helpers run in tests and on other
 * hosts, and a report from the wrong platform must not leak either.
 */
declare function maskUserPath(path: string): string;
/**
 * Describe a name by shape instead of by value: a character count, plus whether
 * it is purely numeric.
 *
 * This is the deliberate middle ground for account names. A Trae account name
 * is often a real name or a phone number, so it must never be printed; but the
 * report still needs to show that an account WAS resolved, and the shape
 * distinguishes a real nickname from a generated `用户<n>` id — which is the
 * only thing a reader needs to judge whether account discovery worked.
 */
declare function describeNameShape(name: unknown): string;
/**
 * Describe an identifier by shape instead of by value.
 *
 * A device id (`x-device-id`) is a stable installation identifier and is
 * directly tied to the upstream's per-device rules, so it is never printed.
 * Its shape still proves which resolution path ran: a real `icube-dc` id is
 * 15 digits, while the fallback is a 32-character hex hash.
 */
declare function describeIdShape(value: unknown): string;
//#endregion
//#region src/protocol.d.ts
declare const TRAE_CN_AGENT_TASK_PATH = "/api/agent/v3/create_agent_task";
declare const TRAE_CN_TITLE_PATH = "/api/agent/v3/llm_utils_chat";
interface OpenAITextMessage {
  role: 'assistant' | 'system' | 'user';
  content: string;
}
interface TraeAgentTaskBody {
  messages: {
    role: OpenAITextMessage['role'];
    content: {
      type: 'text';
      text: string;
    }[];
  }[];
  model: string;
  function: string;
  stream: true;
  request_id: string;
  session_id: string;
  max_tokens?: number;
}
/**
 * Evidence-bounded body draft. It is intentionally pure and offline; the
 * network client remains disabled until a controlled request validates it.
 */
declare function buildTraeAgentTaskBody(messages: readonly OpenAITextMessage[], model: string, options?: {
  maxTokens?: number;
  requestId?: string;
  sessionId?: string;
}): TraeAgentTaskBody;
type TraeHeaderProfile = 'agent-task' | 'model-detail' | 'raw-chat' | 'native-curl';
/**
 * Numeric version code sent when the persisted build version is not a plain
 * integer. The upstream binds `x-app-version-code` / `x-ide-version-code` as a
 * number: Trae stores `iCubeLastVersion` as a dotted build string (observed
 * `2.3.76922` on TRAE SOLO CN 0.1.56), which the server rejects with
 * `4001 ... expr_path=app_version_code, cause=parameter type does not match
 * binding data`. Verified 2026-08-29: with a numeric code the same request
 * returns HTTP 200 + `text/event-stream` on
 * `/api/agent/v3/llm_utils_chat` (`solo_work_lite`).
 *
 * Only the *format* of this field is normalised. Machine, device and app
 * version stay exactly as persisted — nothing here impersonates a device.
 */
declare const TRAE_VERSION_CODE_FALLBACK = "20260716";
/** Keep a purely numeric build version; fall back when it cannot bind. */
declare function normalizeTraeVersionCode(buildVersion: string | undefined): string;
/**
 * Headers shared by every Trae edition. The same shape is accepted by both
 * gateways (verified read-only on the international gateway 2026-09-15,
 * docs/INTL_SG_EVIDENCE.md §2.3: identical `x-app-id`, identity headers, and
 * `Cloud-IDE-JWT` auth), so there is no per-edition branch any more.
 */
declare function buildTraeHeaders(credential: TraeCredential, identity: TraeIdentity, options?: {
  appId?: string;
  requestId?: string;
  profile?: TraeHeaderProfile;
}): Record<string, string>;
/** Backwards-compatible alias; the headers are no longer CN-specific. */
declare const buildTraeCnHeaders: typeof buildTraeHeaders;
declare function traeEndpoint(baseUrl: string, path: string): string;
//#endregion
//#region src/raw-chat.d.ts
declare const TRAE_RAW_CHAT_V2_PATH = "/api/ide/v2/llm_raw_chat";
declare const TRAE_RAW_CHAT_V1_PATH = "/api/ide/v1/llm_raw_chat";
/**
 * Normalise a tool `parameters` schema from JSON Schema draft-3 style to
 * draft-4 style (issue #49).
 *
 * Draft-3 declared a required property by putting a boolean `required: true`
 * INSIDE the property schema:
 *
 *   { "type": "object", "properties": { "tool": { "type": "string", "required": true } } }
 *
 * Draft-4 removed the per-property boolean and uses a parent-level string
 * array instead: `{ "required": ["tool"] }`. The Trae backends disagree on how
 * strictly they check this: the Zhipu backend (glm-5.2) tolerates draft-3
 * `required: true`, but the DeepSeek backend (deepseek-v4.1-flash) rejects the
 * whole request with `4027 … tools.N.function.parameters/properties/X/required:
 * invalid JSON Schema` whenever ANY tool carries the boolean form — and
 * `tools.N` are validated as a batch, so one bad schema fails the entire turn
 * (issue #49, after #48). Since a model's backend is chosen by the upstream
 * router and can change per config, every tool-carrying request must be
 * draft-4 clean regardless of which backend the probe last saw.
 *
 * The rewrite is local, idempotent, and recursive: it lifts each boolean
 * `required` up to the enclosing schema's `required` array (merging with any
 * array already present), then drops the boolean. Non-object property entries
 * are left untouched — draft-4 forbids boolean schemas anyway, so no boolean
 * `required` can hide inside them.
 */
declare function normalizeTraeToolSchema(value: unknown): unknown;
/** Issue #49: apply `normalizeTraeToolSchema` to an OpenAI-style tool list. */
declare function normalizeTraeToolSchemas<T>(tools: readonly T[]): T[];
type RawChatRole = 'assistant' | 'system' | 'tool' | 'user';
interface RawChatTextContent {
  type: 'text';
  text: string;
}
interface RawChatImageContent {
  type: 'image_url';
  image_url: {
    url: string;
  };
}
type RawChatContent = RawChatTextContent | RawChatImageContent;
interface RawChatToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}
interface RawChatMessage {
  role: RawChatRole;
  content: string | RawChatContent[];
  tool_call_id?: string;
  tool_calls?: RawChatToolCall[];
}
interface RawChatTool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
}
interface TraeRawChatDraft {
  model: string;
  messages: RawChatMessage[];
  stream: true;
  tools?: RawChatTool[];
  max_tokens?: number;
  temperature?: number;
  reasoning_effort?: string;
  extra_info?: Record<string, unknown>;
}
/**
 * Evidence-bounded OpenAI-like draft inferred from Trae's LLMRaw* DTO symbols.
 * Pure/offline only: the upstream remains disabled until one controlled probe.
 */
declare function buildTraeRawChatDraft(input: {
  model: string;
  messages: readonly RawChatMessage[];
  tools?: readonly RawChatTool[];
  maxTokens?: number;
  temperature?: number;
  reasoningEffort?: string;
  extraInfo?: Record<string, unknown>;
}): TraeRawChatDraft;
type RawChatDelta = {
  type: 'text';
  text: string;
} | {
  type: 'reasoning';
  text: string;
} | {
  type: 'tool-call';
  index: number;
  id?: string;
  name?: string;
  arguments?: string;
} | {
  type: 'usage';
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  /** Cache-read tokens (`prompt_tokens_details.cached_tokens` / `cached_tokens`). */
  cacheReadTokens?: number;
  /** Cache-write tokens (`prompt_tokens_details.cache_write_tokens`). */
  cacheWriteTokens?: number;
} | {
  type: 'done';
  finishReason: string;
} | {
  type: 'unknown';
  value: unknown;
};
/** Decode OpenAI-like raw-chat chunks while preserving unknown structures. */
declare function decodeRawChatChunk(value: unknown): RawChatDelta[];
//#endregion
//#region src/raw-envelope.d.ts
interface TraeFusionRawChatEnvelope {
  arg: TraeRawChatDraft;
  args_hash: string;
  config_json: string;
}
/** Stable JSON hash candidate used by the native DTO's arg/args_hash fields. */
declare function hashTraeRawChatArg(arg: TraeRawChatDraft): string;
/**
 * Evidence-bounded fusion envelope candidate. The native DTO exposes exactly
 * arg/args_hash/config_json, but the hash algorithm and config_json contents
 * remain candidates until a live response validates them.
 */
declare function buildTraeFusionRawChatEnvelope(arg: TraeRawChatDraft, config: Record<string, unknown>): TraeFusionRawChatEnvelope;
//#endregion
//#region src/raw-runtime-config.d.ts
interface TraeRawChatRuntimeConfig {
  configName: string;
  modelName: string;
  promptMaxTokens?: number;
  maxTokens?: number;
  maxTurn?: number;
  multimodal?: boolean;
  nativeFunctionCall?: boolean;
  passBackReasoning?: boolean;
  useV2Process?: boolean;
  maxModeEnabled?: boolean;
  maxToolcallChars?: number;
  streamThrottleEnabled?: boolean;
  customConfig?: Record<string, unknown>;
}
/** Merge safe current-cache facts with observed behavior flags; no network credentials enter this object. */
declare function traeRawChatExtraInfo(config: TraeRawChatRuntimeConfig): Record<string, unknown>;
declare function buildTraeRawChatRuntimeConfig(modelName: string, cached: TraeCachedModelConfig | undefined, behavior?: TraeRawChatBehaviorConfig): TraeRawChatRuntimeConfig;
//#endregion
//#region src/raw-resolver.d.ts
interface TraeRawResolverResult {
  identity: TraeIdentity;
  runtime: TraeRawChatRuntimeConfig;
}
/** Resolve current desktop identity and safe cached model config for capability probing. */
declare function resolveTraeRawRuntime(store: TraeCredentialStore, modelName: string): Promise<TraeRawResolverResult>;
//#endregion
//#region src/raw-fingerprint.d.ts
/** Stable non-secret fingerprint for capability-cache invalidation. */
declare function rawCapabilityFingerprint(input: {
  endpoint: string;
  edition: string;
  identity: Pick<TraeIdentity, 'appVersion' | 'buildVersion'>;
  runtime: TraeRawChatRuntimeConfig;
}): string;
//#endregion
//#region src/raw-capability.d.ts
type TraeRawChatCapability = {
  available: true;
  contentType: string | null;
} | {
  available: false;
  reason: 'authentication' | 'credit' | 'rate' | 'protocol' | 'transport' | 'server';
  status: number;
};
/** One short non-tool request decides whether Raw Chat may become primary. */
declare function probeTraeRawChatCapability(client: TraeUpstreamClient, signal?: AbortSignal): Promise<TraeRawChatCapability>;
//#endregion
//#region src/raw-diagnostic.d.ts
type TraeRawDiagnosticState = 'disabled' | 'unchecked' | 'available' | 'protocol-gated' | 'authentication' | 'credit' | 'rate' | 'transport' | 'server';
interface TraeRawDiagnostic {
  state: TraeRawDiagnosticState;
  checkedAtMs?: number;
  status?: number;
}
/** Project capability facts to a redacted, user-safe status. */
declare function rawCapabilityDiagnostic(enabled: boolean, capability?: TraeRawChatCapability, checkedAtMs?: number): TraeRawDiagnostic;
//#endregion
//#region src/raw-gateway.d.ts
interface TraeRawGatewayOptions {
  raw: TraeUpstreamClient;
  solo: TraeUpstreamClient;
  endpoint: string;
  edition: string;
  identity: Pick<TraeIdentity, 'appVersion' | 'buildVersion'>;
  runtime: TraeRawChatRuntimeConfig;
  enabled?: boolean;
}
interface TraeRawGateway {
  upstream: TraeUpstreamClient;
  probe(signal?: AbortSignal): ReturnType<typeof probeTraeRawChatCapability>;
  diagnostic(): TraeRawDiagnostic;
  invalidate(): void;
}
/** Assemble the opt-in capability state and safe Raw→SOLO routing. */
declare function createTraeRawGateway(options: TraeRawGatewayOptions): TraeRawGateway;
//#endregion
//#region src/raw-upstream.d.ts
interface TraeRawChatConfig {
  model: string;
  configName: string;
  promptSet?: string;
  abVersion?: string;
  passBackReasoning: boolean;
  extraInfo?: Record<string, unknown>;
  runtime?: TraeRawChatRuntimeConfig;
}
interface TraeRawChatClientOptions {
  credential: () => Promise<TraeCredential>;
  identity: () => Promise<TraeIdentity>;
  config: TraeRawChatConfig;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}
type TraeRawChatFailureReason = 'empty' | 'json' | 'schema' | 'permission' | 'model' | 'generic-http' | 'other';
declare function classifyTraeRawChatFailure(message: string): TraeRawChatFailureReason;
/**
 * Evidence-gated Raw Chat client. It is fully testable through injected fetch,
 * but production callers must not construct it without verified config values.
 */
declare class TraeRawChatUpstreamClient {
  private readonly options;
  private readonly fetchImpl;
  constructor(options: TraeRawChatClientOptions);
  chatStream(bodyJson: string, signal?: AbortSignal): Promise<TraeChatResult>;
}
//#endregion
//#region src/raw-capability-state.d.ts
interface TraeRawCapabilitySnapshot {
  capability?: TraeRawChatCapability;
  checkedAtMs?: number;
  fingerprint?: string;
}
/** In-memory capability state; success/failure expires and config changes invalidate it. */
declare class TraeRawCapabilityState {
  private readonly ttlMs;
  private snapshot;
  constructor(ttlMs?: number);
  current(fingerprint: string, now?: number): TraeRawChatCapability | undefined;
  record(fingerprint: string, capability: TraeRawChatCapability, now?: number): void;
  inspect(): Readonly<TraeRawCapabilitySnapshot>;
  invalidate(): void;
}
//#endregion
//#region src/raw-capability-controller.d.ts
interface TraeRawCapabilityControllerOptions {
  client: TraeUpstreamClient;
  state?: TraeRawCapabilityState;
  enabled?: boolean;
}
/** Explicitly-triggered, single-flight Raw Chat capability checks. */
declare class TraeRawCapabilityController {
  private readonly options;
  private readonly state;
  private enabled;
  private inflight;
  constructor(options: TraeRawCapabilityControllerOptions);
  current(fingerprint: string): TraeRawChatCapability | undefined;
  setEnabled(enabled: boolean): void;
  inspect(): Readonly<TraeRawCapabilitySnapshot>;
  isEnabled(): boolean;
  invalidate(): void;
  probe(fingerprint: string, signal?: AbortSignal): Promise<TraeRawChatCapability>;
}
//#endregion
//#region src/fallback-upstream.d.ts
interface TraeFallbackUpstreamOptions {
  primary: TraeUpstreamClient;
  fallback: TraeUpstreamClient;
  onFallback?: (result: Extract<TraeChatResult, {
    ok: false;
  }>) => void;
}
/**
 * Optional primary route first, native SOLO tool-call route second. Fallback is intentionally narrow:
 * only definitive pre-stream schema/route incompatibilities may retry the same
 * user request. Authentication, credit, rate, cancellation, transport/server
 * failures, and every successful Response are never replayed.
 */
declare class TraeFallbackUpstreamClient implements TraeUpstreamClient {
  private readonly options;
  constructor(options: TraeFallbackUpstreamOptions);
  chatStream(bodyJson: string, signal?: AbortSignal): Promise<TraeChatResult>;
  private canFallback;
}
//#endregion
//#region src/gated-upstream.d.ts
interface TraeGatedUpstreamOptions {
  raw: TraeUpstreamClient;
  solo: TraeUpstreamClient;
  capability(): TraeRawChatCapability | undefined;
  onFallback?: (failure: Extract<TraeChatResult, {
    ok: false;
  }>) => void;
}
/** Select Raw Chat only after a successful capability probe; SOLO is the safe default. */
declare class TraeGatedUpstreamClient implements TraeUpstreamClient {
  private readonly options;
  constructor(options: TraeGatedUpstreamOptions);
  chatStream(bodyJson: string, signal?: AbortSignal): Promise<TraeChatResult>;
}
//#endregion
//#region src/refresh.d.ts
/**
 * Stable device identity for the DeviceInfo body, sourced from the app's own
 * storage. Every field except `deviceId`/`machineId` is optional: the server
 * requires `DeviceID`, `PlatformCode` and `DeviceType` (verified: dropping
 * `DeviceType` yields `20403`, dropping `MachineID` does not), so a machine that
 * cannot read the cosmetic fields must still be able to refresh.
 */
interface TraeRefreshDevice {
  deviceId: string;
  machineId: string;
  deviceName?: string;
  deviceModel?: string;
  deviceBrand?: string;
  deviceCpu?: string;
  osVersion?: string;
  appVersion?: string;
  /**
   * The install's registered keypair, read from `storage.json`. Its presence is
   * exactly what decides whether the CURRENT contract can be attempted: without
   * it there is no proof to sign, and the server would answer `20405`.
   */
  deviceKeyPair?: {
    privateKeyPEM: string;
    publicKeyPEM: string;
  };
}
/**
 * Exchange a refresh token for a fresh access token.
 *
 * The CURRENT contract is attempted first whenever it is possible at all — it is
 * what the shipped clients use. It needs the install's device keypair; without
 * one there is nothing to sign, so the request is skipped rather than sent to be
 * rejected with `20405`.
 *
 * The SUPERSEDED contract is then tried as a fallback, which is what keeps older
 * installs and CLI-only machines working; it carries no device block but the
 * SAME per-edition ClientID, because that split belongs to the OAuth client
 * rather than to the endpoint (see {@link legacyBody}). When both are impossible
 * or both fail, the error names every attempt so a "sign in again" verdict is
 * diagnosable rather than mysterious.
 */
declare function refreshTraeCredential(credential: TraeCredential, signal?: AbortSignal, device?: TraeRefreshDevice): Promise<TraeRefreshOutcome>;
//#endregion
//#region src/sse.d.ts
interface SseEvent {
  event?: string;
  data: string;
  id?: string;
  retry?: number;
}
/** Incremental SSE decoder supporting CRLF, chunk splits and multi-line data. */
declare class SseDecoder {
  private buffer;
  private event;
  private id;
  private retry;
  private data;
  push(chunk: string): SseEvent[];
  finish(): SseEvent[];
  private consumeLine;
  private dispatch;
}
type TraeStreamEvent = {
  type: 'queue';
  position?: number;
} | {
  type: 'progress';
  notice: unknown;
} | {
  type: 'delta';
  text: string;
  reasoning?: string;
  toolCalls?: unknown;
} | {
  type: 'usage';
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  reasoningTokens?: number;
  /**
   * Trae's prompt-cache accounting (`cache_read_input_tokens` /
   * `cache_creation_input_tokens` on the `token_usage` event). Verified
   * 2026-09-22 (docs/ISSUE10_DIAGNOSIS.md): a byte-identical 9224-token
   * prompt reports `prompt_tokens: 9224` while `cache_read_input_tokens`
   * rises to 9216, so these are a *subset* of `prompt_tokens` — the OpenAI
   * convention, not Anthropic's exclusive one. Forwarding them as
   * `cached_tokens` is therefore arithmetically correct.
   */
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
} | {
  /**
   * The upstream's own account of how the request was served: `metadata`
   * (acceptance, plus `prompt_cache_pool_record`) and `timing_cost` (the
   * pipeline and the backing provider model).
   *
   * These events were previously folded into `unknown` and dropped. That
   * mattered for issue #67: `prompt_cache_pool_record` is the ONLY upstream
   * signal that says whether a prompt-cache pool was even attached to the
   * request, so with it dropped a "0% cache" report could not be told apart
   * from a plugin that lost the numbers. See docs/ISSUE67_DIAGNOSIS.md.
   */
  type: 'diagnostic';
  /**
   * `metadata.prompt_cache_pool_record`. `null` is a real, observed value
   * (100% of measured requests on 2026-10-28) and means the upstream attached
   * no cache pool; it is kept distinct from "the field was absent".
   */
  promptCachePoolRecord?: unknown;
  /** `timing_cost.name`, e.g. `llm_raw_chat_v2`. */
  pipeline?: string;
  /** `timing_cost.provider_model_name` — the model that actually answered. */
  providerModelName?: string;
} | {
  type: 'done';
  finishReason: string;
} | {
  type: 'unknown';
  event?: string;
  data: unknown;
};
declare function decodeTraeEvent(event: SseEvent): TraeStreamEvent;
//#endregion
//#region src/solo.d.ts
declare const TRAE_SOLO_CHAT_PATH = "/api/agent/v3/llm_utils_chat";
declare const TRAE_SOLO_MODELS_PATH = "/api/ide/v1/get_detail_param";
declare function prepareSoloBody(source: string, defaultModel?: string, functionName?: string): string;
interface TraeSoloModel {
  id: string;
  name: string;
  contextWindow?: number;
  maxTokens?: number;
  reasoning?: TraeReasoningCapability;
  /** Effective (post-discount) credit multiplier, as the Trae IDE shows it. */
  creditMultiplier?: number;
  /**
   * The row's `activity_discount` rule, read from `display_contact_config`.
   * Display data only: src/promo.ts decides at paint time whether a badge shows.
   */
  activityDiscount?: TraeActivityDiscount;
  /** The directory function that listed this config (replayed when calling it). */
  function?: string;
  /**
   * Upstream's `usage` for this config — `chat_completion` for a model,
   * `custom_model` for the account's own custom model, and one value per
   * built-in tool config. Absent means upstream did not say.
   *
   * The merge layer needs it to tell a MODEL from a TOOL (issue #46).
   */
  usage?: string;
  /**
   * Upstream's `config_source` — 1 for a Trae preset, 3 for the account's own
   * custom model. Absent means upstream did not say.
   */
  configSource?: number;
}
interface TraeSoloClientOptions {
  credential(): Promise<TraeCredential>;
  identity(): Promise<TraeIdentity>;
  baseUrl?: string;
  /**
   * Which chat gateway this client is pinned to. Omitted = `solo`, the consumer
   * pool. `enterprise` targets the tenant-billed `console.enterprise` gateway
   * and stamps the per-call `session_id` it requires (see
   * {@link TRAE_ENTERPRISE_HOST}).
   *
   * Pinned per CLIENT, never chosen per call: a turn must not be able to drift
   * from the pool the user picked, so the route is fixed when the provider is
   * built and every request that client makes stays on it.
   */
  route?: TraeChatRoute;
  fetchImpl?: typeof fetch;
  log?: (message: string, detail?: unknown) => void;
}
/** Which chat pool a client is pinned to. */
type TraeChatRoute = 'solo' | 'enterprise';
declare class TraeSoloUpstreamClient {
  private readonly options;
  private readonly fetchImpl;
  constructor(options: TraeSoloClientOptions);
  /**
   * Read the callable roster for this credential's region.
   *
   * Every function in {@link TRAE_DIRECTORY_FUNCTIONS} is asked, in order, and
   * their answers are unioned: the first function to list a `config_name` owns
   * it. Trae splits its roster across SOLO modes, and a model is only callable
   * through the function that lists it (glm-5.3 exists solely under
   * `solo_work_remote` on the CN gateway). Asking one function therefore
   * silently hides models that the other one serves. The remote directory
   * remains the merge skeleton, so agent-internal entries (search_agent_*,
   * paygo variants) never surface even though they appear here.
   */
  fetchModels(signal?: AbortSignal): Promise<TraeSoloModel[]>;
  /** Merge one function's config list into the shared catalogue (first wins). */
  private collectModels;
  chatStream(bodyJson: string, signal?: AbortSignal, functionName?: string): Promise<TraeChatResult>;
  /** Chat gateway for this client's pinned route. */
  private chatBaseOf;
}
//#endregion
//#region src/solo-bridge.d.ts
/**
 * One upstream failure as Trae reports it inside a 200 SSE body: an `error`
 * event, or any event carrying a `code` at or above Trae's error band.
 */
interface TraeFailure {
  code?: number;
  message: string;
  extra?: unknown;
}
/** A readable message for an in-stream Trae failure, with its code preserved. */
declare function describeTraeFailure(failure: TraeFailure): string;
/** Convert Trae's named SSE events into OpenAI chat-completion SSE chunks. */
declare function bridgeTraeSoloStream(response: Response, model: string): Response;
/**
 * One resolved wire target: the `config_name` `llm_utils_chat` accepts, plus
 * the directory function that listed it. Trae's roster is split across several
 * SOLO-mode functions and a model is only callable through the one listing it
 * (glm-5.3 answers only under `solo_work_remote`), so the chat call replays it.
 */
interface TraeWireTarget {
  configName: string;
  function?: string;
}
/** Resolves a display model id to its wire target (config_name + function). */
type TraeWireResolver = (displayId: string) => TraeWireTarget | undefined;
/**
 * The startup wire map for one region's merged directory.
 *
 * EVERY row is registered, not only the ones whose wire config_name differs
 * from the display id. The runtime catalog is filtered by `enabledModelIds`, so
 * a pool that targets a model the user never enabled for chat would otherwise
 * reach the bridge with no catalog row AND no mapping — and the request would
 * carry the raw id under the DEFAULT function, which answers `4001 config_name
 * rejected` (Doubao-Seed-Code is served only by `solo_agent_remote`;
 * `solo_work_lite` rejects it). The identity mapping is what keeps the
 * discovered function alive for those ids.
 *
 * First row wins a display name: two directory ids can share one (`Seed-Code`),
 * and overwriting would answer with the later row's config_name. Ids are
 * unique, so `byId` needs no such guard.
 */
declare function wireTargetsOf(models: readonly {
  id: string;
  name: string;
  wireConfigName?: string;
  wireFunction?: string;
}[]): {
  byId: Map<string, TraeWireTarget>;
  byName: Map<string, TraeWireTarget>;
};
/** Native SOLO client wrapper used by the loopback OpenAI adapter. */
declare class TraeSoloBridge implements TraeUpstreamClient {
  private readonly upstream;
  private readonly catalog?;
  private readonly wireResolver?;
  /**
   * Optional sink for the upstream's own diagnostics (`metadata` /
   * `timing_cost`). Issue #67: without it, `prompt_cache_pool_record: null`
   * was invisible, so "the upstream attached no cache pool" and "the plugin
   * lost the numbers" looked identical to a user reading a 0% cache rate.
   */
  private readonly log?;
  constructor(upstream: TraeUpstreamClient, catalog?: Pick<TraeCatalog, "current"> | undefined, wireResolver?: TraeWireResolver | undefined,
  /**
   * Optional sink for the upstream's own diagnostics (`metadata` /
   * `timing_cost`). Issue #67: without it, `prompt_cache_pool_record: null`
   * was invisible, so "the upstream attached no cache pool" and "the plugin
   * lost the numbers" looked identical to a user reading a 0% cache rate.
   */
  log?: ((message: string, detail?: unknown) => void) | undefined);
  chatStream(bodyJson: string, signal?: AbortSignal): Promise<TraeChatResult>;
}
//#endregion
//#region src/solo-remote.d.ts
declare const TRAE_SOLO_REMOTE_BASE = "https://solo.trae.cn/api/remote/v1";
interface TraeSoloRemoteCatalogOptions {
  credential(): Promise<TraeCredential>;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  /**
   * Diagnostics sink (wired to `ctx.logger.warn` by the plugin). Called only
   * on the interesting path — when a NON-official host served the directory
   * or is reused as the remembered first candidate — never on the happy path
   * of official-host-first.
   */
  log?: (message: string, detail?: unknown) => void;
  /**
   * Extra directory hosts whose rows are UNIONED into the primary answer.
   *
   * The base loop below stops at the FIRST host that answers non-empty. That is
   * the right rule for a FALLBACK chain (one host, mirrored), but it cannot
   * express "these hosts serve DIFFERENT pools" — and the primary host
   * answering successfully is exactly the case where another host's models
   * stay invisible. So these hosts are read SEPARATELY and merged, never added
   * as another candidate base: a candidate is skipped precisely when the
   * primary succeeds, which is always in the scenario that fails today.
   *
   * Measured 2026-10-24 on a live CN tenant credential:
   * `solo.trae.cn` (the primary) answered 36 ids and does NOT list
   * `DeepSeek-V4.1-Flash-1017`, while `console.enterprise.trae.cn` answered 24
   * and DOES list it (issue #46). Neither host is a superset of the other: 19
   * of the primary's ids are absent from the tenant answer, so REPLACING the
   * primary would trade one missing model for nineteen — a union is the only
   * shape that loses nothing.
   *
   * The primary answer wins every id collision, compared case-insensitively, and
   * a colliding extra row is dropped rather than capacity-competed: a
   * `preferStrongerRow` contest could rename a model the user has already saved
   * in `enabledModelIds` (`deriveCatalog` matches those ids EXACTLY), silently
   * dropping the model out of the selection.
   *
   * An extra host is asked ONLY when the credential being used can call that
   * pool at all (`region` must match the host, and a tenant host additionally
   * requires a tenant credential). The gate lives here rather than at the
   * construction site because the deciding fact — "is this credential a tenant
   * one?" — only exists once `credential()` has resolved, which is per refresh.
   * Gating on the PANEL instead missed the case that matters: a consumer store
   * does not hard-exclude tenant accounts (`auth.ts`'s `offered()` backs off
   * when its filter would hide everything), so a machine whose only login is a
   * tenant account resolves a tenant credential under the Trae panel too.
   */
  unionBaseUrls?: readonly string[];
  /**
   * Region an extra host serves. An `ai` credential never asks a `cn` host.
   *
   * `unionBaseUrls` used to be ungated by region, so a `DSH_TRAE_TENANT_IN_CONSUMER`
   * machine on the international panel issued the CN tenant request on every
   * refresh — a 401 the union skipped, but one wasted request and one warn log
   * per refresh (measured with an SG credential 2026-10-24).
   */
  unionRegion?: TraeRegion;
}
/**
 * Read-only model catalog client for the SOLO Web API.
 *
 * This deliberately has no chat/session method: the Remote session protocol
 * only exposes a final answer and cannot preserve DSH's structured tool loop.
 */
declare class TraeSoloRemoteCatalogClient {
  private readonly options;
  private readonly fetchImpl;
  private readonly baseUrl;
  /**
   * The last base that answered the directory with a NON-EMPTY catalog in this
   * process.
   *
   * A proxy-blocked network pays the failing official attempt on EVERY refresh
   * otherwise, so a backup that has served the catalog is tried first on later
   * refreshes. Putting the official base "second" is NOT enough to re-probe it:
   * the loop returns on the first success, so a backup that keeps answering
   * means the official base is never asked again. The official host is
   * therefore re-probed on a COOLDOWN instead (see {@link OFFICIAL_RETRY_MS}):
   * while the cooldown runs the backup is used and the official host is
   * skipped; when it expires the official host is tried FIRST again, so a
   * healed network takes over within one cooldown window rather than never.
   */
  private lastSuccessfulBase;
  /**
   * When the official base may be probed again after a transport/5xx failure,
   * as epoch milliseconds (0 = probe it on the next refresh).
   */
  private officialRetryAtMs;
  /**
   * How long a failing official host is skipped before it is re-probed.
   *
   * Long enough that a blocked network stops paying the failing attempt on
   * every refresh (the point of the fallback), short enough that a healed
   * network takes over without a restart. Each probe costs one connect timeout
   * (30 s) in the worst case, so 5 minutes bounds that to ~1 attempt per 5 min.
   */
  private static readonly OFFICIAL_RETRY_MS;
  /**
   * When each extra union host may be asked again after it failed, as epoch
   * milliseconds. Absent = ask it on the next refresh.
   *
   * The official host has {@link OFFICIAL_RETRY_MS} because a blocked network
   * would otherwise pay its failing connect on every refresh; an extra host has
   * the same problem and, since discovery (`discoverModels()`) passes no signal,
   * the same 30 s ceiling. A tenant host that is unreachable from this network
   * would therefore stall every refresh for up to 30 s. Same cooldown, same
   * reasoning — an unhelpful host is skipped for a while instead of retried
   * immediately.
   */
  private readonly extraRetryAtMs;
  private readonly unionBaseUrls;
  private readonly unionRegion;
  constructor(options: TraeSoloRemoteCatalogOptions);
  private headers;
  fetchModels(signal?: AbortSignal): Promise<TraeDiscoveredModel[]>;
  /**
   * Union the extra directory hosts' rows into the primary answer (issue #46).
   *
   * The base loop above returns on the FIRST host that answers non-empty, which
   * is correct for a FALLBACK chain but cannot express "these hosts serve
   * different pools" — the primary host answering is exactly the case where the
   * extra host's models would stay invisible forever. Hence a separate read and
   * a merge, not another candidate base (see `unionBaseUrls`).
   *
   * Every extra host is BEST-EFFORT: transport failure, non-2xx, an unreadable
   * body and an empty answer are each logged and skipped. Only an aborted
   * `signal` propagates — that is the caller cancelling, not a host being
   * unhelpful. Failing here must never fail a refresh the primary host already
   * satisfied, which is why a broken extra host costs models, not the catalog.
   * A failure also puts that host on {@link extraRetryAtMs} so a network that
   * cannot reach it stops paying its connect timeout on every refresh.
   */
  private unionWithExtraHosts;
  /**
   * Bases to try for one refresh, in order.
   *
   * While the official host is in its post-failure cooldown the backup hosts go
   * first and the official base is kept LAST as a final chance (so a still-down
   * backup does not fail the whole refresh while the official host happens to
   * be reachable). Once the cooldown expires the official base is first again:
   * that is what lets a healed network take over — the loop returns on the
   * first success, so simply placing the official base second never re-probes
   * it while a backup keeps answering.
   */
  private candidateBases;
  /**
   * Union every returned group into one deduplicated list, attributing each
   * model to the CHAT function the directory listed it under.
   *
   * Each group is a roster the gateway is willing to serve; a model listed by
   * any of them is a model the IDE can offer, and the wire join downstream (see
   * mergeTraeModelSources) is what decides whether it is actually callable.
   * Restricting this to `solo_agent_remote` dropped the nine models issue #19
   * was opened about.
   *
   * FUNCTION ATTRIBUTION (2026-10-20): a group is the authoritative statement
   * of which SOLO function a model belongs to — the accepted `config_name` is
   * isolated per function (glm-5.3 answers `solo_work_remote` and 4001s under
   * `solo_work_lite`). The wire join prefers its own `get_detail_param`
   * function and falls back to this one when the roster says nothing, which
   * restricted networks often do (measured: an empty `config_info_list` for
   * every chat function but `chat_v3`).
   *
   * ONLY CHAT-CAPABLE GROUPS ARE ATTRIBUTED. `solo_agent` and `builder_v3` are
   * IDE/Remote-agent rosters: asking `llm_utils_chat` with either answers
   * 4011/4001 (measured 2026-10-01 on a live credential, issue #19). A model
   * that appears ONLY there is still not uncallable, though — the SAME models
   * answered normally under `solo_work_remote` / `solo_work_lite` /
   * `solo_agent_remote` (measured the same day, see `TRAE_DIRECTORY_FUNCTIONS`
   * in solo.ts), and the default function is what has always reached them:
   * they are exactly the nine models issue #19's fix exposes (`gpt-5.5`,
   * `gpt-5.6-*`, `gpt-6-astra`, `glm-5.2`, `kimi-k2.7-code`,
   * `Dola-Seed-2.0-Code`, `deepseek-v4-flash-0731` — docs/ISSUE19_DIAGNOSIS.md).
   * Stamping `solo_agent` onto such a row makes every call 4011; DROPPING it
   * undoes issue #19 for exactly the restricted-network users this fallback
   * exists for. It therefore keeps NO function, the bridge falls back to the
   * default chat function exactly as before this change, and a refusal (if the
   * model really is unreachable) comes back as a readable upstream message
   * instead of a silent absence.
   *
   * CHAT GROUPS ARE WALKED IN `TRAE_DIRECTORY_FUNCTIONS` ORDER, not in the
   * request's `functions=` order. That list is the measured precedence of which
   * function serves a shared config, and it is the order the wire roster itself
   * collects in (`solo.ts`) — walking a different order would attribute the
   * same model differently depending on whether the roster answered, and the
   * difference is not cosmetic: `solo_agent_remote` sits after the two
   * `solo_work_*` functions because it is behind the Remote plan gate, so
   * preferring it can turn a free-tier model into a `1005 requires a paid
   * plan` refusal.
   *
   * A model appears in SEVERAL groups and the groups disagree about its
   * capacity, so dedupe keeps the MOST CAPABLE row rather than the first one
   * (issue #23). "First wins" assumed the group order was stable; measured
   * 2026-10-05 on a live CN credential it is not — five calls returned five
   * different orders — so the published window became a coin flip:
   * `Doubao-Seed-2.1-Pro` came back as `116000`/no-Max (`builder_v3`), or
   * `256000`/no-Max (`solo_work_*`), or `256000`/`1000000` (`chat_v3`,
   * `solo_agent*`) depending on which group answered first. The Max tier is
   * the one users enable in the IDE, and `applyContextBudgets` can only raise
   * a window to `maxContextWindow` — so losing that field silently capped
   * every configured 1M model at 256K or less, and DSH compressed far earlier
   * than the chosen budget implied.
   *
   * Ordering rule: a row advertising a Max tier beats one that does not, a
   * larger Max wins over a smaller one, and with no Max on either side the
   * wider dev window wins. Every row for one id carries the same
   * `multimodal` / `reasoning` / credit facts (verified the same day), so
   * choosing on capacity loses no capability. The result no longer depends on
   * the gateway's group order — and the FUNCTION does not either: the winning
   * row's capacity may come from a later group, but the separately-tracked
   * attribution is re-asserted on it.
   */
  private collectModels;
}
//#endregion
//#region src/delegating-upstream.d.ts
/** Stable shim dependency whose delegate can be replaced after async setup. */
declare class TraeDelegatingUpstreamClient implements TraeUpstreamClient {
  private delegate;
  constructor(delegate: TraeUpstreamClient);
  replace(delegate: TraeUpstreamClient): void;
  chatStream(bodyJson: string, signal?: AbortSignal): Promise<TraeChatResult>;
}
//#endregion
//#region src/usage.d.ts
/**
 * Read-only Trae usage/credits client.
 *
 * CN sources the verified `api.trae.cn` pay/ug endpoints (see
 * `docs/USAGE_API_RESEARCH.md`); the international (ai) region is
 * subscription-based and reads `ide_user_pay_status` on its own gateway
 * (verified 2026-09-15, docs/INTL_SG_EVIDENCE.md §4). All queries are
 * read-only and do not consume Trae credits. The per-session consumption
 * detail table is deliberately not included: the endpoint returns no rows
 * for the current account, so we only expose what is actually retrievable.
 */
declare const TRAE_PAY_BASE = "https://api.trae.cn";
interface TraeUsageOptions {
  credential(): Promise<TraeCredential | undefined>;
  /**
   * Device identity of the credential's own installation, sent as
   * `x-device-id` on the check-in routes.
   *
   * The claim endpoint is the one WRITE in this client, and it is guarded
   * server-side by that header: with the same Authorization but no
   * `x-device-id`, the upstream answers HTTP 200 with business code `9004`
   * ("The submitted order parameters are incorrect") and grants nothing —
   * verified 2026-09-24 against a live CN account, where adding the header
   * flipped the same request to `code: 0` and the daily reward landed. The
   * official client sends it on every check-in call
   * (`main.js`'s `fb(headers)` sets `x-device-id` from `guaranteedDeviceId`).
   * Absent, the client still reads status; only the claim refuses.
   */
  deviceId?(): Promise<string | undefined>;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  timeoutMs?: number;
}
/**
 * Subscription/pay status of an international (ai) account, parsed from the
 * `ide_user_pay_status` answer. The international region has no Work-credit
 * packs, so this — not `snapshot` — is its usage surface.
 */
interface TraePayStatus {
  isDollarUsageBilling: boolean;
  hasPackage: boolean;
  isPayFreshman: boolean;
  inTrial: boolean;
  trialEndTimeMs: number;
  enableSoloLite: boolean;
  enableSoloBuilder: boolean;
  enableSoloCoder: boolean;
  enableSoloWeb: boolean;
  /**
   * The account's plan identity (`user_pay_identity`), Trae's authoritative
   * tier number: `0` is Free. Measured 2026-10-01 on a live SG community
   * account, which reported `0` / `"Free"`.
   *
   * This is a DIFFERENT question from {@link hasPackage}, which asks whether a
   * package/entitlement object exists. A paying member can hold a plan
   * identity without any package row, which is why issue #19 saw "No active
   * package" on a Pro account — the card only ever read `has_package`.
   */
  payIdentity?: number;
  /** The plan identity as Trae spells it (`user_pay_identity_str`), e.g. `Free`. */
  payIdentityStr?: string;
  /** The fission (referral) program window and cap, when exposed. */
  fission?: {
    startTimeMs: number;
    expireTimeMs: number;
    maxUsage: number;
  };
}
interface TraeUsageSummary {
  totalAmount: number;
  consumedAmount: number;
  consumptionRatio: number;
}
interface TraeUsagePack {
  displayDesc: string;
  entitlementId: string;
  endTimeMs: number;
  currency: number;
  /** 0 = non-Work/general endpoint, 1 = Work endpoint. */
  availableEndpoint?: number;
  creditsLimit?: number;
  /** Credits consumed from this pack (`usage.credits_amount`). */
  consumedCredits?: number;
}
interface TraeUsageSnapshot {
  isCreditsBilling: boolean;
  isDollarUsageBilling: boolean;
  isPayFreshman: boolean;
  inTrial: boolean;
  trialEndTimeMs: number;
  summary: TraeUsageSummary;
  packs: TraeUsagePack[];
}
interface TraeCheckinStatus {
  /**
   * Whether the account's REWARD PACK for today already exists. This is the
   * account-wide answer and it is the one that decides whether there is
   * anything left to claim: a day with `checkedIn: true` has already been paid
   * out, whichever device produced it.
   */
  checkedIn: boolean;
  /** Reward for one check-in, as reported by the upstream (`credits`). */
  credits: number;
  enabled: boolean;
  /**
   * Whether THIS device's claim for today was already recorded. The upstream
   * keys this on the `x-device-id` the request carries — not on the account —
   * so it answers `true` for the device that claimed and `false` for the same
   * account and day read from any other device.
   *
   * Measured 2026-09-26 on a live CN account whose claim had succeeded minutes
   * earlier: `did_checked_in` was `true` with the claiming device id and
   * `false` with the header omitted, with a synthetic id, and with another
   * install's id. Repeating the read never flips it, so it is not "have I seen
   * you before" state either — only an actual claim sets it.
   *
   * It is therefore NOT a "today is done" signal on its own (claiming again
   * answers the upstream's own 9095 "该设备今日已参与签到" refusal); it is
   * evidence that this exact device is already accounted for, which is what
   * makes a claim safe to skip.
   */
  didCheckedIn: boolean;
  /** Bonus credit granted on top of the base reward, when the upstream reports one. */
  extraCredits?: number;
}
/** Result of claiming today's check-in reward. */
interface TraeCheckinClaim {
  /** Whether the upstream accepted the claim (`code === 0`). */
  claimed: boolean;
  /** Business code from the answer; `0` on success. */
  code: number;
  /** Upstream message, verbatim but truncated — never token material. */
  message: string;
}
interface TraeActivityRule {
  activityId: string;
  enabled: boolean;
  activityType: number;
  startTimeMs: number;
  endTimeMs: number;
  workExtra?: Record<string, unknown>;
}
interface TraeUsageView {
  snapshot: TraeUsageSnapshot;
  checkin: TraeCheckinStatus;
  activities: TraeActivityRule[];
}
/**
 * A client for the verified Trae usage/credits endpoints.
 *
 * Every method is read-only except {@link TraeUsageClient.claimCheckin}, which
 * claims the daily check-in reward — the one deliberate mutation, requested by
 * the user from the card and guarded before it is sent.
 */
declare class TraeUsageClient {
  private readonly options;
  private readonly fetchImpl;
  private readonly baseUrl;
  private readonly timeoutMs;
  constructor(options: TraeUsageOptions);
  /**
   * Region of the current credential; `cn` when unresolvable.
   *
   * A US credential throws {@link TraeUnsupportedRegionError} instead of being
   * rounded to the international bucket — issue #66: the rounding is what sent
   * a US token to the SG pay gateway, where the answer is 401.
   */
  private currentRegion;
  /**
   * Pay base for the current credential's region. An explicit baseUrl (tests,
   * diagnostics) pins the endpoint; otherwise CN uses `api.trae.cn` and the
   * international region its own verified pay gateway.
   */
  private payBase;
  /**
   * Device id for the check-in routes, or undefined when the machine's
   * installation identity cannot be read. Best-effort on purpose: a missing
   * identity must not break the read-only status query, which the upstream
   * answers with or without the header.
   */
  private deviceIdHeader;
  private authedHeaders;
  private post;
  /**
   * Subscription/pay status of an international (ai) account. The CN region
   * never calls this (its contract is unverified there); the ai region uses
   * this instead of the Work-credit `snapshot`.
   */
  payStatus(signal?: AbortSignal): Promise<TraePayStatus>;
  /**
   * The Work-credit endpoints are CN-only. The international region is
   * subscription-based and must read {@link payStatus} instead; guarding here
   * keeps the card's degraded `creditsError` message diagnosable rather than
   * letting an ai credential hit an unverified path on its pay gateway.
   */
  private requireCnRegion;
  /** Total entitlements / credits and per-pack breakdown. */
  snapshot(signal?: AbortSignal): Promise<TraeUsageSnapshot>;
  /**
   * Daily check-in status. Read-only, and answered with or without the device
   * header — the claim is what needs it.
   *
   * The read DOES carry the header whenever this installation has one, and
   * that is deliberate rather than incidental: `did_checked_in` is answered
   * per device, so omitting the header would make a device that already claimed
   * today look identical to one that never has (measured 2026-09-26, see
   * {@link TraeCheckinStatus.didCheckedIn}).
   */
  checkinStatus(signal?: AbortSignal): Promise<TraeCheckinStatus>;
  /**
   * Claim today's check-in reward. The ONLY state-changing call in this client.
   *
   * The upstream is idempotent per Beijing day (verified 2026-09-24: repeating
   * the call on an already-claimed day answers `code: 0` while the entitlement
   * total stays byte-identical), so a double click cannot double-grant. The
   * card and its route still guard, because "cannot double-grant" is a property
   * of the upstream we verify rather than one we rely on.
   *
   * A business refusal arrives as HTTP 200 with a non-zero `code` — most often
   * `9004` when the request carries no `x-device-id`. That is reported as
   * `claimed: false` rather than thrown, so the caller can tell "the upstream
   * refused this" apart from "the request never arrived".
   */
  claimCheckin(signal?: AbortSignal): Promise<TraeCheckinClaim>;
  /** Rewards / activity rules. */
  activities(signal?: AbortSignal): Promise<TraeActivityRule[]>;
  /** Convenience: snapshot + check-in + activities in one call (best-effort, non-fatal on missing). */
  view(signal?: AbortSignal): Promise<TraeUsageView>;
}
//#endregion
//#region src/account-pool.d.ts
/**
 * Which of the pool's writers produced a measurement.
 *
 * `test-batch` — the user pressed "test" (or the check-in batch), so the outcome
 *   is a deliberate measurement of the target model.
 * `live-request` — a real chat request failed and its failure was recorded so the
 *   NEXT request starts from a measurement instead of rediscovering the same wall.
 *
 * The distinction is diagnostic, not behavioural: both feed the same routing and
 * cooling logic. It exists so a user who watched an account measure `ok` and
 * later saw it limited can tell whether that was a later live failure (expected)
 * or an older value winning (a bug).
 */
type TraePoolProbeSource = 'test-batch' | 'live-request';
/** One account's pool entry: what the picker needs, plus its last measurement. */
interface TraePoolAccount {
  /** Stable account id (the same one `TraeWebAccount` carries). */
  id: string;
  /** Human name, or `''` when the desktop app recorded none. */
  accountName: string;
}
/**
 * What the pool knows about ONE account's last test of the target model.
 *
 * `undefined` means "never tested", which is deliberately distinct from every
 * measured outcome: an untested account is a candidate (the user may want to use
 * it now) whereas a measured failure is not. Collapsing the two would make a
 * fresh pool look empty until the first test.
 */
interface TraePoolProbe {
  outcome: TraePoolOutcome;
  /** When this measurement was taken, in epoch ms. */
  atMs: number;
  /** WHAT WROTE this measurement; absent for records written before it existed. */
  source?: TraePoolProbeSource;
  /**
   * When this account may be usable again, when the upstream stated a time.
   *
   * Present for a `rate-limited` / `out-of-credit` outcome whose failure carried
   * a reset sentence. ABSENT when the upstream named no time — that absence is
   * meaningful and must never be turned into a locally invented countdown.
   */
  retryAtMs?: number;
  /**
   * The upstream's own words on the failure, already redacted.
   *
   * Kept so the card can say WHY an account left the pool instead of repeating
   * one generic sentence for a DNS failure, a gateway 502 and a cancelled request
   * alike.
   */
  message?: string;
  /**
   * WHICH MODEL this measurement is about.
   *
   * `1005` (plan gate), `4001` (no SOLO function serves this `config_name`) and
   * `4011` (throttle) are all ACCOUNT × MODEL conditions: the same credential
   * answers other models at the same second. A row rendered as plain "可用"
   * therefore claims more than the measurement says. Storing the model id is what
   * makes the claim checkable.
   *
   * Deliberately NOT inherited when an update omits it — the opposite of
   * `accountName` and `retryAtMs`. Those describe the ACCOUNT (still true when a
   * later writer cannot see them); the model describes THIS measurement, and
   * carrying an older id forward would relabel a fresh measurement with a model
   * it was not taken on.
   */
  modelId?: string;
  /**
   * The account's display name AT THE MOMENT IT WAS MEASURED.
   *
   * Stored because a saved pool member can outlive its sign-in: once the desktop
   * app drops a login, that id resolves to no listed account and the card has
   * nothing left to render for it. The name was in hand at write time and nowhere
   * afterwards. Snapshots are never refreshed from a LISTING — only a real
   * measurement writes this.
   */
  accountName?: string;
}
/** One account's live credit situation, as the pool ranks it. */
interface TraePoolCredits {
  /** Remaining credit across every pack (`available` of the upstream snapshot). */
  total: number;
  /** The Work bucket, kept for display: SOLO chat does NOT spend it. */
  workAvailable?: number;
  /** The General bucket, kept for display: this is what SOLO chat spends. */
  generalAvailable?: number;
  /** Credits expiring within the card's "soon" window (3 days). */
  expiringSoon: number;
  /** When the nearest at-risk pack expires, if any does. */
  nearestExpiryMs?: number;
}
/**
 * Everything the ranking rule reads about one account. Assembled by the Host from
 * the credential store, the per-account credit read, and the runtime probe store
 * — this module only consumes it.
 */
interface TraePoolMember {
  account: TraePoolAccount;
  credits?: TraePoolCredits;
  probe?: TraePoolProbe;
  /** When the stored credential expires, used as the final tie-break. */
  tokenExpiresAtMs?: number;
}
/**
 * How one account answered the target model.
 *
 * The first nine values are the workbuddy taxonomy verbatim so the two cards read
 * the same. The tenth, `plan-gated`, is Trae-only: upstream `1005` says THIS
 * account's plan does not cover this model while another account's plan may, and
 * no amount of waiting changes a plan — so it must not be folded into
 * `credential-rejected` (which would demand a re-login) nor into
 * `policy-rejected` (which means a content filter tripped on ONE request).
 */
type TraePoolOutcome = 'ok' | 'rate-limited' | 'model-busy' | 'out-of-credit' | 'credential-rejected' | 'policy-rejected' | 'plan-gated' | 'unavailable' | 'not-found' | 'failed';
//#endregion
//#region src/model-probe.d.ts
/** How one model answered. */
type TraeProbeVerdict = 'available' | 'gated' | 'unsupported' | 'rate_limited' | 'auth' | 'unknown';
interface TraeProbeResult {
  /** The model id as the card knows it. */
  id: string;
  verdict: TraeProbeVerdict;
  /** Upstream's own words (already translated), or a short note. */
  detail: string;
}
/**
 * How long one probe may take. Trae answers a one-word prompt in a few seconds;
 * beyond this the answer is not worth waiting for and is reported as unknown.
 */
declare const TRAE_PROBE_TIMEOUT_MS = 30000;
/**
 * Classify a failure that arrived as a thrown stream error rather than a
 * returned result.
 *
 * The bridge errors the stream (instead of returning a result) when a refusal
 * interrupts an answer that had already started; its message is the same
 * translated text, so a named code is still decisive. Anything without a
 * recognised code — an abort, a socket reset, a proxy — stays `unknown`.
 */
declare function classifyProbeError(message: string): {
  verdict: TraeProbeVerdict;
  detail: string;
};
/**
 * Classify a completed upstream call.
 *
 * `result` is what `TraeSoloBridge.chatStream` returned, so a refusal that
 * arrived inside a 200 body has already been turned into a real error result
 * (and its code translated into `message`) by the bridge — this function only
 * has to read it back.
 */
declare function classifyProbeResult(result: TraeChatResult, outputSeen: boolean): {
  verdict: TraeProbeVerdict;
  detail: string;
};
/**
 * The chat call one probe makes.
 *
 * `inputTokens` pads the user turn so the probe carries roughly as much text as
 * a real conversation. Size matters because an upstream that refuses LARGE
 * requests will happily answer a one-word probe, and a verdict earned by a
 * 1-token request says nothing about the 30k-token turn the user is about to
 * send. `0` keeps the historical minimal probe (one word) — that is the default
 * because it spends the least credit and answers the question the pool ranks on
 * ("can this account talk at all").
 *
 * The filler is `x` words: one ASCII word is about one token, so the body size
 * is predictable (tokens ≈ inputTokens × 2 characters) without a tokenizer.
 */
/**
 * The largest probe this plugin will pad.
 *
 * A 100k-token probe is already ~200 KB of JSON; anything above that is a request
 * the user's real turn would not plausibly reach in this product, and a config
 * file edited by hand must not turn one "test all" click into a multi-megabyte
 * upload.
 */
declare const MAX_PROBE_INPUT_TOKENS = 100000;
declare function probeBody(model: string, inputTokens?: number): string;
/**
 * Probe one model through the bridge the plugin actually chats with, so the
 * recorded verdict describes the user's real path (same wire resolution, same
 * function stamping, same error translation).
 */
declare function probeOneModel(chat: (body: string, signal?: AbortSignal) => Promise<TraeChatResult>, id: string, timeoutMs?: number, inputTokens?: number): Promise<TraeProbeResult>;
/**
 * Probe a list of models ONE AT A TIME.
 *
 * Sequential on purpose: Trae throttles bursts, and a burst of parallel probes
 * would manufacture the very `rate_limited`/`unknown` verdicts this feature
 * must avoid. An authentication failure stops the run — every later probe would
 * fail the same way, and spending calls to learn that again is waste.
 */
declare function probeModelsSequentially(chat: (body: string, signal?: AbortSignal) => Promise<TraeChatResult>, ids: readonly string[], onResult?: (result: TraeProbeResult, index: number) => void): Promise<TraeProbeResult[]>;
//#endregion
//#region src/account-pool-run.d.ts
/** One account's check-in outcome. */
interface TraePoolCheckinRow {
  accountId: string;
  accountName: string;
  /**
   * - `claimed` — the upstream accepted today's claim for this account.
   * - `already` — this ACCOUNT's reward for today already exists, so nothing was sent.
   * - `device-already` — the MACHINE already spent today (9095). Not an account
   *   failure and not a success: a truthful "no, this device is used up".
   * - `disabled` — the upstream's check-in activity is not enabled/active for
   *   this account. Reported separately rather than as `failed`, because claiming
   *   is impossible by policy and calling it an error would read as a broken
   *   plugin.
   * - `failed` — the request never landed, or the credential could not be read.
   */
  status: 'claimed' | 'already' | 'device-already' | 'disabled' | 'failed';
  /** Credits the upstream says this claim carries, when it stated a figure. */
  credit?: number;
  /** The upstream's own words on failure/refusal, redacted by the caller. */
  message?: string;
}
/** One account's test outcome. */
interface TraePoolTestRow {
  accountId: string;
  accountName: string;
  /** The model this row was probed on — one model per batch, recorded per row. */
  modelId: string;
  outcome: TraeProbeResult['verdict'];
  /** Upstream's own words / the plugin's reading of the code. */
  detail: string;
  /** A time the upstream named, when it named one. */
  retryAtMs?: number;
}
//#endregion
//#region src/web-status.d.ts
/**
 * Constructor dependencies. Everything panel-specific is addressed by the
 * panel the request names: the two regions are separate provider stacks, so
 * the card must be served the directory, selection, and credits of the tab the
 * user is on.
 */
interface TraeUsageRouteOptions {
  /** The panel-scoped credential store backing each region's requests. */
  store(panel: TraePanel): TraeCredentialStore;
  /** The panel-scoped usage client (CN work credits / international pay status). */
  client(panel: TraePanel): TraeUsageClient;
  /**
   * CN credit balances of an account OTHER than the bound one, read without
   * changing which account is bound (issue #25). Optional: when absent the
   * exhausted-account hint is simply not offered.
   */
  creditsOfAccount?(panel: TraePanel, accountId: string): Promise<TraeWebCredits | undefined>;
  /**
   * Remove ONE account's plugin-owned credential copy, leaving Trae's own login
   * untouched, and report whether the account still signed in to Trae (which the
   * card must echo as "sign out in Trae", not as a deletion that failed).
   * Optional: absent means the pool table's destructive action is not offered.
   */
  deleteAccountOf?(panel: TraePanel, accountId: string): Promise<{
    deleted: boolean;
    stillSignedIn: boolean;
    hadCopy?: boolean;
    signedOutApps?: readonly string[];
    blockedApps?: readonly string[];
  }>;
  /**
   * Where the panel's credential copies live and how many there are, so the card
   * can name the file instead of asserting "a copy exists". Optional: absent
   * means the card says nothing about the file.
   */
  copiesOf?(panel: TraePanel): Promise<{
    path: string;
    count: number;
  } | undefined>;
  /**
   * Per-account status for one row of the card's account table: CN → check-in
   * + balances, ai → subscription. Read without changing which account is
   * bound. Optional: when absent the account rows show no check-in/credits/
   * subscription figures (the table still lists each account and its switch).
   */
  accountStateOf?(panel: TraePanel, accountId: string): Promise<TraeWebAccountState | undefined>;
  /**
   * Claim today's check-in reward for ONE named account, without moving the
   * binding. Optional: absent means the per-row claim button is disabled (the
   * check-in surface simply is not offered).
   */
  claimCheckinOf?(panel: TraePanel, accountId: string): Promise<{
    claim: TraeCheckinClaim;
    checkin: TraeCheckinStatus;
  } | undefined>;
  /** The requested region's last-refreshed raw directory (one entry per upstream model). */
  displayModels(panel: TraePanel): readonly TraeModelInfo[];
  /** The user's model selection in the requested panel, stored as model id (= Trae name). */
  enabledModelIds(panel: TraePanel): readonly string[];
  /**
   * Whether the requested region's provider is currently offered to DSH. The
   * card renders this as the tab's on/off checkbox, so the switch reflects the
   * committed settings value rather than a local guess.
   */
  regionEnabled(panel: TraePanel): boolean;
  /** Re-read one region's live directory from the upstream. */
  discoverModels?(panel: TraePanel, signal?: AbortSignal): Promise<readonly TraeModelInfo[]>;
  /**
   * Test the given model ids for availability, one real (minimal) chat call
   * each. Present only when the region's chat path is wired.
   */
  probeModels?(panel: TraePanel, ids: readonly string[]): Promise<{
    results: {
      id: string;
      verdict: string;
      detail: string;
    }[];
    skipped?: string[];
  }>;
  /** Raw-Chat capability state of the requested panel. */
  rawDiagnostic?(panel: TraePanel): TraeRawDiagnostic;
  /**
   * The account pool's host side, when the panel can run one. Optional on
   * purpose: the pool is an add-on to the status document, and a harness without
   * it (a test host, or a panel stack that failed to build) must still get a
   * complete usage answer with no `pool` field.
   */
  pool?: TraePoolDeps;
}
/**
 * What the pool surface needs from the Host, addressed by panel.
 *
 * The split is deliberate. The card never learns a credential and never writes a
 * measurement: it sends an ACTION (`checkin` / `test` / `remove`) and reads the
 * ranking back out of the status document. Everything here is therefore either a
 * cheap local read (preferences, roster, saved names) or an explicitly user-
 * triggered spend (the batches). The one thing that must never happen on a GET is
 * an upstream call made for every row on every poll — the card already lazy-loads
 * per-account state, so `checkedInToday` is cached and skippable by design.
 */
interface TraePoolDeps {
  /** The panel's saved pool preferences, read from live settings. */
  preferences(panel: TraePanel): TraePoolPreferences;
  /**
   * The full pool membership WITH live credit reads — the expensive version.
   * Only the status document's own assembly and an explicit batch call it.
   */
  members(panel: TraePanel): Promise<readonly TraePoolMember[]>;
  /**
   * One panel's pool membership from LOCAL state only — the first-paint source
   * (issue #77).
   *
   * Cheap by contract in the strongest sense: no upstream read at all, so the
   * account table can be painted before any billing endpoint answers. A member
   * whose credit total has never been measured carries no `credits`, which the
   * card already renders as `—` rather than as a wrong figure; the follow-up
   * full document fills the real numbers in.
   *
   * A Host built without it degrades to omitting the pool block from a
   * first-paint document rather than paying {@link members} there — the card
   * then shows its single-account view for one refresh cycle.
   */
  localMembers?(panel: TraePanel): Promise<readonly TraePoolMember[]>;
  /**
   * The panel's saved member names, from a local scan only.
   *
   * The first-paint counterpart of {@link memberNames}. The full document builds
   * these by walking {@link members} (which reads every balance), which is a
   * second full membership pass for a map of names; the fast document must not
   * pay that, and it does not need to: the saved-list rows it renders are the
   * ones {@link localMembers} already names.
   */
  localMemberNames?(panel: TraePanel): Promise<Record<string, string>>;
  /**
   * The checked ids that still resolve to a local sign-in, from a local scan only.
   * The batch route's empty-pool guard runs this on every request, so it must not
   * cost an upstream call — {@link members} is not suitable there.
   */
  effectiveMemberAccountIds?(panel: TraePanel): Promise<readonly string[]>;
  /** Last measured display name per saved id, for members whose sign-in is gone. */
  memberNames?(panel: TraePanel): Promise<Record<string, string>>;
  /** Local sign-ins the pool does NOT cover, so the card can offer them to check. */
  otherAccounts?(panel: TraePanel): Promise<readonly TraePoolAccount[]>;
  /** Which account the request path would bill right now, after applying the pool. */
  currentAccountId?(panel: TraePanel): Promise<string | undefined>;
  /** Whether this panel's upstream rewards a daily check-in at all. */
  checkinSupported?(panel: TraePanel): boolean;
  /**
   * Today's check-in state per account, from the cached per-account reads.
   *
   * A missing entry means "not read", which the card renders as unknown rather
   * than as a definite "not checked in". `deviceCheckedIn` is the Trae half of the
   * pair: the daily claim is keyed to `x-device-id`, so an account can be unpaid
   * TODAY because this machine already spent its claim on another account.
   */
  checkinState?(panel: TraePanel): Promise<Record<string, TraePoolCheckinState>>;
  /**
   * Today's check-in state from the cells already measured this process — the
   * first-paint counterpart (issue #77) of {@link checkinState}.
   *
   * Synchronous by contract: it reads the Host's measurement cache and nothing
   * else, so it must never start a request. A Host without it degrades to an
   * unknown check-in column in the first paint, which the card already renders
   * as unknown; the full document fills the column in.
   */
  cachedCheckinState?(panel: TraePanel): Readonly<Record<string, TraePoolCheckinState>>;
  /** Run the check-in batch. Persists nothing to settings; drops its own caches. */
  checkin?(panel: TraePanel): Promise<readonly TraePoolCheckinRow[]>;
  /** Run the model-availability batch and persist its measurements. */
  test?(panel: TraePanel, modelId: string, onRow?: (row: TraePoolTestRow) => void): Promise<readonly TraePoolTestRow[]>;
  /** Probe ONE account against the target model (the row's own test button). */
  testOne?(panel: TraePanel, accountId: string): Promise<TraePoolTestRow | undefined>;
  /** Forget an account's measurement — used when the user removes it from the pool. */
  removeOne?(panel: TraePanel, accountId: string): Promise<boolean>;
  /** The panel's catalog, the source of the free-model default and the stale check. */
  catalog?(panel: TraePanel): readonly TraeModelInfo[];
}
/** One row's cached check-in facts; see {@link TraePoolDeps.checkinState}. */
interface TraePoolCheckinState {
  checkedIn: boolean;
  deviceCheckedIn?: boolean;
  /** Whether this account is offered the reward at all; false renders `disabled`. */
  enabled?: boolean;
}
/**
 * Which usage document a request asked for (issue #77).
 *
 * `full` is the document every earlier caller has always received: live credit
 * figures, fresh check-in state, the ranked pool. `fast` is the same document
 * built from LOCAL state only — no upstream read at all — so the card can paint
 * the account table immediately and then upgrade it with the full document.
 *
 * The distinction lives in ONE optional query parameter (`detail`) so an old
 * caller, a hand-written curl and a browser refresh all keep working: an absent
 * or unrecognised value is `full`.
 */
type TraeStatusDetail = 'full' | 'fast';
/**
 * Assemble one region's card document. `panel` is the tab the card is on; the
 * panel-scoped store already answers with only that region's accounts, so the
 * document's model slots and account list are that region's by construction.
 * Sign-in state is read-only; credit is a live billing answer whose failure
 * degrades to `creditsError` rather than failing the whole document.
 */
declare function traeWebUsage(deps: TraeUsageRouteOptions, panel: TraePanel, options?: {
  detail?: TraeStatusDetail;
}): Promise<TraeWebUsage>;
/** Mount the GET usage route on an optional webServer context. */
declare function registerTraeUsageRoute(ctx: Context$1, deps: TraeUsageRouteOptions): void;
//#endregion
//#region src/index.d.ts
declare const name = "dsh-connect-trae";
declare const inject: string[];
/**
 * Settings namespace, as a plain lowercase literal. DSH 0.1.2 removed the
 * `settingsNamespace` brand constructor from the npm package, and every
 * consumer of this constant takes it as a kebab string — so no branding is
 * needed. It is the FALLBACK namespace; the namespace the host actually serves
 * comes from {@link settingsNamespaceOf} (0.1.7 keys settings by the Loader
 * entry id, which a profile patch may mount as `dsh-connect-trae` or
 * `include:dsh-connect-trae`).
 */
declare const TRAE_SETTINGS_NS = "trae";
/**
 * The namespace the HOST actually serves this plugin under.
 *
 * On DSH 0.1.7 `SettingsForms.describe()` keys every namespace by the Loader
 * entry id, and the harness looks a provider's namespace up by EXACT match —
 * advertising `trae` while the host serves `include:dsh-connect-trae` made the
 * provider read as "not configured": its configure affordance and model
 * discovery both silently went dead.
 *
 * `ctx.fiber.entry` is added by the Loader, not by Cordis itself, so it is not
 * in Cordis's public types and is absent on hosts that mount a plugin without a
 * Loader entry (a test harness, or `ctx.plugin()` called directly). Hence the
 * probe plus the documented fallback, mirroring the first-party plugins:
 * `const settingsNs = ctx.fiber.entry?.options.id ?? NS`.
 */
declare function settingsNamespaceOf(ctx: unknown): string;
/** One region's saved model state: its own directory and the user's selection within it. */
interface TraeRegionState {
  /**
   * Whether this region's provider is switched on. Opt-out: only an explicit
   * `false` disables it, so a config predating this switch keeps both providers
   * running. A disabled region is fully withdrawn from the harness — its
   * adapter route and its configurable-provider entry both hold zero routes, so
   * it disappears from DSH's model picker instead of lingering as an
   * unselectable row (see `syncRegionRegistration`).
   */
  enabled?: boolean;
  /** The last-refreshed raw directory for this region; what the card displays. */
  lastCatalog?: TraeModelInfo[];
  /** The user's selection in this region, as model ids (= Trae name). */
  enabledModelIds?: string[];
  /** Models the user explicitly enabled for image input in this region. */
  imageModelIds?: string[];
  /**
   * Whether the model may call trae_draw_image for this panel. Opt-IN:
   * image generation spends real credits, so an absent value is never consent
   * (the same rule workbuddy's imageToolEnabled follows). Declared in the
   * schema below — a field missing from the schema is dropped on every save.
   */
  drawImageEnabled?: boolean;
  /** Local DSH context budget per model in this region. */
  contextBudgets?: Record<string, number>;
  /**
   * WHERE this region's credit readout sits (learned from dsh-connect-workbuddy
   * issue #62).
   *
   * Two seats, because the first one is not always available:
   *
   *   - `composer` — the composer row (`conversation.input.right`), shared
   *     with the shell's own controls. It is the closer, more glanceable seat,
   *     and it is the default so nothing moves for anyone who does not choose.
   *   - `stats` — the ambient dock below the composer card
   *     (`conversation.composer.dock`), where the shell renders its own
   *     round/step/token pills. That row is a LIST seat whose shipped occupant
   *     registers separately, so a third-party plugin that ALSO parks something
   *     in the composer row cannot crowd this readout out of existence.
   *
   * The report behind this (workbuddy #62) was exactly that: with another
   * plugin installed, the readout vanished from the composer row. Making the
   * seat a choice is what keeps one plugin's presence from deciding another's.
   * Trae already lost this readout once to a shared seat — see the sibling
   * plugin's note about the sidebar foot, where this line was clipped to "Tr"
   * beside dsh-connect-workbuddy's rows — so the setting applies here too.
   */
  creditPosition?: TraeCreditPosition;
  /**
   * This region's account pool (issue #44), as the card saves it.
   *
   * Read through {@link regionStateOf} and written by the card's pool section.
   * `enabled` absent means OFF: an account pool decides where money is spent, so
   * it is opt-in and a config written before it existed must keep billing the
   * account the user picked.
   */
  pool?: TraePoolPreferences;
}
interface Config {
  authFile?: string;
  edition?: 'auto' | 'cn' | 'sg' | 'solo' | 'solo-sg';
  /**
   * @deprecated Legacy single-slot account selector from before the dual
   * provider split. It is attributed to whichever region the account actually
   * belongs to (resolved once at startup from the local account scan); new
   * writes go to {@link Config.accounts}.
   */
  accountId?: string;
  /**
   * Per-region account selections, keyed `cn` | `ai`. Each region's tab writes
   * its own slot; tokens remain outside settings.
   */
  accounts?: Partial<Record<TraePanel, string>>;
  /**
   * Show the credit readout in the composer tool row: `Trae CN · <n>`, rendered
   * ONLY while the session's selected model belongs to this plugin, clickable
   * for the account/balances panel.
   *
   * This field first gated the sidebar credit line (issue #26, contributed by
   * JiewiW); when that line was removed in 2.13.0 the composer readout replaced
   * it and rendered unconditionally; 2.13.3 restores the switch, because the
   * user went looking for it and a readout inside the SHARED composer row
   * deserves the same opt-in the sidebar line had. The field is REUSED so an
   * existing `true` keeps the readout on across the upgrade.
   *
   * OFF by default. The card's checkbox is the only writer, so exactly one path
   * can change it. Declared volatile alongside `accounts`/`regions` so the
   * settings form can both read and write it.
   */
  showPointsInMainUi?: boolean;
  /**
   * Per-region model state, keyed `cn` | `ai`. The CN and international apps
   * expose different rosters, so each keeps its own directory and selection
   * and switching accounts never drops the other region's picks.
   */
  regions?: Partial<Record<TraePanel, TraeRegionState>>;
  /**
   * @deprecated Legacy single-slot fields from before the region split. They
   * predate international support and are read as the CN region's state when
   * `regions.cn` is absent; new writes go to `regions`.
   */
  lastCatalog?: TraeModelInfo[];
  /** @deprecated See {@link Config.lastCatalog}. */
  enabledModelIds?: string[];
  /** @deprecated See {@link Config.lastCatalog}. */
  contextBudgets?: Record<string, number>;
  /** @deprecated See {@link Config.lastCatalog}. */
  imageModelIds?: string[];
  /** @deprecated Legacy generated runtime catalog; kept for backwards compatibility. */
  models?: TraeModelInfo[];
}
/**
 * One panel's saved state. A config written before the region split has only
 * the flat fields: those were always captured from the CN endpoint (the
 * plugin had no international support), so they are read as the CN state and
 * only when no explicit CN slot exists. The ai region never inherits them —
 * that inheritance is exactly the bug where a stale CN directory would be
 * intersected with the international catalog and silently drop the user's
 * picks (the same failure workbuddy fixed with its region split).
 *
 * Keyed by PANEL (`cn` | `enterprise` | `ai`), because each panel carries its
 * own switch, account binding and model selection. `enterprise` has no legacy
 * equivalent: it starts from an EMPTY state (its own directory, its own model
 * picks) and never inherits CN's, so switching it on cannot silently activate
 * a model list the user never chose for the tenant pool.
 */
declare function regionStateOf(config: Config, panel: TraePanel): TraeRegionState;
/**
 * Whether one panel's provider is switched on (issue #11). Opt-out semantics:
 * only an explicit `false` disables it, so every config written before this
 * switch existed — including the pre-region-split flat fields, which never
 * carry `enabled` — keeps both providers running exactly as before. The card
 * reads the same rule through `regionEnabledOf`, so the two halves can never
 * disagree about a region's state.
 *
 * The ENTERPRISE panel is the one deliberate exception: it defaults OFF. A
 * consumer-only account (`tenant 7o2d894p7dr0o4`) cannot use that pool at all,
 * so opting every existing user into a second CN provider would put a route in
 * their model picker that fails on first use. It is switched on from its card
 * tab, by someone whose account actually belongs to a tenant.
 */
declare function regionEnabled(config: Config, panel: TraePanel): boolean;
/**
 * WHERE one region's credit readout sits (learned from workbuddy #62).
 *
 * A local reader rather than a bare schema default, so a config written before
 * the setting existed reads as `composer` — the seat that was the only one, so
 * an upgrade moves nothing on screen — and so a hand-edited value the schema
 * does not know falls back to a seat that renders rather than to nowhere.
 *
 * Shared with the browser half by construction: the card renders the Host's
 * answer for this field, so the control cannot disagree with the readout.
 */
declare function creditPosition(config: Config, region: TraeRegion): TraeCreditPosition;
/**
 * Mark a schema's field as volatile.
 *
 * `volatile()` exists from schemastery 3.18.3; since 2.3.0 the peer range
 * requires `>=3.18.4`, so it is always present on a supported host. The probe
 * is kept as a safety net for a consumer that resolves an older schemastery
 * anyway (where the helper must degrade to identity — hand-writing
 * `meta.volatile = true` would bypass schemastery's own `validateVolatileSchema`
 * checks) and to keep both arms deterministically testable.
 *
 * Without the marker, 0.1.7's settings write gate REJECTS every write with
 * `Plugin entry "trae" has no volatile fields` while the scope's `set()` still
 * resolves — so the card would look like it saved and silently revert.
 */
declare function asVolatile<S>(schema: S): S;
declare const Config: z<Config>;
declare function apply(ctx: Context$1, config: Config): void;
//#endregion
export { Config, FALLBACK_CONTEXT_WINDOW, FALLBACK_TRAE_MODELS, FALLBACK_TRAE_MODELS_AI, MAX_PROBE_INPUT_TOKENS, type PiAiGeneration, type PiAiRuntimeInfo, REGION_GATEWAYS, type RawChatDelta, type RawChatMessage, type RawChatTool, SseDecoder, type SseEvent, TRAE_ACCOUNT_STATUS_PATH, TRAE_AI_PROVIDER, TRAE_CHANNEL_PRIORITY, TRAE_CHECKIN_PATH, TRAE_CN_AGENT_TASK_PATH, TRAE_CN_TITLE_PATH, TRAE_COMMON_FUNCTIONS, TRAE_ENTERPRISE_PROVIDER, TRAE_MODELS_TEST_PATH, TRAE_MODEL_DETAIL_FUNCTIONS, TRAE_MODEL_DETAIL_PATH, TRAE_OFFICIAL_ROSTER_PATH, TRAE_PANELS, TRAE_PAY_BASE, TRAE_PROBE_TIMEOUT_MS, TRAE_PROVIDER, TRAE_PROVIDERS, TRAE_PROVIDER_DISPLAY_NAMES, TRAE_PROVIDER_IDS, TRAE_PROVIDER_ID_DISPLAY_NAMES, TRAE_PROVIDER_ROUTES, TRAE_RAW_CHAT_V1_PATH, TRAE_RAW_CHAT_V2_PATH, TRAE_REASONING_EFFORTS, TRAE_REGIONS, TRAE_REGION_PARAM, TRAE_SETTINGS_NS, TRAE_SOLO_CHAT_PATH, TRAE_SOLO_FUNCTION, TRAE_SOLO_MODELS_PATH, TRAE_SOLO_REMOTE_BASE, TRAE_STATE_DB_FILENAME, TRAE_STREAM_IDLE_TIMEOUT_MS, TRAE_USAGE_PATH, TRAE_VERSION_CODE_FALLBACK, type TraeActivityRule, type TraeAdapter, type TraeCachedModelConfig, TraeCatalog, type TraeChatResult, type TraeCheckinClaim, type TraeCheckinStatus, type TraeContextBudget, type TraeCredential, TraeCredentialStore, TraeDelegatingUpstreamClient, type TraeDiscoveredModel, type TraeDiscoveredReasoning, type TraeEdition, type TraeFailure, TraeFallbackUpstreamClient, type TraeFallbackUpstreamOptions, type TraeFusionRawChatEnvelope, TraeGatedUpstreamClient, type TraeGatedUpstreamOptions, type TraeIdentity, type TraeInputModality, type TraeModelDetailRequest, type TraeModelGroup, type TraeModelInfo, type TraeModelProbeVerdict, type TraeModelView, type TraeModelsTestResponse, type TraeObservedModelConfig, type TraeOfficialChannel, type TraeOfficialFilterResult, type TraeOfficialRoster, TraeOfficialRosterClient, type TraeOfficialVerdict, type TraeOrderableModel, type TraePanel, type TraeProbeResult, type TraeProbeVerdict, type TraeProviderRoute, TraeRawCapabilityController, type TraeRawCapabilityControllerOptions, type TraeRawCapabilitySnapshot, TraeRawCapabilityState, type TraeRawChatBehaviorConfig, type TraeRawChatCapability, type TraeRawChatClientOptions, type TraeRawChatConfig, type TraeRawChatFailureReason, type TraeRawChatRuntimeConfig, TraeRawChatUpstreamClient, type TraeRawDiagnostic, type TraeRawDiagnosticState, type TraeRawGateway, type TraeRawGatewayOptions, type TraeRawResolverResult, type TraeReasoningCapability, type TraeReasoningEffort, type TraeRefreshDevice, type TraeRegion, type TraeRegionGateways, TraeRegionState, type TraeShim, TraeSoloBridge, type TraeSoloClientOptions, TraeSoloRemoteCatalogClient, type TraeSoloRemoteCatalogOptions, TraeSoloUpstreamClient, type TraeStorageCandidate, type TraeStreamEvent, type TraeUpstreamClient, TraeUsageClient, type TraeUsageOptions, type TraeUsagePack, type TraeUsageRouteOptions, type TraeUsageSnapshot, type TraeUsageSummary, type TraeUsageView, type TraeWebAccountState, type TraeWebActivity, type TraeWebCheckin, type TraeWebCheckinClaim, type TraeWebCredits, type TraeWebUsage, type TraeWireModel, type TraeWireTarget, UnconfiguredTraeUpstreamClient, adaptLegacyPiAiContext, adaptModernPiAiContext, apply, applyContextBudgets, applyImageSelection, applyOfficialRoster, applyReasoningEffort, asVolatile, bridgeTraeSoloStream, buildTraeAgentTaskBody, buildTraeCnHeaders, buildTraeFusionRawChatEnvelope, buildTraeModelDetailRequest, buildTraeRawChatDraft, buildTraeRawChatRuntimeConfig, classifyProbeError, classifyProbeResult, classifyTraeRawChatFailure, configuredAccountsOf, createTraeAdapter, createTraeRawGateway, createTraeShim, creditPosition, decidePiAiGeneration, decodeRawChatChunk, decodeTraeEvent, decryptTraeStorageValue, deriveCatalog, describeIdShape, describeNameShape, describeTraeFailure, discoveredCatalog, displayNameOfTraeProvider, fallbackModelsFor, filterTraeModels, generationOf, groupTraeModels, hashTraeRawChatArg, identityHeaders, inject, isEnterpriseAccount, isPromotableWireModel, legacyTraeOwnAuthPath, maskUserPath, mergeTraeModelSources, name, nextRegionCreditPosition, nextRegionEnabled, nextRegionSlots, normalizeTraeCredential, normalizeTraeToolSchema, normalizeTraeToolSchemas, normalizeTraeVersionCode, officialVerdictOf, orderTraeModels, panelOfKey, panelOfProvider, parseObservedModelConfig, parseReasoningCapability, parseTraeAuthValue, parseTraeCachedModel, parseTraeModelExtraConfigLogLine, parseTraeOfficialRoster, parseTraeRawChatBehaviorConfig, parseTraeRemoteModel, parseTraeStorageDocument, piAiRuntimeInfo, pickTraeStorageIdentity, prepareSoloBody, probeBody, probeModelsSequentially, probeOneModel, probeTraeRawChatCapability, providerOfPanel, rawCapabilityDiagnostic, rawCapabilityFingerprint, readTraeCachedModel, readTraeCliIdentity, readTraeIdentity, refreshTraeCredential, regionCreditPositionOf, regionEnabled, regionEnabledOf, regionOfCredential, regionOfEdition, regionOfHost, regionOfPanel, regionOfTraeProvider, regionOfTraeStatusUrl, regionOfUserRegion, regionStateOf, registerTraeUsageRoute, resolveTraeIdentity, resolveTraeRawRuntime, routeOfTraeProvider, sanitizeCatalog, scopeTraeModels, servedContextWindow, settingsNamespaceOf, traeEndpoint, traeInputModalities, traeModelCallChannel, traeModelDisplayName, traeModelInView, traeModelMatchesQuery, traeOwnAuthPath, traeRawChatExtraInfo, traeStateDatabaseCandidates, traeStorageCandidates, traeWebUsage, traeWindowsAppNames, unwrapVolatile, unwrapVolatileDeep, wireTargetsOf, withChatCallableFunctions, withContextAdaptation, withTraeRegion };