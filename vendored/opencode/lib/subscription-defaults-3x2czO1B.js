//#region src/pool/rotate.ts
let delegate = null;
/** Install the runtime's rotate delegate (startIpPool). */
function setRotateDelegate(next) {
	delegate = next;
}
/**
* Reports a stream that died AFTER content had already landed.
*
* This is the reporting half of the same seam, and it exists because of a gap
* the dispatcher cannot cover. Its sentinel is disarmed the moment response
* headers land (`onResponseStart` -> `disarm()`), so once the body goes silent
* mid-stream there is no longer ANY layer that tells the pool the exit died:
* the adapter alone sees the watchdog fire, and it used to simply yield a
* terminal error. The exit therefore stayed `ok` with whatever latency it had
* measured — i.e. near the front of the pick order — so the SAME exit kept
* winning the next request and could tear the next stream down too.
*
* No rotation here (a partially delivered stream is never replayed, docs 3.4):
* this only closes the accounting, reusing the pool's existing transport-failure
* verdict so the exit leaves rotation and the semantics stay uniform.
*/
let failureReporter = null;
/** Install the runtime's stream-failure reporter (startIpPool). */
function setStreamFailureReporter(next) {
	failureReporter = next;
}
/** Report a mid-stream death; no-op when no pool is running. */
function reportStreamFailure(session, model) {
	failureReporter?.(session, model);
}
/**
* Build the reporting half over the live pool (mirrors createRotateDelegate).
*
* Reuses the pool's existing transport verdict rather than inventing a second
* one: a body that stops mid-stream with no error status IS a transport failure
* by docs §4.2, so `recordPassiveTransport` is exactly the right call and the
* two-tier semantics stay uniform with the dispatcher's own accounting.
*
* `avoid` is what actually fixes the reported symptom: the exit keeps its `ok`
* mark for a subscription source (disable-only, §3.5) and would otherwise stay
* at the front of the pick order, so the avoid window is what stops the next
* request from being torn down by the same exit.
*/
function createStreamFailureReporter(pool, onReported) {
	return (session, model) => {
		const failedExit = pool.exitOfSession(session);
		if (failedExit === null) return;
		pool.recordPassiveTransport(failedExit);
		pool.avoid(failedExit);
		pool.rerouteSession(session);
		onReported?.(failedExit);
	};
}
/** Ask the installed delegate; false when no pool is running. */
function shouldRotate(failure, model, session, attempt, deterministic = false) {
	return delegate?.decide(failure, model, session, attempt, deterministic) ?? false;
}
/** Map a pi-ai error message to the failure taxonomy (adapter-side parse). */
function classifyStreamFailure(errorMessage) {
	const text = errorMessage.toLowerCase();
	if (/\b429\b|rate.?limit|freeusagelimit/.test(text)) return "limited";
	if (/\b(?:401|403)\b/.test(text)) return "refused";
	if (/\b(?:network|connection|socket|fetch|terminated|premature close)\b|\beconn[a-z]+\b|timeout|timed out/.test(text)) return "transport";
	if (/\b5\d\d\b|internal server error|server error/.test(text)) return "transport";
	return null;
}
/** True when the error body names a deterministic region block (Zen's
*  RegionError): the exit's IP cannot serve this model — ban the pairing on
*  sight instead of collecting two samples (docs 4.2). */
function isRegionBlocked(errorMessage) {
	return /regionerror|not available in your country/i.test(errorMessage);
}
/**
* Build the runtime delegate over the live pool (ip-pool.ts assembly).
* Passive bookkeeping mirrors the dispatcher observer: the stream that died
* before content already recorded its verdict through the routing layer when
* it could see it — the sentinel covers the mute-connection case — so this
* delegate only breaks stickiness and checks whether a usable exit remains.
*/
function createRotateDelegate(pool, options = {}) {
	const maxAttempts = options.maxAttempts ?? 3;
	return { decide(failure, model, session, attempt, deterministic = false) {
		const failedExit = pool.exitOfSession(session);
		if (deterministic && failedExit !== null) pool.markModelBanned(failedExit, model);
		if (failedExit !== null) pool.avoid(failedExit);
		if (attempt > maxAttempts) return false;
		if (!pool.list().some((entry) => pool.isUsable(entry.id, model))) return false;
		pool.rerouteSession(session);
		return true;
	} };
}

//#endregion
//#region src/pool/subscription-defaults.ts
/** Shared by the host and browser; keep this module free of parser dependencies. */
const DEFAULT_SUBSCRIPTION_USER_AGENT = "clash-verge/v2.0";
function normalizeSubscriptionUserAgent(value) {
	return value?.trim() || DEFAULT_SUBSCRIPTION_USER_AGENT;
}

//#endregion
export { createStreamFailureReporter as a, setRotateDelegate as c, createRotateDelegate as i, setStreamFailureReporter as l, normalizeSubscriptionUserAgent as n, isRegionBlocked as o, classifyStreamFailure as r, reportStreamFailure as s, DEFAULT_SUBSCRIPTION_USER_AGENT as t, shouldRotate as u };