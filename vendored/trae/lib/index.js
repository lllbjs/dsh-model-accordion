import z from "@deepseek-ai/schemastery";
import { listTraeLocalAccounts, syncTraeLocalAccounts, isTraeLocalAccountId } from "./local-accounts.js";
import { createProvider } from "@earendil-works/pi-ai";
import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy";
import { resolveRetryPolicy } from "@deepseek-ai/dsh-llm";
import { PiAiAdapter } from "@deepseek-ai/dsh-llm-pi-ai";
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { copyFile, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID, sign, timingSafeEqual } from "node:crypto";
import { withFileLock, writeFileAtomic } from "@deepseek-ai/dsh-atomic-write";
import { resolveDshHome } from "@deepseek-ai/dsh-home-paths";
import { cpus, homedir, hostname, release, userInfo } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createServer } from "node:http";
import { Readable } from "node:stream";
//#region src/context-budget.ts
/**
* Context-budget arithmetic shared by the HOST (which applies a saved budget to
* the catalog DSH is told about) and the CLIENT card (which renders the radios).
*
* It lives in its own module because the client bundle cannot import
* `catalog.ts` (host-only) and the two sides must agree EXACTLY on which
* windows are selectable: a card that offers a window the host then refuses
* would be a control that silently does nothing.
*/
/**
* The one intermediate budget the card offers, in tokens: 500K.
*
* WHY IT EXISTS: Trae advertises a dev window (typically 200K/256K/272K) and a
* Max window (typically 1M). Switching dev→Max is a 5× jump for a user who
* just wants more room without paying Max-tier pricing for the whole session.
* 500K is the half-way point, and it is only ever offered for a model whose
* Max window is at least that wide.
*
* WHY A CONSTANT AND NOT A PER-MODEL VALUE: this is a LOCAL preference that
* DSH uses to decide when to compress; it is not a Trae-advertised window. The
* value must be sane for every model that can select it, so eligibility is
* gated on `maxContextWindow >= 500000` rather than inventing a window per
* model. `applyContextBudgets` additionally refuses any budget wider than what
* the model advertises, so a stale saved value cannot overflow a shrunken Max.
*/
const TRAE_CONTEXT_BUDGET_MID = 5e5;
/**
* The selectable windows for one model, smallest first: dev, then 500K (only
* when it is a genuine middle step), then Max. Duplicates are dropped so a
* model whose dev window is already 500K offers it once.
*
* A model with no Max window yields exactly one option — its dev window — which
* is what makes the card's radios read-only for such models.
*/
function contextBudgetOptions(model) {
	const dev = model.contextWindow;
	const max = model.maxContextWindow;
	const options = [];
	const push = (value) => {
		if (value === void 0 || value < 1) return;
		if (!options.includes(value)) options.push(value);
	};
	push(dev);
	if (max !== void 0 && max >= 5e5 && (dev === void 0 || 5e5 > dev)) push(TRAE_CONTEXT_BUDGET_MID);
	push(max);
	return options.sort((left, right) => left - right);
}
//#endregion
//#region src/catalog.ts
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
const FALLBACK_CONTEXT_WINDOW = 2e5;
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
function servedContextWindow(info) {
	const window = info.contextWindow;
	return Number.isInteger(window) && window > 0 ? window : FALLBACK_CONTEXT_WINDOW;
}
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
const FALLBACK_TRAE_MODELS = [
	{
		id: "DeepSeek-V4-Flash-Official",
		name: "DeepSeek-V4-Flash",
		contextWindow: 2e5
	},
	{
		id: "DeepSeek-V4-Pro-Official",
		name: "DeepSeek-V4-Pro",
		contextWindow: 2e5
	},
	{
		id: "glm-5.2",
		name: "GLM-5.2",
		contextWindow: 2e5
	},
	{
		id: "kimi-k2.6",
		name: "Kimi-K2.6",
		contextWindow: 2e5
	}
];
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
const FALLBACK_TRAE_MODELS_AI = [
	{
		id: "gemini-3.1-pro",
		name: "Gemini-3.1-Pro-Preview",
		contextWindow: 2e5
	},
	{
		id: "gemini-3-flash-solo",
		name: "Gemini-3-Flash-Preview",
		contextWindow: 2e5
	},
	{
		id: "minimax-m3",
		name: "MiniMax-M3",
		contextWindow: 2e5
	},
	{
		id: "minimax-m2.7",
		name: "MiniMax-M2.7",
		contextWindow: 2e5
	},
	{
		id: "kimi-k2.5",
		name: "Kimi-K2.5",
		contextWindow: 2e5
	},
	{
		id: "gpt-5.4",
		name: "GPT-5.4",
		contextWindow: 272e3
	},
	{
		id: "gpt-5.2",
		name: "GPT-5.2",
		contextWindow: 272e3
	}
];
/**
* Static fallback directory for a region. Each region keeps its own model
* slot in settings; the fallback must match the region so an account never
* shows the other region's roster.
*/
function fallbackModelsFor(region) {
	return region === "ai" ? FALLBACK_TRAE_MODELS_AI : FALLBACK_TRAE_MODELS;
}
/** Exact DSH modalities for one catalog entry; absent metadata is text-only. */
function traeInputModalities(model) {
	return [...model.input ?? ["text"]];
}
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
function traeModelDisplayName(model, withRate = true) {
	return !withRate || model.creditMultiplier === void 0 ? model.name : `${model.name} · x${model.creditMultiplier.toFixed(2)}`;
}
/**
* Whether one model should be offered image input.
*
* Two independent sources, unioned (issue #16):
*
*  - the user's explicit `imageModelIds` opt-in, which stays authoritative and
*    can still switch an individual model on;
*  - Trae's own `multimodal` flag, which is what makes "auto" work at all.
*
* Rationale: Trae's IDE enables its attach-image button purely from this flag
* (`metadata.capabilities.vision`), with no user switch, so a model Trae itself
* calls multimodal is one the vendor expects to receive images. Requiring a
* manual tick for those made this plugin the only place where a vendor-declared
* capability had to be re-enabled by hand.
*
* Why the flag alone is not enough, and the union is:
*
*  - the flag is advisory, not a contract. `llm_utils_chat` is a lightweight
*    SOLO channel and this plugin has been burned by `4001 param is invalid`
*    for ids that LOOKED valid, so the flag is not treated as proof of
*    callability — a model still has to have survived the wire join to appear
*    at all. The flag only decides image input, never model availability.
*  - Users who already ticked a model keep that tick even after a refresh stops
*    reporting the flag, so the union never silently revokes a working setup.
*  - `input` remains the ONLY thing told to DSH: a model that ends up without
*    `image` here is one DSH will degrade images to text for, which is the
*    safe direction for a model whose capability we cannot confirm.
*
* `multimodal === true` is a strict test: absent, `false`, or any non-boolean
* leaves the model text-only unless the user opted in.
*/
function traeModelAcceptsImage(model, selected) {
	return selected.has(model.id) || model.multimodal === true;
}
/** Apply the user's explicit image opt-ins plus Trae's own multimodal flag. */
function applyImageSelection(models, selected) {
	return models.map((model) => ({
		...model,
		input: traeModelAcceptsImage(model, selected) ? ["text", "image"] : ["text"]
	}));
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
function isPromotableWireModel(model) {
	if (model.usage !== "chat_completion") return false;
	if (model.configSource !== 1) return false;
	const name = model.name.trim();
	if (name === "" || name === "-") return false;
	if (name === model.id.trim()) return false;
	if (!name.includes(" ") && name.includes("_")) return false;
	return true;
}
/** Normalise a display name for cross-source joining. */
function displayKey(name) {
	return name.trim().toLowerCase();
}
/**
* DSH thinking level -> the `reasoning_effort` name Trae's wire accepts.
*
* The INVERSE of `EFFORT_MAP` in `model-metadata.ts`, and it must stay an exact
* mirror of it: a level this table does not name has no wire spelling, so it is
* DROPPED rather than guessed (issue #60).
*
* The previous form was a ternary chain ending in a bare `'high'`:
*
*     effort === 'low' ? 'light' : effort === 'xhigh' ? 'extra_high' : 'high'
*
* so EVERY unnamed level was sent as `high`. That is not a harmless default: it
* is a silent downgrade. Trae's own vocabulary carries five levels
* (`low / medium / high / extra_high / max`, verified in the client bundle's
* `reasoning_effort` i18n keys), and its remote config publishes the list per
* model (`AI.agent.model.reasoning_effort_level_by_agent_model_v2`). The day
* upstream starts advertising `max`, a user picking Max would have sent `high`
* — no error, no log, and a cheaper answer than the one they asked for. A
* dropped field lets the upstream apply its own default, which is at least the
* model's real behaviour instead of a wrong claim about it.
*
* Measured 2026-10-25 on a live CN credential (98 directory rows): options are
* `["light","high"]`, `["high","extra_high"]`, `["light","high","extra_high"]`
* or absent — `max` is not published YET, which is exactly why this must not
* wait for it to be.
*/
const WIRE_EFFORT_MAP = {
	low: "light",
	medium: "medium",
	high: "high",
	xhigh: "extra_high",
	max: "max"
};
/**
* Map a model's advertised levels to their wire names, dropping unnamed ones.
*
* `flatMap` rather than `map` + a placeholder: an unmappable level must not
* produce an entry at all, because every consumer reads "is there a value here"
* as "may this level be sent" (see `thinkingLevelMap` in `adapter.ts` and the
* `delete input['reasoning_effort']` fallback in `solo-bridge.ts`).
*/
function wireEffortsOf(supported) {
	return Object.fromEntries(supported.flatMap((effort) => {
		const wire = WIRE_EFFORT_MAP[effort];
		return wire === void 0 ? [] : [[effort, wire]];
	}));
}
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
function mergeTraeModelSources(remote, wire) {
	const wireByName = /* @__PURE__ */ new Map();
	const wireById = /* @__PURE__ */ new Map();
	for (const model of wire) if (!wireById.has(displayKey(model.id))) wireById.set(displayKey(model.id), model);
	for (const model of wire) if (!wireByName.has(displayKey(model.name))) wireByName.set(displayKey(model.name), model);
	const result = [];
	for (const model of remote) {
		const wireModel = wireById.get(displayKey(model.id)) ?? wireByName.get(displayKey(model.name));
		const creditMultiplier = wireModel?.creditMultiplier ?? model.creditMultiplier;
		const wireFunction = wireModel?.function ?? model.function;
		const activityDiscount = wireModel?.activityDiscount ?? model.activityDiscount;
		result.push({
			id: model.id,
			name: model.name,
			...model.contextWindow === void 0 ? {} : { contextWindow: servedContextWindow(model) },
			...model.maxContextWindow === void 0 ? {} : { maxContextWindow: model.maxContextWindow },
			...creditMultiplier === void 0 ? {} : { creditMultiplier },
			...activityDiscount === void 0 ? {} : { activityDiscount },
			input: ["text"],
			...wireModel?.maxTokens === void 0 ? {} : { maxTokens: wireModel.maxTokens },
			...model.multimodal === void 0 ? {} : { multimodal: model.multimodal },
			reasoningSupported: model.reasoningSupported,
			...model.reasoning === void 0 ? {} : {
				reasoning: model.reasoning,
				reasoningEfforts: wireEffortsOf(model.reasoning.supported)
			},
			...wireModel !== void 0 && wireModel.id !== "" && wireModel.id !== model.id ? { wireConfigName: wireModel.id } : {},
			...wireFunction === void 0 ? {} : { wireFunction }
		});
	}
	const remoteIds = new Set(remote.map((model) => displayKey(model.id)));
	/**
	* Display name -> the LARGEST context window claimed under it.
	*
	* A name collision does NOT by itself mean "alias". Two rows sharing a
	* display name are sometimes genuinely different models, and the only
	* upstream signal that separates them is capability. Measured 2026-10-22 on
	* a live CN credential:
	*
	*  - `kimi-k2` (28000) and `kimi-k2-0905` (168000) BOTH display as
	*    `Kimi-K2-0905` — and both ANSWER (verified: `kimi-k2-0905` answers
	*    under `solo_coder` and `chat_v3`). Dropping the second one hid a real
	*    168k model behind an equally-named 28k one, which is exactly the
	*    "dated snapshot the IDE offers, the plugin does not" complaint of
	*    issue #46.
	*  - `minimax-m2` (100000, `chat_v3`) and `minimax-m2-auto` (168000,
	*    `solo_coder`) both display as `MiniMax-M2` — again a bigger config
	*    behind an equally-named smaller one.
	*  - `glm-4.7` and `glm-4.7-auto` both display as `GLM-4.7` with IDENTICAL
	*    metadata (100000/16000/`chat_v3`) — a true duplicate, and promoting it
	*    would list one model twice for no gain.
	*  - `glm-5.2_advisor_default` (168000) is SMALLER than the skeleton's
	*    `glm-5.2` (200000), so it is an internal re-routing of a model the user
	*    already has in full — not worth a second row.
	*
	* So the rule is: a collision skips the row UNLESS the new row carries a
	* STRICTLY LARGER context window, in which case the user is being offered
	* capability the equally-named row does not have and hiding it would cost
	* them something real. Names are tracked with their best context so the
	* comparison is always against the strongest claimant, whatever the order.
	*/
	const claimedNames = /* @__PURE__ */ new Map();
	const claim = (name, contextWindow) => {
		const key = displayKey(name);
		if (key === "") return;
		claimedNames.set(key, Math.max(claimedNames.get(key) ?? 0, contextWindow ?? 0));
	};
	for (const model of remote) claim(model.name, model.contextWindow);
	for (const wireModel of wire) {
		if (remoteIds.has(displayKey(wireModel.id))) continue;
		if (!isPromotableWireModel(wireModel)) continue;
		const collides = claimedNames.has(displayKey(wireModel.name));
		if (collides && (wireModel.contextWindow ?? 0) <= (claimedNames.get(displayKey(wireModel.name)) ?? 0)) continue;
		/**
		* A surviving collision gets the id appended, because the whole point of
		* promoting it is that the user can TELL IT APART from the equally-named
		* row: two rows rendering as `MiniMax-M2` is a picker that lies about
		* having one model. The id is the `config_name` the bridge sends, so it is
		* also the most actionable disambiguator available.
		*/
		const name = collides ? `${wireModel.name} (${wireModel.id})` : wireModel.name;
		claim(wireModel.name, wireModel.contextWindow);
		claim(name, wireModel.contextWindow);
		result.push({
			id: wireModel.id,
			name,
			...wireModel.contextWindow === void 0 ? {} : { contextWindow: servedContextWindow(wireModel) },
			...wireModel.maxTokens === void 0 ? {} : { maxTokens: wireModel.maxTokens },
			...wireModel.creditMultiplier === void 0 ? {} : { creditMultiplier: wireModel.creditMultiplier },
			...wireModel.activityDiscount === void 0 ? {} : { activityDiscount: wireModel.activityDiscount },
			input: ["text"],
			reasoningSupported: wireModel.reasoning !== void 0,
			...wireModel.reasoning === void 0 ? {} : {
				reasoning: {
					supported: [...wireModel.reasoning.supported],
					...wireModel.reasoning.defaultEffort === void 0 ? {} : { defaultEffort: wireModel.reasoning.defaultEffort }
				},
				reasoningEfforts: wireEffortsOf(wireModel.reasoning.supported)
			},
			...wireModel.function === void 0 ? {} : { wireFunction: wireModel.function }
		});
	}
	return result;
}
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
function withChatCallableFunctions(rows, chatFunctions) {
	return rows.map((model) => {
		if (model.wireFunction === void 0 || chatFunctions.includes(model.wireFunction)) return model;
		const { wireFunction: _demoted, ...withoutFunction } = model;
		return withoutFunction;
	});
}
/**
* Apply the saved local budget. Trae advertises a dev window and a Max window
* per model, and the card may also offer the 500K middle step (see
* {@link contextBudgetOptions}), so a budget may only switch a model to a
* window that model actually offers — never to a fabricated number, and never
* to something wider than its Max (a saved 500K for a model later refreshed
* down to a 256K Max must fall back, not overflow). Everything else keeps the
* dev window.
*/
function applyContextBudgets(catalog, budgets = {}) {
	return catalog.map((model) => {
		const budget = budgets[model.id];
		return {
			...model,
			...budget !== void 0 && contextBudgetOptions(model).includes(budget) ? { contextWindow: budget } : {}
		};
	});
}
/** Convert Trae metadata into catalog rows; image input is decided by {@link applyImageSelection}. */
function discoveredCatalog(models) {
	const result = [];
	for (const model of models) result.push({
		id: model.id,
		name: model.name,
		...model.contextWindow === void 0 ? {} : { contextWindow: servedContextWindow(model) },
		...model.maxContextWindow === void 0 ? {} : { maxContextWindow: model.maxContextWindow },
		input: ["text"],
		...model.creditMultiplier === void 0 ? {} : { creditMultiplier: model.creditMultiplier },
		...model.activityDiscount === void 0 ? {} : { activityDiscount: model.activityDiscount },
		...model.multimodal === void 0 ? {} : { multimodal: model.multimodal },
		...model.function === void 0 ? {} : { wireFunction: model.function },
		reasoningSupported: model.reasoningSupported,
		...model.reasoning === void 0 ? {} : {
			reasoning: model.reasoning,
			reasoningEfforts: wireEffortsOf(model.reasoning.supported)
		}
	});
	return result;
}
/**
* Drop rows saved by older releases that generated `@1m` variant models, so a
* stale configuration cannot resurrect a variant the runtime no longer builds.
*/
function sanitizeCatalog(catalog) {
	return catalog.filter((model) => {
		if (model.id.endsWith("@1m")) return false;
		const legacy = model;
		return legacy.baseModelId === void 0 && legacy.maxContext !== true;
	});
}
/**
* Derive the runtime catalog from the last refreshed Trae directory plus the
* user's explicit selection and context budgets. An empty selection falls back
* to the whole directory: a plugin that has never been configured must still
* serve models rather than nothing. This is the single source of truth for
* what DSH actually exposes, so saving only the selection and budgets is
* enough to rebuild it after a restart.
*/
function deriveCatalog(catalog, enabled, budgets = {}) {
	return applyContextBudgets(enabled.size === 0 ? catalog : catalog.filter((model) => enabled.has(model.id)), budgets);
}
var TraeCatalog = class {
	models;
	/**
	* @param region Seeds the static fallback for this region; each region's
	* provider must never serve the other region's roster before its first live
	* refresh lands.
	*/
	constructor(region = "cn") {
		this.models = fallbackModelsFor(region);
	}
	current() {
		return this.models;
	}
	set(models) {
		if (models.length === 0) throw new Error("trae model catalog cannot be empty");
		this.models = models.map((model) => ({
			...model,
			...model.input === void 0 ? {} : { input: [...model.input] }
		}));
	}
};
//#endregion
//#region src/pi-ai-runtime.ts
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
let cached;
/** Resolve (once) which pi-ai copy this plugin runs against. */
function piAiRuntimeInfo() {
	cached ??= inspectResolvedPiAi();
	return cached;
}
function inspectResolvedPiAi() {
	const entry = resolveModuleFile();
	const root = entry === void 0 ? void 0 : findPackageRoot(entry);
	const version = root === void 0 ? void 0 : readVersion(root);
	return {
		generation: decidePiAiGeneration(version, root === void 0 ? void 0 : hasTranscriptModule(root)),
		version,
		resolvedFrom: root,
		inspected: root !== void 0
	};
}
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
function decidePiAiGeneration(version, transcriptPresent) {
	const byVersion = generationOf(version);
	if (byVersion !== void 0) return byVersion;
	if (transcriptPresent === true) return "modern";
	if (transcriptPresent === false) return "legacy";
	return "modern";
}
/**
* The generation a version string belongs to, or `undefined` when the string
* cannot be read as a version at all.
*
* Only the minor of the `0.x` line matters for the boundary, and `major >= 1`
* is modern by definition (1.0.x is already in use by `dsh-llm-pi-ai@0.2.1-alpha.2`
* and consumes transcripts natively).
*/
function generationOf(version) {
	if (version === void 0) return void 0;
	const match = /^(\d+)\.(\d+)\./u.exec(version);
	if (match === null) return void 0;
	const major = Number(match[1]);
	const minor = Number(match[2]);
	if (major > 0) return "modern";
	return minor >= 86 ? "modern" : "legacy";
}
/**
* Whether the resolved package actually contains the transcript module.
*
* `dist/utils/transcript.js` is the file every modern generation ships and no
* legacy one has (checked: absent in 0.82.1 and 0.85.1; present in 0.86.0,
* 0.86.1, 0.87.1 and 1.0.2). Landing on the file directly, rather than asking a
* resolver to find it, is what keeps this honest under bundler-style resolution
* — see the module docstring.
*/
function hasTranscriptModule(packageRoot) {
	return existsSync(join(packageRoot, "dist", "utils", "transcript.js"));
}
/**
* The file the main entry resolved to; undefined when resolution itself fails.
*
* `import.meta.resolve` (not `require.resolve`): pi-ai's exports map exposes
* "." under the `import` condition only, so the CJS resolver refuses the bare
* specifier outright — the ESM resolver is the one this plugin actually imports
* with, so it is also the one whose answer is meaningful here. Only the package
* LOCATION is taken from it; the generation question is answered from disk.
*/
function resolveModuleFile() {
	try {
		return fileURLToPath(import.meta.resolve("@earendil-works/pi-ai"));
	} catch {
		return;
	}
}
/**
* The package directory owning `moduleFile`: `dist/index.js` sits directly
* inside the package, so walking up from the entry finds its manifest. The
* manifest is claimed only when its `name` matches, so a same-named ancestor (a
* pnpm virtual-store parent, for instance) cannot be misread.
*/
function findPackageRoot(moduleFile) {
	let directory = dirname(moduleFile);
	for (let depth = 0; depth < 4; depth++) {
		if (readManifest(directory)?.name === "@earendil-works/pi-ai") return directory;
		const parent = dirname(directory);
		if (parent === directory) return void 0;
		directory = parent;
	}
}
/** Version from the manifest already located by {@link findPackageRoot}. */
function readVersion(packageRoot) {
	const version = readManifest(packageRoot)?.version;
	return typeof version === "string" ? version : void 0;
}
function readManifest(directory) {
	try {
		const parsed = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
		return typeof parsed === "object" && parsed !== null ? parsed : void 0;
	} catch {
		return;
	}
}
//#endregion
//#region src/adapter.ts
/** Provider route this bundle owns for the domestic (CN) gateway. */
const TRAE_PROVIDER = "trae";
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
const TRAE_ENTERPRISE_PROVIDER = "trae-enterprise";
/**
* Provider route this bundle owns for the international (trae.ai) gateway.
* Named `-global` to match the plugin family's convention (`workbuddy-global`);
* the internal region bucket stays `ai`, which is the gateway/protocol name.
*/
const TRAE_AI_PROVIDER = "trae-global";
/** The provider ids one region publishes, in model-picker order. */
const TRAE_PROVIDER_IDS = {
	cn: [TRAE_PROVIDER, TRAE_ENTERPRISE_PROVIDER],
	ai: [TRAE_AI_PROVIDER]
};
/** Each region's default (first) provider id. */
const TRAE_PROVIDERS = {
	cn: TRAE_PROVIDER,
	ai: TRAE_AI_PROVIDER
};
const TRAE_PROVIDER_ROUTES = {
	[TRAE_PROVIDER]: "solo",
	[TRAE_ENTERPRISE_PROVIDER]: "enterprise",
	[TRAE_AI_PROVIDER]: "solo"
};
/** Chat pool a provider id bills against; `undefined` for an unknown id. */
function routeOfTraeProvider(provider) {
	return TRAE_PROVIDER_ROUTES[provider];
}
/** Human-readable provider names, shown in the DSH model picker. */
const TRAE_PROVIDER_DISPLAY_NAMES = {
	cn: "Trae",
	ai: "Trae Global"
};
/** Display name per provider id (the region table above only names the default). */
const TRAE_PROVIDER_ID_DISPLAY_NAMES = {
	[TRAE_PROVIDER]: "Trae",
	[TRAE_ENTERPRISE_PROVIDER]: "Trae 企业版",
	[TRAE_AI_PROVIDER]: "Trae Global"
};
/** Display name of a provider id. */
function displayNameOfTraeProvider(provider) {
	return TRAE_PROVIDER_ID_DISPLAY_NAMES[provider] ?? provider;
}
/** Region a provider route id belongs to. */
function regionOfTraeProvider(provider) {
	for (const [region, ids] of Object.entries(TRAE_PROVIDER_IDS)) if (ids.includes(provider)) return region;
}
const TRAE_STREAM_IDLE_TIMEOUT_MS = 3e5;
const INERT_AUTH = {
	credentials: {
		async read() {},
		async list() {
			return [];
		},
		async modify() {
			throw new Error("dsh-connect-trae has no pi-ai credential lifecycle");
		},
		async delete() {}
	},
	authContext: {
		async env() {},
		async fileExists() {
			return false;
		}
	}
};
const REQUEST_IMAGE_BUDGETS = {
	maxRequestImageBytes: 20971520,
	requestImagePixelBudget: 4194304,
	requestImageMaxBytes: 1048576
};
function toPiModel(info, baseUrl, providerId, withRate = true) {
	return {
		id: info.id,
		name: traeModelDisplayName(info, withRate),
		api: "openai-completions",
		provider: providerId,
		baseUrl,
		input: traeInputModalities(info),
		cost: {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0
		},
		reasoning: info.reasoningEfforts !== void 0,
		...info.reasoningEfforts === void 0 ? {} : { 
		/**
		* Which DSH levels this model may be asked for, and under which wire name.
		*
		* Every level is read from the model's OWN advertised capability, never
		* hardcoded. `minimal / medium / max` used to be pinned to `null`, so a
		* level the upstream published could not be selected even after it was
		* parsed — the second of the three places issue #60 reported. `null`
		* still means "not offered", which is what a model that does not
		* advertise the level reports: nothing here fabricates a level.
		*
		* `off` stays `null` deliberately: Trae's wire has no "no reasoning"
		* spelling, so an explicit off is not something this provider can send.
		*/
thinkingLevelMap: {
			off: null,
			minimal: info.reasoningEfforts.minimal ?? null,
			low: info.reasoningEfforts.low ?? null,
			medium: info.reasoningEfforts.medium ?? null,
			high: info.reasoningEfforts.high ?? null,
			xhigh: info.reasoningEfforts.xhigh ?? null,
			max: info.reasoningEfforts.max ?? null
		} },
		contextWindow: servedContextWindow(info),
		...info.maxTokens === void 0 ? {} : { maxTokens: info.maxTokens },
		compat: { supportsReasoningEffort: info.reasoningEfforts !== void 0 }
	};
}
function isSystemMessage(message) {
	return typeof message === "object" && message !== null && message.role === "system";
}
/**
* The text of one system message: its `content` (a string, as
* `normalizeContext` writes, or text blocks, which a provider may send back)
* followed by its named `sections` — exactly the join pi-ai's own
* `getSystemMessageText` performs.
*
* `sections` is not decoration: it is the modern transcript's second carrier of
* prompt text ("named, ordered prompt sections rendered verbatim after
* content"). Folding `content` alone would silently drop a prompt that arrives
* section-shaped, which is the same asymmetric-loss failure this adapter exists
* to prevent.
*/
function systemTextOf(message) {
	const parts = [contentTextOf(message.content)];
	const sections = message.sections;
	if (typeof sections === "object" && sections !== null && !Array.isArray(sections)) {
		for (const text of Object.values(sections)) if (typeof text === "string") parts.push(text);
	}
	return parts.filter((part) => part.length > 0).join("\n\n");
}
function contentTextOf(content) {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	const texts = [];
	for (const block of content) {
		if (typeof block !== "object" || block === null) continue;
		const candidate = block;
		if (candidate.type === "text" && typeof candidate.text === "string") texts.push(candidate.text);
	}
	return texts.join("\n\n");
}
/**
* Replay one transcript system message's tool deltas into `state`, the same
* merge pi-ai's own `getCurrentTools` performs: removals first, then additions,
* keyed by name so a mid-conversation redeclaration replaces the original.
*/
function replayToolState(message, state) {
	const removed = message.toolsRemoved;
	if (Array.isArray(removed)) for (const tool of removed) {
		const name = tool?.name;
		if (typeof name === "string") state.delete(name);
	}
	const added = message.toolsAdded;
	if (Array.isArray(added)) for (const tool of added) {
		const name = tool?.name;
		if (typeof name === "string") state.set(name, tool);
	}
}
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
function adaptLegacyPiAiContext(context) {
	if (context === null || typeof context !== "object") return context;
	const messages = Array.isArray(context.messages) ? context.messages : void 0;
	if (messages === void 0) return context;
	if (!messages.some(isSystemMessage)) return context;
	const systemTexts = [];
	const rest = [];
	const toolState = /* @__PURE__ */ new Map();
	for (const message of messages) {
		if (!isSystemMessage(message)) {
			rest.push(message);
			continue;
		}
		const text = systemTextOf(message);
		if (text !== "") systemTexts.push(text);
		replayToolState(message, toolState);
	}
	const texts = [...context.systemPrompt === void 0 || context.systemPrompt === "" ? [] : [context.systemPrompt], ...systemTexts];
	const systemPrompt = texts.length > 0 ? texts.join("\n\n") : void 0;
	const promoted = Array.isArray(context.tools) ? void 0 : [...toolState.values()];
	return {
		...context,
		...systemPrompt === void 0 ? {} : { systemPrompt },
		...promoted === void 0 || promoted.length === 0 ? {} : { tools: promoted },
		messages: rest
	};
}
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
function adaptModernPiAiContext(context) {
	if (context === null || typeof context !== "object") return context;
	const messages = Array.isArray(context.messages) ? context.messages : void 0;
	if (messages === void 0) return context;
	const prompt = context.systemPrompt;
	const tools = Array.isArray(context.tools) && context.tools.length > 0 ? context.tools : void 0;
	if (!(typeof prompt === "string" && prompt.length > 0) && tools === void 0) return context;
	const head = {
		role: "system",
		content: prompt ?? "",
		...tools === void 0 ? {} : { toolsAdded: tools }
	};
	const { systemPrompt: _lifted, tools: _liftedTools, ...rest } = context;
	return {
		...rest,
		messages: [head, ...messages]
	};
}
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
function withContextAdaptation(api, generation) {
	const adapt = generation === "modern" ? adaptModernPiAiContext : adaptLegacyPiAiContext;
	const forApi = (context) => adapt(context);
	return {
		...api,
		stream: (model, context, options) => api.stream(model, forApi(context), options),
		streamSimple: (model, context, options) => api.streamSimple(model, forApi(context), options)
	};
}
function createTraeAdapter(options) {
	const providerId = options.provider ?? "trae";
	const providerName = options.displayName ?? "Trae";
	const generation = options.piAiGeneration ?? piAiRuntimeInfo().generation;
	/**
	* The enterprise provider shows no rate: the multiplier belongs to the
	* consumer pool, and this provider bills the tenant pool.
	*/
	const showRate = options.provider !== TRAE_ENTERPRISE_PROVIDER;
	const buildModels = () => options.catalog.current().map((info) => toPiModel(info, `${options.shim.baseUrl()}/v1`, providerId, showRate));
	const provider = {
		...createProvider({
			id: providerId,
			name: providerName,
			auth: { apiKey: {
				name: "Trae loopback secret",
				async resolve({ credential }) {
					const apiKey = credential?.key;
					return apiKey === void 0 || apiKey.length === 0 ? void 0 : {
						auth: { apiKey },
						source: "Trae loopback"
					};
				}
			} },
			models: buildModels(),
			api: withContextAdaptation(openAICompletionsApi(), generation)
		}),
		getModels: () => buildModels()
	};
	const profile = {
		provider: providerId,
		displayName: providerName,
		streamIdleTimeoutMs: TRAE_STREAM_IDLE_TIMEOUT_MS,
		retryPolicy: resolveRetryPolicy(void 0, "dsh-connect-trae retryPolicy"),
		configuredMaxTokens: /* @__PURE__ */ new Map(),
		modelErrors: /* @__PURE__ */ new Map(),
		defaultContextWindow: FALLBACK_CONTEXT_WINDOW,
		...REQUEST_IMAGE_BUDGETS,
		piProvider: provider
	};
	let profiles = /* @__PURE__ */ new Map([[providerId, profile]]);
	return {
		adapter: new PiAiAdapter({
			profiles: () => profiles,
			auth: INERT_AUTH,
			resolveApiKey: async () => options.secret ?? options.shim.token(),
			...options.resolveAttachments === void 0 ? {} : { resolveAttachments: options.resolveAttachments }
		}),
		invalidate() {
			profiles = /* @__PURE__ */ new Map([[providerId, profile]]);
		}
	};
}
//#endregion
//#region src/region.ts
/**
* Code the Host reports for a region this build recognises but cannot serve.
* The card and any external caller can switch on it; the message is only for
* humans.
*/
const TRAE_UNSUPPORTED_REGION_CODE = "unsupported-region";
/** Message for a US credential, phrased to end the re-login loop. */
const TRAE_UNSUPPORTED_REGION_MESSAGE = "This Trae account belongs to the United States region (userRegion \"US\", host *.traeapi.us), which dsh-connect-trae does not support yet. Requests are NOT sent to the Singapore gateway; sign in with a CN or Singapore account (or use the CN build of Trae) to use this panel.";
/**
* A credential that resolved to a region this build does not serve.
*
* Thrown BEFORE any request is built, by every client that reads a credential:
* the failure has to be a local, explicit verdict, not a 401 from the wrong
* gateway (issue #66: a US token sent to `*.trae.ai` answers 401, which read as
* "your sign-in expired" and produced an endless re-login loop).
*/
var TraeUnsupportedRegionError = class extends Error {
	region;
	name = "TraeUnsupportedRegionError";
	code = TRAE_UNSUPPORTED_REGION_CODE;
	constructor(region) {
		super(TRAE_UNSUPPORTED_REGION_MESSAGE);
		this.region = region;
	}
};
/** Every panel, in card tab order. */
const TRAE_PANELS = [
	"cn",
	"enterprise",
	"ai"
];
/** The region whose credential/account pool a panel draws on. */
function regionOfPanel(panel) {
	return panel === "ai" ? "ai" : "cn";
}
/** The provider id a panel publishes. */
function providerOfPanel(panel) {
	if (panel === "enterprise") return "trae-enterprise";
	return panel === "ai" ? "trae-global" : "trae";
}
/** The panel that owns a provider id, or undefined for an unknown id. */
function panelOfProvider(provider) {
	return TRAE_PANELS.find((panel) => providerOfPanel(panel) === provider);
}
/** Narrow a stored settings key to a panel. */
function panelOfKey(value) {
	return TRAE_PANELS.includes(value) ? value : void 0;
}
/**
* Verified gateway bases per region (docs/INTL_SG_EVIDENCE.md §2).
* The AI gateway is shared by both international installs (Trae desktop and
* TRAE SOLO); its mchost shards (`api16/api22-normal-alisg.mchost.guru`)
* answer the same bytes but stay internal — `coresg-normal.trae.ai` is the
* single stable entry point.
*/
const REGION_GATEWAYS = {
	cn: {
		chat: "https://trae-api-cn.mchost.guru",
		remote: "https://solo.trae.cn/api/remote/v1",
		pay: "https://api.trae.cn"
	},
	ai: {
		chat: "https://coresg-normal.trae.ai",
		remote: "https://coresg-normal.trae.ai/api/remote/v1",
		pay: "https://growsg-normal.trae.ai"
	}
};
/**
* Enterprise (tenant) chat gateway for a CN credential that belongs to a
* `tob_online` tenant.
*
* This is a SECOND chat gateway on the same credential, not a second region:
* the roster, the credential and the protocol are the same as `cn`, but a
* tenant account is billed against the enterprise pool when the request goes
* here. Measured 2026-10-17 on a live `Trae CN` tenant account: the same model
* served from this host does not move the personal `consumed_amount`, while
* the same call to `trae-api-cn.mchost.guru` charges it.
*
* Two wire differences, both load-bearing:
*  - the request must carry a per-call `session_id` (the consumer gateway
*    rejects it with `4001`), and
*  - a refused call answers **HTTP 200** whose FIRST SSE frame is
*    `event:error` with `code: 4001` — not an HTTP error status, so the
*    refusal is only visible if the response body is inspected.
*/
const TRAE_ENTERPRISE_HOST = "https://console.enterprise.trae.cn";
/** Region for an edition label: the international installs belong to `ai`. */
function regionOfEdition(edition) {
	return edition === "sg" || edition === "solo-sg" ? "ai" : "cn";
}
/**
* Region from the credential's `userRegion` claim. The desktop storage spells
* it as an object (`{"region":"CN","_aiRegion":"CN"}`); the app logs also
* spell the bare value lowercase (`"sg"`). Both are accepted, case-blind.
*
* `"US"` is recognized as its own region (issue #66). It used to fall through
* this function unrecognised, which is what let a US credential inherit the SG
* routing from the edition label.
*/
function regionOfUserRegion(value) {
	const raw = typeof value === "object" && value !== null && !Array.isArray(value) ? value["region"] : value;
	if (typeof raw !== "string") return void 0;
	const lowered = raw.trim().toLowerCase();
	if (lowered === "cn") return "cn";
	if (lowered === "sg" || lowered === "ai") return "ai";
	if (lowered === "us") return "us";
}
/**
* Region from a credential host (`.trae.ai` → ai, `.trae.cn`/`.trae.com.cn` →
* cn, `.traeapi.us` → us).
*
* The US suffix is checked explicitly. It is NOT a special case of
* `.trae.ai`: `grow-normal.traeapi.us` is a different cluster with its own
* pay/pay-status endpoints, and the plugin's SG gateways answer a US token
* with 401 (issue #66).
*/
function regionOfHost(host) {
	if (host === void 0) return void 0;
	const trimmed = host.trim();
	if (trimmed === "") return void 0;
	let hostname;
	try {
		hostname = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`).hostname;
	} catch {
		return;
	}
	if (hostname === "traeapi.us" || hostname.endsWith(".traeapi.us")) return "us";
	if (hostname === "trae.ai" || hostname.endsWith(".trae.ai")) return "ai";
	if (hostname === "trae.cn" || hostname.endsWith(".trae.cn") || hostname.endsWith(".trae.com.cn")) return "cn";
}
/**
* Region of a credential: the `userRegion` claim wins, the host suffix is the
* fallback, and the edition label is the last resort. Every level is derived
* from data the credential itself carries, so no user configuration is needed.
*
* The edition fallback is only ever reached by a credential that carries
* NEITHER a claim NOR a resolvable host (a CLI token). That matters: it is the
* reason a US credential no longer becomes `ai` — its own claim resolves first.
*/
function regionOfCredential(credential) {
	return regionOfUserRegion(credential.userRegion) ?? regionOfHost(credential.host) ?? regionOfEdition(credential.edition);
}
/** Whether this build actually serves the region (only `cn` and `ai` today). */
function isSupportedRegion(region) {
	return region !== "us";
}
/**
* Narrow a resolved credential region to a servable bucket, or throw
* {@link TraeUnsupportedRegionError}.
*
* Every gateway lookup goes through this instead of indexing
* `REGION_GATEWAYS`/`TRAE_REMOTE_DIRECTORY_FUNCTIONS` directly: those maps hold
* only the two supported clusters, and the missing index IS the bug in issue
* #66 (`REGION_GATEWAYS[regionOfCredential(us)]` silently read the `ai` entry,
* because the resolver had already rounded the US claim down to SG).
*/
function assertSupportedRegion(region) {
	if (!isSupportedRegion(region)) throw new TraeUnsupportedRegionError(region);
	return region;
}
//#endregion
//#region src/status-paths.ts
/** Plugin-owned usage endpoint consumed by its browser half. */
const TRAE_USAGE_PATH = "/plugins/dsh-connect-trae/usage";
/** Plugin-owned live model refresh endpoint. */
const TRAE_MODELS_REFRESH_PATH = "/plugins/dsh-connect-trae/models/refresh";
/**
* Plugin-owned availability probe: POST the model ids to test, get one verdict
* per model. Unlike every read-only sibling this route SPENDS quota — a real
* (minimal) chat call per model — so it is user-initiated only, and the card
* labels the button as consuming a small amount.
*/
const TRAE_MODELS_TEST_PATH = "/plugins/dsh-connect-trae/models/test";
/** Plugin-owned local account rescan endpoint. */
const TRAE_ACCOUNTS_REFRESH_PATH = "/plugins/dsh-connect-trae/accounts/refresh";
/** 本机 TraeDaddy 账号库：多账号列表 + 切换（loopback-only）。 */
const TRAE_LOCAL_ACCOUNTS_PATH = "/plugins/dsh-connect-trae/local-accounts";
/**
* General balance of EVERY account in a region, for the composer panel's table.
*
* Separate from the usage route on purpose: the usage document backs the
* 5-minute readout, and multiplying its upstream reads by the account count
* would charge a healthy account for something it never looks at — the same
* principle that keeps `creditAlternatives` firing only when a balance hits
* zero. This one is paid when the panel is actually opened, which is the only
* place the table is shown.
*/
const TRAE_ACCOUNT_CREDITS_PATH = "/plugins/dsh-connect-trae/account-credits";
/**
* Per-account status (check-in / credits / subscription) for the account table.
*
* Each row of the account table reads its OWN state through this route — a CN
* row carries its check-in state and balance, an ai row its subscription.
* POST with the accountId in the body: one upstream read per account, paid
* only when the table is actually shown.
*/
const TRAE_ACCOUNT_STATUS_PATH = "/plugins/dsh-connect-trae/account-status";
/**
* Plugin-owned daily check-in claim endpoint. POST, loopback-only, and the only
* route in this plugin that changes upstream account state. The accountId in
* the body names WHICH account to claim for, so the button can sit in each
* account row.
*/
const TRAE_CHECKIN_PATH = "/plugins/dsh-connect-trae/checkin";
/**
* Plugin-owned account-pool endpoint: one route for the pool's batch actions.
*
* 参考：`dsh-connect-workbuddy` 的 `WORKBUDDY_POOL_PATH`。本路由与该实现同形
*   （同一 `?action=` 风格、POST、loopback-only、per-row `accountId`），这样同时
*   装了两个插件的用户面对的是同一套交互。
*
* `?action=checkin` and `?action=test` run over the whole member set; `remove`
* addresses ONE account (the body carries `accountId`) and is the only way a
* measurement of an account the user no longer wants can leave the store — a
* deleted member otherwise keeps its row in the file forever, and a re-added
* member would silently inherit an old exclusion.
*
* POST + loopback-only because both batches SPEND something: check-in sends a
* claim, and a test is a real chat call. A page that is not the Host's own
* loopback must not be able to trigger either.
*/
const TRAE_POOL_PATH = "/plugins/dsh-connect-trae/pool";
/** Query parameter selecting which pool batch action a request means. */
const TRAE_POOL_ACTION_PARAM = "action";
/** Query parameter naming ONE pool account a per-row request addresses. */
const TRAE_POOL_ACCOUNT_PARAM = "accountId";
/** Read the pool action off a request URL; unknown/absent means undefined. */
function poolActionOf(url) {
	const at = url.indexOf("?");
	if (at === -1) return void 0;
	const value = new URLSearchParams(url.slice(at + 1)).get(TRAE_POOL_ACTION_PARAM);
	return value === "checkin" || value === "test" || value === "remove" || value === "delete" ? value : void 0;
}
/**
* Read the ONE account a per-row pool request addresses, from the QUERY string.
*
* Unlike the transfer route, the pool's `accountId` rides the URL rather than the
* body, so a row action and a batch action are distinguishable before any bytes
* are read — which is what lets the route refuse a malformed request without ever
* touching the store.
*/
function poolAccountIdOf(url) {
	const at = url.indexOf("?");
	if (at === -1) return void 0;
	const value = new URLSearchParams(url.slice(at + 1)).get(TRAE_POOL_ACCOUNT_PARAM);
	return value === null || value === "" ? void 0 : value;
}
/**
* Plugin-owned account transfer endpoint: batch export and import of a region's
* stored credentials (issue #37).
*
* One route with an `action` query parameter (`export` | `preview` | `import`),
* mirroring the sibling `dsh-connect-workbuddy` plugin's transfer route so the
* two cards behave the same way for a user who has both installed. The vault
* document never leaves the Host: the browser receives parsed answers, and a
* preview carries display fields only — never token material.
*/
const TRAE_TRANSFER_PATH = "/plugins/dsh-connect-trae/transfer";
/** Read the transfer action off a request URL; unknown/absent means undefined. */
function transferActionOf(url) {
	const at = url.indexOf("?");
	if (at === -1) return void 0;
	const value = new URLSearchParams(url.slice(at + 1)).get("action");
	return value === "export" || value === "preview" || value === "import" ? value : void 0;
}
/** Query parameter naming the region a card request addresses. */
const TRAE_REGION_PARAM = "region";
/** Every region, in card tab order. */
const TRAE_REGIONS = ["cn", "ai"];
/**
* Address one region's status route. The two regions are separate provider
* stacks; every card request carries the region whose tab the user is on.
*/
function withTraeRegion(path, panel) {
	return `${path}?${TRAE_REGION_PARAM}=${panel}`;
}
/**
* Read the region parameter off a status-route URL. Absent means the domestic
* tab (`cn`); a present-but-unknown value returns undefined so the route can
* answer 400 instead of guessing.
*/
function regionOfTraeStatusUrl(url) {
	const at = url.indexOf("?");
	const value = at === -1 ? null : new URLSearchParams(url.slice(at + 1)).get(TRAE_REGION_PARAM);
	if (value === null || value === "") return "cn";
	return TRAE_PANELS.includes(value) ? value : void 0;
}
/** Query parameter asking for a thinner first-paint document (issue #77). */
const TRAE_DETAIL_PARAM = "detail";
/** The only recognised `detail` value: local state only, no upstream read. */
const TRAE_DETAIL_FAST = "fast";
/**
* Whether a request URL asks for the fast document.
*
* Only the exact value counts — a typo (`fastest`, `FAST`) degrades to the FULL
* document, because a thinner panel is a worse failure than a slower one: the
* caller that made the mistake is asking about an optimisation, so the safe
* answer is the truthful one.
*/
function fastDetailOf(url) {
	const at = url.indexOf("?");
	if (at === -1) return false;
	return new URLSearchParams(url.slice(at + 1)).get(TRAE_DETAIL_PARAM) === TRAE_DETAIL_FAST;
}
/**
* Peel ONE `{get(): T}` live reference, the shape DSH 0.1.7 delivers a
* volatile-marked settings field as (see {@link unwrapVolatileDeep}).
*/
function unwrapVolatile(value) {
	if (value !== null && typeof value === "object" && typeof value.get === "function") return value.get();
	return value;
}
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
function unwrapVolatileDeep(value) {
	if (value === null || typeof value !== "object") return value;
	if (typeof value.get === "function") return unwrapVolatileDeep(value.get());
	if (Array.isArray(value)) return value.map((entry) => unwrapVolatileDeep(entry));
	const source = value;
	const out = {};
	for (const key of Object.keys(source)) out[key] = unwrapVolatileDeep(source[key]);
	return out;
}
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
function configuredAccountsOf(configured) {
	const accounts = unwrapVolatileDeep(configured)?.accounts;
	return typeof accounts === "object" && accounts !== null ? accounts : {};
}
/**
* Build the next `regions` settings value for the card's save. The write
* targets ONLY the signed-in account's region slot; every other region's slot
* is carried over untouched, so switching accounts never clobbers the other
* region's picks. Tolerates any stored shape (absent, non-object) by starting
* from an empty document.
*/
function nextRegionSlots(regions, panel, slot) {
	const unwrapped = unwrapVolatileDeep(regions);
	return {
		...typeof unwrapped === "object" && unwrapped !== null && !Array.isArray(unwrapped) ? unwrapped : {},
		[panel]: slot
	};
}
/**
* Narrow a settings value to the `regions` map. Accepts EITHER the whole
* settings section (`{ regions: {...}, ... }`) or the `regions` map itself, and
* unwraps the former. This tolerance is deliberate: passing the whole section
* where the map was expected was a real shipped bug — the lookup then read
* `section['cn']` (absent), so the card's checkbox reported `true` forever and
* clicking it appeared to do nothing even though the write succeeded.
*
* Unwraps live references first: on DSH 0.1.7 the `regions` field arrives as a
* `{get(): T}` reference, which passes the `typeof === 'object'` check below
* and would otherwise be returned as if it were the map — making every region
* read back as absent (and the enabled flag read as "on" forever).
*/
function regionsMapOf(value) {
	const unwrapped = unwrapVolatileDeep(value);
	if (typeof unwrapped !== "object" || unwrapped === null || Array.isArray(unwrapped)) return {};
	const record = unwrapped;
	const nested = record["regions"];
	if (typeof nested !== "object" || nested === null || Array.isArray(nested)) return record;
	const panelIds = TRAE_PANELS;
	return Object.keys(record).some((key) => panelIds.includes(key)) ? record : nested;
}
/** One region's stored slot as a plain object; any other shape reads as empty. */
function regionSlotOf(value, panel) {
	const slot = unwrapVolatile(regionsMapOf(value)[panel]);
	return typeof slot === "object" && slot !== null && !Array.isArray(slot) ? slot : {};
}
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
function regionEnabledOf(value, panel) {
	const stored = regionSlotOf(value, panel)["enabled"];
	if (typeof stored === "boolean") return stored;
	return panel !== "enterprise";
}
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
function nextRegionEnabled(value, panel, enabled) {
	return nextRegionSlots(regionsMapOf(value), panel, {
		...regionSlotOf(value, panel),
		enabled
	});
}
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
function regionCreditPositionOf(value, panel) {
	return regionSlotOf(value, panel)["creditPosition"] === "stats" ? "stats" : "composer";
}
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
function nextRegionCreditPosition(value, panel, position) {
	return nextRegionSlots(regionsMapOf(value), panel, {
		...regionSlotOf(value, panel),
		creditPosition: position
	});
}
/**
* Panels whose text-to-image path this plugin has actually MEASURED, in
* `TRAE_PANELS` tab order.
*
* ONE entry today. The other two are refused for the SAME reason — no evidence
* — which is exactly the asymmetry the review of #62 held the PR on:
*
*  - `enterprise` bills through the tenant gateway, a second billing surface
*    whose image behaviour has never been probed;
*  - `ai` answers on `coresg-normal.trae.ai`, where no `tool_text_to_image`
*    request has ever run either — every measurement behind this tool was
*    taken against `trae-api-cn.mchost.guru`. Refusing one unverified gateway
*    while serving another is not a rule, it is an accident.
*
* Adding a panel means adding its evidence in the same change (the precedent
* for international claims is `docs/INTL_SG_EVIDENCE.md`). Order is
* significant: the tool's resolver walks `TRAE_PANELS` order and takes the
* FIRST consenting panel, so `cn` — the only measured one — always answers
* first.
*/
const DRAW_IMAGE_PANELS = ["cn"];
/**
* Whether ONE panel's 「允许模型自主生图」 grant is in force, i.e. its box was
* ticked. ONLY the literal `true` counts: a hand-edited `'yes'` or a `1` is a
* typo, not consent to spend credits. (A `{ get(): true }` live reference — the
* DSH 0.1.7 slot shape — IS decoded to the true it holds first, see
* {@link unwrapVolatileDeep}: that is the Host's own document, not a hand edit.)
*
* `value` may be the whole settings section or the `regions` map (see
* {@link regionsMapOf}).
*/
function drawImageEnabledOf(value, panel) {
	return regionSlotOf(value, panel)["drawImageEnabled"] === true;
}
/**
* The panels that may register `trae_draw_image` RIGHT NOW — the single
* judgment behind both the tool's registration and its account resolver, and
* therefore the only place a user's credits can be exposed by accident.
*
* Pure and exported on purpose (review of #62, item 3): the first version kept
* this rule inside `apply()`'s closure, so "does ticking the box actually
* grant anything" could only be code-reviewed, never tested.
*
* THREE gates, all required: the panel must be measured
* ({@link DRAW_IMAGE_PANELS}), its provider must be switched ON (opt-out rule,
* so a config written before the switch existed still counts), and the panel
* must carry an explicit grant. A tick on a switched-off provider is STORED
* consent, not a live grant: flipping the provider back on restores the tool
* without asking again, which is why both gates are read here rather than at
* the checkbox.
*
* `enterprise` is refused structurally, even if someone later adds it to
* {@link DRAW_IMAGE_PANELS}: consent must never cross into the tenant billing
* surface by editing a list.
*/
function drawImagePanelsOf(value) {
	return TRAE_PANELS.filter((panel) => panel !== "enterprise" && DRAW_IMAGE_PANELS.includes(panel) && regionEnabledOf(value, panel) && drawImageEnabledOf(value, panel));
}
//#endregion
//#region src/decrypt.ts
const TRAE_AUTH_STORAGE_KEY = "iCubeAuthInfo://icube.cloudide";
const SALT_A = Uint8Array.from([
	82,
	9,
	106,
	213,
	48,
	54,
	165,
	56,
	191,
	64,
	163,
	158,
	129,
	243,
	215,
	251,
	124,
	227,
	57,
	130,
	155,
	47,
	255,
	135,
	52,
	142,
	67,
	68,
	196,
	222,
	233,
	203,
	84,
	123,
	148,
	50,
	166,
	194,
	35,
	61,
	238,
	76,
	149,
	11,
	66,
	250,
	195,
	78,
	8,
	46,
	161,
	102,
	40,
	217,
	36,
	178,
	118,
	91,
	162,
	73,
	109,
	139,
	209,
	37
]);
const SALT_B = Uint8Array.from([
	31,
	221,
	168,
	51,
	136,
	7,
	199,
	49,
	177,
	18,
	16,
	89,
	39,
	128,
	236,
	95,
	96,
	81,
	127,
	169,
	25,
	181,
	74,
	13,
	45,
	229,
	122,
	159,
	147,
	201,
	156,
	239,
	160,
	224,
	59,
	77,
	174,
	42,
	245,
	176,
	200,
	235,
	187,
	60,
	131,
	83,
	153,
	97,
	23,
	43,
	4,
	126,
	186,
	119,
	214,
	38,
	225,
	105,
	20,
	99,
	85,
	33,
	12,
	125
]);
const SALT_C = Uint8Array.from([
	191,
	192,
	216,
	250,
	122,
	246,
	220,
	97,
	31,
	254,
	98,
	27,
	8,
	72,
	71,
	176,
	135,
	99,
	96,
	18,
	127,
	101,
	203,
	104,
	211,
	102,
	191,
	125,
	37,
	72,
	150,
	156,
	51,
	229,
	121,
	35,
	17,
	153,
	141,
	177,
	110,
	131,
	150,
	128,
	172,
	255,
	254,
	6,
	18,
	140,
	55,
	62,
	236,
	249,
	135,
	64,
	135,
	12,
	117,
	4,
	89,
	149,
	168,
	209
]);
const SALT_D = Uint8Array.from([
	246,
	204,
	26,
	232,
	232,
	70,
	129,
	109,
	223,
	146,
	169,
	242,
	23,
	241,
	105,
	145,
	50,
	196,
	165,
	42,
	254,
	120,
	3,
	54,
	244,
	207,
	209,
	85,
	53,
	6,
	138,
	106,
	175,
	148,
	31,
	204,
	186,
	186,
	165,
	182,
	87,
	142,
	49,
	10,
	39,
	110,
	26,
	154,
	86,
	56,
	173,
	125,
	18,
	64,
	198,
	225,
	99,
	99,
	83,
	82,
	191,
	134,
	76,
	170
]);
function xor(a, b) {
	return Buffer.from(a.map((value, index) => value ^ (b[index] ?? 0)));
}
function encryptionType(header) {
	if (header.equals(Buffer.from([
		116,
		99,
		5,
		16,
		0,
		0
	]))) return "aes";
	if (header.equals(Buffer.from([
		18,
		57,
		32,
		32,
		2,
		3
	]))) return "aes-private";
	throw new Error("unsupported Trae auth encryption header");
}
function decryptTraeStorageValue(encoded) {
	const buffer = Buffer.from(encoded, "base64");
	if (buffer.length <= 102) throw new Error("Trae auth ciphertext is too short");
	const type = encryptionType(buffer.subarray(0, 6));
	const random = buffer.subarray(6, 38);
	const encrypted = buffer.subarray(38);
	const salt = type === "aes-private" ? xor(SALT_C, SALT_D) : xor(SALT_A, SALT_B);
	const first = createHash("sha512").update(random).digest();
	const derived = createHash("sha512").update(Buffer.concat([first, salt])).digest();
	const decipher = createDecipheriv("aes-128-cbc", derived.subarray(0, 16), derived.subarray(16, 32));
	const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
	if (decrypted.length < 64) throw new Error("Trae auth plaintext is too short");
	const expected = decrypted.subarray(0, 64);
	const plaintext = decrypted.subarray(64);
	const actual = createHash("sha512").update(plaintext).digest();
	if (!expected.equals(actual)) throw new Error("Trae auth integrity check failed");
	return plaintext.toString("utf8");
}
/**
* Re-encrypts one `iCubeAuthInfo` value the way Trae itself stores it.
*
* Needed only to rewrite the app's own `storage.json` after removing an account:
* dropping a key from the plaintext JSON is useless unless the result is sealed
* again with the same scheme, because Trae will fail to decrypt anything else.
* The format is [6-byte header][32-byte random][AES-128-CBC ciphertext], where
* the key/IV come from `sha512(sha512(random) || salt)` and the ciphertext holds
* `sha512(body) || body`. A fresh random is drawn per call, so encrypting the
* same plaintext twice yields different bytes — exactly like the app.
*
* `aes-private` (SALT_C ^ SALT_D) is supported because a value can be read in
* that shape; the default matches every value observed in shipped storage files.
*/
function encryptTraeStorageValue(plaintext, type = "aes") {
	const body = Buffer.from(plaintext, "utf8");
	const digest = createHash("sha512").update(body).digest();
	const random = randomBytes(32);
	const salt = type === "aes-private" ? xor(SALT_C, SALT_D) : xor(SALT_A, SALT_B);
	const first = createHash("sha512").update(random).digest();
	const derived = createHash("sha512").update(Buffer.concat([first, salt])).digest();
	const cipher = createCipheriv("aes-128-cbc", derived.subarray(0, 16), derived.subarray(16, 32));
	const encrypted = Buffer.concat([cipher.update(Buffer.concat([digest, body])), cipher.final()]);
	const header = type === "aes-private" ? Buffer.from([
		18,
		57,
		32,
		32,
		2,
		3
	]) : Buffer.from([
		116,
		99,
		5,
		16,
		0,
		0
	]);
	return Buffer.concat([
		header,
		random,
		encrypted
	]).toString("base64");
}
/** The encryption family of an encoded value, for a byte-faithful rewrite. */
function traeStorageValueType(encoded) {
	return encryptionType(Buffer.from(encoded, "base64").subarray(0, 6));
}
function parseTraeAuthValue(value) {
	const trimmed = value.trim();
	if (trimmed === "") throw new Error("Trae auth value is empty");
	const plaintext = trimmed.startsWith("{") ? trimmed : decryptTraeStorageValue(trimmed);
	return JSON.parse(plaintext);
}
function parseTraeStorageDocument(text) {
	const parsed = JSON.parse(text);
	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("Trae storage document must be an object");
	const value = parsed[TRAE_AUTH_STORAGE_KEY];
	if (typeof value !== "string") throw new Error(`Trae storage document has no ${TRAE_AUTH_STORAGE_KEY}`);
	return parseTraeAuthValue(value);
}
function decodeBase64UrlJson(segment) {
	try {
		const padded = segment.replace(/-/g, "+").replace(/_/g, "/");
		const decoded = Buffer.from(padded, "base64").toString("utf8");
		const parsed = JSON.parse(decoded);
		return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed : void 0;
	} catch {
		return;
	}
}
/**
* Parse the CLI token file. Accepts either the bare JWT itself or a JSON
* envelope containing one, since the on-disk shape is only verified on macOS
* and a future CLI revision may wrap it.
*/
function parseTraeCliToken(text) {
	const trimmed = text.trim();
	if (trimmed === "") throw new Error("Trae CLI token file is empty");
	let token = trimmed;
	if (trimmed.startsWith("{")) {
		const envelope = JSON.parse(trimmed);
		const candidate = envelope["token"] ?? envelope["accessToken"] ?? envelope["jwt"];
		if (typeof candidate !== "string" || candidate.trim() === "") throw new Error("Trae CLI token document has no token field");
		token = candidate.trim();
	}
	const segments = token.split(".");
	if (segments.length !== 3 || segments.some((segment) => segment === "")) throw new Error("Trae CLI token is not a three-part JWT");
	const payload = decodeBase64UrlJson(segments[1]);
	if (payload === void 0) throw new Error("Trae CLI token payload is not decodable JSON");
	const data = typeof payload["data"] === "object" && payload["data"] !== null && !Array.isArray(payload["data"]) ? payload["data"] : void 0;
	const userId = typeof data?.["user_id"] === "string" ? data["user_id"] : void 0;
	if (userId === void 0 || userId === "") throw new Error("Trae CLI token has no data.user_id claim");
	const exp = payload["exp"];
	const expiresAtMs = typeof exp === "number" && Number.isFinite(exp) && exp > 0 ? exp * 1e3 : void 0;
	return {
		accessToken: token,
		userId,
		...expiresAtMs === void 0 ? {} : { expiresAtMs }
	};
}
//#endregion
//#region src/paths.ts
/** The macOS app-support directory name each edition writes, per edition. */
const APP_NAMES = {
	cn: "Trae CN",
	sg: "Trae",
	solo: "TRAE SOLO CN",
	"solo-sg": "TRAE SOLO"
};
/**
* Directory names the Trae CLI uses for its own home. These are deliberately
* separate from the Electron app-support names above: the CLI keeps a dotfile
* home (observed on macOS as `~/.trae-cn`) rather than an `Application Support`
* entry, so a machine with only the CLI installed has no `storage.json` at all.
*/
const CLI_HOME_NAMES = [".trae-cn", ".trae"];
/** Basename of the CLI's persisted bare JWT. */
const TRAE_CLI_TOKEN_FILENAME = "trae-jwt-token";
/**
* Linux desktop config directory names. Electron apps on Linux normally use a
* lowercase, space-free name rather than the macOS `Trae CN` spelling, so both
* are probed: guessing only the macOS spelling would silently miss a real
* install, and guessing only the Linux spelling would break every existing
* user. The actual name is unverified on a real Linux host.
*/
const LINUX_APP_NAMES = {
	cn: [
		"trae-cn",
		"Trae CN",
		"trae",
		"Trae"
	],
	sg: ["trae", "Trae"],
	solo: ["trae-solo-cn", "TRAE SOLO CN"],
	"solo-sg": ["trae-solo", "TRAE SOLO"]
};
/**
* Windows desktop config directory names.
*
* Trae is a VS Code-family Electron app, and that family names its per-user
* data directory from the installer-registered product name — which on Windows
* is `product.json`'s `win32DirName`, NOT the macOS bundle spelling. Measured
* from the shipped bundles (2026-09-26):
*
*   Trae CN      -> win32DirName = "Trae CN"       (applicationName trae-cn)
*   TRAE SOLO CN -> win32DirName = "TRAE SOLO CN"  (applicationName trae-solo-cn)
*
* So the macOS spellings happen to be right here, and `win32DirName` is the
* authority that says so. The lowercase `applicationName` spellings
* (`trae-cn`, `trae-solo-cn`) are probed as well because the same family uses
* them for the Linux config directory, and which of the two a given installer
* writes has never been confirmed on a real Windows host
* (docs/WINDOWS_TOKEN_PROBE.md). Windows file systems are case-insensitive, so
* listing `trae cn` beside `Trae CN` would be the same directory twice — only
* genuinely different spellings are listed.
*/
const WINDOWS_APP_NAMES = {
	cn: ["Trae CN", "trae-cn"],
	sg: ["Trae"],
	solo: ["TRAE SOLO CN", "trae-solo-cn"],
	"solo-sg": ["TRAE SOLO"]
};
/**
* One edition's plausible Windows directory spellings, in probe order.
*
* Exported so the identity reader and the credential scanner probe the SAME
* names: the two resolve different files (the install's `product.json` vs the
* per-user `storage.json`) but they describe one installation, and a spelling
* that works for one but not the other is a bug rather than a preference.
*/
function traeWindowsAppNames(edition) {
	return WINDOWS_APP_NAMES[edition];
}
function traeStorageCandidates(platform = process.platform, home = homedir(), env = process.env) {
	const result = [];
	for (const edition of [
		"cn",
		"sg",
		"solo",
		"solo-sg"
	]) {
		const app = APP_NAMES[edition];
		let roots;
		let appNames;
		if (platform === "darwin") {
			roots = [join(home, "Library", "Application Support")];
			appNames = [app];
		} else if (platform === "win32") {
			roots = [env.APPDATA, join(home, "AppData", "Roaming")].filter((value, index, all) => typeof value === "string" && value !== "" && all.indexOf(value) === index);
			appNames = WINDOWS_APP_NAMES[edition];
		} else if (platform === "linux") {
			roots = [env.XDG_CONFIG_HOME || join(home, ".config")];
			appNames = LINUX_APP_NAMES[edition];
		} else {
			roots = [];
			appNames = [app];
		}
		for (const root of roots) for (const appName of appNames) result.push({
			edition,
			path: join(root, appName, "User", "globalStorage", "storage.json"),
			source: "desktop"
		});
	}
	return [...result, ...traeCliCandidates(platform, home, env)];
}
/**
* Candidate CLI token paths. Only CN/SOLO editions are targeted here for the
* same reason the store ignores SG desktop installs, and `.trae-cn` is mapped
* to `cn` while `.trae` is the CLI's international home and is therefore
* skipped by the store's edition filter.
*
* The CLI home is a dotfile directory directly under `$HOME` on every platform
* observed so far, but this is only verified on macOS; the Windows and Linux
* spellings are probed speculatively and a miss is harmless because every
* candidate is tried in order.
*/
function traeCliCandidates(platform = process.platform, home = homedir(), env = process.env) {
	const roots = [];
	if (platform === "win32") {
		for (const value of [env.USERPROFILE, home]) if (typeof value === "string" && value !== "" && !roots.includes(value)) roots.push(value);
	} else roots.push(home);
	const result = [];
	for (const root of roots) for (const name of CLI_HOME_NAMES) {
		const edition = name === ".trae-cn" ? "cn" : "sg";
		result.push({
			edition,
			path: join(root, name, TRAE_CLI_TOKEN_FILENAME),
			source: "cli"
		});
	}
	return result;
}
//#endregion
//#region src/trae-process.ts
const run = promisify(execFile);
/**
* Why this exists at all: Trae keeps `storage.json` in memory and flushes it over
* the file. Rewriting that file while the app runs is silently undone on its next
* write — the account reappears and the user is told the deletion failed twice
* for two different reasons. So the delete refuses while the matching app is up
* and says which app to quit.
*
* This is a helper, never a gate on correctness: if the probe itself fails
* (`ps` missing, sandbox denial) the answer is "nothing is running", and the
* write proceeds. A false negative costs a retry; a false positive would block a
* deletion that would have worked.
*/
const probeRunningTraeApps = async () => {
	try {
		if (process.platform === "darwin") {
			const { stdout } = await run("ps", ["-Ao", "command"], { maxBuffer: 16777216 });
			return traeEditionsInCommands(stdout, "Application Support");
		}
		if (process.platform === "linux") {
			const { stdout } = await run("ps", ["-Ao", "args"], { maxBuffer: 16777216 });
			return traeEditionsInCommands(stdout, ".config");
		}
		if (process.platform === "win32") {
			const { stdout } = await run("tasklist", [
				"/FO",
				"CSV",
				"/NH"
			], { maxBuffer: 16777216 });
			return /trae/i.test(stdout) ? /* @__PURE__ */ new Set([
				"cn",
				"sg",
				"solo",
				"solo-sg"
			]) : /* @__PURE__ */ new Set();
		}
	} catch {}
	return /* @__PURE__ */ new Set();
};
/**
* Editions whose app-support directory appears in a process listing.
*
* The names are prefixes of each other (`Trae` vs `Trae CN`), so the match is
* made longest-first at each occurrence and consumes the name it claimed. A
* plain `includes('Trae')` would report the international app running whenever
* only `Trae CN` was, and the delete would then refuse for the wrong edition.
*/
function traeEditionsInCommands(commands, supportDir) {
	const running = /* @__PURE__ */ new Set();
	const editions = [
		"cn",
		"sg",
		"solo",
		"solo-sg"
	].map((edition) => ({
		edition,
		name: APP_NAMES[edition]
	})).sort((a, b) => b.name.length - a.name.length);
	const marker = `${supportDir}/`;
	let cursor = commands.indexOf(marker);
	while (cursor !== -1) {
		let consumed = 0;
		for (const { edition, name } of editions) {
			if (!commands.startsWith(name, cursor + marker.length)) continue;
			running.add(edition);
			consumed = name.length;
			break;
		}
		cursor = commands.indexOf(marker, cursor + marker.length + consumed);
	}
	return running;
}
//#endregion
//#region src/auth.ts
/** Host used for CLI tokens, which carry no host claim of their own. */
const CLI_DEFAULT_HOST = "https://api.trae.cn";
/**
* On-disk format of the plugin-owned per-region file.
*
* Version 1 held exactly ONE credential (`{ version, credential }`), which was
* enough while every account came from a Trae install the plugin can discover
* itself. Import (issue #37) breaks that assumption: a user can hold several
* accounts as transferable files, and they have to live somewhere. Version 2
* keeps the same per-region file but stores `{ version, credentials: [...] }`
* instead, so the file stays the unit of region isolation (see
* {@link traeOwnAuthPath}) while holding as many accounts as were imported.
*
* Version 1 remains READ (see {@link parseOwn}), so an existing install keeps
* working and upgrades itself the next time a credential is written; it is
* never written again.
*/
/**
* How long a FAILED per-account refresh is remembered.
*
* Long enough that a revoked refresh token costs one exchange per five minutes
* instead of two per card poll, short enough that a transient network failure is
* retried on the next screen the user opens.
*/
const REFRESH_RETRY_MS = 3e5;
const OWN_VERSION = 2;
/** The superseded single-credential layout, still read for migration. */
const OWN_VERSION_SINGLE = 1;
const TRAE_AUTH_FILENAME = ".trae-auth.json";
/** Prefix of the plugin-owned per-region credential copies. */
const TRAE_OWN_PREFIX = ".trae-auth";
/**
* Plugin-owned copy path for one region. Each region's store refreshes into
* its own file so two simultaneously signed-in regions never overwrite each
* other's refreshed token.
*/
function traeOwnAuthPath(region) {
	return join(resolveDshHome(), `${TRAE_OWN_PREFIX}.${region}.json`);
}
/**
* Pre-dual-provider single-copy path. Still read as a migration source (a
* legacy credential serves the region it belongs to until that region's own
* first refresh writes the per-region file), and removed by `logout`.
*/
function legacyTraeOwnAuthPath() {
	return join(resolveDshHome(), TRAE_AUTH_FILENAME);
}
/**
* Where the "this copy was deleted on purpose" tombstones live.
*
* The store mirrors every local Trae login into its own copy on each refresh
* (see `mirrorLocalLogins`). Without a tombstone the mirror would recreate a
* copy the user just deleted on the very next poll — "delete" would look broken
* again, which is the exact complaint this mechanism exists to fix. A tombstone
* therefore suppresses the mirror for one account id, and is dropped as soon as
* that id is no longer signed in to the app: a later sign-in is a NEW login and
* is mirrored again.
*/
function traeDeletedAccountsPath(region) {
	return join(resolveDshHome(), region === void 0 ? ".trae-deleted.json" : `${TRAE_OWN_PREFIX}.deleted.${region}.json`);
}
function optionalString(value) {
	return typeof value === "string" && value !== "" ? value : void 0;
}
function timeToMs(value) {
	if (typeof value === "number" && Number.isFinite(value) && value > 0) return value > 0xe8d4a51000 ? value : value * 1e3;
	if (typeof value !== "string" || value.trim() === "") return void 0;
	const numeric = Number(value);
	if (Number.isFinite(numeric) && numeric > 0) return numeric > 0xe8d4a51000 ? numeric : numeric * 1e3;
	const parsed = Date.parse(value);
	return Number.isFinite(parsed) ? parsed : void 0;
}
/** Extract the `userRegion.region` string from either on-disk shape. */
function userRegionOf(value) {
	const raw = typeof value === "object" && value !== null && !Array.isArray(value) ? value["region"] : value;
	return typeof raw === "string" && raw.trim() !== "" ? raw.trim() : void 0;
}
function normalizeTraeCredential(raw, edition, source) {
	if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return void 0;
	const value = raw;
	const accessToken = optionalString(value["token"]) ?? optionalString(value["accessToken"]);
	if (accessToken === void 0) return void 0;
	const expiresAtMs = timeToMs(value["expiredAt"] ?? value["expiresAt"]) ?? 0;
	const refreshExpiresAtMs = timeToMs(value["refreshExpiredAt"] ?? value["refreshExpiresAt"]);
	const refreshToken = optionalString(value["refreshToken"]);
	const userRegion = userRegionOf(value["userRegion"]);
	const account = typeof value["account"] === "object" && value["account"] !== null && !Array.isArray(value["account"]) ? value["account"] : void 0;
	const accountName = optionalString(account?.["username"]);
	const tenantId = optionalString(account?.["tenant_id"]) ?? (typeof account?.["tenant_id"] === "number" ? String(account["tenant_id"]) : void 0);
	return {
		accessToken,
		...refreshToken === void 0 ? {} : { refreshToken },
		userId: optionalString(value["userId"]) ?? "",
		...accountName === void 0 ? {} : { accountName },
		...tenantId === void 0 ? {} : { tenantId },
		host: optionalString(value["host"]) ?? "",
		...userRegion === void 0 ? {} : { userRegion },
		expiresAtMs,
		...refreshExpiresAtMs === void 0 ? {} : { refreshExpiresAtMs },
		edition,
		source
	};
}
/**
* Whether this account belongs to a Trae tenant, i.e. may bill the enterprise
* pool.
*
* Evidence (2026-10-17, live): the tenant's own account carries
* `account.tenant_id` / `tenant_name` and `scope: 'saas'`; the personal SOLO
* account carries neither and reports `scope: 'marscode'`. Only the tenant one
* streams on the enterprise gateway — the other answers `4019` risk control.
*/
function isEnterpriseAccount(credential) {
	return credential?.tenantId !== void 0 && credential.tenantId.trim() !== "";
}
function traeAccountId(credential) {
	const stable = `${credential.edition}\0${credential.userId || credential.accountName || "unknown"}`;
	return createHash("sha256").update(stable).digest("hex").slice(0, 24);
}
/**
* The exact shape of an account id — sha256 hex sliced to 24 characters, which is
* what {@link traeAccountId} emits and therefore the only string a request may
* legitimately name.
*
* This regex is a traversal guard as much as a validator: an id becomes part of a
* path (`$DSH_HOME/.trae-pool.<panel>.json` uses it as a key, and a credential
* lookup receives it), so `../../etc/passwd` has to fail here rather than fail
* somewhere closer to the filesystem. Exported so an HTTP route can answer a bad
* id with 400 instead of letting an exception surface as a 500.
*/
const TRAE_ACCOUNT_ID_RE = /^[0-9a-f]{24}$/;
/** Whether a request-supplied value is a well-formed Trae account id. */
function isTraeAccountId(value) {
	return typeof value === "string" && TRAE_ACCOUNT_ID_RE.test(value);
}
/** One stored credential, validated. Returns undefined for a malformed row. */
function credentialOfStored(stored) {
	if (typeof stored !== "object" || stored === null || Array.isArray(stored)) return void 0;
	const record = stored;
	const edition = record["edition"];
	if (edition !== "cn" && edition !== "sg" && edition !== "solo" && edition !== "solo-sg") return void 0;
	return normalizeTraeCredential({
		token: record["accessToken"],
		refreshToken: record["refreshToken"],
		userId: record["userId"],
		host: record["host"],
		userRegion: record["userRegion"],
		account: record["accountName"] === void 0 && record["tenantId"] === void 0 ? void 0 : {
			...record["accountName"] === void 0 ? {} : { username: record["accountName"] },
			...record["tenantId"] === void 0 ? {} : { tenant_id: record["tenantId"] }
		},
		expiredAt: record["expiresAtMs"],
		refreshExpiredAt: record["refreshExpiredAtMs"]
	}, edition, "dsh");
}
/**
* Read the plugin-owned file into its stored credentials.
*
* Accepts BOTH layouts: version 2 (`credentials: [...]`, the import-capable
* shape) and the superseded version 1 (`credential: {...}`). A version-1 file
* keeps working until the next write upgrades it, so no migration step is
* needed and an older install's file is never rejected. A malformed row is
* dropped rather than failing the whole file — one bad imported account must
* not hide the rest.
*
* Returns `undefined` — NOT an empty array — for a file this build cannot parse
* at all: a torn JSON write, a hand-edited document, or a version nothing here
* knows. The distinction is load-bearing (see {@link readOwnForMerge}): every
* merge writer treats `[]` as the merge base but `undefined` as "do not build
* on this", because an unparseable file may still HOLD every account, and
* merging onto "empty" would erase them on the very next refresh.
*/
function parseOwn(text) {
	let document;
	try {
		const parsed = JSON.parse(text);
		if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return void 0;
		document = parsed;
	} catch {
		return;
	}
	if (document.version === OWN_VERSION) {
		if (!Array.isArray(document.credentials)) return void 0;
		return document.credentials.map(credentialOfStored).filter((value) => value !== void 0);
	}
	if (document.version === OWN_VERSION_SINGLE) {
		const single = credentialOfStored(document.credential);
		return single === void 0 ? void 0 : [single];
	}
}
/**
* Move a plugin-owned file this build can no longer parse out of the way, so
* the next write starts from a clean file instead of building on — or being
* refused by — the unreadable one.
*
* The rename is the data preservation: the bytes stay on disk beside the live
* path (`.corrupt-<stamp>`), so a future build that understands the format (or
* a user with a text editor) can still recover the accounts it carried. It is
* best-effort on purpose: a quarantine that cannot happen must not fail the
* user action that triggered it, and the merge writers refuse to overwrite a
* file they could not quarantine (see {@link readOwnForMerge}).
*
* Must be called under the same lock the caller writes under: without the lock
* the rename could interleave with a concurrent writer holding the pre-rename
* content and write it right back.
*/
async function quarantineCorruptOwn(path) {
	const stamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
	try {
		await rename(path, `${path}.corrupt-${stamp}`);
		return true;
	} catch {
		return false;
	}
}
/**
* Write the plugin-owned file: every credential of the region, in the version-2
* array layout.
*
* One writer for both paths that persist to this file (a refresh, and an
* import) so the read-modify-write in `refreshNow` and the additive write in
* {@link TraeCredentialStore.importAccounts} cannot drift apart. Always writes
* `OWN_VERSION`, which is what upgrades a version-1 file on its first write.
*/
async function writeOwn(path, credentials) {
	const document = {
		version: OWN_VERSION,
		credentials: credentials.map((credential) => ({ ...credential }))
	};
	await writeFileAtomic(path, `${JSON.stringify(document, null, 2)}\n`, {
		mode: 384,
		dirMode: 448
	});
}
/**
* How many accounts a quarantined copy still shows, when it can be read at all.
*
* A copy is quarantined because this build could not PARSE it — but not every
* unparseable copy is unreadable: a file whose JSON is intact yet carries a
* version this build does not know still parses as JSON, and its account rows
* are then countable. That number is what tells the user whether one account
* or five went missing, so it is worth the attempt.
*
* A torn copy yields nothing: the count is then ABSENT rather than guessed,
* because a wrong count is worse than no count.
*/
function countStoredAccounts(text) {
	try {
		const parsed = JSON.parse(text);
		if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return void 0;
		const document = parsed;
		if (Array.isArray(document.credentials)) return document.credentials.length;
		if (document.credential !== void 0) return 1;
		return;
	} catch {
		return;
	}
}
/** The key Trae stores the per-user region map under, beside the login itself. */
const TRAE_USERTAG_STORAGE_KEY = "iCubeAuthInfo://usertag";
/**
* Rewrites one Trae `storage.json` so it no longer carries the given login.
*
* Everything else in the document is preserved byte-for-byte at the JSON level:
* only the auth value is dropped and the usertag map loses this one user. Both
* the backup and the atomic write exist because this is the one operation in the
* plugin that edits a file belonging to another application.
*/
async function eraseDesktopLogin(path, document, claims, encoded) {
	const stamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
	try {
		await copyFile(path, `${path}.dsh-backup-${stamp}`);
	} catch {
		return false;
	}
	const next = { ...document };
	delete next[TRAE_AUTH_STORAGE_KEY];
	const userTag = document[TRAE_USERTAG_STORAGE_KEY];
	const userId = typeof claims["userId"] === "string" || typeof claims["userId"] === "number" ? String(claims["userId"]) : void 0;
	if (userId !== void 0 && typeof userTag === "string") try {
		const decoded = parseTraeAuthValue(userTag);
		if (typeof decoded === "object" && decoded !== null && !Array.isArray(decoded)) {
			const tags = { ...decoded };
			delete tags[userId];
			next[TRAE_USERTAG_STORAGE_KEY] = encryptTraeStorageValue(JSON.stringify(tags), traeStorageValueType(userTag));
		}
	} catch {}
	try {
		await writeFileAtomic(path, `${JSON.stringify(next, null, 2)}\n`, { mode: 384 });
		return !(await readFile(path, "utf8")).includes(encoded);
	} catch {
		return false;
	}
}
var TraeCredentialStore = class {
	storagePathOverride;
	edition;
	accountId;
	region;
	requireTenant;
	hideTenantAccounts;
	ownPathExplicit;
	legacyOwnPath;
	legacyOwnPathExplicit;
	refresh;
	refreshMarginMs;
	runningApps;
	inflight;
	/**
	* In-flight refreshes of individual accounts, one per account id.
	*
	* The card reads every member's balance in one poll and each balance can
	* decide to refresh, so without this dedupe the same account would exchange
	* its token several times in a second and the last writer would win over a
	* copy another read already holds.
	*/
	inflightByAccount = /* @__PURE__ */ new Map();
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
	refreshFailedAtMs = /* @__PURE__ */ new Map();
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
	rotatedAccountId;
	constructor(options) {
		this.storagePathOverride = options.storagePath;
		this.edition = options.edition ?? "auto";
		this.accountId = options.accountId;
		this.region = options.region;
		this.requireTenant = options.requireTenant === true;
		this.hideTenantAccounts = options.hideTenantAccounts === true;
		this.ownPathExplicit = options.ownPath;
		this.legacyOwnPath = options.legacyOwnPath ?? legacyTraeOwnAuthPath();
		this.legacyOwnPathExplicit = options.legacyOwnPath;
		this.refresh = options.refresh;
		this.refreshMarginMs = options.refreshMarginMs ?? 3e5;
		this.runningApps = options.runningApps ?? probeRunningTraeApps;
	}
	/** Whether a credential's own claim belongs to this store's region. */
	matchesRegion(credential) {
		return this.region === void 0 || regionOfCredential(credential) === this.region;
	}
	/**
	* The path this store refreshes into: the per-region file for a
	* region-scoped store, the legacy single file otherwise, or an explicitly
	* injected path in tests.
	*/
	ownAuthPath() {
		if (this.ownPathExplicit !== void 0) return this.ownPathExplicit;
		return this.region !== void 0 ? traeOwnAuthPath(this.region) : this.legacyOwnPath;
	}
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
	ownCandidates() {
		if (this.ownPathExplicit !== void 0) return this.legacyOwnPathExplicit !== void 0 ? [this.ownPathExplicit, this.legacyOwnPathExplicit] : [this.ownPathExplicit];
		if (this.region !== void 0) return [traeOwnAuthPath(this.region), this.legacyOwnPath];
		return [
			this.legacyOwnPath,
			traeOwnAuthPath("cn"),
			traeOwnAuthPath("ai")
		];
	}
	/**
	* Where the "deleted copy" tombstones live for this store.
	*
	* Derived from the store's own copy path, so a test that pins `ownPath` also
	* pins the tombstones and can never touch the real `~/.dsh` file.
	*/
	deletedPath() {
		if (this.ownPathExplicit !== void 0) return `${this.ownPathExplicit}.deleted`;
		if (this.legacyOwnPathExplicit !== void 0) return `${this.legacyOwnPathExplicit}.deleted`;
		return traeDeletedAccountsPath(this.region);
	}
	/**
	* The account ids whose copy the user deleted on purpose.
	*
	* Read defensively: a missing, unreadable, or hand-edited file means "no
	* tombstones", never a failing store — losing the list only re-mirrors an
	* account, it never locks the user out.
	*/
	async readTombstones() {
		const text = await readFile(this.deletedPath(), "utf8").catch(() => "");
		if (text.trim() === "") return /* @__PURE__ */ new Set();
		try {
			const parsed = JSON.parse(text);
			const ids = Array.isArray(parsed) ? parsed : typeof parsed === "object" && parsed !== null && Array.isArray(parsed.ids) ? parsed.ids : [];
			return new Set(ids.filter((id) => typeof id === "string" && TRAE_ACCOUNT_ID_RE.test(id)));
		} catch {
			return /* @__PURE__ */ new Set();
		}
	}
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
	async updateTombstones(mutator) {
		const path = this.deletedPath();
		await withFileLock(path, async () => {
			const ids = await this.readTombstones();
			mutator(ids);
			await writeFileAtomic(path, `${JSON.stringify({
				version: 1,
				ids: [...ids]
			}, null, 2)}\n`, {
				mode: 384,
				dirMode: 448
			});
		}).catch(() => void 0);
	}
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
	async readOwnForMerge(path) {
		const text = await readFile(path, "utf8").catch(() => void 0);
		if (text === void 0) return [];
		const parsed = parseOwn(text);
		if (parsed !== void 0) return parsed;
		return await quarantineCorruptOwn(path) ? [] : void 0;
	}
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
	async mirrorLocalLogins() {
		const { credentials: discovered } = await this.readDesktopAll();
		const own = await this.readOwns();
		const ownIds = new Set(own.map((credential) => traeAccountId(credential)));
		const liveIds = new Set(discovered.map((credential) => traeAccountId(credential)));
		const tombstones = await this.readTombstones();
		if ([...tombstones].some((id) => !liveIds.has(id))) await this.updateTombstones((ids) => {
			for (const id of [...ids]) if (!liveIds.has(id)) ids.delete(id);
		});
		const missing = discovered.filter((credential) => this.matchesRegion(credential) && !ownIds.has(traeAccountId(credential)) && !tombstones.has(traeAccountId(credential)));
		if (missing.length === 0) return;
		const ownPath = this.ownAuthPath();
		await withFileLock(ownPath, async () => {
			const existing = await this.readOwnForMerge(ownPath);
			if (existing === void 0) return;
			const byId = new Map(existing.map((credential) => [traeAccountId(credential), credential]));
			for (const credential of missing) {
				const id = traeAccountId(credential);
				if (byId.has(id)) continue;
				byId.set(id, {
					...credential,
					source: "dsh"
				});
			}
			await writeOwn(ownPath, [...byId.values()]);
		});
	}
	setSource(storagePath, edition = "auto", accountId) {
		this.storagePathOverride = storagePath;
		this.edition = edition;
		this.accountId = accountId;
		this.inflight = void 0;
	}
	selectAccount(accountId) {
		this.accountId = accountId;
		this.inflight = void 0;
	}
	candidates() {
		if (this.storagePathOverride !== void 0) {
			const edition = this.edition === "auto" ? "cn" : this.edition;
			return [{
				edition,
				path: this.storagePathOverride,
				source: "desktop"
			}, {
				edition,
				path: this.storagePathOverride,
				source: "cli"
			}];
		}
		const all = traeStorageCandidates();
		const cliEdition = "cn";
		return this.edition === "auto" ? all.filter((candidate) => candidate.source === "desktop" || candidate.edition === cliEdition) : all.filter((candidate) => candidate.edition === this.edition && (candidate.source === "desktop" || candidate.edition === cliEdition));
	}
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
	preferred(credentials) {
		const eligible = this.requireTenant ? credentials.filter((credential) => isEnterpriseAccount(credential)) : credentials;
		if (eligible.length === 0) return void 0;
		return eligible.find((credential) => credential.source === "desktop") ?? eligible[0];
	}
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
	offered(discovered) {
		const eligible = this.requireTenant ? discovered.filter((credential) => isEnterpriseAccount(credential)) : this.hideTenantAccounts ? discovered.filter((credential) => !isEnterpriseAccount(credential)) : discovered;
		return eligible.length > 0 ? eligible : discovered;
	}
	async accounts() {
		await this.mirrorLocalLogins();
		const discovered = await this.readAll();
		const copyIds = /* @__PURE__ */ new Set();
		for (const credential of await this.readOwns()) {
			if (!this.matchesRegion(credential)) continue;
			copyIds.add(traeAccountId(credential));
		}
		const visible = discovered.filter((credential) => copyIds.has(traeAccountId(credential)));
		const offered = this.offered(visible);
		const inUse = this.inUse(discovered, offered);
		/**
		* Never hide the account we are actually billing.
		*
		* An explicit binding outranks the display filter (`inUse` honours it even
		* when the offered list withholds it), and a list whose active row is
		* invisible is worse than no list: the card's "save the selected account"
		* press reads `selected`, so a hidden binding would be rewritten to whichever
		* account merely happened to be DISPLAYED — silently moving the user's
		* billing to an account they never chose. Re-appending it costs one extra
		* row and makes the card tell the truth.
		*/
		const credentials = inUse !== void 0 && !offered.includes(inUse) ? [...offered, inUse] : offered;
		const inUseId = inUse === void 0 ? void 0 : traeAccountId(inUse);
		return credentials.map((credential) => ({
			id: traeAccountId(credential),
			accountName: credential.accountName ?? (credential.userId || `${credential.edition} account`),
			edition: credential.edition,
			enterprise: isEnterpriseAccount(credential),
			region: assertSupportedRegion(regionOfCredential(credential)),
			source: "dsh",
			tokenExpiresAtMs: credential.expiresAtMs,
			...credential.refreshExpiresAtMs === void 0 ? {} : { refreshExpiresAtMs: credential.refreshExpiresAtMs },
			selected: inUseId !== void 0 && traeAccountId(credential) === inUseId
		}));
	}
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
	inUse(discovered, offered) {
		if (this.accountId === void 0) return this.preferred(offered);
		const selected = discovered.find((credential) => traeAccountId(credential) === this.accountId);
		if (this.requireTenant && !isEnterpriseAccount(selected)) return this.preferred(offered);
		return selected;
	}
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
	setRotatedAccount(accountId) {
		if (this.rotatedAccountId === accountId) return;
		this.rotatedAccountId = accountId;
		this.inflight = void 0;
	}
	/** The rotation currently in effect, for diagnostics and the pool's own card. */
	rotatedAccount() {
		return this.rotatedAccountId;
	}
	/**
	* The credential a rotation points at, or `undefined` when it cannot be
	* honoured (the login was removed from this machine, or a tenant-scoped store
	* refuses a personal account).
	*
	* Never substitutes a different account here: the caller then applies the
	* user's binding, which is the honest answer when the pool's choice is gone.
	*/
	rotated(discovered, offered) {
		const id = this.rotatedAccountId;
		if (id === void 0) return void 0;
		const credential = offered.find((item) => traeAccountId(item) === id) ?? discovered.find((item) => traeAccountId(item) === id);
		if (credential === void 0) return void 0;
		if (this.requireTenant && !isEnterpriseAccount(credential)) return void 0;
		return credential;
	}
	async current() {
		const discovered = await this.readAll();
		const offered = this.offered(discovered);
		const rotated = this.rotated(discovered, offered);
		if (rotated !== void 0) return rotated;
		return this.inUse(discovered, offered);
	}
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
	async credentialOf(accountId) {
		if (accountId === "") return void 0;
		return (await this.readAll()).find((credential) => traeAccountId(credential) === accountId);
	}
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
	async copyOf(accountId) {
		if (accountId === "") return void 0;
		return (await this.readOwns()).find((credential) => traeAccountId(credential) === accountId);
	}
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
	async resolveCredentialOf(accountId) {
		const credential = await this.credentialOf(accountId);
		if (credential === void 0) return void 0;
		if (credential.expiresAtMs > Date.now() + this.refreshMarginMs) return credential;
		const pending = this.inflightByAccount.get(accountId);
		if (pending !== void 0) return pending;
		const failedAt = this.refreshFailedAtMs.get(accountId);
		if (failedAt !== void 0 && Date.now() - failedAt < REFRESH_RETRY_MS) return credential;
		const attempt = this.refreshNow(credential).then((refreshed) => {
			this.refreshFailedAtMs.delete(accountId);
			return refreshed;
		}).catch(() => {
			this.refreshFailedAtMs.set(accountId, Date.now());
			return credential;
		}).finally(() => {
			this.inflightByAccount.delete(accountId);
		});
		this.inflightByAccount.set(accountId, attempt);
		return attempt;
	}
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
	async importAccounts(credentials) {
		if (credentials.length === 0) return [];
		const ownPath = this.ownAuthPath();
		const written = [];
		await withFileLock(ownPath, async () => {
			const existing = await this.readOwnForMerge(ownPath);
			if (existing === void 0) return;
			const byId = /* @__PURE__ */ new Map();
			for (const item of existing) byId.set(traeAccountId(item), item);
			for (const credential of credentials) {
				const stored = {
					...credential,
					source: "dsh"
				};
				const id = traeAccountId(stored);
				byId.set(id, stored);
				written.push(id);
			}
			await writeOwn(ownPath, [...byId.values()]);
		});
		if (written.length > 0) {
			this.accountId = written[written.length - 1];
			this.inflight = void 0;
		}
		return written;
	}
	async resolve() {
		const credential = await this.current();
		if (credential === void 0) {
			const first = (await this.unsupportedCredentials().catch(() => []))[0];
			if (first !== void 0) throw new TraeUnsupportedRegionError(first.region);
			throw new Error(`trae: no signed-in account found (${this.candidates().map((item) => item.path).join(" or ")})`);
		}
		if (credential.expiresAtMs > Date.now() + this.refreshMarginMs) return credential;
		this.inflight ??= this.refreshNow(credential).finally(() => {
			this.inflight = void 0;
		});
		return this.inflight;
	}
	async status() {
		try {
			const value = await this.current();
			return value === void 0 ? { state: "signed-out" } : {
				state: "signed-in",
				edition: value.edition,
				expiresAtMs: value.expiresAtMs,
				source: value.source
			};
		} catch {
			return { state: "signed-out" };
		}
	}
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
	async unsupportedCredentials() {
		if (this.region !== void 0 && this.region !== "ai") return [];
		const found = /* @__PURE__ */ new Map();
		const consider = (credential) => {
			const region = regionOfCredential(credential);
			if (isSupportedRegion(region)) return;
			const id = traeAccountId(credential);
			if (found.has(id)) return;
			found.set(id, {
				region,
				accountName: credential.accountName ?? (credential.userId || `${credential.edition} account`)
			});
		};
		try {
			for (const credential of (await this.readDesktopAll()).credentials) consider(credential);
		} catch {}
		try {
			for (const credential of await this.readOwns()) consider(credential);
		} catch {}
		return [...found.values()];
	}
	async desktopFilePresent() {
		for (const candidate of this.candidates()) try {
			if ((await stat(candidate.path)).isFile()) return true;
		} catch {}
		return false;
	}
	/**
	* Remove every plugin-owned copy this store could read (per-region file,
	* legacy single file, and their lock siblings); the desktop storage files
	* are untouched. A region store's logout therefore also clears the legacy
	* migration source — deliberate: `logout` is the user's "forget what the
	* plugin stored" action, not a per-account toggle.
	*/
	async logout() {
		for (const path of this.ownCandidates()) {
			await rm(path, { force: true });
			await rm(`${path}.lock`, { force: true });
		}
	}
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
	async deleteDesktopLogins(accountId) {
		const signedOut = [];
		const blocked = [];
		const seen = /* @__PURE__ */ new Set();
		for (const candidate of this.candidates()) {
			if (candidate.source !== "desktop" || seen.has(candidate.path)) continue;
			seen.add(candidate.path);
			const document = await readFile(candidate.path, "utf8").then((text) => JSON.parse(text)).catch(() => void 0);
			if (document === void 0) continue;
			const encoded = document[TRAE_AUTH_STORAGE_KEY];
			if (typeof encoded !== "string") continue;
			let claims;
			try {
				const parsed = parseTraeAuthValue(encoded);
				if (typeof parsed !== "object" || parsed === null) continue;
				claims = parsed;
			} catch {
				continue;
			}
			const credential = normalizeTraeCredential(claims, candidate.edition, "desktop");
			if (credential === void 0 || traeAccountId(credential) !== accountId) continue;
			if ((await this.runningApps().catch(() => /* @__PURE__ */ new Set())).has(candidate.edition)) {
				blocked.push(candidate.edition);
				continue;
			}
			if (await eraseDesktopLogin(candidate.path, document, claims, encoded)) signedOut.push(candidate.edition);
			else blocked.push(candidate.edition);
		}
		return {
			signedOut: [...new Set(signedOut)],
			blocked: [...new Set(blocked)]
		};
	}
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
	async deleteAccount(accountId) {
		let mutated = false;
		for (const path of this.ownCandidates()) {
			const dropped = await withFileLock(path, async () => {
				const existing = await readFile(path, "utf8").then((text) => parseOwn(text) ?? null, () => null);
				if (existing === null || !existing.some((credential) => traeAccountId(credential) === accountId)) return false;
				const next = existing.filter((credential) => traeAccountId(credential) !== accountId);
				await writeOwn(path, next);
				return true;
			}).catch(() => false);
			mutated = mutated || dropped;
		}
		await this.updateTombstones((ids) => {
			ids.add(accountId);
		});
		if (this.accountId === accountId) {
			this.accountId = void 0;
			this.inflight = void 0;
		}
		const { signedOut, blocked } = await this.deleteDesktopLogins(accountId);
		const stillInOwn = (await this.readOwns()).some((credential) => traeAccountId(credential) === accountId);
		const { credentials: discovered } = await this.readDesktopAll();
		const stillSignedIn = discovered.some((credential) => traeAccountId(credential) === accountId);
		return {
			deleted: !stillInOwn && !stillSignedIn,
			stillSignedIn,
			hadCopy: mutated || signedOut.length > 0,
			signedOutApps: signedOut,
			blockedApps: blocked
		};
	}
	/**
	* Every local credential of this store's region, deduplicated by account id.
	* A region-scoped store sees only its own region's credentials: the other
	* region's accounts are invisible to selection, refresh, and status alike,
	* which is what keeps the two regions' providers from cross-billing.
	*/
	async readAll() {
		const { credentials: desktop } = await this.readDesktopAll();
		const byAccount = /* @__PURE__ */ new Map();
		const consider = (credential) => {
			if (!isSupportedRegion(regionOfCredential(credential))) return;
			if (!this.matchesRegion(credential)) return;
			const id = traeAccountId(credential);
			const incumbent = byAccount.get(id);
			if (incumbent === void 0 || credential.expiresAtMs > incumbent.expiresAtMs) byAccount.set(id, credential);
		};
		for (const credential of desktop) consider(credential);
		for (const own of await this.readOwns()) consider(own);
		return [...byAccount.values()];
	}
	/**
	* Which paths were tried and why each one failed. Read-only and token-free:
	* it exists so a signed-out card can explain itself instead of showing a bare
	* "not signed in", which is undiagnosable on a machine whose layout differs
	* from the ones the plugin was written against.
	*/
	async diagnose() {
		const tried = this.candidates();
		const failures = [];
		for (const candidate of tried) {
			const raw = await readFile(candidate.path, "utf8").then((text) => ({ text }), (error) => ({ error }));
			if ("error" in raw) {
				const code = typeof raw.error === "object" && raw.error !== null && "code" in raw.error ? raw.error.code : void 0;
				failures.push({
					path: candidate.path,
					edition: candidate.edition,
					source: candidate.source,
					reason: code === "ENOENT" ? "missing" : "unreadable",
					...code === "ENOENT" ? {} : { message: String(raw.error) }
				});
				continue;
			}
			try {
				this.credentialFrom(candidate, raw.text);
			} catch (error) {
				failures.push({
					path: candidate.path,
					edition: candidate.edition,
					source: candidate.source,
					reason: "invalid",
					message: error instanceof Error ? error.message : String(error)
				});
			}
		}
		return {
			tried,
			failures
		};
	}
	/** Parse one candidate file's text into a credential, or throw. */
	credentialFrom(candidate, text) {
		let credential;
		if (candidate.source === "cli") {
			if (regionOfEdition(candidate.edition) !== "cn") throw new Error(`Trae CLI tokens are only verified for the CN region; ${candidate.edition} CLI homes are not supported yet`);
			const claims = parseTraeCliToken(text);
			credential = normalizeTraeCredential({
				token: claims.accessToken,
				userId: claims.userId,
				host: CLI_DEFAULT_HOST,
				expiredAt: claims.expiresAtMs
			}, candidate.edition, "cli");
		} else credential = normalizeTraeCredential(parseTraeStorageDocument(text), candidate.edition, "desktop");
		if (credential === void 0) throw new Error(`${candidate.source} candidate could not be normalized into a credential`);
		return credential;
	}
	async readDesktopAll() {
		const credentials = [];
		const failures = [];
		for (const candidate of this.candidates()) try {
			const credential = this.credentialFrom(candidate, await readFile(candidate.path, "utf8"));
			if (!credentials.some((existing) => traeAccountId(existing) === traeAccountId(credential))) credentials.push(credential);
		} catch (error) {
			const code = typeof error === "object" && error !== null && "code" in error ? error.code : void 0;
			failures.push({
				path: candidate.path,
				edition: candidate.edition,
				source: candidate.source,
				reason: code === "ENOENT" ? "missing" : code === void 0 ? "invalid" : "unreadable",
				...code === "ENOENT" || code === void 0 && !(error instanceof Error) ? {} : { message: error instanceof Error ? error.message : String(error) }
			});
			continue;
		}
		return {
			credentials,
			failures
		};
	}
	/**
	* Every readable plugin-owned copy, in candidate order; absent or corrupt
	* files are skipped rather than propagated.
	*/
	async readOwns() {
		const copies = [];
		for (const path of this.ownCandidates()) try {
			const parsed = parseOwn(await readFile(path, "utf8"));
			if (parsed !== void 0) copies.push(...parsed);
		} catch {}
		return copies;
	}
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
	async quarantinedCopies() {
		const notices = [];
		const seen = /* @__PURE__ */ new Set();
		for (const path of this.ownCandidates()) {
			const directory = dirname(path);
			const prefix = `${basename(path)}.corrupt-`;
			let entries;
			try {
				entries = await readdir(directory);
			} catch {
				continue;
			}
			for (const name of entries) {
				if (!name.startsWith(prefix)) continue;
				const quarantinedAs = join(directory, name);
				if (seen.has(quarantinedAs)) continue;
				seen.add(quarantinedAs);
				let bytes = 0;
				let accounts;
				try {
					const text = await readFile(quarantinedAs, "utf8");
					bytes = Buffer.byteLength(text);
					accounts = countStoredAccounts(text);
				} catch {}
				notices.push({
					file: path,
					quarantinedAs,
					bytes,
					...accounts === void 0 ? {} : { accounts }
				});
			}
		}
		return notices;
	}
	async refreshNow(credential) {
		if (credential.refreshToken === void 0 || credential.refreshExpiresAtMs !== void 0 && credential.refreshExpiresAtMs <= Date.now()) {
			if (credential.expiresAtMs > Date.now() + 3e4) return credential;
			throw new Error("trae: access token expired and no valid refresh token is available; sign in again in Trae");
		}
		try {
			const outcome = await this.refresh(credential);
			const refreshed = {
				...credential,
				accessToken: outcome.accessToken,
				...outcome.refreshToken === void 0 ? {} : { refreshToken: outcome.refreshToken },
				expiresAtMs: outcome.expiresAtMs,
				...outcome.refreshExpiresAtMs === void 0 ? {} : { refreshExpiresAtMs: outcome.refreshExpiresAtMs },
				...outcome.host === void 0 ? {} : { host: outcome.host },
				source: "dsh"
			};
			const ownPath = this.ownAuthPath();
			await withFileLock(ownPath, async () => {
				const existing = await this.readOwnForMerge(ownPath);
				if (existing === void 0) return;
				const refreshedId = traeAccountId(refreshed);
				const entries = existing.filter((item) => traeAccountId(item) !== refreshedId);
				entries.push(refreshed);
				await writeOwn(ownPath, entries);
			});
			return refreshed;
		} catch (error) {
			if (credential.expiresAtMs > Date.now() + 3e4) return credential;
			throw new Error(`trae: token refresh failed and access token is expired (${String(error)}); sign in again in Trae`);
		}
	}
};
//#endregion
//#region src/refresh.ts
/** Path of the current token-exchange endpoint, relative to the credential host. */
const TRAE_EXCHANGE_TOKEN_PATH = "/trae/api/v3/oauth/ExchangeToken";
/** Path of the superseded endpoint; only reachable as the fallback. */
const TRAE_LEGACY_EXCHANGE_TOKEN_PATH = "/cloudide/api/v3/trae/oauth/ExchangeToken";
/** Shared desktop ClientID; the current contract also uses it for `cn` / `sg`. */
const DESKTOP_CLIENT_ID = "ono9krqynydwx5";
/** SOLO ClientID; every SOLO package uses it, CN and international alike. */
const SOLO_CLIENT_ID = "en1oxy7wnw8j9n";
/** The current contract: `/trae/api/v3`, per-edition ClientID, always proofed. */
const CURRENT_CONTRACT = {
	cn: {
		path: TRAE_EXCHANGE_TOKEN_PATH,
		clientId: DESKTOP_CLIENT_ID,
		platformCode: "IDE_PC"
	},
	sg: {
		path: TRAE_EXCHANGE_TOKEN_PATH,
		clientId: DESKTOP_CLIENT_ID,
		platformCode: "IDE_PC"
	},
	solo: {
		path: TRAE_EXCHANGE_TOKEN_PATH,
		clientId: SOLO_CLIENT_ID,
		platformCode: "SOLO_PC"
	},
	"solo-sg": {
		path: TRAE_EXCHANGE_TOKEN_PATH,
		clientId: SOLO_CLIENT_ID,
		platformCode: "SOLO_PC"
	}
};
function normalizeHost(host) {
	const value = host.trim();
	if (value === "") throw new Error("Trae refresh host is missing");
	return value.replace(/\/$/, "");
}
/** `OSInfo` value the official client sends (a bare platform word). */
function osInfo(platform = process.platform) {
	return platform === "darwin" ? "mac" : platform === "win32" ? "windows" : platform;
}
/**
* Build the exact string the official client signs.
*
* The separator is a NEWLINE, not a space: the shipped bundle joins the six
* fields with `.join("\n")`. This is load-bearing rather than cosmetic — a
* space-joined message of identical fields is rejected with `20403 Token device
* not match`, which is indistinguishable from a wrong key and sends debugging
* in entirely the wrong direction.
*/
function traeDeviceProofMessage(input) {
	return [
		"POST",
		input.path,
		input.clientId,
		input.refreshToken,
		String(input.timestamp),
		input.nonce
	].join("\n");
}
/**
* Sign a device proof with the install's own private key.
*
* `timestamp`/`nonce` are injectable so tests can pin a deterministic signature;
* the defaults are the whole-second timestamp and 16 random bytes the official
* client uses.
*/
function signTraeDeviceProof(input) {
	const timestamp = input.timestamp ?? Math.floor(Date.now() / 1e3);
	const nonce = input.nonce ?? randomBytes(16).toString("hex");
	const message = traeDeviceProofMessage({
		path: input.path,
		clientId: input.clientId,
		refreshToken: input.refreshToken,
		timestamp,
		nonce
	});
	return {
		Signature: sign("sha256", Buffer.from(message), input.privateKeyPEM).toString("base64"),
		Timestamp: timestamp,
		Nonce: nonce
	};
}
/** The `DeviceInfo` block the current contract sends. */
function traeDeviceInfoBody(contract, device, platform) {
	const os = osInfo(platform);
	return {
		DeviceID: device.deviceId,
		MachineID: device.machineId,
		PlatformCode: contract.platformCode,
		DeviceType: "PC",
		...device.deviceName === void 0 ? {} : { DeviceName: device.deviceName },
		...device.deviceModel === void 0 ? {} : { DeviceModel: device.deviceModel },
		...device.appVersion === void 0 ? {} : { ClientVersion: device.appVersion },
		...device.deviceKeyPair === void 0 ? {} : { DevicePublicKey: device.deviceKeyPair.publicKeyPEM },
		...device.deviceBrand === void 0 ? {} : { DeviceBrand: device.deviceBrand },
		...device.deviceCpu === void 0 ? {} : { DeviceCPU: device.deviceCpu },
		OSInfo: os,
		OSVersion: device.osVersion ?? `${os} ${hostname()}`
	};
}
/** The current contract's complete request body. */
function currentBody(credential, contract, device) {
	return {
		ClientID: contract.clientId,
		ClientSecret: "",
		RefreshToken: credential.refreshToken,
		DeviceInfo: traeDeviceInfoBody(contract, device),
		DeviceProof: signTraeDeviceProof({
			path: contract.path,
			clientId: contract.clientId,
			refreshToken: credential.refreshToken ?? "",
			privateKeyPEM: device.deviceKeyPair.privateKeyPEM
		}),
		...device.appVersion === void 0 ? {} : { IDEVersion: device.appVersion }
	};
}
/**
* The superseded shape, kept as a fallback for installs the current contract
* cannot serve: a machine whose `storage.json` carries no device keypair (an
* older install that has never refreshed on the new contract, or a CLI-only
* home) has nothing to sign a proof with.
*
* The ClientID split is the SAME one the current contract uses, and that is not
* a coincidence — it is enforced by the OAuth CLIENT, not by the endpoint: a
* SOLO-package refresh token is refused by the DESKTOP client with `10101
* refresh token is not matched to the client`, and vice versa, on this path
* exactly as on the current one. Verified 2026-10-11 across all four editions:
* each answers 200 here with its own ClientID and 400 with the other one.
*
* The pre-3.1.0 code hardcoded the desktop ClientID on this path, which is why
* an international SOLO account had no working fallback at all.
*/
function legacyBody(credential, clientId) {
	return {
		ClientID: clientId,
		ClientSecret: "-",
		RefreshToken: credential.refreshToken,
		UserID: credential.userId
	};
}
/** Parse one ExchangeToken response into an outcome, or throw with the reason. */
function outcomeOf(payload, label) {
	const result = payload.Result;
	const accessToken = typeof result?.["Token"] === "string" ? result["Token"] : "";
	if (accessToken === "") throw new Error(`${label} returned no token`);
	const expiry = result?.["TokenExpireAt"];
	const expiresAtMs = typeof expiry === "number" ? expiry : typeof expiry === "string" ? Date.parse(expiry) : NaN;
	if (!Number.isFinite(expiresAtMs)) throw new Error(`${label} returned an invalid expiry`);
	const refreshToken = typeof result?.["RefreshToken"] === "string" && result["RefreshToken"] !== "" ? result["RefreshToken"] : void 0;
	const refreshExpiry = result?.["RefreshExpireAt"];
	const parsedRefreshExpiry = typeof refreshExpiry === "string" ? Date.parse(refreshExpiry) : NaN;
	const refreshExpiresAtMs = typeof refreshExpiry === "number" && Number.isFinite(refreshExpiry) && refreshExpiry > 0 ? refreshExpiry : Number.isFinite(parsedRefreshExpiry) ? parsedRefreshExpiry : void 0;
	return {
		accessToken,
		...refreshToken === void 0 ? {} : { refreshToken },
		expiresAtMs,
		...refreshExpiresAtMs === void 0 ? {} : { refreshExpiresAtMs }
	};
}
/** POST one refresh body and parse it, labelling failures with the path tried. */
async function postExchangeToken(host, path, body, signal, label) {
	const response = await fetch(`${normalizeHost(host)}${path}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
		signal: signal ?? AbortSignal.timeout(3e4)
	});
	if (!response.ok) throw new Error(`${label} failed (http ${response.status})`);
	return outcomeOf(await response.json(), label);
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
async function refreshTraeCredential(credential, signal, device) {
	const contract = CURRENT_CONTRACT[credential.edition];
	if (contract === void 0) throw new Error(`Trae ${credential.edition} refresh contract is not verified`);
	if (credential.refreshToken === void 0) throw new Error("Trae refresh token is missing");
	const attempts = [];
	if (device?.deviceKeyPair === void 0) attempts.push(`${contract.path}: no device keypair in this install's storage`);
	else try {
		return await postExchangeToken(credential.host, contract.path, currentBody(credential, contract, device), signal, "Trae token refresh");
	} catch (error) {
		attempts.push(`${contract.path}: ${error instanceof Error ? error.message : String(error)}`);
	}
	try {
		return await postExchangeToken(credential.host, TRAE_LEGACY_EXCHANGE_TOKEN_PATH, legacyBody(credential, contract.clientId), signal, "Trae token refresh (legacy)");
	} catch (error) {
		attempts.push(`${TRAE_LEGACY_EXCHANGE_TOKEN_PATH}: ${error instanceof Error ? error.message : String(error)}`);
	}
	throw new Error(`Trae token refresh failed — ${attempts.join("; ")}`);
}
//#endregion
//#region src/identity.ts
function nonEmpty$1(value) {
	return typeof value === "string" && value.trim() !== "" ? value.trim() : void 0;
}
function deviceCenterId(storage) {
	const prefix = "iCubeAuthInfo://icube-dc:";
	const ids = Object.keys(storage).filter((key) => key.startsWith(prefix)).map((key) => key.slice(25)).filter(Boolean);
	return ids.length === 1 ? ids[0] : void 0;
}
/**
* Read the install's device keypair out of `storage.json`.
*
* Tolerant on purpose: an older install (or one that has never refreshed on the
* new contract) simply has no keypair, and the caller must still be able to
* resolve an identity for the chat/usage paths — only a refresh then degrades.
* A malformed entry is treated as absent rather than failing the read.
*/
function deviceKeyPairOf(storage) {
	const key = Object.keys(storage).find((name) => name.startsWith("iCubeAuthInfo://icube-dc:"));
	if (key === void 0) return void 0;
	const encoded = storage[key];
	if (typeof encoded !== "string" || encoded.trim() === "") return void 0;
	try {
		const plaintext = parseTraeAuthValue(encoded);
		if (typeof plaintext !== "object" || plaintext === null || Array.isArray(plaintext)) return void 0;
		const value = plaintext;
		const privateKeyPEM = nonEmpty$1(value["privateKeyPEM"]);
		const publicKeyPEM = nonEmpty$1(value["publicKeyPEM"]);
		return privateKeyPEM === void 0 || publicKeyPEM === void 0 ? void 0 : {
			privateKeyPEM,
			publicKeyPEM
		};
	} catch {
		return;
	}
}
/** Read stable identity from Trae-owned files without generating impersonated IDs. */
async function readTraeIdentity(candidate, options = {}) {
	const platform = options.platform ?? process.platform;
	const home = options.home ?? homedir();
	const env = options.env ?? process.env;
	const storage = JSON.parse(await readFile(candidate.path, "utf8"));
	const appRoot = dirname(dirname(dirname(candidate.path)));
	const machineFile = nonEmpty$1(await readFile(join(appRoot, "machineid"), "utf8").catch(() => ""));
	const telemetryMachine = nonEmpty$1(storage["telemetry.machineId"]);
	const devDevice = nonEmpty$1(storage["telemetry.devDeviceId"]);
	const dcDevice = deviceCenterId(storage);
	const machineId = telemetryMachine ?? machineFile;
	if (machineId === void 0) throw new Error(`Trae ${candidate.edition} has no stable machine identity`);
	const deviceId = dcDevice ?? devDevice ?? createHash("sha256").update(machineId).digest("hex").slice(0, 32);
	const buildVersion = nonEmpty$1(storage["iCubeLastVersion"]);
	const appName = {
		cn: "Trae CN",
		sg: "Trae",
		solo: "TRAE SOLO CN",
		"solo-sg": "TRAE SOLO"
	}[candidate.edition];
	const productPaths = [];
	if (appName !== void 0 && (platform === "darwin" || platform === "win32")) {
		if (platform === "darwin") productPaths.push(join("/Applications", `${appName}.app`, "Contents", "Resources", "app", "product.json"));
		else {
			const localRoots = [env.LOCALAPPDATA, join(home, "AppData", "Local")].filter((value) => typeof value === "string" && value !== "").filter((value, index, all) => all.indexOf(value) === index);
			for (const root of localRoots) for (const spelling of traeWindowsAppNames(candidate.edition)) productPaths.push(join(root, "Programs", spelling, "resources", "app", "product.json"));
		}
	}
	let product = {};
	for (const path of productPaths) try {
		product = JSON.parse(await readFile(path, "utf8"));
		break;
	} catch {}
	const appVersion = nonEmpty$1(product["appVersion"]);
	const deviceBrand = platform === "darwin" ? nonEmpty$1(env["TRAE_DEVICE_BRAND"]) : void 0;
	const deviceCpu = cpus()[0]?.model.split(" ")[0];
	const osVersion = `${platform === "darwin" ? "macOS" : platform === "win32" ? "Windows" : platform} ${release()}`;
	const deviceName = (() => {
		try {
			return nonEmpty$1(userInfo().username);
		} catch {
			return;
		}
	})();
	const deviceModel = nonEmpty$1(env["TRAE_DEVICE_MODEL"]);
	const deviceKeyPair = deviceKeyPairOf(storage);
	return {
		edition: candidate.edition,
		machineId,
		deviceId,
		...appVersion === void 0 ? {} : { appVersion },
		...buildVersion === void 0 ? {} : { buildVersion },
		...deviceBrand === void 0 ? {} : { deviceBrand },
		...deviceCpu === void 0 ? {} : { deviceCpu },
		...deviceName === void 0 ? {} : { deviceName },
		...deviceModel === void 0 ? {} : { deviceModel },
		...deviceKeyPair === void 0 ? {} : { deviceKeyPair },
		osVersion,
		platform
	};
}
/** Detect a missing storage file (as opposed to a parse/identity error). */
function isFileMissing(error) {
	return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
/** Prefix of the "no candidate exists on disk" error; see {@link resolveTraeIdentity}. */
const STORAGE_MISSING_PREFIX = "Trae storage was not found";
/**
* Try candidates in order and return the first that yields a valid identity;
* fail hard only when none do. Mirrors the credential store's skip-missing
* semantics so a machine with only SOLO (no CN install) resolves correctly
* instead of pinning the first candidate and throwing on a missing file.
* When every candidate is absent from disk the error names all tried paths;
* a candidate that exists but fails to parse still surfaces its own error.
*/
async function pickTraeStorageIdentity(candidates, options = {}) {
	let lastError;
	let anyPresent = false;
	for (const candidate of candidates) try {
		return await readTraeIdentity(candidate, options);
	} catch (error) {
		lastError = error;
		if (!isFileMissing(error)) anyPresent = true;
	}
	const tried = candidates.map((item) => item.path).join(" or ");
	if (!anyPresent) throw new Error(`${STORAGE_MISSING_PREFIX} (${tried})`);
	throw lastError instanceof Error ? lastError : /* @__PURE__ */ new Error(`Trae identity could not be resolved (${tried})`);
}
/** CLI dotfile home per edition; the CLI keeps its own home, not an Application Support entry. */
const CLI_HOME_BY_EDITION = {
	cn: ".trae-cn",
	solo: ".trae-cn",
	sg: ".trae",
	"solo-sg": ".trae"
};
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
async function readTraeCliIdentity(edition, options = {}) {
	const platform = options.platform ?? process.platform;
	const home = options.home ?? homedir();
	const env = options.env ?? process.env;
	const cliHome = join(home, CLI_HOME_BY_EDITION[edition]);
	const argv = await readJsonFile(join(cliHome, "argv.json"));
	const version = await readJsonFile(join(cliHome, "builtin", "ide_version.json"));
	const crashReporterId = nonEmpty$1(argv?.["crash-reporter-id"]);
	const host = nonEmpty$1(env["HOSTNAME"]) ?? await readHostname() ?? "unknown-host";
	const user = nonEmpty$1(env["USER"]) ?? nonEmpty$1(env["USERNAME"]) ?? "unknown-user";
	const deviceId = crashReporterId ?? createHash("sha256").update(`trae-cli\0${host}\0${user}`).digest("hex").slice(0, 32);
	const machineId = createHash("sha256").update(`trae-cli-machine\0${deviceId}\0${host}`).digest("hex");
	const appVersion = nonEmpty$1(version?.["version"]);
	const deviceCpu = cpus()[0]?.model.split(" ")[0];
	const osVersion = `${platform === "darwin" ? "macOS" : platform === "win32" ? "Windows" : platform} ${release()}`;
	return {
		edition,
		machineId,
		deviceId,
		...appVersion === void 0 ? {} : { appVersion },
		...deviceCpu === void 0 ? {} : { deviceCpu },
		osVersion,
		platform
	};
}
/** Read and parse a JSON file, tolerating absence and malformed content. */
async function readJsonFile(path) {
	try {
		const parsed = JSON.parse(await readFile(path, "utf8"));
		return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed : void 0;
	} catch {
		return;
	}
}
/** OS host name, or undefined when unavailable. */
async function readHostname() {
	try {
		const { hostname } = await import("node:os");
		return nonEmpty$1(hostname());
	} catch {
		return;
	}
}
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
async function resolveTraeIdentity(candidates, edition, options = {}) {
	try {
		return await pickTraeStorageIdentity(candidates, options);
	} catch (error) {
		if (!(error instanceof Error) || !error.message.startsWith(STORAGE_MISSING_PREFIX)) throw error;
		return readTraeCliIdentity(edition, options);
	}
}
/** Headers derived from actual persisted identity, never a new random identity per request. */
function identityHeaders(identity) {
	return {
		"x-machine-id": identity.machineId,
		"x-device-id": identity.deviceId,
		"x-device-type": identity.platform === "darwin" ? "mac" : identity.platform === "win32" ? "windows" : identity.platform,
		...identity.deviceBrand === void 0 ? {} : { "x-device-brand": identity.deviceBrand },
		...identity.deviceCpu === void 0 ? {} : { "x-device-cpu": identity.deviceCpu },
		...identity.osVersion === void 0 ? {} : { "x-os-version": identity.osVersion },
		...identity.appVersion === void 0 ? {} : {
			"x-app-version": identity.appVersion,
			"x-ide-version": identity.appVersion
		},
		...identity.buildVersion === void 0 ? {} : {
			"x-app-version-code": identity.buildVersion,
			"x-ide-version-code": identity.buildVersion
		},
		"x-ide-version-type": "stable"
	};
}
//#endregion
//#region src/model-order.ts
/**
* Wire name of the default SOLO chat function.
*
* Lives here rather than in `solo.ts` so this module stays importable from the
* client; `solo.ts` re-exports it, so there is still exactly one definition.
*/
const TRAE_SOLO_FUNCTION = "solo_work_lite";
/**
* The chat functions of one region, in PRIORITY order.
*
* Two consumers read it, and both mean "priority", which is why they can share
* one array: the wire asks these functions in order and the first to list a
* config owns it (`solo.ts`), and the card draws the groups in the same order so
* the row a user sees first is the one the resolver prefers.
*/
const TRAE_CHANNEL_PRIORITY = {
	cn: [
		"solo_work_remote",
		TRAE_SOLO_FUNCTION,
		"solo_agent_remote",
		"chat_v3",
		"solo_coder"
	],
	ai: [
		"solo_work_remote",
		TRAE_SOLO_FUNCTION,
		"solo_agent_remote",
		"chat_v3"
	]
};
/**
* Rank of one channel inside the region's priority list.
*
* Three cases, and the order between them is deliberate:
*
*  - a known chat channel: its index in the priority list;
*  - an UNKNOWN channel name (a function the region does not call through —
*    `withChatCallableFunctions` clears those, so this is a defensive branch):
*    after every known channel, then alphabetically among themselves;
*  - NO channel at all (a row demoted to the default chat function): last. Such
*    a row is the one the resolver knows least about, so it must not push a
*    properly attributed row down the list.
*/
function channelRank(channel, priority) {
	if (channel === void 0 || channel === "") return priority.length + 1;
	const known = priority.indexOf(channel);
	return known === -1 ? priority.length : known;
}
/**
* Compare two display names the way a person reading a model list expects:
* case-insensitively, with embedded numbers compared as NUMBERS, so `GLM-5.10`
* sorts after `GLM-5.9`. Plain text comparison puts `5.10` first, which reads as
* a bug to anyone who sees the version numbers.
*/
function compareNames(left, right) {
	const byName = left.trim().localeCompare(right.trim(), void 0, {
		numeric: true,
		sensitivity: "base"
	});
	return byName !== 0 ? byName : left.localeCompare(right);
}
/**
* The catalog in display order: channel priority first, then name.
*
* Total and stable — ties fall through to `id`, so two rows with the same name
* in the same channel still get one fixed order rather than the order they
* arrived in.
*/
function orderTraeModels(rows, region = "cn") {
	const priority = TRAE_CHANNEL_PRIORITY[region] ?? TRAE_CHANNEL_PRIORITY.cn;
	return [...rows].sort((left, right) => {
		const byRank = channelRank(left.wireFunction, priority) - channelRank(right.wireFunction, priority);
		if (byRank !== 0) return byRank;
		if (left.wireFunction !== right.wireFunction) return (left.wireFunction ?? "").localeCompare(right.wireFunction ?? "");
		const byName = compareNames(left.name, right.name);
		return byName !== 0 ? byName : left.id.localeCompare(right.id);
	});
}
/**
* Split rows into channel groups, in display order.
*
* Ordering is re-applied here rather than trusted from the caller: a group list
* built from an unsorted input would put the groups in arrival order, which is
* the exact instability this module exists to remove.
*/
function groupTraeModels(rows, region = "cn") {
	const groups = [];
	const byChannel = /* @__PURE__ */ new Map();
	for (const row of orderTraeModels(rows, region)) {
		const channel = row.wireFunction === "" ? void 0 : row.wireFunction;
		const key = channel ?? "\0default";
		const existing = byChannel.get(key);
		if (existing !== void 0) {
			existing.rows.push(row);
			continue;
		}
		const group = {
			channel,
			rows: [row]
		};
		byChannel.set(key, group);
		groups.push(group);
	}
	return groups;
}
/**
* Does one row match a search query?
*
* Matches the display name, the display id and the WIRE config name — the last
* one because a user debugging a `4001 config_name rejected` arrives with the
* upstream name in hand, and the two differ exactly on the rows that carry a
* suffix (`DeepSeek-V4-Flash` vs `DeepSeek-V4-Flash-Official`).
*/
function traeModelMatchesQuery(model, query) {
	const needle = query.trim().toLowerCase();
	if (needle === "") return true;
	if (model.name.toLowerCase().includes(needle)) return true;
	if (model.id.toLowerCase().includes(needle)) return true;
	return (model.wireConfigName ?? "").toLowerCase().includes(needle);
}
/** Filter by {@link traeModelMatchesQuery}, preserving order. */
function filterTraeModels(rows, query) {
	if (query.trim() === "") return [...rows];
	return rows.filter((row) => traeModelMatchesQuery(row, query));
}
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
const TRAE_COMMON_FUNCTIONS = {
	cn: ["solo_work_remote", TRAE_SOLO_FUNCTION],
	ai: ["solo_work_remote", TRAE_SOLO_FUNCTION]
};
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
function traeModelCallChannel(model) {
	const channel = model.wireFunction;
	return channel === void 0 || channel === "" ? TRAE_SOLO_FUNCTION : channel;
}
/**
* Does this row belong to the view?
*
* Judged on {@link traeModelCallChannel}, never on `wireFunction` directly:
* otherwise the one row without a function (`doubao_1_8`, measured 2026-10-23)
* would fall OUT of the common view while being called through exactly the
* common channel it belongs to.
*/
function traeModelInView(model, view, region = "cn") {
	if (view === "all") return true;
	return (TRAE_COMMON_FUNCTIONS[region] ?? TRAE_COMMON_FUNCTIONS.cn).includes(traeModelCallChannel(model));
}
/** Keep the rows a view asks for, preserving order. */
function scopeTraeModels(rows, view, region = "cn") {
	if (view === "all") return [...rows];
	return rows.filter((row) => traeModelInView(row, view, region));
}
//#endregion
//#region src/shim.ts
const BODY_LIMIT = 67108864;
const LOOPBACK_HOSTS = /* @__PURE__ */ new Set([
	"127.0.0.1",
	"localhost",
	"[::1]"
]);
const STATUS_BY_KIND = {
	authentication: 401,
	hard_credit: 402,
	soft_rate: 429,
	not_found: 502,
	server: 502,
	client: 400,
	unconfigured: 503
};
/**
* Failures that say something about the ACCOUNT and are therefore worth another
* account: a rejected token, a drained quota, a rate limit, a 5xx.
*
* `not_found`, `client` and `unconfigured` are deliberately absent — they say
* something about the request or this build, and replaying them on a second
* account would burn the same error twice while teaching the pool a false fact
* about an account that never got a chance to serve.
*/
const FAILOVER_KINDS = /* @__PURE__ */ new Set([
	"authentication",
	"hard_credit",
	"soft_rate",
	"server"
]);
/**
* Accounts one request may try.
*
* Not "all of them": every attempt costs a round-trip before the user sees a
* byte, and a pool whose every member is down must fail with a reason instead of
* turning one request into a slow tour of the roster.
*/
const MAX_POOL_ATTEMPTS = 3;
function hostnameOfHost(host) {
	let hostname = host.trim().toLowerCase();
	if (hostname.startsWith("[")) {
		const end = hostname.indexOf("]");
		return end === -1 ? hostname : hostname.slice(0, end + 1);
	}
	const colon = hostname.lastIndexOf(":");
	if (colon !== -1 && /^\d+$/.test(hostname.slice(colon + 1))) hostname = hostname.slice(0, colon);
	return hostname;
}
function hostIsLoopback(host) {
	return host !== void 0 && host.trim() !== "" && LOOPBACK_HOSTS.has(hostnameOfHost(host));
}
function originIsLoopback(origin) {
	if (origin === void 0 || origin.trim() === "") return true;
	try {
		const hostname = new URL(origin).hostname;
		return LOOPBACK_HOSTS.has(hostname) || hostname === "::1";
	} catch {
		return false;
	}
}
function writeJson(res, status, body) {
	const payload = JSON.stringify(body);
	res.writeHead(status, {
		"Content-Type": "application/json",
		"Content-Length": Buffer.byteLength(payload)
	});
	res.end(payload);
}
function writeError(res, status, kind, message) {
	writeJson(res, status, { error: {
		message,
		type: kind,
		code: kind
	} });
}
function readBody(req) {
	return new Promise((resolve, reject) => {
		const chunks = [];
		let size = 0;
		req.on("data", (chunk) => {
			size += chunk.length;
			if (size > BODY_LIMIT) {
				reject(/* @__PURE__ */ new Error("request body too large"));
				req.destroy();
			} else chunks.push(chunk);
		});
		req.on("end", () => resolve(Buffer.concat(chunks)));
		req.on("error", reject);
	});
}
function createTraeShim(options) {
	/**
	* Resolve the route table. The single-client form becomes a one-entry table
	* labelled `solo`, so existing call sites and tests keep one code path.
	*/
	const routes = options.routes !== void 0 ? options.routes.map((route) => ({
		...route,
		secret: randomBytes(32).toString("base64url")
	})) : [{
		label: "solo",
		client: options.client,
		secret: randomBytes(32).toString("base64url")
	}];
	const secret = routes[0]?.secret ?? randomBytes(32).toString("base64url");
	const sockets = /* @__PURE__ */ new Set();
	const server = createServer((req, res) => {
		handle(req, res);
	});
	server.on("connection", (socket) => {
		sockets.add(socket);
		socket.once("close", () => sockets.delete(socket));
	});
	const ready = new Promise((resolve, reject) => {
		server.once("listening", resolve);
		server.once("error", reject);
	});
	server.listen(0, "127.0.0.1");
	/** Route whose secret matches the request's bearer, or `undefined`. */
	function routeOf(req) {
		const match = typeof req.headers.authorization === "string" ? /^Bearer\s+(.+)$/i.exec(req.headers.authorization.trim()) : null;
		if (match === null) return void 0;
		const actual = Buffer.from(match[1] ?? "");
		for (const route of routes) {
			const expected = Buffer.from(route.secret);
			if (actual.length === expected.length && timingSafeEqual(actual, expected)) return route;
		}
	}
	/**
	* Run one chat request, failing over across pooled accounts when the account
	* that was chosen cannot serve it (issue #44).
	*
	* The happy path makes exactly one upstream call, so a pool that is switched
	* off — or on, with the first choice healthy — costs nothing but one cheap
	* ranking lookup. A failure is reported to the pool BEFORE the decision to
	* retry, because a rate limit the pool never hears about is a rate limit it
	* will walk straight back into on the next request.
	*/
	async function chatWithFailover(route, raw, signal) {
		const pool = route.pool;
		let client = route.client;
		let accountId = pool === void 0 ? void 0 : await pool.prepare().catch(() => void 0);
		const tried = [];
		for (let attempt = 0;; attempt += 1) {
			const result = await client.chatStream(raw, signal);
			if (result.ok) return {
				kind: "stream",
				response: result.response
			};
			const retryable = pool !== void 0 && !signal.aborted && FAILOVER_KINDS.has(result.kind);
			if (retryable && accountId !== void 0) await pool.failed(accountId, result.kind, result.message).catch(() => {});
			const failed = {
				kind: "failed",
				status: STATUS_BY_KIND[result.kind],
				code: result.kind,
				message: result.message
			};
			if (!retryable) return failed;
			if (accountId !== void 0) tried.push(accountId);
			const next = attempt + 1 >= MAX_POOL_ATTEMPTS ? void 0 : await pool.next(tried).catch(() => void 0);
			if (next === void 0) {
				const reason = await pool.shortfall(tried).catch(() => void 0);
				return reason === void 0 ? failed : {
					...failed,
					message: `${failed.message} (${reason})`
				};
			}
			client = next.client;
			accountId = next.accountId;
		}
	}
	async function handle(req, res) {
		try {
			if (!hostIsLoopback(req.headers.host)) return writeError(res, 403, "host_not_allowed", "Host must be loopback");
			if (!originIsLoopback(req.headers.origin)) return writeError(res, 403, "origin_not_allowed", "Origin must be loopback");
			const route = routeOf(req);
			if (route === void 0) return writeError(res, 401, "unauthorized", "Missing or invalid bearer");
			const url = req.url ?? "/";
			if (req.method === "GET" && (url === "/healthz" || url === "/healthz/")) return writeJson(res, 200, { ok: true });
			if (req.method === "GET" && (url === "/v1/models" || url === "/v1/models/")) return writeJson(res, 200, {
				object: "list",
				data: options.catalog.current().map((model) => ({
					id: model.id,
					object: "model",
					created: 0,
					owned_by: "trae"
				}))
			});
			if (req.method === "POST" && (url === "/v1/chat/completions" || url === "/v1/chat/completions/")) {
				if (typeof req.headers["content-type"] !== "string" || !req.headers["content-type"].toLowerCase().startsWith("application/json")) return writeError(res, 415, "unsupported_media_type", "Content-Type must be application/json");
				const raw = (await readBody(req)).toString("utf8");
				try {
					JSON.parse(raw);
				} catch {
					return writeError(res, 400, "invalid_json", "Request body must be valid JSON");
				}
				const parsed = JSON.parse(raw);
				options.logger?.warn("dsh-connect-trae: chat request received", {
					model: parsed.model,
					messages: Array.isArray(parsed.messages) ? parsed.messages.map((message) => typeof message === "object" && message !== null ? message["role"] ?? "?" : "?") : "(none)",
					toolCount: Array.isArray(parsed.tools) ? parsed.tools.length : 0,
					maxTokens: parsed.max_tokens,
					reasoningEffort: parsed.reasoning_effort,
					temperature: parsed.temperature,
					bodyBytes: raw.length
				});
				const controller = new AbortController();
				const abort = () => controller.abort();
				req.once("aborted", abort);
				req.socket.once("close", abort);
				const result = await chatWithFailover(route, raw, controller.signal);
				if (result.kind === "failed") return writeError(res, result.status, result.code, result.message);
				res.writeHead(200, {
					"Content-Type": "text/event-stream",
					"Cache-Control": "no-cache",
					"Connection": "keep-alive",
					"X-Accel-Buffering": "no"
				});
				const body = Readable.fromWeb(result.response.body);
				body.on("error", (error) => {
					const record = error instanceof Error ? {
						name: error.name,
						message: error.message,
						cause: error.cause ? String(error.cause) : void 0
					} : String(error);
					options.logger?.warn("dsh-connect-trae: upstream stream failed", record);
					if (!res.writableEnded) res.end();
				});
				body.pipe(res);
				return;
			}
			writeError(res, 404, "not_found", `No such route: ${req.method} ${url}`);
		} catch (error) {
			options.logger?.error("dsh-connect-trae: shim request failed", error);
			if (!res.headersSent) writeError(res, 500, "internal", "Internal shim error");
			else if (!res.writableEnded) res.end();
		}
	}
	return {
		ready,
		baseUrl() {
			const address = server.address();
			if (address === null || typeof address === "string") throw new Error("trae shim is not listening");
			return `http://127.0.0.1:${address.port}`;
		},
		token: () => secret,
		tokenOf(label) {
			if (label === void 0) return secret;
			const route = routes.find((entry) => entry.label === label);
			if (route === void 0) throw new Error(`trae shim has no route named ${label}`);
			return route.secret;
		},
		close: () => new Promise((resolve, reject) => {
			for (const socket of sockets) socket.destroy();
			server.close((error) => error === void 0 ? resolve() : reject(error));
		})
	};
}
//#endregion
//#region src/model-detail.ts
const TRAE_MODEL_DETAIL_PATH = "/api/ide/v1/batch_get_detail_param";
const TRAE_MODEL_DETAIL_FUNCTIONS = [
	"ui_builder_v2",
	"solo_coder",
	"chat_v3",
	"solo_builder",
	"builder_v3",
	"builder",
	"chat",
	"inline_chat",
	"git_ai",
	"custom_agent_generation",
	"utils",
	"code_reviewer",
	"code_review_summary",
	"solo_agent",
	"solo_agent_remote",
	"solo_work_remote",
	"solo_agent_lite",
	"solo_work_lite",
	"solo_design_lite",
	"solo_design_remote",
	"multimodal",
	"system_diagnosis"
];
/** Build the exact request shape observed in successful current Trae CN logs. */
function buildTraeModelDetailRequest(configName = "", custom = false) {
	return {
		functions: [...TRAE_MODEL_DETAIL_FUNCTIONS],
		agent_type: configName === "" ? "" : "solo_agent",
		current_config_info: {
			config_name: configName,
			is_custom_model: custom
		},
		mode_type: 0,
		access_type: 0,
		ab_force_vids: "",
		ab_autotest_advanced_mode: 0
	};
}
//#endregion
//#region src/protocol.ts
const TRAE_CN_AGENT_TASK_PATH = "/api/agent/v3/create_agent_task";
const TRAE_CN_TITLE_PATH = "/api/agent/v3/llm_utils_chat";
/**
* Evidence-bounded body draft. It is intentionally pure and offline; the
* network client remains disabled until a controlled request validates it.
*/
function buildTraeAgentTaskBody(messages, model, options = {}) {
	if (messages.length === 0) throw new Error("Trae agent task requires at least one message");
	const requestId = options.requestId ?? randomUUID();
	const sessionId = options.sessionId ?? requestId;
	return {
		messages: messages.map((message) => ({
			role: message.role,
			content: [{
				type: "text",
				text: message.content
			}]
		})),
		model,
		function: "inline_chat",
		stream: true,
		request_id: requestId,
		session_id: sessionId,
		...options.maxTokens === void 0 ? {} : { max_tokens: options.maxTokens }
	};
}
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
const TRAE_VERSION_CODE_FALLBACK = "20260716";
/** Keep a purely numeric build version; fall back when it cannot bind. */
function normalizeTraeVersionCode(buildVersion) {
	if (buildVersion === void 0 || buildVersion.trim() === "") return TRAE_VERSION_CODE_FALLBACK;
	const trimmed = buildVersion.trim();
	return /^\d+$/.test(trimmed) ? trimmed : TRAE_VERSION_CODE_FALLBACK;
}
/**
* Headers shared by every Trae edition. The same shape is accepted by both
* gateways (verified read-only on the international gateway 2026-09-15,
* docs/INTL_SG_EVIDENCE.md §2.3: identical `x-app-id`, identity headers, and
* `Cloud-IDE-JWT` auth), so there is no per-edition branch any more.
*/
function buildTraeHeaders(credential, identity, options = {}) {
	const requestId = options.requestId ?? randomUUID();
	const traceId = requestId.replaceAll("-", "").slice(0, 32);
	const profile = options.profile ?? "agent-task";
	const common = {
		"Authorization": `Cloud-IDE-JWT ${credential.accessToken}`,
		"X-Ide-Token": credential.accessToken,
		"x-plugin-channel": "icube-ai",
		"User-Agent": `Trae/${identity.appVersion ?? identity.buildVersion ?? "unknown"}`,
		"x-app-id": options.appId ?? "6eefa01c-1036-4c7e-9ca5-d891f63bfcd8",
		...identityHeaders(identity),
		"x-app-version-code": normalizeTraeVersionCode(identity.buildVersion),
		"x-ide-version-code": normalizeTraeVersionCode(identity.buildVersion),
		"x-custom-trace-id": traceId,
		"x-flow-traceparent": `04-${traceId}-${traceId.slice(0, 16)}-01`,
		"request-traffic-type": "prod",
		"Content-Type": "application/json"
	};
	if (profile === "native-curl") return {
		"Content-Type": "application/json",
		"request-traffic-type": "prod",
		"x-app-id": options.appId ?? "6eefa01c-1036-4c7e-9ca5-d891f63bfcd8",
		...identityHeaders(identity),
		"x-custom-trace-id": traceId,
		"x-flow-traceparent": `04-${traceId}-${traceId.slice(0, 16)}-01`,
		"X-Ide-Token": credential.accessToken
	};
	if (profile === "model-detail") return {
		...common,
		"Accept": "application/json"
	};
	if (profile === "raw-chat") return {
		...common,
		"Accept": "text/event-stream"
	};
	return {
		...common,
		"X-Cloudide-Token": credential.accessToken,
		"x-uid": credential.userId,
		"x-request-id": requestId,
		"x-trae-request-id": requestId,
		"Accept": "text/event-stream"
	};
}
/** Backwards-compatible alias; the headers are no longer CN-specific. */
const buildTraeCnHeaders = buildTraeHeaders;
function traeEndpoint(baseUrl, path) {
	return `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}
//#endregion
//#region src/official-roster.ts
const CHAT_USAGE = "chat_completion";
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
function parseTraeOfficialRoster(payload) {
	const channels = /* @__PURE__ */ new Map();
	const seen = /* @__PURE__ */ new Set();
	let pairs = 0;
	const document = typeof payload === "object" && payload !== null ? payload : {};
	const groups = Array.isArray(document["function_configs"]) ? document["function_configs"] : [];
	for (const group of groups) {
		if (typeof group !== "object" || group === null) continue;
		const record = group;
		const functionName = typeof record["function"] === "string" ? record["function"] : "";
		if (functionName === "") continue;
		const list = Array.isArray(record["config_info_list"]) ? record["config_info_list"] : [];
		for (const item of list) {
			if (typeof item !== "object" || item === null) continue;
			const config = item;
			const configName = typeof config["config_name"] === "string" ? config["config_name"].trim() : "";
			if (configName === "") continue;
			const key = `${functionName}\u0000${configName.toLowerCase()}`;
			if (seen.has(key)) continue;
			seen.add(key);
			const channel = {
				function: functionName,
				usage: typeof config["usage"] === "string" ? config["usage"] : "",
				enabled: config["config_switch"] !== false,
				invisible: config["is_invisible_to_user"] === true
			};
			pairs += 1;
			const bucket = channels.get(configName.toLowerCase());
			if (bucket === void 0) channels.set(configName.toLowerCase(), [channel]);
			else bucket.push(channel);
		}
	}
	return {
		channels,
		size: {
			configs: channels.size,
			pairs
		}
	};
}
/** The `config_name` a catalog row would actually send (see `wireConfigName`). */
function officialKeyOf(model) {
	return (model.wireConfigName ?? model.id).trim().toLowerCase();
}
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
function officialVerdictOf(model, roster, chatFunctions) {
	const entries = roster.channels.get(officialKeyOf(model));
	if (entries === void 0 || entries.length === 0) return { kind: "keep" };
	const callable = entries.filter((entry) => entry.usage === "" || entry.usage === CHAT_USAGE).filter((entry) => chatFunctions.includes(entry.function));
	if (callable.length === 0) return { kind: "keep" };
	const listedBy = callable.map((entry) => entry.function);
	const shown = callable.filter((entry) => !entry.invisible);
	if (shown.length === 0) return {
		kind: "hide",
		function: model.wireFunction,
		listedBy
	};
	const own = model.wireFunction === void 0 ? void 0 : callable.find((entry) => entry.function === model.wireFunction);
	if (own !== void 0 && !own.invisible) return { kind: "keep" };
	const to = chatFunctions.find((fn) => shown.some((entry) => entry.function === fn));
	if (to === void 0) return { kind: "keep" };
	return {
		kind: "repin",
		from: model.wireFunction,
		to,
		listedBy
	};
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
function applyOfficialRoster(rows, roster, chatFunctions) {
	if (roster === void 0) return {
		rows: [...rows],
		hidden: [],
		repinned: []
	};
	const kept = [];
	const hidden = [];
	const repinned = [];
	for (const row of rows) {
		const verdict = officialVerdictOf(row, roster, chatFunctions);
		if (verdict.kind === "hide") {
			hidden.push({
				id: row.id,
				function: verdict.function
			});
			continue;
		}
		if (verdict.kind === "repin") {
			repinned.push({
				id: row.id,
				from: verdict.from,
				to: verdict.to
			});
			kept.push({
				...row,
				wireFunction: verdict.to
			});
			continue;
		}
		kept.push(row);
	}
	return {
		rows: kept,
		hidden,
		repinned
	};
}
/** How long one successful roster read stays usable, in milliseconds. */
const ROSTER_CACHE_MS = 6e5;
/** Timeout for the roster read. It is an OPTIONAL signal; it must not stall a refresh. */
const ROSTER_TIMEOUT_MS = 2e4;
/**
* Reads the IDE's roster once per cache window and never throws.
*
* `undefined` is a first-class answer: it is what a caller sees when the
* document could not be read, and {@link applyOfficialRoster} treats it as "no
* opinion". Silence on failure is intentional — this is a refinement of a
* refresh that already succeeded, so a strict error would turn a usable catalog
* into a failed refresh.
*/
var TraeOfficialRosterClient = class {
	options;
	fetchImpl;
	now;
	cached;
	/** The last failure, so a repeatedly-broken endpoint is not re-probed on every refresh. */
	failedAt;
	constructor(options) {
		this.options = options;
		this.fetchImpl = options.fetchImpl ?? fetch;
		this.now = options.now ?? Date.now;
	}
	/** Cached roster, without any network I/O. */
	cachedRoster() {
		return this.cached === void 0 ? void 0 : this.cached.roster;
	}
	async fetch(signal) {
		const now = this.now();
		if (this.cached !== void 0 && now - this.cached.at < ROSTER_CACHE_MS) return this.cached.roster;
		if (this.failedAt !== void 0 && now - this.failedAt < ROSTER_CACHE_MS) return void 0;
		try {
			const [credential, identity] = await Promise.all([this.options.credential(), this.options.identity()]);
			const region = assertSupportedRegion(regionOfCredential(credential));
			const base = this.options.baseUrl ?? (this.options.route === "enterprise" ? "https://console.enterprise.trae.cn" : REGION_GATEWAYS[region].chat);
			const response = await this.fetchImpl(traeEndpoint(base, TRAE_MODEL_DETAIL_PATH), {
				method: "POST",
				headers: buildTraeCnHeaders(credential, identity, { profile: "model-detail" }),
				body: JSON.stringify({
					...buildTraeModelDetailRequest(""),
					show_custom_model: true
				}),
				signal: signal ?? AbortSignal.timeout(ROSTER_TIMEOUT_MS)
			});
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			const roster = parseTraeOfficialRoster(await response.json());
			if (roster.size.configs === 0) throw new Error("roster document carried no config_name");
			this.cached = {
				at: now,
				roster
			};
			this.failedAt = void 0;
			return roster;
		} catch (error) {
			this.failedAt = now;
			this.options.log?.("dsh-connect-trae: IDE model roster unavailable, keeping every discovered row", { reason: error instanceof Error ? error.message : String(error) });
			return;
		}
	}
};
/** Where the client asks for the roster; re-exported so diagnostics do not hard-code it. */
const TRAE_OFFICIAL_ROSTER_PATH = TRAE_MODEL_DETAIL_PATH;
//#endregion
//#region src/raw-chat.ts
const TRAE_RAW_CHAT_V2_PATH = "/api/ide/v2/llm_raw_chat";
const TRAE_RAW_CHAT_V1_PATH = "/api/ide/v1/llm_raw_chat";
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
function normalizeTraeToolSchema(value) {
	if (Array.isArray(value)) {
		let changed = false;
		const items = value.map((item) => {
			const next = normalizeTraeToolSchema(item);
			if (next !== item) changed = true;
			return next;
		});
		return changed ? items : value;
	}
	if (typeof value !== "object" || value === null) return value;
	const source = value;
	const result = {};
	for (const [key, entry] of Object.entries(source)) {
		if (key === "required" && typeof entry === "boolean") continue;
		result[key] = normalizeTraeToolSchema(entry);
	}
	const properties = source["properties"];
	if (typeof properties === "object" && properties !== null && !Array.isArray(properties)) {
		const promoted = [];
		if (Array.isArray(source["required"])) {
			for (const name of source["required"]) if (typeof name === "string" && !promoted.includes(name)) promoted.push(name);
		}
		for (const [name, property] of Object.entries(properties)) if (typeof property === "object" && property !== null && property["required"] === true && !promoted.includes(name)) promoted.push(name);
		if (promoted.length > 0) result["required"] = promoted;
	}
	return JSON.stringify(result) === JSON.stringify(value) ? value : result;
}
/** Issue #49: apply `normalizeTraeToolSchema` to an OpenAI-style tool list. */
function normalizeTraeToolSchemas(tools) {
	return tools.map((tool) => normalizeTraeToolSchema(tool));
}
/**
* Evidence-bounded OpenAI-like draft inferred from Trae's LLMRaw* DTO symbols.
* Pure/offline only: the upstream remains disabled until one controlled probe.
*/
function buildTraeRawChatDraft(input) {
	if (input.model.trim() === "") throw new Error("Trae raw chat requires a model");
	if (input.messages.length === 0) throw new Error("Trae raw chat requires messages");
	return {
		model: input.model,
		messages: structuredClone([...input.messages]),
		stream: true,
		...input.tools === void 0 || input.tools.length === 0 ? {} : { tools: normalizeTraeToolSchemas(structuredClone([...input.tools])) },
		...input.maxTokens === void 0 ? {} : { max_tokens: input.maxTokens },
		...input.temperature === void 0 ? {} : { temperature: input.temperature },
		...input.reasoningEffort === void 0 ? {} : { reasoning_effort: input.reasoningEffort },
		...input.extraInfo === void 0 ? {} : { extra_info: structuredClone(input.extraInfo) }
	};
}
/** Decode OpenAI-like raw-chat chunks while preserving unknown structures. */
function decodeRawChatChunk(value) {
	if (value === "[DONE]") return [{
		type: "done",
		finishReason: "stop"
	}];
	if (typeof value !== "object" || value === null || Array.isArray(value)) return [{
		type: "unknown",
		value
	}];
	const record = value;
	const result = [];
	const choices = Array.isArray(record["choices"]) ? record["choices"] : [];
	for (const rawChoice of choices) {
		if (typeof rawChoice !== "object" || rawChoice === null) continue;
		const choice = rawChoice;
		const delta = typeof choice["delta"] === "object" && choice["delta"] !== null ? choice["delta"] : {};
		if (typeof delta["reasoning_content"] === "string" && delta["reasoning_content"] !== "") result.push({
			type: "reasoning",
			text: delta["reasoning_content"]
		});
		if (typeof delta["content"] === "string" && delta["content"] !== "") result.push({
			type: "text",
			text: delta["content"]
		});
		if (Array.isArray(delta["tool_calls"])) for (const rawTool of delta["tool_calls"]) {
			if (typeof rawTool !== "object" || rawTool === null) continue;
			const tool = rawTool;
			const fn = typeof tool["function"] === "object" && tool["function"] !== null ? tool["function"] : {};
			result.push({
				type: "tool-call",
				index: typeof tool["index"] === "number" ? tool["index"] : 0,
				...typeof tool["id"] === "string" ? { id: tool["id"] } : {},
				...typeof fn["name"] === "string" ? { name: fn["name"] } : {},
				...typeof fn["arguments"] === "string" ? { arguments: fn["arguments"] } : {}
			});
		}
		if (typeof choice["finish_reason"] === "string" && choice["finish_reason"] !== "") result.push({
			type: "done",
			finishReason: choice["finish_reason"]
		});
	}
	if (typeof record["usage"] === "object" && record["usage"] !== null) {
		const usage = record["usage"];
		const details = typeof usage["prompt_tokens_details"] === "object" && usage["prompt_tokens_details"] !== null ? usage["prompt_tokens_details"] : {};
		const cacheRead = details["cached_tokens"] ?? usage["prompt_cache_hit_tokens"] ?? usage["cached_tokens"];
		const cacheWrite = details["cache_write_tokens"];
		result.push({
			type: "usage",
			...typeof usage["prompt_tokens"] === "number" ? { inputTokens: usage["prompt_tokens"] } : {},
			...typeof usage["completion_tokens"] === "number" ? { outputTokens: usage["completion_tokens"] } : {},
			...typeof usage["total_tokens"] === "number" ? { totalTokens: usage["total_tokens"] } : {},
			...typeof cacheRead === "number" ? { cacheReadTokens: cacheRead } : {},
			...typeof cacheWrite === "number" ? { cacheWriteTokens: cacheWrite } : {}
		});
	}
	return result.length === 0 ? [{
		type: "unknown",
		value
	}] : result;
}
//#endregion
//#region src/promo.ts
function record$1(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value) ? value : void 0;
}
function finite(value) {
	return typeof value === "number" && Number.isFinite(value) ? value : void 0;
}
function percent(value) {
	const parsed = finite(value);
	return parsed !== void 0 && parsed > 0 && parsed < 100 ? parsed : void 0;
}
function ratePair(raw) {
	const entry = record$1(raw);
	if (entry === void 0) return {};
	const beforeRate = finite(entry["before_consumption_rate"]);
	const rate = finite(entry["consumption_rate"]) ?? finite(entry["after_consumption_rate"]);
	const discountPercent = percent(entry["discount"]);
	return {
		...beforeRate === void 0 || beforeRate <= 0 ? {} : { beforeRate },
		...rate === void 0 || rate <= 0 ? {} : { rate },
		...discountPercent === void 0 ? {} : { discountPercent }
	};
}
function windows(raw) {
	const list = Array.isArray(raw) ? raw : [];
	const parsed = [];
	for (const item of list) {
		const entry = record$1(item);
		if (entry === void 0) continue;
		const weekdays = Array.isArray(entry["weekdays"]) ? entry["weekdays"].filter((day) => Number.isInteger(day) && day >= 1 && day <= 7) : [];
		const startMinute = finite(entry["start_minute"]);
		const endMinute = finite(entry["end_minute"]);
		if (weekdays.length === 0 || startMinute === void 0 || endMinute === void 0) continue;
		if (startMinute < 0 || startMinute > 1439 || endMinute < 1 || endMinute > 1440) continue;
		if (startMinute >= endMinute) continue;
		parsed.push({
			weekdays,
			startMinute,
			endMinute
		});
	}
	return parsed;
}
/**
* Parse one `activity_discount` document.
*
* `value` may be the already-parsed object (both call sites hand us the parent
* object) or the raw JSON string; anything without `enable: true` reads as "no
* promotion" rather than as a rule we might later misjudge.
*/
function parseTraeActivityDiscount(value) {
	let source = value;
	if (typeof source === "string") {
		if (source === "") return void 0;
		try {
			source = JSON.parse(source);
		} catch {
			return;
		}
	}
	const raw = record$1(source);
	if (raw === void 0 || raw["enable"] !== true) return void 0;
	const data = record$1(raw["data"]);
	if (data === void 0) return void 0;
	const subKey = typeof raw["subKey"] === "string" && raw["subKey"] !== "" ? raw["subKey"] : void 0;
	const currentRaw = record$1(data["current"]);
	const currentType = typeof currentRaw?.["discount_type"] === "string" ? currentRaw["discount_type"] : void 0;
	const current = currentRaw === void 0 ? void 0 : {
		...ratePair(currentRaw),
		...currentType === void 0 ? {} : { discountType: currentType }
	};
	const memberRaw = data["member"];
	const member = record$1(memberRaw) === void 0 ? void 0 : ratePair(memberRaw);
	const subsidyRaw = data["subsidy"];
	const subsidy = record$1(subsidyRaw) === void 0 ? void 0 : ratePair(subsidyRaw);
	const offPeakRaw = record$1(data["off_peak"]);
	const offPeak = offPeakRaw === void 0 ? void 0 : {
		...ratePair(offPeakRaw),
		...typeof offPeakRaw["time_zone"] === "string" && offPeakRaw["time_zone"] !== "" ? { timeZone: offPeakRaw["time_zone"] } : {},
		windows: windows(offPeakRaw["time_windows"])
	};
	const parsed = {
		...subKey === void 0 ? {} : { subKey },
		...current === void 0 ? {} : { current },
		...member === void 0 ? {} : { member },
		...offPeak === void 0 ? {} : { offPeak },
		...subsidy === void 0 ? {} : { subsidy }
	};
	return parsed.current === void 0 && parsed.member === void 0 && parsed.offPeak === void 0 && parsed.subsidy === void 0 ? void 0 : parsed;
}
//#endregion
//#region src/reasoning.ts
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
const TRAE_REASONING_EFFORTS = [
	"minimal",
	"low",
	"medium",
	"high",
	"xhigh",
	"max"
];
function parseReasoningCapability(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return void 0;
	const record = value;
	const supported = (Array.isArray(record["reasoning_effort_options"]) ? record["reasoning_effort_options"] : []).filter((item) => typeof item === "string" && TRAE_REASONING_EFFORTS.includes(item));
	const rawDefault = record["default_reasoning_effort"];
	const defaultEffort = typeof rawDefault === "string" && supported.includes(rawDefault) ? rawDefault : void 0;
	if (supported.length === 0 && defaultEffort === void 0) return void 0;
	return {
		supported,
		...defaultEffort === void 0 ? {} : { defaultEffort }
	};
}
/** Add effort only when the selected model advertises that exact value. */
function applyReasoningEffort(body, effort, capability) {
	if (effort === void 0) return body;
	if (capability === void 0 || !capability.supported.includes(effort)) throw new Error(`Trae model does not advertise reasoning effort ${effort}`);
	return {
		...body,
		reasoning_effort: effort
	};
}
//#endregion
//#region src/solo.ts
/**
* `llm_utils_chat` functions to union per region, in priority order.
*
* Trae spreads its callable roster across several SOLO-mode functions, and a
* model is only usable through the one that lists it: `glm-5.3` is absent from
* `solo_work_lite` but present in `solo_work_remote` (verified 2026-09-15 —
* calling it through the former answers `4001 param is invalid`, through the
* latter streams normally). Rather than betting on a single function, the
* directory unions them; the first function to provide a config wins, so the
* order below decides which wire name AND which function a model is called with.
*
* THIS LIST IS NOT "directory functions" — it is the set of functions
* `llm_utils_chat` actually accepts, because ownership here is what the chat
* call replays. `solo_agent` is deliberately ABSENT (measured 2026-10-01 on a
* live SG credential, issue #19): it is a Remote-agent roster function, not a
* chat function. Every model sent with `function: "solo_agent"` — `gpt-5.4`,
* `gpt-5.6-sol`, `gpt-6-astra`, `glm-5.2`, `kimi-k2.7-code` — answered
* `event:error {"code":4011}`, while the same model with the same body answered
* normally under `solo_work_remote` / `solo_work_lite` / `solo_agent_remote`.
* Issue #33 corrected the reading of that code: `4011` is Trae's rate limit on
* the route that was asked (its own text says so, and issue #33's reporter hit
* it on the CORRECT function), and the "this route does not serve that model"
* condition is `4001` — measured on all 22 functions of a live CN credential.
* The conclusion for this list is unchanged either way: a route that refuses
* chat is not a chat route, so `solo_agent` stays out.
*
* Note `get_detail_param` DOES answer `solo_agent` with a 43-entry list, so
* asking it looks helpful while making 8 of the 10 exposed ai-region models
* uncallable: it won precedence and stamped its own name onto configs it
* cannot serve. `solo_agent_remote` is the chat-callable half of that roster
* (it answers `minimax-m3`, `gemini-3.1-pro`, … that no `solo_work_*` lists)
* and therefore takes the last slot — after the two IDE functions that serve
* their shared configs without the Remote plan gate.
*
* `chat_v3` is the widest chat roster of all (measured 2026-10-01 on live
* credentials, issue #19 follow-up): its `get_detail_param` answers 40
* config_names on `ai` — more than any other function except `solo_agent` (43,
* which cannot serve chat). It lists models NO other chat function names, and
* it is joined LAST so it only fills gaps: a config two functions list keeps
* the earlier function, so no precedence is disturbed. The ai models it unlocks
* were each verified callable end-to-end through the plugin's own
* `prepareSoloBody` envelope:
*
*   ai (+6): kimi-k2.7-code, deepseek-v4-flash-0731, deepseek-v3.2,
*            gemini-3-flash-premium, gemini_2.5_flash_premium, Dola-Seed-2.0-Code
*
* CN joins `chat_v3` and `solo_coder` too (2026-10-02). Both are callable there
* — verified per model through `prepareSoloBody`, calling each model under a
* function whose roster names it: `glm-5` / `glm-5.1` / `qwen-3.5` and
* `deepseek-v4-pro` / `deepseek-v4-flash` under `solo_coder`, and
* `doubao-seed-2.0-code` under `solo_coder` / `solo_work_remote` /
* `solo_work_lite`. An earlier note here claimed those three answered `4001`
* "under every function" — that was a measurement error, not an upstream
* refusal: the probe had called them by display id while the chat endpoint needs
* the config_name its owning function returned.
*
* This also corrects an older note that `Doubao-Seed-Code` "has no config_name
* and must stay hidden" (docs/MODEL_MANAGEMENT_DESIGN.md): it does have one,
* under `chat_v3`.
*
* A model in NO chat function's roster is still left to the merge: it ships
* with no wire target and its call fails with a readable upstream message
* rather than being hidden (see mergeTraeModelSources).
*
* The list itself lives in {@link TRAE_CHANNEL_PRIORITY} (`model-order.ts`) and
* is aliased here, not copied: the card groups its rows by these same names in
* this same order.
*/
const TRAE_DIRECTORY_FUNCTIONS = TRAE_CHANNEL_PRIORITY;
const TRAE_SOLO_CHAT_PATH = "/api/agent/v3/llm_utils_chat";
const TRAE_SOLO_MODELS_PATH = "/api/ide/v1/get_detail_param";
function classify(status) {
	if (status === 401 || status === 403) return "authentication";
	if (status === 402) return "hard_credit";
	if (status === 429) return "soft_rate";
	if (status === 404) return "not_found";
	if (status >= 500) return "server";
	return "client";
}
function finitePositive$1(value) {
	return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : void 0;
}
function prepareSoloBody(source, defaultModel = "glm-5.2", functionName) {
	const input = JSON.parse(source);
	const model = typeof input["model"] === "string" && input["model"].trim() !== "" ? input["model"].trim() : defaultModel;
	const body = {
		...Array.isArray(input["messages"]) ? { messages: input["messages"] } : {},
		model,
		config_name: model,
		function: typeof input["function"] === "string" && input["function"] !== "" ? input["function"] : functionName ?? "solo_work_lite",
		stream: true,
		...Array.isArray(input["tools"]) ? { tools: input["tools"] } : {},
		...typeof input["reasoning_effort"] === "string" ? { reasoning_effort: input["reasoning_effort"] } : {}
	};
	if (Array.isArray(body["messages"])) for (const raw of body["messages"]) {
		if (typeof raw !== "object" || raw === null) continue;
		const message = raw;
		if (message["role"] === "developer") message["role"] = "system";
		if (typeof message["content"] === "string") message["content"] = [{
			type: "text",
			text: message["content"]
		}];
		if (message["role"] === "assistant" && Array.isArray(message["tool_calls"])) for (const rawCall of message["tool_calls"]) {
			if (typeof rawCall !== "object" || rawCall === null) continue;
			const call = rawCall;
			if (typeof call["function"] === "object" && call["function"] !== null) {
				call["function_call"] = call["function"];
				delete call["function"];
			}
		}
		if (message["role"] === "tool") {
			message["role"] = "tool";
			if (typeof message["tool_call_id"] !== "string" || message["tool_call_id"] === "") throw new Error("Trae SOLO tool message requires tool_call_id");
		}
	}
	if (Array.isArray(body["tools"])) for (const raw of body["tools"]) {
		if (typeof raw !== "object" || raw === null) continue;
		const fn = raw["function"];
		if (typeof fn !== "object" || fn === null) continue;
		const record = fn;
		if (typeof record["parameters"] === "object" && record["parameters"] !== null) record["parameters"] = JSON.stringify(normalizeTraeToolSchema(record["parameters"]));
	}
	return JSON.stringify(body);
}
/**
* Parse this row's `display_contact_config` document.
*
* It is a *string* holding a second JSON document, and three different readers
* (the credit multiplier, the promotion rule, and whatever upstream adds next)
* need it — so it is decoded once here rather than three times.
*/
function wireContactConfig(config) {
	const raw = config["display_contact_config"];
	if (typeof raw !== "string" || raw === "") return void 0;
	let parsed;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return;
	}
	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return void 0;
	return parsed;
}
/** The promotion rule from `display_contact_config`, when the row carries one. */
function wireActivityDiscount(config) {
	return parseTraeActivityDiscount(wireContactConfig(config)?.["activity_discount"]);
}
/**
* Read the effective credit multiplier from a `get_detail_param` row.
*
* The rate the Trae IDE renders lives in `display_contact_config` — a *string*
* holding a second JSON document — and its `consumption_rate.data.rate` is
* already the post-discount value (verified 2026-09-13, commit 1.4.2: the
* Remote directory reports the undiscounted figure, e.g. `0.8`, while the IDE
* and this field both say `0.08` under a 限时 1 折 promotion — up to a 10x
* difference). The wire figure therefore wins over the Remote one during the
* merge; this parser is what feeds it.
*
* The international (ai) gateway serves no `consumption_rate` anywhere (its
* subscription models carry only `features.cost` tags), so rows without the
* field keep their bare name — parsed-but-absent, never fabricated.
*/
function wireCreditMultiplier(config) {
	const parsed = wireContactConfig(config);
	if (parsed === void 0) return void 0;
	const consumption = parsed["consumption_rate"];
	if (typeof consumption !== "object" || consumption === null) return void 0;
	const entry = consumption;
	if (entry["enable"] !== true) return void 0;
	const data = entry["data"];
	if (typeof data !== "object" || data === null) return void 0;
	return finitePositive$1(data["rate"]);
}
/**
* Thrown by {@link TraeSoloUpstreamClient.fetchModels} when every requested
* directory function answered HTTP 200 but with an EMPTY `config_info_list`
* (no rows at all), so the aggregate roster is empty. This is issue #39's root
* signal: the upstream has published NO SOLO function config for this account /
* route. It is a server-side, usually transient gap — the reporter's roster
* returned empty and later self-resolved with rows per function — NOT a local
* credential, plugin or account fault, and not something to re-login for. The
* caller can catch this type to tell "the upstream published no config" apart
* from "all directory functions errored" (which surfaces as a generic failure).
*/
var TraeEmptySoloDirectory = class extends Error {
	name = "TraeEmptySoloDirectory";
	constructor() {
		super("Trae’s server returned NO SOLO function config (an empty directory for every requested function) — an upstream-side gap that usually clears on its own; retry later instead of re-checking credentials or the plugin");
	}
};
var TraeSoloUpstreamClient = class {
	options;
	fetchImpl;
	constructor(options) {
		this.options = options;
		this.fetchImpl = options.fetchImpl ?? fetch;
	}
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
	async fetchModels(signal) {
		const [credential, identity] = await Promise.all([this.options.credential(), this.options.identity()]);
		const region = assertSupportedRegion(regionOfCredential(credential));
		const base = this.options.baseUrl ?? this.chatBaseOf(credential);
		const headers = {
			...buildTraeCnHeaders(credential, identity),
			Accept: "application/json"
		};
		const byId = /* @__PURE__ */ new Map();
		const failures = [];
		for (const directoryFunction of TRAE_DIRECTORY_FUNCTIONS[region]) {
			let list;
			try {
				const response = await this.fetchImpl(traeEndpoint(base, TRAE_SOLO_MODELS_PATH), {
					method: "POST",
					headers,
					body: JSON.stringify({
						function: directoryFunction,
						config_names: null,
						need_prompt: false,
						current_config_info: null,
						poly_prompt: true,
						mode_type: null,
						agent_type: null
					}),
					signal: signal ?? AbortSignal.timeout(3e4)
				});
				if (!response.ok) throw new Error(`HTTP ${response.status}`);
				const document = await response.json();
				list = Array.isArray(document["config_info_list"]) ? document["config_info_list"] : [];
			} catch (error) {
				failures.push(`${directoryFunction}: ${String(error).slice(0, 80)}`);
				continue;
			}
			this.collectModels(list, directoryFunction, byId);
		}
		const models = [...byId.values()];
		if (models.length === 0) {
			if (failures.length === 0) throw new TraeEmptySoloDirectory();
			throw new Error(`Trae SOLO models response contained no models (${failures.join("; ")})`);
		}
		return models;
	}
	/** Merge one function's config list into the shared catalogue (first wins). */
	collectModels(list, directoryFunction, byId) {
		for (const raw of list) {
			if (typeof raw !== "object" || raw === null) continue;
			const config = raw;
			const id = typeof config["config_name"] === "string" ? config["config_name"] : "";
			if (id === "") continue;
			const display = typeof config["display_config"] === "object" && config["display_config"] !== null ? config["display_config"] : {};
			const details = Array.isArray(config["model_detail_list"]) ? config["model_detail_list"] : [];
			const detail = typeof details[0] === "object" && details[0] !== null ? details[0] : {};
			const rawName = typeof display["display_name"] === "string" ? display["display_name"] : "";
			const contextTokens = typeof config["context_window_tokens"] === "object" && config["context_window_tokens"] !== null ? config["context_window_tokens"] : {};
			const promptMaxTokens = finitePositive$1(detail["prompt_max_tokens"]);
			const devTokens = finitePositive$1(contextTokens["dev"]);
			const contextWindow = promptMaxTokens ?? devTokens;
			const maxTokens = finitePositive$1(detail["max_tokens"]);
			const reasoning = parseReasoningCapability({
				...config,
				...detail
			});
			const creditMultiplier = wireCreditMultiplier(config);
			const activityDiscount = wireActivityDiscount(config);
			const usage = typeof config["usage"] === "string" && config["usage"] !== "" ? config["usage"] : void 0;
			const configSource = typeof config["config_source"] === "number" && Number.isFinite(config["config_source"]) ? config["config_source"] : void 0;
			const existing = byId.get(id);
			if (existing !== void 0) {
				if (existing.name === id && rawName !== "" && rawName !== "-") existing.name = rawName;
				continue;
			}
			byId.set(id, {
				id,
				name: rawName !== "" && rawName !== "-" ? rawName : id,
				...contextWindow === void 0 ? {} : { contextWindow },
				...maxTokens === void 0 ? {} : { maxTokens },
				...reasoning === void 0 ? {} : { reasoning },
				...creditMultiplier === void 0 ? {} : { creditMultiplier },
				...activityDiscount === void 0 ? {} : { activityDiscount },
				...usage === void 0 ? {} : { usage },
				...configSource === void 0 ? {} : { configSource },
				function: directoryFunction
			});
		}
	}
	async chatStream(bodyJson, signal, functionName) {
		let prepared;
		try {
			prepared = prepareSoloBody(bodyJson, void 0, functionName);
		} catch {
			return {
				ok: false,
				status: 400,
				kind: "client",
				message: "invalid JSON request"
			};
		}
		const [credential, identity] = await Promise.all([this.options.credential(), this.options.identity()]);
		const headers = buildTraeCnHeaders(credential, identity);
		let base;
		try {
			assertSupportedRegion(regionOfCredential(credential));
			base = this.options.baseUrl ?? this.chatBaseOf(credential);
		} catch (error) {
			return {
				ok: false,
				status: 503,
				kind: "unconfigured",
				message: error instanceof Error ? error.message : String(error)
			};
		}
		if (this.options.route === "enterprise") try {
			const parsed = JSON.parse(prepared);
			if (parsed["session_id"] === void 0) parsed["session_id"] = randomUUID();
			prepared = JSON.stringify(parsed);
		} catch {
			return {
				ok: false,
				status: 400,
				kind: "client",
				message: "invalid JSON request"
			};
		}
		let response;
		try {
			response = await this.fetchImpl(traeEndpoint(base, TRAE_SOLO_CHAT_PATH), {
				method: "POST",
				headers,
				body: prepared,
				signal: signal ?? AbortSignal.timeout(12e4)
			});
		} catch (error) {
			return {
				ok: false,
				status: 0,
				kind: "server",
				message: `transport error: ${String(error)}`
			};
		}
		if (response.ok) {
			/**
			* The enterprise gateway reports a refusal as **HTTP 200** whose first
			* SSE frame is `event:error`. Handing that stream back as a success would
			* surface the refusal as an empty assistant turn, so it is converted to
			* a real error here — the same shape the consumer gateway uses for its
			* non-2xx failures.
			*/
			if (this.options.route !== "enterprise") return {
				ok: true,
				response
			};
			const classified = await classifyEnterpriseResponse(response);
			if ("response" in classified) return {
				ok: true,
				response: classified.response
			};
			this.options.log?.("dsh-connect-trae: enterprise llm_utils_chat refused", {
				status: 200,
				model: JSON.parse(prepared)["model"],
				configName: JSON.parse(prepared)["config_name"],
				body: classified.refusal
			});
			return {
				ok: false,
				status: 200,
				kind: "client",
				message: classified.refusal
			};
		}
		const text = (await response.text()).slice(0, 1024);
		this.options.log?.("dsh-connect-trae: llm_utils_chat rejected", {
			status: response.status,
			model: JSON.parse(prepared)["model"],
			configName: JSON.parse(prepared)["config_name"],
			reasoningEffort: JSON.parse(prepared)["reasoning_effort"],
			body: text
		});
		return {
			ok: false,
			status: response.status,
			kind: classify(response.status),
			message: text || `Trae SOLO returned HTTP ${response.status}`
		};
	}
	/** Chat gateway for this client's pinned route. */
	chatBaseOf(credential) {
		if (this.options.route === "enterprise") return TRAE_ENTERPRISE_HOST;
		return REGION_GATEWAYS[assertSupportedRegion(regionOfCredential(credential))].chat;
	}
};
/**
* Return the refusal frame of an enterprise 200, or `undefined` when the stream
* is a real answer.
*
* Reads (and re-plays) only the first SSE frame: a refusal is emitted before
* any output token, so peeking that far is enough to classify the call, and
* the stream is rebuilt so a caller that got `undefined` still sees every byte.
*/
function concatStream(head, reader) {
	return new ReadableStream({ start(controller) {
		if (head !== "") controller.enqueue(new TextEncoder().encode(head));
		const drain = () => {
			reader.read().then((result) => {
				if (result.done) {
					controller.close();
					return;
				}
				controller.enqueue(result.value);
				drain();
			}).catch((error) => controller.error(error));
		};
		drain();
	} });
}
/**
* Classify an enterprise 200.
*
* Returns `{ refusal }` when the first SSE frame is `event:error`, otherwise
* `{ response }` carrying a REBUILT response whose body re-emits every byte —
* including the peeked frame. A refusal is emitted before any output token, so
* peeking one frame is enough to classify the call.
*
* The response is rebuilt rather than patched: the original's body has been
* partially read, so its `text()`/`json()` would keep failing with "Body has
* already been read" even after `body` is swapped.
*/
async function classifyEnterpriseResponse(response) {
	const body = response.body;
	if (body === null) return { response };
	const reader = body.getReader();
	const decoder = new TextDecoder();
	let head = "";
	try {
		while (!head.includes("\n\n")) {
			const { done, value } = await reader.read();
			if (done) break;
			head += decoder.decode(value, { stream: true });
			if (head.length > 8192) break;
		}
	} catch {
		return { response };
	}
	const frame = head.split("\n\n")[0] ?? "";
	const event = /^event:(\S+)/m.exec(frame)?.[1];
	const data = frame.split("\n").find((line) => line.startsWith("data:"))?.slice(5).trim() ?? "";
	if (event !== "error") return { response: new Response(concatStream(head, reader), {
		status: response.status,
		statusText: response.statusText,
		headers: response.headers
	}) };
	try {
		await reader.cancel();
	} catch {}
	return { refusal: data === "" ? "enterprise gateway refused the request" : data };
}
//#endregion
//#region src/sse.ts
/** Incremental SSE decoder supporting CRLF, chunk splits and multi-line data. */
var SseDecoder = class {
	buffer = "";
	event;
	id;
	retry;
	data = [];
	push(chunk) {
		this.buffer += chunk;
		const events = [];
		while (true) {
			const match = /\r?\n/.exec(this.buffer);
			if (match === null || match.index === void 0) break;
			const line = this.buffer.slice(0, match.index);
			this.buffer = this.buffer.slice(match.index + match[0].length);
			const emitted = this.consumeLine(line);
			if (emitted !== void 0) events.push(emitted);
		}
		return events;
	}
	finish() {
		const events = [];
		if (this.buffer !== "") {
			const emitted = this.consumeLine(this.buffer);
			this.buffer = "";
			if (emitted !== void 0) events.push(emitted);
		}
		const final = this.dispatch();
		if (final !== void 0) events.push(final);
		return events;
	}
	consumeLine(line) {
		if (line === "") return this.dispatch();
		if (line.startsWith(":")) return void 0;
		const colon = line.indexOf(":");
		const field = colon === -1 ? line : line.slice(0, colon);
		let value = colon === -1 ? "" : line.slice(colon + 1);
		if (value.startsWith(" ")) value = value.slice(1);
		if (field === "event") this.event = value;
		else if (field === "data") this.data.push(value);
		else if (field === "id" && !value.includes("\0")) this.id = value;
		else if (field === "retry" && /^\d+$/.test(value)) this.retry = Number(value);
	}
	dispatch() {
		if (this.data.length === 0) {
			this.event = void 0;
			this.retry = void 0;
			return;
		}
		const result = {
			...this.event === void 0 || this.event === "" ? {} : { event: this.event },
			data: this.data.join("\n"),
			...this.id === void 0 ? {} : { id: this.id },
			...this.retry === void 0 ? {} : { retry: this.retry }
		};
		this.event = void 0;
		this.retry = void 0;
		this.data = [];
		return result;
	}
};
function decodeTraeEvent(event) {
	if (event.data === "[DONE]") return {
		type: "done",
		finishReason: "stop"
	};
	let payload;
	try {
		payload = JSON.parse(event.data);
	} catch {
		return {
			type: "unknown",
			...event.event === void 0 ? {} : { event: event.event },
			data: event.data
		};
	}
	const record = typeof payload === "object" && payload !== null && !Array.isArray(payload) ? payload : {};
	if (event.event === "request_wait_in_queue") return {
		type: "queue",
		...typeof record["position"] === "number" ? { position: record["position"] } : {}
	};
	if (event.event === "progress_notice") return {
		type: "progress",
		notice: payload
	};
	if (event.event === "token_usage") return {
		type: "usage",
		...typeof record["prompt_tokens"] === "number" ? { inputTokens: record["prompt_tokens"] } : {},
		...typeof record["completion_tokens"] === "number" ? { outputTokens: record["completion_tokens"] } : {},
		...typeof record["total_tokens"] === "number" ? { totalTokens: record["total_tokens"] } : {},
		...typeof record["reasoning_tokens"] === "number" ? { reasoningTokens: record["reasoning_tokens"] } : {},
		...typeof record["cache_read_input_tokens"] === "number" ? { cacheReadTokens: record["cache_read_input_tokens"] } : {},
		...typeof record["cache_creation_input_tokens"] === "number" ? { cacheWriteTokens: record["cache_creation_input_tokens"] } : {}
	};
	if (event.event === "metadata" || event.event === "timing_cost") return {
		type: "diagnostic",
		...record["prompt_cache_pool_record"] === void 0 ? {} : { promptCachePoolRecord: record["prompt_cache_pool_record"] },
		...typeof record["name"] === "string" ? { pipeline: record["name"] } : {},
		...typeof record["provider_model_name"] === "string" ? { providerModelName: record["provider_model_name"] } : {}
	};
	if (event.event === "done" || typeof record["finish_reason"] === "string" && record["response"] === void 0) return {
		type: "done",
		finishReason: typeof record["finish_reason"] === "string" ? record["finish_reason"] : "stop"
	};
	if (event.event === "output" || record["response"] !== void 0 || record["reasoning_content"] !== void 0) return {
		type: "delta",
		text: typeof record["response"] === "string" ? record["response"] : "",
		...typeof record["reasoning_content"] === "string" ? { reasoning: record["reasoning_content"] } : {},
		...record["tool_calls"] === void 0 || record["tool_calls"] === null ? {} : { toolCalls: record["tool_calls"] }
	};
	return {
		type: "unknown",
		...event.event === void 0 ? {} : { event: event.event },
		data: payload
	};
}
//#endregion
//#region src/solo-bridge.ts
/**
* What Trae's in-stream error codes mean. Measured 2026-10-01 on live
* credentials (issue #19), and re-measured 2026-10-12 on a live CN credential
* (issue #33) with a 22-function × 6-model chat matrix:
*
*  - `1005` — the model needs a paid plan. Trae answers HTTP 200 with
*    `event:error {"code":1005,"message":"","extra":"{\"plan\":1}"}`, so the
*    gate is only visible in `extra.plan`; `gpt-6-sol` returned it under both
*    `solo_work_remote` and `solo_agent_remote` on a free account.
*  - `4011` — Trae throttled the SOLO route for this account. Trae's own text
*    is `your requests have exceeded the rate limit. Please wait and try again
*    later.`, and issue #33 is why that text is now taken at face value: the
*    earlier reading of 4011 as "this function does not serve that model" is
*    contradicted by measurement. On CN that condition is `4001`, and all 22
*    functions answered `4001` — never `4011` — for a model absent from their
*    roster, while `glm-5.3` streamed normally under its own function. Rate
*    limiting is per account, route and moment, which is exactly the shape of
*    that report: the same model through the same function was fine for days
*    and then failed, with Trae's own text saying "rate limit".
*  - `4001` — `config_name` is not one this function serves.
*  - `4008` — the account's SOLO quota is exhausted. Deliberately a different
*    code from `4011`: Trae words this one `your requests have exceeded the
*    quota`, so "I still have plenty of credits" and "I am being throttled" are
*    two different statements, and a user hits the second without touching the
*    first (issue #33).
*  - `4023` — the model name is unknown on the route that was asked.
*  - `4222` — the ENTERPRISE tenant's allowance is exhausted. Measured
*    2026-10-17 on a live tenant account whose enterprise credit ran out: the
*    gateway answered HTTP 200 with `{"code":4222,"message":""}` for a model
*    that streamed normally moments earlier (and still streams on the consumer
*    gateway). Like `4008` it is a billing fact rather than a config one, but
*    it is specific to the tenant pool -- the consumer balance is unaffected,
*    which is why it must not be folded into the `4008` reading.
*  - `2001` — the upstream has not published its function config for the route
*    that was asked. Evidence is issue #39: on a live CN account every SOLO
*    function's `get_detail_param` answered HTTP 200 with `config_info_list:
*    []` (an empty directory), and each chat call failed with
*    `{"code":2001,"message":"no function config found for appId=...,
*    function=solo_work_remote"}` (and the variant `[LLMUtilsChat.resolveByUsage]
*    function is empty, cannot resolve model by usage=`). The roster came back
*    empty and then self-resolved later with rows per function, so this is a
*    TRANSIENT server-side gap the user can wait out or retry — never a local
*    credential, plugin or account fault, and not something to re-login for.
*/
const TRAE_ERROR_HINTS = {
	1005: "Trae requires a paid plan for this model; the current account's plan does not cover it",
	2001: "Trae has not published its function config for this route (an upstream condition, not a local credential or config problem)",
	4001: "Trae does not serve this model under the SOLO function the request used (config_name rejected)",
	4008: "Trae reports the account's SOLO quota is exhausted for this request",
	4011: "Trae throttled the SOLO channel for this account (a rate limit, not the credit balance)",
	4023: "Trae does not recognise this model name on the SOLO route that was asked",
	4222: "The enterprise tenant allowance is exhausted (tenant spend is separate from the personal credit balance; the consumer gateway still has its own)"
};
/** `extra` is a JSON *string* on the wire; unwrap it to read `plan`. */
function traeErrorPlan(extra) {
	let value = extra;
	if (typeof value === "string") try {
		value = JSON.parse(value);
	} catch {
		return;
	}
	if (typeof value !== "object" || value === null) return void 0;
	const plan = value["plan"];
	return typeof plan === "number" ? plan : void 0;
}
/** A readable message for an in-stream Trae failure, with its code preserved. */
function describeTraeFailure(failure) {
	const plan = traeErrorPlan(failure.extra);
	const parts = [
		failure.code === void 0 ? "Trae refused the request" : TRAE_ERROR_HINTS[failure.code] ?? "Trae refused the request",
		...plan === void 0 ? [] : [`plan ${plan}`],
		...failure.code === void 0 ? [] : [`Trae code ${failure.code}`]
	];
	const detail = failure.message.trim();
	return detail === "" ? parts.join(" · ") : `${parts.join(" · ")} · upstream: ${detail}`;
}
/**
* HTTP status + error kind for an in-stream failure, so the loopback shim can
* answer with a real error instead of a truncated 200 stream.
*
* `1005` is a subscription gate: 402 is what makes clients stop rather than
* retry, and it is truthful.
*
* `4011` is a rate limit and is reported as one — `429` / `soft_rate` (issue
* #33). It previously answered `400` / `client`, which contradicted both its own
* message and the client's own behaviour: pi-ai classifies an error by its text
* (`/\b429\b|rate.?limit/i` → `RATE_LIMIT`), and `RATE_LIMIT` is retryable, so
* the kernel retried five times with backoff while this function called the same
* failure a non-retryable client error. Reporting the real status makes all
* three agree, and `soft_rate` is already what `fallback-upstream` refuses to
* replay — correct, since a throttled route is not a route-compatibility
* problem.
*
* Everything else stays a client-side rejection.
*/
function classifyTraeFailure(failure) {
	if (failure.code === 1005) return {
		status: 402,
		kind: "hard_credit"
	};
	if (failure.code === 4011) return {
		status: 429,
		kind: "soft_rate"
	};
	return {
		status: 400,
		kind: "client"
	};
}
/** Recognise an in-stream failure event, or return undefined for anything else. */
function traeFailureOf(decoded) {
	if (decoded.type !== "unknown") return void 0;
	const payload = decoded.data;
	const code = typeof payload?.["code"] === "number" ? payload["code"] : void 0;
	if (decoded.event !== "error" && !(code !== void 0 && code >= 4e3)) return void 0;
	return {
		...code === void 0 ? {} : { code },
		message: typeof payload?.["message"] === "string" ? payload["message"] : "",
		...payload?.["extra"] === void 0 ? {} : { extra: payload["extra"] }
	};
}
function normalizeToolCalls(value) {
	if (!Array.isArray(value)) return [];
	const calls = [];
	for (const raw of value) {
		if (typeof raw !== "object" || raw === null) continue;
		const record = raw;
		const rawFunction = typeof record["function_call"] === "object" && record["function_call"] !== null ? record["function_call"] : typeof record["function"] === "object" && record["function"] !== null ? record["function"] : {};
		const fn = {
			...typeof rawFunction["name"] === "string" ? { name: rawFunction["name"] } : {},
			...typeof rawFunction["arguments"] === "string" ? { arguments: rawFunction["arguments"] } : {}
		};
		calls.push({
			index: typeof record["index"] === "number" ? record["index"] : calls.length,
			...typeof record["id"] === "string" ? { id: record["id"] } : {},
			...record["type"] === "function" ? { type: "function" } : {},
			...Object.keys(fn).length === 0 ? {} : { function: fn }
		});
	}
	return calls;
}
/** Convert Trae's named SSE events into OpenAI chat-completion SSE chunks. */
function bridgeTraeSoloStream(response, model) {
	const source = response.body;
	if (source === null) return new Response(null, { status: 502 });
	return bridgeTraeSource(source, model);
}
/** {@link bridgeTraeSoloStream} over an already-opened byte stream. */
function bridgeTraeSource(source, model, log) {
	const id = `chatcmpl-${randomUUID().replaceAll("-", "").slice(0, 24)}`;
	const created = Math.floor(Date.now() / 1e3);
	const decoder = new TextDecoder();
	const encoder = new TextEncoder();
	const sse = new SseDecoder();
	let sawToolCalls = false;
	let emittedFinishReason = false;
	let upstreamEnded = false;
	let upstreamError;
	let usage;
	const chunk = (delta, finishReason = null) => encoder.encode(`data: ${JSON.stringify({
		id,
		object: "chat.completion.chunk",
		created,
		model,
		choices: [{
			index: 0,
			delta,
			finish_reason: finishReason
		}],
		...usage === void 0 ? {} : { usage }
	})}\n\n`);
	const stream = new ReadableStream({
		async start(controller) {
			const reader = source.getReader();
			const consume = (event) => {
				const decoded = decodeTraeEvent(event);
				if (decoded.type === "unknown") {
					const failure = traeFailureOf(decoded);
					if (failure !== void 0) upstreamError = new Error(describeTraeFailure(failure));
					return;
				}
				if (decoded.type === "diagnostic") {
					if (decoded.promptCachePoolRecord !== void 0 || decoded.pipeline !== void 0) log?.("dsh-connect-trae: upstream request diagnostics", {
						model,
						promptCachePoolRecord: decoded.promptCachePoolRecord,
						pipeline: decoded.pipeline,
						providerModelName: decoded.providerModelName
					});
					return;
				}
				if (decoded.type === "delta") {
					const delta = {};
					if (decoded.text !== "") delta["content"] = decoded.text;
					if (decoded.reasoning !== void 0 && decoded.reasoning !== "") delta["reasoning_content"] = decoded.reasoning;
					const toolCalls = normalizeToolCalls(decoded.toolCalls);
					if (toolCalls.length > 0) {
						sawToolCalls = true;
						delta["tool_calls"] = toolCalls;
					}
					if (Object.keys(delta).length > 0) controller.enqueue(chunk(delta));
				} else if (decoded.type === "usage") {
					const cacheRead = decoded.cacheReadTokens;
					const cacheWrite = decoded.cacheWriteTokens;
					const details = {
						...cacheRead === void 0 ? {} : { cached_tokens: cacheRead },
						...cacheWrite === void 0 ? {} : { cache_write_tokens: cacheWrite }
					};
					usage = {
						...decoded.inputTokens === void 0 ? {} : { prompt_tokens: decoded.inputTokens },
						...decoded.outputTokens === void 0 ? {} : { completion_tokens: decoded.outputTokens },
						...decoded.totalTokens === void 0 ? {} : { total_tokens: decoded.totalTokens },
						...Object.keys(details).length === 0 ? {} : { prompt_tokens_details: details }
					};
				} else if (decoded.type === "done") {
					upstreamEnded = true;
					if (!emittedFinishReason) {
						emittedFinishReason = true;
						if (upstreamError !== void 0) {
							controller.error(upstreamError);
							return;
						}
						controller.enqueue(chunk({}, sawToolCalls ? "tool_calls" : decoded.finishReason || "stop"));
					}
				}
			};
			try {
				while (true) {
					const next = await reader.read();
					if (next.done) break;
					for (const event of sse.push(decoder.decode(next.value, { stream: true }))) consume(event);
				}
				for (const event of sse.finish()) consume(event);
				if (upstreamError !== void 0 && !upstreamEnded) {
					controller.error(upstreamError);
					return;
				}
				if (!emittedFinishReason) {
					emittedFinishReason = true;
					controller.enqueue(chunk({}, sawToolCalls ? "tool_calls" : "stop"));
				}
				controller.enqueue(encoder.encode("data: [DONE]\n\n"));
				controller.close();
			} catch (error) {
				controller.error(error);
			} finally {
				reader.releaseLock();
			}
		},
		cancel(reason) {
			return source.cancel(reason);
		}
	});
	return new Response(stream, {
		status: 200,
		headers: { "Content-Type": "text/event-stream" }
	});
}
/**
* How far {@link openTraeSource} reads before giving up on finding a failure.
* Trae opens a real answer with small `metadata` / `timing_cost` events, so a
* healthy stream is recognised well inside these bounds; they exist only so a
* pathological stream cannot stall the response headers.
*/
const PEEK_MAX_CHUNKS = 64;
const PEEK_MAX_BYTES = 262144;
/** Replay the bytes the peek consumed, then drain the rest of the upstream. */
function replayTraeSource(buffered, reader, ended) {
	let index = 0;
	return new ReadableStream({
		async pull(controller) {
			const chunk = buffered[index];
			if (chunk !== void 0) {
				index += 1;
				controller.enqueue(chunk);
				return;
			}
			if (ended) {
				controller.close();
				return;
			}
			const next = await reader.read();
			if (next.done) {
				controller.close();
				return;
			}
			controller.enqueue(next.value);
		},
		async cancel(reason) {
			await reader.cancel(reason).catch(() => {});
		}
	});
}
/**
* Open the upstream answer, failing fast when Trae refuses BEFORE producing any
* output.
*
* This exists because Trae reports authorisation and subscription failures
* inside a **200** SSE body. Relaying that as a 200 and aborting mid-stream
* (what this bridge used to do) loses the code at the HTTP boundary: pi-ai only
* sees a truncated stream and reports `Stream ended without finish_reason`,
* which reads as a network fault and is retried five times — the exact symptom
* in issue #19. Peeking until the first real output lets a refusal become a
* normal error response with its code and plan intact.
*
* The peek is limited to the head of the stream and replayed verbatim, so a
* healthy answer keeps streaming with no buffering beyond the first event.
*/
async function openTraeSource(response) {
	const body = response.body;
	if (body === null) return {
		ok: false,
		status: 502,
		kind: "server",
		message: "Trae upstream returned no response body"
	};
	const reader = body.getReader();
	const decoder = new TextDecoder();
	const sse = new SseDecoder();
	const buffered = [];
	let bytes = 0;
	let ended = false;
	try {
		while (buffered.length < PEEK_MAX_CHUNKS && bytes < PEEK_MAX_BYTES) {
			const next = await reader.read();
			if (next.done) {
				ended = true;
				break;
			}
			buffered.push(next.value);
			bytes += next.value.byteLength;
			let answered = false;
			for (const event of sse.push(decoder.decode(next.value, { stream: true }))) {
				const decoded = decodeTraeEvent(event);
				const failure = traeFailureOf(decoded);
				if (failure !== void 0) {
					await reader.cancel().catch(() => {});
					return {
						ok: false,
						...classifyTraeFailure(failure),
						message: describeTraeFailure(failure)
					};
				}
				if (decoded.type !== "unknown" && decoded.type !== "diagnostic") answered = true;
			}
			if (answered) break;
		}
	} catch (error) {
		reader.releaseLock();
		return {
			ok: false,
			status: 0,
			kind: "server",
			message: `transport error: ${String(error)}`
		};
	}
	return {
		ok: true,
		source: replayTraeSource(buffered, reader, ended)
	};
}
/**
* Bridge an upstream answer, turning an early refusal into a real error result.
*
* The sibling {@link bridgeTraeSoloStream} stays synchronous and always answers
* 200; it is the primitive, and this is the policy the bridge class uses.
*/
async function bridgeTraeSoloStreamOrFail(response, model, log) {
	const opened = await openTraeSource(response);
	if (!opened.ok) return opened;
	return {
		ok: true,
		response: bridgeTraeSource(opened.source, model, log)
	};
}
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
function wireTargetsOf(models) {
	const byId = /* @__PURE__ */ new Map();
	const byName = /* @__PURE__ */ new Map();
	for (const model of models) {
		const target = {
			configName: model.wireConfigName ?? model.id,
			...model.wireFunction === void 0 ? {} : { function: model.wireFunction }
		};
		byId.set(model.id, target);
		const nameKey = model.name.trim().toLowerCase();
		if (!byName.has(nameKey)) byName.set(nameKey, target);
	}
	return {
		byId,
		byName
	};
}
/** Native SOLO client wrapper used by the loopback OpenAI adapter. */
var TraeSoloBridge = class {
	upstream;
	catalog;
	wireResolver;
	log;
	constructor(upstream, catalog, wireResolver, log) {
		this.upstream = upstream;
		this.catalog = catalog;
		this.wireResolver = wireResolver;
		this.log = log;
	}
	async chatStream(bodyJson, signal) {
		let model = "glm-5.2";
		let prepared = bodyJson;
		try {
			const input = JSON.parse(bodyJson);
			if (typeof input["model"] === "string" && input["model"] !== "") model = input["model"];
			const entryKey = model.trim().toLowerCase();
			const entry = this.catalog?.current().find((item) => item.id === model || item.id.trim().toLowerCase() === entryKey);
			const catalogConfigName = entry?.wireConfigName;
			const fromCatalog = entry === void 0 || catalogConfigName === void 0 && entry.wireFunction === void 0 ? void 0 : {
				configName: catalogConfigName ?? entry.id,
				...entry.wireFunction === void 0 ? {} : { function: entry.wireFunction }
			};
			const fromResolver = this.wireResolver?.(model) ?? this.wireResolver?.(entry?.name ?? "");
			/**
			* The catalog row wins the config_name, but it may not know the function.
			*
			* A row persisted by an older build -- or one whose `wireFunction` the
			* settings schema dropped -- carries the name mapping only, and asking
			* without the function is a `4001 config_name rejected` for every model
			* that a non-default function serves (`Doubao-Seed-Code` lives on
			* `solo_agent_remote` alone). The resolver is built from the same
			* directory, so borrowing its function is safe exactly when both sources
			* agree on the wire config_name; a disagreement means the resolver found
			* a different row and its function would be wrong.
			*
			* The MIRROR case is equally load-bearing and is the reason the row's own
			* id is not accepted as its wire spelling: a row that carries only the
			* FUNCTION (`wireConfigName` absent) has no config_name of its own, and
			* its display id is the wrong-cased spelling of the wire name in exactly
			* the cases issue #38 is about. The resolver's config_name is then the
			* only correct one, so it must win for the NAME while the row keeps
			* winning for the FUNCTION.
			*/
			const sameWireConfig = fromCatalog !== void 0 && fromResolver !== void 0 && fromCatalog.configName.toLowerCase() === fromResolver.configName.toLowerCase();
			/**
			* Whether the catalog row knows its own wire `config_name` (as opposed to
			* only carrying the display id plus a function). Only such a row may
			* decide the name on its own.
			*/
			const catalogKnowsConfigName = catalogConfigName !== void 0;
			const target = fromCatalog !== void 0 && fromCatalog.function === void 0 && sameWireConfig && fromResolver !== void 0 ? {
				configName: fromCatalog.configName,
				...fromResolver.function === void 0 ? {} : { function: fromResolver.function }
			} : fromCatalog !== void 0 && !catalogKnowsConfigName && fromResolver !== void 0 ? {
				configName: fromResolver.configName,
				...fromCatalog.function === void 0 ? {} : { function: fromCatalog.function }
			} : fromCatalog ?? fromResolver;
			/**
			* Last line of defence: the discovered row's own id.
			*
			* For models whose directory id IS the gateway `config_name` the merge
			* deliberately emits no `wireConfigName` (there is nothing to map), so a
			* requested id that differs only by case has neither mapping source —
			* and the row we just matched case-blindly is exactly the canonical
			* spelling. Sending it is what a correct mapping would have produced.
			*
			* Deliberately NOT derived from the row's `name`: the rosters spell most
			* ids in the opposite case of their display names (`glm-5.3` vs
			* `GLM-5.3`) and the gateway accepts the LOWERCASE id for those — a
			* name-derived rewrite answered `4001` for 4 of 5 probed models.
			*/
			const wireModel = target?.configName ?? entry?.id ?? model;
			const wireFunction = target?.function ?? entry?.wireFunction;
			if (wireModel !== input["model"]) input["model"] = wireModel;
			if (wireFunction !== void 0 && input["function"] !== wireFunction) input["function"] = wireFunction;
			if (wireModel !== JSON.parse(bodyJson)["model"] || wireFunction !== void 0) prepared = JSON.stringify(input);
			if (typeof input["reasoning_effort"] === "string") {
				const efforts = entry?.reasoningEfforts;
				const requested = input["reasoning_effort"];
				const mapped = efforts?.[requested];
				const allowed = efforts === void 0 ? [] : Object.values(efforts).filter((value) => typeof value === "string");
				if (typeof mapped === "string") input["reasoning_effort"] = mapped;
				else if (!allowed.includes(requested)) delete input["reasoning_effort"];
				prepared = JSON.stringify(input);
			}
		} catch {
			return {
				ok: false,
				status: 400,
				kind: "client",
				message: "invalid JSON request"
			};
		}
		const result = await this.upstream.chatStream(prepared, signal);
		if (!result.ok) return result;
		return await bridgeTraeSoloStreamOrFail(result.response, model, this.log);
	}
};
//#endregion
//#region src/model-metadata.ts
function finitePositive(value) {
	return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : void 0;
}
function record(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value) ? value : void 0;
}
function parseFeatures(value) {
	if (typeof value !== "string" || value === "") return void 0;
	try {
		return record(JSON.parse(value));
	} catch {
		return;
	}
}
/**
* Trae's wire effort name -> the DSH thinking level.
*
* The FORWARD half of the mapping; `WIRE_EFFORT_MAP` in `catalog.ts` is its
* exact inverse. Both halves must name the same levels, or a level survives one
* direction and vanishes in the other.
*
* `medium` and `max` are here because Trae's own client advertises them
* (`reasoning_effort.{low,medium,high,extra_high,max}` in its i18n bundle) and
* publishes the per-model list remotely — so the day upstream starts sending
* either, the parser must not filter it away before anything can use it (issue
* #60). Measured 2026-10-25 on a live CN credential, the published options were
* only `light / high / extra_high`; these entries are therefore inert today and
* ready tomorrow, not a claim that the levels are served now.
*
* An unknown name is deliberately ABSENT rather than defaulted: `parse` drops
* it, and the reverse map drops it too, so an unrecognised level can never be
* reported to the user or sent upstream under a name the vendor never said.
*/
const EFFORT_MAP = {
	light: "low",
	medium: "medium",
	high: "high",
	extra_high: "xhigh",
	max: "max"
};
/**
* Parse only capabilities explicitly advertised by Trae's remote model API.
*
* @param groupFunction The `data.list[].function` of the group this raw row
* was read from; attached verbatim so downstream can replay the model's own
* function instead of the `llm_utils_chat` default (see
* {@link TraeDiscoveredModel.function}).
*/
function parseTraeRemoteModel(value, groupFunction) {
	const raw = record(value);
	if (raw === void 0 || typeof raw.name !== "string" || raw.name === "") return void 0;
	const context = record(raw.context_window_tokens);
	const dev = finitePositive(context?.["dev"]);
	const max = raw.max_mode === true ? finitePositive(context?.["max"]) : void 0;
	const features = parseFeatures(raw.features);
	const consumption = record(features?.["consumption_rate"]);
	const consumptionData = record(consumption?.["data"]);
	const creditMultiplier = consumption?.["enable"] === true ? finitePositive(consumptionData?.["rate"]) : void 0;
	const reasoningSupported = record(features?.["reasoning"])?.["enable"] === true;
	const activityDiscount = parseTraeActivityDiscount(features?.["activity_discount"]);
	const reasoningConfig = record(raw.reasoning_effort_config);
	const supported = (Array.isArray(reasoningConfig?.["options"]) ? reasoningConfig["options"] : []).flatMap((option) => {
		if (typeof option !== "string") return [];
		const effort = EFFORT_MAP[option];
		return effort === void 0 ? [] : [effort];
	});
	const rawDefault = reasoningConfig?.["default_level"];
	const mappedDefault = typeof rawDefault === "string" ? EFFORT_MAP[rawDefault] : void 0;
	const defaultEffort = mappedDefault !== void 0 && supported.includes(mappedDefault) ? mappedDefault : void 0;
	return {
		id: raw.name,
		name: typeof raw.display_name === "string" && raw.display_name !== "" ? raw.display_name : raw.name,
		multimodal: raw.multimodal === true,
		...dev === void 0 ? {} : { contextWindow: dev },
		...max === void 0 ? {} : { maxContextWindow: max },
		...creditMultiplier === void 0 ? {} : { creditMultiplier },
		...activityDiscount === void 0 ? {} : { activityDiscount },
		reasoningSupported,
		...supported.length === 0 ? {} : { reasoning: {
			supported,
			...defaultEffort === void 0 ? {} : { defaultEffort }
		} },
		...groupFunction === void 0 || groupFunction === "" ? {} : { function: groupFunction }
	};
}
//#endregion
//#region src/failure.ts
/**
* Failure classification shared by the Host's HTTP routes.
*
* Issue #66: the model-refresh route wrapped EVERY thrown error as HTTP 500.
* A US credential sent to the Singapore gateway answers `401`, that 401 became
* `{"error":"SOLO remote models returned HTTP 401"}` under status 500, and the
* card could only say "HTTP 500" — so a region/routing problem was
* indistinguishable from a plugin crash, and the user re-signed-in instead of
* looking at the region.
*
* The fix is deliberately narrow: upstream HTTP verdicts and the local
* "region not served" verdict keep their meaning when they cross the route
* boundary. Only failures that carry no status of their own stay 500.
*
* @module dsh-connect-trae/failure
*/
/** Code for an upstream that refused the credential (401 / 403). */
const TRAE_AUTH_FAILURE_CODE = "authentication";
/** Code for any other upstream HTTP verdict (4xx/5xx that is not auth). */
const TRAE_UPSTREAM_FAILURE_CODE = "upstream";
/**
* A non-2xx answer from a Trae gateway, carrying the status the gateway
* actually sent.
*
* Plain `Error`s are still allowed everywhere (and stay 500 at the route); this
* class exists so the paths that DO know an upstream status can pass it on
* instead of leaving it buried in a message string.
*/
var TraeHttpError = class extends Error {
	status;
	name = "TraeHttpError";
	constructor(status, message) {
		super(message);
		this.status = status;
	}
};
/**
* Map a thrown failure onto the Host's HTTP answer.
*
*  - a region this build does not serve → `501` + `unsupported-region`
*    (the request is well-formed; this build simply has no route for it);
*  - an upstream 401/403 → the SAME status + `authentication`, so the client
*    can distinguish "sign in again" from "the plugin broke";
*  - any other upstream status → passed through verbatim + `upstream`;
*  - anything else (a programming error, a transport failure) → `500`.
*/
function httpFailureOf(error) {
	if (error instanceof TraeUnsupportedRegionError) return {
		status: 501,
		code: TRAE_UNSUPPORTED_REGION_CODE
	};
	if (error instanceof TraeHttpError) {
		const status = Number.isInteger(error.status) && error.status >= 400 && error.status <= 599 ? error.status : 502;
		if (status === 401 || status === 403) return {
			status,
			code: TRAE_AUTH_FAILURE_CODE
		};
		return {
			status,
			code: TRAE_UPSTREAM_FAILURE_CODE
		};
	}
	return { status: 500 };
}
//#endregion
//#region src/solo-remote.ts
const TRAE_SOLO_REMOTE_BASE = "https://solo.trae.cn/api/remote/v1";
/**
* Remote-directory functions to ask for, per region.
*
* The remote `/models` answer is **grouped by function** and the groups are not
* interchangeable (measured 2026-10-01, issue #19):
*
* ```
* solo_agent        : 19 models   ← superset; also the ONLY source of
*                                   gpt-6-astra / gpt-5.6-sol|terra|luna /
*                                   glm-5.2 / gpt-5.5 / Seed-2.1-Turbo
* solo_agent_remote : 10 models   ← what this client used to read, and all it
*                                   read: the preferred group only
* ```
*
* `solo_agent` ⊇ `solo_agent_remote`, so reading just the latter hid nine
* models that the Trae IDE does show — exactly what the reporter saw. Both
* groups are therefore requested, and every returned group is unioned.
*
* Asking for a function the gateway does not serve is harmless: unknown names
* are ignored rather than rejected (`solo_work_remote` returns no group on
* `ai`, and the request still answers HTTP 200).
*
* `chat_v3` was added on 2026-10-01 (issue #19 follow-up) because it carries
* three ai-region models that appear in NO other group — `deepseek-v3.2`,
* `gemini-3-flash-premium`, `gemini_2.5_flash_premium` — and those three are
* callable through it (see TRAE_DIRECTORY_FUNCTIONS in solo.ts).
*
* Both regions now ask the SAME group list (2026-10-02). CN previously asked
* only `solo_agent_remote` + `solo_work_remote`, which left its `solo_coder`
* group (12 models) unread — the same shape of miss as the ai one. Every group
* below was measured to exist on both gateways; a region that does not serve a
* name simply returns no group for it, which the union tolerates. Reading costs
* one query and the merge no longer discards rows for lacking a wire match (see
* mergeTraeModelSources), so an unread group is a model silently missing from
* the user's own list — the failure this list exists to prevent.
*
* `builder_v3` is included for the same reason even though neither region's
* current wire lists name it: its rows are real directory entries, and whether
* a paying account can call one is not something this client can determine.
*
* The IDE's own function list is wider still, and issue #46 showed what the
* gap costs. The Trae IDE asks for 22 functions (see TRAE_MODEL_DETAIL_FUNCTIONS
* in model-detail.ts); the list below asked for 7, and the groups the plugin
* did not ask about hid real models. Measured 2026-10-22 on a live CN
* credential: asking the Remote directory for the IDE's list as well returned
* **41** models instead of **33**, and the eight extra rows were real models
* the plugin could not show — `kimi-k2` (the `Kimi-K2-0905` snapshot, which
* lives under `inline_chat` ALONE), `doubao_1_8` (`Doubao-Seed-1.8`),
* `deepseek-V3`, `deepseek-V3.1`, `doubao-2.0-mini`, `glm-4.7`,
* `code-review-judge`, `multimodal_image_kimi-k2.5`.
*
* The five functions added here are the ones that carry a MODEL (as opposed to
* a helper config): `chat`, `inline_chat`, `solo_agent_lite`,
* `solo_design_lite`, `solo_design_remote`. The remaining IDE functions
* (`ui_builder_v2`, `builder`, `solo_builder`, `git_ai`, `utils`,
* `code_reviewer`, `code_review_summary`, `custom_agent_generation`,
* `multimodal`, `system_diagnosis`) are asked too, for the same reason
* `builder_v3` is: a row is a row, and the merge decides what to do with it.
* Asking for a function the gateway does not serve is harmless — unknown
* names are ignored rather than rejected.
*/
const TRAE_REMOTE_DIRECTORY_FUNCTIONS = {
	cn: [
		"solo_agent",
		"solo_agent_remote",
		"solo_work_remote",
		"solo_work_lite",
		"chat_v3",
		"solo_coder",
		"builder_v3",
		"chat",
		"inline_chat",
		"solo_agent_lite",
		"solo_design_lite",
		"solo_design_remote"
	],
	ai: [
		"solo_agent",
		"solo_agent_remote",
		"solo_work_remote",
		"solo_work_lite",
		"chat_v3",
		"solo_coder",
		"builder_v3",
		"chat",
		"inline_chat",
		"solo_agent_lite",
		"solo_design_lite",
		"solo_design_remote"
	]
};
/**
* Backup bases for the model directory, in try order after the official base.
*
* In restricted (proxy-sandboxed) networks the official catalog host
* `solo.trae.cn` is behind a CONNECT rejection while the region's chat gateway
* stays reachable — and that gateway serves the SAME `/api/remote/v1/models`
* endpoint with an identical response shape (verified against
* `https://trae-api-cn.mchost.guru/api/remote/v1` 2026-10-20; `chat` already
* carries `/api/remote/v1`'s parent in {@link REGION_GATEWAYS}). The backup is
* therefore derived from the region's chat base, mirrored on the remote path;
* `ai` shares a single host for chat and remote, so it yields no candidate and
* keeps its single-host behavior. An explicit `baseUrl` disables the chain.
*/
function traeSoloRemoteFallbackBases(region, officialBase) {
	const backupBase = `${REGION_GATEWAYS[region].chat}/api/remote/v1`;
	return backupBase === officialBase ? [] : [backupBase];
}
/**
* Case-folded identity for a directory id.
*
* A local copy of `catalog.ts`'s private `displayKey`: the two hosts of the
* union spell the same model differently (they disagree on at least 3 ids), and
* ids that differ only by case MUST be treated as the same model — otherwise a
* union would list one model twice under two spellings.
*/
function directoryKey(id) {
	return id.trim().toLowerCase();
}
/**
* Of two rows for the SAME model id, the one the catalog should keep.
*
* The gateway groups its directory by function and reports a model's capacity
* per group, with the group order varying between calls. Keeping the strongest
* row makes the published window deterministic. The comparison is
* LEXICOGRAPHIC and must be applied all the way down, or ordering leaks back in
* at the next field:
*
*  0. the kept row must also carry the promotional rule, which the groups
*     disagree about — the rule is copied onto the capacity winner, and of two
*     rules the one that can say more wins (see the comment in the body);
*  1. a row with a Max tier beats one without (`maxContextWindow` is only set
*     when the group reported `max_mode: true` with a positive max);
*  2. two Max rows: the larger max wins;
*  3. max equal (or absent on both): the WIDER dev window wins;
*  4. both equal: keep the incumbent, so the model order stays the gateway's.
*
* Step 3 is not an afterthought. With equal `max` the first version of this
* function stopped and kept the incumbent, which left the dev window decided by
* arrival order — measured 2026-10-05: `glm-5.2` came back as `dev=116000` when
* `chat_v3` won and `dev=200000` when `solo_agent_remote` did, both with
* `max=1000000` (9 of 30 CN models behaved that way, reported by JiewiW on
* Windows). A budgeted model still resolved to 1M either way, but the DEFAULT
* window of an unbudgeted model — what DSH shows and compresses against — was
* a coin flip, which is the same defect this function exists to remove.
*/
function preferStrongerRow(candidate, incumbent) {
	if (incumbent === void 0) return candidate;
	const winner = strongerCapacityRow(candidate, incumbent);
	const rule = richerRule(candidate.activityDiscount, incumbent.activityDiscount);
	if (rule === void 0 || rule === winner.activityDiscount) return winner;
	return {
		...winner,
		activityDiscount: rule
	};
}
/**
* Step 0's tie-break: of two rules for the same model id, the one that can say
* more about this moment. Every parsed rule already passed `enable: true` (see
* parseTraeActivityDiscount), so the ranking is: an upstream "right now"
* discount first, then the rule covering more clock. Two rules that rank EQUAL
* are compared by their canonical content, so the answer depends on the rule
* documents and never on which group the gateway answered first (issue #23).
*/
function richerRule(candidate, incumbent) {
	if (candidate === void 0) return incumbent;
	if (incumbent === void 0) return candidate;
	const score = (rule) => {
		return (rule.current !== void 0 && (rule.current.discountType ?? "none") !== "none" ? 1 : 0) * 1e3 + (rule.offPeak?.windows.length ?? 0);
	};
	const candidateScore = score(candidate);
	const incumbentScore = score(incumbent);
	if (candidateScore !== incumbentScore) return candidateScore > incumbentScore ? candidate : incumbent;
	return canonicalRule(candidate) < canonicalRule(incumbent) ? candidate : incumbent;
}
/**
* Content-only identity for two rules that scored the same.
*
* The score cannot distinguish, say, two `current: none` rules with two windows
* each in different hours — and keeping "whichever arrived first" would let the
* gateway's group order decide whether tonight's badge appears. Key order is
* normalised (the objects are ours, but a caller may hand us a literal), so
* equal documents compare equal and the incumbent is kept unchanged.
*/
function canonicalRule(rule) {
	const canonical = (value) => {
		if (Array.isArray(value)) return value.map((item) => canonical(item));
		if (typeof value !== "object" || value === null) return value;
		return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0).map(([key, item]) => [key, canonical(item)]));
	};
	return JSON.stringify(canonical(rule));
}
/** Steps 1–4 of the documented order: the row advertising the stronger capacity. */
function strongerCapacityRow(candidate, incumbent) {
	const candidateMax = candidate.maxContextWindow;
	const incumbentMax = incumbent.maxContextWindow;
	if (candidateMax !== void 0 && incumbentMax === void 0) return candidate;
	if (candidateMax === void 0 && incumbentMax !== void 0) return incumbent;
	if (candidateMax !== void 0 && incumbentMax !== void 0 && candidateMax !== incumbentMax) return candidateMax > incumbentMax ? candidate : incumbent;
	return (candidate.contextWindow ?? 0) > (incumbent.contextWindow ?? 0) ? candidate : incumbent;
}
/**
* Region-scoped request dressing. The CN portal is `solo.trae.cn` with the
* CN locale headers; the international directory lives on the shared
* `coresg-normal.trae.ai` gateway and was verified (2026-09-15) with the
* English/Singapore headers — both forms are accepted, each region keeps the
* shape its own portal sends.
*/
function remoteDressing(region) {
	return region === "ai" ? {
		referer: "https://coresg-normal.trae.ai/",
		timezone: "Asia/Singapore",
		language: "en"
	} : {
		referer: "https://solo.trae.cn/",
		timezone: "Asia/Shanghai",
		language: "zh-cn"
	};
}
/**
* Read-only model catalog client for the SOLO Web API.
*
* This deliberately has no chat/session method: the Remote session protocol
* only exposes a final answer and cannot preserve DSH's structured tool loop.
*/
var TraeSoloRemoteCatalogClient = class TraeSoloRemoteCatalogClient {
	options;
	fetchImpl;
	baseUrl;
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
	lastSuccessfulBase;
	/**
	* When the official base may be probed again after a transport/5xx failure,
	* as epoch milliseconds (0 = probe it on the next refresh).
	*/
	officialRetryAtMs = 0;
	/**
	* How long a failing official host is skipped before it is re-probed.
	*
	* Long enough that a blocked network stops paying the failing attempt on
	* every refresh (the point of the fallback), short enough that a healed
	* network takes over without a restart. Each probe costs one connect timeout
	* (30 s) in the worst case, so 5 minutes bounds that to ~1 attempt per 5 min.
	*/
	static OFFICIAL_RETRY_MS = 3e5;
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
	extraRetryAtMs = /* @__PURE__ */ new Map();
	unionBaseUrls;
	unionRegion;
	constructor(options) {
		this.options = options;
		this.fetchImpl = options.fetchImpl ?? fetch;
		this.baseUrl = options.baseUrl;
		this.unionBaseUrls = options.unionBaseUrls ?? [];
		this.unionRegion = options.unionRegion;
	}
	async headers(region) {
		const credential = await this.options.credential();
		const dressing = remoteDressing(region);
		return {
			"Authorization": `Cloud-IDE-JWT ${credential.accessToken}`,
			"Content-Type": "application/json",
			"x-trae-client-type": "web",
			"x-trae-user-timezone": dressing.timezone,
			"x-preferenced-language": dressing.language,
			"Referer": dressing.referer,
			"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
		};
	}
	async fetchModels(signal) {
		const credential = await this.options.credential();
		const region = assertSupportedRegion(regionOfCredential(credential));
		const officialBase = this.baseUrl ?? REGION_GATEWAYS[region].remote;
		const headers = await this.headers(region);
		const functions = TRAE_REMOTE_DIRECTORY_FUNCTIONS[region].join(",");
		let lastError;
		let emptyError;
		for (const base of this.candidateBases(region, officialBase)) {
			let response;
			try {
				response = await this.fetchImpl(`${base}/models?functions=${functions}`, {
					headers,
					signal: signal ?? AbortSignal.timeout(3e4)
				});
			} catch (error) {
				if (signal?.aborted) throw error;
				if (base === officialBase) this.officialRetryAtMs = Date.now() + TraeSoloRemoteCatalogClient.OFFICIAL_RETRY_MS;
				lastError = error;
				continue;
			}
			if (!response.ok) {
				if (response.status < 500) throw new TraeHttpError(response.status, `SOLO remote models returned HTTP ${response.status}`);
				if (base === officialBase) this.officialRetryAtMs = Date.now() + TraeSoloRemoteCatalogClient.OFFICIAL_RETRY_MS;
				lastError = /* @__PURE__ */ new Error(`SOLO remote models returned HTTP ${response.status}`);
				continue;
			}
			const json = await response.json();
			const models = this.collectModels(region, json.data?.list ?? []);
			if (models.length === 0) {
				emptyError = /* @__PURE__ */ new Error("SOLO remote models response contained no models");
				lastError = emptyError;
				continue;
			}
			if (base !== officialBase) this.options.log?.(this.lastSuccessfulBase === base ? `model directory served by the remembered fallback host ${base}; the official host (${officialBase}) is re-probed every ${TraeSoloRemoteCatalogClient.OFFICIAL_RETRY_MS / 6e4} minutes` : `model directory served by fallback host ${base}; the official host (${officialBase}) failed this refresh`, { officialBase });
			else this.officialRetryAtMs = 0;
			this.lastSuccessfulBase = base;
			return await this.unionWithExtraHosts(region, credential, headers, models, signal);
		}
		if (emptyError !== void 0) throw emptyError;
		throw lastError instanceof Error ? lastError : new Error(String(lastError));
	}
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
	async unionWithExtraHosts(region, credential, headers, primary, signal) {
		if (this.unionBaseUrls.length === 0) return primary;
		if (this.unionRegion !== void 0 && this.unionRegion !== region) return primary;
		if (!isEnterpriseAccount(credential)) return primary;
		const functions = TRAE_REMOTE_DIRECTORY_FUNCTIONS[region].join(",");
		const byKey = /* @__PURE__ */ new Map();
		for (const model of primary) byKey.set(directoryKey(model.id), model);
		for (const base of this.unionBaseUrls) {
			if (base === this.lastSuccessfulBase) continue;
			if ((this.extraRetryAtMs.get(base) ?? 0) > Date.now()) continue;
			let response;
			try {
				response = await this.fetchImpl(`${base}/models?functions=${functions}`, {
					headers,
					signal: signal ?? AbortSignal.timeout(3e4)
				});
			} catch (error) {
				if (signal?.aborted) throw error;
				this.extraRetryAtMs.set(base, Date.now() + TraeSoloRemoteCatalogClient.OFFICIAL_RETRY_MS);
				this.options.log?.(`model directory union host ${base} was unreachable; its models are missing from this refresh`, {
					base,
					error: String(error)
				});
				continue;
			}
			if (!response.ok) {
				this.extraRetryAtMs.set(base, Date.now() + TraeSoloRemoteCatalogClient.OFFICIAL_RETRY_MS);
				this.options.log?.(`model directory union host ${base} answered HTTP ${response.status}; its models are missing from this refresh`, { base });
				continue;
			}
			let extra;
			try {
				const json = await response.json();
				extra = this.collectModels(region, json.data?.list ?? []);
			} catch (error) {
				this.extraRetryAtMs.set(base, Date.now() + TraeSoloRemoteCatalogClient.OFFICIAL_RETRY_MS);
				this.options.log?.(`model directory union host ${base} answered a body that could not be read; its models are missing from this refresh`, {
					base,
					error: String(error)
				});
				continue;
			}
			this.extraRetryAtMs.delete(base);
			let added = 0;
			for (const model of extra) {
				const key = directoryKey(model.id);
				if (byKey.has(key)) continue;
				byKey.set(key, model);
				added += 1;
			}
			const collided = extra.length - added;
			this.options.log?.(`model directory union host ${base} contributed ${added} model(s) the primary directory did not list${collided > 0 ? ` (${collided} collided and kept the primary spelling)` : ""}`, {
				base,
				served: extra.length,
				added
			});
		}
		return [...byKey.values()];
	}
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
	candidateBases(region, officialBase) {
		if (this.baseUrl !== void 0) return [officialBase];
		const fallbacks = traeSoloRemoteFallbackBases(region, officialBase);
		if (this.officialRetryAtMs <= Date.now()) return [officialBase, ...fallbacks];
		const remembered = this.lastSuccessfulBase;
		return [
			...remembered === void 0 ? [] : [remembered],
			...fallbacks.filter((base) => base !== remembered),
			officialBase
		];
	}
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
	collectModels(region, groups) {
		const byId = /* @__PURE__ */ new Map();
		const attributedFunction = /* @__PURE__ */ new Map();
		/**
		* The function a row may be stamped with: only a CHAT function. A non-chat
		* roster is not "the function this model belongs to" in any sense the chat
		* route can use (see the method note above), so it is not recorded at all.
		*/
		const chatFunctions = new Set(TRAE_DIRECTORY_FUNCTIONS[region]);
		const attribution = (groupFunction) => groupFunction !== void 0 && chatFunctions.has(groupFunction) ? groupFunction : void 0;
		const addGroup = (groupFunction, raws) => {
			const fn = attribution(groupFunction);
			for (const raw of raws) {
				const model = parseTraeRemoteModel(raw, fn);
				if (model === void 0) continue;
				if (fn !== void 0 && !attributedFunction.has(model.id)) attributedFunction.set(model.id, fn);
				byId.set(model.id, preferStrongerRow(model, byId.get(model.id)));
			}
		};
		/**
		* Every group the gateway sent, bucketed BY FUNCTION NAME and kept as a
		* LIST.
		*
		* A name→group `Map` would keep only the LAST group of a name and silently
		* drop the models of every earlier one: nothing documents that the gateway
		* sends a function at most once, and the pre-change code unioned every
		* element of `data.list`, so a repeated name lost real models. Bucketing
		* keeps that union while the walk below still imposes a deterministic
		* order.
		*/
		const byFunction = /* @__PURE__ */ new Map();
		for (const group of groups) {
			const key = group.function ?? "";
			const bucket = byFunction.get(key);
			if (bucket === void 0) byFunction.set(key, [group]);
			else bucket.push(group);
		}
		for (const name of TRAE_DIRECTORY_FUNCTIONS[region]) for (const group of byFunction.get(name) ?? []) addGroup(name, group.models ?? []);
		for (const [name, bucket] of byFunction) {
			if (chatFunctions.has(name)) continue;
			for (const group of bucket) addGroup(name, group.models ?? []);
		}
		return [...byId.values()].map((model) => {
			const fn = attributedFunction.get(model.id);
			return fn === void 0 || fn === model.function ? model : {
				...model,
				function: fn
			};
		});
	}
};
//#endregion
//#region src/raw-runtime-config.ts
/** Merge safe current-cache facts with observed behavior flags; no network credentials enter this object. */
function traeRawChatExtraInfo(config) {
	return {
		...config.nativeFunctionCall === void 0 ? {} : { native_function_call: config.nativeFunctionCall },
		...config.useV2Process === void 0 ? {} : { use_v2_process: config.useV2Process },
		...config.maxModeEnabled === void 0 ? {} : { v2_max_mode_enabled: config.maxModeEnabled },
		...config.maxToolcallChars === void 0 ? {} : { v3_max_toolcall_chars: config.maxToolcallChars },
		...config.streamThrottleEnabled === void 0 ? {} : { v3_stream_throttle_enabled: config.streamThrottleEnabled }
	};
}
function buildTraeRawChatRuntimeConfig(modelName, cached, behavior = {}) {
	return {
		configName: modelName,
		modelName,
		...cached?.promptMaxTokens === void 0 ? {} : { promptMaxTokens: cached.promptMaxTokens },
		...cached?.maxTokens === void 0 ? {} : { maxTokens: cached.maxTokens },
		...cached?.maxTurn === void 0 ? {} : { maxTurn: cached.maxTurn },
		...cached?.multimodal === void 0 ? {} : { multimodal: cached.multimodal },
		...cached?.customConfig === void 0 ? {} : { customConfig: structuredClone(cached.customConfig) },
		...behavior.nativeFunctionCall === void 0 ? {} : { nativeFunctionCall: behavior.nativeFunctionCall },
		...behavior.passBackReasoning === void 0 ? {} : { passBackReasoning: behavior.passBackReasoning },
		...behavior.useV2Process === void 0 ? {} : { useV2Process: behavior.useV2Process },
		...behavior.maxModeEnabled === void 0 ? {} : { maxModeEnabled: behavior.maxModeEnabled },
		...behavior.maxToolcallChars === void 0 ? {} : { maxToolcallChars: behavior.maxToolcallChars },
		...behavior.streamThrottleEnabled === void 0 ? {} : { streamThrottleEnabled: behavior.streamThrottleEnabled }
	};
}
//#endregion
//#region src/raw-upstream.ts
function classifyTraeRawChatFailure(message) {
	const text = message.trim();
	if (text === "") return "empty";
	if (text.startsWith("{") || text.startsWith("[")) return "json";
	if (/permission|forbidden|unauthorized|auth/i.test(text)) return "permission";
	if (/model|config_name|config name/i.test(text)) return "model";
	if (/schema|field|parameter|invalid|missing|required|parse/i.test(text)) return "schema";
	if (/^Trae Raw Chat returned HTTP \d{3}$/i.test(text)) return "generic-http";
	return "other";
}
function errorKind(status) {
	if (status === 401 || status === 403) return "authentication";
	if (status === 402) return "hard_credit";
	if (status === 429) return "soft_rate";
	if (status === 404) return "not_found";
	if (status >= 500) return "server";
	return "client";
}
/**
* Evidence-gated Raw Chat client. It is fully testable through injected fetch,
* but production callers must not construct it without verified config values.
*/
var TraeRawChatUpstreamClient = class {
	options;
	fetchImpl;
	constructor(options) {
		this.options = options;
		this.fetchImpl = options.fetchImpl ?? fetch;
		if (options.config.configName.trim() === "") throw new Error("Trae Raw Chat configName must be evidence-backed and non-empty");
	}
	async chatStream(bodyJson, signal) {
		let input;
		try {
			input = JSON.parse(bodyJson);
		} catch {
			return {
				ok: false,
				status: 400,
				kind: "client",
				message: "invalid JSON request"
			};
		}
		if (!Array.isArray(input.messages) || input.messages.length === 0) return {
			ok: false,
			status: 400,
			kind: "client",
			message: "messages are required"
		};
		const [credential, identity] = await Promise.all([this.options.credential(), this.options.identity()]);
		const requestId = crypto.randomUUID();
		const headers = buildTraeCnHeaders(credential, identity, {
			requestId,
			profile: "raw-chat"
		});
		const runtime = this.options.config.runtime;
		const runtimeExtra = runtime === void 0 ? {} : traeRawChatExtraInfo(runtime);
		const body = {
			...buildTraeRawChatDraft({
				model: this.options.config.model,
				messages: input.messages,
				...input.tools === void 0 ? {} : { tools: input.tools },
				...input.max_tokens === void 0 ? {} : { maxTokens: input.max_tokens },
				...input.temperature === void 0 ? {} : { temperature: input.temperature },
				...input.reasoning_effort === void 0 ? {} : { reasoningEffort: input.reasoning_effort },
				...Object.keys(runtimeExtra).length === 0 && this.options.config.extraInfo === void 0 ? {} : { extraInfo: {
					...runtimeExtra,
					...this.options.config.extraInfo
				} }
			}),
			config_name: this.options.config.configName,
			...this.options.config.promptSet === void 0 ? {} : { prompt_set: this.options.config.promptSet },
			...this.options.config.abVersion === void 0 ? {} : { ab_version: this.options.config.abVersion },
			pass_back_reasoning: runtime?.passBackReasoning ?? this.options.config.passBackReasoning
		};
		let base;
		try {
			base = this.options.baseUrl ?? REGION_GATEWAYS[assertSupportedRegion(regionOfCredential(credential))].chat;
		} catch (error) {
			return {
				ok: false,
				status: 503,
				kind: "unconfigured",
				message: error instanceof Error ? error.message : String(error)
			};
		}
		let response;
		try {
			response = await this.fetchImpl(traeEndpoint(base, TRAE_RAW_CHAT_V2_PATH), {
				method: "POST",
				headers,
				body: JSON.stringify(body),
				signal: signal ?? AbortSignal.timeout(3e4)
			});
		} catch (error) {
			return {
				ok: false,
				status: 0,
				kind: "server",
				message: `transport error: ${String(error)}`
			};
		}
		if (response.ok) return {
			ok: true,
			response
		};
		const text = (await response.text()).slice(0, 1024);
		return {
			ok: false,
			status: response.status,
			kind: errorKind(response.status),
			message: text || `Trae Raw Chat returned HTTP ${response.status}`
		};
	}
};
//#endregion
//#region src/raw-capability.ts
/** One short non-tool request decides whether Raw Chat may become primary. */
async function probeTraeRawChatCapability(client, signal) {
	const body = JSON.stringify({
		model: "qwen-3.7-plus",
		messages: [{
			role: "user",
			content: "Reply with exactly: OK"
		}],
		max_tokens: 8,
		temperature: 0
	});
	const result = await client.chatStream(body, signal);
	if (result.ok) {
		const contentType = result.response.headers.get("content-type");
		await result.response.body?.cancel().catch(() => {});
		return {
			available: true,
			contentType
		};
	}
	return {
		available: false,
		reason: result.kind === "authentication" ? "authentication" : result.kind === "hard_credit" ? "credit" : result.kind === "soft_rate" ? "rate" : result.status === 400 || result.status === 404 || result.status === 415 || result.kind === "unconfigured" ? "protocol" : result.kind === "server" && result.status === 0 ? "transport" : "server",
		status: result.status
	};
}
//#endregion
//#region src/raw-capability-state.ts
/** In-memory capability state; success/failure expires and config changes invalidate it. */
var TraeRawCapabilityState = class {
	ttlMs;
	snapshot = {};
	constructor(ttlMs = 18e5) {
		this.ttlMs = ttlMs;
	}
	current(fingerprint, now = Date.now()) {
		const value = this.snapshot;
		if (value.capability === void 0 || value.checkedAtMs === void 0 || value.fingerprint !== fingerprint) return void 0;
		return now - value.checkedAtMs <= this.ttlMs ? value.capability : void 0;
	}
	record(fingerprint, capability, now = Date.now()) {
		this.snapshot = {
			fingerprint,
			capability,
			checkedAtMs: now
		};
	}
	inspect() {
		return { ...this.snapshot };
	}
	invalidate() {
		this.snapshot = {};
	}
};
//#endregion
//#region src/raw-capability-controller.ts
/** Explicitly-triggered, single-flight Raw Chat capability checks. */
var TraeRawCapabilityController = class {
	options;
	state;
	enabled;
	inflight;
	constructor(options) {
		this.options = options;
		this.state = options.state ?? new TraeRawCapabilityState();
		this.enabled = options.enabled ?? false;
	}
	current(fingerprint) {
		return this.enabled ? this.state.current(fingerprint) : void 0;
	}
	setEnabled(enabled) {
		if (this.enabled !== enabled) this.state.invalidate();
		this.enabled = enabled;
	}
	inspect() {
		return this.state.inspect();
	}
	isEnabled() {
		return this.enabled;
	}
	invalidate() {
		this.state.invalidate();
	}
	probe(fingerprint, signal) {
		if (!this.enabled) return Promise.resolve({
			available: false,
			reason: "protocol",
			status: 0
		});
		const cached = this.state.current(fingerprint);
		if (cached !== void 0) return Promise.resolve(cached);
		this.inflight ??= probeTraeRawChatCapability(this.options.client, signal).then((result) => {
			this.state.record(fingerprint, result);
			return result;
		}).finally(() => {
			this.inflight = void 0;
		});
		return this.inflight;
	}
};
//#endregion
//#region src/raw-fingerprint.ts
/** Stable non-secret fingerprint for capability-cache invalidation. */
function rawCapabilityFingerprint(input) {
	const stable = JSON.stringify({
		endpoint: input.endpoint,
		edition: input.edition,
		appVersion: input.identity.appVersion ?? "",
		buildVersion: input.identity.buildVersion ?? "",
		runtime: input.runtime
	});
	return createHash("sha256").update(stable).digest("hex");
}
//#endregion
//#region src/raw-diagnostic.ts
/** Project capability facts to a redacted, user-safe status. */
function rawCapabilityDiagnostic(enabled, capability, checkedAtMs) {
	if (!enabled) return { state: "disabled" };
	if (capability === void 0) return { state: "unchecked" };
	if (capability.available) return {
		state: "available",
		...checkedAtMs === void 0 ? {} : { checkedAtMs }
	};
	return {
		state: capability.reason === "protocol" ? "protocol-gated" : capability.reason,
		status: capability.status,
		...checkedAtMs === void 0 ? {} : { checkedAtMs }
	};
}
//#endregion
//#region src/fallback-upstream.ts
/**
* Optional primary route first, native SOLO tool-call route second. Fallback is intentionally narrow:
* only definitive pre-stream schema/route incompatibilities may retry the same
* user request. Authentication, credit, rate, cancellation, transport/server
* failures, and every successful Response are never replayed.
*/
var TraeFallbackUpstreamClient = class {
	options;
	constructor(options) {
		this.options = options;
	}
	async chatStream(bodyJson, signal) {
		const primary = await this.options.primary.chatStream(bodyJson, signal);
		if (primary.ok) return primary;
		if (!this.canFallback(primary, signal)) return primary;
		this.options.onFallback?.(primary);
		return this.options.fallback.chatStream(bodyJson, signal);
	}
	canFallback(result, signal) {
		if (signal?.aborted === true) return false;
		if (result.kind === "authentication" || result.kind === "hard_credit" || result.kind === "soft_rate") return false;
		return result.status === 400 || result.status === 404 || result.status === 415 || result.kind === "unconfigured";
	}
};
//#endregion
//#region src/gated-upstream.ts
/** Select Raw Chat only after a successful capability probe; SOLO is the safe default. */
var TraeGatedUpstreamClient = class {
	options;
	constructor(options) {
		this.options = options;
	}
	chatStream(bodyJson, signal) {
		if (this.options.capability()?.available !== true) return this.options.solo.chatStream(bodyJson, signal);
		return new TraeFallbackUpstreamClient({
			primary: this.options.raw,
			fallback: this.options.solo,
			...this.options.onFallback === void 0 ? {} : { onFallback: this.options.onFallback }
		}).chatStream(bodyJson, signal);
	}
};
//#endregion
//#region src/raw-gateway.ts
/** Assemble the opt-in capability state and safe Raw→SOLO routing. */
function createTraeRawGateway(options) {
	const fingerprint = () => rawCapabilityFingerprint(options);
	const controller = new TraeRawCapabilityController({
		client: options.raw,
		enabled: options.enabled ?? false
	});
	return {
		upstream: new TraeGatedUpstreamClient({
			raw: options.raw,
			solo: options.solo,
			capability: () => controller.current(fingerprint())
		}),
		probe: (signal) => controller.probe(fingerprint(), signal),
		diagnostic: () => {
			const snapshot = controller.inspect();
			return rawCapabilityDiagnostic(controller.isEnabled(), snapshot.capability, snapshot.checkedAtMs);
		},
		invalidate: () => controller.invalidate()
	};
}
//#endregion
//#region src/model-cache.ts
const execFileAsync = promisify(execFile);
/** Basename of the SQLite cache sitting beside the credential document. */
const TRAE_STATE_DB_FILENAME = "state.vscdb";
function positive$1(value) {
	return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : void 0;
}
/** Parse a safe subset of one cached model entry; credentials and endpoints are intentionally omitted. */
function parseTraeCachedModel(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return void 0;
	const raw = value;
	if (typeof raw["name"] !== "string" || raw["name"] === "") return void 0;
	let customConfig;
	if (typeof raw["custom_config"] === "string" && raw["custom_config"] !== "") try {
		const parsed = JSON.parse(raw["custom_config"]);
		if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) customConfig = parsed;
	} catch {}
	const promptMaxTokens = positive$1(raw["prompt_max_tokens"]);
	const maxTokens = positive$1(raw["max_tokens"]);
	const maxTurn = positive$1(raw["max_turn"]);
	return {
		name: raw["name"],
		...customConfig === void 0 ? {} : { customConfig },
		...promptMaxTokens === void 0 ? {} : { promptMaxTokens },
		...maxTokens === void 0 ? {} : { maxTokens },
		...maxTurn === void 0 ? {} : { maxTurn },
		...typeof raw["multimodal"] === "boolean" ? { multimodal: raw["multimodal"] } : {},
		...typeof raw["model_type"] === "string" ? { modelType: raw["model_type"] } : {}
	};
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
function traeStateDatabaseCandidates(options = {}) {
	const platform = options.platform ?? process.platform;
	const home = options.home ?? homedir();
	const env = options.env ?? process.env;
	const paths = [];
	const push = (storagePath) => {
		const database = join(dirname(storagePath), TRAE_STATE_DB_FILENAME);
		if (!paths.some((existing) => existing.toLowerCase() === database.toLowerCase())) paths.push(database);
	};
	if (options.candidate !== void 0 && options.candidate.source === "desktop") push(options.candidate.path);
	for (const candidate of traeStorageCandidates(platform, home, env)) {
		if (candidate.source !== "desktop") continue;
		if (options.candidate !== void 0 && candidate.edition !== options.candidate.edition) continue;
		push(candidate.path);
	}
	return paths;
}
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
async function readTraeCachedModel(functionName, modelName, userId, options = {}) {
	const exists = options.exists ?? existsSync;
	const databases = traeStateDatabaseCandidates(options);
	const fallback = databases[0];
	if (fallback === void 0) throw new Error("trae: no desktop storage candidate to locate the model cache from");
	const database = databases.find((candidate) => exists(candidate)) ?? fallback;
	const key = `${userId}_AI.agent.model.model_list_map`;
	const sql = `select value from ItemTable where key=${JSON.stringify(key)} limit 1;`;
	const { stdout } = await (options.runSqlite ?? ((db, statement) => execFileAsync("sqlite3", [db, statement], { maxBuffer: 8388608 })))(database, sql);
	const document = JSON.parse(stdout);
	return parseTraeCachedModel((Array.isArray(document[functionName]) ? document[functionName] : []).find((item) => typeof item === "object" && item !== null && item.name === modelName));
}
//#endregion
//#region src/raw-resolver.ts
/** Resolve current desktop identity and safe cached model config for capability probing. */
async function resolveTraeRawRuntime(store, modelName) {
	const credential = await store.resolve();
	const candidate = store.candidates().find((item) => item.edition === credential.edition);
	if (candidate === void 0) throw new Error(`no Trae ${credential.edition} storage candidate for Raw Chat identity`);
	const identity = await readTraeIdentity(candidate);
	const cached = credential.edition === "cn" ? await readTraeCachedModel("solo_agent", modelName, credential.userId, { candidate }).catch(() => void 0) : void 0;
	return {
		identity,
		runtime: buildTraeRawChatRuntimeConfig(modelName, cached, {
			passBackReasoning: true,
			nativeFunctionCall: cached?.customConfig?.["native_function_call"] === true,
			useV2Process: cached?.customConfig?.["use_v2_process"] === true
		})
	};
}
//#endregion
//#region src/delegating-upstream.ts
/** Stable shim dependency whose delegate can be replaced after async setup. */
var TraeDelegatingUpstreamClient = class {
	delegate;
	constructor(delegate) {
		this.delegate = delegate;
	}
	replace(delegate) {
		this.delegate = delegate;
	}
	chatStream(bodyJson, signal) {
		return this.delegate.chatStream(bodyJson, signal);
	}
};
//#endregion
//#region src/model-probe.ts
/**
* How long one probe may take. Trae answers a one-word prompt in a few seconds;
* beyond this the answer is not worth waiting for and is reported as unknown.
*/
const TRAE_PROBE_TIMEOUT_MS = 3e4;
/**
* Every upstream code the probe recognises, mapped to the verdict it implies.
*
* ONE table, not a set per verdict: with separate sets the outcome depended on
* the order the branches happened to be written in, so a code left in two sets
* was silently decided by whichever line ran first (measured: re-adding `4011`
* to the "unsupported" set passed every test). A single map makes a code mean
* exactly one thing, and {@link assertCodesAreDistinct} pins that down at
* module load.
*
*  - `1005` — the plan does not cover this model (`extra.plan` carries the
*    tier). A paying account may pass, so it is a gate, not a dead model.
*  - `4001` — this function's roster does not contain that `config_name`. The
*    ONLY code that may produce `unsupported`, measured on all 22 functions of
*    a live CN credential (issue #33).
*  - `4011` — Trae throttled the route; its own text says the rate limit was
*    exceeded. Issue #33 moved this here from `unsupported`: reporting a
*    throttle as "the channel does not serve it" told users a working model was
*    dead.
*  - `4008` — the ACCOUNT's SOLO quota is exhausted. It says nothing about any
*    one model, so it must not become a model verdict; it stays inconclusive
*    and carries the upstream text, so the user retests once the quota is back.
*/
const CODE_VERDICTS = {
	1005: "gated",
	4001: "unsupported",
	4008: "unknown",
	4011: "rate_limited"
};
/** A code that maps to two verdicts would make the table order-dependent. */
function assertCodesAreDistinct(table) {
	const codes = Object.keys(table);
	if (new Set(codes).size !== codes.length) throw new Error("dsh-connect-trae: a Trae probe code maps to more than one verdict");
}
assertCodesAreDistinct(CODE_VERDICTS);
/** Pull `Trae code N` out of an already-translated failure message. */
function codeOf(message) {
	const match = /Trae code (\d+)/u.exec(message);
	return match === null ? void 0 : Number(match[1]);
}
/**
* Classify a failure that arrived as a thrown stream error rather than a
* returned result.
*
* The bridge errors the stream (instead of returning a result) when a refusal
* interrupts an answer that had already started; its message is the same
* translated text, so a named code is still decisive. Anything without a
* recognised code — an abort, a socket reset, a proxy — stays `unknown`.
*/
function classifyProbeError(message) {
	if (codeOf(message) !== void 0) {
		const classified = classifyProbeResult({
			ok: false,
			status: 0,
			kind: "client",
			message
		}, false);
		if (classified.verdict !== "unknown") return classified;
	}
	return {
		verdict: "unknown",
		detail: message === "" ? "the stream failed without a message" : `stream failed: ${message}`
	};
}
/**
* Classify a completed upstream call.
*
* `result` is what `TraeSoloBridge.chatStream` returned, so a refusal that
* arrived inside a 200 body has already been turned into a real error result
* (and its code translated into `message`) by the bridge — this function only
* has to read it back.
*/
function classifyProbeResult(result, outputSeen) {
	if (result.ok) return outputSeen ? {
		verdict: "available",
		detail: "upstream answered"
	} : {
		verdict: "unknown",
		detail: "the stream ended without any output"
	};
	const message = result.message.trim() === "" ? `HTTP ${result.status}` : result.message;
	if (result.kind === "authentication" || result.status === 401 || result.status === 403) return {
		verdict: "auth",
		detail: message
	};
	if (result.kind === "soft_rate" || result.status === 429) return {
		verdict: "rate_limited",
		detail: message
	};
	const code = codeOf(message);
	const mapped = code === void 0 ? void 0 : CODE_VERDICTS[code];
	if (mapped !== void 0) return {
		verdict: mapped,
		detail: message
	};
	if (result.kind === "client" && result.status >= 400 && result.status < 500) return {
		verdict: "unsupported",
		detail: message
	};
	return {
		verdict: "unknown",
		detail: message
	};
}
/** Read a probe response without letting a large or endless body stall. */
async function readProbeOutput(response) {
	try {
		const text = await response.text();
		return { output: /"content"\s*:\s*"[^"]/u.test(text) || /"tool_calls"/u.test(text) };
	} catch (error) {
		return {
			output: false,
			error: error instanceof Error ? error : new Error(String(error))
		};
	}
}
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
const MAX_PROBE_INPUT_TOKENS = 1e5;
function probeBody(model, inputTokens = 0) {
	const padded = Math.min(Math.max(0, Math.floor(inputTokens)), MAX_PROBE_INPUT_TOKENS);
	const content = padded > 0 ? `ping ${"x ".repeat(padded).trimEnd()}` : "ping";
	return JSON.stringify({
		model,
		messages: [{
			role: "user",
			content
		}]
	});
}
/**
* Probe one model through the bridge the plugin actually chats with, so the
* recorded verdict describes the user's real path (same wire resolution, same
* function stamping, same error translation).
*/
async function probeOneModel(chat, id, timeoutMs = TRAE_PROBE_TIMEOUT_MS, inputTokens = 0) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const result = await chat(probeBody(id, inputTokens), controller.signal);
		if (!result.ok) return {
			id,
			...classifyProbeResult(result, false)
		};
		const { output, error } = await readProbeOutput(result.response);
		if (error !== void 0) return {
			id,
			...classifyProbeError(error.message)
		};
		return {
			id,
			...classifyProbeResult(result, output)
		};
	} catch (error) {
		if (controller.signal.aborted) return {
			id,
			verdict: "unknown",
			detail: `no answer within ${Math.round(timeoutMs / 1e3)}s`
		};
		return {
			id,
			...classifyProbeError(error instanceof Error ? error.message : String(error))
		};
	} finally {
		clearTimeout(timer);
	}
}
/**
* Probe a list of models ONE AT A TIME.
*
* Sequential on purpose: Trae throttles bursts, and a burst of parallel probes
* would manufacture the very `rate_limited`/`unknown` verdicts this feature
* must avoid. An authentication failure stops the run — every later probe would
* fail the same way, and spending calls to learn that again is waste.
*/
async function probeModelsSequentially(chat, ids, onResult) {
	const results = [];
	for (const [index, id] of ids.entries()) {
		const result = await probeOneModel(chat, id);
		results.push(result);
		onResult?.(result, index);
		if (result.verdict === "auth") break;
	}
	return results;
}
//#endregion
//#region src/usage.ts
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
const TRAE_PAY_BASE = "https://api.trae.cn";
function asNumber(value) {
	return typeof value === "number" && Number.isFinite(value) ? value : void 0;
}
/**
* Normalize an upstream epoch to milliseconds.
*
* The pack's `end_time` arrives in SECONDS while {@link TraeUsagePack.endTimeMs}
* names milliseconds. Measured against a live CN account: `1788340660` is
* 2026-09-02, and reading it as milliseconds would place the pack in 1970 — a
* date that sorts ahead of every real one and reads as "long expired". The
* magnitude test is the same one `auth.ts` applies to stored expiry fields, so
* an upstream that ever switches to milliseconds is passed through instead of
* being multiplied into the year 57000.
*/
function epochToMs(value) {
	if (value === void 0 || !Number.isFinite(value) || value <= 0) return 0;
	return value > 0xe8d4a51000 ? value : value * 1e3;
}
function parseUsageSnapshot(payload) {
	const summaryRaw = payload["usage_summary"];
	const summary = {
		totalAmount: asNumber(summaryRaw?.["total_amount"]) ?? 0,
		consumedAmount: asNumber(summaryRaw?.["consumed_amount"]) ?? 0,
		consumptionRatio: asNumber(summaryRaw?.["consumption_ratio"]) ?? 0
	};
	const trial = payload["trial_status"];
	const packs = [];
	const rawPacks = Array.isArray(payload["user_entitlement_pack_list"]) ? payload["user_entitlement_pack_list"] : [];
	for (const raw of rawPacks) {
		if (typeof raw !== "object" || raw === null) continue;
		const pack = raw;
		const base = pack["entitlement_base_info"];
		const quota = base?.["quota"];
		const usage = pack["usage"];
		const packageQuota = ((base?.["product_extra"])?.["package_extra"])?.["quota"];
		const creditsLimit = asNumber(packageQuota?.["credits_limit"]) ?? asNumber(quota?.["credits_limit"]);
		const consumedCredits = asNumber(usage?.["credits_amount"]);
		const availableEndpoint = asNumber(base?.["available_endpoint"]);
		packs.push({
			displayDesc: typeof pack["display_desc"] === "string" ? pack["display_desc"] : "",
			entitlementId: typeof base?.["entitlement_id"] === "string" ? base["entitlement_id"] : "",
			endTimeMs: epochToMs(asNumber(base?.["end_time"])),
			currency: asNumber(base?.["currency"]) ?? 0,
			...availableEndpoint === void 0 ? {} : { availableEndpoint },
			...creditsLimit === void 0 ? {} : { creditsLimit },
			...consumedCredits === void 0 ? {} : { consumedCredits }
		});
	}
	return {
		isCreditsBilling: payload["is_credits_billing"] === true,
		isDollarUsageBilling: payload["is_dollar_usage_billing"] === true,
		isPayFreshman: payload["is_pay_freshman"] === true,
		inTrial: trial?.["is_in_trial"] === true,
		trialEndTimeMs: asNumber(trial?.["trial_end_time"]) ?? 0,
		summary,
		packs
	};
}
/**
* A client for the verified Trae usage/credits endpoints.
*
* Every method is read-only except {@link TraeUsageClient.claimCheckin}, which
* claims the daily check-in reward — the one deliberate mutation, requested by
* the user from the card and guarded before it is sent.
*/
var TraeUsageClient = class {
	options;
	fetchImpl;
	baseUrl;
	timeoutMs;
	constructor(options) {
		this.options = options;
		this.fetchImpl = options.fetchImpl ?? fetch;
		this.baseUrl = options.baseUrl;
		this.timeoutMs = options.timeoutMs ?? 3e4;
	}
	/**
	* Region of the current credential; `cn` when unresolvable.
	*
	* A US credential throws {@link TraeUnsupportedRegionError} instead of being
	* rounded to the international bucket — issue #66: the rounding is what sent
	* a US token to the SG pay gateway, where the answer is 401.
	*/
	async currentRegion() {
		const credential = await this.options.credential();
		return credential === void 0 ? "cn" : assertSupportedRegion(regionOfCredential(credential));
	}
	/**
	* Pay base for the current credential's region. An explicit baseUrl (tests,
	* diagnostics) pins the endpoint; otherwise CN uses `api.trae.cn` and the
	* international region its own verified pay gateway.
	*/
	async payBase() {
		return this.baseUrl ?? REGION_GATEWAYS[await this.currentRegion()].pay;
	}
	/**
	* Device id for the check-in routes, or undefined when the machine's
	* installation identity cannot be read. Best-effort on purpose: a missing
	* identity must not break the read-only status query, which the upstream
	* answers with or without the header.
	*/
	async deviceIdHeader() {
		try {
			const deviceId = await this.options.deviceId?.();
			return deviceId === void 0 || deviceId === "" ? {} : { "x-device-id": deviceId };
		} catch {
			return {};
		}
	}
	async authedHeaders() {
		const credential = await this.options.credential();
		if (credential === void 0 || credential.accessToken === "") throw new Error("Trae credential is not available; cannot query usage");
		const origin = await this.currentRegion() === "ai" ? "https://www.trae.ai" : "https://www.trae.cn";
		return {
			"Authorization": `Cloud-IDE-JWT ${credential.accessToken}`,
			"Content-Type": "application/json",
			"User-Agent": "Mozilla/5.0",
			"Origin": origin,
			"Referer": `${origin}/`
		};
	}
	async post(path, data, signal, extraHeaders = {}) {
		const headers = {
			...await this.authedHeaders(),
			...extraHeaders
		};
		const response = await this.fetchImpl(`${await this.payBase()}${path}`, {
			method: "POST",
			headers,
			body: JSON.stringify(data),
			signal: signal ?? AbortSignal.timeout(this.timeoutMs)
		});
		if (!response.ok) throw new TraeHttpError(response.status, `Trae usage endpoint ${path} returned HTTP ${response.status}`);
		return await response.json();
	}
	/**
	* Subscription/pay status of an international (ai) account. The CN region
	* never calls this (its contract is unverified there); the ai region uses
	* this instead of the Work-credit `snapshot`.
	*/
	async payStatus(signal) {
		if (await this.currentRegion() !== "ai") throw new Error("Trae pay status is only available for the international (ai) region");
		const payload = await this.post("/trae/api/v1/pay/ide_user_pay_status", {}, signal);
		const flag = (key) => payload[key] === true;
		const trial = typeof payload["trial_status"] === "object" && payload["trial_status"] !== null ? payload["trial_status"] : {};
		const fissionStart = asNumber(payload["solo_fission_start_time"]);
		const fissionExpire = asNumber(payload["solo_fission_expire_time"]);
		const fissionMax = asNumber(payload["solo_fission_max_usage"]);
		const payIdentity = asNumber(payload["user_pay_identity"]);
		const payIdentityStr = typeof payload["user_pay_identity_str"] === "string" && payload["user_pay_identity_str"].trim() !== "" ? payload["user_pay_identity_str"].trim() : void 0;
		return {
			isDollarUsageBilling: flag("is_dollar_usage_billing"),
			hasPackage: flag("has_package"),
			isPayFreshman: flag("is_pay_freshman") || flag("is_pay_freshman_v2"),
			inTrial: trial["is_in_trial"] === true,
			trialEndTimeMs: asNumber(trial["trial_end_time"]) ?? 0,
			enableSoloLite: flag("enable_solo_lite"),
			enableSoloBuilder: flag("enable_solo_builder"),
			enableSoloCoder: flag("enable_solo_coder"),
			enableSoloWeb: flag("enable_solo_web"),
			...payIdentity === void 0 ? {} : { payIdentity },
			...payIdentityStr === void 0 ? {} : { payIdentityStr },
			...fissionStart === void 0 || fissionExpire === void 0 || fissionMax === void 0 ? {} : { fission: {
				startTimeMs: fissionStart,
				expireTimeMs: fissionExpire,
				maxUsage: fissionMax
			} }
		};
	}
	/**
	* The Work-credit endpoints are CN-only. The international region is
	* subscription-based and must read {@link payStatus} instead; guarding here
	* keeps the card's degraded `creditsError` message diagnosable rather than
	* letting an ai credential hit an unverified path on its pay gateway.
	*/
	async requireCnRegion(method) {
		if (await this.currentRegion() !== "cn") throw new Error(`Trae ${method} is only available for the CN region; the international (ai) region uses payStatus`);
	}
	/** Total entitlements / credits and per-pack breakdown. */
	async snapshot(signal) {
		await this.requireCnRegion("usage snapshot");
		return parseUsageSnapshot(await this.post("/trae/api/v2/pay/web_user_ent_usage", { require_usage: true }, signal));
	}
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
	async checkinStatus(signal) {
		await this.requireCnRegion("check-in status");
		const headers = await this.deviceIdHeader();
		const payload = await this.post("/trae/api/v2/ug/checkin_credits/status", {}, signal, headers);
		const extraCredits = asNumber(payload["extra_credits"]);
		return {
			checkedIn: payload["checked_in"] === true,
			credits: asNumber(payload["credits"]) ?? 0,
			enabled: payload["enable"] !== false,
			didCheckedIn: payload["did_checked_in"] === true,
			...extraCredits === void 0 || extraCredits <= 0 ? {} : { extraCredits }
		};
	}
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
	async claimCheckin(signal) {
		await this.requireCnRegion("check-in claim");
		const headers = await this.deviceIdHeader();
		const payload = await this.post("/trae/api/v2/ug/checkin_credits/claim", {}, signal, headers);
		const code = asNumber(payload["code"]) ?? 0;
		return {
			claimed: code === 0,
			code,
			message: typeof payload["message"] === "string" ? payload["message"].slice(0, 200) : ""
		};
	}
	/** Rewards / activity rules. */
	async activities(signal) {
		await this.requireCnRegion("activities");
		const payload = await this.post("/trae/api/v2/ug/activity/info", {}, signal);
		const rawActivities = Array.isArray(payload["commercial_activities"]) ? payload["commercial_activities"] : [];
		const activities = [];
		for (const raw of rawActivities) {
			if (typeof raw !== "object" || raw === null) continue;
			const rule = raw;
			activities.push({
				activityId: typeof rule["activity_id"] === "string" ? rule["activity_id"] : "",
				enabled: rule["Enabled"] === true,
				activityType: asNumber(rule["activity_type"]) ?? 0,
				startTimeMs: asNumber(rule["start_time_ms"]) ?? 0,
				endTimeMs: asNumber(rule["end_time_ms"]) ?? 0,
				...rule["work_extra"] === void 0 ? {} : { workExtra: rule["work_extra"] }
			});
		}
		return activities;
	}
	/** Convenience: snapshot + check-in + activities in one call (best-effort, non-fatal on missing). */
	async view(signal) {
		const [snapshot, checkin, activities] = await Promise.all([
			this.snapshot(signal),
			this.checkinStatus(signal),
			this.activities(signal)
		]);
		return {
			snapshot,
			checkin,
			activities
		};
	}
};
//#endregion
//#region src/account-pool.ts
/**
* How long an account stays out of the pool when the upstream stated no time.
*
* A conservative FALLBACK, not a measurement: it applies whenever a failed
* outcome carries no `retryAtMs` — every rate limit that came without a reset
* sentence AND every transient failure (a transport error, a 5xx). In both cases
* "when can I use this again" has no honest answer.
*
* The two failure directions it avoids: keeping the account in the pool would
* re-bill it immediately and re-trip the same limit; dropping it FOREVER would
* discard a working account over an event that said nothing about it. A short,
* stated cooldown is the least-wrong of the two — and it is what lets the pool
* heal itself, since nothing else re-probes an excluded member.
*/
const POOL_UNKNOWN_COOLDOWN_MS = 18e5;
/**
* Whether one account can be billed at `nowMs`.
*
* Returns the exclusion reason, or undefined when the account is a candidate.
* The order matters and is NOT arbitrary:
*
* - A `credential-rejected` account is excluded regardless of any cooldown: its
*   token is not accepted, so waiting cannot help and the user must re-auth.
*   (`401` / `403` from Trae, and the `ExchangeToken` rejection of an expired
*   refresh token, land here.)
* - A limited, unreachable or failed outcome is checked against its stated (or
*   fallback) cooldown, so an account whose limit has already reset — or whose
*   gateway blipped once — is back in the pool without needing another test.
* - An `ok` measurement, and no measurement at all, are both candidates. The
*   latter matters: a freshly discovered account has never been tested and must
*   not be invisible.
*
* `not-found`, `credential-rejected` and `plan-gated` deliberately get NO
* cooldown: one describes a model this channel does not serve (a catalog fact),
* one needs the user to sign in again, and one needs a plan change. None is fixed
* by waiting, and pretending otherwise would re-bill a state the upstream has
* already refused.
*
* `policy-rejected` is NOT the `default` branch: a content-policy refusal is a
* fact about ONE REQUEST, not about the account, so the account stays a candidate
* exactly like `ok`. The measurement is still recorded so the card can explain
* what happened.
*
* An outcome this build does not know becomes `unusable` rather than a candidate:
* billing through a state we cannot interpret is worse than leaving the account
* out until a later version explains it.
*/
function exclusionOf(probe, nowMs) {
	if (probe === void 0) return void 0;
	switch (probe.outcome) {
		case "ok": return;
		case "credential-rejected": return "credential-rejected";
		case "not-found": return "not-found";
		case "plan-gated": return "plan-gated";
		case "unavailable": return retryDue(probe, nowMs) ? void 0 : "unavailable";
		case "failed": return retryDue(probe, nowMs) ? void 0 : "failed";
		case "rate-limited": return retryDue(probe, nowMs) ? void 0 : "rate-limited";
		case "model-busy": return retryDue(probe, nowMs, 12e4) ? void 0 : "model-busy";
		case "out-of-credit": return retryDue(probe, nowMs) ? void 0 : "out-of-credit";
		case "policy-rejected": return;
		default: return "unusable";
	}
}
/**
* Whether an account's cooldown has elapsed (or was never stated).
*
* The fallback is the ONLY thing a transient outcome relies on: `retryAtMs` is
* attached for a rate limit or a drained quota, never for a transport failure, so
* `atMs + POOL_UNKNOWN_COOLDOWN_MS` is what brings those back.
*
* `fallbackMs` lets one outcome carry a SHORTER clock than the generic one. It is
* a parameter rather than a second function so every outcome shares one definition
* of "due".
*/
function retryDue(probe, nowMs, fallbackMs = POOL_UNKNOWN_COOLDOWN_MS) {
	return nowMs >= (probe.retryAtMs ?? probe.atMs + fallbackMs);
}
/**
* Rank a pool's members best-first.
*
* The rule, in priority order — this is the whole feature:
*
* 1. **Usability.** Only accounts that can be billed right now are candidates;
*    they always outrank every excluded one.
* 2. **Expiring credits first, soonest first.** Points about to expire are worth
*    exactly zero after they do, so spending them before they lapse is strictly
*    better than saving them.
* 3. **Largest expiring amount.** Between two accounts that both have expiring
*    points, the one with more at risk goes first.
* 4. **Credits, highest first.** Among accounts with nothing expiring, spend the
*    one with the most, so a nearly-drained account is conserved.
* 5. **Freshest credential.** Tie-break so a stale token never wins a draw.
* 6. **Account id.** Final tie-break, making the order TOTAL: two accounts equal on
*    every key would otherwise keep the caller's array order, so the same pool
*    could rotate differently between two runs.
*
* WHY EXPIRY OUTRANKS SIZE (workbuddy issue #70). These used to be strict
* lexicographic keys: total, THEN expiry. Since totals are almost never exactly
* equal, the expiry rule was unreachable — an account with 196 points lapsing that
* day ranked LAST behind accounts that expire weeks later, simply because it held
* ~1,200 fewer points overall. It was never selected, so those points always
* lapsed. A "use it or lose it" rule that another rule completely shadows is not a
* tie-break, it is dead code.
*
* WHY SPENDING THE SMALL EXPIRING ACCOUNT IS STILL RIGHT. Credits are fungible, so
* using the rich account instead does not preserve the 1 point — it spends the 1
* point's chance and loses it. Using the expiring account spends a point that was
* going to be lost anyway, and the rich account is still there for the next
* request. The only real cost is a failover round-trip if the expiring account
* cannot cover a whole request, which the exclusion/failover path already absorbs.
*
* Excluded accounts are still RETURNED (sorted after the candidates) so the card
* can explain why each is out; they differ from candidates by `excludedBy` being
* set, never by being silently dropped.
*
* Pure and total: the same input always yields the same order, and it never throws
* on missing data (an account with no credits is ranked as 0, not crashed on).
*/
function rankPool(members, nowMs) {
	const rows = members.map((member) => {
		const excludedBy = exclusionOf(member.probe, nowMs);
		return {
			account: member.account,
			score: scoreOf(member),
			...excludedBy === void 0 ? {} : { excludedBy },
			_usable: excludedBy === void 0,
			_atRisk: (member.credits?.expiringSoon ?? 0) > 0,
			_expiringAmount: member.credits?.expiringSoon ?? 0,
			_expiring: member.credits?.nearestExpiryMs ?? Number.POSITIVE_INFINITY,
			_tokenExpiresAtMs: member.tokenExpiresAtMs ?? 0
		};
	});
	rows.sort((left, right) => {
		if (left._usable !== right._usable) return left._usable ? -1 : 1;
		if (left._atRisk !== right._atRisk) return left._atRisk ? -1 : 1;
		if (left._atRisk && right._atRisk && left._expiring !== right._expiring) return left._expiring - right._expiring;
		if (left._expiringAmount !== right._expiringAmount) return right._expiringAmount - left._expiringAmount;
		if (left.score !== right.score) return right.score - left.score;
		if (left._tokenExpiresAtMs !== right._tokenExpiresAtMs) return right._tokenExpiresAtMs - left._tokenExpiresAtMs;
		return left.account.id < right.account.id ? -1 : left.account.id > right.account.id ? 1 : 0;
	});
	return rows.map(({ account, score, excludedBy }) => ({
		account,
		score,
		...excludedBy === void 0 ? {} : { excludedBy }
	}));
}
/**
* The checked ids that still resolve to a local sign-in, in the caller's order.
*
* This is THE definition of "effective members". It exists because the same
* predicate wants to be written in several places (the status document, the batch
* route's empty-pool guard, the host dependency the card reads) and "fixed one
* end, missed the other" is this project's most productive bug shape, so the rule
* has one home and every site delegates to it.
*
* ORDER IS THE CALLER'S: the answer preserves the order of `orderedIds`. Callers
* pass whichever list's order they want to show — the saved list for the user's
* own order, the store's roster for the account table's.
*/
function effectiveMembersOf(orderedIds, listedIds) {
	return orderedIds.filter((id) => listedIds.has(id));
}
/**
* The members that may actually be billed, in the store's order.
*
* Three rules in one place, because a request path and a batch that each decide
* "who counts" separately is how a pool ends up billing an account the user did
* not opt into:
*
* - the SAVED opt-in list is the roster (`effectiveMembersOf` — an id the user
*   never selected, or one this machine no longer has, is not a candidate);
* - `triedIds` are the accounts that already failed THIS request, so a failover
*   never walks back into the one that just refused it;
* - a ghost (saved but not listed) is absent from `members`, so it drops out here
*   without a second check.
*
* An EMPTY `savedIds` yields an empty result on purpose: an enabled pool with no
* members bills nobody, rather than silently meaning "all of them".
*/
function billableMembers(members, savedIds, triedIds = []) {
	const saved = new Set(effectiveMembersOf(savedIds, new Set(members.map((member) => member.account.id))));
	const tried = new Set(triedIds);
	return members.filter((member) => saved.has(member.account.id) && !tried.has(member.account.id));
}
/**
* The account to bill, or undefined when the pool has no usable member.
*
* A thin selector over {@link rankPool} so the winner is decided in exactly one
* place: every caller that needs "who serves now" gets the same answer.
*/
function pickAccount(members, nowMs) {
	return rankPool(members, nowMs).find((row) => row.excludedBy === void 0)?.account;
}
/**
* The credit figure used for ordering.
*
* Absent credits rank as zero. Deliberately NOT "unknown ranks first": an account
* whose balance could not be read must never outrank one we positively know is
* full, or a failing credit read would capture all the traffic.
*/
function scoreOf(member) {
	return member.credits?.total ?? 0;
}
/**
* Pick the free model to test against, from one panel's catalog.
*
* "Free" means `creditMultiplier === 0` EXACTLY. An absent multiplier is NOT free:
* the CN static fallback catalog carries no multiplier at all, so treating absence
* as zero would silently bill real credits on a "free" probe.
*
* Among the free candidates the LARGEST context window wins, because the probe
* sends a real payload and a long-conversation probe is the point.
*
* Returns undefined when the panel has no free model, which the caller must render
* as "none available" — never as a fallback to a paid model.
*/
function pickFreeModel(catalog) {
	let best;
	for (const model of catalog) {
		if (model.creditMultiplier !== 0) continue;
		if (best === void 0 || (model.contextWindow ?? 0) > (best.contextWindow ?? 0)) best = model;
	}
	return best;
}
/**
* Resolve the model the pool should test against.
*
* A user-specified id always wins (it is a preference, not a computed default) and
* is returned even when it is a PAID model: the card says so explicitly rather than
* silently overriding the user's choice.
*
* The choice is VALIDATED against the panel's catalog, because the catalog changes:
* the CN roster is empty until its first refresh, and models come and go. A saved
* id that is no longer offered used to be returned as `preferred`, which let the
* card enable its test button and the host run a batch against a model nobody
* offers. It is reported as `stale` instead — never silently replaced by the free
* model (that would test something the user did not choose) and never run.
*/
function resolveTargetModel(catalog, preferredId) {
	if (preferredId !== void 0 && preferredId !== "") return catalog.some((model) => model.id === preferredId) ? {
		modelId: preferredId,
		source: "preferred"
	} : {
		staleModelId: preferredId,
		source: "stale"
	};
	const free = pickFreeModel(catalog);
	return free === void 0 ? { source: "none" } : {
		modelId: free.id,
		source: "free"
	};
}
/**
* Map one Trae probe verdict onto the pool's outcome vocabulary.
*
* The mapping is the whole bridge between `src/model-probe.ts` (which answers a
* QUESTION ABOUT A MODEL) and the pool (which must decide a FACT ABOUT AN ACCOUNT),
* so every row states which side it is reading:
*
*  - `available`      → `ok`.
*  - `auth`           → `credential-rejected`: 401/403 means THIS token is refused;
*    waiting cannot help and the user must sign in again.
*  - `gated` (`1005`) → `plan-gated`: the account's plan does not cover this model,
*    which is an ACCOUNT fact (a paying account may pass) but not one that heals on
*    a clock.
*  - `rate_limited`   → `rate-limited`: `4011` or an honest 429 — transient by
*    definition, so it cools down rather than leaving the pool forever.
*  - `unsupported`    → `not-found`: `4001` says no SOLO function serves this
*    `config_name`. It is MODEL-scoped, so the recorded `modelId` is what keeps the
*    row honest, and nothing about the account changes by waiting.
*  - `unknown`        → `failed`: a timeout, a transport error or a proxy problem.
*    It cools down (it is not a statement about the account) and carries the
*    upstream text so the user can retest.
*
* There is deliberately NO Trae source for `model-busy`, `out-of-credit` and
* `policy-rejected` in this table — they are produced by the live-request path
* (`src/account-pool.ts` has no network), from `4008` (quota exhausted) and from a
* content refusal. A verdict NOT in this table falls through to `failed`, so a new
* upstream verdict can never silently mean "healthy".
*/
function outcomeOfVerdict(verdict) {
	switch (verdict) {
		case "available": return "ok";
		case "auth": return "credential-rejected";
		case "gated": return "plan-gated";
		case "rate_limited": return "rate-limited";
		case "unsupported": return "not-found";
		default: return "failed";
	}
}
/**
* Which pool a panel's members belong to, for the on-disk probe store and the
* `pool` settings slot.
*
* `enterprise` is its OWN bucket even though it shares the CN credential store:
* an account that serves the personal SOLO channel says nothing about whether it
* passes the tenant gate (`4019` is only revealed at the first chat), so measuring
* one must not silently answer the other.
*/
function poolKeyOfPanel(panel) {
	return panel;
}
/**
* WHY THERE IS NO SCHEDULER HERE.
*
* Like the reference implementation, this module carries no timer: rotation is a
* PERSISTENT change of who pays while failover is a PER-REQUEST borrow of another
* account, and having both with an automatic re-test on a clock made "who is being
* billed right now" unanswerable on one card. Recovery is expressed as the cooldown
* in {@link exclusionOf} instead, which needs no timer: it is evaluated at ranking
* time, so a cooled-down member simply becomes a candidate again on the next
* request.
*/
//#endregion
//#region src/transfer.ts
/**
* Account transfer: the export / import file format shared with sibling
* credential managers for the same upstream (dsh-connect-workbuddy ships the
* identical contract so export files interoperate).
*
* 参考：通行实现 —— 文件是一个 JSON 数组，每项为一条凭据记录，顶层字段
*   snake_case（`access_token` / `refresh_token` / `uid` / `nickname` /
*   `email` / `domain` / `expiresAt`(ms) / `refreshExpiresAt`(ms) /
*   `auth_raw`），导入按 account id 去重（同 id 覆盖），缺 `access_token`
*   的记录跳过；预览只回脱敏字段（含 `hasToken` 布尔量），不回明文。解析
*   函数不依赖文件系统，便于无 UI 环境单测；落库由 Host 侧的 store 完成。
*
* 互通 / 单位边界：`expiresAt` 一族按契约是**毫秒**。workbuddy 的 vault 文档
*   存的是秒，需要在导出/导入边界换算；trae 的 `TraeCredential.expiresAtMs`
*   （见 auth.ts 的 `timeToMs`）**本身就是毫秒**，所以这里**不做任何
*   乘除**——刻意与 workbuddy 不同，读者对比两文件时不要误以为换算被漏掉了。
*   导出时 `auth_raw` 直接携带原始认证文档（桌面 storage 文档或 `{auth,
*   account}` 双键块），供写入桌面认证文件的工具原样消费。
*
* @module dsh-connect-trae/transfer
*/
/**
* Parse transfer-file text: a JSON array, every element an object.
*
* The error strings carry the position (1-based item number) because a file
* from another tool can be big, and "第 N 项" is what lets the user find the
* broken record in their editor.
*/
function parseTransferFile(text) {
	if (text.trim() === "") throw new Error("transfer file is empty");
	let parsed;
	try {
		parsed = JSON.parse(text);
	} catch (error) {
		throw new Error("transfer file is not valid JSON: " + (error instanceof Error ? error.message : String(error)));
	}
	if (!Array.isArray(parsed)) throw new Error("transfer file must be a JSON array of account records");
	for (const [index, item] of parsed.entries()) if (typeof item !== "object" || item === null || Array.isArray(item)) throw new Error("transfer file item " + (index + 1) + " is not an account object");
	return parsed;
}
/** One string field of a record, tolerating the sibling format's odd shapes. */
function displayString(value) {
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	return "";
}
/** Whether a record carries a usable token (a non-empty string). */
function hasToken(record) {
	const token = record["access_token"];
	return typeof token === "string" && token !== "";
}
/**
* The transfer file's desensitized preview: display fields only.
*
* Fields come from EXTERNAL files, so a display field may hold an object or an
* array (a sibling tool can store the desktop app's encrypted-wrapper nickname
* verbatim); every preview field is normalized to a string or emptied rather
* than letting a non-renderable value reach the card.
*/
function previewTransferFile(text) {
	const records = parseTransferFile(text);
	return {
		accounts: records.map((record, index) => ({
			index,
			uid: displayString(record["uid"]),
			nickname: displayString(record["nickname"]),
			email: displayString(record["email"]),
			hasToken: hasToken(record)
		})),
		total: records.length
	};
}
/**
* Positive-match region claim for an IMPORTED record: the record's own
* `userRegion` claim wins, the host suffix is the fallback, and anything
* unrecognised (empty, misspelt, or other-region) yields `undefined` — never a
* default.
*
* This is the security-critical difference from `regionOfCredential`, which
* classifies anything unrecognised as `cn` as a last resort (via the edition
* label). That fallback is right for upstream-sourced data, whose host/region
* came out of the real Trae install, but wrong for an import whose values are
* simply whatever the file's author wrote: a spoofed or misspelt `domain`
* would otherwise be admitted into the CN vault and cross-bill the CN provider
* stack with a credential that belongs to no real CN account. So this helper
* reuses `regionOfUserRegion` / `regionOfHost` — both of which already return
* `undefined` on unrecognised input — and deliberately does NOT consult the
* edition fallback. A US claim (`userRegion: "US"` or a `*.traeapi.us` host)
* therefore resolves to `us` and matches neither importable region, so that
* record is skipped like any other foreign one (issue #66).
*/
function knownRegionOfCredential(credential) {
	return regionOfUserRegion(credential.userRegion) ?? regionOfHost(credential.host);
}
/**
* Project one credential into the shared transfer record shape.
*
* `expiresAt` / `refreshExpiresAt` are emitted in epoch MILLISECONDS — the
* transfer contract's unit. Unlike workbuddy — whose vault stored seconds and
* had to convert here — trae's `expiresAtMs` is already milliseconds, so the
* value is carried through verbatim (documented above; do not rescale).
* `auth_raw` carries the original auth document so a tool that writes desktop
* auth files can consume it verbatim.
*/
function traeTransferRecordOf(credential, authRawDocument) {
	return {
		access_token: credential.accessToken,
		...credential.refreshToken !== void 0 && credential.refreshToken !== "" ? { refresh_token: credential.refreshToken } : {},
		...credential.userId !== "" ? { uid: credential.userId } : {},
		...credential.accountName !== void 0 ? { nickname: credential.accountName } : {},
		...credential.host !== "" ? { domain: credential.host } : {},
		...credential.expiresAtMs > 0 ? { expiresAt: credential.expiresAtMs } : {},
		...credential.refreshExpiresAtMs === void 0 ? {} : { refreshExpiresAt: credential.refreshExpiresAtMs },
		auth_raw: authRawDocument
	};
}
/** The `userId` claim from a record: the flat `uid`, else recovered from `auth_raw`. */
function userIdOfRaw(record) {
	const flat = displayString(record["uid"]);
	if (flat !== "") return flat;
	const root = rawRoot(record["auth_raw"]);
	if (root === void 0) return "";
	return displayString(root["userId"]) ?? "";
}
/** The `accountName` claim: the flat `nickname`, else recovered from `auth_raw`. */
function accountNameOfRaw(record) {
	const flat = displayString(record["nickname"]);
	if (flat !== "") return flat;
	const root = rawRoot(record["auth_raw"]);
	if (root === void 0) return void 0;
	const fromAccount = displayString((typeof root["account"] === "object" && root["account"] !== null ? root["account"] : void 0)?.["username"]);
	if (fromAccount !== "") return fromAccount;
	return displayString(root["username"]);
}
/** The raw `userRegion` claim string from `auth_raw` (object `{region}` or bare value). */
function userRegionOfRaw(raw) {
	const root = rawRoot(raw);
	if (root === void 0) return void 0;
	const value = root["userRegion"];
	const claim = typeof value === "object" && value !== null && !Array.isArray(value) ? value["region"] : value;
	return typeof claim === "string" && claim.trim() !== "" ? claim.trim() : void 0;
}
/**
* A record's `auth_raw` root, tolerating both the nested `{auth, account}` block
* this plugin exports and a raw desktop storage document: `account` may be a
* sub-object (the block shape) or absent (flat document shape).
*/
function rawRoot(raw) {
	if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return void 0;
	return raw;
}
/**
* Edition derived from an imported record's `domain` host, positively.
*
* The shared transfer format has no edition field (only `domain`), so a
* re-import must re-derive the routing label from the host. Only the two base
* editions are ever assigned — a flat `domain` + `uid` cannot distinguish the
* SOLO variants — so this is inherently lossy for SOLO accounts; that is
* acceptable because the region gate (see `mergeTransferRecords`) never
* consults edition, and the account id's edition component only affects whether
* a re-imported account converges on the same stored id (which it does as long
* as the host is positively classified).
*/
function editionOfDomain(host) {
	const region = regionOfHost(host);
	if (region === "ai") return "sg";
	if (region === "cn") return "cn";
}
/**
* Project one transfer record into a credential, or undefined when the record
* carries no token (the importer's skip rule).
*
* `userId` empty is tolerated at THIS layer because a token-only record still
* describes a usable credential; the Host's region gate decides whether it is
* representable, and the store's account id (`edition \0 userId || accountName`)
* decides whether it is addressable. An unopenable `auth_raw` is ignored — the
* flat fields are the contract, `auth_raw` is extra fidelity for the write-back
* path.
*
* `edition` is restored positively from the domain host (see `editionOfDomain`),
* defaulting to `cn` ONLY as a neutral placeholder when the host is not
* classifiable — this is safe because the region gate never consults edition,
* and such a record is always `skipped` there before edition could matter.
*/
function credentialOfTransferRecord(record) {
	const accessToken = record["access_token"];
	if (typeof accessToken !== "string" || accessToken === "") return void 0;
	const refreshToken = typeof record["refresh_token"] === "string" ? record["refresh_token"] : "";
	const expiresAtMs = typeof record["expiresAt"] === "number" && Number.isFinite(record["expiresAt"]) && record["expiresAt"] > 0 ? record["expiresAt"] : 0;
	const refreshExpiresAtMs = typeof record["refreshExpiresAt"] === "number" && Number.isFinite(record["refreshExpiresAt"]) && record["refreshExpiresAt"] > 0 ? record["refreshExpiresAt"] : void 0;
	const userId = userIdOfRaw(record);
	const accountName = accountNameOfRaw(record);
	const host = typeof record["domain"] === "string" ? record["domain"] : "";
	const edition = editionOfDomain(host) ?? "cn";
	const userRegion = userRegionOfRaw(record["auth_raw"]);
	return {
		accessToken,
		...refreshToken === "" ? {} : { refreshToken },
		userId,
		...accountName === void 0 ? {} : { accountName },
		host,
		...userRegion === void 0 ? {} : { userRegion },
		expiresAtMs,
		...refreshExpiresAtMs === void 0 ? {} : { refreshExpiresAtMs },
		edition
	};
}
/** Default gate so the merge is secure even when the caller omits the judge. */
const defaultRegionJudge = knownRegionOfCredential;
/**
* Pure merge: fold selected records into a CHANGES map keyed by account id.
*
* Mirrors the sibling merger's contract: a record with the same account id
* OVERWRITES the stored entry (the imported tokens replace what is stored —
* re-importing a re-login must refresh it; the write layer stores the record
* atomically, so "overwrite" needs no knowledge of the incumbent), and a
* record without a token is skipped. The region gate lives HERE rather than in
* the route so it is testable without a Host.
*
* The region gate is a POSITIVE match: a record is kept only when its OWN
* region claim is positively known to equal the target region. `regionOfCredential`
* classifies anything unrecognised as `cn`, which is fine for upstream-sourced
* data but WRONG for an imported file whose host/region are author-controlled —
* a spoofed or misspelt value would otherwise be admitted into the CN vault.
* Here the injected `knownRegionOfCredential` (defaulting to the exported
* positive-match helper, which never consults the edition fallback) returns
* `undefined` for an empty, unrecognised, or other-region claim, and such a
* record counts as `skipped` rather than being silently imported cross-region.
*
* The caller writes one store file per map entry, so a selection that is
* already stored rewrites those files with identical content — idempotent,
* and the steady state of importing the same file twice.
*/
function mergeTransferRecords(records, indexes, region, knownRegionOfCredential = defaultRegionJudge) {
	const changes = /* @__PURE__ */ new Map();
	let imported = 0;
	let skipped = 0;
	for (const index of indexes) {
		const record = records[index];
		if (record === void 0) {
			skipped += 1;
			continue;
		}
		const credential = credentialOfTransferRecord(record);
		if (credential === void 0) {
			skipped += 1;
			continue;
		}
		if (knownRegionOfCredential(credential) !== region) {
			skipped += 1;
			continue;
		}
		const id = traeAccountId(credential);
		changes.set(id, credential);
		imported += 1;
	}
	return {
		changes,
		imported,
		skipped
	};
}
//#endregion
//#region src/web-status.ts
/**
* The upstream's business code for "该设备今日已参与签到" — this DEVICE already
* used today's check-in (measured 2026-09-26 on a CN account whose claim was
* refused with exactly this code after an account switch on the same machine).
*
* It arrives as HTTP 200 with a non-zero `code`, which is why it has to be
* matched on the code rather than on the HTTP status: read as a transport
* failure it looks like the plugin is broken, when the day is simply spent.
*/
const CHECKIN_DEVICE_ALREADY_CLAIMED$1 = 9095;
/** Redact token-like content before it crosses to the browser. */
function safeMessage(error) {
	return (error instanceof Error ? error.message : String(error)).replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/gu, "[redacted token]").replace(/(\b(?:code|token|refresh_token|access_token)=)[^&\s]+/giu, "$1[redacted]").slice(0, 500);
}
function json(res, status, body) {
	const payload = JSON.stringify(body);
	res.writeHead(status, {
		"Content-Type": "application/json",
		"Content-Length": Buffer.byteLength(payload)
	});
	res.end(payload);
}
/**
* Answer a failed route with the meaning the failure actually has (issue #66).
*
* The old rule was `json(res, 500, { error })` everywhere, so a US credential
* sent to the Singapore gateway surfaced as `HTTP 500
* {"error":"SOLO remote models returned HTTP 401"}`: the status said "the
* plugin is broken" while the text said "the gateway refused you". The client
* could not tell "sign in again" from "this region is unsupported", which is
* exactly the loop the issue reports. `httpFailureOf` keeps an upstream 401/403
* as 401/403 and turns the local "not served" verdict into 501 +
* `unsupported-region`; everything else stays 500.
*/
function failJson(res, error) {
	const failure = httpFailureOf(error);
	json(res, failure.status, {
		error: safeMessage(error),
		...failure.code === void 0 ? {} : { code: failure.code }
	});
}
/** Bound on how many OTHER accounts one status read may probe (issue #25). */
const TRAE_CREDIT_ALTERNATIVE_LIMIT = 8;
/**
* Read the ids to test from a POST body.
*
* Only ids present in the region's live catalog are accepted downstream (see
* index.ts), so this reader only has to produce a bounded, string-only list.
*/
async function readModelTestBody(req) {
	const chunks = [];
	let size = 0;
	for await (const chunk of req) {
		const buffer = chunk;
		size += buffer.byteLength;
		if (size > 65536) throw new Error("request body too large");
		chunks.push(buffer);
	}
	const text = Buffer.concat(chunks).toString("utf8").trim();
	if (text === "") return [];
	let parsed;
	try {
		parsed = JSON.parse(text);
	} catch {
		throw new Error("invalid JSON body");
	}
	const raw = typeof parsed === "object" && parsed !== null ? parsed["ids"] : void 0;
	if (!Array.isArray(raw)) throw new Error("body must carry an ids array");
	const ids = [];
	for (const value of raw) {
		if (typeof value !== "string") continue;
		const id = value.trim();
		if (id !== "" && !ids.includes(id)) ids.push(id);
	}
	return ids;
}
/**
* Read the accountId a per-account route needs from a POST body. A bounded,
* single-string reader — the same families of guards the model-test body uses,
* because the claim route here is a state-changing endpoint.
*/
async function readAccountBody(req) {
	const chunks = [];
	let size = 0;
	for await (const chunk of req) {
		const buffer = chunk;
		size += buffer.byteLength;
		if (size > 16384) throw new Error("request body too large");
		chunks.push(buffer);
	}
	const text = Buffer.concat(chunks).toString("utf8").trim();
	if (text === "") throw new Error("empty body");
	let parsed;
	try {
		parsed = JSON.parse(text);
	} catch {
		throw new Error("invalid JSON body");
	}
	const accountId = typeof parsed === "object" && parsed !== null ? parsed["accountId"] : void 0;
	if (typeof accountId !== "string" || accountId.trim() === "") throw new Error("body must carry an accountId string");
	return accountId.trim();
}
/**
* Read a transfer-file POST body: the raw file TEXT plus the record indexes the
* user selected, or (for `export`) the account ids to include.
*
* The ceiling is much larger than the other readers' because this body IS a
* user-chosen file rather than a couple of ids — a credential export from a
* sibling tool can legitimately be hundreds of kilobytes. It is still bounded so
* a malformed or hostile request cannot make the Host buffer without limit.
*/
async function readTransferBody(req) {
	const chunks = [];
	let size = 0;
	for await (const chunk of req) {
		const buffer = chunk;
		size += buffer.byteLength;
		if (size > 4194304) throw new Error("request body too large");
		chunks.push(buffer);
	}
	const text = Buffer.concat(chunks).toString("utf8").trim();
	if (text === "") return {};
	let parsed;
	try {
		parsed = JSON.parse(text);
	} catch {
		throw new Error("invalid JSON body");
	}
	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("body must be a JSON object");
	return parsed;
}
/** Loopback browser origins only; other devices are refused until trusted origins exist. */
function loopbackOrigin(req) {
	const origin = req.headers.origin;
	if (origin === void 0) return true;
	try {
		const { hostname } = new URL(origin);
		return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || hostname === "::1";
	} catch {
		return false;
	}
}
/**
* Whether a pack's expiry is one the card can actually use.
*
* One predicate, shared by the per-pack projection and the bucket summary, so
* the two can never disagree about which packs count as dated. `0` and the
* non-finite values are excluded: a `0` here would read as 1970 and sort ahead
* of every real date, and `NaN`/`Infinity` are not dates at all.
*/
function usableExpiry(endTimeMs) {
	return typeof endTimeMs === "number" && Number.isFinite(endTimeMs) && endTimeMs > 0;
}
/**
* Map the credit snapshot to the card's compact credit document.
*
* Exported so the "is another account usable?" probe (issue #25) derives its
* two buckets through the SAME endpoint classification the bound account uses
* — a second implementation of the Work/general split would be free to disagree
* with the number shown next to it.
*/
function toCredits(snapshot, nowMs = Date.now()) {
	const { totalAmount, consumedAmount } = snapshot.summary;
	const credit = (value) => Math.round(value * 1e4) / 1e4;
	const accounts = snapshot.packs.map((pack) => ({
		displayDesc: pack.displayDesc,
		remain: credit(Math.max(0, (pack.creditsLimit ?? 0) - (pack.consumedCredits ?? 0))),
		size: pack.creditsLimit ?? 0,
		...usableExpiry(pack.endTimeMs) ? { expiresAtMs: pack.endTimeMs } : {},
		...pack.availableEndpoint === void 0 ? {} : { endpoint: pack.availableEndpoint }
	}));
	const remaining = (endpoint) => snapshot.packs.filter((pack) => pack.availableEndpoint === endpoint).reduce((sum, pack) => credit(sum + Math.max(0, (pack.creditsLimit ?? 0) - (pack.consumedCredits ?? 0))), 0);
	return {
		total: totalAmount,
		consumed: consumedAmount,
		available: totalAmount - consumedAmount,
		workAvailable: remaining(1),
		generalAvailable: remaining(0),
		accounts,
		...summarisePackExpiry(accounts, nowMs)
	};
}
/** Empty bucket, used whenever no pack qualifies. */
const NO_EXPIRING_CREDIT = {
	total: 0,
	packs: 0
};
/**
* Sum the credit lapsing inside `horizonMs` of `nowMs`.
*
* Only positive balances count: a lapsed pack with nothing left is not a loss,
* and including it would make every long-lived account look permanently at
* risk. Only *future* expiries count too — see {@link expiredPacks}.
*/
function expiringWithin(packs, nowMs, horizonMs) {
	return sumExpiring(packs, (expiresAt) => expiresAt > nowMs && expiresAt - nowMs <= horizonMs);
}
/**
* Sum the credit whose pack has already lapsed but still carries a balance.
*
* Kept apart from {@link expiringWithin} because a lapsed pack satisfies every
* forward-looking horizon at once (`expiresAt - now` is negative, hence "within
* 24 hours"), which would make a long-dead pack look permanently imminent.
*/
function expiredPacks(packs, nowMs) {
	return sumExpiring(packs, (expiresAt) => expiresAt <= nowMs);
}
/** Shared accumulator over packs whose expiry passes `matches`. */
function sumExpiring(packs, matches) {
	let total = 0;
	let count = 0;
	let earliestExpiresAtMs;
	for (const pack of packs) {
		const expiresAt = pack.expiresAtMs;
		if (!usableExpiry(expiresAt) || pack.remain <= 0) continue;
		if (!matches(expiresAt)) continue;
		total += pack.remain;
		count += 1;
		if (earliestExpiresAtMs === void 0 || expiresAt < earliestExpiresAtMs) earliestExpiresAtMs = expiresAt;
	}
	if (count === 0) return NO_EXPIRING_CREDIT;
	return {
		total,
		packs: count,
		...earliestExpiresAtMs === void 0 ? {} : { earliestExpiresAtMs }
	};
}
/**
* Bucket the card's credit by how soon it lapses.
*
* Returns no `expiry` at all when not one pack carried a usable end time, so a
* caller can tell "nothing is expiring" apart from "we were never told when
* anything expires" — the second must not render as reassurance. Uses the same
* {@link usableExpiry} predicate as the per-pack projection, so a summary is
* never produced from a set of dates the card itself would not carry.
*/
function summarisePackExpiry(accounts, nowMs) {
	if (!accounts.some((pack) => usableExpiry(pack.expiresAtMs))) return {};
	const DAY = 864e5;
	return { expiry: {
		within24h: expiringWithin(accounts, nowMs, DAY),
		within3d: expiringWithin(accounts, nowMs, 3 * DAY),
		within7d: expiringWithin(accounts, nowMs, 7 * DAY),
		expired: expiredPacks(accounts, nowMs)
	} };
}
/** Map the check-in answer to the card's compact document. */
function toCheckin(status) {
	return {
		checkedIn: status.checkedIn,
		didCheckedIn: status.didCheckedIn,
		credits: status.credits,
		enabled: status.enabled,
		...status.extraCredits === void 0 ? {} : { extraCredits: status.extraCredits }
	};
}
/**
* Assemble one region's card document. `panel` is the tab the card is on; the
* panel-scoped store already answers with only that region's accounts, so the
* document's model slots and account list are that region's by construction.
* Sign-in state is read-only; credit is a live billing answer whose failure
* degrades to `creditsError` rather than failing the whole document.
*/
async function traeWebUsage(deps, panel, options = {}) {
	const fast = options.detail === "fast";
	const store = deps.store(panel);
	const enabled = deps.regionEnabled(panel);
	/**
	* Accounts this panel may actually bill.
	*
	* Filtered ONCE, at the source, because this list is spliced into every
	* response shape below (`signed-out`, `signed-in`, the credits route). The
	* enterprise pool can only bill a tenant account, and the tenant gateway does
	* not make that obvious: it answers a personal token's DIRECTORY read in
	* full and only refuses its chat (`4019`). Listing a personal account there
	* would offer a binding that cannot work.
	*/
	const accounts = (await store.accounts()).filter((account) => panel !== "enterprise" || account.enterprise);
	/**
	* Copies that were found unreadable and moved aside (4.4.6+).
	*
	* Read ONCE per document and never allowed to fail it: a notice is a fact
	* about the user's disk, and a card that failed to load would teach the user
	* nothing about it. It is also the one piece of the document that explains a
	* MISSING ACCOUNT, so it belongs on both shapes — the signed-out one
	* especially, because that is where a lost copy leaves the user (issue #56).
	*
	* The scan is a directory listing beside the plugin's OWN files: cheap, and
	* it reads nothing but file names and sizes.
	*/
	const quarantined = await Promise.resolve().then(() => store.quarantinedCopies()).catch(() => []);
	/**
	* A region this build recognizes but does not serve (issue #66).
	*
	* Read ONCE per document and never allowed to fail it: this is a notice about
	* the user's disk, and the panel it explains is usually the one that has just
	* been excluded from billing. It is also why the panel can say "a US account
	* is here, and it is not being used" instead of an undiagnosable "not signed
	* in" on a machine the user knows is signed in.
	*/
	const unsupported = await Promise.resolve().then(() => store.unsupportedCredentials()).catch(() => []);
	const firstUnsupported = unsupported[0];
	const unsupportedRegion = firstUnsupported === void 0 ? void 0 : {
		region: firstUnsupported.region,
		accounts: unsupported.map((item) => item.accountName)
	};
	if ((await store.status()).state !== "signed-in") {
		const { failures } = await store.diagnose();
		return {
			status: "signed-out",
			accounts,
			enabled,
			quarantined,
			...unsupportedRegion === void 0 ? {} : { unsupportedRegion },
			searched: failures.map((failure) => ({
				path: failure.path,
				edition: failure.edition,
				source: failure.source,
				reason: failure.reason,
				...failure.message === void 0 ? {} : { message: safeMessage(failure.message) }
			}))
		};
	}
	let credential;
	try {
		credential = fast ? await store.current() : await store.resolve();
		if (credential === void 0) credential = await store.resolve();
	} catch (error) {
		const explained = error instanceof TraeUnsupportedRegionError && unsupportedRegion !== void 0;
		return {
			status: "signed-out",
			accounts,
			enabled,
			quarantined,
			...unsupportedRegion === void 0 ? {} : { unsupportedRegion },
			...explained ? {} : { message: safeMessage(error) }
		};
	}
	const account = {
		accountId: accounts.find((item) => item.selected)?.id ?? "",
		accountName: credential.accountName ?? credential.userId,
		tokenExpiresAtMs: credential.expiresAtMs,
		...credential.refreshExpiresAtMs === void 0 ? {} : { refreshExpiresAtMs: credential.refreshExpiresAtMs },
		region: regionOfPanel(panel),
		enabled,
		...unsupportedRegion === void 0 ? {} : { unsupportedRegion },
		accounts,
		models: deps.displayModels(panel).map((model) => ({
			...model,
			...model.input === void 0 ? {} : { input: [...model.input] }
		})),
		enabledModelIds: [...deps.enabledModelIds(panel)],
		quarantined,
		...deps.rawDiagnostic === void 0 ? {} : { rawChat: deps.rawDiagnostic(panel) }
	};
	if (fast) {
		const poolSection = await poolSectionOf(deps, panel, true);
		return {
			status: "signed-in",
			...account,
			...poolSection,
			...panel === "enterprise" ? { creditsUnavailable: "enterprise" } : {}
		};
	}
	const poolSection = await poolSectionOf(deps, panel, false);
	const client = deps.client(panel);
	if (regionOfPanel(panel) === "ai") try {
		const payStatus = await client.payStatus();
		return {
			status: "signed-in",
			...account,
			...poolSection,
			payStatus
		};
	} catch (error) {
		return {
			status: "signed-in",
			...account,
			...poolSection,
			payStatusError: safeMessage(error)
		};
	}
	/**
	* The enterprise panel shows NO credit figure, deliberately.
	*
	* `client.snapshot()` reads the CONSUMER packs, and that is the personal
	* balance — not what a tenant turn spends. There is no enterprise counterpart
	* to read: every tenant quota endpoint answers 404 (probed 2026-10-17), and
	* the tenant console at console.enterprise.trae.cn is the only place the
	* enterprise balance exists. Showing the personal number under an enterprise
	* heading would be actively misleading, so the panel reports the absence
	* explicitly and the card explains where the real figure lives.
	*/
	if (panel === "enterprise") return {
		status: "signed-in",
		...account,
		...poolSection,
		creditsUnavailable: "enterprise"
	};
	const [snapshotResult, checkinResult] = await Promise.allSettled([client.snapshot(), client.checkinStatus()]);
	const credits = snapshotResult.status === "fulfilled" ? toCredits(snapshotResult.value) : void 0;
	const alternatives = credits !== void 0 && credits.workAvailable <= 0 && credits.generalAvailable <= 0 ? await creditAlternatives(deps, panel, accounts) : void 0;
	return {
		status: "signed-in",
		...account,
		...poolSection,
		...credits === void 0 ? { creditsError: snapshotResult.status === "rejected" ? safeMessage(snapshotResult.reason) : "unknown" } : { credits },
		...checkinResult.status === "fulfilled" ? { checkin: toCheckin(checkinResult.value) } : { checkinError: safeMessage(checkinResult.reason) },
		...alternatives === void 0 ? {} : { alternatives }
	};
}
/**
* Other accounts on this machine that still have credit, when the bound one has
* none (issue #25).
*
* Only ever called for a bound account whose own credits came back at zero, so
* a healthy setup pays nothing for it. Each candidate is read through
* `creditsOfAccount`, which must not disturb the bound account; a candidate
* that fails is simply absent from the answer rather than reported as a broken
* account, because a stale token on an unrelated login is not this card's
* problem to explain. The list is capped so a machine with many stale
* credentials cannot turn one status read into a burst of upstream calls.
*/
async function creditAlternatives(deps, panel, accounts) {
	if (deps.creditsOfAccount === void 0) return void 0;
	const candidates = accounts.filter((account) => !account.selected && account.region === regionOfPanel(panel)).filter((account) => panel !== "enterprise" || account.enterprise).slice(0, TRAE_CREDIT_ALTERNATIVE_LIMIT);
	if (candidates.length === 0) return void 0;
	const alternatives = (await Promise.all(candidates.map(async (account) => {
		try {
			const credits = await deps.creditsOfAccount(panel, account.id);
			if (credits === void 0) return void 0;
			if (credits.workAvailable <= 0 && credits.generalAvailable <= 0) return void 0;
			return {
				id: account.id,
				accountName: account.accountName,
				edition: account.edition,
				workAvailable: credits.workAvailable,
				generalAvailable: credits.generalAvailable
			};
		} catch {
			return;
		}
	}))).filter((entry) => entry !== void 0);
	return alternatives.length === 0 ? void 0 : alternatives;
}
/**
* The panel's pool section, or an empty standpoint when this Host cannot run one.
*
* THE rule of this file: the pool is an ADD-ON to the status document, so no
* failure inside it may cost the user the sign-in panel. A member with a broken
* balance read, a probe store that cannot be parsed, a clock — all of it degrades
* to "no pool section" rather than to a 500 that hides the account table.
*
* What is deliberately NOT swallowed here: a `credential`-class failure of the
* BOUND account, which `traeWebUsage` reports as `status: error` before the pool
* is even assembled.
*/
async function poolSectionOf(deps, panel, fast = false) {
	if (deps.pool === void 0) return {};
	try {
		const pool = await traeWebPool(deps, panel, fast);
		return pool === void 0 ? {} : { pool };
	} catch {
		return {};
	}
}
/**
* Assemble one panel's pool document (see {@link TraeWebPool}).
*
* Rows come from TWO sources and are kept in the Host's ranking order: checked
* members (ranked by {@link rankPool}) first, then the local sign-ins the pool
* does NOT cover, so the card can offer them to check. Unchecked rows carry no
* credits and no measurement — nothing has been read for an account the pool does
* not bill, and printing a friendlier-looking zero would be a lie.
*
* Every per-row read is failure-tolerant on purpose: one account whose balance
* read throws must not remove the other members from the table.
*/
async function traeWebPool(deps, panel, fast = false) {
	const pool = deps.pool;
	if (pool === void 0) return void 0;
	const preferences = pool.preferences(panel);
	const members = fast ? await pool.localMembers?.(panel) : await pool.members(panel);
	if (members === void 0) return void 0;
	const nowMs = Date.now();
	const ranked = rankPool(members, nowMs);
	const target = resolveTargetModel(pool.catalog?.(panel) ?? [], preferences.targetModelId);
	const byId = new Map(members.map((member) => [member.account.id, member]));
	const excludedById = new Map(ranked.flatMap((row) => row.excludedBy === void 0 ? [] : [[row.account.id, row.excludedBy]]));
	const rankedIds = new Set(ranked.map((row) => row.account.id));
	/**
	* ISSUE #77: every dep below is shaped so the first paint can avoid the
	* upstream. `otherAccounts`, `memberNames` and `checkinState` are all derived
	* from a FULL membership pass on this Host (one balance read per account), and
	* three of them in a row is most of the reported wait. The fast document
	* answers the same questions from the roster it already has:
	*
	* - `otherAccounts`: the local roster minus the members already ranked. The
	*   saved-but-unreachable ghosts are added below from `preferences` anyway, so
	*   nothing a row is built from goes missing.
	* - `memberNames`: only consulted for ghosts, whose rows the fast document
	*   carries from `localMemberNames` when the Host offers it.
	* - `checkinState`: the measurement cache, read synchronously.
	*/
	const others = fast ? members.filter((member) => !rankedIds.has(member.account.id)).map((member) => member.account) : (await pool.otherAccounts?.(panel) ?? []).filter((account) => !rankedIds.has(account.id));
	const checkinState = fast ? { ...pool.cachedCheckinState?.(panel) ?? {} } : await pool.checkinState?.(panel).catch(() => ({})) ?? {};
	const memberNames = fast ? await pool.localMemberNames?.(panel).catch(() => ({})) ?? {} : await pool.memberNames?.(panel).catch(() => ({})) ?? {};
	const currentAccountId = await pool.currentAccountId?.(panel).catch(() => void 0);
	/**
	* A row per listed account, members first.
	*
	* `member` is the membership source of truth: the saved list is what a batch
	* runs on, so a local sign-in that is not checked must not render as one —
	* otherwise the card would claim "N accounts will be tested" over a set the
	* Host never touches.
	*/
	const savedMembers = new Set(preferences.memberAccountIds ?? []);
	const rows = [];
	const rowIds = /* @__PURE__ */ new Set();
	for (const row of ranked) {
		rows.push({
			account: row.account,
			member: savedMembers.has(row.account.id)
		});
		rowIds.add(row.account.id);
	}
	for (const account of others) {
		rows.push({
			account,
			member: savedMembers.has(account.id)
		});
		rowIds.add(account.id);
	}
	for (const accountId of savedMembers) {
		if (rowIds.has(accountId)) continue;
		rows.push({
			account: {
				id: accountId,
				accountName: ""
			},
			member: true
		});
		rowIds.add(accountId);
	}
	const reachableIds = new Set(members.map((member) => member.account.id));
	const tokenExpiresById = /* @__PURE__ */ new Map();
	for (const member of members) if (member.tokenExpiresAtMs !== void 0) tokenExpiresById.set(member.account.id, member.tokenExpiresAtMs);
	const accounts = rows.map((row) => {
		const entry = byId.get(row.account.id);
		const measured = entry?.probe;
		const credits = entry?.credits;
		const checkin = checkinState[row.account.id];
		const excludedBy = excludedById.get(row.account.id);
		const accountName = row.account.accountName !== "" ? row.account.accountName : memberNames[row.account.id] ?? measured?.accountName ?? row.account.id;
		return {
			accountId: row.account.id,
			accountName,
			...credits === void 0 ? {} : {
				credits: credits.total,
				...credits.generalAvailable === void 0 ? {} : { generalAvailable: credits.generalAvailable },
				...credits.workAvailable === void 0 ? {} : { workAvailable: credits.workAvailable },
				expiringSoon: credits.expiringSoon,
				...credits.nearestExpiryMs === void 0 ? {} : { nearestExpiryMs: credits.nearestExpiryMs }
			},
			...measured === void 0 ? {} : { probe: {
				outcome: measured.outcome,
				atMs: measured.atMs,
				...measured.source === void 0 ? {} : { source: measured.source },
				...measured.modelId === void 0 ? {} : { modelId: measured.modelId },
				...measured.retryAtMs === void 0 ? {} : { retryAtMs: measured.retryAtMs },
				...measured.message === void 0 ? {} : { message: safeMessage(measured.message) }
			} },
			...excludedBy === void 0 ? {} : { excludedBy },
			...credits === void 0 && (tokenExpiresById.get(row.account.id) ?? Infinity) <= nowMs ? { tokenExpired: true } : {},
			current: currentAccountId !== void 0 && currentAccountId === row.account.id,
			member: row.member,
			reachable: reachableIds.has(row.account.id),
			...checkin === void 0 ? {} : {
				checkedInToday: checkin.checkedIn,
				...checkin.deviceCheckedIn === void 0 ? {} : { deviceCheckedIn: checkin.deviceCheckedIn }
			}
		};
	});
	/**
	* Why the pool cannot pick anybody, when it cannot.
	*
	* Only meaningful for an ENABLED pool: a disabled pool is not picking anybody by
	* design, and saying "no candidate" there would describe a fault that is not
	* one. Every member excluded is the case the card must explain, because traffic
	* then falls back to the saved selection while the table shows a full roster.
	*/
	let noCandidate;
	if (preferences.enabled === true) {
		if (members.length === 0) noCandidate = "empty";
		else if (ranked.every((row) => row.excludedBy !== void 0)) noCandidate = new Set(ranked.map((row) => row.excludedBy)).size === 1 ? ranked[0]?.excludedBy ?? "unusable" : "unusable";
	}
	const effectiveMemberAccountIds = effectiveMembersOf(rows.filter((row) => row.member).map((row) => row.account.id), new Set(members.map((member) => member.account.id)));
	const copies = await deps.copiesOf?.(panel).catch(() => void 0);
	return {
		enabled: preferences.enabled === true,
		checkinSupported: pool.checkin !== void 0 && regionOfPanel(panel) === "cn",
		...deps.deleteAccountOf === void 0 ? {} : { deleteSupported: true },
		...copies === void 0 ? {} : { copies },
		...target.modelId === void 0 ? {} : { targetModelId: target.modelId },
		targetModelSource: target.source,
		probeInputTokens: Math.max(0, preferences.probeInputTokens ?? 0),
		...target.staleModelId === void 0 ? {} : { staleTargetModelId: target.staleModelId },
		...preferences.memberAccountIds === void 0 ? {} : { memberAccountIds: preferences.memberAccountIds },
		effectiveMemberAccountIds,
		...Object.keys(memberNames).length === 0 ? {} : { memberNames },
		accounts,
		...noCandidate === void 0 ? {} : { noCandidate }
	};
}
/**
* One test row, translated into the pool vocabulary the card renders.
*
* The runner answers in the model-probe verdicts (`available` / `auth` / `gated` /
* `rate_limited` / `unsupported`); the card must not have to know that `gated` and
* `1005` are the same event, so the translation happens here — once, for both the
* batch and the single-row probe.
*/
function poolTestRowViewOf(row) {
	return {
		accountId: row.accountId,
		accountName: row.accountName,
		modelId: row.modelId,
		outcome: outcomeOfVerdict(row.outcome),
		detail: safeMessage(row.detail),
		...row.retryAtMs === void 0 ? {} : { retryAtMs: row.retryAtMs }
	};
}
/** One check-in row, redacted on the way out. */
function poolCheckinRowViewOf(row) {
	return {
		accountId: row.accountId,
		accountName: row.accountName,
		status: row.status,
		...row.credit === void 0 ? {} : { credit: row.credit },
		...row.message === void 0 ? {} : { message: safeMessage(row.message) }
	};
}
/**
* The panel a request addresses, or a 400 answer. Absent parameter means the
* domestic tab; an unknown value is refused rather than guessed.
*/
/**
* The general balance of every account in one panel.
*
* One upstream read per account — the same call `creditsOfAccount` already
* makes for the exhausted-balance alternatives, widened to every account and to
* zero balances. Costs nothing until the composer panel is opened, so the
* 5-minute readout never pays for it (see {@link TRAE_ACCOUNT_CREDITS_PATH}).
*
* An account whose read fails or is unavailable still appears, without a
* figure: the table lists how many accounts exist even when one cannot be
* quoted, rather than dropping it and making the switch unavailable.
*/
async function traeAccountCredits(deps, panel) {
	const accounts = (await deps.store(panel).accounts()).filter((account) => account.region === regionOfPanel(panel)).filter((account) => panel !== "enterprise" || account.enterprise);
	if (accounts.length === 0) return [];
	return Promise.all(accounts.map(async (account) => {
		let generalAvailable;
		if (account.selected) try {
			generalAvailable = toCredits(await deps.client(panel).snapshot()).generalAvailable;
		} catch {}
		else if (deps.creditsOfAccount !== void 0) try {
			generalAvailable = (await deps.creditsOfAccount(panel, account.id))?.generalAvailable;
		} catch {}
		return {
			id: account.id,
			accountName: account.accountName,
			selected: account.selected,
			...generalAvailable === void 0 ? {} : { generalAvailable }
		};
	}));
}
function requestRegion(req, res) {
	const panel = regionOfTraeStatusUrl(req.url ?? "/");
	if (panel === void 0) {
		json(res, 400, { error: "unknown region" });
		return;
	}
	return panel;
}
/** Mount the GET usage route on an optional webServer context. */
function registerTraeUsageRoute(ctx, deps) {
	ctx.effect(() => {
		const disposeUsage = ctx.webServer.register({
			kind: "exact",
			path: TRAE_USAGE_PATH,
			handler: async (req, res) => {
				if (req.method !== "GET") {
					json(res, 405, { error: "method not allowed" });
					return;
				}
				if (!loopbackOrigin(req)) {
					json(res, 403, { error: "origin-not-trusted" });
					return;
				}
				const panel = requestRegion(req, res);
				if (panel === void 0) return;
				const detail = fastDetailOf(req.url ?? "") ? "fast" : "full";
				try {
					json(res, 200, await traeWebUsage(deps, panel, { detail }));
				} catch (error) {
					failJson(res, error);
				}
			}
		});
		/**
		* General balance of every account in the panel — read only when the
		* composer panel is opened. One upstream read per account, paid once per
		* open rather than on the 5-minute cycle (see
		* {@link TRAE_ACCOUNT_CREDITS_PATH}).
		*/
		const disposeAccountCredits = ctx.webServer.register({
			kind: "exact",
			path: TRAE_ACCOUNT_CREDITS_PATH,
			handler: async (req, res) => {
				if (req.method !== "GET") return json(res, 405, { error: "method not allowed" });
				if (!loopbackOrigin(req)) return json(res, 403, { error: "origin-not-trusted" });
				const panel = requestRegion(req, res);
				if (panel === void 0) return;
				try {
					json(res, 200, { accounts: await traeAccountCredits(deps, panel) });
				} catch (error) {
					failJson(res, error);
				}
			}
		});
		/**
		* Per-account status for one row of the card's account table (CN:
		* check-in + balances; ai: subscription). Read-only, one upstream call per
		* account, fetched once per table render. `accountId` rides in the query
		* (a GET, like every other read-only sibling). Absent `accountStateOf`
		* the route answers 503 so the table degrades to bare rows.
		*/
		const disposeAccountStatus = ctx.webServer.register({
			kind: "exact",
			path: TRAE_ACCOUNT_STATUS_PATH,
			handler: async (req, res) => {
				if (req.method !== "GET") return json(res, 405, { error: "method not allowed" });
				if (!loopbackOrigin(req)) return json(res, 403, { error: "origin-not-trusted" });
				if (deps.accountStateOf === void 0) return json(res, 503, { error: "account status unavailable" });
				const panel = requestRegion(req, res);
				if (panel === void 0) return;
				const accountId = new URL(req.url ?? "/", "http://localhost").searchParams.get("accountId");
				if (accountId === null || accountId.trim() === "") return json(res, 400, { error: "missing accountId" });
				try {
					const state = await deps.accountStateOf(panel, accountId);
					if (state === void 0) return json(res, 404, { error: "unknown account" });
					json(res, 200, state);
				} catch (error) {
					failJson(res, error);
				}
			}
		});
		const disposeAccounts = ctx.webServer.register({
			kind: "exact",
			path: TRAE_ACCOUNTS_REFRESH_PATH,
			handler: async (req, res) => {
				if (req.method !== "POST") return json(res, 405, { error: "method not allowed" });
				if (!loopbackOrigin(req)) return json(res, 403, { error: "origin-not-trusted" });
				const panel = requestRegion(req, res);
				if (panel === void 0) return;
				try {
					json(res, 200, { accounts: (await deps.store(panel).accounts()).filter((account) => panel !== "enterprise" || account.enterprise) });
				} catch (error) {
					json(res, 500, { error: safeMessage(error) });
				}
			}
		});
		/**
		* 本机 TraeDaddy 账号库：列出全部已保存的登录快照并可切换。
		*
		* GET  → `{ panel, accounts, selectedAccountId }`，只回身份 / 到期时间，
		*        绝不下发 token。
		* POST → `{ action: "sync" | "switch", accountId? }`
		*   - `sync`   把库里所有账号合并进宿主 own 凭据文件（不切换）
		*   - `switch` 合并 + 把选中账号排到 own 文件第一位 +
		*              调用 `store.selectAccount(id)` 让本次会话立即生效
		*
		* 为什么 own 文件第一位就是「当前账号」：`preferred()` 在未显式绑定时
		* 取 eligible[0]，own 记录全是 `dsh` source，所以第一位生效且重启后
		* 依然成立。settings 的 `accounts.<panel>` 也会被写入（可用时），与
		* 原生设置页的保存行为一致。
		*/
		const disposeLocalAccounts = ctx.webServer.register({
			kind: "exact",
			path: TRAE_LOCAL_ACCOUNTS_PATH,
			handler: async (req, res) => {
				if (!loopbackOrigin(req)) return json(res, 403, { error: "origin-not-trusted" });
				const panel = requestRegion(req, res);
				if (panel === void 0) return;
				if (req.method === "GET") {
					try {
						const accounts = await listTraeLocalAccounts(panel);
						let selectedAccountId;
						try {
							const offered = await deps.store(panel).accounts();
							selectedAccountId = offered.find((account) => account.selected)?.id;
						} catch {}
						return json(res, 200, { panel, accounts, selectedAccountId });
					} catch (error) {
						return json(res, 500, { error: safeMessage(error) });
					}
				}
				if (req.method !== "POST") return json(res, 405, { error: "method not allowed" });
				let body;
				try {
					body = await readTransferBody(req);
				} catch (error) {
					return json(res, 400, { error: safeMessage(error) });
				}
				const action = typeof body.action === "string" ? body.action : "";
				const accountId = typeof body.accountId === "string" ? body.accountId : "";
				try {
					if (action === "sync") {
						const result = await syncTraeLocalAccounts(panel);
						return json(res, 200, { action, ...result });
					}
					if (action === "switch") {
						if (!isTraeLocalAccountId(accountId)) return json(res, 400, { error: "accountId is required and must be a Trae account id" });
						const accounts = await listTraeLocalAccounts(panel);
						const target = accounts.find((account) => account.id === accountId);
						if (target === undefined) return json(res, 404, { error: "account not found in the local Trae library" });
						const result = await syncTraeLocalAccounts(panel, accountId);
						/* 立即生效：内存里的 store 从 own 文件重新解析该账号。 */
						await deps.store(panel).selectAccount(accountId);
						/* 持久化：与原生设置页一致写 accounts.<panel>（best-effort）。 */
						try {
							await deps.setAccountSelection?.(panel, accountId);
						} catch {}
						return json(res, 200, {
							action,
							accountId,
							accountName: target.accountName,
							...result
						});
					}
					return json(res, 400, { error: "action is required (sync|switch)" });
				} catch (error) {
					return json(res, 409, { error: safeMessage(error) });
				}
			}
		});
		/**
		* Batch credential export / import (issue #37).
		*
		* The Host owns every byte of the credential store; the browser only receives
		* parsed answers. `preview` necessarily returns identifiers the card shows
		* (uid / nickname / email) plus a `hasToken` boolean — never a token — and
		* `import` re-parses the file server-side rather than trusting the preview,
		* so a tampered browser cannot smuggle in a record the preview never showed.
		*/
		const disposeTransfer = ctx.webServer.register({
			kind: "exact",
			path: TRAE_TRANSFER_PATH,
			handler: async (req, res) => {
				if (req.method !== "POST") return json(res, 405, { error: "method not allowed" });
				if (!loopbackOrigin(req)) return json(res, 403, { error: "origin-not-trusted" });
				const panel = requestRegion(req, res);
				if (panel === void 0) return;
				const action = transferActionOf(req.url ?? "");
				if (action === void 0) return json(res, 400, { error: "unknown transfer action" });
				try {
					const body = await readTransferBody(req);
					if (action === "export") {
						const wanted = new Set(Array.isArray(body["accountIds"]) ? body["accountIds"].filter((id) => typeof id === "string") : []);
						const store = deps.store(panel);
						const records = [];
						for (const account of await store.accounts()) {
							if (!wanted.has(account.id)) continue;
							const credential = await store.copyOf(account.id).catch(() => void 0);
							if (credential === void 0) continue;
							records.push(traeTransferRecordOf(credential, {
								auth: {
									accessToken: credential.accessToken,
									...credential.refreshToken === void 0 ? {} : { refreshToken: credential.refreshToken },
									expiresAt: credential.expiresAtMs > 0 ? Math.floor(credential.expiresAtMs / 1e3) : 0,
									...credential.refreshExpiresAtMs === void 0 ? {} : { refreshExpiresAt: Math.floor(credential.refreshExpiresAtMs / 1e3) },
									host: credential.host,
									...credential.userRegion === void 0 ? {} : { userRegion: credential.userRegion }
								},
								account: {
									userId: credential.userId,
									...credential.accountName === void 0 ? {} : { username: credential.accountName },
									edition: credential.edition
								}
							}));
						}
						return json(res, 200, { accounts: records });
					}
					const text = typeof body["text"] === "string" ? body["text"] : "";
					if (action === "preview") return json(res, 200, previewTransferFile(text));
					const indexes = Array.isArray(body["indexes"]) ? body["indexes"].filter((index) => typeof index === "number" && Number.isInteger(index)) : [];
					const { changes, imported, skipped } = mergeTransferRecords(parseTransferFile(text), indexes, regionOfPanel(panel));
					if (changes.size > 0) await deps.store(panel).importAccounts([...changes.values()]);
					json(res, 200, {
						imported,
						skipped
					});
				} catch (error) {
					json(res, 400, { error: safeMessage(error) });
				}
			}
		});
		const disposeRefresh = ctx.webServer.register({
			kind: "exact",
			path: TRAE_MODELS_REFRESH_PATH,
			handler: async (req, res) => {
				if (req.method !== "POST") return json(res, 405, { error: "method not allowed" });
				if (!loopbackOrigin(req)) return json(res, 403, { error: "origin-not-trusted" });
				if (deps.discoverModels === void 0) return json(res, 503, { error: "model refresh unavailable" });
				const panel = requestRegion(req, res);
				if (panel === void 0) return;
				try {
					json(res, 200, { models: await deps.discoverModels(panel) });
				} catch (error) {
					failJson(res, error);
				}
			}
		});
		/**
		* One-click availability test for the enabled models.
		*
		* This ROUTE COSTS QUOTA: each tested model gets a real, minimal chat call.
		* Every other plugin surface is read-only, so the guards here are tighter
		* than a GET's — POST only, loopback origin only, and the id list is taken
		* from the request body and validated against the region's live catalog, so
		* a caller cannot spend calls on arbitrary upstream config names. The count
		* is capped for the same reason.
		*/
		const disposeModelsTest = ctx.webServer.register({
			kind: "exact",
			path: TRAE_MODELS_TEST_PATH,
			handler: async (req, res) => {
				if (req.method !== "POST") return json(res, 405, { error: "method not allowed" });
				if (!loopbackOrigin(req)) return json(res, 403, { error: "origin-not-trusted" });
				if (deps.probeModels === void 0) return json(res, 503, { error: "model test unavailable" });
				const panel = requestRegion(req, res);
				if (panel === void 0) return;
				let ids;
				try {
					ids = await readModelTestBody(req);
				} catch (error) {
					return json(res, 400, { error: safeMessage(error) });
				}
				if (ids.length === 0) return json(res, 400, { error: "no models to test" });
				if (ids.length > 64) return json(res, 400, { error: `too many models (limit ${String(64)})` });
				try {
					json(res, 200, await deps.probeModels(panel, ids));
				} catch (error) {
					failJson(res, error);
				}
			}
		});
		/**
		* Daily check-in claim — the ONLY route in this plugin that mutates
		* upstream account state, so it is guarded more tightly than its siblings:
		* POST only, loopback origin only, and the status read runs FIRST so a day
		* the ACCOUNT has already been paid for never reaches the upstream claim.
		*
		* `alreadyCheckedIn` and `deviceCheckedIn` are deliberately separate
		* answers, because the two flags mean different things (see
		* {@link TraeWebCheckin}): `checkedIn` is the account's reward for today
		* existing, `didCheckedIn` is this MACHINE having spent its check-in —
		* possibly for a different account. Treating the latter as "claimed today"
		* was a shipped bug: after switching accounts the card said "claimed
		* today" and disabled the button, which is the right call for the wrong
		* reason and hides that the new account was never rewarded.
		*
		* The upstream is idempotent per Beijing day (verified 2026-09-24: a
		* repeat claim answers `code: 0` with the entitlement total unchanged), but
		* relying on that for correctness would put the guard in someone else's
		* hands.
		*/
		const disposeCheckin = ctx.webServer.register({
			kind: "exact",
			path: TRAE_CHECKIN_PATH,
			handler: async (req, res) => {
				if (req.method !== "POST") return json(res, 405, { error: "method not allowed" });
				if (!loopbackOrigin(req)) return json(res, 403, { error: "origin-not-trusted" });
				const panel = requestRegion(req, res);
				if (panel === void 0) return;
				if (regionOfPanel(panel) !== "cn") return json(res, 404, { error: "check-in is not available for the international region" });
				try {
					let accountId;
					try {
						accountId = await readAccountBody(req);
					} catch {
						accountId = void 0;
					}
					if (accountId !== void 0) {
						if (deps.claimCheckinOf === void 0) return json(res, 503, { error: "check-in by account unavailable" });
						const outcome = await deps.claimCheckinOf(panel, accountId);
						if (outcome === void 0) return json(res, 404, { error: "unknown account" });
						const { claim, checkin: after } = outcome;
						const deviceClaimed = claim.code === CHECKIN_DEVICE_ALREADY_CLAIMED$1;
						return json(res, 200, {
							claimed: claim.claimed,
							alreadyCheckedIn: after.checkedIn,
							...deviceClaimed ? { deviceCheckedIn: true } : {},
							code: claim.code,
							message: claim.message,
							checkin: toCheckin(after)
						});
					}
					const client = deps.client(panel);
					const current = await client.checkinStatus();
					if (!current.enabled) return json(res, 409, { error: "check-in is not enabled for this account" });
					if (current.checkedIn) return json(res, 200, {
						claimed: false,
						alreadyCheckedIn: true,
						deviceCheckedIn: current.didCheckedIn,
						checkin: toCheckin(current)
					});
					if (current.didCheckedIn) return json(res, 200, {
						claimed: false,
						alreadyCheckedIn: false,
						deviceCheckedIn: true,
						code: CHECKIN_DEVICE_ALREADY_CLAIMED$1,
						message: "this device already used today's check-in",
						checkin: toCheckin(current)
					});
					const claim = await client.claimCheckin();
					const checkin = await client.checkinStatus();
					const deviceClaimed = claim.code === CHECKIN_DEVICE_ALREADY_CLAIMED$1;
					json(res, 200, {
						claimed: claim.claimed,
						alreadyCheckedIn: false,
						...deviceClaimed ? { deviceCheckedIn: true } : {},
						code: claim.code,
						message: claim.message,
						checkin: toCheckin(checkin)
					});
				} catch (error) {
					failJson(res, error);
				}
			}
		});
		/**
		* The account pool's ONE mutation surface: `?action=checkin|test|remove`.
		*
		* Everything the pool does that costs something happens here and nowhere else —
		* `checkin` sends a claim, `test` spends a real chat call per member, `remove`
		* drops one account's measurement. The pool is therefore POST-only and
		* loopback-only, like the model test and the check-in it wraps.
		*
		* The empty-pool guard runs on `effectiveMemberAccountIds` — what this Host can
		* actually reach — rather than on the saved list. A saved id whose sign-in
		* disappeared would otherwise let a batch answer `200` with zero rows, which
		* the card reads as "全部正常".
		*
		* Answers are JSON except for a streaming test batch, which writes one NDJSON
		* line per account as it lands: the loop is serial, so without a stream a user
		* cannot tell a slow member from a dead button.
		*/
		const disposePool = ctx.webServer.register({
			kind: "exact",
			path: TRAE_POOL_PATH,
			handler: async (req, res) => {
				if (req.method !== "POST") return json(res, 405, { error: "method not allowed" });
				if (!loopbackOrigin(req)) return json(res, 403, { error: "origin-not-trusted" });
				const panel = requestRegion(req, res);
				if (panel === void 0) return;
				const pool = deps.pool;
				if (pool === void 0) return json(res, 503, { error: "account pool unavailable" });
				const url = req.url ?? "/";
				const action = poolActionOf(url);
				if (action === void 0) return json(res, 400, { error: `missing or unknown action parameter (${TRAE_POOL_ACTION_PARAM})` });
				const accountId = poolAccountIdOf(url);
				if (accountId !== void 0 && !isTraeAccountId(accountId)) return json(res, 400, { error: "malformed account id" });
				if (action === "remove") {
					if (accountId === void 0) return json(res, 400, { error: "remove needs an accountId" });
					if (pool.removeOne === void 0) return json(res, 503, { error: "pool removal unavailable" });
					try {
						json(res, 200, {
							accountId,
							removed: await pool.removeOne(panel, accountId)
						});
					} catch (error) {
						json(res, 500, { error: safeMessage(error) });
					}
					return;
				}
				if (action === "delete") {
					if (accountId === void 0) return json(res, 400, { error: "delete needs an accountId" });
					if (deps.deleteAccountOf === void 0) return json(res, 503, { error: "account deletion unavailable" });
					try {
						json(res, 200, {
							accountId,
							...await deps.deleteAccountOf(panel, accountId)
						});
					} catch (error) {
						json(res, 500, { error: safeMessage(error) });
					}
					return;
				}
				/**
				* Both remaining actions need a NON-EMPTY effective pool.
				*
				* `effectiveMemberAccountIds` is optional; when the Host does not supply it
				* the guard falls back to the saved list, which is weaker but never worse
				* than no guard at all. `no-live-members` and `no-members` are separate
				* reasons because the advice differs: re-check the accounts you lost versus
				* check some accounts in.
				*/
				const saved = pool.preferences(panel).memberAccountIds ?? [];
				let effective = saved;
				if (pool.effectiveMemberAccountIds !== void 0) try {
					effective = await pool.effectiveMemberAccountIds(panel);
				} catch (error) {
					return json(res, 500, { error: safeMessage(error) });
				}
				if (effective.length === 0) return json(res, 409, {
					action,
					reason: saved.length === 0 ? "no-members" : "no-live-members",
					error: saved.length === 0 ? "no accounts are checked into this pool" : "none of the checked accounts can be reached on this machine"
				});
				if (action === "checkin") {
					const supported = pool.checkinSupported?.(panel) ?? true;
					if (!supported || pool.checkin === void 0) return json(res, 409, {
						action,
						reason: "checkin-unsupported",
						error: supported ? "check-in is unavailable in this build" : "this panel has no daily check-in"
					});
					try {
						json(res, 200, { rows: (await pool.checkin(panel)).map((row) => poolCheckinRowViewOf(row)) });
					} catch (error) {
						failJson(res, error);
					}
					return;
				}
				const targetModelId = pool.preferences(panel).targetModelId;
				if (pool.test === void 0) return json(res, 409, {
					action,
					reason: "test-unsupported",
					error: "the pool cannot test this panel"
				});
				const single = accountId === void 0 ? void 0 : pool.testOne;
				if (single !== void 0 && accountId !== void 0) {
					const resolved = resolveTargetModel(pool.catalog?.(panel) ?? [], targetModelId);
					if (resolved.modelId === void 0) return json(res, 409, {
						action,
						reason: resolved.source === "stale" ? "stale-target" : "no-target-model",
						error: resolved.source === "stale" ? "the saved test model is no longer offered by this panel" : "no free model is available to test against"
					});
					resolved.modelId;
				}
				if (single !== void 0 && accountId !== void 0) try {
					const row = await single(panel, accountId);
					if (row === void 0) return json(res, 404, { error: "unknown account" });
					return json(res, 200, { rows: [poolTestRowViewOf(row)] });
				} catch (error) {
					return failJson(res, error);
				}
				res.writeHead(200, {
					"Content-Type": "application/x-ndjson",
					"Cache-Control": "no-store"
				});
				const writeLine = (value) => {
					res.write(`${JSON.stringify(value)}\n`);
				};
				try {
					writeLine({ rows: (await pool.test(panel, targetModelId ?? "", (row) => {
						writeLine({ row: poolTestRowViewOf(row) });
					})).map((row) => poolTestRowViewOf(row)) });
				} catch (error) {
					writeLine({
						reason: "pool-failed",
						error: safeMessage(error)
					});
				}
				res.end();
			}
		});
		return () => {
			disposePool();
			disposeCheckin();
			disposeRefresh();
			disposeTransfer();
			disposeModelsTest();
			disposeLocalAccounts();
			disposeAccounts();
			disposeAccountCredits();
			disposeAccountStatus();
			disposeUsage();
		};
	}, "dsh-connect-trae: Web usage route");
}
//#endregion
//#region src/account-pool-run.ts
/** The upstream's business code for "this DEVICE already checked in today". */
const CHECKIN_DEVICE_ALREADY_CLAIMED = 9095;
/**
* Check in every account, one at a time.
*
* Idempotent by design (see the module note): an account already checked in today
* is reported as `already` and NO write is attempted. A failure on one account is
* recorded on that row and the batch continues — EXCEPT for the device-level
* refusal (`9095`), which stops the run: it is a fact about this MACHINE, so every
* later account would hit the same wall and each of those calls is a wasted
* upstream request against an endpoint that just said "stop".
*
* Never throws: every problem becomes a row.
*/
async function checkinAllAccounts(targets, deps) {
	const rows = [];
	for (const [index, target] of targets.entries()) {
		if (index > 0) await (deps.wait ?? defaultWait)(400);
		const row = await checkinOne(target, deps);
		rows.push(row);
		if (row.status === "device-already") {
			for (const skipped of targets.slice(index + 1)) rows.push({
				accountId: skipped.accountId,
				accountName: skipped.accountName,
				status: "device-already",
				message: "skipped: this device has already claimed today"
			});
			break;
		}
	}
	return rows;
}
/** One account's check-in, reduced to its row. */
async function checkinOne(target, deps) {
	const base = {
		accountId: target.accountId,
		accountName: target.accountName
	};
	let credential;
	try {
		credential = await deps.credentialFor(target.accountId);
	} catch (error) {
		return {
			...base,
			status: "failed",
			message: messageOf$1(error)
		};
	}
	if (credential === void 0) return {
		...base,
		status: "failed",
		message: "no stored credential for this account"
	};
	let status;
	try {
		status = await deps.checkinStatusOf(credential);
	} catch (error) {
		return {
			...base,
			status: "failed",
			message: messageOf$1(error)
		};
	}
	if (!status.enabled) return {
		...base,
		status: "disabled",
		message: "check-in is not enabled for this account"
	};
	if (status.checkedIn) return {
		...base,
		status: "already",
		credit: status.credits
	};
	if (status.didCheckedIn) {}
	try {
		const claim = await deps.claimCheckinOf(credential);
		if (claim.claimed) return {
			...base,
			status: "claimed",
			credit: status.credits,
			...nonEmpty(claim.message)
		};
		if (claim.code === CHECKIN_DEVICE_ALREADY_CLAIMED) return {
			...base,
			status: "device-already",
			message: claim.message
		};
		return {
			...base,
			status: "failed",
			message: claim.message === "" ? `code ${String(claim.code)}` : claim.message
		};
	} catch (error) {
		return {
			...base,
			status: "failed",
			message: messageOf$1(error)
		};
	}
}
/**
* Test every account against one model, one at a time.
*
* The model is resolved by the caller (see `resolveTargetModel`) so this function
* never has to decide "free or not" — an unresolvable target is the caller's
* problem to report, and testing against a model nobody chose would be exactly the
* silent spend this feature forbids.
*
* ONE model for the whole batch, deliberately. Letting each row test a different
* model makes a green batch UNCOMPARABLE — one account's `ok` on model X and
* another's on model Y — which is the reading ("all green") that the reference
* implementation removed its per-account override for. What stays is that every
* measurement RECORDS the model it probed and each row displays it.
*
* Never throws: a failed probe is a ROW, not an aborted batch. A credential
* rejection does NOT stop the run (unlike the region-wide model test, where every
* later probe would fail the same way): here each account has its OWN credential,
* so one account's bad token says nothing about its neighbours.
*
* `onRow` fires the moment one account's row exists, which is what lets a caller
* report progress. The loop is SERIAL by design, so without this a caller cannot
* say anything until the SLOWEST member answers: one stuck account made a working
* batch look like a dead button.
*/
async function testAllAccounts(targets, modelId, probe, deps, onRow) {
	const rows = [];
	for (const [index, target] of targets.entries()) {
		if (index > 0) await (deps.wait ?? defaultWait)(400);
		const row = await testOne(target, modelId, probe, deps);
		rows.push(row);
		onRow?.(row);
	}
	return rows;
}
/** One account's probe, reduced to its row. */
async function testOne(target, modelId, probe, deps) {
	const base = {
		accountId: target.accountId,
		accountName: target.accountName,
		modelId
	};
	let credential;
	try {
		credential = await deps.credentialFor(target.accountId);
	} catch (error) {
		return {
			...base,
			outcome: "auth",
			detail: messageOf$1(error)
		};
	}
	if (credential === void 0) return {
		...base,
		outcome: "auth",
		detail: "no stored credential for this account"
	};
	const result = await probe(deps.chatFor, credential, modelId);
	return {
		...base,
		outcome: result.verdict,
		detail: result.detail
	};
}
/**
* Turn a test batch's rows into the per-account measurements to remember.
*
* A row is stored only when the probe actually measured the MODEL. A row that
* failed because the credential could not even be read says nothing about the
* model, and recording it would exclude a possibly-perfect account from the pool —
* so those accounts keep their previous measurement instead.
*
* `atMs` is stamped here, once for the batch, so the card's "tested N minutes ago"
* reflects when the batch finished rather than drifting per row.
*
* `detail` is carried through as `message`. It was already produced from the
* upstream's own (translated) text, so persisting it cannot leak a token, and
* without it the pool table could only repeat one generic sentence for a DNS
* failure, a gateway 502 and a cancelled request alike.
*/
function probeUpdatesOf(rows, nowMs = Date.now()) {
	const updates = {};
	for (const row of rows) {
		if (isTransportFailure(row)) continue;
		const outcome = outcomeOfVerdict(row.outcome);
		updates[row.accountId] = {
			outcome,
			atMs: nowMs,
			source: "test-batch",
			modelId: row.modelId,
			...row.accountName === "" ? {} : { accountName: row.accountName },
			...row.retryAtMs === void 0 ? {} : { retryAtMs: row.retryAtMs },
			...row.detail === "" ? {} : { message: row.detail }
		};
	}
	return updates;
}
/**
* Whether a row measures the transport rather than the account/model.
*
* `auth` carrying the pool's own "no stored credential" message is the one case we
* can attribute to ourselves rather than the upstream: the request never left.
* Every other rejection came from the upstream and IS a statement about this
* account, so it is kept.
*/
function isTransportFailure(row) {
	return row.outcome === "auth" && row.detail.startsWith("no stored credential");
}
/** Carry an optional upstream sentence only when it says something. */
function nonEmpty(message) {
	return message === "" ? {} : { message };
}
/** The default inter-account pause. */
function defaultWait(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
/** A safe message from an unknown throwable, bounded in length. */
function messageOf$1(error) {
	return (error instanceof Error ? error.message : String(error)).slice(0, 300);
}
//#endregion
//#region src/reset-time.ts
/**
* Parse a reset TIME out of an upstream failure message, when the upstream stated
* one.
*
* 参考：`dsh-connect-workbuddy` 的 `src/probe.ts`（`parseUpstreamResetAt`）。
*   该实现在 WorkBuddy 上是实测出来的（其网关的 429 正文里带一句「将在 … 重置」
*   与一句英文 `will reset at …`），本文件把同一套解析规则搬过来，并把「偏移量
*   必须显式」这条硬约束原样保留。
* 改动：诚实标注**证据状态**。Trae 目前被记录在案的限流/配额文案里**没有任何一条
*   带时间**：
*
*   - `4011` → `We're sorry, your requests have exceeded the rate limit.
*     Please wait and try again later.`（docs/ISSUE33_DIAGNOSIS.md:30，实测原文）
*   - `4008` → `Your requests have exceeded the quota.`（同文档:55，实测原文）
*
*   所以本函数在 Trae 上大概率永远返回 `undefined`，而**这正是它应有的行为**：
*   没有给出的时间不能变成插件自己编的倒计时（池会退回
*   `POOL_UNKNOWN_COOLDOWN_MS` 的 30 分钟兜底并在卡片上如实显示「上游未给出
*   何时恢复」）。它存在的理由只有一个：Trae 的中文网关将来若在正文里写了时间
*   （与 WorkBuddy 中文网关同一族文案），不要把一个真实存在的时间当没有解析出来
*   丢掉 —— 参考实现里那是一条实测的 bug（英文正文解析不到 → 账号比上游要求的
*   早 ~18 小时回到池里，再花一次请求重新撞上同一个限制）。
*
* NEVER use it for a credit PACK's `endTimeMs`: that is when a balance STOPS
* being usable, not when a new allowance ARRIVES. Attaching it as a retry time
* would put an exhausted account back into rotation at the exact moment its
* credit disappears.
*
* @module dsh-connect-trae/reset-time
*/
/**
* The timestamp shape both spellings share: `YYYY-MM-DD HH:MM:SS` followed by an
* EXPLICIT UTC offset.
*
* The offset is required, not optional. `2026-09-30 02:30:30` with no zone is a
* moment the plugin would have to guess at, and `Date.parse` guesses LOCAL time —
* right on a UTC+8 machine by accident, silently wrong everywhere else. A message
* that names a time without a zone therefore yields no time, which is the honest
* answer.
*/
const RESET_STAMP = "(\\d{4})-(\\d{2})-(\\d{2})\\s+(\\d{2}):(\\d{2}):(\\d{2})\\s*UTC\\s*([+-])(\\d{1,2})(?::?(\\d{2}))?";
/** Chinese spelling: the marker sits AFTER the timestamp (将在 … 重置). */
const UPSTREAM_RESET_PATTERN_ZH = new RegExp(`将在?\\s*${RESET_STAMP}[\\s\\S]*?重置`, "u");
/**
* English spelling: the marker sits BEFORE the timestamp (`reset at` /
* `refresh on`). It needs its own pattern because the two languages put the
* keyword on different sides of the time, so loosening the surrounding prose
* alone cannot cover both.
*/
const UPSTREAM_RESET_PATTERN_EN = new RegExp(`(?:reset|resets|refresh|refreshes|renew|renews)\\s+(?:at|on)\\s+${RESET_STAMP}`, "iu");
/**
* Parse the reset time out of an upstream failure message.
*
* Returns epoch ms, or undefined when the message names no parsable time — the
* caller must then say "the upstream gave no time", never invent one.
*
* THE OFFSET IS HONOURED, NOT ASSUMED. `2026-09-30 02:30:30 UTC+8` is 18:30:30 UTC
* the previous day, so the components are assembled with `Date.UTC` and the stated
* offset subtracted — correct on every host regardless of its own zone.
*
* A whole-second resolution is what the upstream prints; sub-second precision would
* be fiction in the other direction.
*/
function parseUpstreamResetAt(message) {
	const match = UPSTREAM_RESET_PATTERN_ZH.exec(message) ?? UPSTREAM_RESET_PATTERN_EN.exec(message);
	if (match === null) return void 0;
	const [, year, month, day, hour, minute, second, sign, offsetHours, offsetMinutes] = match;
	const offsetTotalMinutes = (sign === "-" ? -1 : 1) * (Number(offsetHours) * 60 + Number(offsetMinutes ?? "0"));
	const utcMs = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
	const parsed = new Date(utcMs);
	if (parsed.getUTCFullYear() !== Number(year) || parsed.getUTCMonth() !== Number(month) - 1 || parsed.getUTCDate() !== Number(day) || parsed.getUTCHours() !== Number(hour) || parsed.getUTCMinutes() !== Number(minute) || parsed.getUTCSeconds() !== Number(second)) return;
	if (Math.abs(offsetTotalMinutes) > 840) return void 0;
	return utcMs - offsetTotalMinutes * 6e4;
}
//#endregion
//#region src/account-pool-store.ts
/**
* The account pool's RUNTIME store: measured facts, on disk, outside settings.
*
* 参考：`dsh-connect-workbuddy` 的 `src/account-pool-store.ts`，以及本仓库
*   `src/auth.ts` 的插件自有文件约定（`$DSH_HOME` 下的 `.trae-auth.<region>.json`，
*   `withFileLock` + `writeFileAtomic`，`mode: 0o600`）。
* 改动：一份、按**面板**分文件（cn / enterprise / ai），因为 enterprise 与 cn 共用
*   同一份凭据却走不同的网关 —— 一个账号在个人 SOLO 通道能用，完全不说明它过得了
*   租户门（`4019` 只在第一次真实对话时暴露），所以两份测量必须分开落盘。
*
* 为什么这些事实不放 settings（`regions[panel].pool`）：
*
*   卡片对用户偏好用的是「草稿 → 保存 → 丢弃草稿」模式：保存成功会丢弃草稿。
*   如果探测结果也住在那个槽里，用户手工点一次「保存」就会用**几分钟前的草稿**
*   覆盖掉刚刚写进去的测量结果 —— 那等于把测量回退，测试白做。
*   观测数据由插件高频写入、且不是用户偏好，所以它必须落在自己的文件里。
*
* 本模块的读写**从不抛异常给调用方**：池是增强功能，一个损坏的观测文件绝不能让
* 卡片或 host 启动失败 —— 最坏情况是「回到未测试」，而不是整个插件不可用。
*
* @module dsh-connect-trae/account-pool-store
*/
/** On-disk format version; readers reject anything else. */
const STORE_FORMAT_VERSION = 1;
/** Filename prefix for one panel's measured pool facts. */
const POOL_STORE_PREFIX = ".trae-pool";
/** Whether a parsed value looks like a stored probe. */
function isProbe(value) {
	if (typeof value !== "object" || value === null) return false;
	const candidate = value;
	return typeof candidate["outcome"] === "string" && typeof candidate["atMs"] === "number" && (candidate["retryAtMs"] === void 0 || typeof candidate["retryAtMs"] === "number") && (candidate["message"] === void 0 || typeof candidate["message"] === "string") && (candidate["accountName"] === void 0 || typeof candidate["accountName"] === "string") && (candidate["modelId"] === void 0 || typeof candidate["modelId"] === "string") && (candidate["source"] === void 0 || typeof candidate["source"] === "string");
}
/**
* One panel's path for measured pool facts.
*
* Panel-keyed for the same reason the credential copies are region-keyed: the
* panels are parallel stacks and must never overwrite each other's measurements.
*/
function traePoolStorePath(panel) {
	return join(resolveDshHome(), `${POOL_STORE_PREFIX}.${panel}.json`);
}
/**
* The recovery time a stored record implies — declared, or recoverable from its
* own body.
*
* The field itself wins when present: it is what the writer computed with the
* full input set, and re-deriving it could only lose information.
*
* The fallback exists because a record can state a time in its `message` and
* still have no `retryAtMs`. Read-time healing is the only place this can be
* repaired for EXISTING records: every consumer receives probes through
* {@link readTraePoolProbes}, so healing here fixes all of them at once. Re-
* deriving at each consumer instead would be several copies of one rule, and the
* next consumer added would silently miss it.
*
* Not a permanent second derivation: {@link writeTraePoolProbes} reads through
* this function before it writes, so the very next write persists the healed
* value.
*
* Scoped to the two outcomes whose vocabulary HAS a stated time. Widening it
* would let an incidental sentence in an `ok` body attach a countdown to a
* healthy account — the card prints any present `retryAtMs` beside the outcome,
* so that would render a waiting time on an account waiting for nothing.
*/
function retryAtMsOf(probe) {
	if (probe.retryAtMs !== void 0) return probe.retryAtMs;
	if (probe.outcome !== "rate-limited" && probe.outcome !== "out-of-credit") return void 0;
	if (probe.message === void 0) return void 0;
	return parseUpstreamResetAt(probe.message);
}
/**
* Read one panel's measured facts.
*
* Contains NO credentials. The one free-text field is `message`, and it is
* REDACTED BY THE WRITER before it ever reaches this file, so a token-shaped
* string cannot survive into storage.
*
* Returns an empty map for a missing, unreadable, malformed, or
* version-mismatched file: all four mean "nothing measured yet", which is a valid
* state the pool renders as "untested".
*/
async function readTraePoolProbes(panel) {
	let raw;
	try {
		raw = await readFile(traePoolStorePath(panel), "utf8");
	} catch {
		return {};
	}
	let parsed;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return {};
	}
	if (typeof parsed !== "object" || parsed === null) return {};
	const document = parsed;
	if (document.version !== STORE_FORMAT_VERSION) return {};
	if (typeof document.probes !== "object" || document.probes === null) return {};
	const probes = {};
	for (const [accountId, probe] of Object.entries(document.probes)) {
		if (accountId === "" || !isProbe(probe)) continue;
		const retryAtMs = retryAtMsOf(probe);
		const source = knownProbeSource(probe.source);
		probes[accountId] = {
			outcome: probe.outcome,
			atMs: probe.atMs,
			...source === void 0 ? {} : { source },
			...retryAtMs === void 0 ? {} : { retryAtMs },
			...probe.message === void 0 ? {} : { message: probe.message },
			...probe.accountName === void 0 ? {} : { accountName: probe.accountName },
			...probe.modelId === void 0 ? {} : { modelId: probe.modelId }
		};
	}
	return probes;
}
/**
* A stored source string reduced to a source this build understands.
*
* `isProbe` accepts any string so a newer build's label cannot destroy the
* measurement it describes; this narrows it at the point of use. An unknown value
* becomes `undefined`, which the card renders as "unknown" — the honest answer,
* rather than mislabelling it as one of the two kinds we do know.
*/
function knownProbeSource(value) {
	return value === "test-batch" || value === "live-request" ? value : void 0;
}
/**
* Merge ONE new measurement over the record already stored for that account.
*
* A plain `{ ...existing, ...update }` is wrong here, and the damage is silent.
* The two writers describe the same account at different moments and carry
* different fields:
*
*   - `test-batch` measures the TARGET MODEL deliberately, so it is the writer
*     that can produce a reset point (`retryAtMs`) parsed out of the upstream's
*     own failure body.
*   - `live-request` reports what a real chat request just hit. It often carries
*     no `retryAtMs` at all (a transport blip names no time), and a spread would
*     therefore DELETE the reset point the probe had already resolved.
*
* Measured consequence of the spread (reference implementation, a real
* quota-exhausted account): the probe recorded "quota refreshes 2026-11-01", the
* next live failure rewrote the record without that field, and the pool then
* reported "retry in about 30 minutes" — putting an exhausted account back into
* rotation to be refused again. The correct value was in the file one write
* earlier.
*
* So `retryAtMs` is INHERITED when the update does not state one, and every other
* field is the update's (the newer measurement owns `outcome`, `atMs`, `source`
* and `message`). Inheriting is only about the one field whose absence is not a
* statement: an update that DOES carry a time still overrides, which is what lets
* a fresh, shorter cooldown supersede a stale longer one.
*
* `accountName` is INHERITED for the same reason: its absence is not a statement.
* A writer that could not see the account must not erase the name an earlier
* measurement DID see — that name is the only thing that can identify a member
* whose sign-in has gone.
*
* `modelId` is deliberately NOT inherited (see the field note in
* `account-pool.ts`): it describes THIS measurement, not the account.
*
* Pure and exported so the rule is unit-testable without a filesystem — this is
* exactly the kind of "two writers, one slot" rule that bites silently.
*/
function mergePoolProbe(existing, update) {
	if (existing === void 0) return update;
	const merged = update.accountName === void 0 && existing.accountName !== void 0 ? {
		...update,
		accountName: existing.accountName
	} : update;
	if (update.retryAtMs !== void 0) return merged;
	if (existing.retryAtMs === void 0 || existing.retryAtMs <= update.atMs) return merged;
	return {
		...merged,
		retryAtMs: existing.retryAtMs
	};
}
/**
* Merge measurements into one panel's store and write it atomically.
*
* A MERGE rather than a replace, because batches measure one account at a time and
* a partial failure must not erase what earlier runs learned. An account absent
* from `updates` keeps its previous measurement, and an account present in both is
* combined by {@link mergePoolProbe} rather than overwritten.
*
* Never throws: a failed write loses only the newest measurements, and the
* caller's results are still returned to the user. Surfacing a disk error here
* would fail an operation that actually succeeded.
*/
async function writeTraePoolProbes(panel, updates) {
	if (Object.keys(updates).length === 0) return;
	const path = traePoolStorePath(panel);
	try {
		await withFileLock(path, async () => {
			const existing = await readTraePoolProbes(panel);
			const merged = { ...existing };
			for (const [accountId, update] of Object.entries(updates)) merged[accountId] = mergePoolProbe(existing[accountId], update);
			await writeFileAtomic(path, `${JSON.stringify({
				version: STORE_FORMAT_VERSION,
				probes: merged
			}, null, 2)}\n`, {
				mode: 384,
				dirMode: 448
			});
		});
	} catch {}
}
/**
* Forget one account's measurement, keeping every other row.
*
* Used when the user removes a pool member: its measurement is no longer about a
* member, and leaving it in the file would resurrect a stale `rate-limited` row if
* the account were added back later. Written through the same lock/atomic path so a
* removal cannot interleave with a batch.
*
* The READ also sits inside the lock, like {@link writeTraePoolProbes}'s: a
* delete is a read-modify-write, and a read taken outside the lock snapshots a
* moment that a concurrent batch's write can then be older than — the delete
* would write that stale snapshot back and silently discard the measurements
* the batch had just learned.
*/
async function dropTraePoolProbe(panel, accountId) {
	const path = traePoolStorePath(panel);
	await withFileLock(path, async () => {
		const existing = await readTraePoolProbes(panel);
		if (existing[accountId] === void 0) return;
		const probes = {};
		for (const [id, probe] of Object.entries(existing)) if (id !== accountId) probes[id] = probe;
		await writeFileAtomic(path, `${JSON.stringify({
			version: STORE_FORMAT_VERSION,
			probes
		}, null, 2)}\n`, {
			mode: 384,
			dirMode: 448
		});
	}).catch(() => {});
}
//#endregion
//#region src/model-config.ts
/**
* Parse a secret-free CustomModel debug line emitted by Trae. Optional values
* remain absent when Trae prints None; we must not invent defaults for them.
*/
function parseObservedModelConfig(line) {
	const match = /model_info: CustomModel \{([\s\S]*?)\}\s*(?:trace_id|$)/.exec(line);
	if (match === null) return void 0;
	const body = match[1] ?? "";
	const stringField = (name) => new RegExp(`${name}: "([^"]+)"`).exec(body)?.[1];
	const optionalField = (name) => new RegExp(`${name}: Some\\("([^"]+)"\\)`).exec(body)?.[1];
	const configName = stringField("config_name");
	const modelName = stringField("model_name");
	if (configName === void 0 || modelName === void 0) return void 0;
	const promptSet = optionalField("prompt_set");
	const rawChatFunction = optionalField("raw_chat_function");
	const abVersion = optionalField("ab_versions");
	return {
		configName,
		modelName,
		...promptSet === void 0 ? {} : { promptSet },
		...rawChatFunction === void 0 ? {} : { rawChatFunction },
		...abVersion === void 0 ? {} : { abVersion }
	};
}
//#endregion
//#region src/model-extra-config.ts
function positive(value) {
	return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : void 0;
}
/** Parse only Raw Chat behavior switches observed in Trae's model_extra_config. */
function parseTraeRawChatBehaviorConfig(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
	const raw = value;
	const maxToolcallChars = positive(raw["v3_max_toolcall_chars"]);
	return {
		...typeof raw["pass_back_reasoning"] === "boolean" ? { passBackReasoning: raw["pass_back_reasoning"] } : {},
		...typeof raw["native_function_call"] === "boolean" ? { nativeFunctionCall: raw["native_function_call"] } : {},
		...typeof raw["use_v2_process"] === "boolean" ? { useV2Process: raw["use_v2_process"] } : {},
		...typeof raw["v2_max_mode_enabled"] === "boolean" ? { maxModeEnabled: raw["v2_max_mode_enabled"] } : {},
		...maxToolcallChars === void 0 ? {} : { maxToolcallChars },
		...typeof raw["v3_stream_throttle_enabled"] === "boolean" ? { streamThrottleEnabled: raw["v3_stream_throttle_enabled"] } : {}
	};
}
/** Extract the JSON object from one native model_extra_config parse log line. */
function parseTraeModelExtraConfigLogLine(line) {
	const at = line.indexOf(", raw: ");
	if (at === -1) return void 0;
	const candidate = line.slice(at + 7).trim();
	try {
		return parseTraeRawChatBehaviorConfig(JSON.parse(candidate));
	} catch {
		return;
	}
}
//#endregion
//#region src/redact.ts
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
function maskUserPath(path) {
	return String(path).replace(/([A-Za-z]:\\Users\\)[^\\]+/i, "$1<user>").replace(/([A-Za-z]:\\Documents and Settings\\)[^\\]+/i, "$1<user>").replace(/^(\/(?:Users|home)\/)[^/]+/, "$1<user>");
}
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
function describeNameShape(name) {
	const text = String(name ?? "");
	return `${text.length} 字符${/^\d+$/.test(text) ? "，纯数字" : ""}`;
}
/**
* Describe an identifier by shape instead of by value.
*
* A device id (`x-device-id`) is a stable installation identifier and is
* directly tied to the upstream's per-device rules, so it is never printed.
* Its shape still proves which resolution path ran: a real `icube-dc` id is
* 15 digits, while the fallback is a 32-character hex hash.
*/
function describeIdShape(value) {
	const text = String(value ?? "");
	if (text === "") return "(空)";
	return `${text.length} 位${/^\d+$/.test(text) ? "，纯数字" : "，含非数字"}`;
}
//#endregion
//#region src/raw-envelope.ts
/** Stable JSON hash candidate used by the native DTO's arg/args_hash fields. */
function hashTraeRawChatArg(arg) {
	return createHash("sha256").update(JSON.stringify(arg)).digest("hex");
}
/**
* Evidence-bounded fusion envelope candidate. The native DTO exposes exactly
* arg/args_hash/config_json, but the hash algorithm and config_json contents
* remain candidates until a live response validates them.
*/
function buildTraeFusionRawChatEnvelope(arg, config) {
	return {
		arg: structuredClone(arg),
		args_hash: hashTraeRawChatArg(arg),
		config_json: JSON.stringify(config)
	};
}
//#endregion
//#region src/upstream.ts
/**
* Safe first-stage upstream. Real Trae traffic stays disabled until one
* edition-specific endpoint and wire codec are verified with fixtures.
*/
var UnconfiguredTraeUpstreamClient = class {
	async chatStream(_bodyJson, _signal) {
		return {
			ok: false,
			status: 503,
			kind: "unconfigured",
			message: "Trae upstream protocol is not configured; complete offline protocol verification first"
		};
	}
};
//#endregion
//#region src/image-gen-trae.ts
/**
* Trae 文生图的纯逻辑层：请求体、响应解析、尺寸校验、取图地址解析、SSE 帧。
*
* 与 dsh-connect-workbuddy 的 image-gen.ts 同一分工——本文件只做纯函数与
* 常量，不发网络请求；网络与工具注册在 image-tool.ts。
*
* 协议事实来自 2026-10-25 对 Trae CN 账号的活体探测（tests/live-probe*.spec.ts，
* 结果存 probe2/3/4/5-results.jsonl）：
*   - POST {chat}/api/ide/v1/tool_text_to_image，请求体只有 {prompt, image_size?}
*     被接受；多发 mode_type/request_type/chat_mode/session_id/access_type/
*     image_urls/watermark 等任何已知字段都会被网关 400 拒绝（空 body）。
*     未知字段被忽略（camelCase 字段能过）。
*   - 成功应答是扁平 JSON {message: "success", uri: "<tos 对象 key>"}；
*     业务失败是扁平 {code: 3003, message: "…"}。没有 {code:0,data} envelope。
*   - image_size 校验在 Ark 侧：格式 'WIDTHxHEIGHT' 或预设 2k/3k/4k，
*     总像素 ∈ [3686400, 16777216]（512x512 与 1024x1024 会被拒）；
*     缺省时输出 1920x1920。
*   - 同一路径的 GET（?prompt=<P>&image_size=<S> + x-ide-sign 头）**不是取图**，
*     而是又一次生成：2026-10-26 决定性实测，同一 (prompt, size) 紧接着 GET，
*     回来的是另一个 uri、耗时 27 秒、零像素（等于多扣一张）。曾为它写下的
*     traeImageFetchUrl / computeTraeIdeSign / traeImageSignFields 与签名盐已删除——
*     取图跟 prompt 没有任何关系。
*   - 真正的取图是两步、不再生成（同日实测，零成本）：POST
*     /api/ide/v1/get_resource_url { uri_list: [<tos key>] } →
*     { url_map: { "<key>": "<byteimg 签名 URL>" } }，再直接 GET 那个签名 URL
*     （不带任何 Trae 头）即得图片字节（实测 image/jpeg、1,155,578 字节、
*     头 ffd8ffe0）。签名 URL 带 x-expires，过期重新解析即可。
*   - SSE 端点 tool_text_to_image_stream 的事件名是小写：heartbeat（data:
*     {timestamp_ms, status}）、result（data: {uri}）、done（data:
*     {finish_reason}）。
*   - 计费锚点：1920x1920 一张 ≈ 8.8 积分。
*
* @module dsh-connect-trae/image-gen-trae
*/
/** 文生图（同步）：一次 POST 拿回结果。Trae 客户端的 ToolText2Image 用的就是它。 */
const TRAE_TOOL_TEXT_TO_IMAGE_PATH = "/api/ide/v1/tool_text_to_image";
/** 上游为图像工具固定的模型 id；请求体里没有 model 字段，服务端自选。 */
const TRAE_IMAGE_MODEL = "seedream_5";
/** 尺寸预设：活体确认 '2k','3k','4k' 被 Ark 接受，square/square_hd 等
*  客户端预设名服务端也会翻译（square_hd 实测出 1920x1920）。 */
const TRAE_IMAGE_SIZE_PRESETS = [
	"2k",
	"3k",
	"4k",
	"square",
	"square_hd",
	"landscape",
	"portrait"
];
var TraeImageError = class extends Error {
	code;
	/** 上游业务码（响应里的 code 字段），只在 UPSTREAM 类失败上有值。 */
	serverCode;
	constructor(message, code, serverCode) {
		super(message);
		this.name = "TraeImageError";
		this.code = code;
		this.serverCode = typeof serverCode === "number" ? serverCode : void 0;
	}
};
/** 尺寸合法性：预设名，或 宽x高 且总像素在 Ark 的 [下限,上限] 区间。 */
function isTraeImageSize(value) {
	if (TRAE_IMAGE_SIZE_PRESETS.includes(value)) return true;
	const m = /^([0-9]{3,5})x([0-9]{3,5})$/.exec(value);
	if (m === null) return false;
	const pixels = Number(m[1]) * Number(m[2]);
	return pixels >= 3686400 && pixels <= 16777216;
}
/** 组一次文生图请求体；参数毛病全在这里拦下（INVALID_ARGS，不花积分）。 */
function buildTraeImageBody(input) {
	const prompt = input.prompt.trim();
	if (prompt === "") throw new TraeImageError("trae image: prompt 必须是非空字符串。", "INVALID_ARGS");
	const out = { prompt };
	if (input.size !== void 0 && input.size !== "") {
		const size = input.size.trim().toLowerCase();
		if (!isTraeImageSize(size)) throw new TraeImageError("trae image: 尺寸「" + size + "」不被接受（需 宽x高 且总像素 ∈ [3686400,16777216]，或预设 " + TRAE_IMAGE_SIZE_PRESETS.join("/") + "）。", "INVALID_ARGS");
		out.image_size = size;
	}
	return out;
}
/**
* uri → 可下载 URL 的解析端点。2026-10-26 活体确认：body 必须正是
* `{ uri_list: [<tos key>] }`；其它所有形态（{uri}、{path}、{resource_uri}、
* {uris:[…]}、{resources:[…]}、{scene:'report',uri}、GET ?uri=）都回
* HTTP 200 + 空 url_map——不报错，只是什么都不给。
*/
const TRAE_RESOURCE_URL_PATH = "/api/ide/v1/get_resource_url";
/** 组一次解析请求体；空 uri 在这里拦下（INVALID_ARGS，一分钱没花）。 */
function buildTraeResourceUrlBody(uri) {
	const key = typeof uri === "string" ? uri.trim() : "";
	if (key === "") throw new TraeImageError("trae image: 解析图片地址需要非空的 uri。", "INVALID_ARGS");
	return { uri_list: [key] };
}
/**
* 解析应答里的 url_map。服务端对认不出的 key 就回空表（不报错），
* 所以非字符串/空串条目一律丢弃，由调用方按"缺地址"处理。
*/
function parseTraeResourceUrlMap(json) {
	const raw = (json !== null && typeof json === "object" ? json : {})["url_map"];
	const map = {};
	if (raw === null || typeof raw !== "object") return map;
	for (const [key, value] of Object.entries(raw)) if (typeof value === "string" && value.trim() !== "") map[key] = value.trim();
	return map;
}
/**
* 取该 uri 的签名下载地址。空表 = 服务端认不出这个 key，此时图片已经
* 生成并计费，却拿不到字节——如实抛 IMAGE_UNAVAILABLE，别谎报成功。
*/
function signedTraeResourceUrl(json, uri) {
	const map = parseTraeResourceUrlMap(json);
	const signed = map[uri] ?? map[uri.trim()];
	if (signed === void 0) throw new TraeImageError("trae image: 图片已经生成、积分已经扣了，但服务端没给出可下载地址（url_map 里没有这个 key）：" + uri, "IMAGE_UNAVAILABLE");
	return signed;
}
/** 应答里图片地址的字段名。活体看到的就是 uri；其余字段是 Rust 端
*  ToolcallResultImage 的字段池（tos_uri/display_url/…），留给未来形态。 */
const TRAE_IMAGE_URL_FIELDS = [
	"uri",
	"tos_uri",
	"display_url",
	"image_url",
	"original_url",
	"preview_url",
	"internal_url"
];
/** 深度不超过 4 地扫第一个可用 URL 字段；再深的嵌套不是这个 API 的形态。 */
function findImageUrl(node, depth = 0) {
	if (depth > 4 || node === null || typeof node !== "object") return void 0;
	const record = node;
	for (const field of TRAE_IMAGE_URL_FIELDS) {
		const value = record[field];
		if (typeof value === "string" && value.trim() !== "") return value.trim();
	}
	for (const value of Object.values(record)) if (value !== null && typeof value === "object") {
		const found = findImageUrl(value, depth + 1);
		if (found !== void 0) return found;
	}
}
function findCredit(node, depth = 0) {
	if (depth > 4 || node === null || typeof node !== "object") return void 0;
	const record = node;
	const credit = record.credit;
	if (typeof credit === "number" && Number.isFinite(credit)) return credit;
	for (const value of Object.values(record)) if (value !== null && typeof value === "object") {
		const found = findCredit(value, depth + 1);
		if (found !== void 0) return found;
	}
}
/**
* 解析 tool_text_to_image 的扁平 JSON 应答。
*
* 实测形态：成功 {message:"success", uri:"…"}；失败 {code:3003, message:"…"}。
* code 存在且非 0 → UPSTREAM（原样抛出 code/message——余额不足、风控、
* Ark 参数错误全靠它浮出）；无 code 但 uri 缺失 → EMPTY_RESULT。
*/
function parseTraeImageResponse(json) {
	const record = json !== null && typeof json === "object" ? json : {};
	const code = typeof record.code === "number" ? record.code : void 0;
	const message = typeof record.message === "string" ? record.message : void 0;
	if (code !== void 0 && code !== 0) throw new TraeImageError("trae image: 上游业务错误 code=" + code + (message === void 0 || message === "" ? "" : ": " + message), "UPSTREAM", code);
	const url = findImageUrl(record);
	if (url === void 0) throw new TraeImageError("trae image: 应答里没有图片地址" + (message === void 0 ? "" : "（message=" + message + "）"), "EMPTY_RESULT", code);
	const credit = findCredit(record);
	return credit === void 0 ? { url } : {
		url,
		credit
	};
}
//#endregion
//#region src/image-tool.ts
/**
* trae_draw_image：把 Trae 的文生图能力（客户端与 SOLO 共用的
* /api/ide/v1/tool_text_to_image 端点）暴露成一个 DSH agent 工具。
*
* 与 dsh-connect-workbuddy 的 image-tool.ts 同一注册形态：手写 ToolDefinition、
* 不 import 宿主类型（宿主 Tools.register 只校验 output.render 是函数、
* output.schema 是受支持的 JSON Schema；parameters 原样投影给模型）。
* 这样 bin 可达图不新增任何非 node: 裸说明符（tests/host-peers.spec.ts 的约束）。
*
* 作用域（v1，有意为之）：
*   - 只做文生图。改图（image_urls 传参考图）需要先把本地文件经
*     get_resource_upload_url 预签名上传到 TOS，那是另一条流水线，未接。
*   - 只做文生图同步端点。SSE 端点与 video 端点的常量在 image-gen-trae.ts
*     留档（tool_text_to_image_stream / tool_text_to_video_stream），
*     Trae 的视频结果还要轮询 query_material_result，等真机探针确认后再加。
*
* @module dsh-connect-trae/image-tool
*/
/** 工具名。与其它 connect 插件的命名习惯一致。 */
const TRAE_IMAGE_TOOL_NAME = "trae_draw_image";
/** 单次生图上限。Trae 客户端里一张图 15-45 秒，留足余量。 */
const IMAGE_TOOL_TIMEOUT_MS = 18e4;
/** 失败后的冷却：生图按张扣积分，连续重试会白白烧积分。 */
const FAILURE_COOLDOWN_MS = 3e4;
/** 图片落地目录名，相对会话工作目录。 */
const TRAE_IMAGE_DIR = "trae-images";
function messageOf(error) {
	return error instanceof Error ? error.message : String(error);
}
/** HTTP 层的状态码映射。语义与 workbuddy 侧一致。 */
function mapHttpToImageError(status, detail) {
	const tail = detail === "" ? "" : "：" + detail.slice(0, 200);
	if (status === 401 || status === 403) return new TraeImageError("trae image: 上游拒绝了凭据（HTTP " + status + "）" + tail, "AUTH");
	if (status === 429) return new TraeImageError("trae image: 上游限流（HTTP 429）" + tail, "RATE_LIMIT");
	return new TraeImageError("trae image: 上游 HTTP " + status + tail, "UPSTREAM");
}
/**
* 取图阶段（解析签名地址 / 下载字节）的 HTTP 失败。
*
* 这里**不能**复用 mapHttpToImageError：那套映射是给「生图那一跳」用的，401/403 报
* AUTH、429 报 RATE_LIMIT 都还有意义。到了取图这一跳，图早已生成、积分早已扣掉，
* 再把 403 说成「上游拒绝了凭据」就是谎报——用户会去重新登录，而钱已经花了、图还是
* 拿不到。所以一律归成 IMAGE_UNAVAILABLE，文案保留状态码与原文便于排障，并附上对象
* key。冷却判据只看 code，IMAGE_UNAVAILABLE 同样在冷却集合里，不会因为换了 code 就
* 变成可重试（重试等于再买一张）。
*/
function mapRetrievalHttpError(status, detail, uri) {
	const tail = detail === "" ? "" : "：" + detail.slice(0, 200);
	return new TraeImageError("trae image: 图片已经生成、积分已经扣了，但取图接口回了 HTTP " + status + tail + "\n图片对象 key：" + uri, "IMAGE_UNAVAILABLE");
}
/**
* 发一次真机文生图请求，并把图片字节一起取回来。所有可预期的失败都归一成
* TraeImageError，让上层的冷却判据只看 code（见 createTraeDrawImageTool 的注释）。
*/
var TraeImageClient = class {
	options;
	constructor(options = {}) {
		this.options = options;
	}
	async generate(account, input, signal) {
		const body = buildTraeImageBody(input);
		const endpoint = traeEndpoint(account.baseUrl, TRAE_TOOL_TEXT_TO_IMAGE_PATH);
		const headers = buildTraeHeaders(account.credential, account.identity, { profile: "model-detail" });
		const fetchImpl = this.options.fetchImpl ?? globalThis.fetch;
		const timeoutMs = this.options.timeoutMs ?? IMAGE_TOOL_TIMEOUT_MS;
		const requestSignal = signal ?? AbortSignal.timeout(timeoutMs);
		let response;
		try {
			response = await fetchImpl(endpoint, {
				method: "POST",
				headers,
				body: JSON.stringify(body),
				signal: requestSignal
			});
		} catch (error) {
			throw new TraeImageError("trae image: 生图请求发出失败：" + messageOf(error), "NO_ROUTE");
		}
		let payload;
		try {
			payload = await response.text();
		} catch (error) {
			throw new TraeImageError("trae image: 读取应答失败：" + messageOf(error), "UPSTREAM");
		}
		if (!response.ok) throw mapHttpToImageError(response.status, payload);
		let json;
		try {
			json = JSON.parse(payload);
		} catch {
			throw new TraeImageError("trae image: 应答不是 JSON（HTTP 200）：" + payload.slice(0, 200), "UPSTREAM");
		}
		const outcome = parseTraeImageResponse(json);
		const signed = await this.resolveSignedUrl(account, outcome.url, requestSignal);
		const image = await this.download(signed, requestSignal, outcome.url);
		const result = {
			url: outcome.url,
			bytes: image.bytes,
			mimeType: image.mimeType
		};
		if (outcome.credit !== void 0) result.credit = outcome.credit;
		return result;
	}
	/**
	* 把 tos key 解析成一个可直接 GET 的签名地址（byteimg CDN，带 x-expires）。
	* 这一步只是向服务端要地址，不会重新画图。
	*/
	async resolveSignedUrl(account, uri, signal) {
		const body = buildTraeResourceUrlBody(uri);
		const endpoint = traeEndpoint(account.baseUrl, TRAE_RESOURCE_URL_PATH);
		const headers = buildTraeHeaders(account.credential, account.identity, { profile: "model-detail" });
		const fetchImpl = this.options.fetchImpl ?? globalThis.fetch;
		const requestSignal = signal ?? AbortSignal.timeout(IMAGE_TOOL_TIMEOUT_MS);
		let response;
		try {
			response = await fetchImpl(endpoint, {
				method: "POST",
				headers,
				body: JSON.stringify(body),
				signal: requestSignal
			});
		} catch (error) {
			throw new TraeImageError("trae image: 图片已经生成、积分已经扣了，但解析下载地址的请求发不出去：" + messageOf(error), "IMAGE_UNAVAILABLE");
		}
		let payload;
		try {
			payload = await response.text();
		} catch (error) {
			throw new TraeImageError("trae image: 图片已经生成、积分已经扣了，但读取解析应答失败：" + messageOf(error), "IMAGE_UNAVAILABLE");
		}
		if (!response.ok) throw mapRetrievalHttpError(response.status, payload, uri);
		let json;
		try {
			json = JSON.parse(payload);
		} catch {
			throw new TraeImageError("trae image: 图片已经生成、积分已经扣了，但解析应答不是 JSON（HTTP 200）：" + payload.slice(0, 200), "IMAGE_UNAVAILABLE");
		}
		if (json === null || typeof json !== "object") throw new TraeImageError("trae image: 图片已经生成、积分已经扣了，但解析应答里没有 url_map：" + payload.slice(0, 200), "IMAGE_UNAVAILABLE");
		return signedTraeResourceUrl(json, uri);
	}
	/** 下载签名地址上的图片字节。CDN 不需要任何 Trae 头——签名就在 query 里。 */
	async download(signed, signal, uri) {
		const fetchImpl = this.options.fetchImpl ?? globalThis.fetch;
		const requestSignal = signal ?? AbortSignal.timeout(IMAGE_TOOL_TIMEOUT_MS);
		let response;
		try {
			response = await fetchImpl(signed, {
				method: "GET",
				headers: { Accept: "image/*" },
				signal: requestSignal
			});
		} catch (error) {
			throw new TraeImageError("trae image: 图片已经生成、积分已经扣了，但下载字节失败：" + messageOf(error), "IMAGE_UNAVAILABLE");
		}
		if (!response.ok) {
			const key = uri === void 0 || uri === "" ? "" : "\n图片对象 key：" + uri;
			throw new TraeImageError("trae image: 图片已经生成、积分已经扣了，但下载地址回了 HTTP " + response.status + "。" + key, "IMAGE_UNAVAILABLE");
		}
		let buffer;
		try {
			buffer = await response.arrayBuffer();
		} catch (error) {
			throw new TraeImageError("trae image: 图片已经生成、积分已经扣了，但读取图片字节失败：" + messageOf(error), "IMAGE_UNAVAILABLE");
		}
		if (buffer.byteLength === 0) throw new TraeImageError("trae image: 图片已经生成、积分已经扣了，但下载回来是 0 字节。", "IMAGE_UNAVAILABLE");
		const mimeType = (response.headers.get("content-type") ?? "").split(";")[0]?.trim() ?? "";
		const sniffed = imageMimeTypeOf(new Uint8Array(buffer));
		if (sniffed === void 0) throw new TraeImageError("trae image: 图片已经生成、积分已经扣了，但下载回来的不是图片（content-type " + (mimeType === "" ? "缺失" : mimeType) + "，前 4 字节 " + hexPrefix(new Uint8Array(buffer)) + "）。" + (uri === void 0 || uri === "" ? "" : "\n图片对象 key：" + uri), "IMAGE_UNAVAILABLE");
		return {
			bytes: new Uint8Array(buffer),
			mimeType: sniffed
		};
	}
};
function asRecord(value) {
	return typeof value === "object" && value !== null ? value : {};
}
/**
* 从字节魔数判断图片类型（JPEG / PNG / GIF / WebP / BMP）。
*
* 为什么不信 content-type：签名地址过期或被劫持时，CDN 常拿 200 回一页 HTML。
* 那样写下去的文件扩展名是 .jpg 却打不开，用户只看到碎图标，而积分已经扣了。
* 认不出就返回 undefined，由调用方如实报 IMAGE_UNAVAILABLE。
*/
function imageMimeTypeOf(bytes) {
	const at = (index) => bytes[index] ?? -1;
	if (at(0) === 255 && at(1) === 216 && at(2) === 255) return "image/jpeg";
	if (at(0) === 137 && at(1) === 80 && at(2) === 78 && at(3) === 71) return "image/png";
	if (at(0) === 71 && at(1) === 73 && at(2) === 70) return "image/gif";
	if (at(0) === 82 && at(1) === 73 && at(2) === 70 && at(3) === 70 && at(8) === 87 && at(9) === 69 && at(10) === 66 && at(11) === 80) return "image/webp";
	if (at(0) === 66 && at(1) === 77) return "image/bmp";
}
/** 前若干字节的十六进制，只用于排障文案。 */
function hexPrefix(bytes) {
	return [...bytes.slice(0, 4)].map((value) => value.toString(16).padStart(2, "0")).join("");
}
function asNonEmptyString(value) {
	return typeof value === "string" && value.trim() !== "" ? value.trim() : void 0;
}
/**
* 这些失败码都发生在「生图请求已经发出去」之后或尝试发出它——上游可能已经
* 扣了积分或排了队，连续重试只会把它们再花一遍，所以进冷却。
* INVALID_ARGS / NOT_LOGGED_IN 一分钱没花，不冷却（判据同 workbuddy）。
*/
const BILLABLE_FAILURE_CODES = /* @__PURE__ */ new Set([
	"AUTH",
	"RATE_LIMIT",
	"NO_ROUTE",
	"UPSTREAM",
	"EMPTY_RESULT",
	"IMAGE_UNAVAILABLE"
]);
function isBillableFailure(error) {
	if (error instanceof TraeImageError) return BILLABLE_FAILURE_CODES.has(error.code);
	return true;
}
/** 造出工具定义。每次 apply() 只造一个实例，冷却状态挂在闭包里。 */
function createTraeDrawImageTool(deps) {
	let cooldownUntil = 0;
	return {
		name: TRAE_IMAGE_TOOL_NAME,
		description: "用当前登录的 Trae 账号文生图（TraeWork/SOLO 同款服务，模型 seedream_5）。只在用户明确要一张图时调用：每张真实扣该账号积分，实测 CN 个人版 1920x1920 一张约 8.8 积分（尺寸越大越贵），而上游不回传扣费数字，以 Trae 额度面板为准。不是常开能力：只有插件设置里为该区打开「允许模型自主生图」(drawImageEnabled) 时本工具才存在，没打开就没得调——不要用报错去试探它开没开。取图口径：生成成功后本工具会把图片字节取回来、写进会话工作目录的 trae-images/ 下，结果里给相对路径 path，渲染层已经据此把图显示给用户了——不需要你再写 markdown。取图走 get_resource_url 解析签名地址（只是要地址，不会重新生成、不额外计费）。不要为了\"取图\"或\"换张\"重跑同一条 prompt（那会再扣一张）。失败码 IMAGE_UNAVAILABLE 表示图已生成、积分已扣、但字节没落地：同样不要重跑。失败后有 30 秒冷却，冷却内重试不会打到上游。尺寸：默认 1920x1920，也可给 宽x高（总像素需在 3686400~16777216 之间，如 2048x2048）或预设 2k/3k/4k；过小（如 1024x1024）会被上游直接拒绝。（改图与文生视频暂未开放：改图需要先走 TOS 上传预签名，视频要轮询素材结果。）",
		parameters: {
			type: "object",
			properties: {
				prompt: {
					type: "string",
					description: "画面描述（中文或英文都可以）。写清楚主体、风格、构图、光线。"
				},
				size: {
					type: "string",
					description: "图片尺寸：默认 1920x1920；也可给 宽x高（总像素 3686400~16777216，如 2048x2048）或预设 2k/3k/4k。过小（如 1024x1024）会被上游拒绝。"
				}
			},
			required: ["prompt"],
			additionalProperties: false
		},
		output: {
			schema: {
				type: "object",
				properties: {
					url: {
						type: "string",
						description: "Trae 图片对象 key（tos uri），留作记录与排障，不是可直接打开的 URL。"
					},
					path: {
						type: "string",
						description: "图片文件相对会话工作目录的路径（如 trae-images/trae-20261026-041500-ab12cd.jpg）；渲染层已据此显示图片。"
					},
					model: {
						type: "string",
						description: "实际使用的生图模型 id。"
					},
					prompt: {
						type: "string",
						description: "实际提交的画面描述。"
					},
					size: {
						type: "string",
						description: "实际提交的尺寸。"
					},
					hint: {
						type: "string",
						description: "给模型的后续提示（图片位置、扣费口径）。"
					},
					credit: {
						type: "number",
						description: "上游若回传扣费数字，这里给出积分数。"
					}
				},
				required: [
					"url",
					"path",
					"model",
					"prompt",
					"size",
					"hint"
				],
				additionalProperties: false
			},
			render(_args, value) {
				const record = asRecord(value);
				const url = asNonEmptyString(record["url"]) ?? "";
				const path = asNonEmptyString(record["path"]) ?? "";
				const model = asNonEmptyString(record["model"]) ?? "unknown";
				const size = asNonEmptyString(record["size"]) ?? "";
				const credit = typeof record["credit"] === "number" ? record["credit"] : void 0;
				const hint = asNonEmptyString(record["hint"]) ?? "";
				const lines = path === "" ? ["图片已生成，但字节没取回来（只有对象 key）：`" + url + "`"] : ["![Trae 文生图](" + path + ")"];
				lines.push("", "文生图 · 模型：" + model + (size === "" ? "" : " · 尺寸：" + size) + (credit === void 0 ? "" : " · 消耗 " + credit + " 积分"));
				if (hint !== "") lines.push("", hint);
				return [{
					type: "text",
					text: lines.join("\n")
				}];
			}
		},
		timeoutMs: IMAGE_TOOL_TIMEOUT_MS,
		async execute(args, exec) {
			const record = asRecord(args);
			const prompt = asNonEmptyString(record["prompt"]);
			if (prompt === void 0) throw new TraeImageError("trae_draw_image: 参数 prompt 必填，且必须是非空字符串。", "INVALID_ARGS");
			const size = asNonEmptyString(record["size"]) ?? "1920x1920";
			const now = Date.now();
			if (now < cooldownUntil) throw new TraeImageError("trae image: 上一次生图刚失败过，请 " + Math.ceil((cooldownUntil - now) / 1e3) + " 秒后再试（失败冷却是为了避免连续重试白白烧积分）。", "COOLDOWN");
			const account = await deps.resolveAccount();
			if (account === void 0) throw new TraeImageError("trae image: 没有可用的 Trae 账号——要么相关区都没登录，要么已登录的那个区没有打开「允许模型自主生图」（drawImageEnabled）。请先登录 Trae 并在插件设置里打开那个开关。", "NOT_LOGGED_IN");
			const signal = exec.signal === void 0 ? AbortSignal.timeout(IMAGE_TOOL_TIMEOUT_MS) : AbortSignal.any([exec.signal, AbortSignal.timeout(IMAGE_TOOL_TIMEOUT_MS)]);
			try {
				const outcome = await deps.generate(account, {
					prompt,
					size
				}, signal);
				const saved = await saveTraeImage(await deps.directoryOf?.(exec) ?? sessionCwdOf(exec) ?? process.cwd(), outcome);
				const value = {
					url: outcome.url,
					path: saved.relativePath,
					model: TRAE_IMAGE_MODEL,
					prompt,
					size,
					hint: "这张图来自 Trae 文生图（模型 seedream_5），按张计入该账号积分（实测 1920x1920 约 8.8，上游不回传数字，以 Trae 额度面板为准）。图片已保存到会话目录下的 " + saved.relativePath + "（绝对路径 " + saved.absolutePath + "），渲染层已经把它显示给用户了，不需要你再写 markdown。不要为了取图或换张重跑同一条 prompt——那会再扣一张。"
				};
				if (outcome.credit !== void 0) value.credit = outcome.credit;
				return value;
			} catch (error) {
				if (isBillableFailure(error)) cooldownUntil = Date.now() + FAILURE_COOLDOWN_MS;
				throw error;
			}
		}
	};
}
/** 从 exec 里读会话工作目录（宿主没给就返回 undefined）。 */
function sessionCwdOf(exec) {
	const session = exec.agent?.session;
	return nonEmptyPath(session?.workingDirectory) ?? nonEmptyPath(session?.header?.cwd) ?? nonEmptyPath(session?.cwd) ?? nonEmptyPath(exec.cwd);
}
/** 只在真拿到非空字符串时返回它（空串/空白/null 一律当「不知道」）。 */
function nonEmptyPath(value) {
	if (typeof value !== "string") return void 0;
	return value.trim() === "" ? void 0 : value;
}
/** mime → 文件后缀（上游目前只回 image/jpeg）。 */
function imageExtensionFor(mimeType) {
	const type = mimeType.toLowerCase();
	if (type.includes("png")) return "png";
	if (type.includes("webp")) return "webp";
	if (type.includes("gif")) return "gif";
	return "jpg";
}
/** 文件名：本地时间的可排序时间戳 + 随机后缀，同一秒两张图也不会互相覆盖。 */
function imageFileName(mimeType, now) {
	const date = new Date(now);
	const pad = (value) => String(value).padStart(2, "0");
	const stamp = String(date.getFullYear()) + pad(date.getMonth() + 1) + pad(date.getDate()) + "-" + pad(date.getHours()) + pad(date.getMinutes()) + pad(date.getSeconds());
	const rand = Math.random().toString(16).slice(2, 8);
	return "trae-" + stamp + "-" + rand + "." + imageExtensionFor(mimeType);
}
/**
* 把图片字节写成 <cwd>/trae-images/<name>，返回绝对路径与相对路径。
* 相对路径给 render 用：DSH 的聊天按 session cwd 解析 markdown 图片地址，
* 再过 api/file 鉴权路由取字节，所以相对路径就能显示。
*/
async function saveTraeImage(cwd, outcome) {
	const name = imageFileName(outcome.mimeType, Date.now());
	const directory = join(cwd, TRAE_IMAGE_DIR);
	try {
		await mkdir(directory, { recursive: true });
		const absolutePath = join(directory, name);
		await writeFile(absolutePath, outcome.bytes);
		return {
			absolutePath,
			relativePath: "trae-images/" + name
		};
	} catch (error) {
		throw new TraeImageError("trae image: 图片已经生成、积分已经扣了，但写入本地文件失败（目录 " + directory + "）：" + messageOf(error) + "\n图片对象 key：" + outcome.url, "IMAGE_UNAVAILABLE");
	}
}
/**
* 把工具注册进宿主。返回 disposer；调用方负责在插件卸载时调用它。
* 注册失败只记警告——生图工具缺失不该让整个插件起不来（同 workbuddy）。
*/
function registerTraeDrawImageTool(tools, deps) {
	try {
		return tools.register(createTraeDrawImageTool(deps));
	} catch (error) {
		deps.logger.warn("dsh-connect-trae: 注册 trae_draw_image 失败: " + messageOf(error));
		return;
	}
}
//#endregion
//#region src/index.ts
const name = "dsh-connect-trae";
const inject = ["llm"];
/**
* Settings namespace, as a plain lowercase literal. DSH 0.1.2 removed the
* `settingsNamespace` brand constructor from the npm package, and every
* consumer of this constant takes it as a kebab string — so no branding is
* needed. It is the FALLBACK namespace; the namespace the host actually serves
* comes from {@link settingsNamespaceOf} (0.1.7 keys settings by the Loader
* entry id, which a profile patch may mount as `dsh-connect-trae` or
* `include:dsh-connect-trae`).
*/
const TRAE_SETTINGS_NS = "trae";
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
function settingsNamespaceOf(ctx) {
	const id = ctx?.fiber?.entry?.options?.id;
	return typeof id === "string" && id !== "" ? id : TRAE_SETTINGS_NS;
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
function regionStateOf(config, panel) {
	const stored = unwrapVolatile(unwrapVolatile(config.regions)?.[panel]);
	if (stored !== void 0) return stored;
	if (panel !== "cn") return {};
	return {
		...config.lastCatalog === void 0 ? {} : { lastCatalog: config.lastCatalog },
		...config.enabledModelIds === void 0 ? {} : { enabledModelIds: config.enabledModelIds },
		...config.imageModelIds === void 0 ? {} : { imageModelIds: config.imageModelIds },
		...config.contextBudgets === void 0 ? {} : { contextBudgets: config.contextBudgets }
	};
}
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
function regionEnabled(config, panel) {
	const stored = regionStateOf(config, panel).enabled;
	if (stored !== void 0) return stored !== false;
	return panel !== "enterprise";
}
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
function creditPosition(config, region) {
	return regionStateOf(config, region).creditPosition === "stats" ? "stats" : "composer";
}
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
function asVolatile(schema) {
	if (typeof schema.volatile === "function") return schema.volatile();
	return schema;
}
const modelConfig = z.object({
	id: z.string().required(),
	name: z.string().required(),
	contextWindow: z.number().step(1).min(1),
	maxTokens: z.number().step(1).min(1),
	input: z.array(z.union(["text", "image"])),
	creditMultiplier: z.number(),
	wireFunction: z.string(),
	wireConfigName: z.string(),
	multimodal: z.boolean(),
	activityDiscount: z.any()
});
/**
* One panel's saved state. Panels are keyed `cn | enterprise | ai` — see
* {@link TraePanel}; `enterprise` is a second CN provider with its own switch,
* account binding and model selection.
*/
const regionStateConfig = z.object({
	enabled: z.boolean().description("Whether this panel's provider is offered to DSH (false withdraws it entirely)"),
	lastCatalog: z.array(modelConfig).default([]),
	enabledModelIds: z.array(z.string()).default([]),
	imageModelIds: z.array(z.string()).default([]),
	drawImageEnabled: z.boolean().default(false).description("Allow the model to generate images with trae_draw_image on this panel (consumes credits; default off)"),
	contextBudgets: z.dict(z.number().step(1).min(1)).default({}),
	creditPosition: z.union([z.const("composer"), z.const("stats")]).default("composer").description("积分读数显示位置：\"composer\" = 输入框工具栏（默认），\"stats\" = 输入框下方（与「轮次 / 步数 / token」统计同一行）。装了别的插件后读数不显示时改成 stats。"),
	pool: z.object({
		enabled: z.boolean().default(false).description("账号池：打开后本面板由池中可用账号轮流计费（关闭时按下面的绑定账号）"),
		targetModelId: z.string().default("").description("账号池测速使用的模型 id（留空 = 自动选择免费模型）"),
		memberAccountIds: z.array(z.string()).default([]).description("加入本面板账号池的账号 id（显式勾选，默认为空）"),
		probeInputTokens: z.number().default(0).description("账号池测试请求填充的 token 量（0 = 最小请求，不填充）")
	}).default({})
});
const accountSelectionConfig = z.object({
	cn: z.string().description("Selected domestic (CN) account id (never a token)"),
	ai: z.string().description("Selected international account id (never a token)"),
	enterprise: z.string().description("Selected account id for the CN enterprise pool (never a token)")
});
const Config = z.object({
	authFile: asVolatile(z.string().description("Optional Trae storage.json path override")),
	edition: asVolatile(z.union([
		"auto",
		"cn",
		"sg",
		"solo",
		"solo-sg"
	]).default("auto").description("Trae edition hint")),
	accountId: z.string().description("Deprecated: pre-split account selector, attributed to its own region"),
	showPointsInMainUi: asVolatile(z.boolean().default(false).description("在输入框工具栏显示积分读数「Trae CN · <数值>」（仅当选中的模型属于本插件时出现，可点击查看账号与积分明细）")),
	accounts: asVolatile(accountSelectionConfig.description("Per-panel account selections, keyed cn | enterprise | ai")),
	regions: asVolatile(z.dict(regionStateConfig).default({}).description("Per-panel model directory and selection, keyed cn | enterprise | ai")),
	lastCatalog: z.array(modelConfig).description("Deprecated: pre-region-split CN model directory"),
	enabledModelIds: z.array(z.string()).default([]).description("Deprecated: pre-region-split CN selection"),
	contextBudgets: z.dict(z.number().step(1).min(1)).default({}).description("Deprecated: pre-region-split CN context budgets"),
	imageModelIds: z.array(z.string()).default([]).description("Deprecated: pre-region-split CN image opt-in"),
	models: z.array(modelConfig).description("Legacy generated Trae model list")
});
/** Every region, in card tab order. */
const REGION_KEYS = ["cn", "ai"];
/**
* How long a measured check-in state stays usable (issue #77).
*
* The upstream rewards ONE check-in per device per day, so a figure measured
* minutes ago cannot have changed; re-reading it is a pure upstream round-trip.
* Ten minutes matches the sibling plugin's cache and is comfortably shorter than
* a day, so a genuine second check-in still shows up on the next poll after it.
*/
const CHECKIN_CACHE_MS = 6e5;
/**
* What ONE failed real request means for the account that served it (issue #44).
*
* The shim only reports account-scoped kinds here, so this table never has to
* interpret `not_found` (a model the account cannot see) or `client` (our own bad
* body) — both would exclude a healthy account for good over something that is
* not about the account at all.
*
* `credential-rejected` is the one permanent entry, and deliberately so: a 401
* from the chat gateway means the stored token cannot be refreshed into one that
* works, and the honest recovery is a re-login (which the card offers), not a
* silent retry every half hour.
*/
const POOL_OUTCOME_BY_KIND = {
	authentication: "credential-rejected",
	hard_credit: "out-of-credit",
	soft_rate: "rate-limited",
	server: "unavailable",
	not_found: "not-found",
	client: "failed",
	unconfigured: "failed"
};
function apply(ctx, config) {
	const settingsNs = settingsNamespaceOf(ctx);
	/** DSH settings service，供本地账号切换路由持久化 `accounts.<panel>`。 */
	let settingsService;
	/**
	* 与原生设置页「保存选中账号」完全同构的写入。
	*
	* `accounts` 是 `{ cn, ai, enterprise }` 字典，这里整份合并后写回，
	* 不会抹掉其它面板的选中。settings 尚未注入时抛错，由路由 best-effort
	* 吞掉（own 文件排序已经保证重启后仍生效）。
	*/
	async function setAccountSelection(panel, accountId) {
		if (settingsService === void 0) throw new Error("settings service not available");
		const current = unwrapVolatileDeep(config.accounts) ?? {};
		await settingsService.mutate(settingsNs, [{
			op: "set",
			path: ["accounts"],
			value: { ...current, [panel]: accountId }
		}], void 0);
	}
	let current = () => config;
	const enabledSet = (value, panel) => new Set(regionStateOf(value, panel).enabledModelIds ?? []);
	const imageSet = (value, panel) => new Set(regionStateOf(value, panel).imageModelIds ?? []);
	/**
	* Per-region wire state. Each region's discovery owns its own maps: the CN
	* and international rosters overlap (and spell some ids differently), so a
	* shared map would let one region's answer filter the other region's
	* catalog. Display keys (lowercased id AND name) of every model known to be
	* callable via `llm_utils_chat` are recorded by that region's discovery; a
	* model whose id and name are both absent is a dead config_name (Remote
	* advertises it, `get_detail_param` has no match, e.g. `Doubao-Seed-Code` /
	* `glm-5.3`) and must never be served — even from a stale saved
	* `lastCatalog` / `models` / `enabledModelIds` that still lists it.
	*/
	const wireState = {};
	for (const panel of TRAE_PANELS) wireState[panel] = {
		callableKeys: /* @__PURE__ */ new Set(),
		resolved: false,
		byId: /* @__PURE__ */ new Map(),
		byName: /* @__PURE__ */ new Map()
	};
	/**
	* Warm the wire map before anything spends quota.
	*
	* The bridge resolves a model's directory function from the wire map,
	* falling back to the catalog row. Right after a restart neither may be
	* populated yet — discovery only runs when the host refreshes its model list
	* — and a probe sent without the function is answered `4001` for every model
	* that a non-default function serves (`Doubao-Seed-Code` lives on
	* `solo_agent_remote`). One discovery here is cheaper than telling the user
	* that a working account is unavailable.
	*/
	const warmWireMap = async (panel) => {
		if (wireState[panel].resolved) return;
		try {
			await stacks[panel].discoverModels();
		} catch {}
	};
	const dropDeadModels = (rows, panel) => {
		const wire = wireState[panel];
		if (!wire.resolved) return rows;
		return rows.filter((model) => wire.callableKeys.has(model.id.trim().toLowerCase()) || wire.callableKeys.has(model.name.trim().toLowerCase()));
	};
	const fallbackModels = (value, panel) => applyImageSelection(fallbackModelsFor(regionOfPanel(panel)), imageSet(value, panel));
	const derive = (value, raw, panel) => {
		const selectedImages = imageSet(value, panel);
		const derived = deriveCatalog(applyImageSelection(sanitizeCatalog(dropDeadModels(raw, panel)), selectedImages), enabledSet(value, panel), regionStateOf(value, panel).contextBudgets ?? {});
		return derived.length > 0 ? derived : fallbackModels(value, panel);
	};
	const configuredModels = (value, panel) => {
		const state = regionStateOf(value, panel);
		return state.lastCatalog?.length ? derive(value, state.lastCatalog, panel) : panel === "cn" && value.models?.length ? derive(value, value.models, panel) : fallbackModels(value, panel);
	};
	const displayModels = (value, panel) => {
		const state = regionStateOf(value, panel);
		return state.lastCatalog?.length ? dropDeadModels(sanitizeCatalog(state.lastCatalog), panel) : panel === "cn" && value.models?.length ? dropDeadModels(sanitizeCatalog(value.models), panel) : fallbackModelsFor(regionOfPanel(panel));
	};
	/**
	* Legacy migration for the pre-split single `accountId`: its region is
	* resolved once from the local account scan and the selection is then
	* attributed to that region ONLY — the other region keeps its documented
	* default (first discovered account of that region) instead of silently
	* inheriting a selection that belongs to the other side of the split.
	*/
	let legacyAccountRegion;
	/**
	* Which account a panel is bound to.
	*
	* Keyed by PANEL: the enterprise pool draws on the same CN credentials but
	* keeps its OWN binding, so pointing the consumer tab at a personal account
	* never moves the enterprise tab (and vice versa). A panel with no explicit
	* binding falls through to that REGION's default selection, which is the
	* store's own "preferred account for this region".
	*/
	const effectiveAccountFor = (panel, value) => {
		const explicit = unwrapVolatile(value.accounts)?.[panel];
		if (explicit !== void 0) return explicit;
		const region = regionOfPanel(panel);
		if (panel === "enterprise") return void 0;
		return legacyAccountRegion === region ? value.accountId : void 0;
	};
	/**
	* Retry a directory read once. The gateways answer an intermittent 401 for a
	* credential that works moments later (observed 2026-09-15), and a failed
	* skeleton read would otherwise drop the runtime catalog back to the saved
	* snapshot — hiding every model added since that save (issue #7's glm-5.3
	* among them).
	*/
	async function withDirectoryRetry(read) {
		try {
			return await read();
		} catch (first) {
			await new Promise((resolve) => setTimeout(resolve, 800));
			try {
				return await read();
			} catch {
				throw first;
			}
		}
	}
	/**
	* One stack per PANEL.
	*
	* `cn` and `enterprise` share a credential REGION but not a directory, a wire
	* map or a model selection: the two pools publish different rosters, so a
	* shared catalog would let one pool's answer filter the other's models. Each
	* panel therefore gets its own catalog, wire state, clients and shim routes,
	* and the credential store below is the only thing they have in common.
	*/
	const stacks = {};
	for (const panel of TRAE_PANELS) {
		const region = regionOfPanel(panel);
		/**
		* Whether tenant (enterprise) accounts are also offered by the CONSUMER
		* panels.
		*
		* Off by default, so a published build offers an enterprise login only
		* under the enterprise panel. Opt-in per machine, and intentionally not
		* surfaced in user-facing documentation.
		*/
		const tenantLocal = process.env["DSH_TRAE_TENANT_IN_CONSUMER"] === "1";
		const catalog = new TraeCatalog(region);
		const wire = wireState[panel];
		/**
		* Best-effort device identity for this region's installation. Prefer the
		* selected credential's own edition so an international account reads its
		* own installation's identity (machine/device ids are per-install),
		* mirroring the credential store's account binding; the explicit `edition`
		* config still wins as the user's own narrowing. Candidates are then
		* narrowed to THIS region's editions, so the CN stack can never read an
		* international install's identity (and vice versa).
		*/
		const identity = async () => {
			let preferred;
			try {
				preferred = (await store.current())?.edition;
			} catch {}
			const authFile = unwrapVolatile(config.authFile);
			const edition = unwrapVolatile(config.edition);
			const hint = (edition !== void 0 && edition !== "auto" ? edition : void 0) ?? preferred;
			return resolveTraeIdentity(authFile === void 0 ? traeStorageCandidates().filter((item) => item.source === "desktop" && (hint !== void 0 ? item.edition === hint : regionOfEdition(item.edition) === region)) : [{
				edition: hint ?? (region === "ai" ? "sg" : "solo"),
				path: authFile,
				source: "desktop"
			}], hint ?? (region === "ai" ? "solo-sg" : "cn"));
		};
		/**
		* The current refresh contract signs a DeviceProof with the install's own
		* registered keypair, so every field the server reads must come from the
		* SAME installation the credential belongs to.
		*
		* Resolution failures leave `deviceKeyPair` absent, and the refresh then
		* degrades to the superseded contract instead of sending an unsigned
		* request the server answers with `20405 Device proof required`.
		*/
		const refreshDeviceSafe = async () => {
			try {
				const value = await identity();
				return {
					deviceId: value.deviceId,
					machineId: value.machineId,
					...value.deviceName === void 0 ? {} : { deviceName: value.deviceName },
					...value.deviceModel === void 0 ? {} : { deviceModel: value.deviceModel },
					...value.deviceBrand === void 0 ? {} : { deviceBrand: value.deviceBrand },
					...value.deviceCpu === void 0 ? {} : { deviceCpu: value.deviceCpu },
					...value.osVersion === void 0 ? {} : { osVersion: value.osVersion },
					...value.appVersion === void 0 ? {} : { appVersion: value.appVersion },
					...value.deviceKeyPair === void 0 ? {} : { deviceKeyPair: value.deviceKeyPair }
				};
			} catch {
				return;
			}
		};
		const store = new TraeCredentialStore({
			region,
			...panel === "enterprise" ? { requireTenant: true } : { hideTenantAccounts: !tenantLocal },
			...unwrapVolatile(config.authFile) === void 0 ? {} : { storagePath: unwrapVolatile(config.authFile) },
			edition: unwrapVolatile(config.edition) ?? "auto",
			refresh: async (credential) => refreshTraeCredential(credential, void 0, await refreshDeviceSafe())
		});
		const solo = new TraeSoloUpstreamClient({
			credential: () => store.resolve(),
			identity,
			...panel === "enterprise" ? { route: "enterprise" } : {},
			log: (message, detail) => ctx.logger.warn(message, detail)
		});
		const remoteCatalog = new TraeSoloRemoteCatalogClient({
			credential: () => store.resolve(),
			log: (message, detail) => ctx.logger.warn(message, detail),
			/**
			* The TENANT directory, UNIONED into the consumer one (issue #46).
			*
			* This is the "reads both pools" half of the routing note below, which
			* was intent without an implementation: only the consumer host was ever
			* asked. The `Solo` client above is routed, but THIS one is not — and
			* `solo.trae.cn`, the primary it lands on, does not publish every model a
			* tenant credential can call.
			*
			* Measured 2026-10-24 on the reporter's live CN tenant credential:
			* `solo.trae.cn` answered 36 ids with no `DeepSeek-V4.1-Flash-1017`;
			* `console.enterprise.trae.cn` answered 24 that include it, and the
			* gateway really dispatching a distinct backend for it
			* (`deepseek-v4.1-flash-economic-ark`, vs `deepseek-v4.1-flash-ark` for
			* the plain id) is how issue #46's report was confirmed.
			*
			* UNION, never replace, and never a fallback candidate. The primary is
			* the richer host — 19 of its ids are absent from the tenant answer,
			* including the `deepseek-v4.1-flash` the reporter has saved — so
			* replacing it would trade one missing model for nineteen. And a
			* candidate base cannot work at all: the base loop returns on the first
			* host that answers, and the primary always answers.
			*
			* Gated on a tenant pool being bindable here (an enterprise panel, or a
			* consumer panel under `DSH_TRAE_TENANT_IN_CONSUMER`). A personal
			* consumer account has nothing to gain from the tenant host, so it is not
			* made to pay the extra request.
			*
			* The fix is not about 1017 specifically: the tenant host is a second
			* pool, and every model it alone serves was invisible for the same
			* reason. Verified against the live hosts: 0 rows lost, 0 duplicated.
			*
			* The client decides WHEN to ask it, not this construction site: the
			* deciding fact is whether the credential being resolved is a tenant one,
			* which does not exist until `credential()` runs. Gating on the panel here
			* missed the reporters most likely to hit #46 in the first place — a
			* consumer store does not hard-exclude tenant accounts (`auth.ts`'s
			* `offered()` backs off when the filter would hide everything), so a
			* machine whose only login is a tenant account resolves one under the
			* Trae panel too, and an enterprise-panel-only gate never opened the
			* union for it. `unionRegion` additionally keeps an `ai` credential from
			* asking a `cn` host, which the old `DSH_TRAE_TENANT_IN_CONSUMER` gate on
			* its own did not.
			*
			* Providing the host unconditionally is therefore safe: a personal
			* credential and an `ai` credential both skip it before any request is
			* made, so neither pays for a pool it cannot use.
			*/
			unionBaseUrls: [`${TRAE_ENTERPRISE_HOST}/api/remote/v1`],
			unionRegion: "cn"
		});
		/**
		* The IDE's own roster: which models the vendor's picker shows, per
		* function (issue #52).
		*
		* It is a REFINEMENT of a successful discovery, never a dependency: every
		* failure path in {@link TraeOfficialRosterClient.fetch} collapses to
		* `undefined`, and `applyOfficialRoster` then keeps every row. That is why
		* this can be wired in without a setting — it only acts where every chat
		* function hides a config (retire it) or where the vendor shows it on a
		* DIFFERENT chat function than the one we guessed (re-pin). Both are the
		* upstream's own answers, and both leave anything ambiguous alone.
		*/
		const officialRoster = new TraeOfficialRosterClient({
			credential: () => store.resolve(),
			identity,
			...panel === "enterprise" ? { route: "enterprise" } : {},
			log: (message, detail) => ctx.logger.warn(message, detail)
		});
		const wireResolver = (displayId) => wire.byId.get(displayId) ?? wire.byName.get(displayId.trim().toLowerCase());
		/**
		* One client + bridge per provider id.
		*
		* `routeOfTraeProvider` pins each to its billing pool: the consumer ids get
		* the region gateway exactly as before, `trae-enterprise` gets the tenant
		* gateway and stamps the `session_id` it requires. The discovery client
		* below stays UNROUTED on purpose — it owns the roster/probe path and, for
		* a tenant credential, reads both pools so the shared catalogue keeps every
		* model either one serves. That second pool is supplied by `unionBaseUrls`
		* at the catalog client above, which is what makes this paragraph true;
		* routing THIS client instead would have read one pool and dropped the
		* other (see the note there, and issue #46).
		*/
		/**
		* Latest successful discovery for this panel, mutated by discoverModels
		* and READ by applySelection (via the stack): a settings write rebuilds
		* the catalog from saved rows that may predate wireConfigName, and the
		* merge below is what keeps the case mapping alive across it.
		*/
		const latestDiscovery = [];
		const routeClients = {};
		const shimRoutes = [];
		for (const provider of [providerOfPanel(panel)]) {
			const route = routeOfTraeProvider(provider) ?? "solo";
			const client = new TraeSoloUpstreamClient({
				credential: () => store.resolve(),
				identity,
				route,
				log: (message, detail) => ctx.logger.warn(message, detail)
			});
			const delegating = new TraeDelegatingUpstreamClient(new TraeSoloBridge(client, catalog, wireResolver, (message, detail) => ctx.logger.warn(message, detail)));
			routeClients[provider] = {
				provider,
				route,
				client,
				upstream: delegating,
				secret: ""
			};
			shimRoutes.push({
				label: route,
				client: delegating,
				pool: poolShimHooksOf(panel)
			});
		}
		const shim = createTraeShim({
			catalog,
			routes: shimRoutes,
			logger: ctx.logger
		});
		for (const entry of Object.values(routeClients)) entry.secret = shim.tokenOf(entry.route);
		/**
		* The region's PRIMARY provider plumbing, used by region-wide paths that
		* are not pool-specific: model probing, Raw-Chat status, and the stack's
		* `delegating` handle. Per-provider turns never go through this.
		*/
		const primary = routeClients[providerOfPanel(panel)];
		let rawDiagnostic = () => ({ state: "disabled" });
		if (panel === "cn") (async () => {
			try {
				const resolved = await resolveTraeRawRuntime(store, "qwen-3.7-plus");
				const gateway = createTraeRawGateway({
					raw: new TraeRawChatUpstreamClient({
						credential: () => store.resolve(),
						identity: async () => resolved.identity,
						config: {
							model: resolved.runtime.modelName,
							configName: resolved.runtime.configName,
							passBackReasoning: true,
							runtime: resolved.runtime
						}
					}),
					solo: new TraeSoloBridge(primary.client, catalog, wireResolver, (message, detail) => ctx.logger.warn(message, detail)),
					endpoint: `${REGION_GATEWAYS.cn.chat}/api/ide/v2/llm_raw_chat`,
					edition: resolved.identity.edition,
					identity: {
						appVersion: resolved.identity.appVersion ?? "",
						buildVersion: resolved.identity.buildVersion ?? ""
					},
					runtime: resolved.runtime,
					enabled: false
				});
				primary.upstream.replace(gateway.upstream);
				rawDiagnostic = () => gateway.diagnostic();
				ctx.effect(() => () => gateway.invalidate(), "dsh-connect-trae: Raw capability invalidation");
			} catch (error) {
				ctx.logger.warn("dsh-connect-trae: Raw gateway unavailable; continuing with native SOLO tool-call channel", error);
			}
		})();
		const usageClient = new TraeUsageClient({
			credential: () => store.resolve(),
			deviceId: async () => (await identity()).deviceId
		});
		stacks[panel] = {
			region,
			store,
			catalog,
			shim,
			lastDiscovery: latestDiscovery,
			delegating: routeClients[providerOfPanel(panel)]?.upstream,
			routeClients,
			usageClient,
			/**
			* Credit balance of one named account, WITHOUT rebinding the store
			* (issue #25). The card asks this only after it saw the bound account
			* come back empty, so it can point at a login that still works.
			*
			* A throwaway client is used on purpose: the shared `usageClient` reads
			* `store.resolve()`, which is bound to the selected account, and calling
			* `selectAccount` to look at a neighbour would both race concurrent chat
			* requests and persist a switch the user never made. The credential is
			* resolved (not merely looked up) so an account whose short-lived access
			* token lapsed overnight still answers: its refresh token is good for
			* months, and reporting `—` for a recoverable account is a lie.
			*/
			creditsOfAccount: async (accountId) => {
				const credential = await store.resolveCredentialOf(accountId);
				if (credential === void 0) return void 0;
				return toCredits(await new TraeUsageClient({ credential: async () => credential }).snapshot());
			},
			accountStateOf: async (accountId) => {
				const state = { id: accountId };
				const selectedCredential = await store.current();
				const client = selectedCredential !== void 0 && traeAccountId(selectedCredential) === accountId ? usageClient : (() => {
					const credential = store.resolveCredentialOf(accountId);
					return new TraeUsageClient({
						credential: async () => credential,
						deviceId: async () => (await identity()).deviceId
					});
				})();
				if (region === "ai") {
					state.payStatus = await client.payStatus();
					return state;
				}
				const [snapshot, checkin] = await Promise.allSettled([client.snapshot(), client.checkinStatus()]);
				if (snapshot.status === "fulfilled") state.credits = toCredits(snapshot.value);
				if (checkin.status === "fulfilled") state.checkin = toCheckin(checkin.value);
				return state;
			},
			claimCheckinOf: async (accountId) => {
				const selectedCredential = await store.current();
				const client = selectedCredential !== void 0 && traeAccountId(selectedCredential) === accountId ? usageClient : (() => {
					const credential = store.resolveCredentialOf(accountId);
					return new TraeUsageClient({
						credential: async () => credential,
						deviceId: async () => (await identity()).deviceId
					});
				})();
				return {
					claim: await client.claimCheckin(),
					checkin: await client.checkinStatus()
				};
			},
			discoverModels: async (signal) => {
				const remote = await withDirectoryRetry(() => remoteCatalog.fetchModels(signal));
				const [wireModels, roster] = await Promise.all([solo.fetchModels(signal), officialRoster.fetch(signal)]);
				const merged = mergeTraeModelSources(remote, wireModels);
				const callable = withChatCallableFunctions(merged, TRAE_DIRECTORY_FUNCTIONS[region]);
				const chatFunctions = TRAE_DIRECTORY_FUNCTIONS[region];
				for (const model of merged) {
					if (model.wireFunction === void 0 || chatFunctions.includes(model.wireFunction)) continue;
					ctx.logger.warn(`model directory row is pinned to a non-chat function and will be called through the default chat function instead: ${model.id} (pinned to function ${model.wireFunction})`);
				}
				/**
				* Retire what no chat function offers any more, and re-pin what the
				* vendor offers under a DIFFERENT channel (issue #52).
				*
				* Runs AFTER `withChatCallableFunctions` on purpose: that step decides
				* the `wireFunction` this filter judges the row on. Rows the IDE roster
				* does not mention, and every row when the roster could not be read at
				* all, survive untouched — see `applyOfficialRoster`.
				*/
				const official = applyOfficialRoster(callable, roster, chatFunctions);
				/**
				* Fix the ORDER once, here, so it is a property of the catalog rather
				* than of the screen that happens to draw it (issue #52, P0).
				*
				* The merge walks twelve directory groups and `solo-remote.ts` records
				* that the group order varies between calls, so the same account could
				* get two different lists from two refreshes. Sorting by (channel
				* priority, name) makes the saved `lastCatalog` — and therefore the DSH
				* model picker, which renders in catalog order — identical across
				* refreshes. The card re-applies the same function for catalogs saved
				* before this existed.
				*/
				const visible = orderTraeModels(official.rows, region);
				if (official.hidden.length > 0) ctx.logger.warn(`hiding ${official.hidden.length} model(s) no chat function offers any more (issue #52)`, official.hidden);
				if (official.repinned.length > 0) ctx.logger.warn(`re-pinning ${official.repinned.length} model(s) to the function their vendor shows them on (issue #52)`, official.repinned);
				wire.callableKeys.clear();
				for (const model of visible) {
					wire.callableKeys.add(model.id.trim().toLowerCase());
					wire.callableKeys.add(model.name.trim().toLowerCase());
				}
				wire.resolved = visible.length > 0;
				const wireTargets = wireTargetsOf(visible);
				wire.byId = wireTargets.byId;
				wire.byName = wireTargets.byName;
				latestDiscovery.length = 0;
				latestDiscovery.push(...visible);
				return visible;
			},
			/**
			* One-click availability test. The ids come from the card, so each one is
			* checked against THIS region's live catalog first: a caller must not be
			* able to spend quota probing arbitrary upstream config names, and a row the
			* region does not know is reported as skipped rather than silently dropped.
			*
			* The probe goes through `upstream` — the same bridge real chats use — so
			* wire resolution, function stamping and error translation all match what
			* the user gets when they actually send a message.
			*/
			probeModels: async (ids) => {
				const known = /* @__PURE__ */ new Set();
				for (const model of [...catalog.current(), ...displayModels(current(), region)]) {
					known.add(model.id.trim().toLowerCase());
					known.add(model.name.trim().toLowerCase());
				}
				const testable = [];
				const skipped = [];
				for (const id of ids) if (known.has(id.trim().toLowerCase())) testable.push(id);
				else skipped.push(id);
				const results = await probeModelsSequentially((body, signal) => primary.upstream.chatStream(body, signal), testable);
				return skipped.length === 0 ? { results } : {
					results,
					skipped
				};
			},
			invalidateAdapter: () => {},
			rawDiagnostic: () => rawDiagnostic(),
			wireResolver,
			identity,
			routeOf: (provider) => routeOfTraeProvider(provider) ?? "solo"
		};
	}
	/**
	* Mirror each region's Trae login into the plugin's OWN copy as soon as the
	* plugin loads.
	*
	* `accounts()` performs the mirror, so a card read creates the copy — but only
	* for the tab the user actually opens. Signing in to Trae and never opening
	* the panel would leave the copy missing until the next visit, which reads as
	* "the plugin never made a copy". This fire-and-forget pass makes the copies
	* exist from start-up. Failures are swallowed on purpose: the next card read
	* retries, and a read-only file system must not break the plugin load.
	*/
	for (const panel of TRAE_PANELS) stacks[panel].store.accounts().catch(() => void 0);
	/** This panel's saved pool preferences, unwrapped and defaulted to OFF. */
	const poolPreferencesOf = (panel) => unwrapVolatileDeep(regionStateOf(current(), panel).pool) ?? {};
	/**
	* Project one account's card credits onto the pool's ranking shape.
	*
	* The pool's `total` is the figure a request can SPEND, which on Trae is the
	* General bucket alone (SOLO chat never drains Work). The card's `total` is the
	* wider `available` figure, so it is deliberately NOT reused here: ranking by it
	* would put an account with a large Work balance and no General credit in front
	* of one that can actually serve. `undefined` (the read failed) stays undefined
	* so `rankPool` treats it as zero rather than as full.
	*/
	/**
	* Credit totals the pool ranks on, cached per account.
	*
	* The CHAT path must not spend an upstream round-trip per candidate just to
	* decide who bills: {@link poolMembersOf} reads every balance, which is right
	* for the card (one read per poll) and far too slow per request. So the card's
	* poll warms this cache and the router only reads it.
	*
	* A cold cache means "unknown", not "no credit": `rankPool` orders a missing
	* figure as zero and then falls back to token freshness, so a cold start still
	* picks a member — the user chose the roster — instead of refusing to bill.
	*/
	const poolCreditCache = {
		cn: /* @__PURE__ */ new Map(),
		enterprise: /* @__PURE__ */ new Map(),
		ai: /* @__PURE__ */ new Map()
	};
	/**
	* Today's check-in state per account, measured by the LAST full read.
	*
	* Issue #77: the check-in column used to be an upstream call per account with
	* no memory at all, so every open of the card paid for every member twice (the
	* pool's own membership pass plus one `checkinStatus()` each). The first-paint
	* document may not wait for any of that, and re-measuring what was measured
	* minutes ago buys nothing: a check-in happens at most once per device per day.
	*
	* Entries older than {@link CHECKIN_CACHE_MS} are treated as absent rather than
	* as stale truth, so a document never claims "already checked in" off yesterday's
	* measurement. A cold cache means "not read", which the card renders as unknown.
	*/
	const checkinStateCache = {
		cn: {},
		enterprise: {},
		ai: {}
	};
	const poolCreditsOfAccount = async (panel, accountId) => {
		const credits = await stacks[panel].creditsOfAccount(accountId);
		if (credits === void 0) return void 0;
		const within3d = credits.expiry?.within3d;
		const projected = {
			total: credits.generalAvailable,
			generalAvailable: credits.generalAvailable,
			workAvailable: credits.workAvailable,
			expiringSoon: within3d?.total ?? 0,
			...within3d?.earliestExpiresAtMs === void 0 ? {} : { nearestExpiryMs: within3d.earliestExpiresAtMs }
		};
		poolCreditCache[panel].set(accountId, projected);
		return projected;
	};
	/**
	* Assemble one pool member per LOCAL account, in the store's order.
	*
	* "Member" means the account still has a sign-in this machine can use: a saved
	* id whose desktop credentials vanished is a ghost, and a ghost cannot be tested
	* or checked in, so listing it as a member would enable a batch over nothing.
	* The saved list is intersected separately (see
	* {@link TraePoolDeps.effectiveMemberAccountIds}) — here the store is the source.
	*
	* Balance reads are settled independently: one account whose credit read fails
	* must not take the whole pool document down, and it ranks as zero rather than
	* disappearing.
	*/
	const poolMembersOf = async (panel) => {
		const probes = await readTraePoolProbes(poolKeyOfPanel(panel));
		const choices = await stacks[panel].store.accounts();
		return await Promise.all(choices.map(async (choice) => {
			const credits = await poolCreditsOfAccount(panel, choice.id).catch(() => void 0);
			return {
				account: {
					id: choice.id,
					accountName: choice.accountName
				},
				...credits === void 0 ? {} : { credits },
				...probes[choice.id] === void 0 ? {} : { probe: probes[choice.id] },
				...choice.tokenExpiresAtMs === void 0 ? {} : { tokenExpiresAtMs: choice.tokenExpiresAtMs }
			};
		}));
	};
	/**
	* The catalog a pool test resolves its target model against.
	*
	* The LAST discovery wins, and the saved/live catalog is the fallback: a test
	* clicked before the first discovery lands must still find the free models the
	* region already knows, and one clicked after it must not be judged against a
	* roster the upstream has since replaced.
	*/
	const poolCatalogOf = (panel) => stacks[panel].lastDiscovery.length > 0 ? stacks[panel].lastDiscovery : stacks[panel].catalog.current();
	/** Id → display name for one panel, for the rows a batch reports. */
	const poolMemberNamesOf = async (panel) => {
		const names = {};
		for (const member of await poolMembersOf(panel)) names[member.account.id] = member.account.accountName;
		return names;
	};
	/**
	* The accounts a batch runs on: the SAVED member list, narrowed to what this
	* machine can still reach, in the user's own order.
	*
	* Order is the user's, not the ranking's, on purpose: a batch result table that
	* reorders itself between presses is hard to read row by row, and the ranking
	* is already shown by the table above it.
	*/
	const poolTargetsOf = async (panel) => {
		const saved = poolPreferencesOf(panel).memberAccountIds ?? [];
		const names = await poolMemberNamesOf(panel);
		return effectiveMembersOf(saved, new Set(Object.keys(names))).map((accountId) => ({
			accountId,
			accountName: names[accountId] ?? ""
		}));
	};
	/**
	* Today's check-in state from the cells already measured — the first-paint read
	* (issue #77).
	*
	* Synchronous and local by contract: it never starts a request, so the card's
	* first paint cannot be held by the upstream. Only FRESH cells are returned; an
	* expired entry is dropped rather than reported, because "checked in" from four
	* hours ago is a claim about a day that may already be over.
	*/
	function cachedCheckinStateOf(panel) {
		const nowMs = Date.now();
		const state = {};
		for (const [accountId, entry] of Object.entries(checkinStateCache[panel])) {
			if (nowMs - entry.atMs >= CHECKIN_CACHE_MS) continue;
			state[accountId] = entry.state;
		}
		return state;
	}
	/**
	* Pool members from LOCAL state only: the store's logins, the saved probes and
	* the cached credit totals. No upstream call, so it is safe on the request
	* path (see {@link poolCreditCache} for why the cache exists).
	*/
	async function localPoolMembers(panel) {
		const probes = await readTraePoolProbes(poolKeyOfPanel(panel)).catch(() => ({}));
		const choices = await stacks[panel].store.accounts().catch(() => []);
		const cache = poolCreditCache[panel];
		return choices.map((choice) => {
			const credits = cache.get(choice.id);
			return {
				account: {
					id: choice.id,
					accountName: choice.accountName
				},
				...credits === void 0 ? {} : { credits },
				...probes[choice.id] === void 0 ? {} : { probe: probes[choice.id] },
				...choice.tokenExpiresAtMs === void 0 ? {} : { tokenExpiresAtMs: choice.tokenExpiresAtMs }
			};
		});
	}
	/**
	* The members that may actually be billed: the user's SAVED opt-in list
	* intersected with what this machine can still reach, minus the accounts that
	* already failed this request (`billableMembers` is the one definition of that
	* rule, shared with the batch paths).
	*/
	async function poolBillableMembers(panel, tried = []) {
		return billableMembers(await localPoolMembers(panel), poolPreferencesOf(panel).memberAccountIds ?? [], tried);
	}
	/**
	* Point the NEXT request at the best pooled account, or back at the bound one
	* when the pool is off (issue #44).
	*
	* Returns the account it chose. Both the chat path and the card's usage read go
	* through here, so "currently serving" on screen and the next real request
	* cannot disagree — one rule, one answer.
	*
	* When EVERY member is excluded the rotation is cleared rather than pointed at
	* an excluded account: the bound account then serves, which is the user's own
	* explicit choice and the only account a refusal would not have served anyway.
	* The card reports the exclusion reasons, so this is never silent.
	*/
	async function applyPoolSelection(panel) {
		const store = stacks[panel].store;
		if (poolPreferencesOf(panel).enabled !== true) {
			store.setRotatedAccount(void 0);
			return;
		}
		try {
			const winner = pickAccount(await poolBillableMembers(panel), Date.now());
			store.setRotatedAccount(winner?.id);
			return winner?.id;
		} catch {
			store.setRotatedAccount(void 0);
			return;
		}
	}
	/**
	* The client for the next account worth trying, bound to THAT account.
	*
	* Built per attempt from the account's own stored credential, so a failover
	* never rebinds the store and never disturbs a request that is already billing
	* the chosen account (the same rule per-account probes follow, issue #25). The
	* bridge is the same one a normal turn uses, so display ids still resolve to
	* their wire names.
	*/
	async function failoverClientFor(panel, tried) {
		const next = pickAccount(await poolBillableMembers(panel, tried), Date.now());
		if (next === void 0) return void 0;
		const stack = stacks[panel];
		const accountId = next.id;
		return {
			accountId,
			client: new TraeSoloBridge(new TraeSoloUpstreamClient({
				credential: async () => {
					const credential = await stack.store.resolveCredentialOf(accountId);
					if (credential === void 0) throw new Error(`no stored credential for account ${accountId}`);
					return credential;
				},
				identity: () => stack.identity(),
				route: stack.routeOf(providerOfPanel(panel)),
				log: (message, detail) => ctx.logger.warn(message, detail)
			}), stack.catalog, stack.wireResolver, (message, detail) => ctx.logger.warn(message, detail))
		};
	}
	/**
	* Persist what a real request taught us about an account (issue #44).
	*
	* Written as a `live-request` probe so the card can tell a measurement taken by
	* a batch from one taken by traffic, and so the ranking excludes the account on
	* its next turn instead of walking back into the same limit.
	*/
	async function recordPoolFailure(panel, accountId, kind, message) {
		const outcome = POOL_OUTCOME_BY_KIND[kind];
		if (outcome === void 0) return;
		await writeTraePoolProbes(poolKeyOfPanel(panel), { [accountId]: {
			outcome,
			atMs: Date.now(),
			source: "live-request",
			message: `${kind}: ${message}`
		} }).catch(() => {});
	}
	/**
	* Why nothing else could serve, as one clause for the error the caller sees.
	*
	* `undefined` when the pool is off (the plain upstream error is the whole
	* story) or when there was in fact a candidate left — the shim asked because it
	* ran out of attempts, not out of accounts.
	*/
	async function poolShortfallOf(panel, tried) {
		if (poolPreferencesOf(panel).enabled !== true) return void 0;
		let members;
		let remaining;
		try {
			members = await poolBillableMembers(panel);
			if (members.length === 0) return "the account pool is enabled but has no usable member";
			remaining = await poolBillableMembers(panel, tried);
		} catch {
			return;
		}
		if (remaining.length === 0) return `all ${members.length} pooled account(s) were tried for this request`;
		const ranked = rankPool(remaining, Date.now());
		const reasons = [...new Set(ranked.flatMap((entry) => entry.excludedBy === void 0 ? [] : [entry.excludedBy]))];
		return reasons.length === 0 ? void 0 : `every remaining pooled account is excluded (${reasons.join(", ")})`;
	}
	/**
	* The shim's view of one panel's pool.
	*
	* Declared as a hoisted function because the shim's route table is built ABOVE
	* this point in `apply`; only the bodies run later, on a real request.
	*/
	function poolShimHooksOf(panel) {
		return {
			prepare: () => applyPoolSelection(panel),
			next: (tried) => failoverClientFor(panel, tried),
			failed: (accountId, kind, message) => recordPoolFailure(panel, accountId, kind, message),
			shortfall: (tried) => poolShortfallOf(panel, tried)
		};
	}
	/**
	* The pool's dependency bag for ONE panel.
	*
	* Every member re-reads the store on each call rather than capturing a list:
	* a batch runs for minutes, and a sign-in the user performed half-way through
	* must be visible to the rows it has not reached yet.
	*
	* The bag is built per REQUEST, so it captures the panel and never has to be
	* told which tab asked.
	*/
	const poolDepsOf = (panel) => {
		const bridges = /* @__PURE__ */ new Map();
		const chatBridgeFor = (accountId) => {
			const existing = bridges.get(accountId);
			if (existing !== void 0) return existing;
			const stack = stacks[panel];
			const bridge = new TraeSoloBridge(new TraeSoloUpstreamClient({
				credential: async () => {
					const credential = await stack.store.resolveCredentialOf(accountId);
					if (credential === void 0) throw new Error(`no stored credential for account ${accountId}`);
					return credential;
				},
				identity: () => stack.identity(),
				route: stack.routeOf(providerOfPanel(panel)),
				log: (message, detail) => ctx.logger.warn(message, detail)
			}), stack.catalog, stack.wireResolver, (message, detail) => ctx.logger.warn(message, detail));
			const chat = (body, signal) => bridge.chatStream(body, signal);
			bridges.set(accountId, chat);
			return chat;
		};
		const probeDeps = () => ({
			credentialFor: (accountId) => stacks[panel].store.resolveCredentialOf(accountId),
			checkinStatusOf: async (credential) => {
				return new TraeUsageClient({
					credential: async () => credential,
					deviceId: async () => (await stacks[panel].identity()).deviceId
				}).checkinStatus();
			},
			claimCheckinOf: async (credential) => {
				return new TraeUsageClient({
					credential: async () => credential,
					deviceId: async () => (await stacks[panel].identity()).deviceId
				}).claimCheckin();
			},
			chatFor: (credential) => chatBridgeFor(traeAccountId(credential))
		});
		/** How much text a probe should carry for this panel (0 = the minimal probe). */
		const probeInputTokensOf = (stored) => {
			const tokens = poolPreferencesOf(stored).probeInputTokens;
			return typeof tokens === "number" && Number.isFinite(tokens) && tokens > 0 ? Math.min(tokens, MAX_PROBE_INPUT_TOKENS) : 0;
		};
		/** One account's row, through the same bridge and probe the batch uses. */
		const testWith = async (target, modelId, probeInputTokens) => {
			await warmWireMap(panel);
			const [row] = await testAllAccounts([target], modelId, (chatFor, credential, id) => {
				if (credential === void 0) return Promise.resolve({
					id,
					verdict: "auth",
					detail: "no stored credential for this account"
				});
				return probeOneModel(chatFor(credential), id, void 0, probeInputTokens);
			}, probeDeps());
			return row;
		};
		return {
			preferences: (stored) => poolPreferencesOf(stored),
			members: (stored) => poolMembersOf(stored),
			effectiveMemberAccountIds: async (stored) => {
				return effectiveMembersOf(poolPreferencesOf(stored).memberAccountIds ?? [], new Set((await poolMembersOf(stored)).map((member) => member.account.id)));
			},
			memberNames: async (stored) => {
				const names = {};
				for (const member of await poolMembersOf(stored)) names[member.account.id] = member.account.accountName;
				return names;
			},
			otherAccounts: async (stored) => (await poolMembersOf(stored)).map((member) => member.account),
			currentAccountId: async (stored) => {
				const configured = configuredAccountsOf(current())[stored];
				return isTraeAccountId(configured) ? configured : void 0;
			},
			catalog: (stored) => poolCatalogOf(stored),
			checkinSupported: (stored) => regionOfPanel(stored) === "cn",
			checkin: async (stored) => checkinAllAccounts(await poolTargetsOf(stored), probeDeps()),
			checkinState: async (stored) => {
				const state = cachedCheckinStateOf(stored);
				const nowMs = Date.now();
				for (const target of await poolTargetsOf(stored)) {
					const credential = await stacks[stored].store.resolveCredentialOf(target.accountId);
					if (credential === void 0) continue;
					const client = new TraeUsageClient({
						credential: async () => credential,
						deviceId: async () => (await stacks[stored].identity()).deviceId
					});
					try {
						const status = await client.checkinStatus();
						const measured = {
							checkedIn: status.checkedIn,
							deviceCheckedIn: status.didCheckedIn,
							enabled: status.enabled
						};
						state[target.accountId] = measured;
						checkinStateCache[stored][target.accountId] = {
							state: measured,
							atMs: nowMs
						};
					} catch {}
				}
				return state;
			},
			cachedCheckinState: (stored) => cachedCheckinStateOf(stored),
			test: async (stored, modelId, onRow) => {
				await warmWireMap(stored);
				const probeInputTokens = probeInputTokensOf(stored);
				const rows = await testAllAccounts(await poolTargetsOf(stored), modelId, (chatFor, credential, id) => {
					if (credential === void 0) return Promise.resolve({
						id,
						verdict: "auth",
						detail: "no stored credential for this account"
					});
					return probeOneModel(chatFor(credential), id, void 0, probeInputTokens);
				}, probeDeps(), onRow);
				await writeTraePoolProbes(poolKeyOfPanel(stored), probeUpdatesOf(rows));
				return rows;
			},
			testOne: async (stored, accountId) => {
				const model = resolveTargetModel(poolCatalogOf(stored), poolPreferencesOf(stored).targetModelId);
				if (model.modelId === void 0) return void 0;
				const names = await poolMemberNamesOf(stored);
				const row = await testWith({
					accountId,
					accountName: names[accountId] ?? ""
				}, model.modelId, probeInputTokensOf(stored));
				await writeTraePoolProbes(poolKeyOfPanel(stored), probeUpdatesOf([row]));
				return row;
			},
			removeOne: async (stored, accountId) => {
				await dropTraePoolProbe(poolKeyOfPanel(stored), accountId);
				return true;
			}
		};
	};
	ctx.inject(["webServer"], (webCtx) => registerTraeUsageRoute(webCtx, {
		store: (panel) => stacks[panel].store,
		setAccountSelection,
		client: (panel) => stacks[panel].usageClient,
		displayModels: (panel) => displayModels(current(), panel),
		enabledModelIds: (panel) => regionStateOf(current(), panel).enabledModelIds ?? [],
		regionEnabled: (panel) => regionEnabled(current(), panel),
		discoverModels: (panel, signal) => stacks[panel].discoverModels(signal),
		probeModels: async (panel, ids) => {
			await warmWireMap(panel);
			return stacks[panel].probeModels(ids);
		},
		rawDiagnostic: (panel) => stacks[panel].rawDiagnostic(),
		creditsOfAccount: (panel, accountId) => stacks[panel].creditsOfAccount(accountId),
		deleteAccountOf: (panel, accountId) => stacks[panel].store.deleteAccount(accountId),
		copiesOf: async (panel) => ({
			path: stacks[panel].store.ownAuthPath(),
			count: (await stacks[panel].store.accounts()).length
		}),
		accountStateOf: (panel, accountId) => stacks[panel].accountStateOf(accountId),
		claimCheckinOf: (panel, accountId) => stacks[panel].claimCheckinOf(accountId),
		pool: {
			preferences: (panel) => poolPreferencesOf(panel),
			members: (panel) => poolMembersOf(panel),
			localMembers: (panel) => localPoolMembers(panel),
			localMemberNames: async (panel) => {
				const names = {};
				for (const member of await localPoolMembers(panel)) names[member.account.id] = member.account.accountName;
				return names;
			},
			effectiveMemberAccountIds: async (panel) => {
				return effectiveMembersOf(poolPreferencesOf(panel).memberAccountIds ?? [], new Set((await poolMembersOf(panel)).map((member) => member.account.id)));
			},
			memberNames: (panel) => poolMemberNamesOf(panel),
			otherAccounts: async (panel) => (await poolMembersOf(panel)).map((member) => member.account),
			currentAccountId: async (panel) => {
				await applyPoolSelection(panel).catch(() => void 0);
				const credential = await stacks[panel].store.current().catch(() => void 0);
				return credential === void 0 ? void 0 : traeAccountId(credential);
			},
			catalog: (panel) => poolCatalogOf(panel),
			checkinSupported: (panel) => regionOfPanel(panel) === "cn",
			checkin: (panel) => poolDepsOf(panel).checkin?.(panel) ?? Promise.resolve([]),
			checkinState: (panel) => poolDepsOf(panel).checkinState?.(panel) ?? Promise.resolve({}),
			cachedCheckinState: (panel) => cachedCheckinStateOf(panel),
			test: (panel, modelId, onRow) => poolDepsOf(panel).test?.(panel, modelId, onRow) ?? Promise.resolve([]),
			testOne: (panel, accountId) => poolDepsOf(panel).testOne?.(panel, accountId) ?? Promise.resolve(void 0),
			removeOne: (panel, accountId) => poolDepsOf(panel).removeOne?.(panel, accountId) ?? Promise.resolve(false)
		}
	}));
	/**
	* Live registration handles per region, filled once the shim is listening.
	* A disabled region holds ZERO routes while staying registered: DSH allows
	* `replace([])` for exactly this case ("a settings section that emptied holds
	* zero routes while staying registered"), which is what makes the on/off
	* switch reversible without a restart. Withdrawing the adapter route is what
	* actually removes the region's models from DSH's model picker — hiding the
	* card tab alone would leave every model selectable.
	*/
	const registration = {
		cn: { adapters: [] },
		enterprise: { adapters: [] },
		ai: { adapters: [] }
	};
	/** Release every live registration this apply() created. */
	const disposeRegistration = () => {
		for (const panel of TRAE_PANELS) {
			for (const entry of registration[panel].adapters) entry.handle();
			registration[panel].adapters.length = 0;
		}
		registration.cn.directory?.();
		delete registration.cn.directory;
	};
	/**
	* Publish each region's on/off state to the harness (issue #11). Both swaps
	* are single synchronous sections, so no request can observe a half-applied
	* state, and `replace` announces itself through `llm/adapters-updated`, which
	* is what makes third-party consumers (e.g. a vision router deriving
	* `<provider>-vision` variants) drop the region too. No-op until the shim has
	* registered; `applySelection` runs again on every card write, so a toggle
	* lands immediately.
	*/
	const syncRegionRegistration = (value) => {
		for (const panel of TRAE_PANELS) {
			const enabled = regionEnabled(value, panel);
			for (const entry of registration[panel].adapters) entry.handle.replace(enabled ? [entry.provider] : []);
		}
		registration.cn.directory?.replace(TRAE_PANELS.filter((panel) => regionEnabled(value, panel)).map((panel) => ({
			provider: providerOfPanel(panel),
			displayName: displayNameOfTraeProvider(providerOfPanel(panel)),
			settingsNs,
			settingsPath: [],
			declared: false
		})));
	};
	/** Push the current config into every panel's store selection and catalog. */
	const applySelection = (value) => {
		for (const panel of TRAE_PANELS) {
			const stack = stacks[panel];
			stack.store.setSource(unwrapVolatile(value.authFile), unwrapVolatile(value.edition) ?? "auto", effectiveAccountFor(panel, value));
			/**
			* Re-merge the wire mapping the last discovery taught us.
			*
			* configuredModels rebuilds from the SAVED rows, and rows saved before
			* wireConfigName existed carry wireFunction alone. Every settings write
			* goes through here (card writes, follow-app-login, the initial seed),
			* so without this each write would strip the case mapping until the next
			* discovery -- the exact window that turns deepseek-v4.1-flash into a
			* 4001, because the gateway is case-sensitive and the lowercase
			* directory id is the one spelling it refuses.
			*/
			const known = /* @__PURE__ */ new Map();
			for (const model of stack.lastDiscovery) {
				known.set(model.id, model);
				known.set(model.id.trim().toLowerCase(), model);
				if (model.name.trim() !== "") known.set(model.name.trim().toLowerCase(), model);
			}
			const rows = configuredModels(value, panel).map((model) => {
				const match = known.get(model.id) ?? known.get(model.id.trim().toLowerCase()) ?? (model.name.trim() !== "" ? known.get(model.name.trim().toLowerCase()) : void 0);
				if (match === void 0) return model;
				const wireConfigName = model.wireConfigName ?? match.wireConfigName;
				const wireFunction = model.wireFunction ?? match.wireFunction;
				if (wireConfigName === model.wireConfigName && wireFunction === model.wireFunction) return model;
				return {
					...model,
					...wireConfigName === void 0 ? {} : { wireConfigName },
					...wireFunction === void 0 ? {} : { wireFunction }
				};
			});
			stack.catalog.set(rows);
			stack.invalidateAdapter();
		}
		syncRegionRegistration(value);
	};
	applySelection(config);
	(async () => {
		const id = current().accountId;
		if (id === void 0) return;
		try {
			for (const region of REGION_KEYS) if ((await stacks[region].store.accounts()).some((account) => account.id === id)) {
				legacyAccountRegion = region;
				applySelection(current());
				return;
			}
		} catch {}
	})();
	ctx.inject(["settings"], (settingsCtx) => {
		const settings = settingsCtx.settings;
		settingsService = settings;
		ctx.effect(() => settings.configure({ auto: true }, ctx.fiber));
	});
	const drawImageClient = new TraeImageClient({ logger: ctx.logger });
	let drawImageTools;
	let disposeDrawImageTool;
	const syncTraeDrawImageTool = (value) => {
		if (drawImagePanelsOf(value).length === 0) {
			disposeDrawImageTool?.();
			disposeDrawImageTool = void 0;
			return;
		}
		if (disposeDrawImageTool !== void 0 || drawImageTools === void 0) return;
		disposeDrawImageTool = registerTraeDrawImageTool(drawImageTools, {
			resolveAccount: async () => {
				for (const panel of drawImagePanelsOf(current())) {
					const stack = stacks[panel];
					try {
						return {
							credential: await stack.store.resolve(),
							identity: await stack.identity(),
							baseUrl: REGION_GATEWAYS[stack.region].chat
						};
					} catch {
						continue;
					}
				}
			},
			generate: (account, request, signal) => drawImageClient.generate(account, request, signal),
			directoryOf: (exec) => ensureSessionDirectory === void 0 ? void 0 : ensureSessionDirectory(exec),
			logger: ctx.logger
		});
	};
	let ensureSessionDirectory;
	ctx.inject(["workingDirectory"], (directoryCtx) => {
		const service = directoryCtx.workingDirectory;
		if (service === void 0 || typeof service.ensure !== "function") return;
		const ensure = service.ensure.bind(service);
		ensureSessionDirectory = async (exec) => {
			const agent = exec.agent;
			if (agent === void 0) return void 0;
			try {
				const directory = await ensure(agent, exec.signal);
				return typeof directory === "string" && directory.trim() !== "" ? directory : void 0;
			} catch {
				return;
			}
		};
		directoryCtx.effect(() => () => {
			ensureSessionDirectory = void 0;
		});
	});
	ctx.inject(["tools"], (toolsCtx) => {
		drawImageTools = toolsCtx.tools;
		if (drawImageTools === void 0) return;
		syncTraeDrawImageTool(current());
		toolsCtx.effect(() => () => {
			disposeDrawImageTool?.();
			disposeDrawImageTool = void 0;
			drawImageTools = void 0;
		});
	});
	ctx.on("loader/volatile-update", () => {
		applySelection(current());
		syncTraeDrawImageTool(current());
	});
	let stopped = false;
	ctx.effect(() => () => {
		stopped = true;
		for (const panel of TRAE_PANELS) stacks[panel].shim.close();
	});
	Promise.all(TRAE_PANELS.map((panel) => stacks[panel].shim.ready)).then(async () => {
		if (stopped) return;
		try {
			const piAi = piAiRuntimeInfo();
			ctx.logger.info(`dsh-connect-trae: pi-ai ${piAi.version ?? "unknown"} (${piAi.generation} generation)${piAi.inspected ? "" : " — not resolved locally, the host supplies it"}`);
			for (const panel of TRAE_PANELS) {
				const stack = stacks[panel];
				const provider = providerOfPanel(panel);
				const entry = stack.routeClients[provider];
				if (entry === void 0) continue;
				const trae = createTraeAdapter({
					shim: stack.shim,
					catalog: stack.catalog,
					provider,
					displayName: displayNameOfTraeProvider(provider),
					secret: entry.secret,
					resolveAttachments: () => ctx.get("attachments")
				});
				stack.invalidateAdapter = () => {
					trae.invalidate();
				};
				registration[panel].adapters.push({
					provider,
					handle: ctx.llm.registerAdapter([provider], trae.adapter)
				});
			}
			ctx.llm.registerModelDiscovery(settingsNs, async (request, signal) => {
				const panel = panelOfProvider(request.provider ?? "");
				if (panel === void 0) return [];
				if (!regionEnabled(current(), panel)) return [];
				const cancellation = signal ?? request.signal;
				const next = applyImageSelection(await stacks[panel].discoverModels(cancellation), imageSet(current(), panel));
				const withRate = panel !== "enterprise";
				return next.map((model) => ({
					id: model.id,
					name: traeModelDisplayName(model, withRate),
					contextWindow: servedContextWindow(model),
					...model.maxTokens === void 0 ? {} : { maxTokens: model.maxTokens },
					inputModalities: traeInputModalities(model)
				}));
			});
			registration.cn.directory = ctx.llm.registerConfigurableProviders(TRAE_PANELS.map((panel) => ({
				provider: providerOfPanel(panel),
				displayName: displayNameOfTraeProvider(providerOfPanel(panel)),
				settingsNs,
				settingsPath: [],
				declared: false
			})));
			syncRegionRegistration(current());
		} finally {
			if (registration.cn.adapters.length === 0 || registration.ai.adapters.length === 0 || registration.cn.directory === void 0) disposeRegistration();
		}
		try {
			ctx.effect(() => () => {
				disposeRegistration();
			});
		} catch {
			disposeRegistration();
		}
		for (const panel of TRAE_PANELS) {
			if (!regionEnabled(current(), panel)) continue;
			(async () => {
				const stack = stacks[panel];
				try {
					const models = await stack.discoverModels();
					if (stopped) return;
					stack.catalog.set(derive(current(), models, panel));
				} catch (error) {
					ctx.logger.warn(`dsh-connect-trae: live ${panel} model directory unavailable; serving the configured catalog`, error);
					stack.catalog.set(configuredModels(current(), panel));
				}
				stack.invalidateAdapter();
			})();
		}
	}).catch((error) => {
		ctx.logger.error("dsh-connect-trae: loopback shim failed; providers not registered", error);
	});
}
//#endregion
export { Config, FALLBACK_CONTEXT_WINDOW, FALLBACK_TRAE_MODELS, FALLBACK_TRAE_MODELS_AI, MAX_PROBE_INPUT_TOKENS, REGION_GATEWAYS, SseDecoder, TRAE_ACCOUNT_STATUS_PATH, TRAE_AI_PROVIDER, TRAE_CHANNEL_PRIORITY, TRAE_CHECKIN_PATH, TRAE_CN_AGENT_TASK_PATH, TRAE_CN_TITLE_PATH, TRAE_COMMON_FUNCTIONS, TRAE_ENTERPRISE_PROVIDER, TRAE_MODELS_TEST_PATH, TRAE_MODEL_DETAIL_FUNCTIONS, TRAE_MODEL_DETAIL_PATH, TRAE_OFFICIAL_ROSTER_PATH, TRAE_PANELS, TRAE_PAY_BASE, TRAE_PROBE_TIMEOUT_MS, TRAE_PROVIDER, TRAE_PROVIDERS, TRAE_PROVIDER_DISPLAY_NAMES, TRAE_PROVIDER_IDS, TRAE_PROVIDER_ID_DISPLAY_NAMES, TRAE_PROVIDER_ROUTES, TRAE_RAW_CHAT_V1_PATH, TRAE_RAW_CHAT_V2_PATH, TRAE_REASONING_EFFORTS, TRAE_REGIONS, TRAE_REGION_PARAM, TRAE_SETTINGS_NS, TRAE_SOLO_CHAT_PATH, TRAE_SOLO_FUNCTION, TRAE_SOLO_MODELS_PATH, TRAE_SOLO_REMOTE_BASE, TRAE_STATE_DB_FILENAME, TRAE_STREAM_IDLE_TIMEOUT_MS, TRAE_USAGE_PATH, TRAE_VERSION_CODE_FALLBACK, TraeCatalog, TraeCredentialStore, TraeDelegatingUpstreamClient, TraeFallbackUpstreamClient, TraeGatedUpstreamClient, TraeOfficialRosterClient, TraeRawCapabilityController, TraeRawCapabilityState, TraeRawChatUpstreamClient, TraeSoloBridge, TraeSoloRemoteCatalogClient, TraeSoloUpstreamClient, TraeUsageClient, UnconfiguredTraeUpstreamClient, adaptLegacyPiAiContext, adaptModernPiAiContext, apply, applyContextBudgets, applyImageSelection, applyOfficialRoster, applyReasoningEffort, asVolatile, bridgeTraeSoloStream, buildTraeAgentTaskBody, buildTraeCnHeaders, buildTraeFusionRawChatEnvelope, buildTraeModelDetailRequest, buildTraeRawChatDraft, buildTraeRawChatRuntimeConfig, classifyProbeError, classifyProbeResult, classifyTraeRawChatFailure, configuredAccountsOf, createTraeAdapter, createTraeRawGateway, createTraeShim, creditPosition, decidePiAiGeneration, decodeRawChatChunk, decodeTraeEvent, decryptTraeStorageValue, deriveCatalog, describeIdShape, describeNameShape, describeTraeFailure, discoveredCatalog, displayNameOfTraeProvider, fallbackModelsFor, filterTraeModels, generationOf, groupTraeModels, hashTraeRawChatArg, identityHeaders, inject, isEnterpriseAccount, isPromotableWireModel, legacyTraeOwnAuthPath, maskUserPath, mergeTraeModelSources, name, nextRegionCreditPosition, nextRegionEnabled, nextRegionSlots, normalizeTraeCredential, normalizeTraeToolSchema, normalizeTraeToolSchemas, normalizeTraeVersionCode, officialVerdictOf, orderTraeModels, panelOfKey, panelOfProvider, parseObservedModelConfig, parseReasoningCapability, parseTraeAuthValue, parseTraeCachedModel, parseTraeModelExtraConfigLogLine, parseTraeOfficialRoster, parseTraeRawChatBehaviorConfig, parseTraeRemoteModel, parseTraeStorageDocument, piAiRuntimeInfo, pickTraeStorageIdentity, prepareSoloBody, probeBody, probeModelsSequentially, probeOneModel, probeTraeRawChatCapability, providerOfPanel, rawCapabilityDiagnostic, rawCapabilityFingerprint, readTraeCachedModel, readTraeCliIdentity, readTraeIdentity, refreshTraeCredential, regionCreditPositionOf, regionEnabled, regionEnabledOf, regionOfCredential, regionOfEdition, regionOfHost, regionOfPanel, regionOfTraeProvider, regionOfTraeStatusUrl, regionOfUserRegion, regionStateOf, registerTraeUsageRoute, resolveTraeIdentity, resolveTraeRawRuntime, routeOfTraeProvider, sanitizeCatalog, scopeTraeModels, servedContextWindow, settingsNamespaceOf, traeEndpoint, traeInputModalities, traeModelCallChannel, traeModelDisplayName, traeModelInView, traeModelMatchesQuery, traeOwnAuthPath, traeRawChatExtraInfo, traeStateDatabaseCandidates, traeStorageCandidates, traeWebUsage, traeWindowsAppNames, unwrapVolatile, unwrapVolatileDeep, wireTargetsOf, withChatCallableFunctions, withContextAdaptation, withTraeRegion };
