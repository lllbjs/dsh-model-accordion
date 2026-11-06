/**
 * Trae 本机账号库（TraeDaddy）读取器 + 多账号切换支持。
 *
 * ## 为什么需要它
 *
 * Trae 连接器宿主已经支持多账号：`~/.dsh/.trae-auth.<region>.json` 是
 * `{ version: 2, credentials: [...] }`，`TraeCredentialStore.accounts()` 会把
 * 其中每条列成一个账号，`selectAccount(id)` 切换当前计费账号，选中状态持久化在
 * settings 的 `accounts.<panel>` 字段（原生设置页就是这么写的）。
 *
 * 但宿主默认只把**每个桌面客户端此刻的登录**镜像进 own 文件，所以
 * `/usage` 通常只列出 1 个账号。本机 TraeDaddy 却保存了每个账号的登录快照：
 *
 *   ~/Library/Application Support/TraeDaddy/profiles/
 *     trae-solo-cn/trae-native-<uid>.json     (CN / 国内版)
 *     trae-solo-intl/trae-native-<uid>.json   (SG / 国际版)
 *
 * 每个文件形如
 * `{ capturedAt, user:{uid,nickname,...}, credential:{token,host,expiredAt,refreshExpiredAt}, checkin }`，
 * `token` 就是 Trae 的 accessToken（JWT）。**这些是完整的、可直接用于上游的登录凭据。**
 *
 * 本模块做三件事：
 *   1. 按区域列出这些账号（只回身份 / 到期时间，绝不下发 token）；
 *   2. 把选中账号的凭据合并进宿主的 own 文件（`credentials[]`），让宿主的
 *      `accounts()` / `current()` 能看见并使用它；
 *   3. 提供与宿主一致的 `traeAccountId`，供 Hub 下拉与切换路由使用。
 *
 * ## 面板 → 区域 / 账号库目录
 *
 * | panel | region | edition | TraeDaddy profile |
 * | --- | --- | --- | --- |
 * | cn        | cn | cn | trae-solo-cn   |
 * | enterprise| cn | cn | trae-solo-cn   |
 * | ai        | ai | sg | trae-solo-intl |
 *
 * @module dsh-connect-trae/local-accounts
 */
import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { withFileLock, writeFileAtomic } from "@deepseek-ai/dsh-atomic-write";
import { resolveDshHome } from "@deepseek-ai/dsh-home-paths";

/** 账号来源标记。 */
export const TRAE_LOCAL_ACCOUNT_SOURCE = "trae-local";

const PROFILES_ROOT = join(homedir(), "Library", "Application Support", "TraeDaddy", "profiles");
const NATIVE_PREFIX = "trae-native-";
const NATIVE_SUFFIX = ".json";
const OWN_VERSION = 2;

/** panel → { region, edition, libraryDir }。 */
const PANELS = {
	cn: { region: "cn", edition: "cn", libraryDir: "trae-solo-cn" },
	enterprise: { region: "cn", edition: "cn", libraryDir: "trae-solo-cn" },
	ai: { region: "ai", edition: "sg", libraryDir: "trae-solo-intl" }
};

/** 与宿主 `traeAccountId` 完全一致的派生规则（sha256(edition\0userId) 前 24 位）。 */
export function traeLocalAccountId(credential) {
	const stable = `${credential.edition}\0${credential.userId || credential.accountName || "unknown"}`;
	return createHash("sha256").update(stable).digest("hex").slice(0, 24);
}

export function isTraeLocalAccountId(value) {
	return typeof value === "string" && /^[0-9a-f]{24}$/.test(value);
}

/** 宿主 own 凭据文件路径：`~/.dsh/.trae-auth.<region>.json`。 */
export function traeLocalOwnPath(region) {
	return join(resolveDshHome(), `.trae-auth.${region}.json`);
}

/** 时间字段归一成毫秒；认不出返回 undefined（宁可没有，不要编）。 */
function timeToMs(value) {
	if (typeof value === "number" && Number.isFinite(value) && value > 0) {
		return value > 0xe8d4a51000 ? value : value * 1000;
	}
	if (typeof value !== "string" || value.trim() === "") return undefined;
	const numeric = Number(value);
	if (Number.isFinite(numeric) && numeric > 0) return numeric > 0xe8d4a51000 ? numeric : numeric * 1000;
	const parsed = Date.parse(value);
	return Number.isFinite(parsed) ? parsed : undefined;
}

