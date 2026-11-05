#!/usr/bin/env node
import { G as deriveFingerprint, _ as piAiRuntimeInfo, d as qoderAccountsPath, f as QODER_PAT_ENV_VARS, h as patFromEnv, i as readHostHeartbeat, n as isHeartbeatProcessAlive, o as qoderPoolStorePath, r as qoderHostHeartbeatPath, u as QoderAccountStore, v as QODER_REGIONS, x as isQoderUpstreamError, y as QoderUpstreamClient } from "./host-heartbeat-CNzgGURF.js";
import { rm } from "node:fs/promises";
//#region src/bin.ts
/**
* Standalone status/diagnostics CLI for the dsh-connect-qoder bundle.
*
* 参考：dsh-connect-workbuddy（MIT，Copyright (c) 2026 LaoDing）——三个子命令
* 的骨架（`doctor` / `status` / `logout`）、`--json` 输出、`safeMessage` 脱敏与
* 「凭据来源 + 上游连通性」诊断的结构由该项目设计。
* 改动（按 Qoder 上游的现实）：
*   - 凭据只读环境变量 + 本地 vault（CLI 运行于宿主之外，无法访问设置服务）；
*   - `doctor` 增加 cosy 指纹派生自检、pi-ai 代际、宿主心跳存活、vault 账号计数；
*   - `status` 汇报每区域凭据来源 + 上游可达性 + 当前剩余积分（总额）；
*   - `logout` 清除本区域的 vault 凭据与账号池测量副本（可 `--region` 指定，
*     否则两区域都清）。
*
* @module dsh-connect-qoder/bin
*/
const JSON_SCHEMA_VERSION = 2;
const REGION_KEYS = ["cn", "global"];
/** Remove token-like strings from an unexpected diagnostic message. */
function safeMessage(error) {
	return (error instanceof Error ? error.message : String(error)).replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/gu, "[redacted token]").replace(/(\b(?:code|token|refresh_token|access_token)=)[^&\s]+/giu, "$1[redacted]");
}
/** One region's total remaining credits from a usage read (secret-free). */
function creditsTotal(usage) {
	if (usage === void 0) return void 0;
	let total = 0;
	let seen = false;
	const userQuota = usage.userQuota;
	if (userQuota !== void 0 && typeof userQuota.total === "number") {
		total += Math.max(userQuota.total - (userQuota.used ?? 0), 0);
		seen = true;
	}
	const addOnQuota = usage.addOnQuota;
	if (addOnQuota !== void 0 && typeof addOnQuota.total === "number") {
		total += Math.max(addOnQuota.total - (addOnQuota.used ?? 0), 0);
		seen = true;
	}
	const org = usage.orgResourcePackage;
	if (org !== void 0 && typeof org.cap === "number") {
		total += Math.max(org.cap - (org.used ?? 0), 0);
		seen = true;
	}
	return seen ? total : void 0;
}
function printHelp() {
	process.stdout.write([
		"Usage: dsh-connect-qoder <doctor|status|logout> [--json] [--region cn|global]",
		"",
		"  doctor   PAT source, cosy fingerprint, pi-ai generation, heartbeat, vault (no network)",
		"  status   per-region PAT presence, upstream model-list reachability, credits",
		"  logout   clear the local vault accounts + pool measurements for a region",
		"  --json   emit one secret-free JSON document",
		"",
		"Credentials come from the environment:",
		`  ${QODER_PAT_ENV_VARS.global}   (global, qoder.sh)`,
		`  ${QODER_PAT_ENV_VARS.cn}       (CN, qoder.com.cn)`,
		"or from the local vault ($DSH_HOME/.qoder-accounts.<region>.json).",
		""
	].join("\n"));
}
function printJson(value) {
	process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}
