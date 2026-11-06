/**
 * Qoder **桌面客户端本地登录态**读取器与账号记录簿。
 *
 * ## 为什么需要这个模块（而不是复用 daddy-suite 的账号库）
 *
 * 桌面版把登录态存在 Electron `safeStorage` 密文里：
 *
 *   - 密文：`~/Library/Application Support/com.qoder(cn).app.stable/auth.v1.dat`
 *   - macOS 钥匙串口令：服务名按区域查表（CN `Qoder CN App Safe Storage`、
 *     国际版 `Qoder App Safe Storage`）
 *   - 解出：`{ token: "dt-…", refreshToken: "drt-…", user: {…}, expiresAt }`
 *
 * 这与 `daddysuite-accounts.js` 读的是**同一族**文件，但两者服务的场景不同：
 * 那个模块读的是 daddy-suite 自己落盘的**账号库快照**（`~/.qoderdaddy`），
 * 只有当用户装过 daddy-suite 并往里存过账号时才有内容。本模块读的是
 * **当前这台机器上 Qoder 客户端此刻的登录态** —— 用户刚在客户端登录的那个
 * 账号，不需要任何第三方工具先做快照。
 *
 * ## 关键事实：桌面令牌 ≠ 连接器 PAT
 *
 * 实测（CN + Global 两区域）：
 *
 * | 用途 | `dt-` | `drt-` | `pt-` |
 * | --- | --- | --- | --- |
 * | 网关 `jobToken` 交换（chat 链路） | ✗ 401 | ✗ 401 | ✓ |
 * | openapi `/sash/api/…`（用量） | ✓ | — | ✓ |
 * | COSY `agent_chat_generation`（chat） | ✓ | — | ✓ |
 *
 * 也就是说：**桌面登录态可以直接跑对话**（COSY 会话用 `dt-` 作为
 * `security_oauth_token`，与 buddy-switch 的做法一致），但它**不能**当作
 * 连接器的 PAT 塞进 vault —— vault 的每条凭据都假定能过 `jobToken` 交换。
 *
 * 因此本模块给本地登录态一个**独立的凭据形态**：`{ kind: "device", token,
 * refreshToken, uid }`，并让 upstream 对这类凭据直接建 COSY 会话（跳过
 * `jobToken` 交换）。`kind: "pat"` 的凭据仍然走原来那条交换路径。
 *
 * ## 记录簿
 *
 * 「记录用于账号切换」落在 `~/.dsh/.qoder-local-logins.<region>.json`：
 * 每次「拉取当前本地登录」把解出的身份快照记一条（按 uid 去重），列表在
 * Hub 的账号下拉里与 PAT 账号并列展示，选中即切换。
 *
 * ⚠️ 凭据本身（`dt-`/`drt-`）**不写进记录簿**，只写 uid / 昵称 / 邮箱 /
 * 到期时间。切换时按 uid 回读当前客户端登录态（或记录簿里另一条快照的
 * 明文凭据在内存中），所以记录簿泄露不等于令牌泄露。这样设计还有一个好处：
 * 客户端重新登录会刷新令牌，记录簿里的旧令牌副本必然过期，回读永远拿最新
 * 的那一枚。
 *
 * @module dsh-connect-qoder/local-login
 */
import { execFile } from "node:child_process";
import { createDecipheriv, createHash, pbkdf2Sync } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { resolveDshHome } from "@deepseek-ai/dsh-home-paths";
import { withFileLock, writeFileAtomic } from "@deepseek-ai/dsh-atomic-write";

/** 账号来源标记：桌面客户端当前登录态。 */
export const LOCAL_LOGIN_SOURCE = "local-login";

/** 本地登录凭据的形态标记（与 vault 的 PAT 区分）。 */
export const LOCAL_LOGIN_KIND = "device";

/**
 * 各区域的桌面客户端目录与 macOS 钥匙串服务名。
 *
 * `dataDir` 是 Electron userData 目录名；`cliDir` 是 CLI 侧的 `~/.qoder*`
 * （用于读 `.qoder-app-status.json` 这类状态快照）。
 *
 * ⚠️ 国内版钥匙串是 `Qoder CN App Safe Storage`，国际版才是
 * `Qoder App Safe Storage`（实测；daddy-suite issue #81 同款坑）。
 */