const text = (value) => (typeof value === "string" && value.trim() !== "" ? value.trim() : undefined);

/**
 * 把一个 TraeDaddy `trae-native-*.json` 转成宿主 own 文件的凭据记录形状。
 * 返回 undefined 表示这份快照不可用（缺 token / uid）。
 */
function credentialOfNative(native, panel) {
	const meta = PANELS[panel];
	if (meta === undefined) return undefined;
	const credential = typeof native.credential === "object" && native.credential !== null ? native.credential : {};
	const user = typeof native.user === "object" && native.user !== null ? native.user : {};
	const accessToken = text(credential.token) ?? text(credential.accessToken);
	const userId = text(user.uid);
	if (accessToken === undefined || userId === undefined) return undefined;
	const host = text(credential.host) ?? (meta.region === "cn" ? "https://api.trae.cn" : "https://api.trae.ai");
	const record = {
		accessToken,
		userId,
		host,
		userRegion: meta.region === "cn" ? "CN" : "SG",
		accountName: text(user.nickname) ?? userId,
		expiresAtMs: timeToMs(credential.expiredAt ?? credential.expiresAt) ?? 0,
		edition: meta.edition,
		source: "dsh"
	};
	const refreshExpiresAtMs = timeToMs(credential.refreshExpiredAt ?? credential.refreshExpiresAt);
	if (refreshExpiresAtMs !== undefined) record.refreshExpiresAtMs = refreshExpiresAtMs;
	const refreshToken = text(credential.refreshToken);
	if (refreshToken !== undefined) record.refreshToken = refreshToken;
	return { ...record, id: traeLocalAccountId(record) };
}

/**
 * 读一个区域账号库里的全部账号。
 *
 * 返回 `{ id, accountName, userId, edition, region, source, tokenExpiresAtMs?, refreshExpiresAtMs?, capturedAtMs?, active, libraryFile }[]`。
 * `active` 表示该 uid 是 TraeDaddy 记录的「当前客户端登录」（`trae-active-uid.json`）。
 * **绝不返回 token** —— 凭据只在 `syncIntoOwn` 里在宿主进程内落盘。
 *
 * 读取永不抛：目录不存在 / 文件坏 / 格式变了都返回空数组。
 */
export async function listTraeLocalAccounts(panel) {
	const meta = PANELS[panel];
	if (meta === undefined) return [];
	const dir = join(PROFILES_ROOT, meta.libraryDir);
	let entries;
	try {
		entries = await readdir(dir, { withFileTypes: true });
	} catch {
		return [];
	}
	let activeUid;
	try {
		const active = JSON.parse(await readFile(join(dir, "trae-active-uid.json"), "utf8"));
		activeUid = text(active?.uid);
	} catch {
		activeUid = undefined;
	}
	const out = [];
	const seen = new Set();
	for (const entry of entries) {
		if (!entry.isFile() || !entry.name.startsWith(NATIVE_PREFIX) || !entry.name.endsWith(NATIVE_SUFFIX)) continue;
		let native;
		try {
			native = JSON.parse(await readFile(join(dir, entry.name), "utf8"));
		} catch {
			continue;
		}
		const credential = credentialOfNative(native, panel);
		if (credential === undefined || seen.has(credential.id)) continue;
		seen.add(credential.id);
		out.push({
			id: credential.id,
			accountName: credential.accountName,
			userId: credential.userId,
			edition: credential.edition,
			region: meta.region,
			source: TRAE_LOCAL_ACCOUNT_SOURCE,
			...credential.expiresAtMs > 0 ? { tokenExpiresAtMs: credential.expiresAtMs } : {},
			...credential.refreshExpiresAtMs !== undefined ? { refreshExpiresAtMs: credential.refreshExpiresAtMs } : {},
			...typeof native.capturedAt === "number" ? { capturedAtMs: native.capturedAt } : {},
			active: activeUid !== undefined && credential.userId === activeUid,
			libraryFile: entry.name
		});
	}
	/* 当前客户端登录排最前，其余按昵称 / uid 稳定排序。 */
	out.sort((a, b) => (a.active === b.active ? 0 : a.active ? -1 : 1) || a.accountName.localeCompare(b.accountName) || a.userId.localeCompare(b.userId));
	return out;
}

