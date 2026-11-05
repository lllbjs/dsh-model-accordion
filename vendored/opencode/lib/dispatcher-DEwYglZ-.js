import { AsyncLocalStorage } from "node:async_hooks";
import "undici";

//#region src/pool/dispatcher.ts
/** Per-request routing context (docs/ip-pool.md 3.3): pi-ai builds the body
*  and dispatches on separate layers with no model channel between them, so
*  the adapter sets this at stream() entry and the dispatcher reads it. */
const routingContext = new AsyncLocalStorage();
const DEFAULT_PROXY_HOSTS = ["opencode.ai"];
const PROXY_PROTOCOL_PREFIX = /^[a-z0-9+.-]+:\/\//i;
/** 'host:port' -> 'host' (bracket-aware) for host matching. */
function normalizeHost(host) {
	if (!host) return "";
	let value = host.trim().toLowerCase();
	if (value.includes("://")) try {
		value = new URL(value).hostname;
	} catch {}
	return value.replace(/:\d+$/, "").replace(/^\[(.+)\]$/, "$1");
}
function isLoopback(host) {
	const normalized = normalizeHost(host);
	return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}
/**
* Map an exit address to a ProxyAgent URI ('h:1' -> 'http://h:1').
*
* `https` MUST survive as its own scheme: undici only wraps CONNECT in TLS
* when the proxy URI scheme is `https:` (proxy-agent.js, `forwardConnect =
* this[kProxy].protocol === 'https:'`). Downgrading an `https://` proxy to a
* plaintext `http://` URI sends a bare CONNECT to a TLS listener, which drops
* the connection without ever sending a status line — undici surfaces exactly
* that as `SocketError: other side closed` (client-h1.js, onHttpSocketEnd),
* and the rule table then correctly but uselessly strikes a healthy exit dead.
* Measured live 2026-10-15: 46 of 118 exits failed that way, all on ports
* 443/9002/9443; every sampled one completed a TLS handshake and answered
* CONNECT 200 once the request was wrapped (certs *.windscribe.com,
* *.nodes.gen4.ninja).
*/
function exitProxyUri(exitId, protocol) {
	const scheme = protocol === "socks5" ? "socks5" : protocol === "https" ? "https" : "http";
	return PROXY_PROTOCOL_PREFIX.test(exitId) ? exitId : `${scheme}://${exitId}`;
}
/**
* ProxyAgent options for an https:// exit, including the one setting that
* decides whether it connects at all.
*
* Measured 2026-10-15 against live subscription exits: a bare
* `new ProxyAgent({ uri: 'https://203.0.113.7:443' })` fails EVERY request
* with `Secure Proxy Connection failed`. The cause is certificate
* verification, not connectivity: these exits are addressed by IP literal, so
* there is no hostname a certificate could be issued for, and undici falls
* back to `rejectUnauthorized: true` — every handshake is then rejected.
* Passing `proxyTls: { rejectUnauthorized: false }` made all sampled exits
* serve `http://ip-api.com` with 200.
*
* Only the PROXY HOP is unverified. The tunneled request still runs through
* undici's normal TLS path to the real target, so end-to-end confidentiality
* to `opencode.ai` is unchanged; what is given up is authentication of the
* proxy's own identity, for which an IP literal offers nothing to check
* against anyway. This mirrors what sing-box does for the converted exits.
*/
function httpsProxyOptions() {
	return { proxyTls: { rejectUnauthorized: false } };
}
var PoolRoutingDispatcher = class {
	#pool;
	#undici;
	#proxyHosts;
	#agentLruCap;
	#sentinelMs;
	#headersMs;
	#logger;
	/** Direct path for non-pool hosts and loopback. */
	#direct;
	/** LRU of per-exit ProxyAgents (docs/ip-pool.md 2, exit multi-instance). */
	#agents = /* @__PURE__ */ new Map();
	#agentsOrder = [];
	#closed = false;
	constructor(options) {
		this.#pool = options.pool;
		this.#undici = options.undici;
		this.#proxyHosts = new Set((options.proxyHosts ?? DEFAULT_PROXY_HOSTS).map((host) => normalizeHost(host)));
		this.#agentLruCap = options.agentLruCap ?? 16;
		this.#sentinelMs = options.sentinelMs ?? 2e3;
		this.#headersMs = options.headersMs ?? 1e4;
		this.#logger = options.logger;
		this.#direct = new options.undici.Agent();
	}
	/** Live re-apply of the proxied-host list (settings page, docs §5.1). */
	setProxyHosts(hosts) {
		this.#proxyHosts = hosts && hosts.length > 0 ? new Set(hosts.map((host) => normalizeHost(host))) : new Set(DEFAULT_PROXY_HOSTS.map((host) => normalizeHost(host)));
	}
	/** The proxied-host set as configured (diagnostics / status bridge). */
	get proxyHosts() {
		return [...this.#proxyHosts];
	}
	/** The agent for one exit, LRU-capped (docs/ip-pool.md 2). */
	#agentFor(exitId) {
		const cached = this.#agents.get(exitId);
		if (cached) {
			const index = this.#agentsOrder.indexOf(exitId);
			if (index >= 0) this.#agentsOrder.splice(index, 1);
			this.#agentsOrder.push(exitId);
			return cached;
		}
		const exit = this.#pool.get(exitId);
		if (!exit) return null;
		try {
			const seam = this.#undici;
			const agent = new seam.ProxyAgent({
				uri: exitProxyUri(exit.id, exit.protocol),
				...exit.protocol === "https" ? httpsProxyOptions() : {},
				clientFactory: (origin, opts) => new seam.Agent({
					...opts,
					pipelining: 0
				})
			});
			this.#agents.set(exitId, agent);
			this.#agentsOrder.push(exitId);
			if (this.#agentsOrder.length > this.#agentLruCap) {
				const evict = this.#agentsOrder.shift();
				if (evict !== void 0) {
					const old = this.#agents.get(evict);
					this.#agents.delete(evict);
					old?.destroy().catch(() => {});
				}
			}
			return agent;
		} catch (err) {
			this.#logger?.warn(`opencode2dsh: failed to build proxy agent for ${exitId}: ${err instanceof Error ? err.message : String(err)}`);
			return null;
		}
	}
	dispatch(options, handler) {
		if (this.#closed) {
			handler.onResponseError?.({}, /* @__PURE__ */ new Error("opencode2dsh: routing dispatcher closed"));
			return false;
		}
		const host = normalizeHost(String(options.origin ?? ""));
		if (isLoopback(host) || !this.#proxyHosts.has(host)) return this.#direct.dispatch(options, handler);
		const context = routingContext.getStore() ?? {};
		const model = context.model ?? "default";
		const session = context.session ?? "default";
		const exitId = this.#pool.pick(session, model);
		if (exitId === null) return this.#direct.dispatch(options, handler);
		const agent = this.#agentFor(exitId);
		if (!agent) return this.#direct.dispatch(options, handler);
		return agent.dispatch(options, this.#observe(exitId, model, session, handler));
	}
	/**
	* Wrap the downstream handler with the passive-signal observer
	* (docs/ip-pool.md §4.2 rule table, §4.3 被动): the real request's own
	* outcome feeds the two-tier health — free liveness data no probe spends
	* quota on. Body bytes stream through untouched; only the response start
	* line and terminal transport errors are read.
	*
	* Forwarding discipline (measured against undici 8.10 on this host): the
	* fetch handler's methods live on a prototype with private state, so a
	* spread would strip them and Object.create delegation would re-enter
	* them with the wrong `this`. The wrapper is a fresh plain object that
	* forwards every DispatchHandler callback to the original with the
	* original as `this` — the same shape undici's own wrappers use.
	*
	* Response-silence sentinel: undici's Pool fires NONE of the handler
	* callbacks (not even onResponseError) when a proxy CONNECT fails at the
	* connection stage — the failure surfaces only as a fetch rejection (and
	* an APIConnectionError/"Connection error." upstream). Without a fallback
	* the passive signal is blind exactly when a dead exit needs to be evicted
	* (live repro: 10.255.255.1:9999 blackhole, seen:[] callbacks). So the
	* wrapper arms a timer at dispatch time; any handler callback disarms it,
	* and silence past the deadline counts as a transport failure (dead strike
	* + session reroute) — on that silence path ONLY the sentinel synthesizes
	* the response-error the handler owes and aborts the controller (fetch
	* rejects at once instead of hanging forever). A real onResponseError is
	* forwarded untouched; the sentinel never injects alongside a genuine
	* failure (#87).
	*/
	#observe(exitId, model, session, handler) {
		const pool = this.#pool;
		const forward = (method, args) => {
			const fn = handler[method];
			if (typeof fn === "function") fn.apply(handler, args);
		};
		let classified = false;
		const classify = (statusCode) => {
			if (classified) return;
			classified = true;
			if (pool.recordPassive(exitId, statusCode, model) !== "ok") pool.rerouteSession(session);
		};
		let liveController = null;
		/** Record the transport-grade failure once. Returns true only for the
		*  caller that actually classified the dispatch. */
		const recordTransport = () => {
			if (classified) return false;
			classified = true;
			pool.recordPassiveTransport(exitId);
			pool.rerouteSession(session);
			return true;
		};
		/**
		* Sentinel-only teardown. Live-observed (2026-09-07, muse via 7897): after
		* the tunnel stands a dead-behind-the-tunnel exit answers NOTHING — no
		* headers, no onResponseError — and neither fetch nor pi-ai owns a
		* body-silence timeout, so the request hangs forever (the turn never
		* finished; the stop button's abort never reached it). When the blackhole
		* path never handed us a single callback there is no failure to read, so
		* the sentinel synthesizes the response-error the handler owes (and aborts
		* any controller it did see) — fetch rejects at once, pi-ai turns that
		* into an error event, and the adapter's rotate loop gets to move the
		* session to a live exit.
		*
		* Injection belongs here and nowhere else. A real `onResponseError` means
		* undici already reported the failure to us, so forwarding it is enough;
		* racing it with a synthesized one only loses the original.
		*/
		const sentinelTeardown = () => {
			if (!recordTransport()) return;
			const reason = /* @__PURE__ */ new Error("opencode2dsh: exit response silence");
			if (typeof handler.onResponseError === "function") handler.onResponseError.call(handler, liveController ?? {}, reason);
			liveController?.abort?.(reason);
		};
		const armSentinel = () => {
			clearTimeout(sentinel);
			const window = sawRequestStart ? this.#headersMs : this.#sentinelMs;
			sentinel = setTimeout(sentinelTeardown, window);
			sentinel.unref?.();
		};
		let sawRequestStart = false;
		let sentinel = void 0;
		armSentinel();
		const disarm = () => {
			clearTimeout(sentinel);
		};
		return {
			onRequestStart: (controller, context) => {
				liveController = controller;
				sawRequestStart = true;
				armSentinel();
				forward("onRequestStart", [controller, context]);
			},
			onRequestUpgrade: (controller, statusCode, headers, socket) => {
				liveController = controller;
				disarm();
				forward("onRequestUpgrade", [
					controller,
					statusCode,
					headers,
					socket
				]);
			},
			onResponseStart: (controller, statusCode, headers, statusMessage) => {
				liveController = controller;
				disarm();
				classify(statusCode);
				forward("onResponseStart", [
					controller,
					statusCode,
					headers,
					statusMessage
				]);
			},
			onResponseData: (controller, chunk) => {
				liveController = controller;
				forward("onResponseData", [controller, chunk]);
			},
			onResponseEnd: (controller, trailers) => {
				liveController = controller;
				disarm();
				forward("onResponseEnd", [controller, trailers]);
			},
			onResponseError: (controller, error) => {
				liveController = controller;
				disarm();
				recordTransport();
				forward("onResponseError", [controller, error]);
			},
			onResponseStarted: () => {
				disarm();
				forward("onResponseStarted", []);
			},
			onBodySent: (chunk) => forward("onBodySent", [chunk]),
			onRequestSent: () => forward("onRequestSent", [])
		};
	}
	close() {
		this.#closed = true;
		const jobs = [this.#direct.close(), ...[...this.#agents.values()].map((a) => a.close())];
		return Promise.all(jobs).then(() => void 0);
	}
	destroy() {
		this.#closed = true;
		const jobs = [this.#direct.destroy(), ...[...this.#agents.values()].map((a) => a.destroy())];
		this.#agents.clear();
		this.#agentsOrder = [];
		return Promise.all(jobs).then(() => void 0);
	}
};

//#endregion
export { routingContext as i, exitProxyUri as n, httpsProxyOptions as r, PoolRoutingDispatcher as t };