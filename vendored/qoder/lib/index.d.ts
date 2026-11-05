import z from "@deepseek-ai/schemastery";
import { RetryPolicyConfig } from "@deepseek-ai/dsh-llm";
import { Context } from "@deepseek-ai/cordis";
//#region src/upstream.d.ts
type QoderRegion = 'cn' | 'global';
/** 上游错误分类，供 shim 映射为 DSH 可判定的 code。 */
type UpstreamErrorKind = 'network' | 'auth' | 'rate-limited' | 'invalid-request' | 'content-policy' | 'quota-exhausted' | 'transient' | 'unknown';
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
/** 某区域是否配置了凭据（设置 PAT 或环境变量其一）。 */
declare function regionHasCredential(config: {
  regions?: Record<string, unknown> | null;
}, region: QoderRegion): boolean;
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
  } | undefined;
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
declare function quotaRefreshOf(snapshot: Readonly<Record<string, {
  refreshAtMs?: number;
}>> | undefined, pat: string): {
  quotaRefreshAtMs?: number;
};
//#endregion
export { Config, PoolGate, QODER_CONNECT_VERSION, QODER_GITHUB_URL, apply, asVolatile, catalogSnapshotDeclaresEfforts, clearAnnouncedFailoversFrom, credentialOutcomeOf, failoverAnnounceKey, inject, liveQuotaExhaustion, liveRequestProbe, name, poolAllowsFailover, quotaRefreshOf, regionEnabled, regionHasCredential, regionStateOf, retryPolicyOf, serveSavedCatalog, settingsNamespaceOf, shouldAnnounceFailoverOnce, shouldRecordPoolFailure, unwrapVolatile, withHardTimeout };