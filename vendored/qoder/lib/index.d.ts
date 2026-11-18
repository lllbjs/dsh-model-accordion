import z from "@deepseek-ai/schemastery";
import { RetryPolicyConfig } from "@deepseek-ai/dsh-llm";
import { Context } from "@deepseek-ai/cordis";
//#region src/upstream.d.ts
type QoderRegion = 'cn' | 'global';
/** 上游错误分类，供 shim 映射为 DSH 可判定的 code。 */
type UpstreamErrorKind = 'network' | 'auth' | 'rate-limited' | 'invalid-request' | 'content-policy' | 'quota-exhausted' | 'transient' | 'unknown';
/**
 * 一笔**专属积分包**（issue #38）—— 上游 `qoderUsage.dedicatedResourcePackages[]`。
 *
 * 国际版实测（`GET /sash/api/v2/me/usage`）：
 *
 * ```json
 * [{ "id": "pkg-example", "name": "act-example", "total": 888, "used": 0,
 *    "remaining": 888, "percentage": 0, "unit": "credits",
 *    "expiresAt": 1798732800000, "available": true,
 *    "status": "QUOTA_DETAIL_STATUS_ACTIVE",
 *    "displayLabels": [
 *      { "dimension": "title", "value": "sota model series",
 *        "valueI18n": { "en-US": "SOTA Exclusive Credits", "zh-CN": "SOTA 专属积分" } },
 *      { "dimension": "description", "value": "…",
 *        "valueI18n": { "en-US": "…", "zh-CN": "…" } } ] }]
 * ```
 *
 * 三条「不用自己编」的性质，正是这个类型只透传、不解释的理由：
 *
 *  - **名字上游自己就给了**（`displayLabels` 的 `valueI18n` 带 zh-CN / en-US），
 *    所以 DTO 里存的是**两种语言的原文**，由界面按当前语言挑一条 —— 插件翻译
 *    一个营销词只会在上游改词时落后；
 *  - 它有 `remaining` / `total`，能直接填读数；
 *  - 它有 `status`，`QUOTA_DETAIL_STATUS_ACTIVE` 以外的不该算。
 *
 * ⚠️ 国内版实测 `qoderUsage` 里**没有**这个键，所以这一整块天然只在国际版出现。
 */
