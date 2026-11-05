import { D as stableID, E as randomID, S as canonicalSessionID, T as opencodeUserAgent, a as ZEN_BASE_URL, m as FREE_LANE_GATE_TOOL_NAMES, v as freeLaneGateTool, w as disguiseHeaders } from "./catalog-vHIBECOJ.js";
import { n as exitProxyUri, r as httpsProxyOptions } from "./dispatcher-DEwYglZ-.js";

//#region src/pool/pool.ts
/** Quality grade from admission latency (GoProxy thresholds). */
function gradeOf(latencyMs) {
	if (latencyMs <= 500) return "S";
	if (latencyMs <= 1e3) return "A";
	if (latencyMs <= 2e3) return "B";
	return "C";
}
/**
* Sort key for latency. `0` means "never measured" (a trusted-conversion
* fallback, or a manual entry before its first probe), NOT "instantaneously
* fast". Treating it as a real measurement put unverified exits ahead of every
* exit that had actually answered, so it sorts last instead.
*/
function latencyRank(latencyMs) {
	return latencyMs > 0 ? latencyMs : Number.POSITIVE_INFINITY;
}
const banKey = (exitId, model) => `${exitId}\u0000${model}`;
var ExitPool = class {
	#nodes = /* @__PURE__ */ new Map();
	#health = /* @__PURE__ */ new Map();
	#bans = /* @__PURE__ */ new Map();
	/** exitId -> its ban records, so per-exit lookups never scan all bans. */
	#bansByExit = /* @__PURE__ */ new Map();
	#sessionExit = /* @__PURE__ */ new Map();
	/** Passive-signal counters per exit (docs/ip-pool.md §4.3 被动 + IP-6 stats). */
	#passive = /* @__PURE__ */ new Map();
	#targetSize;
	#cooldownBase;
	#cooldownMax;
	#banConfirmations;
	#deadEvictions;
	#avoidMs;
	/** exitId -> epoch ms until which a rotate loop should skip it (§3.4). */
	#avoidUntil = /* @__PURE__ */ new Map();
	#now;
	constructor(options = {}) {
		this.#targetSize = options.targetSize ?? 20;
		this.#cooldownBase = options.limitedCooldownBaseMs ?? 6e4;
		this.#cooldownMax = options.limitedCooldownMaxMs ?? 30 * 6e4;
		this.#banConfirmations = options.modelBanConfirmations ?? 2;
		this.#deadEvictions = options.deadEvictions ?? 2;
		this.#avoidMs = options.avoidMs ?? 3e4;
		this.#now = options.now ?? Date.now;
	}
	/** Live re-apply of the free-pool target capacity (settings page, §5.1). */
	setTargetSize(value) {
		this.#targetSize = Math.max(1, value);
	}
	/** The effective target capacity (diagnostics / status bridge). */
	get targetSize() {
		return this.#targetSize;
	}
	/** Upsert a node (admission wrote its details); returns false on duplicate
	*  exit IP for a different address — two addresses sharing one exit IP are
	*  one quota bucket and must not both live in the pool (3.1). */
	add(node) {
		if (node.exitIP !== "" && this.#hasExitIP(node.exitIP, node.id)) return false;
		this.#nodes.set(node.id, node);
		if (!this.#health.has(node.id)) this.#health.set(node.id, {
			state: "unknown",
			lastProbedAt: 0,
			consecutiveLimited: 0,
			cooldownUntil: 0,
			inflight: false,
			deadStrikes: 0,
			lastProbeFailure: "",
			lastProbeReason: ""
		});
		return true;
	}
	#hasExitIP(exitIP, exceptId) {
		for (const node of this.#nodes.values()) if (node.id !== exceptId && node.exitIP === exitIP) return true;
		return false;
	}
	has(id) {
		return this.#nodes.has(id);
	}
	get(id) {
		return this.#nodes.get(id);
	}
	/** Drop a node entirely (dead eviction for free nodes, cleanup otherwise). */
	remove(id) {
		this.#nodes.delete(id);
		this.#health.delete(id);
		this.#passive.delete(id);
		this.#avoidUntil.delete(id);
		const nodeBans = this.#bansByExit.get(id);
		if (nodeBans !== void 0) {
			for (const model of nodeBans.keys()) this.#bans.delete(banKey(id, model));
			this.#bansByExit.delete(id);
		}
		for (const [session, exitId] of this.#sessionExit) if (exitId === id) this.#sessionExit.delete(session);
		this.#clearPinnedIf(id);
	}
	/** Single write path for ban records, keeping the per-exit index in sync. */
	#setBan(id, model, ban) {
		this.#bans.set(banKey(id, model), ban);
		let nodeBans = this.#bansByExit.get(id);
		if (nodeBans === void 0) {
			nodeBans = /* @__PURE__ */ new Map();
			this.#bansByExit.set(id, nodeBans);
		}
		nodeBans.set(model, ban);
	}
	/** Disable without dropping (dead manual/subscription/goproxy nodes, 3.5). */
	markDead(id) {
		const health = this.#health.get(id);
		if (!health) return;
		health.state = "dead";
		health.inflight = false;
		if (health.lastProbeFailure === "") health.lastProbeFailure = "transport";
	}
	#clearPinnedIf(id) {
		if (this.pinnedId === id) this.pinnedId = "";
	}
	pinnedId = "";
	/** Pin a node (docs/ip-pool.md 3.6); unpinning any previous pinned node. */
	pin(id) {
		if (!this.#nodes.has(id)) return false;
		this.pinnedId = id;
		return true;
	}
	unpin() {
		this.pinnedId = "";
	}
	/** Try to take the exit's serial-probe slot; false when already taken. */
	takeProbeLock(id) {
		const health = this.#health.get(id);
		if (!health || health.inflight) return false;
		health.inflight = true;
		return true;
	}
	releaseProbeLock(id) {
		const health = this.#health.get(id);
		if (health) health.inflight = false;
	}
	markOk(id, model) {
		const health = this.#health.get(id);
		if (health) {
			health.state = "ok";
			health.lastProbedAt = this.#now();
			health.consecutiveLimited = 0;
			health.cooldownUntil = 0;
			health.deadStrikes = 0;
			health.lastProbeFailure = "";
			health.lastProbeReason = "";
		}
		if (model !== void 0) this.#setBan(id, model, {
			state: "ok",
			bannedAt: 0,
			consecutiveFailures: 0
		});
	}
	/**
	* Record a failed probe's class + reason without touching health.
	*
	* Split out of the mark* family deliberately: several failure classes
	* (server-error, geo-blocked, slow, malformed) must leave the exit's health
	* EXACTLY as it was — the node answered, it just could not serve this probe
	* — yet the settings card still needs to show "probed, and here is why it
	* did not pass" instead of the indistinguishable 未探活. The single
	* write path keeps `lastProbeFailure` and `lastProbeReason` consistent.
	*/
	markProbeFailure(id, failure, reason = "") {
		const health = this.#health.get(id);
		if (!health) return;
		health.lastProbedAt = this.#now();
		health.lastProbeFailure = failure;
		health.lastProbeReason = reason;
	}
	/** 429: exit-level cooldown with exponential backoff (3.2 / 4.6). */
	markLimited(id) {
		const health = this.#health.get(id);
		if (!health) return 0;
		health.consecutiveLimited += 1;
		health.state = "ok";
		health.lastProbeFailure = "";
		health.lastProbeReason = "";
		const backoff = Math.min(this.#cooldownBase * 2 ** (health.consecutiveLimited - 1), this.#cooldownMax);
		health.cooldownUntil = this.#now() + backoff;
		return health.cooldownUntil;
	}
	/** Deterministic refusal (upstream RegionError: region blocks are a
	*  property of the exit, not transient noise) — ban the pairing at once. */
	markModelBanned(id, model) {
		this.#setBan(id, model, {
			state: "banned",
			bannedAt: this.#now(),
			consecutiveFailures: this.#banConfirmations
		});
	}
	/** 401/403: model-level suspicion; banned after N consecutive (3.2). */
	markModelSignal(id, model) {
		const current = this.#bans.get(banKey(id, model)) ?? {
			state: "ok",
			bannedAt: 0,
			consecutiveFailures: 0
		};
		current.consecutiveFailures += 1;
		if (current.consecutiveFailures >= this.#banConfirmations && current.state !== "banned") {
			current.state = "banned";
			current.bannedAt = this.#now();
		} else if (current.state !== "banned") current.state = "suspect";
		this.#setBan(id, model, current);
		return current.state;
	}
	/** Transport failure / 5xx / probe timeout: dead, with free-source eviction
	*  after repeated strikes (3.5). Returns true when the node was evicted.
	*
	*  This is the ONLY source-dependent rule in the health model (docs 3.5):
	*  a dead `free` node is dropped so its slot can be refilled, while a dead
	*  manual/subscription node is disabled in place and re-probed by
	*  `PeriodicProber`. The verdict itself — that the link is gone — is uniform. */
	markDeadStrike(id, reason = "") {
		const node = this.#nodes.get(id);
		const health = this.#health.get(id);
		if (!node || !health) return false;
		health.state = "dead";
		health.inflight = false;
		health.deadStrikes += 1;
		health.lastProbeFailure = "transport";
		health.lastProbedAt = this.#now();
		if (reason !== "") health.lastProbeReason = reason;
		if (node.source === "free" && health.deadStrikes >= this.#deadEvictions) {
			this.remove(id);
			return true;
		}
		return false;
	}
	/**
	* Passive signal from a REAL request outcome (docs/ip-pool.md §4.2 rule
	* table, §4.3 被动 row): one response header read at the routing layer,
	* applied to the two-tier health exactly like a probe would. Returns the
	* classification for diagnostics.
	*/
	recordPassive(id, statusCode, model, regionBlocked = false) {
		if (!this.#nodes.has(id)) return "ok";
		if (statusCode >= 200 && statusCode < 300) {
			this.markOk(id, model);
			this.#countPassive(id, "ok");
			return "ok";
		}
		if (statusCode === 429) {
			this.markLimited(id);
			this.#countPassive(id, "limited");
			return "limited";
		}
		if (statusCode === 401 || statusCode === 403) {
			if (regionBlocked) this.markModelBanned(id, model);
			else this.markModelSignal(id, model);
			this.#countPassive(id, "refused");
			return "refused";
		}
		this.#countPassive(id, "dead");
		return "dead";
	}
	/** Transport-level failure of a real request (connection died mid-flight). */
	recordPassiveTransport(id) {
		if (!this.#nodes.has(id)) return;
		this.markDeadStrike(id);
		this.#countPassive(id, "transport");
	}
	/** Drop the session's sticky exit when its exit degraded (§3.3). */
	rerouteSession(session) {
		this.#sessionExit.delete(session);
	}
	/** The session's current sticky exit, if any (adapter-side 403 bookkeeping:
	*  the dispatcher recorded the refusal against this exit). */
	exitOfSession(session) {
		return this.#sessionExit.get(session) ?? null;
	}
	#countPassive(id, kind) {
		const bucket = this.#passive.get(id) ?? {
			ok: 0,
			limited: 0,
			refused: 0,
			dead: 0,
			transport: 0
		};
		if (kind === "limited") bucket.limited += 1;
		else if (kind === "refused") bucket.refused += 1;
		else if (kind === "dead") bucket.dead += 1;
		else if (kind === "transport") bucket.transport += 1;
		else bucket.ok += 1;
		this.#passive.set(id, bucket);
	}
	/** Passive-signal counters for one exit (status bridge, IP-6). */
	passiveStats(id) {
		return { ...this.#passive.get(id) ?? {
			ok: 0,
			limited: 0,
			refused: 0,
			dead: 0,
			transport: 0
		} };
	}
	isUsable(id, model) {
		const health = this.#health.get(id);
		if (!health || health.state === "dead") return false;
		if (health.cooldownUntil > this.#now()) return false;
		return this.#bans.get(banKey(id, model))?.state !== "banned";
	}
	/**
	* Mark an exit as "just failed this request" so the rotate loop in the same
	* user turn moves on. A 403 whose ban still needs a second sample, and a 5xx
	* (which deliberately does not strike the exit dead), both leave
	* `isUsable()` true — without this the restarted stream re-picked the very
	* exit that had just failed it (measured: `sub-0 -> sub-0 -> sub-5`).
	*/
	avoid(id) {
		if (!this.#nodes.has(id)) return;
		this.#avoidUntil.set(id, this.#now() + this.#avoidMs);
	}
	/** Exits currently in a rotate-avoid window. */
	#avoiding(id) {
		const until = this.#avoidUntil.get(id);
		if (until === void 0) return false;
		if (until > this.#now()) return true;
		this.#avoidUntil.delete(id);
		return false;
	}
	/**
	* Pick the exit for one upstream request. Pinned wins while usable (3.6);
	* the rotation pool then prefers session stickiness, health, fewer
	* cooldowns and lower latency with a same-tier shuffle. Pure; no IO.
	*/
	pick(session, model) {
		if (this.pinnedId !== "" && this.isUsable(this.pinnedId, model)) return this.pinnedId;
		const last = this.#sessionExit.get(session);
		if (last !== void 0 && this.isUsable(last, model) && !this.#avoiding(last) && this.#health.get(last)?.inflight !== true) return last;
		const usable = [...this.#nodes.keys()].filter((id) => this.isUsable(id, model));
		if (usable.length === 0) return null;
		const preferred = usable.filter((id) => !this.#avoiding(id));
		const candidates = preferred.length > 0 ? preferred : usable;
		const health = (id) => this.#health.get(id);
		const node = (id) => this.#nodes.get(id);
		candidates.sort((left, right) => {
			const a = health(left);
			const b = health(right);
			const stateRank = (h) => h.state === "ok" ? 0 : 1;
			const byState = stateRank(a) - stateRank(b);
			if (byState !== 0) return byState;
			const busyRank = (h) => h.inflight ? 1 : 0;
			const byInflight = busyRank(a) - busyRank(b);
			if (byInflight !== 0) return byInflight;
			const byLimited = a.consecutiveLimited - b.consecutiveLimited;
			if (byLimited !== 0) return byLimited;
			const byLatency = latencyRank(node(left).latencyMs) - latencyRank(node(right).latencyMs);
			if (byLatency !== 0) return byLatency;
			return Math.random() < .5 ? -1 : 1;
		});
		const chosen = candidates[0];
		if (chosen === void 0) return null;
		this.#sessionExit.set(session, chosen);
		return chosen;
	}
	/** Usable = not dead, not cooling, and not banned for every probe model —
	*  approximation: nodes banned for all their known models count as
	*  unusable; with no ban data they stay usable (they are only banned for
	*  specific models, which the caller's model already filters). */
	#isAvailable(id) {
		const health = this.#health.get(id);
		if (!health || health.state === "dead") return false;
		if (health.cooldownUntil > this.#now()) return false;
		const nodeBans = this.#bansByExit.get(id);
		if (nodeBans === void 0 || nodeBans.size === 0) return true;
		let allBanned = true;
		for (const ban of nodeBans.values()) if (ban.state !== "banned") {
			allBanned = false;
			break;
		}
		return !allBanned;
	}
	/** Count usable free-source nodes toward the refill thresholds. */
	availableFreeCount() {
		let count = 0;
		for (const node of this.#nodes.values()) if (node.source === "free" && this.#isAvailable(node.id)) count += 1;
		return count;
	}
	/** Determine the pool state over the free-source pool (3.5 thresholds). */
	state() {
		if (this.#targetSize <= 0) return "healthy";
		const ratio = this.availableFreeCount() / this.#targetSize;
		if (ratio < .1) return "emergency";
		if (ratio < .3) return "critical";
		if (ratio < .95) return "warning";
		return "healthy";
	}
	/** Admission quota for a refill round: how many free nodes to accept. */
	admissionQuota() {
		return Math.max(0, this.#targetSize - this.availableFreeCount());
	}
	/** Replace the worst free node (C grade / oldest) to make room (3.5). */
	evictWorstFree() {
		let worst = null;
		for (const node of this.#nodes.values()) {
			if (node.source !== "free") continue;
			if (!worst) {
				worst = node;
				continue;
			}
			const gradeRank = {
				S: 0,
				A: 1,
				B: 2,
				C: 3
			};
			const byGrade = gradeRank[node.quality] - gradeRank[worst.quality];
			if (byGrade > 0 || byGrade === 0 && node.addedAt < worst.addedAt) worst = node;
		}
		if (!worst) return false;
		this.remove(worst.id);
		return true;
	}
	/** Is the pool full for free-source admission? (pinned and non-free nodes
	*  never count against the target, 3.5/3.6.) */
	isFreeFull() {
		return this.freeCount() >= this.#targetSize;
	}
	freeCount() {
		let count = 0;
		for (const node of this.#nodes.values()) if (node.source === "free") count += 1;
		return count;
	}
	snapshot() {
		const bySource = {
			free: 0,
			manual: 0,
			subscription: 0,
			goproxy: 0
		};
		for (const node of this.#nodes.values()) bySource[node.source] += 1;
		return {
			state: this.state(),
			total: this.#nodes.size,
			bySource,
			availableFree: this.availableFreeCount(),
			pinned: this.pinnedId
		};
	}
	list() {
		const out = [];
		for (const [id, node] of this.#nodes) {
			const health = this.#health.get(id);
			const bans = [];
			for (const [key, ban] of this.#bans) if (key.startsWith(`${id}\u0000`)) bans.push({
				model: key.slice(id.length + 1),
				ban
			});
			out.push({
				...node,
				health,
				bans
			});
		}
		return out;
	}
};

//#endregion
//#region src/pool/admission.ts
/** Classify an echo-step HTTP status (ip-api answered through the candidate). */
function classifyEchoStatus(statusCode) {
	if (statusCode === 429) return "quota";
	if (statusCode >= 500) return "server-error";
	return "refused";
}
/** Classify an upstream (Zen) HTTP status; 429 is a quota verdict, not a refusal. */
function classifyUpstreamStatus(statusCode) {
	if (statusCode === 429) return "quota";
	if (statusCode >= 500) return "server-error";
	return "refused";
}
/**
* Coarse screen (admission steps 1+2, docs/ip-pool.md 4.5 修订): one request
* through the candidate to the ip echo. This step touches only the wild
* candidate and a public IP service — never the anonymous lane — so callers
* may fan it out at high concurrency (admissionFanout; GoProxy uses 300 for
* the same reason). Steps 3-4 (which spend anonymous-lane quota) stay on the
* bounded Prober.
*/
async function coarseScreen(deps, candidate, options = {}) {
	const ipEcho = deps.ipEchoUrl ?? DEFAULT_IP_ECHO;
	const timeout = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const blocked = new Set(deps.blockedCountries ?? ["CN"]);
	const maxResponseMs = options.relaxed ? RELAXED_RESPONSE_MS : 3e3;
	const now = options.now ?? Date.now;
	let agent = null;
	try {
		agent = new deps.undici.ProxyAgent({
			uri: exitProxyUri(candidate.address, candidate.protocol),
			...candidate.protocol === "https" ? httpsProxyOptions() : {}
		});
	} catch (err) {
		return {
			rejected: `agent-build: ${err instanceof Error ? err.message : String(err)}`,
			failure: "malformed"
		};
	}
	try {
		const started = now();
		const echo = await withTimeout(deps.undici.request(ipEcho, { dispatcher: agent }), timeout, "probe");
		const latencyMs = now() - started;
		if (echo.statusCode !== 200) return {
			rejected: `echo HTTP ${echo.statusCode}`,
			failure: classifyEchoStatus(echo.statusCode)
		};
		let body;
		try {
			body = JSON.parse(await echo.body.text());
		} catch {
			return {
				rejected: "echo body not JSON",
				failure: "malformed"
			};
		}
		if (body.status !== "success" || !body.query) return {
			rejected: "echo did not report an exit IP",
			failure: "malformed"
		};
		const country = body.countryCode?.toUpperCase() ?? "";
		if (blocked.has(country)) return {
			rejected: `geo-blocked ${country}`,
			failure: "geo-blocked"
		};
		if (latencyMs > maxResponseMs && !options.pinned) return {
			rejected: `latency ${latencyMs}ms > ${maxResponseMs}ms`,
			failure: "slow"
		};
		return {
			exitIP: body.query,
			exitLocation: `${body.countryCode} ${body.city}`.trim(),
			latencyMs
		};
	} catch (err) {
		return {
			rejected: err instanceof Error ? err.message : String(err),
			failure: "echo-unavailable"
		};
	} finally {
		agent.close().catch(() => {});
	}
}
/** Bounded fan-out helper for the coarse screen (wild candidates only).
*  onProgress reports (screensCompleted, survivorsSoFar) as the fan-out runs
*  (settings-page refill progress, docs §5.3). */
async function coarseScreenBatch(deps, candidates, options = {}) {
	const fanout = Math.max(1, options.fanout ?? 300);
	const results = /* @__PURE__ */ new Map();
	const queue = [...candidates];
	let done = 0;
	const worker = async () => {
		for (;;) {
			const candidate = queue.shift();
			if (candidate === void 0) return;
			const verdict = await coarseScreen(deps, candidate, options);
			done += 1;
			if ("exitIP" in verdict) results.set(candidate.address, verdict);
			options.onProgress?.(done, results.size);
		}
	};
	await Promise.all(Array.from({ length: Math.min(fanout, candidates.length) }, () => worker()));
	return results;
}
const DEFAULT_IP_ECHO = "http://ip-api.com/json/?fields=status,country,countryCode,city,query";
const DEFAULT_TIMEOUT_MS = 8e3;
/** critical-state relaxed latency gate (docs/ip-pool.md 4.6 maxResponseMs). */
const RELAXED_RESPONSE_MS = 6e3;
function withTimeout(promise, ms, label) {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(/* @__PURE__ */ new Error(`${label} timed out after ${ms}ms`)), ms);
		promise.then((value) => {
			clearTimeout(timer);
			resolve(value);
		}, (err) => {
			clearTimeout(timer);
			reject(err);
		});
	});
}
async function admitCandidate(deps, candidate, options = {}) {
	const zenBase = deps.zenBaseUrl ?? ZEN_BASE_URL;
	const timeout = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const smokeModel = deps.smokeModel ?? "big-pickle";
	options.now ?? Date.now;
	const probeHeaders = disguiseHeaders({
		session: canonicalSessionID(`admission:${candidate.address}`),
		request: randomID("req", 16),
		project: stableID("prj", "opencode2dsh:default-project"),
		parentSession: ""
	});
	let agent = null;
	try {
		agent = new deps.undici.ProxyAgent({
			uri: exitProxyUri(candidate.address, candidate.protocol),
			...candidate.protocol === "https" ? httpsProxyOptions() : {}
		});
	} catch (err) {
		return {
			admitted: false,
			reason: `agent-build: ${err instanceof Error ? err.message : String(err)}`
		};
	}
	const request = (url, init = {}) => withTimeout(deps.undici.request(url, {
		dispatcher: agent,
		...init
	}), timeout, init.method === "POST" ? "smoke" : "probe");
	try {
		let facts;
		let echoUnavailable = "";
		if (options.echoFacts) facts = options.echoFacts;
		else {
			const verdict = await coarseScreen(deps, candidate, options);
			if ("rejected" in verdict) if (verdict.failure === "echo-unavailable") {
				echoUnavailable = verdict.rejected;
				facts = void 0;
			} else return {
				admitted: false,
				reason: verdict.rejected,
				failure: verdict.failure
			};
			else facts = verdict;
		}
		const models = await request(`${zenBase.replace(/\/+$/, "")}/v1/models`, { headers: {
			authorization: "Bearer public",
			"user-agent": opencodeUserAgent(),
			"x-opencode-client": "cli",
			accept: "application/json",
			...probeHeaders
		} });
		if (models.statusCode !== 200) return {
			admitted: false,
			reason: `zen models HTTP ${models.statusCode}`,
			failure: classifyUpstreamStatus(models.statusCode),
			facts
		};
		const smoke = await request(`${zenBase.replace(/\/+$/, "")}/v1/chat/completions`, {
			method: "POST",
			headers: {
				authorization: "Bearer public",
				"content-type": "application/json",
				...disguiseHeaders({
					session: canonicalSessionID("opencode2dsh:admission-smoke"),
					request: randomID("req", 16),
					project: stableID("prj", "opencode2dsh:admission"),
					parentSession: ""
				}),
				...probeHeaders
			},
			body: JSON.stringify({
				model: smokeModel,
				messages: [{
					role: "user",
					content: "ping"
				}],
				max_tokens: 1,
				stream: true,
				stream_options: { include_usage: true },
				tools: FREE_LANE_GATE_TOOL_NAMES.map((name) => freeLaneGateTool(name)),
				tool_choice: "none"
			})
		});
		if (smoke.statusCode !== 200) {
			if (smoke.statusCode === 429) return {
				admitted: true,
				limited: true,
				reason: `zen smoke HTTP 429${echoUnavailable ? ` (echo unavailable: ${echoUnavailable})` : ""}`,
				node: {
					id: candidate.address,
					protocol: candidate.protocol,
					source: candidate.source,
					pinned: options.pinned ?? false,
					exitIP: facts?.exitIP ?? "",
					exitLocation: facts?.exitLocation ?? "",
					latencyMs: facts?.latencyMs ?? 0,
					quality: facts && facts.latencyMs > 0 ? gradeOf(facts.latencyMs) : "C",
					addedAt: Date.now()
				}
			};
			return {
				admitted: false,
				reason: `zen smoke HTTP ${smoke.statusCode}${echoUnavailable ? ` (echo unavailable: ${echoUnavailable})` : ""}`,
				failure: classifyUpstreamStatus(smoke.statusCode),
				facts
			};
		}
		return {
			admitted: true,
			reason: echoUnavailable ? `admitted with echo unavailable: ${echoUnavailable}` : void 0,
			node: {
				id: candidate.address,
				protocol: candidate.protocol,
				source: candidate.source,
				pinned: options.pinned ?? false,
				exitIP: facts?.exitIP ?? "",
				exitLocation: facts?.exitLocation ?? "",
				latencyMs: facts?.latencyMs ?? 0,
				quality: facts && facts.latencyMs > 0 ? gradeOf(facts.latencyMs) : "C",
				addedAt: Date.now()
			}
		};
	} catch (err) {
		return {
			admitted: false,
			reason: err instanceof Error ? err.message : String(err),
			failure: "transport"
		};
	} finally {
		agent.close().catch(() => {});
	}
}
/** Admit a trusted-source candidate (manual/subscription/goproxy): smoke
*  only; failure warns instead of rejecting for pinned (docs 4.5). Existing
*  pool facts are PRESERVED on the failure fallback — a failed smoke wipes
*  neither a previously measured exitIP/latency nor the routing key.
*
*  The fallback node is flagged `degraded`: the caller keeps the address in
*  the table (so a later probe can revisit it) but must NOT markOk it. Live
*  regression this guards (2026-10-13): sing-box had converted 0 of 470
*  subscription nodes, every smoke failed, and the fallback stamped each node
*  `exitIP: '' / latencyMs: 0 / quality: 'S'`; the caller then markOk'd them,
*  so 30 never-answering exits outranked all 6 healthy free exits and took
*  600/600 picks. Unknown latency is 0 and sorts LAST (pool.pick), and an
*  unmeasured node is 'C', never the top grade. */
async function admitTrusted(deps, candidate, options = {}) {
	const result = await admitCandidate(deps, candidate, { pinned: options.pinned });
	if (result.admitted) {
		if (result.node && !result.node.exitIP && options.previous?.exitIP) return {
			...result,
			node: {
				...result.node,
				exitIP: options.previous.exitIP,
				exitLocation: options.previous.exitLocation,
				latencyMs: options.previous.latencyMs,
				quality: options.previous.quality ?? result.node.quality
			}
		};
		return result;
	}
	const facts = result.facts ?? options.previous;
	const latencyMs = facts?.latencyMs ?? 0;
	deps.logger?.warn(`opencode2dsh: trusted exit ${candidate.address} failed admission (${result.reason}); kept as degraded with ${facts?.exitIP ? "measured" : "unknown"} exit facts`);
	return {
		admitted: true,
		degraded: true,
		reason: result.reason,
		failure: result.failure,
		facts: result.facts,
		node: {
			id: candidate.address,
			protocol: candidate.protocol,
			source: candidate.source,
			pinned: options.pinned ?? false,
			exitIP: facts?.exitIP ?? "",
			exitLocation: facts?.exitLocation ?? "",
			latencyMs,
			quality: latencyMs > 0 ? options.previous?.quality ?? gradeOf(latencyMs) : "C",
			addedAt: Date.now()
		}
	};
}

//#endregion
export { ExitPool as a, coarseScreenBatch as i, admitTrusted as n, gradeOf as o, coarseScreen as r, admitCandidate as t };