/** 读 own 文件的 `credentials[]`；坏文件返回 undefined（不可在其上合并，避免抹掉账号）。 */
async function readOwn(path) {
	try {
		const parsed = JSON.parse(await readFile(path, "utf8"));
		if (typeof parsed !== "object" || parsed === null || parsed.version !== OWN_VERSION || !Array.isArray(parsed.credentials)) return undefined;
		return parsed.credentials;
	} catch {
		return undefined;
	}
}

/**
 * 把本机账号库的全部凭据合并进宿主 own 文件，并把指定账号排到第一位。
 *
 * 为什么排第一位：`TraeCredentialStore.preferred()` 在 settings 未显式绑定
 * 账号时取 `eligible[0]`（desktop source 优先，但 own 记录全是 `dsh`），
 * 所以第一位就是「当前生效账号」。这让切换在**重启后依然成立**，不必依赖
 * 浏览器侧的 settings 写入。
 *
 * 合并是**增量**的：保留 own 文件里已有的每条记录（可能包含宿主刷新过的、
 * 比库里更新的令牌），只在同 id 时用库里的补齐缺失字段，绝不删除。
 *
 * @returns {Promise<{merged:number, selected:string|undefined}>}
 * @throws 当 own 文件无法解析时（宁可报错，也不要把账号抹掉）。
 */
export async function syncTraeLocalAccounts(panel, selectedId) {
	const meta = PANELS[panel];
	if (meta === undefined) throw new Error(`unknown panel: ${String(panel)}`);
	const accounts = await listTraeLocalAccounts(panel);
	const dir = join(PROFILES_ROOT, meta.libraryDir);
	const records = [];
	for (const account of accounts) {
		let native;
		try {
			native = JSON.parse(await readFile(join(dir, account.libraryFile), "utf8"));
		} catch {
			continue;
		}
		const record = credentialOfNative(native, panel);
		if (record !== undefined) records.push(record);
	}
	const ownPath = traeLocalOwnPath(meta.region);
	let merged = 0;
	await withFileLock(ownPath, async () => {
		const existing = await readOwn(ownPath);
		if (existing === undefined) throw new Error(`无法读取 ${ownPath}，为保护已有账号已取消切换`);
		const byId = new Map();
		for (const record of existing) {
			if (typeof record === "object" && record !== null) {
				const id = traeLocalAccountId(record);
				if (!byId.has(id)) byId.set(id, record);
			}
		}
		for (const record of records) {
			const prior = byId.get(record.id);
			if (prior === undefined) {
				const { id, ...stored } = record;
				byId.set(id, stored);
				merged += 1;
			} else {
				/* 已有记录优先（可能是宿主刷新过的更新令牌），只补齐缺失字段。 */
				byId.set(record.id, { ...record, ...prior });
			}
		}
		const ordered = [...byId.entries()];
		if (selectedId !== undefined) {
			const index = ordered.findIndex(([id]) => id === selectedId);
			if (index > 0) ordered.unshift(...ordered.splice(index, 1));
		}
		await writeFileAtomic(ownPath, JSON.stringify({
			version: OWN_VERSION,
			credentials: ordered.map(([, record]) => record)
		}, null, 2) + "\n", { mode: 384, dirMode: 448 });
	});
	return { merged, selected: selectedId };
}

/** 取一条本机账号的完整凭据（只在宿主进程内使用，绝不下发浏览器）。 */
export async function readTraeLocalCredential(panel, accountId) {
	for (const account of await listTraeLocalAccounts(panel)) {
		if (account.id !== accountId) continue;
		const meta = PANELS[panel];
		const native = JSON.parse(await readFile(join(PROFILES_ROOT, meta.libraryDir, account.libraryFile), "utf8"));
		return credentialOfNative(native, panel);
	}
	return undefined;
}