interface QoderDedicatedPackage {
  /** 上游的包 id（同一次报文内唯一；界面用它做 React key）。 */
  id: string;
  /** 上游给的**两种语言**标题；两边都没有时才缺席（那时界面不外显这一个包）。 */
  title?: {
    zh?: string | undefined;
    en?: string | undefined;
  } | undefined;
  /** 上游给的双语说明（「在模型选择器中选择 Sonus 时优先抵扣」）。 */
  description?: {
    zh?: string | undefined;
    en?: string | undefined;
  } | undefined;
  /**
   * 剩余额度；`undefined` = 上游这一行没报（不是 0）。
   *
   * 与 `creditsOf` 里的积分包同一条规矩：0 是关于账号的一个断言，缺席只是
   * 「这次没读到」。
   */
  remaining?: number | undefined;
  total?: number | undefined;
  /** 这一包的到期时刻（ms）。有它就能放进悬停，不必另编一个倒计时。 */
  expiresAtMs?: number | undefined;
  /** 上游的原始 `status`（`QUOTA_DETAIL_STATUS_ACTIVE` 等），原样保留。 */
  status?: string | undefined;
}
/** 用量信息（sash/api/v2/me/usage 的 qoderUsage 形状，官方 SDK UsageInfo 核对）。 */
interface QoderUsage {
  userType?: string | undefined;
  expiresAt?: number | undefined;
  upgradeUrl?: string | undefined;
  userQuota?: {
    total?: number | undefined;
    used?: number | undefined;
    remaining?: number | undefined;
    percentage?: number | undefined;
  } | undefined;
  addOnQuota?: {
    total?: number | undefined;
    used?: number | undefined;
    remaining?: number | undefined;
    percentage?: number | undefined;
    detailUrl?: string | undefined;
  } | undefined;
  orgResourcePackage?: {
    used?: number | undefined;
    cap?: number | undefined;
    remaining?: number | undefined;
    percentage?: number | undefined;
    available?: boolean | undefined;
  } | undefined;
  /**
   * 专属积分包（issue #38）。**只有国际版下发**；国内版实测没有这个键。
   *
   * 缺席 = 这个账号没有（或上游这次没给），不是「读失败」——两者的处理不同：
   * 前者界面不画那一列，后者与「积分读不出来」同路。
   */
  dedicatedResourcePackages?: readonly QoderDedicatedPackage[] | undefined;
  isQuotaExceeded?: boolean;
}
//#endregion
//#region src/promo.d.ts
/**
 * Qoder 的活动优惠规则（`promotion`）：解析与「此刻是否成立」的判定。
 *
 * 三件事都在这里，且都围绕**不替上游说话**：
 *
 * 1. 什么是活动。`model/list` 的每个模型行自带一个 `promotion` 对象，里面既有
 *    上游自己的文案（`badge.zh` / `badge.en`、`description`），也有规则本身
 *    （`rule_id`、`discount_factor`、`window_start/end`、`timezone`）。实测两个
 *    区域都是同一套 schema，只有时区与文案不同（国内 `Asia/Shanghai`，国际
 *    `Asia/Singapore`；国内写「错峰 4 折」，国际写「错峰 4 折」/「Off-Peak 60%
 *    off」）。**文案是上游给的，插件不翻译、不改写**——这与 workbuddy 的促销
 *    徽标同规，也与 Trae 那边故意留白的做法相反（Trae 只发数字，所以那边只能
 *    自造「闲时」这类词）。
 * 2. 什么时候画。上游同时给了一个服务端算好的 `active` 和一个墙钟时段。实测
 *    2026-10-21T16:2x（窗口 22:00–08:00 之外）两个区域全部 `active: false`，说明
 *    它是**按当时那一刻算的**，不是常量；而目录是 DSH 进程启动时取的一份内存快照
 *    （之后只有点「从 Qoder 刷新」才换）。所以：**有窗口就用窗口**（渲染时刻现算，
 *    快照多旧都不影响），没有窗口才退回 `active`。若把 `active` 也当成门，白天启动
 *    的进程会拿着 16:00 的 `false` 一直用到退出，22:00 窗口开了也不画——这个功能
 *    对「一直开着 DSH」的用户等于不存在。反过来，窗口是「此刻」的纯函数，不会因为
 *    快照旧而说错话。
 * 3. 时段怎么算。`window_start` / `window_end` 是**上游声明时区里的墙钟时间**
 *    （`HH:MM`，终点允许 `24:00`），且可以跨零点（22:00→08:00）。所以判定必须按那条
 *    记录的 `timezone` 求当地分钟数，不能拿浏览器本地时间直接比——用户在 UTC+0 打开
 *    卡片时，「22:00–08:00」说的是 Asia/Shanghai 的 22:00，不是他的。时区读不懂就
 *    不画（退回本地时区会让跨零点窗口错位几小时，比不画更糟）。
 *
 * 这里**不做**的事：不猜活动意图、不从 `discount_factor` 反推文案、不把
 * `link_url` 变成可点击动作（卡片上的胶囊只是提示）、不在解析时挑定一枚
 * 徽标（判定放在渲染时刻，理由同 workbuddy 的 `selectPromoBadge`）。
 *
 * 折扣数字（`discount_factor` / `before_promotion_price_factor`）现在**保留**：
 * 它不是用来反推文案的（文案仍原样取上游），而是给 {@link displayMultiplierOf}
 * 在渲染时刻算「活动实际倍率」——issue #41 里 Qoder 官方显示 `x0.00` 而插件只
 * 显示基准价 `0.1x` 的那处不一致。计算只在 UI 层用，计费与落盘仍走基准价。
 *
 * @module dsh-connect-qoder/promo
 */
/** 上游的中英双语字段（`badge` / `description` / `link_url` 都是这个形状）。 */
interface QoderPromoLabel {
  zh?: string;
  en?: string;
}
/** 上游声明的时段（`window_start` / `window_end`，墙钟 `HH:MM`，可跨零点）。 */
interface QoderPromoWindow {
  /** 原样保留的起点文本（`22:00`）。 */
  start: string;
  /** 原样保留的终点文本（`08:00`）。 */
  end: string;
  /** 起点的当天分钟数（0–1439）。 */
  startMinute: number;
  /** 终点的当天分钟数（0–1439）。 */
  endMinute: number;
}
/**
 * 一条已解析的活动规则。
 *
 * 字段名用 camelCase（上游是 snake_case），存储与投影都只认这一种形状——落盘
 * 的形状与运行期的形状是同一个，读回时不需要第二套解析（`readPromotion`）。
 */
