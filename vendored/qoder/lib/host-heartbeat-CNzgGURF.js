import { createCipheriv, createHash, publicEncrypt, randomBytes, randomUUID } from "node:crypto";
import { execFile, execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { readFile, rm, writeFile } from "node:fs/promises";
import { withFileLock, writeFileAtomic } from "@deepseek-ai/dsh-atomic-write";
import { resolveDshHome } from "@deepseek-ai/dsh-home-paths";
//#region src/cosy.ts
/**
* Qoder cosy 协议：加密与签名原语（TypeScript 移植）。
*
* 协议来源（社区逆向 + 官方产物核对）：
* - fengyinxia/qoder2api（MIT）：qoder_auth.py —— PAT→jobToken 交换、cosy
*   签名、自定义 base64、RSA/AES 会话构建，实测可用（CN 网关）。
* - x_Zhengyuuuui/qoder2api（Go 版）：internal/cosy/* —— 同一协议的 Go
*   实现，含设备指纹派生（fingerprint.go），并有 CN / Global 双区域端点。
* - @qoder-ai/qoder-agent-sdk 官方 .d.ts：模型字段、用量字段的官方命名。
*
* 本模块只做「无状态纯函数 + 加密原语」，不触网；网络与流程在 upstream.ts。
*
* @module dsh-connect-qoder/cosy
*/
/** cosy 自定义 base64 字母表（与 qoder2api 逐字节一致）。 */
const CUSTOM_ALPHABET = "_doRTgHZBKcGVjlvpC,@aFSx#DPuNJme&i*MzLOEn)sUrthbf%Y^w.(kIQyXqWA!";
const STD_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const s2c = /* @__PURE__ */ new Map();
const c2s = /* @__PURE__ */ new Map();
for (let i = 0; i < 64; i += 1) {
	s2c.set(STD_ALPHABET[i], CUSTOM_ALPHABET[i]);
	c2s.set(CUSTOM_ALPHABET[i], STD_ALPHABET[i]);
}
s2c.set("=", "$");
c2s.set("$", "=");
/**
* Qoder 自定义 base64 编码：先标准 base64，再按 `n/3` 三块重排，
* 最后把每个字符映射到自定义字母表（含自定义 pad `$`）。
*/
function cosyEncode(plaintext) {
	const std = Buffer.from(plaintext).toString("base64");
	const n = std.length;
	const a = Math.floor(n / 3);
	const rearranged = std.slice(n - a) + std.slice(a, n - a) + std.slice(0, a);
	let out = "";
	for (const ch of rearranged) {
		const mapped = s2c.get(ch);
		if (mapped === void 0) throw new Error(`cosy encode: char out of alphabet: ${ch}`);
		out += mapped;
	}
	return out;
}
/** RFC1123 格式的当前 UTC 时间，用于旧式签名头。 */
function currentRfc1123Date() {
	return (/* @__PURE__ */ new Date()).toUTCString();
}
function md5Hex(input) {
	return createHash("md5").update(input, "utf8").digest("hex");
}
function sha512Base64Url(input) {
	return createHash("sha512").update(input, "utf8").digest("base64url");
}
/** cosy 签名常量。 */
const COSY_APPCODE = "cosy";
const COSY_SECRET_B64 = "d2FyLCB3YXIgbmV2ZXIgY2hhbmdlcw==";
/** 旧式请求签名：md5("cosy&<secret>&<rfc1123date>")。 */
function signLegacy(date) {
	return md5Hex(`${COSY_APPCODE}&${COSY_SECRET_B64}&${date}`);
}
/**
* Qoder 网关 RSA 公钥（客户端用它加密会话临时密钥）。
* 与 qoder2api / Go 克隆一致。
*/
const SERVER_PUBKEY_PEM = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDA8iMH5c02LilrsERw9t6Pv5Nc
4k6Pz1EaDicBMpdpxKduSZu5OANqUq8er4GM95omAGIOPOh+Nx0spthYA2BqGz+l
6HRkPJ7S236FZz73In/KVuLnwI8JJ2CbuJap8kvheCCZpmAWpb/cPx/3Vr/J6I17
XcW+ML9FoCI6AOvOzwIDAQAB
-----END PUBLIC KEY-----`;
/** cosy 版本号（客户端身份的一部分，与 qoder2api 实测一致）。 */
const COSY_VERSION = "0.1.43";
/** AES-CBC + PKCS7 填充。 */
function aesCbcEncrypt(plain, key) {
	const iv = key;
	const blockSize = 16;
	const padLen = blockSize - plain.length % blockSize;
	const padded = new Uint8Array(plain.length + padLen);
	padded.set(plain);
	padded.fill(padLen, plain.length);
	const cipher = createCipheriv("aes-128-cbc", key, iv);
	const out = Buffer.concat([cipher.update(padded), cipher.final()]);
	return new Uint8Array(out);
}
/** RSA PKCS1v1.5 加密（用网关公钥加密会话临时密钥）。 */
function rsaEncrypt(plain) {
	const { publicKey } = requirePublicKey();
	const out = publicEncrypt({
		key: publicKey,
		padding: 1
	}, Buffer.from(plain));
	return new Uint8Array(out);
}
let cachedPublicKey;
function requirePublicKey() {
	if (cachedPublicKey === void 0) cachedPublicKey = { publicKey: SERVER_PUBKEY_PEM };
	return cachedPublicKey;
}
/**
* 新会话：生成临时密钥 → RSA 加密得 cosyKey → AES 加密身份载荷得 info。
* `tempKey` 用 16 字节随机数的 hex 前 16 字符（与 qoder2api 一致）。
*/
function newCosySession(identity, machineId, machineToken, machineType) {
	const tempKey = new Uint8Array(Buffer.from(randomBytes(16).toString("hex").slice(0, 16), "utf8"));
	const cosyKeyBytes = rsaEncrypt(tempKey);
	const cosyKey = Buffer.from(cosyKeyBytes).toString("base64");
	const payload = JSON.stringify(identityPayload(identity));
	return {
		tempKey,
		cosyKey,
		info: Buffer.from(aesCbcEncrypt(new Uint8Array(Buffer.from(payload, "utf8")), tempKey)).toString("base64"),
		identity,
		machineId,
		machineToken,
		machineType
	};
}
function identityPayload(identity) {
	return {
		name: identity.name,
		aid: identity.aid,
		uid: identity.uid,
		yx_uid: identity.yx_uid,
		organization_id: identity.organization_id,
		organization_name: identity.organization_name,
		user_type: identity.user_type,
		security_oauth_token: identity.security_oauth_token,
		refresh_token: identity.refresh_token
	};
}
/**
* Bearer 载荷：{cosyVersion, ideVersion, info, requestId, version} 的
* 标准 base64（键序按字典序，与 qoder2api 一致）。
*/
function buildPayloadB64(info) {
	const payload = {
		cosyVersion: COSY_VERSION,
		ideVersion: "",
		info,
		requestId: randomUUID(),
		version: "v1"
	};
	const sorted = Object.fromEntries(Object.entries(payload).sort(([a], [b]) => a < b ? -1 : 1));
	return Buffer.from(JSON.stringify(sorted)).toString("base64");
}
/**
* 请求签名：md5(payloadB64 \n cosyKey \n date \n body \n pathWithoutAlgo)。
*/
function signRequest(payloadB64, cosyKey, cosyDate, body, pathSig) {
	return md5Hex(`${payloadB64}\n${cosyKey}\n${cosyDate}\n${body}\n${pathSig}`);
}
/** 组装 Authorization 头：`Bearer COSY.<payloadB64>.<sig>`。 */
function composeBearer(payloadB64, sig) {
	return `Bearer COSY.${payloadB64}.${sig}`;
}
/** 从完整 URL 派生签名路径：去掉 `/algo` 前缀（不含查询串）。 */
function pathSigFrom(fullUrl) {
	let path;
	try {
		path = new URL(fullUrl).pathname;
	} catch {
		path = fullUrl;
	}
	return path.startsWith("/algo") ? path.slice(5) : path;
}
function saltedSeed(seed, installSalt) {
	return installSalt ? `${seed}|salt:${installSalt}` : seed;
}
function deriveId(seed, salt, installSalt) {
	return md5Hex(`${salt}:${saltedSeed(seed, installSalt)}`);
}
/**
* 派生设备指纹。seed 优先取账号 UID；未知时回退 `cred:<credential>`，
* 保证同一凭证跨次调用派生结果一致。
*/
function deriveFingerprint(uid, credential, installSalt) {
	const seed = uid !== "" ? uid : `cred:${credential}`;
	return {
		machineId: deriveId(seed, "machine", installSalt),
		machineType: deriveId(seed, "machinetype", installSalt).slice(0, 18),
		machineToken: sha512Base64Url(`machinetoken:${saltedSeed(seed, installSalt)}`).slice(0, 43)
	};
}
//#endregion
//#region src/messages.ts
/** 构建一份全新的聊天请求体（每个请求必须换 ID）。 */
function createChatBodyTemplate() {
	return {
		request_id: "",
		request_set_id: "",
		chat_record_id: "",
		stream: true,
		chat_task: "FREE_INPUT",
		chat_context: {
			extra: {
				modelConfig: {
					is_reasoning: false,
					key: "lite"
				},
				originalContent: {
					type: "text",
					text: ""
				}
			},
			text: {
				type: "text",
				text: ""
			}
		},
		session_id: "",
		source: 1,
		version: "3",
		aliyun_user_type: "personal_standard",
		session_type: "qodercli",
		agent_id: "agent_common",
		task_id: "common",
		model_config: {
			key: "lite",
			is_vl: false,
			is_reasoning: false,
			source: "system"
		},
		messages: [],
		business: {
			id: "",
			name: "hi",
			begin_at: 0
		}
	};
}
function blankResponseMeta() {
	return {
		id: "",
		usage: {
			prompt_tokens: 0,
			completion_tokens: 0,
			total_tokens: 0,
			completion_tokens_details: { reasoning_tokens: 0 },
			prompt_tokens_details: { cached_tokens: 0 }
		}
	};
}
function structuredMessage(role, text) {
	return {
		role,
		content: text,
		response_meta: blankResponseMeta(),
		reasoning_content_signature: ""
	};
}
function userMessage(text, images = []) {
	const parts = [];
	for (const url of images) parts.push({
		type: "image_url",
		image_url: { url }
	});
	if (text.trim()) parts.push({
		type: "text",
		text
	});
	if (parts.length === 0) parts.push({
		type: "text",
		text: ""
	});
	return {
		role: "user",
		content: "",
		contents: parts,
		response_meta: blankResponseMeta(),
		reasoning_content_signature: ""
	};
}
function toolMessage(message, text) {
	const out = structuredMessage("tool", text);
	if (typeof message.name === "string") out.name = message.name;
	if (typeof message.tool_call_id === "string") out.tool_call_id = message.tool_call_id;
	return out;
}
function assistantToolCallMessage(text, toolCalls) {
	const out = structuredMessage("assistant", text);
	out.tool_calls = toolCalls;
	return out;
}
/** 从 OpenAI 消息提取纯文本（content 字符串、contents parts、named 等）。 */
function normalizeMessageText(message) {
	const content = message.content;
	if (typeof content === "string") return content;
	if (Array.isArray(content)) {
		const parts = [];
		for (const part of content) if (typeof part === "string") parts.push(part);
		else if (part && typeof part === "object") {
			const t = part.text;
			if (typeof t === "string") parts.push(t);
			else if (typeof part.value === "string") parts.push(part.value);
		}
		return parts.join("");
	}
	return "";
}
/** 提取消息里的图片 URL（user 消息的 image_url parts）。 */
function extractMessageImages(message) {
	if (message.role !== "user") return [];
	const content = message.content;
	if (!Array.isArray(content)) return [];
	const urls = [];
	for (const part of content) {
		const iu = part.image_url;
		if (iu && typeof iu.url === "string") urls.push(iu.url);
	}
	return urls;
}
const TOOL_CALLS_TEXT_RE = /Tool calls:\s*(\[[\s\S]*?\])/;
/** 尝试从文本解析 "Tool calls: [...]" 形状的 tool_calls（兜底）。 */
function parseToolCallsText(text) {
	if (!text) return void 0;
	const m = TOOL_CALLS_TEXT_RE.exec(text);
	if (!m?.[1]) return void 0;
	try {
		const parsed = JSON.parse(m[1]);
		if (Array.isArray(parsed) && parsed.every((item) => item && typeof item === "object")) return normalizeToolCalls(parsed);
	} catch {
		return;
	}
}
function normalizeToolCalls(raw) {
	return raw.map((tc) => {
		if (tc && typeof tc === "object" && !("function" in tc)) {
			const r = tc;
			if (r.id && r.name && r.input) return {
				id: r.id,
				type: "function",
				function: {
					name: r.name,
					arguments: JSON.stringify(r.input)
				}
			};
		}
		return tc;
	});
}
/** 检测 assistant 消息之后是否有已解析的 tool 响应（决定结构化 tool_calls 传输）。 */
function hasResolvedToolResponse(messages, assistantIndex) {
	const message = messages[assistantIndex];
	if (message === void 0 || message.role !== "assistant") return false;
	const tc = message.tool_calls;
	if (!(Array.isArray(tc) && tc.length > 0) && !parseToolCallsText(normalizeMessageText(message))) return false;
	for (let i = assistantIndex + 1; i < messages.length; i += 1) {
		const next = messages[i];
		if (next?.role === "tool") return true;
		if (next !== void 0 && (next.role === "assistant" || next.role === "user" || next.role === "system")) return false;
	}
	return false;
}
function renderToolCalls(toolCalls) {
	return `Tool calls:\n${JSON.stringify(toolCalls)}`;
}
function renderToolResult(message, text) {
	const name = typeof message.name === "string" ? message.name : "";
	const toolCallId = typeof message.tool_call_id === "string" ? message.tool_call_id : "";
	let out = "Tool result";
	if (name) out += ` (${name})`;
	if (toolCallId) out += ` [${toolCallId}]`;
	if (text.trim()) out += `:\n${text}`;
	return out;
}
/**
* 把一条 OpenAI 消息转换为 Qoder 消息形状；返回 null 表示该条无法表示（跳过）。
*/
function convertIncomingMessage(message, toolsEnabled, allowStructuredToolCalls) {
	const role = typeof message.role === "string" ? message.role : "user";
	const text = normalizeMessageText(message);
	let structuredToolCalls;
	if (toolsEnabled && allowStructuredToolCalls) {
		const tc = Array.isArray(message.tool_calls) && message.tool_calls.length > 0 ? message.tool_calls : parseToolCallsText(text);
		if (tc) structuredToolCalls = tc;
	}
	if (role === "assistant" && structuredToolCalls) return assistantToolCallMessage(text, structuredToolCalls);
	if (role === "tool") {
		if (toolsEnabled) return toolMessage(message, text);
		return structuredMessage("user", renderToolResult(message, text));
	}
	let finalText = text;
	if (role === "assistant" && !toolsEnabled && Array.isArray(message.tool_calls) && message.tool_calls.length > 0) finalText = [text, renderToolCalls(message.tool_calls)].filter(Boolean).join("\n\n");
	const images = role === "user" ? extractMessageImages(message) : [];
	if (!finalText.trim() && images.length === 0) return null;
	if (role === "user") return userMessage(images.length > 0 ? finalText.split("\n\n").filter((s) => !s.trim().startsWith("[image] ")).join("\n\n") : finalText, images);
	return structuredMessage(role, finalText);
}
/**
* 构建发往 Qoder 网关的 messages 数组。OpenAI 形状入参 → Qoder 形状。
*/
function buildQoderMessages(incoming, prompt, toolsEnabled) {
	const rebuilt = [];
	if (incoming.length > 0) for (let i = 0; i < incoming.length; i += 1) {
		const allowStructured = toolsEnabled && hasResolvedToolResponse(incoming, i);
		const converted = convertIncomingMessage(incoming[i], toolsEnabled, allowStructured);
		if (converted !== null) rebuilt.push(converted);
	}
	if (rebuilt.length === 0 && prompt.trim()) rebuilt.push(userMessage(prompt));
	return rebuilt;
}
/** 取最后一条 user 消息的纯文本（供 chat_context / business.name 使用）。 */
function extractLatestUserPrompt(messages) {
	for (let i = messages.length - 1; i >= 0; i -= 1) {
		const m = messages[i];
		if (m?.role === "user") {
			const text = normalizeMessageText(m);
			if (text.trim()) return text;
		}
	}
	return "";
}
/** 任意 JSON 深拷贝（模板必须逐请求独立）。 */
function deepClone(value) {
	return structuredClone(value);
}
/** 模型名 → 是否需要图像输入（is_vl）。两个入口都改：model_config 与 chat_context.extra.modelConfig。 */
function applyModelKey(body, key, userType, isVl) {
	body.model_config.key = key;
	body.model_config.is_vl = isVl;
	body.chat_context.extra.modelConfig.key = key;
	body.aliyun_user_type = userType;
}
//#endregion
//#region src/device-risk.ts
/**
* 设备风控身份（国际版签到依赖）。
*
* 背景：国际版的每日签到活动**只下发给带设备风控头的请求**
* （`Cosy-MachineToken` / `Cosy-MachineCode` / `Cosy-MachineType`）。国内版不需要。
* 这三件套由 Qoder 客户端自带的 UMID 组件（`runtime-info`）在本机生成 —— 它不是
* 随机数，而是与这台机器绑定的标识，所以**不能**由插件伪造或缓存到别的机器。
*
* 来源：社区参考实现 L0NE-6/Qoder-Daily（MIT）的做法是先在 Qoder 客户端资源目录里
* 找 `umid/runtime-info`，找不到才去官方 qodercli 包里提取。本插件只做前者：本机装了
* Qoder 就有，没装就如实报「取不到」，不去下载任何东西。
*
* 组件位置按两层探测：静态候选表（macOS App 内、Windows 默认安装位置）先走，没命中
* 再向 Windows 卸载登记表问「Qoder 装在哪儿」—— 安装器允许改目录，默认位置不是唯一
* 位置，详见 {@link resolveDeviceRiskComponent}。
*
* 为什么不在插件里缓存：组件本身每次调用都会给出当前有效值（参考实现按 50 分钟
* 刷新）。这里按 {@link RISK_TTL_MS} 做进程内缓存，避免每次签到都 fork 一个进程。
*
* @module dsh-connect-qoder/device-risk
*/
const run = promisify(execFile);
/** 组件输出的大小上限：超过即视为异常输出，不解析。 */
const MAX_OUTPUT_BYTES = 1048576;
/**
* 组件进程的 spawn 选项。
*
* `windowsHide` 与 `host-heartbeat.ts` 的 `PROCESS_PROBE_OPTIONS` 同因（家族
* 教训，见其注释）：DSH Desktop 宿主是 Electron GUI 进程（无 console），
* Windows 会给这种父进程的控制台子程序**新建一个可见窗口** —— 每次读设备
* 身份都会闪一个黑框。POSIX 上该选项被忽略。
*/
const RISK_PROCESS_OPTIONS = {
	timeout: 25e3,
	maxBuffer: MAX_OUTPUT_BYTES,
	windowsHide: true
};
/**
* 每个区域的 UMID 组件搜索路径，按优先级排列。
*
* 区域与 App 的对应关系沿用参考实现：国际版优先 `Qoder`，国内版优先 `Qoder CN`。
* 两个 App 都装时，各自优先自己那个 —— 设备身份与区域是绑定的，用错一侧的组件
* 会被风控拒绝。
*
* 这里是 **macOS** 的安装位置；Windows 的安装位置（`%LOCALAPPDATA%\Programs\…`）
* 由 {@link windowsUmidCandidates} 动态展开后**追加**在 macOS 候选之后 —— Windows
* 上没有 `/Applications` 目录，不追加的话 find 永远落空，国际版积分/签到就会
* 因为「取不到设备身份」而读不到。
*
* 这张表只认**默认**安装位置；装在别处的由 {@link resolveDeviceRiskComponent}
* 追加查卸载登记表，见其注释。
*/
const UMID_CANDIDATES = {
	cn: ["/Applications/Qoder CN.app/Contents/Resources/umid/runtime-info", "/Applications/Qoder.app/Contents/Resources/umid/runtime-info"],
	global: ["/Applications/Qoder.app/Contents/Resources/umid/runtime-info", "/Applications/Qoder CN.app/Contents/Resources/umid/runtime-info"]
};
/**
* 某个 Qoder 安装目录下的 UMID 组件路径。
*
* 手写拼接而不是复用 `node:path` 的 `join`：注册表里的安装目录是 **Windows** 路径
* （`D:\…\Qoder`），而本模块的用例跑在 ubuntu 与 windows 两个 CI job 上 —— POSIX 的
* `join` 会把 `D:\…\Qoder` 当成一个普通文件名，拼出 `D:\…\Qoder/resources/umid/…`
* 这种半截路径，于是「解析出来的候选」本身就没法跨平台断言。这里按目录里实际出现的
* 分隔符拼接，把「解析」与「宿主平台」解耦。
*/
function windowsUmidPath(installDir) {
	const trimmed = installDir.replace(/[\\/]+$/u, "");
	const separator = trimmed.includes("\\") ? "\\" : "/";
	return [
		trimmed,
		"resources",
		"umid",
		"runtime-info.exe"
	].join(separator);
}
/**
* Windows 上 Qoder 客户端的 UMID 组件位置（`%LOCALAPPDATA%\Programs\<App>\resources\
* umid\runtime-info.exe`），区域 → App 的优先级与 macOS 候选一致。
*
* `%LOCALAPPDATA%` 可能未定义（无窗口会话 / CI），此时返回空数组 —— 调用方照常
* 走「macOS 候选 + 环境变量」的既有路径，不报错。
*
* 这里展开的是**默认**安装位置。安装器允许改目录，改过之后这条路径整族落空 ——
* 那种机器由 {@link findInWindowsUninstallRegistry} 兜底：向系统问「Qoder 装在哪」，
* 而不是假定它装在哪。
*/
function windowsUmidCandidates(region) {
	const local = process.env.LOCALAPPDATA;
	if (!local) return [];
	const pathOf = (app) => windowsUmidPath(join(local, "Programs", app));
	return region === "cn" ? [pathOf("Qoder CN"), pathOf("Qoder")] : [pathOf("Qoder"), pathOf("Qoder CN")];
}
/** 允许用户显式指定组件路径（参考实现的 `QODER_UMID_PATH` 同规）。 */
const UMID_PATH_ENV = "QODER_UMID_PATH";
const cache = {};
/**
* 找本机可用的 UMID 组件 —— **同步快速路径**（不起任何进程）。
*
* 覆盖：显式指定的路径、macOS App 内的组件、Windows 的**默认**安装位置。Windows 上装在
* 别处的情况不在这里 —— 那要起一个 `reg.exe` 去问卸载登记表，代价与这里不同类，所以
* 单独放在 {@link resolveDeviceRiskComponent} 里。要「找得到就一定能用」的调用方调那个；
* 这个函数只回答「不用起进程就能确定的那部分」。
*
* @returns 组件绝对路径；快速路径没命中时 undefined（**不代表本机没有**）。
*/
function findDeviceRiskComponent(region) {
	const custom = process.env[UMID_PATH_ENV];
	if (typeof custom === "string" && custom !== "" && existsSync(custom)) return custom;
	for (const candidate of [...UMID_CANDIDATES[region], ...windowsUmidCandidates(region)]) if (existsSync(candidate)) return candidate;
}
/**
* Windows 卸载登记表的三个根，按查询优先级排列：当前用户 → 本机 64 位 → 本机 32 位。
*
* Qoder 的安装器是 per-user 安装（`UninstallString` 结尾带 `/currentuser`），实测登记项落在
* HKCU —— 所以它排第一，命中即停，省掉后面两次查询。后两个根是给「装给所有用户」的形态
* 留的，不是摆设。
*/
const WINDOWS_UNINSTALL_ROOTS = [
	String.raw`HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall`,
	String.raw`HKLM\Software\Microsoft\Windows\CurrentVersion\Uninstall`,
	String.raw`HKLM\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall`
];
/**
* 卸载登记表里 Qoder 系产品的 `DisplayName` → 区域。
*
* **顺序即优先级**：`Qoder CN 0.4.9` 同时满足下面两条（`^Qoder\b` 在空格处也算词边界），
* 所以 CN 必须排在前面 —— 设备身份与区域绑定，把国内版认成国际版会被风控拒绝。
*
* 认不出区域的一律**跳过**（而不是猜一侧）：没有 DisplayName、或名字不叫 Qoder 系产品时，
* 宁可当作「这一条没给出东西」。
*/
const WINDOWS_DISPLAY_NAME_REGIONS = [[/^Qoder\s*CN\b/iu, "cn"], [/^Qoder\b/iu, "global"]];
/** `reg query` 输出里的一行值：`    DisplayName    REG_SZ    Qoder 0.4.9`。 */
const REG_VALUE_LINE = /^\s+(.+?)\s+REG_SZ\s+(.*)$/u;
/**
* `reg.exe` 查询的 spawn 选项。
*
* `windowsHide` 与 {@link RISK_PROCESS_OPTIONS} 同因（见其注释：GUI 宿主 spawn 控制台子程序
* 会闪黑窗）；超时取得比组件本身短 —— 读注册表是本地操作，25s 是给组件留的余量，不该照抄。
*/
const REG_QUERY_OPTIONS = {
	timeout: 1e4,
	maxBuffer: MAX_OUTPUT_BYTES,
	windowsHide: true
};
/**
* 从卸载登记表的值里还原出**安装目录**。
*
* 三种实测形态都要认：
*
* - `"D:\…\Qoder\Uninstall Qoder.exe" /currentuser` —— 带引号且尾巴上有参数（Qoder 的
*   `UninstallString` 就是这种）。**必须先看引号**：卸载器名字里自带空格
*   （`Uninstall Qoder.exe`），按空白切会切在名字中间。
* - `D:\…\Qoder\uninstallerIcon.ico` —— `DisplayIcon` 那种裸路径。
* - `D:\…\Qoder.exe /S` —— 没引号但带参数，截到 `.exe` 为止。
*
* 只认「盘符 + 分隔符」或 UNC 开头的绝对路径：相对路径与残缺值不该变成候选，否则
* `existsSync` 会在当前工作目录下瞎撞，把「没找到」伪装成「找到了」。
*/
function windowsInstallDirOf(value) {
	const text = value.trim();
	if (text === "") return void 0;
	const quoted = /^"(?<path>[^"]+)"/u.exec(text)?.groups?.path;
	const executable = /^.+?\.exe\b/iu.exec(text)?.[0];
	const file = (quoted ?? executable ?? text).trim();
	const cut = Math.max(file.lastIndexOf("\\"), file.lastIndexOf("/"));
	if (cut <= 0) return void 0;
	const dir = file.slice(0, cut);
	return /^(?:[A-Za-z]:[\\/]|\\\\)/u.test(dir) ? dir : void 0;
}
/**
* 把 `reg query … /s /f Qoder /t REG_SZ` 的输出解析成**该区域**的安装目录，按登记顺序。
*
* 纯函数：不碰注册表、不碰文件系统。查询那一侧在 CI 上没东西可查（runner 上没装 Qoder），
* 只有把「解析」与「查询」分开，才能把真实输出固化成用例 —— 而这个 bug 的本质，恰恰是
* 解析侧漏掉了一种安装位置，不是查询侧拿不到数据。
*/
function parseWindowsUninstallDirs(output, region) {
	const dirs = [];
	let displayName = "";
	let uninstallString = "";
	let displayIcon = "";
	/** 结算一条登记项：名字认得出区域、且能取出安装目录时才算数。 */
	const settle = () => {
		if (WINDOWS_DISPLAY_NAME_REGIONS.find(([pattern]) => pattern.test(displayName))?.[1] === region) {
			const dir = windowsInstallDirOf(uninstallString) ?? windowsInstallDirOf(displayIcon);
			if (dir !== void 0 && !dirs.includes(dir)) dirs.push(dir);
		}
		displayName = "";
		uninstallString = "";
		displayIcon = "";
	};
	for (const line of output.split(/\r?\n/u)) {
		if (line.startsWith("HKEY_")) {
			settle();
			continue;
		}
		const value = REG_VALUE_LINE.exec(line);
		if (value === null) continue;
		const name = value[1].trim().toLowerCase();
		if (name === "displayname") displayName = value[2].trim();
		else if (name === "uninstallstring") uninstallString = value[2].trim();
		else if (name === "displayicon") displayIcon = value[2].trim();
	}
	settle();
	return dirs;
}
/**
* `reg.exe` 的绝对路径。
*
* 不靠 PATH：宿主是 Electron GUI 进程，PATH 来自用户环境（被裁剪过的环境里 `reg.exe` 找不到）。
* `%SystemRoot%\System32\reg.exe` 在任何 Windows 上都存在；`%SystemRoot%` 缺失这种极端情况
* 退回裸名字，由 PATH 兜底。
*/
function windowsRegExe() {
	const root = process.env.SystemRoot;
	return root === void 0 || root === "" ? "reg.exe" : join(root, "System32", "reg.exe");
}
/**
* 向 Windows 卸载登记表问「Qoder 装在哪儿」，返回该区域**确实存在**的组件路径。
*
* 为什么需要它：`%LOCALAPPDATA%\Programs\<App>` 只是默认值，安装器允许改目录 —— 实测一台
* 机器上 Qoder 装在 `D:\Users\<user>\AppData\Local\Programs\Qoder`，登记表里写得清清楚楚，
* 而候选表整族落空，于是国际版签到只剩「未找到设备风控组件」一条路。
*
* 三个根依次查、命中即停。任何一步失败（`reg.exe` 不在、项读不到、超时、没有匹配项）都
* **静默跳过**：找不到组件时该由调用方给出那条统一、可操作的报错；在这里抛只会把
* 「不知道装在哪」和「读不出来」混成同一句话。
*/
async function findInWindowsUninstallRegistry(region) {
	for (const root of WINDOWS_UNINSTALL_ROOTS) {
		let stdout;
		try {
			stdout = (await run(windowsRegExe(), [
				"query",
				root,
				"/s",
				"/f",
				"Qoder",
				"/t",
				"REG_SZ"
			], REG_QUERY_OPTIONS)).stdout;
		} catch {
			continue;
		}
		for (const dir of parseWindowsUninstallDirs(stdout, region)) {
			const candidate = windowsUmidPath(dir);
			if (existsSync(candidate)) return candidate;
		}
	}
}
/**
* 找本机可用的 UMID 组件 —— **完整探测**。
*
* 分两层是因为代价不同类：{@link findDeviceRiskComponent} 是几次 `existsSync`（同步、不起进程），
* 注册表那层要起一个 `reg.exe`。第一层命中就不付第二层的钱；第一层落空、且确实在 Windows 上
* 时，才去问系统 Qoder 装在哪儿。
*
* 非 Windows 不查注册表：macOS 那边安装位置就是固定的 `/Applications`，第一层已经覆盖完了。
*
* @returns 组件绝对路径；两层都没有时 undefined（调用方据此如实降级）。
*/
async function resolveDeviceRiskComponent(region, probeRegistry = findInWindowsUninstallRegistry) {
	const found = findDeviceRiskComponent(region);
	if (found !== void 0) return found;
	if (process.platform !== "win32") return void 0;
	return probeRegistry(region);
}
/**
* 读取设备风控身份。
*
* 组件把 JSON 打在第一行 stdout。任何一步不符合预期（找不到组件、超时、输出不是
* JSON、字段缺失或过长）都**抛错**而不是返回半个对象 —— 半个身份发上去只会被风控
* 当成伪造，反而更难诊断。
*
* 结果按 {@link RISK_TTL_MS} 在进程内缓存。
*/
async function readDeviceRisk(region, nowMs = Date.now()) {
	const hit = cache[region];
	if (hit !== void 0 && nowMs - hit.atMs < 3e6) return hit.risk;
	const component = await resolveDeviceRiskComponent(region);
	if (component === void 0) throw new Error(`未找到 Qoder 设备风控组件（umid/runtime-info）。国际版签到需要它：请安装 Qoder 客户端，或用 ${UMID_PATH_ENV} 指定组件路径`);
	let stdout;
	try {
		stdout = (await run(component, [], RISK_PROCESS_OPTIONS)).stdout;
	} catch (error) {
		throw new Error(`设备风控组件执行失败: ${String(error?.message ?? error)}`);
	}
	const firstLine = stdout.split("\n").map((line) => line.trim()).find((line) => line !== "") ?? "";
	let parsed;
	try {
		parsed = JSON.parse(firstLine);
	} catch {
		throw new Error(`设备风控组件输出不是 JSON: ${firstLine.slice(0, 120)}`);
	}
	if (parsed === null || typeof parsed !== "object") throw new Error("设备风控组件输出不是对象");
	const record = parsed;
	const pick = (key) => {
		const value = record[key];
		if (typeof value !== "string" || value.trim() === "" || value.length > 4096) throw new Error(`设备风控组件输出缺少 ${key}`);
		return value.trim();
	};
	const risk = {
		machineToken: pick("machineToken"),
		machineCode: pick("machineCode"),
		machineType: pick("machineType")
	};
	cache[region] = {
		risk,
		atMs: nowMs
	};
	return risk;
}
//#endregion
//#region src/status-paths.ts
/** Plugin-owned usage endpoint consumed by its browser half. */
const QODER_USAGE_PATH = "/plugins/dsh-connect-qoder/usage";
/**
* Plugin-owned campaign feed endpoint for one region.
*
* Answers the card's activity area: the daily 100-Credits check-in row plus every
* `VIEW_DETAILS` banner upstream currently serves (集结 / 首月翻倍 / …), each with
* its title, description and detail link. Read-only and lazy like the credits
* endpoint — the activities live next to the usage readout and are only worth one
* upstream read while the panel is open.
*/
const QODER_CAMPAIGNS_PATH = "/plugins/dsh-connect-qoder/campaigns";
/**
* Per-account credit balances for one region, read ONLY while the composer
* panel is open.
*
* Separate from {@link QODER_USAGE_PATH} because its cost is different in
* kind: the usage document is one upstream read for the selected account,
* while this is one read PER account in the region. Folding it into the usage
* route would make every 5-minute refresh pay for a table nobody is looking
* at, so it is fetched on demand instead — the same principle the pool
* applies to its per-account figures.
*/
const QODER_ACCOUNT_CREDITS_PATH = "/plugins/dsh-connect-qoder/account-credits";
/**
* The project's public repository.
*
* Lives here rather than beside one component because TWO sections link to it
* — the model section and the account pool — and a second copy of a URL is a
* second thing to forget when it moves. Node-free and side-effect free, so it
* costs nothing on the Host side either.
*/
const QODER_GITHUB_URL = "https://github.com/dingminhua/dsh-connect-qoder";
/** Plugin-owned live model refresh endpoint. */
const QODER_MODELS_REFRESH_PATH = "/plugins/dsh-connect-qoder/models/refresh";
/** Plugin-owned account rescan endpoint (re-reads settings / env / vault). */
const QODER_ACCOUNTS_REFRESH_PATH = "/plugins/dsh-connect-qoder/accounts/refresh";
/**
* Plugin-owned account mutation endpoint: add or remove one account.
*
* `?action=add` POSTs `{ pat, name? }`: the Host validates the PAT against
* the region's gateway (a jobToken exchange doubles as the cheapest
* authenticated check and yields the account's display name) and stores it in
* the plugin-owned vault. `?action=remove` POSTs `{ accountId }` and deletes
* the vault entry. POST + loopback-only: both carry token material or mutate
* stored credentials.
*/
const QODER_ACCOUNTS_PATH = "/plugins/dsh-connect-qoder/accounts";
/**
* Plugin-owned model probe endpoint.
*
* Sends one minimal chat request per named model so the card can answer "is
* this model usable right now, and if it is limited, when can it be used
* again?". Lives on the Host because the credential must never reach the
* browser half.
*/
const QODER_PROBE_PATH = "/plugins/dsh-connect-qoder/probe";
/**
* Plugin-owned account-pool endpoint: one batch action per call.
*
* `?action=test` probes every checked account against the region's target
* model; `?action=remove` drops one account's membership. Both are POST and
* loopback-only because a probe spends credits and removal mutates a
* preference.
*
* Deliberately ONE endpoint rather than two: the actions share every guard
* (method, origin, region) and differ only in the work, so splitting them
* would duplicate the guards and invite them to drift apart.
*/
const QODER_POOL_PATH = "/plugins/dsh-connect-qoder/pool";
/**
* Plugin-owned account transfer endpoint: the batch export / import of PAT
* credentials between machines.
*
* `?action=export` POSTs account ids, answers a JSON ARRAY of credential
* records; `?action=preview` POSTs file text, answers a token-free listing;
* `?action=import` POSTs file text plus selected indexes, merges into the
* vault. POST + loopback-only like every other mutation: the file content is
* arbitrary user data and export carries token material.
*/
const QODER_TRANSFER_PATH = "/plugins/dsh-connect-qoder/transfer";
/**
* Plugin-owned settings write fallback: the card's writes go through the
* settings mirror when it is healthy, and through this Host-side endpoint
* when the mirror refuses or lags (a measured 0.1.7 behaviour the sibling
* plugin hit: `settings/mutate` from the browser can leave the mirror stale
* while the Host accepted the write).
*/
const QODER_SAVE_PATH = "/plugins/dsh-connect-qoder/__save";
/** Query parameter naming the region a card request addresses. */
const QODER_REGION_PARAM = "region";
/** Every region, in card tab order. */
const QODER_REGIONS$1 = ["cn", "global"];
/**
* Query parameter selecting HOW MUCH of the usage document a request wants.
*
* Absent means the full document — every caller written before this parameter
* existed keeps getting exactly what it used to, which is why the default is
* `full` rather than an opt-in flag.
*/
const QODER_DETAIL_PARAM = "detail";
/**
* The one non-default detail level: a first-paint document built from LOCAL
* state only.
*
* The card's first paint used to wait for the full document, whose tail
* includes one live upstream read for the selected account's credits plus one
* per pool member. Each of those can stall for seconds, and the card rendered
* nothing about accounts until all of them came back — the complaint this
* exists to fix (同一族插件的 issue #77，见 dsh-connect-workbuddy)。
*
* A `fast` document answers from what the Host already knows: the stored
* credential (no token refresh), the cached credit reading, the pool's saved
* member list and the check-in state measured this process. It never performs
* an upstream read, so it cannot be held by a slow upstream.
*/
const QODER_DETAIL_FAST = "fast";
/**
* Does this request URL ask for the first-paint document?
*
* Only the exact value `fast` counts. Anything else — a typo, a future level
* this build does not know, an empty value — degrades to the FULL document.
* That direction is deliberate: a typo must cost a slow paint, never an
* emptier panel that looks like data loss.
*/
function fastDetailOf(url) {
	const at = url.indexOf("?");
	if (at === -1) return false;
	return new URLSearchParams(url.slice(at + 1)).get(QODER_DETAIL_PARAM) === QODER_DETAIL_FAST;
}
/**
* Read the region parameter off a status-route URL. Absent means the domestic
* tab (`cn`); a present-but-unknown value returns undefined so the route can
* answer 400 instead of guessing.
*/
function regionOfStatusUrl(url) {
	const at = url.indexOf("?");
	const value = at === -1 ? null : new URLSearchParams(url.slice(at + 1)).get(QODER_REGION_PARAM);
	if (value === null || value === "") return "cn";
	return QODER_REGIONS$1.includes(value) ? value : void 0;
}
/** Query parameter selecting which action a request means. */
const QODER_ACTION_PARAM = "action";
/** Read the pool action off a request URL; unknown/absent means undefined. */
function poolActionOf(url) {
	const value = actionParamOf(url);
	if (value === "checkin" || value === "test" || value === "remove" || value === "progress") return value;
}
/** Read the account action off a request URL; unknown/absent means undefined. */
function accountActionOf(url) {
	const value = actionParamOf(url);
	return value === "add" || value === "remove" ? value : void 0;
}
/** Read the transfer action off a request URL; unknown/absent means undefined. */
function transferActionOf(url) {
	const value = actionParamOf(url);
	return value === "export" || value === "preview" || value === "import" ? value : void 0;
}
/** Read the shared action parameter; unknown/absent means undefined. */
function actionParamOf(url) {
	const at = url.indexOf("?");
	if (at === -1) return void 0;
	const value = new URLSearchParams(url.slice(at + 1)).get(QODER_ACTION_PARAM);
	return value === null || value === "" ? void 0 : value;
}
/** Query parameter naming ONE pool account a per-row request addresses. */
const QODER_POOL_ACCOUNT_PARAM = "accountId";
/** Read the per-row account id off a request URL, when the action takes one. */
function poolAccountIdOf(url) {
	const at = url.indexOf("?");
	if (at === -1) return void 0;
	const value = new URLSearchParams(url.slice(at + 1)).get(QODER_POOL_ACCOUNT_PARAM);
	return value !== null && value !== "" ? value : void 0;
}
/** All region keys, in display order. The single source for region loops. */
const QODER_WEB_REGIONS = ["cn", "global"];
/** Every domain {@link knownQoderRegionOfDomain} admits, i.e. the transfer domains. */
const TRANSFER_DOMAINS = ["qoder.com.cn", "qoder.sh"];
/**
* The login domain a transfer record must carry to belong to a region.
*
* Qoder has two gateways with distinct hosts, so a transferred PAT identifies
* its region by the host it was minted against — `qoder.com.cn` is the CN
* gateway's domain, `qoder.sh` the international one.
*/
function knownQoderRegionOfDomain(domain) {
	if (domain === "qoder.com.cn") return "cn";
	if (domain === "qoder.sh") return "global";
}
/**
* 该区域的**传输域名**：导出账号时写进 transfer 文件的 `domain` 字段。
*
* 与 {@link knownQoderRegionOfDomain}（域名 → 区域）是同一组事实的**反向读法**，
* 所以在这里定义、并从那张反查表**推导**出来，而不是再手抄一遍域名 —— 手抄才是
* 这两处漂移过一次就很难被发现的原因。推导失败即抛错，让漏登记的区域在编译期
* 与首屏就暴露，而不是等到用户导出才发现。
*
* 注意这与 {@link QODER_CONSOLE_DOMAIN} **不是同一个域名**：那边是用户浏览器里
* 申请 PAT 的控制台（国际版是 `qoder.com`），这边是 PAT 实际发证方所在的网关域
* （国际版是 `qoder.sh`），导入时的区域门只认后者。
*/
const QODER_REGION_TRANSFER_DOMAIN = (() => {
	const table = {};
	for (const region of QODER_WEB_REGIONS) table[region] = "";
	for (const domain of TRANSFER_DOMAINS) {
		const region = knownQoderRegionOfDomain(domain);
		if (region === void 0) throw new Error(`transfer domain is not a known Qoder region: ${domain}`);
		table[region] = domain;
	}
	for (const region of QODER_WEB_REGIONS) if (table[region] === "") throw new Error(`region has no transfer domain: ${region}`);
	return table;
})();
/**
* 该区域请求实际打到的**网关主机名**（不含协议），只用于诊断展示。
*
* 为什么要有这一行：卡片的「诊断」栏要如实回答「这次请求打到哪个域名」，而这句话
* 必须与 `QODER_REGIONS[region].gateway` **同一个事实**。此前卡片只有
* {@link QODER_CONSOLE_DOMAIN}（用户浏览器里申请 PAT 的控制台），两者在区域之间
* 恰好是相反的形状（控制台是 `qoder.com`，网关却是 `api1.qoder.sh`）—— 拿控制台
* 域名去回答诊断问题会给出一个**看起来对、实际不是请求目标**的答案。所以这张表
* 放在这里，并由 `upstream.ts` 的 `QODER_REGIONS` **直接消费**（见那里的
* `gateway` 字段），不手抄第二遍：两处域名漂移过一次就很难被发现。
*/
const QODER_UPSTREAM_DOMAIN = {
	cn: "gateway.qoder.com.cn",
	global: "api1.qoder.sh"
};
/**
* Deep copy of a settings value with every `{get(): T}` live reference
* replaced by the value it resolves to.
*
* `regions` is declared `asVolatile(...)`, and schemastery resolves a volatile
* field to a live reference. A live reference is still `typeof === 'object'`,
* so `{ ...reference }` does NOT read the field: it produces
* `{ get: <function> }`. Any caller that spreads the resolved field to
* preserve its siblings would otherwise DROP every sibling and leak a
* function into the document. Both halves therefore unwrap before touching a
* resolved field.
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
* The plugin's DECLARED settings namespace — the fallback name, not the value
* the host necessarily serves.
*
* On 0.1.7 the settings service keys every form by the plugin's Loader entry
* id (`describe()` returns `ns: entry.options.id`), and the harness resolves
* a provider's namespace by EXACT match. The entry id is chosen by the
* profile patch (`cordis.patch.yml`), so the declared id mirrors it.
*/
const QODER_SETTINGS_NS = "dsh-connect-qoder";
//#endregion
//#region src/native-modality.ts
/**
* 已核对的分类，按**精确 model id**（绝不用前缀匹配）键控。
* 不在本表中的 id 一律 `unknown` —— 见 {@link nativeModalityOf}。
*
* 主键是 Qoder 的**内部短 id**（稳定），厂商显示名作别名（见文件头
* 「为什么按短 id 键控」）。两个键指向同一结论，`imageDefaultFor` 会依次试。
*/
const NATIVE_MODALITY_BY_MODEL_ID = {
	"qmodel_38max": "multimodal",
	"qfmodel": "multimodal",
	"dmodel": "multimodal",
	"dfmodel": "multimodal",
	"gmodel": "multimodal",
	"gfmodel": "multimodal",
	"kmodel_latest": "multimodal",
	"kmodel": "multimodal",
	"mmodel": "multimodal",
	"fast": "multimodal",
	"ultimate": "multimodal",
	"efficient": "multimodal",
	"smodel": "multimodal",
	"cmodel": "multimodal",
	"qwen3.8-max": "multimodal",
	"qwen3.8-flash": "multimodal",
	"deepseek-v4-pro": "multimodal",
	"deepseek-flash": "multimodal",
	"glm-5.3": "multimodal",
	"glm-5.3-flash": "multimodal",
	"kimi-k3.1-pro": "multimodal",
	"kimi-k2.8-preview": "multimodal",
	"minimax-m3.1-flash": "multimodal",
	"sonus": "multimodal",
	"cantus": "multimodal",
	"kimi-k2.7-code": "multimodal",
	"qwen3.7-max": "multimodal",
	"qwen3.8-max-preview": "multimodal",
	"qwen3.7-plus": "multimodal",
	"qwen3.6-flash": "multimodal",
	"gm51model": "multimodal",
	"glm-5.2": "multimodal",
	"minimax-m2.7": "multimodal"
};
/**
* 上游的**路由器**（router），不是模型。
*
* `auto` 是一个「挑模型的入口」：网关在**请求时**才决定把它解析成哪一个模型。
* 所以它的上下文窗口、思考档位与计费对象都由别人临时决定，插件无法如实描述
* ——本仓库保存下来的真实目录里，`auto` 正是**唯一没有思考档位**、却带着
* `isDefault: true` 的那一行。把它列成一个可勾选的模型，用户勾的是一个「未知
* 会变成谁」的条目。
*
* **用显式表而不是名字启发式**：路由是上游的概念，没有声明字段可查；按名字
* 猜（比如「叫 auto 的都丢」）迟早会误伤一个真的叫这个名字的模型。要往这里
* 加 id，先拿到与 `auto` 同等强度的证据。
*
* 参考：dingminhua/dsh-connect-workbuddy（MIT，Copyright (c) 2026 LaoDing）的
* `ROUTER_MODEL_IDS` / `isRouterModelId`——那边同样用显式表而非启发式。
*/
const ROUTER_MODEL_IDS = /* @__PURE__ */ new Set(["auto"]);
/** 这个 id 是不是上游路由器（而不是模型）。 */
function isRouterModelId(modelId) {
	return ROUTER_MODEL_IDS.has(normalizeModelId(modelId));
}
/**
* 一次模型刷新是否应当**预勾选**该模型的图片开关。
*
* 只有表里确认 `multimodal` 的会被预勾选。`text` 已写明不能读图，而
* `unknown` 是刻意留空而非猜测——这张表存在的全部理由就是平台标记猜错过。
* 平台的 `supportsImages: false` 仍然拥有一票否决权，所以一个表里 multimodal
* 的 id 也不会在平台明确说「不支持」时被预勾选。
*
* 用户始终可以手动勾选；这里只决定**默认值**，运行时生效的仍是用户保存的
* `imageModelKeys` 之类的持久选择。
*
* **`name` 是必须传的第二个候选键**（issue #22 的根因）。表的主键是 Qoder 内部
* 短 id（`qmodel_38max`），但旧存档、外部选择器与旧表都以**厂商显示名**
* （`Qwen3.8-Max`）称呼同一个模型。调用方此前只传 `key`，两边结构上不可能
* 相等 ⇒ 每一次 seed 查表都落到 `undefined` ⇒ 整张表是死代码。传两个候选键
* 就是把这张表真正接上线。
*
* 仍然是**精确**匹配、不做模糊匹配：短 id 与显示名各查一次同样的表，查不到
* 就是 unknown。**不**从同族前缀继承（`qwen3.9-max` 不会因为 `qwen3.8-max`
* 是 multimodal 而被勾上）。
*/
function imageDefaultFor(info) {
	if (info.supportsImages === false) return false;
	if (NATIVE_MODALITY_BY_MODEL_ID[normalizeModelId(info.id)] === "multimodal") return true;
	if (info.name === void 0 || info.name === "") return false;
	return NATIVE_MODALITY_BY_MODEL_ID[normalizeModelId(info.name).replace(/\s+/gu, "-")] === "multimodal";
}
/**
* 把 Qoder 的内部短 id（`qmodel_latest` 等）或显示名归一到本表键。
*
* 内置目录里 `key` 是短 id、`displayName` 是厂商模型名，两处都可能被当成
* 「模型 id」传进来；先按原样查表，查不到再用显示名的小写连字符形式兜底。
* 仍然查不到就是 unknown——兜底只是多给一次**精确**匹配机会，绝不做模糊匹配。
*/
function normalizeModelId(modelId) {
	return modelId.trim().toLowerCase();
}
//#endregion
//#region src/upstream.ts
/**
* Qoder 上游 HTTP 客户端：cosy 签名请求、jobToken 交换、聊天 SSE、
* 模型目录与用量查询。
*
* 端点映射（CN 与 Global 双区域）。两区域**各自一个网关主机**，chat / models /
* jobToken 三个端点共用它（见 `QODER_REGIONS` 的 `gateway` 字段）：
*
* ```text
* CN     gateway: gateway.qoder.com.cn
*        chat:     /algo/api/v2/service/pro/sse/agent_chat_generation
*        models:   /algo/api/v2/model/list
*        jobToken: /algo/api/v3/user/jobToken
*        openapi:  openapi.qoder.com.cn
* Global gateway: api1.qoder.sh
*        chat:     /algo/api/v2/service/pro/sse/agent_chat_generation
*        models:   /algo/api/v2/model/list
*        jobToken: /algo/api/v3/user/jobToken
*        openapi:  openapi.qoder.sh
* ```
*
* 注：早期注释称国际版的 models 走 `api2.qoder.sh`、jobToken 走
* `center.qoder.sh`。实测（2026-10）三者对本插件用到的端点**完全等效**——
* 对同一个假 PAT 都回 `401 personal token is invalid`（凭据层被拒，而非
* `Signature invalid`），说明三者都接受同一套 cosy 签名、只是拒绝坏凭据。
* 所以国际版统一用 `api1.qoder.sh`，不按端点分主机；若将来真要分流，请改
* `QODER_REGIONS` 的配置表，而不是只改这段注释。
*
* @module dsh-connect-qoder/upstream
*/
const CHAT_PATH = "/algo/api/v2/service/pro/sse/agent_chat_generation?FetchKeys=llm_model_result&AgentId=agent_common&Encode=1";
/**
* 每日签到走 `sash` 的**活动**接口。路径里没有「签到」二字（叫 campaigns），
* 所以照着 checkin / signin / reward 猜永远猜不到——实测猜了 13 个全 404。
* 注意是 **v1**（用量那套是 v2）。
*/
const CAMPAIGNS_PATH = "/sash/api/v1/me/campaigns";
/**
* sash 面专用的令牌交换端点（CLI / 网页那一族）。
*
* 与 {@link JOB_TOKEN_PATH}（桌面客户端那一族）**并存**，不是替代 —— 实测国际版
* 的 chat 面只认前者换来的 `securityOauthToken`，而 sash / 额度面只认这里换来的
* `token`；国内版两族等价。见 `QoderSessionHolder.sashToken`。
*/
const SASH_TOKEN_PATH = "/api/v1/jobToken/exchange";
const CAMPAIGNS_QUERY = "?forceRefresh=true";
/** sash 接口要求的客户端标识（参考实现如此，缺了会被拒）。 */
const SASH_CLIENT_TYPE = "10";
const SASH_USER_AGENT = "Qoder";
/**
* **cosy 面**（chat + models）的客户端身份：`cosy-clienttype` 与 `cosy-version`。
*
* 上游按这两个头决定下发哪一套模型目录。旧值 `5` / `0.1.43` 是 2026-10-11 写下
* 时正确的身份，那时上游还没有 Sonus/Cantus/Fast；上游后来把新模型只发给新
* 协议，于是旧身份拿到的是**静默的旧目录**——目录照常返回、对话照常能跑，只是
* 少几个模型，没有任何报错指向这里（issue #21）。
*
* 实测（2026-10-29，两个区域各一枚真实 PAT，只读目录 + 一次对话）：
*
* | 区域   | `5` / `0.1.43` | `10` / `1.1.69`        |
* | ------ | -------------- | ---------------------- |
* | cn     | 9 条           | 10 条（+`fast`）       |
* | global | 11 条          | 14 条（+`smodel`/`cmodel`/`fast`） |
*
* 两个值必须**成对**改：国内版只把 clienttype 提到 `10`、version 留在 `0.1.43`
* 时，目录仍只有 9 条（拿不到 `fast`），而 chat 直接报
* `HTTP 403 code 112`（「协议半改」的坏状态）。成对改之后 chat 两个区域都正常
* 吐字，`qfmodel` / `dfmodel` 与新增的 `fast` / `smodel` 都实测通过。
*
* 与 sash 面**无关**：`sashRequest` / `fetchUsageDirect` / `jobTokenGet` 是逐条
* 手写请求头，没有展开 {@link DEFAULT_HEADERS}，所以这条改动碰不到签到与用量
* （实测改完两个区域的用量与活动列表照常 200）。
*
* `COSY_VERSION`（`src/cosy.ts`，进 bearer **载荷**的那个）刻意**不**跟着改：
* 它只参与签名与身份声明，实测在头为 `10` / `1.1.69` 时保持 `0.1.43` 两个区域
* 的目录、对话、用量、活动全部正常。改它是另一件事，没有收益，不做。
*/
const COSY_CLIENT_TYPE = "10";
const COSY_VERSION_HEADER = "1.1.69";
const QODER_REGIONS = {
	cn: {
		gateway: `https://${QODER_UPSTREAM_DOMAIN.cn}`,
		openapi: "https://openapi.qoder.com.cn",
		chatPath: CHAT_PATH,
		modelsPath: "/algo/api/v2/model/list?Encode=1",
		jobTokenPath: "/algo/api/v3/user/jobToken?Encode=1",
		campaignsPath: CAMPAIGNS_PATH,
		requiresDeviceRisk: false
	},
	global: {
		gateway: `https://${QODER_UPSTREAM_DOMAIN.global}`,
		openapi: "https://openapi.qoder.sh",
		chatPath: CHAT_PATH,
		modelsPath: "/algo/api/v2/model/list?Encode=1",
		jobTokenPath: "/algo/api/v3/user/jobToken?Encode=1",
		campaignsPath: CAMPAIGNS_PATH,
		requiresDeviceRisk: true
	}
};
var QoderUpstreamError = class extends Error {
	kind;
	status;
	code;
	/**
	* 上游**自己申报**的「请等这么久再试」，毫秒（issue #24）。
	*
	* 来自 `10605 / RESOURCE_LIMIT` 信封里的 `retryAfterSeconds`（实测形状：
	* `{"isQueued":false,"queueCount":0,"retryAfterSeconds":5,"serviceAvailable":true}`），
	* 或 HTTP `Retry-After` 头。取不到就是 `undefined` —— 「上游没说」与「上游说
	* 等 0 秒」是两件事，抽取层不替它下结论。
	*
	* 这个值的去向有两处，都必须有：①写进给宿主的失败文案（否则用户只看到
	* 「上游报了个 4xx」，看不到「上游只要求等 5 秒」）；②非流式失败响应上的
	* `Retry-After` 头。宿主在 pi-ai 那条路由上**只从文案分类**，不读头，所以
	* ①是唯一能让「申报值」影响等待的一条。
	*/
	retryAfterMs;
	/**
	* 上游说「我在排队」的证据（issue #26）。
	*
	* 与 {@link retryAfterMs} 分开是因为它们是**两件事**：`retryAfterMs` 说
	* 「等多久再来」，`queue` 说「你现在排在第几位、服务本身是好的」。前者决定
	* 冷却多长，后者决定**怎么跟用户说** —— 把排队说成「连不上上游」是错的
	* （用户实拍：账号完全正常，六个模型同时可用）。
	*/
	queue;
	constructor(kind, message, status = 0, code, retryAfterMs, queue) {
		super(message);
		this.name = "QoderUpstreamError";
		this.kind = kind;
		this.status = status;
		this.code = code;
		if (retryAfterMs !== void 0 && Number.isFinite(retryAfterMs) && retryAfterMs > 0) this.retryAfterMs = retryAfterMs;
		if (queue !== void 0) this.queue = queue;
	}
};
function isQoderUpstreamError(error) {
	return error instanceof QoderUpstreamError;
}
/**
* cosy 面（chat + models）的公共请求头。
*
* 协议版本见 {@link COSY_CLIENT_TYPE} / {@link COSY_VERSION_HEADER}：这两个值
* 决定上游下发哪套模型目录，改之前先读那段注释（issue #21 的实测表）。
*/
const DEFAULT_HEADERS = {
	"cosy-data-policy": "agree",
	"content-type": "application/json",
	"cosy-clienttype": COSY_CLIENT_TYPE,
	"login-version": "v2",
	"user-agent": "Go-http-client/2.0",
	"cosy-scene": "assistant",
	"cosy-business-product": "ide",
	"cosy-business-type": "agent"
};
/**
* Qoder 上游客户端。每个区域一个实例；会话按需惰性交换与续期。
*/
var QoderUpstreamClient = class {
	region;
	/** 本实例所属区域（`region` 是它的配置表；这里保留区域名本身）。 */
	regionKey;
	logger;
	installSalt;
	fetchImpl;
	/**
	* 按凭证键控的会话缓存。
	*
	* 一个区域实例会同时服务多个账号（账号池批量探测、按账号查额度），
	* 不同 PAT 的 cosy 会话互不相通，所以会话必须按凭证分开缓存——用单个
	* 字段会互相覆盖（上一个账号的会话被下一个冲掉）。键是 PAT 本身：
	* 会话不可再交换，必须绑定到它交换来的那份凭证。
	*/
	holders = /* @__PURE__ */ new Map();
	/** 最近使用的主会话（默认解析路径复用它）。 */
	currentKey;
	constructor(region, options = {}) {
		this.region = QODER_REGIONS[region];
		this.regionKey = region;
		this.logger = options.logger ?? (() => {});
		this.installSalt = options.installSalt;
		this.fetchImpl = options.fetch ?? globalThis.fetch;
	}
	log(message) {
		this.logger(`dsh-connect-qoder: ${message}`);
	}
	/** 某一凭证的会话是否已过期（或即将过期）。 */
	isSessionValid(credential, nowMs = Date.now()) {
		const holder = this.holders.get(credential);
		if (holder === void 0) return false;
		return holder.expireAtMs - nowMs > 3e5;
	}
	/** 最近使用的凭证，沿用直觉意义上「当前账号」的引用。 */
	currentCredential() {
		return this.holders.has(this.currentKey ?? "") ? this.currentKey : void 0;
	}
	/**
	* 用 PAT（`pt-...` 或任意凭证）或 refresh token（`drt-...`）交换 jobToken。
	* 设备指纹以凭证为种子派生（无 uid 可用前），保证稳定。
	*/
	async exchangeJobToken(credential) {
		const fingerprint = deriveFingerprint("", credential, this.installSalt);
		const body = jobTokenBody(credential);
		const date = currentRfc1123Date();
		const sig = signLegacy(date);
		const headers = {
			"cosy-machinetoken": fingerprint.machineToken,
			"cosy-machinetype": fingerprint.machineType,
			"login-version": "v2",
			appcode: "cosy",
			accept: "application/json",
			"accept-encoding": "identity",
			"cosy-version": COSY_VERSION_HEADER,
			"cosy-clienttype": COSY_CLIENT_TYPE,
			date,
			signature: sig,
			"content-type": "application/json",
			"cosy-machineid": fingerprint.machineId,
			"user-agent": "Go-http-client/2.0"
		};
		const url = `${this.region.gateway}${this.region.jobTokenPath}`;
		const resp = await this.fetchImpl(url, {
			method: "POST",
			headers,
			body
		});
		const text = await resp.text();
		if (resp.status !== 200) throw new QoderUpstreamError(classifyFailure(resp.status, text), `jobToken 交换失败: HTTP ${resp.status} ${truncate(text, 200)}`, resp.status, deepestBusinessCode(text));
		let data;
		try {
			data = JSON.parse(text);
		} catch {
			throw new QoderUpstreamError("unknown", `jobToken 响应不是 JSON: ${truncate(text, 200)}`, resp.status);
		}
		const jobToken = {
			id: String(data.id ?? ""),
			name: String(data.name ?? ""),
			expireTime: Number(data.expireTime ?? 0),
			securityOauthToken: String(data.securityOauthToken ?? ""),
			refreshToken: String(data.refreshToken ?? ""),
			userType: String(data.userType ?? "personal_standard")
		};
		if (!jobToken.id && !jobToken.securityOauthToken) throw new QoderUpstreamError("auth", `jobToken 交换响应缺少身份字段: ${truncate(text, 200)}`, resp.status);
		const holder = {
			session: newCosySession({
				name: jobToken.name,
				aid: jobToken.id,
				uid: jobToken.id,
				yx_uid: "",
				organization_id: "",
				organization_name: "",
				user_type: jobToken.userType,
				security_oauth_token: jobToken.securityOauthToken,
				refresh_token: jobToken.refreshToken
			}, fingerprint.machineId, fingerprint.machineToken, fingerprint.machineType),
			fingerprint,
			jobToken,
			expireAtMs: jobToken.expireTime > 0 ? jobToken.expireTime : 0
		};
		await this.refreshSashToken(credential, holder);
		this.holders.set(credential, holder);
		this.currentKey = credential;
		this.log(`jobToken 已交换: ${jobToken.name} (${jobToken.id})`);
		return jobToken;
	}
	/**
	* 换一枚 sash 面专用的令牌（`POST /api/v1/jobToken/exchange`）。
	*
	* **不抛**：这一族换不到时 sash 那一支会回落到旧令牌（国内版本来就够用），
	* 而整条交换失败只该让「积分读不到」，不该让 chat / 对话跟着挂 —— 那是完全
	* 不同的两条链路。
	*
	* body 键是 `personal_token`：实测 `personal_access_token`（eghrhegpe 那个 fork
	* 用的拼写）在当前上游回 **400 BadRequest**，两个区域都是。
	*/
	async refreshSashToken(credential, holder) {
		const url = `${this.region.openapi}${SASH_TOKEN_PATH}`;
		try {
			const resp = await this.fetchImpl(url, {
				method: "POST",
				headers: {
					"content-type": "application/json",
					accept: "application/json"
				},
				body: JSON.stringify({ personal_token: credential })
			});
			const text = await resp.text();
			if (resp.status !== 200) {
				this.log(`sash 令牌交换失败（HTTP ${resp.status}），sash 面将回落到旧令牌: ${truncate(text, 120)}`);
				return;
			}
			const data = parseJson(text);
			const raw = data === void 0 ? {} : data;
			const token = typeof raw["token"] === "string" && raw["token"] !== "" ? raw["token"] : typeof raw["job_token"] === "string" && raw["job_token"] !== "" ? raw["job_token"] : typeof raw["jobToken"] === "string" && raw["jobToken"] !== "" ? raw["jobToken"] : "";
			if (token === "") {
				this.log(`sash 令牌交换响应里没有 token 字段: ${truncate(text, 120)}`);
				return;
			}
			holder.sashToken = token;
			const expiry = typeof raw["expires_at"] === "string" ? Date.parse(raw["expires_at"]) : NaN;
			holder.sashExpireAtMs = Number.isFinite(expiry) ? expiry : 0;
			this.log(`sash 令牌已交换（有效期至 ${holder.sashExpireAtMs > 0 ? new Date(holder.sashExpireAtMs).toISOString() : "未知"}）`);
		} catch (error) {
			this.log(`sash 令牌交换异常，sash 面将回落到旧令牌: ${String(error?.message ?? error).slice(0, 120)}`);
		}
	}
	/**
	* 取该会话用于 **sash 面** 的 Authorization 值。
	*
	* 新令牌优先（国际版必需）；没有就回落到旧的 `securityOauthToken`（国内版
	* 两个面都认它，而且它是 chat 在用的那一个 —— 回落不会破坏任何东西）。
	*
	* 返回 `''` 表示两族都没有：那一支必须报「读不到」，绝不能带上一个空 bearer
	* 去换一个 401 回来（那样分不清是没令牌还是令牌被拒）。
	*/
	sashBearerOf(holder) {
		if (typeof holder.sashToken === "string" && holder.sashToken !== "") return holder.sashToken;
		return holder.jobToken.securityOauthToken;
	}
	/**
	* 确保存在未过期会话。credential 提供 PAT 或 refreshToken（`drt-` 前缀）。
	* 已有有效会话时直接复用（不重复交换）。
	*/
	async ensureSession(credential) {
		if (this.isSessionValid(credential)) return this.holders.get(credential);
		await this.exchangeJobToken(credential);
		return this.holders.get(credential);
	}
	/**
	* 拉取模型目录。响应形状（服务端 snake_case）：
	* `{"chat":[{key, display_name, enable, is_vl, is_default, ...}], ...}`
	*/
	async fetchModels(credential, signal) {
		const holder = await this.ensureSession(credential);
		const url = `${this.region.gateway}${this.region.modelsPath}`;
		const data = await this.bearerGet(holder, url, signal);
		return (Array.isArray(data.chat) ? data.chat : []).map((entry) => {
			if (!entry || typeof entry !== "object") return void 0;
			const raw = entry;
			const key = typeof raw.key === "string" ? raw.key : "";
			const displayName = typeof raw.display_name === "string" ? raw.display_name : "";
			if (!key || !displayName) return void 0;
			return {
				key,
				display_name: displayName,
				enable: raw.enable !== false,
				is_default: raw.is_default === true,
				is_vl: raw.is_vl === true,
				is_reasoning: raw.is_reasoning === true,
				is_free: raw.is_free === true,
				price_factor: typeof raw.price_factor === "number" ? raw.price_factor : void 0,
				max_input_tokens: typeof raw.max_input_tokens === "number" ? raw.max_input_tokens : void 0,
				max_output_tokens: typeof raw.max_output_tokens === "number" ? raw.max_output_tokens : void 0,
				thinking_config: typeof raw.thinking_config === "object" ? raw.thinking_config : void 0,
				context_config: typeof raw.context_config === "object" ? raw.context_config : void 0,
				raw
			};
		}).filter((m) => m !== void 0).filter((model) => !isRouterModelId(model.key));
	}
	/**
	* 聊天 SSE 流。onDelta 逐行回调；返回 null 表示正常结束。
	* 令牌：`credential` 只在会话续期时使用。
	*/
	async chatStream(credential, modelKey, messages, options) {
		const holder = await this.ensureSession(credential);
		const template = deepClone(createChatBodyTemplate());
		applyModelKey(template, modelKey, options.userType ?? holder.jobToken.userType, options.isVl ?? false);
		if (options.isReasoning) {
			template.model_config.is_reasoning = true;
			template.chat_context.extra.modelConfig.is_reasoning = true;
		}
		if (options.reasoningEffort !== void 0 && options.reasoningEffort !== "") {
			template.reasoningEffort = options.reasoningEffort;
			template.parameters = {
				...template.parameters ?? {},
				reasoning_effort: options.reasoningEffort
			};
		}
		const prompt = extractLatestUserPrompt(messages);
		template.messages = buildQoderMessages(messages, prompt, Array.isArray(options.tools) && options.tools.length > 0);
		if (options.tools !== void 0) template.tools = options.tools;
		template.request_id = randomId();
		template.chat_record_id = template.request_id;
		template.request_set_id = randomId();
		template.session_id = randomId();
		template.business.id = randomId();
		template.business.name = prompt.slice(0, 30) || "hi";
		template.business.begin_at = Date.now();
		const body = JSON.stringify(template);
		const url = `${this.region.gateway}${this.region.chatPath}`;
		const pathSig = pathSigFrom(url);
		const encoded = cosyEncode(new TextEncoder().encode(body));
		const date = String(Math.floor(Date.now() / 1e3));
		const payloadB64 = buildPayloadB64(holder.session.info);
		const bearer = composeBearer(payloadB64, signRequest(payloadB64, holder.session.cosyKey, date, encoded, pathSig));
		const headers = {
			...DEFAULT_HEADERS,
			"cosy-machinetype": holder.session.machineType,
			"cosy-date": date,
			"cosy-user": holder.session.identity.uid,
			"cosy-key": holder.session.cosyKey,
			"cache-control": "no-cache",
			accept: "text/event-stream",
			authorization: bearer,
			"cosy-version": COSY_VERSION_HEADER,
			"cosy-machineid": holder.session.machineId,
			"cosy-machinetoken": holder.session.machineToken,
			"x-model-key": modelKey,
			"x-model-source": "system"
		};
		const resp = await this.fetchImpl(url, {
			method: "POST",
			headers,
			body: encoded,
			...options.signal === void 0 ? {} : { signal: options.signal }
		});
		if (resp.status !== 200) {
			const errText = await resp.text();
			throw new QoderUpstreamError(classifyFailure(resp.status, errText), `聊天请求失败: HTTP ${resp.status} ${truncate(errText, 300)}`, resp.status, deepestBusinessCode(errText), retryAfterMsOf(errText) ?? retryAfterMsOfHeader(resp.headers.get("retry-after")), queueOf(errText));
		}
		if (!resp.body) throw new QoderUpstreamError("transient", "聊天响应没有 body");
		const reader = resp.body.getReader();
		const decoder = new TextDecoder();
		let buffer = "";
		try {
			for (;;) {
				const { done, value } = await reader.read();
				if (done) break;
				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split("\n");
				buffer = lines.pop() ?? "";
				for (const line of lines) {
					const trimmed = line.trim();
					if (trimmed === "" || !trimmed.startsWith("data:")) continue;
					const payload = trimmed.slice(5).trim();
					if (payload === "[DONE]") continue;
					const delta = parseStreamDelta(payload);
					if (delta !== void 0) options.onDelta(delta);
				}
			}
		} finally {
			reader.releaseLock();
		}
	}
	/**
	* 查询用量（只读）。`GET {openapi}/sash/api/v2/me/usage`。
	*
	* **认证用的是 jobToken 里的 `securityOauthToken`（`jt-…`），不是 PAT，
	* 也不是 COSY 签名 bearer。** 三者实测（2026-10，CN）：
	*
	* | 凭据 | 结果 |
	* | --- | --- |
	* | 裸 PAT `pt-…` | 401 `TOKEN_EXPIRE / token is not active` |
	* | COSY 签名 bearer（chat/models 用的那套） | 401 `TOKEN_INVALID / invalid token` |
	* | `jt-…`（jobToken 交换产出） | **200，返回完整 qoderUsage** |
	*
	* 前两种之所以失败，是因为 `sash` 是**浏览器会话面**的接口：它既不收 PAT，
	* 也不认 cosy 协议头（缺 Authorization 时它回
	* `UNAUTHORIZED / missing cookie header`，可见它本来是给 cookie 会话用的）。
	* 这解释了「令牌明明是好的、聊天也正常，积分却永远拿不到」——以前用错凭据。
	*/
	async fetchUsage(credential, signal) {
		const url = `${this.region.openapi}/sash/api/v2/me/usage`;
		try {
			const holder = await this.ensureSession(credential);
			return parseUsage(await this.jobTokenGet(holder, url, signal));
		} catch (error) {
			if (error instanceof QoderUpstreamError && (error.status === 401 || error.status === 403)) {
				const direct = await this.fetchUsageDirect(url, credential, signal);
				if (direct !== void 0) return direct;
				throw error;
			}
			return;
		}
	}
	/**
	* `sash` 系列接口的取数：带 `Authorization: Bearer <jobToken.securityOauthToken>`。
	*
	* 与 {@link bearerGet} 的区别只有一个——**认证凭据不同**：`sash` 要的是
	* jobToken 交换产出的 `jt-…`，不是 COSY 签名 bearer（实测后者回
	* `TOKEN_INVALID / invalid token`），也不是裸 PAT（回 `TOKEN_EXPIRE`）。
	* 也正因为如此，这里**不**带那套 cosy-* 协议头：它们属于 cosy 协议面。
	* 但**设备风控三件套属于 sash 面**，按 `requiresDeviceRisk` 附加 —— 见下。
	*/
	async jobTokenGet(holder, url, signal) {
		const oauthToken = this.sashBearerOf(holder);
		if (oauthToken === "") throw new QoderUpstreamError("auth", "两次令牌交换都没有拿到可用令牌，无法查询用量", 401);
		const resp = await this.fetchImpl(url, {
			headers: {
				accept: "application/json",
				authorization: `Bearer ${oauthToken}`,
				...await this.deviceRiskHeaders()
			},
			...signal === void 0 ? {} : { signal }
		});
		const text = await resp.text();
		if (resp.status !== 200) throw new QoderUpstreamError(classifyFailure(resp.status, text), `请求失败: HTTP ${resp.status} ${truncate(text, 200)}`, resp.status, deepestBusinessCode(text));
		try {
			return JSON.parse(text);
		} catch {
			throw new QoderUpstreamError("unknown", `响应不是 JSON: ${truncate(text, 200)}`, resp.status);
		}
	}
	/**
	* 活动列表（`GET /sash/api/v1/me/campaigns?forceRefresh=true`）。
	*
	* 协议来自社区参考实现（L0NE-6/Qoder-Daily），已在本机 CN 账号实测通过：
	* `GET {openapi}/sash/api/v1/me/campaigns?forceRefresh=true`，认证用与用量
	* 查询同一套 `jt-` 令牌（`jobToken.securityOauthToken`）。
	*
	* 注意路径里**没有**「签到」二字——它叫 campaigns（活动/权益）。这也是我早期
	* 把 `checkinSupported` 写死成 false 的原因：照着 checkin / signin / reward
	* 猜路径一律 404（实测猜了 13 个），于是误判成「Qoder 没有签到」。
	*
	* 旧语义（签到挑用的那一小片）保留在这里：它就是 `fetchCampaignFeed` 的
	* `campaigns` 投影，免得签到路径与卡片展示路径各写一份解析、日后漂移。
	*/
	async fetchCampaigns(credential, signal) {
		return (await this.fetchCampaignFeed(credential, signal)).campaigns;
	}
	/**
	* 完整活动面（含 `VIEW_DETAILS` banner 与顶层字段），给卡片「活动」区用。
	*
	* 实测（CN，2026-10-25）返回的整份形状：
	* `{ uid, showCampaign, claimable, campaignUrl, campaigns:[{ campaignId, campaignKey,
	*   actionType, startAt, endAt, claimStatus, benefit:{...},
	*   placements:[{ type, campaignUrl, content:{ zh:{title,description,detailUrl},
	*   en:{...} } }] }] }`。标题 / 描述 / 「查看详情」链接都在 `placements[*].content`
	* 里，按语言各一份；上游只下发它有的语言，所以这里原样收拢，不做翻译。
	*
	* 解析对字段缺席是**宽容**的：活动形状常按节日变（1024 集结、首月翻倍这类只在
	* 当期下发），缺字段就少渲染一点，绝不替上游编标题或链接。
	*/
	async fetchCampaignFeed(credential, signal) {
		const holder = await this.ensureSession(credential);
		const url = `${this.region.openapi}${this.region.campaignsPath}${CAMPAIGNS_QUERY}`;
		const data = await this.sashRequest("GET", holder, url, void 0, signal);
		return {
			campaigns: (Array.isArray(data.campaigns) ? data.campaigns : Array.isArray(data.data?.campaigns) ? data.data.campaigns : []).map((entry) => projectCampaignEntry(entry)).filter((c) => c !== void 0),
			...typeof data.campaignUrl === "string" && data.campaignUrl !== "" ? { campaignUrl: data.campaignUrl } : {},
			...typeof data.showCampaign === "boolean" ? { showCampaign: data.showCampaign } : {},
			...typeof data.claimable === "boolean" ? { claimable: data.claimable } : {}
		};
	}
	/**
	* 签到：领取今天那一份每日 Credits。
	*
	* 一次调用自足——先拉活动列表找出可领的那条，再领取。三种结果分得很清：
	*   - `claimed`：领到了（带回数额与有效期）；
	*   - `already-claimed`：今天已经领过（`CLAIMED` / 409 / `ALREADY_CLAIMED` /
	*     `replayed`），**不是错误**——重复调用是幂等的；
	*   - `unavailable`：今天上游没下发活动（未开窗 / 已领到活动行消失 / 企业号
	*     不支持该活动），带上说明。
	*/
	async claimDailyCredits(credential, signal) {
		const campaigns = await this.fetchCampaigns(credential, signal);
		const daily = campaigns.find((c) => c.actionType === "CLAIM_BENEFIT");
		const claimable = campaigns.find((c) => c.actionType === "CLAIM_BENEFIT" && c.claimStatus === "CLAIMABLE");
		const nextRefreshAtMs = daily?.endAt === void 0 ? void 0 : daily.endAt * 1e3;
		if (claimable === void 0) return daily?.claimStatus === "CLAIMED" ? {
			status: "already-claimed",
			...nextRefreshAtMs === void 0 ? {} : { nextRefreshAtMs }
		} : {
			status: "unavailable",
			message: "上游今日没有下发可领取的签到活动"
		};
		const holder = await this.ensureSession(credential);
		const url = `${this.region.openapi}${this.region.campaignsPath}/${encodeURIComponent(claimable.campaignId)}/claim`;
		try {
			const data = await this.sashRequest("POST", holder, url, {}, signal);
			if (String(data.status ?? "") === "CLAIMED") return {
				status: "claimed",
				...claimable.amount === void 0 ? {} : { amount: claimable.amount },
				...claimable.validityDays === void 0 ? {} : { validityDays: claimable.validityDays },
				...nextRefreshAtMs === void 0 ? {} : { nextRefreshAtMs }
			};
			return {
				status: "unavailable",
				message: `签到未完成（上游状态 ${String(data.status ?? "未知")}）`
			};
		} catch (error) {
			if (error instanceof QoderUpstreamError && error.status === 409) return {
				status: "already-claimed",
				...nextRefreshAtMs === void 0 ? {} : { nextRefreshAtMs }
			};
			throw error;
		}
	}
	/**
	* `sash` 接口的通用请求（活动列表 / 领取共用）。
	*
	* 认证与用量查询同一套：`Authorization: Bearer <jobToken.securityOauthToken>`。
	* 但那两个接口需要 `cosy-clienttype: 10` 与 `user-agent: Qoder`——参考实现
	* 如此，缺了会被拒；而夹带 cosy 协议头（chat/models 那套）反而不认。
	*
	* 这里的 `10` 与 cosy 面的 {@link COSY_CLIENT_TYPE} **恰好同值但不同源**：
	* 这条是 sash 面自己的客户端标识（`SASH_CLIENT_TYPE`，逐条手写请求头），
	* 改 cosy 面的协议版本不该顺手动它，反之亦然。两个数字各自独立被测。sash 面
	* 也**不**发 `cosy-version`：它本来就不带那套协议头。
	*
	* **国际版额外需要设备风控头**（`Cosy-MachineToken/Code/Type`，见 device-risk.ts）：
	* 签到活动只下发给带这些头的请求，缺了就拿不到活动列表。国内版不需要，所以按
	* region 条件附加 —— 不要无条件发，多余的头在另一侧是噪音。
	*/
	async sashRequest(method, holder, url, body, signal) {
		const oauthToken = this.sashBearerOf(holder);
		if (oauthToken === "") throw new QoderUpstreamError("auth", "两次令牌交换都没有拿到可用令牌，无法访问签到接口", 401);
		const resp = await this.fetchImpl(url, {
			method,
			headers: {
				authorization: `Bearer ${oauthToken}`,
				"cosy-clienttype": SASH_CLIENT_TYPE,
				accept: "application/json",
				"accept-language": "zh-CN",
				"user-agent": SASH_USER_AGENT,
				...await this.deviceRiskHeaders(),
				...method === "POST" ? {
					"content-type": "application/json",
					origin: this.region.openapi
				} : {}
			},
			...method === "POST" ? { body: JSON.stringify(body ?? {}) } : {},
			...signal === void 0 ? {} : { signal }
		});
		const text = await resp.text();
		if (resp.status !== 200 && resp.status !== 201) throw new QoderUpstreamError(classifyFailure(resp.status, text), `请求失败: HTTP ${resp.status} ${truncate(text, 200)}`, resp.status, deepestBusinessCode(text));
		try {
			return JSON.parse(text);
		} catch {
			throw new QoderUpstreamError("unknown", `响应不是 JSON: ${truncate(text, 200)}`, resp.status);
		}
	}
	/**
	* 本区域签到需要的设备风控头。
	*
	* 国内版返回空对象（不需要，发了反而是噪音）；国际版读取本机 UMID 组件的
	* 三件套。读取失败**不**静默降级成「无头请求」——那样只会拿到一个空的活动
	* 列表，用户看到「今天没有活动」而真实原因是取不到设备身份。所以这里让错误
	* 抛出去，由调用方带着原因回报。
	*/
	async deviceRiskHeaders() {
		if (!this.region.requiresDeviceRisk) return {};
		const risk = await readDeviceRisk(this.regionKey);
		return {
			"cosy-machinetoken": risk.machineToken,
			"cosy-machinecode": risk.machineCode,
			"cosy-machinetype": risk.machineType
		};
	}
	/**
	* 直连回退：`Bearer <PAT>` 打同一个端点。返回 undefined 表示这条回退路径
	* 也没给出 200（端点不接受直连 PAT，或网络失败）——由调用方决定是否把原始
	* 的凭据被拒错误抛出去。
	*/
	async fetchUsageDirect(url, credential, signal) {
		try {
			const resp = await this.fetchImpl(url, {
				headers: {
					authorization: `Bearer ${credential}`,
					accept: "application/json",
					"cosy-clienttype": "10",
					"user-agent": "Qoder",
					...await this.deviceRiskHeaders()
				},
				...signal === void 0 ? {} : { signal }
			});
			if (resp.status === 200) return parseUsage(await resp.json());
			if (resp.status === 401 || resp.status === 403) return;
		} catch {}
	}
	async bearerGet(holder, url, signal) {
		const pathSig = pathSigFrom(url);
		const payloadB64 = buildPayloadB64(holder.session.info);
		const date = String(Math.floor(Date.now() / 1e3));
		const bearer = composeBearer(payloadB64, signRequest(payloadB64, holder.session.cosyKey, date, "", pathSig));
		const headers = {
			...DEFAULT_HEADERS,
			"cosy-machinetype": holder.session.machineType,
			"cosy-date": date,
			"cosy-user": holder.session.identity.uid,
			"cosy-key": holder.session.cosyKey,
			accept: "application/json",
			authorization: bearer,
			"cosy-version": COSY_VERSION_HEADER,
			"cosy-machineid": holder.session.machineId,
			"cosy-machinetoken": holder.session.machineToken
		};
		const resp = await this.fetchImpl(url, {
			headers,
			...signal === void 0 ? {} : { signal }
		});
		const text = await resp.text();
		if (resp.status !== 200) throw new QoderUpstreamError(classifyFailure(resp.status, text), `请求失败: HTTP ${resp.status} ${truncate(text, 200)}`, resp.status, deepestBusinessCode(text));
		try {
			return JSON.parse(text);
		} catch {
			throw new QoderUpstreamError("unknown", `响应不是 JSON: ${truncate(text, 200)}`, resp.status);
		}
	}
};
/**
* 把上游的一条 campaign 投影成 `QoderCampaign`（宽容：缺字段就少渲染，不编造）。
*
* `placements` 是数组，每个元素带 `content: { zh?: {…}, en?: {…} }`（POPUP / USAGE
* 各一份）。同一语言的文案取**第一份非空**：同一活动通常多份完全相同，重复渲染
* 只会让卡片上出现两行一样的东西。
*/
function projectCampaignEntry(entry) {
	if (!entry || typeof entry !== "object") return void 0;
	const raw = entry;
	const campaignId = typeof raw.campaignId === "string" ? raw.campaignId : "";
	if (campaignId === "") return void 0;
	const benefit = typeof raw.benefit === "object" && raw.benefit !== null ? raw.benefit : {};
	const validity = typeof benefit.validity === "object" && benefit.validity !== null ? benefit.validity : {};
	const placements = Array.isArray(raw.placements) ? raw.placements : [];
	let campaignUrl = "";
	const content = {};
	for (const p of placements) {
		if (!p || typeof p !== "object") continue;
		const slot = p;
		if (campaignUrl === "" && typeof slot.campaignUrl === "string") campaignUrl = slot.campaignUrl;
		const slotContent = slot.content;
		if (!slotContent || typeof slotContent !== "object") continue;
		for (const [lang, text] of Object.entries(slotContent)) {
			if (!text || typeof text !== "object") continue;
			const t = text;
			const row = {
				...typeof t.title === "string" ? { title: t.title } : {},
				...typeof t.description === "string" ? { description: t.description } : {},
				...typeof t.detailUrl === "string" ? { detailUrl: t.detailUrl } : {},
				...typeof t.buttonText === "string" ? { buttonText: t.buttonText } : {}
			};
			const prior = content[lang];
			if (prior === void 0 || Object.keys(prior).length === 0 && Object.keys(row).length > 0) content[lang] = row;
		}
	}
	return {
		campaignId,
		actionType: typeof raw.actionType === "string" ? raw.actionType : "",
		claimStatus: typeof raw.claimStatus === "string" ? raw.claimStatus : "",
		...typeof raw.campaignKey === "string" && raw.campaignKey !== "" ? { campaignKey: raw.campaignKey } : {},
		...campaignUrl !== "" ? { campaignUrl } : {},
		...typeof benefit.amount === "number" ? { amount: benefit.amount } : {},
		...typeof validity.days === "number" ? { validityDays: validity.days } : {},
		...typeof raw.startAt === "number" ? { startAt: raw.startAt } : {},
		...typeof raw.endAt === "number" ? { endAt: raw.endAt } : {},
		...Object.keys(content).length > 0 ? { content } : {}
	};
}
/** jobToken 交换请求体。PAT 或 `drt-` refreshToken 二选一。 */
function jobTokenBody(credential) {
	const isRefresh = credential.startsWith("drt-");
	const outer = {
		payload: JSON.stringify({
			personalToken: isRefresh ? "" : credential,
			securityOauthToken: "",
			refreshToken: isRefresh ? credential : "",
			needRefresh: isRefresh,
			authInfo: {}
		}),
		encodeVersion: "1"
	};
	const plain = JSON.stringify(outer);
	return cosyEncode(new TextEncoder().encode(plain));
}
function randomId() {
	return crypto.randomUUID();
}
/**
* 解析一条 SSE 帧：
* `data: {"headers":{...},"body":"<inner json>","statusCodeValue":200}`
* 内层：`{"choices":[{"delta":{...}}], "usage":{...}}` 或业务错误 `{"code":"115","message":"..."}`。
* 返回 undefined 表示本帧无可消费内容（或 [DONE] 之前的空帧）。
*/
function parseStreamDelta(dataPayload) {
	let wrapper;
	try {
		wrapper = JSON.parse(dataPayload);
	} catch {
		return;
	}
	const scv = wrapper.statusCodeValue;
	if (scv !== void 0 && scv !== null && Number(scv) !== 200) {
		const detail = typeof wrapper.body === "string" ? wrapper.body : dataPayload.slice(0, 400);
		throw new QoderUpstreamError(classifyFailure(Number(scv), detail), `上游信封错误: HTTP ${scv} ${truncate(detail, 300)}`, Number(scv), deepestBusinessCode(detail), retryAfterMsOf(detail), queueOf(detail));
	}
	const innerStr = wrapper.body;
	if (typeof innerStr !== "string" || innerStr === "") return void 0;
	let inner;
	try {
		inner = JSON.parse(innerStr);
	} catch {
		return;
	}
	if (inner === null || typeof inner !== "object") return void 0;
	if (typeof inner.code === "string" && inner.code !== "" && inner.code !== "0") {
		const detail = typeof inner.message === "string" ? inner.message : JSON.stringify(inner.message ?? "");
		throw new QoderUpstreamError(classifyBusinessCode(inner.code), `上游业务错误 code=${inner.code}: ${String(inner.message ?? "")}`, 0, inner.code, retryAfterMsOf(detail), queueOf(detail));
	}
	const usageIn = readTokens(inner.usage, "prompt_tokens");
	const usageOut = readTokens(inner.usage, "completion_tokens");
	const usageCached = readCachedTokens(inner.usage);
	const tokens = usageCached === void 0 ? {
		inputTokens: usageIn,
		outputTokens: usageOut
	} : {
		inputTokens: usageIn,
		outputTokens: usageOut,
		cachedTokens: usageCached
	};
	const choices = Array.isArray(inner.choices) ? inner.choices : [];
	for (const ch of choices) {
		const delta = ch.delta;
		if (!delta) continue;
		const role = typeof delta.role === "string" ? delta.role : "";
		const content = typeof delta.content === "string" ? delta.content : "";
		const reasoning = typeof delta.reasoning_content === "string" ? delta.reasoning_content : "";
		const toolCalls = Array.isArray(delta.tool_calls) && delta.tool_calls.length > 0 ? delta.tool_calls : void 0;
		if (role !== "" || content !== "" || reasoning !== "" || toolCalls !== void 0) return {
			role,
			content,
			reasoningContent: reasoning,
			toolCalls,
			...tokens
		};
	}
	if (usageIn > 0 || usageOut > 0) return {
		role: "",
		content: "",
		reasoningContent: "",
		toolCalls: void 0,
		...tokens
	};
}
function readTokens(usage, key) {
	if (!usage || typeof usage !== "object") return 0;
	const v = usage[key];
	return typeof v === "number" ? v : 0;
}
/**
* 读缓存命中的输入 token 数（issue #4）。
*
* 为什么这里值得一个专门的函数、而不是顺手写进 `readTokens`：**它有三个可能的
* 位置**，而各家的写法不统一（宿主 `parseChunkUsage` 里列过同一张表）：
*
*   1. `prompt_tokens_details.cached_tokens` —— OpenAI / OpenRouter，也是实测
*      上 Qoder 网关正在用的那个（见 `QoderChatDelta.cachedTokens` 的真实样本）。
*   2. `prompt_cache_hit_tokens` —— DeepSeek 系，顶层的另一个拼法。
*   3. `cached_tokens` —— Kimi 文档里放顶层。
*
* 取**第一个存在**的那个，不做相加：它们是同一个量的三种写法，不是三个分量。
*
* 返回 `undefined` 表示「上游没报」。**不要**把它折成 0：那会让「这一帧没有
* usage」与「这次一个都没命中」变成同一个数字，而宿主的百分比正是拿它算的
* ——issue #4 的整个症状就是「0% 不可信」，用一个默认 0 去修它等于把病保留下来。
*
* 另一条**不可踩的坑**：`cached_tokens` 是 `prompt_tokens` 的**子集**（实测
* 2032 / 2038），所以绝不能加进 `prompt_tokens`。宿主侧自己会做
* `input = prompt_tokens - cacheRead`，两边各按「子集」理解才对得上。
*/
function readCachedTokens(usage) {
	if (!usage || typeof usage !== "object") return void 0;
	const record = usage;
	const details = record["prompt_tokens_details"];
	const fromDetails = details !== null && typeof details === "object" && !Array.isArray(details) ? readCount(details["cached_tokens"]) : void 0;
	if (fromDetails !== void 0) return fromDetails;
	const fromHit = readCount(record["prompt_cache_hit_tokens"]);
	if (fromHit !== void 0) return fromHit;
	return readCount(record["cached_tokens"]);
}
/** 有限、非负的数字；其它一律 `undefined`（`NaN` / 负数 / 字符串都不算数）。 */
function readCount(value) {
	return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : void 0;
}
/** 解析用量响应（兼容 qoderUsage 内层与平铺两种形状）。 */
function parseUsage(data) {
	const source = data.qoderUsage ?? data;
	const userQuota = readBucket(source.userQuota);
	const addOn = source.addOnQuota;
	const org = source.orgResourcePackage;
	const out = {
		userType: typeof source.userType === "string" ? source.userType : void 0,
		expiresAt: typeof source.expiresAt === "number" ? source.expiresAt : void 0,
		upgradeUrl: typeof source.upgradeUrl === "string" ? source.upgradeUrl : void 0,
		isQuotaExceeded: source.isQuotaExceeded === true
	};
	if (userQuota) out.userQuota = userQuota;
	if (addOn) out.addOnQuota = {
		...readBucket(addOn),
		detailUrl: typeof addOn.detailUrl === "string" ? addOn.detailUrl : void 0
	};
	if (org) out.orgResourcePackage = {
		used: num(org.used),
		cap: num(org.cap),
		remaining: num(org.remaining),
		percentage: num(org.percentage),
		available: org.available === true
	};
	return out;
}
function readBucket(value) {
	if (!value || typeof value !== "object") return void 0;
	const v = value;
	return {
		total: num(v.total),
		used: num(v.used),
		remaining: num(v.remaining),
		percentage: num(v.percentage)
	};
}
function num(v) {
	return typeof v === "number" ? v : void 0;
}
/** HTTP 状态 → 错误分类（内容审核标记优先于状态码，与 Go 版一致）。 */
function classifyHttpStatus(status, detail) {
	if (isContentPolicy(detail)) return "content-policy";
	if (status === 401 || status === 403) return "auth";
	if (status === 429) return "rate-limited";
	if (status === 400) return "invalid-request";
	if (status === 418 || status >= 500) return "transient";
	return "unknown";
}
/**
* 下钻的最大层数：防自嵌套/循环引用把解析变成死循环。
*
* 实测最深的两层就够（issue #6 的真实帧是「外层信封 → 内层业务码」），但这里给
* 一点余量，因为上游换一次包装就会多一层，而多一层只是多一次 JSON.parse。
*/
const MAX_CODE_NESTING = 6;
/**
* 取上游申报的「请等这么久再试」，毫秒（issue #24）。
*
* 实测形状（`HTTP 4xx` + `code 10605 / subCode RESOURCE_LIMIT`）：
*
* ```json
* {"code":"10605","message":"{\"isQueued\":false,\"modelKey\":\"…\",
*   \"queueCount\":0,\"queueType\":\"p2\",\"retryAfterSeconds\":5,
*   \"serviceAvailable\":true,\"waitTime\":0}","subCode":"RESOURCE_LIMIT"}
* ```
*
* 与 {@link deepestBusinessCode} 走同一条路（只沿 `message` 往里剥、有深度上限），
* 因为这两个值在同一个信封里，分头解析迟早漂移。
*
* **只认 JSON 里的数字秒。** 不解析 HTTP `Retry-After` 头：宿主在 pi-ai 路由上
* 只从文案分类、不读头（见 `llm-pi-ai/src/stream.ts` 的 `classifyPiAiError`），
* 所以头带了也没人读；而这里读到的值会进文案，是**真的**能影响等待的那条路。
* 头仍然照发（`Retry-After`），那是给别的消费者看的，不是本插件的判据。
*
* 上限 1 小时：超过就当上游没申报。一个离谱的值会让宿主放弃这次重试
* （`llm-retry` 在 `> maxDelayMs` 时 `next()`），比不报更糟。
*/
const MAX_RETRY_AFTER_MS = 36e5;
/**
* 解析 HTTP `Retry-After` 头（两种合法形式：秒数 / HTTP-date）。
*
* 只作**兜底**：上游的申报值在 body 里（`retryAfterSeconds`），头是次要来源。
* 判据同 {@link retryAfterMsOf}：正数、且不超过 1 小时。
*/
function retryAfterMsOfHeader(value, nowMs = Date.now()) {
	if (typeof value !== "string" || value.trim() === "") return void 0;
	const text = value.trim();
	if (/^\d+$/u.test(text)) {
		const seconds = Number(text);
		const ms = Math.round(seconds * 1e3);
		return ms > 0 && ms <= MAX_RETRY_AFTER_MS ? ms : void 0;
	}
	const at = Date.parse(text);
	if (!Number.isFinite(at)) return void 0;
	const ms = at - nowMs;
	return ms > 0 && ms <= MAX_RETRY_AFTER_MS ? ms : void 0;
}
function retryAfterMsOf(detail) {
	for (const record of envelopeRecords(detail)) {
		const seconds = record.retryAfterSeconds;
		if (typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0) {
			const ms = Math.round(seconds * 1e3);
			return ms <= MAX_RETRY_AFTER_MS ? ms : void 0;
		}
	}
}
/**
* 沿一条失败信封往里剥，产出每一层的记录对象。
*
* **为什么需要它（issue #26）**：上游的信封有两种「往里包」的方式，两种都在
* 现场出现过：
*
* ```json
* { "code": "403", "message": "{\"code\":\"10605\",\"message\":\"…\"}" }   // 字符串
* { "code": "403", "message": "{\"code\":\"10605\",\"message\":{…}}" }   // 对象
* ```
*
* 第二种里，`message` **不是**字符串而是对象，而此前 `retryAfterMsOf` 与
* `deepestBusinessCode` 都写着「`message` 是字符串才继续往里走」—— 于是
* 走到第二层就停下，`retryAfterSeconds` 明明就在那层的 `message` 对象里，
* 却读不出来。现场后果：上游说「等 30 秒」，插件读成「上游没说」，于是按
* 30 分钟兜底冷却（差 60 倍）。
*
* 这里把「剥信封」收成**一处**实现，两个读者共用，避免两处再次漂移。深度
* 上限沿用 {@link MAX_CODE_NESTING}。
*/
function envelopeRecords(detail) {
	const records = [];
	let text = typeof detail === "string" ? detail.trim() : "";
	for (let depth = 0; depth < MAX_CODE_NESTING; depth += 1) {
		let record;
		if (typeof text === "string") {
			if (!text.startsWith("{")) break;
			const parsed = parseJson(text);
			if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) break;
			record = parsed;
		} else if (typeof text === "object" && text !== null && !Array.isArray(text)) record = text;
		else break;
		records.push(record);
		const message = record.message;
		if (typeof message === "string") text = message.trim();
		else if (typeof message === "object" && message !== null && !Array.isArray(message)) text = message;
		else break;
	}
	return records;
}
/**
* 上游的排队状态（issue #26）。
*
* 判据是上游**自己说的** `isQueued: true`；`serviceAvailable: true` 是旁证
* （服务是好的，只是排在队里）。返回 undefined 表示上游没提排队 —— 那时
* 不许把任何失败说成「排队中」。
*
* `queueCount` 与 `retryAfterSeconds` 一并带出：前者让用户看到「排在第 1027
* 位」，后者是「等 30 秒」—— 上游给了就显示，没给就不编。
*/
function queueOf(detail) {
	for (const record of envelopeRecords(detail)) {
		const isQueued = record.isQueued;
		if (typeof isQueued !== "boolean") continue;
		const count = record.queueCount;
		const queueType = record.queueType;
		const seconds = record.retryAfterSeconds;
		return {
			isQueued,
			...typeof count === "number" && Number.isFinite(count) && count >= 0 ? { queueCount: count } : {},
			...typeof queueType === "string" && queueType !== "" ? { queueType } : {},
			...typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0 ? { retryAfterSeconds: seconds } : {}
		};
	}
}
/**
* 取**最深一层认识的**业务码（`{"code":"10605","message":"…"}`）。
*
* 为什么不能只看最外层（issue #6）：上游的失败帧常是外层信封继续往里包，实拍帧：
*
* ```json
* { "code": 403, "message": "{\"code\":\"10605\",\"message\":\"qmodel 排队中，请稍后重试\"}" }
* ```
*
* 外层那个 `403` 是 HTTP 语义的码（`classifyBusinessCode('403')` → `unknown`），
* 真正的业务码 `10605`（排队）藏在内层 `message` 里。只剥一层 ⇒ 读不到码 ⇒ 回落
* HTTP 状态 ⇒ `403 → auth → credential-rejected → 永久剔除账号 + 叫用户换 PAT`。
* 而 `10605`/`10408` 本来就在 `TRANSIENT_CODES` 里 —— 码表没缺，缺的是「读到它」。
*
* 三条纪律（都来自现场形态，不是风格偏好）：
*
* 1. **只沿 `parsed.message` 往里走。** 改成遍历 `error`/`data`/`result` 之类更宽
*    的键集合，会把外层信封那个 HTTP 语义的 `code`（或 `code: 0` 之类无关字段）
*    当成业务码返回 —— 那比现在更糟，因为 `classifyBusinessCode` 一旦命中就可能
*    盖住真码。
* 2. **认不出的码要记进 `fallback` 并继续往里找**，不能直接 return。用例
*    「外层 403 + 内层 10605/402」就靠这条才过：外层认不出、里层才认得出，先
*    返回外层就还是 `auth`。
* 3. **认不出就原样回落 `classifyHttpStatus`** —— `TOKEN_EXPIRE` 这类字符串码、
*    非 JSON body、空 body 的行为与改动前逐字一致（真被拒的那一侧不能被改坏）。
*/
function deepestBusinessCode(detail) {
	let fallback;
	for (const record of envelopeRecords(detail)) {
		const raw = record.code;
		let code;
		if (typeof raw === "string" && raw !== "") code = raw;
		else if (typeof raw === "number" && Number.isInteger(raw)) code = String(raw);
		if (code !== void 0) {
			if (classifyBusinessCode(code) !== "unknown") return code;
			if (fallback === void 0) fallback = code;
		}
	}
	return fallback;
}
/**
* 一次失败的分类：**业务码优先于 HTTP 状态**，状态只作兜底。
*
* 这是本轮的根因所在（用户实拍：国际版「Qoder 拒绝了这个账号的 PAT」）。实测
* 上游对**当日用量用尽**回的是
*
* ```
* HTTP 403 {"code":"110","message":"Billing daily count exceeded"}
* ```
*
* 而旧实现只看状态：`403 → auth → credential-rejected → 「请添加新 PAT」`。
* 那句话不只是文案难听 —— `credential-rejected` 在账号池里是**无条件永久排除**
* （`exclusionOf` 连冷却期都不看，理由写得很对：令牌被拒，等也没用）。于是
* 一个只是今天用满、明天自动恢复的账号被踢出池且**不会自愈**，同时被要求去做
* 一件根本无效的事（换 PAT）。
*
* 官方码表（docs.qoder.com/zh/cli/sdk/errors）里 `105` 才是「登录态或 Access
* Token 已过期」；`110`/`113`/`115`–`119`/`122` 全是**用量与配额**族。也就是说
* 「403 就是凭据坏了」这个推断在协议层面根本不成立。
*
* 认识的码说了算；不认识的（如 `TOKEN_EXPIRE` 这类字符串码）回落状态分类，
* 行为与改动前一致。
*
* 取码用 {@link deepestBusinessCode} 而不是 {@link businessCodeOf}：业务码可能
* 藏在第二/三层包装里（issue #6 的实拍帧），只剥一层就会把「排队」当成
* 「凭据被拒」，进而永久剔除一个其实几分钟就自愈的账号。
*/
function classifyFailure(status, detail) {
	const code = deepestBusinessCode(detail);
	if (code !== void 0) {
		const byCode = classifyBusinessCode(code);
		if (byCode !== "unknown") return byCode;
	}
	return classifyHttpStatus(status, detail);
}
/** 业务 code → 错误分类（官方码表，见 {@link classifyFailure}）。 */
function classifyBusinessCode(code) {
	if (code === "105") return "auth";
	if (QUOTA_CODES.has(code)) return "quota-exhausted";
	if (code === "406") return "content-policy";
	if (REQUEST_CODES.has(code)) return "invalid-request";
	if (TRANSIENT_CODES.has(code)) return "transient";
	return "unknown";
}
const QUOTA_CODES = /* @__PURE__ */ new Set([
	"110",
	"113",
	"115",
	"116",
	"117",
	"118",
	"119",
	"122",
	"402",
	"6004"
]);
/** 416 范围/结构无法满足 · 430 能力不支持 · 80411 输入过长 · 80412 媒体过多。 */
const REQUEST_CODES = /* @__PURE__ */ new Set([
	"416",
	"430",
	"80411",
	"80412"
]);
const TRANSIENT_CODES = /* @__PURE__ */ new Set([
	"500",
	"10408",
	"10500",
	"10605"
]);
const CONTENT_POLICY_MARKERS = [
	"DataInspectionFailed",
	"inappropriate content",
	"input text data may contain",
	"ContentFilter",
	"SensitiveContent"
];
function isContentPolicy(detail) {
	return CONTENT_POLICY_MARKERS.some((marker) => detail.includes(marker));
}
/** Parse JSON, or undefined when the body is not JSON at all. Never throws. */
function parseJson(text) {
	try {
		return JSON.parse(text);
	} catch {
		return;
	}
}
function truncate(text, max) {
	return text.length <= max ? text : `${text.slice(0, max)}…`;
}
//#endregion
//#region src/pi-ai-runtime.ts
/**
* Which `@earendil-works/pi-ai` copy THIS plugin actually resolves at runtime.
*
* 参考：dsh-connect-workbuddy（MIT，Copyright (c) 2026 LaoDing）的同名模块
* 改动：纯改名移植（workbuddy → qoder，模块 doc 提及），检测机制与决策表原样沿用。
*
* WHY THIS EXISTS (issues #24 / #25 / #26, and the 0.2.1-rc.1 regression).
* The plugin declares pi-ai as a peer (`>=0.85.0 <0.88.0 || >=1.0.0 <2.0.0`),
* so the module it imports is whatever the host environment provides — and the
* two generations consume DIFFERENT context shapes:
*
* - **modern** (0.87 … 1.x) hands providers a normalized transcript:
*   `{ messages: [ {role:'system', content, toolsAdded}, … ] }`. The system
*   prompt and the tool declarations live ONLY on that leading system message;
*   the top-level `systemPrompt` / `tools` fields are gone, and the api module
*   never reads them back. In 0.87 this normalization happens inside the api
*   modules; from 0.87/1.x it happens one layer up, in pi-ai's **Models layer**
*   (`createModels().stream*` → `normalizeContext`), which sits between the
*   host and the api module. Either way the api sees a transcript.
* - **legacy** (0.85) expects `{ systemPrompt, tools, messages }` and has no
*   branch for a `system` message inside `messages` at all: its token
*   estimator crashes on one (issue #24), and its wire converter silently
*   drops it.
*
* Which copy resolves is NOT predictable from the host version alone: a
* nested 0.85.1 on disk shadows the host's 0.87.1 (the plugin author's own
* symlinked checkout does exactly that), while a clean market install has no
* local copy at all and resolves the host's (issue #26's reporter). The
* adapter therefore gates on what THIS plugin resolves.
*
* HOW it is detected — deliberately WITHOUT importing pi-ai:
* `import.meta.resolve` locates the entry file (executing nothing), the
* package manifest sitting beside it names the version, and the generation is
* decided from that version (0.87+ **and every 1.x** → modern; see
* {@link generationOf}, whose failure to handle the 1.x major was the
* 0.2.1-rc.1 regression). A static import would drag
* pi-ai into the standalone `doctor` CLI, which must also run from market
* installs where NO local pi-ai exists and the module is only provided inside
* the DSH host — a static import there is a load-time crash. Resolution
* itself does not need the module: within the peer range, the manifest
* version and the `normalizeContext` feature (present from 0.87 on, not
* before) agree.
*
* When resolution FAILS — the normal state of a market install probed outside
* the host — there is no local copy, so inside DSH the host supplies pi-ai.
* Every DSH host that normalizes contexts (0.2.0+ ships 0.87.1; 0.2.1 ships
* pi-ai 1.x) supplies a self-normalizing pi-ai, so the reported generation
* defaults to `modern` (pass-through). That default is safe on older hosts
* too: they never normalize, and a native 0.85-shaped context is an identity
* under BOTH branches of the adapter gate.
*
* `doctor` prints the resolved version and path so mixed-generation setups —
* the silent kind that produced #24 and #26 — become visible on demand.
*
* @module dsh-connect-qoder/pi-ai-runtime
*/
let cached;
/** Resolve (once) which pi-ai copy this plugin runs against. */
function piAiRuntimeInfo() {
	cached ??= piAiRuntimeFor(resolveModuleFile());
	return cached;
}
/**
* The decision table for one resolution result, exported so the branch that
* only ever runs on OTHER machines (a market install with no local pi-ai) is
* pinned by tests rather than by this comment.
*
* `undefined` means nothing local resolved — inside DSH the host supplies the
* module, and every host that normalizes contexts (0.2.0+, via 0.87.1) ships
* the modern generation, so that is the default. Older hosts never normalize,
* and their native 0.85-shaped context is an identity under either gate
* branch, so the default cannot hurt them.
*/
function piAiRuntimeFor(resolvedFrom) {
	if (resolvedFrom === void 0) return {
		generation: "modern",
		resolvedFrom: void 0,
		version: void 0,
		resolvedLocally: false
	};
	const version = readVersion(resolvedFrom);
	return {
		generation: generationOf(version),
		resolvedFrom,
		version,
		resolvedLocally: true
	};
}
/**
* The file the main entry resolved to; undefined when resolution itself fails.
*
* `import.meta.resolve` (not `require.resolve`): pi-ai's exports map exposes
* "." under the `import` condition only, so the CJS resolver refuses the bare
* specifier outright — the ESM resolver is the one this plugin actually
* imports with, so it is also the one whose answer is meaningful here.
*/
function resolveModuleFile() {
	try {
		return fileURLToPath(import.meta.resolve("@earendil-works/pi-ai"));
	} catch {
		return;
	}
}
/**
* The version of the package owning `moduleFile`. pi-ai's exports map does
* not expose `./package.json`, so the manifest is found by walking up from
* the resolved entry — `dist/index.js` sits directly inside the package —
* and claiming it only when its `name` matches, so a same-named ancestor
* (a pnpm virtual-store parent, for instance) cannot be misread.
*/
function readVersion(moduleFile) {
	if (moduleFile === void 0) return void 0;
	let directory = dirname(moduleFile);
	for (let depth = 0; depth < 4; depth++) {
		try {
			const parsed = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
			if (parsed.name === "@earendil-works/pi-ai" && typeof parsed.version === "string") return parsed.version;
		} catch {}
		const parent = dirname(directory);
		if (parent === directory) return void 0;
		directory = parent;
	}
}
/**
* The generation a manifest version belongs to.
*
* The context-shape split is by CAPABILITY, and it moved twice:
*
* - `0.87.x` … `0.x` — normalizes contexts in its api modules (`0.87+`).
* - `1.x` — normalizes in the **Models layer** (`createModels().stream*` →
*   `normalizeContext`), which sits between the host and the api module. The
*   provider-facing contract is the same normalized transcript, so 1.x is
*   `modern` for this plugin's purposes.
*
* ⚠️ THE 1.x BRANCH IS THE 0.2.1-rc.1 REGRESSION. This function used to read
* `/^0\.(\d+)\./` only, so any `1.x.y` failed to match and fell through to
* `legacy`. The adapter then applied `adaptLegacyPiAiContext` to a transcript
* that pi-ai had already normalized, and every request went upstream with NO
* system prompt and NO tool declarations — silently (measured on the real
* 0.2.1-rc.1 stack: `roles:["user"]`, `system:null`, `tools:0`).
*
* The guard that should have caught this did not: the old test recomputed the
* SAME buggy formula (`minor >= 87`, which is `NaN >= 87 === false` for `1.x`)
* and asserted `legacy`, so it certified the defect. The replacement asserts a
* written-down version table instead of re-deriving it.
*
* A major version of 2 or more is unknown to this table, and an unreadable
* version is unknown too. Both conservatively report `legacy`: the legacy
* branch is the identity on an already-flat 0.85 context and its fold is a
* no-op on a context that has no system message, so guessing `legacy` degrades
* to "possibly a redundant fold" rather than "definitely drops the prompt".
* `doctor` prints the resolved version so a guess is visible, not silent.
*/
function generationOf(version) {
	if (version === void 0) return "legacy";
	const match = /^(\d+)\.(\d+)\./u.exec(version);
	if (match === null) return "legacy";
	const major = Number(match[1]);
	const minor = Number(match[2]);
	if (major >= 1) return "modern";
	if (major === 0) return minor >= 87 ? "modern" : "legacy";
	return "legacy";
}
//#endregion
//#region src/credentials.ts
/**
* Qoder 凭据解析：PAT（Personal Access Token）来源与账号 id 派生。
*
* PAT 优先级（每个区域独立）：
* 1. 设置卡片里用户显式填写的 PAT（`config.regions.<region>.pat`）；
* 2. 环境变量（`QODER_PERSONAL_ACCESS_TOKEN` / `QODERCN_PERSONAL_ACCESS_TOKEN`）；
* 3. 插件自有保险库（`src/accounts.ts`）里登记的其余 PAT。
*
* 说明：Qoder CLI 的交互式登录凭据（`~/.qoder/qoder-cli-credentials.json`
* 等）是 AES-256-GCM 加密存储的，密钥派生在 qodercli 二进制内，插件不做
* 二进制逆向；本插件通过 PAT 接入。
*
* @module dsh-connect-qoder/credentials
*/
/** 各区域对应的 PAT 环境变量名。 */
const QODER_PAT_ENV_VARS = {
	global: "QODER_PERSONAL_ACCESS_TOKEN",
	cn: "QODERCN_PERSONAL_ACCESS_TOKEN"
};
/** 从环境变量取该区域的 PAT。 */
function patFromEnv(region, env = process.env) {
	const value = env[QODER_PAT_ENV_VARS[region]]?.trim();
	return value ? value : void 0;
}
/**
* 一个 PAT 的稳定账号 id：`pat-` + sha256 前 16 位十六进制。
*
* 为什么不用上游的 uid：jobToken 交换能给出 uid，但那要求添加/导入时
* 必须联机，而且 vault 里还没验证过的记录会没有 id 可用。从 PAT 本身派生
* 的 id 离线可得、永不变化，且单向散列不把 token 材料泄进设置文件、
* 日志或浏览器快照（id 会出现在卡片的 DOM 与 URL 参数里）。
*/
function qoderAccountId(pat) {
	return `pat-${createHash("sha256").update(pat, "utf8").digest("hex").slice(0, 16)}`;
}
/** 判断一个 id 是否由本插件的 PAT 派生规则产生。 */
function isQoderAccountId(id) {
	return /^pat-[0-9a-f]{16}$/.test(id);
}
/** 展示用的 PAT 掩码：只留头尾，绝不出现完整 token。 */
function maskPat(pat) {
	if (pat.length <= 10) return "…";
	return `${pat.slice(0, 5)}…${pat.slice(-4)}`;
}
//#endregion
//#region src/accounts.ts
/**
* Qoder 账号库：按区域隔离的 PAT 保险库 + 账号解析。
*
* 参考：dsh-connect-workbuddy（MIT，Copyright (c) 2026 LaoDing）的
*   `src/auth.ts` —— 插件自有凭据文件的约定（`$DSH_HOME` 下按区域分文件、
*   `withFileLock` + `writeFileAtomic`、`mode: 0o600`）、「账号列表与选中
*   分离，选中存设置」「读取永不抛异常」的语义沿用其做法。
* 改动：WorkBuddy 的账号来自桌面端登录文件 + OAuth 扫码；Qoder 的账号
*   就是 PAT 本身，来源三种——设置卡片的 PAT 字段、环境变量、以及本模块
*   维护的插件自有保险库（卡片「添加账号」与转账导入写入）。账号 id 由
*   PAT 单向派生（见 `credentials.ts` 的 `qoderAccountId`），不依赖联机
*   验证，也不把 token 材料泄进 id。
*
* 本模块不碰网络：PAT 的有效性验证（jobToken 交换）在 Host 路由层完成，
* 这里只负责持久化与解析。
*
* @module dsh-connect-qoder/accounts
*/
/** On-disk format version; readers reject anything else. */
const VAULT_FORMAT_VERSION = 1;
/** Filename prefix for one region's account vault. */
const VAULT_PREFIX = ".qoder-accounts";
/** Whether a parsed value looks like a stored account entry. */
function isStoredAccount(value) {
	if (typeof value !== "object" || value === null) return false;
	const candidate = value;
	return typeof candidate["id"] === "string" && candidate["id"] !== "" && typeof candidate["pat"] === "string" && candidate["pat"] !== "" && typeof candidate["accountName"] === "string" && typeof candidate["addedAtMs"] === "number";
}
/** One region's vault path. */
function qoderAccountsPath(region) {
	return join(resolveDshHome(), `${VAULT_PREFIX}.${region}.json`);
}
/**
* One region's account store.
*
* Reads never throw: a missing, unreadable, malformed, or version-mismatched
* vault all mean "no stored accounts", which is a valid state — the pool and
* the card simply show an empty account list. Writes go through the file lock
* and an atomic replace, same as the credential copies in the sibling plugin.
*/
var QoderAccountStore = class {
	region;
	constructor(region) {
		this.region = region;
	}
	/** The vault entries, in insertion order. */
	async vaultAccounts() {
		let raw;
		try {
			raw = await readFile(qoderAccountsPath(this.region), "utf8");
		} catch {
			return [];
		}
		let parsed;
		try {
			parsed = JSON.parse(raw);
		} catch {
			return [];
		}
		if (typeof parsed !== "object" || parsed === null) return [];
		const document = parsed;
		if (document.version !== VAULT_FORMAT_VERSION) return [];
		if (!Array.isArray(document.accounts)) return [];
		return document.accounts.filter(isStoredAccount);
	}
	/**
	* Every account this region can bill, merged from all three sources.
	*
	* Order is the resolution priority: the settings PAT first, then the
	* environment PAT, then the vault. A PAT appearing in two sources is listed
	* ONCE, under the higher-priority source — the id is derived from the PAT
	* itself, so duplicates are exact.
	*/
	async accounts(sources) {
		const out = [];
		const seen = /* @__PURE__ */ new Set();
		const settingsPat = sources.settingsPat?.trim();
		if (settingsPat) {
			const id = qoderAccountId(settingsPat);
			seen.add(id);
			out.push({
				id,
				accountName: "",
				source: "settings"
			});
		}
		const envPat = sources.envPat?.trim();
		if (envPat) {
			const id = qoderAccountId(envPat);
			if (!seen.has(id)) {
				seen.add(id);
				out.push({
					id,
					accountName: "",
					source: "env"
				});
			}
		}
		for (const stored of await this.vaultAccounts()) {
			if (seen.has(stored.id)) continue;
			seen.add(stored.id);
			out.push({
				id: stored.id,
				accountName: stored.accountName,
				source: "vault"
			});
		}
		return out;
	}
	/**
	* The PAT for one account id, from whichever source holds it.
	*
	* Resolving by id — rather than touching the region's selection — is what
	* lets a pool batch address every account while the user's chosen account
	* keeps serving traffic.
	*/
	async credentialFor(accountId, sources) {
		const settingsPat = sources.settingsPat?.trim();
		if (settingsPat && qoderAccountId(settingsPat) === accountId) return {
			id: accountId,
			accountName: "",
			source: "settings",
			pat: settingsPat
		};
		const envPat = sources.envPat?.trim();
		if (envPat && qoderAccountId(envPat) === accountId) return {
			id: accountId,
			accountName: "",
			source: "env",
			pat: envPat
		};
		const stored = (await this.vaultAccounts()).find((account) => account.id === accountId);
		return stored === void 0 ? void 0 : {
			id: stored.id,
			accountName: stored.accountName,
			source: "vault",
			pat: stored.pat
		};
	}
	/**
	* The credential that serves traffic right now.
	*
	* `selectedId` is the user's explicit per-region choice (`''`/undefined =
	* automatic). Automatic resolution follows source priority: settings PAT,
	* then env PAT, then the first vault entry. An explicit id that resolves to
	* nothing falls back to automatic rather than stranding the region — the
	* card reports `selectionLost` so the user sees why.
	*/
	async resolve(sources, selectedId) {
		if (selectedId !== void 0 && selectedId !== "") {
			const chosen = await this.credentialFor(selectedId, sources);
			if (chosen !== void 0) return chosen;
		}
		const settingsPat = sources.settingsPat?.trim();
		if (settingsPat) return {
			id: qoderAccountId(settingsPat),
			accountName: "",
			source: "settings",
			pat: settingsPat
		};
		const envPat = sources.envPat?.trim();
		if (envPat) return {
			id: qoderAccountId(envPat),
			accountName: "",
			source: "env",
			pat: envPat
		};
		const first = (await this.vaultAccounts())[0];
		return first === void 0 ? void 0 : {
			id: first.id,
			accountName: first.accountName,
			source: "vault",
			pat: first.pat
		};
	}
	/**
	* Add (or refresh) one vault entry. Keyed by the PAT-derived id: re-adding
	* the same token updates its name in place rather than duplicating it.
	*/
	async add(pat, accountName) {
		const entry = {
			id: qoderAccountId(pat),
			accountName,
			pat,
			addedAtMs: Date.now()
		};
		await this.mutate((accounts) => {
			const index = accounts.findIndex((account) => account.id === entry.id);
			if (index === -1) return [...accounts, entry];
			const next = [...accounts];
			next[index] = {
				...next[index],
				accountName: entry.accountName,
				pat: entry.pat
			};
			return next;
		});
		return entry;
	}
	/**
	* Remove one vault entry. Only vault entries are removable — the settings
	* and env PATs are managed outside the plugin. Returns whether anything
	* was actually removed.
	*/
	async remove(accountId) {
		let removed = false;
		await this.mutate((accounts) => {
			const next = accounts.filter((account) => account.id !== accountId);
			removed = next.length !== accounts.length;
			return next;
		});
		return removed;
	}
	/** Backfill a display name learned later (from a jobToken exchange). */
	async rename(accountId, accountName) {
		if (accountName === "") return;
		await this.mutate((accounts) => accounts.map((account) => account.id === accountId && account.accountName !== accountName ? {
			...account,
			accountName
		} : account));
	}
	/** Empty the vault. Used by the CLI's `logout`. */
	async clear() {
		await this.mutate(() => []);
	}
	/** One locked read-modify-write of the vault document. */
	async mutate(edit) {
		const path = qoderAccountsPath(this.region);
		await withFileLock(path, async () => {
			const accounts = edit(await this.vaultAccounts());
			await writeFileAtomic(path, `${JSON.stringify({
				version: VAULT_FORMAT_VERSION,
				accounts
			}, null, 2)}\n`, {
				mode: 384,
				dirMode: 448
			});
		});
	}
};
//#endregion
//#region src/version.ts
/** The npm package version this build was produced from. */
const QODER_CONNECT_VERSION = "1.16.4";
//#endregion
//#region src/account-pool-store.ts
/**
* The account pool's RUNTIME store: measured facts, on disk, outside settings.
*
* 参考：dingminhua/dsh-connect-workbuddy（MIT）的 `src/account-pool-store.ts`。
* 改动：文件名前缀换成本插件的 `.qoder-pool`；其余逐行沿用 —— 同一套
*   `$DSH_HOME` 落盘约定（`withFileLock` + `writeFileAtomic`、`0o600`）、
*   「观测数据与用户设置分开落盘」（否则卡片草稿保存会用几分钟前的草稿覆盖掉
*   探测结果）、以及「读写从不抛异常给调用方」。
*
* @module dsh-connect-qoder/account-pool-store
*/
/** On-disk format version; readers reject anything else. */
const STORE_FORMAT_VERSION = 1;
/** Filename prefix for one region's measured pool facts. */
const POOL_STORE_PREFIX = ".qoder-pool";
/** Whether a parsed value looks like a stored probe. */
function isProbe(value) {
	if (typeof value !== "object" || value === null) return false;
	const candidate = value;
	return typeof candidate["outcome"] === "string" && typeof candidate["atMs"] === "number" && (candidate["retryAtMs"] === void 0 || typeof candidate["retryAtMs"] === "number") && (candidate["message"] === void 0 || typeof candidate["message"] === "string") && (candidate["source"] === void 0 || typeof candidate["source"] === "string");
}
/** One region's path for measured pool facts. */
function qoderPoolStorePath(region) {
	return join(resolveDshHome(), `${POOL_STORE_PREFIX}.${region}.json`);
}
/**
* Read one region's measured facts.
*
* Returns an empty map for a missing, unreadable, malformed, or
* version-mismatched file: all four mean "nothing measured yet".
*/
async function readPoolProbes(region) {
	let raw;
	try {
		raw = await readFile(qoderPoolStorePath(region), "utf8");
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
		probes[accountId] = {
			outcome: probe.outcome,
			atMs: probe.atMs,
			...knownProbeSource(probe.source) === void 0 ? {} : { source: knownProbeSource(probe.source) },
			...probe.retryAtMs === void 0 ? {} : { retryAtMs: probe.retryAtMs },
			...knownQueue(probe.queue) === void 0 ? {} : { queue: knownQueue(probe.queue) },
			...probe.message === void 0 ? {} : { message: probe.message }
		};
	}
	return probes;
}
/**
* 落盘的排队信息，只保留形状对的那些字段（issue #26）。
*
* 形状不对就返回 undefined（**丢掉**而不是留半个对象）—— 半个对象读起来会像
* 「上游说队列里有 0 个人」，那不是上游说过的话。
*/
function knownQueue(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return void 0;
	const record = value;
	const count = record["queueCount"];
	const type = record["queueType"];
	const out = {};
	if (typeof count === "number" && Number.isFinite(count) && count >= 0) out.queueCount = count;
	if (typeof type === "string" && type !== "") out.queueType = type;
	return Object.keys(out).length === 0 ? void 0 : out;
}
/** A stored source string reduced to a source this build understands. */
function knownProbeSource(value) {
	return value === "test-batch" || value === "live-request" ? value : void 0;
}
/**
* Merge measurements into one region's store and write it atomically.
*
* A MERGE rather than a replace, because batches measure one account at a time
* and a partial failure must not erase what earlier runs learned. Never
* throws: a failed write loses only the newest measurements.
*/
async function writePoolProbes(region, updates) {
	if (Object.keys(updates).length === 0) return;
	const path = qoderPoolStorePath(region);
	try {
		await withFileLock(path, async () => {
			const existing = await readPoolProbes(region);
			const document = {
				version: STORE_FORMAT_VERSION,
				probes: {
					...existing,
					...updates
				}
			};
			await writeFileAtomic(path, `${JSON.stringify(document, null, 2)}\n`, {
				mode: 384,
				dirMode: 448
			});
		});
	} catch {}
}
//#endregion
//#region src/host-heartbeat.ts
/**
* Host-side heartbeat: a small JSON file written under `$DSH_HOME` once the
* `qoder` provider is registered. The status CLI reads it to report
* whether the host bundle is alive, independent of the browser card.
*
* 参考：corrinehu/dsh-workbuddy-connect（MIT，Copyright (c) 2026 Corrine Hu）
*   — 该机制由其设计：浏览器端无法写文件，其健康只能靠 console.error 上报，
*     因此由宿主写心跳文件，缺失即代表宿主从未启动；崩溃后的陈旧心跳
*     通过 PID 存活检查识别。
* 参考：dsh-connect-workbuddy（MIT，Copyright (c) 2026 LaoDing）的同名模块
* 改动：纯改名移植（WorkBuddy → Qoder，包名/版本常量/心跳文件名），机制、
*      `windowsHide`、PID 与 start-time 逻辑原样沿用。
*
* @module dsh-connect-qoder/host-heartbeat
*/
/** Basename of the host heartbeat file inside the Harness home. */
const QODER_HOST_HEARTBEAT_FILENAME = ".qoder-host-heartbeat.json";
/** Current on-disk heartbeat format; readers reject others. */
const HEARTBEAT_FORMAT_VERSION = 1;
/** Absolute path of the host heartbeat file. */
function qoderHostHeartbeatPath() {
	return join(resolveDshHome(), QODER_HOST_HEARTBEAT_FILENAME);
}
/**
* Spawn options every external probe in this module is run with.
*
* `windowsHide` is REQUIRED here, not cosmetic. Windows hands a console-program
* child a brand-new console window whenever its PARENT has none — and the
* parent frequently has none: the DSH Desktop host is an Electron GUI process
* (`MainWindowHandle = 0`, verified on the live host), as are Task Scheduler
* jobs and CI services. That window is created VISIBLE, so every start-time
* probe would flash a black box on the user's screen.
*
* Evidence (real Windows 11, parent created console-less through the WMI
* service — the same condition as the Electron host; the child reports the
* console it actually owns):
*
*   - without `windowsHide`: `NEW-console hwnd=1573500 visible=True`
*   - with `windowsHide: true`: `no-console`
*
* Invoked from a terminal the parent HAS a console and the child simply
* inherits it (no new window), which is why this never showed up in local
* runs — the same blind spot `docs/WINDOWS.md` §0 describes. The sibling call
* site `src/at-rest.ts` (the at-rest key fetch) already sets this option; this
* module did not, and that inconsistency is what the test pins.
*
* On POSIX the option is ignored.
*/
const PROCESS_PROBE_OPTIONS = {
	encoding: "utf8",
	windowsHide: true
};
/**
* The command one start-time probe runs, per platform.
*
* Split out as a value so the spawn can be asserted WITHOUT a Windows machine:
* `tests/host-heartbeat.spec.ts` checks the platform branch and the options
* object directly, which is the only way a Windows-only spawn defect here can
* be caught on the macOS development machine (§0: not "unreproduced" but
* "impossible to reproduce").
*
* `platform` is injectable for the same reason, in the same spirit as
* `defaultDesktopAuthDirs()` and `qoderAppExecutableCandidates()`.
*/
function processStartProbe(pid, platform = process.platform) {
	if (platform === "win32") return {
		file: "powershell",
		args: [
			"-NoProfile",
			"-NonInteractive",
			"-Command",
			`(Get-Process -Id ${pid} -ErrorAction SilentlyContinue).StartTime.ToUniversalTime().ToString('o')`
		]
	};
	return {
		file: "ps",
		args: [
			"-o",
			"lstart=",
			"-p",
			String(pid)
		]
	};
}
/**
* Process start time in epoch milliseconds; undefined when unavailable.
*
* POSIX reads `ps -o lstart=`; Windows has no such command, so the creation
* time is taken from PowerShell's `Get-Process` StartTime, emitted as UTC ISO
* 8601 so `Date.parse` understands it without locale assumptions. Absent or
* unqueryable processes (other users' processes) degrade to undefined.
*/
function processStartTimeMs(pid) {
	try {
		const probe = processStartProbe(pid);
		const output = execFileSync(probe.file, probe.args, PROCESS_PROBE_OPTIONS);
		const parsed = Date.parse(output.trim());
		return Number.isFinite(parsed) ? parsed : void 0;
	} catch {
		return;
	}
}
/**
* Whether the recorded host process still matches the heartbeat's PID.
*
* A PID can be reused after a crash, so the recorded start time is compared
* against the live process: a different start time means a different process.
*/
function isHeartbeatProcessAlive(heartbeat) {
	if (!Number.isInteger(heartbeat.pid) || heartbeat.pid <= 0) return false;
	try {
		process.kill(heartbeat.pid, 0);
	} catch {
		return false;
	}
	const startedAt = processStartTimeMs(heartbeat.pid);
	if (startedAt === void 0) return true;
	return Math.abs(startedAt - heartbeat.registeredAt) < 6e4;
}
/** Read the heartbeat; absent or unparsable files report undefined. */
async function readHostHeartbeat() {
	try {
		const parsed = JSON.parse(await readFile(qoderHostHeartbeatPath(), "utf8"));
		if (typeof parsed !== "object" || parsed === null) return void 0;
		const document = parsed;
		if (document["version"] !== HEARTBEAT_FORMAT_VERSION) return void 0;
		if (document["package"] !== "dsh-connect-qoder") return void 0;
		const pid = document["pid"];
		const registeredAt = document["registeredAt"];
		if (typeof pid !== "number" || typeof registeredAt !== "number") return void 0;
		return {
			version: HEARTBEAT_FORMAT_VERSION,
			package: "dsh-connect-qoder",
			pluginVersion: typeof document["pluginVersion"] === "string" ? document["pluginVersion"] : QODER_CONNECT_VERSION,
			registeredAt,
			pid
		};
	} catch {
		return;
	}
}
/** Write the heartbeat for the current process. */
async function writeHostHeartbeat() {
	const heartbeat = {
		version: HEARTBEAT_FORMAT_VERSION,
		package: "dsh-connect-qoder",
		pluginVersion: QODER_CONNECT_VERSION,
		registeredAt: Date.now(),
		pid: process.pid
	};
	await writeFile(qoderHostHeartbeatPath(), `${JSON.stringify(heartbeat, null, 2)}\n`, { mode: 384 });
}
/** Remove the heartbeat; called when the plugin is disposed. */
async function clearHostHeartbeat() {
	await rm(qoderHostHeartbeatPath(), { force: true });
}
//#endregion
export { QODER_POOL_PATH as A, poolAccountIdOf as B, isRouterModelId as C, QODER_CAMPAIGNS_PATH as D, QODER_ACCOUNT_CREDITS_PATH as E, QODER_SETTINGS_NS as F, deriveFingerprint as G, regionOfStatusUrl as H, QODER_TRANSFER_PATH as I, QODER_USAGE_PATH as L, QODER_REGIONS$1 as M, QODER_REGION_TRANSFER_DOMAIN as N, QODER_GITHUB_URL as O, QODER_SAVE_PATH as P, accountActionOf as R, imageDefaultFor as S, QODER_ACCOUNTS_REFRESH_PATH as T, transferActionOf as U, poolActionOf as V, unwrapVolatileDeep as W, piAiRuntimeInfo as _, writeHostHeartbeat as a, QoderUpstreamError as b, writePoolProbes as c, qoderAccountsPath as d, QODER_PAT_ENV_VARS as f, qoderAccountId as g, patFromEnv as h, readHostHeartbeat as i, QODER_PROBE_PATH as j, QODER_MODELS_REFRESH_PATH as k, QODER_CONNECT_VERSION as l, maskPat as m, isHeartbeatProcessAlive as n, qoderPoolStorePath as o, isQoderAccountId as p, qoderHostHeartbeatPath as r, readPoolProbes as s, clearHostHeartbeat as t, QoderAccountStore as u, QODER_REGIONS as v, QODER_ACCOUNTS_PATH as w, isQoderUpstreamError as x, QoderUpstreamClient as y, fastDetailOf as z };
