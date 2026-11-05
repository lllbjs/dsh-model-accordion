import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { createHash, randomBytes } from "node:crypto";

//#region src/adapter/ids.ts
/** sha256("prefix\0value") truncated to 12 bytes: stable, non-reversible. */
function stableID(prefix, value) {
	return `${prefix}_${createHash("sha256").update(prefix + "\0" + value).digest().subarray(0, 12).toString("hex")}`;
}
function randomID(prefix, size) {
	return `${prefix}_${randomBytes(size).toString("hex")}`;
}
/**
* The conversation signal: JSON of the first user message's content. Using the
* first user turn keeps a multi-turn conversation stable as its history grows
* while separating conversations with different beginnings (ids.go:59-76).
*/
function conversationSeed(messages) {
	for (const message of messages) {
		if (message.role !== "user") continue;
		const encoded = JSON.stringify(message.content ?? null);
		if (encoded !== "null" && encoded.length > 0) return encoded;
	}
	return "";
}
/**
* Derive the correlation ids for one upstream request. In adapter mode there
* are no inbound opencode headers, so the seed is the conversation itself.
*/
function deriveRequestIDs(messages) {
	let signal = conversationSeed(messages);
	if (signal === "" || signal === "{}") signal = randomID("fallback", 16);
	return {
		session: canonicalSessionID(signal),
		request: randomID("req", 16),
		project: stableID("prj", "opencode2dsh:default-project"),
		parentSession: ""
	};
}
/**
* OpenCode's canonical session shape: "ses_" + 12 lowercase hex timestamp
* characters + 14 Base62 characters. Since 2026-09-16 the Zen free tier
* rejects any other session shape with 403 FreeTierError ("free tier can
* only be used from within OpenCode") — the plain User-Agent gate stopped
* being sufficient (upstream fix: jasonxu114514/opencode2api 8185202).
* Live-probed 2026-09-18: the gate has a second, body-shape half (streaming
* + bash/read tools, adapter/messages.ts); both must pass.
*
* Issue #62 (2026-10-13): matching that SHAPE stopped being sufficient. The
* 12 hex characters are not an arbitrary blob — they encode a real
* timestamp, bitwise-inverted, and the free tier decodes them back and
* rejects anything that is not a plausible wall-clock time. A digest-derived
* prefix therefore 403s even though it matches the regex. See
* `invertedTimestampHex`.
*/
const CANONICAL_SESSION_PATTERN = /^ses_[0-9a-f]{12}[0-9A-Za-z]{14}$/;
const BASE62_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
function base62Fixed(value, width) {
	const base = 62n;
	let n = value;
	const out = new Array(width);
	for (let i = width - 1; i >= 0; i--) {
		out[i] = BASE62_ALPHABET.charAt(Number(n % base));
		n /= base;
	}
	return out.join("");
}
/**
* The 12 hex characters a genuine OpenCode client emits, ported from
* upstream's identifier generator (`packages/schema/src/identifier.ts`):
* take the millisecond clock, append a per-millisecond sequence in the low
* 12 bits, and invert the whole thing bitwise (`~x`), so ids sort newest
* first as plain strings.
*
* The sequence matters: the low 12 bits are exactly `counter`, and the
* inversion flips them, which is why a real counter-1 session ends its time
* segment in `ffe` — a structural consequence, not a magic marker. Live
* probes (2026-10-13) show the free tier reads those low 12 bits back as a
* per-millisecond counter and accepts only `[0, 63]`; the high 36 clock bits
* are not checked (an id whose clock decodes to 1970 still passes). A digest
* prefix lands in that window ~1.5% of the time, so it is rejected almost
* always even though it matches the regex.
*
* We always mint counter 1: this plugin is the only writer of its own
* sessions, so a per-millisecond counter would only add state.
*
* Exported for the regression test that pins this against upstream's own
* encoder; not part of the wire contract.
*/
function invertedTimestampHex(now = Date.now()) {
	return (~(BigInt(now) * 4096n + 1n) & 281474976710655n).toString(16).padStart(12, "0");
}
/**
* A synthesized session, memoized per conversation signal.
*
* The clock half must be minted ONCE per conversation, not per request: a
* retry (reasoning-only → Off), or any second call in the same conversation,
* has to reuse the identical `ses_` id. Upstream groups the free tier's quota
* and prompt cache by session, so a fresh clock on every request would both
* break the retry contract asserted in reasoning-recovery.test.ts and forfeit
* cache reuse across turns.
*
* Capped at {@link SESSION_MEMO_LIMIT} entries, oldest-evicted, so a
* long-lived process cannot grow the map without bound.
*/
const SESSION_MEMO_LIMIT = 1024;
const sessionMemo = /* @__PURE__ */ new Map();
/**
* The session id sent upstream. A signal that already carries an official
* OpenCode session passes through unchanged (preserving upstream prompt-cache
* affinity); any other identity — the conversation seed in adapter mode,
* foreign client sessions, admission probes — is expanded into a canonical id
* whose timestamp segment is a REAL clock (issue #62), with the conversation
* identity folded into the Base62 tail so distinct conversations never collide.
*/
function canonicalSessionID(signal) {
	if (CANONICAL_SESSION_PATTERN.test(signal)) return signal;
	const memoized = sessionMemo.get(signal);
	if (memoized !== void 0) return memoized;
	const sum = createHash("sha256").update("ses\0" + signal).digest();
	const session = `ses_${invertedTimestampHex()}${base62Fixed(BigInt("0x" + sum.subarray(6, 16).toString("hex")), 14)}`;
	if (sessionMemo.size >= SESSION_MEMO_LIMIT) {
		const oldest = sessionMemo.keys().next();
		if (!oldest.done) sessionMemo.delete(oldest.value);
	}
	sessionMemo.set(signal, session);
	return session;
}
/** CLI-identical user agent (ids.go opencodeUserAgent, node runtime values). */
function opencodeUserAgent() {
	return `opencode/1.18.31 (${process.platform} ${process.arch}; node${process.versions.node})`;
}
/**
* The full disguise header set sent with every upstream request
* (design.md 2.4; gateway.go newUpstreamRequest:640-669).
*
* `x-opencode-request` is never sent — any value is refused (#75). The project
* header carries `global` rather than a `prj_` id, which is refused too (#75).
* `x-opencode-session-id` repeats the session id, required once the User-Agent
* claims an opencode release above 1.18.33 (#74, #78).
*/
function disguiseHeaders(ids) {
	return {
		"user-agent": opencodeUserAgent(),
		"x-opencode-client": "cli",
		"x-opencode-session": ids.session,
		"x-opencode-session-id": ids.session,
		"x-session-affinity": ids.session,
		"X-Session-Id": ids.session,
		"x-opencode-project": "global"
	};
}