const REALMS = {
	cn: {
		dataDir: "com.qodercn.app.stable",
		cliDir: ".qoder-cn",
		keychainService: "Qoder CN App Safe Storage",
		statusProduct: "qodercn"
	},
	global: {
		dataDir: "com.qoder.app.stable",
		cliDir: ".qoder",
		keychainService: "Qoder App Safe Storage",
		statusProduct: "qoder"
	}
};

const AUTH_FILE = "auth.v1.dat";
const STATUS_FILE = ".qoder-app-status.json";
const V10_PREFIX = "v10";
const SALT = "saltysalt";
const PBKDF2_ITERATIONS = 1003;
const DERIVED_KEY_BYTES = 16;
/** Chromium macOS 方案的 IV 固定为 16 个空格。 */
const CBC_IV = Buffer.alloc(16, 0x20);
/** 首次读钥匙串会弹系统授权，给它足够时间等用户点「允许」。 */
const KEYCHAIN_TIMEOUT_MS = 60000;

/** 记录簿格式版本；不匹配就当作空簿（宁可丢记录，也不要读坏结构）。 */
const LEDGER_FORMAT_VERSION = 1;

/** service → Promise<string|undefined>；缓存 Promise 让并发请求共用一次授权。 */
const passwordCache = new Map();
/** auth 文件路径 → { stamp, value }；按 size+mtime 失效，避免反复解密。 */
const decryptCache = new Map();

/** 认得出的桌面访问令牌前缀（`dt-` 设备流访问令牌）。 */
const DEVICE_TOKEN_PREFIX = "dt-";
/** 认得出的桌面刷新令牌前缀。 */
const DEVICE_REFRESH_PREFIX = "drt-";

/**
 * 时间字段归一成毫秒。认不出的返回 undefined（宁可没有，不要编）。
 */
function timestampOf(value) {
	if (typeof value === "number" && Number.isFinite(value) && value > 0) {
		return value < 1e12 ? value * 1000 : value;
	}
	if (typeof value === "string" && value.trim() !== "") {
		const numeric = Number(value);
		if (Number.isFinite(numeric) && numeric > 0) return numeric < 1e12 ? numeric * 1000 : numeric;
		const parsed = Date.parse(value);
		if (Number.isFinite(parsed)) return parsed;
	}
	return void 0;
}

/** 读钥匙串口令；失败返回 undefined（含用户拒绝授权、条目不存在）。 */
function readKeychainPassword(service) {
	const cached = passwordCache.get(service);
	if (cached !== void 0) return cached;
	const pending = new Promise((resolve) => {
		execFile("security", ["find-generic-password", "-s", service, "-w"], { timeout: KEYCHAIN_TIMEOUT_MS }, (error, stdout) => {
			if (error !== null || typeof stdout !== "string" || stdout.trim() === "") return resolve(void 0);
			resolve(stdout.trim());
		});
	});
	passwordCache.set(service, pending);
	return pending;
}

/** 解一枚 `v10` 密文；格式不符或解密失败返回 undefined。 */
function decryptRecord(blob, password) {
	if (blob.length <= V10_PREFIX.length) return void 0;
	if (blob.subarray(0, V10_PREFIX.length).toString("latin1") !== V10_PREFIX) return void 0;
	try {
		const key = pbkdf2Sync(password, SALT, PBKDF2_ITERATIONS, DERIVED_KEY_BYTES, "sha1");
		const decipher = createDecipheriv("aes-128-cbc", key, CBC_IV);
		const plain = Buffer.concat([decipher.update(blob.subarray(V10_PREFIX.length)), decipher.final()]);
		const parsed = JSON.parse(plain.toString("utf8").trim());
		return typeof parsed === "object" && parsed !== null ? parsed : void 0;
	} catch {
		return void 0;
	}
}

/** 桌面客户端 userData 目录。 */
function dataDirOf(region) {
	const realm = REALMS[region];
	if (realm === void 0) return void 0;
	return join(homedir(), "Library", "Application Support", realm.dataDir);
}

/** 该区域桌面登录态的密文路径。 */
export function localAuthPath(region) {
	const dir = dataDirOf(region);
	return dir === void 0 ? void 0 : join(dir, AUTH_FILE);
}