function regionArg() {
	const index = process.argv.indexOf("--region");
	if (index !== -1) {
		const value = process.argv[index + 1];
		if (value === "cn" || value === "global") return [value];
	}
	return REGION_KEYS;
}
/**
* 从 argv 里取出**命令词**：剥掉 flag 与区域实参，剩下的第一个就是。
*
* 必须是「保留**不是** flag、**不是**区域名的实参」。写反成
* `REGION_KEYS.includes(arg)`（只留 cn/global）会让命令词自己被过滤掉，
* 于是三条子命令全部只会打印 usage。抽成纯函数就是为了能对它断言。
*/
function commandArgOf(argv) {
	return argv.filter((arg) => arg !== "--json" && arg !== "--region" && !REGION_KEYS.includes(arg))[0];
}
async function doctor() {
	const piAi = piAiRuntimeInfo();
	const heartbeat = await readHostHeartbeat();
	const entries = [];
	for (const region of REGION_KEYS) {
		const fingerprint = deriveFingerprint("", `doctor:${region}`);
		const vault = await new QoderAccountStore(region).vaultAccounts();
		entries.push({
			region,
			gateway: QODER_REGIONS[region].gateway,
			patEnv: QODER_PAT_ENV_VARS[region],
			patPresent: patFromEnv(region) !== void 0,
			vaultAccounts: vault.length,
			fingerprint: {
				machineId: fingerprint.machineId,
				machineType: fingerprint.machineType,
				machineToken: fingerprint.machineToken
			}
		});
	}
	const report = {
		schemaVersion: JSON_SCHEMA_VERSION,
		piAi: {
			generation: piAi?.generation ?? "unknown",
			version: piAi?.version ?? "unknown"
		},
		heartbeat: {
			present: heartbeat !== void 0,
			alive: heartbeat !== void 0 && isHeartbeatProcessAlive(heartbeat),
			...heartbeat?.pid === void 0 ? {} : { pid: heartbeat.pid }
		},
		entries
	};
	if (process.argv.includes("--json")) {
		printJson(report);
		return report;
	}
	process.stdout.write(`pi-ai: ${report.piAi.generation} (${report.piAi.version})\n`);
	process.stdout.write(`heartbeat: ${report.heartbeat.present ? report.heartbeat.alive ? `alive (pid ${report.heartbeat.pid ?? "?"})` : "stale" : "absent"} — ${qoderHostHeartbeatPath()}\n`);
	for (const entry of entries) {
		process.stdout.write(`[${entry.region}] ${entry.gateway}\n`);
		process.stdout.write(`  PAT ${entry.patEnv}: ${entry.patPresent ? "present" : "missing"}\n`);
		process.stdout.write(`  vault: ${entry.vaultAccounts} account(s) — ${qoderAccountsPath(entry.region)}\n`);
		process.stdout.write(`  fingerprint: machineId=${entry.fingerprint.machineId} type=${entry.fingerprint.machineType}\n`);
	}
	const missing = entries.filter((entry) => !entry.patPresent && entry.vaultAccounts === 0);
	if (missing.length > 0) {
		process.stdout.write(`\nNo PAT in the environment or vault for: ${missing.map((entry) => entry.region).join(", ")}\n`);
		process.stdout.write("Set the variable above (or add an account in the plugin card) before using that region.\n");
	}
	return report;
}
async function status() {
	const entries = [];
	for (const region of REGION_KEYS) {
		const envPat = patFromEnv(region);
		const vault = await new QoderAccountStore(region).vaultAccounts();
		const pat = envPat ?? vault[0]?.pat;
		const patSource = envPat !== void 0 ? "env" : vault.length > 0 ? "vault" : "none";
		const entry = {
			region,
			gateway: QODER_REGIONS[region].gateway,
			...patSource === void 0 ? {} : { patSource },
			models: 0
		};
		if (pat === void 0) {
			entries.push(entry);
			continue;
		}
		try {
			const client = new QoderUpstreamClient(region);
			entry.models = (await client.fetchModels(pat)).length;
			try {
				const credits = creditsTotal(await client.fetchUsage(pat));
				if (credits !== void 0) entry.creditsTotal = credits;
			} catch {}
		} catch (error) {
			if (isQoderUpstreamError(error)) entry.error = `${error.kind} (HTTP ${error.status}): ${safeMessage(error.message)}`;
			else entry.error = safeMessage(error);
		}
		entries.push(entry);
	}
	if (process.argv.includes("--json")) {
		printJson({
			schemaVersion: JSON_SCHEMA_VERSION,
			entries
		});
		return;
	}
	for (const entry of entries) {
		process.stdout.write(`[${entry.region}] ${entry.gateway}\n`);
		process.stdout.write(`  PAT: ${entry.patSource ?? "none"}\n`);
		if (entry.error !== void 0) process.stdout.write(`  upstream: FAILED (${entry.error})\n`);
		else if (entry.patSource !== "none") {
			const credits = entry.creditsTotal === void 0 ? "" : `, credits ${entry.creditsTotal}`;
			process.stdout.write(`  upstream: OK, ${entry.models} models${credits}\n`);
		}
	}
}
async function logout() {
	const regions = regionArg();
	const cleared = [];
	for (const region of regions) for (const path of [qoderAccountsPath(region), qoderPoolStorePath(region)]) try {
		await rm(path, { force: true });
		cleared.push(path);
	} catch {}
	if (process.argv.includes("--json")) {
		printJson({
			schemaVersion: JSON_SCHEMA_VERSION,
			cleared
		});
		return;
	}
	process.stdout.write(cleared.length === 0 ? "Nothing to clear (no vault files present).\n" : `Cleared:\n${cleared.map((path) => `  ${path}\n`).join("")}`);
}
async function main() {
	const command = commandArgOf(process.argv.slice(2));
	if (command === "doctor") {
		await doctor();
		return;
	}
	if (command === "status") {
		await status();
		return;
	}
	if (command === "logout") {
		await logout();
		return;
	}
	printHelp();
	process.exitCode = command === void 0 ? 0 : 2;
}
main();
//#endregion
export { commandArgOf };