interface QoderPromotion {
  /**
   * 上游在**取目录那一刻**算出的「此刻生效」。
   *
   * 它是一份快照：目录在 DSH 进程启动时取一次，之后只有点「从 Qoder 刷新」才会换。
   * 所以只在**没有窗口声明**时拿它作依据（那种活动没有起止，快照旧了也不会错）；
   * 有窗口时窗口说了算，见 `promoLiveAt`。
   */
  active: boolean;
  /** 上游自己的徽标文案。没有它就没有可画的东西，解析直接丢弃。 */
  badge: QoderPromoLabel;
  /** 上游自己的悬停说明。 */
  description?: QoderPromoLabel;
  /** 上游声明的时区（`Asia/Shanghai`）；缺席时按账号所在区域兜底。 */
  timeZone?: string;
  /** 上游声明的每日时段；缺席表示没有窗口声明。 */
  window?: QoderPromoWindow;
  /**
   * 上游**声明了**窗口但读不懂（`24:30`、只给一端、`HH:MM` 以外的写法）。
   *
   * 与「没有窗口声明」是两件事：读不懂的窗口不能被当成「全天」，也不能退回去信
   * `active`——那会把一句读不懂的规则放大成整天都在打折。这种条目一律不画。
   */
  windowUnreadable?: boolean;
  /** 上游的活动说明页。 */
  link?: QoderPromoLabel;
  /**
   * 上游的折扣系数（`discount_factor`，形如 `0.4` = 基准价打四折、`0` = 免费）。
   *
   * 只给 {@link displayMultiplierOf} 算 UI 展示用倍率，绝不参与计费/落盘。
   * 缺席（上游没给或不是有限数）≠ 0：前者是「不知道有没有折扣」，回退基准价。
   */
  discountFactor?: number;
  /**
   * 上游声明的「折前倍率」（`before_promotion_price_factor`，形如 `0.5`）。
   *
   * **只作记录，不参与计算**：`displayMultiplierOf` 的公式是「当前基准价 ×
   * `discount_factor`」（实测 `0.5 × 0.4 = 0.2`，见 PROMO_BADGE.md §5.1）。不拿
   * 这个字段去校验基准价——一旦上游给的值与目录里的 `price_factor` 对不上
   * （改价、或限时免费这种特价活动），用它当门会把本来该显示的 `x0.00` 又压
   * 回基准价，正是 issue #41 要修的病。留着它是为了不丢上游声明，供日后复核。
   */
  beforePromotionPriceFactor?: number;
}
//#endregion
//#region src/catalog.d.ts
interface QoderModelInfo {
  key: string;
  displayName: string;
  /** 积分倍率（模型名内嵌 `· xN.NN`）。 */
  priceFactor: number;
  /** 原生输入窗口（由 context_config 首档或 max_input_tokens 决定）。 */
  contextWindow: number;
  maxOutputTokens: number;
  supportsImages: boolean;
  supportsThinking: boolean;
  /** 可完全关闭思考（thinking_config.disabled 存在）。 */
  canDisableThinking: boolean;
  /**
   * 上游声明的思考强度档位（`thinking_config.enabled.efforts` 的键，按强度
   * 升序）。不存在时该模型没有可选档位，卡片不渲染这一项。
   *
   * 实测 Qoder 的档位名不统一：Qwen 系用 `low / medium / xhigh`，DeepSeek/GLM
   * 用 `low / high / max`——所以只做展示，不做跨模型比较。上游给出的键序也不
   * 可靠（JSON 里可能先出现 `xhigh`），必须按语义排序后再显示。
   */
  thinkingEfforts?: string[];
  /** 上游标为默认的档位（`efforts[x].is_default`）。 */
  defaultThinkingEffort?: string;
  isDefault: boolean;
  isFree: boolean;
  isNew: boolean;
  /**
   * 网关声明可用的上下文档位（`context_config` 各项的 token_count，升序）。
   * 不存在时无档位可选，卡片不渲染预算选择器。
   */
  contextTiers?: number[];
  /**
   * 上游的活动优惠规则（`model/list` 每行的 `promotion`）。
   *
   * 这里存的是**解析后**的规则（`src/promo.ts` 的 `QoderPromotion`），不是上游的
   * snake_case 原文：落盘、投影、卡片三处只认一种形状，读回时用 `readPromotion`
   * 校验，不会出现两套解析各自漂移。
   *
   * 缺席 = 上游没给活动（或给的活动没有可显示的文案）。**不要**从
   * `price_factor` 反推活动——倍率是基础价，活动是另一层，混起来会画出上游没
   * 说的折扣。
   */
  promotion?: QoderPromotion;
}
//#endregion
//#region src/status-paths.d.ts
/**
 * The project's public repository.
 *
 * Lives here rather than beside one component because TWO sections link to it
 * — the model section and the account pool — and a second copy of a URL is a
 * second thing to forget when it moves. Node-free and side-effect free, so it
 * costs nothing on the Host side either.
 */
