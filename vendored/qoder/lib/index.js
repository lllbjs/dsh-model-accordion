import { A as QODER_POOL_PATH, B as poolAccountIdOf, C as isRouterModelId, D as QODER_CAMPAIGNS_PATH, E as QODER_ACCOUNT_CREDITS_PATH, F as QODER_SETTINGS_NS, H as regionOfStatusUrl, I as QODER_TRANSFER_PATH, L as QODER_USAGE_PATH, M as QODER_REGIONS, O as QODER_GITHUB_URL, P as QODER_SAVE_PATH, R as accountActionOf, S as imageDefaultFor, T as QODER_ACCOUNTS_REFRESH_PATH, U as transferActionOf, V as poolActionOf, W as unwrapVolatileDeep, _ as piAiRuntimeInfo, a as writeHostHeartbeat, b as QoderUpstreamError, c as writePoolProbes, g as qoderAccountId, h as patFromEnv, j as QODER_PROBE_PATH, k as QODER_MODELS_REFRESH_PATH, l as QODER_CONNECT_VERSION, m as maskPat, p as isQoderAccountId, s as readPoolProbes, t as clearHostHeartbeat, u as QoderAccountStore, w as QODER_ACCOUNTS_PATH, x as isQoderUpstreamError, y as QoderUpstreamClient, z as fastDetailOf } from "./host-heartbeat-CNzgGURF.js";
import { readLocalLogin, listLocalLogins, resolveLocalLogin, LocalLoginLedger, LOCAL_LOGIN_SOURCE, LOCAL_LOGIN_KIND, isLocalLoginAccountId, readAppStatus } from "./local-login.js";
import z from "@deepseek-ai/schemastery";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { createProvider } from "@earendil-works/pi-ai";
import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy";
import { resolveRetryPolicy } from "@deepseek-ai/dsh-llm";
import { PiAiAdapter } from "@deepseek-ai/dsh-llm-pi-ai";
//#region src/failover-notice.ts
/**
* 每种失败对用户该怎么讲。
*
* 键必须覆盖 `UpstreamErrorKind` 全集；`satisfies Record<…>` 让上游新增 kind
* 时这里**编译期报错**，而不是运行时悄悄走到兜底分支。
*/
const REASON_TEXT = {
	network: "网络中断",
	auth: "凭证已失效",
	"rate-limited": "被限流",
	"invalid-request": "请求被上游拒绝",
	"content-policy": "触发内容策略",
	"quota-exhausted": "当日用量已达上限",
	transient: "上游暂时异常",
	unknown: "上游返回了无法识别的失败"
};
/** 失败种类的用户可读理由。未知 kind 走中性兜底，不编造。 */
function failoverReasonText(kind) {
	return REASON_TEXT[kind] ?? REASON_TEXT.unknown;
}
/**
* 排队这一档的专属说法（issue #26）。
*
* 排队在 kind 那一层是 `transient`（上游业务码 10605），所以光看 kind 只能说
* 「上游暂时异常」—— 而上游逐字说的是「在排队，服务是好的」。这两句对用户的
* 行动指导完全不同：前者像是要等，后者是「等 30 秒就好，账号没坏」。
*/
const QUEUE_REASON_TEXT = "上游排队中";
/**
* 排队时的换号提示正文（issue #26）。
*
* 与 {@link failoverNoticeText} 同构，只是理由换成「上游排队中」。
*/
function queuedFailoverNoticeText(failed) {
	return `「${accountLabelOf(failed.accountName, failed.accountId)}」${QUEUE_REASON_TEXT}，已改用池中另一个账号回答。`;
}
/**
* 账号在提示里怎么称呼。
*
* 账号名可能为空（env 路径下 `accountName` 是空串），也可能就是内部 id。
* 空名时退回 id；两者都空时用中性说法，绝不出现「「」被限流」这种空书名号。
*/
function accountLabelOf(accountName, accountId) {
	const name = accountName.trim();
	if (name !== "") return name;
	const id = accountId.trim();
	if (id !== "") return id;
	return "所选账号";
}
/**
* 换号提示正文（不含任何前缀、不含换行）。
*
* 是否该显示由调用方判断——见 `shouldAnnounceFailover`。
*/
function failoverNoticeText(failed, kind) {
	return `「${accountLabelOf(failed.accountName, failed.accountId)}」${failoverReasonText(kind)}，已改用池中另一个账号回答。`;
}
/**
* 这次失败要不要向用户播报。
*
* 只播报**真正换成了另一个账号**的情况。以下几种都不播报：
*
* - 池没启用 / 没有任何账号被换过（`switched === false`）；
* - 拿不到失败原因（换号逻辑没告诉我们是哪种失败）；
* - 新旧账号相同（等价于没换）。
*
* 提取成纯函数而非内联判断，是为了让测试能钉住「什么情况下不提示」——内联
* 的闭包此前有过悄悄失去可验证性的记录。
*/
function shouldAnnounceFailover(input) {
	if (!input.switched) return false;
	if (input.kind === void 0) return false;
	if (input.fromAccountId === "") return false;
	return input.fromAccountId !== input.toAccountId;
}
//#endregion
//#region src/promo.ts
/** 读取一个非空、非全空白的字符串。 */
function text(value) {
	if (typeof value !== "string") return void 0;
	const trimmed = value.trim();
	return trimmed === "" ? void 0 : trimmed;
}
/** 读取一个有限数。 */
function number(value) {
	return typeof value === "number" && Number.isFinite(value) ? value : void 0;
}
/** 读取一个双语字段；两边都没有时返回 undefined。 */
function label(value) {
	if (value === null || typeof value !== "object" || Array.isArray(value)) return void 0;
	const raw = value;
	const zh = text(raw["zh"]);
	const en = text(raw["en"]);
	if (zh === void 0 && en === void 0) return void 0;
	return {
		...zh === void 0 ? {} : { zh },
		...en === void 0 ? {} : { en }
	};
}
/**
* `HH:MM` → 当天分钟数。
*
* 起点只接受 0–23 时、0–59 分；**终点额外接受 `24:00`**（那是「到当天结束」的常见
* 写法，映射成 1440，判定时正好等价于 `[start, 24:00)`）。其余越界/写坏的值返回
* `undefined`：一份读不懂的窗口不该被解释成任何一个方向，由调用方标记成
* `windowUnreadable` 并停止画。
*/
function clockMinute(value, role = "start") {
	const match = /^(\d{1,2}):(\d{2})$/u.exec(value.trim());
	if (match === null) return void 0;
	const hour = Number(match[1]);
	const minute = Number(match[2]);
	if (role === "end" && hour === 24 && minute === 0) return 1440;
	if (hour > 23 || minute > 59) return void 0;
	return hour * 60 + minute;
}
/** 解析上游的时段；两端都读得懂才算有窗口。 */
function parsePromoWindow(startRaw, endRaw) {
	const start = text(startRaw);
	const end = text(endRaw);
	if (start === void 0 || end === void 0) return void 0;
	const startMinute = clockMinute(start);
	const endMinute = clockMinute(end, "end");
	if (startMinute === void 0 || endMinute === void 0) return void 0;
	return {
		start,
		end,
		startMinute,
		endMinute
	};
}
/**
* 解析上游的 `promotion` 对象。
*
* 丢弃的判据很干脆：没有 `badge.zh` 也没有 `badge.en` 的条目一律不要——那意味着
* 上游没有给出可显示的话，插件没有可画的东西（也不该自己编）。`active` / 规则
* 字段缺失时只是「此刻不画」，条目本身仍保留：规则是上游目录里的一份事实，丢了
* 会让落盘往返悄悄少一段上游声明，也让 `scripts/probe-promo.mjs` 这类复核失去依据。
*
* 实测形状（`qmodel_38max`，截断）：
* ```json
* { "active": false, "rule_id": "idle_time_model_credit_discount",
*   "discount_factor": 0.4, "before_promotion_price_factor": 0.5,
*   "badge": { "zh": "错峰 4 折", "en": "Off-Peak 60% off" },
*   "timezone": "Asia/Shanghai", "window_start": "22:00", "window_end": "08:00",
*   "link_url": { "zh": "https://docs.qoder.cn/..." }, "description": { "zh": "..." } }
* ```
*
* `discount_factor` / `before_promotion_price_factor` / `rule_id` 不保留：插件不从数字
* 反推文案，也没有任何界面消费它们，留一份没人读的副本只会随目录一起落盘。
*/
function parseQoderPromotion(value) {
	if (value === null || typeof value !== "object" || Array.isArray(value)) return void 0;
	const raw = value;
	const badge = label(raw["badge"]);
	if (badge === void 0) return void 0;
	const description = label(raw["description"]);
	const link = label(raw["link_url"]);
	const timeZone = text(raw["timezone"]);
	const window = parsePromoWindow(raw["window_start"], raw["window_end"]);
	const declared = text(raw["window_start"]) !== void 0 || text(raw["window_end"]) !== void 0;
	const unreadable = window === void 0 && declared;
	return {
		active: raw["active"] === true,
		badge,
		...description === void 0 ? {} : { description },
		...link === void 0 ? {} : { link },
		...timeZone === void 0 ? {} : { timeZone },
		...window === void 0 ? {} : { window },
		...unreadable ? { windowUnreadable: true } : {}
	};
}
/**
* 把**已落盘**的条目读回一条规则（`catalog` 的持久化往返）。
*
* 与 `parseQoderPromotion` 分开，是因为落盘形状是上面这个 camelCase 的
* `QoderPromotion`，不是上游的 snake_case：同一份 schema 若在两处各写一遍解析，
* 迟早漂移（workbuddy 的 `modelFromStored` 就是被这样咬过一次）。这里只做形状
* 校验，值原样返回。
*/
function readPromotion(value) {
	if (value === null || typeof value !== "object" || Array.isArray(value)) return void 0;
	const raw = value;
	const badge = raw["badge"];
	if (badge === null || typeof badge !== "object" || Array.isArray(badge)) return void 0;
	const badgeText = badge;
	if (text(badgeText["zh"]) === void 0 && text(badgeText["en"]) === void 0) return void 0;
	const promo = {
		active: raw["active"] === true,
		badge: {
			...text(badgeText["zh"]) === void 0 ? {} : { zh: text(badgeText["zh"]) },
			...text(badgeText["en"]) === void 0 ? {} : { en: text(badgeText["en"]) }
		}
	};
	const description = label(raw["description"]);
	if (description !== void 0) promo.description = description;
	const link = label(raw["link"]);
	if (link !== void 0) promo.link = link;
	const timeZone = text(raw["timeZone"]);
	if (timeZone !== void 0) promo.timeZone = timeZone;
	const window = raw["window"];
	if (window !== null && typeof window === "object" && !Array.isArray(window)) {
		const rawWindow = window;
		const start = text(rawWindow["start"]);
		const end = text(rawWindow["end"]);
		const startMinute = number(rawWindow["startMinute"]);
		const endMinute = number(rawWindow["endMinute"]);
		if (start !== void 0 && end !== void 0 && startMinute !== void 0 && endMinute !== void 0 && clockMinute(start) === startMinute && clockMinute(end, "end") === endMinute) promo.window = {
			start,
			end,
			startMinute,
			endMinute
		};
		else promo.windowUnreadable = true;
	}
	if (promo.window === void 0 && raw["windowUnreadable"] === true) promo.windowUnreadable = true;
	return promo;
}
//#endregion
//#region src/catalog.ts
const QODER_FALLBACK_MODELS = [
	{
		key: "qmodel_latest",
		displayName: "Qwen3.7-Max",
		isVl: true,
		isReasoning: true,
		maxInputTokens: 2e5
	},
	{
		key: "qmodel_preview",
		displayName: "Qwen3.8-Max-Preview",
		isVl: true,
		isReasoning: true,
		maxInputTokens: 2e5
	},
	{
		key: "qmodel",
		displayName: "Qwen3.7-Plus",
		isVl: true,
		isReasoning: true,
		maxInputTokens: 2e5
	},
	{
		key: "q36fmodel",
		displayName: "Qwen3.6-Flash",
		isVl: true,
		isReasoning: true,
		maxInputTokens: 2e5
	},
	{
		key: "dmodel",
		displayName: "DeepSeek-V4-Pro",
		isVl: true,
		isReasoning: true,
		maxInputTokens: 2e5
	},
	{
		key: "dfmodel",
		displayName: "DeepSeek-V4-Flash",
		isVl: true,
		isReasoning: true,
		maxInputTokens: 2e5
	},
	{
		key: "gm51model",
		displayName: "GLM-5.2",
		isVl: true,
		isReasoning: true,
		maxInputTokens: 2e5
	},
	{
		key: "kmodel",
		displayName: "Kimi-K2.7-Code",
		isVl: true,
		isReasoning: true,
		maxInputTokens: 256e3
	},
	{
		key: "mmodel",
		displayName: "MiniMax-M2.7",
		isVl: false,
		isReasoning: true,
		maxInputTokens: 2e5
	}
];
/** 从 context_config 档位表提取升序 token 档位（无档位返回 undefined）。 */
function contextTiersOf(raw) {
	const cc = raw.context_config;
	if (!cc) return void 0;
	const counts = Object.values(cc).map((v) => v.token_count).filter(Number.isFinite);
	if (counts.length === 0) return void 0;
	return [...new Set(counts)].sort((a, b) => a - b);
}
/**
* 档位改写表：上游声明的 400K 档一律按 **500K** 呈现与保存（用户要求，2026-10-24）。
*
* 为什么改在解析边界：档位表只有一个写点（`parseUpstreamModel`）与一个存档读点
* （`modelFromStored`），在这里改写，卡片下拉、usage 投影、落盘往返、运行期预算
* 四处拿到的就是同一份改写后的表——在渲染层改只会让「下拉里的选项」与「保存后
* 生效的窗口」重新变成两张表。上游哪天真的改口发 500K，这张表变成恒等映射，
* 不需要再动任何读点。
*
* 档位是**插件本地的上下文预算**（聊天请求体里没有任何上下文字段，实测
* `createChatBodyTemplate`），所以改写只影响 DSH 侧的预算选择与显示，不替上游
* 承诺它没声明的窗口。
*/
const QODER_CONTEXT_TIER_OVERRIDES = /* @__PURE__ */ new Map([[4e5, 5e5]]);
/** 单个档位值过改写表；表里没有的原样返回。 */
function mapContextTier(value) {
	return QODER_CONTEXT_TIER_OVERRIDES.get(value) ?? value;
}
/** 整张档位表过改写表（去重 + 升序，防止上游同时声明 400K 与 500K 时出现重项）。 */
function mapContextTiers(tiers) {
	return [...new Set(tiers.map(mapContextTier))].sort((a, b) => a - b);
}
/**
* 已保存的预算过改写表：旧存档里的 400K 选择读回时就是 500K。
*
* 不做这一步，升级前勾了 400K 的人会在下拉里看到一个「不在选项里的选中值」——
* `<select>` 的 value 命中不了任何 option，界面只会显示成空白或第一项，比没迁移
* 更糟。
*/
function migrateContextBudgets(budgets) {
	const out = {};
	for (const [key, value] of Object.entries(budgets)) out[key] = mapContextTier(value);
	return out;
}
/** 强度语义排序用的序表（`max` 与 `xhigh` 同属"最强"档，都排最后）。 */
const EFFORT_ORDER = [
	"minimal",
	"low",
	"medium",
	"high",
	"xhigh",
	"max"
];
/**
* 从 `thinking_config` 提取可选档位。
*
* 实测形状（qmodel_38max）：
*   `{ disabled: {}, enabled: { is_default: true,
*      efforts: { xhigh: {}, low: {}, medium: { is_default: true } } } }`
*
* 两个要点：
* - **键序不可信**：上游给的顺序是 `xhigh, low, medium`，直接显示会让用户
*   以为 xhigh 是最弱档。按语义序表排。
* - **不是每个模型都有档位**：`qmodel_latest`、`mmodel` 等 `efforts` 缺失，
*   此时返回空对象（字段缺席），卡片据此不渲染这一项——而不是渲染一个空标签。
*   （这一条也是 `auto` 曾经最难解释的地方：它是唯一天生没有档位、却常被当作
*   默认模型勾上的条目；现在它按路由器被整个丢掉了。）
*/
function thinkingOf(config) {
	const enabled = config?.["enabled"];
	if (enabled === null || enabled === void 0 || typeof enabled !== "object") return {};
	const efforts = enabled["efforts"];
	if (efforts === null || typeof efforts !== "object" || Array.isArray(efforts)) return {};
	const names = Object.keys(efforts);
	if (names.length === 0) return {};
	const sorted = [...names].sort((a, b) => {
		const ia = EFFORT_ORDER.indexOf(a);
		const ib = EFFORT_ORDER.indexOf(b);
		if (ia === -1 && ib === -1) return a.localeCompare(b);
		if (ia === -1) return 1;
		if (ib === -1) return -1;
		return ia - ib;
	});
	const declared = sorted.find((name) => {
		const entry = efforts[name];
		return entry !== null && typeof entry === "object" && entry["is_default"] === true;
	});
	return {
		thinkingEfforts: sorted,
		...declared === void 0 ? {} : { defaultThinkingEffort: declared }
	};
}
/**
* 该条目**是否支持思考**：上游的 `thinking_config` 说了算，`is_reasoning` 只作
* 补充。任一为真即成立。
*
* 为什么不能只看 `is_reasoning`（issue #1「不能调节推理等级」的根因）：实测两个
* 区域的 `model/list` 里 `is_reasoning` 与 `thinking_config` **自相矛盾**，而且
* 同一个模型换个区域就翻转 ——
*
* | 区域   | key             | `is_reasoning` | `efforts`          |
* | ------ | --------------- | -------------- | ------------------ |
* | cn     | `dfmodel`       | false          | low / high / max   |
* | cn     | `kmodel_latest` | false          | low / high / max   |
* | global | `performance`   | false          | low / medium / high / xhigh / max |
* | global | `kmodel_latest` | false          | low / high / max   |
* | global | `kmodel`        | false          | low / high / max   |
*
* 还有 `dfmodel`（cn false / global true）、`qmodel`、`qmodel_latest`、`auto`
* （cn true / global false）—— 同一模型两边声明相反，说明 `is_reasoning` 是上游
* 侧的配置漂移，不是模型能力。而 `thinking_config` 给全了默认档、逐档
* `is_default` 与 `disabled` 描述，是一份**完整**的推理配置；它声明了档位，就
* 一定支持强度选择。采信 `is_reasoning:false` 的结果就是这些模型在 DSH 里连
* 思考强度控件都不渲染（用户实拍）。
*
* 方向的偏置是刻意的：只把 false 补成 true，**绝不**把 true 降成 false（实测
* 29 条目录中 5 条改变，24 条不动，0 条反向回退）。`efforts` 缺失的条目
* （`auto`、`efficient`、`qmodel` 等）保持 `is_reasoning` 原值，不会被误开。
*
* 上面表与下面这段是**实测记录**，保留了观测当时的原名（含 `auto`）。其中 `auto`
* 现在已按路由器被整个丢掉（见 `ROUTER_MODEL_IDS`），到不了这个函数；但记录不改：
* 它证明的是「`is_reasoning` 与 `thinking_config` 会互相矛盾」这件事，抹掉它反而
* 让这张表看起来比当时的证据更干净。
*/
function supportsThinkingOf(raw) {
	if (raw.is_reasoning) return true;
	return thinkingOf(raw.thinking_config).thinkingEfforts !== void 0;
}
/**
* 该条目**能否关闭思考**：`thinking_config.disabled` 存在，或它被声明为推理
* 模型——此时「不能关」是一句反事实的断言，不采信（同一处数据漂移的另一面）。
*
* 上游真正做不到时，用户勾选后的一次请求会失败并被如实报出；而按 `is_reasoning`
* 藏起一个本可用的 off 档，代价是用户**永远**没有这个选项（与
* `src/off-thinking.ts` 的取舍方向一致：宁可多提供，因为它可撤回）。
*
* 注意顺序：这里用的是**修正后**的 `supportsThinking`，所以像 global 的
* `qmodel` / `qmodel_latest` / `kmodel` 这类「`disabled` 有、`efforts` 没有」
* 的条目也能拿到 off 档。
*/
function canDisableThinkingOf(raw, supportsThinking) {
	return raw.thinking_config?.disabled !== void 0 || supportsThinking;
}
/** 把上游 snake_case 条目解析成 DSH 侧模型信息。 */
function parseUpstreamModel(raw) {
	const contextWindow = mapContextTier(pickDefaultContextWindow(raw) ?? raw.max_input_tokens ?? 2e5);
	const tiers = contextTiersOf(raw);
	const reasoning = thinkingOf(raw.thinking_config);
	const supportsThinking = supportsThinkingOf(raw);
	const promotion = parseQoderPromotion(raw.raw["promotion"]);
	return {
		key: raw.key,
		displayName: raw.display_name,
		priceFactor: raw.price_factor ?? 1,
		contextWindow,
		maxOutputTokens: raw.max_output_tokens ?? 32768,
		supportsImages: raw.is_vl,
		supportsThinking,
		canDisableThinking: canDisableThinkingOf(raw, supportsThinking),
		...reasoning,
		isDefault: raw.is_default,
		isFree: raw.is_free === true,
		isNew: false,
		...tiersField(tiers === void 0 ? void 0 : mapContextTiers(tiers)),
		...promotion === void 0 ? {} : { promotion }
	};
}
/** 从 context_config 档位表选默认档（is_default=true，否则取 token_count 最小者）。 */
function pickDefaultContextWindow(raw) {
	const cc = raw.context_config;
	if (!cc) return void 0;
	const entries = Object.entries(cc);
	if (entries.length === 0) return void 0;
	const def = entries.find(([, v]) => v.is_default === true);
	if (def) return def[1].token_count;
	return Math.min(...entries.map(([, v]) => v.token_count));
}
/** `contextTiers` 的可选字段投影（undefined 时略去字段，避免写入 undefined）。 */
function tiersField(tiers) {
	return tiers === void 0 || tiers.length <= 1 ? {} : { contextTiers: tiers };
}
/** 把 fallback 条目解析成模型信息。 */
function fallbackModelInfo(m) {
	return {
		key: m.key,
		displayName: m.displayName,
		priceFactor: m.priceFactor ?? 1,
		contextWindow: m.maxInputTokens ?? 2e5,
		maxOutputTokens: m.maxOutputTokens ?? 32768,
		supportsImages: m.isVl,
		supportsThinking: m.isReasoning,
		canDisableThinking: true,
		isDefault: false,
		isFree: false,
		isNew: false
	};
}
/**
* 应用用户保存的每模型上下文档位。
*
* Qoder 的窗口是**档位选择**而非任意上限：一模型说得出几个 `context_config`
* 档，用户保存的预算就只能在档位里挑（选了不在档位里的值没有效果，保持原生）。
* 这样卡片渲染的 `<select>` 选项与运行期生效的窗口永远一致 —— 不会出现存档里
* 存了 200K 而该模型根本没这个档的时候，运行期悄悄用别的东西。
*
* `contextWindow` 不降反升的情形只可能发生在档位表的**原生档**高于默认窗口时
* （例如默认档 96K、另有一档 400K），此时按档位选择是诚实的用户决定。
*/
function applyContextBudgets(catalog, budgets = {}) {
	return catalog.map((model) => {
		const chosen = budgets[model.key];
		if (model.contextTiers === void 0 || chosen === void 0) return model;
		return model.contextTiers.includes(chosen) ? {
			...model,
			contextWindow: chosen
		} : model;
	});
}
/**
* 模型显示名：内嵌积分倍率（与 Qoder 自身菜单格式一致——倍率为 1 也照写，
* `Qwen3.7-Max · x1.00`）。workbuddy 的选择器同名规则同样不省略 1。
*/
function modelDisplayName(info) {
	return `${info.displayName} · x${info.priceFactor.toFixed(2)}`;
}
/**
* 目录派生：目录 ∩ 勾选（workbuddy 的 `deriveCatalog` 同规）。
*
* **注册给 DSH 的模型 = 用户勾选的那些**。此前实现是「一律全部保留」，于是
* 无论用户在卡片里勾了几个，DSH 的模型选择器里都躺着整份上游目录（用户实拍：
* 「保存的模型，还是那么多」）——勾选形同虚设。
*
* `enabled` 为空是特例：**全不勾不等于全不选**，而是「还没选过」——此时把整份
* 目录交出去，否则新用户的选择器会是空的。这与 workbuddy 的
* `enabled.size === 0 ? catalog : catalog.filter(...)` 逐字同义。
*
* **勾了、但一条都没命中时也退回整份目录**（workbuddy 同一条守卫）。这不是
* 「宽容」，是修一个具体的坏形状：`auto` 路由器不再进名册之后，某个只勾过
* `auto` 的人，他的 `enabledModelKeys` 与目录交集为空——运行时目录于是变成空的，
* DSH 的选择器一个模型都没有，而且**没有任何报错**（issue #32 的故障形态：模型
* 静默消失）。退回整份目录至少让每个模型还能被看见、被重新勾选。
*
* 卡片自己的模型列表走的是另一条路（`catalog.current()`，始终是完整目录），
* 所以「未勾选的也要看得见、才勾得上」不受影响。
*/
function deriveCatalog(models, enabledKeys) {
	const selected = enabledKeys.size === 0 ? models : models.filter((model) => enabledKeys.has(model.key));
	return selected.length === 0 ? models : selected;
}
/**
* 把上游的**路由器**行从目录里去掉。
*
* `auto` 不是模型，是该区的默认路由（网关在请求时才决定解析成哪一个）。它
* 无法被如实标价、也没法说清上下文与档位，所以不该作为一个可勾选的模型出现。
*
* 为什么在两个地方都要过滤（这里是**读**点，`upstream.fetchModels` 是**写**点）：
* 静态兜底、实时拉取都经 `fetchModels`，但 `lastCatalog` 是**用户档案里的旧
* 快照**——上一版把它存进去的人，升级后每一次读（卡片的列表、运行时目录、注册
* 给 provider 的目录）都还会看到那一行，直到他下次刷新为止。在读点过滤而不是
* 迁移存档是刻意的：存档保持「上次刷新写下的原样」，加载时不悄悄改写用户数据，
* 而这一行在新代码跑起来的那一刻就消失，不必等下一次刷新。
*/
function withoutRouters(models) {
	return models.filter((model) => !isRouterModelId(model.key));
}
/**
* 初始勾选集合：目录中的默认模型 + 免费模型；其余不勾。
*
* `auto` 在这里**必须**再排除一次，尽管它已经不在目录里：曾经的默认项就是它
* （`isDefault: true`），所以「初始勾选」这条路上，一个恰好只剩路由器行的旧
* 目录会把它重新勾上，然后借下一行的 `deriveCatalog` 复活成 DSH 里唯一的模型。
*/
function initialEnabledKeys(models) {
	return new Set(models.filter((m) => !isRouterModelId(m.key) && (m.isDefault || m.isFree)).map((m) => m.key));
}
/**
* 一区域的当前目录。启动时以静态 fallback 填充（离线也能立刻有 provider），
* 上游目录拉取成功后整表替换；空结果不覆盖已有表。
*/
var QoderCatalog = class {
	models;
	constructor(initial) {
		this.models = initial;
	}
	current() {
		return this.models;
	}
	set(models) {
		if (models.length > 0) this.models = models;
	}
	/** 按 key 或显示名查找模型。 */
	find(selector) {
		return this.models.find((m) => m.key === selector || m.displayName === selector);
	}
	/** key 解析：优先内部 key，其次显示名；未知返回 undefined。 */
	keyOf(selector) {
		return this.find(selector)?.key;
	}
	supportsImagesOf(selector) {
		return this.find(selector)?.supportsImages ?? false;
	}
	isReasoningOf(selector) {
		return this.find(selector)?.supportsThinking ?? false;
	}
};
//#endregion
//#region src/off-thinking.ts
/**
* 已观察到**拒绝** `reasoning_effort: "off"`（HTTP 400）的模型 id，
* 即使它们声明了「可关闭思考」。
*
* 按精确 model id 键控，且刻意**不**按区域分：拒绝与否跟模型家族走，不跟网关走。
* 代价是不对称的——提供一个必然失败的档位，代价是用户该模型的**每一次**请求；
* 而藏起一个本可用的档位，代价只是少一个选项——所以本表宁可多藏。
* 知道得更清楚的用户可以显式覆盖（见 {@link effectiveOff}）。
*
* 现状为空：本项目尚未在 Qoder 网关上实测到拒绝样本。留空即「只信上游声明」，
* 这与本插件 0.1.0 的行为一致，属于**不倒退**的默认；一旦有实测样本，按上面的
* 键控规则补条目即可。
*/
const REFUSES_OFF_MODEL_IDS = /* @__PURE__ */ new Set([]);
/**
* 在用户没有表态时，是否应当为某模型提供 `off` 档：上游声明减去已知拒绝的 id。
*
* 只有上游**显式**声明可关闭（`canDisableThinking === true`）才开启该档；
* 缺失视为「未知」，保持不提供——与本插件对其它未声明能力的一贯处理一致。
*/
function offDefaultFor(info) {
	return info.canDisableThinking === true && !REFUSES_OFF_MODEL_IDS.has(info.key);
}
/**
* 默认应当提供 `off` 档的模型 id 集合。
*
* 用户的勾选框是一个普通集合：勾上=提供，取消=撤回。这里是**种子**——集合
* 第一次被读取时填入的内容——让从未保存过的 profile 立刻显示正确默认值，
* 而不必先保存一次。
*/
function defaultOffModelIds(models) {
	return models.filter(offDefaultFor).map((model) => model.key);
}
/**
* 把用户保存的 `off` 选择**盖印**到模型列表上，供**运行时**目录使用。
*
* 运行时描述符由适配器的 `qoderThinkingLevelMap` 构建，它只读模型自报的声明；
* 因此校正后的答案必须在模型抵达适配器之前写到模型上。放在这里可以让适配器
* 保持「声明进、档位表出」的纯函数，也让这张表紧挨着它所服务的规则。
*
* 这里**覆盖**声明字段而不是新增兄弟字段：该声明只有这一个消费者（同一张档位
* 表），且从不被持久化到卡片能看到的地方（`toWebModel` 会丢掉
* `canDisableThinking`，卡片的 `lastCatalog` 来自上游原始发现，而非这份盖印
* 结果）。未声明推理的模型原样返回——没有档位需要校正。
*/
function withEffectiveOff(models, selection) {
	return models.map((model) => {
		if (model.supportsThinking !== true) return model;
		return {
			...model,
			canDisableThinking: selection.has(model.key)
		};
	});
}
/** 便捷投影：把目录条目转成本模块需要的两个字段。 */
function offCapabilityOf(info) {
	return {
		key: info.key,
		supportsThinking: info.supportsThinking,
		canDisableThinking: info.canDisableThinking
	};
}
//#endregion
//#region src/shim.ts
/**
* Qoder 回环 shim：进程内 HTTP 服务（127.0.0.1 随机端口）。
*
* 安全模型与 dsh-connect-workbuddy 一致（参考其 `src/shim.ts`）：
* - 随机端口 + 进程内 32 字节随机 secret（pi-ai 只拿到 secret 当 apiKey，
*   真实的 Qoder 凭据绝不交给 pi-ai）；
* - Host / Origin / Content-Type 三重入站校验（必须在路由判定之前），
*   请求体有 64MB 上限；
* - 常量时间比对 Authorization。
*
* 职责：把 pi-ai 的 OpenAI 聊天请求翻译成 Qoder 网关请求，并把 Qoder 的
* OpenAI 形状 SSE 原样转发为 OpenAI chunks；错误分类映射为 DSH 可判定的
* HTTP 状态 + error.code。
*
* 首字节之前的失败一律回 **非 200 的 JSON 错误**（不是 SSE 错误帧）：pi-ai
* 的 openai-completions 客户端只认非 2xx 响应体的 `error.message/code`，
* 对 200 流里的 `error` 字段完全不读（chunk 循环只取 `choices[0]`，
* `finish_reason:"error"` 会被塌缩成一句无信息的 "Provider finish_reason:
* error"）。只有 JSON 错误能把真实的 kind/code 送进宿主的分类器。
*
* 账号池故障转移（参考 dsh-connect-workbuddy 的 `src/shim.ts` 相同模式）：
* - 每次请求先 `resolveServing()` 解析**本次该买单的账号**——就是用户显式
*   选中的号（缺省落到 `credential()` 的默认解析：settings → env → 首个
*   vault）；账号池的排序**不参与第一发**，它只在下面的接管路径里出场；
* - 首块字节写出前若上游硬拒（auth / 限流 / 额度 / 瞬时），记录该账号的失败
*   （`onServingFailure` → live-request 写回账号池），间隔
*   `failoverGapMs`（默认 2s，可中断）后再 `failoverAccount()` 取下一个候选
*   重试 —— **只在未写任何 SSE 前重试**，一旦首个 delta 已转发，之后的错误
*   原样进流（不回放、不换号）；策略层若重复返回已试过的账号，shim 侧也刹车；
* - 客户端中途断开（响应流 close）会中止上游请求，且**不**为该次失败记测量
*   （那是断开，不是账号的错）；
* - 被账号池接管时，首个内容帧以引用块前缀说明「本次由账号池账号 X 服务」
*   （必须走 `choices[0].delta.content`——空 choices 的自定义帧会被 pi-ai
*   直接跳过，用户将完全看不到换号）。
*
* @module dsh-connect-qoder/shim
*/
const CONTENT_TYPE_JSON = "application/json";
/** 请求体上限（workbuddy 同值）：长对话体可以很大，但必须有界。 */
const REQUEST_BODY_LIMIT = 67108864;
/**
* 换号重试前的间隔（workbuddy 同值）。
*
* 上游限流按请求体积触发：零间隔连环重试会让每个候选账号都撞上同一堵墙
* （4 个账号一秒内全部失败）。批量测试已在账号间等 400ms
* （`POOL_BATCH_GAP_MS`）；故障转移重试是用户正在等的真实请求，给上游窗口
* 更多喘息空间。等待是可中断的：客户端断开就立刻停，而不是睡满全程。
*/
const FAILOVER_ACCOUNT_GAP_MS = 2e3;
/**
* 浏览器 Origin（存在时）必须指向回环。非浏览器客户端（插件自己的 fetch、
* pi-ai）根本不发 Origin，直接放行；DNS-rebinding 页面的 Host 可以伪造，
* 但 Origin 会暴露它的真实域名。
*/
function originIsLoopback(origin) {
	if (origin === void 0 || origin.trim() === "") return true;
	try {
		const { hostname } = new URL(origin);
		return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1" || hostname === "[::1]";
	} catch {
		return false;
	}
}
/**
* 写给宿主的 `code` 翻译表。
*
* 宿主（`@deepseek-ai/dsh-llm` + llm-pi-ai）从失败文案里读英文短语来决定
* 「原地重试（默认 5 次指数退避）」还是「跨供应商故障转移」：`RATE_LIMIT` /
* `SERVER` / `TIMEOUT` / `TRANSPORT` / `EMPTY_RESPONSE` 在原地重试集里。
*
* `rate-limited` 是那个被字面翻译害惨的 kind：上游 429 的冷却常常以小时计
* （探针从响应体里解析恢复时间），若按 `rate_limit_exceeded` 送达，宿主会把
* 整个重试预算烧在一个不可能在退避窗口内恢复的端点上。翻成 `quota_exceeded`
* 是宿主认得的词，也符合上游「此刻不可用」的实际语义；HTTP 状态保持 429
* 不动（那是上游真实返回的），上游自己的消息仍原文透传给人读。
*/
const KIND_HOST_CODE = { "rate-limited": "quota_exceeded" };
/** 首字节前失败写给宿主的 code（宿主按它分类）；流内错误帧仍用原 code。 */
function hostErrorCode(kind) {
	return KIND_HOST_CODE[kind] ?? ERROR_MAP[kind].code;
}
/**
* 净化写给宿主的失败文案里**裸的 401/403 数字**。
*
* 这是国际版「API 密钥无效」假警报的根因（用户实拍：对话报密钥无效、同一条
* 账号在卡片里却只是「用量已达上限」）。
*
* 宿主对 pi-ai 失败**不是**按 HTTP 状态分类，而是**对文案跑正则**
* （app.asar 内 `classifyPiAiError`）：
*
* ```js
* if (/\b(?:401|403)\b/.test(message)) return "AUTH";   // ← 第一道，命中即返回
* if (isQuotaExceededError(message)) return QUOTA_EXCEEDED;
* ```
*
* 而本插件为了溯源，一直把上游原文（含 `HTTP 403 {"code":"110",…}`）拼进这条
* 文案。于是**配额耗尽被第一道正则截走判成 AUTH**，宿主用中立文案
* `message.failure.auth`（「API 密钥无效」）覆盖掉提供方消息 —— 一个明天就
* 自动恢复的账号被读成凭据坏了。实测 `isQuotaExceededError` 对同一串文本是
* `true`：分类结果是**顺序**造成的，不是判据不认。
*
* 只替换**裸数字**，且只在非 auth 类上做：
* - `auth` 必须原文照送。上游真的吐 `401 TOKEN_EXPIRE` 时，AUTH 正是正确答案；
*   而「未配置 PAT」那条中文没有状态码，宿主会显示原文（比换成「API 密钥无效」
*   更有用），所以这一档**不做**任何装饰。
* - `429`/`5xx`/`400` 不受影响：`429 → RATE_LIMIT`、`5xx → SERVER`（原地重试）、
*   `400 → INVALID_REQUEST` 都是期望的分类。**状态码数字必须整词替换**，
*   否则 `1401`、`4030` 这类业务数字会被改坏（这是溯源信息）。
*
* 边界判据是**两条否定环视**（对抗审核 S1 发现 `\b` 不够）：
* - `(?<![\w.])` 左侧：数字/字母/下划线/句点之前不算独立状态码，于是 `1401`、
*   `v403`、`a403b`、`code_403` 全部保留；`code=403`、`HTTP 403 {` 仍然命中。
* - `(?!\d)(?!\.\d)` 右侧：后面跟数字或「小数点+数字」时不算，于是 `4030x` 保留、
*   **`401.5` 这种小数不再被改写成非法的 `4xx.5`**。句末句号（`HTTP 403.`）不受
*   影响，因为 `(?!\.\d)` 要求点后紧跟数字。
*
* 换成 `4xx` 而不是删掉数字：状态码是给人读的溯源信息，抹掉会让「为什么失败」
* 变得不可查 —— 这是本项目反复吃过亏的地方。
*/
function hostMessageText(kind, message) {
	if (kind === "auth") return message;
	return message.replace(SANITIZE_BARE_STATUS, "4xx");
}
/**
* 「裸的 401/403」的判据，只有一处定义 —— 前缀、正文、后缀都由它统一净化。
*
* 抽成常量而不是在三处各写一遍：净化一旦漏掉某一段拼接文本，那个数字就会绕过
* 它自己被送进宿主的正则分类器（前缀漏净化的那次回归就是这么来的）。
*/
const SANITIZE_BARE_STATUS = /(?<![\w.])(?:401|403)(?!\d)(?!\.\d)/gu;
/**
* 净化任意写给宿主的片段（前缀、正文、后缀都走它）。
*
* `auth` 档原文照送，所以调用方判断 kind 之后再决定要不要调它。
*/
function sanitizeForHost(text) {
	return text.replace(SANITIZE_BARE_STATUS, "4xx");
}
/**
* 写给宿主的**完整**失败文案：带 kind 名与状态码前缀，再统一净化。
*
* 为什么要带前缀：宿主只按正则猜分类，猜不中就落到 `TRANSPORT`（不可原地重试
* 的兜底）。留一串没有任何线索的中文（例如只净化的 `上游信封错误: HTTP 4xx
* {"code":"115"}`）会被猜成 `TRANSPORT`；而带上 `quota-exhausted` 之后，
* `isQuotaExceededError` 的 `quota ... exceeded` 判据立刻命中。
*
* **状态码由本函数负责加、也由本函数负责净化，`note` 后缀同样一起净化**
* （对抗审核 S3：原先 suffix 拼在净化之后，将来它若带上游信息就会绕过净化）。
* 前置判断放在 `auth` 那一行：那一档必须原文送达，一个字符都不能改。
*/
function hostFailureMessage(kind, status, message, suffix = "") {
	if (kind === "auth") return message;
	return sanitizeForHost(`qoder upstream ${kind} (http ${status}): ${hostMessageText(kind, message)}${suffix}`);
}
/**
* 把上游申报的重试间隔写进**给宿主的失败文案**（issue #24）。
*
* 为什么非写文案不可：宿主在 pi-ai 这条路由上**只从文案分类**
* （`llm-pi-ai/src/stream.ts` 的 `classifyPiAiError` 拿到的就是 `failure.message`），
* 失败对象上没有 `providerRetryAfterMs` 的通道 —— 那条通道只有 Anthropic /
* DeepSeek 那两个直连适配器有（它们的 `providerError(raw, status, headers)` 读
* `retry-after` 头）。所以「上游说等 5 秒」这件事，在本路由上唯一能影响宿主
* 行为的办法就是让它出现在文案里，且**不要**被 `hostMessageText` 的净化吞掉
* （那个净化只动裸 401/403，不动我们这段）。
*
* 措辞固定为 `retry-after 5s`：`llm-retry` 不解析文案，所以这不是给机器读的，
* 是给用户与后续排查读的 —— 现在他们能直接看到「上游只要求等 5 秒」，而不是
* 「上游报了个 4xx」。
*/
function retryAfterNote(retryAfterMs) {
	if (retryAfterMs === void 0 || !Number.isFinite(retryAfterMs) || retryAfterMs <= 0) return "";
	const seconds = retryAfterMs / 1e3;
	return ` [upstream retry-after ${Number.isInteger(seconds) ? String(seconds) : seconds.toFixed(1)}s]`;
}
/**
* 构造给宿主的失败文案，并把上游申报的重试间隔附在后面。
*
* 这一层存在是为了让「文案」与「头」两个出口用同一个判据：`retryAfterNote`
* 负责文案，`Retry-After` 头负责非流式响应（见 `writeJson` 的调用点）。
* 两处都从 `QoderUpstreamError.retryAfterMs` 读，不各自解析一遍。
*/
function hostFailureMessageOf(error, suffix = "") {
	return hostFailureMessage(error.kind, error.status, error.message, `${suffix}${retryAfterNote(error.retryAfterMs)}`);
}
/** HTTP 状态 + error.code 双映射表（DSH 依据 code 判定原地重试 vs failover）。 */
const ERROR_MAP = {
	network: {
		status: 502,
		code: "connection_error"
	},
	auth: {
		status: 401,
		code: "invalid_api_key"
	},
	"rate-limited": {
		status: 429,
		code: "rate_limit_exceeded"
	},
	"invalid-request": {
		status: 400,
		code: "invalid_request_error"
	},
	"content-policy": {
		status: 400,
		code: "content_policy_rejected"
	},
	"quota-exhausted": {
		status: 429,
		code: "quota_exceeded"
	},
	transient: {
		status: 502,
		code: "upstream_error"
	},
	unknown: {
		status: 500,
		code: "upstream_error"
	}
};
/**
* Round about which upstream failures are worth spending a failover attempt
* on. A request never starts, wait / fix input / the model is gone, a
* content-policy refusal is about THIS message (the next account would be
* refused the same way), and a mid-stream error has already committed bytes.
* Only a failure where the serving account was the problem and nothing has
* been written yet deserves to move to the next account.
*/
function isFailoverEligible(kind) {
	return kind === "auth" || kind === "rate-limited" || kind === "quota-exhausted" || kind === "network" || kind === "transient";
}
/** 可中断的等待：signal 中止时立即结束，而不是睡满全程。 */
function sleepAbortable(ms, signal) {
	return new Promise((resolve) => {
		if (ms <= 0 || signal.aborted) return resolve();
		const timer = setTimeout(resolve, ms);
		signal.addEventListener("abort", () => {
			clearTimeout(timer);
			resolve();
		}, { once: true });
	});
}
function createQoderShim(options) {
	const { upstream } = options;
	const logger = options.logger ?? (() => {});
	const secret = randomBytes(32).toString("base64url");
	const secretBuf = Buffer.from(secret);
	let baseUrlValue = "";
	let portValue = 0;
	let closeFn = async () => {};
	const ready = new Promise((resolveReady, rejectReady) => {
		const server = createServer((req, res) => {
			handleRequest(req, res).catch((error) => {
				const upstream = isQoderUpstreamError(error);
				const status = upstream ? ERROR_MAP[error.kind].status : 500;
				const code = upstream ? hostErrorCode(error.kind) : "internal_error";
				const raw = String(error.message ?? "internal error");
				writeJson(res, status, { error: {
					message: upstream ? hostFailureMessageOf({
						...error,
						message: raw
					}) : raw,
					code,
					type: "qoder_error"
				} }, upstream ? error.retryAfterMs : void 0);
			});
		});
		server.on("error", (error) => {
			rejectReady(error);
		});
		server.listen(0, "127.0.0.1", () => {
			const addr = server.address();
			baseUrlValue = `http://127.0.0.1:${addr.port}`;
			portValue = addr.port;
			resolveReady();
		});
		closeFn = () => new Promise((resolve, reject) => {
			server.close((error) => error ? reject(error) : resolve());
		});
	});
	async function handleRequest(req, res) {
		if (!checkHost(req)) {
			writeJson(res, 403, { error: {
				message: "bad host",
				code: "host_not_allowed"
			} });
			return;
		}
		if (!originIsLoopback(req.headers.origin)) {
			writeJson(res, 403, { error: {
				message: "Origin must be a loopback origin",
				code: "origin_not_allowed"
			} });
			return;
		}
		if (!checkAuthorization(req, secretBuf)) {
			writeJson(res, 401, { error: {
				message: "invalid api key",
				code: "invalid_api_key"
			} });
			return;
		}
		if (!checkContentType(req)) {
			writeJson(res, 415, { error: {
				message: "unsupported media type",
				code: "invalid_request_error"
			} });
			return;
		}
		const url = new URL(req.url ?? "/", "http://127.0.0.1");
		if (req.method === "GET" && (url.pathname === "/healthz" || url.pathname === "/healthz/")) {
			writeJson(res, 200, { ok: true });
			return;
		}
		if (req.method === "GET" && url.pathname === "/v1/models") {
			await handleModels(res);
			return;
		}
		if (req.method === "POST" && url.pathname === "/v1/chat/completions") {
			await handleChat(req, res);
			return;
		}
		writeJson(res, 404, { error: {
			message: "not found",
			code: "invalid_request_error"
		} });
	}
	function checkHost(req) {
		const host = req.headers.host ?? "";
		return /^127\.0\.0\.1:\d+$/.test(host);
	}
	function checkAuthorization(req, expected) {
		const header = req.headers.authorization;
		if (typeof header !== "string") return false;
		const match = /^Bearer (.+)$/.exec(header);
		if (!match) return false;
		const actual = Buffer.from(match[1] ?? "");
		if (actual.length !== expected.length) return false;
		return timingSafeEqual(actual, expected);
	}
	function checkContentType(req) {
		if (req.method === "GET") return true;
		return (req.headers["content-type"] ?? "").startsWith(CONTENT_TYPE_JSON);
	}
	function resolveFallbackCredential() {
		const pat = options.credential();
		if (!pat) throw new QoderUpstreamError("auth", "未配置 Qoder PAT：请在插件设置里填写，或设置环境变量", 401);
		return pat;
	}
	async function handleModels(res) {
		writeJson(res, 200, {
			object: "list",
			data: listModelIds().map((id) => ({
				id,
				object: "model",
				owned_by: "qoder"
			}))
		});
	}
	function listModelIds() {
		return [];
	}
	async function handleChat(req, res) {
		let raw;
		try {
			raw = await readBody(req, options.requestBodyLimit ?? REQUEST_BODY_LIMIT);
		} catch (error) {
			if (error.message === "request body too large") {
				writeJson(res, 413, { error: {
					message: "request body too large",
					code: "invalid_request_error"
				} });
				return;
			}
			throw error;
		}
		let body;
		try {
			body = JSON.parse(raw);
		} catch {
			writeJson(res, 400, { error: {
				message: "invalid JSON body",
				code: "invalid_request_error"
			} });
			return;
		}
		const model = typeof body.model === "string" ? body.model : "";
		const messages = Array.isArray(body.messages) ? body.messages : [];
		const stream = body.stream !== false;
		if (messages.length === 0) {
			writeJson(res, 400, { error: {
				message: "messages is required",
				code: "invalid_request_error"
			} });
			return;
		}
		const key = options.modelKeyOf ? options.modelKeyOf(model) ?? model : model;
		const supportsImages = options.supportsImagesOf ? options.supportsImagesOf(model) : false;
		const savedEffort = options.reasoningEffortOf ? options.reasoningEffortOf(model) : void 0;
		if (messages.some((m) => Array.isArray(m.content) && m.content.some((p) => p?.type === "image_url")) && !supportsImages) {
			writeJson(res, 400, { error: {
				message: hostMessageText("invalid-request", `模型 ${model} 不支持图像输入`),
				code: "invalid_request_error"
			} });
			return;
		}
		if (!stream) {
			writeJson(res, 400, { error: {
				message: "only streaming is supported",
				code: "invalid_request_error"
			} });
			return;
		}
		const tools = body.tool_choice === "none" || !Array.isArray(body.tools) ? void 0 : body.tools;
		const requestedOff = body.reasoning_effort === "off";
		const isReasoning = savedEffort !== void 0 && !requestedOff ? true : isReasoningRequested(body);
		const reasoningEffort = requestedOff ? void 0 : savedEffort;
		const controller = new AbortController();
		res.on("close", () => controller.abort());
		if (res.destroyed) controller.abort();
		let serving;
		try {
			serving = await (options.resolveServing ? options.resolveServing() : Promise.resolve(void 0));
			if (serving === void 0) serving = {
				accountId: "default",
				accountName: "",
				pat: resolveFallbackCredential()
			};
		} catch (error) {
			const upstream = isQoderUpstreamError(error);
			const mapped = upstream ? ERROR_MAP[error.kind] : {
				status: 500,
				code: "upstream_error"
			};
			const raw = String(error.message ?? "internal error");
			writeJson(res, mapped.status, { error: {
				message: upstream ? hostFailureMessageOf({
					...error,
					message: raw
				}) : raw,
				code: mapped.code,
				type: "qoder_error"
			} }, upstream ? error.retryAfterMs : void 0);
			return;
		}
		const requestId = `chatcmpl-${randomBytes(12).toString("hex")}`;
		const created = Math.floor(Date.now() / 1e3);
		const tried = [];
		const gapMs = options.failoverGapMs ?? FAILOVER_ACCOUNT_GAP_MS;
		let notice;
		let wroteBytes = false;
		for (;;) {
			let wroteAny = false;
			let hasToolCalls = false;
			let inputTokens = 0;
			let outputTokens = 0;
			/**
			* 缓存命中数（issue #4）。与上面两个**计数方式不同**：
			*
			* `inputTokens` / `outputTokens` 是 `> 0` 才覆盖的（流里多帧会重复报，
			* 只认非零值）；缓存命中数则允许本身就是 0（上游明确报「缓存一个都没
			* 命中」是很正常的一件事）。所以用 `undefined` 当「还没拿到」，一旦上游
			* 报过就记下来（含 0），不再被后面的帧覆盖成别的数。
			*/
			let cachedTokens;
			try {
				await upstream.chatStream(serving.pat, key, messages, {
					...tools === void 0 ? {} : { tools },
					isReasoning,
					...reasoningEffort === void 0 ? {} : { reasoningEffort },
					isVl: supportsImages,
					signal: controller.signal,
					onDelta: (delta) => {
						if (!wroteAny) {
							res.writeHead(200, {
								"Content-Type": "text/event-stream",
								"Cache-Control": "no-cache",
								"Connection": "keep-alive",
								"X-Accel-Buffering": "no"
							});
							if (notice !== void 0 && !wroteBytes) writeNoticeChunk(res, requestId, created, model, notice);
							notice = void 0;
							wroteAny = true;
							wroteBytes = true;
						}
						if (delta.inputTokens > 0) inputTokens = delta.inputTokens;
						if (delta.outputTokens > 0) outputTokens = delta.outputTokens;
						if (delta.cachedTokens !== void 0) cachedTokens = delta.cachedTokens;
						if (delta.toolCalls !== void 0) hasToolCalls = true;
						writeDeltaChunk(res, requestId, created, model, delta);
					}
				});
				if (res.destroyed) return;
				const done = makeChunk(requestId, created, model);
				done.choices[0].finish_reason = hasToolCalls ? "tool_calls" : "stop";
				if (inputTokens > 0 || outputTokens > 0) done.usage = {
					prompt_tokens: inputTokens,
					completion_tokens: outputTokens,
					total_tokens: inputTokens + outputTokens,
					...cachedTokens === void 0 ? {} : { prompt_tokens_details: { cached_tokens: cachedTokens } }
				};
				res.write(`data: ${JSON.stringify(done)}\n\n`);
				res.write("data: [DONE]\n\n");
				res.end();
				return;
			} catch (error) {
				if (wroteAny) {
					writeErrorChunk(res, requestId, created, model, error);
					return;
				}
				if (isQoderUpstreamError(error) && isFailoverEligible(error.kind) && !controller.signal.aborted) {
					options.onServingFailure?.(serving.accountId, error.kind, error.message, {
						status: error.status,
						code: error.code,
						...error.retryAfterMs === void 0 ? {} : { retryAfterMs: error.retryAfterMs },
						...error.queue === void 0 ? {} : { queue: error.queue }
					});
					tried.push(serving.accountId);
					let next;
					try {
						next = options.failoverAccount ? await options.failoverAccount(tried) : void 0;
					} catch {
						next = void 0;
					}
					if (next !== void 0 && options.isAccountExcluded?.(next.accountId) === true) {
						logger(`shim: failover candidate ${next.accountId} is already excluded; not retrying it`);
						next = void 0;
					}
					if (next !== void 0 && !tried.includes(next.accountId)) {
						logger(`shim failover: ${serving.accountId} → ${next.accountId} (${error.kind})`);
						const from = serving;
						const to = next;
						if (shouldAnnounceFailover({
							switched: true,
							fromAccountId: from.accountId,
							toAccountId: to.accountId,
							kind: error.kind
						}) && options.hasAnnouncedFailover?.(from, to, error.kind) !== true) notice = options.failoverNotice?.(from, to, error.kind, { ...error.queue === void 0 ? {} : { queue: error.queue } });
						serving = next;
						await sleepAbortable(gapMs, controller.signal);
						if (controller.signal.aborted) return;
						continue;
					}
				}
				if (isQoderUpstreamError(error)) {
					const note = tried.length > 1 ? ` (after trying ${tried.length} accounts)` : "";
					const mapped = ERROR_MAP[error.kind];
					writeJson(res, mapped.status, { error: {
						message: hostFailureMessageOf({
							...error,
							message: error.message.slice(0, 400)
						}, note),
						code: hostErrorCode(error.kind),
						type: "qoder_error"
					} }, error.retryAfterMs);
					return;
				}
				throw error;
			}
		}
	}
	/** 从请求体决定本次的 `is_reasoning`（见在线路上的注释）。 */
	function isReasoningRequested(body) {
		const effort = typeof body.reasoning_effort === "string" ? body.reasoning_effort : void 0;
		if (effort === "off") return false;
		if (effort !== void 0 && effort !== "") return true;
		return body.stream_options?.include_reasoning === true;
	}
	/** 池接管的通知帧：一段以引用块前缀开头的**内容**帧（pi-ai 可见）。 */
	function writeNoticeChunk(res, id, created, model, notice) {
		const chunk = makeChunk(id, created, model);
		chunk.choices[0].delta.content = `\n\n> [dsh-connect-qoder] ${notice}\n\n`;
		res.write(`data: ${JSON.stringify(chunk)}\n\n`);
	}
	function writeDeltaChunk(res, id, created, model, delta) {
		const chunk = makeChunk(id, created, model);
		const choice = chunk.choices[0];
		if (delta.role !== "") choice.delta.role = delta.role;
		if (delta.content !== "") choice.delta.content = delta.content;
		if (delta.reasoningContent !== "") choice.delta.reasoning_content = delta.reasoningContent;
		if (delta.toolCalls !== void 0) choice.delta.tool_calls = delta.toolCalls;
		res.write(`data: ${JSON.stringify(chunk)}\n\n`);
	}
	function writeErrorChunk(res, id, created, model, error) {
		if (res.destroyed) return;
		const errChunk = makeChunk(id, created, model);
		errChunk.choices[0].finish_reason = "error";
		const upstream = isQoderUpstreamError(error);
		const code = upstream ? ERROR_MAP[error.kind].code : "upstream_error";
		const raw = String(error.message ?? "internal error");
		errChunk.error = {
			message: upstream ? hostFailureMessage(error.kind, error.status, raw) : raw,
			code,
			type: "qoder_error"
		};
		res.write(`data: ${JSON.stringify(errChunk)}\n\n`);
		res.write("data: [DONE]\n\n");
		res.end();
	}
	function makeChunk(id, created, model) {
		return {
			id,
			object: "chat.completion.chunk",
			created,
			model,
			choices: [{
				index: 0,
				delta: {},
				finish_reason: null
			}]
		};
	}
	/**
	* 写一条 JSON 响应。`retryAfterMs` 可选：带上就发 `Retry-After`（秒，向上取整）。
	*
	* 这个头是给**别的**消费者看的（浏览器/中间层/未来的宿主能力）。宿主在当前
	* pi-ai 路由上**不读它**（`llm-pi-ai` 的失败只有 `{message, code}`），所以
	* 上游申报值真正影响等待的那条路是**文案**（见 `retryAfterNote`）。两个出口都
	* 从同一个 `QoderUpstreamError.retryAfterMs` 来，不各解析一遍。
	*/
	function writeJson(res, status, body, retryAfterMs) {
		if (res.writableEnded || res.destroyed) return;
		const text = JSON.stringify(body);
		const headers = { "Content-Type": "application/json; charset=utf-8" };
		if (retryAfterMs !== void 0 && Number.isFinite(retryAfterMs) && retryAfterMs > 0) headers["Retry-After"] = String(Math.ceil(retryAfterMs / 1e3));
		res.writeHead(status, headers);
		res.end(text);
	}
	function readBody(req, limit) {
		return new Promise((resolve, reject) => {
			const chunks = [];
			let size = 0;
			let over = false;
			req.on("data", (chunk) => {
				if (over) return;
				size += chunk.length;
				if (size > limit) {
					over = true;
					reject(/* @__PURE__ */ new Error("request body too large"));
					req.resume();
					return;
				}
				chunks.push(chunk);
			});
			req.on("end", () => {
				if (!over) resolve(Buffer.concat(chunks).toString("utf8"));
			});
			req.on("error", reject);
		});
	}
	return {
		ready,
		get baseUrl() {
			return baseUrlValue;
		},
		get port() {
			return portValue;
		},
		secret,
		close: async () => {
			await closeFn();
		}
	};
}
/** The provider id each region registers as. */
const QODER_PROVIDERS = {
	cn: "qoder",
	global: "qoder-global"
};
/** Region a provider route id belongs to. */
function regionOfProvider(provider) {
	for (const [region, id] of Object.entries(QODER_PROVIDERS)) if (id === provider) return region;
}
/** Human-readable provider name, shown in the DSH model picker. */
const QODER_PROVIDER_DISPLAY_NAMES = {
	cn: "Qoder",
	global: "Qoder Global"
};
/** Provider idle ceiling while one stream read is outstanding. */
const QODER_STREAM_IDLE_TIMEOUT_MS = 3e5;
const NO_COST = {
	input: 0,
	output: 0,
	cacheRead: 0,
	cacheWrite: 0
};
/** Image-request budgets at the dsh-llm-pi-ai defaults. */
const REQUEST_IMAGE_BUDGETS = {
	maxRequestImageBytes: 20971520,
	requestImagePixelBudget: 4194304,
	requestImageMaxBytes: 1048576
};
/** Inert pi-ai auth plane: the route authenticates only through the shim secret. */
const INERT_AUTH = {
	credentials: {
		async read() {},
		async list() {
			return [];
		},
		async modify() {}
	},
	authContext: {}
};
const THINKING_LEVELS = [
	"minimal",
	"low",
	"medium",
	"high",
	"xhigh",
	"max"
];
/** pi-ai input modalities: images only when Qoder advertises them. */
function qoderModelInput(info) {
	return info.supportsImages === true ? ["text", "image"] : ["text"];
}
/**
* The DSH-facing thinking level map for one Qoder model.
*
* **只映射上游真正声明的档位**（workbuddy 的 `workBuddyThinkingLevelMap` 同规）。
* Qoder 的 `thinking_config.enabled.efforts` 会逐模型声明档位，且**不统一**：
* Qwen 系是 `xhigh / low / medium`，DeepSeek/GLM 系是 `high / low / max`。
* 把六个 DSH 档位全部置 null 会让 DSH 的模型设置里出现一排「可选但无效」的
* 档位 —— 用户选了也不起作用。正确做法是：声明了的档位映射到**同名**的真实档位，
* 没声明的映射为 `null`（DSH 据此不提供该档）。
*
* 上游声明可以关闭思考时额外提供 `off`；不能关闭则 `off` 映射为 null（DSH
* 不提供「关闭」）。非推理模型没有 map。
*
* 注意：这与「请求线怎么带档位」是两件事 —— shim 侧按
* `reasoningEffort` + `parameters.reasoning_effort` 发送（见 shim.ts）。
*/
function qoderThinkingLevelMap(info) {
	if (!info.supportsThinking) return void 0;
	const declared = info.thinkingEfforts ?? [];
	const supported = THINKING_LEVELS.filter((level) => declared.includes(level));
	if (supported.length === 0) return void 0;
	const map = {};
	for (const level of THINKING_LEVELS) map[level] = supported.includes(level) ? level : null;
	if (info.canDisableThinking === true) map.off = "off";
	return map;
}
/** Build one pi-ai model descriptor pointing at the loopback shim. */
function toPiModel(info, baseUrl, providerId) {
	const thinkingLevelMap = qoderThinkingLevelMap(info);
	return {
		id: info.key,
		name: modelDisplayName(info),
		api: "openai-completions",
		provider: providerId,
		baseUrl,
		input: qoderModelInput(info),
		cost: NO_COST,
		contextWindow: info.contextWindow,
		maxTokens: info.maxOutputTokens,
		reasoning: thinkingLevelMap !== void 0,
		...thinkingLevelMap === void 0 ? {} : { thinkingLevelMap },
		compat: {
			supportsReasoningEffort: thinkingLevelMap !== void 0,
			supportsDeveloperRole: false
		}
	};
}
/**
* Rewrite a pi-ai 0.87-shaped transcript into the 0.85 shape this plugin's
* pi-ai understands — prompt AND tools.
*
* WHY THIS EXISTS: pi-ai 0.87's `normalizeContext` moves the system prompt
* INTO `messages` as `{ role: 'system', content }`, and 0.85's own `Message`
* union has no `system` variant — its token estimator then throws inside the
* library. This plugin cannot patch the library, so it must not hand a 0.87
* transcript to a 0.85 API object.
*
* The 0.87 transcript also carries the tool declarations on that leading
* system message (`toolsAdded`/`toolsRemoved`) — the only place they live —
* so the fold promotes them too, exactly the merge pi-ai 0.87's own
* `getCurrentTools` performs, and leaves an existing top-level `tools` array
* untouched.
*
* Unlike the sibling plugin, Qoder needs NO fallback system prompt: the Qoder
* gateway accepts user-first conversations (there is no "first message must be
* the system prompt" rule), so a transcript with no system message is passed
* through as-is. All the 0.87-vs-0.85 shape work above is identical.
*
* Deliberately SHAPE-based within the legacy branch, not version-based, and
* `withLegacyContext` generation-gates which API object consumes the result.
*
* LEGACY-ONLY (0.85). This produces the FLAT `{systemPrompt, tools, messages}`
* shape that ONLY pi-ai 0.85 reads. Never hand its result to a 1.x api — 1.x
* reads the prompt and tools from `messages[].toolsAdded` and would see none.
* That is precisely the 0.2.1-rc.1 regression: `generationOf` misclassified
* the 1.x major version as `legacy`, so this function was applied to a
* transcript that pi-ai's `createModels` had already normalized, and the
* request went out with no prompt and no tools. See {@link withLegacyContext}.
* Type note: the parameter is the 0.85 `Context`, while pi-ai 1.x types the
* api's second parameter as `TranscriptContext`; calling this with 1.x typings
* is a TS2353 by design, which is exactly why the modern branch must not touch
* it.
*/
function adaptLegacyPiAiContext(context) {
	if (context === null || typeof context !== "object") return context;
	if (context.systemPrompt) return context;
	const messages = Array.isArray(context.messages) ? context.messages : void 0;
	if (messages === void 0) return context;
	const systemTexts = [];
	const rest = [];
	const toolState = /* @__PURE__ */ new Map();
	let sawSystemMessage = false;
	for (const message of messages) {
		if (message?.role !== "system") {
			rest.push(message);
			continue;
		}
		sawSystemMessage = true;
		const text = systemTextOf(message);
		if (text !== "") systemTexts.push(text);
		replayToolState(message, toolState);
	}
	if (!sawSystemMessage) return context;
	const systemPrompt = systemTexts.length > 0 ? systemTexts.join("\n\n") : void 0;
	const tools = Array.isArray(context.tools) ? void 0 : [...toolState.values()];
	return {
		...context,
		...systemPrompt === void 0 ? {} : { systemPrompt },
		...tools !== void 0 && tools.length > 0 ? { tools } : {},
		messages: rest
	};
}
/** Replay one 0.87 system message's tool deltas into `state`. */
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
/** The text of one system message, whether it is a string or text blocks. */
function systemTextOf(message) {
	const content = message.content;
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
* Wrap one pi-ai API module so both stream entry points receive a context this
* generation can actually consume.
*
* The gate is the plugin's own module, resolved via {@link piAiRuntimeInfo}
* (manifest version of the copy this plugin resolves — no pi-ai import):
*
* - `legacy` (0.85) wants the flat `{systemPrompt, tools, messages}` shape, so
*   a normalized transcript is UN-folded by {@link adaptLegacyPiAiContext}.
* - `modern` (0.87+, incl. 1.x) wants the normalized transcript, which is
*   already what it receives, so the api is passed through UNWRAPPED.
*
* WHY `modern` IS A PASS-THROUGH — and the 0.2.1-rc.1 regression this guards.
* The normalizer that matters lives in pi-ai's **Models layer**
* (`createModels().stream/streamSimple` → `normalizeContext(context)`), which
* sits BETWEEN the host and the provider-facing api module. `PiAiAdapter`
* registers this plugin's provider into that layer, so the api module is
* handed an ALREADY-normalized transcript. Verified on the installed
* 0.2.1-rc.1 host (pi-ai 1.x) with a real `createModels` + real
* `openaiCompletionsApi()`: the api module receives
* `{messages:[{role:'system',…toolsAdded}]}` and never a top-level
* `systemPrompt`/`tools`.
*
* The 0.2.1-rc.1 regression was therefore NOT "the modern branch is empty". It
* was {@link generationOf} failing to recognise the 1.x MAJOR version: its
* `/^0\.(\d+)\./` pattern only matches a leading `0.`, so `1.1.0` / `1.3.0`
* fell through to `legacy`. The plugin then applied
* {@link adaptLegacyPiAiContext} — which UN-folds the transcript back into the
* flat 0.85 shape — and handed that to a 1.x api that reads only
* `context.messages`. Measured wire result on the real stack:
*
*   legacy branch (bug)  → roles ["user"],  system null,       tools 0
*   modern branch (fix)  → roles ["system","user"], prompt intact, tools 1
*
* i.e. NO prompt and NO tools, silently. The fix is in the detector, not here:
* this branch must stay a pass-through, because folding on top of what
* `createModels` already normalized would prepend a SECOND (empty) system
* message.
*/
function withLegacyContext(api, generation) {
	if (generation === "modern") return api;
	return {
		...api,
		stream: (model, context, options) => api.stream(model, adaptLegacyPiAiContext(context), options),
		streamSimple: (model, context, options) => api.streamSimple(model, adaptLegacyPiAiContext(context), options)
	};
}
/**
* Assemble the adapter. The provider's `getModels` reads the live catalog,
* and every model's `baseUrl` is re-resolved per read so the shim's
* ephemeral port applies from the first snapshot after startup.
*/
function createQoderAdapter(options) {
	const { shim, catalog } = options;
	const providerId = options.provider ?? "qoder";
	const providerName = options.displayName ?? QODER_PROVIDER_DISPLAY_NAMES.cn;
	const generation = options.piAiGeneration ?? piAiRuntimeInfo()?.generation ?? "modern";
	const api = withLegacyContext(openAICompletionsApi(), generation);
	const buildModels = () => {
		const baseUrl = `${shim.baseUrl}/v1`;
		return catalog.current().map((info) => toPiModel(info, baseUrl, providerId));
	};
	const provider = {
		...createProvider({
			id: providerId,
			name: providerName,
			auth: { apiKey: {
				name: "Qoder shim token",
				async resolve({ credential }) {
					const apiKey = credential?.key;
					return {
						auth: apiKey === void 0 || apiKey.length === 0 ? {} : { apiKey },
						source: "Qoder shim token"
					};
				}
			} },
			models: buildModels(),
			api
		}),
		getModels: () => buildModels()
	};
	const profile = {
		provider: providerId,
		displayName: providerName,
		streamIdleTimeoutMs: QODER_STREAM_IDLE_TIMEOUT_MS,
		retryPolicy: resolveRetryPolicy(options.retryPolicy, options.retryPolicyPath ?? "dsh-connect-qoder retryPolicy"),
		configuredMaxTokens: /* @__PURE__ */ new Map(),
		modelErrors: /* @__PURE__ */ new Map(),
		...REQUEST_IMAGE_BUDGETS,
		piProvider: provider
	};
	let profiles = /* @__PURE__ */ new Map([[providerId, profile]]);
	return {
		adapter: new PiAiAdapter({
			profiles: () => profiles,
			auth: INERT_AUTH,
			resolveApiKey: async () => shim.secret,
			...options.resolveAttachments === void 0 ? {} : { resolveAttachments: options.resolveAttachments }
		}),
		invalidate: () => {
			profiles = /* @__PURE__ */ new Map([[providerId, profile]]);
		},
		piAiGeneration: generation
	};
}
//#endregion
//#region src/probe.ts
/** The family's default probe input, in tokens (a realistic conversation size). */
const DEFAULT_PROBE_INPUT_TOKENS = 25e3;
/**
* The probe sizes the card offers, in tokens — carried from the sibling plugin
* so the two cards read one family set.
*/
const PROBE_INPUT_TOKEN_CHOICES = [
	1e4,
	2e4,
	3e4,
	5e4,
	1e5
];
/**
* A requested probe size reduced to a size this build will send.
*/
function resolveProbeInputTokens(requested) {
	return requested !== void 0 && PROBE_INPUT_TOKEN_CHOICES.includes(requested) ? requested : DEFAULT_PROBE_INPUT_TOKENS;
}
/** Characters per token for the filler text (family estimate, 4.5 c/tok). */
const CHARS_PER_TOKEN = 4.5;
/** Neutral filler; carries no user content, only volume. */
const FILLER_LINE = "The quick brown fox jumps over the lazy dog. ";
/**
* Build the user message a probe carries: a padded filler (for volume) plus
* the actual prompt. Qoder's gateway takes user-first messages (no system
* requirement), so no PROBE_SYSTEM_PROMPT is needed.
*/
function probeUserMessage(inputTokens = DEFAULT_PROBE_INPUT_TOKENS) {
	const targetChars = Math.ceil(resolveProbeInputTokens(inputTokens) * CHARS_PER_TOKEN);
	return `${FILLER_LINE.repeat(Math.ceil(targetChars / 45))}Reply with a single word.`;
}
/**
* Parse a `Retry-After` header value into an absolute time.
*
* Both RFC 9110 forms are accepted: delay-seconds (`120`) and an HTTP-date.
* Returns undefined for anything else, including negative/zero delays.
*/
function parseRetryAfter(value, nowMs) {
	if (value === null) return void 0;
	const trimmed = value.trim();
	if (trimmed === "") return void 0;
	if (/^\d+$/u.test(trimmed)) {
		const seconds = Number(trimmed);
		if (!Number.isFinite(seconds) || seconds <= 0) return void 0;
		return nowMs + seconds * 1e3;
	}
	const parsed = Date.parse(trimmed);
	if (Number.isNaN(parsed)) return void 0;
	if (parsed <= nowMs) return void 0;
	return parsed;
}
/**
* The upstream's reset sentence, as Qoder's gateways write it in Chinese —
* e.g. `您的使用量已超出频率限制，将在 2026-09-30 02:30:30 UTC+8 重置，…`.
* Loose around the wording, strict about the parts that must not be guessed:
* the keyword 重置, the timestamp shape, and an explicit UTC offset.
*/
const UPSTREAM_RESET_PATTERN = /将在?\s*(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})\s*UTC\s*([+-])(\d{1,2})(?::?(\d{2}))?[\s\S]*?重置/u;
/**
* Parse the reset time out of an upstream failure message.
*
* The offset is honoured, not assumed: `Date.UTC` with the stated offset
* subtracted, returned as epoch ms. A whole-second resolution is what the
* upstream prints.
*/
function parseUpstreamResetAt(message) {
	const match = UPSTREAM_RESET_PATTERN.exec(message);
	if (match === null) return void 0;
	const [, year, month, day, hour, minute, second, sign, offsetHours, offsetMinutes] = match;
	const offsetTotalMinutes = (sign === "-" ? -1 : 1) * (Number(offsetHours) * 60 + Number(offsetMinutes ?? "0"));
	const utcMs = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
	const parsed = new Date(utcMs);
	if (parsed.getUTCFullYear() !== Number(year) || parsed.getUTCMonth() !== Number(month) - 1 || parsed.getUTCDate() !== Number(day) || parsed.getUTCHours() !== Number(hour) || parsed.getUTCMinutes() !== Number(minute) || parsed.getUTCSeconds() !== Number(second)) return;
	if (Math.abs(offsetTotalMinutes) > 840) return void 0;
	return utcMs - offsetTotalMinutes * 6e4;
}
/**
* The cooldown the upstream stated, if it stated one.
*
* Four sources, in order of authority: `Retry-After` on the failure response;
* the upstream's OWN declared wait (`retryAfterSeconds` in the queue envelope,
* issue #26); the reset time written into the failure body (the case that
* actually fires — a 429 carries `将在 … 重置`, no header); and the region's
* quota refresh point ONLY for an out-of-credit outcome. None of these → `{}`,
* which the card renders as "the upstream did not say when".
*
* ⚠️ The declared wait comes **before** the body reset sentence on purpose:
* issue #26's field report is an upstream that says "wait 30 seconds" while the
* plugin amplified it into a 30-minute cooldown — a 60× error caused by one
* dropped field. The upstream's explicit number is the most specific statement
* it can make, so it outranks a sentence we scraped out of a body.
*/
function cooldownOf(input) {
	const fromHeader = parseRetryAfter(input.retryAfter, input.nowMs);
	if (fromHeader !== void 0) return {
		retryAtMs: fromHeader,
		retrySource: "retry-after"
	};
	if (input.retryAfterMs !== void 0 && Number.isFinite(input.retryAfterMs) && input.retryAfterMs > 0) return {
		retryAtMs: input.nowMs + input.retryAfterMs,
		retrySource: "upstream-reported"
	};
	const fromBody = input.body === void 0 ? void 0 : parseUpstreamResetAt(input.body);
	if (fromBody !== void 0) return {
		retryAtMs: fromBody,
		retrySource: "upstream-message"
	};
	if (input.outcome === "out-of-credit" && input.quotaRefreshAtMs !== void 0) return {
		retryAtMs: input.quotaRefreshAtMs,
		retrySource: "quota-refresh"
	};
	return {};
}
/**
* Classify one failed probe into the card's outcome vocabulary, from the
* upstream error kind rather than raw status codes, so a probe and a real chat
* request never disagree about the same answer.
*
* **排队单独成一档（issue #26）**：上游明说「在排队、服务是好的、30 秒后再来」
* —— 把它归进 `unavailable`（「连不上上游」）是**两句都不对的话**：连接是通的，
* 上游也是好的，只是这个模型在排队。用户看到那句话会以为账号坏了、要求换
* PAT，而真相是「等 30 秒就好」。
*/
function outcomeOfFailure(error) {
	if (error.queue?.isQueued === true) return { outcome: "queued" };
	switch (error.kind) {
		case "auth": return { outcome: "credential-rejected" };
		case "rate-limited": return { outcome: "rate-limited" };
		case "quota-exhausted": return { outcome: "out-of-credit" };
		case "content-policy": return { outcome: "policy-rejected" };
		case "invalid-request": return error.status === 400 && /model/i.test(error.message) ? { outcome: "not-found" } : { outcome: "failed" };
		case "not-found-model": return { outcome: "not-found" };
		case "network":
		case "transient": return { outcome: "unavailable" };
		case "unknown": return error.status === 0 || error.status >= 500 ? { outcome: "unavailable" } : { outcome: "failed" };
	}
}
/** Max characters of upstream text kept for display, after redaction. */
const PROBE_MESSAGE_LIMIT = 300;
/**
* Redact token-shaped content out of upstream text before it is stored or sent.
*
* Lives here because this module is the one that reads raw failure bodies, so
* the redaction belongs at the point of capture. Also used by the pool's
* `recordAccountFailure` path so the two writers cannot drift apart.
*/
function redactUpstreamText(text) {
	return text.replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/gu, "[redacted token]").replace(/(\b(?:code|token|refresh_token|access_token)=)[^\s&,]+/giu, "$1[redacted]").replace(/\bpt-[A-Za-z0-9_-]{6,}\b/giu, "[redacted credential]").slice(0, PROBE_MESSAGE_LIMIT);
}
/**
* Run one probe for one model and reduce it to a result row.
*
* Never throws: a probe is a diagnostic the user asked for, so every failure is
* a RESULT — one dead model must not abort a batch and hide the other rows.
*/
async function probeModel(input) {
	const startedAt = Date.now();
	let answer;
	try {
		answer = await input.client.probeChat(input.credential, input.modelKey, {
			...input.inputTokens === void 0 ? {} : { inputTokens: input.inputTokens },
			...input.signal === void 0 ? {} : { signal: input.signal }
		});
	} catch (error) {
		const thrown = error;
		const queued = thrown.queue?.isQueued === true;
		return {
			modelId: input.modelKey,
			outcome: queued ? "queued" : "unavailable",
			message: redactUpstreamText(error instanceof Error ? error.message : String(error)),
			...queued ? { queue: {
				...thrown.queue?.queueCount === void 0 ? {} : { queueCount: thrown.queue.queueCount },
				...thrown.queue?.queueType === void 0 ? {} : { queueType: thrown.queue.queueType }
			} } : {},
			...thrown.retryAfterMs === void 0 ? {} : {
				retryAtMs: input.nowMs + thrown.retryAfterMs,
				retrySource: "upstream-reported"
			}
		};
	}
	const elapsedMs = Date.now() - startedAt;
	if (answer.ok) return {
		modelId: input.modelKey,
		outcome: "ok",
		elapsedMs,
		status: answer.status,
		...cooldownOf({
			outcome: "ok",
			retryAfter: answer.retryAfter,
			nowMs: input.nowMs,
			...input.quotaRefreshAtMs === void 0 ? {} : { quotaRefreshAtMs: input.quotaRefreshAtMs }
		})
	};
	const error = answer.error;
	if (error === void 0) return {
		modelId: input.modelKey,
		outcome: "failed",
		elapsedMs,
		status: answer.status
	};
	const { outcome } = outcomeOfFailure(error);
	const body = answer.body ?? "";
	const retryAfterMs = answer.retryAfterMs ?? error.retryAfterMs;
	return {
		modelId: input.modelKey,
		outcome,
		elapsedMs,
		status: answer.status,
		...body === "" ? {} : { message: redactUpstreamText(body) },
		...error.queue?.isQueued === true ? { queue: {
			...error.queue.queueCount === void 0 ? {} : { queueCount: error.queue.queueCount },
			...error.queue.queueType === void 0 ? {} : { queueType: error.queue.queueType }
		} } : {},
		...cooldownOf({
			outcome,
			retryAfter: answer.retryAfter,
			nowMs: input.nowMs,
			body,
			...retryAfterMs === void 0 ? {} : { retryAfterMs },
			...input.quotaRefreshAtMs === void 0 ? {} : { quotaRefreshAtMs: input.quotaRefreshAtMs }
		})
	};
}
/**
* Whether one account can be billed at `nowMs`.
*
* Returns the exclusion reason, or undefined when the account is a candidate.
* The order matters and is NOT arbitrary:
*
* - A `credential-rejected` / `not-found` account is excluded regardless of any
*   cooldown: the token is refused / the model is gone, so waiting cannot help
*   and the user must act.
* - A limited, unreachable or failed outcome is checked against its stated (or
*   fallback) cooldown, so an account whose limit has already reset — or whose
*   gateway blipped once — is back in the pool without another test first.
* - An `ok` measurement, and no measurement at all, are both candidates.
*
* WHY TRANSIENT OUTCOMES GET A COOLDOWN: a transport failure (DNS blip, a 5xx,
* a cancelled request) says nothing about the ACCOUNT, so excluding it
* permanently would idle a good account and drain the pool of candidates. The
* cooldown is what makes the pool RECOVER instead of staying broken.
*/
function exclusionOf(probe, nowMs, modelId) {
	if (probe === void 0) return void 0;
	if (modelId !== void 0 && probe.modelId !== void 0 && probe.modelId !== modelId) return void 0;
	switch (probe.outcome) {
		case "ok": return;
		case "credential-rejected": return "credential-rejected";
		case "not-found": return "not-found";
		case "unavailable": return retryDue(probe, nowMs) ? void 0 : "unavailable";
		case "queued": return retryDue(probe, nowMs) ? void 0 : "queued";
		case "failed": return retryDue(probe, nowMs) ? void 0 : "failed";
		case "rate-limited": return retryDue(probe, nowMs) ? void 0 : "rate-limited";
		case "out-of-credit": return retryDue(probe, nowMs) ? void 0 : "out-of-credit";
		case "policy-rejected": return;
		default: return "unusable";
	}
}
/**
* Whether an account's cooldown has elapsed (or was never stated).
*
* `exclusionOf` 与 `queuedModelIdsOf` 共用这一条 —— 两条路对「还在冷却吗」
* 的判断必须是同一个，否则会出现「模型被算作在排队、账号却已经回池」的
* 自相矛盾。
*/
function retryDue(probe, nowMs) {
	return nowMs >= (probe.retryAtMs ?? probe.atMs + 18e5);
}
/**
* Rank a pool's members best-first.
*
* The rule, in priority order — this is the whole feature:
*
* 1. **Usability.** Only accounts that can be billed right now are candidates.
* 2. **Has credits about to lapse.** An account with any points expiring inside
*    the "soon" window is spent FIRST. Points are worth zero the moment they
*    expire, so an account carrying them is strictly worth more than one that
*    merely holds a larger pile that does not lapse.
* 3. **Lapses soonest first.** Among accounts at risk, the one whose nearest
*    expiry comes up first goes first — it has the least time to be spent.
* 4. **Largest amount at risk.** Same expiry (or neither at risk): the bigger
*    amount wins; with nothing expiring this falls through to total credits.
* 5. **Credits, highest first.** Spend the account that has the most.
* 6. **Account id.** Final tie-break, making the order TOTAL.
*
* ⚠️ **Steps 2–4 used to be a dead branch** (upstream issue #70, fixed in the
* sibling plugin's 4.6.7 and inherited here). The old order put `score`
* (total credits) BEFORE the expiry key. Totals are almost never exactly equal,
* so the expiry rule was UNREACHABLE — mathematics, not luck: an account whose
* 196 expiring points lapse today would sit last forever behind accounts
* holding ~1200 non-expiring ones. Worse, the single `_expiring` key held the
* raw `nearestExpiryMs` timestamp and `expiringSoon` (the AMOUNT) was never
* consulted at all, so "largest amount at risk" could not even be expressed.
* The three keys are separate now precisely so this cannot silently regress:
* `_atRisk` (bool), `_expiring` (when), `_expiringAmount` (how much).
*
* Excluded accounts are still RETURNED (sorted after the candidates) so the
* card can explain why each is out.
*
* Pure and total: the same input always yields the same order, and it never
* throws on missing data (an account with no credits is ranked as 0).
*/
function rankPool(members, nowMs, modelId, orderAccountIds) {
	const order = /* @__PURE__ */ new Map();
	for (const [index, id] of (orderAccountIds ?? []).entries()) if (!order.has(id)) order.set(id, index);
	const rows = members.map((member) => {
		const excludedBy = exclusionOf(member.probe, nowMs, modelId);
		return {
			account: member.account,
			score: scoreOf(member),
			...excludedBy === void 0 ? {} : { excludedBy },
			_usable: excludedBy === void 0,
			_atRisk: (member.credits?.expiringSoon ?? 0) > 0,
			_expiringAmount: member.credits?.expiringSoon ?? 0,
			_expiring: member.credits?.nearestExpiryMs ?? Number.POSITIVE_INFINITY,
			_order: order.get(member.account.id) ?? Number.POSITIVE_INFINITY
		};
	});
	rows.sort((left, right) => {
		if (left._usable !== right._usable) return left._usable ? -1 : 1;
		if (left._atRisk !== right._atRisk) return left._atRisk ? -1 : 1;
		if (left._order !== right._order) return left._order - right._order;
		if (left._atRisk && right._atRisk && left._expiring !== right._expiring) return left._expiring - right._expiring;
		if (left._expiringAmount !== right._expiringAmount) return right._expiringAmount - left._expiringAmount;
		if (left.score !== right.score) return right.score - left.score;
		return left.account.id < right.account.id ? -1 : left.account.id > right.account.id ? 1 : 0;
	});
	return rows.map(({ account, score, excludedBy }) => ({
		account,
		score,
		...excludedBy === void 0 ? {} : { excludedBy }
	}));
}
/** The credit figure used for ordering. Absent credits rank as zero. */
function scoreOf(member) {
	return member.credits?.total ?? 0;
}
/**
* Resolve the model the pool should test against.
*
* A user-specified id always wins (it is a preference, not a computed default),
* and is returned even when it is a PAID model: the card says so explicitly.
* The choice is VALIDATED against the region's catalog: a saved id no longer
* offered is reported as `stale` — never silently replaced by the free model —
* and a catalog that has not loaded yet reads as `stale` too (the safe
* direction: no credits are spent while the roster is unknown).
*/
function resolveTargetModel(catalog, preferredId, options) {
	if (preferredId !== void 0 && preferredId !== "") return catalog.some((model) => model.id === preferredId) ? {
		modelId: preferredId,
		source: "preferred"
	} : {
		staleModelId: preferredId,
		source: "stale"
	};
	const free = pickFreeModel(catalog, {
		...options?.avoidModelIds === void 0 ? {} : { avoid: new Set(options.avoidModelIds) },
		...options?.preferModelIds === void 0 ? {} : { prefer: new Set(options.preferModelIds) }
	});
	return free === void 0 ? { source: "none" } : {
		modelId: free.id,
		source: "free"
	};
}
/**
* Pick the free model to test against, from one region's projected catalog.
*
* "Free" means `creditMultiplier === 0` EXACTLY. An absent multiplier is NOT
* free — the Host only folds `is_free` to 0 when it positively knows the model
* is free, so an absent multiplier stays a non-free (unknown) model rather than
* silently billing real credits on a probe. Among the free candidates the
* LARGEST context window wins, because the probe sends a real-sized payload.
*
* `avoid` 是**可选的排除名单**（issue #26：刚被排过队的模型），`prefer` 是
* **可选的优先名单**（最近测成功过的模型）。名单里的模型先跳过/先挑；一个候选
* 都没有时宁可让位（返回一个都没有比挑一个更糟）。
*
* Returns undefined when there is no free model, which the caller must render
* as "none available" — never as a fallback to a paid model.
*/
function pickFreeModel(catalog, options) {
	let best;
	let preferred;
	let fallback;
	for (const model of catalog) {
		if (model.creditMultiplier !== 0) continue;
		if (fallback === void 0 || model.contextWindow > fallback.contextWindow) fallback = model;
		if (options?.avoid?.has(model.id) === true) continue;
		if (options?.prefer?.has(model.id) === true) {
			if (preferred === void 0 || model.contextWindow > preferred.contextWindow) preferred = model;
			continue;
		}
		if (best === void 0 || model.contextWindow > best.contextWindow) best = model;
	}
	return preferred ?? best ?? fallback;
}
/**
* 哪些模型**刚被上游排过队**（issue #26）。
*
* 判据：最近一次测量是 `queued`，且上游给的等待时刻还没到。等待时刻缺席时
* 按池的 30 分钟兜底（与 `exclusionOf` 同一口径）——「上游说了在排队、却没说
* 等多久」不是一个好状态，但它仍然是排队。
*
* 只看**该账号最后一次**测量的 `modelId`：探针的结论本来就是针对某个模型的
* 事实。
*/
function queuedModelIdsOf(probes, nowMs) {
	const ids = [];
	for (const probe of Object.values(probes)) {
		if (probe.outcome !== "queued") continue;
		if (probe.modelId === void 0 || probe.modelId === "") continue;
		if (!retryDue(probe, nowMs)) ids.push(probe.modelId);
	}
	return [...new Set(ids)];
}
/**
* 哪些模型**最近测成功过**（issue #26 的「自动」挑选依据）。
*
* 判据：最近一次测量是 `ok`，且记录了它测的是哪个模型。只看**该账号最后一次**
* 测量 —— 探针的结论本来就是针对某个模型的事实。
*/
function workingModelIdsOf(probes) {
	const ids = [];
	for (const probe of Object.values(probes)) {
		if (probe.outcome !== "ok") continue;
		if (probe.modelId === void 0 || probe.modelId === "") continue;
		ids.push(probe.modelId);
	}
	return [...new Set(ids)];
}
//#endregion
//#region src/web-status.ts
/** 本机 Qoder 桌面客户端登录态：拉取 / 记录 / 列表 / 删除。 */
const QODER_LOCAL_LOGIN_PATH = "/plugins/dsh-connect-qoder/local-login";
function json(res, status, body) {
	if (res.writableEnded || res.destroyed) return;
	const text = JSON.stringify(body);
	res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
	res.end(text);
}
function safeMessage(error) {
	return error instanceof Error ? error.message : String(error);
}
function loopbackOrigin(req) {
	const origin = req.headers.origin;
	if (origin === void 0) return true;
	return /^http:\/\/127\.0\.0\.1:\d+$/.test(origin) || /^http:\/\/localhost:\d+$/.test(origin);
}
async function readBody(req) {
	return new Promise((resolve, reject) => {
		let total = 0;
		const chunks = [];
		req.on("data", (chunk) => {
			total += chunk.length;
			if (total > 1048576) {
				reject(/* @__PURE__ */ new Error("request body too large"));
				req.destroy();
				return;
			}
			chunks.push(chunk);
		});
		req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
		req.on("error", reject);
	});
}
/** Narrow the region on a route URL; 400 when absent/unknown. */
function requiredRegion(res, url) {
	const region = regionOfStatusUrl(url);
	if (region === void 0) {
		json(res, 400, { error: "unknown region" });
		return;
	}
	return region;
}
/** Project one model into the card's web row. */
function webModelOf(m) {
	return {
		key: m.key,
		name: m.displayName,
		contextWindow: m.contextWindow,
		nativeContextWindow: m.contextWindow,
		maxTokens: m.maxOutputTokens,
		creditMultiplier: m.priceFactor,
		...m.supportsImages === true ? { supportsImages: true } : {},
		supportsThinking: m.supportsThinking,
		...m.canDisableThinking === true ? { canDisableThinking: true } : {},
		...m.thinkingEfforts === void 0 ? {} : { thinkingEfforts: m.thinkingEfforts },
		...m.defaultThinkingEffort === void 0 ? {} : { defaultThinkingEffort: m.defaultThinkingEffort },
		...m.isDefault === true ? { isDefault: true } : {},
		...m.isFree === true ? { isFree: true } : {},
		...m.isNew === true ? { isNew: true } : {},
		...m.contextTiers === void 0 ? {} : { contextTiers: m.contextTiers },
		...m.promotion === void 0 ? {} : { promotion: m.promotion }
	};
}
/** Redact upstream failure text for safe display/storage. */
function redactQoderText(text) {
	return text.replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/gu, "[redacted token]").replace(/\b(pt-|eyJ)[A-Za-z0-9_\-]{6,}\b/giu, "[redacted credential]").slice(0, 300);
}
/** Project one model into the pool's target picker shape. */
function poolModelOf(m) {
	return {
		id: m.key,
		name: m.displayName,
		creditMultiplier: m.isFree === true ? 0 : m.priceFactor,
		contextWindow: m.contextWindow
	};
}
/**
* Mount the web routes for dsh-connect-qoder. Returns the status builder so
* the Host can also answer from a cache (the route itself re-derives it).
*/
function registerQoderWebRoutes(ctx, deps) {
	const disposers = [];
	const regionOf = requiredRegion;
	const mount = (path, handler) => {
		try {
			const dispose = ctx.webServer.register({
				kind: "exact",
				path,
				handler
			});
			if (typeof dispose === "function") disposers.push(dispose);
		} catch {}
	};
	mount(QODER_USAGE_PATH, async (req, res) => {
		if (req.method !== "GET") return json(res, 405, { error: "method not allowed" });
		const region = regionOfStatusUrl(req.url ?? "");
		if (region === void 0) return json(res, 400, { error: "unknown region" });
		return json(res, 200, await buildWebUsage(deps, region, { detail: fastDetailOf(req.url ?? "") ? "fast" : "full" }));
	});
	mount(QODER_ACCOUNT_CREDITS_PATH, async (req, res) => {
		if (req.method !== "GET") return json(res, 405, { error: "method not allowed" });
		const region = regionOf(res, req.url ?? "");
		if (region === void 0) return;
		if (deps.accountCredits === void 0) return json(res, 503, {
			reason: "credits-unavailable",
			error: "account credits unavailable"
		});
		try {
			return json(res, 200, await deps.accountCredits(region));
		} catch (error) {
			return json(res, 502, { error: safeMessage(error) });
		}
	});
	mount(QODER_CAMPAIGNS_PATH, async (req, res) => {
		if (req.method !== "GET") return json(res, 405, { error: "method not allowed" });
		const region = regionOf(res, req.url ?? "");
		if (region === void 0) return;
		if (deps.campaigns === void 0) return json(res, 503, {
			reason: "campaigns-unavailable",
			error: "campaigns unavailable"
		});
		try {
			return json(res, 200, await deps.campaigns(region));
		} catch (error) {
			return json(res, 502, { error: safeMessage(error) });
		}
	});
	mount(QODER_MODELS_REFRESH_PATH, async (req, res) => {
		if (req.method !== "POST") return json(res, 405, { error: "method not allowed" });
		const region = regionOf(res, req.url ?? "");
		if (region === void 0) return;
		const refresh = deps.refreshModels ?? deps.discoverModels;
		if (refresh === void 0) return json(res, 503, {
			reason: "refresh-unavailable",
			error: "model discovery unavailable"
		});
		try {
			return json(res, 200, { models: (await refresh(region)).map(webModelOf) });
		} catch (error) {
			return json(res, 502, { error: safeMessage(error) });
		}
	});
	mount(QODER_ACCOUNTS_REFRESH_PATH, async (req, res) => {
		if (req.method !== "POST") return json(res, 405, { error: "method not allowed" });
		const region = regionOf(res, req.url ?? "");
		if (region === void 0) return;
		return json(res, 200, (await deps.store(region).accounts(deps.credentialSources(region))).map(webAccountOf(deps, region)));
	});
	mount(QODER_ACCOUNTS_PATH, async (req, res) => {
		if (!loopbackOrigin(req)) return json(res, 403, { error: "forbidden" });
		if (req.method !== "POST") return json(res, 405, { error: "method not allowed" });
		const region = regionOf(res, req.url ?? "");
		if (region === void 0) return;
		const action = accountActionOf(req.url ?? "");
		if (action === void 0) return json(res, 400, { error: "action is required (add|remove)" });
		const body = await readBody(req);
		let parsed;
		try {
			parsed = JSON.parse(body || "{}");
		} catch {
			return json(res, 400, { error: "invalid JSON body" });
		}
		if (action === "add") {
			const pat = typeof parsed.pat === "string" ? parsed.pat.trim() : "";
			if (pat === "") return json(res, 400, { error: "pat is required" });
			const preferred = typeof parsed.name === "string" ? parsed.name.trim() : "";
			if (deps.accountValidation === void 0) return json(res, 503, {
				reason: "validation-unavailable",
				error: "account validation unavailable"
			});
			try {
				const { name } = await deps.accountValidation.validateForRegion(region, pat);
				const displayName = preferred !== "" ? preferred : name;
				const stored = await deps.store(region).add(pat, displayName);
				if (displayName !== stored.accountName) await deps.store(region).rename(stored.id, displayName);
				return json(res, 200, {
					accountId: stored.id,
					accountName: displayName
				});
			} catch (error) {
				return json(res, 502, { error: safeMessage(error) });
			}
		}
		const accountId = typeof parsed.accountId === "string" ? parsed.accountId : "";
		if (accountId === "") return json(res, 400, { error: "accountId is required" });
		return json(res, 200, { removed: await deps.store(region).remove(accountId) });
	});
	mount(QODER_PROBE_PATH, async (req, res) => {
		if (req.method !== "GET") return json(res, 405, { error: "method not allowed" });
		const region = regionOf(res, req.url ?? "");
		if (region === void 0) return;
		const model = new URL(req.url ?? "", "http://127.0.0.1").searchParams.get("model") ?? "";
		if (model === "") return json(res, 400, { error: "model is required" });
		if (deps.probeModel === void 0) return json(res, 503, {
			reason: "probe-unavailable",
			error: "probe unavailable"
		});
		try {
			return json(res, 200, await deps.probeModel(region, model));
		} catch (error) {
			return json(res, 502, { error: safeMessage(error) });
		}
	});
	mount(QODER_POOL_PATH, async (req, res) => {
		if (!loopbackOrigin(req)) return json(res, 403, { error: "forbidden" });
		const region = regionOf(res, req.url ?? "");
		if (region === void 0) return;
		const action = poolActionOf(req.url ?? "");
		if (action === void 0) return json(res, 400, { error: "action is required (checkin|test|remove|progress)" });
		if (deps.pool === void 0) return json(res, 503, {
			reason: "pool-unavailable",
			error: "pool unavailable"
		});
		const pool = deps.pool;
		if (action === "progress") {
			if (req.method !== "GET") return json(res, 405, { error: "method not allowed" });
			const batch = pool.batchProgress?.(region);
			return json(res, 200, batch === void 0 ? { action: "progress" } : {
				action: "progress",
				batch
			});
		}
		if (req.method !== "POST") return json(res, 405, { error: "method not allowed" });
		if (action === "checkin") {
			if (pool.checkinSupported(region) !== true) return json(res, 409, {
				reason: "checkin-unsupported",
				error: "this region does not offer a daily check-in"
			});
			if (pool.checkin === void 0) return json(res, 503, {
				reason: "pool-unavailable",
				error: "pool check-in unavailable"
			});
			return json(res, 200, {
				action: "checkin",
				rows: await pool.checkin(region)
			});
		}
		if (action === "test") {
			const now = Date.now();
			const poolProbes = pool.poolProbes(region);
			const target = resolveTargetModel(pool.catalog(region).map(poolModelOf), pool.preferences(region).targetModelId, {
				avoidModelIds: queuedModelIdsOf(poolProbes, now),
				preferModelIds: workingModelIdsOf(poolProbes)
			});
			if (target.modelId === void 0) return json(res, 200, {
				action: "test",
				rows: [],
				modelId: void 0
			});
			const only = poolAccountIdOf(req.url ?? "");
			if (only !== void 0 && !isQoderAccountId(only)) return json(res, 400, { error: "accountId is not a well-formed account id" });
			if (only !== void 0) {
				if ((await deps.store(region).vaultAccounts()).find((entry) => entry.id === only) === void 0) return json(res, 409, {
					reason: "account-not-found",
					error: "no stored account with that id"
				});
			}
			const rows = await pool.test(region, only);
			return json(res, 200, {
				action: "test",
				modelId: target.modelId,
				...only === void 0 ? {} : { accountId: only },
				rows
			});
		}
		const accountId = poolAccountIdOf(req.url ?? "");
		if (accountId === void 0) return json(res, 400, { error: "accountId is required" });
		if (!isQoderAccountId(accountId)) return json(res, 400, { error: "accountId is not a well-formed account id" });
		const store = deps.store(region);
		if ((await store.vaultAccounts()).find((entry) => entry.id === accountId) === void 0) return json(res, 409, {
			reason: "account-not-deletable",
			error: "only accounts added by this plugin can be deleted"
		});
		const removed = await store.remove(accountId);
		if (deps.selectedAccountId(region) === accountId) await deps.clearSelection?.(region);
		const prefs = pool.preferences(region);
		if (prefs.memberAccountIds.includes(accountId)) pool.updateMembership(region, prefs.memberAccountIds.filter((id) => id !== accountId), prefs.enabled);
		return json(res, 200, { removed });
	});
	mount(QODER_TRANSFER_PATH, async (req, res) => {
		if (!loopbackOrigin(req)) return json(res, 403, { error: "forbidden" });
		if (req.method !== "POST") return json(res, 405, { error: "method not allowed" });
		const region = regionOf(res, req.url ?? "");
		if (region === void 0) return;
		const action = transferActionOf(req.url ?? "");
		if (action === void 0) return json(res, 400, { error: "action is required (export|preview|import)" });
		if (deps.transfer === void 0) return json(res, 503, {
			reason: "transfer-unavailable",
			error: "transfer unavailable"
		});
		const transfer = deps.transfer;
		const body = await readBody(req);
		let parsed = {};
		try {
			parsed = JSON.parse(body || "{}");
		} catch {
			return json(res, 400, { error: "invalid JSON body" });
		}
		if (action === "export") return json(res, 200, await transfer.exportAccounts(region));
		if (action === "preview") {
			const text = typeof parsed.text === "string" ? parsed.text : "";
			return json(res, 200, await transfer.previewImport(region, text));
		}
		const text = typeof parsed.text === "string" ? parsed.text : "";
		const indexes = Array.isArray(parsed.indexes) ? parsed.indexes.filter((i) => typeof i === "number" && Number.isFinite(i)) : [];
		return json(res, 200, await transfer.importAccounts(region, text, indexes));
	});
	mount(QODER_SAVE_PATH, async (req, res) => {
		if (!loopbackOrigin(req)) return json(res, 403, { error: "forbidden" });
		if (req.method !== "POST") return json(res, 405, { error: "method not allowed" });
		const bodyText = await readBody(req);
		let body;
		try {
			body = JSON.parse(bodyText);
		} catch {
			return json(res, 400, { error: "invalid JSON body" });
		}
		const field = body.field;
		if (typeof field !== "string" || field === "") return json(res, 400, { error: "field is required" });
		try {
			await deps.settings.set(field, mergeSlotWise(field, deps.settings.describe(), body.value));
			return json(res, 200, { ok: true });
		} catch (error) {
			return json(res, 500, { error: safeMessage(error) });
		}
	});
	/**
	* 本机桌面客户端登录态。
	*
	* GET  → 列表（当前登录 + 记录簿历史）+ 客户端状态快照，绝不下发令牌。
	* POST → `{ action: "pull" | "remove" | "select", accountId? }`
	*   - `pull`   读当前登录态并记一条（供账号切换用）
	*   - `select` 把 `regions.<region>.accountId` 设为该本地账号 id
	*   - `remove` 从记录簿删一条（不影响当前客户端登录）
	*
	* 全部 POST 都限 loopback；`dt-`/`drt-` 令牌只在宿主进程内流转，
	* 响应里只有 uid / 昵称 / 时间等身份摘要。
	*/
	mount(QODER_LOCAL_LOGIN_PATH, async (req, res) => {
		if (!loopbackOrigin(req)) return json(res, 403, { error: "forbidden" });
		const region = regionOf(res, req.url ?? "");
		if (region === void 0) return;
		const local = deps.localLogin?.(region);
		if (local === void 0) return json(res, 503, {
			reason: "local-login-unavailable",
			error: "local desktop login source unavailable"
		});
		if (req.method === "GET") {
			try {
				return json(res, 200, {
					region,
					accounts: await local.list(),
					status: await local.status(),
					selectedAccountId: deps.selectedAccountId(region)
				});
			} catch (error) {
				return json(res, 502, { error: safeMessage(error) });
			}
		}
		if (req.method !== "POST") return json(res, 405, { error: "method not allowed" });
		const bodyText = await readBody(req);
		let body;
		try {
			body = JSON.parse(bodyText || "{}");
		} catch {
			return json(res, 400, { error: "invalid JSON body" });
		}
		const action = typeof body.action === "string" ? body.action : "";
		try {
			if (action === "pull") {
				const entry = await local.pull();
				return json(res, 200, { action, account: entry });
			}
			if (action === "remove") {
				const accountId = typeof body.accountId === "string" ? body.accountId : "";
				if (accountId === "") return json(res, 400, { error: "accountId is required" });
				return json(res, 200, { action, removed: await local.remove(accountId) });
			}
			if (action === "select") {
				const accountId = typeof body.accountId === "string" ? body.accountId : "";
				if (accountId === "") return json(res, 400, { error: "accountId is required" });
				/** 先确认这条记录真的能解析出凭据（历史条目不是当前登录会抛）。 */
				await local.credentialStrict(accountId);
				await deps.settings.set("regions", mergeSlotWise("regions", deps.settings.describe(), {
					[region]: { accountId }
				}));
				return json(res, 200, { action, accountId });
			}
			return json(res, 400, { error: "action is required (pull|remove|select)" });
		} catch (error) {
			return json(res, 409, { error: safeMessage(error) });
		}
	});
	const mounted = { status: (region) => buildWebUsage(deps, region) };
	ctx.effect(() => () => {
		for (const dispose of disposers) try {
			dispose();
		} catch {}
	});
	return mounted;
}
/** Project one account entry to its web shape with the selection flag. */
function webAccountOf(deps, region, servingId) {
	return (account) => ({
		id: account.id,
		accountName: account.accountName,
		source: account.source,
		selected: account.id === (servingId ?? deps.selectedAccountId(region)) || account.source !== "vault" && account.source !== "local-login" && deps.selectedAccountId(region) === void 0,
		...account.tokenExpiresAtMs === void 0 ? {} : { tokenExpiresAtMs: account.tokenExpiresAtMs },
		...account.refreshExpiresAtMs === void 0 ? {} : { refreshExpiresAtMs: account.refreshExpiresAtMs }
	});
}
/**
* 按区域槽位合并一次 settings 写入。
*
* 客户端只带它要写的那一个区域（`{ [region]: value }`）——它没有另一侧的当前
* 状态，无法自己做合并；而宿主有 `describe()`，所以合并必须发生在这里。
*
* 规则：
*   - `regions.<region>` 是**槽位级**的：请求里出现的槽位整份替换（槽位内部的
*     字段级合并已经在客户端完成——`nextRegionModels` 从现槽位起 merge），未出现
*     的槽位**原样保留**；
*   - 若宿主当前没有这个槽位，则整份采用请求值。
*
* 这条规则是必须的，不是优化：缺了它，保存任一区域都会静默删除另一区域的全部
* 配置（用户实拍「保存模型保存不了」）。
*/
function mergeSlotWise(field, described, incoming) {
	if (field !== "regions") return incoming;
	if (!isRecord(incoming)) return incoming;
	const current = described.find((entry) => entry.value !== void 0)?.value;
	const currentRegions = isRecord(current) && isRecord(current["regions"]) ? current["regions"] : void 0;
	if (currentRegions === void 0) return incoming;
	const merged = { ...currentRegions };
	for (const [region, value] of Object.entries(incoming)) merged[region] = isRecord(value) && isRecord(currentRegions[region]) ? {
		...currentRegions[region],
		...value
	} : value;
	return {
		...isRecord(current) ? current : {},
		regions: merged
	};
}
/** Whether a value is a plain (non-array, non-null) object. */
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
/**
* This region's usage entry, refreshed from upstream first.
*
* 对齐 workbuddy：那边的 usage 路由每次请求都现场拉积分，所以数字总是新的。Qoder
* 移植时换成了纯缓存读，而缓存只在「启动 / 配置写入 / 刷新模型 / 签到」四个时机
* 被写 —— 聊天扣费后触发器上的数字**永远不会自己变新**，而面板表格（每账号现场
* 读）是新的，于是同一个账号在同一个面板里显示两个数（用户实拍 800 vs 738）。
*
* 三条约束，缺一不可：
*   1. **失败绝不能把文档打回空白**。`refreshUsage` 的失败由宿主记成覆盖层
*      （`staleError` → 文档的 `refreshError`），这里只 await、不抛；
*   2. **dep 缺席（旧宿主）时退回原来的缓存读**，行为与从前一致；
*   3. 刷新**之后**才读缓存，否则读到的还是上一轮的旧快照 —— 修了等于没修。
*/
async function freshUsageEntryOf(deps, region) {
	try {
		await deps.refreshUsage?.(region);
	} catch {}
	return deps.usage(region);
}
/** Build one region's main usage document. */
async function buildWebUsage(deps, region, options = {}) {
	const fast = options.detail === "fast";
	const sources = deps.credentialSources(region);
	const store = deps.store(region);
	const accounts = await store.accounts(sources);
	const selectedId = deps.selectedAccountId(region);
	let serving = await store.resolve(sources, selectedId);
	if (serving === void 0) {
		const selectionExplicit = selectedId !== void 0 && selectedId !== "";
		const selectionLost = selectionExplicit && accounts.length > 0;
		deps.regionUsable?.(region, false);
		const pool = deps.pool === void 0 ? void 0 : await buildPoolView(deps, region, accounts, deps.catalogs[region].current(), void 0, fast);
		const lastQuotaExhaustion = deps.lastQuotaExhaustion?.(region);
		return {
			status: "signed-out",
			accounts: accounts.map(webAccountOf(deps, region)),
			enabled: deps.regionEnabled(region),
			showCreditsInMainUi: deps.regionCreditsShown(region),
			creditPosition: deps.creditPosition?.(region) ?? "composer",
			...lastQuotaExhaustion === void 0 ? {} : { lastQuotaExhaustion },
			message: selectionLost ? "所选账号已不存在，请重新选择或填写 PAT" : "请填写 Qoder PAT（或设置环境变量）",
			selectionLost,
			selectionExplicit,
			...pool === void 0 ? {} : { pool }
		};
	}
	deps.regionUsable?.(region, true);
	const catalog = deps.catalogs[region].current();
	const enabledKeys = new Set(deps.enabledModelKeys(region));
	const budgets = deps.contextBudgets(region);
	const models = catalog.map((model) => {
		const budget = budgets[model.key];
		const effectiveWindow = budget !== void 0 && model.contextTiers?.includes(budget) ? {
			contextWindow: budget,
			nativeContextWindow: model.contextWindow
		} : {
			contextWindow: model.contextWindow,
			nativeContextWindow: model.contextWindow
		};
		return {
			...webModelOf(model),
			...effectiveWindow
		};
	});
	const usageEntry = fast ? deps.usage(region) : await freshUsageEntryOf(deps, region);
	const offKeysRaw = deps.offModelKeys(region);
	const offModelKeys = catalog.filter((m) => offKeysRaw.includes(m.key)).map((m) => m.key);
	const credentialRejected = usageEntry?.error === "credential-rejected";
	let recovery;
	if (credentialRejected) recovery = deps.credentialRecovery === void 0 || fast ? { reloginRequired: accounts.length <= 1 } : await deps.credentialRecovery(region, serving.id);
	let pool;
	if (deps.pool !== void 0) pool = await buildPoolView(deps, region, accounts, catalog, serving.id, fast);
	const lastQuotaExhaustion = deps.lastQuotaExhaustion?.(region);
	return {
		status: "signed-in",
		accountId: serving.id,
		accountName: serving.accountName,
		region,
		enabled: deps.regionEnabled(region),
		showCreditsInMainUi: deps.regionCreditsShown(region),
		creditPosition: deps.creditPosition?.(region) ?? "composer",
		...lastQuotaExhaustion === void 0 ? {} : { lastQuotaExhaustion },
		source: serving.source,
		...serving.tokenExpiresAtMs === void 0 ? {} : { tokenExpiresAtMs: serving.tokenExpiresAtMs },
		...serving.refreshExpiresAtMs === void 0 ? {} : { refreshExpiresAtMs: serving.refreshExpiresAtMs },
		selectionExplicit: selectedId !== void 0 && selectedId !== "",
		accounts: accounts.map(webAccountOf(deps, region, serving.id)),
		models,
		enabledModelKeys: models.filter((m) => enabledKeys.has(m.key)).map((m) => m.key),
		offModelKeys,
		imageModelKeys: deps.imageModelKeys(region).filter((key) => catalog.some((m) => m.key === key)),
		imageSelectionSaved: deps.imageSelectionSaved?.(region) ?? deps.imageModelKeys(region).length > 0,
		...usageEntry?.usage?.credits === void 0 ? {} : { credits: usageEntry.usage.credits },
		...usageEntry?.error !== void 0 ? { creditsError: redactQoderText(usageEntry.error) } : {},
		...usageEntry?.staleError === void 0 ? {} : { refreshError: redactQoderText(usageEntry.staleError) },
		...usageEntry?.usage?.atMs === void 0 ? {} : { creditsAtMs: usageEntry.usage.atMs },
		...credentialRejected && recovery ? {
			credentialRejected: true,
			recovery
		} : {},
		contextBudgets: budgets,
		thinkingEfforts: deps.thinkingEfforts(region),
		...pool === void 0 ? {} : { pool }
	};
}
/** Build the pool's web view, including per-account rows tied to the probes. */
async function buildPoolView(deps, region, accounts, catalog, servingAccountId, fast = false) {
	const pool = deps.pool;
	const prefs = pool.preferences(region);
	const probes = pool.poolProbes(region);
	const now = Date.now();
	const memberSet = new Set(prefs.memberAccountIds);
	/** 当前确实存在的账号 id —— 用来把配置里的残渣过滤掉。 */
	const knownIds = new Set(accounts.map((account) => account.id));
	prefs.targetModelId;
	const targetModels = catalog.map((m) => ({
		id: m.key,
		name: m.displayName,
		creditMultiplier: m.isFree === true ? 0 : m.priceFactor,
		contextWindow: m.contextWindow
	}));
	const target = resolveTargetModel(targetModels, prefs.targetModelId, {
		avoidModelIds: queuedModelIdsOf(probes, now),
		preferModelIds: workingModelIdsOf(probes)
	});
	const checkinSupported = pool.checkinSupported(region);
	const checkinSnapshot = pool.checkinSnapshot?.(region) ?? {};
	const checkinLegacy = pool.checkinState?.(region) ?? {};
	const effectiveIds = [];
	const rows = [];
	/**
	* 「serving 号自己是否已被排除」与「池里还有没有人能接管」。
	*
	* 这两件事必须在**循环之前**算出来，因为每一行的 `current` 都要用它。
	* 「还有没有人能接管」按 `prefs.memberAccountIds` 直接算，不等
	* `effectiveIds` —— 后者要跑完循环才知道，而循环里就要这个答案。
	* 判据与请求路径一致：成员 ∩ 未被排除（`nextFailoverCredential` 里
	* `rankPool(...)[0]` 用的同一条 `exclusionOf`）。
	*/
	const servingExcluded = servingAccountId !== void 0 && exclusionOf(probes[servingAccountId], now, target.modelId) !== void 0;
	const anyMemberCanServe = prefs.memberAccountIds.some((id) => exclusionOf(probes[id], now, target.modelId) === void 0);
	/**
	* 实际在服务的账号。
	*
	* 用户实拍（2026-10-18）：serving 号标着「当前使用」，同一行却写着
	* 「✗ 用量已达上限」，读起来像自相矛盾。工作簿（workbuddy）对这件事的处理
	* 是：serving 号被排除且无人接管时直接答 `undefined` —— 注释写明理由是
	* 「把它报成在用，会和正下方那张写着同一个号被限流的表自相矛盾」。
	*
	* 这里照做，但把条件收窄到**真的没人接管**：池开着、且所有成员都被排除。
	* 只要还有别的号能接管，`current` 就落在接管者身上（见下面的行循环），
	* 「有人在买单」这句话仍然成立。
	* 池关着时不做这个降级 —— 没有第二个人，报「没人在用」只会让标题变空。
	*/
	const liveServing = servingExcluded && prefs.enabled && !anyMemberCanServe ? void 0 : servingAccountId;
	let memberCredits;
	if (fast) {
		if (pool.cachedMemberCredits === void 0) return void 0;
		memberCredits = pool.cachedMemberCredits(region, prefs.memberAccountIds);
	} else memberCredits = await pool.memberCredits?.(region, prefs.memberAccountIds).catch(() => void 0);
	/**
	* 池开启时的**接管候选人**：`rankPool` 第一个可用的成员。
	*
	* ⚠️ 它**不是**「每个请求的第一发」——此前这里的注释把方向写反了。真实请求
	* 路径（`src/shim.ts` 的 `handleChat`）每次都先 `resolveServing()`，也就是
	* `store.resolve(sources, selectedAccountId)`：**第一发永远打给用户选中的号**。
	* 只有首字节之前被硬拒（auth / 限流 / 额度 / 瞬时），才走
	* `nextFailoverCredential` → `rankPool(candidates,...)[0]` 重试。所以这个
	* 候选人只在「选中号此刻被排除」时才会真正接管；选中号好着时，第一发根本
	* 轮不到它，把它报成「当前使用」同样是假话。
	*
	* 判据必须与请求路径逐字相同（同一个 `rankPool`、同一个 `orderAccountIds`、
	* 同一个目标模型作用域），否则接管发生时卡片会指错人。
	* 取不到候选（没有可用成员）时退回 `undefined` —— 说不出就不说。
	*/
	let livePriorityAccount;
	if (prefs.enabled) {
		const candidates = [];
		for (const accountId of prefs.memberAccountIds) {
			const probe = probes[accountId];
			const reading = memberCredits?.get(accountId);
			candidates.push({
				account: {
					id: accountId,
					accountName: accountId
				},
				...reading === void 0 ? {} : { credits: reading },
				...probe === void 0 ? {} : { probe }
			});
		}
		livePriorityAccount = rankPool(candidates, now, target.modelId, prefs.orderAccountIds).find((row) => row.excludedBy === void 0)?.account.id;
	}
	for (const account of accounts) {
		const member = memberSet.has(account.id);
		const probe = probes[account.id];
		const excludedBy = exclusionOf(probe, now, target.modelId);
		const isCurrent = prefs.enabled && servingExcluded ? livePriorityAccount === account.id : liveServing === account.id;
		if (member) {
			if (await pool.credentialFor(region, account.id) !== void 0) effectiveIds.push(account.id);
		}
		const reading = member === true ? memberCredits?.get(account.id) : void 0;
		rows.push({
			accountId: account.id,
			accountName: account.accountName,
			source: account.source,
			...reading === void 0 ? {} : {
				credits: reading.total,
				expiringSoon: reading.expiringSoon,
				...reading.nearestExpiryMs === void 0 ? {} : { nearestExpiryMs: reading.nearestExpiryMs }
			},
			...probe === void 0 ? {} : { probe: {
				outcome: probe.outcome,
				atMs: probe.atMs,
				...probe.source === void 0 ? {} : { source: probe.source },
				...probe.retryAtMs === void 0 ? {} : { retryAtMs: probe.retryAtMs },
				...probe.queue === void 0 ? {} : { queue: probe.queue },
				...probe.message === void 0 ? {} : { message: probe.message },
				...probe.modelId === void 0 ? {} : { modelId: probe.modelId }
			} },
			...excludedBy === void 0 ? {} : { excludedBy },
			...checkinSupported && checkinSnapshot[account.id] !== void 0 ? {
				checkedInToday: checkinSnapshot[account.id].claimed,
				...checkinSnapshot[account.id].refreshAtMs === void 0 ? {} : { checkinRefreshAtMs: checkinSnapshot[account.id].refreshAtMs }
			} : checkinSupported && checkinLegacy[account.id] !== void 0 ? { checkedInToday: checkinLegacy[account.id] === true } : {},
			current: isCurrent,
			member
		});
	}
	/**
	* 「这一行的 current 是怎么来的」。
	*
	* 用户实拍（2026-10-18）：nick1064248741 标着「当前使用」，同一行却写着
	* 「✗ 用量已达上限」；上面 nick2223682662 还有 100 分、目标模型列写着
	* 「✓ 可用」。读起来像自相矛盾。真实请求路径（`src/shim.ts`）是：
	*
	*   · 每一发的第一击都是 `resolveServing()` —— 用户**选中**的号；池开着不会
	*     改变这一点（此前本文件的注释把它写成「请求先发 rankPool 第一名」，方向
	*     是反的，本轮已按代码逐行核实并纠正）。
	*   · 只有选中号在首字节前被硬拒，池才会让 `rankPool` 第一个可用的成员
	*     **接管**这次请求并由它计费。
	*
	* 所以 `current` 有两种来源，必须让 UI 说出来，否则「当前使用」与同一行的
	* 「用量已达上限」会读起来互相打架：
	*
	*   - `selected`：选中号在服务（池开与否都一样——它没被排除时第一发就在它身上）；
	*   - `failover`：选中号此刻被排除、接管者是这个成员 ——「接管」不是「回落」，
	*     它是当前唯一真正在买单的人。
	*
	* 还有一种更糟的情形（workbuddy 同款判断）：选中号被排除、而**池里没有别人
	* 能接管**时，`current` 全是 false、本字段缺席，配 `servingUnavailable: true` —
	* 「谁在计费」的诚实答案是「没有人」：下一个请求会直接失败而不是记在谁头上。
	*/
	const servingSource = liveServing === void 0 ? void 0 : prefs.enabled && servingExcluded ? "failover" : "selected";
	/**
	* 清洗过的用户顺序：只保留**当前确实存在的账号**。
	*
	* 配置里的 `orderAccountIds` 在删除账号后不会自动收缩（与 `memberAccountIds`
	* 同一个残渣问题），原样透传会让卡片把名次算在一个已经不存在的行上。
	*/
	const orderedIds = (prefs.orderAccountIds ?? []).filter((id) => knownIds.has(id));
	return {
		enabled: prefs.enabled,
		checkinSupported: pool.checkinSupported(region),
		...target.modelId === void 0 ? {} : { targetModelId: target.modelId },
		...target.source === "stale" && target.staleModelId !== void 0 ? { staleTargetModelId: target.staleModelId } : {},
		targetModelSource: target.source,
		...servingSource === void 0 ? {} : { servingSource },
		...livePriorityAccount === void 0 ? {} : { priorityAccountId: livePriorityAccount },
		...servingExcluded && liveServing === void 0 ? { servingUnavailable: true } : {},
		memberAccountIds: prefs.memberAccountIds,
		...orderedIds.length === 0 ? {} : { orderAccountIds: orderedIds },
		...prefs.probeInputTokens && prefs.probeInputTokens > 0 ? { probeInputTokens: prefs.probeInputTokens } : {},
		effectiveMemberAccountIds: effectiveIds,
		accounts: rows,
		catalog: targetModels
	};
}
/**
* Test every account against one model, one at a time.
*
* The model is resolved by the caller (see `resolveTargetModel`) so this
* function never has to decide "free or not". Never throws: a failed probe is
* a ROW, not an aborted batch.
*
* `onRow` fires the moment one account's row exists, so a caller can report
* progress instead of waiting for the SLOWEST member.
*/
async function testAllAccounts(targets, modelId, deps, onRow) {
	const rows = [];
	for (const [index, target] of targets.entries()) {
		if (index > 0) await (deps.wait ?? defaultWait)(400);
		const row = await testOne(target, modelId, deps);
		rows.push(row);
		onRow?.(row);
	}
	return rows;
}
/**
* Test ONE account, returning its row.
*
* Exported because the card's per-row "测试" button used to call the BATCH
* runner, so clicking one account's test re-probed the whole pool — a real
* cost, not just a UI oddity: every member spends a real probe request
* (~25k input tokens on Qoder's side), and the row you clicked was not
* necessarily the one that changed anything. A row-level control must touch
* that row only.
*
* Same row contract as the batch (`QoderPoolTestRow`): a failed probe is a
* ROW, never a throw.
*/
async function testOne(target, modelId, deps) {
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
			result: {
				modelId,
				outcome: "credential-rejected",
				message: messageOf(error)
			}
		};
	}
	if (credential === void 0) return {
		...base,
		result: {
			modelId,
			outcome: "credential-rejected",
			message: "no stored credential for this account"
		}
	};
	return {
		...base,
		result: await withProbeTimeout(deps.probe(credential, modelId), modelId, deps.probeTimeoutMs ?? 9e4)
	};
}
/**
* Race one probe against a hard limit.
*
* A timeout is a **row** too — `unavailable` with its own words — never a throw
* and never an endless wait: the batch is serial, so one request that never
* comes back would otherwise hold every account behind it, forever.
*
* A late rejection after the timeout lands on an already-settled promise and is
* swallowed here: `then` keeps a handler attached, so it cannot surface as an
* unhandled rejection.
*/
function withProbeTimeout(probe, modelId, timeoutMs) {
	let timer;
	const timeout = new Promise((resolve) => {
		timer = setTimeout(() => {
			resolve({
				modelId,
				outcome: "unavailable",
				message: `probe timed out after ${Math.max(1, Math.round(timeoutMs / 1e3))}s`
			});
		}, timeoutMs);
	});
	return Promise.race([probe.catch((error) => ({
		modelId,
		outcome: "unavailable",
		message: messageOf(error)
	})), timeout]).finally(() => {
		if (timer !== void 0) clearTimeout(timer);
	});
}
/** The default inter-account pause. */
function defaultWait(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
/** A safe message from an unknown throwable, bounded in length. */
function messageOf(error) {
	return (error instanceof Error ? error.message : String(error)).slice(0, 300);
}
//#endregion
//#region src/index.ts
const name = "dsh-connect-qoder";
/** The model registry and settings service required before providers register. */
const inject = ["llm", "settings"];
/**
* 积分读（`sash/api/v2/me/usage`）的超时上限。
*
* 这个读现在发生在**每次** `/usage` 路由请求上（卡片 60s 轮询 + composer 300s +
* 面板打开），所以它不能再无界：上游挂住会把整张卡片与 composer 读数一起挂住。
*/
const USAGE_FETCH_TIMEOUT_MS = 8e3;
/**
* 给一个 promise 加硬超时，超时**按「这次没读到」处理**（resolve undefined），
* 而不是抛错。
*
* 两条理由：
*   1. `fetchUsage` 先 `ensureSession()` 再带 signal 打 sash，signal 只管得住后半段
*      —— 会话过期时前半段（jobToken 交换）挂住，signal 还没生效。整体 race 才封得住。
*   2. 超时必须落到**保旧值**那条分支，而不是 catch 分支：后者会把缓存写成
*      `usage: undefined`，于是「网络慢」被显示成「没有积分数据」。
*
* 迟到的 rejection 要单独吞掉：promise 已经按超时结算之后，它再 reject 就是一次
* 没人处理的 rejection。
*/
function withHardTimeout(promise, timeoutMs) {
	let timer;
	return new Promise((resolve, reject) => {
		timer = setTimeout(() => {
			resolve(void 0);
		}, timeoutMs);
		promise.then(resolve, reject);
	}).finally(() => {
		if (timer !== void 0) clearTimeout(timer);
	});
}
/** The namespace the HOST actually serves this plugin under (workbuddy probe). */
function settingsNamespaceOf(ctx) {
	const id = ctx?.fiber?.entry?.options?.id;
	return typeof id === "string" && id !== "" ? id : QODER_SETTINGS_NS;
}
function asVolatile(schema) {
	if (typeof schema.volatile === "function") return schema.volatile();
	return schema;
}
/** Unwrap a schemastery volatile's reactive `.get()` into a plain snapshot. */
function unwrapVolatile(value) {
	if (value !== null && typeof value === "object" && "get" in value && typeof value.get === "function") return value.get();
	return value;
}
const modelConfig = z.object({
	key: z.string(),
	displayName: z.string(),
	priceFactor: z.number(),
	contextWindow: z.number(),
	maxOutputTokens: z.number(),
	supportsImages: z.boolean(),
	supportsThinking: z.boolean(),
	canDisableThinking: z.boolean(),
	isDefault: z.boolean(),
	isFree: z.boolean(),
	isNew: z.boolean(),
	/**
	* 该模型声明的思考强度档位（`['xhigh','low','medium']` 之类，已按强度升序）。
	*
	* 必须在这里声明成 `required(false)`，否则思考强度选择器整个不渲染。但**机制
	* 不是「被 zod 剥掉」**（本注释原先这么写，是错的，已由实验更正）：实测
	* schemastery **不剥未声明的键**（`nativeContextWindow` / `maxTokens` 那些都会
	* 原样透传），真正会发生的是**缺席的数组被补成 `[]`**。
	*
	* 于是缺陷链条是：客户端从不写这个字段（0.4.2 已修）→ 落盘缺席 → 解析补 `[]`
	* → 读取端 `modelFromStored` 的判据是 `length > 0` → 档位选择器消失
	* （用户实拍「拉取的思考模式又不见了」「每次保存都会思考强度不见了」）。
	* 也就是说：**声明仍然必需，必需的理由是那三个字段的判据（`length > 0` / 非空串）
	* 与「缺席补 []」之间的落差，而不是剥键。** `contextTiers` 同理。
	*/
	thinkingEfforts: z.array(z.string()).required(false),
	defaultThinkingEffort: z.string().required(false),
	contextTiers: z.array(z.number()).required(false),
	/**
	* 上游的活动优惠规则（`promotion`），原样往返。
	*
	* 用 `z.any()` 而不是嵌套 schema，理由只有两条：**不写第二套解析**（上游 snake_case
	* → `QoderPromotion` 的映射只在 `parseQoderPromotion` 里有一份），以及**不让 schema
	* 去「理解」上游文档**——上游字段随活动类型变化，逐个声明等于把上游的形状抄进配置层，
	* 抄漏的那次就会像 `thinkingEfforts` 那样把数据抹掉。
	*
	* 注意它**不等于**「未来新增的键会被保住」：读回时走 `readPromotion` 的白名单重建，
	* 插件不认识的键在那里就丢了（这是有意的——卡片只消费自己声明过的字段）。所以这个
	* 字段的契约是「本插件已知的字段原样往返」，不是「上游文档原样存档」。
	*/
	promotion: z.any().required(false)
});
const poolConfig = z.object({
	enabled: z.boolean().default(false),
	targetModelId: z.string().default(""),
	probeInputTokens: z.number().default(0),
	memberAccountIds: z.array(z.string()).default([]),
	/**
	* 用户手动排定的账号优先级（靠前的先用）。
	*
	* 与 `memberAccountIds` **分开**存：那个是成员资格（谁在池里），这个是顺序
	* （先用谁）。合成一个数组会让「取消勾选再勾回来」意外改变优先级，而旧配置
	* 里的那个顺序只是勾选历史，并不表达意图。
	*
	* 空数组 = 完全由 `rankPool` 的积分策略决定（修复前的行为）。
	*/
	orderAccountIds: z.array(z.string()).default([])
});
/**
* 重试预算（issue #24）。**三个 0 都表示「用宿主默认」**。
*
* 用 0 而不是 `.optional()` 作缺省：配置界面把三个数字框摆在用户眼前，留空
* 就是 0；而「0 次重试」是一个真实且有用的选择（彻底关掉原地重试），不能被
* 当作「未配置」吞掉。所以判据是「值为 0 = 跟随宿主默认」，与「填 0 = 关掉」
* 分开 —— 后者请填 `maxRetries: -1`？不行，那更绕。
*
* 结论：这里只把 **0 当默认**，并把「关掉重试」留给宿主默认里的 `maxRetries`
* 之外的手段（本版不提供）。理由：把 0 解释成「关」会让**升级用户**的中文
* 配置（schema 默认 0）一上来就关掉全部重试，那是静默的行为变化。
*/
const regionRetryConfig = z.object({
	/** 最多重试几次（0 = 跟随宿主默认）。 */
	maxRetries: z.number().step(1).min(0).default(0).description("最多原地重试几次（0 = 跟随宿主默认）"),
	/** 首次退避毫秒（0 = 跟随宿主默认）。 */
	initialDelayMs: z.number().min(0).default(0).description("首次退避毫秒（0 = 跟随宿主默认）"),
	/** 退避上限毫秒（0 = 跟随宿主默认）。 */
	maxDelayMs: z.number().min(0).default(0).description("退避上限毫秒（0 = 跟随宿主默认）")
});
const regionConfig = z.object({
	/** 本区域 PAT。留空读环境变量；env 与 vault 承接连带选择。 */
	pat: z.string().default("").description("Qoder PAT（留空时读取环境变量）"),
	/** 本区域 provider 是否启用；显式 false 才停用（opt-out）。 */
	enabled: z.boolean().default(true),
	/** 用户显式选择的账号 id（'' = 自动：settings → env → vault）。 */
	accountId: z.string().default(""),
	/** 是否在主界面展示积分（composer 面板）；opt-out。 */
	showCreditsInMainUi: z.boolean().default(true),
	/**
	* 积分读数放在哪个席位。
	*
	* 两个席位，因为第一个不总是可用：
	*
	*   - `composer` —— 输入框工具栏（`conversation.input.right`），与 shell 自带
	*     控件共享该 list 插槽。它更近、更易扫一眼，且是默认值，所以没主动选过的
	*     人升级后界面不动。
	*   - `stats` —— 输入框卡片下方的常驻栏（`conversation.composer.dock`），
	*     即 shell 渲染「轮次 / tok/s / token / 缓存命中」那一行。那个 list 插槽的
	*     自带占用者单独注册，因此另一个把东西停在输入框那行的第三方插件，无法把
	*     这个读数挤到消失。
	*
	* 参考 dsh-connect-workbuddy 的 issue #62：装了第三方插件后读数从输入框那行
	* 消失，根因是「席位本身」——list 插槽无法保证每个占用者都可见。把席位变成
	* 用户的选择，正是让一个插件的存在不再决定另一个插件的可见性。
	*/
	creditPosition: z.union([z.const("composer"), z.const("stats")]).default("composer").description("积分读数的位置：\"composer\" = 输入框工具栏（默认），\"stats\" = 输入框卡片下方的常驻栏，与 shell 自己的 token 统计同行。若输入框那行被其他插件占用，选 \"stats\"。"),
	/** 用户勾选的模型 key 集合。 */
	enabledModelKeys: z.array(z.string()).default([]),
	/**
	* 用户**显式**开启图片输入的模型 key 集合。
	*
	* 图像能力只来自这里，绝不从上游的 `is_vl` 平台标记推断——那是**平台**的
	* 声明，不该替本插件下逐模型的能力结论（见 src/native-modality.ts：为什么
	* 不采信、核对表现在按什么键控、结论是从哪来的）。
	* 与 lastCatalog 分开存储，使勾选状态不随目录重写而耦合丢失。
	*
	* **它是白名单，不是追加清单**：列出的才开图，未列出的一律关。所以「用户
	* 把全部勾都取消」与「用户从未保存过」在**数据上**都表现为空数组，而两者的
	* 正确行为相反（前者应保持全关，后者应套用核对表种子）。空集无法区分它们，
	* 因此判据是下面那个显式标记 {@link imageSelectionSaved}，不是 `length > 0`。
	*/
	imageModelKeys: z.array(z.string()).default([]),
	/**
	* 用户是否**保存过**图片选择（与集合内容无关）。
	*
	* 存在的唯一理由是把「从未选过」与「选成了空集」分开：`imageModelKeys` 是
	* 白名单，两种情况都是 `[]`，但前者要套核对表种子、后者要尊重「全关」。
	* 靠 `imageModelKeys.length > 0` 推断会把后一种误判成前一种，用户取消全部
	* 勾选后一刷新图又回来了（issue #22 的次因）。
	*
	* 缺省 `false` = 从未保存过（含升级上来的旧配置）：旧配置里 `imageModelKeys`
	* 非空时另有兜底判据，见 `imageSelectionSavedOf`。
	*/
	imageSelectionSaved: z.boolean().default(false),
	/** 用户关闭的模型 key 集合（独立于硬性关闭）。 */
	offModelKeys: z.array(z.string()).default([]),
	/** 每个模型的显式上下文预算（必须是模型声明的 tier，否则用原生值）。 */
	contextBudgets: z.dict(z.number()).default({}),
	/**
	* 每个模型保存的思考强度（档位名，如 `low` / `medium` / `xhigh`）。
	*
	* 「设置里选好、之后每个请求自动带上」——与 Qoder 客户端同形态（它的事件
	* 名就叫 `reasoning-effort-changed`）。缺省表示用模型自己声明的默认档。
	* 键是模型 key：不同模型的档位名不统一（Qwen 系 low/medium/xhigh，
	* DeepSeek/GLM 系 low/high/max），所以必须逐模型存。
	*/
	thinkingEfforts: z.dict(z.string()).default({}),
	/** 账号池偏好。 */
	pool: poolConfig.default({
		enabled: false,
		targetModelId: "",
		probeInputTokens: 0,
		memberAccountIds: []
	}),
	/**
	* 重试预算（issue #24）。缺省 = 宿主默认，行为与升级前一致。
	*
	* 为什么要能配：`llm-retry` 的等待阶梯由 provider 自己的策略决定，本插件此前
	* 只传 `resolveRetryPolicy(undefined, …)`（宿主默认 5 次 / 500ms→10s）。上游
	* 报 `10605 / RESOURCE_LIMIT` 的两种形态差很多（瞬时 5 秒 / `queueType:p2`
	* 排队 30 秒），一套固定阶梯不可能同时贴合；而插件又没暴露配置项，用户只能改
	* `node_modules` 里的构建产物 —— 升级即静默还原。
	*
	* 只暴露**三个**数字，不暴露 `mode` / `retryableCodes`：那两个会改变「哪些错误
	* 值得重试」的语义（`always` 甚至会让一个必然失败的请求无限重试），不是「调预算」。
	*/
	retry: regionRetryConfig.default({
		maxRetries: 0,
		initialDelayMs: 0,
		maxDelayMs: 0
	}),
	/** 保存的模型目录（卡片“保存”时写入）。 */
	lastCatalog: z.array(modelConfig).default([])
});
const Config = z.object({ regions: asVolatile(z.dict(regionConfig).default({}).description("Per-region Qoder settings, keyed cn | global")) });
/**
* 一份目录是否**声明了**思考档位。
*
* 「一个模型都没有档位」有两种完全不同的含义，必须分开：
* 1. 上游当前没声明（`thinkingEfforts` 字段缺席或为空）—— 那它是「上游没
*    档位」的诚实答案；
* 2. 这份目录来自一次没拉到档位的时刻 —— 本机实测 14 个 cn 模型的
*    `thinkingEfforts` 全是 `[]`，是旧 schema 把字段剥掉时的产物。用它当答案，
*    卡片就不渲染档位选择器（用户实拍「思考强度有时候有、有时候没有」：点一次
*    「从 Qoder 刷新」就有，重启后就没）。
*
* 两种情况从数据上分不开（空数组与缺席都判「没声明」），要不要重拉由**目录的
* 来源**决定：调用方只在「本进程还没成功拉到实时目录」时才据此触发重拉（见
* displayModels）—— 实时目录没档位是上游的诚实答案，重拉多少次都一样。
*
* 判据用 `length > 0` 而不是「字段在不在」：旧 schema 留下的是**空数组**而不是
* 缺席，所以「字段在」恰恰不能作为「声明过」的证据。
*/
function catalogSnapshotDeclaresEfforts(models) {
	return models.some((model) => (model.thinkingEfforts?.length ?? 0) > 0);
}
/**
* 「手上的目录能不能当档位答案」——**判据与动作打包在一起**。
*
* 拆开成两个函数（判据一个、调用处自己判）会留下一条没被测试覆盖的接线：把调用处
* 变异掉，单测仍然全绿（第一版就是这么自我欺骗的）。这里让规则自己执行动作并
* 返回结论，于是「动作有没有真的发生」也能被断言。
*
* 检测到「一个档位都没声明」时**不改动要服务的模型列表**：模型不能从卡片上
* 消失，缺的只是档位 —— 后台拉回来之后的下一次读取自然补上。返回 `stale`
* 标记这次调用有没有触发过拉取。
*/
function serveSavedCatalog(models, onStale) {
	if (catalogSnapshotDeclaresEfforts(models)) return {
		models,
		stale: false
	};
	onStale();
	return {
		models,
		stale: true
	};
}
/** 某区域的配置状态（缺省返回空对象）。 */
function regionStateOf(config, region) {
	const stored = unwrapVolatile(config.regions)?.[region];
	if (stored !== void 0 && stored !== null && typeof stored === "object") return stored;
	return {};
}
/** 某区域是否启用（opt-out）。 */
function regionEnabled(config, region) {
	return regionStateOf(config, region).enabled !== false;
}
/**
* 某区域的重试预算 → 宿主的 `RetryPolicyConfig`（issue #24）。
*
* 三个值全为 0（schema 默认）时返回 `undefined`：**交给宿主默认**，与升级前
* 逐字一致。只要有一个非 0 就成对补齐 —— 宿主的 `resolveBackoff` 要求
* `initialDelayMs <= maxDelayMs` 且都为正数，所以缺失的一侧用另一侧/默认填，
* 而不是原样把 0 递进去（那会直接抛）。
*
* `mode` 恒为 `normal`（只重试宿主的可重试码）：`always` 会让一个必然失败的
* 请求无限重试，那不是「调预算」，所以本版不暴露。
*/
function retryPolicyOf(config, region) {
	const raw = regionStateOf(config, region).retry ?? {};
	const num = (value) => typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
	const maxRetries = num(raw.maxRetries);
	const initialDelayMs = num(raw.initialDelayMs);
	const maxDelayMs = num(raw.maxDelayMs);
	if (maxRetries === 0 && initialDelayMs === 0 && maxDelayMs === 0) return void 0;
	const initial = initialDelayMs > 0 ? initialDelayMs : Math.min(500, maxDelayMs > 0 ? maxDelayMs : 500);
	const max = maxDelayMs > 0 ? maxDelayMs : Math.max(initial, 1e4);
	return {
		mode: "normal",
		...maxRetries > 0 ? { maxRetries } : {},
		backoff: {
			initialDelayMs: Math.min(initial, max),
			maxDelayMs: max
		}
	};
}
/** 某区域是否在主界面显示积分（opt-out）。 */
function regionCreditsShown(config, region) {
	return regionStateOf(config, region).showCreditsInMainUi !== false;
}
/**
* 某区域的积分读数放在哪个席位。
*
* 本地读取而不是依赖 schema 默认值：这样在设置存在之前写下的配置读出来是
* `composer` —— 当时唯一的席位 —— 所以升级不会移动屏幕上的任何东西。
*/
function creditPosition(config, region) {
	return regionStateOf(config, region).creditPosition === "stats" ? "stats" : "composer";
}
/** 某区域是否配置了凭据（设置 PAT 或环境变量其一）。 */
function regionHasCredential(config, region) {
	const state = regionStateOf(config, region);
	if ((typeof state.pat === "string" ? state.pat.trim() : "") !== "") return true;
	return patFromEnv(region) !== void 0;
}
/** 某区域显式选择的账号 id（undefined = 自动）。 */
function selectedAccountId(config, region) {
	const id = regionStateOf(config, region).accountId;
	return typeof id === "string" && id !== "" ? id : void 0;
}
/** 某区域保存的 contextBudgets（过档位改写表：旧存档的 400K 读回即 500K）。 */
function contextBudgetsOf(config, region) {
	const raw = regionStateOf(config, region).contextBudgets;
	if (raw === null || raw === void 0 || typeof raw !== "object") return {};
	const out = {};
	for (const [key, value] of Object.entries(raw)) if (typeof value === "number" && Number.isFinite(value)) out[key] = value;
	return migrateContextBudgets(out);
}
/** 某区域保存的 offModelKeys。 */
function offModelKeysOf(config, region) {
	const state = regionStateOf(config, region);
	return Array.isArray(state.offModelKeys) ? state.offModelKeys : [];
}
/** 某区域保存的逐模型思考强度（模型 key → 档位名）。 */
function thinkingEffortsOf(config, region) {
	const raw = regionStateOf(config, region).thinkingEfforts;
	if (raw === null || raw === void 0 || typeof raw !== "object") return {};
	const out = {};
	for (const [key, value] of Object.entries(raw)) if (typeof value === "string" && value !== "") out[key] = value;
	return out;
}
/** 某区域保存的 imageModelKeys（用户显式开启图片输入的模型）。 */
function imageModelKeysOf(config, region) {
	const state = regionStateOf(config, region);
	return Array.isArray(state.imageModelKeys) ? state.imageModelKeys : [];
}
/**
* 用户是否**保存过**图片选择（决定要不要套核对表种子）。
*
* 主判据是显式标记 `imageSelectionSaved`（见配置 schema 里那段：空集既是
* 「从未选过」也是「选成空集」，只有标记能把它们分开）。
*
* 旧配置兜底：`imageSelectionSaved` 是本版新增的键，升级上来的配置里没有它。
* 那种配置只要有**非空**的 `imageModelKeys`，就说明用户当时确实保存过选择
* （旧代码只会在保存时写这个集合），按「已保存」处理；空集则无从判断，按
* 「从未保存」套种子——这正是升级前的行为，不倒退。
*/
function imageSelectionSavedOf(config, region) {
	if (regionStateOf(config, region).imageSelectionSaved === true) return true;
	return imageModelKeysOf(config, region).length > 0;
}
/**
* 把用户的**显式**图片 opt-in 盖印到模型列表上——这是 `supportsImages`
* 在运行时的**唯一**来源，上游的 `is_vl` 平台标记一律不采信。
*
* 与 workbuddy 的 `withImageSelection` 同构：所有运行时目录路径（启动种子、
* 刷新、保存）都经过它，保证同一模型在三条路径上得到一致的图像能力答案。
* 用户从未保存过时，用 `imageDefaultFor` 的核对表结论作种子，使首次打开就能
* 显示正确默认，而不必先保存一次。
*
* `seeded` 的含义是「用户保存过选择」，由 {@link imageSelectionSavedOf} 判定，
* **不是** `images.size > 0`：那是把「白名单为空」当成「没选过」，于是用户把
* 勾全部取消后一刷新，种子又把图全打开了（issue #22 的次因）。
*
* `model.key` 与 `model.displayName` 都要交给查表：核对表的主键是内部短 id、
* 厂商名是别名键，两个候选键覆盖两种来源（旧存档与外部选择器只拿得到显示名）。
* issue #22 的主因就是这里只传了一个键、而表的键形与它不同，于是每次都查不中。
*/
function withImageSelection(models, images, seeded) {
	return models.map((model) => ({
		...model,
		supportsImages: images.has(model.key) ? true : seeded ? false : imageDefaultFor({
			id: model.key,
			name: model.displayName,
			...model.supportsImages === void 0 ? {} : { supportsImages: model.supportsImages }
		})
	}));
}
/**
* 把用户保存的「可关闭思考」选择盖印到运行时目录上。
*
* 上游声明的 `canDisableThinking` 并不可全信（见 src/off-thinking.ts）。运行时
* 适配器只读模型自报的该字段，所以必须在此之前把校正后的答案写上去。用户尚未
* 保存过（选择为空）时用 `defaultOffModelIds` 作为种子——只对上游显式声明可关闭、
* 且不在已知拒绝集里的模型提供 off。
*/
function stampOffSelection(config, region, models) {
	const saved = new Set(offModelKeysOf(config, region));
	return withEffectiveOff(models, saved.size > 0 ? saved : new Set(defaultOffModelIds(models.map(offCapabilityOf))));
}
/**
* 把用户的两项显式选择（图片输入、可关闭思考）盖印到运行时目录上。
*
* 两者机制相同：上游声明不可全信，用户的选择是唯一权威；未保存过时用核对表/
* 内置规则作种子。合在一处便于所有运行时目录路径（启动、刷新、保存）一次盖齐，
* 避免漏盖导致「某条路径上模型能力与另一条不一致」。
*/
function stampRuntimeCatalog(config, region, models) {
	return stampOffSelection(config, region, withImageSelection(models, new Set(imageModelKeysOf(config, region)), imageSelectionSavedOf(config, region)));
}
/** 某区域保存的 enabledModelKeys。 */
function enabledModelKeysOf(config, region) {
	const state = regionStateOf(config, region);
	return Array.isArray(state.enabledModelKeys) ? state.enabledModelKeys : [];
}
/** 某区域保存的 pool 偏好。 */
function poolPreferencesOf(config, region) {
	const raw = regionStateOf(config, region).pool ?? {};
	return {
		enabled: raw.enabled === true,
		targetModelId: typeof raw.targetModelId === "string" ? raw.targetModelId : "",
		probeInputTokens: typeof raw.probeInputTokens === "number" ? raw.probeInputTokens : 0,
		memberAccountIds: Array.isArray(raw.memberAccountIds) ? raw.memberAccountIds : [],
		orderAccountIds: Array.isArray(raw.orderAccountIds) ? raw.orderAccountIds : []
	};
}
/** 把保存的目录条目解析为模型信息（历史兼容）。 */
function modelFromStored(raw) {
	if (typeof raw.key !== "string" || typeof raw.displayName !== "string") return void 0;
	const promotion = readPromotion(raw.promotion);
	return {
		key: raw.key,
		displayName: raw.displayName,
		priceFactor: typeof raw.priceFactor === "number" ? raw.priceFactor : 1,
		contextWindow: typeof raw.contextWindow === "number" ? mapContextTier(raw.contextWindow) : 2e5,
		maxOutputTokens: typeof raw.maxOutputTokens === "number" ? raw.maxOutputTokens : 32768,
		supportsImages: raw.supportsImages === true,
		supportsThinking: raw.supportsThinking === true,
		canDisableThinking: raw.canDisableThinking === true,
		isDefault: raw.isDefault === true,
		isFree: raw.isFree === true,
		isNew: raw.isNew === true,
		...Array.isArray(raw.contextTiers) ? { contextTiers: mapContextTiers(raw.contextTiers.filter((v) => typeof v === "number")) } : {},
		...Array.isArray(raw.thinkingEfforts) && raw.thinkingEfforts.length > 0 ? { thinkingEfforts: raw.thinkingEfforts.filter((v) => typeof v === "string") } : {},
		...typeof raw.defaultThinkingEffort === "string" && raw.defaultThinkingEffort !== "" ? { defaultThinkingEffort: raw.defaultThinkingEffort } : {},
		...promotion === void 0 ? {} : { promotion }
	};
}
/** 某区域当前应展示的目录（保存 → 运行期 → fallback）。 */
function configuredModels(config, region, live) {
	const saved = regionStateOf(config, region).lastCatalog;
	if (Array.isArray(saved) && saved.length > 0) {
		const models = withoutRouters(saved.map((item) => modelFromStored(item ?? {})).filter((m) => m !== void 0));
		if (models.length > 0) return models;
	}
	return live.length > 0 ? live : QODER_FALLBACK_MODELS.map(fallbackModelInfo);
}
/** 把一次用量解析成卡片可渲染的积分包。 */
function creditsOf(usage) {
	const packages = [];
	let total = 0;
	let expiringSoon = 0;
	let nearestExpiryMs;
	const SOON_MS = 2592e5;
	const add = (packageName, remaining, size, expiresAtMs) => {
		if (size <= 0) return;
		total += remaining;
		if (expiresAtMs !== void 0 && remaining > 0) {
			nearestExpiryMs = nearestExpiryMs === void 0 ? expiresAtMs : Math.min(nearestExpiryMs, expiresAtMs);
			if (expiresAtMs - Date.now() < SOON_MS) expiringSoon += 1;
		}
		packages.push({
			packageName,
			remain: remaining,
			size,
			monthly: false,
			...expiresAtMs === void 0 ? {} : { expiresAtMs }
		});
	};
	const userQuota = usage.userQuota;
	if (userQuota !== void 0 && typeof userQuota.total === "number") add("base", Math.max(userQuota.total - (userQuota.used ?? 0), 0), userQuota.total);
	const addOnQuota = usage.addOnQuota;
	if (addOnQuota !== void 0 && typeof addOnQuota.total === "number") add("addon", Math.max(addOnQuota.total - (addOnQuota.used ?? 0), 0), addOnQuota.total, usage.expiresAt);
	const org = usage.orgResourcePackage;
	if (org !== void 0 && typeof org.cap === "number") add("org", Math.max(org.cap - (org.used ?? 0), 0), org.cap);
	return {
		total,
		packages,
		expiringSoon,
		...nearestExpiryMs === void 0 ? {} : { nearestExpiryMs }
	};
}
/**
* 换号播报去重的条目上限。
*
* 真实的键只有「失败账号 × 失败种类 × 接管账号」的组合，数量个位数；上限只是
* 防止某个病态上游把两种 kind 交替着发、把 Map 撑大。超出时淘汰最久没用的
* 那条 —— 淘汰只可能让用户**多看**一条，不会让一条该看的提示消失。
*/
const FAILOVER_ANNOUNCE_MAX_ENTRIES = 32;
function apply(ctx, config) {
	const settingsNs = settingsNamespaceOf(ctx);
	const log = (message) => ctx.logger.warn(`dsh-connect-qoder: ${message}`);
	let stopped = false;
	const stacks = {};
	/**
	* 每区域最近一次**上游明说**的额度耗尽（`liveQuotaExhaustion` 的落点）。
	*
	* 与 `stacks[].poolRuntime` 分开存：那份按账号、服务于池的换号决策；这份按
	* 区域、只服务于 UI——usage 路由把它带进文档，卡片显示「最近一次」。进程内
	* 状态（重启即清）：它说的是「上游最近一次说过」，不是「现在仍然耗尽」，
	* 事实性由时间戳保证，不需要落盘承诺。
	*/
	const quotaExhaustionByRegion = {};
	const usageCache = {};
	const registration = {
		cn: {},
		global: {}
	};
	/**
	* 今日签到状态快照（区域 → 成员 id → 是否已领）。签到批次回写、成员表读取。
	* 进程内即可：它描述的是「今天」，重启后由下一次签到重新写入。
	*/
	const checkinState = {
		cn: {},
		global: {}
	};
	/**
	* 每区域的签到快照：每个成员「是否已领」+「下一窗何时刷新」（epoch 毫秒，
	* 来自上游活动行的 `endAt`）。
	*
	* 为什么不能只留 `checkinState` 那个布尔表：「已领取」这句话离开「还有多久
	* 刷新」是不完整的 —— 领取不是「今天到此为止」，只是这一窗从 `CLAIMABLE`
	* 变成 `CLAIMED`，下一窗什么时候开上游早就写在 `endAt` 里了（实测活动窗是
	* 当天 10:00 → 次日 09:59 UTC+8）。用户实拍里官网页面上那个 `09:22:23`
	* 就是这个 `endAt − 当前时间`。
	*
	* 同样只在进程内：它描述的是「今天」，重启后由下一次签到重新写入。
	*/
	const checkinSnapshots = {
		cn: {},
		global: {}
	};
	/**
	* 正在飞的批量动作（签到或测试）已处理完的那几行，按区域一个槽位。
	*
	* 为什么要它：两种批量都是**串行**的真实请求（一池六个号就是几分钟）。此前
	* 卡片只能等整个响应回来才一次性写活动日志，于是六行日志盖上**同一个时刻**
	* 落在一起（用户实拍：全是 05:44:54）——那几分钟里日志是空的，看起来跟卡死
	* 没有区别。现在每处理完一个账号就往这里追加一行（带完成时刻），卡片用
	* `action=progress` 每秒读一次，逐条落行、时间也是真的。
	*
	* 两个动作共用一把锁，所以不需要区分并发；批次结束即清空——完整结果本来就在
	* 响应里，这个槽位只服务「在飞期间」。
	*/
	const poolBatches = {};
	function beginPoolBatch(region, action) {
		poolBatches[region] = {
			action,
			done: []
		};
	}
	function recordPoolBatchRow(region, row) {
		const batch = poolBatches[region];
		if (batch === void 0) return;
		batch.done.push({
			atMs: Date.now(),
			row
		});
	}
	function endPoolBatch(region) {
		delete poolBatches[region];
	}
	/**
	* 每区域最近一次**实时**拉到的完整目录（含上游声明的思考档位），未过滤。
	*
	* 为什么要单独存：`stacks[region].catalog` 装的是**过滤后**（只含勾选模型）
	* 的运行时目录，卡片不能用它；而保存的 `lastCatalog` 可能是**旧快照**，
	* 上游新声明的思考档位会缺失（用户实拍「还是没有思考强度」——即使刚刚
	* 「从 Qoder 刷新」成功过，卡片读的仍是那份没有档位的旧快照）。
	* 实时目录优先于保存快照，才能反映上游当前声明了什么。
	*/
	const fullCatalog = {
		cn: [],
		global: []
	};
	/**
	* 卡片展示用的模型列表（workbuddy 的 `displayModels` 同规）。
	*
	* 与运行时目录（`stacks[region].catalog`）的区别只有一条，但它是关键：
	* **运行时目录只含用户勾选的模型**（DSH 的选择器读它），而卡片必须看到**完整
	* 目录**，否则未勾选的模型根本不出现在卡片里，用户再也勾不上它们。
	*
	* 实时目录（`fullCatalog`）优先于运行时目录：实时目录反映上游**当前**声明了
	* 什么（含思考档位），而运行时目录是启动时由保存的 lastCatalog 装配的 ——
	* 那是上一次保存时的旧快照（issue #32 的教训：保存槽位丢了目录时必须显示
	* 实时目录，否则卡片会把用户正在用的模型报成「已下架」）。
	*
	* 「思考强度有时候有、有时候没有」（用户实拍）的机制也在这条读路径上：
	* `fullCatalog` 是纯内存的、只在启动时拉一次；启动那次失败的话，卡片每次
	* 读到的都是启动装配的旧快照 —— 一个档位都没有，直到用户手动点一次
	* 「从 Qoder 刷新」。所以读到「本进程还没成功拉过实时目录 + 手上的目录一个
	* 档位都没声明」时，**触发一次后台重拉**（fire-and-forget，见
	* ensureCatalogRefresh）并且**继续服务手上的目录** —— 模型不能从卡片上消失，
	* 缺的只是档位，拉回来之后下一次读取自然补上。
	*/
	function displayModels(region) {
		const full = fullCatalog[region];
		const live = full.length > 0 ? full : stacks[region].catalog.current();
		if (full.length === 0) serveSavedCatalog(live, () => {
			ensureCatalogRefresh(region);
		});
		return live;
	}
	/**
	* 幂等地触发一次该区域的目录拉取（**不等待**）。
	*
	* 为什么不等待：`displayModels` 是**读**路径，被 `/usage` 路由同步调用；在里面
	* await 网络会让「卡片读一次快照」这个纯读动作每次都等一次上游。改为
	* fire-and-forget + 在飞标记去重，拉取完成后下一次读取自然拿到新目录。
	*
	* 为什么需要它：目录此前**只在启动时拉一次**（`refreshModels`），而 `fullCatalog`
	* 是纯内存的。于是「思考强度」在重启后必然退化成那份空快照 —— 除非用户恰好
	* 去点一次「从 Qoder 刷新」。有没有点过刷新、以及进程活多久，就是「有时候有、
	* 有时候没有」的全部来源。
	*/
	const catalogRefreshInFlight = {};
	const ensureCatalogRefresh = (region) => {
		if (catalogRefreshInFlight[region] === true) return;
		catalogRefreshInFlight[region] = true;
		refreshModels(region).finally(() => {
			catalogRefreshInFlight[region] = false;
		});
	};
	let invalidateCatalog = () => {};
	/**
	* 桌面客户端本地登录态的宿主侧适配器。
	*
	* 三个职责：
	*  1. `upstream.resolveDeviceLogin` —— `dt-` 凭据要开 COSY 会话，必须拿到
	*     **真实 uid**；这里回读当前客户端登录态并按令牌匹配。
	*  2. `store.localLogin` —— 把「当前登录 + 记录簿历史」并进账号列表，
	*     并让按 id 解析 / 自动解析能拿到 `dt-` 凭据。
	*  3. Web 路由用的 `pull` / `record` / `list` / `remove` / `status`。
	*
	* 凭据形状统一成 store 期待的 `{ id, accountName, source, pat, … }`：
	* `pat` 字段放 `dt-` 令牌（upstream 按前缀判别走设备会话分支），
	* 额外的 `kind` / `uid` / `refreshToken` 供设备会话与展示用。
	*/
	const localLoginOf = (region) => {
		const ledger = new LocalLoginLedger(region);
		const asCredential = (login) => login === void 0 ? void 0 : {
			id: login.id,
			accountName: login.accountName,
			source: LOCAL_LOGIN_SOURCE,
			kind: LOCAL_LOGIN_KIND,
			pat: login.token,
			uid: login.uid,
			refreshToken: login.refreshToken,
			...login.email === undefined ? {} : { email: login.email },
			...login.phone === undefined ? {} : { phone: login.phone },
			...login.tokenExpiresAtMs === undefined ? {} : { tokenExpiresAtMs: login.tokenExpiresAtMs },
			...login.refreshExpiresAtMs === undefined ? {} : { refreshExpiresAtMs: login.refreshExpiresAtMs }
		};
		return {
			ledger,
			list: () => listLocalLogins(region),
			current: () => readLocalLogin(region),
			status: () => readAppStatus(region),
			/**
			* 按 id 解析凭据。**永不抛**：历史条目不是客户端当前登录时返回
			* undefined，让 `/usage` 走「所选账号已不存在」而不是整个状态页 500。
			* 路由里需要可读错误时走 `credentialStrict`。
			*/
			credential: async (accountId) => {
				try {
					if (accountId === undefined) return asCredential(await readLocalLogin(region));
					return asCredential(await resolveLocalLogin(region, accountId));
				} catch {
					return void 0;
				}
			},
			/** 切换时的严格校验：失败抛出带操作指引的中文错误。 */
			credentialStrict: async (accountId) => asCredential(await resolveLocalLogin(region, accountId)),
			/** upstream 回调：按 `dt-` 令牌反查身份（必须是当前登录）。 */
			identity: async (credential) => {
				const login = await readLocalLogin(region);
				if (login === void 0 || login.token !== credential) return void 0;
				return {
					uid: login.uid,
					accountName: login.accountName,
					refreshToken: login.refreshToken,
					userType: "personal_standard",
					expiresAtMs: login.tokenExpiresAtMs
				};
			},
			/** 拉取当前登录并记一条；返回给 UI 的安全摘要（不含令牌）。 */
			pull: async () => {
				const login = await readLocalLogin(region);
				if (login === void 0) throw new Error("没有读到 Qoder 桌面客户端的登录态（未安装 / 未登录 / 钥匙串未授权）");
				const entry = await ledger.record(login);
				return {
					accountId: entry.id,
					accountName: entry.accountName,
					uid: entry.uid,
					active: true,
					...entry.email === undefined ? {} : { email: entry.email },
					...entry.phone === undefined ? {} : { phone: entry.phone },
					...entry.tokenExpiresAtMs === undefined ? {} : { tokenExpiresAtMs: entry.tokenExpiresAtMs },
					...entry.refreshExpiresAtMs === undefined ? {} : { refreshExpiresAtMs: entry.refreshExpiresAtMs }
				};
			},
			remove: (accountId) => ledger.remove(accountId)
		};
	};
	const localLogins = Object.fromEntries(QODER_REGIONS.map((region) => [region, localLoginOf(region)]));
	for (const region of QODER_REGIONS) {
		const local = localLogins[region];
		const upstream = new QoderUpstreamClient(region, {
			logger: log,
			resolveDeviceLogin: (credential) => local.identity(credential)
		});
		const catalog = new QoderCatalog(QODER_FALLBACK_MODELS.map(fallbackModelInfo));
		const store = new QoderAccountStore(region, { localLogin: local });
		let poolRuntime = {};
		readPoolProbes(region).then((probes) => {
			poolRuntime = {
				...probes,
				...poolRuntime
			};
			const stack = stacks[region];
			if (stack !== void 0) stack.poolRuntime = poolRuntime;
		});
		const announcedFailovers = /* @__PURE__ */ new Map();
		stacks[region] = {
			upstream,
			catalog,
			shim: createQoderShim({
				upstream,
				credential: () => resolveServingPat(region),
				modelKeyOf: (selector) => catalog.keyOf(selector),
				supportsImagesOf: (selector) => catalog.supportsImagesOf(selector),
				reasoningEffortOf: (selector) => {
					const key = catalog.keyOf(selector);
					if (key === void 0) return void 0;
					return thinkingEffortsOf(config, region)[key];
				},
				logger: log,
				resolveServing: async () => {
					const serving = await resolveServing(region);
					return serving === void 0 ? void 0 : {
						accountId: serving.id,
						accountName: serving.accountName,
						pat: serving.pat
					};
				},
				failoverAccount: async (tried) => nextFailoverCredential(region, tried),
				onServingFailure: (accountId, kind, message, context) => {
					const exhaustion = liveQuotaExhaustion(kind, message, context, Date.now());
					if (exhaustion !== void 0) quotaExhaustionByRegion[region] = exhaustion;
					const probe = liveRequestProbe(kind, message, void 0, context);
					if (probe === void 0 || accountId === "") return;
					poolRuntime[accountId] = probe;
					if (shouldRecordPoolFailure(poolPreferencesOf(config, region), accountId)) {
						writePoolProbes(region, { [accountId]: probe });
						log(`pool ${region}: ${maskPat(accountId)} marked ${probe.outcome} by live request`);
					}
				},
				isAccountExcluded: (accountId) => {
					const probe = poolRuntime[accountId];
					if (probe === void 0) return false;
					const targetModelId = poolTargetOf(region).modelId;
					if (exclusionOf(probe, Date.now(), targetModelId) === void 0) {
						clearAnnouncedFailoversFrom(announcedFailovers, accountId);
						return false;
					}
					return true;
				},
				failoverNotice: (from, _to, kind, context) => context?.queue?.isQueued === true ? queuedFailoverNoticeText({
					accountName: from.accountName,
					accountId: from.accountId
				}) : failoverNoticeText({
					accountName: from.accountName,
					accountId: from.accountId
				}, kind),
				hasAnnouncedFailover: (from, to, kind) => shouldAnnounceFailoverOnce(announcedFailovers, {
					fromAccountId: from.accountId,
					toAccountId: to.accountId,
					kind
				})
			}),
			store,
			probeClient: buildProbeClient(region),
			poolRuntime,
			announcedFailovers
		};
	}
	/** The region's source PATs (settings + env). */
	function sourcesOf(region) {
		const state = regionStateOf(config, region);
		const settingsPat = typeof state.pat === "string" ? state.pat.trim() : "";
		const envPat = patFromEnv(region);
		return {
			...settingsPat === "" ? {} : { settingsPat },
			...envPat === void 0 ? {} : { envPat }
		};
	}
	/** The region's auto-resolved serving PAT (settings → env). Vault is async. */
	function resolveServingPat(region) {
		const sources = sourcesOf(region);
		if (sources.settingsPat) return sources.settingsPat;
		if (sources.envPat) return sources.envPat;
	}
	/** Full serving credential via the store (honors selection + vault). */
	async function resolveServing(region) {
		return stacks[region].store.resolve(sourcesOf(region), selectedAccountId(config, region));
	}
	/** Next usable PAT for failover: rankPool over members, skip tried. */
	async function nextFailoverCredential(region, tried) {
		const store = stacks[region].store;
		const prefs = poolPreferencesOf(config, region);
		if (!poolAllowsFailover(prefs)) return void 0;
		const memberIds = prefs.memberAccountIds;
		const probes = stacks[region].poolRuntime;
		const now = Date.now();
		const snapshot = now - (poolCreditsSnapshotAt[region] ?? 0) <= POOL_CREDITS_SNAPSHOT_MS ? poolCreditsSnapshot[region] : void 0;
		const candidates = [];
		for (const accountId of memberIds) {
			if (tried.includes(accountId)) continue;
			const credit = await store.credentialFor(accountId, sourcesOf(region));
			if (credit === void 0) continue;
			const probe = probes[accountId];
			const reading = snapshot?.get(accountId);
			candidates.push({
				account: {
					id: credit.id,
					accountName: credit.accountName
				},
				...reading === void 0 ? {} : { credits: reading },
				...probe === void 0 ? {} : { probe }
			});
		}
		const chosen = rankPool(candidates, now, poolTargetOf(region).modelId, prefs.orderAccountIds)[0];
		if (chosen === void 0 || chosen.excludedBy !== void 0) return void 0;
		const credit = await store.credentialFor(chosen.account.id, sourcesOf(region));
		return credit === void 0 ? void 0 : {
			accountId: credit.id,
			accountName: credit.accountName,
			pat: credit.pat
		};
	}
	/** 成员积分快照：请求路径不能上网，排名用卡片路由最近一次的读数。 */
	const poolCreditsSnapshot = {};
	const POOL_CREDITS_SNAPSHOT_MS = 6e5;
	const poolCreditsSnapshotAt = {};
	/** 这份快照是「问哪几个账号」问出来的：请求的成员集合变了就不能复用。 */
	const poolCreditsRequested = {};
	/**
	* 卡片读数的复用窗口。
	*
	* 批量在飞时卡片每 2.5 秒重读一次 usage，而每次读取都会**为每个成员各发一次**
	* usage 请求（`poolMemberCredits`）——六个号就是每分钟 144 次上游调用，纯属
	* 浪费，还可能撞限流。积分不是秒级变化的东西，15 秒内复用同一份读数，肉眼
	* 看不出差别，上游负载降一个数量级。（签到领了分是例外：那时会主动作废，
	* 见 `runCheckinBatch` 末尾。）
	*/
	const POOL_CREDITS_CARD_TTL_MS = 15e3;
	/**
	* 池成员的最新积分（每成员一次 usage 读数）。由卡片路由付费——卡片正在看的
	* 数字与排名快照同一次读取（workbuddy 的 poolMembersOf 同规），单个账号失败
	* 只让那一行显示「—」，不拖垮整张表。
	*/
	async function poolMemberCredits(region, accountIds) {
		const requested = accountIds.join("\0");
		const cached = poolCreditsSnapshot[region];
		if (cached !== void 0 && poolCreditsRequested[region] === requested && Date.now() - (poolCreditsSnapshotAt[region] ?? 0) <= POOL_CREDITS_CARD_TTL_MS) return cached;
		const store = stacks[region].store;
		const SOON_MS = 2592e5;
		const entries = await Promise.all(accountIds.map(async (accountId) => {
			const credit = await store.credentialFor(accountId, sourcesOf(region)).catch(() => void 0);
			if (credit === void 0) return void 0;
			const usage = await stacks[region].upstream.fetchUsage(credit.pat).catch(() => void 0);
			if (usage === void 0) return void 0;
			const view = creditsOf(usage);
			const expiringSoon = view.packages.reduce((sum, pkg) => pkg.expiresAtMs !== void 0 && pkg.expiresAtMs - Date.now() < SOON_MS ? sum + pkg.remain : sum, 0);
			return [accountId, {
				total: view.total,
				expiringSoon,
				...view.nearestExpiryMs === void 0 ? {} : { nearestExpiryMs: view.nearestExpiryMs }
			}];
		}));
		const map = new Map(entries.filter((entry) => entry !== void 0));
		poolCreditsSnapshot[region] = map;
		poolCreditsSnapshotAt[region] = Date.now();
		poolCreditsRequested[region] = requested;
		return map;
	}
	/**
	* 首屏用的成员积分：只答**已经量过**的那份快照，一次上游都不打。
	*
	* `poolMemberCredits` 是诚实但昂贵的版本——每个成员一次真实 usage 读数，串在
	* usage 文档的尾巴上 await。冷进程（或上游慢/被限流）时它能把设置页的账号
	* 列表扣住几十秒，这正是同族插件 issue #77 报的症状。
	*
	* 快照新鲜度仍按 `POOL_CREDITS_SNAPSHOT_MS` 判：过期的读数拿来当「现在」是
	* 另一种谎，宁可让那一列显示「—」（没量过），完整文档随后立刻补上真数字。
	* 返回 `undefined` 表示这一区还什么都没量过。
	*/
	function cachedMemberCredits(region, accountIds) {
		const snapshot = poolCreditsSnapshot[region];
		if (snapshot === void 0) return void 0;
		if (Date.now() - (poolCreditsSnapshotAt[region] ?? 0) > POOL_CREDITS_SNAPSHOT_MS) return void 0;
		const picked = /* @__PURE__ */ new Map();
		for (const accountId of accountIds) {
			const reading = snapshot.get(accountId);
			if (reading !== void 0) picked.set(accountId, reading);
		}
		return picked.size === 0 ? void 0 : picked;
	}
	/** A probe client for one region backed by chatStream. */
	function buildProbeClient(region) {
		return { probeChat: async (credential, modelKey, opts) => {
			let firstBytes = 0;
			let error;
			try {
				await stacks[region].upstream.chatStream(credential.pat, modelKey, [{
					role: "user",
					content: probeUserMessage(opts.inputTokens)
				}], {
					...opts.signal === void 0 ? {} : { signal: opts.signal },
					isReasoning: false,
					isVl: false,
					onDelta: (delta) => {
						if (firstBytes === 0) firstBytes = cheapProbeLength(delta);
					}
				});
			} catch (caught) {
				if (isQoderUpstreamError(caught)) error = caught;
				else throw caught;
			}
			if (error !== void 0) {
				const probeError = {
					kind: error.kind,
					status: error.status,
					message: error.message,
					...error.retryAfterMs === void 0 ? {} : { retryAfterMs: error.retryAfterMs },
					...error.queue === void 0 ? {} : { queue: error.queue }
				};
				return {
					ok: false,
					status: error.status,
					retryAfter: null,
					...error.retryAfterMs === void 0 ? {} : { retryAfterMs: error.retryAfterMs },
					body: error.message,
					error: probeError
				};
			}
			return {
				ok: true,
				status: 200,
				retryAfter: null
			};
		} };
	}
	/** Cheap text length of a delta for probe first-byte accounting. */
	function cheapProbeLength(delta) {
		let length = delta.content.length;
		if (delta.reasoningContent.length > 0) length += delta.reasoningContent.length;
		if (delta.toolCalls !== void 0) length += delta.toolCalls.length;
		return length;
	}
	/** One real probe of one model through one credential. Never throws. */
	async function probeThrough(region, credential, modelId, signal) {
		return probeModel({
			client: stacks[region].probeClient,
			credential,
			modelKey: modelId,
			nowMs: Date.now(),
			...quotaRefreshOf(checkinSnapshots[region], credential.pat),
			...signal === void 0 ? {} : { signal }
		});
	}
	/**
	* 对一个区域勾选的成员逐个签到（领取当日 Credits）。
	*
	* 与 `test` 批次同构：只跑**真的有凭据**的成员（幽灵 id 跳过，见 test 里那段
	* 注释），逐个之间留间隔避免撞限流。每个成员独立成败——一个账号失败不影响
	* 其余账号，结果逐行回报（workbuddy 的 checkin 批次同规）。
	*
	* 三种状态分得很清：`claimed`（这次领到）/ `already`（今天已领，幂等，
	* **不是**失败）/ `failed`（真的失败：凭据被拒、上游报错）。
	*/
	/**
	* 把一行的签到结果并进快照：成员表据此显示「已签到 / 未签到」以及「还有多久刷新」。
	*
	* `claimed` 与 `already` 都算「今天已领」——两者的区别只对**本次操作**有意义
	* （领到了 vs 早就领过），对「今天是否已签到」这个事实没有区别。
	*
	* 失败**不**写 `refreshAtMs`：这一次没拿到上游的开窗时间，宁可不说，也不把
	* 上一次成功留下的时间当成这次的答案。
	*/
	function applyCheckinRow(region, row) {
		const next = { ...checkinState[region] ?? {} };
		const nextSnapshot = { ...checkinSnapshots[region] ?? {} };
		if (row.status === "claimed" || row.status === "already") {
			next[row.accountId] = true;
			nextSnapshot[row.accountId] = {
				claimed: true,
				...row.refreshAtMs === void 0 ? {} : { refreshAtMs: row.refreshAtMs }
			};
		} else if (row.status === "failed") {
			next[row.accountId] = false;
			nextSnapshot[row.accountId] = { claimed: false };
		}
		checkinState[region] = next;
		checkinSnapshots[region] = nextSnapshot;
	}
	async function runCheckinBatch(region) {
		const store = stacks[region].store;
		const prefs = poolPreferencesOf(config, region);
		const client = stacks[region].upstream;
		const rows = [];
		beginPoolBatch(region, "checkin");
		try {
			let first = true;
			for (const accountId of prefs.memberAccountIds) {
				const credit = await store.credentialFor(accountId, sourcesOf(region));
				if (credit === void 0) continue;
				if (!first) await new Promise((resolve) => setTimeout(resolve, 400));
				first = false;
				const base = {
					accountId,
					accountName: credit.accountName
				};
				let row;
				try {
					const outcome = await client.claimDailyCredits(credit.pat);
					const refresh = outcome.status === "unavailable" ? {} : outcome.nextRefreshAtMs === void 0 ? {} : { refreshAtMs: outcome.nextRefreshAtMs };
					if (outcome.status === "claimed") row = {
						...base,
						status: "claimed",
						...outcome.amount === void 0 ? {} : { credit: outcome.amount },
						...outcome.validityDays === void 0 ? {} : { validityDays: outcome.validityDays },
						...refresh
					};
					else if (outcome.status === "already-claimed") row = {
						...base,
						status: "already",
						...refresh
					};
					else row = {
						...base,
						status: "failed",
						message: outcome.message
					};
				} catch (error) {
					row = {
						...base,
						status: "failed",
						message: error instanceof Error ? error.message : String(error)
					};
				}
				rows.push(row);
				applyCheckinRow(region, row);
				recordPoolBatchRow(region, row);
			}
		} finally {
			endPoolBatch(region);
		}
		await refreshUsageCoalesced(region).catch(() => {});
		poolCreditsSnapshotAt[region] = 0;
		return rows;
	}
	/** Cached usage read for one region. */
	function usageEntryOf(region) {
		const entry = usageCache[region];
		if (entry === void 0) return void 0;
		return {
			...entry.usage === void 0 ? {} : { usage: {
				credits: creditsOf(entry.usage),
				atMs: entry.atMs
			} },
			...entry.error === void 0 ? {} : { error: entry.error },
			...entry.staleError === void 0 ? {} : { staleError: entry.staleError }
		};
	}
	/**
	* 在飞的积分刷新（区域 → promise）。
	*
	* `/usage` 现在每次请求都要现场刷一次积分，而这个路由的调用方不止一个：卡片
	* 60s 轮询、composer 300s 轮询、面板打开、手动刷新。它们可能几乎同时打到同一
	* 区域 —— 没有合流的话，一次面板打开会连带触发好几条上游读。
	*
	* **所有**积分读都必须经过这里，包括那些 fire-and-forget 的后台补读（签到后
	* 补读、目录刷新完补读、写配置后全区补读）。此前它们直接调 `refreshUsage`，
	* 于是同一次操作能打出两次上游读 —— 上游一慢就稳定复现。合流只有在「一个入口」
	* 的前提下才是真的。
	*/
	const usageRefreshInFlight = {};
	/** One upstream credits read per region at a time; late callers join it. */
	const refreshUsageCoalesced = (region) => {
		const running = usageRefreshInFlight[region];
		if (running !== void 0) return running;
		const next = refreshUsage(region).finally(() => {
			if (usageRefreshInFlight[region] === next) delete usageRefreshInFlight[region];
		});
		usageRefreshInFlight[region] = next;
		return next;
	};
	const refreshUsage = async (region) => {
		const serving = await resolveServing(region);
		if (!serving) return;
		const prior = usageCache[region];
		try {
			const usage = await withHardTimeout(stacks[region].upstream.fetchUsage(serving.pat, AbortSignal.timeout(USAGE_FETCH_TIMEOUT_MS)), USAGE_FETCH_TIMEOUT_MS);
			if (usage === void 0) {
				usageCache[region] = {
					usage: prior?.usage,
					atMs: prior?.atMs ?? Date.now(),
					...prior?.error === void 0 ? {} : { error: prior.error },
					staleError: prior?.staleError ?? "credits read returned no data (timeout / transient upstream failure)"
				};
				return;
			}
			usageCache[region] = {
				usage,
				atMs: Date.now()
			};
		} catch (error) {
			const kind = isQoderUpstreamError(error) ? error.kind : void 0;
			const context = isQoderUpstreamError(error) ? {
				status: error.status,
				code: error.code
			} : void 0;
			usageCache[region] = {
				usage: void 0,
				atMs: Date.now(),
				error: kind === "auth" ? credentialOutcomeOf(context) : kind ?? "unknown"
			};
		}
	};
	/** The region's catalog projected into the pool target picker's shape. */
	function poolModelsOf(region) {
		return stacks[region].catalog.current().map((m) => ({
			id: m.key,
			name: m.displayName,
			creditMultiplier: m.isFree === true ? 0 : m.priceFactor,
			contextWindow: m.contextWindow
		}));
	}
	/**
	* 这个区域**该测哪个模型**（issue #26 的「自动」挑法）。
	*
	* 「自动」这一档不再永远钉在最热门的免费模型上：那个模型一旦排队，每一次
	* 探测都会撞同一个队列（用户实拍：整池躺了半小时）。现在的规则是
	* 「最近测成功过的优先 → 跳过刚被排过队的 → 上下文最大的」。
	*
	* 用户手选的模型**永远优先**（`resolveTargetModel` 里就短路了）—— 绝不因为
	* 它在排队就偷偷换人测，那会与卡片上写的「测试用模型」对不上。
	*/
	function poolTargetOf(region) {
		const probes = stacks[region].poolRuntime;
		const now = Date.now();
		return resolveTargetModel(poolModelsOf(region), poolPreferencesOf(config, region).targetModelId, {
			avoidModelIds: queuedModelIdsOf(probes, now),
			preferModelIds: workingModelIdsOf(probes)
		});
	}
	/** On-demand model read for discovery + refresh. */
	async function discoverModels(region, signal) {
		const serving = await resolveServing(region);
		if (!serving) return [];
		return applyContextBudgets((await stacks[region].upstream.fetchModels(serving.pat, signal)).map(parseUpstreamModel), contextBudgetsOf(config, region));
	}
	/**
	* 拉取并安装一个区域的动态目录。返回安装后的目录；拉取失败抛错——
	* 路由层据此答 500，启动路径自己吞掉落回兜底目录。
	*/
	async function refreshRegionCatalog(region, pat) {
		const stamped = stampRuntimeCatalog(config, region, applyContextBudgets((await stacks[region].upstream.fetchModels(pat)).map(parseUpstreamModel), contextBudgetsOf(config, region)));
		const saved = new Set(enabledModelKeysOf(config, region));
		fullCatalog[region] = stamped;
		stacks[region].catalog.set(deriveCatalog(stamped, saved));
		invalidateCatalog();
		return stamped;
	}
	/**
	* 路由层（卡片「从 Qoder 刷新」按钮）用的完整刷新：装目录 + 刷积分。
	* 此前的路由只调只读的 discoverModels——返回了新模型给卡片，却从不写入
	* 运行时目录，卡片随后重取 usage 文档看到的仍是旧目录，刷了个寂寞。
	*/
	async function refreshRegionForRoute(region) {
		const serving = await resolveServing(region);
		if (!serving) throw new Error(`no PAT configured for ${region}`);
		const models = await refreshRegionCatalog(region, serving.pat);
		refreshUsageCoalesced(region);
		return models;
	}
	const refreshModels = (region) => {
		return (async () => {
			const serving = await resolveServing(region);
			if (!serving) {
				log(`models refresh skipped for ${region}: no PAT configured`);
				return;
			}
			try {
				await refreshRegionCatalog(region, serving.pat);
			} catch (error) {
				log(`dynamic ${region} model catalog unavailable; serving the static fallback list: ${String(error?.message ?? error)}`);
			}
			refreshUsageCoalesced(region);
		})();
	};
	const syncRegionRegistration = (value) => {
		for (const region of QODER_REGIONS) {
			const enabled = regionEnabled(value, region);
			const handle = registration[region].adapter;
			if (handle === void 0) continue;
			try {
				handle.replace(enabled ? [QODER_PROVIDERS[region]] : []);
			} catch (error) {
				log(`region ${region} adapter sync failed: ${String(error?.message ?? error)}`);
			}
		}
		const dirHandle = registration.cn.directory;
		if (dirHandle === void 0) return;
		try {
			dirHandle.replace(QODER_REGIONS.filter((region) => regionEnabled(value, region)).map((region) => ({
				provider: QODER_PROVIDERS[region],
				displayName: QODER_PROVIDER_DISPLAY_NAMES[region],
				settingsNs,
				settingsPath: [],
				declared: false
			})));
		} catch (error) {
			log(`provider directory sync failed: ${String(error?.message ?? error)}`);
		}
	};
	const applySelection = (value) => {
		for (const region of QODER_REGIONS) {
			const stamped = stampRuntimeCatalog(value, region, applyContextBudgets(configuredModels(value, region, stacks[region].catalog.current()), contextBudgetsOf(value, region)));
			const saved = new Set(enabledModelKeysOf(value, region));
			stacks[region].catalog.set(deriveCatalog(stamped, saved));
		}
		invalidateCatalog();
		syncRegionRegistration(value);
		for (const region of QODER_REGIONS) refreshUsageCoalesced(region);
	};
	applySelection(config);
	const accountDeps = (region) => {
		const store = stacks[region].store;
		return {
			accounts: (sources) => store.accounts(sources ?? sourcesOf(region)),
			credentialFor: (accountId, sources) => store.credentialFor(accountId, sources ?? sourcesOf(region)),
			resolve: (sources, selectedId) => store.resolve(sources ?? sourcesOf(region), selectedId ?? selectedAccountId(config, region)),
			add: (pat, name) => store.add(pat, name),
			vaultAccounts: () => store.vaultAccounts(),
			remove: (accountId) => store.remove(accountId),
			rename: (accountId, name) => store.rename(accountId, name)
		};
	};
	const accountValidationDeps = { validateForRegion: async (region, pat) => {
		return { name: (await stacks[region].upstream.exchangeJobToken(pat)).name || "" };
	} };
	/** Region-dispatch table for the single pool deps the route gets. */
	function poolFor(region) {
		const store = stacks[region].store;
		return {
			preferences: (reg) => poolPreferencesOf(config, reg),
			catalog: (reg) => stacks[reg].catalog.current(),
			poolProbes: (reg) => stacks[reg].poolRuntime,
			credentialFor: (reg, accountId) => store.credentialFor(accountId, sourcesOf(reg)),
			probeOne: (reg, credit, modelId) => probeThrough(reg, credit, modelId),
			checkinSupported: () => true,
			checkin: async (reg) => runCheckinBatch(reg),
			test: async (reg, onlyAccountId) => {
				const prefs = poolPreferencesOf(config, reg);
				const target = poolTargetOf(reg);
				if (target.modelId === void 0) return [];
				const deps = {
					credentialFor: (accountId) => store.credentialFor(accountId, sourcesOf(reg)),
					probe: (credit, modelId) => probeThrough(reg, credit, modelId)
				};
				const targets = [];
				const scope = onlyAccountId === void 0 ? prefs.memberAccountIds : [onlyAccountId];
				for (const accountId of scope) {
					const credit = await store.credentialFor(accountId, sourcesOf(reg));
					if (credit === void 0) continue;
					targets.push({
						accountId,
						accountName: credit.accountName
					});
				}
				const modelIdOfTarget = target.modelId;
				const rows = await (async () => {
					const batch = onlyAccountId === void 0;
					if (batch) beginPoolBatch(reg, "test");
					try {
						return batch ? await testAllAccounts(targets, modelIdOfTarget, deps, (row) => {
							recordPoolBatchRow(reg, row);
							const probe = poolProbeFromResult(row.result);
							if (probe === void 0) return;
							stacks[reg].poolRuntime = {
								...stacks[reg].poolRuntime,
								[row.accountId]: probe
							};
							writePoolProbes(reg, { [row.accountId]: probe });
						}) : await Promise.all(targets.map((target) => testOne(target, modelIdOfTarget, deps)));
					} finally {
						endPoolBatch(reg);
					}
				})();
				const probes = {};
				for (const row of rows) {
					const p = poolProbeFromResult(row.result);
					if (p) probes[row.accountId] = p;
				}
				stacks[reg].poolRuntime = {
					...stacks[reg].poolRuntime,
					...probes
				};
				writePoolProbes(reg, probes);
				return rows;
			},
			applyProbes: async (reg, probes) => {
				stacks[reg].poolRuntime = {
					...stacks[reg].poolRuntime,
					...probes
				};
				writePoolProbes(reg, probes);
			},
			updateMembership: (reg, memberAccountIds, enabled) => {
				submitRegionSettings(reg, { pool: {
					...poolPreferencesOf(config, reg),
					memberAccountIds,
					...enabled === void 0 ? {} : { enabled }
				} });
			}
		};
	}
	function buildPoolDeps() {
		return {
			preferences: (region) => poolPreferencesOf(config, region),
			catalog: (region) => stacks[region].catalog.current(),
			poolProbes: (region) => stacks[region].poolRuntime,
			batchProgress: (region) => poolBatches[region],
			memberCredits: (region, accountIds) => poolMemberCredits(region, accountIds),
			cachedMemberCredits: (region, accountIds) => cachedMemberCredits(region, accountIds),
			credentialFor: (region, accountId) => stacks[region].store.credentialFor(accountId, sourcesOf(region)),
			probeOne: (region, credit, modelId) => probeThrough(region, credit, modelId),
			test: (region, modelId) => poolFor(region).test(region, modelId),
			checkinSupported: (region) => poolFor(region).checkinSupported(region),
			checkin: (region) => poolFor(region).checkin(region),
			checkinState: (region) => checkinState[region],
			checkinSnapshot: (region) => checkinSnapshots[region],
			applyProbes: async (region, probes) => poolFor(region).applyProbes(region, probes),
			updateMembership: (region, memberAccountIds, enabled) => poolFor(region).updateMembership(region, memberAccountIds, enabled)
		};
	}
	/** Build the transfer deps once (region-dispatched). */
	const transferDeps = {
		exportAccounts: async (region) => {
			const { transferRecordsFor } = await import("./transfer-BSok3OGe.js");
			return { accounts: transferRecordsFor(region, await stacks[region].store.vaultAccounts()) };
		},
		previewImport: async (_region, text) => {
			const { previewTransferFile } = await import("./transfer-BSok3OGe.js");
			return previewTransferFile(text);
		},
		importAccounts: async (region, text, indexes) => {
			const { mergeTransferRecords } = await import("./transfer-BSok3OGe.js");
			const { changes, imported, skipped } = mergeTransferRecords(region, text, indexes);
			for (const entry of changes.values()) await stacks[region].store.add(entry.pat, entry.accountName);
			return {
				imported,
				skipped
			};
		}
	};
	let settingsService;
	ctx.inject(["settings"], (sctx) => {
		settingsService = sctx.settings;
	});
	const pluginRow = () => {
		if (settingsService === void 0) return void 0;
		return settingsService.describe().find((row) => String(row.ns).includes("dsh-connect-qoder"));
	};
	/**
	* Two-level merge a settings field write, then `mutate` it (workbuddy's
	* `__save` contract, so a partial payload never deletes sibling regions).
	*/
	async function mutateField(field, incoming) {
		const row = pluginRow();
		if (row === void 0) throw new Error("settings namespace not yet available");
		const current = unwrapVolatileDeep(row.value?.[field] ?? {});
		const patch = incoming ?? {};
		const merged = { ...current };
		for (const [key, slot] of Object.entries(patch)) {
			const prior = current[key];
			const isPlain = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
			merged[key] = isPlain(prior) && isPlain(slot) ? {
				...prior,
				...slot
			} : slot;
		}
		await settingsService.mutate(row.ns, [{
			op: "set",
			path: [field],
			value: merged
		}], void 0);
	}
	const settingsDeps = {
		describe: () => settingsService === void 0 ? [] : settingsService.describe(),
		set: async (field, value) => {
			if (field !== "regions") throw new Error(`unsupported settings field: ${String(field)}`);
			await mutateField(field, value);
		}
	};
	/** Write one region's settings patch (whole `regions` dict replace). */
	function submitRegionSettings(region, patch) {
		const regions = unwrapVolatile(config.regions) ?? {};
		mutateField("regions", {
			...regions,
			[region]: {
				...regions[region] ?? {},
				...patch
			}
		});
	}
	/** Fresh per-account credit balances for the composer panel. */
	async function accountCreditsOf(region, signal) {
		const store = stacks[region].store;
		const accounts = await store.accounts(sourcesOf(region));
		const prefs = poolPreferencesOf(config, region);
		const probes = stacks[region].poolRuntime;
		const now = Date.now();
		const targetModelId = poolTargetOf(region).modelId;
		const selectedId = selectedAccountId(config, region);
		/**
		* 池开启时的**接管候选**（`rankPool` 第一个可用的成员）。
		*
		* 与 `nextFailoverCredential` 同一条判据（同一个 `rankPool`、同一个
		* `orderAccountIds`、同一个目标模型作用域）——但它只在第一发被硬拒时
		* 才真正接管线；第一发本来就是选中号。池关闭时缺席——没有换号机制。
		*/
		let priorityId;
		if (poolAllowsFailover(prefs)) {
			const candidates = [];
			for (const accountId of prefs.memberAccountIds) {
				const probe = probes[accountId];
				candidates.push({
					account: {
						id: accountId,
						accountName: accountId
					},
					...probe === void 0 ? {} : { probe }
				});
			}
			priorityId = rankPool(candidates, now, targetModelId, prefs.orderAccountIds).find((row) => row.excludedBy === void 0)?.account.id;
		}
		/**
		* 每一发的第一击打给谁 —— 直接调 `resolveServing`，与 `src/shim.ts` 的
		* 请求路径逐字同判（同一个 `store.resolve`）。「在用」跟着第一击走，
		* 而不是跟着 rankPool 名次；只有第一击被排除**且池开着**时，实际买单的
		* 才是接管者 `priorityId`（全灭时无人 current）。
		*/
		const firstShotId = (await resolveServing(region))?.id;
		const firstShotExcluded = firstShotId !== void 0 && exclusionOf(probes[firstShotId], now, targetModelId) !== void 0;
		const out = [];
		for (const account of accounts) {
			const pat = (await store.credentialFor(account.id, sourcesOf(region)))?.pat;
			if (!pat) continue;
			let usage;
			try {
				usage = await stacks[region].upstream.fetchUsage(pat, signal);
			} catch {
				usage = void 0;
			}
			const probe = probes[account.id];
			const excludedBy = exclusionOf(probe, now, targetModelId);
			const selected = account.id === selectedId || account.source !== "vault" && selectedId === void 0;
			out.push({
				id: account.id,
				accountName: account.accountName || account.source,
				selected,
				current: poolAllowsFailover(prefs) && firstShotExcluded ? priorityId === account.id : firstShotId === account.id,
				...excludedBy === void 0 ? {} : { excludedBy },
				...probe === void 0 ? {} : { probeOutcome: probe.outcome },
				...probe?.retryAtMs === void 0 ? {} : { retryAtMs: probe.retryAtMs },
				...usage === void 0 ? {} : { credits: creditsOf(usage).total }
			});
		}
		return out;
	}
	/**
	* 一个区域的活动面：签到 + `VIEW_DETAILS` banner，供卡片「活动」区读。
	*
	* 复用 `resolveServing` 的同一份判定（settings → env → vault / 选中号），所以
	* 卡片上看到的「这一区有哪些活动」和用量面板读到的是同一个账号的活动。
	*/
	async function campaignsOf(region, signal) {
		const serving = await resolveServing(region);
		if (!serving) throw new Error("未配置凭据");
		return stacks[region].upstream.fetchCampaignFeed(serving.pat, signal);
	}
	/** The serving credential for a probe route (region's selection). */
	async function probeModelOf(region, modelId, signal) {
		const serving = await resolveServing(region);
		if (!serving) return {
			modelId,
			outcome: "credential-rejected",
			message: "未配置凭据"
		};
		return probeThrough(region, {
			pat: serving.pat,
			accountName: serving.accountName
		}, modelId, signal);
	}
	writeHostHeartbeat();
	ctx.inject(["webServer"], (ctxWithWeb) => {
		registerQoderWebRoutes(ctxWithWeb, {
			regionEnabled: (region) => regionEnabled(config, region),
			regionCreditsShown: (region) => regionCreditsShown(config, region),
			creditPosition: (region) => creditPosition(config, region),
			lastQuotaExhaustion: (region) => quotaExhaustionByRegion[region],
			regionUsable: (region, usable) => {
				if (!usable) log(`region ${region} is signed out`);
			},
			store: accountDeps,
			credentialSources: sourcesOf,
			localLogin: (region) => localLogins[region],
			selectedAccountId: (region) => selectedAccountId(config, region),
			clearSelection: (region) => {
				submitRegionSettings(region, { accountId: "" });
			},
			catalogs: {
				cn: { current: () => [...displayModels("cn")] },
				global: { current: () => [...displayModels("global")] }
			},
			contextBudgets: (region) => contextBudgetsOf(config, region),
			thinkingEfforts: (region) => thinkingEffortsOf(config, region),
			offModelKeys: (region) => offModelKeysOf(config, region),
			imageModelKeys: (region) => imageModelKeysOf(config, region),
			imageSelectionSaved: (region) => imageSelectionSavedOf(config, region),
			enabledModelKeys: (region) => enabledModelKeysOf(config, region),
			discoverModels,
			refreshModels: refreshRegionForRoute,
			usage: usageEntryOf,
			refreshUsage: refreshUsageCoalesced,
			probeModel: probeModelOf,
			accountCredits: accountCreditsOf,
			campaigns: campaignsOf,
			pool: buildPoolDeps(),
			transfer: transferDeps,
			accountValidation: accountValidationDeps,
			settings: settingsDeps,
			logger: log
		});
	});
	ctx.on("loader/volatile-update", () => applySelection(config));
	let disposed = false;
	ctx.effect(() => () => {
		if (disposed) return;
		disposed = true;
		stopped = true;
		for (const region of QODER_REGIONS) stacks[region].shim.close();
		clearHostHeartbeat();
	});
	Promise.all(QODER_REGIONS.map((region) => stacks[region].shim.ready)).then(async () => {
		if (stopped) return;
		try {
			const adapters = {};
			for (const region of QODER_REGIONS) {
				adapters[region] = createQoderAdapter({
					shim: stacks[region].shim,
					catalog: stacks[region].catalog,
					provider: QODER_PROVIDERS[region],
					displayName: QODER_PROVIDER_DISPLAY_NAMES[region],
					resolveAttachments: () => ctx.get("attachments"),
					retryPolicy: retryPolicyOf(config, region),
					retryPolicyPath: `dsh-connect-qoder regions.${region}.retry`
				});
				stacks[region].adapter = adapters[region];
			}
			invalidateCatalog = () => {
				for (const region of QODER_REGIONS) adapters[region].invalidate();
			};
			const releaseAdapter = {};
			let releaseDirectory;
			try {
				for (const region of QODER_REGIONS) releaseAdapter[region] = registration[region].adapter = ctx.llm.registerAdapter([QODER_PROVIDERS[region]], adapters[region].adapter);
				releaseDirectory = registration.cn.directory = ctx.llm.registerConfigurableProviders(QODER_REGIONS.map((region) => ({
					provider: QODER_PROVIDERS[region],
					displayName: QODER_PROVIDER_DISPLAY_NAMES[region],
					settingsNs,
					settingsPath: [],
					declared: false
				})));
			} finally {
				if (QODER_REGIONS.some((region) => releaseAdapter[region] === void 0) || releaseDirectory === void 0) {
					for (const region of QODER_REGIONS) releaseAdapter[region]?.();
					releaseDirectory?.();
				}
			}
			ctx.effect(() => () => {
				for (const region of QODER_REGIONS) releaseAdapter[region]?.();
				releaseDirectory?.();
			});
			syncRegionRegistration(config);
			ctx.llm.registerModelDiscovery(settingsNs, async (request, signal) => {
				const region = regionOfProvider(request.provider ?? "");
				if (region === void 0) return [];
				if (!regionEnabled(config, region)) return [];
				try {
					const models = await discoverModels(region, signal);
					const saved = new Set(enabledModelKeysOf(config, region));
					return deriveCatalog(models, saved.size > 0 ? saved : initialEnabledKeys(models)).map((model) => ({
						id: model.key,
						name: modelDisplayName(model),
						contextWindow: model.contextWindow,
						maxTokens: model.maxOutputTokens,
						inputModalities: model.supportsImages ? ["text", "image"] : ["text"]
					}));
				} catch {
					return [];
				}
			});
		} catch (error) {
			ctx.logger.error("dsh-connect-qoder: provider registration failed", error);
			return;
		}
		for (const region of QODER_REGIONS) refreshModels(region);
	}).catch((error) => {
		ctx.logger.error("dsh-connect-qoder: loopback endpoint failed to start; providers not registered", error);
	});
	/** One batch result → a persisted pool probe. */
	function poolProbeFromResult(result) {
		return {
			outcome: result.outcome,
			atMs: Date.now(),
			source: "test-batch",
			...result.modelId === "" ? {} : { modelId: result.modelId },
			...result.retryAtMs === void 0 ? {} : { retryAtMs: result.retryAtMs },
			...result.queue === void 0 ? {} : { queue: result.queue },
			...result.message === void 0 ? {} : { message: result.message }
		};
	}
}
const FAIL_OVER_OUTCOME = {
	"rate-limited": "rate-limited",
	"quota-exhausted": "out-of-credit",
	network: "unavailable",
	transient: "unavailable"
};
/**
* 「凭据被拒」这条结论**有没有凭据**。
*
* `auth` 这个 kind 只说「像凭据问题」，不说「凭什么」。两种来源的处置必须不同
* （issue #6）：
*
* - **业务码 `105` 确认**（官方码表：登录态或 Access Token 已过期）—— 令牌真的
*   被拒了，等也没用，永久剔除是对的。
* - **HTTP 401** —— 401 在这套上游语义里就是凭据被拒，同样永久剔除。
* - **只是 HTTP 403 兜底猜的**（`classifyHttpStatus` 的 `401/403 → auth`）——
*   上游把「当日用量用尽」「排队中」「限流」也装在 403 里（实测 403 + 码 110 /
*   10605）。此时永久剔除会把一个几分钟到几小时就自愈的账号踢出池，而且
*   **不自愈**：用户被要求换 PAT，换了也没用（问题从来不在凭据）。
*
* 所以这里只把**确认过**的拒绝记成永久排除，没确认的降级为冷却（`unavailable`
* ⇒ `exclusionOf` 走冷却期，到期自动回池）。
*
* `context` 缺席（旧调用方 / 不知道来源）时保持原语义：永久排除 —— 宁可多剔除，
* 也不让一个坏账号一直留在池里被反复选中。
*/
function credentialOutcomeOf(context) {
	if (context === void 0) return "credential-rejected";
	if (context.code === "105") return "credential-rejected";
	if (context.status === 401) return "credential-rejected";
	return "unavailable";
}
/**
* 一次**真实请求**失败要写进账号池的那条测量；kind 不可映射时返回 undefined
* （不写：内容策略拒绝是「这一次输入」的事实，不是账号的事实，见
* `exclusionOf` 的 policy-rejected 分支）。
*
* 抽成模块级纯函数并导出，是因为它此前是 `onServingFailure` 里的一段内联字面量，
* 而那段代码有一个**已经发生过的**缺陷：上游原文被丢掉（参数写成 `_message`），
* 于是池里只有一句结论、没有依据 —— 用户实拍那条 `credential-rejected` 记录连
* `message` 都没有，卡片只能空口指控「PAT 被拒」，而真相（`code 110` 当日用量
* 用尽）就在被丢掉的那串字符里。探针路径早就带原文（`redactUpstreamText`），
* 两条路径写同一个文件却只有一个带。
*
* 按本项目的既有教训（「判据与动作打包，于是动作有没有真的发生也能被断言」），
* 把它做成可测函数而不是留在接线里：接线变异掉，测试照样全绿过一次了。
*
* `context`（上游状态 + 业务码）决定「凭据被拒」是永久排除还是冷却，见
* {@link credentialOutcomeOf}。
*/
function liveRequestProbe(kind, message, modelId, context) {
	const queued = context?.queue?.isQueued === true;
	const outcome = queued ? "queued" : kind === "auth" ? credentialOutcomeOf(context) : FAIL_OVER_OUTCOME[kind];
	if (outcome === void 0) return void 0;
	const now = Date.now();
	const retryAfterMs = context?.retryAfterMs;
	return {
		outcome,
		atMs: now,
		source: "live-request",
		...modelId === void 0 || modelId === "" ? {} : { modelId },
		...retryAfterMs === void 0 || !Number.isFinite(retryAfterMs) || retryAfterMs <= 0 ? {} : { retryAtMs: now + retryAfterMs },
		...queued ? { queue: {
			...context?.queue?.queueCount === void 0 ? {} : { queueCount: context.queue.queueCount },
			...context?.queue?.queueType === void 0 ? {} : { queueType: context.queue.queueType }
		} } : {},
		...message === "" ? {} : { message: redactUpstreamText(message) }
	};
}
/**
* 一次真实请求的失败要不要记成**区域级**的「上游报额度耗尽」通知。
*
* 与 {@link liveRequestProbe} 的分工：那条按**账号**记、供池换号决策用，且有
* 两道门（池关不记盘、非成员不记）；这条按**区域**记、纯粹给 UI 看——池关着时
* 一次 code 110 的失败此前在任何面板上都无处显示（0.7.x 的「今日额度疑似已
* 用尽」胶囊拆掉后留下的缺口）。只要 `kind` 是 `quota-exhausted`（上游业务码
* 命中配额族）就记，展示口径「最近一次」——上游恢复正常不会主动通知，所以不
* 设失效时刻，事实性由时间戳保证。
*
* 抽成纯函数的理由同 `liveRequestProbe`：接线变异掉时测试仍能钉住判据。
*/
function liveQuotaExhaustion(kind, message, context, nowMs) {
	if (kind !== "quota-exhausted") return void 0;
	return {
		...context?.code === void 0 || context.code === "" ? {} : { code: context.code },
		message: redactUpstreamText(message),
		atMs: nowMs
	};
}
/**
* **池开关是换号的唯一授权。** 关闭时不得改用任何别的账号。
*
* 这一条此前**缺着**：`nextFailoverCredential` 只读成员名单、从不读
* `enabled`，于是「关掉账号池」这个最核心的开关**对换号完全无效** —— 只要
* 成员非空，插件就永远在失败后悄悄换到另一个 PAT 计费，而用户以为自己关掉了
* 自动行为。默认值是 `enabled: false`，所以这是**每一条全新安装**都在踩的路径。
*
* 注意作用域：签到/测试这两个**手动**批量动作**不**挂在这个开关上 —— 它们由
* 用户亲手点击，不属于「插件替你决定」。只有换号与失败记录设门。
*/
function poolAllowsFailover(prefs) {
	return prefs.enabled;
}
/**
* 该不该把一次「正在服务的请求失败」记成池状态。
*
* 两条守卫各挡一类误伤：
*
*  1. **池关不记**：关掉池子意味着插件不再替用户选号、也不再替用户换号。此时
*     仍把失败写进池状态，用户下次开池会看到一堆根本没参与过任何决策的「上次
*     失败」，也与「关了就完全回到手动选号」这条承诺冲突。
*  2. **非成员不记**：勾选成员就是「我同意让这些号参与」。没勾的号不该因为一次
*     恰好用了它的请求就被判出池 —— 那等于把用户没授权的开销当成默认值。
*
* `invalid-request` 一类不必在这里再挡：shim 的 `isFailoverEligible` 已经排除过
* 它们（400 换谁都是 400），`liveRequestProbe` 不会为它们产出记录。
*/
function shouldRecordPoolFailure(prefs, accountId) {
	if (!prefs.enabled) return false;
	if (accountId === "") return false;
	return prefs.memberAccountIds.includes(accountId);
}
/**
* 一条换号播报的去重键：**同一个事实**才合并。
*
* 键里刻意含接管账号与失败种类：换成另一个账号回答、或失败原因变了
* （限流 → 用尽），都是新事实，应当再说一次。反之，一次 Agent 回合里十几轮
* 调用都以「A 用尽 → B 回答」进行时，它们只是同一件事重复了十几遍。
*/
function failoverAnnounceKey(input) {
	return `${input.fromAccountId}\u0000${input.toAccountId}\u0000${input.kind}`;
}
/**
* 记录并回答「这条播报是否应当发出」：第一次 true，之后同一个键 false。
*
* `seen` 是调用方的有界 Map（值只当作插入顺序序号用，不参与判断）。重复的键会
* 被重新插入，从而在超限淘汰时保住仍然活跃的那一条。
*/
function shouldAnnounceFailoverOnce(seen, input) {
	const key = failoverAnnounceKey(input);
	if (seen.has(key)) {
		seen.delete(key);
		seen.set(key, 0);
		return false;
	}
	seen.set(key, 0);
	while (seen.size > FAILOVER_ANNOUNCE_MAX_ENTRIES) {
		const oldest = seen.keys().next();
		if (oldest.done === true) break;
		seen.delete(oldest.value);
	}
	return true;
}
/** 某个账号不再被排除时，把它参与过的播报记录一并清掉（下一次重新播报）。 */
function clearAnnouncedFailoversFrom(seen, accountId) {
	const prefix = `${accountId}\u0000`;
	for (const key of [...seen.keys()]) if (key.startsWith(prefix) || key.includes(`\u0000${accountId}\u0000`)) seen.delete(key);
}
/**
* The region's daily quota refresh point for one PAT, as `probeModel` wants it.
*
* 「当日用量用尽」(code 110) 的恢复时刻是**次日窗口开启**，不是 30 分钟。上游
* 在签到报文里给了这个时刻（`daily.endAt`），签到批次把它存进快照；这里就
* 从快照取。
*
* 取不到时返回 `{}`（不传）。这是**故意的保守**：宁可用 30 分钟兜底，也不在
* 本机编一个「次日零点」。官方页面上那个数字才是准的，编出来的会让用户在错的
* 时间回来 —— 与 `cooldownOf` 的既有注释同一条规矩。
*
* 抽成纯函数是为了能被断言：它是 `probeThrough` 里唯一无法单测的闭包边角，
* 而恰恰是这一处此前**从未传过** `quotaRefreshAtMs`，让 out-of-credit 一直
* 走兜底。
*/
function quotaRefreshOf(snapshot, pat) {
	const refreshAtMs = snapshot?.[qoderAccountId(pat)]?.refreshAtMs;
	return refreshAtMs === void 0 ? {} : { quotaRefreshAtMs: refreshAtMs };
}
//#endregion
export { Config, QODER_CONNECT_VERSION, QODER_GITHUB_URL, apply, asVolatile, catalogSnapshotDeclaresEfforts, clearAnnouncedFailoversFrom, credentialOutcomeOf, failoverAnnounceKey, inject, liveQuotaExhaustion, liveRequestProbe, name, poolAllowsFailover, quotaRefreshOf, regionEnabled, regionHasCredential, regionStateOf, retryPolicyOf, serveSavedCatalog, settingsNamespaceOf, shouldAnnounceFailoverOnce, shouldRecordPoolFailure, unwrapVolatile, withHardTimeout };