/** 读一份 `auth.v1.dat`，返回解出的原始记录；任何一步失败都返回 undefined。 */
async function readAuthRecord(region, authPath) {
	let stamp;
	try {
		const info = await stat(authPath);
		stamp = `${info.size}:${info.mtimeMs}`;
	} catch {
		return void 0;
	}
	const cached = decryptCache.get(authPath);
	if (cached !== void 0 && cached.stamp === stamp) return cached.value;
	let value;
	try {
		const realm = REALMS[region];
		const password = await readKeychainPassword(realm.keychainService);
		if (password !== void 0) value = decryptRecord(await readFile(authPath), password);
	} catch {
		value = void 0;
	}
	decryptCache.set(authPath, { stamp, value });
	return value;
}

/**
 * 账号稳定 id。
 *
 * 桌面登录态**没有** PAT 可哈希，用 `user.id`（Qoder 的 uid）派生，前缀
 * 用 `login-` 以示与 vault 的 `pat-<hash>` 不同族 —— 这样 `isQoderAccountId`
 * 的校验不会把它误判成「插件写入的 PAT 账号」，删除/测试等按 id 分派的地方
 * 也能一眼分清来源。
 */
function localAccountId(uid) {
	return `login-${createHash("sha256").update(`qoder-local:${uid}`, "utf8").digest("hex").slice(0, 16)}`;
}

/** 判断一个 id 是否由本地登录派生。 */
export function isLocalLoginAccountId(id) {
	return /^login-[0-9a-f]{16}$/.test(id);
}

/** 从解出的记录里取可用凭据（只认 `dt-` / `drt-`）。 */
function credentialOfRecord(record) {
	const token = typeof record.token === "string" ? record.token.trim() : "";
	const refreshToken = typeof record.refreshToken === "string" ? record.refreshToken.trim() : "";
	return {
		...token !== "" && token.startsWith(DEVICE_TOKEN_PREFIX) && !/\s/.test(token) ? { token } : {},
		...refreshToken !== "" && refreshToken.startsWith(DEVICE_REFRESH_PREFIX) && !/\s/.test(refreshToken) ? { refreshToken } : {}
	};
}

/** 身份字段归一（昵称/邮箱/手机号，空字符串一律省略）。 */
function identityOf(record) {
	const user = typeof record.user === "object" && record.user !== null ? record.user : {};
	const text = (value) => (typeof value === "string" && value.trim() !== "" ? value.trim() : undefined);
	const uid = text(user.id) ?? "";
	return {
		uid,
		name: text(user.name) ?? "",
		...text(user.email) === undefined ? {} : { email: text(user.email) },
		...text(user.phone) === undefined ? {} : { phone: text(user.phone) },
		...text(user.avatarUrl) === undefined ? {} : { avatarUrl: text(user.avatarUrl) }
	};
}

/** 昵称优先级：name → email → phone → uid。 */
function displayNameOf(identity) {
	for (const value of [identity.name, identity.email, identity.phone, identity.uid]) {
		if (typeof value === "string" && value.trim() !== "") return value.trim();
	}
	return "";
}

/**
 * 读该区域**当前**的桌面登录态。
 *
 * 返回 `{ id, accountName, source, kind, token, refreshToken, uid, …expiry }`
 * 或 undefined（未安装 / 未登录 / 钥匙串拒绝 / 格式变了都算「没有」，
 * 绝不抛）。
 */
export async function readLocalLogin(region) {
	const authPath = localAuthPath(region);
	if (authPath === void 0) return void 0;
	const record = await readAuthRecord(region, authPath);
	if (record === void 0) return void 0;
	const identity = identityOf(record);
	if (identity.uid === "") return void 0;
	const credential = credentialOfRecord(record);
	if (credential.token === undefined && credential.refreshToken === undefined) return void 0;
	const tokenExpiresAtMs = timestampOf(record.expiresAt);
	const refreshExpiresAtMs = timestampOf(record.refreshTokenExpiresAt);
	return {
		id: localAccountId(identity.uid),
		accountName: displayNameOf(identity),
		source: LOCAL_LOGIN_SOURCE,
		kind: LOCAL_LOGIN_KIND,
		uid: identity.uid,
		...identity,
		...credential,
		...tokenExpiresAtMs === void 0 ? {} : { tokenExpiresAtMs },
		...refreshExpiresAtMs === void 0 ? {} : { refreshExpiresAtMs },
		authPath
	};
}