declare const QODER_GITHUB_URL = "https://github.com/dingminhua/dsh-connect-qoder";
/**
 * One credit bucket as the card renders it, node-free.
 *
 * ⚠️ **没有 `expiresAtMs`，也没有 `monthly`**（issue #31 的两条）。
 *
 * - `expiresAtMs` 曾经挂在这里，但上游那个字段是 `qoderUsage.expiresAt` ——
 *   账号级**套餐 / 14 天试用**的到期，不是「这个积分包过期」。`userQuota` /
 *   `addOnQuota` 自己都不带任何到期字段。把它挂在一个叫「积分包」的类型上，
 *   等于用一个误导性的名字请后来者再踩一次。套餐到期改在 {@link QoderWebCredits}
 *   上单出 `planExpiresAtMs`。
 * - `monthly` 在 Qoder 这边**恒为 `false`**（没有按月刷新的桶），它没有编码
 *   任何信息。family 的约定是「有按月刷新的桶时，用 `monthly` + `cycleRefreshMs`
 *   这一对表达」，不是「每个连接器都必须有」。留着它只会让读者无法区分
 *   「不按月刷新」与「作者没填」。
 */
interface QoderWebCreditPackage {
  /** Stable bucket key — 'base' | 'addon' | 'org'; the card localizes it. */
  packageName: string;
  remain: number;
  size: number;
}
/** Aggregated credit answer rendered by the plugin card. */
interface QoderWebCredits {
  total: number;
  packages: readonly QoderWebCreditPackage[];
  /**
   * 3 天内到期的积分**金额**（不是包数）。
   *
   * 同名二义曾经存在（issue #31 附带那条）：`creditsOf` 累加的是**包数**，而
   * `poolMemberCredits` 累加的是**金额**，卡片文案 `row.poolCreditSoon` 写的是
   * 「{count} 积分 3 天内过期」—— 金额措辞。现在两处都只算金额，计数那一份
   * 从 DTO 里删掉（它没有读者）。
   */
  expiringSoon: number;
  /**
   * 最早一批**积分**的到期时刻（ms）。只来自真正带到期语义的批次（签到批），
   * 与套餐到期无关 —— 池排序的「临期紧急度」读的就是它。
   */
  nearestExpiryMs?: number;
  /**
   * 账号级**套餐 / 试用**到期时刻（ms），来源是上游 `qoderUsage.expiresAt`。
   *
   * issue #31 的语义拆分：这个值此前伪装成 `packages[].expiresAtMs`，于是
   * 「14 天试用到期」被显示成「积分包到期」。它与积分紧急度是两件事，所以既不进
   * `expiringSoon`，也不进 `nearestExpiryMs`，更不参与池排序。
   */
  planExpiresAtMs?: number;
}
/**
 * 一笔专属积分包，面板要画的那几个字段（issue #38）。
 *
 * 与上游 DTO（`QoderDedicatedPackage`）分开声明，理由与
 * {@link QoderWebProbeOutcome} 相同：`status-paths.ts` 是**无 node 依赖的桥**，
 * 客户端会 import 它，不该顺着类型把上游模块（`node:http`、cosy 签名那一套）
 * 拖进浏览器包里。
 */
interface QoderWebDedicatedPackage {
  /** 上游的包 id —— 同一次报文内唯一，界面拿它做 React key。 */
  id: string;
  /**
   * 上游自己的双语标题（`SOTA 专属积分` / `SOTA Exclusive Credits`）。
   *
   * **插件不翻译它。** 上游在 `displayLabels[].valueI18n` 里已经给了两种语言，
   * 自己再写一份译文只会在上游改词时落后一步，而这是个营销词、不是术语。
   */
  title?: {
    zh?: string;
    en?: string;
  };
  /** 上游自己的双语说明（「在模型选择器中选择 Sonus 时优先抵扣该积分」）。 */
  description?: {
    zh?: string;
    en?: string;
  };
  /** 剩余额度；缺席 = 上游这一行没报（**不是 0**）。 */
  remaining?: number;
  total?: number;
  /** 这一包的到期时刻（ms）。 */
  expiresAtMs?: number;
}
/**
 * Outcome vocabulary of one model probe, shared by the Host and the card.
 *
 * Mirrors `QoderProbeOutcome` in `./probe.ts`; kept as its own declaration
 * here because this module is the node-free bridge and must not import the
 * Host-side probe module.
 */
type QoderWebProbeOutcome = 'ok' | 'rate-limited' | 'out-of-credit' | 'credential-rejected' | 'policy-rejected' | 'unavailable' | 'queued' | 'not-found' | 'failed';
/**
 * 最近一次**上游明说**的额度耗尽（对话路径上 `quota-exhausted` 的那次失败）。
 *
 * 为什么需要它：逐账号的 `out-of-credit` 只活在账号池的视图里，而池的记账有
 * 两道门（池关不记盘、非成员不记）——池关着时一次 code 110 的失败在任何 UI 上
 * 都无处可看（0.7.x 时代的「今日额度疑似已用尽」胶囊就是干这个的，后来随本地
 * 计数器一起被拆掉了）。这份记录按**区域**存、与池开关无关，是那条信息现在的
 * 出口。
 *
 * 注意它是**事实**不是推断：只有上游的业务码命中配额族（110/113/118/…）才产生
 * 它，措辞用「上游报」，不用旧版的「疑似（本地统计）」。
 */
