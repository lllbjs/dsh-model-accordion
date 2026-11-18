window.__ModuleLoader__.load({
	id: "@dmh2002/dsh-connect-qoder",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		let react_dom = require("react-dom");
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
		/**
		* 创建 PAT 的逐步指南。挂在「添加 PAT」弹窗里而不是页脚：用户打开那个弹窗的
		* 时刻正是需要它的时刻，而页脚那条常驻提示已按用户要求删除。用仓库内的绝对
		* 地址（GitHub blob），因为 DSH 里没有内嵌文档路由可指。
		*/
		const QODER_PAT_DOC_URL = `${QODER_GITHUB_URL}/blob/main/docs/PAT.md`;
		/** Plugin-owned live model refresh endpoint. */
		const QODER_MODELS_REFRESH_PATH = "/plugins/dsh-connect-qoder/models/refresh";
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
		const QODER_REGIONS = ["cn", "global"];
		/**
		* Address one region's status route. The two regions are separate provider
		* stacks; every card request carries the region whose tab the user is on.
		*/
		function withQoderRegion(path, region) {
			return `${path}?${QODER_REGION_PARAM}=${region}`;
		}
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
		* Address one region's usage route asking for the first-paint document.
		*
		* Separate from {@link withQoderRegion} so that "this call only wants the
		* cheap document" is visible at the call site.
		*/
		function withQoderRegionFastDetail(path, region) {
			return `${withQoderRegion(path, region)}&${QODER_DETAIL_PARAM}=${QODER_DETAIL_FAST}`;
		}
		/** Query parameter selecting which action a request means. */
		const QODER_ACTION_PARAM = "action";
		/**
		* Address one region's endpoint for ANY route that dispatches on `action`.
		*
		* The accounts and transfer routes reject a request with no action (400), so
		* their callers must build the URL here rather than with
		* {@link withQoderRegion} — a request missing the parameter fails the same
		* way whether the omission was a mistake or not.
		*/
		function withQoderRouteAction(path, region, action) {
			return `${withQoderRegion(path, region)}&${QODER_ACTION_PARAM}=${action}`;
		}
		/**
		* `withQoderRouteAction` plus the id of the ONE account a per-row request
		* addresses.
		*
		* Kept separate from the plain action builder so that "this request acts on a
		* single row" is a property of the call site, not a value a caller can forget
		* to append — the row-level test button silently degrading into a whole-pool
		* batch is exactly the bug this exists to prevent.
		*/
		function withQoderRouteAccount(path, region, action, accountId) {
			return `${withQoderRouteAction(path, region, action)}&${QODER_POOL_ACCOUNT_PARAM}=${encodeURIComponent(accountId)}`;
		}
		/** Query parameter naming ONE pool account a per-row request addresses. */
		const QODER_POOL_ACCOUNT_PARAM = "accountId";
		/** Address one region's pool endpoint with an action. */
		function withQoderRegionAndAction(path, region, action) {
			return `${withQoderRegion(path, region)}&${QODER_ACTION_PARAM}=${action}`;
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
		(() => {
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
		* 该区域的**控制台域名**，用于「PAT 去哪弄」这句说明。
		*
		* 与 {@link knownQoderRegionOfDomain} 是同一组事实的两种读法（那边由域名反查
		* 区域，这边由区域正查域名），所以放在一起维护 —— 两处域名漂移过一次就很难
		* 被发现。
		*
		* 注意国内版是 `qoder.com.cn`（控制台在 `https://qoder.com.cn` → 设置 →
		* API 令牌），**不是** `api.qoder.com.cn`（那个返回 503）。国际版是 `qoder.com`
		* （不是网关用的 `qoder.sh`）—— 用户在浏览器里看到的是前者。
		*/
		const QODER_CONSOLE_DOMAIN = {
			cn: "qoder.com.cn",
			global: "qoder.com"
		};
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
		* Project one card row into its persisted `lastCatalog` entry.
		*
		* **写法照 `dsh-connect-workbuddy` 的 `toPersistedWorkBuddyModel`**：spread 整行
		* 再按名剔除卡片独有字段，**不逐个字段手写白名单**。这是同一处缺陷的第二次
		* 出诊 —— workbuddy 的注释写着「omitting it made one Save silently strip the
		* declaration from every model」：白名单只要漏一个字段，那次保存就把该字段从
		* 每个模型上抹掉，而且**没有任何东西会报错**。本仓库正是这样丢掉
		* `thinkingEfforts` / `defaultThinkingEffort` 的（用户实拍「每次保存都会思考
		* 强度不见了」）：卡片手写映射漏了这两个键，而读取端 `modelFromStored` 的判据是
		* `length > 0`、缺席的声明会被 schema 补成 `[]`，于是档位选择器整个消失。
		* 改成白名单只是把「漏」换了个位置，所以**必须**是 spread。
		*
		* 三处字段名在落盘时与卡片行不同，必须重命名（读取端 `modelFromStored` 只认
		* 落盘名）：`name → displayName`、`maxTokens → maxOutputTokens`、
		* `creditMultiplier → priceFactor`。**这三对名字必须与读取端逐字一致**，
		* 否则解析出 `undefined` → 回落默认值（`modelFromStored` 对
		* `maxOutputTokens` 默认 32 768，旧代码写的 `maxTokens` 因此从没被读到过）。
		*
		* 剔除的卡片独有键：
		* - `nativeContextWindow` —— 它的值已经装进 `contextWindow`（落盘存**原生**
		*   窗口，生效窗口由 `applyContextBudgets` 在读取时重新施加，见 issue 语境）。
		* - `maxTokens` / `name` / `creditMultiplier` —— 已重命名，原名不能带上去。
		*
		* **绝不写成 `undefined` 值**：显式 `undefined` 会挺过 `structuredClone`，被设置
		* 写入端那道严格 JSON codec 拒收（`client api: settings/mutate rejected "ops"`），
		* 整次保存失败。这里用解构剔除（真的没有这个键），而不是赋 `undefined`。可选键
		* 缺席时由 schema 的 `required(false)` 兜底，不需要在这里补默认值。
		*
		* `supportsImages` 是**覆盖**而非派生：卡片的待保存草稿持有用户尚未保存的勾选，
		* 而 model 上带的是上次保存过的值；从 model 派生会把用户刚勾的那一下在本次保存
		* 中抹掉。它是上游自己的声明（`is_vl`），随条目落盘、但运行时能力由独立的
		* `imageModelKeys` 盖印决定（同 workbuddy 的 `supportsImages` / `multimodal` 之分）。
		*/
		function toPersistedCatalogEntry(model, overrides = {}) {
			const { name, maxTokens, creditMultiplier, nativeContextWindow, thinkingEfforts, defaultThinkingEffort, contextTiers, supportsImages, ...rest } = model;
			return {
				...rest,
				displayName: name,
				maxOutputTokens: maxTokens,
				priceFactor: typeof creditMultiplier === "number" ? creditMultiplier : 1,
				contextWindow: nativeContextWindow,
				supportsImages: overrides.supportsImages ?? supportsImages === true,
				...thinkingEfforts === void 0 || thinkingEfforts.length === 0 ? {} : { thinkingEfforts: [...thinkingEfforts] },
				...defaultThinkingEffort === void 0 || defaultThinkingEffort === "" ? {} : { defaultThinkingEffort },
				...contextTiers === void 0 || contextTiers.length === 0 ? {} : { contextTiers: [...contextTiers] }
			};
		}
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
		* Narrow a settings value to the `regions` map. Accepts EITHER the whole
		* settings section (the Host's resolved `Config`) OR the `regions` map
		* itself, and unwraps the former. This tolerance is deliberate: passing the
		* whole section where the map was expected was a real shipped bug in the
		* sibling project — the lookup then read `section['cn']` (absent), so the
		* card's checkbox reported `true` forever.
		*/
		function regionsMapOf(value) {
			const unwrapped = unwrapVolatileDeep(value);
			if (typeof unwrapped !== "object" || unwrapped === null || Array.isArray(unwrapped)) return {};
			const record = unwrapped;
			const nested = record["regions"];
			if (typeof nested === "object" && nested !== null && !Array.isArray(nested)) return nested;
			return record;
		}
		/** One region's stored slot as a plain object; any other shape reads as empty. */
		function regionSlotOf$1(value, region) {
			const slot = regionsMapOf(value)[region];
			return typeof slot === "object" && slot !== null && !Array.isArray(slot) ? slot : {};
		}
		/**
		* Whether one region's provider is switched on. Opt-out semantics: only an
		* explicit `false` disables it, so a config written before this switch
		* existed keeps both providers running exactly as before. The Host reads the
		* same rule through `regionStateOf`, so card and Host can never disagree.
		*/
		function regionEnabledOf(value, region) {
			return regionSlotOf$1(value, region)["enabled"] !== false;
		}
		/** Build the next `regions` settings value replacing one region's slot. */
		function nextRegionSlots(regions, region, slot) {
			return {
				...typeof regions === "object" && regions !== null && !Array.isArray(regions) ? regions : {},
				[region]: slot
			};
		}
		/**
		* Build the next `regions` settings value for a MODEL-LIST save.
		*
		* The model save replaces part of a region slot, so the merge has to start
		* from the EXISTING slot: the pool's preferences and the PAT live in that
		* same slot, and a save that omitted them would delete settings the user
		* configured elsewhere in the card.
		*/
		function nextRegionModels(value, region, models) {
			return nextRegionSlots(regionsMapOf(value), region, {
				...regionSlotOf$1(value, region),
				...models
			});
		}
		/**
		* Build the next `regions` settings value for a POOL-PREFERENCES save.
		*
		* Same reasoning as {@link nextRegionModels}: the pool is one field of a slot
		* that also holds the model list, so the merge starts from the existing slot.
		*/
		function nextRegionPool(value, region, pool) {
			return nextRegionSlots(regionsMapOf(value), region, {
				...regionSlotOf$1(value, region),
				pool
			});
		}
		/** 界面上给的全部档位，升序。默认值不在这里 —— 见 {@link pollMinutesOf}。 */
		const QODER_POLL_MINUTES_OPTIONS = [
			1,
			5,
			10,
			30,
			60
		];
		/**
		* 读全局的刷新间隔。
		*
		* 与 `sidebarPanelEnabledOf` 同规：先 `unwrapVolatileDeep`（cosmokit 的活引用
		* 不解包时 `===` 恒假），再**白名单**校验 —— 配置是用户可编辑的 JSON，任何不在
		* 五档里的值（手改的 `0`、`"5"`、`2.5`）都退回默认，而不是把 `setInterval` 交给
		* 一个没校验过的数。
		*/
		function pollMinutesOf(value) {
			const unwrapped = unwrapVolatileDeep(value);
			const minutes = unwrapVolatileDeep(typeof unwrapped === "object" && unwrapped !== null && !Array.isArray(unwrapped) ? unwrapped["pollMinutes"] : void 0);
			return QODER_POLL_MINUTES_OPTIONS.includes(minutes) ? minutes : 5;
		}
		/**
		* Which seat one region's readout uses, defaulting to the composer tool row.
		*
		* 默认 `composer` 是刻意的：它是该设置存在之前**唯一**的席位，所以升级不会
		* 移动任何人屏幕上的东西。
		*/
		function regionCreditPositionOf(value, region) {
			return regionSlotOf$1(value, region)["creditPosition"] === "stats" ? "stats" : "composer";
		}
		/**
		* Whether one region's composer credit line is shown. Opt-out: only an
		* explicit `false` hides it.
		*/
		function regionCreditsShownOf(value, region) {
			return regionSlotOf$1(value, region)["showCreditsInMainUi"] !== false;
		}
		/**
		* 侧边栏面板这一行的**顶层**设置字段名（不在 `regions.<region>.` 下）。
		*
		* 参考：dsh-connect-workbuddy 的 `Config.sidebarPanel`（PR #188，MIT,
		* Copyright (c) 2026 LaoDing）。
		*
		* 与积分读数那几个开关不同，这一项**没有区域轴**：侧边栏只有一条 Qoder 行、
		* 一个整页，不随「国内版 / 国际版」变。所以它住在配置顶层，而不是每个区域槽
		* 各存一份——存两份就会出现「cn 开着、global 关着，那这一行到底算谁的」这种
		* 没有答案的状态。
		*/
		const QODER_SIDEBAR_PANEL_FIELD = "sidebarPanel";
		/** The top-level settings field carrying the global upstream-refresh interval. */
		const QODER_POLL_MINUTES_FIELD = "pollMinutes";
		/**
		* 侧边栏那一行与它打开的整页共用的 id。
		*
		* `sidebar.panellist` 的 `id` 与 `main` 的 `key` **必须相同**：侧边栏按钮
		* 点下去是「选中 id 等于自己的中央面板」（`ui-layout` 的 `panelId` 按 key
		* 派发），两者对不上就只是一个点了没反应的按钮。
		*/
		const QODER_SIDEBAR_PANEL_ID = "dsh-connect-qoder";
		/**
		* 是否在 DSH 侧边栏加一个 Qoder 面板行（+ 对应的整页）。
		*
		* **默认关闭**，且判据是 `=== true` 而不是 `!== false`：这一行占的是
		* `sidebar.panellist` 这个**所有插件共用的全局座位**，点开还会接管中央面板。
		* 打开它是对用户整个侧边栏的决定，不是对这张卡片的偏好——所以「没写过」
		* 必须读成「没要」，升级不能替用户重新排一次侧边栏。
		*
		* 参考 workbuddy 的 `unwrapVolatile(current().sidebarPanel) === true`（同一条
		* 理由）；Qoder 这边的字段同样声明成 volatile（见 `src/index.ts` 的
		* `Config`），所以这里先解包再判。
		*/
		function sidebarPanelEnabledOf(value) {
			const unwrapped = unwrapVolatileDeep(value);
			return unwrapVolatileDeep(typeof unwrapped === "object" && unwrapped !== null && !Array.isArray(unwrapped) ? unwrapped[QODER_SIDEBAR_PANEL_FIELD] : void 0) === true;
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
		/**
		* Every namespace spelling the browser half follows when looking for the
		* settings form the host actually serves, in preference order.
		*
		* `describe()` keys a form by its Loader ENTRY ID, and the profile patch picks
		* that id — so the plugin must ASK rather than assume. The observed spellings
		* are the bare entry id and the `include:`-wrapped id (the sibling workbuddy
		* plugin records that the live Desktop host mounts it that way), with the
		* declared name as the last resort.
		*
		* ⚠️ **这份表是 `whileServed` 的监视对象，不只是「匹配时的候选」**：宿主只在
		* **被监视的命名空间之一**到货时才触发 register 边缘。少一种拼写 ⇒ 宿主若正好
		* 用那种拼写挂载，边缘**永不触发**，于是回调里那条 `/qoder/i` 兜底成了死代码，
		* 卡片永远停在只读降级上（用户看得见卡片、却存不了设置，且无任何报错）。
		*
		* Lives here, not in the host entry, because the browser half needs the same
		* list and must not import node-only host code.
		*/
		const QODER_SETTINGS_NAMESPACE_CANDIDATES = [
			QODER_SETTINGS_NS,
			`include:${QODER_SETTINGS_NS}`,
			"qoder"
		];
		//#endregion
		//#region src/client/account-selection.ts
		/**
		* Verified writes of the per-region account / settings slots.
		*
		* 参考：dingminhua/dsh-connect-workbuddy（MIT，Copyright (c) 2026 LaoDing）
		*   — 写入后回读并与写入值比对的验证形态、Host 端点优先再回填浏览器镜像的顺序、
		*     file-contention 诊断，均沿用自该项目的 `account-selection.ts`。
		*
		* Qoder 差异（按 `src/index.ts` 的 settings 契约）：
		*   1. 账号选择不在顶层 `accounts` 字段，而是 `regions.<region>.accountId`（'' =
		*      自动：settings → env → vault）；PAT 凭据由 Host 的 vault 保存。所以本模块
		*      只写 `regions` 这一字段，每个写入都带整个区域槽。
		*   2. `__save` 端点只接受 `field: 'regions'`（Host 侧 `mutateField` 做两层合并），
		*      因此这里没有 workbuddy 的 `'accounts'` 分支。
		*
		* Kept out of `QoderCard.tsx` — and free of any browser-only import — so the
		* write contract stays unit-testable without a DOM.
		*
		* @module dsh-connect-qoder/client/account-selection
		*/
		/** A settings write that did not take effect. */
		var QoderSettingsWriteError = class extends Error {
			/** The settings field that did not land. */
			field;
			constructor(field, reason) {
				super(`qoder: settings field "${field}" was not persisted by the settings write${reason === void 0 ? "" : `: ${reason}`}`);
				this.name = "QoderSettingsWriteError";
				this.field = field;
			}
		};
		/**
		* Whether a save failure is a FILE-CONTENTION refusal.
		*/
		function isFileContentionWriteError(error) {
			const message = error instanceof Error ? error.message : String(error);
			return /\b(?:EPERM|EBUSY|EACCES)\b/u.test(message);
		}
		/**
		* Read one settings field's current object value from the scope snapshot
		* (a volatile `regions` field is a `{get()}` live reference — unwrap first).
		*/
		function fieldSnapshotOf(scope, field) {
			const value = unwrapVolatileDeep(scope.getSnapshot().value?.[field]);
			return typeof value === "object" && value !== null ? value : {};
		}
		/**
		* Fallback write: POST `${field: 'regions', value: { [region]: slot }}` to the
		* plugin's own Host endpoint. The host's `mutateField` merges the posted region
		* into the authoritative value, preserving the sibling region and slot fields.
		*/
		async function saveViaHostEndpoint(field, region, value) {
			let response;
			try {
				response = await fetch(QODER_SAVE_PATH, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					credentials: "same-origin",
					body: JSON.stringify({
						field,
						value: { [region]: value }
					})
				});
			} catch (error) {
				throw new QoderSettingsWriteError(field, `Host save endpoint unreachable: ${String(error)}`);
			}
			if (!response.ok) {
				const detail = await response.json().catch(() => ({ error: `HTTP ${String(response.status)}` }));
				const reason = `${String(detail.errorName ?? "")} ${String(detail.error ?? "")}`.trim();
				throw new QoderSettingsWriteError(field, `Host save refused: ${reason === "" ? String(detail.error) : reason}`);
			}
		}
		/**
		* 把一个**顶层**字段写到宿主的保存端点（没有区域轴，所以 body 直接是那个值）。
		*
		* `regions` 走 `{ [region]: value }`，因为它是按区域槽位合并的；顶层标量
		* （`sidebarPanel`）没有兄弟槽要保护，整份就是它自己的新值 —— 与 workbuddy
		* 的 `__save` 对顶层开关的处理一致（`region === undefined` 时 body 直接是值）。
		*/
		async function saveTopLevelViaHostEndpoint(field, value) {
			let response;
			try {
				response = await fetch(QODER_SAVE_PATH, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					credentials: "same-origin",
					body: JSON.stringify({
						field,
						value
					})
				});
			} catch (error) {
				throw new QoderSettingsWriteError(field, `Host save endpoint unreachable: ${String(error)}`);
			}
			if (!response.ok) {
				const detail = await response.json().catch(() => ({ error: `HTTP ${String(response.status)}` }));
				const reason = `${String(detail.errorName ?? "")} ${String(detail.error ?? "")}`.trim();
				throw new QoderSettingsWriteError(field, `Host save refused: ${reason === "" ? String(detail.error) : reason}`);
			}
			return (await response.json().catch(() => void 0))?.value;
		}
		/**
		* 写侧：全局的自动刷新间隔（分钟）。
		*
		* 与 {@link writeSidebarPanelEnabled} 逐字同形的顶层标量写入：宿主保存端点优先
		* （权威合并、自己报告拒绝），settings 作用域次之。落地校验读的是**解包后**的值
		* 与目标相等 —— 这个字段是枚举，写进去一个不在五档里的值等于没写。
		*
		* @throws {QoderSettingsWriteError} 两个写者都没能持久化时。
		*/
		async function writePollMinutes(scope, minutes) {
			const field = QODER_POLL_MINUTES_FIELD;
			let hostError;
			try {
				const authoritative = await saveTopLevelViaHostEndpoint(field, minutes);
				if (authoritative !== void 0) try {
					await scope.set(field, authoritative[field]);
				} catch {}
				return;
			} catch (error) {
				hostError = error;
			}
			let delivered = false;
			try {
				delivered = await scope.set(field, minutes) !== false;
			} catch {
				delivered = false;
			}
			if (delivered && pollMinutesOf(scope.getSnapshot().value) === minutes) return;
			throw hostError instanceof Error ? hostError : new QoderSettingsWriteError(field, "neither the Host save endpoint nor the settings scope persisted the value");
		}
		/**
		* 写侧：打开 / 关闭侧边栏面板，并验证它真的落地了。
		*
		* 写者顺序与 {@link writeField} 相同、理由也相同：宿主端点优先（它是权威合并，
		* 且自己会报告拒绝），settings 作用域次之（这个命名空间的浏览器镜像在受影响的
		* 0.1.7 部署上被记录为陈旧 —— 一行「看起来在、Host 却不这么认为」的侧边栏
		* 比没有这一行更糟）。
		*
		* 这是一个顶层标量，所以写在自己那条路径上；字段里没有兄弟状态要保留。
		*
		* @throws {QoderSettingsWriteError} 两个写者都没能持久化时。
		*/
		async function writeSidebarPanelEnabled(scope, enabled) {
			const field = QODER_SIDEBAR_PANEL_FIELD;
			let hostError;
			try {
				const authoritative = await saveTopLevelViaHostEndpoint(field, enabled);
				if (authoritative !== void 0) try {
					await scope.set(field, authoritative[field]);
				} catch {}
				return;
			} catch (error) {
				hostError = error;
			}
			let delivered = false;
			try {
				delivered = await scope.set(field, enabled) !== false;
			} catch {
				delivered = false;
			}
			if (delivered && sidebarPanelEnabledOf(scope.getSnapshot().value)) return;
			throw hostError instanceof Error ? hostError : new QoderSettingsWriteError(field, "neither the Host save endpoint nor the settings scope persisted the value");
		}
		/**
		* Write one volatile field, then confirm the value actually landed.
		*
		* The Host endpoint goes FIRST — it is the only writer that cannot delete a
		* sibling region. `scope.set` is then attempted purely to refresh the mirror,
		* and only when it alone both delivers AND lands is the write considered done
		* without the endpoint.
		*
		* @throws {QoderSettingsWriteError} when neither path persists the value.
		*/
		async function writeField(scope, field, region, value, landed) {
			let hostError;
			try {
				await saveViaHostEndpoint(field, region, value);
				return;
			} catch (error) {
				hostError = error;
			}
			let scopeDelivered = false;
			try {
				scopeDelivered = await scope.set(field, {
					...fieldSnapshotOf(scope, field),
					[region]: value
				}) !== false;
			} catch {
				scopeDelivered = false;
			}
			if (scopeDelivered && landed(fieldSnapshotOf(scope, field)[region])) return;
			throw hostError instanceof Error ? hostError : new QoderSettingsWriteError(field, "neither the Host save endpoint nor the settings scope persisted the value");
		}
		/**
		* Write one region's account selection, then confirm it actually landed.
		*
		* `accountId` of `''` means auto (settings → env → vault). Verification is
		* exact, because `undefined` (slot absent) and `''` (slot cleared) are different
		* states with different meanings, and only the second is a successful clear.
		*/
		async function writeAccountSlot(scope, region, value) {
			await writeField(scope, "regions", region, {
				...regionSlotOf(scope.getSnapshot().value, region),
				accountId: value
			}, (readBack) => readBack?.["accountId"] === value);
		}
		/**
		* Write one region's saved model state, then confirm it actually landed.
		*/
		async function writeRegionModels(scope, region, payload) {
			const next = nextRegionModels(scope.getSnapshot().value, region, payload)[region];
			const written = payload.lastCatalog.map((model) => model.key);
			await writeField(scope, "regions", region, next, (readBack) => {
				const stored = readBack?.lastCatalog?.map((model) => model.key);
				return stored !== void 0 && stored.length === written.length && stored.every((key, index) => key === written[index]);
			});
		}
		/**
		* Switch one region's provider off or on, with the same landed-check.
		*/
		async function writeRegionEnabled(scope, region, enabled, slot) {
			await writeField(scope, "regions", region, slot, (readBack) => {
				const stored = readBack;
				return stored !== null && stored !== void 0 && stored["enabled"] === enabled;
			});
		}
		/**
		* Show or hide one region's composer credit line, with the same landed-check.
		*/
		async function writeRegionCreditsShown(scope, region, shown, slot) {
			await writeField(scope, "regions", region, slot, (readBack) => {
				const stored = readBack;
				return stored !== null && stored !== void 0 && stored["showCreditsInMainUi"] === shown;
			});
		}
		/**
		* Write one region's campaign-feed switch, with the same landed-check.
		*
		* Same shape as {@link writeRegionCreditsShown}: both are per-region content
		* switches written as a whole region slot, so a sibling region is never
		* dropped. The landed-check matters for the measured reason that switch
		* documents: the settings mirror can silently drop a write, and a checkbox that
		* keeps showing the old value is worse than one that reports failure.
		*/
		async function writeRegionCampaignsShown(scope, region, shown, slot) {
			await writeField(scope, "regions", region, slot, (readBack) => {
				const stored = readBack;
				return stored !== null && stored !== void 0 && stored["showCampaigns"] === shown;
			});
		}
		/**
		* Write one region's credit-readout SEAT, with the same landed-check.
		*
		* The read-back check matters for the same measured reason it does for the
		* switch: the settings mirror can silently drop a write, and a control that
		* keeps showing the old seat is worse than one that reports failure.
		*/
		async function writeRegionCreditPosition(scope, region, position, slot) {
			await writeField(scope, "regions", region, slot, (readBack) => {
				const stored = readBack;
				return stored !== null && stored !== void 0 && stored["creditPosition"] === position;
			});
		}
		/**
		* Write one region's account-pool PREFERENCES, verifying they landed.
		*/
		async function writePoolPreferences(scope, region, preferences) {
			const orderAccountIds = preferences.orderAccountIds ?? [];
			const autoCheckin = preferences.autoCheckin === true;
			const slot = {
				enabled: preferences.enabled,
				targetModelId: preferences.targetModelId,
				memberAccountIds: preferences.memberAccountIds,
				orderAccountIds,
				autoCheckin
			};
			if (preferences.probeInputTokens !== void 0) slot["probeInputTokens"] = preferences.probeInputTokens;
			const next = nextRegionPool(scope.getSnapshot().value, region, slot)[region];
			await writeField(scope, "regions", region, next, (readBack) => {
				const pool = readBack?.pool;
				if (pool === void 0 || pool === null) return false;
				if (pool["enabled"] !== preferences.enabled || pool["targetModelId"] !== preferences.targetModelId) return false;
				const wantedTokens = preferences.probeInputTokens ?? 0;
				if ((pool["probeInputTokens"] ?? 0) !== wantedTokens) return false;
				const stored = pool["memberAccountIds"];
				if (!Array.isArray(stored) || stored.length !== preferences.memberAccountIds.length) return false;
				const wanted = new Set(preferences.memberAccountIds);
				if (!stored.every((id) => typeof id === "string" && wanted.has(id))) return false;
				const storedOrder = pool["orderAccountIds"];
				if (!Array.isArray(storedOrder) || storedOrder.length !== orderAccountIds.length) return false;
				if (!storedOrder.every((id, index) => id === orderAccountIds[index])) return false;
				return pool["autoCheckin"] === true === autoCheckin;
			});
		}
		/** One region's stored slot as a plain object (node-free source of truth). */
		function regionSlotOf(value, region) {
			const unwrapped = unwrapVolatileDeep(value);
			const regions = typeof unwrapped === "object" && unwrapped !== null && !Array.isArray(unwrapped) ? unwrapped["regions"] : void 0;
			const slot = (typeof regions === "object" && regions !== null && !Array.isArray(regions) ? regions : {})[region];
			return typeof slot === "object" && slot !== null && !Array.isArray(slot) ? slot : {};
		}
		//#endregion
		//#region src/client/panel-switch.ts
		/**
		* 可选侧边栏面板的开关，在浏览器半边怎么存、怎么通知注册控制器。
		*
		* 参考：dingminhua/dsh-connect-workbuddy 的 `client/panel-switch.ts`（PR #188，
		* MIT，Copyright (c) 2026 LaoDing）——模块级小 store + 订阅的形态逐字沿用。
		*
		* ## 为什么是模块级 store，而不是组件状态
		*
		* `sidebar.panellist` 那一行是由**注册元数据**渲染的，不是由组件自己决定：
		* `ui-sidebar` 的 `SidebarRoot` 把 `usePanels(...)`（插槽的 entries）映射成
		* `PanelRow` 按钮 —— 标签来自 `options.label`、图标来自 `renderSlot(...)`。
		* 因此一个 `return null` 的组件**不会**让那一行消失：它留下的是一个空白但
		* 仍可点击的导航按钮。
		*
		* 这正是本插件**不能**照搬 `ComposerCreditsGate` 那种「渲染时决定」的原因：
		* 那个席位渲染的是一个组件列表，`null` 就是「不存在」；这一行是元数据。
		* 所以行只能在开关打开时**注册**，关掉时**注销**。
		*
		* 按条件注册又要求有人负责「设置变了就重注册」——那个人在入口（`apply`）里，
		* 不在组件里。本模块就是两者的接缝：卡片在**确认写入落地之后**把值写进这里，
		* 入口订阅它、按需注册或注销。
		*
		* ## 为什么用 Host 的答案做种子
		*
		* 值由 Host 在状态文档里下发（`sidebarPanelEnabled`），理由与本插件每个其它
		* 开关相同：这个命名空间的浏览器镜像在受影响的 0.1.7 部署上被记录为「陈旧」。
		* 只在启动时读 settings 作用域，会让一个陈旧的 `false` 藏起 Host 认为正在
		* 服务的行 —— 而之后**没有任何事件**去纠正它，因为 `whileServed` 只在命名空间
		* 边缘触发，不在值变化时触发。
		*
		* 页面开着时把面板关掉不需要特殊处理：`ui-layout` 的 `retainMainPanels` 会丢掉
		* 一个 `main` key 已不存在的 `activePanelId`，中央那一列自己回到对话。
		*/
		/** 等待开关变化的监听者。 */
		const listeners = /* @__PURE__ */ new Set();
		/**
		* 当前答案，默认**关闭**。
		*
		* 关闭正是这个开关的全部意义：缺席或读不出来的值绝不能把这一行打开。
		* 见 `src/index.ts` 的 `Config.sidebarPanel`。
		*/
		let wanted = false;
		/** 侧边栏面板此刻是否应该被注册。 */
		function sidebarPanelWanted() {
			return wanted;
		}
		/**
		* 设置开关状态并通知注册控制器。
		*
		* 幂等：控制器每次都会重新注册，而 settings 订阅完全可能把同一个值报告两次。
		* 无法判断值是否真的变了的调用方不必先比较。
		*
		* @param next - 期望状态。
		*/
		function setSidebarPanelWanted(next) {
			if (wanted === next) return;
			wanted = next;
			for (const listener of [...listeners]) try {
				listener();
			} catch {}
		}
		/**
		* 观察开关状态的变化。
		*
		* @param listener - 每次变化后调用。
		* @returns 移除该监听者的 disposer。
		*/
		function subscribeSidebarPanelWanted(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		}
		//#endregion
		//#region src/client/remaining.ts
		const MINUTE_MS$1 = 6e4;
		const HOUR_MS$1 = 60 * MINUTE_MS$1;
		const DAY_MS$1 = 24 * HOUR_MS$1;
		/**
		* How far out hours stop being the useful unit.
		*
		* Below this, hours; at or above it, days. The cut is at TWO days rather than
		* one so that 30 hours reads as "约 30 小时后" instead of rounding to "约 1 天后",
		* which would understate it by six hours.
		*/
		const DAYS_AT_MS = 2 * DAY_MS$1;
		/**
		* A short "约 N 分钟后 / 约 N 小时后 / 约 N 天后", or `''` once the moment passed.
		*
		* The empty string is the contract callers depend on: an elapsed cooldown means
		* the account is already back, so appending "in 0 minutes" would assert the
		* opposite of the state the card is showing. Callers append this only when it is
		* non-empty.
		*/
		function remainingText(t, untilMs, nowMs) {
			const left = untilMs - nowMs;
			if (left <= 0) return "";
			if (left < MINUTE_MS$1) return t("row.remainingImminent");
			if (left < HOUR_MS$1) return t("row.remainingMinutes", { count: Math.round(left / MINUTE_MS$1) });
			if (left < DAYS_AT_MS) return t("row.remainingHours", { count: Math.round(left / HOUR_MS$1) });
			return t("row.remainingDays", { count: Math.round(left / DAY_MS$1) });
		}
		/**
		* An exact `HH:MM:SS` countdown to a stated instant, or `''` once it has passed.
		*
		* 与 {@link remainingText} 的分工：那个回答「还要等多久」（约 N 小时后，适合冷却
		* 回池这类不需要盯着看的场景），这个回答「精确到秒」（适合每日签到刷新 —— 用户要
		* 知道自己得等多久才能点下一次，看到「约 1 天后」没有用）。
		*
		* **同样只用于上游给出的时刻**：每日签到的这一窗什么时候开是上游活动行的 `endAt`
		* （实测当天 10:00 → 次日 09:59 UTC+8），这里只换一种写法，不发明新的时间来源。
		* 上游没给（`untilMs === undefined`）就没有倒计时，调用方也不许自己补一个。
		*
		* 秒级向上取整：剩 1 秒时显示 `00:00:01` 而不是 `00:00:00`（后者读起来像「已经到
		* 时间了」，而那一秒其实还在倒计时里）。到点之后一律 `''`。
		*/
		function countdownText(untilMs, nowMs) {
			if (untilMs === void 0) return "";
			const left = Math.ceil((untilMs - nowMs) / 1e3);
			if (left <= 0) return "";
			const hours = Math.floor(left / 3600);
			const minutes = Math.floor(left % 3600 / 60);
			const seconds = left % 60;
			const pad = (value) => String(value).padStart(2, "0");
			return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
		}
		//#endregion
		//#region src/client/exclusion-text.ts
		/** The exclusion label for one account, or undefined when it is usable. */
		function exclusionText(t, excludedBy, retryAtMs, nowMs = Date.now(), retrySource) {
			const label = exclusionLabel(t, excludedBy);
			if (label === void 0) return void 0;
			const remaining = retryAtMs === void 0 ? "" : remainingText(t, retryAtMs, nowMs);
			if (remaining === "") return retrySource === "unknown-cooldown" ? `${label} · ${t("row.poolRetryUnknown")} · ${t("row.poolRetryFallback")}` : label;
			return `${label} · ${t(retrySource === "quota-refresh" ? "row.unlockSuffixWindow" : "row.unlockSuffix", { when: remaining })}`;
		}
		/** 排除原因的固定短标签（不含时间）。 */
		function exclusionLabel(t, excludedBy) {
			switch (excludedBy) {
				case "rate-limited": return t("row.poolExcludedRateLimited");
				case "out-of-credit": return t("row.poolExcludedOutOfCredit");
				case "credential-rejected": return t("row.poolExcludedRejected");
				case "queued": return t("row.poolExcludedQueued");
				case "not-found": return t("row.probeNotFound");
				case "unavailable": return t("row.probeUnavailable");
				case "failed": return t("row.probeFailed");
				case "unusable": return t("row.poolExcludedUnusable");
				default: return;
			}
		}
		/**
		* 某一时刻在指定时区里的当天分钟数。
		*
		* 只用来把「上游声明的墙钟时间」和「此刻」放到同一个坐标系里。时区名读不懂时
		* 返回 `undefined`，由调用方决定回落——**不静默退回浏览器本地时间**：那会让
		* 一个跨零点窗口在别的时区悄悄错位 8 小时。
		*
		* `hourCycle: 'h23'` 是刻意的：部分引擎在 `hour12: false` 下会把午夜报成 24，
		* 那会让「22:00–08:00」在 00:00 判定失败。
		*/
		function zonedClock(now, timeZone) {
			let parts;
			try {
				parts = new Intl.DateTimeFormat("en-US", {
					timeZone,
					hourCycle: "h23",
					hour: "2-digit",
					minute: "2-digit"
				}).formatToParts(now);
			} catch {
				return;
			}
			const read = (type) => parts.find((part) => part.type === type)?.value;
			const hour = Number(read("hour"));
			const minute = Number(read("minute"));
			if (!Number.isFinite(hour) || !Number.isFinite(minute)) return void 0;
			return { minutes: hour % 24 * 60 + minute };
		}
		/**
		* 此刻是否落在该规则的时段内。
		*
		* 语义与 Qoder 自己的描述一致（「10 PM-8 AM UTC+8」）：
		* - **起点含、终点不含**：22:00 已生效，08:00 已失效；`22:00–24:00` 覆盖到当天结束。
		* - **跨零点**：`start > end` 时命中区间是 `[start, 24:00) ∪ [0, end)`。
		* - `start === end` 视为**全天**：上游写「22:00–22:00」只可能是这个意思（与
		*   Trae 那边 `start===end` 的取舍一致）。
		* - **读不懂的时区一律返回 `false`**：judge 不了就不画。退回浏览器时区会让一个
		*   跨零点窗口在别的时区错位几小时，比不画更糟。
		* - 没有窗口声明时返回 `true`——这一支只由 `promoLiveAt` 在「确实没声明」时走到。
		*/
		function promoWithinWindow(promo, now) {
			const window = promo.window;
			if (window === void 0) return true;
			const clock = zonedClock(now, promo.timeZone ?? "Asia/Shanghai");
			if (clock === void 0) return false;
			const { startMinute, endMinute } = window;
			if (startMinute === endMinute) return true;
			if (startMinute < endMinute) return clock.minutes >= startMinute && clock.minutes < endMinute;
			return clock.minutes >= startMinute || clock.minutes < endMinute;
		}
		function promoDisplayAt(promo, now) {
			if (promo === void 0) return "none";
			if (promo.windowUnreadable === true) return "none";
			if (promo.window === void 0) return promo.active ? "live" : "none";
			return promoWithinWindow(promo, now) ? "live" : "pending";
		}
		/**
		* 某一时刻 UI 该显示的积分倍率 = 基准价 × 当前生效活动的折扣系数。
		*
		* **只是显示。** 计费由 Qoder 服务端按请求结算，pi-ai 请求体、目标模型 id、
		* `creditMultiplier` 的「免费即 0」判据、落盘的 `priceFactor` 全部仍走基准价，
		* 这里碰都不会碰（issue #41 的建议就是加一个「显示倍率」字段仅用于 UI）。
		*
		* 为什么不把结果存成目录字段：折扣随窗口开关，是个渲染时刻的纯函数；一旦
		* 写进 `lastCatalog`，夜里读到的一份就会冻结到第二天早上——这与 §3.2「判定
		* 必须在渲染时刻」是同一条理由。所以这里现算，卡片/选择器各自用自己的时钟。
		*
		* 采信一条折扣的前提（任何一条不满足就**原样退回基准价**，宁可少显示也不说错话）：
		* - 此刻 `promoDisplayAt === 'live'`（有窗口按窗口，没窗口才看 `active`）；
		* - 上游给了可信的 `discountFactor`（有限数，且 `0 ≤ x ≤ 1`——0 = 免费，1 = 不打折）；
		* - 算出的结果必须有限且非负，按两位小数归一（消除 `0.5 × 0.4 = 0.20000000000000001`）。
		*
		* `before_promotion_price_factor` **不**用来校验：限时免费这类活动里它可能与目录里的
		* `price_factor` 对不上，拿它当门恰好会压掉 issue #41 要修的 `x0.00`。基准价永远取
		* 目录当前值（`source.priceFactor`），而不是折前快照。
		*
		* @param source - 基准价与该模型的活动规则（缺席即无活动）。
		* @param now - 判定用的时刻（渲染时刻现给的 `new Date()`）。
		*/
		function displayMultiplierOf(source, now) {
			const base = source.priceFactor;
			const promo = source.promotion;
			if (promo === void 0 || promoDisplayAt(promo, now) !== "live") return base;
			const factor = promo.discountFactor;
			if (factor === void 0 || !Number.isFinite(factor) || factor < 0 || factor > 1) return base;
			const result = Math.round(base * factor * 100) / 100;
			return Number.isFinite(result) && result >= 0 ? result : base;
		}
		//#endregion
		//#region src/client/account-state.ts
		/**
		* 一个账号的状态色语义：能用绿、不能用红。
		*
		* 纯函数，只吃「此刻是否被排除」。`probeOutcome` 作为**兼容入参**保留：排除
		* 判定（`exclusionOf`）已经由探针结论推导过一遍，这里再判一次只会在边界上
		* 又分叉出第三种颜色。
		*/
		function accountStateTone(input) {
			return input.excludedBy === void 0 ? "ok" : "bad";
		}
		/** CSS 颜色（两处表格共用同一组令牌，避免出现两种绿）。 */
		function accountStateColor(tone) {
			switch (tone) {
				case "ok": return "var(--dsw-alias-state-success-primary, #22a06b)";
				case "warn": return "var(--dsw-alias-state-warn-primary, #f59e0b)";
				case "bad": return "var(--dsw-alias-state-error-primary, #ef4444)";
				case "unknown": return "var(--dsw-alias-label-dimmed, #9aa0a6)";
			}
		}
		/**
		* 行状态点用色（两处表格的行循环都调它）。
		*
		* `current` **不影响颜色**：能用的一律绿，不能用的一律红 —— 包括池关时仍在
		* 发号、但额度已经用尽的选中号。给它绿点就是「当前使用 + 用量已达上限」这
		* 个自相矛盾的老 bug（用户实拍，2026-10-18）复活。「当前选用」改由第二行
		* 文字说明，不占用颜色。
		*
		* 保留这个包装（而不是让调用方直接用 `accountStateTone`）是为了让「行上的
		* 点在用与否」仍然是一个显式入参，将来若再引入第三种状态不必改两个调用方。
		*/
		function accountDotTone(input) {
			return accountStateTone(input);
		}
		//#endregion
		//#region src/client/BusyOverlay.tsx
		/**
		* The shared busy veil's spinner: an arc that breathes while it turns.
		*
		* Deliberately the host's own state-spinner shape (dsh's `_dsh-state-dot-spin`)
		* rather than a border-ring: a two-tone CSS ring at .7s read as a loading
		* indicator from another decade and was out of step with every spinner in the
		* shell. The motion lives in CSS (`dsm-qoder-veil-spin` / `-dash`), so this
		* element only describes the geometry; `currentColor` lets it inherit whatever
		* tier it sits in.
		*
		* `aria-hidden` because the veil's `role="status"` already announces the
		* message — a second announcement from a decorative arc is noise.
		*
		* 对齐：dingminhua/dsh-connect-workbuddy 的 VeilSpinner（MIT，LaoDing）。类名换
		*   `dsm-qoder-*`，几何与节奏（20px / 1.5s / dash 呼吸 / currentColor）逐条沿用。
		*/
		function VeilSpinner() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				className: "dsm-qoder-veil-spinner",
				viewBox: "0 0 20 20",
				"aria-hidden": "true",
				focusable: "false",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
					className: "dsm-qoder-veil-spinner-track",
					cx: "10",
					cy: "10",
					r: "8",
					fill: "none",
					stroke: "currentColor",
					strokeWidth: "2"
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
					className: "dsm-qoder-veil-spinner-arc",
					cx: "10",
					cy: "10",
					r: "8",
					fill: "none",
					stroke: "currentColor",
					strokeWidth: "2",
					strokeLinecap: "round"
				})]
			});
		}
		/**
		* The veil. Deliberately NOT a modal dialog: it carries no focusable control
		* and no dismissal — there is nothing for the user to decide, only a step to
		* wait through.
		*/
		function BusyOverlay({ message, hint, visible }) {
			if (!visible) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dsm-qoder-veil",
				role: "status",
				"aria-busy": "true",
				"aria-live": "polite",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dsm-qoder-veil-card",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(VeilSpinner, {}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dsm-qoder-veil-text",
							children: message
						}),
						hint === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dsm-qoder-veil-hint",
							children: hint
						})
					]
				})
			});
		}
		//#endregion
		//#region src/client/probe-reason.ts
		/**
		* Outcomes whose label + stated recovery time ARE the whole story.
		*
		* Both carry a reset instant, which the row prints right beside them; their
		* bodies restate that instant and add a `code`/`requestId` pair nobody reads.
		*
		* `credential-rejected` and `not-found` are deliberately NOT here: their labels
		* state a conclusion, and the upstream's own words are what make that conclusion
		* checkable rather than asserted.
		*/
		const SELF_EXPLANATORY = /* @__PURE__ */ new Set([
			"rate-limited",
			"out-of-credit",
			"queued"
		]);
		/** Longest inline reason kept. */
		const REASON_LIMIT = 72;
		/** The inline reason for one measurement, or `undefined` when it adds nothing. */
		function inlineProbeReason(outcome, message) {
			if (message === void 0 || message === "") return void 0;
			if (SELF_EXPLANATORY.has(outcome)) return void 0;
			const text = (humanSentenceOf(message) ?? stripTransportPrefix(message)).trim();
			return text === "" ? void 0 : truncate(text);
		}
		function truncate(text) {
			return text.length <= REASON_LIMIT ? text : `${text.slice(0, 71)}…`;
		}
		/** `{"code":6004,"msg":"…","requestId":"…"}` → the `msg` sentence, if it has one. */
		function humanSentenceOf(message) {
			if (!message.startsWith("{")) return void 0;
			let parsed;
			try {
				parsed = JSON.parse(message);
			} catch {
				return;
			}
			if (typeof parsed !== "object" || parsed === null) return void 0;
			const msg = parsed["msg"];
			return typeof msg === "string" && msg !== "" ? msg : void 0;
		}
		/** `transport error: TimeoutError: …` → `TimeoutError: …`. */
		function stripTransportPrefix(message) {
			return message.replace(/^transport error:\s*/u, "");
		}
		//#endregion
		//#region src/client/probe-label.ts
		/** 恢复时刻的本地化显示（日期 + 时间，24 小时制）。 */
		function formatProbeMoment(atMs) {
			return new Intl.DateTimeFormat(void 0, {
				month: "2-digit",
				day: "2-digit",
				hour: "2-digit",
				minute: "2-digit",
				hourCycle: "h23"
			}).format(new Date(atMs));
		}
		/** 「何时恢复」的相对后缀（` · 约 1 小时后`），无时刻或已过期时为空串。 */
		function retrySuffix(t, untilMs, nowMs) {
			if (untilMs === void 0) return "";
			const remaining = remainingText(t, untilMs, nowMs);
			return remaining === "" ? "" : ` · ${remaining}`;
		}
		/** 一位小数的秒数（`1.5s`）。 */
		function secondsOf(ms) {
			return `${(ms / 1e3).toFixed(1)}s`;
		}
		/** 一条探针结果的文字与色调。两个调用方都必须走这里。 */
		function probeResultView(result, t, nowMs = Date.now()) {
			switch (result.outcome) {
				case "ok": return {
					text: result.elapsedMs === void 0 ? t("row.probeOk") : t("row.probeOkMs", { ms: secondsOf(result.elapsedMs) }),
					tone: "ok"
				};
				case "rate-limited": return {
					text: result.retryAtMs === void 0 ? t("row.probeRateLimitedUnknown") : t("row.probeRateLimitedAt", { at: formatProbeMoment(result.retryAtMs) }) + retrySuffix(t, result.retryAtMs, nowMs),
					tone: "warn"
				};
				case "out-of-credit": return {
					text: result.retryAtMs === void 0 ? t("row.probeOutOfCreditUnknown") : t("row.probeOutOfCreditAt", { at: formatProbeMoment(result.retryAtMs) }) + retrySuffix(t, result.retryAtMs, nowMs),
					tone: "bad"
				};
				case "credential-rejected": return {
					text: t("row.probeCredentialRejected"),
					tone: "bad"
				};
				case "policy-rejected": return {
					text: t("row.probePolicyRejected"),
					tone: "bad"
				};
				case "not-found": return {
					text: t("row.probeNotFound"),
					tone: "bad"
				};
				case "queued": {
					const queue = result.queue?.queueCount === void 0 ? "" : t("row.probeQueuedCount", { count: String(result.queue.queueCount) });
					return {
						text: result.retryAtMs === void 0 ? t("row.probeQueuedUnknown") : t("row.probeQueuedAt", { at: formatProbeMoment(result.retryAtMs) }) + retrySuffix(t, result.retryAtMs, nowMs) + (queue === "" ? "" : ` · ${queue}`),
						tone: "warn"
					};
				}
				case "unavailable": return {
					text: t("row.probeUnavailable"),
					tone: "bad"
				};
				default: return {
					text: result.status === void 0 ? t("row.probeFailed") : t("row.probeFailedStatus", { status: String(result.status) }),
					tone: "bad"
				};
			}
		}
		/** 便捷包装：完整结果与池表格形状共用同一条规则。 */
		function probeLabelOf(t, result, nowMs = Date.now()) {
			if (result === void 0) return t("row.poolNeverTested");
			return probeResultView(result, t, nowMs).text;
		}
		//#endregion
		//#region src/client/probe-age.ts
		const MINUTE_MS = 6e4;
		const HOUR_MS = 60 * MINUTE_MS;
		const DAY_MS = 24 * HOUR_MS;
		/**
		* How long ago a measurement was taken, coarsely: "刚刚", "N 分钟前",
		* "N 小时前", "N 天前".
		*
		* A clock skew that puts the measurement in the FUTURE (a stored `atMs` ahead
		* of `nowMs`, from a machine whose clock moved backwards) is reported as
		* "刚刚" rather than as a negative age.
		*/
		function probeAgeText(t, atMs, nowMs) {
			const age = nowMs - atMs;
			if (age < MINUTE_MS) return t("row.poolProbeJustNow");
			if (age < HOUR_MS) return t("row.poolProbeMinutesAgo", { count: Math.round(age / MINUTE_MS) });
			if (age < 2 * DAY_MS) return t("row.poolProbeHoursAgo", { count: Math.round(age / HOUR_MS) });
			return t("row.poolProbeDaysAgo", { count: Math.round(age / DAY_MS) });
		}
		/**
		* Who wrote the measurement, or `undefined` when the record predates the field.
		*/
		function probeSourceText(t, source) {
			if (source === void 0) return void 0;
			return source === "test-batch" ? t("row.poolProbeSourceTest") : t("row.poolProbeSourceLive");
		}
		//#endregion
		//#region src/probe.ts
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
		//#endregion
		//#region src/account-pool.ts
		/**
		* The checked ids that still resolve to a stored credential, in the caller's
		* order. Pure and never mutates its input.
		*/
		function effectiveMembersOf(orderedIds, listedIds) {
			return orderedIds.filter((id) => listedIds.has(id));
		}
		//#endregion
		//#region src/client/pool-state.ts
		/**
		* Pure decision helpers for the account pool's card section.
		*
		* 参考：dingminhua/dsh-connect-workbuddy（MIT，Copyright (c) 2026 LaoDing）
		*
		* 本模块不 import React、不碰网络，纯函数、全函数，规则本身可被单测直接钉住。
		*
		* 改动（按 Qoder 现实）：
		*   1. 池的批量动作只有 test / remove，没有 checkin——`poolErrNoCheckin` 键保留
		*      以维持家族形状，但 host 永远不会给 checkin-unsupported 的 reason；
		*   2. `poolFailureText` / `poolErrorText` 沿用，供池路由失败时给出结构化文案。
		*
		* @module dsh-connect-qoder/client/pool-state
		*/
		/**
		* The base a draft edit starts from.
		*
		* Resolved at EDIT time rather than captured when the callback was built.
		*/
		function draftBaseFor(previous, previousRegion, region, saved) {
			return previous !== null && previousRegion === region ? previous : saved;
		}
		/**
		* Membership that resolves to a real credential — what a batch runs on.
		*
		* The HOST computes this and sends it; this helper only chooses which answer to
		* trust. While the draft is CLEAN the Host's answer is authoritative; while it
		* is DIRTY it must be derived from the edited list.
		*/
		function effectiveMemberIds(input) {
			if (!input.dirty) return [...input.savedEffective];
			return effectiveMembersOf(input.draftMembers, input.listedIds);
		}
		/**
		* Localize a pool route failure from its structured cause.
		*/
		function poolErrorText(t, reason, detail) {
			switch (reason) {
				case "no-members": return t("row.poolErrNoMembers");
				case "no-live-members": return t("row.poolErrNoLiveMembers");
				case "no-free-model": return t("row.poolErrNoFreeModel");
				case "target-model-stale": return t("row.poolErrStaleModel");
				case "checkin-unsupported": return t("row.poolErrNoCheckin");
				case "account-not-deletable": return t("row.poolErrNotDeletable");
				case "pool-unavailable": return t("row.poolErrUnavailable");
				case "pool-failed": return t("row.poolErrFailed", { message: detail ?? "" });
				default: return;
			}
		}
		function poolFailureText(t, input) {
			return poolErrorText(t, input.reason, input.error) ?? input.error ?? (input.bodyUnreadable === true && input.status === 405 ? t("row.poolErrRouteMissing") : t("row.poolErrHttp", { status: String(input.status) }));
		}
		/**
		* Pool MEMBERS that can serve right now.
		*/
		function usableMemberIds(accounts, effectiveMembers, draftMembers) {
			const wanted = /* @__PURE__ */ new Set([...effectiveMembers, ...draftMembers]);
			return accounts.filter((account) => wanted.has(account.accountId) && account.excludedBy === void 0).map((account) => account.accountId);
		}
		//#endregion
		//#region src/client/AccountPool.tsx
		/**
		* The account pool's card section.
		*
		* 参考：dingminhua/dsh-connect-workbuddy（MIT，Copyright (c) 2026 LaoDing）
		*   — `AccountPool.tsx`：草稿态 + dirty 标记 + 「保存/放弃」、`writeField` 验证
		*     写入、批量测试进度、活动日志的计时/配色、池表格的分列与配色，全部沿用。
		* 改动（按 Qoder 现实）：
		*   1. 每日签到走 campaigns 端点，`checkinSupported` 按区域判定（CN 与国际版均已
		*      接通）；为 false 的区域，签到按钮与那一列整体不渲染；
		*   2. 批量测试走 `POST /pool?action=test`，Host 一次性返回 JSON
		*      `{action, modelId, rows}`；**在飞期间**另用 `GET /pool?action=progress`
		*      逐秒读「哪几行已经处理完」（只读宿主内存、不碰上游），活动日志据此
		*      **逐条**落行——等整批响应才写，六行会共用同一秒的时间戳；
		*   3. 账号来自 PAT（settings / env / vault）。**两件不同的事必须分开**：
		*        - 移出池 = 取消勾选并保存（只改 `memberAccountIds`，凭据留着）；
		*        - 彻底删除 = 行内「删除」按钮 + 二次确认（删 vault 条目，并连带收掉
		*          配置里指向它的 `accountId` 与 `memberAccountIds` 残骸）。
		*      此前只有一个「移除」按钮，它做的其实是移出池，却长得像删除：用户点它
		*      期望账号消失，PAT 却原封不动留在 vault 里，「全选」一下又回来了（用户
		*      实拍：「删除唯一的号，但是号并没有删除干净」）。移出池现在只由勾选框表达
		*      （workbuddy 同规），按钮留给真正不可恢复的那个动作。
		*   4. settings / env 的 PAT 不归本插件管，删不动，所以那些行不给删除按钮。
		*
		* Add-PAT 与导出/导入由卡片以单独小节渲染（`AddAccount` / `AccountTransfer`），
		* 本模块只负责池本身：批量动作、成员勾选、偏好设置、活动日志。
		*
		* @module dsh-connect-qoder/client/AccountPool
		*/
		/** 池日志行的时间戳：只要时钟（日志是「刚刚/刚才」的语境，不需要日期）。 */
		function formatClock$1(atMs) {
			const d = new Date(atMs);
			const pad = (n) => String(n).padStart(2, "0");
			return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
		}
		/** 活动日志条数上限（超出裁最旧）。 */
		const LOG_LIMIT = 50;
		/**
		* 「使用哪个账号」下拉里代表「当前没有任何账号在生效」的哨兵值。
		*
		* 不能用 `''`：那正是「自动（设置 → 环境变量 → 保险库）」这个**真实选项**的
		* 值。共用会让下拉在没有生效账号时显示成「自动」，等于替用户宣称了一个他没做
		* 过的选择——而这正是这个控件存在的意义所在（不显示看起来正常、实际没在跑的
		* 东西）。哨兵带下划线前缀，不可能与真实账号 id 撞上（id 形如 `pat-<hex>`）。
		*/
		const MANUAL_ACCOUNT_NONE = "__none__";
		/**
		* 跨 remount 的活动日志。折叠卡片/切换 tab 会 unmount 本组件，组件 state 会
		* 丢空；日志属于「刚刚发生了什么」的事实记录，丢了会让用户以为操作没发生。
		* （workbuddy 的 logStore 同款方案。）
		*/
		const logStore = /* @__PURE__ */ new Map();
		function AccountPool(props) {
			const { t, region, pool, settingsScope, siblingBusy, canWrite, onChanged, onBusyChange, accountTools, onSelectAccount } = props;
			const [nowMs, setNowMs] = (0, react.useState)(() => Date.now());
			const [dirty, setDirty] = (0, react.useState)(false);
			const [saving, setSaving] = (0, react.useState)(false);
			const [saveError, setSaveError] = (0, react.useState)(void 0);
			const [actionError, setActionError] = (0, react.useState)(void 0);
			/** 正在跑的批量动作（'checkin' | 'test'），undefined = 空闲。两者互斥。 */
			const [batchAction, setBatchAction] = (0, react.useState)(void 0);
			/** 任一批量动作在跑。两个按钮共用同一把锁，避免签到与测试交错。 */
			const batchBusy = batchAction !== void 0;
			/**
			* 正在跑「行内测试」的那一行账号 id；undefined = 空闲。
			*
			* 与 `batchAction` 分开记，是因为**这两件事对使用者的意义不同**：批量会改动
			* 整张表的排名，值得全屏挡一道；而行内测试只测一个账号、结果自有一行日志，
			* 抬遮罩等于让一次轻操作绑架整个界面——用户在其他区域点什么都点不动。
			*
			* 参考：dingminhua/dsh-connect-workbuddy（MIT，Copyright (c) 2026 LaoDing）
			*   — 该项目的 `rowBusyAccountId` / `rowBusyAction`：注释原话是测试「keeps no
			*     veil — it changes no row membership, and its result already has its own
			*     line in the log」。workbuddy 用一个 id + 一个动作名，因为它行内还有
			*     remove；这里删除已经由 `removingId` 单独表达，所以只需要一个 id。
			*/
			const [rowTestingId, setRowTestingId] = (0, react.useState)(void 0);
			/**
			* 行内测试在飞。**它不进遮罩**，但仍然是锁：表里的测试按钮彼此互斥，批量
			* 按钮也要禁用——批量与单行交错会让两拨探针同时打向宿主，谁的结果是谁就
			* 说不清了。
			*/
			const rowTestBusy = rowTestingId !== void 0;
			/** 正在删除的账号 id；undefined = 空闲。删除过程中锁住整张表。 */
			const [removingId, setRemovingId] = (0, react.useState)(void 0);
			/**
			* 等待二次确认的「删除账号」目标 id。
			*
			* 删除是**硬删** vault 条目：那是这个账号在本插件里的唯一存储位置，删掉就
			* 找不回来（对比「勾选框」表达的移出池——那只改名单，凭据留着，随时能勾回来）。
			* 所以按第一下只把这一行换成确认条，第二个按钮才真的删。
			*
			* 用两步内联确认而不是 `window.confirm`：不阻塞、可被测试、禁用态下也能复位
			* （workbuddy 的删除是「暂时隐藏」、可 rescan 找回，所以它不需要确认；这里
			* 没有第二来源可按，必须有）。
			*/
			const [confirmDeleteId, setConfirmDeleteId] = (0, react.useState)(void 0);
			const [log, setLog] = (0, react.useState)(() => logStore.get(region) ?? []);
			(0, react.useEffect)(() => {
				setLog(logStore.get(region) ?? []);
			}, [region]);
			const [draftRegion, setDraftRegion] = (0, react.useState)(void 0);
			const [draftPool, setDraftPool] = (0, react.useState)(null);
			const mounted = (0, react.useRef)(true);
			/** 幽灵成员自愈的防重入标记（见 render 前的那个 effect）。 */
			const pruningRef = (0, react.useRef)(false);
			(0, react.useEffect)(() => {
				mounted.current = true;
				setNowMs(Date.now());
				return () => {
					mounted.current = false;
				};
			}, []);
			(0, react.useEffect)(() => {
				const timer = window.setInterval(() => setNowMs(Date.now()), 2e4);
				return () => window.clearInterval(timer);
			}, []);
			const onChangedRef = (0, react.useRef)(onChanged);
			(0, react.useEffect)(() => {
				onChangedRef.current = onChanged;
			}, [onChanged]);
			(0, react.useEffect)(() => {
				if (batchAction === void 0) return;
				const timer = window.setInterval(() => {
					onChangedRef.current?.();
				}, 2500);
				return () => window.clearInterval(timer);
			}, [batchAction]);
			(0, react.useEffect)(() => {
				onBusyChange?.(saving);
				return () => {
					onBusyChange?.(false);
				};
			}, [onBusyChange, saving]);
			const saved = {
				enabled: pool?.enabled ?? false,
				targetModelId: pool?.targetModelId || pool?.staleTargetModelId || "",
				probeInputTokens: pool?.probeInputTokens ?? 0,
				memberAccountIds: pool?.memberAccountIds ?? [],
				orderAccountIds: pool?.orderAccountIds ?? [],
				autoCheckin: pool?.autoCheckin === true
			};
			/**
			* 正在计费的那个账号，或 undefined（池里没有 `current` 行时）。
			*
			* 这个事实由宿主给出（取自该区域解析出的服务凭据），卡片只渲染、不推断。
			*/
			const currentAccount = pool?.accounts.find((account) => account.current === true);
			const active = draftPool !== null && draftRegion === region ? draftPool : saved;
			/**
			* 「使用哪个账号」下拉框的当前值。
			*
			* 这个控件**只在池关闭时**渲染（见下面 `saved.enabled` 的判据），而那时
			* 选择即服务 —— `current` 就是用户保存的那个 id，没有第二个候选答案。
			* 所以这里照旧读 `current`：引入一个「保存的选择」字段只会多一份可能与
			* `current` 分叉的真值，而它可渲染的场景为零。池里无人可用时 `current`
			* 虽为空，但那时控件本来就不在（池开着）。
			*/
			const currentAccountId = currentAccount?.accountId;
			const listed = new Set(pool?.accounts.map((a) => a.accountId) ?? []);
			/**
			* 当前**生效**的优先级序列（成员 id，靠前的先用）。
			*
			* 保存的顺序可能不全：新勾进来的账号、或宿主刚清理过的池，都不在里面。
			* 那些未排过序的成员按池表原顺序接在尾部 —— 与宿主 `rankPool` 的
			* 「没排过 = 排到最后」是同一条约定，卡片上的名次才不会和实际选中顺序打架。
			*
			* 只含成员：非成员不参与排名。
			*/
			const orderIds = (() => {
				const members = active.memberAccountIds.filter((id) => listed.has(id));
				const explicit = active.orderAccountIds.filter((id) => members.includes(id));
				const rest = members.filter((id) => !explicit.includes(id));
				return [...explicit, ...rest];
			})();
			/** 用户排过序吗？没排过时名次不算数，界面必须这么说。 */
			const orderIsManual = active.orderAccountIds.some((id) => active.memberAccountIds.includes(id));
			const effective = pool?.effectiveMemberAccountIds?.slice() ?? effectiveMemberIds({
				savedEffective: pool?.effectiveMemberAccountIds ?? [],
				draftMembers: active.memberAccountIds,
				listedIds: listed,
				dirty
			});
			const canEditPool = settingsScope !== void 0 && canWrite && !siblingBusy;
			/** 该区域是否提供每日签到（决定整列与批量按钮是否出现）。 */
			const checkinOn = pool?.checkinSupported === true;
			/**
			* 幽灵成员自愈：名单里留有「凭据已被删除」的 id 时，静默把名单收敛为实际
			* 存在的成员并写回。
			*
			* 为什么不提示用户（用户实拍：「你应该直接就清理掉，而不是再给我这么一个
			* 提示」）：删掉 PAT 之后配置里的 `memberAccountIds` 不会自动收缩，残渣是
			* 插件的内部记账问题。原先的文案（「再保存一次即可移除它们」）把这件事推回
			* 给用户——他删完 PAT 还得回到池设置里再点一次保存，而他本来就不想要这些
			* 账号；更糟的是批量测试仍会遍历它们，白跑一轮。
			*
			* 只在不脏、不忙、可写时动手：正在编辑草稿时不能偷改（会覆盖用户的选择），
			* 只读权限下也不能写。ref 防重入——写回后 pool 以新快照回流，effect 再跑时
			* kept 已等于 savedIds，自然停下。
			*/
			(0, react.useEffect)(() => {
				if (dirty || saving || settingsScope === void 0 || !canEditPool) return;
				const savedIds = pool?.memberAccountIds;
				if (savedIds === void 0) return;
				const kept = savedIds.filter((id) => listed.has(id));
				if (kept.length === savedIds.length) return;
				if (pruningRef.current) return;
				pruningRef.current = true;
				writePoolPreferences(settingsScope, region, {
					...saved,
					memberAccountIds: kept
				}).then(() => onChanged?.()).catch(() => {}).finally(() => {
					pruningRef.current = false;
				});
			}, [
				dirty,
				saving,
				settingsScope,
				canEditPool,
				pool?.memberAccountIds,
				region,
				saved,
				listed,
				onChanged
			]);
			const usable = pool === void 0 ? [] : usableMemberIds(pool.accounts, effective, active.memberAccountIds);
			const targetProvenance = pool === void 0 ? null : pool.targetModelSource === "preferred" ? t("row.poolTargetCurrentPreferred", { model: pool.targetModelId ?? "" }) : pool.targetModelSource === "free" ? t("row.poolTargetCurrentFree", { model: pool.targetModelId ?? "" }) : pool.targetModelSource === "stale" ? t("row.poolTargetStale", { model: pool.staleTargetModelId ?? "" }) : pool.targetModelSource === "none" ? t("row.poolTargetNone") : null;
			const editDraft = (0, react.useCallback)((update) => {
				setDraftPool(update(draftBaseFor(draftPool, draftRegion, region, saved)));
				setDraftRegion(region);
				setDirty(true);
				setSaveError(void 0);
			}, [
				draftPool,
				draftRegion,
				region,
				saved
			]);
			const toggleMember = (accountId, next) => {
				editDraft((prev) => ({
					...prev,
					memberAccountIds: next ? [...prev.memberAccountIds, accountId] : prev.memberAccountIds.filter((id) => id !== accountId)
				}));
			};
			/**
			* 把某个成员在用户排序里上移/下移一位。
			*
			* 基准是**当前显示的顺序**（`orderIds`），不是配置里那个可能不全的数组：
			* 用户看到的是哪一行在谁上面，拖动的结果就该跟着眼睛走。因此第一次拖动时
			* 会把当前可见顺序整个落下来——这也是「用户开始手动排序」的那个点，
			* 从此不再由积分策略自动决定。
			*
			* 只动池成员：非成员不参与排名，混进来只会让名次出现空位。
			*/
			const moveMember = (accountId, delta) => {
				const members = orderIds.filter((id) => active.memberAccountIds.includes(id));
				const from = members.indexOf(accountId);
				const to = from + delta;
				if (from < 0 || to < 0 || to >= members.length) return;
				const next = members.slice();
				const [moved] = next.splice(from, 1);
				next.splice(to, 0, moved);
				editDraft((prev) => ({
					...prev,
					orderAccountIds: next
				}));
			};
			const selectAll = (on) => {
				editDraft((prev) => ({
					...prev,
					memberAccountIds: on ? pool?.accounts.map((a) => a.accountId) ?? [] : []
				}));
			};
			const savePool = async () => {
				if (settingsScope === void 0) return;
				setSaving(true);
				setSaveError(void 0);
				try {
					await writePoolPreferences(settingsScope, region, active);
					setDraftPool(active);
					setDirty(false);
					try {
						await onChanged?.();
					} catch {}
				} catch (error) {
					setSaveError(isFileContentionWriteError(error) ? `${t("row.poolSaveFailed", { message: String(error?.message ?? error) })}${t("row.saveContentionHint")}` : t("row.poolSaveFailed", { message: String(error?.message ?? error) }));
				} finally {
					if (mounted.current) setSaving(false);
				}
			};
			/**
			* 一键签到：对勾选的成员逐个领取当日 Credits。
			*
			* 与测试批次共用同一把锁（`batchAction`），两者不会交错。日志逐行写明每个
			* 账号的结果——`claimed`（领到，带数额）、`already`（今天已领）、`failed`
			* （失败原因）。「今天已领」是**正常**结果，不该显示成失败。
			*/
			const runCheckinBatch = async () => {
				setActionError(void 0);
				loggedBatchIds.current = /* @__PURE__ */ new Set();
				appendLog({
					atMs: Date.now(),
					text: t("row.poolLogCheckinStart", { count: effective.length }),
					tone: "info"
				});
				setBatchAction("checkin");
				try {
					const response = await fetch(withQoderRouteAction(QODER_POOL_PATH, region, "checkin"), {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						credentials: "same-origin"
					});
					let bodyUnreadable = false;
					const raw = await response.json().catch(() => {
						bodyUnreadable = true;
						return {};
					});
					if (!response.ok) {
						const reason = typeof raw["reason"] === "string" ? raw["reason"] : void 0;
						const error = typeof raw["error"] === "string" ? raw["error"] : void 0;
						throw new Error(poolFailureText(t, {
							status: response.status,
							reason,
							error,
							bodyUnreadable
						}));
					}
					if (raw["action"] === "checkin" && Array.isArray(raw["rows"])) {
						const rows = raw["rows"].map(parseCheckinRow).filter((row) => row !== void 0);
						for (const row of rows) logCheckinRowOnce(row, Date.now());
						if (rows.length > 0) appendLog({
							atMs: Date.now(),
							text: t("row.poolLogCheckinDone"),
							tone: "info"
						});
					}
					try {
						await onChanged?.();
					} catch {}
				} catch (error) {
					if (mounted.current) setActionError(String(error?.message ?? error));
				} finally {
					if (mounted.current) setBatchAction(void 0);
				}
			};
			const appendLog = (0, react.useCallback)((entry) => {
				setLog((entries) => {
					const next = [entry, ...entries].slice(0, LOG_LIMIT);
					logStore.set(region, next);
					return next;
				});
			}, [region]);
			/**
			* 逐条落日志的账本：哪个账号的这一次结果已经写过了。
			*
			* 同一批结果有两条来路——在飞期间的进度轮询、以及最终的整批响应（后者带着
			* 完整结果，是权威答案）。两边都调 `*RowOnce`，由这里去重；每批开始时清空，
			* 因为同一个账号的两**批**结果该各留一行。
			*/
			const loggedBatchIds = (0, react.useRef)(/* @__PURE__ */ new Set());
			const logTestRowOnce = (0, react.useCallback)((row, atMs) => {
				if (loggedBatchIds.current.has(row.accountId)) return;
				loggedBatchIds.current.add(row.accountId);
				appendLog({
					atMs,
					text: t("row.poolLogTestRow", {
						accountName: row.accountName,
						outcome: probeLabelOf(t, row.result, atMs)
					}),
					tone: row.result.outcome === "ok" ? "ok" : "warn"
				});
			}, [appendLog, t]);
			const logCheckinRowOnce = (0, react.useCallback)((row, atMs) => {
				if (loggedBatchIds.current.has(row.accountId)) return;
				loggedBatchIds.current.add(row.accountId);
				appendLog({
					atMs,
					text: checkinLogText(t, row),
					tone: row.status === "failed" ? "warn" : "ok"
				});
			}, [appendLog, t]);
			/**
			* 批量在飞期间逐秒读一次「哪几行已经处理完」，并把新行**逐条**写进活动日志。
			*
			* 为什么要有这条路：整批日志原是等响应回来一次性写的，六行于是共用落盘那一
			* 刻的时间戳（用户实拍：六条全是 05:44:54）。批量是分钟级的串行真实探针，
			* 日志在那几分钟里整段空着——用户分不清「还在跑」和「卡住了」，而这两者在
			* 界面上确实看不出区别。宿主每处理完一个账号就往进度槽位追加一行（带完成
			* 时刻），这里读出来照原样落行：时间是真的，行是一行一行出现的。
			*
			* 轮询只读宿主内存里的进度、不碰上游，所以每秒一次很便宜。（*重读 usage*
			* 那条路不一样：它每成员一次上游读数，所以它 2.5 秒一次、宿主侧还有 15 秒
			* 的复用窗口。）
			*/
			(0, react.useEffect)(() => {
				const action = batchAction;
				if (action === void 0) return;
				let stopped = false;
				const pull = async () => {
					try {
						const response = await fetch(withQoderRegionAndAction(QODER_POOL_PATH, region, "progress"), { credentials: "same-origin" });
						if (!response.ok) return;
						const batch = (await response.json().catch(() => ({})))["batch"];
						if (stopped || typeof batch !== "object" || batch === null) return;
						const entry = batch;
						if (entry["action"] !== action || !Array.isArray(entry["done"])) return;
						for (const value of entry["done"]) {
							if (typeof value !== "object" || value === null) continue;
							const done = value;
							const atMs = typeof done["atMs"] === "number" ? done["atMs"] : Date.now();
							if (action === "test") {
								const row = parseTestRow(done["row"]);
								if (row !== void 0) logTestRowOnce(row, atMs);
							} else {
								const row = parseCheckinRow(done["row"]);
								if (row !== void 0) logCheckinRowOnce(row, atMs);
							}
						}
					} catch {}
				};
				pull();
				const timer = window.setInterval(() => {
					pull();
				}, 1e3);
				return () => {
					stopped = true;
					window.clearInterval(timer);
				};
			}, [
				batchAction,
				region,
				logTestRowOnce,
				logCheckinRowOnce
			]);
			/**
			* 测试一个账号，或整批。
			*
			* 行级按钮**必须**传 `accountId`：此前它调的是整批，于是点一行「测试」会把
			* 池里每个成员都真跑一遍（每个都是一次真实探针、约 25k 输入 token），而且
			* 动的不一定是用户点的那一行。整批仍由工具栏按钮与「测试全部」使用。
			*
			* 两条路径的「在飞表达」相同（学 workbuddy 的 `runRowTest` 与 `runAction`
			* 之分）：**都不抬全屏遮罩**，只锁测试类按钮，在飞期间界面照常可用。
			* 行内只让那一行的按钮自变「测试中…」；整批在顶部挂一句「正在逐个账号执行…」，
			* 并且每 2.5 秒重读一次快照，让每一行的结果逐个落位——批量是几分钟级的串行
			* 真实探针，一次轻操作（乃至一次长操作）都不该把使用者锁在整个界面外面；
			* 用户把它当成「卡住」过，而那时遮罩挡着、表也不动，确实与卡死无异。
			* 两条路径仍是同一把锁：测试类按钮互斥，批量与单行交错会让两拨探针同时
			* 打向宿主，谁的结果是谁就说不清了。
			* 「正在逐个账号执行…」那句提示**只在批量时挂**（workbuddy 同规：它的 hint
			* 挂在批量态 `busy` 上）——只测一行时「逐个」是句假话，行内的轻提示就是那
			* 颗按钮自己的「测试中…」。
			*/
			const runTestBatch = async (onlyAccountId) => {
				const inline = onlyAccountId !== void 0;
				if (batchBusy || rowTestBusy) return;
				setActionError(void 0);
				if (inline) setRowTestingId(onlyAccountId);
				else {
					loggedBatchIds.current = /* @__PURE__ */ new Set();
					appendLog({
						atMs: Date.now(),
						text: t("row.poolLogTestStart", {
							count: effective.length,
							model: pool?.targetModelId || t("row.modelUnknown")
						}),
						tone: "info"
					});
					setBatchAction("test");
				}
				try {
					const url = inline ? withQoderRouteAccount(QODER_POOL_PATH, region, "test", onlyAccountId) : withQoderRouteAction(QODER_POOL_PATH, region, "test");
					const response = await fetch(url, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						credentials: "same-origin"
					});
					let bodyUnreadable = false;
					const raw = await response.json().catch(() => {
						bodyUnreadable = true;
						return {};
					});
					if (!response.ok) {
						const reason = typeof raw["reason"] === "string" ? raw["reason"] : void 0;
						const error = typeof raw["error"] === "string" ? raw["error"] : void 0;
						throw new Error(poolFailureText(t, {
							status: response.status,
							reason,
							error,
							bodyUnreadable
						}));
					}
					if (raw["action"] === "test" && Array.isArray(raw["rows"])) {
						const rows = raw["rows"].map(parseTestRow).filter((row) => row !== void 0);
						if (inline) {
							if (rows.length === 0) {
								const target = pool?.accounts.find((account) => account.accountId === onlyAccountId);
								appendLog({
									atMs: Date.now(),
									text: t("row.poolLogTestRowMalformed", { accountName: target?.accountName || target?.accountId || onlyAccountId || "" }),
									tone: "warn"
								});
							} else for (const row of rows) appendLog({
								atMs: Date.now(),
								text: t("row.poolLogTestRow", {
									accountName: row.accountName,
									outcome: probeLabelOf(t, row.result, Date.now())
								}),
								tone: row.result.outcome === "ok" ? "ok" : "warn"
							});
						} else {
							if (rows.length === 0) appendLog({
								atMs: Date.now(),
								text: effective.length === 0 ? t("row.poolLogBatchFailed", { message: t("row.poolTargetNone") }) : t("row.poolLogTestNoneRan"),
								tone: "warn"
							});
							else for (const row of rows) logTestRowOnce(row, Date.now());
							appendLog({
								atMs: Date.now(),
								text: t("row.poolLogTestDone"),
								tone: "info"
							});
						}
					}
					try {
						await onChanged?.();
					} catch {}
				} catch (error) {
					if (!mounted.current) return;
					const message = String(error?.message ?? error);
					setActionError(message);
					if (inline) {
						const target = pool?.accounts.find((account) => account.accountId === onlyAccountId);
						appendLog({
							atMs: Date.now(),
							text: t("row.poolLogTestRow", {
								accountName: target?.accountName || target?.accountId || onlyAccountId || "",
								outcome: message
							}),
							tone: "error"
						});
					} else appendLog({
						atMs: Date.now(),
						text: t("row.poolLogBatchFailed", { message }),
						tone: "error"
					});
				} finally {
					if (!mounted.current) return;
					if (inline) setRowTestingId(void 0);
					else setBatchAction(void 0);
				}
			};
			/**
			* 彻底删除一个账号（凭据 + 池成员 + 区域选择）。
			*
			* 这一支以前叫 `runRowRemove`，做的却只是「从池名单里剔掉」——也就是移出池。
			* 用户点它期望账号消失，PAT 却留在 vault 里，下一次「全选」又勾回来，看起来
			* 就是「删不掉」（用户实拍：「删除唯一的号，但是号并没有删除干净」）。
			* 现在两件事彻底分开：移出池 = 取消勾选并保存；删除 = 这里，且要二次确认。
			*/
			const runDeleteAccount = async (accountId) => {
				setActionError(void 0);
				setRemovingId(accountId);
				setConfirmDeleteId(void 0);
				try {
					const url = `${withQoderRegionAndAction(QODER_POOL_PATH, region, "remove")}&${QODER_POOL_ACCOUNT_PARAM}=${encodeURIComponent(accountId)}`;
					const response = await fetch(url, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						credentials: "same-origin"
					});
					let bodyUnreadable = false;
					const raw = await response.json().catch(() => {
						bodyUnreadable = true;
						return {};
					});
					if (!response.ok) {
						const reason = typeof raw["reason"] === "string" ? raw["reason"] : void 0;
						const error = typeof raw["error"] === "string" ? raw["error"] : void 0;
						throw new Error(poolFailureText(t, {
							status: response.status,
							reason,
							error,
							bodyUnreadable
						}));
					}
					const accountName = pool?.accounts.find((a) => a.accountId === accountId)?.accountName ?? t("row.accountUnnamed");
					appendLog({
						atMs: Date.now(),
						text: t("row.poolRowRemoved", { accountName }),
						tone: "ok"
					});
					if (draftPool !== null && draftRegion === region) {
						setDraftPool({
							...draftPool,
							memberAccountIds: draftPool.memberAccountIds.filter((id) => id !== accountId)
						});
						if (draftPool.memberAccountIds.includes(accountId)) setDirty(true);
					}
					try {
						await onChanged?.();
					} catch {}
				} catch (error) {
					if (mounted.current) setActionError(String(error?.message ?? error));
				} finally {
					if (mounted.current) {
						setRemovingId(void 0);
						setConfirmDeleteId(void 0);
					}
				}
			};
			const targetMisses = pool?.targetModelSource === "none" || pool?.targetModelSource === "stale";
			/**
			* 自动签到今天的进度，或什么都不渲染。
			*
			* 读的是**保存着的**开关（`saved`），不是草稿：这一段描述的是运行器在做什么，
			* 而一个草稿状态下「打开」的开关还没启动任何东西 —— 给它显示进度等于宣称一个
			* 任务正在跑。
			*
			* 三态三句话：全做完了、做到一半、以及「还欠着重试」。最后一句是用户唯一能
			* 知道「它还在试」而不是「它悄悄卡住了」的地方。
			*/
			const autoCheckinStatus = (() => {
				if (!saved.autoCheckin) return null;
				const today = pool?.autoCheckinToday;
				if (today === void 0) return null;
				const headline = today.pending === 0 && today.done === today.total ? t("row.poolAutoCheckinDone", { total: String(today.total) }) : t("row.poolAutoCheckinToday", {
					done: String(today.done),
					total: String(today.total)
				});
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: "dsm-qoder-pool-auto-checkin-status",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dsm-qoder-pool-auto-checkin-line",
							children: headline
						}),
						today.pending === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dsm-qoder-pool-auto-checkin-pending",
							children: t("row.poolAutoCheckinPending", { count: String(today.pending) })
						}),
						today.lastError === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dsm-qoder-pool-auto-checkin-error",
							title: today.lastError,
							children: t("row.poolAutoCheckinFailed", { message: today.lastError })
						})
					]
				});
			})();
			/**
			* 运行中的模式（`saved.enabled`），**不是**草稿（`active.enabled`）。
			*
			* 开关显示的是「你正要改成什么」，旁边那枚脏标记说的是「还没保存」；所以
			* 模式芯片必须回答另一个问题——「池子此刻在做什么」。读草稿会让页面写着
			* 「自动挑号」，而保存着的池其实还关着、下面的手动选号仍在生效，正是这一节
			* 反复防的「显示 A、实际记 B」。
			*/
			const poolRunning = saved.enabled;
			const accountCounts = nameCountsOf(pool?.accounts ?? []);
			/**
			* 「谁在服务」这一槽：池关着时是选号下拉，池开着时是「当前使用」芯片。
			*
			* 两者是同一个问题的两半，所以共用一个位置。此前下拉在设置区里独占一行，
			* 于是同一个账号名在一屏上出现三次（标题芯片、那一行、成员表），读起来像
			* 机器拼的而不是设计出来的。
			*
			* workbuddy 同构（94c339f）。qoder 的差异保留：下拉里有「自动」这个真实
			* 第三态（设置 → 环境变量 → 保险库三级回退），不能照抄 workbuddy 那个没有
			* 自动项的下拉。
			*/
			const manualPicker = !poolRunning && onSelectAccount !== void 0 && (pool?.accounts.length ?? 0) > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				className: "dsm-qoder-pool-head-pick",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dsm-qoder-pool-head-pick-label",
					children: t("row.poolManualAccountLabel")
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
					className: "dsm-qoder-pool-select dsm-qoder-pool-account-select",
					value: currentAccountId ?? MANUAL_ACCOUNT_NONE,
					disabled: !canEditPool,
					"aria-label": t("row.accountSelectAria"),
					onChange: (e) => {
						if (e.target.value === MANUAL_ACCOUNT_NONE) return;
						onSelectAccount(e.target.value);
					},
					children: [
						currentAccountId === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
							value: MANUAL_ACCOUNT_NONE,
							disabled: true,
							children: t("row.poolManualAccountNone")
						}) : null,
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
							value: "",
							children: t("row.accountSelectAuto")
						}),
						(pool?.accounts ?? []).map((account) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
							value: account.accountId,
							children: poolAccountLabel(t, account, accountCounts)
						}, account.accountId))
					]
				})]
			}) : null;
			/**
			* 「在用」与「在池里」是正交的两件事。
			*
			* 同一行同时写「当前使用」和「未入池」会让人问「都在用了为什么不在池里」——
			* 不是 bug，但解释必须存在，且只在这个状态需要它时出现。放在模式条下面
			* 一行，不占成员表的地方。
			*/
			const servingOutside = poolRunning && currentAccount !== void 0 && !effective.includes(currentAccount.accountId);
			/**
			* 本区域「下一窗什么时候开」的倒计时，来自上游活动行的 `endAt`。
			*
			* 区域级而不是账号级：活动窗对整个区域是同一批（所有成员领的是同一份每日
			* 额度），所以取第一条**已领取且给了时间**的成员行即可 —— 不去猜哪条才对。
			* 一个都没有 → `undefined`：上游没给就不显示倒计时，而不是拿本地区时编一个。
			*
			* 返回 `''` 表示「倒计时走完了，此刻就可以领了」——与「没有倒计时」（undefined）
			* 是两件事，UI 要分开说。
			*/
			const checkinCountdown = (0, react.useMemo)(() => {
				if (!checkinOn) return { state: "off" };
				const row = pool?.accounts.find((row) => row.checkedInToday === true && row.checkinRefreshAtMs !== void 0);
				if (row === void 0) return { state: "unknown" };
				const text = countdownText(row.checkinRefreshAtMs, nowMs);
				return text === "" ? { state: "due" } : {
					state: "ticking",
					text
				};
			}, [
				checkinOn,
				pool?.accounts,
				nowMs
			]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: "dsm-qoder-pool",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(BusyOverlay, {
						visible: saving || removingId !== void 0,
						message: t("row.poolSaving")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsm-qoder-pool-head",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
							className: "dsm-qoder-pool-title",
							children: t("row.poolTitle")
						}), manualPicker !== null ? manualPicker : currentAccount === void 0 ? pool?.servingUnavailable === true ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dsm-qoder-pool-current-badge dsm-qoder-pool-current-badge-off",
							title: t("row.poolCurrentHintUnavailable"),
							children: t("row.poolCurrentHeaderUnavailable")
						}) : null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dsm-qoder-pool-current-badge",
							title: pool?.servingSource === "failover" ? t("row.poolCurrentHintFailover") : t("row.poolCurrentHintSelected"),
							children: t(pool?.servingSource === "failover" ? "row.poolCurrentHeaderFailover" : "row.poolCurrentHeader", { account: currentAccount.accountName || currentAccount.accountId })
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsm-qoder-pool-settings dsm-qoder-pool-modebar",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsm-qoder-pool-modebar-row",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
										className: "sw",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											type: "checkbox",
											checked: active.enabled,
											disabled: !canEditPool,
											onChange: (e) => editDraft((prev) => ({
												...prev,
												enabled: e.target.checked
											}))
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: "sw-track" })]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", {
										className: "dsm-qoder-pool-modebar-label",
										children: t("row.poolEnabled")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsm-qoder-pool-modebar-state",
										children: poolRunning ? t("row.poolModeAuto") : t("row.poolModeManual")
									}),
									dirty ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsm-qoder-pool-dirty",
										children: t("row.poolDirty")
									}) : null
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsm-qoder-pool-note",
								children: t("row.poolEnabledHint")
							}),
							checkinOn ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsm-qoder-pool-modebar-row dsm-qoder-pool-auto-checkin",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
										className: "sw",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											type: "checkbox",
											checked: active.autoCheckin,
											disabled: !canEditPool,
											onChange: (e) => editDraft((prev) => ({
												...prev,
												autoCheckin: e.target.checked
											}))
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: "sw-track" })]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", {
										className: "dsm-qoder-pool-modebar-label",
										children: t("row.poolAutoCheckin")
									}),
									autoCheckinStatus
								]
							}) : null,
							checkinOn ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsm-qoder-pool-note",
								children: t("row.poolAutoCheckinHint")
							}) : null
						]
					}),
					servingOutside ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dsm-qoder-pool-note dsm-qoder-pool-serving-note",
						children: t("row.poolServingOutside", { account: currentAccount?.accountName || currentAccount?.accountId || "" })
					}) : null,
					pool?.enabled === true && usable.length === 0 && (pool?.accounts.length ?? 0) > 0 ? (0, react.createElement)("p", {
						className: "dsm-qoder-pool-warn",
						role: "status"
					}, `${t("row.poolNoCandidate")} ${t("row.poolNoCandidateHint")}`) : null,
					(pool?.accounts.length ?? 0) === 0 ? (0, react.createElement)("p", {
						className: "dsm-qoder-pool-empty",
						role: "status"
					}, t("row.poolEmptyHint")) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsm-qoder-pool-members",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsm-qoder-pool-members-head",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h4", {
									className: "dsm-qoder-pool-members-title",
									children: t("row.poolMembersTitle")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dsm-qoder-pool-note",
									children: t("row.poolMembersHint")
								})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsm-qoder-pool-members-actions",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsm-qoder-pool-hint",
											children: t("row.poolSelectedCount", {
												count: effective.length,
												total: pool?.accounts.length ?? 0
											})
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "dsm-btn dsm-btn-outline dsm-qoder-pool-small-btn",
											disabled: pool?.accounts.length === 0 || !canEditPool,
											onClick: () => selectAll(true),
											children: t("row.poolSelectAll")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "dsm-btn dsm-btn-outline dsm-qoder-pool-small-btn",
											disabled: effective.length === 0 || !canEditPool,
											onClick: () => selectAll(false),
											children: t("row.poolSelectNone")
										})
									]
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsm-qoder-pool-actions",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsm-qoder-pool-actions-group",
									children: [
										pool?.checkinSupported !== true ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "dsm-btn dsm-btn-primary",
											disabled: !canEditPool || effective.length === 0 || batchBusy || rowTestBusy,
											onClick: () => {
												runCheckinBatch();
											},
											children: batchAction === "checkin" ? t("row.poolCheckingIn") : t("row.poolCheckinAll")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "dsm-btn dsm-btn-outline",
											disabled: !canEditPool || effective.length === 0 || batchBusy || rowTestBusy || targetMisses,
											title: pool?.targetModelSource === "none" ? t("row.poolTargetNone") : pool?.targetModelSource === "stale" ? t("row.poolTargetStale", { model: pool.staleTargetModelId ?? "" }) : void 0,
											onClick: () => {
												runTestBatch();
											},
											children: batchAction === "test" ? t("row.poolTesting") : t("row.poolTestAll")
										}),
										batchAction === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsm-qoder-pool-hint",
											children: t("row.poolBusyHint")
										}),
										batchAction === void 0 && effective.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsm-qoder-pool-hint",
											children: t("row.poolNoneSelectedHint")
										}) : null
									]
								})
							}),
							(pool?.accounts.length ?? 0) === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: `dsm-qoder-pool-table${checkinOn ? " dsm-qoder-pool-table-checkin" : ""}`,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsm-qoder-pool-row dsm-qoder-pool-row-head",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("row.poolColumnAccount") }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("row.poolColumnCredits") }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("row.poolColumnProbe") }),
										checkinOn ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("row.poolColumnCheckin") }) : null,
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { "aria-hidden": "true" })
									]
								}), sortAccountsByOrder(pool?.accounts ?? [], orderIds).map((account) => {
									const name = account.accountName === "" ? t("row.accountUnnamed") : account.accountName;
									const excluded = exclusionText(t, account.excludedBy, account.probe?.retryAtMs, nowMs, account.probe?.retrySource);
									const inPool = active.memberAccountIds.includes(account.accountId);
									return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: `dsm-qoder-pool-row${account.current ? " dsm-qoder-pool-row-current" : ""}`,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
												className: "dsm-qoder-pool-account",
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
														className: "dsm-qoder-pool-check",
														children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
															type: "checkbox",
															checked: inPool,
															disabled: !canEditPool,
															"aria-label": t("row.poolSelectAria", { accountName: name }),
															onChange: (e) => toggleMember(account.accountId, e.target.checked)
														})
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "dsm-qoder-usage-dot",
														style: { background: stateColor(account) }
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
														className: "dsm-qoder-pool-account-name",
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
															className: "dsm-qoder-pool-account-line",
															children: [
																/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", { children: name }),
																!inPool ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																	className: orderIsManual ? "dsm-qoder-pool-rank" : "dsm-qoder-pool-rank-auto",
																	title: t(!orderIsManual ? "row.poolRankAutoHint" : account.excludedBy === void 0 ? "row.poolRankHint" : "row.poolRankExcludedHint"),
																	children: !orderIsManual ? t("row.poolRankAuto") : account.excludedBy === void 0 ? t("row.poolRank", { rank: String(orderIds.indexOf(account.accountId) + 1) }) : t("row.poolRankExcluded", { rank: String(orderIds.indexOf(account.accountId) + 1) })
																}),
																account.current ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																	className: "dsm-qoder-pool-current-tag",
																	title: t(pool?.servingSource === "failover" ? "row.poolCurrentHintFailover" : "row.poolCurrentHintSelected"),
																	children: t(pool?.servingSource === "failover" ? "row.poolCurrentBadgeFailover" : "row.poolCurrentBadge")
																}) : null,
																inPool ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																	className: "dsm-qoder-pool-not-member",
																	children: t("row.poolNotMember")
																}),
																pool?.enabled === true && inPool && canEditPool ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
																	className: "dsm-qoder-pool-move",
																	role: "group",
																	"aria-label": t("row.poolMoveAria", { accountName: name }),
																	children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
																		type: "button",
																		className: "dsm-qoder-pool-move-btn",
																		title: t("row.poolMoveUp"),
																		"aria-label": t("row.poolMoveUp"),
																		disabled: orderIds.indexOf(account.accountId) <= 0,
																		onClick: () => {
																			moveMember(account.accountId, -1);
																		},
																		children: "↑"
																	}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
																		type: "button",
																		className: "dsm-qoder-pool-move-btn",
																		title: t("row.poolMoveDown"),
																		"aria-label": t("row.poolMoveDown"),
																		disabled: orderIds.indexOf(account.accountId) >= orderIds.length - 1,
																		onClick: () => {
																			moveMember(account.accountId, 1);
																		},
																		children: "↓"
																	})]
																}) : null
															]
														}), excluded === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: "dsm-qoder-pool-excluded",
															children: excluded
														})]
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "dsm-qoder-pool-credits",
														children: account.credits === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: "dsm-qoder-pool-unknown",
															children: "—"
														}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", { children: String(account.credits) })
													})
												]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
												className: "dsm-qoder-pool-probe",
												...account.probe?.message === void 0 ? {} : { title: account.probe.message },
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dsm-qoder-pool-probe-main",
													children: [probeLabelOf(t, account.probe, nowMs), account.probe === void 0 ? void 0 : inlineProbeReason(account.probe.outcome, account.probe.message)].filter((part) => part !== void 0 && part !== "").join(" · ")
												}), account.probe === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
													className: "dsm-qoder-pool-probe-prov",
													children: [
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: probeSourceClass(account.probe.source),
															children: probeSourceText(t, account.probe.source) ?? t("row.poolProbeSourceUnknown")
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: "dsm-qoder-pool-prov-sep",
															children: "·"
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: "dsm-qoder-pool-prov-age",
															children: probeAgeText(t, account.probe.atMs, nowMs)
														}),
														account.probe.modelId === void 0 || account.probe.modelId === "" || account.probe.modelId === saved.targetModelId ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: "dsm-qoder-pool-prov-sep",
															children: "·"
														}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: "dsm-qoder-pool-probe-scope",
															title: t("row.poolProbeOtherModelHint"),
															children: t("row.poolProbeOtherModel", { model: account.probe.modelId })
														})] })
													]
												})]
											}),
											checkinOn ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "dsm-qoder-pool-checkin",
												children: account.checkedInToday === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dsm-qoder-pool-unknown",
													title: t("row.poolNeverTested"),
													children: t("row.poolCheckinUnknown")
												}) : account.checkedInToday ? checkinCountdown.state === "ticking" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dsm-qoder-pool-checkin-next",
													title: t("row.poolCheckinNextHint"),
													children: t("row.poolCheckinNext", { countdown: checkinCountdown.text })
												}) : checkinCountdown.state === "due" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dsm-qoder-pool-checkin-due",
													title: t("row.poolCheckinDueHint"),
													children: t("row.poolCheckinDue")
												}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dsm-qoder-pool-checked",
													children: t("row.poolCheckedIn")
												}) : t("row.poolNotCheckedIn")
											}) : null,
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
												className: "dsm-qoder-pool-row-actions",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: "dsm-btn dsm-btn-outline dsm-qoder-pool-small-btn",
													title: rowTestingId === account.accountId ? t("row.poolTesting") : t("row.poolRowTest"),
													"aria-label": rowTestingId === account.accountId ? t("row.poolTesting") : t("row.poolRowTest"),
													disabled: !canEditPool || batchBusy || rowTestBusy || targetMisses,
													onClick: () => {
														runTestBatch(account.accountId);
													},
													children: rowTestingId === account.accountId ? t("row.poolTesting") : t("row.poolRowTest")
												}), account.source !== "vault" ? null : confirmDeleteId === account.accountId ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
													className: "dsm-qoder-pool-confirm",
													role: "group",
													"aria-label": t("row.poolDeleteConfirmAria", { accountName: name }),
													children: [
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: "dsm-qoder-pool-confirm-text",
															children: t("row.poolDeleteConfirm", { accountName: name })
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
															type: "button",
															className: "dsm-btn dsm-btn-danger dsm-qoder-pool-small-btn",
															disabled: removingId !== void 0,
															onClick: () => {
																runDeleteAccount(account.accountId);
															},
															children: t("row.poolDeleteConfirmYes")
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
															type: "button",
															className: "dsm-btn dsm-btn-outline dsm-qoder-pool-small-btn",
															disabled: removingId !== void 0,
															onClick: () => setConfirmDeleteId(void 0),
															children: t("row.poolDeleteCancel")
														})
													]
												}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: "dsm-btn dsm-btn-outline dsm-qoder-pool-small-btn dsm-qoder-pool-delete-btn",
													title: t("row.poolRowDeleteHint"),
													"aria-label": t("row.poolRowDeleteAria", { accountName: name }),
													disabled: !canEditPool || removingId !== void 0,
													onClick: () => {
														setConfirmDeleteId(account.accountId);
													},
													children: removingId === account.accountId ? t("row.poolRowDeleting") : t("row.poolRowDelete")
												})]
											})
										]
									}, account.accountId);
								})]
							})
						]
					}),
					dirty && !sameIds(active.memberAccountIds, saved.memberAccountIds) ? (0, react.createElement)("p", { className: "dsm-qoder-pool-dirty" }, t("row.poolUnsavedMembers")) : null,
					pool?.targetModelSource === "none" ? (0, react.createElement)("p", {
						className: "dsm-qoder-pool-warn",
						role: "status"
					}, `${t("row.poolTargetNone")} ${t("row.poolTargetNoneHint")}`) : null,
					pool?.targetModelSource === "stale" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsm-qoder-pool-conflict",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: "dsm-qoder-pool-conflict-main",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", { children: t("row.poolTargetStale", { model: pool.staleTargetModelId ?? "" }) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("row.poolTargetStaleHint") })]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "dsm-btn dsm-btn-outline",
							disabled: !canEditPool,
							onClick: () => {
								editDraft((current) => ({
									...current,
									targetModelId: ""
								}));
							},
							children: t("row.poolTargetStaleClear")
						})]
					}) : null,
					actionError === void 0 ? null : (0, react.createElement)("p", {
						className: "dsm-qoder-pool-error",
						role: "alert"
					}, actionError),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(RenderSettings, {
						t,
						active,
						dirty,
						saving,
						canEditPool,
						saveError,
						catalog: pool?.catalog,
						targetProvenance,
						accountTools,
						onEdit: editDraft,
						onSave: () => {
							savePool();
						},
						onDiscard: () => {
							setDraftPool(saved);
							setDraftRegion(region);
							setDirty(false);
							setSaveError(void 0);
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsm-qoder-pool-log",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsm-qoder-pool-log-head",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("row.poolLogTitle") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dsm-btn dsm-btn-outline dsm-qoder-pool-log-clear",
								onClick: () => {
									logStore.set(region, []);
									setLog([]);
								},
								children: t("row.poolLogClear")
							})]
						}), log.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dsm-qoder-pool-log-empty",
							children: t("row.poolLogEmpty")
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dsm-qoder-pool-log-body",
							children: [...log].map((entry, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsm-qoder-pool-log-row",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsm-qoder-pool-log-time",
									children: formatClock$1(entry.atMs)
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: `dsm-qoder-pool-log-text dsm-qoder-pool-log-${entry.tone}`,
									children: entry.text
								})]
							}, `${entry.atMs}-${index}`))
						})]
					})
				]
			});
		}
		function RenderSettings(props) {
			const { t, active, dirty, saving, canEditPool, saveError, catalog, targetProvenance, accountTools, onEdit, onSave, onDiscard } = props;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsm-qoder-pool-settings-wrap",
				children: [
					accountTools === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsm-qoder-pool-tools",
						children: accountTools
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsm-qoder-pool-settings",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsm-qoder-pool-set",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsm-qoder-pool-set-copy",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", { children: t("row.poolTargetLabel") }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [targetProvenance === null ? null : `${targetProvenance} `, t("row.poolTargetHint")] })]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsm-qoder-pool-set-ctl",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
									className: "dsm-qoder-pool-select",
									value: active.targetModelId,
									disabled: !canEditPool,
									onChange: (e) => onEdit((prev) => ({
										...prev,
										targetModelId: e.target.value
									})),
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: "",
											children: t("row.poolTargetAutoOption")
										}),
										active.targetModelId !== "" && !(catalog ?? []).some((m) => m.id === active.targetModelId) ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: active.targetModelId,
											disabled: true,
											children: t("row.poolTargetStaleOption", { model: active.targetModelId })
										}) : null,
										(catalog ?? []).map((model) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: model.id,
											children: model.creditMultiplier === void 0 ? model.name : `${model.name} (x${displayMultiplierOf({
												priceFactor: model.creditMultiplier,
												promotion: model.promotion
											}, /* @__PURE__ */ new Date()).toFixed(2)})`
										}, model.id))
									]
								})
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsm-qoder-pool-set",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsm-qoder-pool-set-copy",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", { children: t("row.poolProbeSizeLabel") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("row.poolProbeSizeHint") })]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsm-qoder-pool-set-ctl",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
									className: "dsm-qoder-pool-select",
									value: String(active.probeInputTokens),
									disabled: !canEditPool,
									onChange: (e) => onEdit((prev) => ({
										...prev,
										probeInputTokens: Number(e.target.value)
									})),
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: "0",
										children: t("row.poolProbeSizeDefault")
									}), PROBE_INPUT_TOKEN_CHOICES.map((tokens) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: String(tokens),
										children: t("row.poolProbeSizeOption", { tokens: String(Math.round(tokens / 1e3)) })
									}, String(tokens)))]
								})
							})]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsm-qoder-pool-save-bar",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("a", {
							className: "dsm-qoder-usage-cheer",
							href: QODER_GITHUB_URL,
							target: "_blank",
							rel: "noopener noreferrer",
							children: [t("row.cheer"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dsm-qoder-usage-cheer-star",
								"aria-hidden": "true",
								children: "★"
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsm-qoder-pool-save-buttons",
							children: [
								saveError === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsm-qoder-pool-pending",
									children: saveError
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "dsm-btn dsm-btn-outline",
									disabled: !canEditPool || saving || !dirty,
									onClick: onDiscard,
									children: t("row.poolDiscard")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "dsm-btn dsm-btn-primary",
									disabled: !canEditPool || saving || !dirty,
									onClick: onSave,
									children: saving ? t("row.poolSaving") : t("row.poolSaved")
								})
							]
						})]
					})
				]
			});
		}
		function parseTestRow(value) {
			if (typeof value !== "object" || value === null) return void 0;
			const row = value;
			const accountId = typeof row["accountId"] === "string" ? row["accountId"] : void 0;
			const accountName = typeof row["accountName"] === "string" ? row["accountName"] : void 0;
			const result = row["result"];
			if (accountId === void 0 || accountName === void 0 || typeof result !== "object" || result === null) return void 0;
			return {
				accountId,
				accountName,
				result
			};
		}
		function parseCheckinRow(value) {
			if (typeof value !== "object" || value === null) return void 0;
			const row = value;
			const accountId = typeof row["accountId"] === "string" ? row["accountId"] : void 0;
			const accountName = typeof row["accountName"] === "string" ? row["accountName"] : void 0;
			const status = row["status"];
			if (accountId === void 0 || accountName === void 0) return void 0;
			if (status !== "claimed" && status !== "already" && status !== "failed") return void 0;
			return {
				accountId,
				accountName,
				status,
				...typeof row["credit"] === "number" ? { credit: row["credit"] } : {},
				...typeof row["validityDays"] === "number" ? { validityDays: row["validityDays"] } : {},
				...typeof row["message"] === "string" ? { message: row["message"] } : {}
			};
		}
		/** 一行签到日志的文案（三态各说各的，`already` 不能写成失败）。 */
		function checkinLogText(t, row) {
			if (row.status === "claimed") return row.credit === void 0 ? t("row.poolLogCheckinClaimed", { accountName: row.accountName }) : t("row.poolLogCheckinClaimedAmount", {
				accountName: row.accountName,
				credit: String(row.credit)
			});
			if (row.status === "already") return t("row.poolLogCheckinAlready", { accountName: row.accountName });
			return t("row.poolLogCheckinFailed", {
				accountName: row.accountName,
				message: row.message ?? t("row.poolCheckinUnknown")
			});
		}
		function sameIds(a, b) {
			if (a.length !== b.length) return false;
			const set = new Set(b);
			return a.every((id) => set.has(id));
		}
		/**
		* 溯源药丸的样式类（workbuddy 的 probeLabel 同规）：来源未知用带描边的
		* 「未知」态——它必须与「测试写入」的默认态看得出区别，否则一条旧记录
		* 看起来就像刚测过。
		*/
		function probeSourceClass(source) {
			if (source === void 0) return "dsm-qoder-pool-prov-tag dsm-qoder-pool-prov-unknown";
			return source === "live-request" ? "dsm-qoder-pool-prov-tag dsm-qoder-pool-prov-live" : "dsm-qoder-pool-prov-tag";
		}
		/**
		* 成员行状态点的颜色。
		*
		* 判定与配色都移到了 `account-state.ts`：composer 小面板要画同一个点的颜色，
		* 两处各写一份迟早会分叉（本轮就是这样——面板的点根本没看数据）。
		*/
		function stateColor(account) {
			return accountStateColor(accountDotTone({
				current: account.current === true,
				...account.excludedBy === void 0 ? {} : { excludedBy: account.excludedBy },
				...account.probe === void 0 ? {} : { probeOutcome: account.probe.outcome }
			}));
		}
		/**
		* 按优先级重排账号行。
		*
		* **可用性压过用户顺序**，与宿主 `rankPool` 的第 1 层用的是同一条规则
		* （`excludedBy === undefined`）。这条不能只在宿主生效而表格不管：
		* 用户实拍（2026-10-18）——`account-a` 用量已达上限却被排在第 1 位，
		* 而第 2 位的 `account-b` 写着「✓ 可用」。请求实际发给的是
		* 第 2 位，表格却宣称第 1 位优先。**名次表撒谎比没有名次表更糟**。
		*
		* 用户仍能决定「能用的号之间谁先」，出池的号只是沉到末尾 —— 它们在池里
		* 也仍然显示名次，只是不参与优先。
		*
		* 名单外的账号（非成员、或还没排过序的）保持宿主给的相对顺序接在末尾：
		* 稳定排序保证同样的输入永远得到同样的行序，否则表格会在每次快照回流时
		* 无声地抖动 —— 那种「自己会跳」的表比排错更让人不敢用。
		*/
		function sortAccountsByOrder(accounts, orderIds) {
			if (orderIds.length === 0) return accounts;
			const rank = /* @__PURE__ */ new Map();
			for (const [index, id] of orderIds.entries()) if (!rank.has(id)) rank.set(id, index);
			const fallback = orderIds.length;
			return accounts.map((account, index) => ({
				account,
				index,
				usable: account.excludedBy === void 0,
				rank: rank.get(account.accountId) ?? fallback
			})).sort((left, right) => {
				if (left.usable !== right.usable) return left.usable ? -1 : 1;
				return left.rank - right.rank || left.index - right.index;
			}).map((entry) => entry.account);
		}
		/** 统计同名字号出现次数（`accountName` 为空串也算一组，显示名会是「未命名」）。 */
		function nameCountsOf(accounts) {
			const counts = /* @__PURE__ */ new Map();
			for (const account of accounts) counts.set(account.accountName, (counts.get(account.accountName) ?? 0) + 1);
			return counts;
		}
		/**
		* 「使用哪个账号」下拉里一个账号显示成什么。
		*
		* 同名账号必须还能分辨：同一个邮箱重新签发 PAT 会得到**两条**记录（id 由 PAT
		* 推导，是不同的），两条显示名一模一样。只显示名字的话，「我当前在用哪一条」
		* 这个问题的答案是「看不出」——用户实拍的就是这种两条同名、一条已过期的情况。
		* 重名时补 id 尾号（id 形如 `pat-0123456789abcdef`，末 4 位足够区分）。
		*
		* 这里**不**再加「使用中」后缀：下拉的选中值本身就是当前在服务的账号，头部还
		* 有一枚 `row.poolCurrentHeader` 标签，同一个事实说三遍反而是噪音。
		*/
		function poolAccountLabel(t, account, counts) {
			const base = account.accountName === "" ? t("row.accountUnnamed") : account.accountName;
			return (counts.get(account.accountName) ?? 0) > 1 ? `${base} · ${account.accountId.slice(-4)}` : base;
		}
		//#endregion
		//#region src/client/AddAccount.tsx
		/**
		* The card's Add-PAT section: one resting bar row plus a dialog opened by the
		* "Add PAT" button.
		*
		* 参考：dingminhua/dsh-connect-workbuddy（MIT，Copyright (c) 2026 LaoDing）
		*   — 该项目的 `OAuthSignIn.tsx` 的组件形态：静态入口一行 + 弹窗 + 就地管理全部
		*     状态（busy / 结果 / 错误）+ 完成后回调让卡片重新读取快照。样式沿用
		*     transfer-dialog / bar 类。
		* 改动：Qoder 用 PAT 而不是桌面端 OAuth——扫码/网页登录整块替换为「粘贴 pt-…
		*   触发添加」的普通表单。Host 用 JobToken 交换验证该 token（合法才取得到显示
		*   名并创建 vault 条目），客户端只在格式上做前置校验（期望 `pt-` 前缀），把
		*   真正的验证留给 Host。
		*
		* @module dsh-connect-qoder/client/AddAccount
		*/
		/** PAT is the Qoder token shape; a trivially-wrong paste fails before the POST. */
		function looksLikePat(value) {
			return /^pt-/u.test(value.trim());
		}
		/**
		* The section. Rendered on BOTH account states: a region with no account gains
		* its first here; a signed-in one can add another without leaving the card.
		*/
		function AddAccount({ t, region, onAdded }) {
			const [phase, setPhase] = (0, react.useState)({ kind: "idle" });
			const [dialogOpen, setDialogOpen] = (0, react.useState)(false);
			const [pat, setPat] = (0, react.useState)("");
			const [name, setName] = (0, react.useState)("");
			const [touched, setTouched] = (0, react.useState)(false);
			const mounted = (0, react.useRef)(true);
			(0, react.useEffect)(() => {
				mounted.current = true;
				return () => {
					mounted.current = false;
				};
			}, []);
			const closeDialog = () => {
				if (phase.kind === "validating" || phase.kind === "syncing") return;
				setDialogOpen(false);
				setPhase({ kind: "idle" });
				setPat("");
				setName("");
				setTouched(false);
			};
			const runAdd = async () => {
				const trimmed = pat.trim();
				if (!looksLikePat(trimmed)) {
					setPhase({
						kind: "error",
						message: t("row.addAccountInvalid")
					});
					return;
				}
				setPhase({ kind: "validating" });
				try {
					const response = await fetch(withQoderRouteAction(QODER_ACCOUNTS_PATH, region, "add"), {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						credentials: "same-origin",
						body: JSON.stringify({
							pat: trimmed,
							...name.trim() === "" ? {} : { name: name.trim() }
						})
					});
					const body = await response.json().catch(() => ({}));
					if (!response.ok) throw new Error(body.error ?? `HTTP ${String(response.status)}`);
					if (body.accountId === void 0) throw new Error(t("row.addAccountError", { message: `HTTP ${String(response.status)}` }));
					if (!mounted.current) return;
					setPhase({ kind: "syncing" });
					await onAdded?.();
					if (!mounted.current) return;
					setPhase({
						kind: "done",
						accountName: name.trim() !== "" ? name.trim() : t("row.accountUnnamed")
					});
					setPat("");
					setName("");
					setTouched(false);
				} catch (error) {
					if (!mounted.current) return;
					setPhase({
						kind: "error",
						message: t("row.addAccountError", { message: String(error?.message ?? error) })
					});
				}
			};
			const finishText = phase.kind === "done" ? t("row.addAccountDone", { accountName: phase.accountName }) : phase.kind === "error" ? phase.message : "";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: "dsm-qoder-bar",
				"aria-label": t("row.addAccountStart"),
				children: [
					finishText === "" ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: `dsm-qoder-bar-status ${phase.kind === "done" ? "dsm-qoder-bar-ok" : "dsm-qoder-bar-error"}`,
						children: finishText
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsm-qoder-bar-actions",
						role: "group",
						"aria-label": t("row.addAccountStart"),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "dsm-btn dsm-btn-outline",
							onClick: () => {
								setPat("");
								setName("");
								setTouched(false);
								setPhase({ kind: "idle" });
								setDialogOpen(true);
							},
							children: t("row.addAccountStart")
						})
					}),
					dialogOpen ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsm-qoder-transfer-dialog",
						role: "dialog",
						"aria-label": t("row.addAccountTitle"),
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("row.addAccountTitle") }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: "dsm-qoder-addpat-input",
								type: "password",
								autoComplete: "off",
								spellCheck: false,
								placeholder: t("row.addAccountPlaceholder"),
								value: pat,
								onChange: (event) => {
									setPat(event.target.value);
									setTouched(true);
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: "dsm-qoder-addpat-name",
								type: "text",
								placeholder: t("row.addAccountNameHint"),
								value: name,
								onChange: (event) => {
									setName(event.target.value);
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsm-qoder-addpat-origin",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("row.addAccountPatHint", { domain: QODER_CONSOLE_DOMAIN[region] }) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dsm-qoder-addpat-doc",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
										href: QODER_PAT_DOC_URL,
										target: "_blank",
										rel: "noopener noreferrer",
										children: t("row.docsHint")
									})
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsm-qoder-addpat-verify",
								children: t("row.addAccountTouchedOnce")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsm-qoder-transfer-dialog-actions",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "dsm-btn dsm-btn-outline",
									onClick: closeDialog,
									children: t("row.addAccountDialogClose")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "dsm-btn dsm-btn-primary",
									disabled: phase.kind === "validating" || phase.kind === "syncing" || !touched,
									onClick: () => {
										runAdd();
									},
									children: phase.kind === "validating" ? t("row.addAccountValidating") : t("row.addAccountStart")
								})]
							}),
							finishText !== "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: `dsm-qoder-bar-${phase.kind === "done" ? "ok" : "error"}`,
								role: "status",
								children: finishText
							}) : null
						]
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(BusyOverlay, {
						message: t("row.addAccountSyncing"),
						hint: t("row.veilHintList"),
						visible: phase.kind === "syncing"
					})
				]
			});
		}
		//#endregion
		//#region src/client/AccountTransfer.tsx
		/**
		* The card's account-transfer section: batch export / import of the region's
		* stored credentials, in the file format shared with sibling credential
		* managers for the same upstream.
		*
		* 参考：dingminhua/dsh-connect-workbuddy（MIT，Copyright (c) 2026 LaoDing）
		*   — 该项目的 `AccountTransfer.tsx`：导出弹框（多选账号 → 下载 JSON）与导入
		*     弹框（选文件 → 脱敏预览 → 勾选 → 导入）的步骤划分、`<a download>` Blob
		*     下载（设置页 iframe 无宿主保存对话框）。
		* 改动：按 Qoder 的传输契约（`src/status-paths.ts` 的 `QoderTransferRecord`
		*   snake_case 记录：`access_token` / `uid` / `nickname` / `email` / `domain`）
		*   与 Host 的 transfer 路由（export / preview / import）适配。
		*
		* @module dsh-connect-qoder/client/AccountTransfer
		*/
		/** Build the default export file name: qoder-accounts-YYYY-MM-DD.json. */
		function exportFileName() {
			const pad = (value) => String(value).padStart(2, "0");
			const d = /* @__PURE__ */ new Date();
			return `qoder-accounts-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
		}
		/** Download a JSON array as a local file (no host save dialog inside the iframe). */
		function downloadJson(fileName, data) {
			const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
			const url = URL.createObjectURL(blob);
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = fileName;
			document.body.appendChild(anchor);
			anchor.click();
			anchor.remove();
			URL.revokeObjectURL(url);
		}
		/**
		* The section. Rendered on both account states — a region with no account can
		* still import a file exported elsewhere; export without accounts answers the
		* error line.
		*/
		function AccountTransfer({ t, region, accounts, onChanged }) {
			const [phase, setPhase] = (0, react.useState)({ kind: "idle" });
			const [dialog, setDialog] = (0, react.useState)(void 0);
			const [selected, setSelected] = (0, react.useState)(/* @__PURE__ */ new Set());
			const [preview, setPreview] = (0, react.useState)(void 0);
			const [importSelected, setImportSelected] = (0, react.useState)(/* @__PURE__ */ new Set());
			const fileInput = (0, react.useRef)(null);
			const mounted = (0, react.useRef)(true);
			(0, react.useEffect)(() => {
				mounted.current = true;
				return () => {
					mounted.current = false;
				};
			}, []);
			const closeDialog = () => {
				if (phase.kind === "exporting" || phase.kind === "importing" || phase.kind === "refreshing") return;
				setDialog(void 0);
				setSelected(/* @__PURE__ */ new Set());
				setPreview(void 0);
				setImportSelected(/* @__PURE__ */ new Set());
				setPhase({ kind: "idle" });
			};
			const transferPost = async (action, body) => {
				const response = await fetch(withQoderRouteAction(QODER_TRANSFER_PATH, region, action), {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					credentials: "same-origin",
					body: JSON.stringify(body)
				});
				const parsed = await response.json().catch(() => ({}));
				if (!response.ok) throw new Error(parsed.error ?? `HTTP ${String(response.status)}`);
				return parsed;
			};
			const runExport = async () => {
				setPhase({ kind: "exporting" });
				try {
					const answer = await transferPost("export", {});
					if (!mounted.current) return;
					if (selected.size === 0 || answer.accounts.length === 0) {
						setPhase({
							kind: "error",
							message: t("row.transferError", { message: "no selection" })
						});
						return;
					}
					const wanted = /* @__PURE__ */ new Set([...selected]);
					const projected = answer.accounts.filter((record) => wanted.has(record.uid ?? "") || wanted.has(record.nickname ?? "") || wanted.has(record.email ?? ""));
					const fileName = exportFileName();
					downloadJson(fileName, projected.length > 0 ? projected : answer.accounts);
					setPhase({
						kind: "done",
						message: t("row.transferExported", {
							count: projected.length > 0 ? projected.length : answer.accounts.length,
							fileName
						})
					});
				} catch (error) {
					if (!mounted.current) return;
					setPhase({
						kind: "error",
						message: t("row.transferError", { message: String(error?.message ?? error) })
					});
				}
			};
			const runImport = async () => {
				const file = fileInput.current?.files?.[0];
				if (file === void 0) return;
				setPhase({ kind: "importing" });
				try {
					const text = await file.text();
					const previewAnswer = await transferPost("preview", { text });
					if (!mounted.current) return;
					setPreview(previewAnswer.accounts);
					setImportSelected(new Set(previewAnswer.accounts.map((entry) => entry.index)));
					setPhase({ kind: "idle" });
				} catch (error) {
					if (!mounted.current) return;
					setPhase({
						kind: "error",
						message: t("row.transferError", { message: String(error?.message ?? error) })
					});
				}
			};
			const runImportConfirm = async () => {
				const file = fileInput.current?.files?.[0];
				if (file === void 0) return;
				const text = await file.text();
				setPhase({ kind: "importing" });
				try {
					const indexes = [...importSelected];
					const answer = await transferPost("import", {
						text,
						indexes
					});
					if (!mounted.current) return;
					setPhase({
						kind: "refreshing",
						message: t("row.transferImported", {
							imported: answer.imported,
							skipped: answer.skipped
						})
					});
					await onChanged?.();
					if (!mounted.current) return;
					setPhase({
						kind: "done",
						message: t("row.transferImported", {
							imported: answer.imported,
							skipped: answer.skipped
						})
					});
					closeDialog();
				} catch (error) {
					if (!mounted.current) return;
					setPhase({
						kind: "error",
						message: t("row.transferError", { message: String(error?.message ?? error) })
					});
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: "dsm-qoder-bar",
				"aria-label": t("row.transferTitle"),
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(BusyOverlay, {
						message: phase.kind === "refreshing" || phase.kind === "importing" ? t("row.transferImporting") : t("row.transferExporting"),
						hint: t("row.veilHintList"),
						visible: phase.kind === "importing" || phase.kind === "refreshing"
					}),
					phase.kind === "done" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dsm-qoder-bar-status dsm-qoder-bar-ok",
						children: phase.message
					}) : phase.kind === "error" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dsm-qoder-bar-status dsm-qoder-bar-error",
						children: phase.message
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsm-qoder-bar-actions",
						role: "group",
						"aria-label": t("row.transferTitle"),
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "dsm-btn dsm-btn-outline",
							disabled: accounts.length === 0,
							onClick: () => {
								closeDialog();
								setDialog("export");
								setPhase({ kind: "idle" });
							},
							children: t("row.transferExport")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "dsm-btn dsm-btn-outline",
							onClick: () => {
								closeDialog();
								setDialog("import");
								setPhase({ kind: "idle" });
							},
							children: t("row.transferImport")
						})]
					}),
					dialog === "export" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsm-qoder-transfer-dialog",
						role: "dialog",
						"aria-label": t("row.transferExport"),
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("row.transferExportPick", { total: accounts.length }) }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
								className: "dsm-qoder-transfer-list",
								children: accounts.map((account) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "checkbox",
									checked: selected.has(account.id),
									onChange: (event) => {
										const next = new Set(selected);
										if (event.target.checked) next.add(account.id);
										else next.delete(account.id);
										setSelected(next);
									}
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: account.accountName === "" ? t("row.accountUnnamed") : account.accountName })] }) }, account.id))
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsm-qoder-transfer-dialog-actions",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "dsm-btn dsm-btn-outline",
									onClick: closeDialog,
									children: t("row.transferCancel")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "dsm-btn dsm-btn-primary",
									disabled: selected.size === 0 || phase.kind === "exporting",
									onClick: () => {
										runExport();
									},
									children: phase.kind === "exporting" ? t("row.transferExporting") : t("row.transferExportConfirm", { count: selected.size })
								})]
							}),
							phase.kind === "done" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsm-qoder-bar-ok",
								role: "status",
								children: phase.message
							}) : null,
							phase.kind === "error" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsm-qoder-bar-error",
								role: "alert",
								children: phase.message
							}) : null
						]
					}) : null,
					dialog === "import" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsm-qoder-transfer-dialog",
						role: "dialog",
						"aria-label": t("row.transferImport"),
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("row.transferHint") }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsm-qoder-transfer",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									ref: fileInput,
									className: "dsm-qoder-transfer-file",
									type: "file",
									accept: ".json,application/json",
									onChange: () => {
										runImport();
									}
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "dsm-btn dsm-btn-outline",
									onClick: () => {
										fileInput.current?.click();
									},
									children: t("row.transferImport")
								})]
							}),
							phase.kind === "refreshing" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsm-qoder-bar-status",
								role: "status",
								children: phase.message
							}) : null,
							preview !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("row.transferPreviewTotal", { total: preview.length }) }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
									className: "dsm-qoder-transfer-list",
									children: preview.map((entry) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "checkbox",
										checked: importSelected.has(entry.index),
										onChange: (event) => {
											const next = new Set(importSelected);
											if (event.target.checked) next.add(entry.index);
											else next.delete(entry.index);
											setImportSelected(next);
										}
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [entry.nickname.trim() === "" ? t("row.transferEntryUnknown") : entry.nickname, entry.hasToken ? "" : ` (${t("row.transferNoToken")})`] })] }) }, entry.index))
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsm-qoder-transfer-dialog-actions",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "dsm-btn dsm-btn-outline",
										onClick: closeDialog,
										children: t("row.transferCancel")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "dsm-btn dsm-btn-primary",
										disabled: importSelected.size === 0 || phase.kind === "importing",
										onClick: () => {
											runImportConfirm();
										},
										children: phase.kind === "importing" ? t("row.transferImporting") : t("row.transferImportConfirm", { count: importSelected.size })
									})]
								})
							] }) : null,
							phase.kind === "done" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsm-qoder-bar-ok",
								role: "status",
								children: phase.message
							}) : null,
							phase.kind === "error" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsm-qoder-bar-error",
								role: "alert",
								children: phase.message
							}) : null
						]
					}) : null
				]
			});
		}
		//#endregion
		//#region src/client/promo-badge.ts
		/**
		* 界面语言，由浏览器报告。
		*
		* 只在拿不到宿主语言时当兜底（见 `hostLanguage`）。`navigator` 防御性读取：这个
		* 模块会被运行在纯 Node 环境的单测导入。
		*/
		function uiLanguage() {
			return typeof navigator === "undefined" ? "" : navigator.language;
		}
		/**
		* 卡片按哪一种语言选上游文案。
		*
		* **宿主的界面语言优先**：DSH 允许在设置里切换界面语言，而浏览器语言不会跟着变，
		* 只看 `navigator.language` 会出现「中文界面配英文胶囊」。宿主绑定好的 `t` 是唯一
		* 我们能读到的语言信号（它按当前语言解析），所以用一条只给机器读的字典项
		* （`promo.locale`）把语言名问出来；读不到（未绑定 / 单测里的直通 `t`）才退回浏览器。
		*/
		function hostLanguage(t) {
			const marker = t?.("promo.locale");
			if (marker === void 0 || marker === "" || marker === "promo.locale") return uiLanguage();
			return marker;
		}
		/** 该语言是否属于英语。 */
		function isEnglish$1(language) {
			return (language ?? "").toLowerCase().startsWith("en");
		}
		/**
		* 胶囊上的文案。
		*
		* 中文界面优先上游的 `zh`，英文界面优先 `en`；缺哪边就用另一边——上游两个区域
		* 都同时发中英，但字段可能只写了一半（国内 `qmodel` 的 `zh` 是「错峰4折」而
		* 国际同一行写「错峰 4 折」，空格也不一样，都是上游的写法，一律原样）。
		*/
		function promoBadgeLabel(promo, language) {
			const { zh, en } = promo.badge;
			return isEnglish$1(language) ? en ?? zh : zh ?? en;
		}
		/** 双语字段按界面语言取一侧。 */
		function pick(copy, language) {
			if (copy === void 0) return void 0;
			return isEnglish$1(language) ? copy.en ?? copy.zh : copy.zh ?? copy.en;
		}
		/**
		* 胶囊的悬停：上游的描述、活动时段（含时区）、上游的说明页。
		*
		* 空项直接略去，而不是渲染空分隔符——只发了一个 `badge` 的规则就只有一个悬停
		* 标题，不会拖一串 `· ·`。
		*/
		function promoBadgeTooltip(promo, language) {
			const parts = [];
			const description = pick(promo.description, language);
			if (description !== void 0) parts.push(description);
			const window = promo.window;
			if (window !== void 0) {
				const zone = promo.timeZone;
				const hours = zone === void 0 ? `${window.start}–${window.end}` : `${window.start}–${window.end} (${zone})`;
				parts.push(hours);
			}
			const link = pick(promo.link, language);
			if (link !== void 0) parts.push(link);
			return parts.join(" · ");
		}
		/**
		* 倍率标签的悬停（issue #41）：显示的是活动实际价时，补一句「这是活动价，
		* 基准价是 N.NN」，避免用户拿它去和别处（或下个月的账单）对不上而误以为出错。
		*
		* 只有显示倍率与基准价**不同**时才给提示；相同（没有折扣、窗口外、不采信折扣）
		* 时返回 `undefined`，调用方不挂 title——没有差异就不必解释。
		*
		* 这句是插件自己写的解释，不是上游的话：上游 `promotion` 只给折扣数字，没给
		* 「基准价是多少」的文案，而用户需要知道屏幕上那个 0 是活动价（与「免费」徽标
		* 的判据解释 `row.modelFreeHint` 同一类用法）。
		*
		* @param source - 该模型的基准价与活动规则。
		* @param now - 与显示倍率同一个渲染时刻，保证「显示值」与「提示里的基准价」同源。
		* @param t - 当前界面的翻译函数。
		*/
		function rateHint(source, now, t) {
			if (displayMultiplierOf(source, now) === source.priceFactor) return void 0;
			const key = "row.ratePromoHint";
			const template = t?.(key, { base: source.priceFactor.toFixed(2) }) ?? key;
			return template === key ? `Base rate x${source.priceFactor.toFixed(2)} during this promotion` : template;
		}
		//#endregion
		//#region src/client/Campaigns.tsx
		/**
		* Card section: the provider's campaigns (活动) for one region.
		*
		* Answers the readout the host's `/campaigns` route produces for `/me/campaigns`:
		* the daily 100-Credits check-in row plus every `VIEW_DETAILS` banner the upstream
		* currently sends. Read-only — nothing here writes to the account. Claiming stays
		* where it has always been (the account-pool 签到 column, a deliberate user action).
		*
		* 为什么单独成一个文件而不是塞进 `QoderCard`：这份渲染有自己的状态（每个区域一次
		* 懒加载、错误态、AbortController 清理）和一套独立样式，`QoderCard` 已经很长了。
		*
		* 三个刻意的取舍：
		* 1. **不发明标题**——只有上游 `placements[].content.{zh,en}` 给了标题才显示，
		*    空则退回 `row.campaignUntitled`，绝不拿 campaignId 编一句「限时活动」；
		* 2. **不画绝对到期时间**——`endAt` 是 UTC 时间戳，把它换算成当地墙上时间很容易
		*    写错时区（上游文案自己已经写清「每日 10:00（UTC+8）刷新」），所以这里只呈现
		*    状态词（可领取 / 已领取）与上游给到的描述；
		* 3. **上游没下发就不出现**——`campaigns: []` 时只显示一行静默的「暂无活动」，
		*    不会凭空造一个 banner；读取失败显示原因，而不是把「读不到」伪装成「没有」。
		*
		* @module dsh-connect-qoder/client/Campaigns
		*/
		/** 每行状态词对应的本地化键。 */
		const CLAIM_KEYS = {
			CLAIMABLE: "row.campaignClaimable",
			CLAIMED: "row.campaignClaimed"
		};
		/** 上游状态 → 本地化键；未知状态不渲染状态词（只给标题/描述/链接）。 */
		function claimKeyOf(status) {
			if (status === "CLAIMABLE" || status === "CLAIMED") return status;
		}
		/** 该语言是否属于英语（与 `promo-badge.ts` 的同一判据）。 */
		function isEnglish(language) {
			return (language ?? "").toLowerCase().startsWith("en");
		}
		/** 按界面语言取上游的双语活动文案；缺哪边用另一边。 */
		function pickContent(content, language) {
			if (content === void 0 || Object.keys(content).length === 0) return void 0;
			const direct = isEnglish(language) ? "en" : "zh";
			const fallback = isEnglish(language) ? "zh" : "en";
			return content[direct] ?? content[fallback];
		}
		/** 把 feed 里的每条活动投影成可渲染行（`key` 保证列表稳定）。 */
		function rowOf(campaign, feed, language, t) {
			const content = pickContent(campaign.content, language);
			const title = content?.title ?? t("row.campaignUntitled");
			const description = content?.description;
			const detailUrl = content?.detailUrl ?? campaign.campaignUrl ?? feed.campaignUrl;
			return {
				key: campaign.campaignId ?? campaign.campaignKey ?? title,
				title,
				description,
				amount: campaign.amount,
				claimStatus: campaign.claimStatus,
				detailUrl: detailUrl === "" ? void 0 : detailUrl
			};
		}
		function QoderCampaigns(props) {
			const { region, t } = props;
			const language = hostLanguage(t);
			const controller = (0, react.useRef)(null);
			const [state, setState] = (0, react.useState)({
				feed: null,
				error: void 0,
				noCredential: false,
				loading: true
			});
			(0, react.useEffect)(() => {
				controller.current?.abort();
				const current = new AbortController();
				controller.current = current;
				setState((prev) => ({
					feed: prev.feed,
					error: void 0,
					noCredential: false,
					loading: true
				}));
				fetch(withQoderRegion(QODER_CAMPAIGNS_PATH, region), {
					headers: { accept: "application/json" },
					credentials: "same-origin",
					signal: current.signal
				}).then(async (response) => {
					if (!response.ok) {
						const body = await response.json().catch(() => ({}));
						const thrown = new Error(body.error ?? `HTTP ${String(response.status)}`);
						if (body.reason === "no-credential") Object.assign(thrown, { noCredential: true });
						throw thrown;
					}
					const feed = await response.json();
					if (current.signal.aborted) return;
					setState({
						feed,
						error: void 0,
						noCredential: false,
						loading: false
					});
				}).catch((error) => {
					if (current.signal.aborted) return;
					const message = error instanceof Error ? error.message : String(error);
					const noCredential = error?.noCredential === true;
					setState({
						feed: null,
						error: message,
						noCredential,
						loading: false
					});
				});
				return () => current.abort();
			}, [region]);
			const { feed, error, noCredential, loading } = state;
			const campaigns = feed?.campaigns ?? [];
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsm-qoder-campaigns",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dsm-qoder-campaigns-title",
						children: t("row.campaignsTitle")
					}),
					error !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dsm-qoder-campaigns-error",
						role: "alert",
						children: t("row.campaignsError", { message: error })
					}) : null,
					noCredential ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dsm-qoder-campaigns-hint",
						children: t("row.campaignsNoCredential")
					}) : null,
					error === void 0 && loading && campaigns.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dsm-qoder-campaigns-empty",
						children: t("row.campaignsLoading")
					}) : null,
					error === void 0 && !loading && campaigns.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dsm-qoder-campaigns-empty",
						children: t("row.campaignsEmpty")
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsm-qoder-campaigns-grid",
						children: campaigns.map((campaign) => {
							const row = rowOf(campaign, feed ?? { campaigns: [] }, language, t);
							const claimKey = campaign.actionType === "CLAIM_BENEFIT" ? claimKeyOf(campaign.claimStatus) : void 0;
							const status = claimKey === void 0 ? void 0 : t(CLAIM_KEYS[claimKey]);
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsm-qoder-campaign-row",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsm-qoder-campaign-row-head",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsm-qoder-campaign-row-title",
											children: row.title
										}), row.amount !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: "dsm-qoder-campaign-row-amount",
											children: [
												"+",
												row.amount,
												" Credits"
											]
										}) : null]
									}),
									row.description !== void 0 && row.description !== "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: "dsm-qoder-campaign-row-desc",
										title: row.description,
										children: row.description
									}) : null,
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsm-qoder-campaign-row-foot",
										children: [status !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: `dsm-qoder-campaign-row-status dsm-qoder-campaign-row-status-${row.claimStatus?.toLowerCase() ?? "unknown"}`,
											children: status
										}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {}), row.detailUrl !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
											className: "dsm-qoder-campaign-row-link",
											href: row.detailUrl,
											target: "_blank",
											rel: "noreferrer",
											children: t("row.campaignDetails")
										}) : null]
									})
								]
							}, row.key);
						})
					})
				]
			});
		}
		//#endregion
		//#region src/client/icon.ts
		/**
		* Plugin icon for the Qoder card header — the LD brand logo (64px) shared
		* across the LaoDing plugin family (dsh-connect-trae / dsh-connect-workbuddy /
		* dsh-connect-qoder …）。
		*
		* 家族约定：所有 connect-* 插件使用**同一张** LD 品牌标（蓝紫渐变圆角磁贴 +
		* 白色粗字标），让用户在插件列表与卡片头部一眼认出「这是同一家族的插件」。
		* 卡片标题、描述与配色才承载各自的产品名，图标不承载。
		*
		* 参考：dingminhua/dsh-connect-workbuddy（MIT，Copyright (c) 2026 LaoDing）
		*   — 同一 data URI 逐字沿用；其注释说明来自 dingminhua/dsh-connect-trae
		*     （MIT），再往上是 dingminhua/dsh-subagent-default-model（MIT）。
		* 改动：仅导出名改为 QODER_PLUGIN_ICON。
		*
		* @module dsh-connect-qoder/client/icon
		*/
		const QODER_PLUGIN_ICON = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAXGUlEQVR4nH1bC7BdVXn+1tr7nHPvzb3JvUloSAQp0JHWoAMttKOCFrWU8irQSbCTQYG21IahnTJUUTsM0FJhZCzCSIcKImOpDkhrhQ5YC7ROB3lUBU3EyCuBFBIIedzcx3ntvTr/a621TwIns3PO3mfvddf/+v7v/9c6DvYKoYBz1cZNYfJpVBcNBm7dcIhj3TBM15VzqAE6XAWEGggVADroOl0byDW+PtRr9E732rl9r2PxOMNsrCogVE7PA0Kge4Lcz5/TGI6v00UaK+h98u4QUA9quIDg4Pe2i2LTsknc++mzZu9cv37VHNaFAveSJICj/9aFUNzrXHXSTwdnznl/Y+X9MaEP1D0A/ToKaUdDASoAK0YVYcLad/G88S6C1aQcOkI2Nj9HylBFBRMYqPUeFp6EDXQfKcIUoud6LQQP59rwrsBEOdhy9KGDK/7j9mUPmBKcCf++Z4YbF6eKLw+6QFioKl/DoYILlXMsHE2KPCCzwlsqoNb3oUw4Kq+2a0k4G4MtXOX3J4HNyulzUkC0eqYI8ZAaQZQSAh9080Qx1m7jHStnL/3B3ctvXbcuFOwBH/p5OG12DA/29leV6wcHeI8hadE1rBldl/6ACs7WMEuz0PIcKawe0Gdzeyf36eTzcOHxVAEpTEQB0QtY0PRZPMYsX+t3tSqBxkteYeHh6qqu6yIsmVhaHHtE7/fu/8fJhzzF/OywunXQR+DJOO9pkLp2NJ64pIXhaOxb/IfmJM29PemSJ+NSzJP1s2dhwmucJ6uaoIYFzVjnkFDhLRTkb2XC03gQTKDrZNjSV1icXwzPv9y99Z5Hw6R/psQnqoniyLBQ1d65IoGiDqZuHwWwzyFzx8xl5RDBZR4uCZc9E8fS+8TdSfHZ2KxAel6VwEIYZiflxC9NKToeKcKrAcjV2d2DK3xYqOcXJ478ytf2fcL3htWGegAaSZGeBnKixWgVPXRiZpEomLq4Kcri2RCc7zN3NWuq5XlOJLwqjq9liqlHlEfzSveIdVk0Fjh5kVjdjKLneniCtcEg7N492FBWAWvrHpwLzgmYUfySi+VorcJFBE6I7jIAjFnC3DybePKE5ClxLLsPI0q3kNAsYJ4g1wjkzDuju4nQJrx6RxRe/7YHfFX3MOyHtaUHloaKcqa4rcQTDWxubHnZ0lESNoaGXad7+RmLc7GMxbS4s8Y82S3mdhMshR+Po4pk181jkx22afHc8hL3plNTjOGDjEfu7pxfWkpcyA02Ofo6xpylPsMCi3eNTROShVawM0H4+4bXaGqzcTKQzc8j6VGPkb9tFtU56bwlBdK9ZMQMKNgolMtVKepFcq6hBMAzQJAQ6srG9iwNJRfN0LtWd64z1qZjRPDieBYQkyNTqFpCsoYoKQFoFt8xhA5icZ2fXWOwY4GScsT95Tv7XoSnd0ehgLJBSPSdkdhYWbSeAk2eCSzuScDs/qQo9dpRZarVWWm5ZRuxn8YRRabYtiwhn5PVRXD9js8FzM2rowKII7MnOJSR2GSZJMVUckfzjIjKMe2p5fOsENGfPESR38AwB8AsZTUBUV025TwWVEAsubSl6gYA8rU6eUMmvE2ErjMrQEDZQGkewGI6TcqPAhlT1hHBBV0xZC/R3B09JFmdXDESrIz5GRPMlWQA6kNAoVbjf7FAyq1vsW8xrt+rImI4aEiwIuqAMjI9y/8Z5RSAS+f04P4uTcihozDLaO6kZup2gSWFIXjm3plb75sHxkugMKzAgWmQcYmsTvqrgPkuMOgHFAhY0gnolDJfOgTM0t/xMcYTJeZz9QZRgHiUd5AQIHe2fNqIY3o4xiEw3wc++A6HvzweWNbWtKmsrF853PFEwDd/LEqoVOiYQQLQ7QGXn+Zw3okOhc9i1tw8umpS7mBQ4PW9Ab/YVuHxTTV+8EyF7TsqTHQCxtsBlVWSUVBViGYHcnMDQvaUyAv03wmPDcP8ECiy2lwOKl4CFz2+AoYDx1b73rkOayaVfUXziRMu9oGTbg54cz9pNlV9FEJzi8CJv+zwwOWWoZvZfXSst3rteDPgXx4e4LZv9fDS9grLlzotkclDakmXJCCFTswAdC5eZQqphwErZgr40QInAh4XHMbsHGt6ugSmWuLZwyqwlclFhwqOrSJgZky+izydc7bj+1ZPy7P9AT2nz/MR+PuK/g6/50fg8QdDGffQFQ4b13fwyFcmccl5HczOUgVYoXTcAGEBSWBzdRY4hoLUBvGeQGFgrM84gMWglq/mwszXqcSlAahgdi57l8/Mr9gaxiqbnZwheZMU23Lw88zN0zWff5ZzCpeyAApqTNWkjBorljnceMUEbvnMEqK0qIc1A6UAnYQS5/6Md4jTNxlhGUkKRYYBHmHCiEewJxQjzmmenFdphiXsZ0aKstogvmwkEiqwYml6MmS6kQkQKcUlICsIY6hyDAEbzupgZgr448/OouyI5Y3t8YgGfq5OIaHfeiZDWXclFizWw1OmF0lRQ4A8UWevnPTEsTNFjoQ7fV0UDq3SoSyBVgmU/FmOVsuz9VmfrCUBMPIMut4f1Dj9tzv4wqcmORzIvW1qwgOcYIC5vB0gzAClQW1EGuJXkgql2MlyuTHFhg4OAlrm8vRxtHrMFUhRV4trv/hawK3fqbF/QSwoYwSUPuCwlcDJ7y3wgeMKFHAYDgN7gOmwLBwGgxobzhnH/z7Txz9/exErpz2HK1teUZ+tTSGXZYZCFGAc3eqBZsESmZs1L0e92HK5TikSKA2N2CMY8QATfuvOgLOvqrBlW0CnyOioeWVF1/v4rXd7/M2fjeGEtQWGFO+FpkzFFPKOv/7zKXz/sR5m99foUJ2rRRNhhwCfAqBOxQkbVObHKSv14UZb2KnFdBAl5CdxvMwDcnotrTsW/vW9wPnXVdi2M+DwQ4DVK4CZSWDFVDp+aRkwNR7wxE8GOOuyWdz3vT7K0jMGyN8ToKTzFTMel2yYwPxcAJe56voR/eO7tOscY0Ls2GSFkJW+Nue8QTn6agJD6gta5mhwf7mHhCdesOGGCpu3AmMthzv+qsTHf6fArj0SP5YGKXNQZpleArRcjU9ePYdHnxgwPrAStK1EXkBhvO7scRx+aIleL2SWTzFP1qdQYkCs6dx66COob/28mB61GjzACwhmc9Q2rxnt/9GfUGwY1g4XfbHG488GjLWAmzYWOOU4zwAoKG6KteYG8YSAdunQKQM+dcMc9uwLbHnRv9Baumf5dIGPnNTB4jx5gQjNgisNLuH0Gr07ygKpjpdKsFnWGiuMXtLwfaPDpoRk/dFqjcYht6Q7P3lzhQefqvn87y4usOEjkgpjYlHhyT2psjMLErOcHANe3DbAXfd1xfUZVzRH6qMf/VA7E15JkfECdX9TiB+11ughDcisQGr4+wEfDqzrtegRxAau+aca3/gvEejK8z0uOcNhsUfWtAJGviOhrWKLXRwujgImx4Fvf3cR3V7gLGBRyDnfBbxnbQurVlImqJlEmdtLSpS/I9dACpD0l+I+sTjLCNbLe3sekHlEJry5/tJxh/98usZtDwo1vfTsAp/+mMeA0hrnPssalgl0PtoEEUYn18fbDltfHmLzlgEcs0MtiZ0oY+UKjyPWlBj0lRVGy3s+J2VQreKZIGUWq7MFDMEBaW01yMyoC7iRwmikG0zaZo5BcTwE9s0FXPS7Hp+/2DO356rQquKsvy9NDWV2yuXlM4Eb0O8FbN4ieTnCheIAKWLNao9qKPm/gJdD6bfhQkHlMLE9QmouF7Mlq1geM/hpO2xU/oNciT2K2B0Wik1/cHYu4Jz3O9y80bNXCOAJfnCzRAeguUhxbF0e7eLwMyIUKeW1HRkoWS9QXzPTnmWQvoOkQMED5Q8UDnDUE0ytLVv6jtbTyae6IP8T2qczNhKbAymLWP4nwXp94IhVDv9wWcGWoBRHHD/Fr8NPn6/Q8lpFpqCKwEgCGLsjF+4umOs3nZJeS8Y8ilrSHV0kazPqq6J5BRQylsgR4z2rALXhmWWkt8CAZvES49/aYDTZXsDxRzksnaDcTqAnz5DLtkqPux8c4LuPDTjfE9rnq0ziFUpotJfH4WFdjthUSbOjMdjFSXCtWg0EyyC9DU+fWcNq6UaDMq7tExJn6fFt3J+vKmPkZog9p4wqhoc6Dwvf8vjOfw9w+RcXucNj7e+0kpPa4wZmHDg1sHK5FAVCBXRgndb8XB2boj4TmBkgW9+AsLIOr/X6m/TX1uxjiyz3AOvjNQODMcVqb1GKrtrQ83qRQoCEf+SpITbeQJsSrLcnbhOR2zVZnBU0pXc46ghRAI+phMzGf3NnjRYBLOEPK8DzOxMheqcqFF5DIF+dyRZIYkhEgpJiNmn7wGIokhlLXWzNlEeHKvyTm4f4o+sWsdgNWHuUx2RHlG2KYDfniSaGyIUMMb4Zz/k+F5pGpyKp263x6v9VaBOztNyv40RmqGsG3o30+SMQZvXBAQsdb/UaJVTRdaVHZ2sPY22HzS9WuPDaLnbuqnHWySUe+vIU/uCjbcxRIUPpylKfeQMjuLTHF+drHH9sC2tWlxxGRKJiFADY/nKFXTsqjLUpE2jsx3Qq6C8A6CQEuP2V1wCNNfpmamvG/wg6amzLOmESPh+D0P7FVwMuuHoRW7dXOP19JW79zDjaLWBqQsLGipXo9jpZa2tTuG742EQmtKZSpcU/+VEf3fmANhVDbHnJGpEa8zUnxVK+o8N4fFx/H2F/MSXl3VvrBzhqUUmIJHdNedyAcfvrARdc08WzL9U4+bgSt181jjEFP1tljiVsrOHFAzothz27a5xx6jhOfn8HVUVU12YkvUR6/c/DPXQKEi4VPkyIuDrMiqNA3pbz/tGV29j3N68QetLweWuKKEOjdjMpsMX8Sb6nt2VLgCd/VuHMK4Z44ZUK7z26wJ1Xj2N6ynGKHOvYjhR6XumrKpFkbBfAnjcrrD2mhc9dORXpb5wJhULh8dzPB9j0wwEmlxDZMM9JyC9VoGQmz7wgU0Bc089dfqRCPKApqqsutCRGrarTf8PhjT0Bu2cDdu8L2LOvxu69AbP7A3a8UeEXWyu86zCPr187jjWHNFtclvqoFUZkiRRKf6/fDdj1eoXf/PUObrtlBstnpIVH1aB5IydBB3zr6wvodym/Sy9AKG8qi1NPgOixk7XBfJ0ub2o2lJBVdY2YsK6MFiWfO9/jnSuBHz1HHuGFSmuKC5XH6uUOHz+jhdUrndQChSiBXtTEoLRHQFj1a47bibbDrxxR4twzx7Bh/QTKlvCHKLzyf+oSbX66j0f/vYtlU1K/MAFSdyceEIVXAxdxeVy5fwPtRxHd9vw0GqBqIn4zWhpw4akeF5769gmDeADFr1mOXq/urHkN8Nyzx3DGKR20yoBDVhQ4+siSFUVWr014fZCUTue9bsCXrtsfOQIxWxNamiAKiOwZojxPHmBr75a/Y2hpP988pMEHYsfT1u0TEaFTyvMCS9m9htTWpIwlMMWuw8JizV3do99Z4PNXTnHLK9UXQemz4/rBhmW84naYw99fuw/PbR5g5XTBniwIT9bWuHcS+8YraAAfGyIZBlgGyHd45fv4UsTZW+rGmB7KghoVQkqK/J1XeEiIlLRJWRQ+DzzSx8+2DHHqB9osfK9Xs9DkKZRdpAucApDcXsb2uOX6WTz0r4tYQcIPc0HT59QBSpmgsBCILa98BSfb0jKa7jMAOEhTJOmGU2C85BCoINEvyT9IwHbL49WdFW68bZ6Xu9afPcZ3m+KUPFiASQiQkkuP/ftr3PS3s3j4/i73Aql+sc4vC6+rQIL2Qs+NY6QQqG0zZEZYLC2mYowfokVN1n6dGg/NV8YPzF1iBORlFK36BLS956XuP/3sPjy7ZYDL/2QJjv3VEr2+FDK8yKrZIa0byvS//0gPt39pDttfqHiVF4NEm2PDU0tgvpZ7AdMXMUZpW1Kb+4GaqY8+twpgx96A+x4PuPjDsmB54GukX3DQl1yfXwDuf7SHm766gJdfGeIPf38c11wxxd91aO/BQV673qjw1BMDPPhvi3j6yT7GSoeZZbKIa2UyNb3yJqitBebub6tPnosj22010rsf3exEgDNRAld9o8aPX3B412rdB2xgl1Hf0CiEMseoA3r9gG3bK/xw0wAvbB1iqkMkyeOw1QW+9s0FDAeCFeIwAYNewK5dNV7ZWmHb80O8uaNmUrR0Uqo6WgITmptITlRAg1LnZMiIEODec8MwkDV4707+A4isCHJD2cNr3GDfHLi/Z3v4448Xsj38EiepEOLqTru8RaDdHeDtLrZldn6/LnHbhLlNpwQmAB3vMNFxGOPtNZrmaqvzpbYXzm/ARyWvl4YIdYbU/Rn4CFMqYGq5ly0yVqUdUMnZ6q4Bl94zM2E9xGztTxc045aavK1Of1wxxQWiqDULYJuj6G/QEje7byAl6IT1YAF0H7HsKpUmjVV4eakcra6rwlIP6DJYtkbA6Ri8P0CB1jYv5u2lvBoULsfnnJpG9vCyIEqWZHeJrjJn48adGrzzSyZgGxek2ySeZqFjz3FjNd/vo0JKw8QEVgVqt0iKH1sDlBTKy+r6TLBx6nwFuPGefpMTc79Z3RRkPXw+H21njVSPcQ9fanXbWLymb/1/29RgkKmNTRuLBVXrxx0m+lkENmVY7S/zEWtrb9BWiRxlgZGCJ+a9PLHlfEDBTP2hsTFRdpVJNWdPx21qWVPDWtP5ik+j4Zn176wFzoWN9fcyoDNhI+dXppkA0XoCTQLEPCAIdhxk5Tur+nWPsChKYzxH97h/37aqm+z2Sw7ZvGRa5x5c3IuUlBBbVBYWBlymuEx4Gyuv74X4pDTXYILWD8ja4zRKYVR49Fcdxg3invt8yUsVJCRPHshrBWNZ+R49UYLt5tYfRcR6Xy0c3Ta5dJ6/Zd/vCNjlxCcueCa2l1pgGQDGzpIVSEPMyq6w5q+wzOoNUIzu0uz0SFhkHlHTiq4InO4zr9ENSjHO841N2e5ui3PrBTZQPFlagC0Jb54Vd4pZqNiOttgPoI4AZn1ZYLPzLoQatS2CNmod3T3W7Asc+Puc5D1JKRbpRJnFYgZAI9iQub7EvY9gxc9yW1vW+HgME3KkwSkNDs0EVnXqWqARIG3X1y3XDq0xbPbTS4q7vVcCN7qwGWM73/HV3P0t7iwImoOhlMZpe0rc8q7tblaE9vxzJaTCJa3nC/iZp6QFTgNGi/0mC9TvOTukUNLUG8Y6hZte7e/2l52Iu8ar6qXalR6hrhq5P0+LI7/DaYBgrHnMve1HEhYu6RkWgq2bvKDJ3cVGOfhZLOdYkaq8xPIYX2zVV72uyPBEN01XnTDuy2WLL33w+rG7/PpT3NyvrQ4bx9tww8qT1ejHNHFPQEJ6Ke0E1LJd2FmhR90g04xpP+tfKCjmYKaWIU/ImhcpTpXi2q7UfLeH9fXVqSVsTNiMD+Rh4uraDT2mlpXu8BNaG1etcnN+3T2huPcvWg8dubS6dHJJUfD6bFVXrq5rrw3+tCaXOuGmBENzAzHpu0tvL63uNj8bykdeoCkt8QHL+SqAkRxz60wJcQ9BFh6p7CX8CYEQLtShKocTfmbpRLHs3d1LT7u+9dA99tNZ+yHxBTcNztz0mr9x74I/hnZXhD7F/PCAn6bJz+U0vrPr7K5VJUJZf5/v040NDcG02LGGJVmfOsuxdifg03U9vUZHrPz0fl7p5caGjNkiEmTFUXBooUDbjWGs5TE+Pdyy6vjqijO+MPYACb+efjwdiYsqIewMk+d8tbro1b1uXXehPrYahmn+hZmGgtefqsalNFvU1BpAhM8QXhUlCmgCmihAUnBUQixk6J2eSYqwvM9Iz5sfrApM7LDF7W651oILbef3Tky0Nk2vcfeed0dxp3Nu7h6EYr2sgOL/Aa5OuMdnE5sWAAAAAElFTkSuQmCC";
		//#endregion
		//#region src/client/styles.ts
		/**
		* Client styles for the Qoder plugin card + composer credits readout.
		*
		* 参考：dingminhua/dsh-connect-workbuddy（MIT，Copyright (c) 2026 LaoDing）
		*   — 整套 `dsm-*` 卡片样式系统（卡片外壳、折叠 caret、按钮原语、
		*     `--dsw-alias-*` 主题变量与十六进制回退值、账号池表格、缓冲遮罩、
		*     对话框、composer 面板）逐字沿用自该项目，其又逐字复制自
		*     dingminhua/dsh-connect-trae（MIT）与
		*     dingminhua/dsh-subagent-default-model（MIT）的 SETTINGS_CSS。
		*     沿用的目的与那两个项目相同：**让同族的插件在同一张卡片列表里共享
		*     同一套外部表现语言**——外壳尺寸、按钮形态、圆角、间距、主题变量
		*     都一致，只有各自的功能区不同。
		* 改动：
		*   1. 类名前缀由 `dsm-workbuddy-*` 改为 `dsm-qoder-*`（共享的
		*      `.dsm-plugin-card*` 与 `.dsm-btn*` 保持原名，那是家族语言本身）；
		*   2. 移除 searched-paths 与 OAuth 二维码的样式（Qoder 无此功能），
		*      新增 PAT 粘贴表单用到的 bar / transfer-dialog 类（沿用家族类）；
		*   3. 模型行按 Qoder 上游给的字段（积分倍率、上下文/输出上限、是否支持
		*      推理与图像、默认/免费）排版；探针结果行沿用同一套语义色。
		*
		* @module dsh-connect-qoder/client/styles
		*/
		const QODER_CARD_CSS = `
.dsm-plugin-card{border:1px solid var(--dsw-alias-border-l2,#36373b);background:var(--dsw-alias-bg-layer-3,#202126);border-radius:12px;list-style:none;transition:border-color .16s,background .16s}
.dsm-plugin-card:hover{border-color:var(--dsw-alias-label-dimmed,#777)}
.dsm-plugin-card-open{background:var(--dsw-alias-bg-layer-2,#25262b);border-color:var(--dsw-alias-label-dimmed,#777)}
.dsm-plugin-card-header{appearance:none;width:100%;font:inherit;color:inherit;text-align:left;cursor:pointer;background:transparent;border:0;border-radius:12px;align-items:center;gap:12px;padding:14px 16px;display:flex}
.dsm-plugin-card-header:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#5686fe);outline-offset:-2px}
.dsm-plugin-card-head{flex-direction:column;flex:1;gap:4px;min-width:0;display:flex}
.dsm-plugin-card-title{color:var(--dsw-alias-label-primary,#e6e6e6);font-size:15px;font-weight:600;line-height:1.4}
.dsm-plugin-card-description{color:var(--dsw-alias-label-tertiary,#999);font-size:13px;line-height:1.5}
/* Pure-CSS caret: the host primitives' chevron icon names differ per DSH line
   (0.1.5 Outline14 vs 0.1.7 OutlineRegular), so no static import can serve
   both. A border caret in the plugin's own CSS is version-proof. */
.dsm-plugin-card-chevron{color:var(--dsw-alias-label-tertiary,#999);flex:none;width:16px;height:16px;position:relative;transition:transform .16s}
.dsm-plugin-card-chevron::before{content:"";display:block;position:absolute;left:4px;top:5px;width:7px;height:7px;border-right:1.6px solid currentColor;border-bottom:1.6px solid currentColor;transform:rotate(45deg)}
.dsm-plugin-card-chevron-open{transform:rotate(180deg)}
.dsm-plugin-card-body{border-top:1px solid var(--dsw-alias-border-l2,#36373b);margin:0 16px;padding:0 0 8px}
.dsm-plugin-card-icon{width:32px;height:32px;flex:none;border-radius:7px}
.dsm-btn{appearance:none;font:inherit;cursor:pointer;border:1px solid transparent;border-radius:8px;padding:5px 14px;font-size:13px;line-height:1.5}
.dsm-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#5686fe);outline-offset:1px}
.dsm-btn:disabled{opacity:.4;cursor:default}
.dsm-btn-outline{border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);background:transparent;font-weight:500}
.dsm-btn-outline:hover:not(:disabled){color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-dimmed);background:rgba(255,255,255,.04)}
.dsm-btn-primary{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3)}
.dsm-btn-primary:hover:not(:disabled){opacity:.9}
/*
 * 卡片正文的第一块（tab 栏 + 说明行）。padding-top 提供与上方分隔线的间距，
 * gap 提供 tab 栏与说明行之间的间距。用户实拍「两个间隔都小点」指的就是这两处：
 * 它们原本各是 16px（与 workbuddy 一致）。
 *   - 上：16px → 10px（仍明显离开分隔线，只是不再空一大截）；
 *   - 中：gap 16px → 10px。
 * 下侧 4px 保持：说明行与账号池之间还隔着账号池自己的 padding-top 与边框。
 */
.dsm-qoder-usage{display:flex;flex-direction:column;gap:10px;margin:0;padding:12px 0 2px}
/*
 * Tab 栏：**两格独立的卡片**，不再是「一条通栏长条里塞两个按钮」。
 * 形状照 dsh-connect-trae（用户给了参照图并指出「这个区域的设计，学习一下」）：
 *   - 每格自带 1px 边框 + 圆角 + 自己的底色，格与格之间留 8px 缝；
 *   - **选中的那格**描品牌色边（--dsw-alias-brand-primary）、底色降一层；
 *   - 圆点/供应商名/开关三样都在同一格内，右侧开关前有一条细分隔线，
 *     让「这格是哪个供应商」与「它开没开」读成一个单位；
 *   - 未开启的供应商整格压到 55% 不透明度，而不是只压名字。
 * 通栏那条外框与「按钮自带 inset 边框」一起删掉了：外面一条、里面再一条，
 * 两道边框相距几像素，看起来像渲染出错（trae 的注释里记的正是这一条）。
 */
.dsm-qoder-tabs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.dsm-qoder-tab-cell{display:flex;align-items:center;gap:4px;min-width:0;padding:8px 12px;border:1px solid var(--dsw-alias-border-l2,#3a3d45);border-radius:10px;background:var(--dsw-alias-bg-layer-3,#2a2c33);transition:border-color .15s,background .15s}
.dsm-qoder-tab-cell:hover{border-color:var(--dsw-alias-label-dimmed,#777)}
/* 选中态挂在 CELL 上：一格一个单位，开关也在这格的边框里。 */
.dsm-qoder-tab-cell-active{border-color:var(--dsw-alias-brand-primary,#5686fe);background:var(--dsw-alias-bg-layer-2,#232529)}
.dsm-qoder-tab{appearance:none;font:inherit;cursor:pointer;flex:1;min-width:0;border:0;border-radius:7px;padding:0;color:var(--dsw-alias-label-tertiary,#999);font-size:13px;font-weight:600;line-height:20px;background:transparent;text-align:left;transition:color .15s;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dsm-qoder-tab:hover:not(:disabled):not(.dsm-qoder-tab-active){color:var(--dsw-alias-label-primary,#e6e6e6)}
.dsm-qoder-tab:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#5686fe);outline-offset:1px}
/* 只管字色；边框与底色由上级那条 .dsm-qoder-tab-cell-active 负责。 */
.dsm-qoder-tab-active{color:var(--dsw-alias-label-primary,#e6e6e6)}
.dsm-qoder-tab-dot{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:7px;vertical-align:baseline}
.dsm-qoder-tab-off{opacity:.55}
/* 开关与名字同一行、靠右，前面一条细分隔线；点击区只包住开关本身，不盖住
   按钮，否则点名字会被当成点开关。 */
.dsm-qoder-tab-switch{display:inline-flex;align-items:center;flex:none;margin-left:auto;padding-left:10px;border-left:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.24));cursor:pointer}
.dsm-qoder-tab-switch input{margin:0;cursor:pointer;accent-color:var(--dsw-alias-brand-primary,#5686fe)}
.dsm-qoder-tab-switch input:disabled{cursor:default}
.dsm-qoder-tab-switch:has(input:disabled){opacity:.6;cursor:default}
/*
 * 积分显示：设置区顶部的**两行**，结构照 dsh-connect-trae 的 .dsm-trae-pref*
 * （用户给参照图，圈出「在输入框工具栏显示积分读数 / 显示位置」这两行，要求
 * 「改成一样的样式」）。三条规矩逐字对齐：
 *   1. 一行一个开关，label 包住勾选框，**整行都是点击区**（不必瞄准那个小方块）；
 *   2. 主标题与副说明分两行：先说「这个开关做什么」，再说「它会带来什么」；
 *   3. 下级控件（显示位置的下拉）**排在主标题右侧同一行**，不甩到卡片另一头
 *      ——推到对面等于把一句话拆成两个物件，中间留半张卡片空白。
 * 上一版是「勾选框 + 短标签 + 下拉」挤在 <h3>账号池</h3> 之后，没有一句可见
 * 说明（三条说明只挂在 title 上，要悬停才看得见）。
 */
/* 底部留 8px：这句说明的下一行就是账号池那条分隔线，而说明自己只有
   padding-bottom:6px —— 实测文字到线只剩 4 CSS px，紧得像贴上去
   （用户实拍：「这里文字和线 距离不对」）。补 8px 后约 12px，与线下到
   「账号池」标题的那截间距相称。 */
.dsm-qoder-prefs{display:flex;flex-direction:column;gap:14px;padding:2px 2px 8px}
.dsm-qoder-pref{display:flex;align-items:flex-start;gap:10px;font-size:13px;line-height:18px;color:var(--dsw-alias-label-secondary,#c6c9d0);cursor:pointer}
.dsm-qoder-pref input{flex:none;cursor:pointer;accent-color:var(--dsw-alias-brand-primary,#5686fe)}
.dsm-qoder-pref-check{inline-size:15px;block-size:15px;margin:3px 0 0}
.dsm-qoder-pref-copy{display:flex;flex-direction:column;gap:3px;min-width:0}
.dsm-qoder-pref-label{font-weight:500;color:var(--dsw-alias-label-primary,#e6e6e6)}
/* 「显示位置 [下拉]」：从左侧排起、谁也不拉伸，控件贴着问它的那几个字。 */
.dsm-qoder-pref-lead{display:flex;align-items:center;justify-content:flex-start;gap:10px;min-width:0}
.dsm-qoder-pref-lead .dsm-qoder-pref-label{flex:none}
.dsm-qoder-pref input:disabled{cursor:default}
.dsm-qoder-pref:has(input:disabled){opacity:.6;cursor:default}
.dsm-qoder-pref-hint{color:var(--dsw-alias-label-tertiary,#9aa0a8);font-size:12px;line-height:17px}
.dsm-qoder-pref span{min-width:0}
/* 这一行没有勾选框，借用它的那一列作内边距，好让标题和上面那条左边缘对齐
   （15px 勾选框 + 10px 间距 = 25px）。 */
/* 第一行先声明这一列，第二行才能吃到同一个值——两行的左边缘因此对齐到
   主标题，而不是各算各的（之前写死 25px，与勾选框的实际尺寸各算各的，
   位置一旦对不上就整体偏左）。 */
.dsm-qoder-credit-toggle{--dsm-qoder-pref-indent:25px}
.dsm-qoder-credit-position-pref{align-items:flex-start;padding-left:var(--dsm-qoder-pref-indent,25px)}
/* 下拉按自己那两个选项的宽度定尺寸，不拉伸：它回答的是一个很短的问题。 */
.dsm-qoder-credit-position{flex:none;max-width:none;margin-top:0;padding:3px 8px;font-size:12px;line-height:16px;border:1px solid var(--dsw-alias-border-l2,#3a3d45);border-radius:7px;background:var(--dsw-alias-bg-layer-3,#2a2c33);color:var(--dsw-alias-label-primary,#e6e6e6);cursor:pointer}
.dsm-qoder-credit-position:disabled{cursor:default}
.dsm-qoder-usage-account-actions{display:flex;gap:8px;margin:10px 0 0}
.dsm-qoder-account-confirm{display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap;padding:4px 8px;border:1px solid var(--dsw-alias-border-l2,#36373b);border-radius:8px;background:var(--dsw-alias-bg-layer-3,#2a2c33)}
.dsm-qoder-account-confirm-text{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#c6c9d0)}
.dsm-qoder-tab-off-notice{color:var(--dsw-alias-label-tertiary,#999);font-size:12px;line-height:18px;margin:0 0 4px;padding:8px 10px;background:var(--dsw-alias-bg-layer-3,#2a2c33);border:1px solid var(--dsw-alias-border-l2,#36373b);border-radius:8px}
/*
 * 分栏 tab 条（账号 / 模型 / 诊断）。
 *
 * 刻意**不是**上面那两格方块。那两格是区域作用域：二选一，每格还带自己的开关。
 * 这里则是同一份文档的分栏，形状就是宿主自己的设置窗口里那种下划线 tab——
 * 两排方块连在一起会被读成「四选一」。
 *
 * 真正起作用的是每个分栏上的 hidden 属性：非活动栏仍然挂载，所以切回来不重新
 * 拉取、不丢未保存的目录草稿、账号池日志不重建；隐藏同时把它移出无障碍树，这正是
 * role="tabpanel" 要的语义（用 CSS 类做 display:none 会被后面的规则覆盖，hidden 不会）。
 */
.dsm-qoder-panels{display:flex;align-items:stretch;gap:2px;margin:12px 0 0;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.24))}
.dsm-qoder-panel-tab{appearance:none;font:inherit;cursor:pointer;border:0;background:transparent;padding:7px 11px;margin-bottom:-1px;border-bottom:2px solid transparent;color:var(--dsw-alias-label-tertiary,#999);font-size:13px;font-weight:600;line-height:20px;white-space:nowrap;transition:color .15s,border-color .15s}
.dsm-qoder-panel-tab:hover:not(.dsm-qoder-panel-tab-active){color:var(--dsw-alias-label-primary,#e6e6e6)}
.dsm-qoder-panel-tab:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#5686fe);outline-offset:1px}
.dsm-qoder-panel-tab-active{color:var(--dsw-alias-label-primary,#e6e6e6);border-bottom-color:var(--dsw-alias-brand-primary,#5686fe)}
.dsm-qoder-panel{margin-top:12px}
/*
 * 分栏里的第一块不再画自己的上分隔线。
 *
 * 模型区带 border-top + padding-top——那是一列长页里的段落分隔线，作用是
 * 「告诉读者上一段结束了」。可模型区现在是模型栏里唯一的内容，而 tab 条自己
 * 已经有一条 border-bottom：两条线只隔 12px，读起来像渲染出错。段落边界由
 * tab 条表达，第一块就不必再说一遍。
 *
 * 只针对模型区：账号栏的第一块永远是积分偏好那两行（renderCreditsSwitch
 * 无条件渲染），账号池因此总是**第二块**——它要靠自己那条 border-top 把「谁在
 * 服务」与上方的偏好分开（用户实拍要求过那里的间距），所以不动它。
 */
.dsm-qoder-panel > .dsm-qoder-models:first-child{border-top:0;padding-top:0}
/*
 * 诊断栏：两列的事实表，不是散文。每一行都是卡片**真的读到的**一个值，所以一份
 * 问题反馈可以整段引用它，而不是把界面复述一遍。这里没有控件是刻意的——能改设置
 * 的诊断栏，只是一个名字更差的设置栏。
 */
.dsm-qoder-diag{display:flex;flex-direction:column;border:1px solid var(--dsw-alias-border-l2,#36373b);border-radius:10px;overflow:hidden;background:var(--dsw-alias-bg-layer-2,#232529)}
.dsm-qoder-diag-row{display:flex;align-items:baseline;justify-content:space-between;gap:16px;padding:8px 12px}
.dsm-qoder-diag-row+.dsm-qoder-diag-row{border-top:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.24))}
.dsm-qoder-diag-label{flex:none;color:var(--dsw-alias-label-tertiary,#999);font-size:12px;line-height:18px}
.dsm-qoder-diag-value{min-width:0;color:var(--dsw-alias-label-primary,#e6e6e6);font-size:12px;line-height:18px;text-align:right;overflow-wrap:anywhere}
.dsm-qoder-diag-mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
.dsm-qoder-diag-bad{color:var(--dsw-alias-label-caution,#e8b34b)}
.dsm-qoder-diag-hint{margin:10px 0 0;color:var(--dsw-alias-label-tertiary,#999);font-size:12px;line-height:18px}
/*
 * 那段说明行（「每个 tab 是一个独立供应商…」）。
 *
 * 它此前**只有** padding-left，上下间距全靠外层容器的 gap 与账号池的 padding——
 * 用户圈出的两处空白正是它的上下。给 line-height 18px 配 6px 上下边距，让这段
 * 与 tab 栏、与账号池标题都保持一个读得舒服但不过分的距离。
 * 上一轮我误把账号池自己的 padding-top 当成其中一处改小了，已恢复。
 */
/*
 * 那句说明行（「每个 tab 是一个独立供应商…」）。
 *
 * 它是 <p>，而**浏览器默认给 p 加 margin:1em 0（16px 上下）**。本文件里其他每
 * 一个 <p> 都写了 margin:0，唯独这条漏了 —— 于是它上下各顶出 16px 浏览器默认
 * 边距，再叠加容器的 gap 与 padding，看起来怎么调容器都「没有改善」：
 * 用户实拍「还是没有改善」，说的正是这个。
 * workbuddy 的同名规则也有同样的遗漏，所以那边同样偏松。
 *
 * 显式 margin:0 之后，上下间距才真正由这里与容器的 padding 控制。
 */
.dsm-qoder-usage-hint{margin:0;padding:6px 0 6px 19px;color:var(--dsw-alias-label-tertiary,#9aa0a8);font-size:12px;line-height:18px}
.dsm-qoder-account-error{color:var(--dsw-alias-state-error-primary,#ef4444);font-size:12px;line-height:18px;white-space:pre-line}
.dsm-qoder-usage-select-wrap{position:relative}
.dsm-qoder-usage-select{appearance:none;width:100%;font:inherit;padding:10px 34px 10px 12px;border:1px solid var(--dsw-alias-border-l2,#3a3d45);border-radius:10px;color:var(--dsw-alias-label-primary,#e6e6e6);background:var(--dsw-alias-bg-layer-3,#2a2c33);cursor:pointer;transition:border-color .15s,box-shadow .15s}
.dsm-qoder-usage-select:focus-visible{outline:none;border-color:var(--dsw-alias-brand-primary,#5686fe);box-shadow:0 0 0 3px rgba(86,134,254,.22)}
.dsm-qoder-usage-select:disabled{opacity:.6;cursor:default}
.dsm-qoder-usage-select-wrap::after{content:"";position:absolute;top:50%;right:12px;width:7px;height:7px;transform:translateY(-65%) rotate(45deg);border-right:1.6px solid var(--dsw-alias-label-secondary,#c6c9d0);border-bottom:1.6px solid var(--dsw-alias-label-secondary,#c6c9d0);pointer-events:none}
.dsm-qoder-usage-text{margin:0;font-size:14px;line-height:22px;color:var(--dsw-alias-label-secondary,#b8b8b8)}
.dsm-qoder-usage-error{margin:0;font-size:14px;line-height:22px;color:var(--dsw-alias-state-error-primary,#ef4444)}
.dsm-qoder-usage-dot{width:9px;height:9px;border-radius:50%;flex:0 0 auto}
.dsm-qoder-models{display:flex;flex-direction:column;gap:10px;border-top:1px solid var(--dsw-alias-border-l2,#36373b);padding-top:14px}
.dsm-qoder-models-fold{display:flex;flex-direction:column;gap:10px}
.dsm-qoder-models-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
.dsm-qoder-models-title-row{display:flex;align-items:center;gap:6px;min-width:0}
.dsm-qoder-models-title{margin:0;color:var(--dsw-alias-label-primary,#e6e6e6);font-size:14px;font-weight:600;line-height:20px}
.dsm-qoder-models-dirty{margin-left:8px;padding:1px 6px;border-radius:6px;background:var(--dsw-alias-state-warn-primary,#f59e0b);color:#1b1d22;font-size:11px;font-weight:600;line-height:16px;vertical-align:1px;white-space:nowrap}
.dsm-qoder-models-summary{margin:2px 0 0;color:var(--dsw-alias-label-tertiary,#999);font-size:12px;line-height:18px}
/* 模型列表：**每一条都排出来，不设高度上限、不自己滚动。**
 *
 * 用户要求：「模型的页面，所有模型要全部呈现，不用滚动条」。这条规则因此**没有**
 * max-height、也没有 overflow-y：盒子高度永远等于内容高度，20 多条目录就是 20 多
 * 行，靠**外层页面**滚动去看它们。同族的 workbuddy 曾经有 max-height:520px +
 * overflow-y:auto，结果是 20 多条只露七八行、其余藏在一条要先发现再拖动、并且叠在
 * 面板滚动条之上的**第二条**滚动条后面 —— 而一个「让人看见并勾选模型」的列表，
 * 恰恰不该是这个形状。
 *
 * overflow:hidden 必须留着，而且是有作用的而不是残留：圆角由这个带边框的盒子画，
 * 不裁剪的话首行与末行会把直角盖到圆角上。现在盒子高度等于内容高度，它不会再裁掉
 * 任何东西。tests/styles.spec.ts 与 scripts/model-list-layout.preview.tsx 分别从
 * 「规则文本」和「真实 Chrome 布局」两侧钉住这件事。 */
.dsm-qoder-model-list{display:flex;flex-direction:column;border:1px solid var(--dsw-alias-border-l2,#36373b);border-radius:10px;overflow:hidden}
.dsm-qoder-model{display:grid;grid-template-columns:minmax(0,1fr);gap:7px;padding:10px 12px;background:var(--dsw-alias-bg-layer-2,#232529);transition:opacity .16s}
.dsm-qoder-model-disabled{opacity:.55}
.dsm-qoder-model+.dsm-qoder-model{border-top:1px solid var(--dsw-alias-border-l2,#36373b)}
.dsm-qoder-model-head{display:flex;align-items:center;justify-content:space-between;gap:12px;min-width:0}
.dsm-qoder-model-enabled{display:flex;align-items:center;gap:8px;min-width:0;cursor:pointer;flex:1}
.dsm-qoder-model-enabled input{margin:0;accent-color:var(--dsw-alias-brand-primary,#5686fe);flex:none}
.dsm-qoder-model-image{display:inline-flex;align-items:center;gap:5px;flex:none;cursor:pointer;color:var(--dsw-alias-label-secondary,#c6c9d0);font-size:11px;line-height:16px}
.dsm-qoder-model-image input{margin:0;accent-color:var(--dsw-alias-brand-primary,#5686fe)}
.dsm-qoder-model-off{display:inline-flex;align-items:center;gap:5px;flex:none;cursor:pointer;color:var(--dsw-alias-label-secondary,#c6c9d0);font-size:11px;line-height:16px}
.dsm-qoder-model-off input{margin:0;accent-color:var(--dsw-alias-brand-primary,#5686fe)}
.dsm-qoder-model-copy{display:flex;align-items:baseline;gap:8px;min-width:0}
.dsm-qoder-model-name{display:inline-flex;align-items:baseline;gap:7px;color:var(--dsw-alias-label-primary,#e6e6e6);font-size:13px;font-weight:500;line-height:19px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsm-qoder-model-name-rate{color:var(--dsw-alias-label-tertiary,#999);font-size:11px;font-weight:400;line-height:16px;flex:none}
/*
 * 上游的活动优惠徽标（「错峰 4 折」/「Off-Peak 60% off」）。
 *
 * 文案与颜色都**不是**插件选的：文案是上游 promotion.badge 的原话，颜色则
 * 只有一种——Qoder 的活动字段里没有颜色（对比 workbuddy 的促销给了
 * badge.color），所以这里统一用品牌色系，靠 color-mix 调出淡底+同色描边。
 * flex:none 是关键：模型名会省略号截断，徽标必须不被压缩。
 */
.dsm-qoder-model-promo{flex:none;display:inline-flex;align-items:center;padding:0 7px;border-radius:999px;font-size:10px;line-height:16px;font-weight:600;white-space:nowrap;color:var(--dsw-alias-brand-primary,#5686fe);background:rgba(255,255,255,.08);background:color-mix(in srgb,var(--dsw-alias-brand-primary,#5686fe) 16%,transparent);border:1px solid transparent;border-color:color-mix(in srgb,var(--dsw-alias-brand-primary,#5686fe) 40%,transparent)}
/*
 * 同一条活动规则，但**此刻不在窗口内**（promoDisplayAt 的 pending）。
 *
 * 灰显不是为了好看，是为了让「还没到点」和「正在打折」在同一行里一眼分得开：
 * 两种状态挂着同一句上游文案（「错峰 4 折」），只靠颜色深浅区分会让人读成
 * 「现在就在打折」。所以这里同时换三样东西——品牌色换成 tertiary 灰、底色退回
 * 中性、描边改成虚线（虚线是形状差异，不依赖颜色，色觉障碍与高对比度主题下
 * 仍然成立）。悬停里写明几点生效，那才是这个状态真正的信息。
 */
.dsm-qoder-model-promo-pending{color:var(--dsw-alias-label-tertiary,#9aa0a8);background:rgba(174,179,187,.10);border-style:dashed;border-color:rgba(174,179,187,.32)}
/*
 * 模型选择器里的同两枚徽标（issue #12）。
 *
 * 宿主把这段内容内联进 picker 的模型行，外面没有卡片外壳，所以这里只管三件
 * 事：基线对齐（行高由 picker 决定，抬到 middle 会跟名字错位）、不换行（窄行
 * 里换行会把整行撑高）、以及菜单行里给胶囊一个宽度上限（trigger 行宽，菜单行
 * 窄；不限宽时较长的上游文案会把模型名挤成省略号，主次颠倒）。
 * 颜色、圆角、虚线灰显全部复用上面的 .dsm-qoder-model-promo* 一族，两个表面
 * 不各写一套。
 */
.dsm-qoder-model-label{display:inline-flex;align-items:center;gap:5px;white-space:nowrap;vertical-align:baseline;min-width:0}
.dsm-qoder-model-label-promo{max-width:6em;overflow:hidden;text-overflow:ellipsis}
/*
 * 别家 provider 行上那枚胶囊：**逐条复现宿主 Tag 的几何**（0.2.2-rc.1 的
 * Tag.module.css）。颜色由行内样式给（四个 tone 各一对主题变量，见
 * host-badge.tsx），这里只管形状：
 *
 *   display:inline-flex / align-items:center / border-radius:999px /
 *   corner-shape:round / padding:1px 8px / font-size:11px / line-height:17px /
 *   font-weight:500 / white-space:nowrap
 *
 * 宿主那颗**没有描边**，所以这里也不画 —— 加了描边，同一行里两颗胶囊就会一个
 * 有圈一个没有。同理**不加 max-width / 省略号**：宿主不截断，我们截了就会在同一
 * 行宽下显示成「限时免…」，比不显示更糟。
 *
 * vertical-align:baseline 与 .dsm-qoder-model-label 同一取舍：行高由 picker
 * 决定，自己抬到 middle 会跟名字错位。
 */
.dsm-qoder-model-label-host-badge{display:inline-flex;align-items:center;border-radius:999px;corner-shape:round;padding:1px 8px;font-size:11px;line-height:17px;font-weight:500;white-space:nowrap;vertical-align:baseline;flex:none}
.dsm-qoder-model-desc{margin:0;color:var(--dsw-alias-label-tertiary,#9aa0a8);font-size:12px;line-height:18px}
.dsm-qoder-model-details{display:flex;align-items:center;justify-content:space-between;gap:12px;min-width:0}
.dsm-qoder-model-meta{display:flex;align-items:center;gap:7px 12px;flex-wrap:wrap;color:var(--dsw-alias-label-tertiary,#999);font-size:11px;line-height:16px}
.dsm-qoder-model-meta-tag{padding:1px 7px;border-radius:999px;font-size:11px;line-height:15px;background:rgba(174,179,187,.11);color:var(--dsw-alias-label-secondary,#c6c9d0)}
.dsm-qoder-context-budget{display:flex;align-items:center;justify-content:flex-end;gap:12px;flex:none;margin:0;padding:0;border:0;color:var(--dsw-alias-label-secondary,#c6c9d0);font-size:11px;line-height:16px}
.dsm-qoder-context-budget label{display:inline-flex;align-items:center;gap:4px;cursor:pointer}
.dsm-qoder-context-budget input{margin:0;accent-color:var(--dsw-alias-brand-primary,#5686fe)}
/* 思考强度选择器：与上下文选择器同一套观感（两者都是「一项设置」）。 */
.dsm-qoder-effort{display:inline-flex;align-items:center;gap:4px}
.dsm-qoder-effort label{display:inline-flex;align-items:center;gap:4px;cursor:pointer}
/*
 * 模型行里的两个选择器（上下文档位 / 思考强度）。
 *
 * 它们**不是**账号池表格里的数字输入框：pool-num 是 13px、74px 宽、8px 圆角
 * 的实心方块，放进 11px 的 meta 行会格外突兀（用户实拍：「这个字体样式很
 * 突兀」）。这里做成「行内值 + 小箭头」：无边框、无底色、字号与所在行一致，
 * 读起来像这一行的文字而不是一个表单控件；hover/focus 才显出可交互。
 */
.dsm-qoder-inline-select{
  appearance:none;
  padding:0 14px 0 0;
  margin:0;
  border:0;
  border-radius:0;
  background-color:transparent;
  background-image:none;
  color:inherit;
  font:inherit;
  font-size:11px;
  line-height:16px;
  cursor:pointer;
  /* 由外层的 ::after 画箭头：原生箭头在暗色主题下不可控。 */
}
.dsm-qoder-inline-select:hover{color:var(--dsw-alias-label-primary,#e6e6e6)}
.dsm-qoder-inline-select:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#5686fe);outline-offset:1px;border-radius:3px}
.dsm-qoder-inline-select:disabled{opacity:.6;cursor:default}
/* 选项列表由系统绘制，不继承行内样式：不加背景会在大面积卡片上渲染成
   透明的一列文字（暗色主题下尤其难读）。 */
.dsm-qoder-inline-select option{background:var(--dsw-alias-bg-layer-2,#24262c);color:var(--dsw-alias-label-primary,#e6e6e6)}
.dsm-qoder-inline{position:relative;display:inline-flex;align-items:center}
.dsm-qoder-inline::after{
  content:"";
  position:absolute;
  top:50%;
  right:3px;
  width:5px;
  height:5px;
  transform:translateY(-70%) rotate(45deg);
  border-right:1.4px solid var(--dsw-alias-label-tertiary,#999);
  border-bottom:1.4px solid var(--dsw-alias-label-tertiary,#999);
  pointer-events:none;
}
.dsm-qoder-model-capability-note{margin:0;color:var(--dsw-alias-label-tertiary,#999);font-size:12px;line-height:18px}
.dsm-qoder-models-head-actions{display:flex;align-items:center;gap:8px;flex:none}
.dsm-qoder-model-probe{flex:none;padding:3px 10px;font-size:11px;line-height:16px}
.dsm-qoder-model-probe-result{margin:0;font-size:12px;line-height:18px;word-break:break-word}
.dsm-qoder-model-probe-result-ok{color:var(--dsw-alias-state-success-primary,#22a06b)}
.dsm-qoder-model-probe-result-warn{color:var(--dsw-alias-state-warn-primary,#f59e0b)}
.dsm-qoder-model-probe-result-bad{color:var(--dsw-alias-state-error-primary,#ef4444)}
.dsm-qoder-model-capability-note{margin:0;color:var(--dsw-alias-label-tertiary,#999);font-size:12px;line-height:18px}
.dsm-qoder-model-actions{display:flex;align-items:center;justify-content:space-between;gap:12px;border-top:1px solid var(--dsw-alias-border-l2,#36373b);padding-top:12px}
.dsm-qoder-model-save-error{flex:1;min-width:0;color:var(--dsw-alias-state-error-primary,#ef4444);font-size:12px;line-height:16px;text-align:right}
.dsm-qoder-model-actions-buttons{display:flex;align-items:center;justify-content:flex-end;gap:8px}
.dsm-qoder-usage-cheer{display:inline-flex;align-items:center;gap:4px;flex:none;text-decoration:underline;text-underline-offset:2px;color:var(--dsw-alias-label-tertiary,#999);font-size:13px;line-height:1.5;transition:color .16s}
.dsm-qoder-usage-cheer-star{font-size:12px;line-height:1;display:inline-flex}
.dsm-qoder-usage-cheer:hover{color:var(--dsw-alias-label-primary,#e6e6e6)}
.dsm-qoder-usage-cheer:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#5686fe);outline-offset:2px}

/* ---- Account pool ---- */
/* 「账号池」标题行夹在**两条线**中间：上面是本块的 border-top，下面是
   .dsm-qoder-pool-actions 的 border-top。要让文字垂直居中，上内边距就必须
   等于它下方那截间距 —— 下方是容器的 gap:12px，所以这里也取 12px。
   原来是 8px，文字因此偏上 4px（用户实拍：「让文字在两条线中间垂直居中」）。
   上一版把上边距压到 8px 是为了回应「红色的部分向上靠拢一些」，那个诉求指的
   是**标题与上方说明行**之间的空档；几何上正解是让标题居中，而不是继续压小
   ——压到 8px 会让它离上线近、离下线远，反而更明显。 */
.dsm-qoder-pool{display:flex;flex-direction:column;gap:12px;margin:0;padding:12px 0 4px;border-top:1px solid var(--dsw-alias-border-l2,#36373b)}
.dsm-qoder-pool-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
/* 「谁在服务」这一槽——池关着是选号下拉，池开着是「当前使用」芯片。
   两者由同一条 margin-left:auto 推到右端，标题行不会在两种状态之间跳。
   下拉此前住在下面设置区自己的一行里，于是同一个账号名在标题行、那一行、
   成员表里各出现一次（workbuddy 94c339f 同规）。 */
.dsm-qoder-pool-head-pick{margin-left:auto;display:flex;align-items:center;gap:8px;font-size:12px}
.dsm-qoder-pool-head-pick-label{color:var(--dsw-alias-label-secondary,#c6c9d0);white-space:nowrap}
/* 积分开关已搬进设置区顶部那两行（形状照 dsh-connect-trae），标题行不再有
   额外的壳——它当初存在只因「开关要和标题挤一行」。 */
.dsm-qoder-pool-current-badge{margin-left:auto;padding:2px 10px;border-radius:999px;background:rgba(86,134,254,.16);color:var(--dsw-alias-brand-primary,#5686fe);font-size:12px;font-weight:600;line-height:18px;white-space:nowrap}
/* 池里没有可用账号时的芯片：灰掉，因为它在说「没有人在服务」而不是「是这个号」 */
.dsm-qoder-pool-current-badge-off{background:rgba(120,120,128,.14);color:var(--dsw-alias-text-secondary,#6b6b70)}
.dsm-qoder-pool-account-select{min-width:200px}
.dsm-qoder-pool-title{margin:0;font-size:15px;font-weight:600;color:var(--dsw-alias-label-primary,#e6e6e6)}
/* 模式条：整页的总开关，紧跟标题。沿用 .dsm-qoder-pool-settings 的带边框
   堆叠样式（组件测试把「启用账号池」定位为它里面的第一个复选框），另加一层
   品牌色描边与浅底，让它读作「这一页其余部分由我定义」而不是又一张设置卡。
   开关原先在**页面底部**，比它控制的一切低 400px。 */
.dsm-qoder-pool-modebar{padding:12px 14px;gap:8px;border:1px solid rgba(86,134,254,.36);border-radius:12px;overflow:hidden;background:linear-gradient(180deg,rgba(86,134,254,.10),rgba(86,134,254,.02)),var(--dsw-alias-bg-layer-2,#24262c)}
.dsm-qoder-pool-modebar-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.dsm-qoder-pool-modebar-label{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary,#e6e6e6)}
/* 模式用文字说出来：开关的位置是一个 20px 的形状要解码，这枚芯片直接说
   现在是哪种模式，也就说清了下面那张表该怎么读。 */
.dsm-qoder-pool-modebar-state{flex:none;padding:1px 9px;border-radius:999px;font-size:12px;line-height:18px;font-weight:500;color:var(--dsw-alias-brand-primary,#5686fe);background:rgba(86,134,254,.14);border:1px solid rgba(86,134,254,.3)}
.dsm-qoder-pool-modebar .dsm-qoder-pool-dirty{margin-left:auto}
.dsm-qoder-pool-modebar .dsm-qoder-pool-note{margin:0;line-height:18px;color:var(--dsw-alias-label-secondary,#c6c9d0)}
/* 自动签到那一行（issue #36）。它紧跟在「启用账号池」下面，共用模式条的盒子：
   两个开关管的是两件不同的事（谁挑号 / 插件能不能自己动手），但它们都是
   「这一页的模式」，所以用同一个形状。上边一条淡分隔线把两行分开。 */
.dsm-qoder-pool-auto-checkin{padding-top:8px;border-top:1px solid rgba(86,134,254,.16)}
/* 进度那一行是**事实**不是警告：中性色写计数，只有真的失败那一段才用琥珀色。
   不做成横幅——它挂在开关右边，与开关属于同一句话。 */
.dsm-qoder-pool-auto-checkin-status{display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#c6c9d0)}
.dsm-qoder-pool-auto-checkin-pending{color:var(--dsw-alias-brand-primary,#5686fe)}
.dsm-qoder-pool-auto-checkin-error{color:var(--dsw-alias-state-warn-primary,#f59e0b);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* 「有人在服务但不在池里」：一条左竖线标它是上一行的旁注，不是警告 */
.dsm-qoder-pool-serving-note{padding-left:10px;border-left:2px solid rgba(86,134,254,.5);color:var(--dsw-alias-label-secondary,#c6c9d0)}
/* 批量动作条：成员卡片内部一行，所以没有上边框——分隔线会把按钮和上一行
   「已选 N / M」切开，而那两个数字正是这些按钮的作用范围。左右内边距跟着卡头
   走，三行的左对齐线才是同一条。 */
.dsm-qoder-pool-actions{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:0 14px 12px}
.dsm-qoder-pool-actions-group{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.dsm-qoder-pool-hint{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#c6c9d0)}
.dsm-qoder-pool-note{margin:0;font-size:12px;line-height:17px;color:var(--dsw-alias-label-secondary,#c6c9d0)}
.dsm-qoder-pool-warn{margin:0;padding:9px 11px;border-radius:9px;font-size:12px;line-height:17px;color:var(--dsw-alias-state-warn-primary,#f59e0b);background:rgba(245,158,11,.09);border:1px solid rgba(245,158,11,.3)}
/* 空状态（这一区一个账号都没有）：不是警告，是引导 —— 用中性色，别让「还没添加」
   读起来像「出问题了」。 */
.dsm-qoder-pool-empty{margin:0;padding:9px 11px;border-radius:9px;font-size:12px;line-height:17px;color:var(--dsw-alias-label-secondary,#666);background:var(--dsw-alias-fill-tertiary,rgba(127,127,127,.08));border:1px dashed var(--dsw-alias-border-secondary,rgba(127,127,127,.3))}
.dsm-qoder-pool-error{margin:0;font-size:12px;line-height:17px;color:var(--dsw-alias-state-error-primary,#ef4444);white-space:pre-line}
.dsm-qoder-pool-table{
  /* CONTAINMENT ROOT */
  container-type:inline-size;
  /* 列轨道写在变量里，由表格自己按「有没有签到列」声明一次；行与表头都读它。
     此前是两条规则各写一遍 grid-template-columns，于是「有签到列」那条
     （.dsm-qoder-pool-table-checkin .dsm-qoder-pool-row，两个类）在层叠上
     压过了媒体查询里的宽屏那条（一个类）——**宽屏形态从来没有渲染过**，
     窗口多宽都是两行紧凑排法。变量只在一处声明，行与表头不可能再分叉。 */
  /* 尾部两条轨道都是**固定 px**，不用 fr / auto：轨道的宽度必须与格子里有没有
     内容无关，否则表头与数据行会各自算出不同的轨道宽度、越往右错得越多
     （实测过表头「账号」w=275 而数据格 w=246）。
     两份定义各写一次，是因为「有签到列」与否轨道数不同。 */
  /* 签到列给 118px：这一格的文案是「23:59:59 后可再签到」这种**最长**形态，
     实测 116px。给 96px 时它会溢出自己的轨道，而数字每秒在变，溢出量也跟着变
     ——看着像这一格在抖。
   *
   * 末尾固定 96px 给**操作列**（测试 / 删除）：它在宽屏是独立一格，在窄形态里
   * 则是第二行的右端 —— 同一组按钮，两种排法。曾经删掉过这一条（按钮那时住在
   * 账号格的名字行里），结果宽屏那一列空着；现在按钮回到行级，轨道重新有主。 */
  --dsm-qoder-pool-cols:minmax(0,1.75fr) minmax(0,.95fr) minmax(0,1.35fr) 118px 96px;
  /* 表格不再自己描边：它现在是成员卡片里的一段，卡片已经有那圈边框了。
     自己再描一圈会得到「框中框」——两圈相距 1px，看着像渲染出错。 */
  border:0;border-radius:0;overflow:hidden;
  border-top:1px solid var(--dsw-alias-border-l1,#2c2d31);
  background:var(--dsw-alias-bg-layer-2,#24262c);
}
/* 国际版暂不通签到：少一条签到轨道，操作列（末尾固定 96px）仍在。 */
.dsm-qoder-pool-table:not(.dsm-qoder-pool-table-checkin){--dsm-qoder-pool-cols:minmax(0,1.9fr) minmax(0,.9fr) minmax(0,1.4fr) 96px}
/* 行布局：**窄是默认，宽由容器查询升级**。
 *
 * 断点测的必须是**这张表**的宽度，不是视口。这张卡同时画在三处，宽度与窗口毫无
 * 关系：输入框卡片、整页版（上限 860px）、以及设置面板的内容列（1400px 屏上是
 * 578px）。此前用的是 @media (min-width:761px)——在 1440px 的窗口里它永远成立，
 * 于是 578px 的表格拿到了宽屏那套，账号列被撑到 402px、行高 108px，而右侧 134px
 * 的积分列里只有两位数。实测（1440 视口 / 578px 表格）：
 *   账号 x=1159 w=402 │ 积分 x=1573 w=134 │ 状态 x=1159 w=402 │ 签到 x=1573 w=36
 *
 * 窄形态用 flex + wrap，按**两行**排（用户第三次实拍后定的形态）：
 *
 *   第一行：账号（辨认的一端）… 积分（**推到这一行最右**）
 *   第二行：状态 · 签到 … 操作按钮（**推到这一行最右**）
 *
 * 为什么是两行而不是三行：原来第二行整行只有「积分 + 到期两句」，而到期那两句
 * 已被移除（界面上不再提供到期时刻），于是那一行只剩下一个数字——让一整行只为
 * 一个数字存在，是把每行的高度白付一次。数字短、右对齐无害，所以它上提进第一行
 * 的右端；状态与签到顺势上移成第二行，操作按钮落在同一行的右端。
 *
 * 两行各自「左端是内容、右端是补充」：第一行左端是**你是谁**、右端是**多少分**；
 * 第二行左端是**能不能用**、右端是**能对它做什么**。
 *
 * 走错的路记在这里免得再走一遍：
 *   - 全部 flex-wrap 挤成一行（三行时代的进一步压缩）会变成「888  可用(1.5s)
 *     测得 · 1 分钟前  已签到  [测试] [删除]」——只读事实与可点按钮挤成一句话；
 *   - 固定 grid 两行时账号名短也撑满整行，横向空出一大片；
 *   - 三行时操作按钮 flex-basis:100% 独占一行：每个账号白付一整行高度。
 */
.dsm-qoder-pool-row{
  display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 12px;padding:10px 14px;
  border-top:1px solid var(--dsw-alias-border-l1,#2c2d31);font-size:13px;color:var(--dsw-alias-label-secondary,#c6c9d0);
}
.dsm-qoder-pool-account{display:flex;align-items:center;gap:8px;min-width:0;flex:1 1 100%}
/* 积分：**贴在第一行（账号格）最右端**。
 *
 * 它现在住在 .dsm-qoder-pool-account 里，是该格内的最后一个 flex 项，靠
 * margin-left:auto 推到这一格的右端 —— 而账号格本身 flex:1 1 100% 独占第一行，
 * 所以这就是**第一行的右端**。
 *
 * 为什么不放在行级：行级的序号在状态与签到之后，放那里它只会落在第二行。
 *
 * flex:none + white-space:nowrap：数字是这一行的右边界，它一折行，第一行就
 * 变成两行，整个「两行」形态就塌了。 */
.dsm-qoder-pool-credits{display:flex;flex-direction:row;align-items:baseline;gap:2px 8px;min-width:0;flex:none;margin-left:auto;white-space:nowrap;font-variant-numeric:tabular-nums}
/* 状态这一格允许自己折行：主行（结果 · 原因）与出处行本来就是一句话。 */
.dsm-qoder-pool-probe{display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 8px;font-size:12px;line-height:17px;color:var(--dsw-alias-label-tertiary,#999);min-width:0;flex:1 1 auto;overflow-wrap:anywhere}
/* 签到跟在状态后面，**不再自己抢右端**：第二行的右端留给操作按钮（见下）。
 * 之前它靠 margin-left:auto 占右端，那时按钮在第三行；现在两者同一行，右端只能
 * 有一个主人，否则两个 auto 会把这一行撕成三截。 */
.dsm-qoder-pool-checkin{font-size:12px;line-height:17px;color:var(--dsw-alias-label-tertiary,#999);white-space:nowrap;flex:none;margin-left:0}
/* 行内操作（测试 / 删除）坐**第二行的右端**（1.20.0 定稿）。
 *
 * 走过的三条路，按顺序记下来，因为每一条都对应一次用户实拍：
 *   1. flex:1 1 100% 独占第三行、左对齐 —— 每个账号白付一整行高度；
 *   2. 挪进名字那一行、margin-left:auto 推右 —— 省了一行，但名字行因此被
 *      名次、「当前使用」、↑↓、按钮挤满；
 *   3. **现在**：回到行级，与状态、签到同处第二行，由 margin-left:auto 推到
 *      这一行的右端。第一行留给「你是谁 + 多少分」，第二行是「能不能用 + 能对它
 *      做什么」。
 *
 * flex:none 承重：状态文本可以折行，按钮不行 —— 被压窄的按钮点不准。
 */
.dsm-qoder-pool-row-actions{display:flex;gap:6px;align-items:center;flex:none;margin-left:auto}
/* 窄形态不画表头：它的标签描述的是宽屏那套轨道，折行之后每一个标签都对不上
   自己的值——实测「签到」标签停在 x=1476，它的值在 1573，差 97px。一堆对不上的
   表头比没有表头更糟（dsh-connect-trae 在 700px 以下是同一条判断）。 */
.dsm-qoder-pool-row-head{display:none;padding:8px 14px;background:var(--dsw-alias-bg-layer-3,#2a2c33);color:var(--dsw-alias-label-tertiary,#999);font-size:11px;font-weight:600;letter-spacing:.02em;text-transform:uppercase}
.dsm-qoder-pool-row:first-child{border-top:0}
/* 宽屏：这张表自己够宽时才排成一行 5 列，一眼横向可比。
 * 阈值 700px 与 dsh-connect-trae 取同一个数，理由相同：表格没有「稍微窄一点」的
 * 形态值得保留——要么放得下这些列，要么放不下。 */
@container (min-width:700px){
  .dsm-qoder-pool-row{display:grid;grid-template-columns:var(--dsm-qoder-pool-cols);align-items:center;gap:12px}
  /* 宽屏那张表是**单行**，所以每一格回到自己的轨道：窄形态那几条 flex 覆盖
     （100% 占满、margin-left:auto 推右）必须在这里让位，否则操作按钮会带着
     flex-basis:100% 挤到第二行，五行变六行。 */
  .dsm-qoder-pool-account,.dsm-qoder-pool-credits,.dsm-qoder-pool-probe,
  .dsm-qoder-pool-checkin{flex:none;margin-left:0;padding-top:0}
  .dsm-qoder-pool-credits{flex-direction:column;align-items:flex-start;gap:1px}
  .dsm-qoder-pool-probe{flex-direction:column;align-items:flex-start;gap:4px}
  .dsm-qoder-pool-checkin{margin-left:0}
  /* 操作按钮在宽屏是**自己的最后一格**，靠 justify-self 贴右端；窄形态那条
     margin-left:auto 在这个单行网格里必须让位（否则它会把按钮从格子里顶出去）。 */
  .dsm-qoder-pool-row-actions{justify-self:end;margin-left:0}
  .dsm-qoder-pool-account-name{flex:1 1 auto}
  /* 表头回到宽屏那套轨道上——它现在与行读的是**同一个变量**，不会再错位。 */
  .dsm-qoder-pool-row-head{display:grid;grid-template-columns:var(--dsm-qoder-pool-cols);align-items:center;gap:12px}
  /* 操作列表头是个空 span；display:block 让它占住自己的轨道（否则某些外壳会
     把它塌成 0 宽，四条 fr 轨道于是各多分到一点，标签整体右移）。 */
  .dsm-qoder-pool-row-head > span:last-child{display:block}
}
.dsm-qoder-pool-row-current{background:rgba(86,134,254,.07)}
/* 左侧 3px 竖条：正在计费的那一行必须一眼可见。只靠 7% 的背景色，在暗色主题
   下几乎看不出区别（workbuddy 同规，两条规则共用同一个类名）。 */
.dsm-qoder-pool-row-current{box-shadow:inset 3px 0 0 var(--dsw-alias-brand-primary,#5686fe)}
/* 名字块占满账号格里**除积分以外**的剩余宽度（flex:1 1 auto）。
 *
 * 这个 1 现在是**积分右对齐的前提**：积分在同一个格子里靠 margin-left:auto 推右，
 * 只有名字块把剩余空间吃掉，auto 才有「剩余」可推。名字块若是 0 1 auto（有多宽算
 * 多宽），积分就会紧贴名字后面，右对齐又回到半途 —— 上一版正是这样差了 113px。
 *
 * min-width:0 保留：长账号名要能省略，不能把块撑破。 */
.dsm-qoder-pool-account-name{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1 1 auto}
/* 第一行：名字 + 名次 + 「当前使用」+ 上下移，全部**同一行**。
   这一列原来是 5 行竖排（名次 / 箭头 / 徽章 / 测试于 / 上一行结果），把整行
   撑到 90px 以上，而同一行的另外四列各自都只有一行 —— 高度全浪费在这里。
   现在压缩成 2 行：身份 + 一句话原因。 */
.dsm-qoder-pool-account-line{display:flex;align-items:center;gap:6px;min-width:0;flex-wrap:wrap}
.dsm-qoder-pool-account-name b{font-weight:600;font-size:13px;color:var(--dsw-alias-label-primary,#e6e6e6);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.dsm-qoder-pool-account-name span{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,#999)}
.dsm-qoder-pool-account-name .dsm-qoder-pool-current-tag{margin:0;padding:1px 6px;border-radius:999px;background:rgba(86,134,254,.16);color:var(--dsw-alias-brand-primary,#5686fe);font-size:11px;font-weight:600;line-height:16px;white-space:nowrap;flex:none}
/* 上下移**紧贴「当前使用」**，不推到这一行的右端。
 *
 * 它读起来是「名字 · 第 1 位 · 当前使用 · ↑↓」这一句话：↑↓ 改的是**名次**，
 * 而名次就画在名字旁边。曾经用 margin-left:auto 把它推到行尾（当时的理由是
 * 「它改的是名次，贴着名字会让人以为它只作用于名字」），用户实拍指出那一段空白
 * 让控件看起来像掉队的第四个徽章 —— 现在第一行的右端由**积分**占据，这一行不再
 * 需要谁来撑满。
 *
 * 这条对宽屏同样成立，所以不再需要容器查询里的那条覆盖（原先宽屏要把它改回 0）。
 */
.dsm-qoder-pool-account-line .dsm-qoder-pool-move{margin-left:0}
.dsm-qoder-pool-excluded{color:var(--dsw-alias-state-warn-primary,#f59e0b)}
.dsm-qoder-pool-credits b{color:var(--dsw-alias-label-primary,#e6e6e6);font-weight:600}
.dsm-qoder-pool-probe-main{color:var(--dsw-alias-label-secondary,#c6c9d0)}
.dsm-qoder-pool-probe-prov{display:flex;align-items:center;gap:5px;font-size:11px;line-height:15px;color:var(--dsw-alias-label-tertiary,#999);min-width:0;flex-wrap:wrap}
.dsm-qoder-pool-prov-tag{padding:1px 6px;border-radius:999px;background:var(--dsw-alias-bg-layer-3,#2a2c33);color:var(--dsw-alias-label-tertiary,#999);font-size:10px;font-weight:600;line-height:15px;white-space:nowrap}
.dsm-qoder-pool-prov-live{background:rgba(245,158,11,.16);color:var(--dsw-alias-state-warn-primary,#f59e0b)}
.dsm-qoder-pool-prov-unknown{background:var(--dsw-alias-bg-layer-3,#2a2c33);border:1px solid var(--dsw-alias-border-l1,#2c2d31);color:var(--dsw-alias-label-secondary,#c6c9d0)}
.dsm-qoder-pool-prov-sep{color:var(--dsw-alias-label-dimmed,#9aa0a6);opacity:.7}
.dsm-qoder-pool-prov-age{color:var(--dsw-alias-label-tertiary,#999);white-space:nowrap}
/* 成员区是一张**卡片**：卡头（标题 + 已选/全选/全不选）、批量条、表格全在同一个
   边框里（学 dsh-connect-trae 的 .dsm-trae-pool-card）。
   此前是「标题浮在外面 + 表格自己描一圈边」：标题与表格之间隔着一条 gap，读起来
   像两个不相干的东西，而卡头上那枚「已选 2 / 2」与它要看管的复选框之间又隔着
   一条批量条。一张卡片、一条分隔线，谁管谁就一目了然。 */
.dsm-qoder-pool-members{display:flex;flex-direction:column;gap:0;border:1px solid var(--dsw-alias-border-l2,#3a3d45);border-radius:12px;overflow:hidden;background:var(--dsw-alias-bg-layer-2,#24262c)}
.dsm-qoder-pool-members-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:14px 14px 12px}
.dsm-qoder-pool-members-title{margin:0 0 3px;font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary,#e6e6e6)}
.dsm-qoder-pool-members-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.dsm-qoder-pool-small-btn{padding:3px 10px;font-size:12px}
.dsm-qoder-pool-check{display:inline-flex;align-items:center;flex:none;cursor:pointer}
.dsm-qoder-pool-check input{margin:0;cursor:pointer;accent-color:var(--dsw-alias-brand-primary,#5686fe)}
.dsm-qoder-pool-check input:disabled{cursor:default;opacity:.5}
.dsm-qoder-pool-checked{color:var(--dsw-alias-state-success-primary,#22a06b)}
/* 倒计时那一格现在是**唯一**的一句话（不再与「已签到」并排），所以没有 margin-left。
   数字逐秒变化，给它等宽数字（tabular-nums）—— 否则位数一变整格宽度就抖，表格列
   跟着左右晃。颜色沿用单元格本身的 label-tertiary：它就是这一格的主句。 */
.dsm-qoder-pool-checkin-next{font-variant-numeric:tabular-nums;font-feature-settings:"tnum"}
/* 到点之后同样是主句、不缩进；绿色表示「此刻有事可做」，与「已签到」同色。 */
.dsm-qoder-pool-checkin-due{color:var(--dsw-alias-state-success-primary,#22a06b)}
.dsm-qoder-pool-unknown{color:var(--dsw-alias-label-dimmed,#9aa0a6)}
/* 优先级名次。手动排序用品牌色实心底（这是用户自己定的，是「生效的顺序」）；
   自动排序用虚线灰框（不占位、不抢注意力，也不假装名次已经固定）。 */
.dsm-qoder-pool-rank{flex:none;padding:0 6px;border-radius:9px;font-size:11px;line-height:17px;font-weight:600;color:var(--dsw-alias-brand-primary,#5686fe);background:color-mix(in srgb,var(--dsw-alias-brand-primary,#5686fe) 14%,transparent)}
.dsm-qoder-pool-rank-auto{flex:none;padding:0 6px;border-radius:9px;font-size:11px;line-height:17px;color:var(--dsw-alias-label-dimmed,#9aa0a6);border:1px dashed var(--dsw-alias-border-l2,#3a3d45)}
.dsm-qoder-pool-move{display:inline-flex;gap:2px;margin-left:2px}
.dsm-qoder-pool-move-btn{width:20px;height:20px;padding:0;display:inline-flex;align-items:center;justify-content:center;border-radius:6px;border:1px solid var(--dsw-alias-border-l2,#3a3d45);background:transparent;color:var(--dsw-alias-label-secondary,#b6bcc6);font-size:12px;line-height:1;cursor:pointer}
.dsm-qoder-pool-move-btn:hover:not(:disabled){border-color:var(--dsw-alias-brand-primary,#5686fe);color:var(--dsw-alias-brand-primary,#5686fe)}
.dsm-qoder-pool-move-btn:disabled{opacity:.35;cursor:default}
.dsm-qoder-pool-move-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#5686fe);outline-offset:1px}
.dsm-qoder-pool-not-member{color:var(--dsw-alias-label-dimmed,#9aa0a6)}
/* 一道分节线，不只是间距：过这条线，页面从「池是什么」转到「改它的旋钮」。
   没有这条线，标题就浮在表格下面，主题换了却没有任何标记（workbuddy 同规）。 */
.dsm-qoder-pool-settings-wrap{display:flex;flex-direction:column;gap:10px;border-top:1px solid var(--dsw-alias-border-l2,#36373b);padding-top:14px}
/* 「更多设置」的副标题：比页面标题低一级，面板只有一个主标题而非两个一样响的。 */
.dsm-qoder-pool-card-head{display:flex;align-items:center;gap:8px}
.dsm-qoder-pool-card-title{margin:0;font-size:13px;font-weight:600;color:var(--dsw-alias-label-secondary,#c6c9d0)}
.dsm-qoder-pool-dirty{font-size:12px;line-height:18px;font-weight:500;color:var(--dsw-alias-state-warn-primary,#f59e0b)}
/* 设置区**不带框**（1.20.0，用户实拍「下面的功能设置也不要外围的框」）。
 *
 * 它曾经是一张带边框 + 圆角 + 底色的卡片。边框在这里没有承托任何东西：里面只有
 * 两行设置，而每一行自己都有标题；外框反而让它读起来像页面里的第二张卡片
 * （页面上已经有成员卡片与账号工具虚线框两张）。
 *
 * container-type:inline-size 不是装饰：下面那条窄列容器查询（设置行改成上下
 * 两段）要有这条线的祖先声明才可能生效。
 *
 * ⚠️ **模式条复用同一个类名**（.dsm-qoder-pool-modebar），所以它现在把边框、
 * 圆角、overflow 全部**写在自己那条规则里**，不再依赖共享类提供。 */
.dsm-qoder-pool-settings{container-type:inline-size;display:flex;flex-direction:column;gap:1px}
/* Add-PAT + export/import, above the 「更多设置」 heading. */
/*
 * 账号工具（添加 PAT / 导出 / 导入）：三颗按钮共用一行。
 *
 * 两条工具条各自是 <section class="dsm-qoder-bar">，这里用 display:contents 把它们
 * 的壳塌陷掉——「添加 PAT」与「导出 / 导入」的按钮、状态行、对话框直接参与外层的
 * 排列，于是三颗按钮落在同一行，右端对齐，间距由 gap 统一。
 *
 * 对话框用 flex-basis:100% 强制换行、独占一行：让它保持在按钮**下方展开**的原有
 * 行为（不改成绝对定位的浮层——浮层要盖住下面的成员表，还得自己管阴影与遮挡）。
 *
 * 备注：display:contents 会让 <section> 的名字在某些浏览器里从无障碍树消失，
 * 所以两个 .dsm-qoder-bar-actions 各自带 role="group" + aria-label（组件里）。
 */
.dsm-qoder-pool-tools{display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-end;gap:8px;border:1px dashed var(--dsw-alias-border-l2,#3a3d45);border-radius:12px;padding:6px 10px}
.dsm-qoder-pool-tools > .dsm-qoder-bar{display:contents}
/*
 * 两处必须覆盖，都是「塌陷成一行」之后才出现的：
 *
 * 1. 两组按钮各自带 margin-left:auto，在外层会**平分**剩余空间——实测第一颗
 *    停在行的中间、第二组贴着右端，中间空出一大截。右对齐交给容器的
 *    justify-content 统一负责，这里归零。
 * 2. DOM 顺序里「添加 PAT」的对话框夹在两组按钮中间。对话框一换行，跟在它后面
 *    的「导出 / 导入」就被挤到下一行（实测两颗按钮整行消失）。用 order 把对话框
 *    排到所有按钮之后。
 */
.dsm-qoder-pool-tools .dsm-qoder-bar-actions{margin-left:0}
.dsm-qoder-pool-tools .dsm-qoder-transfer-dialog{order:2;flex:1 1 100%;margin:0}
/* 两行设置：**左右不内缩**，与账号工具虚线框、保存行落在同一条竖线上。
 *
 * 那 14px 左右内边距原本是外层卡片的内边距（卡片在 1.20.0 已被去掉，见
 * .dsm-qoder-pool-settings 那条）。卡片没了之后它没有任何东西可承托，只会让这两行
 * 比周围的块窄一截 —— 实测 564px 列里，账号工具与保存行从 x=24 起，这两行从
 * x=38 起，说明文字因此只有 292px、折成四行（用户实拍「宽度也要调整啊」）。
 *
 * 纵向 12px 保留：两行之间要透气，那是行距，不是内缩。 */
.dsm-qoder-pool-set{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:12px 0;border-top:1px solid var(--dsw-alias-border-l1,#2c2d31)}
.dsm-qoder-pool-set:first-child{border-top:0}
.dsm-qoder-pool-set-copy{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1}
.dsm-qoder-pool-set-copy b{font-size:13px;font-weight:500;color:var(--dsw-alias-label-primary,#e6e6e6)}
.dsm-qoder-pool-set-copy span{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary,#999)}
.dsm-qoder-pool-set-ctl{flex:none;display:flex;align-items:center;gap:8px}
.dsm-qoder-pool-num{width:74px;padding:6px 10px;border:1px solid var(--dsw-alias-border-l2,#3a3d45);border-radius:8px;background:var(--dsw-alias-bg-layer-3,#2a2c33);color:var(--dsw-alias-label-primary,#e6e6e6);font:inherit;font-size:13px;text-align:center;font-variant-numeric:tabular-nums}
.dsm-qoder-pool-select{max-width:260px;padding:6px 10px;border:1px solid var(--dsw-alias-border-l2,#3a3d45);border-radius:8px;background:var(--dsw-alias-bg-layer-3,#2a2c33);color:var(--dsw-alias-label-primary,#e6e6e6);font:inherit;font-size:13px;cursor:pointer}
.dsm-qoder-pool-select:disabled,.dsm-qoder-pool-num:disabled{opacity:.5;cursor:default}
/* 提交行：面板在屏期间钉在视口底部。面板比一屏还高，而让任何编辑真正生效的
   两颗按钮原本在它最底部——用户改完的那一刻正好在视口之外，截图里干脆看不见。
   背景必须不透明：内容会从它下面滚过去。（workbuddy 94c339f 同规。） */
.dsm-qoder-pool-save-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;border-top:1px solid var(--dsw-alias-border-l2,#36373b);padding-top:12px;position:sticky;bottom:0;z-index:2;padding-bottom:8px;background:var(--dsw-alias-bg-layer-3,#2a2c33)}
/* 与模型保存行同规：flex-wrap 去掉、按钮组 flex:none 去掉——两行是同一个
   组件族的同一种「保存行」，一行会换行、另一行不会，看起来就是两套样式
   （用户实拍：「这里的样式不统一」）。左端的仓库链接靠 usage-cheer 自带的
   flex:none 保持不压缩。 */
.dsm-qoder-pool-save-buttons{display:flex;align-items:center;justify-content:flex-end;gap:8px}
.dsm-qoder-pool-conflict{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:11px 13px;border-radius:10px;background:rgba(245,158,11,.08);border:1px solid var(--dsw-alias-state-warn-primary,#f59e0b)}
.dsm-qoder-pool-pending{flex:none;align-self:center;font-size:12px;line-height:17px;color:var(--dsw-alias-state-warn-primary,#f59e0b)}
.dsm-qoder-pool-conflict-main{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}
.dsm-qoder-pool-conflict-main b{font-size:12px;font-weight:600;color:var(--dsw-alias-state-warn-primary,#f59e0b)}
.dsm-qoder-pool-conflict-main span{font-size:12px;line-height:17px;color:var(--dsw-alias-label-secondary,#c6c9d0)}
.dsm-qoder-pool-log{border:1px solid var(--dsw-alias-border-l2,#3a3d45);border-radius:12px;overflow:hidden;background:var(--dsw-alias-bg-layer-2,#24262c)}
.dsm-qoder-pool-log-head{display:flex;align-items:center;justify-content:space-between;padding:9px 14px;background:var(--dsw-alias-bg-layer-3,#2a2c33);border-bottom:1px solid var(--dsw-alias-border-l1,#2c2d31);font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary,#c6c9d0)}
.dsm-qoder-pool-log-clear{padding:2px 10px;font-size:12px}
.dsm-qoder-pool-log-body{max-height:186px;overflow-y:auto}
.dsm-qoder-pool-log-row{display:flex;gap:10px;padding:7px 14px;border-top:1px solid var(--dsw-alias-border-l1,#2c2d31);font-size:12px;line-height:18px}
.dsm-qoder-pool-log-row:first-child{border-top:0}
.dsm-qoder-pool-log-time{flex:none;color:var(--dsw-alias-label-tertiary,#999);font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.dsm-qoder-pool-log-text{min-width:0;overflow-wrap:anywhere}
.dsm-qoder-pool-log-ok{color:var(--dsw-alias-state-success-primary,#22a06b)}
.dsm-qoder-pool-log-warn{color:var(--dsw-alias-state-warn-primary,#f59e0b)}
.dsm-qoder-pool-log-error{color:var(--dsw-alias-state-error-primary,#ef4444)}
.dsm-qoder-pool-log-info{color:var(--dsw-alias-label-secondary,#c6c9d0)}
.dsm-qoder-pool-log-empty{padding:14px;font-size:12px;color:var(--dsw-alias-label-tertiary,#999)}
/* 操作列只有 .8fr（约 88px 内容宽），两颗按钮必须**不换行**：中文可以在任意
   两字之间断行，于是「测试」「删除」会被压成竖排的两个字（桌面宽度下实测）。
   nowrap + 略收窄的左右 padding，比给这一列加宽更划算——加宽要从「账号」列
   拿空间，而账号名那一列本来就挤（名次、箭头、徽章都在里面）。 */
.dsm-qoder-pool-row-actions .dsm-qoder-pool-small-btn{padding:2px 7px;font-size:12px;white-space:nowrap;flex:none}
/* 「删除」分三档，按「用户离不可逆操作还有多远」决定红的浓度。
 *
 *   1. 静止态 —— 淡红。它和「测试」并排，两者都是 outline 小按钮，若删除也用
 *      满饱和红，整行右侧会一直有一块红色在喊；而这一行在绝大多数时候是被扫视
 *      而不是被操作的。用 color-mix 把危险色调到 62% 再混一点标签灰，得到一个
 *      「看得出是危险动作、但不抢注意力」的强度。
 *   2. 悬停 —— 回到满饱和红，边框也跟着点亮。指针已经停在它上面，此刻该明确。
 *   3. 确认条里的「确认删除」—— 实心红底白字（见下面的 .dsm-btn-danger）。
 *      只有走到这一步才是真的要删。
 *
 * 兜底值写成 #c76a6a 而不是 #ef4444：不支持 color-mix 的环境（老 WebView）
 * 拿到的是同一条柔和红，而不是突然变回满饱和。
 * （注释里不能用反引号 —— CSS 整段是模板字符串，反引号会把它拦腰截断。这条
 * 在 1.17.x 里已经踩过两次。） */
.dsm-qoder-pool-delete-btn{color:#c76a6a;color:color-mix(in srgb,var(--dsw-alias-state-error-primary,#ef4444) 62%,var(--dsw-alias-label-tertiary,#9aa0a8))}
.dsm-qoder-pool-delete-btn:hover:not(:disabled){color:var(--dsw-alias-state-error-primary,#ef4444);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary,#ef4444) 55%,transparent)}
/* 二次确认就地展开在这一行的操作格里，不弹窗：确认的是什么（哪个账号）必须
   和被确认的那一行待在同一视线内，隔到弹窗里就说错了对象。 */
.dsm-qoder-pool-confirm{display:flex;gap:6px;align-items:center;justify-content:flex-end;flex-wrap:wrap}
.dsm-qoder-pool-confirm-text{font-size:11px;line-height:15px;color:var(--dsw-alias-state-error-primary,#ef4444);text-align:right}
.dsm-qoder-pool .dsm-btn-danger{border-color:var(--dsw-alias-state-error-primary,#ef4444);color:#fff;background:var(--dsw-alias-state-error-primary,#ef4444)}
.dsm-qoder-pool .dsm-btn-danger:hover:not(:disabled){opacity:.9}
/* 设置面板那种窄列（564px）里，两行设置改成**上下两段**：说明文字独占整宽，
   下拉框落到它下面一行并占满整宽。
 *
 * 并排时说明文字只剩约 320px —— 那句「全池共用这一个模型…」要折四行，而下拉框
 * 右侧还有一片用不掉的空白。上下排之后文字拿到约 516px，行数减半。
 * 判据与 workbuddy 的 @container max-width:620px 同一条。
 *
 * 用**容器查询**不用媒体查询：这张卡画在输入框、整页版、设置面板三处，视口宽度
 * 与这张表的宽度毫无关系（设置面板里视口是 1400px 而表格只有 564px）。
 */
@container (max-width:620px){
  .dsm-qoder-pool-set{flex-direction:column;align-items:stretch;gap:8px}
  .dsm-qoder-pool-set-ctl{flex:1 1 auto;justify-content:flex-start}
  /* width:100% 会输给 max-width：下拉框基础规则里有 max-width:260px，下面那条
     @media 又把它压到 180px —— 两者都会盖住 width:100%，所以这里必须把
     max-width 一起放开，否则下拉框在窄列里仍只占 180px。 */
  .dsm-qoder-pool-select{max-width:none;width:100%}
}
/* 手机上把下拉框收窄：这一条量的是**视口**，而它服务的正是插件市场那个宽页面
   （视口就是约束）。设置面板里的窄列由上面那条容器查询负责 —— 在面板里视口是
   1400px，这条永远不成立，所以两者不会打架。 */
@media (max-width:760px){.dsm-qoder-pool-select{max-width:180px}}
/* Pool switch, namespaced under .dsm-qoder-pool so it cannot collide with host styles. */
.dsm-qoder-pool .sw{position:relative;display:inline-block;width:38px;height:22px;flex:none;cursor:pointer}
.dsm-qoder-pool .sw input{position:absolute;opacity:0;width:0;height:0}
.dsm-qoder-pool .sw-track{position:absolute;inset:0;border-radius:999px;background:var(--dsw-alias-border-l2,#3a3d45);transition:background .18s}
.dsm-qoder-pool .sw-track::after{content:"";position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform .18s;box-shadow:0 1px 3px rgba(0,0,0,.3)}
.dsm-qoder-pool .sw input:checked+.sw-track{background:var(--dsw-alias-brand-primary,#5686fe)}
.dsm-qoder-pool .sw input:checked+.sw-track::after{transform:translateX(16px)}
.dsm-qoder-pool .sw input:disabled+.sw-track{opacity:.4}
.dsm-qoder-pool .sw input:disabled{cursor:default}
/* Account action bars: Add-PAT and export/import. */
.dsm-qoder-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:8px 0;padding:0}
.dsm-qoder-bar-status{flex:1 1 auto;min-width:0;margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-primary,#e8e9ed);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/*
 * 「PAT 从哪来」的那一句搬进对话框后，这条 bar 上只剩按钮与（偶发的）状态行；
 * 原来那条「.dsm-qoder-bar-hint」（常驻在标签与按钮之间）已无渲染者，随之删除。
 * 按钮靠 margin-left:auto 仍然贴右端。
 */
.dsm-qoder-bar-actions{display:flex;gap:8px;flex:none;margin-left:auto}
.dsm-qoder-bar a{color:var(--dsw-alias-brand-primary,#5686fe);text-decoration:none}
.dsm-qoder-bar a:hover{text-decoration:underline}
.dsm-qoder-bar-ok{color:var(--dsw-alias-state-success-primary,#22a06b)}
.dsm-qoder-bar-error{color:var(--dsw-alias-state-error-primary,#ef4444)}
/* 同 .dsm-qoder-usage-hint：<p> 的浏览器默认上下边距（1em = 16px）必须显式
   归零，否则行与行之间凭空多出两段空白。本文件里每一条渲染成 <p> 的规则都
   要写 margin:0 —— 这条此前漏了。 */
.dsm-qoder-hint{margin:0;color:var(--dsw-alias-label-tertiary,#999)}
/* The Add-PAT / transfer dialog is deliberately a block: it holds either the
   PAT paste field or a scrollable account list, which cannot live in a one-row
   bar. */
.dsm-qoder-transfer-dialog{margin-top:8px;padding:10px 12px;border:1px solid var(--dsw-alias-border-l2,#3a3d45);border-radius:10px;background:var(--dsw-alias-bg-secondary,transparent)}
.dsm-qoder-transfer-dialog p{margin:0 0 8px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-primary,#e8e9ed)}
.dsm-qoder-transfer-dialog-actions{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}
.dsm-qoder-transfer-list{list-style:none;margin:0 0 8px;padding:0;max-height:180px;overflow-y:auto}
.dsm-qoder-transfer-list label{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--dsw-alias-label-primary,#e8e9ed);cursor:pointer;padding:2px 0}
.dsm-qoder-transfer-list input[type="checkbox"]{flex:none}
.dsm-qoder-transfer input[type="file"]{font-size:12px;color:var(--dsw-alias-label-primary,#e8e9ed);margin-bottom:8px}
.dsm-qoder-transfer-file{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
/* PAT paste field inside the Add-PAT dialog. */
.dsm-qoder-addpat-input{width:100%;box-sizing:border-box;padding:8px 10px;margin-bottom:8px;border:1px solid var(--dsw-alias-border-l2,#3a3d45);border-radius:8px;background:var(--dsw-alias-bg-layer-3,#2a2c33);color:var(--dsw-alias-label-primary,#e8e9ed);font:inherit;font-size:13px}
.dsm-qoder-addpat-input:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#5686fe);outline-offset:1px}
.dsm-qoder-addpat-name{width:100%;box-sizing:border-box;padding:6px 10px;margin-bottom:8px;border:1px solid var(--dsw-alias-border-l2,#3a3d45);border-radius:8px;background:var(--dsw-alias-bg-layer-3,#2a2c33);color:var(--dsw-alias-label-primary,#e8e9ed);font:inherit;font-size:12px}
.dsm-qoder-addpat-name:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#5686fe);outline-offset:1px}
/* 弹窗里的「如何创建 PAT？」入口：小字、品牌色、不抢主按钮的注意力。 */
/* 「PAT 从哪来」的文字路径 + 文档外链合成一块：左侧一道细竖线表示「参考信息」，
   与上面两个待填的输入框区分开。块内段落必须按「对话框 > 块 > 段落」的完整路径
   覆盖边距——「.dsm-qoder-transfer-dialog p」给了 8px 下边距，不覆盖的话两行会散开
   成两块。 */
.dsm-qoder-transfer-dialog .dsm-qoder-addpat-origin{display:flex;flex-direction:column;gap:2px;margin:0 0 10px;padding-left:9px;border-left:2px solid var(--dsw-alias-border-l2,#3a3d45)}
.dsm-qoder-transfer-dialog .dsm-qoder-addpat-origin p{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#c6c9d0)}
.dsm-qoder-addpat-doc a{color:var(--dsw-alias-brand-primary,#5686fe);font-size:12px;line-height:18px;text-decoration:none}
.dsm-qoder-addpat-doc a:hover{text-decoration:underline}
/* 「按下添加之后会发生什么」——紧贴按钮行上方，弱一档，不与主按钮抢注意力。 */
.dsm-qoder-transfer-dialog p.dsm-qoder-addpat-verify{margin:0 0 8px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary,#9aa0a8)}
/* The shared busy veil: a fixed overlay for operations whose result only shows
   up after the list re-read (remove / import / add). It is NOT a modal: no
   control, no dismissal — only "this is running" and "here is why nothing
   moved yet". Fixed positioning so it covers the card regardless of which
   section started the operation, and a semi-transparent backdrop so the table
   stays visible underneath — the user is watching a specific row change, and
   hiding it would defeat the point.

   The mask and the card surface are the HOST's own tokens, not this file's
   invention. --dsw-alias-bg-mask-1 + --dsw-mask-blur is exactly what the
   host's own overlays use (see dsh-client-ui-settings-general's Dws9Sa_mask),
   so the veil now dims the way every other overlay in the shell does instead
   of laying its own black wash on top. The previous hardcoded rgba(0,0,0,.38)
   was tuned against neither theme: too weak next to the host's .24 mask in
   light mode, and it ignored the host's blur entirely.

   bg-layer-2 (not bg-primary, which does not exist in the host's token set
   at all and therefore always fell through to this file's near-black #1b1c20)
   is the same surface the host puts behind its panels — that near-black fallback
   is what made the veil read as a black slab with unreadable text on it. */
.dsm-qoder-veil{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;background:var(--dsw-alias-bg-mask-1,rgba(0,0,0,.32));backdrop-filter:var(--dsw-mask-blur);cursor:progress}
/* --dsw-elevation-prominent is the host's own panel shadow (a hairline stroke
   plus two soft layers); the previous 0 8px 28px rgba(0,0,0,.35) was a
   hand-rolled drop shadow that read as a heavy grey box. */
.dsm-qoder-veil-card{display:flex;flex-direction:column;align-items:center;gap:8px;max-width:min(340px,80vw);padding:16px 20px;border:1px solid var(--dsw-alias-border-l2,#0000001a);border-radius:12px;background:var(--dsw-alias-bg-layer-2,#fff);box-shadow:var(--dsw-elevation-prominent,0 8px 28px rgba(0,0,0,.35))}
.dsm-qoder-veil-text{font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary,#0f1115);text-align:center}
/* label-secondary, not label-tertiary: this line carries the operation's
   detail and must stay legible. tertiary is the host's dimmest tier
   (neutral-bluish-600 on light, neutral-bluish-400 on dark) and is meant
   for metadata, not for a sentence the user has to read while waiting. */
.dsm-qoder-veil-hint{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#61666b);text-align:center}
/* The spinner proves the UI is alive when the row under it has not changed yet
   — which is precisely the confusion the veil exists to remove. It follows the
   host's own state spinner (dsh's _dsh-state-dot-spin): an SVG arc whose
   dash breathes while it turns, currentColor so it inherits the tier it sits
   in, and the same 1.5s beat. The previous 18px border-ring at .7s was roughly
   twice the host's speed and visibly out of step with every other spinner in
   the shell — that mismatch, more than the shape itself, is what made it look
   cheap.

   Reduced-motion users get the static arc rather than a frozen ring, matching
   how the host degrades its own spinner. */
.dsm-qoder-veil-spinner{width:20px;height:20px;color:var(--dsw-alias-label-secondary,#61666b);animation:dsm-qoder-veil-spin 1.5s linear infinite}
.dsm-qoder-veil-spinner-track{opacity:.25}
.dsm-qoder-veil-spinner-arc{stroke-dasharray:12 150;animation:dsm-qoder-veil-dash 1.5s ease-in-out infinite}
@keyframes dsm-qoder-veil-spin{to{transform:rotate(360deg)}}
@keyframes dsm-qoder-veil-dash{0%{stroke-dasharray:12 150;stroke-dashoffset:0}50%{stroke-dasharray:24 150;stroke-dashoffset:-6}to{stroke-dasharray:12 150;stroke-dashoffset:0}}
@media (prefers-reduced-motion: reduce){.dsm-qoder-veil-spinner{animation:none}.dsm-qoder-veil-spinner-arc{animation:none;stroke-dasharray:18 150;stroke-dashoffset:-3}}
/*
 * 侧边栏那一行的图标，以及它打开的整页。
 *
 * 图标只有一个约束：它是 PNG 品牌标，所以在 currentColor 主题的图标格里
 * 必须**按自己的颜色**画（不能套 filter / fill:currentColor），选中态由
 * 宿主围着它画。圆角与卡片头部那个 32px 图标同规，只是尺寸小一号。
 */
.dsm-qoder-panel-icon{display:block;border-radius:4px}
/*
 * 整页（sidebar.panellist 行打开的 main 页）。
 *
 * 形状照 workbuddy 的同名页：整页占满中央那一列、内容居中限宽 860px，因为
 * 卡片正文在设置页里只有 ~600px 宽，铺满一屏会把它拉成一条极长的行。
 * overflow:auto 在**这一层**：页面比一屏高时滚动的是页面，不是外框。
 */
.dsm-qoder-page{box-sizing:border-box;height:100%;display:flex;flex-direction:column;align-items:center;gap:20px;padding:28px clamp(24px,4vw,48px) 48px;overflow:auto;color:var(--dsw-alias-label-primary,#e6e6e6)}
.dsm-qoder-page>*{width:100%;max-width:860px}
.dsm-qoder-page-head{display:flex;flex-direction:column;gap:6px}
.dsm-qoder-page-back{appearance:none;font:inherit;cursor:pointer;border:1px solid var(--dsw-alias-border-l2,#36373b);background:var(--dsw-alias-bg-layer-1,#17181b);color:var(--dsw-alias-label-secondary,#c7c7c7);border-radius:8px;padding:5px 12px;display:inline-flex;align-items:center;gap:6px;align-self:flex-start;font-size:13px;line-height:20px}
.dsm-qoder-page-back:hover{color:var(--dsw-alias-label-primary,#e6e6e6);border-color:var(--dsw-alias-label-dimmed,#777)}
.dsm-qoder-page-back svg{flex:none}
.dsm-qoder-page-icon{width:40px;height:40px;border-radius:9px;align-self:flex-start;margin-top:14px}
.dsm-qoder-page-title{margin:0;font-size:20px;font-weight:600;line-height:1.4}
.dsm-qoder-page-desc{margin:0;font-size:13px;line-height:1.5;color:var(--dsw-alias-label-tertiary,#999)}
/*
 * 设置页（settings.section）形态：标题 → 总述 → 三条用途 → 正文。
 *
 * 这里不套 .dsm-plugin-card 那套列表外壳（折叠 header、边框）。
 *
 * **正文那层盒子在设置页里要拆掉，这是与侧边栏整页不同的一处。** 设置面板自己
 * 已经有 24px 的列内边距与一层底色，再在里面套一张「1px 边框 + 底色 + 12px 圆角 +
 * 20px 内边距」的卡片，页面就变成「一张浮在页面里的卡」，左边还多出一圈 20px 的
 * 真空 —— 用户实拍 workbuddy 的设置页做对照，那边内容直接铺在列里。规则与
 * workbuddy 的 .dsm-workbuddy-settings .dsm-workbuddy-page-body .dsm-workbuddy-usage
 * 同一条（padding:0 / border:0 / border-radius:0），但这里**不给设置页自己补底色**：
 * 本插件的面板列本来就是实底，补一层只会在实底上再叠一层同色，而壁纸场景由宿主
 * 自带的列底色负责（workbuddy 补那条是因为它的列在壁纸主题下半透明）。
 */
.dsm-qoder-section{display:flex;flex-direction:column;gap:14px;min-width:0}
.dsm-qoder-section-heading{margin:0;font-size:16px;font-weight:600;line-height:24px;color:var(--dsw-alias-label-primary,#e6e6e6)}
.dsm-qoder-section-intro{margin:0;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary,#b8b8b8)}
.dsm-qoder-section-body .dsm-plugin-card-body{margin:0;padding:0;border:0;border-radius:0;background:none}
/*
 * 整页里的正文自带外壳：.dsm-plugin-card-body 在列表卡片里靠外层 <li> 提供
 * 边框与内边距，整页没有那个 <li>，所以由这条规则补上同一套外观——整页看到的
 * 是一个有边界的盒子，而不是一片裸内容。设置页**不**走这条（见上）。
 */
.dsm-qoder-page-body .dsm-plugin-card-body{margin:0;padding:20px 20px 8px;border:1px solid var(--dsw-alias-border-l2,#36373b);background:var(--dsw-alias-bg-layer-3,#202126);border-radius:12px}
/*
 * 可选侧边栏开关那一行。类名与积分开关**刻意不同**（.dsm-qoder-pref-check
 * 是积分那一块用例的定位器，多一个同类勾选框会把那条选择器变成二义），
 * 布局规则则与 .dsm-qoder-credit-toggle 同源：勾选框 + 一段两行说明。
 */
.dsm-qoder-sidebar-panel-pref{cursor:pointer}
/* 开关自己的失败提示：与那一行同宽缩进（借复选框那一列），红字。 */
.dsm-qoder-sidebar-panel-error{padding-left:25px;color:var(--dsw-alias-state-error-primary,#ef4444)}

/* 活动区（Campaigns.tsx）。**这一段曾经住在 QODER_COMPOSER_CSS 里** —— 那份样式
   表由 composer 积分读数组件注入，而设置页从不渲染那个组件，于是活动区的类名
   一条规则都没有：界面上是一列没有边框、没有分栏的裸文字（见 1.18.0 的截图）。
   样式必须跟着**渲染它的组件**走：QoderCampaigns 挂在卡片正文里，它就该在卡片
   样式表里。 */
.dsm-qoder-campaigns{display:flex;flex-direction:column;gap:10px;margin-top:6px;padding-top:14px;border-top:1px solid var(--dsw-alias-border-l2,#36373b)}
/* 区块标题，不是表格头。 */
.dsm-qoder-campaigns-title{margin:0;color:var(--dsw-alias-label-primary,#e6e6e6);font-size:14px;font-weight:600;line-height:20px}
.dsm-qoder-campaigns-empty{margin:0;color:var(--dsw-alias-label-tertiary,#999);font-size:12px;line-height:18px}
.dsm-qoder-campaigns-error{margin:0;color:var(--dsw-alias-state-error-primary,#ef4444);font-size:12px;line-height:18px;white-space:pre-line}
/* issue #47：无凭据时的可操作引导，跟在错误行后面。用中性提示色，不叠加第二个红字。 */
.dsm-qoder-campaigns-hint{margin:0;color:var(--dsw-alias-label-secondary,#bbb);font-size:12px;line-height:18px}
/* 瓦片网格：auto-fill + 260px 下限，在约 580px 宽的正文栏里自然排成两列，
   窄容器（侧边栏面板更窄时）退回一列。minmax(0,...) 而不是 1fr：没有它，
   一条长英文标题会把整列撑破（grid 的 min-content 陷阱）。 */
.dsm-qoder-campaigns-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px}
/* 每条活动是一张等高小卡片：边框 + 底色把它和相邻那条分开，align-items 默认
   stretch 让同一排的两张高度一致。 */
.dsm-qoder-campaign-row{display:flex;flex-direction:column;gap:6px;min-width:0;padding:11px 13px;border:1px solid var(--dsw-alias-border-l2,#36373b);border-radius:10px;background:var(--dsw-alias-bg-layer-3,#202126)}
/* 标题行：标题吃掉剩余宽度，额度不换行。 */
.dsm-qoder-campaign-row-head{display:flex;align-items:baseline;gap:8px;min-width:0;flex-wrap:wrap}
.dsm-qoder-campaign-row-title{flex:1 1 auto;min-width:0;color:var(--dsw-alias-label-primary,#e6e6e6);font-size:13px;line-height:19px;font-weight:600}
.dsm-qoder-campaign-row-amount{padding:1px 7px;border-radius:6px;background:rgba(34,160,107,.18);color:var(--dsw-alias-state-success-primary,#22a06b);font-size:11px;font-weight:600;line-height:16px;white-space:nowrap;flex:none}
/* 描述限两行：这是摘要位，不是正文。三条活动各带一段长描述时，不限行会让
   卡片高度随上游文案长短跳动，整排格子高低不齐 —— 全文仍在 title 悬停里。 */
.dsm-qoder-campaign-row-desc{margin:0;color:var(--dsw-alias-label-secondary,#b8b8b8);font-size:12px;line-height:17px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
/* 页脚贴底：状态在左、出口在右，同一排卡片因此共用一条基线。 */
.dsm-qoder-campaign-row-foot{margin-top:auto;padding-top:2px;display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0}
.dsm-qoder-campaign-row-status{padding:1px 6px;border-radius:6px;font-size:11px;font-weight:600;line-height:16px;white-space:nowrap;flex:none}
.dsm-qoder-campaign-row-status-claimable{background:rgba(34,160,107,.18);color:var(--dsw-alias-state-success-primary,#22a06b)}
.dsm-qoder-campaign-row-status-claimed{background:var(--dsw-alias-bg-layer-2,#25262b);color:var(--dsw-alias-label-tertiary,#9aa0a8);border:1px solid var(--dsw-alias-border-l2,#36373b)}
.dsm-qoder-campaign-row-link{font-size:12px;line-height:18px;color:var(--dsw-alias-brand-primary,#5686fe);text-decoration:none;white-space:nowrap;flex:none;margin-left:auto}
.dsm-qoder-campaign-row-link:hover{text-decoration:underline}
`;
		/**
		* Composer credit readout styles, injected by the readout component itself.
		*
		* 参考：dingminhua/dsh-connect-workbuddy（MIT，Copyright (c) 2026 LaoDing）
		*   — 该项目的 `WORKBUDDY_COMPOSER_CSS`，类名改为 `dsm-qoder-*`，
		*     其余（尺寸、节奏、主题变量与回退值、表格对齐）逐条沿用。
		*/
		const QODER_COMPOSER_CSS = `
.dsm-qoder-composer-credits{display:inline-flex;align-items:center;min-width:0}
.dsm-qoder-composer-credits-trigger{
  appearance:none;display:inline-flex;align-items:center;align-self:stretch;
  padding:2px 6px;border:0;border-radius:6px;background:transparent;
  font-size:12px;line-height:18px;
  color:var(--dsw-alias-label-tertiary,#999);
  white-space:nowrap;cursor:pointer;
  font-variant-numeric:tabular-nums;
}
.dsm-qoder-composer-credits-trigger:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.14))}
.dsm-qoder-composer-credits-trigger:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#5686fe);outline-offset:1px}
.dsm-qoder-composer-panel{
  position:fixed;z-index:1100;box-sizing:border-box;
  width:min(248px,calc(100vw - 24px));padding:12px;
  border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.28));
  border-radius:var(--dsw-radius-lg,14px);
  background:var(--dsw-specific-menu,Canvas);
  box-shadow:var(--dsw-elevation-prominent,0 8px 32px rgba(0,0,0,.22));
  backdrop-filter:var(--dsw-menu-backdrop-filter,none);
  font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#444);
}
/* 多一列专属积分时的加宽（issue #38）。248px 是按「账号名 + 64px 数字」调的：
   再塞一列进来，账号名会直接从两行文字被压成一截省略号。56px 是那一列自己的
   宽度预算（与 .dsm-qoder-composer-panel-dedicated 的 width 对齐），加宽的是
   **浮层**；表格仍是 width:100% + table-layout:fixed（issue #34 的修复不动）。
   clamp 的上限照旧是视口：窄屏上它仍然是「不超出窗口」，只是少了 56px 可用宽。 */
.dsm-qoder-composer-panel-wide{width:min(304px,calc(100vw - 24px))}
.dsm-qoder-composer-panel-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}
/* nowrap 不是洁癖：页头是一个标题加一颗 11px 的控件挤在约 250px 的浮层里，
   设置按钮一进来，标题当场折成两行（workbuddy 在真机 Desktop 上量到过
   「WB AI」/「积分」断开）。标题是这一行里唯一必须保持单行的东西，它后面
   跟着的东西按构造都是短的。 */
.dsm-qoder-composer-panel-title{flex:none;white-space:nowrap;font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary,CanvasText)}
/* 页头右侧控件的外壳。**不是**给按钮本身加 auto margin：那颗按钮并非总在
   （宿主没有去处的路由时根本不渲染），而一个始终存在的外壳让页头在两种情形下
   排布完全一致 —— 否则按钮消失时标题会因为 auto margin 的消失而左移。 */
.dsm-qoder-composer-panel-actions{flex:none;margin-left:auto;display:flex;align-items:center}
/* 安静的**药丸**，不是带框的按钮，也不是下划线链接（对齐 workbuddy 实测结论）：
   下划线会让一个单词的标签读成「碰巧能点的正文」，13px 页头里根本不像控件；
   带框按钮又太吵，13px 标题旁边一颗带框按钮读成工具栏。品牌色 10% 底色让它
   静止时就有形状 —— 可点击性正该在这个时刻被看见，而不是悬停之后。
   边框只在 hover/focus 出现，那里才真的需要提示。 */
.dsm-qoder-composer-panel-settings{
  appearance:none;flex:none;
  display:inline-flex;align-items:center;gap:4px;
  padding:3px 8px 3px 6px;
  border:1px solid transparent;border-radius:999px;
  background:rgba(86,134,254,.10);
  color:var(--dsw-alias-brand-primary,#5686fe);
  font:inherit;font-size:11px;line-height:16px;font-weight:500;
  cursor:pointer;
  transition:background-color .12s ease,border-color .12s ease,color .12s ease;
}
.dsm-qoder-composer-panel-settings:hover{
  background:rgba(86,134,254,.18);
  border-color:rgba(86,134,254,.34);
  color:var(--dsw-alias-brand-primary,#5686fe);
}
.dsm-qoder-composer-panel-settings:active{background:rgba(86,134,254,.26)}
.dsm-qoder-composer-panel-settings:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#5686fe);outline-offset:1px}
/* 齿轮不许被压扁：flex 子项默认会 shrink，标签换成更长的词（「Settings」对
   「设置」）时，窄浮层里的图标会被挤成椭圆。 */
.dsm-qoder-composer-panel-settings-icon{flex:none;display:block}
/* 标签永不换行：16px 高的药丸里折成两行会把页头撑高，下面的表格就脱开了。 */
.dsm-qoder-composer-panel-settings-label{flex:none;white-space:nowrap}
/* 减弱动效：这个颜色过渡是装饰，关掉之后 hover 态依然完整可见。 */
@media (prefers-reduced-motion:reduce){
  .dsm-qoder-composer-panel-settings{transition:none}
}
/* 「刷新」颗按钮：**透明底**的安静药丸，hover 才出色。
   它与「设置」是**不同的视觉权重**：设置是品牌色底的胶囊（它离开面板），刷新
   作用于下面的表（本地、可重复）。两个一样响的胶囊会让页头读成一条工具栏。
   逐字对齐 dsh-connect-workbuddy 的同名控件（acc8f2f / 92078a8），那边在真实
   宿主里的渲染就是本图参照的样子：刷新是灰字透明底，设置是淡紫底深色字。 */
.dsm-qoder-composer-panel-refresh{
  appearance:none;flex:none;
  display:inline-flex;align-items:center;gap:4px;
  padding:3px 8px 3px 6px;margin-right:6px;
  border:1px solid transparent;border-radius:999px;
  background:transparent;
  color:var(--dsw-alias-label-secondary,#444);
  font:inherit;font-size:11px;line-height:16px;font-weight:500;
  cursor:pointer;
  transition:background-color .12s ease,border-color .12s ease,color .12s ease;
}
.dsm-qoder-composer-panel-refresh:hover:not(:disabled){
  background:rgba(127,127,127,.10);
  border-color:var(--dsw-alias-border-l2,rgba(127,127,127,.34));
  color:var(--dsw-alias-label-primary,CanvasText);
}
.dsm-qoder-composer-panel-refresh:active:not(:disabled){background:rgba(127,127,127,.16)}
.dsm-qoder-composer-panel-refresh:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#5686fe);outline-offset:1px}
/* 批次在飞时按钮是禁用的，而一颗**仍然在 hover 时亮起来**的禁用控件会招来第二次
   按压——那次按压会被忽略，用户只会更困惑。 */
.dsm-qoder-composer-panel-refresh:disabled{cursor:default;opacity:.6}
/* 循环箭头同样不许被压扁（与齿轮同一条理由）。 */
.dsm-qoder-composer-panel-refresh-icon{flex:none;display:block}
/* 在飞时转起来：用户看着一个不动的按钮等了半分钟，会以为它没点上。
   一圈 900ms：快到读得出在动，慢到不像渲染故障。 */
.dsm-qoder-composer-panel-refresh-icon-spin{animation:dsm-qoder-panel-refresh-spin .9s linear infinite}
@keyframes dsm-qoder-panel-refresh-spin{to{transform:rotate(360deg)}}
/* 标签永不换行（与设置按钮同一条理由）。 */
.dsm-qoder-composer-panel-refresh-label{flex:none;white-space:nowrap}
/* 减弱动效下不转，但箭头**不许消失** —— 它是「批次还活着」的唯一提示。改为变暗，
   而真正的指示是文案（「正在刷新…」）。 */
@media (prefers-reduced-motion:reduce){
  .dsm-qoder-composer-panel-refresh{transition:none}
  .dsm-qoder-composer-panel-refresh-icon-spin{animation:none;opacity:.55}
}
/* 表格**不许**被内容撑开（issue #34）。默认的 table-layout:auto 让列宽跟着内容走，
   width:100% 只是下限：账号行第二行的状态文案是一条**可长可短**的翻译句子
   （国内版「用量已达上限 · 约 7 小时后解禁（按今日额度窗口推算）」，国际版比它
   更长），它一长，整张表就比 248px 的浮层还宽 —— 右侧「积分」列于是连数字一起
   被推到浮层外面。实测（Chrome，真实 DOM + 本文件 CSS）：中文那条把表撑到 336px、
   溢出 102px，英文那条撑到 543px、溢出 309px。
   fixed 之后列宽按声明分配，内容再长也只在自己那格里换行或省略。 */
.dsm-qoder-composer-panel-table{
  width:100%;border-collapse:collapse;table-layout:fixed;
  font-size:12px;line-height:18px;
}
.dsm-qoder-composer-panel-table thead th{
  padding:0 0 7px;font-weight:500;text-align:left;font-size:11px;
  color:var(--dsw-alias-label-tertiary,GrayText);
  border-bottom:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.24));
}
.dsm-qoder-composer-panel-num{
  text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;
}
/* 「积分」这一列**定宽**（issue #34）。table-layout:fixed 之后列宽只认声明：
   不写宽度的话它与账号列平分剩下的 222px，账号列被砍掉一半去换一个永远只有
   三四位数的数字，反而更难读。
   64px 的来历是实测：Chrome、12px、tabular-nums 下「999,999」50.9px、
   「9,999,999」62px（最宽的一档），共用的 11px 表头「积分」/「Credits」更短。
   overflow+ellipsis 是**兜底**：真出现十位数的余额时把它截断成省略号，而不是让它
   画到浮层外面去（issue 报的正是「跑到框外」）。 */
.dsm-qoder-composer-panel-table thead th.dsm-qoder-composer-panel-num,
.dsm-qoder-composer-panel-table tbody td.dsm-qoder-composer-panel-num{
  width:64px;overflow:hidden;text-overflow:ellipsis;
}
.dsm-qoder-composer-panel-table thead th.dsm-qoder-composer-panel-num{padding-right:0}
/* 专属积分那一列（issue #38）：56px，比「积分」窄一档。
   宽度的来历与 64px 那条相同 —— Chrome、12px、tabular-nums 下四位数（含千分位
   「2,000」）约 36px，表头「SOTA」（11px）不到 30px，56 是留了余量的那一档；
   再宽就只是从账号名那一格（全表最贵的一格）身上割肉。
   它**没有**单独再写 overflow/ellipsis：那三条已经由上面「面板数字格」那条规则
   给了（两个类名总在同一格子上），重复一遍只会让两处宽度声明打架。
   选择器**指名 th / td 而不用裸类名**：上面那条定宽规则带着 thead th / tbody td，
   特异性比裸类名高 —— 只写裸类名的话表头那一格仍按 64px 算，而 table-layout:fixed
   拿表头那行当列宽基准，于是正文 56、表头 64，实际列宽以 64 为准。 */
.dsm-qoder-composer-panel-table thead th.dsm-qoder-composer-panel-dedicated,
.dsm-qoder-composer-panel-table tbody td.dsm-qoder-composer-panel-dedicated{width:56px}
.dsm-qoder-composer-panel-table tbody th{
  padding:0;font-weight:400;text-align:left;vertical-align:middle;
}
.dsm-qoder-composer-panel-table tbody td{
  padding:4px 0;vertical-align:middle;
  color:var(--dsw-alias-label-primary,CanvasText);
}
.dsm-qoder-composer-panel-table tbody tr.dsm-qoder-composer-panel-row-current td{font-weight:600}
.dsm-qoder-composer-panel-switch{
  appearance:none;display:flex;align-items:center;gap:7px;
  width:100%;padding:4px 6px;margin-left:-6px;
  border:0;border-radius:6px;background:transparent;
  color:inherit;font:inherit;font-size:12px;text-align:left;cursor:pointer;
  white-space:nowrap;overflow:hidden;
}
.dsm-qoder-composer-panel-switch>span:last-child{overflow:hidden;text-overflow:ellipsis}
.dsm-qoder-composer-panel-who{display:flex;flex-direction:column;min-width:0;gap:1px}
.dsm-qoder-composer-panel-name{overflow:hidden;text-overflow:ellipsis}
/* 第二行的两种文字：原因（不能用的红字，与红点同义）与「当前选用」
   （能用的正向提示，绿字）。此前只有一个琥珀色的 reason 样式。 */
/* **换行，不截断**（issue #34）。
   外层 .dsm-qoder-composer-panel-switch 为账号名设了 white-space:nowrap，这条会
   被继承；而这一格的文字是**翻译句子**，长度不受布局控制（国内版那句「用量已达
   上限 · 约 7 小时后解禁（按今日额度窗口推算）」30 个字，国际版那句更长），
   nowrap 于是让它一路顶出浮层。这里的两种候选结局里，多一行是**读得完**的，
   截断是**读不到**的 —— 「按今日额度窗口推算」正是这句里最该被读到的一半，
   它说明这个时刻是**推算**的、不是上游承诺的。
   overflow-wrap:anywhere：中文没有词间空格可断，不给它这条就只会在标点处折。
   （与 dsh-connect-workbuddy 的 issue #108 同一个判断，那边也是先截断、后改成换行。） */
.dsm-qoder-composer-panel-mark{
  font-size:11px;line-height:15px;
  color:var(--dsw-alias-state-error-primary,#ef4444);
  white-space:normal;overflow-wrap:anywhere;
}
.dsm-qoder-composer-panel-pick{
  font-size:11px;line-height:15px;
  color:var(--dsw-alias-state-success-primary,#22a06b);
}
.dsm-qoder-composer-panel-switch:hover:not(:disabled){
  background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.14));
}
.dsm-qoder-composer-panel-switch:focus-visible{
  outline:2px solid var(--dsw-alias-brand-primary,#5686fe);outline-offset:-1px;
}
.dsm-qoder-composer-panel-switch:disabled{cursor:default}
/* 这一行没有专属包时的「—」：比数字淡一档，别让读者把它读成一个读数。
   只给专属那一列用；「余额读不出来」的格子仍是原来的裸字面量 —— 那条路
   已有自己的回归用例（composer-billing 的「计费号哪都没有余额读数」），
   顺手改它的样式属于本次之外的改动。 */
.dsm-qoder-composer-panel-none{color:var(--dsw-alias-label-tertiary,GrayText)}
/* 点的颜色由数据驱动（行内 style，见 account-state.ts），这里只留尺寸。
   此前的两条规则把颜色钉死在 CSS 里 -- 面板于是不看数据就报「当前使用」，
   额度用尽的号顶着绿点、能用的号是灰的（用户实拍 2026-10-18）。 */
.dsm-qoder-composer-panel-dot{
  flex:none;width:7px;height:7px;border-radius:50%;
}
.dsm-qoder-composer-panel-foot{
  display:flex;justify-content:space-between;gap:8px;
  margin-top:9px;padding-top:7px;
  border-top:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.24));
  font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,GrayText);
}
.dsm-qoder-composer-panel-empty{margin:0;color:var(--dsw-alias-label-tertiary,GrayText)}
.dsm-qoder-composer-panel-error{margin:8px 0 0;color:var(--dsw-alias-state-error-primary,#d92d20);font-size:11px;line-height:16px}
/* 活动（Campaigns.tsx）：卡在区域作用域内、额度读数之下的一条列表。
   与模型区同款分隔线 + 标题；每行 = 标题 · 额度 · 状态 · 查看详情。
   空列表只显示一行淡字「当前没有活动」——不凭空造 banner；读不到则红字原因。 */

`;
		//#endregion
		//#region src/version.ts
		/**
		* The npm package **name** this build was produced from.
		*
		* Needed at runtime by the browser half in two places, both of which address the
		* bundle by its *installed package name*:
		*
		*  - the model-picker label registration and the plugin-market fallback
		*    (`pluginNavigation.openBundle(<package name>)`);
		*  - diagnostics lines and copy that name the package.
		*
		* The configuration page itself no longer uses it: since 1.18.0 that page is a
		* `settings.section` addressed by `id` (the Loader entry id), not by the
		* package-keyed `plugins.bundle.config` / `plugins.row.config` slots.
		*
		* Injected at build time so it cannot drift from `package.json`; the fallback
		* only applies outside a build (the unit tests inject the real value too — see
		* `vitest.config.ts`).
		*/
		const QODER_PACKAGE_NAME = "@dmh2002/dsh-connect-qoder";
		//#endregion
		//#region src/client/style-injector.ts
		/**
		* Install — or **refresh** — one plugin-owned stylesheet in the document head.
		*
		* ## Why this module exists
		*
		* Two independent mechanisms have to agree about who owns a `<style>` tag, and
		* both of them key that ownership by the **npm package name**:
		*
		*   - the Host's client module system (`@deepseek-ai/dsh-client-modules`)
		*     removes a plugin's styles by `data-plugin` when the entry is rebuilt or
		*     evicted (`removeOwnedStyles`), and the id it uses is the client graph
		*     row id — which IS the package name;
		*   - the Host's own generated client bundles tag their sheets the same way
		*     (`tag.dataset.plugin = <package name>`), so a plugin that wants to be
		*     cleaned up with the rest of its family has to use the same spelling.
		*
		* The Loader entry id (`dsh-connect-qoder`) is a DIFFERENT identifier: it
		* backs the settings namespace and the `/plugins/<id>/…` routes. Tagging
		* styles with it means the Host can never clean them up — it looks for
		* `data-plugin="@dmh2002/dsh-connect-qoder"` and finds nothing.
		*
		* ## Why the sheet is REFRESHED rather than skipped
		*
		* A Host that rebuilds the client bundle tears the entry down and re-imports
		* it, which re-runs this module's top-level code. If the sheet were only
		* appended *when absent*, the **first** version ever injected would stay in
		* the document for the rest of the session, and every later change to the
		* stylesheet would be invisible in the browser while the code around it
		* updated normally.
		*
		* That is not hypothetical — it is exactly what happened to this plugin's
		* composer stylesheet. The "Settings" button shipped with new CSS (a
		* brand-coloured pill), while the browser kept the sheet from the very first
		* page load: a version with no rule for that class at all, so the button
		* rendered with the browser's default button chrome. The symptom reads as
		* "the style was never applied", while the CSS on disk was already correct.
		*
		* Refreshing in place is the pattern the settings card already used, and it
		* is the one that survives a rebuild.
		*
		* 参考：dingminhua/dsh-connect-workbuddy（MIT，Copyright (c) 2026 LaoDing）
		*   —— 同款做法：它在样式表上只「追加」，因为它的包名恰好等于它的 entry id，
		*   两件事碰巧是同一个字符串；本插件加了 npm scope，这层巧合没了，所以这里
		*   把「谁拥有这张表」和「这张表要不要刷新」都写成显式的规则。
		*/
		/**
		* The `data-plugin` value the Host looks for when it removes this plugin's
		* styles.
		*
		* Must be the **package name**, not the Loader entry id: the Host's
		* `removeOwnedStyles` and its own generated bundles both use the package
		* name. A mismatch here is invisible until the plugin is rebuilt, at which
		* point the stale sheets simply stay in the document.
		*/
		const PLUGIN_STYLE_OWNER = QODER_PACKAGE_NAME;
		/**
		* Install or refresh one stylesheet owned by this plugin.
		*
		* @param cssId - Stable per-sheet id, written to `data-plugin-css`. It must
		*   not change between releases: it is the lookup key that finds the sheet
		*   already in the document.
		* @param css - The stylesheet text. Replacing an existing sheet's text is
		*   what makes a rebuild visible.
		*/
		function installPluginStyle(cssId, css) {
			if (typeof document === "undefined") return;
			const existing = document.querySelector(`style[data-plugin-css="${cssId}"]`);
			if (existing !== null) {
				existing.textContent = css;
				existing.dataset.plugin = PLUGIN_STYLE_OWNER;
				return;
			}
			const styleTag = document.createElement("style");
			styleTag.dataset.plugin = PLUGIN_STYLE_OWNER;
			styleTag.dataset.pluginCss = cssId;
			styleTag.textContent = css;
			document.head.appendChild(styleTag);
		}
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
		* 某个 model id 的原生模态。只做精确匹配：新模型绝不会从它的同族、
		* 显示名或平台的图片标记里继承结论。
		*/
		function nativeModalityOf(modelId) {
			if (isRouterModelId(modelId)) return "router";
			return NATIVE_MODALITY_BY_MODEL_ID[normalizeModelId(modelId)] ?? "unknown";
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
		/** 把 Qoder 的短 key / 显示名映射到本表键（供显示层做一次显式归一）。 */
		function modalityKeyOf(key, displayName) {
			const direct = normalizeModelId(key);
			if (NATIVE_MODALITY_BY_MODEL_ID[direct] !== void 0) return direct;
			if (displayName !== void 0 && displayName !== "") {
				const byName = normalizeModelId(displayName).replace(/\s+/gu, "-");
				if (NATIVE_MODALITY_BY_MODEL_ID[byName] !== void 0) return byName;
			}
			return direct;
		}
		//#endregion
		//#region src/client/QoderCard.tsx
		/**
		* Qoder (Lingma) accounts, credits & models — the body shared by the Settings
		* page (`settings.section`, the only configuration entry since 1.18.0) and the
		* optional sidebar panel's full-screen surface.
		*
		* 参考：dingminhua/dsh-connect-workbuddy（MIT，Copyright (c) 2026 LaoDing）
		*   — 卡片的整体结构（折叠外壳 `<li class="dsm-plugin-card">` + header/icon/title/
		*     description/chevron、国内/国际 tab 栏 + 供应商开关、账号下拉、积分区、模型表、
		*     探针行、可配的自动刷新轮询（`pollMinutes`，默认 5 分钟）与 AbortController 清理、模块加载时注入一次 `<style>`、
		*     纯 CSS caret）、以及 `dsm-*` 类名体系与 `--dsw-alias-*` 主题变量用法，
		*     均沿用自该项目；其又逐字承接 dingminhua/dsh-connect-trae（MIT）与
		*     dingminhua/dsh-subagent-default-model（MIT）。
		* 改动（按 Qoder 现实）：
		*   1. 账号是 PAT（settings / env / vault），不是桌面端登录：无 searched-paths
		*      诊断、无 OAuth 登录；账号列表旁是「Add PAT」表单与每 vault 账号的删除；
		*   2. 每日签到走 campaigns 端点：`QoderWebPool.checkinSupported` 按区域判定
		*      （CN 与国际版均已接通），为 false 时签到动作与那一列不渲染；
		*   3. 积分逐账号显示在账号池表格里（卡片正文不再重复一份额度明细，只在读不到
		*      时渲染失败原因）；
		*   4. 模型行：勾选（enabledModelKeys / offModelKeys）、图像开关（supportsImages）、
		*      上下文预算 tier 选择器（model.contextTiers + contextBudgets）、探针；
		*   5. 保存仍是草稿态 + dirty + 「保存/放弃」，写入走共享的 verified-write
		*      (`account-selection.write*`)，Host 端点优先、`__save` 回退。
		*
		* 数据流：
		* - 配置值（PAT、accountId、开关、勾选、contextBudgets、pool 偏好）经
		*   `settingsScope`（宿主 settings 镜像）读写，或经 `QODER_SAVE_PATH` 回退。
		* - 状态（账号、额度、模型目录、探针、池）经本插件只读路由获取。
		*
		* @module dsh-connect-qoder/client/QoderCard
		*/
		/**
		* 每个分栏的标签文案键。
		*
		* 查表而不是嵌套三元：三元在加第四项时必然退化成「其它情况都是诊断」——那一版的
		* 第四栏会顶着「诊断」两个字。表的类型是 `Record<QoderPanel, ...>`，所以以后再加
		* 一栏、忘了配文案，编译就会红。
		*/
		const PANEL_TAB_LABELS = {
			accounts: "row.panelAccounts",
			models: "row.panelModels",
			diag: "row.panelDiag",
			capabilities: "row.panelCapabilities"
		};
		/**
		* Inject or refresh the shared card CSS for the current client bundle.
		*
		* `installPluginStyle` refreshes an existing sheet in place instead of
		* skipping it: the Host rebuilds this bundle and re-imports it, and a sheet
		* that is only appended-when-absent would keep the FIRST version for the
		* rest of the session.
		*/
		installPluginStyle("dsh-connect-qoder/client.css", QODER_CARD_CSS);
		function formatNumber(value) {
			return new Intl.NumberFormat(void 0, {
				minimumFractionDigits: 0,
				maximumFractionDigits: 2
			}).format(value);
		}
		function dotStyle(status) {
			return { background: status === "signed-in" ? "var(--dsw-alias-state-success-primary, #22a06b)" : status === "error" ? "var(--dsw-alias-state-error-primary, #d92d20)" : "var(--dsw-alias-label-dimmed, #9aa0a6)" };
		}
		/**
		* 某个模型图片开关的说明文字。
		*
		* 复选框只对**核对表确认 multimodal** 的模型默认勾选，所以另外两种结果必须
		* 说清「为什么没勾」——否则一个确认纯文本的模型和一个未核实的模型，在已经
		* 勾选的兄弟旁边看起来是一样地「坏了」。三种状态各给一句不同的 tooltip。
		*
		* 查表要同时看 `key`（短 id）与 `name`（厂商名）：表的主键是短 id，但别名键
		* 是厂商名，两处都可能命中。只传 `key` 会让每一条都落进 `unknown`，于是每个
		* 开关都写着「未经核实」——那正是 issue #22 的表征之一。
		*/
		function imageCheckboxHint(modelKey, modelName, t) {
			switch (nativeModalityOf(modalityKeyOf(modelKey, modelName))) {
				case "multimodal": return t("row.modelImage");
				case "text": return t("row.modelImageText");
				default: return t("row.modelImageUnverified");
			}
		}
		function QoderCard(props) {
			const { view, surface, backToConversation } = props;
			/**
			* 同一份正文有三种装载形态：
			*
			*  - `surface === undefined` —— 旧的插件列表卡片（`<li>` 折叠行）。1.18.0 起
			*    产品里不再有注册点，只留这条降级路径与既有用例；
			*  - `surface === 'page'` —— 侧边栏那一行打开的整屏面板，带「返回会话」；
			*  - `surface === 'section'` —— **设置 → Qoder** 那一页。没有折叠外壳，也没有
			*    返回按钮（设置面板自己有导航与关闭），页头只是标题 + 一句话总述。
			*
			* 后两种都恒展开：折叠按钮只对列表项有意义。用**同一个** `open` 值让 60 秒
			* 轮询与首次拉取的 effect 原样不动——把整页切成「收起」只会让它变成空壳。
			*/
			const pageSurface = surface === "page";
			const sectionSurface = surface === "section";
			const pageLike = pageSurface || sectionSurface;
			const t = props.t ?? ((key) => key);
			const [open, setOpen] = (0, react.useState)(view === "page" || pageLike);
			const [activeRegion, setActiveRegion] = (0, react.useState)(() => "cn");
			/**
			* 卡片正文里的**分栏**：账号 / 模型 / 诊断。
			*
			* 为什么要分：正文原来是一列长页，把两件互不相干的事混排在一起——运维账号
			* （谁在服务、剩多少积分、签到与切换）和编辑目录（勾模型、上下文预算、思考
			* 强度）。它们连**提交语义**都不同：账号改动点一下即生效，目录改动是草稿、
			* 必须点「保存」，于是保存按钮常常离它要保存的东西隔着几屏。
			*
			* 参考 dingminhua/dsh-connect-workbuddy 的同名分栏（MIT）：那里也是
			* 「账号 / 模型 / 诊断」三段，tab 条与区域那两格**刻意不是同一种形状**
			* ——区域是二选一的作用域（每格还带自己的开关），这里是**同一份文档的分栏**。
			*
			* 非活动栏用 `hidden` 留在页面里（不是卸载）：切回来不重新拉取、不丢未保存的
			* 目录草稿、账号池的日志不重建；`hidden` 同时把它移出无障碍树，正是
			* `role="tabpanel"` 想要的效果——而 `display:none` 走 CSS 类会被后面的规则覆盖。
			*/
			const [panel, setPanel] = (0, react.useState)("accounts");
			const creditsLabelId = (0, react.useId)();
			const creditsHintId = (0, react.useId)();
			const [usages, setUsages] = (0, react.useState)({});
			const [busyRegions, setBusyRegions] = (0, react.useState)(/* @__PURE__ */ new Set());
			const [probes, setProbes] = (0, react.useState)({});
			const [probeBusy, setProbeBusy] = (0, react.useState)(/* @__PURE__ */ new Set());
			const [dirty, setDirty] = (0, react.useState)(false);
			const [saving, setSaving] = (0, react.useState)(false);
			const [poolBusy, setPoolBusy] = (0, react.useState)(false);
			const [saveError, setSaveError] = (0, react.useState)(void 0);
			const [siblingBusy, setSiblingBusy] = (0, react.useState)(false);
			/**
			* 可选的**侧边栏面板**开关（对齐 workbuddy PR #188）。
			*
			* `undefined` 表示「这张卡片还没写过它」，于是渲染 Host 交下来的已提交值，
			* 猜都不猜——与本卡片其它 Host 承载开关同一条规矩。
			*/
			const [sidebarPanelOn, setSidebarPanelOn] = (0, react.useState)(void 0);
			const [sidebarPanelBusy, setSidebarPanelBusy] = (0, react.useState)(false);
			const [pollMinutesBusy, setPollMinutesBusy] = (0, react.useState)(false);
			const [pollMinutesError, setPollMinutesError] = (0, react.useState)(void 0);
			/** 该开关自己的失败提示：它住在「账号」栏，而通用那条长在「模型」栏的保存行上。 */
			const [sidebarPanelError, setSidebarPanelError] = (0, react.useState)(void 0);
			/**
			* 等待二次确认的「删除账号」目标 id。
			*
			* 删除是**硬删** vault 条目：vault 是这一个账号的唯一存储位置，删掉就再也
			* 找不回来（workbuddy 的删除是「暂时隐藏」，可 rescan 找回，所以它不需要确认；
			* 本插件没有第二来源可按，因此必须有一次确认）。这里用两步内联确认而不是
			* `window.confirm`：不阻塞、可被测试，且在禁用态下也能正确复位。
			*/
			const [drafts, setDrafts] = (0, react.useState)({});
			const [revision, setRevision] = (0, react.useState)(0);
			const mounted = (0, react.useRef)(true);
			/** Per-region in-flight usage requests, so one region never cancels another's. */
			const controllers = (0, react.useRef)({});
			/**
			* Per-region in-flight FIRST-PAINT requests (`detail=fast`), kept apart from
			* `controllers` on purpose.
			*
			* `controllers` is a latest-wins cancellation chain for the FULL document:
			* a newer read aborts the older one so a stale response can never overwrite
			* a fresh one. The first-paint request has different semantics — it is
			* worthless the moment a full document exists, and it must never cancel (or
			* be cancelled by) the real read. Mixing them would mean the fast request
			* aborts the full one or vice versa, i.e. exactly the bug this card already
			* had once with a shared controller across regions.
			*/
			const fastControllers = (0, react.useRef)({});
			const scope = props.settingsScope;
			/**
			* 打上游的自动刷新节奏（分钟），**活读**：设置镜像一变（`revision`）就重读，
			* 轮询 effect 以它为依赖重建定时器 —— 改完下拉框，下一次心跳就是新间隔，
			* 不必重开卡片。
			*
			* 三级回退与 `sidebarPanelSwitchedOn` 同规：宿主文档里的投影是权威（它来自
			* 服务端那份配置），镜像次之，都没有就是默认 5。
			*/
			const pollMinutes = pollMinutesLive();
			function pollMinutesLive() {
				const fromScope = pollMinutesOf(scope?.getSnapshot().value);
				if (scope !== void 0) return fromScope;
				const fromHost = usages[activeRegion]?.pollMinutes;
				return typeof fromHost === "number" ? pollMinutesOf({ pollMinutes: fromHost }) : fromScope;
			}
			(0, react.useEffect)(() => scope?.subscribe(() => setRevision((v) => v + 1)), [scope]);
			const refresh = (0, react.useCallback)(async (region, force) => {
				controllers.current[region]?.abort();
				const controller = new AbortController();
				controllers.current[region] = controller;
				setBusyRegions((prev) => new Set(prev).add(region));
				try {
					const response = await fetch(withQoderRegion(QODER_USAGE_PATH, region), {
						headers: { accept: "application/json" },
						credentials: "same-origin",
						signal: controller.signal
					});
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
					const value = await response.json();
					if (!mounted.current || controller.signal.aborted) return;
					setUsages((prev) => ({
						...prev,
						[region]: value
					}));
				} catch (error) {
					if (controller.signal.aborted || !mounted.current) return;
					setUsages((prev) => ({
						...prev,
						[region]: error instanceof Error ? {
							status: "error",
							message: error.message
						} : {
							status: "error",
							message: String(error)
						}
					}));
				} finally {
					if (mounted.current) setBusyRegions((prev) => new Set([...prev].filter((r) => r !== region)));
				}
			}, []);
			/**
			* First paint: ask for the LOCAL-ONLY document so the account rows can appear
			* immediately, then let the full read above upgrade the numbers.
			*
			* The full document's tail awaits a live upstream credit read (the serving
			* account) plus one live read per pool member — six members means six
			* network reads stacked in front of the account table. Any one of them being
			* slow holds the whole page on a blank body; that is the exact complaint
			* this fixes (workbuddy issue #77, 同一族).
			*
			* `detail=fast` answers from state the Host already has: the stored PAT (no
			* token exchange), the cached credit reading, the saved member list and this
			* process's check-in snapshot. It performs NO upstream read, so it cannot be
			* held by one.
			*
			* Deliberate asymmetry with `refresh`: a fast answer NEVER replaces a region
			* that already has a document. The full read stays authoritative — the fast
			* one only fills a hole that would otherwise render as an empty page, and it
			* carries no error state (a failed first paint is simply no paint yet; the
			* full read will report the failure properly).
			*/
			const refreshFast = (0, react.useCallback)(async (region) => {
				fastControllers.current[region]?.abort();
				const controller = new AbortController();
				fastControllers.current[region] = controller;
				try {
					const response = await fetch(withQoderRegionFastDetail(QODER_USAGE_PATH, region), {
						headers: { accept: "application/json" },
						credentials: "same-origin",
						signal: controller.signal
					});
					if (!response.ok) return;
					const value = await response.json();
					if (!mounted.current || controller.signal.aborted) return;
					setUsages((prev) => {
						if (prev[region] !== void 0) return prev;
						return {
							...prev,
							[region]: value
						};
					});
				} catch {} finally {
					if (fastControllers.current[region] === controller) delete fastControllers.current[region];
				}
			}, []);
			(0, react.useEffect)(() => {
				mounted.current = true;
				for (const region of QODER_REGIONS) refreshFast(region);
				for (const region of QODER_REGIONS) refresh(region);
				if (typeof window !== "undefined") {
					const timer = window.setInterval(() => {
						for (const region of QODER_REGIONS) refresh(region);
					}, pollMinutes * 6e4);
					return () => {
						mounted.current = false;
						window.clearInterval(timer);
						abortAllRegions();
					};
				}
				return () => {
					mounted.current = false;
					abortAllRegions();
				};
			}, [pollMinutes]);
			(0, react.useEffect)(() => {
				if (usages[activeRegion] === void 0) {
					refreshFast(activeRegion);
					refresh(activeRegion);
				}
			}, [activeRegion]);
			/** Cancel every region's in-flight usage read (unmount only). */
			const abortAllRegions = () => {
				for (const controller of Object.values(controllers.current)) controller?.abort();
				for (const controller of Object.values(fastControllers.current)) controller?.abort();
			};
			(0, react.useEffect)(() => {
				refresh(activeRegion, true);
			}, [revision]);
			const usage = usages[activeRegion];
			const regionOn = usage !== void 0 && usage.status !== "error" ? regionEnabledOfUsage(usage) : true;
			const cartesianModels = usage?.status === "signed-in" ? usage.models : [];
			const enabledModelKeys = usage?.status === "signed-in" ? usage.enabledModelKeys : [];
			const offModelKeys = usage?.status === "signed-in" ? usage.offModelKeys : [];
			const imageModelKeys = usage?.status === "signed-in" ? usage.imageModelKeys : [];
			const imageSelectionSaved = usage?.status === "signed-in" ? usage.imageSelectionSaved : false;
			const savedBudgets = usage?.status === "signed-in" ? usage.contextBudgets ?? {} : {};
			const savedEfforts = usage?.status === "signed-in" ? usage.thinkingEfforts ?? {} : {};
			const draft = drafts[activeRegion] ?? {
				enabledModelKeys: new Set(enabledModelKeys),
				offModelKeys: new Set(offModelKeys),
				supportsImages: imageSelectionSaved ? new Set(imageModelKeys) : new Set(cartesianModels.filter((m) => imageDefaultFor({
					id: m.key,
					name: m.name,
					...m.supportsImages === void 0 ? {} : { supportsImages: m.supportsImages }
				})).map((m) => m.key)),
				contextBudgets: { ...savedBudgets },
				thinkingEfforts: { ...savedEfforts }
			};
			const toggleModel = (key, on) => {
				setDirty(true);
				setSaveError(void 0);
				setDrafts((prev) => {
					const d = cloneDraft(prev[activeRegion] ?? draft);
					if (on) d.enabledModelKeys.add(key);
					else d.enabledModelKeys.delete(key);
					return {
						...prev,
						[activeRegion]: d
					};
				});
			};
			const toggleOff = (key, on) => {
				setDirty(true);
				setSaveError(void 0);
				setDrafts((prev) => {
					const d = cloneDraft(prev[activeRegion] ?? draft);
					if (on) d.offModelKeys.add(key);
					else d.offModelKeys.delete(key);
					return {
						...prev,
						[activeRegion]: d
					};
				});
			};
			const toggleImageLight = (key, on) => {
				setDirty(true);
				setSaveError(void 0);
				setDrafts((prev) => {
					const d = cloneDraft(prev[activeRegion] ?? draft);
					if (on) d.supportsImages.add(key);
					else d.supportsImages.delete(key);
					return {
						...prev,
						[activeRegion]: d
					};
				});
			};
			const setContextBudget = (key, tokens) => {
				setDirty(true);
				setSaveError(void 0);
				setDrafts((prev) => {
					const d = cloneDraft(prev[activeRegion] ?? draft);
					if (tokens > 0) d.contextBudgets[key] = tokens;
					else delete d.contextBudgets[key];
					return {
						...prev,
						[activeRegion]: d
					};
				});
			};
			/** 保存某个模型的思考强度；空串表示「跟随上游默认」（删掉保存值）。 */
			const setThinkingEffort = (key, effort) => {
				setDirty(true);
				setSaveError(void 0);
				setDrafts((prev) => {
					const d = cloneDraft(prev[activeRegion] ?? draft);
					if (effort === "") delete d.thinkingEfforts[key];
					else d.thinkingEfforts[key] = effort;
					return {
						...prev,
						[activeRegion]: d
					};
				});
			};
			const runProbe = async (modelKey) => {
				const probeRegion = activeRegion;
				setProbeBusy((prev) => new Set(prev).add(modelKey));
				try {
					const response = await fetch(`${withQoderRegion(QODER_PROBE_PATH, probeRegion)}&model=${encodeURIComponent(modelKey)}`, {
						headers: { accept: "application/json" },
						credentials: "same-origin"
					});
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
					const result = await response.json();
					if (mounted.current) setProbes((prev) => ({
						...prev,
						[probeRegion]: {
							...prev[probeRegion],
							[modelKey]: result
						}
					}));
				} catch (error) {
					if (mounted.current) {
						const httpStatus = Number.parseFloat(String(error?.message ?? "").replace(/\D+/g, "")) || void 0;
						const failed = {
							modelId: modelKey,
							outcome: "failed",
							message: String(error?.message ?? error)
						};
						if (httpStatus !== void 0) failed.status = httpStatus;
						setProbes((prev) => ({
							...prev,
							[probeRegion]: {
								...prev[probeRegion],
								[modelKey]: failed
							}
						}));
					}
				} finally {
					if (mounted.current) setProbeBusy((prev) => new Set([...prev].filter((k) => k !== modelKey)));
				}
			};
			const refreshModels = async () => {
				setSiblingBusy(true);
				try {
					const response = await fetch(withQoderRegion(QODER_MODELS_REFRESH_PATH, activeRegion), {
						method: "POST",
						credentials: "same-origin"
					});
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
					await refresh(activeRegion, true);
				} catch (error) {
					if (mounted.current) setSaveError(String(error?.message ?? error));
				} finally {
					if (mounted.current) setSiblingBusy(false);
				}
			};
			const saveModels = async () => {
				if (scope === void 0) return;
				setSaving(true);
				setSaveError(void 0);
				const payload = buildModelsPayload(draft, cartesianModels);
				try {
					await writeRegionModels(scope, activeRegion, payload);
					setDrafts((prev) => ({
						...prev,
						[activeRegion]: void 0
					}));
					setDirty(false);
					await refresh(activeRegion, true);
				} catch (error) {
					setSaveError(isContention(error) ? `${t("row.saveError", { message: String(error?.message ?? error) })}${t("row.saveContentionHint")}` : t("row.saveError", { message: String(error?.message ?? error) }));
				} finally {
					if (mounted.current) setSaving(false);
				}
			};
			const discardModels = () => {
				setDrafts((prev) => ({
					...prev,
					[activeRegion]: void 0
				}));
				setDirty(false);
				setSaveError(void 0);
			};
			/**
			* 可选的侧边栏面板开关此刻是否打开。
			*
			* 三级读法，与 `creditsShownOf` 那一族同规：**这张卡片自己成功写下的值**优先，
			* 其次是 Host 在 usage 文档里交下来的已提交值，最后才是 settings 快照。
			*
			* 为什么 Host 排在快照前面（而不是反过来）：这个命名空间的浏览器镜像在受影响的
			* 0.1.7 部署上被记录为陈旧，而这里一个陈旧的 `false` 会让行永远不出现——并且
			* 之后没有任何事件去纠正它（`whileServed` 只在命名空间边缘触发，不在值变化时
			* 触发）。Host 的答案才是权威，与其它 Host 承载开关一致。
			*
			* GLOBAL：侧边栏只有一行、一个整页，所以从活动 tab 读到的那份就是全部答案，
			* 不随区域变。
			*/
			const sidebarPanelSwitchedOn = () => {
				if (sidebarPanelOn !== void 0) return sidebarPanelOn;
				const fromHost = usage?.sidebarPanelEnabled;
				if (typeof fromHost === "boolean") return fromHost;
				return sidebarPanelEnabledOf(scope?.getSnapshot().value);
			};
			/**
			* 翻转侧边栏面板开关。
			*
			* 成功后**才**发布到入口的开关 store：那一行是拿插槽注册元数据渲染的，自己
			* 决定不了自己的可见性（见 `panel-switch.ts`）。只在写入被验证之后发布，
			* 两者就不会打架——Host 拒绝过的值绝不会长出一行。
			*/
			const toggleSidebarPanel = async (enabled) => {
				if (scope === void 0) return;
				setSidebarPanelBusy(true);
				setSidebarPanelError(void 0);
				try {
					await writeSidebarPanelEnabled(scope, enabled);
					if (mounted.current) setSidebarPanelOn(enabled);
					setSidebarPanelWanted(enabled);
					await refresh(activeRegion, true);
				} catch (error) {
					if (mounted.current) setSidebarPanelError(t("row.sidebarPanelFailed", { message: error instanceof Error ? error.message : String(error) }));
				} finally {
					if (mounted.current) setSidebarPanelBusy(false);
				}
			};
			const signIn = usage?.status === "signed-in" ? usage : void 0;
			/**
			* 正文本身，与「装在哪种外壳里」无关。
			*
			* 两种外壳（设置页那个 `<li>` 卡片行 / 侧边栏那一行打开的整页）渲染的是
			* **同一份**正文：账号池、模型目录、诊断栏、以及所有即时生效的开关。把它们
			* 抽出来的理由与 workbuddy 相同——整页不是「另一个页面」，它是同一份内容的
			* 第二个入口；写成两份就会有两个真相，而用户会拿其中一份去对照另一份。
			*/
			const cardBody = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsm-plugin-card-body",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsm-qoder-usage",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsm-qoder-tabs",
								role: "tablist",
								"aria-label": t("row.title"),
								children: QODER_REGIONS.map((region) => {
									const on = region === activeRegion;
									const regionStatus = usages[region]?.status ?? "signed-out";
									const regionOnState = regionOnOf(usages[region]);
									return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: `dsm-qoder-tab-cell${on ? " dsm-qoder-tab-cell-active" : ""}`,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
											type: "button",
											role: "tab",
											"aria-selected": on,
											className: `dsm-qoder-tab${on ? " dsm-qoder-tab-active" : ""}${regionOnState ? "" : " dsm-qoder-tab-off"}`,
											onClick: () => {
												setActiveRegion(region);
												setSaveError(void 0);
											},
											children: [usages[region] === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												"aria-hidden": "true",
												className: "dsm-qoder-tab-dot",
												style: dotStyle(regionStatus)
											}), region === "cn" ? t("row.tabCn") : t("row.tabGlobal")]
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
											className: "dsm-qoder-tab-switch",
											title: t("row.tabSwitchHint"),
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
												type: "checkbox",
												checked: regionOnState,
												disabled: !canWrite(scope) || siblingBusy || poolBusy,
												"aria-label": t("row.tabSwitchAria", { region: region === "cn" ? t("row.tabCn") : t("row.tabGlobal") }),
												onChange: (event) => {
													toggleRegion(region, event.target.checked);
												}
											})
										})]
									}, region);
								})
							}),
							!regionOn ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsm-qoder-tab-off-notice",
								children: t("row.tabOffNotice")
							}) : null,
							signIn === void 0 || signIn.credits !== void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsm-qoder-usage-text",
								children: signIn.creditsError === void 0 ? t("row.usageUnavailable") : t("row.creditsError", { message: signIn.creditsError })
							})
						]
					}),
					regionOn && campaignsShownOf(usage) ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(QoderCampaigns, {
						region: activeRegion,
						t
					}) : null,
					signIn?.credentialRejected === true ? renderRejected(signIn) : null,
					usage?.status === "error" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dsm-qoder-usage-error",
						role: "alert",
						children: usage.message
					}) : null,
					renderQuotaNotice(),
					usage?.status === "signed-in" && usage.refreshError !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dsm-qoder-hint",
						children: t("row.requestFailedHint", { message: usage.refreshError })
					}) : null,
					usage?.status === "signed-out" && usage.selectionLost === true ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dsm-qoder-hint",
						children: t("row.selectionLostHint")
					}) : null,
					regionOn && usage?.status !== "error" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dsm-qoder-panels",
							role: "tablist",
							"aria-label": t("row.panelAria"),
							children: [
								"accounts",
								"models",
								"capabilities",
								"diag"
							].map((id) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								role: "tab",
								id: `dsm-qoder-tab-${id}`,
								"aria-controls": `dsm-qoder-panel-${id}`,
								"aria-selected": panel === id,
								className: `dsm-qoder-panel-tab${panel === id ? " dsm-qoder-panel-tab-active" : ""}`,
								onClick: () => {
									setPanel(id);
								},
								children: t(PANEL_TAB_LABELS[id])
							}, id))
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsm-qoder-panel",
							role: "tabpanel",
							id: "dsm-qoder-panel-accounts",
							"aria-labelledby": "dsm-qoder-tab-accounts",
							hidden: panel !== "accounts",
							children: [usage === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsm-qoder-usage-text",
								role: "status",
								children: t("row.accountsLoading")
							}) : null, renderPool()]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dsm-qoder-panel",
							role: "tabpanel",
							id: "dsm-qoder-panel-models",
							"aria-labelledby": "dsm-qoder-tab-models",
							hidden: panel !== "models",
							children: renderModels()
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dsm-qoder-panel",
							role: "tabpanel",
							id: "dsm-qoder-panel-capabilities",
							"aria-labelledby": "dsm-qoder-tab-capabilities",
							hidden: panel !== "capabilities",
							children: renderCreditsSwitch()
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dsm-qoder-panel",
							role: "tabpanel",
							id: "dsm-qoder-panel-diag",
							"aria-labelledby": "dsm-qoder-tab-diag",
							hidden: panel !== "diag",
							children: renderDiag()
						})
					] }) : null
				]
			});
			/**
			* 侧边栏整页的页头（对齐 workbuddy 的 `pageHead`）。
			*
			* 返回按钮由**宿主**的 layout 服务提供：`selectPanel(null)` 把中央那一列交回
			* 对话。它是软探测的（注册处只在 `layout` 存在时才注入回调），所以一台不声明
			* `layout` 的宿主只会少一个返回按钮，而不是整页不渲染。
			*/
			const pageHead = pageSurface ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsm-qoder-page-head",
				children: [
					backToConversation === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "dsm-qoder-page-back",
						onClick: backToConversation,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
							width: "14",
							height: "14",
							viewBox: "0 0 16 16",
							fill: "none",
							"aria-hidden": "true",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
								d: "M10 3.5 5.5 8l4.5 4.5",
								stroke: "currentColor",
								strokeWidth: "1.6",
								strokeLinecap: "round",
								strokeLinejoin: "round"
							})
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("nav.back") })]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
						className: "dsm-qoder-page-icon",
						src: QODER_PLUGIN_ICON,
						alt: ""
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dsm-qoder-page-title",
						children: t("row.title")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dsm-qoder-page-desc",
						children: t("row.desc")
					})
				]
			}) : null;
			/**
			* 侧边栏整页：页头 + 同一份正文。
			*
			* 刻意**不是** `<li class="dsm-plugin-card">`：那一套外壳是「插件列表里的一
			* 行」（折叠 header、上下分隔线），而整页不是列表项，套进去会得到一个既不像
			* 列表项也不像页面的东西。
			*/
			if (pageSurface) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsm-qoder-page",
				children: [pageHead, /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "dsm-qoder-page-body",
					children: cardBody
				})]
			});
			/**
			* 设置页（`settings.section`）：标题 → 一句话总述 → 三条核心用途 → 正文。
			*
			* 与侧边栏整页的区别只有页头：设置面板自己提供导航与关闭，所以这里**没有**
			* 返回按钮，也不需要再画一枚 40px 的品牌标（导航行里已经有了）。
			*
			* 三条用途不是装饰：这一页把「账号池、签到、模型目录、积分读数」四件事装在
			* 一起，落地时用户最先看到的是 tab 栏和一张账号表，得靠这三行知道**哪些开关
			* 买到了什么**。兄弟项目 dsh-subagent-default-model 2.1.20 做过同一件事。
			*/
			if (sectionSurface) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsm-qoder-section",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
						className: "dsm-qoder-section-heading",
						children: t("section.title")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dsm-qoder-section-intro",
						children: t("row.tabHint")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsm-qoder-section-body",
						children: cardBody
					})
				]
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
				className: `dsm-plugin-card${open ? " dsm-plugin-card-open" : ""}`,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: "dsm-plugin-card-header",
					onClick: () => {
						setOpen(!open);
					},
					"aria-expanded": open,
					"aria-label": `${t(open ? "row.collapse" : "row.expand")}: ${t("row.title")}`,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
							className: "dsm-plugin-card-icon",
							src: QODER_PLUGIN_ICON,
							alt: "",
							width: "32",
							height: "32"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: "dsm-plugin-card-head",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dsm-plugin-card-title",
								children: t("row.title")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dsm-plugin-card-description",
								children: t("row.desc")
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: `dsm-plugin-card-chevron${open ? " dsm-plugin-card-chevron-open" : ""}`,
							"aria-hidden": "true"
						})
					]
				}), open ? cardBody : null]
			});
			function toggleRegion(region, on) {
				if (scope === void 0) return;
				setSiblingBusy(true);
				writeRegionEnabled(scope, region, on, slotWith(scope, region, { enabled: on })).finally(() => {
					if (mounted.current) setSiblingBusy(false);
				});
			}
			function toggleCreditsShown(on) {
				if (scope === void 0) return;
				setSiblingBusy(true);
				writeRegionCreditsShown(scope, activeRegion, on, slotWith(scope, activeRegion, { showCreditsInMainUi: on })).finally(() => {
					if (mounted.current) setSiblingBusy(false);
				});
			}
			/**
			* 显示/隐藏本区域的活动区。
			*
			* 与 `toggleCreditsShown` 逐字同形：两者都是**区域级内容开关**，写的是整个
			* 区域槽（兄弟区域不会被吃掉），落地检查也由 `writeRegionCampaignsShown`
			* 自己做 —— 宿主可能静默丢掉一次写入，勾选框继续显示旧值比报错更糟。
			*/
			function toggleCampaignsShown(on) {
				if (scope === void 0) return;
				setSiblingBusy(true);
				writeRegionCampaignsShown(scope, activeRegion, on, slotWith(scope, activeRegion, { showCampaigns: on })).finally(() => {
					if (mounted.current) setSiblingBusy(false);
				});
			}
			/**
			* Move this region's readout to another seat.
			*
			* A settings write, not a slot re-registration: both seats are registered
			* unconditionally and the gate picks between them, so this returns as soon as
			* the Host accepts it.
			*/
			function changeCreditPosition(position) {
				if (scope === void 0) return;
				setSiblingBusy(true);
				writeRegionCreditPosition(scope, activeRegion, position, slotWith(scope, activeRegion, { creditPosition: position })).finally(() => {
					if (mounted.current) setSiblingBusy(false);
				});
			}
			/**
			* 改全局的自动刷新间隔。顶层标量，与 `changeCreditPosition` 的区域写入不同形：
			* 它没有区域轴，走 {@link writePollMinutes}（宿主端点优先、镜像次之）。
			*
			* 失败就地说话：这一行在能力栏里随时可点，而模型栏的保存行此刻可能根本没显示。
			*/
			function changePollMinutes(minutes) {
				if (scope === void 0) return;
				setPollMinutesBusy(true);
				setPollMinutesError(void 0);
				writePollMinutes(scope, minutes).catch((error) => {
					if (mounted.current) setPollMinutesError(t("row.pollMinutesFailed", { message: error instanceof Error ? error.message : String(error) }));
				}).finally(() => {
					if (mounted.current) setPollMinutesBusy(false);
				});
			}
			function renderQuotaNotice() {
				const record = lastQuotaExhaustionOf(usage);
				if (record === void 0) return null;
				return renderQuotaExhausted(record);
			}
			/**
			* 「上游报额度耗尽」通知：区域级、事实性（上游业务码命中配额族才产生），
			* 口径是「最近一次 + 时刻」——上游恢复不会主动通知，时间戳就是它的时效。
			*
			* 池开着且命中号是成员时，逐账号明细在账号池表格里（红点 + 原因）；这条
			* 区域级通知存在的意义是**池关着/非成员**的那个缺口：此前一次 code 110 的
			* 失败在任何 UI 上都无处可看（0.7.x「今日额度疑似已用尽」胶囊拆掉后留下的）。
			*/
			function renderQuotaExhausted(record) {
				const time = new Date(record.atMs).toLocaleTimeString(void 0, {
					hour: "2-digit",
					minute: "2-digit"
				});
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
					className: "dsm-qoder-usage-error dsm-qoder-quota-exhausted",
					role: "status",
					...record.message === "" ? {} : { title: record.message },
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t("row.quotaExhaustedTitle") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("row.quotaExhaustedDetail", {
						time,
						code: record.code ?? "—"
					}) })]
				});
			}
			function renderRejected(usage) {
				const recovery = usage.recovery;
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
					className: "dsm-qoder-usage-error",
					role: "alert",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t("row.credentialRejectedTitle") }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("row.credentialRejectedIntro", { accountName: usage.accountName }) }),
						recovery?.usableAccount !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("row.credentialRejectedSwitch", { accountName: recovery.usableAccount.accountName }) }) : recovery?.reloginRequired === true ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("row.credentialRejectedRelogin") }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("row.credentialRejectedChoose") }),
						recovery?.usableAccount === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "dsm-btn dsm-btn-outline",
							disabled: !canWrite(scope) || siblingBusy,
							onClick: () => {
								if (scope === void 0) return;
								setSiblingBusy(true);
								writeAccountSlot(scope, activeRegion, recovery.usableAccount.accountId).finally(() => {
									if (mounted.current) {
										setSiblingBusy(false);
										refresh(activeRegion, true);
									}
								});
							},
							children: siblingBusy ? t("row.accountsScanning") : t("row.credentialRejectedSwitchAction", { accountName: recovery.usableAccount.accountName })
						})
					]
				});
			}
			function renderModels() {
				const modelList = signIn?.models ?? [];
				/**
				* 活动徽标的判定时钟：**一次渲染一个时刻**。
				*
				* 不在解析目录时挑定徽标——上游的活动是墙钟窗口（22:00–08:00 Asia/Shanghai），
				* 写死一枚会让夜里读到的「错峰 4 折」在第二天早上继续挂着。卡片打开期间本来
				* 就会随轮询重渲染，这里只要每次用「现在的时刻」重判即可，不需要额外定时器。
				* 同一帧里所有行共用一个 `Date`，避免同一份数据被两个时刻判出两种结果。
				*/
				const promoNow = /* @__PURE__ */ new Date();
				const promoLanguage = hostLanguage(t);
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
					className: "dsm-qoder-models",
					"aria-label": t("row.modelsTitle"),
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsm-qoder-models-head",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsm-qoder-models-title-row",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("h3", {
									className: "dsm-qoder-models-title",
									children: [t("row.modelsTitle"), dirty ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsm-qoder-models-dirty",
										children: t("row.modelsDirty")
									}) : null]
								})
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsm-qoder-models-summary",
								children: t("row.modelsSummary", { count: String(draft.enabledModelKeys.size) })
							})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsm-qoder-models-head-actions",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "dsm-btn dsm-btn-outline",
									disabled: siblingBusy,
									onClick: () => {
										refreshModels();
									},
									children: siblingBusy ? t("row.modelsRefreshing") : t("row.modelsRefresh")
								})
							})]
						}),
						modelList.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dsm-qoder-usage-hint",
							children: t("row.usageUnavailable")
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dsm-qoder-model-list",
							children: modelList.map((model) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: `dsm-qoder-model${draft.enabledModelKeys.has(model.key) ? "" : " dsm-qoder-model-disabled"}`,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsm-qoder-model-head",
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
												className: "dsm-qoder-model-enabled",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
													type: "checkbox",
													checked: draft.enabledModelKeys.has(model.key),
													disabled: !canWrite(scope) || siblingBusy,
													onChange: (e) => toggleModel(model.key, e.target.checked)
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
													className: "dsm-qoder-model-copy",
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
														className: "dsm-qoder-model-name",
														title: model.key,
														children: [model.name, typeof model.creditMultiplier === "number" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
															className: "dsm-qoder-model-name-rate",
															title: (() => {
																return rateHint({
																	priceFactor: model.creditMultiplier,
																	promotion: model.promotion
																}, promoNow, t);
															})(),
															children: [
																"(",
																displayMultiplierOf({
																	priceFactor: model.creditMultiplier,
																	promotion: model.promotion
																}, promoNow).toFixed(2),
																"x)"
															]
														}) : null]
													}), (() => {
														const promo = model.promotion;
														const display = promoDisplayAt(promo, promoNow);
														if (promo === void 0 || display === "none") return null;
														const label = promoBadgeLabel(promo, promoLanguage);
														if (label === void 0) return null;
														const pending = display === "pending";
														const start = promo.window?.start;
														if (pending && start === void 0) return null;
														const tip = promoBadgeTooltip(promo, promoLanguage);
														const title = pending ? [t("row.promoPending", { start }), tip].filter((part) => part !== "").join(" · ") : tip;
														return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: pending ? "dsm-qoder-model-promo dsm-qoder-model-promo-pending" : "dsm-qoder-model-promo",
															title,
															onClick: (event) => {
																event.preventDefault();
																event.stopPropagation();
															},
															children: label
														});
													})()]
												})]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
												className: "dsm-qoder-model-image",
												title: imageCheckboxHint(model.key, model.name, t),
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
													type: "checkbox",
													checked: draft.supportsImages.has(model.key),
													disabled: !canWrite(scope) || siblingBusy,
													onChange: (e) => toggleImageLight(model.key, e.target.checked)
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("row.modelImage") })]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
												className: "dsm-qoder-model-off",
												title: t("row.modelOffHint"),
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
													type: "checkbox",
													disabled: !canWrite(scope) || siblingBusy,
													checked: draft.offModelKeys.has(model.key),
													onChange: (e) => toggleOff(model.key, e.target.checked)
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("row.modelOff") })]
											}),
											renderContextPicker(model),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: "dsm-qoder-model-actions-buttons",
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: "dsm-btn dsm-btn-outline dsm-qoder-model-probe",
													disabled: probeBusy.has(model.key) || signIn === void 0,
													title: t("row.probeHint"),
													onClick: () => {
														runProbe(model.key);
													},
													children: probeBusy.has(model.key) ? t("row.probing") : t("row.probe")
												})
											})
										]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "dsm-qoder-model-details",
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "dsm-qoder-model-meta",
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("row.modelContext", { context: formatCapacity(model.contextWindow) }) }),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("row.modelOutput", { output: formatCapacity(model.maxTokens) }) }),
												renderEffortPicker(model),
												model.isFree === true ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dsm-qoder-model-meta-tag",
													title: t("row.modelFreeHint"),
													children: t("row.modelFree")
												}) : null
											]
										})
									}),
									(() => {
										const p = probes[activeRegion]?.[model.key];
										if (p === void 0) return null;
										const view = probeResultView(p, t);
										const reason = inlineProbeReason(p.outcome, p.message);
										return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
											className: `dsm-qoder-model-probe-result dsm-qoder-model-probe-result-${view.tone}`,
											role: "status",
											...p.message === void 0 ? {} : { title: p.message },
											children: [view.text, reason === void 0 ? null : " · " + reason]
										});
									})()
								]
							}, model.key))
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dsm-qoder-model-capability-note",
							children: t("row.modelCapabilityPending")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsm-qoder-model-actions",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("a", {
									className: "dsm-qoder-usage-cheer",
									href: QODER_GITHUB_URL,
									target: "_blank",
									rel: "noopener noreferrer",
									children: [t("row.cheer"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsm-qoder-usage-cheer-star",
										"aria-hidden": "true",
										children: "★"
									})]
								}),
								saveError === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsm-qoder-model-save-error",
									children: t("row.saveError", { message: saveError })
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsm-qoder-model-actions-buttons",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "dsm-btn dsm-btn-outline",
										disabled: !dirty || !canWrite(scope) || saving || poolBusy,
										onClick: discardModels,
										children: t("row.discard")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "dsm-btn dsm-btn-primary",
										disabled: !canWrite(scope) || saving || !dirty || poolBusy || draft.enabledModelKeys.size === 0,
										onClick: () => {
											saveModels();
										},
										children: saving ? t("row.saving") : t("row.save")
									})]
								})
							]
						})
					]
				});
			}
			/**
			* 思考强度选择器（一项设置，保存后每个请求自动带上）。
			*
			* 档位名由上游逐模型声明，且**不统一**（Qwen 系 low/medium/xhigh，
			* DeepSeek/GLM 系 low/high/max），所以选项直接显示上游给的档位名，不做
			* 本地化、也不跨模型比较。多出一个「默认」项表示不干预（清掉保存值，请求
			* 不带档位字段，由上游用它自己的默认档）——没有这一项的话，用户选过一次
			* 就再也回不到「跟随上游默认」。
			*/
			function renderEffortPicker(model) {
				const efforts = model.thinkingEfforts ?? [];
				if (efforts.length === 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {});
				const saved = draft.thinkingEfforts[model.key] ?? "";
				return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dsm-qoder-effort",
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [
						t("row.modelReasoningLabel"),
						" ",
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dsm-qoder-inline",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
								className: "dsm-qoder-inline-select",
								disabled: !canWrite(scope) || siblingBusy,
								value: saved,
								onChange: (e) => setThinkingEffort(model.key, e.target.value),
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: "",
									children: model.defaultThinkingEffort === void 0 ? t("row.modelReasoningFollowUpstream") : t("row.modelReasoningFollowUpstreamNamed", { effort: model.defaultThinkingEffort })
								}), efforts.map((effort) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: effort,
									children: effort
								}, effort))]
							})
						})
					] })
				});
			}
			function renderContextPicker(model) {
				const tiers = model.contextTiers ?? [];
				if (tiers.length === 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {});
				const current = draft.contextBudgets[model.key] ?? model.contextWindow;
				return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "dsm-qoder-context-budget",
					title: t("row.contextBudget"),
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dsm-qoder-inline",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
							className: "dsm-qoder-inline-select",
							"aria-label": t("row.contextBudget"),
							disabled: !canWrite(scope) || siblingBusy,
							value: String(current),
							onChange: (e) => setContextBudget(model.key, Number(e.target.value)),
							children: tiers.map((tier) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: String(tier),
								children: formatCapacity(tier)
							}, String(tier)))
						})
					}) })
				});
			}
			/**
			* 诊断栏：这张卡片**实际读到了什么**。
			*
			* 它是一个两列的事实表，不是散文。每一行都是卡片真的读到的值，所以一次问题
			* 反馈可以**整段引用**，而不是把界面复述一遍。
			*
			* 这里**没有任何会改设置的控件**，这是刻意的：能改设置的诊断栏，只是一个名字
			* 更差的设置栏。也正因为如此，它读的是**已保存**的值（`enabledModelKeys`，而不是
			* 草稿 `draft`）——一份诊断若把「你还没点保存的改动」当成事实报出去，它给出的
			* 就是错的答案。
			*
			* 上游域名读的是 `QODER_UPSTREAM_DOMAIN`，与 `upstream.ts` 里真正发请求的那个
			* 主机名**同一处事实**；不用 `QODER_CONSOLE_DOMAIN`（那是用户浏览器里申请 PAT
			* 的控制台，国际版恰好是另一个域名，拿它回答这个问题会给出看似对的错答案）。
			*/
			function renderDiag() {
				const failures = [];
				if (signIn?.credentialRejected === true) failures.push(t("row.credentialRejectedTitle"));
				if (signIn?.refreshError !== void 0) failures.push(signIn.refreshError);
				if (signIn?.creditsError !== void 0) failures.push(signIn.creditsError);
				if (usage?.status === "error") failures.push(usage.message);
				const pool = usage?.status === "error" ? void 0 : usage?.pool;
				const serving = signIn === void 0 ? "—" : signIn.accountName === "" ? t("row.accountUnnamed") : signIn.accountName;
				const rows = [
					{
						label: t("row.diagRegion"),
						value: activeRegion === "cn" ? t("row.tabCn") : t("row.tabGlobal")
					},
					{
						label: t("row.diagDomain"),
						value: QODER_UPSTREAM_DOMAIN[activeRegion],
						mono: true
					},
					{
						label: t("row.diagAccount"),
						value: serving
					},
					...signIn?.source === void 0 ? [] : [{
						label: t("row.diagSource"),
						value: signIn.source === "settings" ? t("row.accountSourceSettings") : signIn.source === "env" ? t("row.accountSourceEnv") : t("row.accountSourceVault")
					}],
					...signIn?.creditsAtMs === void 0 ? [] : [{
						label: t("row.diagCreditsAt"),
						value: formatProbeMoment(signIn.creditsAtMs),
						mono: true
					}],
					...signIn === void 0 ? [] : [{
						label: t("row.diagCatalog"),
						value: formatNumber(signIn.models.length)
					}, {
						label: t("row.diagEnabled"),
						value: formatNumber(signIn.enabledModelKeys.length)
					}],
					...pool === void 0 ? [] : [{
						label: t("row.diagPool"),
						value: pool.enabled ? t("row.diagPoolOn", { count: pool.accounts.length }) : t("row.diagPoolOff")
					}]
				];
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
					"aria-label": t("row.panelDiag"),
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsm-qoder-diag",
						children: [rows.map((row) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsm-qoder-diag-row",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dsm-qoder-diag-label",
								children: row.label
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: `dsm-qoder-diag-value${row.mono === true ? " dsm-qoder-diag-mono" : ""}`,
								children: row.value
							})]
						}, row.label)), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsm-qoder-diag-row",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dsm-qoder-diag-label",
								children: t("row.diagFailures")
							}), failures.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dsm-qoder-diag-value",
								children: t("row.diagNoFailures")
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dsm-qoder-diag-value dsm-qoder-diag-bad dsm-qoder-diag-mono",
								children: failures.join(" · ")
							})]
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dsm-qoder-diag-hint",
						children: t("row.diagHint")
					})]
				});
			}
			/**
			* 账号池区。**读 `usage` 而不是 `signIn`** —— 这一行是国际版整块空白的直接原因。
			*
			* 此前它第一行就 `if (signIn?.pool === undefined) return <span />`，而 `signIn`
			* 只在 `status === 'signed-in'` 时存在。于是国际版（一个 PAT 都没有）永远拿到
			* `signed-out`，账号池整块不渲染 —— 连同由它渲染的「添加 PAT / 导出导入」
			* 一起消失。**最需要添加第一个账号的页面，反而没有任何添加账号的入口**
			* （用户实拍：国际版看起来就是空的）。
			*
			* 宿主侧此前已经修好了一半：`buildWebUsage` 的 `signed-out` 支现在也构建并带上
			* `pool`（零账号时 `current` 全为 false）。这一行是剩下的另一半 —— 两边都改完，
			* 零凭据的区域才会既能看到「这里还没有账号」的说法，又拿得到添加入口。
			*
			* `status === 'error'` 仍不渲染：那是一份没读成的文档，它的 pool 字段根本没
			* 有过，渲染一个空壳只会把错误行挤到下面（与 workbuddy 同规）。
			*/
			/** 「在对话框显示积分」那两行（- 复选框+标题+说明 / - 显示位置+说明）。
			*
			*  池存在时交给账号池的设置区渲染在最上面；池不存在时由 renderPool 就地
			*  渲染——它管的是「读数显不显示」，跟有没有账号池是两件事。
			*/
			function renderCreditsSwitch() {
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dsm-qoder-prefs",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: "dsm-qoder-pref dsm-qoder-credit-toggle",
							title: activeRegion === "cn" ? t("row.showCreditsCnHint") : t("row.showCreditsGlobalHint"),
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "checkbox",
								className: "dsm-qoder-pref-check",
								checked: regionOn ? creditsShownOf(usage) : false,
								disabled: !regionOn || !canWrite(scope) || siblingBusy || poolBusy,
								"aria-describedby": creditsHintId,
								onChange: (event) => {
									toggleCreditsShown(event.target.checked);
								}
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "dsm-qoder-pref-copy",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsm-qoder-pref-label",
									id: creditsLabelId,
									children: activeRegion === "cn" ? t("row.showCreditsCn") : t("row.showCreditsGlobal")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsm-qoder-pref-hint",
									id: creditsHintId,
									children: activeRegion === "cn" ? t("row.showCreditsCnDesc") : t("row.showCreditsGlobalDesc")
								})]
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
							className: "dsm-qoder-pref dsm-qoder-credit-position-pref",
							title: t("row.creditPositionHint"),
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "dsm-qoder-pref-copy",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: "dsm-qoder-pref-lead",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsm-qoder-pref-label",
										children: t("row.creditPositionLabel")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
										className: "dsm-qoder-credit-position",
										value: creditsPositionOf(usage),
										disabled: !regionOn || !creditsShownOf(usage) || !canWrite(scope) || siblingBusy || poolBusy,
										"aria-label": t("row.creditPositionAria", { region: activeRegion === "cn" ? "QD CN" : "QD AI" }),
										onChange: (event) => {
											changeCreditPosition(event.target.value === "stats" ? "stats" : "composer");
										},
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: "composer",
											children: t("row.creditPositionComposer")
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: "stats",
											children: t("row.creditPositionStats")
										})]
									})]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsm-qoder-pref-hint",
									children: t("row.creditPositionHint")
								})]
							})
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
							className: "dsm-qoder-pref dsm-qoder-poll-minutes-pref",
							title: t("row.pollMinutesHint"),
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "dsm-qoder-pref-copy",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: "dsm-qoder-pref-lead",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsm-qoder-pref-label",
										children: t("row.pollMinutesLabel")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
										className: "dsm-qoder-poll-minutes",
										value: String(pollMinutes),
										disabled: !canWrite(scope) || siblingBusy || poolBusy || pollMinutesBusy,
										"aria-label": t("row.pollMinutesAria"),
										onChange: (event) => {
											const minutes = Number(event.target.value);
											if (QODER_POLL_MINUTES_OPTIONS.includes(minutes)) changePollMinutes(minutes);
										},
										children: QODER_POLL_MINUTES_OPTIONS.map((minutes) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: String(minutes),
											children: t("row.pollMinutesOption", { minutes: String(minutes) })
										}, minutes))
									})]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsm-qoder-pref-hint",
									children: t("row.pollMinutesHint")
								})]
							})
						}),
						pollMinutesError === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dsm-qoder-hint dsm-qoder-poll-minutes-error",
							role: "alert",
							children: pollMinutesError
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: "dsm-qoder-pref dsm-qoder-campaigns-pref",
							title: t("row.showCampaignsHint"),
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "checkbox",
								className: "dsm-qoder-campaigns-check",
								checked: regionOn && campaignsShownOf(usage),
								disabled: !regionOn || !canWrite(scope) || siblingBusy || poolBusy,
								onChange: (event) => {
									toggleCampaignsShown(event.target.checked);
								}
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "dsm-qoder-pref-copy",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsm-qoder-pref-label",
									children: t("row.showCampaigns")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsm-qoder-pref-hint",
									children: t("row.showCampaignsHint")
								})]
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: "dsm-qoder-pref dsm-qoder-sidebar-panel-pref",
							title: t("row.sidebarPanelHint"),
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "checkbox",
								className: "dsm-qoder-sidebar-panel-check",
								checked: sidebarPanelSwitchedOn(),
								disabled: !canWrite(scope) || saving || poolBusy || sidebarPanelBusy,
								onChange: (event) => {
									toggleSidebarPanel(event.target.checked);
								}
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "dsm-qoder-pref-copy",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsm-qoder-pref-label",
									children: t("row.sidebarPanelLabel")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsm-qoder-pref-hint",
									children: t("row.sidebarPanelHint")
								})]
							})]
						}),
						sidebarPanelError === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dsm-qoder-hint dsm-qoder-sidebar-panel-error",
							role: "alert",
							children: sidebarPanelError
						})
					]
				});
			}
			function renderPool() {
				const doc = usage?.status === "error" ? void 0 : usage;
				const pool = doc?.pool;
				if (pool === void 0 || doc === void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {});
				const accountTools = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(AddAccount, {
					t,
					region: activeRegion,
					onAdded: () => refresh(activeRegion, true)
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AccountTransfer, {
					t,
					region: activeRegion,
					accounts: doc.accounts.map((a) => ({
						id: a.id,
						accountName: a.accountName
					})),
					onChanged: () => refresh(activeRegion, true)
				})] });
				return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AccountPool, {
					t,
					region: activeRegion,
					pool,
					settingsScope: scope,
					siblingBusy,
					canWrite: canWrite(scope),
					onBusyChange: setPoolBusy,
					accountTools,
					onChanged: () => refresh(activeRegion, true),
					onSelectAccount: (accountId) => {
						if (scope === void 0) return;
						setSiblingBusy(true);
						writeAccountSlot(scope, activeRegion, accountId).finally(() => {
							if (mounted.current) {
								setSiblingBusy(false);
								refresh(activeRegion, true);
							}
						});
					}
				});
			}
		}
		/** Whether the injected scope permits edits. */
		function canWrite(scope) {
			return scope !== void 0;
		}
		/** Build the region slot for a write (merge into the current slot). */
		function slotWith(scope, region, patch) {
			const root = scope.getSnapshot().value;
			const regions = typeof root === "object" && root !== null && !Array.isArray(root) ? root["regions"] : void 0;
			const map = typeof regions === "object" && regions !== null && !Array.isArray(regions) ? regions : {};
			return {
				...typeof map[region] === "object" && map[region] !== null && !Array.isArray(map[region]) ? map[region] : {},
				...patch
			};
		}
		/** Whether a usage doc's region is switched on (opt-out). */
		function regionEnabledOfUsage(usage) {
			if (usage === void 0) return true;
			if (usage.status === "signed-out") return usage.enabled !== false;
			if (usage.status === "signed-in") return usage.enabled !== false;
			return true;
		}
		function regionOnOf(usage) {
			return regionEnabledOfUsage(usage);
		}
		/**
		* Whether this region's campaign feed is shown.
		*
		* Read from the HOST's answer (`usage.showCampaigns`) rather than the browser
		* settings mirror, for the same measured reason as `creditsShownOf`: on
		* affected deployments that mirror never picks up writes made through the Host
		* save endpoint. Absent (older Host, or an error document) reads as SHOWN —
		* the feed was there before this switch existed.
		*/
		function campaignsShownOf(usage) {
			if (usage === void 0) return true;
			if (usage.status === "error") return true;
			return usage.showCampaigns !== false;
		}
		function creditsShownOf(usage) {
			if (usage === void 0) return true;
			if (usage.status === "signed-out") return usage.showCreditsInMainUi !== false;
			if (usage.status === "signed-in") return usage.showCreditsInMainUi !== false;
			return true;
		}
		/**
		* Which seat this region's readout uses, read from the HOST's answer.
		*
		* Read from the usage document rather than the browser settings mirror, for the
		* same measured reason as the switch above: on affected deployments that mirror
		* never picks up writes made through the Host save endpoint, so a control
		* reading it would keep showing the old seat.
		*/
		function creditsPositionOf(usage) {
			if (usage === void 0) return "composer";
			if (usage.status === "error") return "composer";
			return usage.creditPosition === "stats" ? "stats" : "composer";
		}
		/** The region's last upstream-asserted quota exhaustion, on either variant. */
		function lastQuotaExhaustionOf(usage) {
			if (usage === void 0) return void 0;
			if (usage.status === "error") return void 0;
			return usage.lastQuotaExhaustion;
		}
		function cloneDraft(draft) {
			return {
				enabledModelKeys: new Set(draft.enabledModelKeys),
				offModelKeys: new Set(draft.offModelKeys),
				supportsImages: new Set(draft.supportsImages),
				contextBudgets: { ...draft.contextBudgets },
				thinkingEfforts: { ...draft.thinkingEfforts }
			};
		}
		/** Build the `lastCatalog` array + enabled/off/image selections for the save. */
		function buildModelsPayload(draft, models) {
			return {
				lastCatalog: models.map((model) => toPersistedCatalogEntry(model, { supportsImages: draft.supportsImages.has(model.key) })),
				enabledModelKeys: [...draft.enabledModelKeys],
				imageModelKeys: [...draft.supportsImages],
				imageSelectionSaved: true,
				offModelKeys: [...draft.offModelKeys],
				contextBudgets: draft.contextBudgets,
				thinkingEfforts: draft.thinkingEfforts
			};
		}
		function isContention(error) {
			const message = error instanceof Error ? error.message : String(error);
			return /\b(?:EPERM|EBUSY|EACCES)\b/u.test(message);
		}
		function formatCapacity(value, unknown = "—") {
			if (value === void 0) return unknown;
			if (value >= 1e6 && value % 1e6 === 0) return `${value / 1e6}M`;
			if (value >= 1e3 && value % 1e3 === 0) return `${value / 1e3}K`;
			return formatNumber(value);
		}
		//#endregion
		//#region src/client/popover.ts
		/**
		* The two shell behaviours the composer credit panel needs: hanging the panel
		* off its trigger, and dismissing it on an outside press.
		*
		* 参考：dingminhua/dsh-connect-workbuddy（MIT，Copyright (c) 2026 LaoDing）
		*   — 该项目的 `client/popover.ts`，逐条沿用其判断：同样的上下放置、同样的
		*     视口收边、同样的 scroll(capture)/resize/自身尺寸变化重测、同样的
		*     「pointerdown 落在触发器与面板之外即关闭」。这些不是随手写的——那边
		*     2.12.0/2.13.0 的客户端加载失败与面板位置错乱都留下了记录，这里直接
		*     采用其最终结论。
		*
		* Implemented locally rather than imported from
		* `@deepseek-ai/dsh-client-ui-primitives`. The shell DOES register that package
		* for plugin bundles, so importing it is legal — this is a deliberate choice,
		* not a workaround: the two behaviours are ~40 lines of DOM geometry, and owning
		* them keeps this component renderable in the Node test suite without mocking a
		* package that itself reaches `*.module.css` and further DSH dependencies.
		*
		* @module dsh-connect-qoder/client/popover
		*/
		/**
		* Clearance to keep from the top of the viewport.
		*
		* The shell reserves a strip at the top of the frame
		* (`--dsh-frame-top-clearance`) for the window chrome, so a panel clamped to
		* `margin` alone can still land under it.
		*/
		function overlayTopMargin(min) {
			if (typeof document === "undefined") return min;
			const root = document.documentElement;
			const clearance = Number.parseFloat(getComputedStyle(root).getPropertyValue("--dsh-frame-top-clearance"));
			if (Number.isNaN(clearance)) return min;
			return Math.max(min, (root.hasAttribute("data-fullscreen") ? 0 : clearance) + 20);
		}
		/** Keep a `position: fixed` floating element anchored to a trigger. */
		function useAnchoredPosition(options) {
			const { open, anchorRef, panelRef, side = "bottom", align = "start", gap, margin } = options;
			const [position, setPosition] = (0, react.useState)(null);
			(0, react.useLayoutEffect)(() => {
				if (!open) {
					setPosition(null);
					return;
				}
				const place = () => {
					const rect = anchorRef.current?.getBoundingClientRect();
					if (rect === void 0) return;
					const panel = panelRef.current;
					const width = panel?.offsetWidth ?? 0;
					const height = panel?.offsetHeight ?? 0;
					let left = align === "end" ? rect.right - width : rect.left;
					let top = side === "top" ? rect.top - gap - height : rect.bottom + gap;
					if (width > 0) left = Math.min(Math.max(left, margin), window.innerWidth - width - margin);
					if (height > 0) top = Math.min(Math.max(top, overlayTopMargin(margin)), window.innerHeight - height - margin);
					setPosition({
						left,
						top
					});
				};
				place();
				window.addEventListener("scroll", place, true);
				window.addEventListener("resize", place);
				const panel = panelRef.current;
				let observer = null;
				if (typeof ResizeObserver !== "undefined" && panel !== null) {
					observer = new ResizeObserver(place);
					observer.observe(panel);
				}
				return () => {
					observer?.disconnect();
					window.removeEventListener("scroll", place, true);
					window.removeEventListener("resize", place);
				};
			}, [
				open,
				anchorRef,
				panelRef,
				side,
				align,
				gap,
				margin
			]);
			return position;
		}
		/**
		* Close an open popover when a pointerdown lands outside it.
		*
		* `portal` counts as inside: the panel is portaled to `document.body`, so it is
		* not a descendant of `root` and a click on the panel itself would otherwise
		* read as "outside" and dismiss the popover the user is trying to use.
		*/
		function useDismissOnOutsidePointer(root, open, setOpen, portal) {
			(0, react.useEffect)(() => {
				if (!open) return void 0;
				const closeOutside = (event) => {
					if (event.target instanceof Node && root.current?.contains(event.target) !== true && portal?.current?.contains(event.target) !== true) setOpen(false);
				};
				document.addEventListener("pointerdown", closeOutside);
				return () => {
					document.removeEventListener("pointerdown", closeOutside);
				};
			}, [
				root,
				open,
				setOpen,
				portal
			]);
		}
		//#endregion
		//#region src/client/ComposerCredits.tsx
		/**
		* Credit readout for the composer row (`conversation.input.right`, rendered
		* immediately before the model picker).
		*
		* 参考：dingminhua/dsh-connect-workbuddy（MIT，Copyright (c) 2026 LaoDing）
		*   — `ComposerCredits.tsx`：读数形态（`<区域> · <余额>`）、点击弹出锚定面板、
		*     面板内是**账号表格**（点行即切换账号）、刷新按钮放在面板里而不是读数上、
		*     每账号读数**只在面板打开时抓**、可配的自动刷新定时器（`pollMinutes`，默认 5 分钟）、失败保留上次数值。
		* 改动：按 Qoder 适配——provider 路由是 `qoder` / `qoder-global`，读数标注为
		*   「QD CN」/「QD AI」；`QODER_ACCOUNT_CREDITS_PATH` 直接返回 `QoderWebAccountCredit[]`
		*   数组（而非 `{accounts}` 包裹）；账号选择写在 `regions.<region>.accountId`，
		*   变更走共享的 `writeAccountSlot`。
		*
		* Shows the selected region's general credit balance, but ONLY while the
		* session's selected model belongs to this plugin (the gate decides that).
		*
		* @module dsh-connect-qoder/client/ComposerCredits
		*/
		/**
		* Inject the readout's styles into the document head, once, on module load.
		*
		* Same idempotent pattern as the card's injection: the classes are attached to
		* DOM this component owns, and `QODER_CARD_CSS` only loads when the settings
		* card does — which is not guaranteed on a host where the card is never rendered.
		*
		* The sheet is **refreshed in place**, not appended only when absent. The Host
		* rebuilds this bundle and re-imports it, which re-runs this code; with an
		* append-only sheet the browser would keep the very first version of the
		* stylesheet for the rest of the session. That is precisely what left this
		* plugin's "Settings" button rendering with the browser's default button
		* chrome while the CSS on disk already carried the intended pill styling.
		*/
		installPluginStyle("dsh-connect-qoder/composer-credits.css", QODER_COMPOSER_CSS);
		/**
		* Provider routes whose credit balance this readout can show, mapped to the
		* region to read it from. Mirrors `QODER_PROVIDERS` on the host side; duplicated
		* here because the client bundle must not import the host entry.
		*/
		const QODER_COMPOSER_PROVIDERS = {
			"qoder": "cn",
			"qoder-global": "global"
		};
		/** The credit total out of one usage document, or undefined. */
		function creditsOf(usage) {
			if (usage.status !== "signed-in") return void 0;
			return usage.credits?.total;
		}
		/** Group the digits so a four-figure balance stays readable in a narrow row. */
		function formatCredits(value) {
			return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
		}
		/**
		* A same-day instant, as the READER's locale writes it.
		*
		* The locale is `undefined` — the reader's, not a fixed one — so an English UI
		* shows `11:59 PM` rather than the Chinese convention's `23:59`. It used to
		* hardcode `'zh-CN'`, which meant the English interface printed a Chinese-style
		* time. Ported from dsh-connect-trae (issue #71).
		*
		* Only for instants that are the same day as the reader: a bare clock time on
		* a timestamp from another day is a different question (and a different
		* design), which is why this is not reused for anything but "now".
		*/
		function formatClock(value) {
			return new Date(value).toLocaleTimeString(void 0, {
				hour: "2-digit",
				minute: "2-digit"
			});
		}
		/**
		* A calendar date in the reader's locale — for an expiry, which is usually not
		* today.
		*
		* Separate from {@link formatClock} on purpose: a bare `11:59 PM` on a package
		* that expires next week reads as tonight. The expiry of an exclusive credit
		* package is a date the user plans around, so it gets its own format.
		*/
		function formatDay(value) {
			return new Date(value).toLocaleDateString(void 0, {
				year: "numeric",
				month: "2-digit",
				day: "2-digit"
			});
		}
		/**
		* 上游给的双语文案按**界面语言**挑一侧（issue #38）。
		*
		* 语言信号复用 `promo-badge.ts` 的 `hostLanguage(t)`：宿主绑定好的 `t` 是这里
		* 唯一能读到的界面语言（浏览器语言不会跟着 DSH 的语言设置变，只看
		* `navigator.language` 会出现「中文界面配英文表头」）。
		*
		* 只在下发的那一侧缺席时退回另一侧 —— 两条都是上游自己的话，不是我们翻译的，
		* 所以「退回」不是降级，只是换了上游给的另一种说法。
		*/
		function localizedLabel(label, english) {
			if (label === void 0) return void 0;
			return english ? label.en ?? label.zh : label.zh ?? label.en;
		}
		function ComposerCredits(props) {
			const { t, provider, region, settingsScope, openSettings } = props;
			if (t === void 0) throw new Error("Composer credits readout requires its translation function");
			const owned = provider === void 0 ? void 0 : QODER_COMPOSER_PROVIDERS[provider];
			const activeRegion = region ?? owned;
			const [usage, setUsage] = (0, react.useState)(void 0);
			const [accountCredits, setAccountCredits] = (0, react.useState)(void 0);
			const [busy, setBusy] = (0, react.useState)(false);
			const [switchingId, setSwitchingId] = (0, react.useState)(void 0);
			const [failed, setFailed] = (0, react.useState)(false);
			const [lastRefresh, setLastRefresh] = (0, react.useState)(void 0);
			const [open, setOpen] = (0, react.useState)(false);
			/** A pool batch (probe every member) is in flight. */
			const [testing, setTesting] = (0, react.useState)(false);
			/** The last pool batch failed to start. */
			const [testFailed, setTestFailed] = (0, react.useState)(false);
			const inFlight = (0, react.useRef)(false);
			const mounted = (0, react.useRef)(true);
			const rootRef = (0, react.useRef)(null);
			const panelRef = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				mounted.current = true;
				return () => {
					mounted.current = false;
				};
			}, []);
			const position = useAnchoredPosition({
				open: open && activeRegion !== void 0,
				anchorRef: rootRef,
				panelRef,
				side: "top",
				gap: 8,
				margin: 12
			});
			useDismissOnOutsidePointer(rootRef, open, setOpen, panelRef);
			const fetchUsage = (0, react.useCallback)(async (signal) => {
				if (inFlight.current || activeRegion === void 0) return;
				inFlight.current = true;
				if (mounted.current) setBusy(true);
				try {
					const response = await fetch(withQoderRegion(QODER_USAGE_PATH, activeRegion), {
						headers: { accept: "application/json" },
						credentials: "same-origin",
						...signal === void 0 ? {} : { signal }
					});
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
					const value = await response.json();
					if (!mounted.current || signal?.aborted === true) return;
					setUsage(value);
					setLastRefresh(Date.now());
					setFailed(false);
				} catch {
					if (mounted.current && signal?.aborted !== true) setFailed(true);
				} finally {
					inFlight.current = false;
					if (mounted.current) setBusy(false);
				}
			}, [activeRegion]);
			/**
			* Every account's balance in the region — one upstream read per account.
			* Paid only while the panel is open. On failure keep the previous rows.
			*/
			const fetchAccountCredits = (0, react.useCallback)(async (signal) => {
				if (activeRegion === void 0) return;
				try {
					const response = await fetch(withQoderRegion(QODER_ACCOUNT_CREDITS_PATH, activeRegion), {
						headers: { accept: "application/json" },
						credentials: "same-origin",
						...signal === void 0 ? {} : { signal }
					});
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
					const data = await response.json();
					if (!mounted.current || signal?.aborted === true) return;
					if (Array.isArray(data)) setAccountCredits(data);
				} catch {}
			}, [activeRegion]);
			/**
			* 本会话的刷新节奏（毫秒），活读设置镜像。
			*
			* 与卡片同一条规则、同一个字段：一个全局节奏管住所有打上游的自动读。镜像读不到
			* （老宿主、单测）时退回 {@link COMPOSER_CREDITS_REFRESH_INTERVAL_MS} —— 那正是
			* 这个读数在这个设置存在之前的间隔，所以「读不到」与「没改过」在屏幕上同形。
			*/
			const pollIntervalMs = pollMinutesOf(settingsScope?.getSnapshot().value) * 6e4;
			(0, react.useEffect)(() => {
				if (owned === void 0) return void 0;
				let cancelled = false;
				let timer;
				const controller = new AbortController();
				fetchUsage(controller.signal).finally(() => {
					if (cancelled) return;
					timer = window.setInterval(() => {
						fetchUsage(controller.signal);
					}, pollIntervalMs);
				});
				return () => {
					cancelled = true;
					if (timer !== void 0) window.clearInterval(timer);
					controller.abort();
				};
			}, [
				owned,
				fetchUsage,
				pollIntervalMs
			]);
			(0, react.useEffect)(() => {
				if (!open || activeRegion === void 0) return void 0;
				const controller = new AbortController();
				fetchAccountCredits(controller.signal);
				return () => {
					controller.abort();
				};
			}, [
				open,
				activeRegion,
				fetchAccountCredits
			]);
			(0, react.useEffect)(() => {
				if (!open) return void 0;
				const onKeyDown = (event) => {
					if (event.key === "Escape") setOpen(false);
				};
				document.addEventListener("keydown", onKeyDown);
				return () => {
					document.removeEventListener("keydown", onKeyDown);
				};
			}, [open]);
			const switchTo = async (accountId) => {
				if (settingsScope === void 0) return;
				if (activeRegion === void 0 || switchingId !== void 0) return;
				if (accountId === (accountCredits?.find((account) => account.selected)?.id ?? (usage?.status === "signed-in" ? usage.accountId : void 0))) return;
				setSwitchingId(accountId);
				setFailed(false);
				try {
					await writeAccountSlot(settingsScope, activeRegion, accountId);
					await fetchUsage();
					await fetchAccountCredits();
				} catch {
					if (mounted.current) setFailed(true);
				} finally {
					if (mounted.current) setSwitchingId(void 0);
				}
			};
			/**
			* 「刷新」：把玩家池里的每个成员真跑一次探针。
			*
			* 面板回答的是「谁在服务、还剩多少」，而圆点与第二行的原因（被拒绝／用量
			* 达上限／限流 · 约 N 分钟后解禁）全部来自**探针结论**——只读余额读不出
			* 「还能不能用」。所以这颗按钮真正该做的是重测一遍：探针写回宿主快照之后，
			* 颜色与原因才是刚测出来的，而不是打开面板那一刻的旧账。
			*
			* 走的是设置页账号池工具栏那条**同一条**路（`POST /pool?action=test`），
			* 不另造一条：两条路测出来的结论必须一致，否则同一个号在两处显示不同。
			*
			* 批量是**串行**的真实探针（一个号十几秒到几十秒），因此不干等整批响应：
			* 边跑边读宿主的**只读**进度（`action=progress`，不碰上游），每落一行就把
			* 账号表重取一次，用户能看着圆点一行一行翻新。整批结束（成功或失败）后再补
			* 最后一读 —— 成败都补：失败时探针可能已经落了一部分，至少别让表格停在
			* 测试前的旧账上。
			*/
			const runTestAll = async () => {
				if (activeRegion === void 0 || testing || busy || switchingId !== void 0) return;
				setTesting(true);
				setTestFailed(false);
				setFailed(false);
				let cursor = 0;
				const pull = async () => {
					if (activeRegion === void 0) return;
					try {
						const response = await fetch(withQoderRegionAndAction(QODER_POOL_PATH, activeRegion, "progress"), { credentials: "same-origin" });
						if (!response.ok) return;
						const batch = (await response.json().catch(() => ({})))["batch"];
						if (typeof batch !== "object" || batch === null) return;
						const entry = batch;
						if (entry["action"] !== "test" || !Array.isArray(entry["done"])) return;
						const done = entry["done"];
						if (done.length <= cursor) return;
						cursor = done.length;
						await fetchAccountCredits();
					} catch {}
				};
				let timer;
				try {
					timer = window.setInterval(() => {
						pull();
					}, 1500);
					const response = await fetch(withQoderRouteAction(QODER_POOL_PATH, activeRegion, "test"), {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						credentials: "same-origin"
					});
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
				} catch {
					if (mounted.current) setTestFailed(true);
				} finally {
					if (timer !== void 0) window.clearInterval(timer);
					await fetchAccountCredits();
					if (mounted.current) setTesting(false);
				}
			};
			if (owned === void 0) return null;
			const signedIn = usage?.status === "signed-in" ? usage : void 0;
			/**
			* 文档级总额：**这份文档是用哪个号读上来的**，就是哪个号的余额 —— 也就是
			* 第一发目标（选中号）的余额。它不等于「此刻在计费的号」的余额，见 `total`。
			*/
			const docTotal = signedIn === void 0 ? void 0 : creditsOf(signedIn);
			const signedOut = usage !== void 0 && usage.status === "signed-out";
			const label = t(activeRegion === "cn" ? "composer.pointsCn" : "composer.pointsGlobal");
			const selectedId = accountCredits?.find((account) => account.selected)?.id ?? (signedIn === void 0 ? void 0 : signedIn.accountId);
			/**
			* 此刻**真正在计费**的账号 —— 与面板「当前选用」同一条判据（表格的 `current`
			* 来自 `accountCreditsOf`、池视图的 `current` 来自 `web-status`，两者都与
			* `src/shim.ts` 的请求路径逐字同判）。两者都缺席（旧宿主 / 池关）时退回选中号：
			* 没有接管机制时第一发确实是它。
			*/
			const billingId = accountCredits?.find((account) => account.current === true)?.id ?? signedIn?.pool?.accounts.find((account) => account.current === true)?.accountId ?? selectedId;
			const billingName = accountCredits?.find((account) => account.id === billingId)?.accountName ?? signedIn?.pool?.accounts.find((account) => account.accountId === billingId)?.accountName ?? (signedIn !== void 0 && signedIn.accountId === billingId ? signedIn.accountName : void 0);
			const total = accountCredits?.find((account) => account.id === billingId)?.credits ?? signedIn?.pool?.accounts.find((account) => account.accountId === billingId)?.credits ?? (billingId === signedIn?.accountId ? docTotal : void 0);
			const valueText = total === void 0 ? "—" : formatCredits(total);
			/** 悬停说清这个数字是谁的：接管发生时，光看「QD AI · 100」不知道 100 归谁。 */
			const billingTitle = billingName === void 0 ? void 0 : t("composer.billingAccount", { name: billingName });
			const rows = (accountCredits ?? (signedIn === void 0 ? [] : signedIn.accounts.map((account) => ({
				id: account.id,
				accountName: account.accountName,
				selected: account.selected
			})))).map((row) => {
				if (row.id !== selectedId || row.credits !== void 0 || docTotal === void 0) return row;
				return {
					...row,
					credits: docTotal
				};
			});
			const canSwitch = settingsScope !== void 0;
			const poolTestable = ((signedIn?.pool?.effectiveMemberAccountIds ?? signedIn?.pool?.memberAccountIds)?.length ?? 0) > 0;
			/**
			* 专属积分包那一列（issue #38）在**这一张表里**到底要不要画。
			*
			* 判据只有一条：**有没有哪一行真的带 `dedicated`**。不能按区域判（国内版实测
			* 没有这个字段，但那是上游的现状、不是契约），也不能按「这份文档是国际版」判
			* —— 面板列的是逐号读数，可能混着两个来源。没有专属包时整列（连 `th` 一起）
			* 不渲染，于是国内版与没有专属包的用户看到的仍是原来那两列。
			*/
			const dedicatedShown = rows.some((row) => (row.dedicated?.length ?? 0) > 0);
			/** 界面是否英文 —— 只用来挑上游双语标题/描述里的哪一侧。 */
			const english = hostLanguage(t).toLowerCase().startsWith("en");
			/**
			* 一行的专属积分读数（主列 + 悬停）。
			*
			* **主列只显示「主包自己的余额 + 溢出标记」，绝不再把多个包相加**（issue #43）。
			* issue #38 当时在「合计 / 按包分行」之间选了合计，但那个决定建立在「多个同类
			* 的包」的假设上。实测上游会下发**用途不同**的包（SOTA 专属 1960 绑 Sonus、
			* 极致专属 500 绑另一个模型），两笔钱各绑各的模型、不能互换 —— 它们相加出来的
			* 2460 不对应任何能花出去的额度：选 Sonus 时超出 1960 的部分会掉回通用积分。
			* 「一个数字必须对应一件真事」，所以主列取第一个包（主包）的真实余额，后面跟
			* `+N` 表示还有 N 个别的包，逐包明细进悬停。
			*
			* 不按「按包分行」是为了保住 issue #38 的宽度预算：这一列只有 56px，一个账号
			* 占三四行会挤掉别的账号；`+N` 把宽度控制在「四位数 + 两字符」以内，同时不让
			* 数字撒谎。
			*/
			const dedicatedOf = (packages) => {
				if (packages === void 0 || packages.length === 0) return void 0;
				const primary = packages.find((entry) => entry.remaining !== void 0);
				const lines = [];
				for (const entry of packages) {
					const name = localizedLabel(entry.title, english) ?? t("composer.dedicated");
					const hint = localizedLabel(entry.description, english) ?? t("composer.dedicatedHint");
					const amount = entry.remaining === void 0 ? "—" : formatCredits(entry.remaining);
					const expires = entry.expiresAtMs === void 0 ? "" : ` · ${t("composer.dedicatedExpires", { time: formatDay(entry.expiresAtMs) })}`;
					lines.push(`${name}: ${amount}${expires} — ${hint}`);
				}
				if (packages.length > 1) lines.unshift(t("composer.dedicatedMultiple", { count: packages.length }));
				const primaryText = primary === void 0 ? "—" : formatCredits(primary.remaining ?? 0);
				const overflow = packages.length - 1;
				return {
					text: primaryText + (overflow > 0 ? `+${overflow}` : ""),
					title: lines.join("\n")
				};
			};
			/**
			* 这一列表头的文字：优先**上游自己的话**（`title` 的当前语言那一侧）。
			*
			* 上游在 `displayLabels` 里已经给了「SOTA 专属积分 / SOTA Exclusive Credits」，
			* 而这是个营销词、不是术语 —— 自己再写一份译文只会在上游改词时落后。字典里
			* 那条 `composer.dedicated` 只是上游没下发标题时的兜底，不是主文案。
			*/
			const dedicatedHeader = (() => {
				for (const row of rows) for (const entry of row.dedicated ?? []) {
					const label = localizedLabel(entry.title, english);
					if (label !== void 0) return label;
				}
				return t("composer.dedicated");
			})();
			/**
			* 页脚显示的时刻：优先用**数据的真实读取时刻**（宿主给的 `creditsAtMs`），
			* 没有才退回本组件 fetch 成功的时刻。
			*
			* 此前只有后者，于是刷新失败时页脚时间照样往前走 —— 数字是旧的、时间显示
			* 刚刚，用户无从判断哪个能信（截图里的 800 正是这样看起来像「刚刷新的」）。
			*/
			const displayedAt = signedIn?.creditsAtMs ?? lastRefresh;
			/** 显示的数字比最近一次 fetch 更老 = 这次没刷出新数据。 */
			const staleDisplay = signedIn?.creditsAtMs !== void 0 && lastRefresh !== void 0 && signedIn.creditsAtMs < lastRefresh - 5e3;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				ref: rootRef,
				className: "dsm-qoder-composer-credits",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: "dsm-qoder-composer-credits-trigger",
					"aria-haspopup": "dialog",
					"aria-expanded": open,
					onClick: () => {
						setOpen(!open);
					},
					...billingTitle === void 0 ? {} : { title: billingTitle },
					children: [
						label,
						" · ",
						valueText
					]
				}), open && (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					ref: panelRef,
					className: dedicatedShown ? "dsm-qoder-composer-panel dsm-qoder-composer-panel-wide" : "dsm-qoder-composer-panel",
					style: position ?? {
						visibility: "hidden",
						left: 0,
						top: 0
					},
					role: "dialog",
					"aria-label": t("composer.panelTitle"),
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsm-qoder-composer-panel-head",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dsm-qoder-composer-panel-title",
								children: t(activeRegion === "cn" ? "composer.panelTitleCn" : "composer.panelTitleGlobal")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "dsm-qoder-composer-panel-actions",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									className: "dsm-qoder-composer-panel-refresh",
									disabled: testing || busy || switchingId !== void 0 || !poolTestable,
									title: t("composer.refreshHint"),
									"aria-label": t("composer.refreshHint"),
									onClick: () => {
										runTestAll();
									},
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
										className: testing ? "dsm-qoder-composer-panel-refresh-icon dsm-qoder-composer-panel-refresh-icon-spin" : "dsm-qoder-composer-panel-refresh-icon",
										viewBox: "0 0 16 16",
										width: "12",
										height: "12",
										fill: "none",
										"aria-hidden": "true",
										focusable: "false",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
											d: "M13.3 8a5.3 5.3 0 1 1-1.55-3.75",
											stroke: "currentColor",
											strokeWidth: "1.5",
											strokeLinecap: "round"
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
											d: "M13.4 2.2v2.9h-2.9",
											stroke: "currentColor",
											strokeWidth: "1.5",
											strokeLinecap: "round",
											strokeLinejoin: "round"
										})]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsm-qoder-composer-panel-refresh-label",
										children: testing ? t("composer.refreshing") : t("composer.refresh")
									})]
								}), openSettings === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									className: "dsm-qoder-composer-panel-settings",
									title: t("composer.openSettingsHint"),
									onClick: () => {
										setOpen(false);
										openSettings();
									},
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
										className: "dsm-qoder-composer-panel-settings-icon",
										viewBox: "0 0 16 16",
										width: "12",
										height: "12",
										fill: "none",
										"aria-hidden": "true",
										focusable: "false",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
											d: "M8 10.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4Z",
											stroke: "currentColor",
											strokeWidth: "1.5"
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
											d: "M12.9 9.6a1.2 1.2 0 0 0 .24 1.32l.04.04a1.4 1.4 0 1 1-1.98 1.98l-.04-.04a1.2 1.2 0 0 0-1.32-.24 1.2 1.2 0 0 0-.72 1.1v.12a1.4 1.4 0 1 1-2.8 0v-.07a1.2 1.2 0 0 0-.78-1.1 1.2 1.2 0 0 0-1.32.24l-.04.04a1.4 1.4 0 1 1-1.98-1.98l.04-.04a1.2 1.2 0 0 0 .24-1.32 1.2 1.2 0 0 0-1.1-.72h-.12a1.4 1.4 0 1 1 0-2.8h.07a1.2 1.2 0 0 0 1.1-.78 1.2 1.2 0 0 0-.24-1.32l-.04-.04a1.4 1.4 0 1 1 1.98-1.98l.04.04a1.2 1.2 0 0 0 1.32.24h.05a1.2 1.2 0 0 0 .72-1.1v-.12a1.4 1.4 0 1 1 2.8 0v.07a1.2 1.2 0 0 0 .72 1.1 1.2 1.2 0 0 0 1.32-.24l.04-.04a1.4 1.4 0 1 1 1.98 1.98l-.04.04a1.2 1.2 0 0 0-.24 1.32v.05a1.2 1.2 0 0 0 1.1.72h.12a1.4 1.4 0 1 1 0 2.8h-.07a1.2 1.2 0 0 0-1.1.72Z",
											stroke: "currentColor",
											strokeWidth: "1.5",
											strokeLinecap: "round",
											strokeLinejoin: "round"
										})]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsm-qoder-composer-panel-settings-label",
										children: t("composer.openSettings")
									})]
								})]
							})]
						}),
						signedOut ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dsm-qoder-composer-panel-empty",
							children: t("composer.signedOut")
						}) : rows.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dsm-qoder-composer-panel-empty",
							children: t("composer.noAccounts")
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("table", {
							className: "dsm-qoder-composer-panel-table",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
									scope: "col",
									children: t("composer.account")
								}),
								dedicatedShown ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
									scope: "col",
									className: "dsm-qoder-composer-panel-num dsm-qoder-composer-panel-dedicated",
									children: dedicatedHeader
								}) : null,
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
									scope: "col",
									className: "dsm-qoder-composer-panel-num",
									children: t("composer.credits")
								})
							] }) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("tbody", { children: rows.map((row) => {
								const current = row.current ?? row.id === selectedId;
								const excluded = exclusionText(t, row.excludedBy, row.retryAtMs, Date.now(), row.retrySource);
								const mark = excluded ?? (current ? t("composer.currentPick") : void 0);
								/** 这一行的专属积分读数（合计 + 悬停）；没有包时 `undefined`。 */
								const rowDedicated = dedicatedOf(row.dedicated);
								const dotColor = accountStateColor(accountStateTone({
									...row.excludedBy === void 0 ? {} : { excludedBy: row.excludedBy },
									...row.probeOutcome === void 0 ? {} : { probeOutcome: row.probeOutcome }
								}));
								return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", {
									className: current ? "dsm-qoder-composer-panel-row-current" : void 0,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
											scope: "row",
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
												type: "button",
												className: "dsm-qoder-composer-panel-switch",
												disabled: !canSwitch || switchingId !== void 0 || current,
												"aria-label": t("composer.switchTo", { account: row.accountName }),
												onClick: () => {
													switchTo(row.id);
												},
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dsm-qoder-composer-panel-dot",
													style: { background: dotColor },
													"aria-hidden": "true"
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
													className: "dsm-qoder-composer-panel-who",
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "dsm-qoder-composer-panel-name",
														title: row.accountName,
														children: row.accountName
													}), mark === void 0 ? null : excluded === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "dsm-qoder-composer-panel-pick",
														children: mark
													}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "dsm-qoder-composer-panel-mark",
														title: mark,
														children: mark
													})]
												})]
											})
										}),
										dedicatedShown ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
											className: "dsm-qoder-composer-panel-num dsm-qoder-composer-panel-dedicated",
											children: rowDedicated === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "dsm-qoder-composer-panel-none",
												children: "—"
											}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												title: rowDedicated.title,
												children: rowDedicated.text
											})
										}) : null,
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
											className: "dsm-qoder-composer-panel-num",
											children: row.credits === void 0 ? "—" : formatCredits(row.credits)
										})
									]
								}, row.id);
							}) })]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dsm-qoder-composer-panel-foot",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
								t("composer.lastRefresh"),
								" ",
								displayedAt === void 0 ? "—" : formatClock(displayedAt),
								staleDisplay ? ` · ${t("composer.dataStale")}` : ""
							] })
						}),
						failed || signedIn?.refreshError !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dsm-qoder-composer-panel-error",
							role: "status",
							children: t("composer.refreshFailed")
						}) : null,
						testFailed ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dsm-qoder-composer-panel-error",
							role: "status",
							children: t("composer.refreshAccountsFailed")
						}) : null
					]
				}), document.body)]
			});
		}
		//#endregion
		//#region src/client/ComposerCreditsGate.tsx
		/**
		* Decides whether the composer credit readout belongs in this session, by
		* reading the Host's own `modelSelection` projection and the plugin's
		* per-region `showCreditsInMainUi` switch.
		*
		* 参考：dingminhua/dsh-connect-workbuddy（MIT，Copyright (c) 2026 LaoDing）
		*   — 该项目的 `client/ComposerCreditsGate.tsx`：从 `modelSelection` 投影读
		*     「本会话当前用哪个 provider」来决定要不要渲染，以及 `next` 优先于
		*     `lastUsed` 的判定。这是本项目把积分读数放到输入框的核心机制。
		*
		* WHY the projection rather than this plugin's own state: the projection is what
		* the model picker writes and what the next request will use, so the readout
		* cannot disagree with the model actually in effect. `next` outranks `lastUsed`.
		*
		* Kept separate from {@link ComposerCredits} (and from the browser-plugin entry)
		* so the decision can be unit-tested without a Host.
		*/
		/** The provider route the session is currently pointed at. */
		function selectedProviderOf(projection) {
			const provider = (projection?.next ?? projection?.lastUsed)?.provider;
			return typeof provider === "string" && provider !== "" ? provider : void 0;
		}
		/**
		* The settings tree this plugin writes, unwrapped to a plain object.
		*
		* `unwrapVolatileDeep` first: the scope's value is a live cosmokit reference,
		* and reading fields off it without unwrapping yields proxies whose `===`
		* comparison against a string is false.
		*/
		function scopeValueOf(scope) {
			return scope === void 0 ? void 0 : unwrapVolatileDeep(scope.getSnapshot().value);
		}
		/**
		* Which region's readout this session should show, or undefined for none.
		*
		* One regime only: the session's model must be **this plugin's** (`provider`
		* maps to a region), and that region's shown/enabled switches must both pass.
		* A provider belonging to another connector renders nothing here —— 本插件不做
		* 插件之间的联动，别的连接器当家时不去猜、也不去替它显示本插件的读数
		* （见 docs/DESIGN.md「边界：不做什么」）。
		*/
		function composerCreditsRegionOf(projection, scope) {
			const provider = selectedProviderOf(projection);
			const region = provider === void 0 ? void 0 : QODER_COMPOSER_PROVIDERS[provider];
			if (region === void 0) return void 0;
			const value = scopeValueOf(scope);
			if (!regionCreditsShownOf(value, region)) return void 0;
			if (!regionEnabledOf(value, region)) return void 0;
			return region;
		}
		function ComposerCreditsGate(props) {
			const { t, position, settingsScope, useProjection, openSettings } = props;
			const [, setRevision] = (0, react.useState)(0);
			(0, react.useEffect)(() => {
				if (settingsScope?.getSnapshot === void 0) return void 0;
				return subscribeScope(settingsScope, setRevision);
			}, [settingsScope]);
			const projection = useProjection === void 0 ? void 0 : useProjection("modelSelection");
			const region = composerCreditsRegionOf(projection, settingsScope);
			if (region === void 0) return null;
			if (regionCreditPositionOf(scopeValueOf(settingsScope), region) !== (position ?? "composer")) return null;
			const provider = selectedProviderOf(projection);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ComposerCredits, {
				t,
				...provider === void 0 ? {} : { provider },
				region,
				...settingsScope === void 0 ? {} : { settingsScope },
				...openSettings === void 0 ? {} : { openSettings }
			});
		}
		function subscribeScope(scope, setRevision) {
			return scope.subscribe === void 0 ? void 0 : scope.subscribe(() => {
				setRevision((value) => value + 1);
			});
		}
		//#endregion
		//#region src/client/host-badge.tsx
		/**
		* 宿主那枚 `Tag` 的四档配色，逐条抄自 `Tag.module.css`（0.2.2-rc.1）。
		*
		* 两个最容易抄错的地方：`info` 用的是 `state-business-primary` 而**不是**
		* `brand-primary`；`warning` 用的是 `state-warn-primary` 而**不是**
		* `state-warn-secondary`。抄错了，同一行里两颗胶囊的颜色就对不上。
		*
		* 宿主那颗**没有描边**，所以这里也不加。
		*/
		const HOST_BADGE_TONES = {
			neutral: {
				color: "var(--dsw-alias-label-secondary)",
				background: "var(--dsw-alias-bg-module-platform)"
			},
			info: {
				color: "var(--dsw-alias-state-business-primary)",
				background: "color-mix(in srgb, var(--dsw-alias-state-business-primary) 10%, transparent)"
			},
			success: {
				color: "var(--dsw-alias-state-success-primary)",
				background: "color-mix(in srgb, var(--dsw-alias-state-success-primary) 10%, transparent)"
			},
			warning: {
				color: "var(--dsw-alias-state-warn-primary)",
				background: "color-mix(in srgb, var(--dsw-alias-state-warn-primary) 12%, transparent)"
			}
		};
		/** 认不出来的 tone 按 `neutral` 画：旧宿主与未来新增的 tone 都可能落到这一支。 */
		function hostBadgePaint(tone) {
			return HOST_BADGE_TONES[tone] ?? HOST_BADGE_TONES.neutral;
		}
		/**
		* 胶囊上那一行字，取读者语言。
		*
		* 查找顺序与宿主的 `resolveText` 同规：当前语言 → 它的基语言（`de-DE` → `de`）
		* → `en`（宿主契约里的必填兜底）。空串与缺席等价：这是本插件加的判断，比宿主
		* 更严，目的只是不画一颗没有字的胶囊。
		*
		* @param text - 上游/别家写进 `badge.text` 的东西；读不懂就返回 `undefined`。
		* @param language - 界面语言（见 `hostLanguage`）。
		*/
		function resolveHostBadgeText(text, language) {
			if (typeof text === "string") return text.trim() === "" ? void 0 : text;
			if (text === null || typeof text !== "object" || Array.isArray(text)) return void 0;
			const table = text;
			const read = (key) => {
				const value = table[key];
				return typeof value === "string" && value.trim() !== "" ? value : void 0;
			};
			const lower = language.toLowerCase();
			const base = lower.split("-")[0] ?? "";
			return read(lower) ?? (base === "" ? void 0 : read(base)) ?? read("en");
		}
		/**
		* 这枚 `badge` 能不能画：能画就给出「格式化后的 badge + 那一行字」。
		*
		* 调用方要先知道「画不画」再决定**要不要那个分隔符**：`<Chip/>` 自己可能渲染成
		* `null`，而外面那个空格会留下，于是名字后面挂一个看不见的空白。
		*
		* `tone` 认不出来时按 `neutral` 画（`hostBadgePaint` 的兜底），**不抛、不留白**：
		* 旧宿主或未来新增的 tone 都可能落到这一支。
		*/
		function drawableHostBadge(badge, language) {
			if (badge === null || typeof badge !== "object" || Array.isArray(badge)) return void 0;
			const candidate = badge;
			const label = resolveHostBadgeText(candidate.text, language);
			if (label === void 0) return void 0;
			const tone = typeof candidate.tone === "string" ? candidate.tone : "neutral";
			return {
				badge: {
					text: candidate.text,
					tone
				},
				label
			};
		}
		/** The chip itself, geometrically the host's `Tag` (`padding:1px 8px`, `999px`, 11px). */
		function HostBadgeChip(props) {
			const paint = hostBadgePaint(props.badge.tone);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: "dsm-qoder-model-label-host-badge",
				style: {
					color: paint.color,
					background: paint.background
				},
				children: props.label
			});
		}
		/**
		* 一行别家 provider 的标签：名字 + （有的话）该模型自带的胶囊。
		*
		* `placement === 'trigger'` 时胶囊在前，`menu` / `option` 时在后 —— 这是宿主
		* fallback 的逐字顺序，也是**唯一**一件不能凭偏好决定的事。分隔符就是一个空格，
		* 不用 flex `gap`：宿主 fallback 里写的就是文本空格，两者在窄行里的换行行为不同。
		*
		* 读不到胶囊（没有 / 形状读不懂 / 文案为空）时返回纯名字：那是槽位契约的下限，
		* 也是宿主自己在没有 badge 时画的东西。`model.name` 一个字符都不改 —— 名字是稳定
		* 标识，胶囊是会变的东西，把易变的塞进稳定标识会污染悬停、读屏、搜索排序。
		*/
		function ForeignModelLabel(props) {
			const { model, placement, t } = props;
			const name = model.name;
			const drawable = drawableHostBadge(model.badge, hostLanguage(t));
			if (drawable === void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: name });
			const chip = /* @__PURE__ */ (0, react_jsx_runtime.jsx)(HostBadgeChip, {
				badge: drawable.badge,
				label: drawable.label
			});
			return placement === "trigger" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
				chip,
				" ",
				name
			] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
				name,
				" ",
				chip
			] });
		}
		//#endregion
		//#region src/client/QoderModelLabel.tsx
		/**
		* The HOST's model picker label: the catalog name plus this plugin's badges.
		*
		* 参考：dingminhua/dsh-connect-workbuddy（MIT，Copyright (c) 2026 LaoDing）
		*   —— `WorkBuddyModelLabel.tsx` 的整体形态（WHY A SLOT / WHY THE BADGE
		*   BELONGS HERE AT ALL / 共享分钟时器 / provider→region 映射）沿用自该项目；
		*   徽标复用卡片已有的 `dsm-qoder-model-promo` 家族类，不另造一套视觉。
		*
		* 徽标为什么属于选择器（issue #12，workbuddy 文件头的判断）：选择器才是做选择
		* 的地方，「今晚打折」「免费」都是选择判据；卡片是设置面 —— 读到徽标时模型早
		* 选完了。这不是装饰搬家，是把同一个上游事实挪到它还能改变决定的位置。
		*
		* 与上游的两处有意差异：
		*
		* 1. **组件由工厂产出、按 fiber 捕获 `slots`**（issue #12 报告的补丁用的是模块级
		*    变量，那是真缺陷）：bundle 是单例，宿主若以多个 fiber 各跑一次 `apply`，
		*    后跑的会覆盖前者 —— 外来 provider 的委托就会调到**错误宿主**的注册表。
		*    工厂把 `slots` 关进每次注册各自的闭包，覆盖在结构上不可能。
		* 2. **委托渲染成子元素而不是直接调用**（报告的补丁直接 `other(props)` 调）：
		*    被委托的组件（workbuddy 的标签自己就有 `useState`/`useEffect`）作为函数
		*    调用时，它的 hooks 会混进**我们**的 hook 序列 —— 同一槽位在外来/本插件
		*    provider 之间切换时 hook 数量一变，React 直接崩。`jsx(Other, …)` 让它跑在
		*    自己的 fiber 里，两条路径的 hook 数量与顺序都恒定。
		*
		* ## 三处出口，一条底线
		*
		* 本组件占的是 single 槽，**所有** provider 的行都从这里出去：
		*
		* | 行 | 出口 |
		* | --- | --- |
		* | 本插件的 provider | 自己的标签（名字 + 活动徽标 + 免费标记），见下方 |
		* | 别家 provider，账本里有可委托的组件 | `jsx(Other, ownerProps)`，把对方自己的 `t` 绑好递过去 |
		* | 别家 provider，交不出去 | `ForeignModelLabel`：名字 + 该模型自带的 `model.badge` |
		*
		* 第三条那一格此前是裸名字。`docs/MODEL-LABEL-SPEC.md` §4 的结论是它必须复现
		* 宿主 fallback 的「名字 + 可选胶囊」：我们占了槽，宿主那句 fallback 就再也不会
		* 执行，只画名字等于把别家挂在目录里的胶囊抹掉。委托仍然是首选（它保住了别人的
		* 完整装饰），只是退路不再是「什么都不画」。
		*
		* 底线是这一支**绝不抛、绝不发请求**：它一抛，宿主会把整个组件从那一格摘掉，
		* 整片模型标签换成别家或裸名字。
		*
		* @module dsh-connect-qoder/client/QoderModelLabel
		*/
		/** The slot key（宿主 model-selection 声明的槽，ownerProps 见 `QoderModelLabelProps`）. */
		const QODER_MODEL_LABEL_SLOT = "conversation.input.model.label";
		/**
		* 本插件拥有的每一个 provider id。
		*
		* 导出是因为 keyed 宿主上「一条注册 = 一个 provider」：注册侧需要的清单必须与
		* 组件判定「这行是不是我的」用的是同一份，否则两处字面量迟早漂移。由
		* `QODER_COMPOSER_PROVIDERS` 推导而不是另写一遍——那正是本仓库已经维护的那张表。
		*/
		const QODER_MODEL_LABEL_PROVIDERS = Object.keys(QODER_COMPOSER_PROVIDERS);
		/**
		* 本插件在这个 single 槽上的注册优先级。
		*
		* **必须小于 -100**，那是 workbuddy 的 `MODEL_LABEL_PRIORITY`。宿主的 single 槽
		* 只渲染一条注册，按 priority **升序取首条**（小者先）。所以「排在哪」就是
		* 「能不能被看见」。
		*
		* 为什么非要排在它前面：workbuddy 是**终点型**组件 —— 它的文件头明确写着
		* `does not read the slot ledger, does not look for another plugin's
		* registration, and does not render another plugin's component`，它不会把座位
		* 交还给别人。此前这里是 -1（注释误以为对方用的是默认的 0），于是 workbuddy
		* 稳稳抢在前面，**qoder 的促销胶囊在模型选择器里一次都没显示过**（用户实拍：
		* 卡片里有「错峰 4 折」，选择器里没有）。
		*
		* 取 **-101** 而不是一个大得多的负数：只争一格，把身后的位置留给将来任何正常
		* 的插件。这条优先级只影响「这一行由谁画」，不会动到别人的 provider 行 ——
		* 本组件会把非 qoder 的行委托回去（见 `createQoderModelLabel`）。
		*
		* keyed 宿主上这条数值的含义变了、数值不必变。宿主把槽声明成 `keyed` 后，每条
		* 注册按 provider id 各占一格，priority 不再决定「谁可见」，只剩「同一格内谁先」
		* （两个插件抢同一个 provider id：同值抛错、低者渲染）。于是与 workbuddy 的
		* `-105`、trae 的 `-102` 之间不再有压制关系——**停战不是靠再往下压，是靠换
		* 槽的基数**。`-101` 因此保留为「本插件自己那两格的排序」，既不下探也不改回。
		*/
		const QODER_MODEL_LABEL_PRIORITY = -101;
		/** 一分钟：窗口边界的翻面与快照的保鲜共用它（workbuddy 同规）。 */
		const TICK_MS = 6e4;
		/**
		* 共享分钟时器：挂在选择器上的每一行都是一个组件实例，每行一个 timer 会在打开
		* 的菜单里堆出几十条。这里一个时器广播给所有实例，最后一个退订时关掉。
		* `unref` 防测试进程被它吊着（浏览器里没有这个方法，可选链）。
		*/
		const tickListeners = /* @__PURE__ */ new Set();
		let tickTimer;
		function subscribeMinute(fn) {
			tickListeners.add(fn);
			if (tickTimer === void 0) {
				tickTimer = setInterval(() => {
					for (const listener of [...tickListeners]) listener();
				}, TICK_MS);
				tickTimer.unref?.();
			}
			return () => {
				tickListeners.delete(fn);
				if (tickListeners.size === 0 && tickTimer !== void 0) {
					clearInterval(tickTimer);
					tickTimer = void 0;
				}
			};
		}
		const snapshots = /* @__PURE__ */ new Map();
		const inFlight = /* @__PURE__ */ new Map();
		const SNAPSHOT_TTL_MS = 6e4;
		function freshEnough(region) {
			const hit = snapshots.get(region);
			return hit !== void 0 && Date.now() - hit.atMs < SNAPSHOT_TTL_MS ? hit : void 0;
		}
		function fetchSnapshot(region) {
			const running = inFlight.get(region);
			if (running !== void 0) return running;
			const task = fetch(withQoderRegionFastDetail(QODER_USAGE_PATH, region), {
				headers: { accept: "application/json" },
				credentials: "same-origin"
			}).then(async (response) => {
				if (!response.ok) throw new Error(`HTTP ${response.status}`);
				const value = await response.json();
				const snapshot = value.status === "signed-in" ? {
					models: value.models,
					atMs: Date.now()
				} : void 0;
				if (snapshot !== void 0) snapshots.set(region, snapshot);
				return snapshot;
			}).catch(() => void 0).finally(() => {
				inFlight.delete(region);
			});
			inFlight.set(region, task);
			return task;
		}
		/**
		* 按选择器给来的 id 找 usage 行：先 key，再显示名。
		*
		* 判据与 host 侧 `catalog.keyOf` 同规（宿主把目录的哪一列当 id 不由我们决定），
		* 两列都认才不会静默丢徽标。找不到返回 undefined —— 整行只剩裸名字，不报错。
		*/
		function findUsageRow(models, id) {
			return models?.find((row) => row.key === id || row.name === id);
		}
		/**
		* 活动徽标：卡片那一半的复用 —— 同一个 class、同一个三态、同一句悬停。
		*
		* `live` 实心，`pending` 灰显虚线并前缀「几点生效」，`none` 不画 —— 全部来自
		* `promoDisplayAt`（#11），两个表面永不打架。compact（菜单行比 trigger 窄）
		* 加一个修饰类限宽，徽标文字自己省略号。
		*/
		function QoderModelLabelPromoChip(props) {
			const { promo, language, compact, t } = props;
			const display = promoDisplayAt(promo, /* @__PURE__ */ new Date());
			if (display === "none") return null;
			const label = promoBadgeLabel(promo, language);
			if (label === void 0) return null;
			const pending = display === "pending";
			const start = promo.window?.start;
			if (pending && start === void 0) return null;
			const tip = promoBadgeTooltip(promo, language);
			const title = pending ? [t("row.promoPending", { start }), tip].filter((part) => part !== "").join(" · ") : tip;
			const classes = ["dsm-qoder-model-promo"];
			if (pending) classes.push("dsm-qoder-model-promo-pending");
			if (compact) classes.push("dsm-qoder-model-label-promo");
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: classes.join(" "),
				title: title === "" ? void 0 : title,
				children: label
			});
		}
		/**
		* 产出**本 fiber** 的标签组件。委托（single 槽只有一个座位）的取舍：
		*
		* - 宿主只渲染座位上的第一条注册。workbuddy 的标签（倍率后缀/忙图标）与 1017
		*   参考实现都注册在同一槽的默认优先级；qoder 想给自己的模型加徽标就必须抢在前
		*   面（priority 升序、小者渲染 ⇒ 取 -101，必须小于 workbuddy 的 -100，见
		*   {@link QODER_MODEL_LABEL_PRIORITY}），同时**把外来 provider 原样交还**，
		*   否则别人的标签在我们到场的那一刻集体消失（#12 报告本地实测踩过）。
		* - 交还靠原始账本 `entries()`：`entriesOfSlot()` 对 single 槽去重后只剩第一条
		*   （自己），拿不到别人。
		* - 两个都委托的插件理论上会互相委托成环；当前生态（workbuddy、1017 参考）都是
		*   「渲染裸名」的终点型组件，不成环。真出现互委托时 React 的最大更新深度会拦下
		*   它，宿主把抛错的 entry 一次性弃权（`reportEntryError` ⇒ 下一帧换幸存者），
		*   不会死循环。
		*
		* ## 委托必须把对方**自己命名空间的 `t`** 递过去（issue #23）
		*
		* 宿主对 `t` 的注入是「每个 entry 按自己注册时声明的 `locale`，由框架塞进 kit」
		* （`scoped-slots.tsx` 的 `if (entry.locale !== undefined) kit['t'] = localeSeat(...)`）。
		* 绕过框架直接 `jsx(Other, {...ownerProps})` 就没这个机会，于是：
		*
		* - 对方的组件若**无条件**调用 `t(...)`（宿主内置的 `DeepSeekModelLabel` 正是），
		*   立刻 `TypeError: t is not a function`；
		* - 宿主错误边界接住后**弃权**该 entry，整片 label 槽回退成裸名字 —— 触发按钮、
		*   菜单当前值、每个列表行一起死，用户零信号。
		*
		* 所以这里按 `entry.locale` 用 `ctx.locale.bind(ns)` 替对方绑一个 `t`。**不是**
		* 转发我们自己的 `t`：那会把我们的 `settings.qoder` 字典当成对方的字典用，
		* 对方的 key 查不到就回落成字面键名（`badge.label` 直接画在界面上）。
		*
		* 拿不到 locale 面（`bindLocale` 缺席：单测 / 老宿主）时**不委托**，落回裸名字：
		* 少一枚别家的徽标，好过整片槽被一个 TypeError 打掉。
		*
		* 委托仍然渲染成**子元素**（见文件头第 2 条）：直接函数调用会把对方的 hooks
		* 混进我们的序列，provider 切换时 hook 数量变化直接崩。
		*/
		function createQoderModelLabel(slots) {
			const QoderModelLabel = (props) => {
				const { provider, model, placement, selected, t } = props;
				const region = QODER_COMPOSER_PROVIDERS[provider.id];
				const [snapshot, setSnapshot] = (0, react.useState)(() => region === void 0 ? void 0 : freshEnough(region) ?? snapshots.get(region));
				const [, setTick] = (0, react.useState)(0);
				(0, react.useEffect)(() => {
					if (region === void 0) return void 0;
					let alive = true;
					const apply = (next) => {
						if (alive && next !== void 0) setSnapshot(next);
					};
					if (freshEnough(region) === void 0) fetchSnapshot(region).then(apply);
					const unsubscribe = subscribeMinute(() => {
						setTick((count) => count + 1);
						fetchSnapshot(region).then(apply);
					});
					return () => {
						alive = false;
						unsubscribe();
					};
				}, [region]);
				if (region === void 0) {
					const other = slots.entries(QODER_MODEL_LABEL_SLOT).filter((entry) => entry.component !== QoderModelLabel && typeof entry.component === "function")[0];
					if (other === void 0 || slots.bindLocale === void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ForeignModelLabel, {
						model,
						placement,
						t
					});
					const Other = other.component;
					let otherT;
					if (other.locale !== void 0 && other.locale !== "") try {
						otherT = slots.bindLocale(other.locale);
					} catch {
						return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ForeignModelLabel, {
							model,
							placement,
							t
						});
					}
					return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Other, {
						provider,
						model,
						placement,
						selected,
						...otherT === void 0 ? {} : { t: otherT }
					});
				}
				const compact = placement !== "trigger";
				const row = findUsageRow(snapshot?.models, model.id);
				const language = hostLanguage(t);
				const translate = t ?? ((key, params) => params === void 0 ? key : `${key} ${JSON.stringify(params)}`);
				const promo = row?.promotion === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(QoderModelLabelPromoChip, {
					promo: row.promotion,
					language,
					compact,
					t: translate
				});
				const freeTag = row?.isFree !== true ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dsm-qoder-model-meta-tag",
					title: translate("row.modelFreeHint"),
					children: translate("row.modelFree")
				});
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: compact ? "dsm-qoder-model-label dsm-qoder-model-label-compact" : "dsm-qoder-model-label",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: model.name }),
						promo,
						freeTag
					]
				});
			};
			return QoderModelLabel;
		}
		//#endregion
		//#region src/client/model-label-seat.ts
		/**
		* 读一个槽**实际声明**的 kind；读不出来返回 `undefined`。
		*
		* `spec()` 是文档化的只读访问器（`SlotRegistry.spec`），0.1.7 与 0.2.2 都有。
		* 也是唯一能知道 kind 的途径：声明写在宿主包里，插件自己的 `SlotMap` 增强只
		* 说明本插件**希望**槽是什么，不代表运行中的宿主声明了什么。
		*
		* 任何异常——老宿主没有 `spec`、服务未就绪抛错、出现本构建不认识的 kind——
		* 都返回 `undefined`，调用方落回单格形状。那是保守方向：每个已发布版本本来就是
		* 这么注册的。
		*
		* @param slots - `slots` 服务（类型放宽：访问器是可选的）。
		* @param key - 要检查的槽位 key。
		* @returns 声明出来的 kind，或 `undefined`。
		*/
		function declaredSlotKind(slots, key) {
			const face = slots;
			if (face === void 0 || typeof face.spec !== "function") return void 0;
			let spec;
			try {
				spec = face.spec(key);
			} catch {
				return;
			}
			const kind = spec?.kind;
			if (kind === "single" || kind === "list" || kind === "keyed" || kind === "chain") return kind;
		}
		/**
		* 本插件应该为模型标签槽注册的席位。
		*
		* `keyed` 下每个 provider id 一条：各自一格，各自只画属于那个 provider 的行；
		* 本插件不负责的 provider 落到宿主的 fallback（目录名 + 该模型自带的 badge）。
		*
		* 其余情况——包括 `undefined`（宿主无法被检视）——都是历史上那一条。那不是降级：
		* 那是 `single` 要求的形状，也是 inject 回调即将面对的未声明状态下的形状。
		*
		* keyed 但 provider 列表为空会一条都不注册（标签静默消失，三种失败里最坏的一种），
		* 所以退回单条：形状不对但画得出东西，胜于形状正确但什么都不画。
		*
		* @param params - 槽位 key、声明的 kind、本插件的 provider ids、优先级。
		* @returns 一个或多个 `register()` 选项，按注册顺序。
		*/
		function modelLabelSeats(params) {
			const { name, kind, providerIds, priority } = params;
			if (kind === "list" || kind === "chain") return [];
			if (kind === "keyed" && providerIds.length > 0) return providerIds.map((id) => ({
				name,
				key: id,
				priority
			}));
			return [{
				name,
				priority
			}];
		}
		/**
		* Claim every planned seat, atomically, and hand back ONE disposer.
		*
		* WHY ATOMIC. The seat list is 2-3 entries on a `keyed` host, and `register()`
		* can throw on any ONE of them — a rival plugin claiming the same provider id at
		* the same priority, or the declaration collapsing mid-loop. A plain `.map()`
		* would then leave the earlier seats landed on the ledger with their disposers
		* unreachable (they were only ever held by the array that the throw discarded),
		* which is worse than failing outright: the component stays mounted, the caller
		* believes registration failed, and nothing will ever release those cells. On a
		* `single` host it also means the identity keeps a live entry that the next
		* `inject` re-run cannot displace without a priority clash.
		*
		* So a partial failure is rolled back in reverse order before the error is
		* rethrown, exactly as if it had never been attempted. The rethrow is important:
		* each caller already has a catch that logs, and swallowing here would hide the
		* refusal from the diagnostics that exist to explain it.
		*
		* A disposal that itself throws must not mask the original error, hence the
		* inner catch — the registry treats a second dispose as a no-op, and a broken
		* one must not turn one failure into a crash.
		*
		* @param seats - The plan from {@link modelLabelSeats}, in registration order.
		* @param register - Claims one seat and returns its disposer.
		* @returns One disposer that releases every seat, in reverse registration order.
		*/
		function registerModelLabelSeats(seats, register) {
			const claimed = [];
			try {
				for (const seat of seats) claimed.push(register(seat));
			} catch (error) {
				for (const dispose of [...claimed].reverse()) try {
					dispose();
				} catch {}
				throw error;
			}
			return () => {
				for (const dispose of [...claimed].reverse()) try {
					dispose();
				} catch {}
			};
		}
		const qoderLocales = {
			zh: {
				"row.title": `接入使用 Qoder（通义灵码）积分与模型（${QODER_PACKAGE_NAME}）`,
				"row.desc": "在 DSH 中使用 Qoder（通义灵码 国内/国际）模型并随时查看剩余积分；国内版与国际版是两个独立供应商（qoder / qoder-global），各有自己的 PAT 与账号，可同时使用。",
				"row.expand": "展开",
				"row.collapse": "收起",
				"section.label": "Qoder",
				"section.title": "Qoder（通义灵码）账号、积分与模型",
				"row.tabCn": "国内版",
				"row.tabGlobal": "国际版",
				"row.tabHint": "每个 tab 是一个独立供应商（qoder / qoder-global），各有自己的 PAT、账号、积分与模型。两边同时生效：不同会话可各选一边，一侧的改动不影响另一侧。",
				"row.tabSwitchHint": "取消勾选即关闭该供应商：它的模型不再出现在 DSH 模型选择器里；PAT、账号、积分与模型设置都会保留，重新勾选即恢复。",
				"row.tabSwitchAria": "是否向 DSH 提供{region}供应商",
				"row.tabOffNotice": "该供应商已关闭：它的模型不会提供给 DSH。PAT、账号、积分与模型设置均已保留——勾选上方复选框即可恢复。",
				"row.panelAccounts": "账号",
				"row.panelModels": "模型",
				"row.panelCapabilities": "能力",
				"row.panelDiag": "诊断",
				"row.panelAria": "卡片分区",
				"row.diagHint": "这张卡片实际读到了什么，方便整段贴进问题反馈。这里没有任何会改动设置的控件。",
				"row.diagRegion": "区域",
				"row.diagDomain": "上游域名",
				"row.diagAccount": "当前服务账号",
				"row.diagSource": "凭据来源",
				"row.diagCreditsAt": "积分读取于",
				"row.diagCatalog": "目录中的模型",
				"row.diagEnabled": "已启用的模型",
				"row.diagPool": "账号池",
				"row.diagPoolOn": "{count} 个账号",
				"row.diagPoolOff": "关闭",
				"row.diagFailures": "最近一次失败",
				"row.diagNoFailures": "没有报错。",
				"row.patLabel": "PAT（Personal Access Token）",
				"row.patPlaceholder": "pt-… 粘贴到这里；留空则读环境变量",
				"row.patHint": "只在本地保存到插件配置。优先于环境变量。",
				"row.patEnvHint": "也可设置环境变量 {var}",
				"row.accountsHint": "本区域生效的账号，从设置中的 PAT、环境变量 PAT 与插件保险库中选择。",
				"row.accountSelectLabel": "生效账号",
				"row.accountSelectAuto": "自动 —— 设置 → 环境变量 → 保险库",
				"row.accountSelectAria": "选择哪个账号服务本区域",
				"row.accountsScanning": "正在读取…",
				"row.accountsLoading": "正在加载账号…",
				"row.accountSourceSettings": "设置 PAT",
				"row.accountSourceEnv": "环境变量 PAT",
				"row.accountSourceVault": "保险库",
				"row.accountUnnamed": "未命名账号",
				"row.accountRemoving": "正在删除账号…",
				"row.accountsWriteFailed": "账号改动未保存：{message}",
				"row.selectionLostHint": "已保存的账号已不在可用的 PAT 之中。",
				"row.selectionLostMessage": "该区域保存的账号已不在可用的 PAT 来源（设置 / 环境变量 / 保险库）中。请在上方重新选择一个当前账号；仅添加新 PAT 并不会单独修复这个丢失的选择。",
				"row.credentialRejectedTitle": "Qoder 拒绝了这个账号的 PAT",
				"row.credentialRejectedIntro": "「{accountName}」的 PAT 已不被 Qoder 接受，因此这里的积分与测试都不可用。重新添加同一个 PAT 没有意义——当前实际适用的是：",
				"row.credentialRejectedSwitch": "本区域另一个账号「{accountName}」刚刚实测可用，切换到它即可恢复；若你还没有它的 PAT，请先添加。",
				"row.credentialRejectedSwitchAction": "切换到「{accountName}」",
				"row.credentialRejectedRelogin": "本区域没有其他可切换的账号。请为本区域添加一个有效的 PAT。",
				"row.credentialRejectedChoose": "本区域还有其他账号，但刚才都没能通过上游校验。可以在上方切换一个试试；如果都不行，请添加一个全新的 PAT。",
				"row.transferTitle": "导出 / 导入账号",
				"row.transferHint": "用 JSON 文件在电脑之间迁移 PAT 账号。文件里是账号凭据——请妥善保管。",
				"row.transferExport": "导出账号",
				"row.transferExporting": "正在导出…",
				"row.transferExportPick": "选择要导出的账号（共 {total} 个）：",
				"row.transferExportConfirm": "导出 {count} 个账号",
				"row.transferExported": "已导出 {count} 个账号到 {fileName}。",
				"row.transferImport": "导入账号",
				"row.transferImporting": "正在导入…",
				"row.transferPreviewing": "正在读取文件…",
				"row.transferPreviewTotal": "文件中共 {total} 个账号——不需要的请取消勾选。导入会覆盖这里已存储的同名账号。",
				"row.transferImportConfirm": "导入 {count} 个账号",
				"row.transferImported": "已导入 {imported} 个账号；跳过 {skipped} 个（缺 token，或属于另一个区域）。",
				"row.transferEntryUnknown": "未知账号",
				"row.transferNoToken": "此记录没有 token",
				"row.transferCancel": "取消",
				"row.transferError": "传输失败：{message}",
				"row.addAccountTitle": "添加一个 PAT",
				"row.addAccountStart": "添加 PAT",
				"row.addAccountPlaceholder": "在此粘贴一个 Qoder PAT（pt-…）",
				"row.addAccountNameHint": "可选显示名（验证通过的 token 会自动取一个）",
				"row.addAccountPatHint": "登录网页 {domain} → 服务集成 → 新建令牌（另一个区域域名不同）",
				"row.addAccountValidating": "正在验证…",
				"row.addAccountDone": "已添加「{accountName}」，它现在为这个区域服务。",
				"row.addAccountError": "无法添加此 PAT：{message}",
				"row.addAccountInvalid": "这不是 PAT 的格式（期望 pt-…）。",
				"row.addAccountTouchedOnce": "会用区域网关验证该 token，通过后账号会出现在上方。",
				"row.addAccountDialogClose": "关闭",
				"row.veilHintList": "完成后列表会立即刷新。",
				"row.addAccountSyncing": "正在添加账号…",
				"row.creditsError": "积分查询失败：{message}",
				"row.usageTitle": "额度",
				"row.usageUnavailable": "额度暂不可用（未配置 PAT，或上游未响应）。",
				"row.campaignsTitle": "活动",
				"row.campaignsEmpty": "当前没有活动。",
				"row.campaignsLoading": "正在加载活动…",
				"row.campaignsError": "活动信息暂不可用：{message}",
				"row.campaignsNoCredential": "尚未配置凭据——请在账号池添加一个 PAT 后即可加载活动。",
				"row.campaignUntitled": "未命名活动",
				"row.campaignDetails": "查看详情",
				"row.campaignClaimable": "可领取",
				"row.campaignClaimed": "已领取",
				"row.usageBucketBase": "基础额度",
				"row.usageBucketAddon": "附加额度",
				"row.usageBucketOrg": "组织额度",
				"row.usageUsed": "已用",
				"row.usageTotal": "总量",
				"row.usageExpiresAt": "{at} 到期",
				"row.usageExpired": "已到期",
				"row.refreshUsage": "刷新额度",
				"row.refreshingUsage": "正在刷新额度…",
				"row.modelsTitle": "模型",
				"row.modelsSummary": "已启用 {count} 个",
				"row.modelsDirty": "有未保存的修改",
				"row.modelsRefresh": "从 Qoder 刷新",
				"row.modelsRefreshing": "正在刷新模型…",
				"row.discard": "放弃修改",
				"row.save": "保存",
				"row.saving": "保存中…",
				"row.saveError": "保存失败：{message}",
				"row.saveContentionHint": "（该文件被占用，写入被拒——Windows 上通常是杀毒软件、OneDrive 这类同步盘，或正打开该文件的编辑器。请先关闭占用者再保存一次；你的改动仍然还在。）",
				"row.modelContext": "最大上下文 {context}",
				"row.contextBudget": "上下文",
				"row.modelOutput": "最大输出 {output}",
				"row.modelReasoningLabel": "思考强度",
				"row.modelReasoningFollowUpstream": "跟随上游默认",
				"row.modelReasoningFollowUpstreamNamed": "{effort}（上游默认）",
				"row.modelMultimodal": "多模态",
				"row.modelFree": "免费",
				"row.modelFreeHint": "倍率为 0，不消耗积分",
				"row.promoPending": "当前未生效，{start} 起生效",
				"row.ratePromoHint": "活动价，基准价 x{base}",
				"row.modelImage": "图片",
				"row.modelImageText": "厂商文档标注该模型为纯文本，不接收图片输入",
				"row.modelImageUnverified": "该模型的原生多模态能力未经核实；除非你确定它能读图，否则请保持关闭",
				"row.modelOff": "可关闭思考",
				"row.modelOffHint": "为这个模型提供「关闭思考」档位",
				"row.modelFallback": "内置目录（上游暂不可达）",
				"row.modelNoProbe": "测试",
				"row.modelUnknown": "未知",
				"row.modelCapabilityPending": "仅展示 Qoder 接口明确公布的模型能力。",
				"row.probe": "测试",
				"row.probing": "测试中…",
				"row.probeHint": "对该模型发一条真实聊天请求，报告它现在能不能用。会消耗少量额度，且一次只测一个模型。",
				"row.probeOk": "✓ 可用",
				"row.probeOkMs": "✓ 可用（{ms}）",
				"row.probeRateLimitedUnknown": "✗ 被限流 · 上游未给出何时恢复",
				"row.probeRateLimitedAt": "✗ 被限流 · {at} 之后可再用",
				"row.probeOutOfCreditUnknown": "✗ 用量已达上限 · 上游未给出何时恢复",
				"row.probeOutOfCreditAt": "✗ 用量已达上限 · {at} 恢复",
				"row.probeCredentialRejected": "✗ Qoder 拒绝了这个账号的 PAT——请添加新 PAT 或换一个账号",
				"row.probePolicyRejected": "✗ Qoder 服务端按内容策略拒绝了这次请求——重新添加 PAT 无效",
				"row.probeNotFound": "✗ 上游不认识这个模型",
				"row.probeQueuedUnknown": "✗ 上游排队中 · 上游未给出何时恢复",
				"row.probeQueuedAt": "✗ 上游排队中 · {at} 之后可再用",
				"row.probeQueuedCount": "前面还有 {count} 个",
				"row.probeUnavailable": "✗ 连不上上游——上游没有给出可用答复",
				"row.probeFailed": "✗ 测试失败",
				"row.probeFailedStatus": "✗ 测试失败（HTTP {status}）",
				"row.probeError": "无法执行测试：{message}",
				"row.cheer": "鼓励一下",
				"row.docsHint": "如何创建 PAT？",
				"row.poolTitle": "账号池",
				"row.poolNoCandidate": "账号池里目前没有可用的账号。",
				"row.poolNoCandidateHint": "成员要么在限流冷却中、要么用量已达上限、要么上游排队中、要么凭据被拒、要么上游无响应。限流、用量上限、上游排队与瞬时故障都会自动回池——按上游给出的恢复时间，没给时间就按 30 分钟兜底，不需要你操作；只有「凭据被拒」需要换一个新 PAT。",
				"row.poolEmptyHint": "这个区域还没有账号。用上面的「添加 PAT」粘贴一个，或用「导出 / 导入账号」把别的机器上的账号搬过来 —— 账号池、模型测试与每日签到都需要至少一个账号。",
				"row.poolTestAll": "测试勾选的账号",
				"row.poolCheckinAll": "签到勾选的账号",
				"row.poolCheckingIn": "签到中…",
				"row.poolLogCheckinStart": "开始为 {count} 个账号签到",
				"row.poolLogCheckinClaimed": "{accountName}：已领取",
				"row.poolLogCheckinClaimedAmount": "{accountName}：已领取 {credit} Credits",
				"row.poolLogCheckinAlready": "{accountName}：今天已领过",
				"row.poolLogCheckinFailed": "{accountName}：签到失败 — {message}",
				"row.poolLogCheckinDone": "签到完成",
				"row.poolTesting": "测试中…",
				"row.poolBusyHint": "正在逐个账号执行…",
				"row.poolTargetAuto": "自动",
				"row.poolTargetFree": "自动选中的免费模型：{model}",
				"row.poolTargetPreferred": "你指定的模型：{model}",
				"row.poolTargetCurrentPreferred": "当前：{model}（你指定）。",
				"row.poolTargetCurrentFree": "当前：{model}（自动挑选的免费模型）。",
				"row.poolTargetNone": "本区域没有可用来测试的倍率为 0 的免费模型。",
				"row.poolRank": "第 {rank} 位",
				"row.poolRankAuto": "自动排序",
				"row.poolRankHint": "这个顺序是你手动排的。请求会优先发给排在前面且可用的账号。",
				"row.poolRankExcluded": "第 {rank} 位 · 暂不参与",
				"row.poolRankExcludedHint": "你把它排在了这个位置，但它此刻被排除，所以排在所有可用账号之后，直到恢复。",
				"row.poolRankAutoHint": "还没有手动排序：池会先花临期积分，再按余额多寡选号。用 ↑/↓ 自己指定顺序。",
				"row.poolMoveUp": "提高优先级",
				"row.poolMoveDown": "降低优先级",
				"row.poolMoveAria": "{accountName} 的优先级顺序",
				"row.poolTargetNoneHint": "这有两种原因，且都不是账号的问题：要么本区域的倍率还没刷出来（去「模型」区刷新一次目录），要么本区域此刻确实一个倍率为 0 的模型都没有。「已启用模型」在这里不影响任何事 —— 勾选只决定 DSH 的选择器里列哪些，不决定能测哪些。为了不让你在不知情的情况下花掉积分，在免费模型可用之前测试会保持关闭；你也可以自己指定一个目标模型。",
				"row.poolTargetStale": "你保存的目标模型已不在目录中：{model}",
				"row.poolTargetStaleHint": "本区域的模型目录已变化，不再包含这个模型，因此测试被停用。请改选一个目标模型，或切回自动。",
				"row.poolTargetStaleClear": "切回自动",
				"row.poolTargetStaleShort": "目标模型已失效",
				"row.poolTargetNoneShort": "无免费模型",
				"row.poolColumnAccount": "账号",
				"row.poolColumnCredits": "积分",
				"row.poolColumnProbe": "状态",
				"row.poolColumnCheckin": "签到",
				"row.poolCheckedIn": "已签到",
				"row.poolNotCheckedIn": "未签到",
				"row.poolCheckinUnknown": "—",
				"row.poolCheckinNext": "{countdown} 后可再签到",
				"row.poolCheckinNextHint": "这一窗已经签到过了。这个数字是下一窗什么时候开（到点就能再签），与 Qoder 网页上的倒计时是同一个数 —— 不是「这一行多久刷新」。",
				"row.poolCheckinDue": "现在可以签到",
				"row.poolCheckinDueHint": "下一窗已经开了，这个账号现在可以再签。「已签到」说的是上一窗，所以这里不再重复它。",
				"row.poolNeverTested": "未测试",
				"row.poolTestedAt": "测试于 {at}",
				"row.poolExcludedRateLimited": "被限流",
				"row.poolExcludedOutOfCredit": "用量已达上限",
				"row.poolExcludedRejected": "被拒绝",
				"row.poolExcludedQueued": "上游排队中",
				"row.poolExcludedUnusable": "不可用",
				"row.poolRetryUnknown": "上游未给出何时恢复",
				"row.poolRetryFallback": "每 30 分钟自动重试一次",
				"row.unlockSuffix": "{when}解禁",
				"row.unlockSuffixWindow": "{when}解禁（按今日额度窗口推算）",
				"row.remainingImminent": "即将恢复",
				"row.remainingMinutes": "约 {count} 分钟后",
				"row.remainingHours": "约 {count} 小时后",
				"row.remainingDays": "约 {count} 天后",
				"row.poolProbeJustNow": "刚刚",
				"row.poolProbeMinutesAgo": "{count} 分钟前",
				"row.poolProbeHoursAgo": "{count} 小时前",
				"row.poolProbeDaysAgo": "{count} 天前",
				"row.poolProbeSourceTest": "测得",
				"row.poolProbeSourceLive": "聊天撞上",
				"row.poolProbeSourceUnknown": "来源未知",
				"row.poolProbeOtherModel": "针对 {model} 测得",
				"row.poolProbeOtherModelHint": "这条结论是针对另一个模型的，对当前选中的模型不作数。Qoder 按模型限流，同一个账号可能在一个模型上正常、在另一个上被限。",
				"row.poolEnabled": "启用账号池",
				"row.poolEnabledHint": "开启：由账号池为每次请求挑号，失败就换下一个。关闭：你选的账号服务每一次请求，失败如实报错。",
				"row.poolModeAuto": "自动挑号",
				"row.poolModeManual": "手动选号",
				"row.poolAutoCheckin": "每天自动签到",
				"row.poolAutoCheckinHint": "开启：后台为池成员每天领一次签到，先读活动状态，今天已领过的不会再领。关闭：只有点按钮才签到。错过一窗就是白丢一份。",
				"row.poolAutoCheckinToday": "今日：已签 {done} / {total}",
				"row.poolAutoCheckinDone": "今日：{total} 个全部已签",
				"row.poolAutoCheckinPending": "待重试 {count} 个",
				"row.poolAutoCheckinFailed": "上次尝试失败：{message}",
				"row.poolManualAccountLabel": "使用哪个账号",
				"row.poolManualAccountNone": "当前没有生效的账号",
				"row.poolTargetLabel": "测试用模型（全池统一）",
				"row.poolTargetHint": "全池共用这一个模型，测试就是拿它逐个去测。「自动」会从本区域目录里挑一个倍率为 0 的免费模型，多个候选取上下文窗口最大的；手动指定优先于自动。",
				"row.poolTargetAutoOption": "自动 —— 挑一个免费模型",
				"row.poolTargetStaleOption": "已保存的目标已下架：{model}",
				"row.poolProbeSizeLabel": "测试请求体积",
				"row.poolProbeSizeHint": "测试时发送多少文本。体积越大测得越准，但每次测试消耗的额度也越多。",
				"row.poolProbeSizeDefault": "默认（2.5 万）",
				"row.poolProbeSizeOption": "{tokens} 万 token",
				"row.poolSaved": "保存",
				"row.poolSaving": "保存中…",
				"row.poolSaveFailed": "保存失败：{message}",
				"row.poolSavedStaleRefresh": "已保存，但面板未能重新读取。设置已写入；下次刷新后会显示。",
				"row.poolDiscard": "放弃修改",
				"row.poolDirty": "● 有未保存的修改",
				"row.poolLogTitle": "活动记录",
				"row.poolLogClear": "清空",
				"row.poolLogEmpty": "尚无活动。测试与账号切换都会记录在这里。",
				"row.poolLogTestStart": "开始测试 {count} 个账号 × {model}",
				"row.poolLogTestRow": "{accountName}：{outcome}",
				"row.poolLogTestDone": "测试完成，已重新计算候选账号",
				"row.poolLogTestRowMalformed": "{accountName}：Host 未返回该账号的结果",
				"row.poolLogBatchFailed": "批量操作失败 —— 没有执行：{message}",
				"row.poolLogTestNoneRan": "没有测任何账号：本池勾选的账号当前都没有可用的 PAT。",
				"row.poolMembersTitle": "本池包含的账号",
				"row.poolMembersHint": "只有勾选的账号参与轮换、签到与测试。",
				"row.poolSelectAll": "全选",
				"row.poolSelectNone": "全不选",
				"row.poolSelectedCount": "已选 {count} / {total}",
				"row.poolNoneSelectedHint": "勾选至少一个账号，才能签到与测试。",
				"row.poolSelectAria": "把 {accountName} 加入本区域的账号池",
				"row.poolCurrentBadge": "当前使用",
				"row.poolCurrentHeader": "当前使用：{account}",
				"row.poolCurrentHeaderFailover": "当前使用：{account}（为被排除的选中号接管）",
				"row.poolCurrentBadgeFailover": "接管中",
				"row.poolCurrentHintFailover": "池已开启，且你选中的账号此刻被排除：每个请求仍先发给选中号，它在首字节前被拒绝时才由这个账号接管并计费。所以这一行标「当前使用」、选中号那行写「用量已达上限」——两句话都对。",
				"row.poolCurrentHintSelected": "区域手动选中的就是这个账号，请求直接发给它。",
				"row.poolCurrentHeaderUnavailable": "当前没有可用的账号",
				"row.poolCurrentHintUnavailable": "这个池里的成员全都被挡在门外（限流、积分耗尽、凭据被拒，或者模型正忙）——包括你保存的那个选择。所以没有一行标「当前使用」：此刻没有任何账号在服务，下一个请求会直接失败而不是记在谁头上。冷却时间一到会自动恢复。",
				"row.poolNotMember": "未入池",
				"row.poolServingOutside": "「{account}」正在使用，但不在这个池里：轮换不会挑它，批量签到与测试也不会动它。",
				"row.poolUnsavedMembers": "勾选已改动 —— 保存后生效",
				"row.poolRowTest": "测试",
				"row.poolRowDelete": "删除",
				"row.poolRowDeleteHint": "彻底删除这个账号：它的 PAT 会被抹掉，并自动退出账号池与该区域的选择。如果只想让它不参与轮换，取消勾选并保存即可。",
				"row.poolRowDeleteAria": "删除账号 {accountName}",
				"row.poolDeleteConfirm": "彻底删除 {accountName}？它保存的 PAT 会被抹掉，找不回来。",
				"row.poolDeleteConfirmAria": "确认删除 {accountName}",
				"row.poolDeleteConfirmYes": "彻底删除",
				"row.poolDeleteCancel": "保留",
				"row.poolRowDeleting": "正在删除账号…",
				"row.poolRowRemoved": "{accountName}：已删除，保存的 PAT 一并抹掉。",
				"row.poolErrNotDeletable": "这个账号的 PAT 不是本插件存的（来自应用设置或环境变量），由插件之外管理。请到那里删除。",
				"row.poolErrUnavailable": "本版本没有可用的账号池（或其批量接口缺失）。请重启应用；若仍不行，插件可能需要重新安装。",
				"row.poolErrFailed": "批量操作在宿主侧失败：{message}",
				"row.poolErrHttp": "批量操作被拒绝（HTTP {status}）。请确认插件是最新版本后重试。",
				"row.poolErrNoMembers": "本池没有勾选任何账号，批量操作没有可执行对象。请至少勾选一个账号并保存。",
				"row.poolErrNoLiveMembers": "本池勾选的账号当前都没有可用的 PAT，批量操作没有可执行对象。",
				"row.poolErrNoFreeModel": "本区域没有可用的免费（倍率为 0）模型。请先刷新模型目录，或自己指定一个目标模型。",
				"row.poolErrNoCheckin": "本区域没有每日签到 —— 这里不提供该操作。",
				"row.poolErrStaleModel": "目标模型已不在本区域目录中。请改选一个，或切回自动。",
				"row.poolErrRouteMissing": "批量接口返回 405 且响应体为空。这是宿主进程在为一个从未注册的路由作答——请重启应用；不要重装或升级本插件。",
				"row.requestFailed": "请求失败",
				"row.requestFailedHint": "刷新失败——下方为上次加载的数据：{message}",
				"row.showCreditsCn": "在对话框显示 QD CN 积分",
				"row.showCreditsGlobal": "在对话框显示 QD AI 积分",
				"row.showCreditsCnHint": "在对话输入框工具栏显示国内版（QD CN）剩余额度，仅当本会话使用 CN 模型时出现。点击可看各账号余额并手动刷新（每 5 分钟也会自动刷新）。",
				"row.showCreditsGlobalHint": "在对话输入框工具栏显示国际版（QD AI）剩余额度，仅当本会话使用国际版模型时出现。点击可看各账号余额并手动刷新（每 5 分钟也会自动刷新）。",
				"row.showCampaigns": "显示活动",
				"row.showCampaignsHint": "在这个区域显示上游下发的活动（每日签到额度与限时活动公告），位置在 tab 栏之上。只读——签到仍在账号池里操作。关掉之后这一页直接从 tab 栏开始，其余功能不受影响。",
				"row.showCreditsCnDesc": "在输入框工具栏显示可点击读数（选中国内版模型时出现）：「QD CN · 余额」。读数位置在下一行。",
				"row.showCreditsGlobalDesc": "在输入框工具栏显示可点击读数（选中全球版模型时出现）：「QD AI · 套餐」。读数位置在下一行。",
				"row.creditPositionLabel": "显示位置",
				"row.creditPositionAria": "{region} 积分读数的位置",
				"row.creditPositionComposer": "输入框工具栏",
				"row.creditPositionStats": "输入框下方",
				"row.creditPositionHint": "积分读数放在哪里。「输入框工具栏」位置更近，但那一行是共享的 list 插槽——若另一个插件也把东西停在那里、读数消失，就选「输入框下方」（会话 token 统计旁边那行常驻栏）。",
				"row.sidebarPanelLabel": "在侧边栏显示 Qoder",
				"row.sidebarPanelHint": "在 DSH 侧边栏加一个 Qoder 行，点开就是这一页的整屏版。默认关闭：这一行占的是所有插件共用的全局侧边栏座位，而「设置 → Qoder」本来就能看到同样的内容。点一下即生效，不用保存；页面开着时关掉它，会直接回到对话。",
				"row.sidebarPanelFailed": "侧边栏开关没能保存：{message}",
				"row.pollMinutesLabel": "自动刷新上游",
				"row.pollMinutesHint": "设置页与输入框积分读数多久向上游重读一次（分钟）。两个区域、两个表面共用同一条节奏——它们问的是同一个路由，几乎同时到达的读会被合流成一次上游请求。改完立即生效，不用保存。",
				"row.pollMinutesAria": "上游自动刷新间隔",
				"row.pollMinutesOption": "每 {minutes} 分钟",
				"row.pollMinutesFailed": "刷新间隔没能保存：{message}",
				"nav.panel": "Qoder",
				"nav.back": "返回会话",
				"row.quotaExhaustedTitle": "上游报额度耗尽",
				"row.quotaExhaustedDetail": "最近一次 {time}（业务码 {code}）。逐账号明细在账号池表格里（池开着时）；池关着时这里是唯一能看到它的地方。",
				"composer.pointsCn": "QD CN",
				"composer.pointsGlobal": "QD AI",
				"composer.panelTitleCn": "QD CN 积分",
				"composer.panelTitleGlobal": "QD AI 积分",
				"composer.account": "账号",
				"composer.dedicated": "SOTA",
				"composer.dedicatedHint": "专属积分，选中与之绑定的模型时优先抵扣。不计入右边的「积分」列：不选那只模型时这笔钱一分都动不了。",
				"composer.dedicatedExpires": "{time} 到期",
				"composer.dedicatedMultiple": "共 {count} 个专属包，各自余额见下",
				"composer.credits": "积分",
				"composer.switchTo": "切换到 {account}",
				"composer.noAccounts": "该区域暂无账号",
				"composer.signedOut": "未登录",
				"composer.openSettings": "设置",
				"composer.openSettingsHint": "打开「设置 → Qoder」（账号池、模型目录、诊断）",
				"composer.refresh": "刷新",
				"composer.refreshing": "正在刷新…",
				"composer.refreshHint": "刷新本区所有账号的状态——逐个探测每个账号（会消耗少量积分，最长约一分钟）",
				"composer.refreshAccountsFailed": "账号状态刷新失败",
				"composer.refreshFailed": "积分刷新失败",
				"composer.lastRefresh": "最近刷新",
				"composer.dataStale": "未更新",
				"composer.currentPick": "当前选用",
				"composer.billingAccount": "当前计费的账号：{name}",
				"composer.panelTitle": "Qoder 积分",
				"promo.locale": "zh-CN"
			},
			en: {
				"row.title": `Qoder (Lingma) credits & models (${QODER_PACKAGE_NAME})`,
				"row.desc": "Use Qoder (Lingma CN / global) models in DSH and see your remaining credits; the CN and international sides are two independent providers (qoder / qoder-global), each with its own PAT and accounts — use both at the same time.",
				"row.expand": "Expand",
				"row.collapse": "Collapse",
				"section.label": "Qoder",
				"section.title": "Qoder (Lingma) accounts, credits & models",
				"row.tabCn": "CN",
				"row.tabGlobal": "Global",
				"row.tabHint": "Each tab is a separate provider (qoder / qoder-global) with its own PAT, accounts, credits, and models. Both sides are live at once: different sessions can pick from either side, and changes on one tab never touch the other.",
				"row.tabSwitchHint": "Uncheck to switch this provider off. Its models disappear from the DSH model picker; your PAT, accounts, credits, and model settings are kept and return when you check it again.",
				"row.tabSwitchAria": "Offer the {region} provider to DSH",
				"row.tabOffNotice": "This provider is switched off: none of its models are offered to DSH. Your PAT, accounts, credits, and model settings are kept — check the box above the tab to bring it back.",
				"row.panelAccounts": "Accounts",
				"row.panelModels": "Models",
				"row.panelCapabilities": "Capabilities",
				"row.panelDiag": "Diagnostics",
				"row.panelAria": "Card sections",
				"row.diagHint": "What this card actually read, so a report can quote it. Nothing here changes a setting.",
				"row.diagRegion": "Region",
				"row.diagDomain": "Upstream domain",
				"row.diagAccount": "Serving account",
				"row.diagSource": "Credential source",
				"row.diagCreditsAt": "Credits read at",
				"row.diagCatalog": "Models in the catalog",
				"row.diagEnabled": "Enabled models",
				"row.diagPool": "Account pool",
				"row.diagPoolOn": "{count} account(s)",
				"row.diagPoolOff": "off",
				"row.diagFailures": "Last failure",
				"row.diagNoFailures": "Nothing reported.",
				"row.patLabel": "PAT (Personal Access Token)",
				"row.patPlaceholder": "pt-… paste here; empty reads the environment variable",
				"row.patHint": "Stored locally in the plugin configuration only. Takes precedence over the environment variable.",
				"row.patEnvHint": "You may also set the environment variable {var}",
				"row.accountsHint": "The serving account for this region, chosen from the settings PAT, the environment PAT, and the plugin vault.",
				"row.accountSelectLabel": "Account in effect",
				"row.accountSelectAuto": "Auto — settings, then env, then vault",
				"row.accountSelectAria": "Choose which account serves this region",
				"row.accountsScanning": "Re-reading…",
				"row.accountsLoading": "Loading your accounts…",
				"row.accountSourceSettings": "settings PAT",
				"row.accountSourceEnv": "environment PAT",
				"row.accountSourceVault": "vault",
				"row.accountUnnamed": "Unnamed account",
				"row.accountRemoving": "Removing the account…",
				"row.accountsWriteFailed": "The account change was not saved: {message}",
				"row.selectionLostHint": "The saved account no longer exists among the available PATs.",
				"row.selectionLostMessage": "The account saved for this region is no longer among the available PAT sources (settings / env / vault). Pick a current one from the list above; adding a PAT will not fix a lost selection on its own.",
				"row.credentialRejectedTitle": "Qoder refused this account's PAT",
				"row.credentialRejectedIntro": "The PAT for \"{accountName}\" is no longer accepted by Qoder, so credits and testing are unavailable here. Re-adding the same PAT will not help — what actually applies:",
				"row.credentialRejectedSwitch": "Another account in this region answered the upstream: \"{accountName}\". Switching to it fixes this — add its PAT if you do not already have it.",
				"row.credentialRejectedSwitchAction": "Switch to \"{accountName}\"",
				"row.credentialRejectedRelogin": "No other account exists to switch to. Add a valid PAT for this region.",
				"row.credentialRejectedChoose": "Other accounts exist but none of them answered the upstream just now. Try switching to one above; if none works, add a fresh PAT.",
				"row.transferTitle": "Export / import accounts",
				"row.transferHint": "Move PAT accounts between machines as a JSON file. The file carries the credentials — keep it private.",
				"row.transferExport": "Export accounts",
				"row.transferExporting": "Exporting…",
				"row.transferExportPick": "Choose the accounts to export ({total} available):",
				"row.transferExportConfirm": "Export {count} account(s)",
				"row.transferExported": "Exported {count} account(s) to {fileName}.",
				"row.transferImport": "Import accounts",
				"row.transferImporting": "Importing…",
				"row.transferPreviewing": "Reading the file…",
				"row.transferPreviewTotal": "{total} account(s) in the file — untick what should stay out. Accounts already stored here are overwritten by the import.",
				"row.transferImportConfirm": "Import {count} account(s)",
				"row.transferImported": "Imported {imported} account(s); {skipped} skipped (no token, or belongs to the other region).",
				"row.transferEntryUnknown": "unknown account",
				"row.transferNoToken": "no token in this record",
				"row.transferCancel": "Cancel",
				"row.transferError": "Transfer failed: {message}",
				"row.addAccountTitle": "Add a PAT",
				"row.addAccountStart": "Add PAT",
				"row.addAccountPlaceholder": "Paste a Qoder PAT (pt-…) here",
				"row.addAccountNameHint": "Optional display name (a validated token yields one automatically)",
				/**
				* 「PAT 从哪来」的就地说明。放在「添加 PAT」这一行上，而不是只靠对话框里
				* 那个文档链接 —— 用户看到这个入口的瞬间，最想知道的正是「去哪弄一个令牌」。
				* 域名逐区域不同（国内 qoder.com.cn / 国际 qoder.com），所以写成参数。
				*/
				"row.addAccountPatHint": "Sign in at {domain} → Service integrations → New token (the other region uses a different domain)",
				"row.addAccountValidating": "Validating…",
				"row.addAccountDone": "Added “{accountName}”. It now serves this region.",
				"row.addAccountError": "Could not add this PAT: {message}",
				"row.addAccountInvalid": "This does not look like a PAT (expected pt-…).",
				"row.addAccountTouchedOnce": "Validate the token against the region gateway; the account appears above when it is accepted.",
				"row.addAccountDialogClose": "Close",
				"row.veilHintList": "The list refreshes as soon as this finishes.",
				"row.addAccountSyncing": "Adding the account…",
				"row.creditsError": "Credit query unavailable: {message}",
				"row.usageTitle": "Credits",
				"row.usageUnavailable": "Credits unavailable (no PAT, or the upstream is not answering).",
				"row.campaignsTitle": "Campaigns",
				"row.campaignsEmpty": "No active campaigns right now.",
				"row.campaignsLoading": "Loading campaigns…",
				"row.campaignsError": "Campaigns unavailable: {message}",
				"row.campaignsNoCredential": "No credential configured — add a PAT in the account pool to load campaigns.",
				"row.campaignUntitled": "Untitled campaign",
				"row.campaignDetails": "View details",
				"row.campaignClaimable": "Claimable",
				"row.campaignClaimed": "Claimed",
				"row.usageBucketBase": "Base quota",
				"row.usageBucketAddon": "Add-on quota",
				"row.usageBucketOrg": "Org quota",
				"row.usageUsed": "used",
				"row.usageTotal": "total",
				"row.usageExpiresAt": "expires {at}",
				"row.usageExpired": "expired",
				"row.refreshUsage": "Refresh credits",
				"row.refreshingUsage": "Refreshing credits…",
				"row.modelsTitle": "Models",
				"row.modelsSummary": "{count} enabled",
				"row.modelsDirty": "unsaved changes",
				"row.modelsRefresh": "Refresh from Qoder",
				"row.modelsRefreshing": "Refreshing models…",
				"row.discard": "Discard changes",
				"row.save": "Save",
				"row.saving": "Saving…",
				"row.saveError": "Save failed: {message}",
				"row.saveContentionHint": " (The file was locked, so the write was refused — on Windows this is usually an antivirus scanner, a sync client such as OneDrive, or an editor with that file open. Close whatever holds it and save again; your edits are still here.)",
				"row.modelContext": "Maximum context {context}",
				"row.contextBudget": "Context",
				"row.modelOutput": "Output {output}",
				"row.modelReasoningLabel": "Reasoning",
				"row.modelReasoningFollowUpstream": "Upstream default",
				"row.modelReasoningFollowUpstreamNamed": "{effort} (upstream default)",
				"row.modelMultimodal": "Multimodal",
				"row.modelFree": "Free",
				"row.modelFreeHint": "Zero multiplier — calls with this model consume no credits",
				"row.promoPending": "Not active yet — starts at {start}",
				"row.ratePromoHint": "Promotional rate — base rate is x{base}",
				"row.modelImage": "Image",
				"row.modelImageText": "This model is documented as text-only — it does not accept image input",
				"row.modelImageUnverified": "Native multimodal support is not verified for this model; leave it off unless you know it accepts images",
				"row.modelOff": "Can disable thinking",
				"row.modelOffHint": "Offer the \"off\" thinking level for this model",
				"row.modelFallback": "Built-in catalog (upstream unreachable)",
				"row.modelNoProbe": "Test",
				"row.modelUnknown": "Unknown",
				"row.modelCapabilityPending": "Only capabilities advertised by Qoder are shown.",
				"row.probe": "Test",
				"row.probing": "Testing…",
				"row.probeHint": "Send one real chat request to this model and report whether it answers right now. This costs a little credit and runs one model at a time.",
				"row.probeOk": "✓ Usable",
				"row.probeOkMs": "✓ Usable ({ms})",
				"row.probeRateLimitedUnknown": "✗ Rate limited · the upstream gave no time for when it frees up",
				"row.probeRateLimitedAt": "✗ Rate limited · usable again after {at}",
				"row.probeOutOfCreditUnknown": "✗ Usage limit reached · the upstream gave no time for when it frees up",
				"row.probeOutOfCreditAt": "✗ Usage limit reached · recovers {at}",
				"row.probeCredentialRejected": "✗ Qoder refused this account's PAT — add a new one or pick another account",
				"row.probePolicyRejected": "✗ Qoder's server refused this request under its content policy — re-adding the PAT will not help",
				"row.probeNotFound": "✗ The upstream does not know this model",
				"row.probeQueuedUnknown": "✗ Queued upstream · the upstream gave no time for when it frees up",
				"row.probeQueuedAt": "✗ Queued upstream · usable again after {at}",
				"row.probeQueuedCount": "{count} ahead in the queue",
				"row.probeUnavailable": "✗ The upstream could not be reached — no usable answer came back",
				"row.probeFailed": "✗ Test failed",
				"row.probeFailedStatus": "✗ Test failed (HTTP {status})",
				"row.probeError": "Could not run the test: {message}",
				"row.cheer": "Star on GitHub",
				"row.docsHint": "How to create a PAT?",
				"row.poolTitle": "Account pool",
				"row.poolNoCandidate": "No account in this pool can be used right now.",
				"row.poolNoCandidateHint": "Members are rate-limited, at their usage limit, queued upstream, rejected, or unreachable. Rate limits, usage limits, upstream queues and transient failures return to the pool on their own — at the time the upstream states, or after a 30-minute fallback. Only a rejected credential needs a new PAT.",
				"row.poolEmptyHint": "This region has no accounts yet. Use “Add PAT” above to paste one, or “Export / import accounts” to bring them over from another machine — the pool, the model tests and the daily check-in all need at least one account.",
				"row.poolTestAll": "Test selected",
				"row.poolCheckinAll": "Check in selected",
				"row.poolCheckingIn": "Claiming…",
				"row.poolLogCheckinStart": "Claiming daily credits for {count} account(s)",
				"row.poolLogCheckinClaimed": "{accountName}: claimed",
				"row.poolLogCheckinClaimedAmount": "{accountName}: claimed {credit} credits",
				"row.poolLogCheckinAlready": "{accountName}: already claimed today",
				"row.poolLogCheckinFailed": "{accountName}: failed — {message}",
				"row.poolLogCheckinDone": "Check-in finished",
				"row.poolTesting": "Testing…",
				"row.poolBusyHint": "Running one account at a time…",
				"row.poolTargetAuto": "Auto",
				"row.poolTargetFree": "Auto-picked free model: {model}",
				"row.poolTargetPreferred": "Your chosen model: {model}",
				"row.poolTargetCurrentPreferred": "Current: {model} (your choice).",
				"row.poolTargetCurrentFree": "Current: {model} (auto-picked free model).",
				"row.poolTargetNone": "No zero-multiplier model to test with in this region.",
				"row.poolRank": "Priority #{rank}",
				"row.poolRankAuto": "Auto-ranked",
				"row.poolRankHint": "You set this order. Requests go to the highest available account first.",
				"row.poolRankExcluded": "Position #{rank} · not in use",
				"row.poolRankExcludedHint": "You set this position, but the account is excluded right now, so it sinks below every usable one until it recovers.",
				"row.poolRankAutoHint": "No manual order yet — the pool picks by expiring credits first, then balance. Use ↑/↓ to set your own order.",
				"row.poolMoveUp": "Higher priority",
				"row.poolMoveDown": "Lower priority",
				"row.poolMoveAria": "Priority order for {accountName}",
				"row.poolTargetNoneHint": "Two things cause this, and neither is the account: either the catalog has not revealed its multipliers yet (refresh the models in the Models section), or this region genuinely lists no multiplier-0 model right now. Your enabled models do not matter here — ticking a model only decides what the DSH picker lists, not what may be tested. Rather than quietly spending credits on a paid model, testing stays off until a free one is available; you can also pin a target model yourself.",
				"row.poolTargetStale": "The target model you saved is no longer offered: {model}",
				"row.poolTargetStaleHint": "The region's catalog changed and no longer lists this model, so testing is off rather than running against a model the upstream may not accept. Pick another target, or switch back to automatic.",
				"row.poolTargetStaleClear": "Switch back to automatic",
				"row.poolTargetStaleShort": "target model unavailable",
				"row.poolTargetNoneShort": "no free model",
				"row.poolColumnAccount": "Account",
				"row.poolColumnCredits": "Credits",
				"row.poolColumnProbe": "Status",
				"row.poolColumnCheckin": "Check-in",
				"row.poolCheckedIn": "Checked in",
				"row.poolNotCheckedIn": "Not checked in",
				"row.poolCheckinUnknown": "—",
				"row.poolCheckinNext": "Claimable again in {countdown}",
				"row.poolCheckinNextHint": "This daily window has been claimed. The number is when the NEXT window opens (claim again then) — the same countdown the Qoder web page shows, not how often this row refreshes.",
				"row.poolCheckinDue": "Claimable now",
				"row.poolCheckinDueHint": "The next window has opened, so this account can claim again now. \"Checked in\" referred to the previous window, so it is not repeated here.",
				"row.poolNeverTested": "Untested",
				"row.poolTestedAt": "Tested {at}",
				"row.poolExcludedRateLimited": "Rate limited",
				"row.poolExcludedOutOfCredit": "Usage limit reached",
				"row.poolExcludedRejected": "Rejected",
				"row.poolExcludedQueued": "Queued upstream",
				"row.poolExcludedUnusable": "Unusable",
				"row.poolRetryUnknown": "The upstream gave no time for when this frees up",
				"row.poolRetryFallback": "Retrying automatically about every 30 min",
				"row.unlockSuffix": "unblocks {when}",
				"row.unlockSuffixWindow": "unblocks {when} (daily quota window)",
				"row.remainingImminent": "any moment now",
				"row.remainingMinutes": "in about {count} min",
				"row.remainingHours": "in about {count} h",
				"row.remainingDays": "in about {count} d",
				"row.poolProbeJustNow": "just now",
				"row.poolProbeMinutesAgo": "{count} min ago",
				"row.poolProbeHoursAgo": "{count} h ago",
				"row.poolProbeDaysAgo": "{count} d ago",
				"row.poolProbeSourceTest": "tested",
				"row.poolProbeSourceLive": "hit by a live request",
				"row.poolProbeSourceUnknown": "source unknown",
				"row.poolProbeOtherModel": "measured on {model}",
				"row.poolProbeOtherModelHint": "This result is about a different model — it says nothing about the currently selected one. Qoder rate-limits per model, so the same account can be fine on one and throttled on another.",
				"row.poolEnabled": "Enable the account pool",
				"row.poolEnabledHint": "On: the pool picks the account for every request and moves to the next one when it fails. Off: the account you select serves every request, and a failure is reported as it is.",
				"row.poolModeAuto": "picking automatically",
				"row.poolModeManual": "you pick",
				"row.poolAutoCheckin": "Check in automatically each day",
				"row.poolAutoCheckinHint": "On: claims the daily check-in for pool members once a day, in the background — it reads the campaign first, so an account already claimed today is never re-claimed. Off: only the button claims. A missed window is a missed reward.",
				"row.poolAutoCheckinToday": "Today: {done} of {total} checked in",
				"row.poolAutoCheckinDone": "Today: all {total} checked in",
				"row.poolAutoCheckinPending": "{count} still to retry",
				"row.poolAutoCheckinFailed": "Last attempt failed: {message}",
				"row.poolManualAccountLabel": "Which account to use",
				"row.poolManualAccountNone": "No account in effect",
				"row.poolTargetLabel": "Test model (whole pool)",
				"row.poolTargetHint": "One model for every account here — the test measures each row with it. Auto picks a zero-multiplier model from this region catalog, preferring the largest context window; a manual choice wins.",
				"row.poolTargetAutoOption": "Auto — pick a free model",
				"row.poolTargetStaleOption": "Saved target no longer offered: {model}",
				"row.poolProbeSizeLabel": "Test request size",
				"row.poolProbeSizeHint": "How much text a test sends. A larger test is more truthful but costs more credit each.",
				"row.poolProbeSizeDefault": "Default (25K)",
				"row.poolProbeSizeOption": "{tokens}K tokens",
				"row.poolSaved": "Save",
				"row.poolSaving": "Saving…",
				"row.poolSaveFailed": "Could not save: {message}",
				"row.poolSavedStaleRefresh": "Saved, but the panel could not re-read it. The value is stored; the next refresh will show it.",
				"row.poolDiscard": "Discard changes",
				"row.poolDirty": "● Unsaved changes",
				"row.poolLogTitle": "Activity",
				"row.poolLogClear": "Clear",
				"row.poolLogEmpty": "Nothing yet. Tests and account switches are recorded here.",
				"row.poolLogTestStart": "Testing {count} account(s) against {model}",
				"row.poolLogTestRow": "{accountName}: {outcome}",
				"row.poolLogTestDone": "Test finished; the pool was re-ranked",
				"row.poolLogTestRowMalformed": "{accountName}: the host returned no result for this account",
				"row.poolLogBatchFailed": "Batch failed — nothing ran: {message}",
				"row.poolLogTestNoneRan": "Nothing was tested: no checked account in this pool has a usable PAT right now.",
				"row.poolMembersTitle": "Accounts in this pool",
				"row.poolMembersHint": "Only checked accounts rotate, get checked in, and get tested.",
				"row.poolSelectAll": "Select all",
				"row.poolSelectNone": "Clear all",
				"row.poolSelectedCount": "{count} of {total} selected",
				"row.poolNoneSelectedHint": "Check at least one account to enable check-in and test.",
				"row.poolSelectAria": "Include {accountName} in this region's account pool",
				"row.poolCurrentBadge": "In use",
				"row.poolCurrentHeader": "In use: {account}",
				"row.poolCurrentHeaderFailover": "In use: {account} (taking over for the benched selection)",
				"row.poolCurrentBadgeFailover": "Takeover",
				"row.poolCurrentHintFailover": "The pool is on and the selected account is currently benched: every request still goes to the selection first, and only when it is rejected before the first byte does this account take over and get billed. That is why this row says \"in use\" while the selection reads \"usage limit reached\" — both are true.",
				"row.poolCurrentHintSelected": "This account is the region's explicit selection, so requests go straight to it.",
				"row.poolCurrentHeaderUnavailable": "No account usable right now",
				"row.poolCurrentHintUnavailable": "Every member of this pool is benched (rate-limited, out of quota, rejected, or the model is busy) — including the saved selection. No row says \"in use\", because nothing is serving: the next request will fail rather than bill anyone. This clears on its own once an account's cooldown expires.",
				"row.poolNotMember": "Not in pool",
				"row.poolServingOutside": "“{account}” is serving right now but is not in this pool: rotation will not pick it, and batch check-in and test will not touch it.",
				"row.poolUnsavedMembers": "Selection changed — save to apply",
				"row.poolRowTest": "Test",
				"row.poolRowDelete": "Delete",
				"row.poolRowDeleteHint": "Delete this account for good: its stored PAT is erased, and it drops out of the pool and the region selection. To only take it out of the rotation, untick it and save instead.",
				"row.poolRowDeleteAria": "Delete the account {accountName}",
				"row.poolDeleteConfirm": "Delete {accountName} for good? Its stored PAT is erased and cannot be recovered.",
				"row.poolDeleteConfirmAria": "Confirm deleting {accountName}",
				"row.poolDeleteConfirmYes": "Delete for good",
				"row.poolDeleteCancel": "Keep it",
				"row.poolRowDeleting": "Deleting the account…",
				"row.poolRowRemoved": "{accountName}: deleted, along with its stored PAT.",
				"row.poolErrNotDeletable": "This account's PAT does not come from this plugin — it comes from the app's settings or the environment, where it is managed outside here. Remove it there instead.",
				"row.poolErrUnavailable": "The account pool is not available in this build (or its batch route is missing). Restart the app; if it persists, the plugin needs reinstalling.",
				"row.poolErrFailed": "The batch failed on the host side: {message}",
				"row.poolErrHttp": "The batch was refused (HTTP {status}). Check the plugin is up to date and try again.",
				"row.poolErrNoMembers": "No account is checked into this pool — the batch had nothing to run. Check at least one account and save.",
				"row.poolErrNoLiveMembers": "No checked account currently has a usable PAT, so the batch had nothing to run.",
				"row.poolErrNoFreeModel": "This region has no zero-multiplier model to test with. Refresh the model catalog, or pick a target model yourself.",
				"row.poolErrNoCheckin": "This region has no daily check-in — the action is not offered here.",
				"row.poolErrStaleModel": "The target model is no longer offered by this region. Pick another, or switch back to automatic.",
				"row.poolErrRouteMissing": "The batch route answered 405 with no response body. This is the host process answering for a route it never registered — restart the app; do not reinstall or upgrade this plugin.",
				"row.requestFailed": "Request failed",
				"row.requestFailedHint": "Refresh failed — showing the last loaded data: {message}",
				"row.showCreditsCn": "Show QD CN credits in the composer",
				"row.showCreditsGlobal": "Show QD AI credits in the composer",
				"row.showCreditsCnHint": "Show the CN (QD CN) credit balance in the composer toolbar, but only while this session uses a CN model. Click it for per-account balances and a manual refresh (refreshes by itself every 5 minutes).",
				"row.showCreditsGlobalHint": "Show the international (QD AI) credit balance in the composer toolbar, but only while this session uses a global model. Click it for per-account balances and a manual refresh (refreshes by itself every 5 minutes).",
				"row.showCampaigns": "Show campaigns",
				"row.showCampaignsHint": "Show this region's campaign feed (the daily check-in offer and any limited-time banners the upstream is sending) above the tabs. Read-only — claiming stays in the account pool. Turn it off and the page goes straight to accounts; nothing else changes.",
				"row.showCreditsCnDesc": "A clickable readout in the composer toolbar (shown only while this session uses a CN model): \"QD CN · balance\". Where it sits is the next line.",
				"row.showCreditsGlobalDesc": "A clickable readout in the composer toolbar (shown only while this session uses a global model): \"QD AI · plan\". Where it sits is the next line.",
				"row.creditPositionLabel": "Position",
				"row.creditPositionAria": "Credit readout position for {region}",
				"row.creditPositionComposer": "In the composer toolbar",
				"row.creditPositionStats": "Below the composer",
				"row.creditPositionHint": "Where the credit readout sits. \"In the composer toolbar\" is the closer spot, but that row is a shared list slot — if another plugin parks something there and the readout disappears, choose \"Below the composer\" (the ambient row next to the session token counts).",
				"row.sidebarPanelLabel": "Show Qoder in the sidebar",
				"row.sidebarPanelHint": "Adds a Qoder row to the DSH sidebar that opens this page as a full-screen panel. Off by default: the row takes a global sidebar slot shared by every installed plugin, and Settings → Qoder already reaches the same content. Takes effect on the click — no Save needed — and switching it off while the page is open returns you to the conversation.",
				"row.sidebarPanelFailed": "Could not change the sidebar setting: {message}",
				"row.pollMinutesLabel": "Auto-refresh upstream",
				"row.pollMinutesHint": "How often the settings page and the composer credit readout re-read usage from upstream, in minutes. One global rhythm for both regions and both surfaces — they ask the same route and near-simultaneous reads are coalesced into one upstream call. Takes effect immediately; no Save needed.",
				"row.pollMinutesAria": "Upstream auto-refresh interval",
				"row.pollMinutesOption": "Every {minutes} min",
				"row.pollMinutesFailed": "Could not change the refresh interval: {message}",
				"nav.panel": "Qoder",
				"nav.back": "Back to conversation",
				"row.quotaExhaustedTitle": "Upstream reported quota exhausted",
				"row.quotaExhaustedDetail": "Last seen at {time} (business code {code}). Per-account detail lives in the pool table when the pool is on; this notice is the only surface when it is off.",
				"composer.pointsCn": "QD CN",
				"composer.pointsGlobal": "QD AI",
				"composer.panelTitleCn": "QD CN credits",
				"composer.panelTitleGlobal": "QD AI credits",
				"composer.account": "Account",
				"composer.dedicated": "SOTA",
				"composer.dedicatedHint": "Exclusive credits, used first when you pick the model they are tied to. Not counted in the credits column: they cannot be spent on any other model.",
				"composer.dedicatedExpires": "Expires {time}",
				"composer.dedicatedMultiple": "{count} exclusive packages (see each balance below)",
				"composer.credits": "Credits",
				"composer.switchTo": "Switch to {account}",
				"composer.noAccounts": "No account in this region",
				"composer.signedOut": "Not signed in",
				"composer.openSettings": "Settings",
				"composer.openSettingsHint": "Open Settings → Qoder (account pool, model catalog, diagnostics)",
				"composer.refresh": "Refresh",
				"composer.refreshing": "Refreshing…",
				"composer.refreshHint": "Refresh the status of every account in this region — probes each one, one at a time (spends a small amount of credits, takes up to a minute)",
				"composer.refreshAccountsFailed": "Could not refresh the account status",
				"composer.refreshFailed": "Could not refresh credits",
				"composer.lastRefresh": "Last refreshed",
				"composer.dataStale": "not updated",
				"composer.currentPick": "In use",
				"composer.billingAccount": "Balance of the account billing right now: {name}",
				"composer.panelTitle": "Qoder credits",
				"promo.locale": "en"
			}
		};
		//#endregion
		//#region src/client/settings-jump.ts
		/**
		* 通往本插件**设置页分区**（设置 → Qoder）的路。两条，好的一条在前。
		*
		* ## 两条路
		*
		* 1. **外壳自己的 store 座位** —— 一次调用，精确，不依赖时序：
		*    `slots.entries('sidebar.settings')[0].store.create().actions.openSection(id)`。
		* 2. **驱动真实 chrome** —— 点侧边栏的设置触发器，等面板挂上，再按导航标签点
		*    本插件那一行。
		*
		* 第 1 条正是这颗按钮该做的事（「点一下，设置直接落在本插件这一页」），且在本插件
		* 支持的宿主线上都在。第 2 条保留给外壳还没有座位的老线：那里它仍能把用户送到本
		* 插件页，删掉等于拿可用的兜底换一个空。第 1 条在有座位的地方**严格更好**：
		* `openSection(id)` 一次同时设 `activeId` 与 `open`，不存在「先停在别的分区再跳」
		* 的重试窗口，也不依赖导航行的本地化文案。
		*
		* ## 为什么座位是合法的公开面（读过的，不是照抄兄弟项目）
		*
		* 从随包发布的宿主里逐条读出来（0.2.2-rc.1，`ui-settings-general` 的 client bundle）：
		*
		*     ctx.remoteAccess.whenAccess('settings/describe', () => ctx.slots.inject('sidebar.settings', () => {
		*       const shellHandle = createSettingsShellStore()
		*       const shellInstance = shellHandle.create()
		*       const shellStore = { ...shellHandle, create: () => shellInstance }
		*       …
		*       ctx.slots.register({ name: 'sidebar.settings', locale: NS, store: shellStore, … })
		*     }))
		*
		* 以及 store 本身：
		*
		*     defineStore({
		*       init: () => ({ open: false, activeId: void 0 }),
		*       actions: {
		*         open:        (d) => { d.open = true },
		*         close:       (d) => { d.open = false; d.activeId = void 0 },
		*         select:      (d, id) => { d.activeId = id },
		*         openSection: (d, id) => { d.activeId = id; d.open = true },
		*       },
		*     })
		*
		* 三件事都承重：
		*
		*  - `create: () => shellInstance` 把座位**钉在**外壳唯一的活动实例上。裸句柄每次
		*    `create()` 另造一份，`openSection` 推动的就是一个没人渲染的副本。
		*  - `store` 是注册的**声明字段**（契约里写的是「Declared store seat; instance
		*    resolution and lifecycle live with the host machinery」），`slots.entries(key)`
		*    是公开服务方法（宿主自己的 client 测试就是这么读这块座位的）。
		*  - **只有 `openSection` 能回答这个需求。** 公开契约里 `settings.section` 的注册方
		*    只拿到 `close`；`settings.launcher` 拿到的是不带 id 的 `openSettings`；
		*    `openSection(id)` 只发给 `settings.onboarding` 的步骤。为了拿它去注册一个假的
		*    首启步骤，比读一块外壳自己发布的座位侵入得多。
		*
		* ## 为什么每次**按下**才探测，而不是 `apply` 时探测一次
		*
		* 座位属于**另一个 bundle**，它的 apply 顺序不归我们假设。在 `apply` 里探一次，
		* 在侧边栏后加载的宿主上会永远拿到 `undefined`，那颗按钮整个会话都是死的。
		* `entries()` 对未声明的槽位返回 `[]`，所以每次按下现探是无状态且永远当前的。
		*
		* ## 第 2 条路（驱动 chrome）为什么留着
		*
		* 本插件声明的宿主范围跨到了可能早于该座位的 shell 线。座位缺席时旧路仍把用户送到
		* 本插件页，所以不能删。它现在是**第二选择**，这意味着它已知的弱点（导航行按本地化
		* 标签匹配，我们没出过的语种匹配不上）再也不会影响有座位的宿主。
		*
		*   1. 点外壳的设置触发器（`aria-haspopup="dialog"` + `aria-expanded`）—— 除非面板
		*      已经开着，那时再点会把它关掉，跳转变成「消失」；
		*   2. 等面板挂上（它按需渲染到 body）；
		*   3. 按**标签**找到本插件那一行并点它。
		*
		* ## 为什么它从不抛异常
		*
		* 每一步都从渲染路径被调用（积分浮层里的一个点击处理器）。这里抛出去毁的是整块读数，
		* 而不是一颗按钮 —— 所以每一级各自吞掉自己的失败，外壳形状不同时整次跳转降级成
		* 静默 no-op。
		*
		* @module dsh-connect-qoder/client/settings-jump
		*/
		/**
		* 设置面板的容器选择器。
		*
		* `data-shortcut-modal="settings"` 是外壳自己写的属性（快捷键路由靠它判断
		* 「当前弹出的模态是不是设置」），比任何类名都稳 —— 类名是 CSS Modules 的哈希。
		*/
		const SETTINGS_PANEL_SELECTOR = "[data-shortcut-modal=\"settings\"]";
		/** 侧边栏那颗设置触发器：对话框语义 + 展开状态。 */
		const TRIGGER_SELECTOR = "button[aria-haspopup=\"dialog\"][aria-expanded]";
		/** 外壳发布设置状态句柄的那个槽位。 */
		const SETTINGS_SLOT = "sidebar.settings";
		/**
		* 面板挂载 + 导航行渲染的等待预算。
		*
		* 面板是点击后**同步**挂到 body 的，但导航行的 `label` 要等 locale 快照，
		* 所以在同一帧里查一次往往差一点点。四次、每次 70ms：足够覆盖一次布局，
		* 又短到用户感知不到「点了没反应」。
		*
		* 只有第 2 条路（驱动 chrome）用到它：第 1 条路一次调用就落地。
		*/
		const RETRY_DELAYS_MS = [
			0,
			70,
			70,
			120
		];
		function defaultSchedule(run, ms) {
			try {
				window.setTimeout(run, ms);
			} catch {
				run();
			}
		}
		function buttonsIn(scope) {
			return Array.from(scope.querySelectorAll("button"));
		}
		/** 找到标签等于本插件行的那颗导航按钮。 */
		function findSectionRow(scope, label) {
			const want = label.trim();
			if (want === "") return void 0;
			return buttonsIn(scope).find((button) => (button.textContent ?? "").trim() === want);
		}
		/**
		* 通过外壳的 store 座位打开设置并选中本插件分区。
		*
		* @returns `'opened'` = 对话框已经停在正确的分区上（完事）；`'shell'` = 对话框
		*   已打开但没预选（第 2 条路还能去点那一行）；`undefined` = 座位缺席或不可用。
		*/
		function openThroughStoreSeat(get, sectionId) {
			let slots;
			try {
				slots = get("slots");
			} catch {
				return;
			}
			if (slots === void 0 || typeof slots.entries !== "function") return void 0;
			let seat;
			try {
				seat = slots.entries(SETTINGS_SLOT)[0]?.store;
			} catch {
				return;
			}
			if (seat === null || typeof seat !== "object") return void 0;
			const handle = seat;
			if (typeof handle.create !== "function") return void 0;
			try {
				const instance = handle.create();
				const openSection = instance?.actions?.openSection;
				if (typeof openSection === "function") {
					openSection(sectionId);
					return "opened";
				}
				const open = instance?.actions?.open;
				if (typeof open === "function") {
					open();
					return "shell";
				}
			} catch {}
		}
		/**
		* 打开设置面板并选中本插件的分区。
		*
		* @returns 是否**采取了**某条路（`false` = 一条都走不了，外壳不可识别且
		*   `onGiveUp` 已经跑过）。
		*/
		function openQoderSettingsSection(options) {
			const { doc = document, label } = options;
			const schedule = options.schedule ?? defaultSchedule;
			const sectionId = options.sectionId ?? "dsh-connect-qoder";
			if (options.get !== void 0) {
				let seatResult;
				try {
					seatResult = openThroughStoreSeat(options.get, sectionId);
				} catch {
					seatResult = void 0;
				}
				if (seatResult === "opened") return true;
			}
			try {
				if (doc.querySelector(SETTINGS_PANEL_SELECTOR) === null) {
					const collapsed = Array.from(doc.querySelectorAll(TRIGGER_SELECTOR)).find((button) => button.getAttribute("aria-expanded") !== "true");
					if (collapsed === void 0) {
						try {
							options.onGiveUp?.();
						} catch {}
						return false;
					}
					collapsed.click();
				}
				let clicked = false;
				let remaining = RETRY_DELAYS_MS.length;
				for (const delay of RETRY_DELAYS_MS) schedule(() => {
					if (clicked) return;
					remaining -= 1;
					try {
						const row = findSectionRow(doc.querySelector(SETTINGS_PANEL_SELECTOR) ?? doc, label());
						if (row !== void 0) {
							clicked = true;
							row.click();
							return;
						}
					} catch {}
					if (remaining === 0) try {
						options.onGiveUp?.();
					} catch {}
				}, delay);
				return true;
			} catch {
				return false;
			}
		}
		//#endregion
		//#region src/client/index.tsx
		/**
		* Browser half: Qoder accounts, credits and model management, rendered as a
		* **Settings page** (`settings.section`).
		*
		* 注册形态沿用 dsh-connect-workbuddy 的 `client/index.tsx`：`slots` / `locale`
		* 两项注入、`LocaleNamespaceMap` 模块增强、apply 体包 try/catch 以便槽位 API
		* 变更时降级为 console.error 而不触发红色横幅。
		*
		* 1.18.0 起配置入口不再挂在插件市场详情页的卡片上
		* （`plugins.bundle.config` / `plugins.row.config` 两处注册已删除），而是设置面板
		* 左侧导航里的独立一页；同一份正文另有一个 opt-in 的侧边栏整屏入口。
		*
		* @module dsh-connect-qoder/client
		*/
		/** Stable browser-plugin name. */
		const name = "dsh-connect-qoder-client";
		/** Client services required by the Plugin configuration contribution. */
		const inject = ["slots", "locale"];
		/** Register card copy and the Qoder card under Plugin configuration. */
		function apply(ctx) {
			try {
				const namespace = "settings.qoder";
				ctx.effect(() => ctx.locale.register(namespace, qoderLocales), "dsh-connect-qoder: settings copy");
				const t = ctx.locale.bind(namespace);
				const softGet = (name) => ctx.get(name);
				/**
				* 打开本插件的设置页（「设置 → Qoder」）。
				*
				* 由 `settings-jump.ts` 在 DOM 里自己找路（点侧边栏的设置触发器 → 在面板里
				* 按导航标签找本插件那一行 → 点它），不依赖任何宿主服务到货 —— 所以它在
				* `apply` 里就有一个确定的值，积分面板那颗按钮因此**总是**渲染。
				*
				* 唯一的外部依赖是 `pluginNavigation.openBundle(<npm 包名>)`，而它只在跳转
				* 找不到导航行时被当作退路：那时把用户送回插件市场本插件那一页，比一颗点了
				* 没反应的按钮好。它是软探测（`ctx.get`），缺席时退路静默不做任何事 ——
				* 绝不能把它写进 `inject: ['slots','locale']`，那会让整个客户端插件在没装
				* Plugins 页的 profile 上不激活（读数、模型徽标一起消失）。
				*/
				let openPluginSettings;
				let settingsScope;
				const forms = softGet("configForms");
				/**
				* 设置页分区（`settings.section`）—— 本插件**唯一**的配置入口。
				*
				* 从 1.18.0 起，配置界面不再挂在插件市场详情页的卡片里
				* （`plugins.bundle.config` / `plugins.row.config` 两处注册已删除），而是
				* 注册成设置面板左侧导航里的独立一页，与「账号与余额 / 通用设置 / 模型 /
				* 插件」并列。理由是那张卡片一直兼任两件事：它是插件列表里的一行（谁装的、
				* 在跑什么），同时又是一整页配置（PAT、账号池、模型目录、诊断）。把入口
				* 挪进设置之后，插件列表只回答「装了什么」。
				*
				* **没有能力探测**：`settings.section` 是 0.2.1-rc.5 才引入的槽位，而本插件
				* 的 peer 下限更低，但 `ctx.slots.inject()` 本身就是探测 —— 宿主没声明这个
				* 槽位时它只等待、不抛错、也不执行回调，插件其余部分完全不受影响。反过来
				* 写一层 `typeof ctx.slots.specOf === 'function'` 的探测会让失败的探测静默
				* 关掉整页（兄弟项目 dsh-subagent-default-model 2.1.16/2.1.17 就是这么丢了
				* 整个设置页的）。**探测失败必须往「能用」的方向失败。**
				*
				* 图标与页面在**同一个** `inject` 回调里注册、disposer 成对返回：外壳给导航
				* 行取图标用的是 `renderSlot('settings.section.icon', …, { only: row.id })`，
				* id 必须与页面完全一致才会命中，否则静默回落到默认齿轮。
				*/
				const registerSection = () => {
					try {
						return ctx.slots.inject("settings.section", () => {
							const disposers = [];
							disposers.push(ctx.slots.register({
								name: "settings.section",
								id: QODER_SETTINGS_NS,
								order: 30,
								label: () => t("section.label"),
								locale: namespace,
								inject: () => settingsScope === void 0 ? {
									t,
									surface: "section"
								} : {
									t,
									settingsScope,
									surface: "section"
								}
							}, QoderCard));
							try {
								const iconDisposer = ctx.slots.inject("settings.section.icon", () => ctx.slots.register({
									name: "settings.section.icon",
									id: QODER_SETTINGS_NS,
									locale: namespace
								}, QoderSectionIcon));
								if (typeof iconDisposer === "function") disposers.push(iconDisposer);
							} catch (error) {
								console.error("[dsh-connect-qoder] settings.section.icon failed to register (page still renders):", error);
							}
							return () => {
								for (const dispose of disposers) try {
									dispose();
								} catch {}
							};
						});
					} catch (error) {
						console.error("[dsh-connect-qoder] settings.section failed to register (host provider unaffected):", error);
						return;
					}
				};
				/**
				* Credit readout in the composer row (`conversation.input.right`, a
				* session-scope list slot rendered immediately before the model picker).
				*
				* `input.right` 而不是 `input.left`（同步自 dsh-connect-trae 的 issue #71）：
				* 宿主把 `input.right` 渲染在 `div.trailing` 的 `standardControls` 内、模型
				* 选择器**之前**，而 `input.left` 在 `div.tools` 最末尾、距权限选择器只有
				* 8px。两者都是可点元素，想点「完全权限」会点到读数并弹出积分浮层。
				* 读数是读数不是按钮，挨着模型选择器就不再和用户真正想点的控件争位置。
				* `composer` 这个设置值含义不变（「带模型选择器的那一行」），老 profile
				* 无需迁移。
				*
				* 参考：dingminhua/dsh-connect-workbuddy（MIT，Copyright (c) 2026 LaoDing）
				*   — 该项目的 `registerComposerCredits`：无条件注册插槽、由 gate 读
				*     `modelSelection` 投影自行决定是否渲染。Qoder 沿用同一形态；不同在于
				*     读数标注与 provider 路由不同（`qoder` / `qoder-global`）。
				*
				* Provider-scoped on purpose: it renders only while the session's selected
				* model belongs to this plugin, which keeps two connector plugins from
				* competing for one shared row. Registration is unconditional; the gate
				* reads the Host's `modelSelection` projection and returns null for every
				* other provider.
				*/
				const registerComposerCredits = () => {
					try {
						return ctx.slots.inject("conversation.input.right", () => ctx.slots.register({
							name: "conversation.input.right",
							id: "dsh-connect-qoder-composer-credits",
							order: 4,
							locale: namespace,
							inject: () => ({
								t,
								position: "composer",
								...settingsScope === void 0 ? {} : { settingsScope },
								...openPluginSettings === void 0 ? {} : { openSettings: openPluginSettings }
							})
						}, ComposerCreditsGate));
					} catch (error) {
						console.error("[dsh-connect-qoder] composer credits slot failed to register (host provider unaffected):", error);
						return;
					}
				};
				/**
				* 同一个读数，注册在输入框卡片下方的常驻栏（`conversation.composer.dock`）。
				*
				* 与输入框席位一样**无条件注册**，因为「两个席位选哪个」这个决定在 gate 里：
				* 它只在设置点名的席位渲染、在另一个席位 return null。只注册被选中的席位，
				* 就意味着每次改设置都要重新注册插槽——而本仓库已写明这种绑定是脆的（晚到的
				* settings 命名空间必须产生新注册而非改闭包）。
				*
				* 参考：dingminhua/dsh-connect-workbuddy 的 `registerStatsCredits`（issue #62，
				* MIT，Copyright (c) 2026 LaoDing）。Qoder 沿用同一形态；不同在于读数标注与
				* provider 路由（`qoder` / `qoder-global`）。
				*
				* 这个席位为什么存在：输入框工具栏是**共享的 list 插槽**，任何其他 bundle 都
				* 注册在那里，而 list 插槽无法保证每个占用者都可见——第三方插件把读数挤没的
				* 报告正是这么来的。这一行是 shell 渲染自己「轮次 / tok/s / token / 缓存命中」
				* 的地方，本来就是用户读会话数字的位置；`order` 10 排在 shell 统计（注册在 0）
				* 之后，所以自带统计仍在最左，读数是**追加**而不是顶替。
				*/
				const registerStatsCredits = () => {
					try {
						return ctx.slots.inject("conversation.composer.dock", () => ctx.slots.register({
							name: "conversation.composer.dock",
							id: "dsh-connect-qoder-stats-credits",
							order: 10,
							locale: namespace,
							inject: () => ({
								t,
								position: "stats",
								...settingsScope === void 0 ? {} : { settingsScope },
								...openPluginSettings === void 0 ? {} : { openSettings: openPluginSettings }
							})
						}, ComposerCreditsGate));
					} catch (error) {
						console.error("[dsh-connect-qoder] stats credits slot failed to register (host provider unaffected):", error);
						return;
					}
				};
				/**
				* 把本插件贡献的所有槽位收口成一组注册，供 `rebindSlots` 统一 dispose/重建。
				* 参考：dingminhua/dsh-connect-workbuddy（MIT）的 `registerAllSlots` ——
				* settings 命名空间的绑定与槽位注册必须**一起**移动：晚到的 namespace 必须
				* 产生全新的注册而非改写旧闭包，否则渲染器按 entry 身份缓存 inject 结果，
				* 旧注册永远不被重新求值（issue #55：空 Plugins 页且无报错）。
				*/
				const registerModelLabel = () => {
					/** 失败路径：eager 与 deferred 两种调用共用一处（所以声明在 try 之外）。 */
					const refuse = (error) => {
						console.error("[dsh-connect-qoder] model label slot failed to register (host provider unaffected):", error);
					};
					try {
						const label = createQoderModelLabel({
							entries: (key) => ctx.slots.entries(key),
							bindLocale: (ns) => ctx.locale.bind(ns)
						});
						return ctx.slots.inject(QODER_MODEL_LABEL_SLOT, () => {
							const registry = ctx.slots;
							const seats = modelLabelSeats({
								name: QODER_MODEL_LABEL_SLOT,
								kind: declaredSlotKind(ctx.slots, QODER_MODEL_LABEL_SLOT),
								providerIds: QODER_MODEL_LABEL_PROVIDERS,
								priority: QODER_MODEL_LABEL_PRIORITY
							});
							try {
								return registerModelLabelSeats(seats, (seat) => registry.register({
									...seat,
									locale: namespace
								}, label));
							} catch (error) {
								refuse(error);
								return () => {};
							}
						});
					} catch (error) {
						return refuse(error);
					}
				};
				const registerAllSlots = () => [
					registerSection(),
					registerComposerCredits(),
					registerStatsCredits(),
					registerModelLabel()
				].filter((disposer) => disposer !== void 0);
				/** 当前绑定下已注册的槽位 disposer。 */
				let liveDisposers = [];
				/**
				* 设置面板左侧导航那一格的图标（`settings.section.icon`）。
				*
				* 外壳以 `{ size, active }` 渲染它，尺寸由外壳给（不是硬编码 16），选中态
				* 由外壳围着画、我们只把未选中时的不透明度降一档。`inline: true` 的槽位把
				* cell 包在 `<span>` 里，所以用 `<img>` + `display:block` 精确占位，不破坏
				* 导航行的基线。
				*/
				function QoderSectionIcon(props) {
					const edge = typeof props.size === "number" && props.size > 0 ? props.size : 16;
					return (0, react.createElement)("img", {
						className: "dsm-qoder-section-icon",
						src: QODER_PLUGIN_ICON,
						alt: "",
						width: edge,
						height: edge,
						style: {
							width: `${edge}px`,
							height: `${edge}px`,
							display: "block",
							borderRadius: "3px",
							objectFit: "contain",
							opacity: props.active === false ? .75 : 1
						},
						"aria-hidden": "true"
					});
				}
				/**
				* 侧边栏那一行的图标（`sidebar.panellist` 的组件位置）。
				*
				* 侧边栏以 `{ size, active }` 在一个 `currentColor` 主题的图标格里渲染它，
				* 所以品牌标画成一个小 `<img>`：PNG 自己的颜色读起来就是插件的身份，选中
				* 状态由宿主围着它画。
				*
				* 参考：dsh-connect-workbuddy 的 `WorkBuddyPanelIcon`（PR #188，MIT，
				* Copyright (c) 2026 LaoDing）。
				*/
				function QoderPanelIcon(props) {
					const edge = typeof props.size === "number" && props.size > 0 ? props.size : 16;
					return (0, react.createElement)("img", {
						className: "dsm-qoder-panel-icon",
						src: QODER_PLUGIN_ICON,
						alt: "",
						width: edge,
						height: edge,
						"aria-hidden": "true"
					});
				}
				/**
				* DSH 侧边栏里的 Qoder 面板：一个 `sidebar.panellist` 行 + 一个 `main` 整页。
				*
				* 形态照宿主自己的 Plugins 行（`ui-plugin-manager`）：`id` 与 `main` 的
				* `key` 必须**同值**——侧边栏按钮点下去是「选中 id 等于自己的中央面板」，
				* 两者对不上就只是一个点了没反应的按钮。
				*
				* **OPT-IN**（`Config.sidebarPanel`，默认 false）。注册它不等于显示它：
				* `ui-sidebar` 那一行是拿插槽的**注册元数据**渲染的（`usePanels` →
				* `PanelRow`，标签取 `options.label`、图标取 `renderSlot(...)`），所以一个
				* 返回 `null` 的组件留下的是一个空白但**仍可点击**的按钮，而不是没有按钮。
				* 因此行只能在开关打开时注册——由 {@link syncPanelRegistration} 负责。
				* 见 `panel-switch.ts` 里那条 store 为什么必须在入口而不在组件。
				*
				* 返回对话复用宿主的 layout 服务：`selectPanel(null)` 把中央那一列交回会话。
				* 它是软探测的，所以一台不声明 `layout` 的宿主只是少一个返回按钮，不会整页
				* 卡死（与卡片对缺失 settings 表单的降级同规）。
				*/
				const registerPanel = () => {
					const PANEL_ID = QODER_SIDEBAR_PANEL_ID;
					const disposers = [];
					const backToConversation = () => {
						const layout = softGet("layout");
						if (layout !== void 0 && typeof layout.selectPanel === "function") layout.selectPanel(null);
					};
					try {
						disposers.push(ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
							name: "sidebar.panellist",
							id: PANEL_ID,
							order: 1,
							label: () => t("nav.panel"),
							locale: namespace
						}, QoderPanelIcon)));
					} catch (error) {
						console.error("[dsh-connect-qoder] sidebar panel row failed to register (host provider unaffected):", error);
					}
					try {
						disposers.push(ctx.slots.inject("main", () => ctx.slots.register({
							name: "main",
							key: PANEL_ID,
							locale: namespace,
							inject: () => settingsScope === void 0 ? {
								t,
								surface: "page",
								backToConversation
							} : {
								t,
								settingsScope,
								surface: "page",
								backToConversation
							}
						}, QoderCard)));
					} catch (error) {
						console.error("[dsh-connect-qoder] sidebar panel page failed to register (host provider unaffected):", error);
					}
					return disposers;
				};
				/**
				* 已在册的面板注册，**与 {@link liveDisposers} 分开**。
				*
				* 这是本插件唯一会随页面存活期来去的槽位（因为那个 opt-in 开关），单独持有
				* 它的意义是：翻开关不会把卡片、composer 读数等五个座位一起拆掉重建——那会
				* 让「插件」页为了一件与它无关的改动闪一下。
				*/
				let panelDisposers = [];
				/**
				* 让面板注册与 opt-in 开关保持一致。
				*
				* **先 dispose 再 register**，理由与 {@link rebindSlots} 相同：keyed 槽位的
				* 同一个 `key` / `id` 不能重复注册，那次抛错会被只打日志的 try/catch 吞掉，
				* 结果是「一个注册都没有」。
				*
				* 重新注册（而不是只注销）是 settings 作用域换绑之后也必须做的：渲染器按
				* entry 身份缓存 `inject` 的结果，作用域到货之前创建的 entry 会永远拿不到它。
				*/
				const syncPanelRegistration = () => {
					for (const dispose of panelDisposers) try {
						dispose();
					} catch {}
					panelDisposers = [];
					if (!sidebarPanelWanted()) return;
					panelDisposers = registerPanel();
				};
				/**
				* 用当前 `settingsScope` 重建全部槽位注册。先 dispose 旧的，再注册新的——
				* 顺序不能反（同 key 同优先级的 keyed 槽位重复注册会抛 "already has an entry"）。
				*/
				const rebindSlots = () => {
					for (const dispose of liveDisposers) try {
						dispose();
					} catch {}
					liveDisposers = [];
					liveDisposers = registerAllSlots();
					try {
						console.info(`[dsh-connect-qoder] registered ${String(liveDisposers.length)} slots (settings form: ${settingsScope === void 0 ? "none — card is read-only" : "bound"}, sidebar panel: ${sidebarPanelWanted() ? "on" : "off"})`);
					} catch {}
					syncPanelRegistration();
				};
				/**
				* 把 `settingsScope` 绑到宿主**真正在服务的**命名空间，并在该答案变化时重注册。
				*
				* 为什么不是启动时读一次：宿主的 `configForms` mirror 由异步
				* `remote.settings.describe()` 填充，apply 时刻通常还是空的。把这份空当成
				* 「声明名一定对」再 `forms.get(声明名)`，铸出的就是一个宿主并不服务的 form，
				* 它会永远 `unavailable`；宿主按命名空间**精确**匹配，所以猜错不会自己纠正
				* （workbuddy #46 的原始缺陷，qoder 这里不重踩）。
				*
				* `whileServed` 是宿主自己的惯用法（mirror 订阅 + 即时同步），只在
				* unserved→served 的**边缘**触发 register，且会顺着把旧注册 withdraw ——
				* 这正是「新命名空间要到货才能重绑」所需的语义。宿主若不支持（旧线），回退成
				* 「问一次镜像 + 绑上 + 注册一次」，代价是镜像晚到时绑错且不回看 —— 没有
				* 订阅机制时，这仍好过永远不注册。
				*
				* ⚠️ 监视的是 `QODER_SETTINGS_NAMESPACE_CANDIDATES` **整份表**，不是单一拼写：
				* 少一种拼写，宿主用那种拼写挂载时边缘就永不触发，回调里的 `/qoder/i` 兜底
				* 也随之成为死代码（见该常量的注释）。
				*/
				const bindSettingsScope = () => {
					if (forms === void 0 || typeof forms.whileServed !== "function") {
						if (forms !== void 0) {
							let ns = QODER_SETTINGS_NS;
							try {
								const served = (forms.describe().getSnapshot().view?.namespaces ?? []).find((entry) => QODER_SETTINGS_NAMESPACE_CANDIDATES.includes(entry.ns) || /qoder/i.test(entry.ns));
								if (served !== void 0) ns = served.ns;
							} catch {}
							settingsScope = forms.get(ns);
						}
						liveDisposers = registerAllSlots();
						return;
					}
					ctx.effect(() => forms.whileServed(QODER_SETTINGS_NAMESPACE_CANDIDATES, (served) => {
						const ns = QODER_SETTINGS_NAMESPACE_CANDIDATES.find((candidate) => served.has(candidate)) ?? [...served].find((entry) => /qoder/i.test(entry));
						settingsScope = ns === void 0 ? void 0 : forms.get(ns);
						rebindSlots();
						return () => {
							for (const dispose of liveDisposers) try {
								dispose();
							} catch {}
							liveDisposers = [];
						};
					}), "dsh-connect-qoder: settings namespace binding");
					rebindSlots();
				};
				/**
				* 「设置」按钮的目的地：**设置 → Qoder** 那一页。
				*
				* 1.18.0 之前这里等的是 `pluginNavigation.openBundle(包名)`（打开插件市场里
				* 本插件那一页），因为配置卡片就渲染在那儿。卡片搬进设置之后那个落点已经
				* 没有配置可看，所以改成驱动真实 chrome：`settings-jump.ts` 点开设置面板、
				* 再点本插件的导航行。
				*
				* 1.20.0 起先走**外壳自己的 store 座位**：设置外壳把状态句柄发布在
				* `sidebar.settings` 的 `store` 上，`create().actions.openSection(id)` 一次
				* 调用同时设 `activeId` 与 `open` —— 没有重试窗口，也不依赖导航行的文案。
				* 驱动 chrome 降为第二条路（老外壳没有座位时仍能到本插件页）。
				* 依据读自 0.2.2-rc.1 的 `ui-settings-general`，逐条记在 `settings-jump.ts`。
				*
				* **为什么还要留一条 `pluginNavigation` 的退路**：跳转靠导航行的**标签**定位，
				* 而标签是本地化字符串。万一宿主换了外壳（标签被截断、面板换了容器属性），
				* 那次跳转会落空；此时退回 `openBundle(包名)` 至少把用户送到插件市场那一页
				* ——比一颗彻底死掉的按钮好，也不会误导（那一页现在只说「已安装」，不再承诺
				* 有配置）。
				*
				* `openPluginSettings` 因此**总是**有值：不再取决于某个宿主服务是否到货。
				* 一颗「服务不到就不渲染」的按钮，在跳转这件事上已经没有必要 —— 跳转本身
				* 在 DOM 里自己找路。
				*
				* ⚠️ **必须在 `bindSettingsScope()` 之前赋值**（1.18.0 的第一个发布候选就把
				* 这颗按钮弄丢过）：`bindSettingsScope()` 会立刻 `registerAllSlots()` 跑一次
				* 首次注册，而 `inject` 闭包在**那一刻**读的就是 `openPluginSettings`。写在
				* 它后面，首次注册拿到的就是 `undefined` —— 积分面板据此不渲染那颗齿轮，
				* 之后也没有任何东西会再去纠正它。
				*
				* 也不能指望「之后再重绑一次」来救：渲染器对 `inject()` 的结果做了
				* `useMemo`（依赖是 `[actions, definition, scopeBinding]`），注册对象不变就
				* 不会重算 —— 只有**换掉 entry 身份**（重建注册）才会。那意味着每次改设置
				* 都要拆了重挂一遍 composer 读数，代价远大于「先赋值再注册」。
				*/
				openPluginSettings = () => {
					openQoderSettingsSection({
						label: () => t("section.label"),
						get: softGet,
						onGiveUp: () => {
							const navigation = softGet("pluginNavigation");
							if (navigation !== void 0 && typeof navigation.openBundle === "function") try {
								navigation.openBundle(QODER_PACKAGE_NAME);
							} catch {}
						}
					});
				};
				bindSettingsScope();
				/**
				* 跟随 opt-in 开关，并用 Host 的答案做**种子**。
				*
				* 种子是一次状态读取，而不是读 settings 作用域：这个命名空间的浏览器镜像
				* 在受影响的 0.1.7 部署上被记录为陈旧，而这里一个陈旧的 `false` 意味着那一
				* 行永远不会出现——之后也没有任何事件去纠正它，因为 `whileServed` 只在命名
				* 空间边缘触发、不在值变化时触发。Host 自己的答案才是权威
				* （usage 文档上的 `sidebarPanelEnabled`），与本插件其它 Host 承载开关一致。
				*
				* 读取失败**不是**要展示的错误：OFF 是一个合法答案，而且事实上就是默认值，
				* 所以一个连不上状态路由的插件只是没有那一行——用户在这里也无事可做。
				*
				* **订阅**才是让开关生效的东西：卡片在写入被验证之后调用
				* `setSidebarPanelWanted`，于是那一行出现或消失都不需要刷新。`ui-layout`
				* 会丢掉 `main` key 已不存在的 `activePanelId`，所以页面开着时关掉它，中央
				* 那一列自己回到对话。
				*/
				ctx.effect(() => subscribeSidebarPanelWanted(() => {
					syncPanelRegistration();
				}), "dsh-connect-qoder: sidebar panel opt-in");
				try {
					if (sidebarPanelEnabledOf(settingsScope?.getSnapshot().value) === true) setSidebarPanelWanted(true);
				} catch {}
				if (!sidebarPanelWanted()) (async () => {
					try {
						const response = await fetch(withQoderRegion(QODER_USAGE_PATH, "cn"), { headers: { accept: "application/json" } });
						if (!response.ok) return;
						if ((await response.json()).sidebarPanelEnabled === true) setSidebarPanelWanted(true);
					} catch {}
				})();
			} catch (error) {
				console.error("[dsh-connect-qoder] client apply failed:", error);
			}
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	}
});