//#endregion
//#region src/adapter/routing.ts
const RESPONSES_ONLY_PREFIX = "muse-spark";
function isResponsesModel(id) {
	return String(id ?? "").toLowerCase().startsWith(RESPONSES_ONLY_PREFIX);
}
function apiForModel(id) {
	return isResponsesModel(id) ? "openai-responses" : "openai-completions";
}

//#endregion
//#region src/adapter/messages.ts
function zeroUsage() {
	return {
		input: 0,
		output: 0,
		cacheRead: 0,
		cacheWrite: 0,
		totalTokens: 0,
		cost: {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			total: 0
		}
	};
}
function parseArguments(raw) {
	if (typeof raw !== "string" || raw.length === 0) return {};
	try {
		const parsed = JSON.parse(raw);
		return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : { value: parsed };
	} catch {
		return { raw };
	}
}
/**
* Harness attachment root (mirrors dsh-attachment-local's resolveDshHome).
* DSH_HOME is always set by the harness child; the homedir fallback covers
* direct invocation (tests, tooling).
*/
function dshHome() {
	const configured = process.env.DSH_HOME?.trim();
	if (configured) return configured;
	return join(homedir(), ".dsh");
}
/**
* Convert one harness image block to pi-ai ImageContent by reading the
* content-addressed normalized object (DSH_HOME/attachments/v1/objects/<2>/<sha>).
* Falls back to stable text on any failure so a missing object can never
* fail the whole stream.
*/
async function toPiImage(ref) {
	const attachment = ref ?? {};
	const id = typeof attachment.attachmentId === "string" ? attachment.attachmentId : "";
	const sha = id.startsWith("sha256:") ? id.slice(7) : id;
	if (!/^[0-9a-f]{64}$/.test(sha)) return {
		type: "text",
		text: `[image omitted: unreadable attachment reference ${JSON.stringify(id)}]`
	};
	const path = join(dshHome(), "attachments", "v1", "objects", sha.slice(0, 2), sha);
	try {
		return {
			type: "image",
			data: (await readFile(path)).toString("base64"),
			mimeType: typeof attachment.mediaType === "string" && attachment.mediaType.length > 0 ? attachment.mediaType : "image/png"
		};
	} catch {
		return {
			type: "text",
			text: `[image omitted: failed to read normalized attachment ${JSON.stringify(id)}]`
		};
	}
}
/**
* Host-budget-offloaded images were routed out of the request by dsh-llm on
* purpose (`offloaded: true`); re-reading their bytes from disk would defy the
* image budget the host already enforced. Emit a stable placeholder instead —
* the same semantics as the host adapter's projectOffloadedImages.
*/
function offloadedImagePart(ref) {
	const id = ref?.attachmentId;
	return {
		type: "text",
		text: `[image omitted: offloaded to fit the request image budget${typeof id === "string" && id.length > 0 ? ` ${id.slice(0, 30)}` : ""}]`
	};
}
/** One image block, respecting the host's offload flag. */
async function imagePart(block) {
	return block.offloaded === true ? offloadedImagePart(block.attachment) : toPiImage(block.attachment);
}
/** Text/image parts of one user message's content, in block order. */
async function userParts(blocks) {
	const parts = [];
	for (const block of blocks) if (block.type === "text") {
		if (block.text.length > 0) parts.push({
			type: "text",
			text: block.text
		});
	} else if (block.type === "image") parts.push(await imagePart(block));
	return parts;
}
/** Text/image parts of one tool result's content, walking nested results. */
async function toolResultParts(blocks) {
	const parts = [];
	for (const block of blocks) if (block.type === "text") parts.push({
		type: "text",
		text: block.text
	});
	else if (block.type === "image") parts.push(await imagePart(block));
	else if (block.type === "tool-result") parts.push(...await toolResultParts(block.content));
	return parts;
}
function toPiAssistant(message, providerId) {
	const content = [];
	for (const block of message.content) switch (block.type) {
		case "text":
			content.push({
				type: "text",
				text: block.text
			});
			break;
		case "reasoning": {
			const thinking = {
				type: "thinking",
				thinking: block.text
			};
			if (typeof block.signature === "string" && block.signature.length > 0) thinking.thinkingSignature = block.signature;
			content.push(thinking);
			break;
		}
		case "tool-call":
			content.push({
				type: "toolCall",
				id: block.id,
				name: block.name,
				arguments: parseArguments(block.arguments)
			});
			break;
		case "image": break;
		default: break;
	}
	const source = message.source;
	const model = source?.kind === "model" && typeof source.model === "string" ? source.model : providerId;
	return {
		role: "assistant",
		content,
		api: apiForModel(model),
		provider: source?.kind === "model" && typeof source.provider === "string" ? source.provider : providerId,
		model,
		usage: zeroUsage(),
		stopReason: content.some((block) => block.type === "toolCall") ? "toolUse" : "stop",
		timestamp: 0
	};
}
function flattenText(message) {
	return message.content.filter((block) => block.type === "text").map((block) => block.text).join("");
}
/**
* Call id of a message-level tool result (DSH >= 0.2: `role: 'tool'`,
* `toolCallId` on the message, plain content blocks, `source.callId` as a
* mirror). Returns undefined for ordinary user/system messages. Only consult
* `source.callId` when the source is a tool, so model/user provenance can
* never be mistaken for a tool result.
*/
function messageToolCallId(message) {
	if (typeof message.toolCallId === "string" && message.toolCallId.length > 0) return message.toolCallId;
	const source = message.source;
	if (source?.kind === "tool" && typeof source.callId === "string" && source.callId.length > 0) return source.callId;
}
/** Emit one pi-ai toolResult, substituting a placeholder for empty output. */
async function pushToolResult(messages, toolNames, toolCallId, content, isError) {
	let rparts = await toolResultParts(content);
	const hasImage = rparts.some((part) => part.type === "image");
	const hasText = rparts.some((part) => part.type === "text" && part.text.length > 0);
	if (!hasImage && !hasText) rparts = [{
		type: "text",
		text: "(no output)"
	}];
	messages.push({
		role: "toolResult",
		toolCallId,
		toolName: toolNames.get(toolCallId) ?? "unknown",
		content: rparts,
		isError,
		timestamp: 0
	});
}
/**
* Convert the harness conversation into a pi-ai Context. User and tool-result
* messages keep text AND image blocks (images load from the harness
* attachment store); tool results as toolResult messages, assistant history as
* pi-ai assistant messages. Async because image bytes are read from disk.
*/
async function toPiContext(options) {
	const providerId = options.provider;
	const toolNames = /* @__PURE__ */ new Map();
	const messages = [];
	for (const message of options.messages) {
		if (message.role === "system") {
			const text = flattenText(message);
			if (text.length > 0) messages.push({
				role: "user",
				content: text,
				timestamp: 0
			});
			continue;
		}
		if (message.role === "assistant") {
			const assistant = toPiAssistant(message, providerId);
			for (const block of assistant.content) if (block.type === "toolCall") toolNames.set(block.id, block.name);
			messages.push(assistant);
			continue;
		}
		const results = message.content.filter((block) => block.type === "tool-result");
		if (results.length === 0) {
			const toolCallId = messageToolCallId(message);
			if (toolCallId !== void 0) {
				await pushToolResult(messages, toolNames, toolCallId, message.content, message.isError ?? false);
				continue;
			}
		}
		const parts = await userParts(message.content);
		if (parts.length > 0 || results.length === 0) {
			const first = parts[0];
			let content;
			if (parts.length === 0) content = "";
			else if (parts.length === 1 && first?.type === "text") content = first.text;
			else content = parts;
			messages.push({
				role: "user",
				content,
				timestamp: 0
			});
		}
		for (const result of results) await pushToolResult(messages, toolNames, result.toolCallId, result.content, result.isError ?? false);
	}
	const context = { messages };
	if (typeof options.system === "string" && options.system.length > 0) context.systemPrompt = options.system;
	const tools = options.tools?.map((tool) => ({
		name: tool.name,
		description: tool.description,
		parameters: tool.parameters
	}));
	if (tools && tools.length > 0) context.tools = tools;
	return context;
}
/**
* The anonymous free-lane gate (~2026-10-09, issue #56; live-probed again
* 2026-10-11): a chat request passes with HTTP 200 only when ALL hold:
*   1. a canonical `ses_*` id in a session header (`x-opencode-session`,
*      `x-session-affinity` and `X-Session-Id` all work — any ONE suffices;
*      bad-shape ids 403);
*   2. a streaming body (`stream: true` — non-stream 403s);
*   3. an agent-shaped `tools` array: `bash`+`read` pass (200), `shell`+1
*      known name pass (200), but `bash` alone, `shell` alone, and 5 known
*      names WITHOUT bash/shell all 403. Schemas and descriptions go
*      uninspected.
* The `Bearer public` credential and the User-Agent spelling are NOT gates
* (both pass on /zen/v1; only /inference/openai 401s the Bearer). The shipped
* recipe stays the 2026-09-18 bash+read pair: minimal, host-named, and valid
* on both the /zen and /inference lanes.
*/
const FREE_LANE_GATE_TOOL_NAMES = ["bash", "read"];
/**
* Inbound tool-call names rewritten before the chunk stream leaves the
* adapter (zen-adapter.ts hands this to toStreamChunks). Empty on the shipped
* recipe: every injected stub is call-disabled or host-named, so nothing the
* model can call needs a rename. Kept as the seam for a future gate spelling
* that forces an alias (e.g. a mandatory `shell`).
*/
const GATE_TOOL_ALIASES = {};
/**
* The lane refuses an official tool name whose `parameters.properties` is empty
* (#75, #78), so the injected pair carries the CLI's own definitions rather than
* a placeholder. The gate inspects presence, not shape; the schema is here so the
* tool also stays callable if the model reaches for it.
*/
const GATE_TOOL_SCHEMAS = {
	bash: {
		description: "Run a shell command in the project workspace.",
		parameters: {
			type: "object",
			properties: {
				command: {
					type: "string",
					description: "The command to run."
				},
				description: {
					type: "string",
					description: "What the command does."
				}
			},
			required: ["command"],
			additionalProperties: false
		}
	},
	read: {
		description: "Read a file from the filesystem.",
		parameters: {
			type: "object",
			properties: {
				filePath: {
					type: "string",
					description: "Absolute path of the file to read."
				},
				offset: {
					type: "integer",
					description: "Line number to start reading from."
				},
				limit: {
					type: "integer",
					description: "Maximum number of lines to read."
				}
			},
			required: ["filePath"],
			additionalProperties: false
		}
	}
};
function freeLaneGateTool(name) {
	const schema = GATE_TOOL_SCHEMAS[name];
	return {
		type: "function",
		function: {
			name,
			description: schema.description,
			parameters: schema.parameters
		}
	};
}
/** Responses uses flat function tools and its Zen gateway accepts auto only. */
function ensureResponsesFreeLaneShape(payload) {
	if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return void 0;
	const body = payload;
	if (!Array.isArray(body.input)) return void 0;
	const tools = Array.isArray(body.tools) ? body.tools : [];
	const gateSchemaOk = (tool, name) => {
		if (typeof tool !== "object" || tool === null) return false;
		const candidate = tool;
		if (candidate.type !== "function" || candidate.name !== name) return false;
		const properties = candidate.parameters?.properties;
		return typeof properties === "object" && properties !== null && Object.keys(properties).length > 0;
	};
	const missing = FREE_LANE_GATE_TOOL_NAMES.filter((name) => !tools.some((tool) => gateSchemaOk(tool, name)));
	const invalidChoice = body.tool_choice !== void 0 && body.tool_choice !== "auto";
	if (missing.length === 0 && !invalidChoice) return void 0;
	const kept = tools.filter((tool) => {
		const candidate = typeof tool === "object" && tool !== null ? tool : void 0;
		const name = typeof candidate?.name === "string" ? candidate.name : void 0;
		return !(name !== void 0 && missing.includes(name) && !gateSchemaOk(tool, name));
	});
	return {
		...body,
		tools: [...kept, ...missing.map((name) => ({
			type: "function",
			...freeLaneGateTool(name).function
		}))],
		tool_choice: "auto"
	};
}
/**
* Rewrite an outgoing chat-completions payload so it satisfies the free-lane
* agent-shape gate (wired through pi-ai's onPayload). Appends only the gate
* tools the payload is missing; when the context carried no tools at all,
* tool_choice 'none' keeps the model from ever calling the injected stubs,
* while client-provided tool choices are preserved untouched. Returns
* undefined when the payload already satisfies the gate or is not a
* chat-completions body (pi-ai keeps the original in that case).
*/
function ensureFreeLaneShape(payload) {
	if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return void 0;
	const body = payload;
	if (!Array.isArray(body.messages)) return void 0;
	const tools = Array.isArray(body.tools) ? body.tools : [];
	const gateSchemaOk = (tool, name) => {
		const fn = typeof tool === "object" && tool !== null ? tool.function : void 0;
		if (typeof fn !== "object" || fn === null || fn.name !== name) return false;
		const properties = fn.parameters?.properties;
		return typeof properties === "object" && properties !== null && Object.keys(properties).length > 0;
	};
	const missing = FREE_LANE_GATE_TOOL_NAMES.filter((name) => !tools.some((tool) => gateSchemaOk(tool, name)));
	if (missing.length === 0) return void 0;
	const kept = tools.filter((tool) => {
		const fn = typeof tool === "object" && tool !== null ? tool.function : void 0;
		const name = typeof fn?.name === "string" ? fn.name : void 0;
		return !(name !== void 0 && missing.includes(name) && !gateSchemaOk(tool, name));
	});
	const next = { ...body };
	next.tools = [...kept, ...missing.map((name) => freeLaneGateTool(name))];
	if (tools.length === 0) next.tool_choice = "none";
	return next;
}