interface QoderWebQuotaExhaustion {
  /** 上游业务码（如 `110` 当日用量 / `118` 个人 Credits 耗尽），读不到则缺席。 */
  code?: string;
  /** 脱敏后的上游原文（与探针 message 同一处理，pt- 形态绝不落盘）。 */
  message: string;
  /** 上游报出这件事的时刻；展示口径是「最近一次」。 */
  atMs: number;
}
//#endregion
//#region src/version.d.ts
/**
 * Package version, injected at build time by `tsdown.config.ts`.
 *
 * 参考：dsh-connect-workbuddy（MIT）——版本由构建期 define 注入，而非
 * 运行时读 package.json（发布包只含 lib/，不含可解析的 package.json 路径）。
 *
 * @module dsh-connect-qoder/version
 */
/** The npm package version this build was produced from. */
declare const QODER_CONNECT_VERSION: string;
//#endregion
//#region src/account-pool.d.ts
/**
 * Which of the pool's writers produced a measurement.
 *
 * `test-batch` — the user pressed "test", so the outcome is a deliberate
 *   measurement of the target model.
 * `live-request` — a real chat request failed and its failure was recorded so
 *   the NEXT request starts from a measurement instead of rediscovering the
 *   same wall.
 */
type QoderPoolProbeSource = 'test-batch' | 'live-request';
/**
 * 一条测量的 `retryAtMs` 是谁给的（issue #32）。
 *
 * `upstream-reported` 是上游自己申报的等待时长（排队信封），`quota-refresh`
 * 是从签到快照推出来的当日窗口结束时刻 —— 后者是**本地推算**，卡片必须说清楚，
 * 否则用户会把「我们猜的」读成「上游说的」。`retry-after` / `upstream-message`
 * 来自探针路径（HTTP 头、失败报文里的重置句）。
 *
 * `unknown-cooldown` 与前面四个**语义不同**，务必看清：它表示 `retryAtMs`
 * **缺席**，这次排除用的完全是本地兜底节奏（{@link POOL_UNKNOWN_COOLDOWN_MS}），
 * 上游没有、快照也没有给出任何时刻。它存在的唯一理由是让「我们在按 30 分钟
 * 自己重试」这件事在数据里留下痕迹 —— 只看着 `retryAtMs` 缺席的话，它与
 * 「上游没说、我们也不打算再试」完全无法区分，而实际上系统会拿真实聊天请求
 * 每 30 分钟撞一次。
 */
type QoderPoolProbeRetrySource = 'retry-after' | 'upstream-message' | 'quota-refresh' | 'upstream-reported' | 'unknown-cooldown';
/**
 * What the pool knows about ONE account's last test of the target model.
 *
 * `undefined` means "never tested", deliberately distinct from every measured
 * outcome: an untested account is a candidate (the user may want to use it
 * now) whereas a measured failure is not.
 */
interface QoderPoolProbe {
  outcome: QoderWebProbeOutcome;
  /** When this measurement was taken, in epoch ms. */
  atMs: number;
  /**
   * WHAT WROTE THIS MEASUREMENT. Absent for any measurement written before the
   * field existed, so old probe files stay readable — an absent source means
   * "unknown", never a guess.
   */
  source?: QoderPoolProbeSource;
  /**
   * When this account may be usable again, when the upstream stated a time.
   * ABSENT when the upstream named no time — never a locally invented one.
   */
  retryAtMs?: number;
  /**
   * WHICH source supplied {@link retryAtMs}（issue #32）。
   *
   * 缺席 = 写这条记录的版本还没有这个字段（旧文件照常可读，卡片按「没说」处理）。
   */
  retrySource?: QoderPoolProbeRetrySource;
  /**
   * 上游的排队信息（issue #26）。
   *
   * 缺席 = 上游没提排队。`queueCount` 是上游给的人头数，不是本地估的。
   */
  queue?: {
    queueCount?: number;
    queueType?: string;
  };
  /**
   * The upstream's own words on the failure, already redacted by the probe.
   * ABSENT for a success.
   */
  message?: string;
  /**
   * WHICH MODEL this measurement is about.
   *
   * Without it a probe is an unscoped verdict: the pool would take "model A
   * worked, model B was rate-limited" and conclude the ACCOUNT is fine or
   * broken regardless of what is being asked for. Qoder rate-limits per model,
   * so the same PAT can be `ok` on one and `rate-limited` on another at the
   * same instant.
   *
   * ABSENT means the writer did not record a model (records written before the
   * field existed, and the live-request path, which knows the failure kind but
   * not reliably which model was being asked for). Readers must treat absent
   * as "applies to anything" — that is the old, coarser behaviour, not a
   * claim that every model agrees.
   */
  modelId?: string;
}
//#endregion
//#region src/credit-expiry.d.ts
/**
 * 一次签到领到的积分批次。
 *
 * `validityDays` 缺席 = 上游这次没说有效天数（不猜）。`amount` 缺席 = 没说数额
 * （只影响「临期多少分」，不影响「哪一批先过期」）。
 */