/**
 * 读 CLI 侧的状态快照（`~/.qoder-cn/` 或 `~/.qoder/` 下的
 * `.qoder-app-status.json`）。
 *
 * 只用于**诊断展示**（「客户端显示已登录 / 未登录」），绝不作为凭据来源 ——
 * 那份文件里没有令牌。读不到就返回 undefined。
 */
export async function readAppStatus(region) {
	const realm = REALMS[region];
	if (realm === void 0) return void 0;
	try {
		const parsed = JSON.parse(await readFile(join(homedir(), realm.cliDir, STATUS_FILE), "utf8"));
		if (typeof parsed !== "object" || parsed === null) return void 0;
		const loggedIn = parsed.logged_in === true;
		return {
			loggedIn,
			...typeof parsed.name === "string" && parsed.name.trim() !== "" ? { name: parsed.name.trim() } : {},
			...typeof parsed.email === "string" && parsed.email.trim() !== "" ? { email: parsed.email.trim() } : {},
			...typeof parsed.snapshot_at === "string" ? { snapshotAt: parsed.snapshot_at } : {}
		};
	} catch {
		return void 0;
	}
}

/** 记录簿路径：`~/.dsh/.qoder-local-logins.<region>.json`。 */
export function localLoginsPath(region) {
	return join(resolveDshHome(), `.qoder-local-logins.${region}.json`);
}

function isLedgerEntry(value) {
	return typeof value === "object" && value !== null && typeof value.id === "string" && isLocalLoginAccountId(value.id) && typeof value.uid === "string" && value.uid !== "";
}

/** 读记录簿；任何异常都返回空簿（读取永不抛）。 */
async function readLedger(region) {
	try {
		const parsed = JSON.parse(await readFile(localLoginsPath(region), "utf8"));
		if (typeof parsed !== "object" || parsed === null) return [];
		if (parsed.version !== LEDGER_FORMAT_VERSION) return [];
		if (!Array.isArray(parsed.accounts)) return [];
		return parsed.accounts.filter(isLedgerEntry);
	} catch {
		return [];
	}
}

/** 原子写记录簿（`0o600`，与 vault 同款纪律）。 */
async function writeLedger(region, accounts) {
	const path = localLoginsPath(region);
	await withFileLock(path, async () => {
		await writeFileAtomic(path, JSON.stringify({
			version: LEDGER_FORMAT_VERSION,
			accounts
		}, null, 2), { mode: 384 });
	});
}

/**
 * 本机桌面登录态记录簿（按区域隔离）。
 *
 * 只记**身份与时间**，不记凭据：令牌留在客户端密文里，切换时按 uid 回读。
 */
export class LocalLoginLedger {
	constructor(region) {
		this.region = region;
	}

	/** 记录簿里的全部条目（最近一次「拉取」在最后）。 */
	async entries() {
		return readLedger(this.region);
	}

	/**
	 * 记一条快照（按 uid 去重）。
	 *
	 * 已存在的 uid 只更新昵称/到期时间，并把它移到末尾（「最近使用」语义），
	 * 不新增重复行。
	 */
	async record(login) {
		const entry = {
			id: login.id,
			uid: login.uid,
			accountName: login.accountName,
			source: LOCAL_LOGIN_SOURCE,
			...login.email === undefined ? {} : { email: login.email },
			...login.phone === undefined ? {} : { phone: login.phone },
			...login.tokenExpiresAtMs === undefined ? {} : { tokenExpiresAtMs: login.tokenExpiresAtMs },
			...login.refreshExpiresAtMs === undefined ? {} : { refreshExpiresAtMs: login.refreshExpiresAtMs },
			recordedAtMs: Date.now()
		};
		let next = [];
		await withFileLock(localLoginsPath(this.region), async () => {
			const current = await readLedger(this.region);
			const others = current.filter((item) => item.uid !== entry.uid);
			next = [...others, entry];
			await writeFileAtomic(localLoginsPath(this.region), JSON.stringify({
				version: LEDGER_FORMAT_VERSION,
				accounts: next
			}, null, 2), { mode: 384 });
		});
		return entry;
	}

