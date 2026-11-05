//#region src/pool/probe-verdict.ts
/**
* Apply one admission verdict to the pool. Returns what was applied.
*
* `pool.add()` is NOT done here — the caller owns node identity (addedAt,
* exit-IP dedup, insert-vs-refresh) because those differ per producer. This
* function is purely the verdict→health mapping.
*/
function applyProbeVerdict(pool, id, verdict, options) {
	const reason = verdict.reason ?? "";
	if (verdict.limited) {
		pool.markLimited(id);
		return "limited";
	}
	if (!verdict.admitted) return applyFailure(pool, id, verdict.failure, options, reason);
	if (verdict.degraded) return applyFailure(pool, id, verdict.failure, options, reason);
	pool.markOk(id, options.model);
	return "ok";
}
/** Map a classified failure onto the pool's two-tier health (§4.2). */
function applyFailure(pool, id, failure, options, reason) {
	switch (failure) {
		case "transport":
			if (options.pinned === true) {
				pool.markProbeFailure(id, "transport", reason);
				return "unchanged";
			}
			pool.markDeadStrike(id, reason);
			return "dead";
		case "refused":
			pool.markModelSignal(id, options.model);
			pool.markProbeFailure(id, "refused", reason);
			return "refused";
		case "quota":
			pool.markLimited(id);
			pool.markProbeFailure(id, "quota", reason);
			return "limited";
		case "server-error":
		case "geo-blocked":
		case "slow":
		case "malformed":
		case "echo-unavailable":
			pool.markProbeFailure(id, failure, reason);
			return "unchanged";
		default: return "unchanged";
	}
}

//#endregion
export { applyProbeVerdict as t };