interface QoderCheckinBatch {
  /** 领取时刻（epoch ms）。这是上游没给的 `claimAtMs`，由本地在领到的那一刻记下。 */
  atMs: number;
  /** 有效天数，来自 `benefit.validity.days`。 */
  validityDays: number;
  /** 这一批的数额，来自 `benefit.amount`。 */
  amount?: number;
}
//#endregion
//#region src/index.d.ts
declare const name = "dsh-connect-qoder";
/** The model registry and settings service required before providers register. */
declare const inject: string[];
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
declare function withHardTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | undefined>;
/** The namespace the HOST actually serves this plugin under (workbuddy probe). */
declare function settingsNamespaceOf(ctx: unknown): string;
declare function asVolatile<T>(schema: z<T>): z<T>;
/** Unwrap a schemastery volatile's reactive `.get()` into a plain snapshot. */
declare function unwrapVolatile<T>(value: T): T;
interface Config {
  regions: Record<string, unknown>;
  /**
   * 是否在 DSH 侧边栏放一个 Qoder 面板（行 + 整页）。**默认关闭**。
   *
   * 参考：dsh-connect-workbuddy 的 `Config.sidebarPanel`（PR #188，MIT，
   * Copyright (c) 2026 LaoDing）。
   *
   * 为什么要用户显式打开：这一行占的是 `sidebar.panellist` —— 所有插件共用的
   * 全局侧边栏座位，点开还会接管中央面板。打开它是对用户整个侧边栏的决定，
   * 不是对这张卡片的偏好；「插件」页本来就能看到同一张卡片，所以默认值必须是
   * 「不替用户动侧边栏」。缺席读作关闭（`=== true` 判据见 `status-paths.ts`）。
   */
  sidebarPanel?: boolean;
}
declare const Config: z<Config>;
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
declare function catalogSnapshotDeclaresEfforts(models: readonly {
  thinkingEfforts?: readonly string[];
}[]): boolean;
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
declare function serveSavedCatalog(models: readonly QoderModelInfo[], onStale: () => void): {
  models: readonly QoderModelInfo[];
  stale: boolean;
};
/** 某区域的配置状态（缺省返回空对象）。 */
declare function regionStateOf(config: {
  regions?: Record<string, unknown> | null;
}, region: QoderRegion): Record<string, unknown>;
/** 某区域是否启用（opt-out）。 */
declare function regionEnabled(config: {
  regions?: Record<string, unknown> | null;
}, region: QoderRegion): boolean;
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
declare function retryPolicyOf(config: {
  regions?: Record<string, unknown> | null;
}, region: QoderRegion): RetryPolicyConfig | undefined;
/**
 * 某区域「上游排队时插件自己等多久」的上限（毫秒，issue #29）。
 *
 * 返回 `undefined` 表示关掉（0）：失败原样交给宿主的重试阶梯。本地读取而不是
 * 依赖 schema 默认值 —— 这样在设置存在之前写下的配置读出来是「关」还是「60 秒」
 * 由这里一句话决定，不随 schema 默认值漂移。
 *
 * 为什么默认开着：宿主的阶梯前两次一定短于上游申报的 30 秒（见 issue #29 的
 * 28 次重试实测），不在这层等掉就等于每次都在对方说「别来」的窗口里敲门。
 */
declare function queueWaitMsOf(config: {
  regions?: Record<string, unknown> | null;
}, region: QoderRegion): number | undefined;
/** 某区域是否配置了凭据（设置 PAT 或环境变量其一）。 */
declare function regionHasCredential(config: {
  regions?: Record<string, unknown> | null;
}, region: QoderRegion): boolean;
/**
 * 把一次用量解析成卡片可渲染的积分包。
 *
 * ⚠️ **上游那个 `expiresAt` 不是积分包的到期**（issue #31 的主问题）：它是
 * `qoderUsage` 的同级字段，等于 `userId`（UUIDv7）前 48 bit + 14 天 ——
 * **账号级套餐 / 试用**的到期。`userQuota` / `addOnQuota` 自己都不带到期字段。
 * 此前它被挂到 `addon` 包上，于是「试用期到期」被显示成「积分包到期」，池排序
 * 也拿它当积分紧急度。现在它单独出 `planExpiresAtMs`，与积分彻底分开。
 *
 * 积分本身的到期只可能来自**签到批次**（上游 `validity.days` 只在活动里给过），
 * 那一路见 `credit-expiry.ts`。
 */