	/** 删除一条记录（按 id）。 */
	async remove(id) {
		let removed = false;
		await withFileLock(localLoginsPath(this.region), async () => {
			const current = await readLedger(this.region);
			const next = current.filter((item) => item.id !== id);
			if (next.length === current.length) return;
			removed = true;
			await writeFileAtomic(localLoginsPath(this.region), JSON.stringify({
				version: LEDGER_FORMAT_VERSION,
				accounts: next
			}, null, 2), { mode: 384 });
		});
		return removed;
	}

	/** 按 id 找一条记录。 */
	async find(id) {
		return (await readLedger(this.region)).find((item) => item.id === id);
	}
}

/**
 * 列出该区域可用的本地登录账号：**当前登录态** + 记录簿里的历史条目。
 *
 * 当前登录态永远排第一（它是唯一「活的」凭据）；记录簿里同 uid 的条目被
 * 合并进它，不重复列出。历史条目只带身份，`tokenExpiresAtMs` 可能已过期 ——
 * 选中它时由 {@link resolveLocalLogin} 回读客户端，读不到就明确报错，
 * 绝不静默回落到别的账号。
 */
export async function listLocalLogins(region) {
	const ledger = new LocalLoginLedger(region);
	const entries = await ledger.entries();
	const current = await readLocalLogin(region);
	const out = [];
	const seen = new Set();
	if (current !== void 0) {
		out.push({
			id: current.id,
			accountName: current.accountName,
			source: LOCAL_LOGIN_SOURCE,
			uid: current.uid,
			active: true,
			...current.email === undefined ? {} : { email: current.email },
			...current.phone === undefined ? {} : { phone: current.phone },
			...current.tokenExpiresAtMs === undefined ? {} : { tokenExpiresAtMs: current.tokenExpiresAtMs },
			...current.refreshExpiresAtMs === undefined ? {} : { refreshExpiresAtMs: current.refreshExpiresAtMs }
		});
		seen.add(current.uid);
	}
	for (const entry of entries) {
		if (seen.has(entry.uid)) continue;
		seen.add(entry.uid);
		out.push({
			id: entry.id,
			accountName: entry.accountName,
			source: LOCAL_LOGIN_SOURCE,
			uid: entry.uid,
			active: false,
			...entry.email === undefined ? {} : { email: entry.email },
			...entry.phone === undefined ? {} : { phone: entry.phone },
			...entry.tokenExpiresAtMs === undefined ? {} : { tokenExpiresAtMs: entry.tokenExpiresAtMs },
			...entry.refreshExpiresAtMs === undefined ? {} : { refreshExpiresAtMs: entry.refreshExpiresAtMs },
			...entry.recordedAtMs === undefined ? {} : { recordedAtMs: entry.recordedAtMs }
		});
	}
	return out;
}

/**
 * 把一条「本地登录账号」解析成可用凭据。
 *
 * 关键约束：**客户端此刻登录的账号只有一个**。所以：
 *
 * - 选中的 uid 与当前登录态一致 ⇒ 直接用当前凭据（活的、最新的）；
 * - 选中的 uid 是记录簿里的历史条目 ⇒ **明确报错**，提示用户在 Qoder
 *   客户端切到该账号后重新拉取。绝不拿当前账号冒充另一个账号 —— 那会让
 *   「切换」变成「看起来切了、实际还在用同一个号」，是这类工具最恶劣的
 *   失效形态。
 *
 * @throws {Error} 记录簿里没有该 uid，或它与客户端当前登录态不一致。
 */
export async function resolveLocalLogin(region, accountId) {
	const current = await readLocalLogin(region);
	/** 当前登录态本身就是一条合法账号（还没「拉取记录」也该能直接用）。 */
	if (current !== void 0 && current.id === accountId) return current;
	const ledger = new LocalLoginLedger(region);
	const entry = await ledger.find(accountId);
	if (entry === undefined) throw new Error(`本地登录记录里没有 ${accountId}（可能已被删除）`);
	if (current !== void 0 && current.uid === entry.uid) return current;
	throw new Error(
		`该账号（${entry.accountName || entry.uid}）不是 Qoder 客户端当前登录的账号。` +
		`请在 Qoder 桌面客户端里切换到它，然后点「拉取当前登录」再试。`
	);
}