//#endregion
//#region src/adapter/catalog.ts
/**
* Port of agent/internal/catalog (opencode2api models.go + model_metadata.go,
* trimmed to the single anonymous Zen lane) plus the S3 static fallback:
*
*   S1  GET {zen}/v1/models            live catalog (in-sale ids, free or paid)
*   S2  GET https://models.dev/api.json  pricing metadata -> free decision
*   S3  compile-time verified ids       last-resort bootstrap list
*
* /v1/models-equivalent exposure = S1 ∩ S2-allowed (or S3 while S1 is pending).
*/
const ZEN_BASE_URL = "https://opencode.ai/inference";
/**
* Free-lane blocklist (issue #56 live matrix, 2026-10-10): models the live
* chat lane has refused to serve from at least one vantage point. The Zen
* catalog still lists them, so S1 alone would expose ids that are dead from
* the reporter's network — one exclusion reason per model at the time of
* writing:
*   exo-free                             410 ModelDeprecated (upstream delisted)
*   jev-1.13-free                        400 ModelProtocolUnsupported (SystemOne-only)
*   ling-3.0-flash-fin-free              400 "Model is unavailable" (upstream-side)
*   muse-spark-1.*-contributor-free      403 RegionError, chat and responses alike
*
* The blocklist is a VANTAGE-POINT claim, not a law of physics: issue #56's
* matrix was measured from one egress, and the same ids answer HTTP 200 from
* other networks (2026-10-16, Taiwan egress: both muse ids stream 200 on
* /zen/v1/responses with the faithful adapter shape). `FREE_LANE_BLOCKLIST`
* below therefore names only the models that can NEVER serve — a protocol
* mismatch no amount of retrying fixes. Everything else moves to
* `FREE_LANE_PROBE_SET` and is re-verified per egress by the catalog's
* adaptive probe (see ModelCatalog.#probeRound): a model that answers
* 200/429 is exposed, one that answers the recorded refusal status is kept
* hidden, and a probe that errors is left hidden until the next round.
*/
const FREE_LANE_BLOCKLIST = new Set(["jev-1.13-free"]);
/** Blocklist candidates re-checked per egress by the adaptive probe.
* Seeded from the issue #56 matrix minus the never-serve protocol id. */
const FREE_LANE_PROBE_SET = new Set([
	"exo-free",
	"ling-3.0-flash-fin-free",
	"muse-spark-1.2-contributor-free",
	"muse-spark-1.3-contributor-free"
]);
/** Probe cadence: first round right after warm()'s window, then every 30min. */
const PROBE_INTERVAL_MS = 1800 * 1e3;
/** Previously verified models still in the public roster (checked 2026-10-13).
* New ids arrive through the live directory, which republishes the picker. */
const staticFreeModels = [
	"big-pickle",
	"mimo-v2.6-flash-free",
	"nemotron-3.5-lightning-free",
	"muse-spark-1.2-contributor-free",
	"muse-spark-1.3-contributor-free"
];
function isFreeModel(model) {
	return model.toLowerCase().includes("free");
}
/** Decide (model_metadata.go Decide, ported with the deprecation fix).
*
* The upstream short-circuits on isFreeModel before consulting metadata, so a
* delisted-but-still-cataloged id like deepseek-v4-flash-free stays exposed
* forever. Here the order is: a ready metadata verdict (including deprecated)
* always wins; the name fallback only fires when metadata cannot speak
* (pending or model missing) — its original documented intent (design.md 4.2).
*/
function decide(model, prices, ready) {
	const nameFree = isFreeModel(model);
	const fallback = (source) => {
		if (nameFree) return {
			allowed: true,
			source: "name_free",
			known: false
		};
		return {
			allowed: false,
			source,
			known: false
		};
	};
	if (!ready || prices.size === 0) return fallback("metadata_pending");
	const price = prices.get(model);
	if (!price) return fallback("metadata_model_missing");
	if (price.deprecated) return {
		allowed: false,
		source: "metadata_deprecated",
		known: true
	};
	if (price.input === 0 && price.output === 0) return {
		allowed: true,
		source: nameFree ? "name_and_metadata_free" : "metadata_free",
		known: true
	};
	if (price.input === void 0 || price.output === void 0) return {
		allowed: false,
		source: "metadata_cost_unknown",
		known: false
	};
	return {
		allowed: false,
		source: "metadata_paid",
		known: true
	};
}
/**
* models.dev fields the plugin knowingly overrides (issue #56 metadata note).
* Checked BEFORE the metadata in `limits()`/`reasoningCapability()`/
* `modalities()` — a fixed feed deletes its entry here.
*
* Both entries are free/paid twins of one canonical model where the feed gives
* the free lane a smaller window than the paid one:
*
* - `mimo-v2.6-flash-free`: declares `limit.context: 200000`, while the MiMo
*   V2.6 Flash model card and the official OpenCode CLI config use 1048576.
* - `deepseek-v4.1-flash-free`: declares `limit.context: 200000` while its paid
*   twin `deepseek-v4.1-flash` (same canonical id
*   `deepseek/deepseek-v4.1-flash`) declares 1000000. #81 widened the free
*   entry to 1048576 after a 2026-10-16 needle probe recalled at 1,011,668
*   prompt tokens. A repeat probe of the same lane on 2026-10-20 recalls at
*   315,596 prompt tokens, while a ~326k-token prompt is refused with
*   `context_length_exceeded`; the free lane no longer serves 1M. Declaring
*   1M is also actively harmful: DSH compacts at 0.8 × contextWindow (=800k),
*   so a long session grows past the real ceiling without ever compacting and
*   then fails with a hard upstream error (#99). 300000 is the conservative
*   serving value: DSH compacts at 240k, and a 240k prompt plus the model's
*   32k output budget is 272k, still below the verified 315,596-token recall
*   point; it also keeps >200k usable.
*/
const LOCAL_MODEL_OVERRIDES = {
	"mimo-v2.6-flash-free": { contextWindow: 1048576 },
	"deepseek-v4.1-flash-free": { contextWindow: 3e5 }
};
/** Shallow per-field override: declared fields win, the rest pass through. */
function applyLocalOverride(model, price) {
	const override = LOCAL_MODEL_OVERRIDES[model];
	if (override === void 0) return price;
	return {
		...price,
		...override
	};
}
/**
* decodeModelsDev (model_metadata.go:253-335): use the OpenCode provider
* section of models.dev, preferring the exact `opencode`/`opencode-zen` key.
*/
function decodeModelsDev(data) {
	const result = /* @__PURE__ */ new Map();
	if (!data || typeof data !== "object") return result;
	const providers = data;
	const keys = Object.keys(providers);
	const rank = (key) => {
		const lower = key.toLowerCase();
		if (lower === "opencode" || lower === "opencode-zen" || lower === "opencode_zen") return 0;
		if (lower.includes("opencode")) return 1;
		return 2;
	};
	keys.sort((left, right) => {
		const leftRank = rank(left);
		const rightRank = rank(right);
		if (leftRank !== rightRank) return leftRank - rightRank;
		return left.localeCompare(right);
	});
	for (const key of keys) {
		if (rank(key) > 1) continue;
		const provider = providers[key];
		if (!provider || typeof provider !== "object") continue;
		if (rank(key) === 1) {
			if (!`${provider.id ?? ""} ${provider.name ?? ""}`.toLowerCase().trim().includes("opencode")) continue;
		}
		const models = provider.models;
		if (!models || typeof models !== "object") continue;
		for (const [modelKey, raw] of Object.entries(models)) {
			if (!raw || typeof raw !== "object") continue;
			const modelId = typeof raw.id === "string" && raw.id.length > 0 ? raw.id : modelKey;
			const cost = raw.cost ?? {};
			const limit = raw.limit ?? {};
			const modalities = raw.modalities ?? {};
			const num = (value) => typeof value === "number" && Number.isFinite(value) ? value : void 0;
			const contextWindow = num(limit.context);
			const maxOutput = num(limit.output);
			const inputModalities = decodeModalities(modalities.input);
			result.set(modelId, {
				input: num(cost.input),
				output: num(cost.output),
				deprecated: metadataDeprecated(raw),
				reasoning: raw.reasoning === true,
				...decodeEffortValues(raw.reasoning_options),
				...contextWindow !== void 0 ? { contextWindow } : {},
				...maxOutput !== void 0 ? { maxOutput } : {},
				...inputModalities !== void 0 ? { modalities: inputModalities } : {}
			});
		}
		if (result.size > 0) return result;
	}
	return result;
}
function metadataDeprecated(model) {
	if (model.deprecated === true) return true;
	const status = String(model.status ?? model.lifecycle ?? "").toLowerCase();
	if (status === "deprecated" || status === "retired" || status === "disabled") return true;
	return model.deprecated_at != null || model.retirement_date != null;
}
/**
* models.dev `reasoning_options` (live shape 2026-09-18): an array of
* `{type: "effort", values: [...]} | {type: "toggle"} | {type: "budget_tokens", ...}`
* entries, absent when the model never thinks. Only the `effort` entries carry
* selectable levels; `toggle`/`budget_tokens` map to "reasoning, no declared
* ladder" and are reported as an empty array. Omitted entirely when the field
* is absent so cached pre-reasoning metadata stays structurally valid.
*/
function decodeEffortValues(raw) {
	if (!Array.isArray(raw)) return {};
	const values = [];
	for (const option of raw) {
		if (typeof option !== "object" || option === null) continue;
		const entry = option;
		if (entry.type !== "effort" || !Array.isArray(entry.values)) continue;
		for (const value of entry.values) if (typeof value === "string" && value.length > 0 && !values.includes(value)) values.push(value);
	}
	return values.length > 0 ? { effortValues: values } : { effortValues: [] };
}
/**
* models.dev `modalities.input` (live shape 2026-09-28): an array of lowercase
* kind strings such as ["text","image","video","pdf","audio"]. Only a non-empty
* array of non-empty strings is kept, so a malformed or absent field speaks for
* nothing and the adapter keeps its own vision pattern (isVisionModel).
*/
function decodeModalities(input) {
	if (!Array.isArray(input)) return void 0;
	const kinds = [];
	for (const kind of input) if (typeof kind === "string" && kind.length > 0 && !kinds.includes(kind)) kinds.push(kind);
	return kinds.length > 0 ? kinds : void 0;
}
const METADATA_REFRESH_MS = 1440 * 60 * 1e3;
const FETCH_TIMEOUT_MS = 3e4;
/**
* Normalize the #83 whitelist: trim and dedupe ids, drop blanks; undefined,
* an empty list, or only blanks = `null` = no gate. Every consumer (the
* decision tail, the probe skip, the startup warn) reads through this, so
* "empty means everything" has one source of truth.
*/
function normalizeAllowedModels(ids) {
	if (!Array.isArray(ids)) return null;
	const set = /* @__PURE__ */ new Set();
	for (const id of ids) if (typeof id === "string" && id.trim().length > 0) set.add(id.trim());
	return set.size > 0 ? set : null;
}
/**
* Live model directory with the S1/S2/S3 fallback chain and the timer-driven
* refresh loop. All state is in-memory; only the models.dev cache persists.
*
* Decision chain (design.md 4.1/4.2, with the deprecation-first fix):
*   1. ready metadata verdict — deprecated/paid deny, free cost allows; a
*      "free" name never overrides a negative metadata verdict
*   2. metadata cannot speak (pending/missing) — name fallback, or the
*      compile-time verified S3 list for known-good ids
*   3. the issue #83 allowedModels whitelist — narrowing only and always
*      last, so every catalog rule above stays authoritative
*/
var ModelCatalog = class {
	#zen = /* @__PURE__ */ new Set();
	#updatedAt = 0;
	#prices = /* @__PURE__ */ new Map();
	#pricesReady = false;
	#lastError = "";
	#zenFailed = false;
	#refreshSeconds;
	#cachePath;
	/** #83 whitelist, normalized; null = unrestricted. */
	#allowedModels;
	#zenBaseUrl;
	#metadataUrl;
	#fetch;
	#now;
	#timer = null;
	#stopped = false;
	#onRefresh;
	#startupRetryMs;
	/** In-flight refresh round (deduped so warm() shares start()'s first fetch). */
	#refreshing = null;
	#probeDisabled;
	#probeIntervalMs;
	#probeImpl;
	/** Adaptive-probe state: pass = exposed, refused/error = hidden this boot. */
	#probeVerdicts = /* @__PURE__ */ new Map();
	#probeTimer = null;
	#probing = null;
	constructor(options = {}) {
		this.#refreshSeconds = options.refreshSeconds ?? 300;
		this.#cachePath = options.cachePath;
		this.#allowedModels = normalizeAllowedModels(options.allowedModels);
		this.#zenBaseUrl = options.zenBaseUrl ?? ZEN_BASE_URL;
		this.#metadataUrl = options.metadataUrl ?? "https://models.dev/api.json";
		this.#fetch = options.fetchImpl ?? fetch;
		this.#now = options.now ?? Date.now;
		this.#onRefresh = options.onRefresh;
		this.#startupRetryMs = options.startupRetryMs ?? 15e3;
		this.#probeDisabled = options.probeDisabled ?? false;
		this.#probeIntervalMs = options.probeIntervalMs ?? PROBE_INTERVAL_MS;
		this.#probeImpl = options.probeImpl ?? defaultProbeImpl(this.#zenBaseUrl, this.#fetch);
	}
	/**
	* Start the refresh loop: immediate S1+S2, fast retries while the live
	* catalog is still empty (the first fetch often races the machine's network
	* coming up — VPN/TUN reconnect, DNS), then the normal cadence (S2 24h).
	*/
	async start() {
		await this.refreshOnce();
		let attempts = 0;
		while (this.#zen.size === 0 && attempts < 4 && !this.#stopped) {
			attempts += 1;
			await new Promise((resolve) => setTimeout(resolve, this.#startupRetryMs));
			if (this.#stopped) return;
			await this.refreshOnce();
		}
		if (this.#stopped) return;
		this.#timer = setInterval(() => {
			this.refreshOnce();
		}, this.#refreshSeconds * 1e3);
		this.#timer.unref?.();
		if (!this.#probeDisabled) {
			this.#probeTimer = setTimeout(() => void this.probeOnce(), 5e3);
			this.#probeTimer.unref?.();
		}
	}
	stop() {
		this.#stopped = true;
		if (this.#timer) {
			clearInterval(this.#timer);
			this.#timer = null;
		}
		if (this.#probeTimer) {
			clearTimeout(this.#probeTimer);
			this.#probeTimer = null;
		}
	}
	/** One refresh round, deduped while in flight: a concurrent caller (warm()
	*  racing start()'s first round, or the interval timer) joins the running
	*  round instead of firing a parallel fetch of the same endpoints. */
	refreshOnce() {
		if (this.#refreshing === null) this.#refreshing = this.#refreshRound().finally(() => {
			this.#refreshing = null;
		});
		return this.#refreshing;
	}
	async #refreshRound() {
		await Promise.allSettled([this.refreshZen(), this.refreshMetadata()]);
		if (this.#onRefresh) try {
			this.#onRefresh(this.snapshot(), this.#lastError);
		} catch {}
	}
	async refreshZen() {
		try {
			const ids = await fetchZenModels(this.#zenBaseUrl, this.#fetch, opencodeUserAgent());
			this.#zen = new Set(ids);
			this.#zenFailed = false;
			this.#updatedAt = this.#now();
			this.#lastError = "";
		} catch (err) {
			this.#zenFailed = true;
			this.#lastError = err instanceof Error ? err.message : String(err);
		}
	}
	async refreshMetadata() {
		if (this.#cachePath && !this.#pricesReady) {
			const cached = await loadMetadataCache(this.#cachePath, this.#now).catch(() => null);
			if (cached && cached.size > 0) {
				this.#prices = cached;
				this.#pricesReady = true;
			}
		}
		try {
			const response = await withTimeout(this.#fetch(this.#metadataUrl, { headers: { accept: "application/json" } }));
			if (!response.ok) throw new Error(`models.dev returned HTTP ${response.status}`);
			const prices = decodeModelsDev(await response.json());
			if (prices.size === 0) throw new Error("models.dev contains no OpenCode model metadata");
			this.#prices = prices;
			this.#pricesReady = true;
			if (this.#cachePath) await saveMetadataCache(this.#cachePath, prices, this.#now());
		} catch (err) {
			if (this.#cachePath && !this.#pricesReady) {
				const cached = await loadMetadataCache(this.#cachePath, this.#now).catch(() => null);
				if (cached && cached.size > 0) {
					this.#prices = cached;
					this.#pricesReady = true;
					return;
				}
			}
			this.#lastError = err instanceof Error ? err.message : String(err);
		}
	}
	/**
	* Resolve once the first live fetch has settled, so a model-list read is
	* never answered from the bootstrap list (issue #45: the host caches the
	* snapshot its picker took at adapter registration, and the re-read
	* triggers are topology/settings events a warming catalog never fires —
	* so the 7-id staticFreeModels roster could stick for the whole host
	* generation). Bounded: a dead network still answers promptly with the
	* static list. Joins start()'s in-flight round when one exists (no
	* duplicate fetch), or triggers a round of its own when none does.
	*/
	async warm(ms = 4e3) {
		if (this.#zen.size > 0 || this.#stopped) return;
		let timer;
		const timeout = new Promise((resolve) => {
			timer = setTimeout(resolve, ms);
			timer.unref?.();
		});
		try {
			await Promise.race([this.refreshOnce().catch(() => {}), timeout]);
		} finally {
			clearTimeout(timer);
		}
	}
	decision(model) {
		if (FREE_LANE_BLOCKLIST.has(model)) return {
			allowed: false,
			source: "local_blocklist",
			known: true
		};
		if (FREE_LANE_PROBE_SET.has(model) && this.#probeVerdicts.get(model) !== "pass") return {
			allowed: false,
			source: "probe_pending",
			known: false
		};
		const metadata = decide(model, this.#prices, this.#pricesReady);
		let verdict = metadata;
		if (!metadata.allowed && (metadata.source === "metadata_deprecated" || !metadata.known) && staticFreeModels.includes(model)) verdict = {
			allowed: true,
			source: "static_verified",
			known: false
		};
		if (verdict.allowed && !this.#whitelistAllows(model)) return {
			allowed: false,
			source: "not_in_whitelisted",
			known: true
		};
		return verdict;
	}
	/** The #83 gate: an unset/empty whitelist allows everything, a set one is
	* exact-match by model id. */
	#whitelistAllows(model) {
		return this.#allowedModels === null || this.#allowedModels.has(model);
	}
	/**
	* The #83 whitelist as a serving gate for the adapter: zen-adapter consults
	* this BEFORE any wire traffic, so a direct call to an excluded id fails
	* fast instead of spending anonymous-lane quota on a model the picker would
	* never offer. Deliberately NOT the full decision() chain — only the
	* whitelist gates serving; probe-pending/blocklisted ids keep today's
	* serving behavior (the upstream answers for itself), a question the
	* maintainer may revisit separately.
	*/
	whitelistAllows(model) {
		return this.#whitelistAllows(model);
	}
	/** ids exposed to DSH: S1 ∩ allowed, or S3 while the live catalog is pending. */
	list() {
		if (this.#zen.size === 0) return this.#zenFailed ? [] : staticFreeModels.filter((model) => this.decision(model).allowed);
		const out = [];
		for (const model of this.#zen) if (this.decision(model).allowed) out.push(model);
		return out.sort();
	}
	/**
	* Adaptive vantage-point probe (2026-10-16): models the issue #56 live
	* matrix refused from one egress answer 200 from others; this host's own
	* exit is the only verdict that matters, so probe those ids directly and
	* expose them when the lane answers 200/429.
	*
	* One round: probe every FREE_LANE_PROBE_SET id that is still in the live
	* Zen catalog, store the verdict, schedule the next round. A probe uses a
	* 1-token streaming request on the lane the model actually speaks
	* (apiForModel: muse → Responses, everything else → chat), with the
	* adapter's canonical session id and disguise headers so a pass here is
	* exactly what a real turn would send. Verdicts are per boot; refused
	* models are retried on the next round, so an upstream unblock or a
	* threshold flip is picked up without a host restart.
	*/
	async #probeRound() {
		if (this.#stopped) return;
		const nextRound = () => {
			if (this.#stopped || this.#probeDisabled) return;
			this.#probeTimer = setTimeout(() => void this.probeOnce(), this.#probeIntervalMs);
			this.#probeTimer.unref?.();
		};
		const ids = [...FREE_LANE_PROBE_SET].filter((id) => this.#zen.has(id) && this.#whitelistAllows(id));
		if (ids.length === 0) {
			nextRound();
			return;
		}
		for (const model of ids) {
			const api = apiForModel(model);
			const verdict = await this.#probeImpl(model, api).catch(() => "error");
			this.#probeVerdicts.set(model, verdict);
		}
		if (this.#onRefresh) try {
			this.#onRefresh(this.snapshot(), this.#lastError);
		} catch {}
		nextRound();
	}
	/** Public entry: run one probe round, deduped like refreshOnce(). Manual
	* calls always run (tests drive the round this way); probeDisabled only
	* suppresses the scheduled timers so a disabled catalog never probes on
	* its own. */
	probeOnce() {
		if (this.#probing === null) this.#probing = this.#probeRound().finally(() => {
			this.#probing = null;
		});
		return this.#probing;
	}
	/** Current adaptive-probe verdicts (healthz/observability). */
	probeVerdicts() {
		return Object.fromEntries(this.#probeVerdicts);
	}
	/**
	* models.dev declared limits for one model: `contextWindow` (limit.context)
	* and `maxOutput` (limit.output). undefined when the metadata cannot speak
	* for the model (pending, or id absent) or declares no limits — the caller
	* then keeps its own defaults.
	*/
	limits(model) {
		const price = applyLocalOverride(model, this.#prices.get(model));
		if (!price) return void 0;
		if (price.contextWindow === void 0 && price.maxOutput === void 0) return void 0;
		return {
			...price.contextWindow !== void 0 ? { contextWindow: price.contextWindow } : {},
			...price.maxOutput !== void 0 ? { maxOutput: price.maxOutput } : {}
		};
	}
	/**
	* models.dev `modalities.input` for one model: the input kinds it accepts
	* (["text","image","video",…]). undefined when the metadata cannot speak for
	* the model (pending, or id absent) or declares no modalities — the caller
	* then keeps its own vision pattern (isVisionModel).
	*/
	modalities(model) {
		const modalities = applyLocalOverride(model, this.#prices.get(model))?.modalities;
		return modalities === void 0 ? void 0 : [...modalities];
	}
	/**
	* models.dev reasoning capability for one model: `reasoning` flags the
	* always-think models, `effortValues` the declared selectable levels
	* (empty array = reasons but declares no ladder). undefined when the
	* metadata cannot speak for the model (pending, or id absent).
	*/
	reasoningCapability(model) {
		const price = applyLocalOverride(model, this.#prices.get(model));
		if (!price) return void 0;
		return {
			reasoning: price.reasoning === true,
			effortValues: price.effortValues ?? []
		};
	}
	/** healthz models block (design.md 6.1). */
	snapshot() {
		const age = this.#updatedAt === 0 ? Infinity : this.#now() - this.#updatedAt;
		const stale = this.#updatedAt !== 0 && age > 600 * 1e3;
		return {
			status: this.#updatedAt === 0 ? this.#zenFailed ? "error" : "pending" : this.#zenFailed || stale ? "stale" : "ready",
			total: this.#zen.size,
			exposed: this.list().length,
			...this.#updatedAt !== 0 ? { lastRefresh: new Date(this.#updatedAt).toISOString() } : {}
		};
	}
	get lastError() {
		return this.#lastError;
	}
};
async function withTimeout(promise, timeoutMs = FETCH_TIMEOUT_MS) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		return await promise;
	} finally {
		clearTimeout(timer);
	}
}
/** S1: fetchModels (models.go:587-618) with the CLI disguise headers. */
async function fetchZenModels(zenBaseUrl, fetchImpl, userAgent) {
	const response = await withTimeout(fetchImpl(`${zenBaseUrl.replace(/\/+$/, "")}/v1/models`, { headers: {
		authorization: "Bearer public",
		"user-agent": userAgent,
		"x-opencode-client": "cli",
		accept: "application/json"
	} }));
	if (!response.ok) throw new Error(`models endpoint returned HTTP ${response.status}`);
	const payload = await response.json();
	const models = [];
	for (const item of payload.data ?? []) if (typeof item?.id === "string" && item.id.length > 0) models.push(item.id);
	if (models.length === 0) throw new Error("models endpoint returned an empty list");
	return models;
}
async function saveMetadataCache(path, prices, now) {
	const cache = {
		updatedAt: now,
		prices: [...prices]
	};
	const tmp = `${path}.${process.pid}.tmp`;
	await mkdir(dirname(path), { recursive: true });
	await writeFile(tmp, JSON.stringify(cache), "utf8");
	await rm(path, { force: true });
	await rename(tmp, path);
}
async function loadMetadataCache(path, now = Date.now) {
	const raw = JSON.parse(await readFile(path, "utf8"));
	if (now() - raw.updatedAt > 7 * METADATA_REFRESH_MS) throw new Error("models.dev cache too old");
	return new Map(raw.prices);
}
/** Default cache location next to the agent data dir (config.ts convention). */
function defaultCachePath(dataDir) {
	return join(dataDir, "agent-config.json.models.dev.json");
}
const PROBE_TIMEOUT_MS = 15e3;
/**
* The probe speaks the same wire shape the adapter uses for a real turn:
* canonical ses_ id + disguise headers + gate tools + streaming, 1 output
* token. Verdict mapping mirrors the catalog philosophy (design.md): any
* status the gate itself issues on a healthy lane (200, or the free-lane
* throttle 429) counts as pass; the recorded refusal statuses count as
* refused; transport/API errors count as error (hidden until next round).
*/
function defaultProbeImpl(zenBaseUrl, fetchImpl) {
	const base = zenBaseUrl.replace(/\/+$/, "");
	return async (model, api) => {
		const headers = {
			...disguiseHeaders(deriveRequestIDs([{
				role: "user",
				content: "probe"
			}])),
			"content-type": "application/json"
		};
		let url;
		let body;
		if (api === "openai-responses") {
			url = `${base}/v1/responses`;
			body = {
				model,
				input: [{
					role: "user",
					content: [{
						type: "input_text",
						text: "probe"
					}]
				}],
				stream: true,
				max_output_tokens: 16,
				tools: FREE_LANE_GATE_TOOL_NAMES.map((name) => ({
					type: "function",
					...freeLaneGateTool(name).function
				})),
				tool_choice: "auto"
			};
		} else {
			url = `${base}/v1/chat/completions`;
			body = {
				model,
				messages: [{
					role: "user",
					content: "probe",
					timestamp: 0
				}],
				stream: true,
				max_tokens: 8,
				tools: FREE_LANE_GATE_TOOL_NAMES.map((name) => freeLaneGateTool(name)),
				tool_choice: "none"
			};
		}
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
		try {
			const response = await fetchImpl(url, {
				method: "POST",
				headers,
				body: JSON.stringify(body),
				signal: controller.signal
			});
			if (response.body) {
				const reader = response.body.getReader();
				try {
					await reader.read();
				} finally {
					reader.cancel().catch(() => {});
				}
			}
			if (response.status === 200 || response.status === 429) return "pass";
			if (response.status === 403 || response.status === 400 || response.status === 410) return "refused";
			return "error";
		} catch {
			return "error";
		} finally {
			clearTimeout(timer);
		}
	};
}

//#endregion
export { deriveRequestIDs as C, stableID as D, randomID as E, canonicalSessionID as S, opencodeUserAgent as T, ensureResponsesFreeLaneShape as _, ZEN_BASE_URL as a, apiForModel as b, defaultCachePath as c, isFreeModel as d, normalizeAllowedModels as f, ensureFreeLaneShape as g, GATE_TOOL_ALIASES as h, PROBE_INTERVAL_MS as i, defaultProbeImpl as l, FREE_LANE_GATE_TOOL_NAMES as m, FREE_LANE_PROBE_SET as n, decide as o, staticFreeModels as p, ModelCatalog as r, decodeModelsDev as s, FREE_LANE_BLOCKLIST as t, fetchZenModels as u, freeLaneGateTool as v, disguiseHeaders as w, isResponsesModel as x, toPiContext as y };