declare function creditsOf(usage: QoderUsage): QoderWebCredits;
/**
 * 把专属积分包映射进面板那一列的 DTO（issue #38）。
 *
 * **不并进 `total`。** 这是这一条最容易做错的地方：专属包是「选了某个模型才
 * 优先抵扣」的一笔钱（上游原文：在模型选择器中选择 Sonus 模型时优先抵扣该
 * 积分），与「普通积分」是**两个池子**。把它们相加会让胶囊显示一个用户花不掉
 * 的数字 —— 不选那只模型，这笔钱一分都动不了。所以它单独一列，普通积分那一列
 * 一个字都不变。
 *
 * 只留 `remaining > 0` 的（issue #38 的原话：「且 remaining > 0 时才多出这一
 * 列」）：一个用光的专属包留在读数里，用户会以为那笔钱还在。`remaining` 缺席
 * 的行**保留**（那是「上游没报」，不是「用完了」），界面画成「—」。
 */
declare function dedicatedPackagesOf(usage: QoderUsage): QoderWebDedicatedPackage[];
/**
 * 把签到批次的到期推算并进积分视图。
 *
 * 分成两步（而不是把批次塞进 `creditsOf`）的理由：`creditsOf` 是纯的、只吃
 * 一次 usage 报文；批次是**另一份状态**，进程重启后才需要落盘。分开之后，
 * 「没有批次」是一个自然状态（新装的插件、从没签到过），而不是一种要特判的错误。
 */
declare function creditsWithExpiry(credits: QoderWebCredits, batches: readonly QoderCheckinBatch[], nowMs?: number): QoderWebCredits;
declare function apply(ctx: Context, config: Config): void;
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
declare function credentialOutcomeOf(context?: {
  status?: number | undefined;
  code?: string | undefined;
}): QoderWebProbeOutcome;
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
declare function liveRequestProbe(kind: UpstreamErrorKind, message: string, modelId?: string, context?: {
  status?: number | undefined;
  code?: string | undefined;
  /** 上游申报的等待时长（毫秒），issue #26。 */
  retryAfterMs?: number | undefined;
  /** 上游说「我在排队」的证据，issue #26。 */
  queue?: {
    isQueued: boolean;
    queueCount?: number;
    queueType?: string;
    retryAfterSeconds?: number;
    serviceAvailable?: boolean;
  } | undefined;
  /**
   * 「当日用量用尽」的恢复时刻（签到快照里的 `refreshAtMs`），issue #32。
   *
   * 真实请求撞 `110` 时，上游报文里**没有**等待时长（那是 `10605` 排队信封
   * 才有的字段），于是这条路径此前只能落一条没有 `retryAtMs` 的记录，池子
   * 按 30 分钟兜底 —— 一个要等到次日窗口才恢复的号，每 30 分钟被真实请求
   * 撞一次。探测路径（`probeThrough`）早就接上了这个值，真实路径没有。
   *
   * 只在 `out-of-credit` 时采用，与 {@link cooldownOf} 同一顺序：上游申报的
   * 时长优先，其次才是快照推出来的窗口时刻。
   */
  quotaRefreshAtMs?: number | undefined;
}): QoderPoolProbe | undefined;
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
declare function liveQuotaExhaustion(kind: UpstreamErrorKind, message: string, context: {
  status?: number | undefined;
  code?: string | undefined;
} | undefined, nowMs: number): QoderWebQuotaExhaustion | undefined;
/** 「这个区域此刻允不允许替用户换号」所需要的那一个偏好位。 */
interface PoolGate {
  enabled: boolean;
  memberAccountIds: readonly string[];
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
declare function poolAllowsFailover(prefs: PoolGate): boolean;
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
declare function shouldRecordPoolFailure(prefs: PoolGate, accountId: string): boolean;
/**
 * 一条换号播报的去重键：**同一个事实**才合并。
 *
 * 键里刻意含接管账号与失败种类：换成另一个账号回答、或失败原因变了
 * （限流 → 用尽），都是新事实，应当再说一次。反之，一次 Agent 回合里十几轮
 * 调用都以「A 用尽 → B 回答」进行时，它们只是同一件事重复了十几遍。
 */
declare function failoverAnnounceKey(input: {
  fromAccountId: string;
  toAccountId: string;
  kind: string;
}): string;
/**
 * 记录并回答「这条播报是否应当发出」：第一次 true，之后同一个键 false。
 *
 * `seen` 是调用方的有界 Map（值只当作插入顺序序号用，不参与判断）。重复的键会
 * 被重新插入，从而在超限淘汰时保住仍然活跃的那一条。
 */
declare function shouldAnnounceFailoverOnce(seen: Map<string, number>, input: {
  fromAccountId: string;
  toAccountId: string;
  kind: string;
}): boolean;
/** 某个账号不再被排除时，把它参与过的播报记录一并清掉（下一次重新播报）。 */
declare function clearAnnouncedFailoversFrom(seen: Map<string, number>, accountId: string): void;
/**
 * @deprecated 用 {@link quotaRefreshOfAccount}（按账号 id）或
 * {@link quotaRefreshOfStored}（再叠一层磁盘）。
 *
 * 保留它只为**不删已发布过的导出**（1.17.4 的 `lib/index.d.ts` 里有这个名字，
 * 补丁版本不该把它拿走）。但它正是 issue #32 那个坑的形状：它替调用方把 PAT
 * 派生成 id，而真实请求路径手里**本来就是 id** —— 再派生一次得到
 * `pat-<hash(pat-…)>`，永远取不到，修复静默失效而纯函数测试全绿。
 *
 * 只在你手里确实是 PAT 时用它；其余情况直接用 id 那个入口。
 */
declare function quotaRefreshOf(snapshot: Readonly<Record<string, {
  refreshAtMs?: number;
}>> | undefined, pat: string): {
  quotaRefreshAtMs?: number;
};
/**
 * 「当日用量用尽」(code 110) 的恢复时刻，从签到快照按**账号 id** 取。
 *
 * 上游在签到报文里给了这个时刻（`daily.endAt`），签到批次把它存进快照；这里
 * 就按 id 取。取不到时返回 `{}`（不传）—— 这是**故意的保守**：宁可用 30 分钟
 * 兜底，也不在本机编一个「次日零点」。官方页面上那个数字才是准的，编出来的会
 * 让用户在错的时间回来（与 `cooldownOf` 的既有注释同一条规矩）。
 *
 * ⚠️ **键是账号 id（`pat-…`），不是 PAT**，这是 issue #32 那个坑：真实请求路径
 * （`onServingFailure`）只拿得到 `accountId`，而探测路径手里是 PAT。曾经有一个
 * 内部先 `qoderAccountId(pat)` 再取的入口，把 `pat-abc…` 再哈希一次得到
 * `pat-<hash(pat-…)>`，于是永远取不到、修复静默失效（纯函数测试还全绿）。
 * 现在派生一律由**调用方**做，本函数只认 id —— 少一个入口就少一处能踩。
 */
declare function quotaRefreshOfAccount(snapshot: Readonly<Record<string, {
  refreshAtMs?: number;
}>> | undefined, accountId: string): {
  quotaRefreshAtMs?: number;
};
/**
 * 同上，但在进程内快照之外再看一眼**落过盘**的窗口时刻（issue #32 第三条）。
 *
 * 为什么需要第三个入口：`checkinSnapshots` 是进程内对象，注释里也写了「重启后
 * 由下一次签到重新写入」。而 110 的兜底冷却恰恰只在「窗口时刻不知道」时生效 ——
 * 于是进程一重启兜底就必然生效，用户看到的就是「这个号每半小时被试探一次」。
 * 窗口时刻本身是一个**绝对时间点**（上游活动行的 `endAt`），它跨重启仍然成立。
 *
 * 顺序：进程内快照优先（它带今天的 `claimed` 语境），其次磁盘。两者都没有时
 * 返回 `{}`，让调用方走兜底 —— 与这套代码一贯的「宁缺勿错」同规。
 */
declare function quotaRefreshOfStored(snapshot: Readonly<Record<string, {
  refreshAtMs?: number;
}>> | undefined, stored: Readonly<Record<string, number>> | undefined, accountId: string, nowMs?: number): {
  quotaRefreshAtMs?: number;
};
//#endregion
export { Config, PoolGate, QODER_CONNECT_VERSION, QODER_GITHUB_URL, apply, asVolatile, catalogSnapshotDeclaresEfforts, clearAnnouncedFailoversFrom, credentialOutcomeOf, creditsOf, creditsWithExpiry, dedicatedPackagesOf, failoverAnnounceKey, inject, liveQuotaExhaustion, liveRequestProbe, name, poolAllowsFailover, queueWaitMsOf, quotaRefreshOf, quotaRefreshOfAccount, quotaRefreshOfStored, regionEnabled, regionHasCredential, regionStateOf, retryPolicyOf, serveSavedCatalog, settingsNamespaceOf, shouldAnnounceFailoverOnce, shouldRecordPoolFailure, unwrapVolatile, withHardTimeout };