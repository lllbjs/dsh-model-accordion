window.__ModuleLoader__.load({
	id: "dsh-connect-trae",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		let react_dom = require("react-dom");
		//#region src/region.ts
		/** Every panel, in card tab order. */
		const TRAE_PANELS = [
			"cn",
			"enterprise",
			"ai"
		];
		/** The region whose credential/account pool a panel draws on. */
		function regionOfPanel(panel) {
			return panel === "ai" ? "ai" : "cn";
		}
		/** The provider id a panel publishes. */
		function providerOfPanel(panel) {
			if (panel === "enterprise") return "trae-enterprise";
			return panel === "ai" ? "trae-global" : "trae";
		}
		/** The panel that owns a provider id, or undefined for an unknown id. */
		function panelOfProvider(provider) {
			return TRAE_PANELS.find((panel) => providerOfPanel(panel) === provider);
		}
		//#endregion
		//#region src/status-paths.ts
		/** Plugin-owned usage endpoint consumed by its browser half. */
		const TRAE_USAGE_PATH = "/plugins/dsh-connect-trae/usage";
		/** Plugin-owned live model refresh endpoint. */
		const TRAE_MODELS_REFRESH_PATH = "/plugins/dsh-connect-trae/models/refresh";
		/**
		* Plugin-owned availability probe: POST the model ids to test, get one verdict
		* per model. Unlike every read-only sibling this route SPENDS quota — a real
		* (minimal) chat call per model — so it is user-initiated only, and the card
		* labels the button as consuming a small amount.
		*/
		const TRAE_MODELS_TEST_PATH = "/plugins/dsh-connect-trae/models/test";
		/** Plugin-owned local account rescan endpoint. */
		const TRAE_ACCOUNTS_REFRESH_PATH = "/plugins/dsh-connect-trae/accounts/refresh";
		/**
		* General balance of EVERY account in a region, for the composer panel's table.
		*
		* Separate from the usage route on purpose: the usage document backs the
		* 5-minute readout, and multiplying its upstream reads by the account count
		* would charge a healthy account for something it never looks at — the same
		* principle that keeps `creditAlternatives` firing only when a balance hits
		* zero. This one is paid when the panel is actually opened, which is the only
		* place the table is shown.
		*/
		const TRAE_ACCOUNT_CREDITS_PATH = "/plugins/dsh-connect-trae/account-credits";
		/**
		* Per-account status (check-in / credits / subscription) for the account table.
		*
		* Each row of the account table reads its OWN state through this route — a CN
		* row carries its check-in state and balance, an ai row its subscription.
		* POST with the accountId in the body: one upstream read per account, paid
		* only when the table is actually shown.
		*/
		const TRAE_ACCOUNT_STATUS_PATH = "/plugins/dsh-connect-trae/account-status";
		/**
		* Plugin-owned daily check-in claim endpoint. POST, loopback-only, and the only
		* route in this plugin that changes upstream account state. The accountId in
		* the body names WHICH account to claim for, so the button can sit in each
		* account row.
		*/
		const TRAE_CHECKIN_PATH = "/plugins/dsh-connect-trae/checkin";
		/**
		* Plugin-owned account-pool endpoint: one route for the pool's batch actions.
		*
		* 参考：`dsh-connect-workbuddy` 的 `WORKBUDDY_POOL_PATH`。本路由与该实现同形
		*   （同一 `?action=` 风格、POST、loopback-only、per-row `accountId`），这样同时
		*   装了两个插件的用户面对的是同一套交互。
		*
		* `?action=checkin` and `?action=test` run over the whole member set; `remove`
		* addresses ONE account (the body carries `accountId`) and is the only way a
		* measurement of an account the user no longer wants can leave the store — a
		* deleted member otherwise keeps its row in the file forever, and a re-added
		* member would silently inherit an old exclusion.
		*
		* POST + loopback-only because both batches SPEND something: check-in sends a
		* claim, and a test is a real chat call. A page that is not the Host's own
		* loopback must not be able to trigger either.
		*/
		const TRAE_POOL_PATH = "/plugins/dsh-connect-trae/pool";
		/** Query parameter selecting which pool batch action a request means. */
		const TRAE_POOL_ACTION_PARAM = "action";
		/** Query parameter naming ONE pool account a per-row request addresses. */
		const TRAE_POOL_ACCOUNT_PARAM = "accountId";
		/**
		* Address one panel's pool route with its action.
		*
		* Kept as its own helper (rather than a `withTraeRegion` + hand-appended
		* `&action=`) because a missing action parameter means "no action", not a
		* default one — the typo has to be impossible rather than merely unlikely.
		*/
		function withTraePoolAction(panel, action) {
			return `${TRAE_POOL_PATH}?${TRAE_REGION_PARAM}=${panel}&${TRAE_POOL_ACTION_PARAM}=${action}`;
		}
		/**
		* Address one panel's pool route for ONE account, e.g. a row's Test or Remove.
		*
		* Kept beside {@link withTraePoolAction} for the same reason that one exists: the
		* account id is a 24-char hex string, and hand-appending `&accountId=` at a call
		* site is one typo away from a request the route answers 400 to — or worse, from
		* one that addresses the wrong action. Both parameters are therefore spelled by
		* this module and nowhere else.
		*/
		function withTraePoolAccount(panel, action, accountId) {
			return `${withTraePoolAction(panel, action)}&${TRAE_POOL_ACCOUNT_PARAM}=${encodeURIComponent(accountId)}`;
		}
		/**
		* Plugin-owned account transfer endpoint: batch export and import of a region's
		* stored credentials (issue #37).
		*
		* One route with an `action` query parameter (`export` | `preview` | `import`),
		* mirroring the sibling `dsh-connect-workbuddy` plugin's transfer route so the
		* two cards behave the same way for a user who has both installed. The vault
		* document never leaves the Host: the browser receives parsed answers, and a
		* preview carries display fields only — never token material.
		*/
		const TRAE_TRANSFER_PATH = "/plugins/dsh-connect-trae/transfer";
		/** Query parameter naming the region a card request addresses. */
		const TRAE_REGION_PARAM = "region";
		/**
		* Address one region's status route. The two regions are separate provider
		* stacks; every card request carries the region whose tab the user is on.
		*/
		function withTraeRegion(path, panel) {
			return `${path}?${TRAE_REGION_PARAM}=${panel}`;
		}
		/**
		* Address one region's transfer route with its step, e.g.
		* `/plugins/dsh-connect-trae/transfer?region=cn&action=export`.
		*
		* Separate from {@link withTraeRegion} because this route carries a second
		* query parameter: a caller that appended `&action=` by hand would be one typo
		* away from a 400, which is exactly the failure the sibling workbuddy plugin
		* hit (#42) when five requests dropped that parameter.
		*/
		function withTraeTransferAction(path, panel, action) {
			return `${path}?${TRAE_REGION_PARAM}=${panel}&action=${action}`;
		}
		/** Query parameter asking for a thinner first-paint document (issue #77). */
		const TRAE_DETAIL_PARAM = "detail";
		/** The only recognised `detail` value: local state only, no upstream read. */
		const TRAE_DETAIL_FAST = "fast";
		/**
		* Address one panel's usage route asking for the FAST document, e.g.
		* `/plugins/dsh-connect-trae/usage?region=cn&detail=fast`.
		*
		* Kept beside {@link withTraeRegion} for the same reason as
		* {@link withTraeTransferAction}: the region is already a parameter, so a caller
		* appending `&detail=` by hand is one typo away from a request that silently
		* asks for the wrong document.
		*/
		function withTraeRegionFastDetail(path, panel) {
			return `${withTraeRegion(path, panel)}&${TRAE_DETAIL_PARAM}=${TRAE_DETAIL_FAST}`;
		}
		/**
		* Peel ONE `{get(): T}` live reference, the shape DSH 0.1.7 delivers a
		* volatile-marked settings field as (see {@link unwrapVolatileDeep}).
		*/
		function unwrapVolatile(value) {
			if (value !== null && typeof value === "object" && typeof value.get === "function") return value.get();
			return value;
		}
		/**
		* Deep copy of a value with every `{get(): T}` live reference replaced by the
		* value it resolves to.
		*
		* DSH 0.1.7 hands volatile-marked fields back as live references, and a live
		* reference is still `typeof === 'object'` — so it passes a naive object check
		* and every lookup on it is `undefined`. Worse, spreading one (`{ ...ref }`)
		* does NOT read the field: it produces `{ get: <function> }`. Any merge that
		* spreads a resolved field to preserve its siblings — the card's "write one
		* region, keep the other" write, or the account map's spread — would otherwise
		* DROP every sibling and leak a function into the document.
		*
		* Both halves therefore unwrap before touching a resolved field. This lives in
		* the node-free host↔client bridge because the browser half needs it too.
		*
		* Non-reference values are recursed into so a nested volatile field is caught
		* as well; arrays and objects are rebuilt rather than mutated, so the caller's
		* value is never touched.
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
		* Read the per-region account selections out of a settings value.
		*
		* SHARED because `accounts` now has TWO writers: the card, and the composer
		* panel's account table (2.14.0). Two writers of one field must use one merge
		* rule, or they drift — and the rule is not obvious.
		*
		* Deep-unwraps first: on DSH 0.1.7 a volatile field arrives as a `{get(): T}`
		* live reference, which passes the `typeof === 'object'` check and would be
		* returned as if it were the map. Every lookup on it is then `undefined`, and
		* the merge (`{ ...configured, [region]: id }`) would spread a reference into
		* `{get: <function>}` — dropping the other region's selection and leaking a
		* function into the settings document.
		*/
		function configuredAccountsOf(configured) {
			const accounts = unwrapVolatileDeep(configured)?.accounts;
			return typeof accounts === "object" && accounts !== null ? accounts : {};
		}
		/**
		* Build the next `regions` settings value for the card's save. The write
		* targets ONLY the signed-in account's region slot; every other region's slot
		* is carried over untouched, so switching accounts never clobbers the other
		* region's picks. Tolerates any stored shape (absent, non-object) by starting
		* from an empty document.
		*/
		function nextRegionSlots(regions, panel, slot) {
			const unwrapped = unwrapVolatileDeep(regions);
			return {
				...typeof unwrapped === "object" && unwrapped !== null && !Array.isArray(unwrapped) ? unwrapped : {},
				[panel]: slot
			};
		}
		/**
		* Narrow a settings value to the `regions` map. Accepts EITHER the whole
		* settings section (`{ regions: {...}, ... }`) or the `regions` map itself, and
		* unwraps the former. This tolerance is deliberate: passing the whole section
		* where the map was expected was a real shipped bug — the lookup then read
		* `section['cn']` (absent), so the card's checkbox reported `true` forever and
		* clicking it appeared to do nothing even though the write succeeded.
		*
		* Unwraps live references first: on DSH 0.1.7 the `regions` field arrives as a
		* `{get(): T}` reference, which passes the `typeof === 'object'` check below
		* and would otherwise be returned as if it were the map — making every region
		* read back as absent (and the enabled flag read as "on" forever).
		*/
		function regionsMapOf(value) {
			const unwrapped = unwrapVolatileDeep(value);
			if (typeof unwrapped !== "object" || unwrapped === null || Array.isArray(unwrapped)) return {};
			const record = unwrapped;
			const nested = record["regions"];
			if (typeof nested !== "object" || nested === null || Array.isArray(nested)) return record;
			const panelIds = TRAE_PANELS;
			return Object.keys(record).some((key) => panelIds.includes(key)) ? record : nested;
		}
		/** One region's stored slot as a plain object; any other shape reads as empty. */
		function regionSlotOf(value, panel) {
			const slot = unwrapVolatile(regionsMapOf(value)[panel]);
			return typeof slot === "object" && slot !== null && !Array.isArray(slot) ? slot : {};
		}
		/**
		* Whether one region's provider is switched on. Opt-out semantics: only an
		* explicit `false` disables it, so a config written before this switch existed
		* (and the pre-region-split flat fields, which never carry `enabled`) keep both
		* providers running exactly as before. The Host reads the same rule through
		* `regionStateOf`, so card and Host can never disagree about a region's state.
		*
		* `value` may be the whole settings section or the `regions` map (see
		* {@link regionsMapOf}).
		*/
		function regionEnabledOf(value, panel) {
			const stored = regionSlotOf(value, panel)["enabled"];
			if (typeof stored === "boolean") return stored;
			return panel !== "enterprise";
		}
		/**
		* Build the next `regions` settings value for a provider on/off toggle. ONLY
		* the target region's `enabled` flag changes: every other field of that slot
		* (its directory, selection, image opt-ins, context budgets) and every other
		* region's slot are carried over verbatim, so switching a provider off never
		* discards the user's model picks and switching it back on restores them.
		*
		* This is deliberately separate from {@link nextRegionSlots}: that helper
		* writes a whole slot from a signed-in tab's draft, while this one must work
		* for a region that is signed OUT — which is precisely the region a user wants
		* to switch off (no international install, no international account).
		*
		* `value` may be the whole settings section or the `regions` map; the RETURN
		* value is always the `regions` map, i.e. exactly what `settingsScope.set(
		* 'regions', ...)` needs.
		*/
		function nextRegionEnabled(value, panel, enabled) {
			return nextRegionSlots(regionsMapOf(value), panel, {
				...regionSlotOf(value, panel),
				enabled
			});
		}
		/**
		* Which seat one region's readout uses, defaulting to the composer row.
		*
		* Anything other than an explicit `'stats'` reads as `'composer'`, which covers
		* the two cases that matter: a profile written BEFORE this setting existed (the
		* composer row was the only seat, so an upgrade moves nothing on screen), and a
		* hand-edited value the schema does not know. Falling back rather than
		* rendering nowhere is deliberate — an unrecognized value must not make the
		* readout disappear, which is the very defect this setting exists to fix.
		*
		* `value` may be the whole settings section or the `regions` map (see
		* {@link regionsMapOf}).
		*/
		function regionCreditPositionOf(value, panel) {
			return regionSlotOf(value, panel)["creditPosition"] === "stats" ? "stats" : "composer";
		}
		/**
		* Build the next `regions` settings value for one region's credit seat.
		*
		* Same merge rule as every sibling region write: only the target region's
		* `creditPosition` changes, so a seat change cannot drop that slot's model
		* directory, selection, budgets or enabled flag, nor touch the other region.
		*
		* `value` may be the whole settings section or the `regions` map; the RETURN
		* value is always the `regions` map, i.e. exactly what `settingsScope.set(
		* 'regions', ...)` needs.
		*/
		function nextRegionCreditPosition(value, panel, position) {
			return nextRegionSlots(regionsMapOf(value), panel, {
				...regionSlotOf(value, panel),
				creditPosition: position
			});
		}
		/**
		* One panel's saved pool PREFERENCES, as the card's settings block edits them.
		*
		* Read from the settings document rather than from the usage answer for the same
		* reason `regionCreditPositionOf` is: the card must paint its controls correctly
		* on the FIRST frame, before any fetch lands, and a control that starts on a
		* default and jumps when data arrives is the "looks like it did nothing" defect.
		*
		* Absent reads as `{}` — every field of {@link TraePoolPreferences} is optional
		* by design, and a profile written by an older build has no `pool` slot at all.
		* The caller applies the defaults it means (OFF, automatic model, no members);
		* this function never invents them, because `targetModelId: ''` and
		* `targetModelId: undefined` mean the same thing and only the CALLER may decide
		* to collapse them.
		*
		* `value` may be the whole settings section or the `regions` map (see
		* {@link regionsMapOf}).
		*/
		function regionPoolOf(value, panel) {
			const unwrapped = unwrapVolatileDeep(regionSlotOf(value, panel)["pool"]);
			return typeof unwrapped === "object" && unwrapped !== null && !Array.isArray(unwrapped) ? unwrapped : {};
		}
		/**
		* Build the next `regions` settings value for one panel's pool preferences.
		*
		* Same merge rule as every sibling region write: only the addressed panel's
		* `pool` slot changes, so saving the pool cannot drop that slot's model
		* directory, selection, budgets, enabled flag or credit seat, and cannot touch
		* the other panels. Panels are independent even where they share credentials
		* (`cn` and `enterprise` bill the same Trae CN account): membership is a choice
		* per panel, not per credential.
		*
		* `value` may be the whole settings section or the `regions` map; the RETURN
		* value is always the `regions` map, i.e. exactly what `settingsScope.set(
		* 'regions', ...)` needs.
		*/
		function nextRegionPool(value, panel, pool) {
			return nextRegionSlots(regionsMapOf(value), panel, {
				...regionSlotOf(value, panel),
				pool
			});
		}
		/**
		* Panels whose text-to-image path this plugin has actually MEASURED, in
		* `TRAE_PANELS` tab order.
		*
		* ONE entry today. The other two are refused for the SAME reason — no evidence
		* — which is exactly the asymmetry the review of #62 held the PR on:
		*
		*  - `enterprise` bills through the tenant gateway, a second billing surface
		*    whose image behaviour has never been probed;
		*  - `ai` answers on `coresg-normal.trae.ai`, where no `tool_text_to_image`
		*    request has ever run either — every measurement behind this tool was
		*    taken against `trae-api-cn.mchost.guru`. Refusing one unverified gateway
		*    while serving another is not a rule, it is an accident.
		*
		* Adding a panel means adding its evidence in the same change (the precedent
		* for international claims is `docs/INTL_SG_EVIDENCE.md`). Order is
		* significant: the tool's resolver walks `TRAE_PANELS` order and takes the
		* FIRST consenting panel, so `cn` — the only measured one — always answers
		* first.
		*/
		const DRAW_IMAGE_PANELS = ["cn"];
		/**
		* Build the next `regions` settings value for one panel's 「允许模型自主生图」
		* switch (`drawImageEnabled`, `trae_draw_image`).
		*
		* Same merge rule as every sibling region write: only the addressed panel's
		* `drawImageEnabled` changes, so flipping the switch carries that slot's model
		* directory, selection, budgets, pool and credit seat through, and leaves the
		* other panels alone. The flag is a PANEL's consent, not the account's: cn and
		* enterprise bill the same Trae CN account but route through different gateways,
		* so consent must not cross the boundary (the tool resolver reads it per panel).
		*
		* `value` may be the whole settings section or the `regions` map; the RETURN
		* value is always the `regions` map, i.e. exactly what `settingsScope.set(
		* 'regions', ...)` needs.
		*/
		function nextRegionDrawImage(value, panel, enabled) {
			return nextRegionSlots(regionsMapOf(value), panel, {
				...regionSlotOf(value, panel),
				drawImageEnabled: enabled
			});
		}
		/**
		* Build the next `regions` settings value for one panel's MODEL DIRECTORY.
		*
		* The model-directory save REPLACES the whole region slot, so every field of
		* that slot must be carried through — the ones the save does not name are
		* silently dropped. Two were being dropped this way:
		*
		*  - `pool` (issue #44): the account-pool preferences. Enabling the pool and
		*    then saving the model list turned the pool back OFF, and the card came
		*    back showing "not saved" — the switch looked broken.
		*  - `creditPosition`: which seat this region's credit readout occupies, so
		*    saving the model list silently moved the readout back.
		*
		* Both are the user's standing choices, not the model directory's business.
		* The stored slot is therefore SPREAD and the directory fields override it, so
		* the save owns exactly the five fields it knows about and inherits the rest.
		*
		* `value` may be the whole settings section or the `regions` map; the RETURN
		* value is always the `regions` map, i.e. exactly what `settingsScope.set(
		* 'regions', ...)` needs.
		*/
		function nextRegionDirectory(value, panel, directory) {
			return nextRegionSlots(regionsMapOf(value), panel, {
				...regionSlotOf(value, panel),
				...directory
			});
		}
		/**
		* Whether Trae's plan identity says this account is on a paying plan.
		*
		* `has_package` alone is NOT that question — it reports whether a package
		* entitlement row exists, and a member can be on a plan without one (issue
		* #19: a Pro account rendered as "No active package"). Trae spells the plan in
		* `user_pay_identity_str`, so this reads that field, and only the exact word
		* `Free` counts as free: an unknown or future tier name is treated as paid,
		* because claiming "Free" for a tier we simply do not recognise is the more
		* damaging of the two errors.
		*/
		function traePlanIsPaid(payIdentityStr) {
			const tier = payIdentityStr?.trim();
			return tier !== void 0 && tier !== "" && !/^free$/i.test(tier);
		}
		//#endregion
		//#region src/context-budget.ts
		/**
		* Context-budget arithmetic shared by the HOST (which applies a saved budget to
		* the catalog DSH is told about) and the CLIENT card (which renders the radios).
		*
		* It lives in its own module because the client bundle cannot import
		* `catalog.ts` (host-only) and the two sides must agree EXACTLY on which
		* windows are selectable: a card that offers a window the host then refuses
		* would be a control that silently does nothing.
		*/
		/**
		* The one intermediate budget the card offers, in tokens: 500K.
		*
		* WHY IT EXISTS: Trae advertises a dev window (typically 200K/256K/272K) and a
		* Max window (typically 1M). Switching dev→Max is a 5× jump for a user who
		* just wants more room without paying Max-tier pricing for the whole session.
		* 500K is the half-way point, and it is only ever offered for a model whose
		* Max window is at least that wide.
		*
		* WHY A CONSTANT AND NOT A PER-MODEL VALUE: this is a LOCAL preference that
		* DSH uses to decide when to compress; it is not a Trae-advertised window. The
		* value must be sane for every model that can select it, so eligibility is
		* gated on `maxContextWindow >= 500000` rather than inventing a window per
		* model. `applyContextBudgets` additionally refuses any budget wider than what
		* the model advertises, so a stale saved value cannot overflow a shrunken Max.
		*/
		const TRAE_CONTEXT_BUDGET_MID = 5e5;
		/**
		* The selectable windows for one model, smallest first: dev, then 500K (only
		* when it is a genuine middle step), then Max. Duplicates are dropped so a
		* model whose dev window is already 500K offers it once.
		*
		* A model with no Max window yields exactly one option — its dev window — which
		* is what makes the card's radios read-only for such models.
		*/
		function contextBudgetOptions(model) {
			const dev = model.contextWindow;
			const max = model.maxContextWindow;
			const options = [];
			const push = (value) => {
				if (value === void 0 || value < 1) return;
				if (!options.includes(value)) options.push(value);
			};
			push(dev);
			if (max !== void 0 && max >= 5e5 && (dev === void 0 || 5e5 > dev)) push(TRAE_CONTEXT_BUDGET_MID);
			push(max);
			return options.sort((left, right) => left - right);
		}
		//#endregion
		//#region src/model-order.ts
		/**
		* Wire name of the default SOLO chat function.
		*
		* Lives here rather than in `solo.ts` so this module stays importable from the
		* client; `solo.ts` re-exports it, so there is still exactly one definition.
		*/
		const TRAE_SOLO_FUNCTION = "solo_work_lite";
		/**
		* The chat functions of one region, in PRIORITY order.
		*
		* Two consumers read it, and both mean "priority", which is why they can share
		* one array: the wire asks these functions in order and the first to list a
		* config owns it (`solo.ts`), and the card draws the groups in the same order so
		* the row a user sees first is the one the resolver prefers.
		*/
		const TRAE_CHANNEL_PRIORITY = {
			cn: [
				"solo_work_remote",
				TRAE_SOLO_FUNCTION,
				"solo_agent_remote",
				"chat_v3",
				"solo_coder"
			],
			ai: [
				"solo_work_remote",
				TRAE_SOLO_FUNCTION,
				"solo_agent_remote",
				"chat_v3"
			]
		};
		/**
		* Rank of one channel inside the region's priority list.
		*
		* Three cases, and the order between them is deliberate:
		*
		*  - a known chat channel: its index in the priority list;
		*  - an UNKNOWN channel name (a function the region does not call through —
		*    `withChatCallableFunctions` clears those, so this is a defensive branch):
		*    after every known channel, then alphabetically among themselves;
		*  - NO channel at all (a row demoted to the default chat function): last. Such
		*    a row is the one the resolver knows least about, so it must not push a
		*    properly attributed row down the list.
		*/
		function channelRank(channel, priority) {
			if (channel === void 0 || channel === "") return priority.length + 1;
			const known = priority.indexOf(channel);
			return known === -1 ? priority.length : known;
		}
		/**
		* Compare two display names the way a person reading a model list expects:
		* case-insensitively, with embedded numbers compared as NUMBERS, so `GLM-5.10`
		* sorts after `GLM-5.9`. Plain text comparison puts `5.10` first, which reads as
		* a bug to anyone who sees the version numbers.
		*/
		function compareNames(left, right) {
			const byName = left.trim().localeCompare(right.trim(), void 0, {
				numeric: true,
				sensitivity: "base"
			});
			return byName !== 0 ? byName : left.localeCompare(right);
		}
		/**
		* The catalog in display order: channel priority first, then name.
		*
		* Total and stable — ties fall through to `id`, so two rows with the same name
		* in the same channel still get one fixed order rather than the order they
		* arrived in.
		*/
		function orderTraeModels(rows, region = "cn") {
			const priority = TRAE_CHANNEL_PRIORITY[region] ?? TRAE_CHANNEL_PRIORITY.cn;
			return [...rows].sort((left, right) => {
				const byRank = channelRank(left.wireFunction, priority) - channelRank(right.wireFunction, priority);
				if (byRank !== 0) return byRank;
				if (left.wireFunction !== right.wireFunction) return (left.wireFunction ?? "").localeCompare(right.wireFunction ?? "");
				const byName = compareNames(left.name, right.name);
				return byName !== 0 ? byName : left.id.localeCompare(right.id);
			});
		}
		/**
		* Split rows into channel groups, in display order.
		*
		* Ordering is re-applied here rather than trusted from the caller: a group list
		* built from an unsorted input would put the groups in arrival order, which is
		* the exact instability this module exists to remove.
		*/
		function groupTraeModels(rows, region = "cn") {
			const groups = [];
			const byChannel = /* @__PURE__ */ new Map();
			for (const row of orderTraeModels(rows, region)) {
				const channel = row.wireFunction === "" ? void 0 : row.wireFunction;
				const key = channel ?? "\0default";
				const existing = byChannel.get(key);
				if (existing !== void 0) {
					existing.rows.push(row);
					continue;
				}
				const group = {
					channel,
					rows: [row]
				};
				byChannel.set(key, group);
				groups.push(group);
			}
			return groups;
		}
		/**
		* Does one row match a search query?
		*
		* Matches the display name, the display id and the WIRE config name — the last
		* one because a user debugging a `4001 config_name rejected` arrives with the
		* upstream name in hand, and the two differ exactly on the rows that carry a
		* suffix (`DeepSeek-V4-Flash` vs `DeepSeek-V4-Flash-Official`).
		*/
		function traeModelMatchesQuery(model, query) {
			const needle = query.trim().toLowerCase();
			if (needle === "") return true;
			if (model.name.toLowerCase().includes(needle)) return true;
			if (model.id.toLowerCase().includes(needle)) return true;
			return (model.wireConfigName ?? "").toLowerCase().includes(needle);
		}
		/** Filter by {@link traeModelMatchesQuery}, preserving order. */
		function filterTraeModels(rows, query) {
			if (query.trim() === "") return [...rows];
			return rows.filter((row) => traeModelMatchesQuery(row, query));
		}
		/**
		* The channels a NORMAL Trae chat session actually runs on: the `solo_work_*`
		* family, i.e. the panel's own chat modes.
		*
		* Deliberately not "every channel we can call". After issue #52 P1 the catalog
		* is 34 rows and 10 of them are reachable only through a SPECIALIST channel:
		* `solo_coder` (7: `Doubao-Seed-2.0-Code`, `glm-5.1`, `glm-5v-turbo`,
		* `kimi-k2.5`, `minimax-m2.7`, `qwen-3.5`, `qwen-3.6-plus`), `chat_v3` (2:
		* `kimi-k2.8-preview`, `qwen3.8-flash`) and `solo_agent_remote` (1:
		* `Doubao-Seed-Code`). Measured 2026-10-23 on a live CN account. Those rows work
		* — that is why P1 kept them — but they are not what Trae's main chat offers,
		* and mixing them into the default view is exactly the "a code model answering a
		* solo request" shape issue #52 asked about.
		*/
		const TRAE_COMMON_FUNCTIONS = {
			cn: ["solo_work_remote", TRAE_SOLO_FUNCTION],
			ai: ["solo_work_remote", TRAE_SOLO_FUNCTION]
		};
		/**
		* The function a request for this row will NAME.
		*
		* A row with no `wireFunction` is not "unknown to the wire": the bridge sends
		* the region default (`TRAE_SOLO_FUNCTION`), so for every question about where
		* the turn goes, the default is the answer. The distinction still matters for
		* DISPLAY (`groupTraeModels` keeps these in their own group, because their
		* provenance — which directory group advertised them — really is unknown), but
		* not for scope: a `solo_work_lite` turn is a normal chat turn either way.
		*/
		function traeModelCallChannel(model) {
			const channel = model.wireFunction;
			return channel === void 0 || channel === "" ? TRAE_SOLO_FUNCTION : channel;
		}
		/**
		* Does this row belong to the view?
		*
		* Judged on {@link traeModelCallChannel}, never on `wireFunction` directly:
		* otherwise the one row without a function (`doubao_1_8`, measured 2026-10-23)
		* would fall OUT of the common view while being called through exactly the
		* common channel it belongs to.
		*/
		function traeModelInView(model, view, region = "cn") {
			if (view === "all") return true;
			return (TRAE_COMMON_FUNCTIONS[region] ?? TRAE_COMMON_FUNCTIONS.cn).includes(traeModelCallChannel(model));
		}
		/** Keep the rows a view asks for, preserving order. */
		function scopeTraeModels(rows, view, region = "cn") {
			if (view === "all") return [...rows];
			return rows.filter((row) => traeModelInView(row, view, region));
		}
		//#endregion
		//#region src/promo.ts
		/** Zone used when upstream omits `off_peak.time_zone` (CN accounts). */
		const TRAE_PROMO_DEFAULT_TIME_ZONE = "Asia/Shanghai";
		const WEEKDAY_INDEX = {
			Mon: 1,
			Tue: 2,
			Wed: 3,
			Thu: 4,
			Fri: 5,
			Sat: 6,
			Sun: 7
		};
		/** Wall clock in one named zone: ISO weekday (1–7) plus minutes since midnight. */
		function zonedClock(now, timeZone) {
			let parts;
			try {
				parts = new Intl.DateTimeFormat("en-US", {
					timeZone,
					weekday: "short",
					hour: "2-digit",
					minute: "2-digit",
					hourCycle: "h23"
				}).formatToParts(now);
			} catch {
				return;
			}
			let isoWeekday;
			let hour;
			let minute;
			for (const part of parts) if (part.type === "weekday") isoWeekday = WEEKDAY_INDEX[part.value];
			else if (part.type === "hour") hour = Number.parseInt(part.value, 10);
			else if (part.type === "minute") minute = Number.parseInt(part.value, 10);
			if (isoWeekday === void 0 || hour === void 0 || minute === void 0) return void 0;
			if (!Number.isFinite(hour) || !Number.isFinite(minute)) return void 0;
			return {
				isoWeekday,
				minutes: hour % 24 * 60 + minute
			};
		}
		function clockOf(minutes) {
			const hour = Math.floor(minutes / 60);
			const minute = minutes % 60;
			return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
		}
		function runningWindow(discount, now, defaultTimeZone) {
			const offPeak = discount.offPeak;
			if (offPeak === void 0 || offPeak.windows.length === 0) return void 0;
			const declaredZone = offPeak.timeZone ?? defaultTimeZone;
			let usedZone = declaredZone;
			let clock = zonedClock(now, declaredZone);
			if (clock === void 0 && declaredZone !== defaultTimeZone) {
				usedZone = defaultTimeZone;
				clock = zonedClock(now, defaultTimeZone);
			}
			if (clock === void 0) return void 0;
			const match = offPeak.windows.find((window) => window.weekdays.includes(clock.isoWeekday) && clock.minutes >= window.startMinute && clock.minutes < window.endMinute);
			return match === void 0 ? void 0 : {
				...match,
				timeZone: usedZone
			};
		}
		/** `subKey` is upstream's machine name; it is the only honest source for "限时". */
		function kindOf(discount) {
			const key = discount.subKey ?? "";
			if (key.includes("off_peak")) return "offPeak";
			if (key.includes("subsidy")) return "subsidy";
			if (key.includes("limited")) return "limited";
			const type = discount.current?.discountType ?? "";
			if (type.includes("off")) return "offPeak";
			if (type.includes("limited")) return "limited";
			return "subsidy";
		}
		/** Pay ratio as upstream would phrase it; falls back to the rates it published. */
		function discountOf(price) {
			if (price.discountPercent !== void 0) return price.discountPercent;
			if (price.beforeRate === void 0 || price.rate === void 0) return void 0;
			if (price.beforeRate <= 0 || price.rate >= price.beforeRate) return void 0;
			return Math.round(price.rate / price.beforeRate * 100);
		}
		/**
		* The member price, but only when it beats the rate the badge is already showing.
		*
		* Two rates on the same base are two ways to reach one price: `member` quoting
		* 0.06 beside a live 0.06 is not "another 5 折". Comparing the post-discount
		* numbers is the only honest test — a branch with no rate cannot be shown to be
		* cheaper, so it is not quoted at all.
		*/
		function cheaperMemberOf(price, discount) {
			const member = discount.member;
			if (member === void 0 || member.rate === void 0) return void 0;
			if (price.rate === void 0 || member.rate >= price.rate) return void 0;
			const discountPercent = discountOf(member);
			if (discountPercent === void 0) return void 0;
			return {
				rate: member.rate,
				discountPercent
			};
		}
		function badgeOf(kind, price, discount, window) {
			const discountPercent = discountOf(price);
			if (discountPercent === void 0) return void 0;
			const member = cheaperMemberOf(price, discount);
			return {
				kind,
				discountPercent,
				percentOff: 100 - discountPercent,
				...price.beforeRate === void 0 ? {} : { beforeRate: price.beforeRate },
				...price.rate === void 0 ? {} : { rate: price.rate },
				...member === void 0 ? {} : {
					memberDiscountPercent: member.discountPercent,
					memberRate: member.rate
				},
				...window === void 0 ? {} : {
					fromClock: clockOf(window.startMinute),
					untilClock: clockOf(window.endMinute),
					timeZone: window.timeZone
				}
			};
		}
		/**
		* Decide the one badge (if any) a model shows right now.
		*
		* `now` is injected so the verdict is testable and so the card, which re-renders
		* on its own poll, always judges against the current clock. `defaultTimeZone` is
		* the account's zone, used only when upstream omits `off_peak.time_zone`.
		*/
		function selectTraePromoBadge(discount, now, defaultTimeZone = TRAE_PROMO_DEFAULT_TIME_ZONE) {
			if (discount === void 0) return void 0;
			const current = discount.current;
			if (current !== void 0) {
				if ((current.discountType ?? "none") !== "none" && (current.beforeRate === void 0 || current.rate === void 0 || current.rate < current.beforeRate)) {
					const kind = kindOf(discount);
					const badge = badgeOf(kind, current, discount, kind === "offPeak" ? runningWindow(discount, now, defaultTimeZone) : void 0);
					if (badge !== void 0) return badge;
				}
			}
			const window = runningWindow(discount, now, defaultTimeZone);
			if (window !== void 0 && discount.offPeak !== void 0) {
				if ((discount.current?.discountType ?? "none") === "none" || discountOf(discount.offPeak) !== void 0) return badgeOf("offPeak", discount.offPeak, discount, window);
			}
		}
		//#endregion
		//#region src/client/icon.ts
		/**
		* Plugin icon (LD brand logo, 64px) shared across the LaoDing plugin family.
		* Same data URI used by `dsh-subagent-default-model` so the external image
		* stays consistent.
		*/
		const TRAE_PLUGIN_ICON = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAXGUlEQVR4nH1bC7BdVXn+1tr7nHPvzb3JvUloSAQp0JHWoAMttKOCFrWU8irQSbCTQYG21IahnTJUUTsM0FJhZCzCSIcKImOpDkhrhQ5YC7ROB3lUBU3EyCuBFBIIedzcx3ntvTr/a621TwIns3PO3mfvddf/+v7v/9c6DvYKoYBz1cZNYfJpVBcNBm7dcIhj3TBM15VzqAE6XAWEGggVADroOl0byDW+PtRr9E732rl9r2PxOMNsrCogVE7PA0Kge4Lcz5/TGI6v00UaK+h98u4QUA9quIDg4Pe2i2LTsknc++mzZu9cv37VHNaFAveSJICj/9aFUNzrXHXSTwdnznl/Y+X9MaEP1D0A/ToKaUdDASoAK0YVYcLad/G88S6C1aQcOkI2Nj9HylBFBRMYqPUeFp6EDXQfKcIUoud6LQQP59rwrsBEOdhy9KGDK/7j9mUPmBKcCf++Z4YbF6eKLw+6QFioKl/DoYILlXMsHE2KPCCzwlsqoNb3oUw4Kq+2a0k4G4MtXOX3J4HNyulzUkC0eqYI8ZAaQZQSAh9080Qx1m7jHStnL/3B3ctvXbcuFOwBH/p5OG12DA/29leV6wcHeI8hadE1rBldl/6ACs7WMEuz0PIcKawe0Gdzeyf36eTzcOHxVAEpTEQB0QtY0PRZPMYsX+t3tSqBxkteYeHh6qqu6yIsmVhaHHtE7/fu/8fJhzzF/OywunXQR+DJOO9pkLp2NJ64pIXhaOxb/IfmJM29PemSJ+NSzJP1s2dhwmucJ6uaoIYFzVjnkFDhLRTkb2XC03gQTKDrZNjSV1icXwzPv9y99Z5Hw6R/psQnqoniyLBQ1d65IoGiDqZuHwWwzyFzx8xl5RDBZR4uCZc9E8fS+8TdSfHZ2KxAel6VwEIYZiflxC9NKToeKcKrAcjV2d2DK3xYqOcXJ478ytf2fcL3htWGegAaSZGeBnKixWgVPXRiZpEomLq4Kcri2RCc7zN3NWuq5XlOJLwqjq9liqlHlEfzSveIdVk0Fjh5kVjdjKLneniCtcEg7N492FBWAWvrHpwLzgmYUfySi+VorcJFBE6I7jIAjFnC3DybePKE5ClxLLsPI0q3kNAsYJ4g1wjkzDuju4nQJrx6RxRe/7YHfFX3MOyHtaUHloaKcqa4rcQTDWxubHnZ0lESNoaGXad7+RmLc7GMxbS4s8Y82S3mdhMshR+Po4pk181jkx22afHc8hL3plNTjOGDjEfu7pxfWkpcyA02Ofo6xpylPsMCi3eNTROShVawM0H4+4bXaGqzcTKQzc8j6VGPkb9tFtU56bwlBdK9ZMQMKNgolMtVKepFcq6hBMAzQJAQ6srG9iwNJRfN0LtWd64z1qZjRPDieBYQkyNTqFpCsoYoKQFoFt8xhA5icZ2fXWOwY4GScsT95Tv7XoSnd0ehgLJBSPSdkdhYWbSeAk2eCSzuScDs/qQo9dpRZarVWWm5ZRuxn8YRRabYtiwhn5PVRXD9js8FzM2rowKII7MnOJSR2GSZJMVUckfzjIjKMe2p5fOsENGfPESR38AwB8AsZTUBUV025TwWVEAsubSl6gYA8rU6eUMmvE2ErjMrQEDZQGkewGI6TcqPAhlT1hHBBV0xZC/R3B09JFmdXDESrIz5GRPMlWQA6kNAoVbjf7FAyq1vsW8xrt+rImI4aEiwIuqAMjI9y/8Z5RSAS+f04P4uTcihozDLaO6kZup2gSWFIXjm3plb75sHxkugMKzAgWmQcYmsTvqrgPkuMOgHFAhY0gnolDJfOgTM0t/xMcYTJeZz9QZRgHiUd5AQIHe2fNqIY3o4xiEw3wc++A6HvzweWNbWtKmsrF853PFEwDd/LEqoVOiYQQLQ7QGXn+Zw3okOhc9i1tw8umpS7mBQ4PW9Ab/YVuHxTTV+8EyF7TsqTHQCxtsBlVWSUVBViGYHcnMDQvaUyAv03wmPDcP8ECiy2lwOKl4CFz2+AoYDx1b73rkOayaVfUXziRMu9oGTbg54cz9pNlV9FEJzi8CJv+zwwOWWoZvZfXSst3rteDPgXx4e4LZv9fDS9grLlzotkclDakmXJCCFTswAdC5eZQqphwErZgr40QInAh4XHMbsHGt6ugSmWuLZwyqwlclFhwqOrSJgZky+izydc7bj+1ZPy7P9AT2nz/MR+PuK/g6/50fg8QdDGffQFQ4b13fwyFcmccl5HczOUgVYoXTcAGEBSWBzdRY4hoLUBvGeQGFgrM84gMWglq/mwszXqcSlAahgdi57l8/Mr9gaxiqbnZwheZMU23Lw88zN0zWff5ZzCpeyAApqTNWkjBorljnceMUEbvnMEqK0qIc1A6UAnYQS5/6Md4jTNxlhGUkKRYYBHmHCiEewJxQjzmmenFdphiXsZ0aKstogvmwkEiqwYml6MmS6kQkQKcUlICsIY6hyDAEbzupgZgr448/OouyI5Y3t8YgGfq5OIaHfeiZDWXclFizWw1OmF0lRQ4A8UWevnPTEsTNFjoQ7fV0UDq3SoSyBVgmU/FmOVsuz9VmfrCUBMPIMut4f1Dj9tzv4wqcmORzIvW1qwgOcYIC5vB0gzAClQW1EGuJXkgql2MlyuTHFhg4OAlrm8vRxtHrMFUhRV4trv/hawK3fqbF/QSwoYwSUPuCwlcDJ7y3wgeMKFHAYDgN7gOmwLBwGgxobzhnH/z7Txz9/exErpz2HK1teUZ+tTSGXZYZCFGAc3eqBZsESmZs1L0e92HK5TikSKA2N2CMY8QATfuvOgLOvqrBlW0CnyOioeWVF1/v4rXd7/M2fjeGEtQWGFO+FpkzFFPKOv/7zKXz/sR5m99foUJ2rRRNhhwCfAqBOxQkbVObHKSv14UZb2KnFdBAl5CdxvMwDcnotrTsW/vW9wPnXVdi2M+DwQ4DVK4CZSWDFVDp+aRkwNR7wxE8GOOuyWdz3vT7K0jMGyN8ToKTzFTMel2yYwPxcAJe56voR/eO7tOscY0Ls2GSFkJW+Nue8QTn6agJD6gta5mhwf7mHhCdesOGGCpu3AmMthzv+qsTHf6fArj0SP5YGKXNQZpleArRcjU9ePYdHnxgwPrAStK1EXkBhvO7scRx+aIleL2SWTzFP1qdQYkCs6dx66COob/28mB61GjzACwhmc9Q2rxnt/9GfUGwY1g4XfbHG488GjLWAmzYWOOU4zwAoKG6KteYG8YSAdunQKQM+dcMc9uwLbHnRv9Baumf5dIGPnNTB4jx5gQjNgisNLuH0Gr07ygKpjpdKsFnWGiuMXtLwfaPDpoRk/dFqjcYht6Q7P3lzhQefqvn87y4usOEjkgpjYlHhyT2psjMLErOcHANe3DbAXfd1xfUZVzRH6qMf/VA7E15JkfECdX9TiB+11ughDcisQGr4+wEfDqzrtegRxAau+aca3/gvEejK8z0uOcNhsUfWtAJGviOhrWKLXRwujgImx4Fvf3cR3V7gLGBRyDnfBbxnbQurVlImqJlEmdtLSpS/I9dACpD0l+I+sTjLCNbLe3sekHlEJry5/tJxh/98usZtDwo1vfTsAp/+mMeA0hrnPssalgl0PtoEEUYn18fbDltfHmLzlgEcs0MtiZ0oY+UKjyPWlBj0lRVGy3s+J2VQreKZIGUWq7MFDMEBaW01yMyoC7iRwmikG0zaZo5BcTwE9s0FXPS7Hp+/2DO356rQquKsvy9NDWV2yuXlM4Eb0O8FbN4ieTnCheIAKWLNao9qKPm/gJdD6bfhQkHlMLE9QmouF7Mlq1geM/hpO2xU/oNciT2K2B0Wik1/cHYu4Jz3O9y80bNXCOAJfnCzRAeguUhxbF0e7eLwMyIUKeW1HRkoWS9QXzPTnmWQvoOkQMED5Q8UDnDUE0ytLVv6jtbTyae6IP8T2qczNhKbAymLWP4nwXp94IhVDv9wWcGWoBRHHD/Fr8NPn6/Q8lpFpqCKwEgCGLsjF+4umOs3nZJeS8Y8ilrSHV0kazPqq6J5BRQylsgR4z2rALXhmWWkt8CAZvES49/aYDTZXsDxRzksnaDcTqAnz5DLtkqPux8c4LuPDTjfE9rnq0ziFUpotJfH4WFdjthUSbOjMdjFSXCtWg0EyyC9DU+fWcNq6UaDMq7tExJn6fFt3J+vKmPkZog9p4wqhoc6Dwvf8vjOfw9w+RcXucNj7e+0kpPa4wZmHDg1sHK5FAVCBXRgndb8XB2boj4TmBkgW9+AsLIOr/X6m/TX1uxjiyz3AOvjNQODMcVqb1GKrtrQ83qRQoCEf+SpITbeQJsSrLcnbhOR2zVZnBU0pXc46ghRAI+phMzGf3NnjRYBLOEPK8DzOxMheqcqFF5DIF+dyRZIYkhEgpJiNmn7wGIokhlLXWzNlEeHKvyTm4f4o+sWsdgNWHuUx2RHlG2KYDfniSaGyIUMMb4Zz/k+F5pGpyKp263x6v9VaBOztNyv40RmqGsG3o30+SMQZvXBAQsdb/UaJVTRdaVHZ2sPY22HzS9WuPDaLnbuqnHWySUe+vIU/uCjbcxRIUPpylKfeQMjuLTHF+drHH9sC2tWlxxGRKJiFADY/nKFXTsqjLUpE2jsx3Qq6C8A6CQEuP2V1wCNNfpmamvG/wg6amzLOmESPh+D0P7FVwMuuHoRW7dXOP19JW79zDjaLWBqQsLGipXo9jpZa2tTuG742EQmtKZSpcU/+VEf3fmANhVDbHnJGpEa8zUnxVK+o8N4fFx/H2F/MSXl3VvrBzhqUUmIJHdNedyAcfvrARdc08WzL9U4+bgSt181jjEFP1tljiVsrOHFAzothz27a5xx6jhOfn8HVUVU12YkvUR6/c/DPXQKEi4VPkyIuDrMiqNA3pbz/tGV29j3N68QetLweWuKKEOjdjMpsMX8Sb6nt2VLgCd/VuHMK4Z44ZUK7z26wJ1Xj2N6ynGKHOvYjhR6XumrKpFkbBfAnjcrrD2mhc9dORXpb5wJhULh8dzPB9j0wwEmlxDZMM9JyC9VoGQmz7wgU0Bc089dfqRCPKApqqsutCRGrarTf8PhjT0Bu2cDdu8L2LOvxu69AbP7A3a8UeEXWyu86zCPr187jjWHNFtclvqoFUZkiRRKf6/fDdj1eoXf/PUObrtlBstnpIVH1aB5IydBB3zr6wvodym/Sy9AKG8qi1NPgOixk7XBfJ0ub2o2lJBVdY2YsK6MFiWfO9/jnSuBHz1HHuGFSmuKC5XH6uUOHz+jhdUrndQChSiBXtTEoLRHQFj1a47bibbDrxxR4twzx7Bh/QTKlvCHKLzyf+oSbX66j0f/vYtlU1K/MAFSdyceEIVXAxdxeVy5fwPtRxHd9vw0GqBqIn4zWhpw4akeF5769gmDeADFr1mOXq/urHkN8Nyzx3DGKR20yoBDVhQ4+siSFUVWr014fZCUTue9bsCXrtsfOQIxWxNamiAKiOwZojxPHmBr75a/Y2hpP988pMEHYsfT1u0TEaFTyvMCS9m9htTWpIwlMMWuw8JizV3do99Z4PNXTnHLK9UXQemz4/rBhmW84naYw99fuw/PbR5g5XTBniwIT9bWuHcS+8YraAAfGyIZBlgGyHd45fv4UsTZW+rGmB7KghoVQkqK/J1XeEiIlLRJWRQ+DzzSx8+2DHHqB9osfK9Xs9DkKZRdpAucApDcXsb2uOX6WTz0r4tYQcIPc0HT59QBSpmgsBCILa98BSfb0jKa7jMAOEhTJOmGU2C85BCoINEvyT9IwHbL49WdFW68bZ6Xu9afPcZ3m+KUPFiASQiQkkuP/ftr3PS3s3j4/i73Aql+sc4vC6+rQIL2Qs+NY6QQqG0zZEZYLC2mYowfokVN1n6dGg/NV8YPzF1iBORlFK36BLS956XuP/3sPjy7ZYDL/2QJjv3VEr2+FDK8yKrZIa0byvS//0gPt39pDttfqHiVF4NEm2PDU0tgvpZ7AdMXMUZpW1Kb+4GaqY8+twpgx96A+x4PuPjDsmB54GukX3DQl1yfXwDuf7SHm766gJdfGeIPf38c11wxxd91aO/BQV673qjw1BMDPPhvi3j6yT7GSoeZZbKIa2UyNb3yJqitBebub6tPnosj22010rsf3exEgDNRAld9o8aPX3B412rdB2xgl1Hf0CiEMseoA3r9gG3bK/xw0wAvbB1iqkMkyeOw1QW+9s0FDAeCFeIwAYNewK5dNV7ZWmHb80O8uaNmUrR0Uqo6WgITmptITlRAg1LnZMiIEODec8MwkDV4707+A4isCHJD2cNr3GDfHLi/Z3v4448Xsj38EiepEOLqTru8RaDdHeDtLrZldn6/LnHbhLlNpwQmAB3vMNFxGOPtNZrmaqvzpbYXzm/ARyWvl4YIdYbU/Rn4CFMqYGq5ly0yVqUdUMnZ6q4Bl94zM2E9xGztTxc045aavK1Of1wxxQWiqDULYJuj6G/QEje7byAl6IT1YAF0H7HsKpUmjVV4eakcra6rwlIP6DJYtkbA6Ri8P0CB1jYv5u2lvBoULsfnnJpG9vCyIEqWZHeJrjJn48adGrzzSyZgGxek2ySeZqFjz3FjNd/vo0JKw8QEVgVqt0iKH1sDlBTKy+r6TLBx6nwFuPGefpMTc79Z3RRkPXw+H21njVSPcQ9fanXbWLymb/1/29RgkKmNTRuLBVXrxx0m+lkENmVY7S/zEWtrb9BWiRxlgZGCJ+a9PLHlfEDBTP2hsTFRdpVJNWdPx21qWVPDWtP5ik+j4Zn176wFzoWN9fcyoDNhI+dXppkA0XoCTQLEPCAIdhxk5Tur+nWPsChKYzxH97h/37aqm+z2Sw7ZvGRa5x5c3IuUlBBbVBYWBlymuEx4Gyuv74X4pDTXYILWD8ja4zRKYVR49Fcdxg3invt8yUsVJCRPHshrBWNZ+R49UYLt5tYfRcR6Xy0c3Ta5dJ6/Zd/vCNjlxCcueCa2l1pgGQDGzpIVSEPMyq6w5q+wzOoNUIzu0uz0SFhkHlHTiq4InO4zr9ENSjHO841N2e5ui3PrBTZQPFlagC0Jb54Vd4pZqNiOttgPoI4AZn1ZYLPzLoQatS2CNmod3T3W7Asc+Puc5D1JKRbpRJnFYgZAI9iQub7EvY9gxc9yW1vW+HgME3KkwSkNDs0EVnXqWqARIG3X1y3XDq0xbPbTS4q7vVcCN7qwGWM73/HV3P0t7iwImoOhlMZpe0rc8q7tblaE9vxzJaTCJa3nC/iZp6QFTgNGi/0mC9TvOTukUNLUG8Y6hZte7e/2l52Iu8ar6qXalR6hrhq5P0+LI7/DaYBgrHnMve1HEhYu6RkWgq2bvKDJ3cVGOfhZLOdYkaq8xPIYX2zVV72uyPBEN01XnTDuy2WLL33w+rG7/PpT3NyvrQ4bx9tww8qT1ejHNHFPQEJ6Ke0E1LJd2FmhR90g04xpP+tfKCjmYKaWIU/ImhcpTpXi2q7UfLeH9fXVqSVsTNiMD+Rh4uraDT2mlpXu8BNaG1etcnN+3T2huPcvWg8dubS6dHJJUfD6bFVXrq5rrw3+tCaXOuGmBENzAzHpu0tvL63uNj8bykdeoCkt8QHL+SqAkRxz60wJcQ9BFh6p7CX8CYEQLtShKocTfmbpRLHs3d1LT7u+9dA99tNZ+yHxBTcNztz0mr9x74I/hnZXhD7F/PCAn6bJz+U0vrPr7K5VJUJZf5/v040NDcG02LGGJVmfOsuxdifg03U9vUZHrPz0fl7p5caGjNkiEmTFUXBooUDbjWGs5TE+Pdyy6vjqijO+MPYACb+efjwdiYsqIewMk+d8tbro1b1uXXehPrYahmn+hZmGgtefqsalNFvU1BpAhM8QXhUlCmgCmihAUnBUQixk6J2eSYqwvM9Iz5sfrApM7LDF7W651oILbef3Tky0Nk2vcfeed0dxp3Nu7h6EYr2sgOL/Aa5OuMdnE5sWAAAAAElFTkSuQmCC";
		//#endregion
		//#region src/client/styles.ts
		/**
		* Client styles for the Trae plugin card.
		* Copied verbatim from `dsh-subagent-default-model`'s SETTINGS_CSS so the two
		* plugins share one external-presentation language (same card shell, same
		* button primitives, same `--dsw-alias-*` token palette).
		*/
		const TRAE_CARD_CSS = `
.dsm-plugin-card{border:1px solid var(--dsw-alias-border-l2,#36373b);background:var(--dsw-alias-bg-layer-3,#202126);border-radius:12px;list-style:none;transition:border-color .16s,background .16s}
.dsm-plugin-card:hover{border-color:var(--dsw-alias-label-dimmed,#777)}
.dsm-plugin-card-open{background:var(--dsw-alias-bg-layer-2,#25262b);border-color:var(--dsw-alias-label-dimmed,#777)}
.dsm-plugin-card-header{appearance:none;width:100%;font:inherit;color:inherit;text-align:left;cursor:pointer;background:transparent;border:0;border-radius:12px;align-items:center;gap:12px;padding:14px 16px;display:flex}
.dsm-plugin-card-header:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#5686fe);outline-offset:-2px}
.dsm-plugin-card-head{flex-direction:column;flex:1;gap:6px;min-width:0;display:flex}
.dsm-plugin-card-title{color:var(--dsw-alias-label-primary,#e6e6e6);font-size:15px;font-weight:600;line-height:1.4}
.dsm-plugin-card-description{color:var(--dsw-alias-label-tertiary,#999);font-size:12.5px;line-height:1.55}
/* Pure-CSS caret: the host primitives' chevron icon names are not part of any
   stable contract across DSH releases, so no static import is used 鈥?a border
   caret in the plugin's own CSS is version-proof. */
.dsm-plugin-card-chevron{color:var(--dsw-alias-label-tertiary,#999);flex:none;width:16px;height:16px;position:relative;transition:transform .16s}
.dsm-plugin-card-chevron::before{content:"";display:block;position:absolute;left:4px;top:5px;width:7px;height:7px;border-right:1.6px solid currentColor;border-bottom:1.6px solid currentColor;transform:rotate(45deg)}
.dsm-plugin-card-chevron-open{transform:rotate(180deg)}
.dsm-plugin-card-body{border-top:1px solid var(--dsw-alias-border-l2,#36373b);margin:0 16px;padding:0 0 8px}
.dsm-plugin-card-icon{width:32px;height:32px;flex:none;border-radius:7px}
.dsm-plugin-card-body .dsm-model-settings{margin:0;padding:12px 0 0;background:transparent;border:0;border-radius:0}
.dsm-btn{appearance:none;font:inherit;cursor:pointer;border:1px solid transparent;border-radius:8px;padding:5px 14px;font-size:13px;line-height:1.5}
.dsm-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#5686fe);outline-offset:1px}
.dsm-btn:disabled{opacity:.4;cursor:default}
.dsm-btn-outline{border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);background:transparent;font-weight:500}
.dsm-btn-outline:hover:not(:disabled){color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-dimmed);background:rgba(255,255,255,.04)}
.dsm-btn-primary{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3)}
.dsm-btn-primary:hover:not(:disabled){opacity:.9}
.dsm-trae-mainui-switch{display:flex;justify-content:flex-end;padding:0 2px 8px}
.dsm-trae-mainui-switch-label{display:inline-flex;align-items:center;gap:6px;font-size:13px;line-height:18px;color:var(--dsw-alias-label-secondary,#c6c9d0);white-space:nowrap;cursor:pointer}
.dsm-trae-mainui-switch-label input{margin:0;accent-color:var(--dsw-alias-brand-primary,#5686fe)}
.dsm-trae-mainui-switch-label:has(input:disabled){opacity:.6;cursor:default}
.dsm-trae-usage{display:flex;flex-direction:column;gap:16px;margin:0;padding:16px 0 4px}
.dsm-trae-tabs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.dsm-trae-tab-cell{display:flex;align-items:center;gap:4px;min-width:0;padding:8px 12px;border:1px solid var(--dsw-alias-border-l2,#3a3d45);border-radius:10px;background:var(--dsw-alias-bg-layer-3,#2a2c33);transition:border-color .15s,background .15s}
.dsm-trae-tab-cell:hover{border-color:var(--dsw-alias-label-dimmed,#777)}
/* The selected tab is marked on its CHIP, not on the button inside it: an
   inset ring on an inner button, inside a bordered strip, drew two borders
   a few pixels apart and read as a rendering mistake. The chip carries the
   accent border, so the switch beside the label stays in the same unit. */
.dsm-trae-tab-cell:has(.dsm-trae-tab-active){border-color:var(--dsw-alias-brand-primary,#5686fe);background:var(--dsw-alias-bg-layer-2,#232529)}
.dsm-trae-tab{appearance:none;font:inherit;cursor:pointer;flex:1;min-width:0;border:0;border-radius:7px;padding:0;color:var(--dsw-alias-label-tertiary,#999);font-size:13px;font-weight:600;line-height:20px;background:transparent;text-align:left;transition:color .15s;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dsm-trae-tab:hover:not(:disabled):not(.dsm-trae-tab-active){color:var(--dsw-alias-label-primary,#e6e6e6)}
.dsm-trae-tab:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#5686fe);outline-offset:1px}
.dsm-trae-tab-active{color:var(--dsw-alias-label-primary,#e6e6e6)}
.dsm-trae-tab-off{opacity:.55}
/* Same checkbox as the settings block (.dsm-trae-switch); only the padding
   differs, so it sits inside the tab cell without crowding the label. */
.dsm-trae-tab-switch{flex:none;margin-left:auto;padding-left:10px;border-left:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.24))}
.dsm-trae-tab-dot{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:7px;vertical-align:baseline}
.dsm-trae-tab-hint{margin:0;padding:0 2px;color:var(--dsw-alias-label-tertiary,#999);font-size:12px;line-height:18px}
/* SECTION TABS: the card's own top-level split (account / models / diagnostics).
 *
 * Deliberately NOT the boxed chips above. Those are the REGION scope — a
 * three-way choice of which PROVIDER this whole card is about, each chip
 * carrying its own on/off switch — while these are panels of ONE document, the
 * shape a reader already knows from the app's own settings window. Two rows of
 * boxes would read as one six-way choice.
 *
 * The hidden ATTRIBUTE on each panel is what does the work: an inactive panel
 * stays MOUNTED, so switching back does not refetch, a half-filled model draft
 * survives the trip, and the account pool keeps its log. It also takes the
 * inactive panel out of the accessibility tree, which is exactly what
 * role="tabpanel" wants — unlike display:none reached by a CSS class, the user
 * agent's own rule for [hidden] cannot be overridden by a later declaration. */
.dsm-trae-panels{display:flex;align-items:stretch;gap:2px;margin:4px 0 0;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.24))}
.dsm-trae-panel-tab{appearance:none;font:inherit;cursor:pointer;border:0;background:transparent;padding:7px 11px;margin-bottom:-1px;border-bottom:2px solid transparent;color:var(--dsw-alias-label-tertiary,#999);font-size:13px;font-weight:600;line-height:20px;white-space:nowrap;transition:color .15s,border-color .15s}
.dsm-trae-panel-tab:hover:not(.dsm-trae-panel-tab-active){color:var(--dsw-alias-label-primary,#e6e6e6)}
.dsm-trae-panel-tab:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#5686fe);outline-offset:1px}
.dsm-trae-panel-tab-active{color:var(--dsw-alias-label-primary,#e6e6e6);border-bottom-color:var(--dsw-alias-brand-primary,#5686fe)}
/* No top margin of its own: the strip above already carries a border, and the
   card's 16px stack gap would double the separation. */
.dsm-trae-panel{margin-top:0}
/* DIAGNOSTICS: a two-column fact table rather than prose. Each row is one thing
 * the card actually READ, so a bug report can quote a line instead of
 * paraphrasing the UI. No control lives here on purpose — a diagnostics panel
 * that can change settings is a settings panel with a worse name. */
.dsm-trae-diag{display:flex;flex-direction:column;border:1px solid var(--dsw-alias-border-l2,#36373b);border-radius:10px;overflow:hidden;background:var(--dsw-alias-bg-layer-2,#232529)}
.dsm-trae-diag-row{display:flex;align-items:baseline;justify-content:space-between;gap:16px;padding:8px 12px}
.dsm-trae-diag-row+.dsm-trae-diag-row{border-top:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.24))}
.dsm-trae-diag-label{flex:none;color:var(--dsw-alias-label-tertiary,#999);font-size:12px;line-height:18px}
.dsm-trae-diag-value{min-width:0;color:var(--dsw-alias-label-primary,#e6e6e6);font-size:12px;line-height:18px;text-align:right;overflow-wrap:anywhere}
.dsm-trae-diag-mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
/* A failure line, in the same warn tone the card already uses for an expiring
   credit — NOT a hand-rolled amber. The token set the card asks DSH for is
   audited by the card-styles spec (every name must be one the host actually
   defines), so this deliberately names state-warn-primary rather than the
   sibling card's label-caution, which this suite has never verified. */
.dsm-trae-diag-bad{color:var(--dsw-alias-state-warn-primary,#b45309)}
.dsm-trae-diag-hint{margin:10px 0 0;color:var(--dsw-alias-label-tertiary,#999);font-size:12px;line-height:18px}
.dsm-trae-credits-unavailable{margin:10px 0 0;padding:10px 12px;border:1px solid var(--dsw-alias-border-l2,#3a3d45);border-radius:10px;color:var(--dsw-alias-label-secondary,#c6c9d0);font-size:12px;line-height:18px;background:var(--dsw-alias-bg-layer-3,#2a2c33)}
.dsm-trae-account-value-muted{color:var(--dsw-alias-label-secondary,#c6c9d0);font-size:12px}
.dsm-trae-tab-off-notice{margin:0;padding:10px 12px;border:1px solid var(--dsw-alias-border-l2,#3a3d45);border-radius:10px;color:var(--dsw-alias-label-secondary,#c6c9d0);font-size:12px;line-height:18px;background:var(--dsw-alias-bg-layer-3,#2a2c33)}
.dsm-trae-usage-account{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border:1px solid var(--dsw-alias-border-l2,#3a3d45);border-radius:14px;background:var(--dsw-alias-bg-layer-2,#24262c)}
.dsm-trae-usage-account-copy{display:flex;flex-direction:column;gap:3px;min-width:0}
.dsm-trae-usage-expiry{padding-left:19px;color:var(--dsw-alias-label-tertiary,#9aa0a8);font-size:12px;line-height:18px}
/* Refresh-token countdown (issue #37 follow-up). Sits under the access-token
   line and aligns with it, so the two read as one stack: "token renews" then
   "but this is when renewal itself ends". Only rendered when it is close or
   already past, so a healthy account is unchanged. */
.dsm-trae-refresh-warn{padding-left:19px;font-size:12px;line-height:18px}
.dsm-trae-refresh-warn-soon{color:var(--dsw-alias-state-warn-primary,#b45309)}
.dsm-trae-refresh-warn-lapsed{color:var(--dsw-alias-state-error-primary,#dc2626)}
.dsm-trae-account-picker{display:block}
/* The 璁剧疆 block: label + hint on the left, control on the right, one save for
   the whole block. It replaces the bare checkbox rows that used to write on
   every click 鈥?a draft needs a visible way back out, so each row carries its
   own explanation and the footer carries the buttons. */
/* The preference switches: BARE LINES, one per switch, each with its label
   wrapped around the box so the whole line is a click target.
 *
 * The 璁剧疆 block used to be a bordered box with a heading, two rows and a
 * 銆屼繚瀛樸€?銆屾斁寮冦€?footer. That is gone with the draft it existed to serve 鈥?this
 * is the sibling dsh-connect-workbuddy card's shape, where a preference is a
 * checkbox on a line that commits on the click. */
.dsm-trae-prefs{display:flex;flex-direction:column;gap:14px;padding:2px 2px 0}
.dsm-trae-pref{display:flex;align-items:flex-start;gap:10px;font-size:13px;line-height:18px;color:var(--dsw-alias-label-secondary,#c6c9d0);cursor:pointer}
.dsm-trae-pref input{flex:none;cursor:pointer;accent-color:var(--dsw-alias-brand-primary,#5686fe)}
.dsm-trae-pref-check{inline-size:15px;block-size:15px;margin:3px 0 0}
/* The label and its explanation used to run together as one wrapped blob
   ("在输入框工具栏显示积分读数 在输入框工具栏显示可点击读数…"), which is what made
   this block read as a wall of text. They are two lines now: what the switch
   does, then what it means. */
.dsm-trae-pref-copy{display:flex;flex-direction:column;gap:3px;min-width:0}
.dsm-trae-pref-label{font-weight:500;color:var(--dsw-alias-label-primary,#e6e6e6)}
/* The select sits NEXT TO its label ("显示位置 [输入框工具栏 ▾]"), not at the far
   right of the card. Pushing it to the opposite edge split one sentence into
   two objects with half a card of empty space between them, and left the reader
   to guess which label the control belonged to. The row packs from the left;
   nothing in it stretches. */
.dsm-trae-pref-lead{display:flex;align-items:center;justify-content:flex-start;gap:10px;min-width:0}
.dsm-trae-pref-lead .dsm-trae-pref-label{flex:none}
.dsm-trae-pref input:disabled{cursor:default}
.dsm-trae-pref:has(input:disabled){opacity:.6;cursor:default}
.dsm-trae-pref b{font-weight:500;color:var(--dsw-alias-label-primary,#e6e6e6)}
.dsm-trae-pref-hint{color:var(--dsw-alias-label-tertiary,#9aa0a8);font-size:12px;line-height:17px}
.dsm-trae-pref span{min-width:0}
/* The credit readout's seat picker (learned from workbuddy #62). Its OWN label
   class, deliberately not the plain .dsm-trae-pref the two checkboxes use: a
   query for "the composer-credits switch" must not be able to pick this control
   up, because the two are different widgets and a test selecting by position
   would otherwise start asserting about a <select>.
   The select keeps its own class for the same reason, and takes the checkbox
   column's width so it reads as a sibling of the box rather than a stray row. */
/* The select row has no checkbox, so it borrows the checkbox's column as
   padding — its label must start on the same left edge as the two labels
   above it (15px box + 10px gap). */
.dsm-trae-credit-position-pref{align-items:flex-start;padding-left:25px}
/* Sized by its own two options, not stretched: the control answers one short
   question and sits beside the words that ask it. */
.dsm-trae-credit-position{flex:none;max-width:none;margin-top:0;padding:3px 8px;font-size:12px;line-height:16px;border:1px solid var(--dsw-alias-border-l2,#3a3d45);border-radius:7px;background:var(--dsw-alias-bg-layer-3,#2a2c33);color:var(--dsw-alias-label-primary,#e6e6e6);cursor:pointer}
.dsm-trae-credit-position:disabled{cursor:default}
/* The card's checkboxes are the platform's own, styled only with
   accent-color 鈥?the SAME idiom .dsm-trae-mainui-switch-label above already
   uses for the composer-line switch, and the one the sibling
   dsh-connect-workbuddy card uses for its tab and credits boxes.
 *
 * These were drawn by hand for one release: a 34x20 track with a 14px knob,
 * --dsw-alias-brand-primary when checked. That token is DSH's CONTRAST colour
 * (#0f1115 light / #f9fafb dark), not an accent, so a checked box came out as a
 * solid black pill 鈥?heavier than anything else in the card, and unrelated to
 * the native box sitting two centimetres away in the composer toolbar. The
 * platform checkbox tracks the host's own accent and dark mode for free. */
.dsm-trae-switch{display:inline-flex;align-items:center;cursor:pointer}
.dsm-trae-switch input{margin:0;cursor:pointer;accent-color:var(--dsw-alias-brand-primary,#5686fe)}
.dsm-trae-switch input:disabled{cursor:default}
.dsm-trae-switch:has(input:disabled){opacity:.6;cursor:default}
/* A pill, only where a pill is the idiom: the standalone preference rows.
   appearance:none hands the geometry to the stylesheet, so the track and the
   knob are ours. It is scoped rather than global because the tab row's switch
   sits inside a chip — a pill there reads as a second button, which is exactly
   how it looked when this was global. */
.dsm-trae-switch-pill{display:inline-flex;align-items:center}
.dsm-trae-switch-pill input{appearance:none;-webkit-appearance:none;position:relative;inline-size:36px;block-size:20px;border:0;border-radius:999px;background:var(--dsw-alias-border-l2,#c4c7cc);transition:background-color .15s ease}
.dsm-trae-switch-pill input::after{content:"";position:absolute;inset-block-start:2px;inset-inline-start:2px;inline-size:16px;block-size:16px;border-radius:50%;background:var(--dsw-alias-bg-layer-3,#fff);box-shadow:0 1px 2px rgba(0,0,0,.24);transition:transform .15s ease}
.dsm-trae-switch-pill input:checked{background:var(--dsw-alias-brand-primary,#1b1c1e)}
.dsm-trae-switch-pill input:checked::after{transform:translateX(16px)}
/* The account block is a real table: the question it answers is "which of these
   accounts, and what is the action on each one" 鈥?a dropdown can only ever show
   the one already chosen. */
.dsm-trae-accounts{display:flex;flex-direction:column;gap:10px;padding:12px 14px;border:1px solid var(--dsw-alias-border-l2,#3a3d45);border-radius:14px;background:var(--dsw-alias-bg-layer-2,#24262c)}
.dsm-trae-accounts-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
/* The refresh button must not be squeezed into two lines by a long hint. */
.dsm-trae-accounts-head>button{flex:none;white-space:nowrap}
.dsm-trae-accounts-title{margin:0;font-size:13px;font-weight:600;line-height:18px;color:var(--dsw-alias-label-primary,#e6e6e6)}
.dsm-trae-accounts-hint{margin:3px 0 0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary,#9aa0a8)}
/* The account rows: two lines each 鈥?who the account is, then what it is worth
   鈥?with the one action that applies to THAT row on the right. A four-column
   table was the wrong instrument here: every field demanded its own header, the
   columns drifted with the content ("LaoDing" vs a full expiry stamp), and the
   bound row repeated its "in use" badge in two different columns. */
/* The account table, shaped like the sibling WorkBuddy card's pool table: a
   bordered container, a tinted header row, and one grid row per account whose
   tracks are FRACTIONS of the container rather than sizes derived from the
   content. That is the whole point 鈥?the previous four-column table let each
   column grow with its own text, so the columns did not line up from row to row
   and the table read as noise in a narrow panel. */
.dsm-trae-account-table{display:flex;flex-direction:column;border:1px solid var(--dsw-alias-border-l2,#3a3d45);border-radius:var(--dsm-trae-pool-radius);overflow:hidden;background:var(--dsw-alias-bg-layer-2,#24262c)}
/* Four tracks where the region has a check-in column, three where it does not
   (the international region has no check-in at all: the ug/* family answers
   404 on every ai gateway, so the column is absent rather than empty and
   permanently unknown). The freed track goes to the account name. */
.dsm-trae-account-row{display:grid;grid-template-columns:1.7fr 1.1fr 1fr 1.1fr;gap:10px;align-items:center;padding:9px 12px;border-top:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.18));font-size:13px;color:var(--dsw-alias-label-secondary,#c6c9d0)}
.dsm-trae-account-table:not(.dsm-trae-account-table-checkin) .dsm-trae-account-row{grid-template-columns:2.2fr 1.2fr 1.1fr}
.dsm-trae-account-row:first-child{border-top:0}
.dsm-trae-account-row-head{padding:7px 12px;background:var(--dsw-alias-bg-layer-3,#2a2c33);color:var(--dsw-alias-label-tertiary,#999);font-size:11px;font-weight:600;letter-spacing:.02em;text-transform:uppercase}
/* The serving row, findable at a glance: the accent bar is what distinguishes it
   in a long table, where the 7%-opacity wash alone reads as a zebra stripe. */
.dsm-trae-account-row-current{background:rgba(86,134,254,.07);box-shadow:inset 3px 0 0 var(--dsw-alias-brand-primary,#5686fe)}
.dsm-trae-account-who{display:flex;align-items:center;gap:8px;min-width:0}
.dsm-trae-account-who .dsm-trae-usage-dot{margin-right:0;flex:none}
.dsm-trae-account-name{display:flex;flex-direction:column;gap:1px;min-width:0}
.dsm-trae-account-name b{font-weight:500;color:var(--dsw-alias-label-primary,#e6e6e6);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsm-trae-account-row-current .dsm-trae-account-name b{font-weight:600}
/* Declared AFTER the blanket span rule above so it wins: the badge must not
   inherit the muted 11px tertiary treatment the edition line uses. */
.dsm-trae-account-name .dsm-trae-account-badge{align-self:flex-start;margin-top:2px;padding:1px 6px;border-radius:999px;font-size:10px;line-height:15px;font-weight:600;white-space:nowrap;color:var(--dsw-alias-brand-primary,#5686fe);background:rgba(86,134,254,.14)}
.dsm-trae-account-meta{display:flex;align-items:center;gap:5px;flex-wrap:wrap;font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,#9aa0a8);min-width:0}
.dsm-trae-account-meta i{font-style:normal;opacity:.4}
.dsm-trae-account-note{font-size:11px;line-height:16px;color:var(--dsw-alias-state-error-primary,#ef4444)}
/* Its own track, in tabular figures, so digits in different rows sit on the same
   column of the grid instead of jittering with the glyph widths. */
.dsm-trae-account-worth{display:flex;flex-direction:column;gap:1px;min-width:0;font-variant-numeric:tabular-nums}
.dsm-trae-account-value{color:var(--dsw-alias-label-primary,#e6e6e6);font-weight:600}
.dsm-trae-account-value-on{color:var(--dsw-alias-state-success-primary,#22a06b)}
.dsm-trae-account-checkin-cell{display:flex;align-items:center;min-width:0}
.dsm-trae-account-actions{display:flex;align-items:center;gap:6px;justify-content:flex-end;flex:none}
/* The per-row switch is the shared outline button, only smaller: one button
   vocabulary in the card instead of a bespoke one per block. */
.dsm-trae-account-row .dsm-trae-account-switch{padding:2px 10px;font-size:12px}
@media (max-width:760px){.dsm-trae-account-row,.dsm-trae-account-table:not(.dsm-trae-account-table-checkin) .dsm-trae-account-row{grid-template-columns:1fr 1fr;row-gap:6px}.dsm-trae-account-row-head{display:none}}
/* The check-in is the only action on this card that reaches upstream account
   state, so it is the one button allowed a colour. Everything else in the row
   defers to it. */
.dsm-trae-account-checkin{appearance:none;font:inherit;cursor:pointer;white-space:nowrap;border:1px solid rgba(86,134,254,.4);border-radius:7px;padding:2px 9px;font-size:12px;line-height:18px;font-weight:500;color:var(--dsw-alias-brand-primary,#5686fe);background:rgba(86,134,254,.08)}
.dsm-trae-account-checkin:hover:not(:disabled){background:rgba(86,134,254,.16)}
.dsm-trae-account-checkin:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#5686fe);outline-offset:1px}
.dsm-trae-account-checkin-state{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary,#9aa0a8);white-space:nowrap}
/* A disabled check-in still STATES something ("claimed", "device used"), so it
   stays readable 鈥?clearly inactive, not invisible. */
.dsm-trae-account-checkin:disabled{opacity:.55;cursor:default;border-color:transparent;color:var(--dsw-alias-label-tertiary,#9aa0a8);background:transparent}
/* The switch is the row's LIVE control, so it is brighter than the inert
   check-in labels beside it: same shape, different weight. */
.dsm-trae-account-switch{appearance:none;font:inherit;cursor:pointer;white-space:nowrap;border:0;border-radius:7px;padding:3px 8px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#c6c9d0);background:transparent}
.dsm-trae-account-switch:hover:not(:disabled){color:var(--dsw-alias-brand-primary,#5686fe);background:rgba(86,134,254,.12)}
.dsm-trae-account-switch:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#5686fe);outline-offset:1px}
.dsm-trae-account-switch:disabled{opacity:.45;cursor:default}
.dsm-trae-mark{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:5px;font-size:11px;font-weight:700;color:#111;background:linear-gradient(135deg,#ffd36e,#ffb84d);margin-right:6px}
.dsm-trae-usage-list{display:flex;flex-direction:column;gap:10px}
.dsm-trae-usage-text{margin:0;font-size:14px;line-height:22px;color:var(--dsw-alias-label-secondary,#b8b8b8)}
.dsm-trae-usage-error{margin:0;font-size:14px;line-height:22px;color:var(--dsw-alias-state-error-primary,#ef4444)}
.dsm-trae-usage-dot{width:9px;height:9px;border-radius:50%;flex:0 0 auto}
.dsm-trae-usage-status{display:flex;align-items:center;gap:10px;font-size:15px;font-weight:500;color:var(--dsw-alias-label-primary,#e6e6e6)}
.dsm-trae-usage-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:2px}
.dsm-trae-usage-stats-two{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
.dsm-trae-usage-stat{position:relative;display:flex;flex-direction:column;gap:9px;padding:16px 16px 14px;border:1px solid var(--dsw-alias-border-l2,#3a3d45);border-radius:14px;background:var(--dsw-alias-bg-layer-2,#24262c);overflow:hidden;min-width:0}
.dsm-trae-usage-stat::before{content:"";position:absolute;top:0;left:0;right:0;height:3px;opacity:.9}
.dsm-trae-usage-stat-work::before{background:#9ca2aa}
.dsm-trae-usage-stat-general::before{background:#4d9b6d}
.dsm-trae-usage-stat-head{display:flex;align-items:center;gap:7px;min-width:0}
.dsm-trae-usage-stat-label{font-size:13px;line-height:18px;font-weight:600;color:var(--dsw-alias-label-secondary,#c6c9d0);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsm-trae-usage-stat-badge{margin-left:auto;flex:0 0 auto;padding:2px 8px;border-radius:999px;font-size:11px;line-height:15px;font-weight:600;letter-spacing:.2px}
.dsm-trae-usage-stat-badge-off{color:#aeb3bb;background:rgba(174,179,187,.11)}
.dsm-trae-usage-stat-badge-on{color:#3f8d60;background:rgba(63,141,96,.13)}
.dsm-trae-usage-stat-value{font-size:32px;line-height:36px;font-weight:700;letter-spacing:-.5px;white-space:nowrap;font-variant-numeric:tabular-nums}
.dsm-trae-usage-stat-value-general{color:#3f8d60}
.dsm-trae-usage-stat-value-work{color:#9298a0}
.dsm-trae-usage-stat-hint{margin:2px 0 0;font-size:12px;line-height:17px;color:var(--dsw-alias-label-tertiary,#9aa0a8)}
.dsm-trae-models{display:flex;flex-direction:column;gap:10px;border-top:1px solid var(--dsw-alias-border-l2,#36373b);padding-top:14px}
.dsm-trae-models-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
.dsm-trae-models-title{margin:0;color:var(--dsw-alias-label-primary,#e6e6e6);font-size:14px;font-weight:600;line-height:20px}
.dsm-trae-models-summary{margin:2px 0 0;color:var(--dsw-alias-label-tertiary,#999);font-size:12px;line-height:18px}
/* CATALOG SHAPE (issue #52): search + channel groups.
 *
 * The catalog is the union of every Trae mode, so a flat list reads as "a mess
 * of models" no matter how many rows it holds. The search box answers 「where is
 * X」 and the group headers answer 「why are there so many」 — the header names the
 * mode each row is actually called through, so the union is legible instead of
 * merely long. Both are presentation only: no rule here changes what is saved. */
.dsm-trae-models-search{display:flex;align-items:center;gap:10px;min-width:0}
/* SCOPE CHIPS (issue #52, P2).
 *
 * A segmented pair, not two more dsm-btn-outline buttons: those are 30px tall
 * and would compete with the section's own buttons, while this control is a
 * filter on the list directly below it. aria-pressed carries the state, so the
 * visual and the announced state cannot disagree. */
.dsm-trae-models-view{display:flex;align-items:center;gap:2px;padding:2px;border-radius:8px;background:var(--dsw-alias-bg-layer-2,#232529);align-self:flex-start}
.dsm-trae-models-view-opt{padding:4px 10px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-tertiary,#9aa0a8);font-size:12px;line-height:17px;cursor:pointer;font-variant-numeric:tabular-nums;white-space:nowrap}
.dsm-trae-models-view-opt:hover{color:var(--dsw-alias-label-secondary,#c6c9d0)}
/* The pressed chip is bg-layer-3 on a bg-layer-2 track: the verified pair that
 * reads as "this segment sits ON the control" in both themes. (bg-layer-1 was
 * the first choice and is NOT a token DSH defines — the fallback would then win
 * in both themes, the exact defect card-styles.spec.tsx exists to catch.) */
.dsm-trae-models-view-opt[aria-pressed="true"]{background:var(--dsw-alias-bg-layer-3,#2e3136);color:var(--dsw-alias-label-primary,#e6e6e6);font-weight:600}
.dsm-trae-models-view-opt:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#5686fe);outline-offset:-2px}
/* The follow-up line under a scoped list ("N enabled are outside this view") and
 * the "show all" affordance inside it. Same 12px tertiary treatment as the hint
 * line above the list, because it is the same kind of statement: a note about
 * the list, not part of it. */
.dsm-trae-models-note{margin:0;display:flex;align-items:center;gap:8px;flex-wrap:wrap;color:var(--dsw-alias-label-tertiary,#999);font-size:12px;line-height:18px}
.dsm-trae-models-widen{margin-left:2px;padding:0;border:0;background:transparent;color:var(--dsw-alias-brand-primary,#5686fe);font-size:12px;line-height:18px;cursor:pointer;text-decoration:underline;text-underline-offset:2px}
.dsm-trae-models-widen:hover{color:var(--dsw-alias-brand-primary,#5686fe);opacity:.8}
.dsm-trae-models-widen:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#5686fe);outline-offset:1px;border-radius:3px}
.dsm-trae-models-search-input{flex:1 1 auto;min-width:0;padding:6px 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2,#36373b);background:var(--dsw-alias-bg-layer-2,#232529);color:var(--dsw-alias-label-primary,#e6e6e6);font-size:13px;line-height:18px}
.dsm-trae-models-search-input::placeholder{color:var(--dsw-alias-label-tertiary,#999)}
.dsm-trae-models-search-input:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#5686fe);outline-offset:-1px}
.dsm-trae-models-search-count{flex:none;color:var(--dsw-alias-label-tertiary,#999);font-size:12px;line-height:18px;font-variant-numeric:tabular-nums}
.dsm-trae-models-empty{margin:0;padding:14px 12px;color:var(--dsw-alias-label-tertiary,#999);font-size:12px;line-height:18px}
.dsm-trae-model-group{display:block}
.dsm-trae-model-group+.dsm-trae-model-group{border-top:1px solid var(--dsw-alias-border-l2,#36373b)}
/* list-style:none + a drawn marker: the native triangle cannot be styled to
   sit on the header's baseline, and Safari needs the -webkit- pseudo removed
   separately. The marker is TEXT on purpose — an icon import would tie the card
   to a host package for one glyph. */
/* The header tint is a NEUTRAL overlay, not a DSH token: it has to sit one step
   away from the row background in BOTH themes, and the only token the card may
   use there (bg-layer-2) is what the rows already paint. A 6% grey wash is the
   same "slightly recessed" relationship for a light and a dark surface. */
.dsm-trae-model-group-head{display:flex;align-items:center;gap:8px;padding:7px 12px;cursor:pointer;background:rgba(127,127,127,.12);color:var(--dsw-alias-label-secondary,#c6c9d0);font-size:12px;line-height:17px;font-weight:600;list-style:none}
.dsm-trae-model-group-head::-webkit-details-marker{display:none}
.dsm-trae-model-group-head::before{content:'▸';flex:none;width:9px;color:var(--dsw-alias-label-tertiary,#999);font-size:10px}
.dsm-trae-model-group[open]>.dsm-trae-model-group-head::before{content:'▾'}
.dsm-trae-model-group-head:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#5686fe);outline-offset:-2px}
.dsm-trae-model-group-name{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsm-trae-model-group-count{flex:none;color:var(--dsw-alias-label-tertiary,#999);font-weight:400;font-variant-numeric:tabular-nums}
/* The header separates itself from its FIRST row; between rows the generic
   .dsm-trae-model+.dsm-trae-model hairline still applies, and between groups
   the rule above does. Without this the first row of every group looked pasted
   onto its header. */
.dsm-trae-model-group-head+.dsm-trae-model{border-top:1px solid var(--dsw-alias-border-l2,#36373b)}
/* EVERY model is on the page — no inner scroller, no max-height.
 *
 * A capped list with its own scrollbar was tried and rejected by the user: it
 * turned a settings section into a little window that has to be scrolled inside
 * a page that already scrolls, and put the models a user is looking for behind a
 * gesture that does not match the rest of the card. The section is allowed to be
 * as tall as the catalog is; the card's own page scroll is the only scroll.
 *
 * overflow:hidden is for the rounded border only (so the row hairlines cannot
 * paint outside the radius). It is deliberately NOT auto: nothing here clips
 * content vertically. */
.dsm-trae-model-list{display:flex;flex-direction:column;border:1px solid var(--dsw-alias-border-l2,#36373b);border-radius:10px;overflow:hidden}
.dsm-trae-model{display:grid;grid-template-columns:minmax(0,1fr);gap:7px;padding:10px 12px;background:var(--dsw-alias-bg-layer-2,#232529);transition:opacity .16s}
.dsm-trae-model-disabled{opacity:.55}
.dsm-trae-model+.dsm-trae-model{border-top:1px solid var(--dsw-alias-border-l2,#36373b)}
.dsm-trae-model-head{display:flex;align-items:center;justify-content:space-between;gap:12px;min-width:0}
.dsm-trae-model-enabled{display:flex;align-items:center;gap:8px;min-width:0;cursor:pointer}
.dsm-trae-model-enabled input{margin:0;accent-color:var(--dsw-alias-brand-primary,#5686fe);flex:none}
.dsm-trae-model-copy{display:flex;align-items:baseline;gap:8px;min-width:0}
.dsm-trae-model-name{display:inline-flex;align-items:baseline;gap:7px;color:var(--dsw-alias-label-primary,#e6e6e6);font-size:13px;font-weight:500;line-height:19px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsm-trae-model-name-rate{color:var(--dsw-alias-label-tertiary,#999);font-size:11px;font-weight:400;line-height:16px;flex:none}
/* The two head actions sit together; the probe one SPENDS quota, so it carries
   the hint tooltip rather than looking like its read-only sibling. */
/* The sidebar-credit switch. Two instances share this style: the card's own
   row at the top and the copy beside the model actions (2.9.3). Without it the
   checkbox rendered unstyled and read as absent 鈥?the whole reason the switch
   looked missing. */
.dsm-trae-models-actions{display:flex;align-items:center;gap:8px;flex:none}
.dsm-trae-usage-alternative{display:flex;align-items:flex-start;gap:10px;margin-top:10px;padding:10px 12px;border:1px solid var(--dsw-alias-state-warn-secondary,#fbbf24);border-radius:10px;background:var(--dsw-alias-state-warn-tertiary,#fef3c7)}
.dsm-trae-usage-alternative-text{margin:0;flex:1 1 auto;font-size:12px;line-height:18px;color:var(--dsw-alias-label-primary,#e6e6e6)}
.dsm-trae-usage-switch-button{flex:0 0 auto;padding:5px 10px;border:1px solid var(--dsw-alias-border-l2,#3a3d45);border-radius:8px;background:var(--dsw-alias-bg-layer-3,#2c2f36);color:var(--dsw-alias-label-primary,#e6e6e6);font-size:12px;line-height:16px;cursor:pointer}
.dsm-trae-usage-switch-button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.14))}
.dsm-trae-usage-switch-button:disabled{opacity:.5;cursor:not-allowed}
.dsm-trae-usage-note{margin:8px 0 0;color:var(--dsw-alias-label-tertiary,#999);font-size:11px;line-height:16px}
/* Credit-expiry notice, card copy. Four tones by urgency, so the 24-hour case
   cannot be mistaken for the 3-day one, nor either for the 7-day one, at a
   glance. Reads as an advisory, not an error: the account works fine, the
   credit is simply about to lapse.
   The 3-day tone sits BETWEEN the other two on purpose: it carries the
   warning border (the reader must not scroll past a 3-day expiry without
   noticing) but not the warning fill (a 3-day pack is not the emergency a
   24-hour pack is). */
.dsm-trae-expiry{display:flex;flex-direction:column;gap:2px;margin-top:10px;padding:10px 12px;border:1px solid;border-radius:10px;font-size:12px;line-height:18px}
.dsm-trae-expiry-soon{border-color:var(--dsw-alias-state-warn-secondary,#fbbf24);background:var(--dsw-alias-state-warn-tertiary,#fef3c7);color:var(--dsw-alias-label-primary,#e6e6e6)}
.dsm-trae-expiry-days{border-color:var(--dsw-alias-state-warn-secondary,#fbbf24);background:transparent;color:var(--dsw-alias-label-primary,#e6e6e6)}
.dsm-trae-expiry-week{border-color:var(--dsw-alias-border-l2,#3a3d45);background:var(--dsw-alias-bg-layer-3,#2c2f36);color:var(--dsw-alias-label-primary,#e6e6e6)}
.dsm-trae-expiry-lapsed{border-color:var(--dsw-alias-border-l2,#3a3d45);background:var(--dsw-alias-bg-layer-3,#2c2f36);color:var(--dsw-alias-label-tertiary,#999)}
.dsm-trae-expiry-detail{font-size:11px;line-height:16px;opacity:.8}
/* Account import / export (issue #37). A sub-block of the accounts section:
   the transfer row, plus the two dialogs it opens in place. The file input is
   hidden rather than absent — the button opens the system picker, and the input
   must stay mounted to be clicked. */
.dsm-trae-transfer{margin-top:12px;padding-top:10px;border-top:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.2))}
.dsm-trae-transfer-label{margin:0 0 6px;font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary,GrayText)}
.dsm-trae-transfer-flat{margin-top:0;padding-top:0;border-top:0}
.dsm-trae-transfer-flat .dsm-trae-transfer-actions{flex-wrap:nowrap}
.dsm-trae-transfer-actions{display:flex;flex-wrap:wrap;gap:8px}
.dsm-trae-transfer-file{display:none}
.dsm-trae-transfer-status{margin:6px 0 0;font-size:11px;line-height:16px}
.dsm-trae-transfer-ok{color:var(--dsw-alias-state-success-primary,#16a34a)}
.dsm-trae-transfer-error{color:var(--dsw-alias-state-error-primary,#dc2626)}
.dsm-trae-transfer-dialog{
  margin-top:8px;padding:10px;border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.28));
  border-radius:8px;font-size:12px;line-height:18px;
}
.dsm-trae-transfer-dialog>p{margin:0 0 6px}
.dsm-trae-transfer-list{list-style:none;margin:6px 0;padding:0;max-height:180px;overflow:auto}
.dsm-trae-transfer-list label{display:flex;align-items:center;gap:6px;padding:2px 0;cursor:pointer}
.dsm-trae-transfer-list input{flex:none}
.dsm-trae-transfer-dialog-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
/* A text-button rather than a boxed one: "select all" is a shortcut inside the
   dialog, and a third button would compete with the two that act. */
.dsm-trae-transfer-link{
  margin-top:6px;padding:0;border:0;background:none;cursor:pointer;
  color:var(--dsw-alias-brand-primary,#2563eb);font-size:11px;line-height:16px;
}
.dsm-trae-models-hint{margin:4px 0 0;color:var(--dsw-alias-label-tertiary,#999);font-size:11px;line-height:16px}
/* Bulk context-budget row (issue #42): under the model list, above the
   capability note. Wraps on narrow cards; keeps the two buttons visually a
   pair and distinct from the save footer below. */
.dsm-trae-context-bulk{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
/* Per-panel 「自主生图」 consent (trae_draw_image). Sits under the bulk-context
   row, above the capability note, because it is a per-REGION runtime choice like
   the model picks above it — not a global preference. The input stays a real
   checkbox so the card's tests can find it by its accessible name. */
.dsm-trae-draw-image{display:flex;align-items:flex-start;gap:8px;margin-top:10px;font-size:11px;line-height:16px;cursor:pointer}
.dsm-trae-draw-image input{flex:none;margin:2px 0 0}
.dsm-trae-draw-image[data-disabled="true"]{cursor:not-allowed;opacity:.6}
.dsm-trae-draw-image-hint{color:var(--dsw-alias-label-tertiary,#999)}
/* Verdict badge. Only a real refusal is coloured as a warning; an unknown
   verdict stays neutral because an inconclusive probe is not evidence against
   the model. */
.dsm-trae-model-probe{flex:none;border-radius:999px;padding:1px 7px;font-size:10px;font-weight:500;line-height:15px;white-space:nowrap}
.dsm-trae-model-probe-available{color:var(--dsw-alias-state-success-primary,#22a06b);border:1px solid color-mix(in srgb,var(--dsw-alias-state-success-primary,#22a06b) 40%,transparent)}
.dsm-trae-model-probe-gated,.dsm-trae-model-probe-unsupported{color:var(--dsw-alias-state-warn-primary,#f59e0b);border:1px solid color-mix(in srgb,var(--dsw-alias-state-warn-primary,#f59e0b) 40%,transparent)}
.dsm-trae-model-probe-auth{color:var(--dsw-alias-state-error-primary,#d92d20);border:1px solid color-mix(in srgb,var(--dsw-alias-state-error-primary,#d92d20) 40%,transparent)}
.dsm-trae-model-probe-rate-limited,.dsm-trae-model-probe-unknown{color:var(--dsw-alias-label-tertiary,#999);border:1px solid color-mix(in srgb,var(--dsw-alias-label-tertiary,#999) 35%,transparent)}
/* Promotion capsule (src/promo.ts). Unlike WorkBuddy's badge there is NO
   upstream colour to honour — Trae publishes a pay ratio and nothing else — so
   these three colours are the plugin's own choice, picked only so the kinds stay
   distinguishable at a glance: red = subsidy price, orange = explicitly
   "limited", blue = off-peak hours. */
.dsm-trae-model-promo{flex:none;border-radius:999px;padding:1px 7px;font-size:10px;font-weight:500;line-height:15px;white-space:nowrap;border:1px solid transparent}
.dsm-trae-model-promo-subsidy{color:var(--dsw-alias-state-error-primary,#d92d20);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary,#d92d20) 40%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#d92d20) 10%,transparent)}
.dsm-trae-model-promo-limited{color:var(--dsw-alias-state-warn-primary,#f59e0b);border-color:color-mix(in srgb,var(--dsw-alias-state-warn-primary,#f59e0b) 45%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-warn-primary,#f59e0b) 12%,transparent)}
.dsm-trae-model-promo-offPeak{color:var(--dsw-alias-brand-primary,#5686fe);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary,#5686fe) 40%,transparent);background:color-mix(in srgb,var(--dsw-alias-brand-primary,#5686fe) 10%,transparent)}
.dsm-trae-model-meta{display:flex;align-items:center;gap:7px 12px;flex-wrap:wrap;color:var(--dsw-alias-label-tertiary,#999);font-size:11px;line-height:16px}
.dsm-trae-model-options{display:flex;align-items:center;justify-content:flex-end;gap:12px;flex:none}
.dsm-trae-model-image{display:inline-flex;align-items:center;gap:4px;color:var(--dsw-alias-label-secondary,#c6c9d0);font-size:11px;line-height:16px;cursor:pointer}
.dsm-trae-model-image input{margin:0;accent-color:var(--dsw-alias-brand-primary,#5686fe)}
.dsm-trae-context-budget{display:flex;align-items:center;justify-content:flex-end;gap:12px;flex:none;margin:0;padding:0;border:0;color:var(--dsw-alias-label-secondary,#c6c9d0);font-size:11px;line-height:16px}
.dsm-trae-context-budget label{display:inline-flex;align-items:center;gap:4px;cursor:pointer}
.dsm-trae-context-budget input{margin:0;accent-color:var(--dsw-alias-brand-primary,#5686fe)}
.dsm-trae-model-capability-note{margin:0;color:var(--dsw-alias-label-tertiary,#999);font-size:12px;line-height:18px}
.dsm-trae-model-actions{display:flex;align-items:center;justify-content:space-between;gap:12px;border-top:1px solid var(--dsw-alias-border-l2,#36373b);padding-top:12px}
.dsm-trae-model-actions-buttons{display:flex;align-items:center;justify-content:flex-end;gap:8px}
.dsm-trae-usage-cheer{display:inline-flex;align-items:center;gap:4px;flex:none;text-decoration:underline;text-underline-offset:2px;color:var(--dsw-alias-label-tertiary,#999);font-size:13px;line-height:1.5;transition:color .16s}
.dsm-trae-usage-cheer-star{font-size:12px;line-height:1;display:inline-flex}
.dsm-trae-usage-cheer:hover{color:var(--dsw-alias-label-primary,#e6e6e6)}
.dsm-trae-searched{margin-top:8px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary,#999)}
.dsm-trae-searched>summary{cursor:pointer;color:var(--dsw-alias-label-secondary,#b8b8b8);user-select:none}
.dsm-trae-searched-hint{margin:6px 0 4px;color:var(--dsw-alias-label-tertiary,#999)}
.dsm-trae-searched-list{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:4px}
.dsm-trae-searched-list li{display:flex;flex-direction:column;gap:1px;min-width:0}
.dsm-trae-searched-list code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary,#b8b8b8);word-break:break-all}
.dsm-trae-searched-reason{color:var(--dsw-alias-label-tertiary,#999);font-size:11px}
/* The quarantine notice: a copy that was kept aside instead of being erased.
   It borrows the "probed paths" look but stands on its own class, because it
   is a different KIND of fact — and because a screen may carry both. */
.dsm-trae-quarantine{margin-top:8px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary,#999)}
.dsm-trae-quarantine>summary{cursor:pointer;color:var(--dsw-alias-label-secondary,#b8b8b8);user-select:none}
.dsm-trae-quarantine-hint{margin:6px 0 4px;color:var(--dsw-alias-label-tertiary,#999)}
.dsm-trae-quarantine-list{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:4px}
.dsm-trae-quarantine-list li{display:flex;flex-direction:column;gap:1px;min-width:0}
.dsm-trae-quarantine-list code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary,#b8b8b8);word-break:break-all}
.dsm-trae-quarantine-reason{color:var(--dsw-alias-label-tertiary,#999);font-size:11px}
.dsm-trae-usage-cheer:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#5686fe);outline-offset:2px}
.dsm-trae-checkin{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;border:1px solid var(--dsw-alias-border-l2,#3a3d45);border-radius:14px;background:var(--dsw-alias-bg-layer-2,#24262c)}
.dsm-trae-checkin-copy{display:flex;flex-direction:column;gap:2px;min-width:0}
.dsm-trae-checkin-label{color:var(--dsw-alias-label-primary,#e6e6e6);font-size:13px;line-height:18px;font-weight:600}
.dsm-trae-checkin-hint{color:var(--dsw-alias-label-tertiary,#9aa0a8);font-size:12px;line-height:17px}
.dsm-trae-checkin-button{flex:none}
/* The "this machine already used today's check-in" note is INFORMATIONAL, not
   an error: it is Trae's one-per-device-per-day rule, and the day is simply
   spent. Rendering it in the error colour would read as a plugin fault. */
.dsm-trae-checkin-note{margin:8px 0 0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#c6c9d0)}
/* The busy veil: one overlay for every account write whose result only lands
   after the Host re-reads its settings document. Fixed so it covers the card
   no matter which section started the operation, and translucent so the table
   stays visible underneath — the user is watching a specific row change, and
   hiding it would defeat the point.

   The mask and card surface are the HOST's own tokens, not this file's
   invention. --dsw-alias-bg-mask-1 + --dsw-mask-blur is exactly what the
   host's own overlays use, so the veil dims the way every other overlay in the
   shell does instead of laying its own black wash on top. A hardcoded flat
   black mask (e.g. a mid-transparency black) was tuned against neither theme:
   too weak next to the host's .24 mask in light mode, and it ignored the
   host's blur entirely.

   bg-layer-2 (not bg-primary, which does not exist in the host's token set at
   all and therefore always fell through to this file's near-black #1b1c20) is
   the same surface the host puts behind its panels — that near-black fallback
   is what made the veil read as a black slab with unreadable text on it. */
.dsm-trae-veil{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;background:var(--dsw-alias-bg-mask-1,rgba(0,0,0,.32));backdrop-filter:var(--dsw-mask-blur);cursor:progress}
/* --dsw-elevation-prominent is the host's own panel shadow (a hairline stroke
   plus two soft layers); a hand-rolled drop shadow read as a heavy grey box. */
.dsm-trae-veil-card{display:flex;flex-direction:column;align-items:center;gap:8px;max-width:min(340px,80vw);padding:16px 20px;border:1px solid var(--dsw-alias-border-l2,#0000001a);border-radius:12px;background:var(--dsw-alias-bg-layer-2,#fff);box-shadow:var(--dsw-elevation-prominent,0 8px 28px rgba(0,0,0,.35))}
.dsm-trae-veil-text{font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary,#0f1115);text-align:center}
/* label-secondary, not label-tertiary: this line carries the operation's
   detail and must stay legible. tertiary is the host's dimmest tier
   (neutral-bluish-600 on light, neutral-bluish-400 on dark) and is meant for
   metadata, not for a sentence the user has to read while waiting. */
.dsm-trae-veil-hint{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#61666b);text-align:center}
/* The spinner proves the UI is alive when the row under it has not changed yet
   — which is precisely the confusion the veil exists to remove. It follows the
   host's own state spinner (dsh's _dsh-state-dot-spin): an SVG arc whose dash
   breathes while it turns, currentColor so it inherits the tier it sits in,
   and the same 1.5s beat. The previous 18px border-ring at .7s was roughly
   twice the host's speed and visibly out of step with every other spinner in
   the shell — that mismatch, more than the shape itself, is what made it look
   cheap.

   Reduced-motion users get the static arc rather than a frozen ring, matching
   how the host degrades its own spinner. */
.dsm-trae-veil-spinner{width:20px;height:20px;color:var(--dsw-alias-label-secondary,#61666b);animation:dsm-trae-veil-spin 1.5s linear infinite}
.dsm-trae-veil-spinner-track{opacity:.25}
.dsm-trae-veil-spinner-arc{stroke-dasharray:12 150;animation:dsm-trae-veil-dash 1.5s ease-in-out infinite}
@keyframes dsm-trae-veil-spin{to{transform:rotate(360deg)}}
@keyframes dsm-trae-veil-dash{0%{stroke-dasharray:12 150;stroke-dashoffset:0}50%{stroke-dasharray:24 150;stroke-dashoffset:-6}to{stroke-dasharray:12 150;stroke-dashoffset:0}}
@media (prefers-reduced-motion: reduce){.dsm-trae-veil-spinner{animation:none}.dsm-trae-veil-spinner-arc{animation:none;stroke-dasharray:18 150;stroke-dashoffset:-3}}

/* ------------------------------------------------------------------ *
 * The account pool (3.9.0).                                           *
 *                                                                     *
 * Five tracks, because the table answers "which accounts, and what is  *
 * each one worth right now" — a single picker could only ever show the *
 * one already chosen, and every field here is a reason to include or   *
 * exclude a row. The check-in track is CONDITIONAL (only the CN panel  *
 * grants a daily reward), so the actions cell is pinned to the LAST    *
 * track (grid-column:-2/-1) rather than to the fifth one: otherwise     *
 * a four-cell row would drop Test/Remove into the check-in slot and    *
 * leave a hole on the right.                                          *
 * ------------------------------------------------------------------ */
.dsm-trae-pool{--dsm-trae-pool-pad-x:14px;--dsm-trae-pool-pad-y:10px;--dsm-trae-pool-radius:14px;display:flex;flex-direction:column;gap:12px;border-top:1px solid var(--dsw-alias-border-l2,#36373b);padding:14px 0 0}
.dsm-trae-pool-head{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px}
.dsm-trae-pool-title{margin:0;font-size:13px;font-weight:600;line-height:18px;color:var(--dsw-alias-label-primary,#e6e6e6)}
.dsm-trae-pool-region-note{margin:3px 0 0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary,#9aa0a8)}
.dsm-trae-pool-current{flex:none;padding:2px 8px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2,#3a3d45);font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary,#c6c9d0);white-space:nowrap}
/* Two classes on the element (settings + modebar): a single-class rule here loses
   to .dsm-trae-pool-settings further down, which resets padding to 0 and repaints
   the background. Match both classes so the strip keeps its own frame. */
.dsm-trae-pool-settings.dsm-trae-pool-modebar{padding:12px 14px;gap:8px;border-color:rgba(86,134,254,.36);background:linear-gradient(180deg,rgba(86,134,254,.10),rgba(86,134,254,.02)),var(--dsw-alias-bg-layer-2,#24262c)}
.dsm-trae-pool-modebar-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.dsm-trae-pool-modebar-label{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary,#e6e6e6)}
.dsm-trae-pool-modebar-state{flex:none;padding:1px 9px;border-radius:999px;font-size:12px;line-height:18px;font-weight:500;color:var(--dsw-alias-brand-primary,#5686fe);background:rgba(86,134,254,.14);border:1px solid rgba(86,134,254,.3)}
.dsm-trae-pool-modebar .dsm-trae-pool-dirty{margin-left:auto}
.dsm-trae-pool-modebar .dsm-trae-pool-note{line-height:18px}
/* Modifier rules must out-specify their base class wherever the base is defined
   further down (.dsm-trae-pool-note, .dsm-trae-select): matching both classes keeps
   the warn tone and the wider select from being reset by the later base rule. */
.dsm-trae-pool-note.dsm-trae-pool-serving-note{color:var(--dsw-alias-state-warn-primary,#b45309)}
.dsm-trae-pool-card .dsm-trae-pool-actions{padding:0 var(--dsm-trae-pool-pad-x) 12px}
.dsm-trae-pool-card .dsm-trae-pool-action-note{padding:0 var(--dsm-trae-pool-pad-x) 12px}
.dsm-trae-pool-actions{display:flex;align-items:center;flex-wrap:wrap;gap:8px}
.dsm-trae-pool-action-checkin{flex:none;white-space:nowrap}
.dsm-trae-pool-action-test{flex:none;white-space:nowrap}
/* Reference text, folded away. Same <details>/<summary> shape as the WorkBuddy
   sibling's "how the pool picks an account": keyboard-operable and
   screen-reader-expanded natively, and nothing to keep in sync in state. The
   paragraphs inside are plain .dsm-trae-pool-note - the container only supplies
   the frame, so their own type scale stays authoritative. */
.dsm-trae-pool-more{border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.18));border-radius:10px;background:var(--dsw-alias-bg-layer-2,#24262c);overflow:hidden}
.dsm-trae-pool-more-summary{padding:8px 12px;cursor:pointer;user-select:none;color:var(--dsw-alias-label-secondary,#c6c9d0);font-size:12px;font-weight:600;line-height:18px}
.dsm-trae-pool-more-summary:hover{color:var(--dsw-alias-label-primary,#e6e6e6)}
.dsm-trae-pool-more-summary:focus-visible{outline:2px solid rgba(86,134,254,.55);outline-offset:-2px}
.dsm-trae-pool-more-body{display:flex;flex-direction:column;gap:8px;padding:10px 12px 12px;border-top:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.18))}
/* Removing an account from the pool is destructive (it drops THIS panel's saved
   membership), so the hover state takes the error tone rather than the neutral
   one every other outline button gets. */
/* The destructive Delete is visually heavier than 移除 from the start (error
   colour idle), so the row shows two distinct actions instead of two greys. */
.dsm-trae-pool-delete{color:var(--dsw-alias-state-error-primary,#d92d20)}
.dsm-trae-pool-delete:hover:not(:disabled){background:rgba(217,45,32,.08)}
.dsm-trae-pool-delete-hint{margin:0;padding:8px var(--dsm-trae-pool-pad-x);border:1px solid var(--dsw-alias-state-error-primary,#d92d20);border-radius:10px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#c6c9d0);background:var(--dsw-alias-bg-layer-3,#2a2c33)}
.dsm-trae-pool-busy{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary,#9aa0a8)}
.dsm-trae-pool-action-note{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary,#9aa0a8)}
.dsm-trae-pool-card{display:flex;flex-direction:column;min-width:0;border:1px solid var(--dsw-alias-border-l2,#3a3d45);border-radius:var(--dsm-trae-pool-radius);background:var(--dsw-alias-bg-layer-2,#24262c);overflow:hidden}
.dsm-trae-pool-card-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px var(--dsm-trae-pool-pad-x) 12px}
.dsm-trae-pool-card-title{margin:0;font-size:13px;line-height:18px;font-weight:600;color:var(--dsw-alias-label-primary,#e6e6e6)}
.dsm-trae-pool-card-tools{display:flex;align-items:center;gap:8px;flex:none}
.dsm-trae-pool-count{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary,#9aa0a8)}
.dsm-trae-pool-card .dsm-trae-pool-table{border:0;border-radius:0;border-top:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.18))}
.dsm-trae-pool-members{display:flex;flex-direction:column;gap:10px}
/* Prose, not a box. Every explanation in this section is one line of muted
   text; boxing each one is what made the block look like a stack of cards. */
.dsm-trae-pool-actions-end{margin-inline-start:auto}
.dsm-trae-pool-credit-meta{display:block;margin-top:2px;font-size:11px;line-height:16px;white-space:nowrap;color:var(--dsw-alias-label-tertiary,#9aa0a8)}
.dsm-trae-pool-account-note{grid-column:2;grid-row:3;font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,#9aa0a8)}
.dsm-trae-pool-tools-dashed{border:1px dashed var(--dsw-alias-border-l2,#3a3d45);border-radius:var(--dsm-trae-pool-radius);padding:var(--dsm-trae-pool-pad-y) var(--dsm-trae-pool-pad-x)}
.dsm-trae-pool-tool-label{margin-inline-end:auto;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#c6c9d0)}
.dsm-trae-pool-note{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary,#9aa0a8)}
/* A setting row: label + hint on the left, the control on the right, one
   rhythm for the switch, the target select and the manual binding. */
.dsm-trae-pool-set{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:var(--dsm-trae-pool-pad-y) var(--dsm-trae-pool-pad-x);border-top:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.18))}
.dsm-trae-pool-set:first-child{border-top:0}
.dsm-trae-pool-set-copy{display:flex;flex-direction:column;gap:3px;min-width:0}
.dsm-trae-pool-set-copy b{font-size:13px;line-height:18px;font-weight:500;color:var(--dsw-alias-label-primary,#e6e6e6)}
.dsm-trae-pool-set-copy span{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary,#9aa0a8)}
.dsm-trae-pool-set-ctl{display:flex;align-items:center;gap:8px;flex:none}
.dsm-trae-pool-set-ctl select{min-width:180px}
.dsm-trae-select.dsm-trae-pool-account-select{min-width:180px;max-width:min(320px,50%)}
.dsm-trae-pool-tools{display:flex;flex-direction:column;gap:8px}
.dsm-trae-pool-tool-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.dsm-trae-pool-meta{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,#9aa0a8);white-space:nowrap}
.dsm-trae-pool-warn-tag{padding:0 6px;border-radius:999px;font-size:11px;line-height:16px;white-space:nowrap}
.dsm-trae-pool-warn-tag-soon{color:var(--dsw-alias-state-warn-primary,#b45309)}
.dsm-trae-pool-warn-tag-lapsed{color:var(--dsw-alias-state-error-primary,#d92d20)}
.dsm-trae-pool-claim{padding:2px 8px;font-size:12px;line-height:16px}
.dsm-trae-pool-settings-wrap{display:flex;flex-direction:column;gap:10px}

.dsm-trae-pool-settings{display:flex;flex-direction:column;gap:0;padding:0;border:1px solid var(--dsw-alias-border-l2,#3a3d45);border-radius:var(--dsm-trae-pool-radius);overflow:hidden;background:var(--dsw-alias-bg-layer-2,#24262c)}
.dsm-trae-pool-members-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.dsm-trae-pool-settings-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.dsm-trae-pool-subtitle{margin:0;font-size:12px;font-weight:600;line-height:18px;color:var(--dsw-alias-label-primary,#e6e6e6)}
.dsm-trae-pool-subnote{margin:2px 0 0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary,#9aa0a8)}
.dsm-trae-pool-select-actions{display:flex;flex:none;gap:6px}
.dsm-trae-pool-select-actions .dsm-btn,.dsm-trae-pool-row-actions .dsm-btn{padding:4px 10px;font-size:12px;line-height:1.4}
.dsm-trae-pool-table{--dsm-trae-pool-cols:minmax(0,1.4fr) 128px minmax(0,1.2fr) 96px 128px;display:flex;flex-direction:column;border:1px solid var(--dsw-alias-border-l2,#3a3d45);border-radius:var(--dsm-trae-pool-radius);overflow:hidden;background:var(--dsw-alias-bg-layer-2,#24262c)}
.dsm-trae-pool-table-no-checkin{--dsm-trae-pool-cols:minmax(0,1.4fr) 128px minmax(0,1.2fr) 128px}
.dsm-trae-pool-row{display:grid;grid-template-columns:var(--dsm-trae-pool-cols);align-items:start;gap:10px;padding:var(--dsm-trae-pool-pad-y) var(--dsm-trae-pool-pad-x);border-top:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.18))}
.dsm-trae-pool-row:first-child{border-top:0}
/* The header carries labels for the first three tracks only: the check-in and
   action cells are self-describing ("Not checked in", "Test"), and a header word
   for an empty cell would be a promise the table does not keep. */
.dsm-trae-pool-col-account{padding-inline-start:23px}
.dsm-trae-pool-row-head{align-items:center;padding:8px var(--dsm-trae-pool-pad-x);border-top:0;background:var(--dsw-alias-bg-layer-3,#2a2c33);font-size:11px;line-height:16px;font-weight:600;letter-spacing:.02em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary,#9aa0a8)}
/* The row that would bill the next request. Tinted, not bordered: a border here
   reads as a selection control, and the checkbox beside it already is one. */
.dsm-trae-pool-row-current{background:rgba(86,134,254,.07);box-shadow:inset 3px 0 0 var(--dsw-alias-brand-primary,#5686fe)}
.dsm-trae-pool-row-ghost{opacity:.7}
.dsm-trae-pool-row-actions{display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end}
.dsm-trae-pool-account{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:2px 8px;min-width:0}
.dsm-trae-pool-check{display:inline-flex;align-items:center;flex:none;grid-column:1;grid-row:1;cursor:pointer}
.dsm-trae-pool-check input{flex:none;margin:0;cursor:pointer;accent-color:var(--dsw-alias-brand-primary,#5686fe)}
.dsm-trae-pool-check:has(input:disabled){opacity:.6;cursor:default}
.dsm-trae-pool-account-name{display:flex;align-items:center;gap:6px;min-width:0;grid-column:2;grid-row:1;font-size:13px;line-height:18px;color:var(--dsw-alias-label-primary,#e6e6e6);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsm-trae-pool-dot{flex:none;width:7px;height:7px;border-radius:50%;background:var(--dsw-alias-label-dimmed,#777)}
.dsm-trae-pool-dot-ok{background:var(--dsw-alias-state-success-primary,#12b76a)}
.dsm-trae-pool-dot-excluded{background:var(--dsw-alias-state-warn-primary,#b45309)}
.dsm-trae-pool-dot-ghost{background:var(--dsw-alias-label-dimmed,#777)}
.dsm-trae-pool-account-tags{display:flex;flex-wrap:wrap;align-items:center;gap:6px;grid-column:2;grid-row:2;min-width:0}
.dsm-trae-pool-tag{padding:0 6px;border-radius:999px;font-size:10px;line-height:16px;white-space:nowrap}
.dsm-trae-pool-member{font-size:11px;line-height:16px;color:var(--dsw-alias-brand-primary,#5686fe)}
.dsm-trae-pool-not-member{font-size:11px;line-height:16px;color:var(--dsw-alias-label-dimmed,#9aa0a6)}
.dsm-trae-pool-tag-member{border:1px solid var(--dsw-alias-border-l2,#3a3d45);color:var(--dsw-alias-label-tertiary,#9aa0a8)}
.dsm-trae-pool-tag-excluded{background:var(--dsw-alias-state-warn-tertiary,#fef3c7);color:var(--dsw-alias-state-warn-primary,#b45309)}
.dsm-trae-pool-tag-ghost{border:1px dashed var(--dsw-alias-border-l2,#3a3d45);color:var(--dsw-alias-label-tertiary,#9aa0a8)}
.dsm-trae-pool-credit{display:flex;flex-direction:column;gap:1px;min-width:0}
.dsm-trae-pool-credit-num{font-size:13px;line-height:18px;color:var(--dsw-alias-label-primary,#e6e6e6);font-variant-numeric:tabular-nums}
.dsm-trae-pool-credit-label{font-size:10px;line-height:14px;color:var(--dsw-alias-label-tertiary,#9aa0a8)}
.dsm-trae-pool-probe{min-width:0}
.dsm-trae-pool-probe-cell{display:flex;flex-direction:column;gap:1px;min-width:0}
.dsm-trae-pool-probe-outcome{display:flex;align-items:center;gap:5px;font-size:12px;line-height:16px;color:var(--dsw-alias-label-secondary,#c6c9d0)}
.dsm-trae-pool-probe-ok{color:var(--dsw-alias-state-success-primary,#12b76a)}
.dsm-trae-pool-probe-warn{color:var(--dsw-alias-state-warn-primary,#b45309)}
.dsm-trae-pool-probe-meta{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,#9aa0a8);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsm-trae-pool-probe-detail{font-size:11px;line-height:15px;color:var(--dsw-alias-label-tertiary,#9aa0a8);overflow-wrap:anywhere}
.dsm-trae-pool-probe-none{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,#9aa0a8)}
.dsm-trae-pool-checkin{min-width:0}
.dsm-trae-pool-checkin-state{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,#9aa0a8)}
.dsm-trae-pool-checkin-ok{color:var(--dsw-alias-state-success-primary,#12b76a)}
.dsm-trae-pool-checkin-no{color:var(--dsw-alias-state-warn-primary,#b45309)}
/* "Unknown" and "device already claimed" are facts, not faults: a muted line
   says so without dressing either one up as an error. */
.dsm-trae-pool-checkin-unknown{color:var(--dsw-alias-label-tertiary,#9aa0a8)}
.dsm-trae-pool-checkin-device{color:var(--dsw-alias-label-tertiary,#9aa0a8)}
/* The advisory lines share one shape (a quiet bordered box): each is a fact the
   user may need to act on, none of them is an error, and five different
   rectangles in one section would read as five different severities. */
.dsm-trae-pool-ghost-note{margin:0;padding:8px var(--dsm-trae-pool-pad-x);border:1px solid var(--dsw-alias-border-l2,#3a3d45);border-radius:10px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#c6c9d0);background:var(--dsw-alias-bg-layer-3,#2a2c33)}
.dsm-trae-pool-unsaved{margin:0;padding:8px var(--dsm-trae-pool-pad-x);border:1px solid var(--dsw-alias-border-l2,#3a3d45);border-radius:10px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#c6c9d0);background:var(--dsw-alias-bg-layer-3,#2a2c33)}
.dsm-trae-pool-off-notice{margin:0;padding:0 var(--dsm-trae-pool-pad-x) 10px;font-size:12px;line-height:18px;color:var(--dsw-alias-state-warn-primary,#b45309)}
.dsm-trae-pool-target-none{margin:0;padding:0 12px 10px;font-size:12px;line-height:18px;color:var(--dsw-alias-state-warn-primary,#b45309)}
.dsm-trae-pool-target-stale{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 var(--dsm-trae-pool-pad-x);padding-bottom:10px;color:var(--dsw-alias-state-warn-primary,#b45309)}
.dsm-trae-pool-warning{display:flex;flex-direction:column;gap:2px;padding:8px var(--dsm-trae-pool-pad-x);border:1px solid var(--dsw-alias-state-warn-secondary,#fbbf24);border-radius:10px;background:var(--dsw-alias-state-warn-tertiary,#fef3c7);color:var(--dsw-alias-state-warn-primary,#b45309);font-size:12px;line-height:18px}
.dsm-trae-pool-warning-title{font-weight:600}
.dsm-trae-pool-warning-hint{opacity:.85}
/* "Empty" is an unfinished setup, not a fault: neutral tone. */
.dsm-trae-pool-warning-empty{border-color:var(--dsw-alias-border-l2,#3a3d45);background:var(--dsw-alias-bg-layer-3,#2a2c33);color:var(--dsw-alias-label-secondary,#c6c9d0)}
/* "Every member is unusable" is the one case that IS the pool's fault, so it
   keeps the warn tone the base class sets. */
.dsm-trae-pool-warning-unusable{border-color:var(--dsw-alias-state-warn-secondary,#fbbf24);background:var(--dsw-alias-state-warn-tertiary,#fef3c7);color:var(--dsw-alias-state-warn-primary,#b45309)}
.dsm-trae-pool-save-row{display:flex;align-items:center;justify-content:space-between;gap:12px;border-top:1px solid var(--dsw-alias-border-l2,#36373b);padding-top:12px;position:sticky;bottom:0;z-index:2;padding-bottom:8px;background:var(--dsw-alias-bg-layer-3,#2a2c33)}
.dsm-trae-pool-save-buttons{display:flex;align-items:center;justify-content:flex-end;gap:8px}
.dsm-trae-pool-save-row .dsm-btn{padding:5px 14px;font-size:13px;line-height:1.5}
.dsm-trae-pool-dirty{padding:0 6px;border-radius:999px;background:var(--dsw-alias-state-warn-tertiary,#fef3c7);color:var(--dsw-alias-state-warn-primary,#b45309);font-size:10px;line-height:16px}
.dsm-trae-pool-save-error{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-state-error-primary,#d92d20)}
.dsm-trae-pool-target{display:flex;flex-direction:column;gap:6px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#c6c9d0)}
.dsm-trae-pool-target-label{color:var(--dsw-alias-label-secondary,#c6c9d0)}
.dsm-trae-select{max-width:220px;padding:2px 6px;font:inherit;font-size:12px;color:var(--dsw-alias-label-primary,#e6e6e6);background:var(--dsw-alias-bg-layer-3,#2a2c33);border:1px solid var(--dsw-alias-border-l2,#3a3d45);border-radius:8px}
.dsm-trae-select:disabled{opacity:.6;cursor:default}
.dsm-trae-pool-log{display:flex;flex-direction:column;gap:6px;padding-top:2px}
.dsm-trae-pool-log-head{display:flex;align-items:center;justify-content:space-between;gap:10px}
.dsm-trae-pool-log-empty{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary,#9aa0a8)}
.dsm-trae-pool-log-list{display:flex;flex-direction:column;gap:3px;margin:0;padding:0;list-style:none;max-height:160px;overflow-y:auto}
.dsm-trae-pool-log-item{padding:0 0 0 8px;border-left:2px solid var(--dsw-alias-border-l2,#3a3d45);font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#c6c9d0)}
.dsm-trae-pool-log-info{border-left-color:var(--dsw-alias-border-l2,#3a3d45)}
.dsm-trae-pool-log-ok{border-left-color:var(--dsw-alias-state-success-primary,#12b76a)}
.dsm-trae-pool-log-warn{border-left-color:var(--dsw-alias-state-warn-primary,#b45309)}
.dsm-trae-pool-log-error{border-left-color:var(--dsw-alias-state-error-primary,#d92d20)}
.dsm-trae-pool-log-text{overflow-wrap:anywhere}
`;
		/**
		* Composer-row readout styles, injected by the readout itself.
		*
		* SEPARATE from `TRAE_CARD_CSS`, and that is not tidiness: the card's CSS is
		* only injected when the settings card module loads, so putting the composer's
		* rules in it means the readout renders UNSTYLED in the composer toolbar 鈥?
		* which is exactly what shipped in 2.13.0鈥?.13.4. The trigger fell back to the
		* browser's default button box, and the panel, without `position: fixed`, had
		* its inline left/top ignored and rendered nowhere useful.
		*
		* `tests/composer-styles.spec.tsx` now asserts that every class this component
		* renders has a rule here, so a rule cannot go missing without a test failing.
		*/
		const COMPOSER_POINTS_CSS = `
/* The readout is plain composer text 鈥?no border, no fill at rest. The padding
   is only the click target, invisible until the pointer arrives. */
.dsm-trae-composer-points{display:inline-flex;align-items:center;min-width:0}
.dsm-trae-composer-points-trigger{
  appearance:none;display:inline-flex;align-items:center;align-self:stretch;
  padding:2px 6px;border:0;border-radius:6px;background:transparent;
  /* EXPLICIT, not inherit. The composer row's own font and body colour are
     noticeably larger and darker than the neighbouring controls 鈥?a credit
     readout is secondary information and must not shout. 12px matches this
     plugin's original line; label-tertiary matches the shell's own composer-row
     control (ContextMeter), which is the sibling this reads alongside. */
  font-size:12px;line-height:18px;
  color:var(--dsw-alias-label-tertiary,#999);
  white-space:nowrap;cursor:pointer;
  font-variant-numeric:tabular-nums;
}
.dsm-trae-composer-points-trigger:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.14))}
.dsm-trae-composer-points-trigger:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#5686fe);outline-offset:1px}
/* The panel is portaled to document.body and positioned from the trigger, so it
   MUST be fixed 鈥?otherwise the left/top it measures are ignored and it lands in
   document flow. All material comes from shell tokens so it follows the theme. */
.dsm-trae-composer-panel{
  position:fixed;z-index:1100;box-sizing:border-box;
  width:min(248px,calc(100vw - 24px));padding:12px;
  border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.28));
  border-radius:var(--dsw-radius-lg,14px);
  background:var(--dsw-specific-menu,Canvas);
  box-shadow:var(--dsw-elevation-prominent,0 8px 32px rgba(0,0,0,.22));
  backdrop-filter:var(--dsw-menu-backdrop-filter,none);
  font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#444);
}
.dsm-trae-composer-panel-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}
.dsm-trae-composer-panel-title{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary,CanvasText)}
/* Self-contained: the dsm-btn primitive lives in TRAE_CARD_CSS, which the
   composer never loads, so the refresh button must style itself. */
.dsm-trae-composer-panel-refresh{
  appearance:none;flex:none;margin-left:auto;padding:3px 10px;
  border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.34));
  border-radius:7px;background:transparent;
  color:var(--dsw-alias-label-secondary,#444);
  font:inherit;font-size:11px;line-height:16px;cursor:pointer;
}
.dsm-trae-composer-panel-refresh:hover:not(:disabled){border-color:var(--dsw-alias-label-dimmed,rgba(127,127,127,.6));color:var(--dsw-alias-label-primary,CanvasText)}
.dsm-trae-composer-panel-refresh:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#5686fe);outline-offset:1px}
.dsm-trae-composer-panel-refresh:disabled{opacity:.5;cursor:default}
/* The panel is a TABLE: one row per account in the region, one figure (the
   general balance) per row, and a row click switches accounts.

   Rhythm is deliberate: the header sits on a hairline, the switch button owns
   ALL horizontal padding (and pulls back by the same amount so its label lines
   up with the header), and every row is the same height. A misaligned first
   column is what makes a two-column popover read as broken. */
.dsm-trae-composer-panel-table{
  width:100%;border-collapse:collapse;
  font-size:12px;line-height:18px;
}
.dsm-trae-composer-panel-table thead th{
  padding:0 0 7px;font-weight:500;text-align:left;font-size:11px;
  color:var(--dsw-alias-label-tertiary,GrayText);
  border-bottom:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.24));
}
.dsm-trae-composer-panel-num{
  text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;
}
.dsm-trae-composer-panel-table thead th.dsm-trae-composer-panel-num{padding-right:0}
.dsm-trae-composer-panel-table tbody th{
  padding:0;font-weight:400;text-align:left;vertical-align:middle;
}
.dsm-trae-composer-panel-table tbody td{
  padding:4px 0;vertical-align:middle;
  color:var(--dsw-alias-label-primary,CanvasText);
}
/* The current account reads as current without shouting: a filled dot and a
   slightly heavier weight. Disabled 鈥?pressing it would write a selection that
   has not changed. */
.dsm-trae-composer-panel-table tbody tr.dsm-trae-composer-panel-row-current td{font-weight:600}
.dsm-trae-composer-panel-switch{
  appearance:none;display:flex;align-items:center;gap:7px;
  width:100%;padding:4px 6px;margin-left:-6px;
  border:0;border-radius:6px;background:transparent;
  color:inherit;font:inherit;font-size:12px;text-align:left;cursor:pointer;
  white-space:nowrap;overflow:hidden;
}
.dsm-trae-composer-panel-switch>span:last-child{overflow:hidden;text-overflow:ellipsis}
/* Hover belongs to the switch, not the row: the number cell is not clickable,
   so lighting it up would promise an action it cannot perform. */
.dsm-trae-composer-panel-switch:hover:not(:disabled){
  background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.14));
}
.dsm-trae-composer-panel-switch:focus-visible{
  outline:2px solid var(--dsw-alias-brand-primary,#5686fe);outline-offset:-1px;
}
.dsm-trae-composer-panel-switch:disabled{cursor:default}
.dsm-trae-composer-panel-dot{
  flex:none;width:7px;height:7px;border-radius:50%;
  background:var(--dsw-alias-label-dimmed,rgba(127,127,127,.5));
}
.dsm-trae-composer-panel-table tr.dsm-trae-composer-panel-row-current .dsm-trae-composer-panel-dot{
  background:var(--dsw-alias-state-success-primary,#22c55e);
}
.dsm-trae-composer-panel-foot{
  display:flex;justify-content:space-between;gap:8px;
  margin-top:9px;padding-top:7px;
  border-top:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.24));
  font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,GrayText);
}
.dsm-trae-composer-panel-empty{margin:0;color:var(--dsw-alias-label-tertiary,GrayText)}
.dsm-trae-composer-panel-error{margin:8px 0 0;color:var(--dsw-alias-state-error-primary,#d92d20);font-size:11px;line-height:16px}
/* Credit-expiry notice. Three tones by urgency, so the 24-hour case cannot be
   mistaken for the 7-day one at a glance. Reads as an advisory, not an error:
   the account works fine, the credit is simply about to lapse. */
.dsm-trae-expiry{
  display:flex;flex-direction:column;gap:2px;
  margin-top:9px;padding:8px 10px;border:1px solid;border-radius:8px;
  font-size:11px;line-height:16px;
}
.dsm-trae-expiry-soon{
  border-color:var(--dsw-alias-state-warn-secondary,#fbbf24);
  background:var(--dsw-alias-state-warn-tertiary,#fef3c7);
  color:var(--dsw-alias-label-primary,#1f2329);
}
.dsm-trae-expiry-days{
  border-color:var(--dsw-alias-state-warn-secondary,#fbbf24);
  background:transparent;
  color:var(--dsw-alias-label-primary,#1f2329);
}
.dsm-trae-expiry-week{
  border-color:var(--dsw-alias-border-l2,rgba(127,127,127,.36));
  background:transparent;
  color:var(--dsw-alias-label-secondary,GrayText);
}
.dsm-trae-expiry-lapsed{
  border-color:var(--dsw-alias-border-l2,rgba(127,127,127,.36));
  background:transparent;
  color:var(--dsw-alias-label-tertiary,GrayText);
}
.dsm-trae-expiry-detail{font-size:11px;line-height:16px;opacity:.85}
`;
		//#endregion
		//#region src/client/BusyOverlay.tsx
		/**
		* The shared busy veil's spinner: an arc that breathes while it turns.
		*
		* Deliberately the host's own state-spinner shape (dsh's `_dsh-state-dot-spin`)
		* rather than a border-ring: a two-tone CSS ring at .7s read as a loading
		* indicator from another decade and was out of step with every spinner in the
		* shell. The motion lives in CSS (`dsm-trae-veil-spin` / `-dash`), so this
		* element only describes the geometry; `currentColor` lets it inherit whatever
		* tier it sits in.
		*
		* `aria-hidden` because the veil's `role="status"` already announces the
		* message — a second announcement from a decorative arc is noise.
		*/
		function VeilSpinner() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				className: "dsm-trae-veil-spinner",
				viewBox: "0 0 20 20",
				"aria-hidden": "true",
				focusable: "false",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
					className: "dsm-trae-veil-spinner-track",
					cx: "10",
					cy: "10",
					r: "8",
					fill: "none",
					stroke: "currentColor",
					strokeWidth: "2"
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
					className: "dsm-trae-veil-spinner-arc",
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
		* wait through. `aria-busy` plus a polite live region state that to screen
		* readers, which is the whole accessibility contract a wait screen needs.
		*/
		function BusyOverlay({ message, hint, visible }) {
			if (!visible) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dsm-trae-veil",
				role: "status",
				"aria-busy": "true",
				"aria-live": "polite",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dsm-trae-veil-card",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(VeilSpinner, {}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dsm-trae-veil-text",
							children: message
						}),
						hint === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dsm-trae-veil-hint",
							children: hint
						})
					]
				})
			});
		}
		//#endregion
		//#region src/client/AccountPool.tsx
		/**
		* The account-pool card UI for Trae, ported from the WorkBuddy sibling.
		*
		* Mounted by {@link TraeUsageCard} inside the signed-in branch, below the
		* account table, rendered only when the usage document carries `pool` (the Host
		* omits it when the panel is unconfigured).
		*
		* This half of the feature is deliberately dumb about rules: every verdict an
		* account needs — credits, exclusion, the in-pool flag, the serving row — comes
		* pre-derived by the Host (`TraeWebPoolAccount`), so the card never re-ranks on
		* its own idea of "which account should bill". It drafts the saved preferences
		* (`TraePoolPreferences`) and writes them back through the card's verified
		* regions-write helper.
		*/
		/**
		* A finite number or the fallback.
		*
		* The usage document is served by a Host that may be OLDER than this bundle (the
		* card ships in the client bundle and updates on refresh, the Host only on
		* restart), so a field the Host does not send yet must degrade to a usable default
		* instead of rendering `undefined` into a select.
		*/
		function numberOr(value, fallback) {
			return typeof value === "number" && Number.isFinite(value) ? value : fallback;
		}
		/**
		* Probe sizes the card offers, in tokens. `0` is the minimal one-word probe.
		*
		* Deliberately a short, coarse list: the number is a spend decision (a probe at
		* 50k tokens costs real credit on every account in the batch), and offering a
		* free-text field invites values the upstream rounds away anyway.
		*/
		const PROBE_INPUT_TOKEN_CHOICES = [
			0,
			1e4,
			2e4,
			3e4,
			5e4,
			1e5
		];
		/** Compare two arrays of ids order-insensitively. */
		function sameIds(a, b) {
			const lhs = [...a ?? []].sort();
			const rhs = [...b ?? []].sort();
			return lhs.length === rhs.length && lhs.every((v, i) => v === rhs[i]);
		}
		function formatNumber$1(value) {
			return new Intl.NumberFormat(void 0, { maximumFractionDigits: 1 }).format(value);
		}
		/** `MM/DD, HH:mm` — the absolute stamp a row shows under its age. */
		function shortWhen(atMs) {
			const at = new Date(atMs);
			const pad = (value) => value < 10 ? `0${value}` : String(value);
			return `${pad(at.getMonth() + 1)}/${pad(at.getDate())}, ${pad(at.getHours())}:${pad(at.getMinutes())}`;
		}
		/** `MM/DD`, for a line that has room for a date but not a clock time. */
		function shortDate(atMs) {
			const at = new Date(atMs);
			const pad = (value) => value < 10 ? `0${value}` : String(value);
			return `${pad(at.getMonth() + 1)}/${pad(at.getDate())}`;
		}
		function relativeAt(atMs, now, t) {
			const mins = Math.max(0, Math.round((now - atMs) / 6e4));
			if (mins < 1) return t("row.poolAgoNow");
			if (mins < 60) return t("row.poolAgoMin", { n: mins });
			const hours = Math.round(mins / 60);
			if (hours < 24) return t("row.poolAgoHour", { n: hours });
			return t("row.poolAgoDay", { n: Math.round(hours / 24) });
		}
		/** A human label for every value of {@link TraeWebPoolOutcome}. */
		function outcomeLabel(outcome, t) {
			switch (outcome) {
				case "ok": return t("row.poolProbeOk");
				case "rate-limited": return t("row.poolProbeRateLimited");
				case "model-busy": return t("row.poolProbeModelBusy");
				case "out-of-credit": return t("row.poolProbeOutOfCredit");
				case "credential-rejected": return t("row.poolProbeCredentialRejected");
				case "policy-rejected": return t("row.poolProbePolicyRejected");
				case "plan-gated": return t("row.poolProbePlanGated");
				case "unavailable": return t("row.poolProbeUnavailable");
				case "not-found": return t("row.poolProbeNotFound");
				case "failed": return t("row.poolProbeFailed");
			}
		}
		/** A human label for every value of {@link TraeWebPoolExclusion}. */
		function exclusionLabel(exclusion, t) {
			switch (exclusion) {
				case "unusable": return t("row.poolExcludedUnusable");
				case "rate-limited": return t("row.poolExcludedRateLimited");
				case "model-busy": return t("row.poolExcludedModelBusy");
				case "out-of-credit": return t("row.poolExcludedOutOfCredit");
				case "credential-rejected": return t("row.poolExcludedCredentialRejected");
				case "policy-rejected": return t("row.poolExcludedPolicyRejected");
				case "plan-gated": return t("row.poolExcludedPlanGated");
				case "not-found": return t("row.poolExcludedNotFound");
				case "unavailable": return t("row.poolExcludedUnavailable");
				case "failed": return t("row.poolExcludedFailed");
			}
		}
		function probeSourceLabel(source, t) {
			switch (source) {
				case "test-batch": return t("row.poolProbeSourceTest");
				case "live-request": return t("row.poolProbeSourceLive");
				case void 0: return t("row.poolProbeSourceUnknown");
			}
		}
		/** The tone to log a test row result under. */
		function outcomeTone(outcome) {
			return outcome === "ok" ? "ok" : "warn";
		}
		/** The serving account (Host's answer), for the header badge. */
		function servingAccount(pool) {
			return pool.accounts.find((account) => account.current === true);
		}
		/**
		* Render a route refusal into a card-safe string. The error statuses the Host
		* can answer with are listed in the card doc; every one here must render as
		* TEXT (never crash). `origin-not-trusted`/`pool-unavailable` carry no body, so
		* they get a dedicated copy line keyed off the status.
		*/
		function renderRouteError(t, status, body) {
			if (status === 403 && body?.reason === "origin-not-trusted") return t("row.poolErrOrigin");
			if (status === 503) return t("row.poolErrUnavailable");
			if (status === 405) return t("row.poolErrMethod");
			if (status === 400) return t("row.poolErrBadRequest");
			if (status === 409) switch (body?.reason) {
				case "no-members": return t("row.poolErrNoMembers");
				case "no-live-members": return t("row.poolErrNoLiveMembers");
				case "target-model-stale": return t("row.poolErrTargetStale");
				case "no-free-model": return t("row.poolErrNoFreeModel");
				default: return t("row.poolErrConflict");
			}
			return t("row.poolErrGeneric", { status: String(status) });
		}
		/**
		* Handle ONE NDJSON line of a `test` answer. A non-JSON line is skipped; a
		* `{reason:'pool-failed'}` line reports the failure and counts as "saw
		* something". Returns whether the line was usable, so the caller can tell "the
		* route answered nothing parseable" (a bug to surface) from "not finished yet".
		*/
		function applyTestLine(line, t, onRow, onFailure) {
			if (line.trim() === "") return false;
			let parsed;
			try {
				parsed = JSON.parse(line);
			} catch {
				return false;
			}
			if (parsed.row !== void 0) {
				onRow(parsed.row);
				return true;
			}
			if (parsed.rows !== void 0) {
				for (const r of parsed.rows) onRow(r);
				return true;
			}
			if (parsed.reason === "pool-failed") {
				onFailure(parsed.error ?? t("row.poolLogGeneric"));
				return true;
			}
			return false;
		}
		/**
		* Read the answer line by line AS IT ARRIVES.
		*
		* The Host streams one line per account, but `response.text()` waits for the
		* whole body: with a slow probe the card sat on "逐个处理账号中…" and looked
		* frozen (a single member could take half a minute). Reading the body stream
		* makes each finished account appear immediately, and an empty/failed stream
		* still ends the loop instead of hanging the busy state forever.
		*/
		async function* testLinesOf(response) {
			const body = response.body;
			if (body === null) {
				for (const line of (await response.text()).split(/\r?\n/)) yield line;
				return;
			}
			const reader = body.getReader();
			const decoder = new TextDecoder();
			let buffer = "";
			for (;;) {
				const { done, value } = await reader.read();
				if (done) break;
				buffer += decoder.decode(value, { stream: true });
				let cut = buffer.indexOf("\n");
				while (cut >= 0) {
					yield buffer.slice(0, cut);
					buffer = buffer.slice(cut + 1);
					cut = buffer.indexOf("\n");
				}
			}
			buffer += decoder.decode();
			if (buffer.trim() !== "") yield buffer;
		}
		/**
		* How long one `test` request may take before the card gives up.
		*
		* A probe has its own upstream deadline, but a stalled connection (a restarting
		* Host, a dropped keep-alive) has none: without this the run button stays
		* disabled until the page is reloaded, which reads as "测速卡住了". Sized for a
		* batch: a few seconds per account plus room for the slowest upstream.
		*/
		const TEST_TIMEOUT_MS = 18e4;
		function AccountPool({ panel, pool, models, t, settingsScope, onChanged, onRefresh, tools, topActions, details, claims, onClaim, deviceClaimed = false, onBind, bindingBusy }) {
			const [settingsTick, setSettingsTick] = (0, react.useState)(0);
			const saved = (0, react.useMemo)(() => {
				const base = regionPoolOf(settingsScope?.getSnapshot().value, panel);
				return {
					enabled: base.enabled === true,
					targetModelId: base.targetModelId ?? pool.targetModelId ?? pool.staleTargetModelId ?? "",
					memberAccountIds: [...base.memberAccountIds ?? []],
					probeInputTokens: numberOr(base.probeInputTokens, numberOr(pool.probeInputTokens, 0))
				};
			}, [
				settingsTick,
				settingsScope,
				panel,
				pool.targetModelId,
				pool.staleTargetModelId,
				pool.probeInputTokens
			]);
			/**
			* Whether the running Host knows the probe-size preference at all.
			*
			* The card bundle and the Host update on different clocks (a page refresh vs a
			* restart), so an older Host serves a pool document without this field. Writing
			* a key that Host's schema does not declare would be dropped on the way in and
			* then fail the read-back check — a save that reports an error and changes
			* nothing. Hiding the row is the honest state: this Host cannot do it yet.
			*/
			const probeSupported = typeof pool.probeInputTokens === "number";
			const [enabled, setEnabled] = (0, react.useState)(saved.enabled);
			const [targetModelId, setTargetModelId] = (0, react.useState)(saved.targetModelId ?? "");
			const [probeInputTokens, setProbeInputTokens] = (0, react.useState)(saved.probeInputTokens);
			const [selected, setSelected] = (0, react.useState)(() => new Set(saved.memberAccountIds ?? []));
			const [busy, setBusy] = (0, react.useState)(void 0);
			const [saveError, setSaveError] = (0, react.useState)(void 0);
			const [moreRulesOpen, setMoreRulesOpen] = (0, react.useState)(false);
			const [testing, setTesting] = (0, react.useState)(void 0);
			const [rows, setRows] = (0, react.useState)({});
			const [deletingIds, setDeletingIds] = (0, react.useState)(() => /* @__PURE__ */ new Set());
			const [deleteHint, setDeleteHint] = (0, react.useState)(void 0);
			const [log, setLog] = (0, react.useState)([]);
			const [now, setNow] = (0, react.useState)(Date.now());
			const logId = (0, react.useRef)(0);
			const mountRef = (0, react.useRef)(true);
			(0, react.useEffect)(() => {
				mountRef.current = true;
				return () => {
					mountRef.current = false;
				};
			}, []);
			(0, react.useEffect)(() => settingsScope?.subscribe(() => {
				setSettingsTick((tick) => tick + 1);
			}), [settingsScope]);
			const pushLog = (tone, text) => {
				if (!mountRef.current) return;
				logId.current += 1;
				const id = logId.current;
				setLog((prev) => [...prev.slice(-49), {
					id,
					tone,
					text
				}]);
			};
			const knownIds = (0, react.useMemo)(() => new Set(pool.accounts.map((account) => account.accountId)), [pool]);
			const ghosts = (0, react.useMemo)(() => {
				const names = pool.memberNames ?? {};
				const result = [];
				for (const id of saved.memberAccountIds ?? []) {
					if (knownIds.has(id)) continue;
					const name = names[id];
					result.push({
						accountId: id,
						accountName: name === void 0 || name === "" ? id : name
					});
				}
				return result;
			}, [
				saved,
				pool,
				knownIds
			]);
			const dirty = enabled !== saved.enabled || (targetModelId ?? "") !== (saved.targetModelId ?? "") || probeSupported && probeInputTokens !== saved.probeInputTokens || !sameIds([...selected], saved.memberAccountIds);
			const writable = settingsScope?.getSnapshot().writable === true;
			const savedMemberKey = (0, react.useMemo)(() => [...saved.memberAccountIds ?? []].sort().join("\0"), [saved]);
			(0, react.useEffect)(() => {
				setEnabled(saved.enabled);
			}, [panel, saved.enabled]);
			(0, react.useEffect)(() => {
				setTargetModelId(saved.targetModelId ?? "");
			}, [panel, saved.targetModelId]);
			(0, react.useEffect)(() => {
				setProbeInputTokens(saved.probeInputTokens);
			}, [panel, saved.probeInputTokens]);
			(0, react.useEffect)(() => {
				setSelected(new Set(saved.memberAccountIds ?? []));
			}, [panel, savedMemberKey]);
			const savedKey = (0, react.useMemo)(() => `${panel}:${saved.enabled}:${saved.targetModelId ?? ""}:${saved.probeInputTokens}:${savedMemberKey}`, [
				panel,
				saved.enabled,
				saved.targetModelId,
				saved.probeInputTokens,
				savedMemberKey
			]);
			(0, react.useEffect)(() => {
				setSaveError(void 0);
			}, [savedKey]);
			const toggleMember = (accountId) => {
				setSelected((prev) => {
					const next = new Set(prev);
					if (next.has(accountId)) next.delete(accountId);
					else next.add(accountId);
					return next;
				});
			};
			const selectAll = () => {
				setSelected(/* @__PURE__ */ new Set([...pool.accounts.map((a) => a.accountId), ...saved.memberAccountIds ?? []]));
			};
			const selectNone = () => setSelected(/* @__PURE__ */ new Set());
			const discard = () => {
				setEnabled(saved.enabled);
				setTargetModelId(saved.targetModelId ?? "");
				setProbeInputTokens(saved.probeInputTokens);
				setSelected(new Set(saved.memberAccountIds ?? []));
				setSaveError(void 0);
				pushLog("info", t("row.poolLogDiscarded"));
				setNow(Date.now());
			};
			const save = async () => {
				if (!writable || busy !== void 0) return;
				setBusy("save");
				setSaveError(void 0);
				try {
					const next = {
						enabled,
						...targetModelId === "" ? {} : { targetModelId },
						memberAccountIds: [...selected],
						...probeSupported ? { probeInputTokens } : {}
					};
					await writeSettingsField(settingsScope, "regions", nextRegionPool(settingsScope.getSnapshot().value, panel, next), (readBack) => {
						const readPool = regionPoolOf(readBack, panel);
						return readPool.enabled === (next.enabled ?? false) && sameIds(readPool.memberAccountIds, next.memberAccountIds) && (readPool.targetModelId ?? "") === (next.targetModelId ?? "") && (!probeSupported || (readPool.probeInputTokens ?? 0) === probeInputTokens);
					});
					pushLog("ok", t("row.poolLogSaved"));
					onChanged?.();
					onRefresh?.();
					setNow(Date.now());
				} catch (error) {
					const message = error instanceof Error ? error.message : String(error);
					setSaveError(t("row.poolSaveFailed", { message }));
					pushLog("error", t("row.poolLogSaveFailed"));
				} finally {
					if (mountRef.current) setBusy(void 0);
				}
			};
			const runTest = async () => {
				if (busy !== void 0) return;
				const members = [...selected];
				if (members.length === 0) {
					pushLog("warn", t("row.poolLogNoMembers"));
					return;
				}
				setBusy("test");
				setRows({});
				setTesting({ done: 0 });
				setNow(Date.now());
				const targetLabel = targetModelId === "" ? t("row.poolTargetAutoOption") : models.find((m) => m.id === targetModelId)?.name ?? targetModelId;
				pushLog("info", t("row.poolLogTestStart", {
					count: members.length,
					model: targetLabel
				}));
				const controller = new AbortController();
				const timer = setTimeout(() => {
					controller.abort();
				}, TEST_TIMEOUT_MS);
				try {
					const response = await fetch(withTraePoolAction(panel, "test"), {
						method: "POST",
						signal: controller.signal
					});
					const seen = /* @__PURE__ */ new Set();
					let sawAny = false;
					for await (const line of testLinesOf(response)) if (applyTestLine(line, t, (r) => {
						const fresh = !seen.has(r.accountId);
						setRows((prev) => ({
							...prev,
							[r.accountId]: r
						}));
						if (!fresh) return;
						seen.add(r.accountId);
						if (mountRef.current) setTesting({ done: seen.size });
						pushLog(outcomeTone(r.outcome), t("row.poolLogTestRow", {
							accountName: r.accountName,
							outcome: outcomeLabel(r.outcome, t)
						}));
					}, (errorText) => {
						pushLog("error", t("row.poolLogBatchFailed", { message: errorText }));
					})) sawAny = true;
					if (!sawAny) throw new Error(t("row.poolLogGeneric"));
					pushLog("ok", t("row.poolLogTestDone"));
					onRefresh?.();
					setNow(Date.now());
				} catch (error) {
					pushLog("error", t(controller.signal.aborted ? "row.poolLogTimeout" : "row.poolLogBatchFailed", { message: error instanceof Error ? error.message : String(error) }));
				} finally {
					clearTimeout(timer);
					if (mountRef.current) {
						setBusy(void 0);
						setTesting(void 0);
					}
				}
			};
			const runSingleTest = async (account) => {
				if (busy !== void 0) return;
				setBusy("test");
				setNow(Date.now());
				const targetLabel = targetModelId === "" ? t("row.poolTargetAutoOption") : models.find((m) => m.id === targetModelId)?.name ?? targetModelId;
				pushLog("info", t("row.poolLogRowTesting", { accountName: account.accountName }));
				const controller = new AbortController();
				const timer = setTimeout(() => {
					controller.abort();
				}, TEST_TIMEOUT_MS);
				try {
					const response = await fetch(withTraePoolAccount(panel, "test", account.accountId), {
						method: "POST",
						signal: controller.signal
					});
					let sawAny = false;
					const logged = /* @__PURE__ */ new Set();
					for await (const line of testLinesOf(response)) if (applyTestLine(line, t, (r) => {
						setRows((prev) => ({
							...prev,
							[r.accountId]: r
						}));
						if (logged.has(r.accountId)) return;
						logged.add(r.accountId);
						pushLog(outcomeTone(r.outcome), t("row.poolLogTestRow", {
							accountName: r.accountName,
							outcome: outcomeLabel(r.outcome, t),
							model: targetLabel
						}));
					}, (errorText) => {
						pushLog("error", t("row.poolLogBatchFailed", { message: errorText }));
					})) sawAny = true;
					if (!sawAny) throw new Error(t("row.poolLogGeneric"));
					onRefresh?.();
					setNow(Date.now());
				} catch (error) {
					pushLog("error", t(controller.signal.aborted ? "row.poolLogTimeout" : "row.poolLogBatchFailed", { message: error instanceof Error ? error.message : String(error) }));
				} finally {
					clearTimeout(timer);
					if (mountRef.current) setBusy(void 0);
				}
			};
			/**
			* Persist the removal of ONE account out of this panel's membership.
			*
			* The slot written is the SAVED slot with ONLY `memberAccountIds` replaced —
			* never the draft's switch or target model, because the card's own hint
			* promises only the in-row actions take effect immediately
			* (「开关与目标模型是偏好，改完要保存」), and never the DOCUMENT's effective
			* target model either: that falls back to the free model when the user left
			* the choice automatic, so writing it back would pin a model they never chose.
			* The membership written is the DRAFT minus the removed id, so a checkbox the
			* user already toggled on another row is not silently discarded by the
			* settings re-read this write triggers.
			*/
			const persistRemoval = async (accountId) => {
				const scope = settingsScope;
				if (scope === void 0) throw new Error(t("row.poolLogSaveFailed"));
				const base = regionPoolOf(scope.getSnapshot().value, panel);
				const next = {
					...base,
					memberAccountIds: [...selected].filter((id) => id !== accountId)
				};
				await writeSettingsField(scope, "regions", nextRegionPool(scope.getSnapshot().value, panel, next), (readBack) => {
					const readPool = regionPoolOf(readBack, panel);
					return !readPool.memberAccountIds?.includes(accountId) && sameIds(readPool.memberAccountIds, next.memberAccountIds) && (readPool.enabled ?? false) === (base.enabled ?? false) && (readPool.targetModelId ?? "") === (base.targetModelId ?? "") && (readPool.probeInputTokens ?? 0) === (base.probeInputTokens ?? 0);
				});
			};
			/** Product names for the desktop apps a delete touched or was blocked by. */
			const appLabels = (editions) => editions.map((edition) => t(`row.edition${edition === "cn" ? "Cn" : edition === "sg" ? "Sg" : edition === "solo" ? "Solo" : "SoloSg"}`)).join("、");
			/**
			* Delete an account from this machine: drop the plugin's own credential copy,
			* then erase the account's login from Trae's `storage.json`, then clear every
			* account-holder this card holds (pool probe, settings membership, draft
			* selection, the serving binding it may have held).
			*
			* The app half is what makes the row actually disappear. It has one failure
			* mode worth its own message: a RUNNING Trae flushes its in-memory state back
			* over the file, so the Host refuses and names the app, and the card says to
			* quit it instead of reporting a generic failure the user cannot act on.
			*/
			const deleteAccount = async (account) => {
				if (busy !== void 0 || deletingIds.has(account.accountId)) return;
				setBusy("delete");
				setDeletingIds((prev) => new Set(prev).add(account.accountId));
				setDeleteHint(void 0);
				try {
					const response = await fetch(withTraePoolAccount(panel, "delete", account.accountId), { method: "POST" });
					const body = await response.json();
					if (!response.ok) throw new Error(renderRouteError(t, response.status, body));
					const blocked = body?.blockedApps ?? [];
					if (blocked.length > 0 && body?.deleted !== true) {
						setDeleteHint({
							kind: "app-running",
							accountId: account.accountId,
							accountName: account.accountName,
							apps: blocked
						});
						pushLog("warn", t("row.poolRowDeleteAppRunning", {
							accountName: account.accountName,
							apps: appLabels(blocked)
						}));
						setNow(Date.now());
						return;
					}
					if (body?.deleted !== true) throw new Error(t("row.poolRowDeleteFailed"));
					const wasMember = (saved.memberAccountIds ?? []).includes(account.accountId);
					let saveFailed = false;
					if (wasMember) {
						if (!writable) {
							saveFailed = true;
							setSaveError(t("row.poolSaveFailed", { message: t("row.poolLogSaveFailed") }));
							pushLog("error", t("row.poolLogSaveFailed"));
						} else try {
							await persistRemoval(account.accountId);
						} catch (error) {
							saveFailed = true;
							const message = error instanceof Error ? error.message : String(error);
							setSaveError(t("row.poolSaveFailed", { message }));
							pushLog("error", t("row.poolLogSaveFailed"));
						}
					}
					setSelected((prev) => {
						const next = new Set(prev);
						next.delete(account.accountId);
						return next;
					});
					if (!saveFailed) {
						if (body.stillSignedIn === true) {
							const hadCopy = body.hadCopy !== false;
							setDeleteHint({
								kind: "still-signed-in",
								accountId: account.accountId,
								accountName: account.accountName,
								hadCopy
							});
							pushLog("warn", t(hadCopy ? "row.poolRowDeleteStillSigned" : "row.poolRowDeleteNoCopy", { accountName: account.accountName }));
						} else {
							const signedOut = body.signedOutApps ?? [];
							pushLog("ok", signedOut.length === 0 ? t("row.poolRowDeleted", { accountName: account.accountName }) : t("row.poolRowDeletedSignedOut", {
								accountName: account.accountName,
								apps: appLabels(signedOut)
							}));
						}
					}
					setNow(Date.now());
					if (!saveFailed) await onRefresh?.();
				} catch (error) {
					pushLog("error", t("row.poolRowDeleteError", {
						accountName: account.accountName,
						message: error instanceof Error ? error.message : String(error)
					}));
				} finally {
					if (mountRef.current) {
						setBusy(void 0);
						setDeletingIds((prev) => {
							const next = new Set(prev);
							next.delete(account.accountId);
							return next;
						});
					}
				}
			};
			const noCandidate = pool.noCandidate;
			const showNoCandidate = pool.enabled && noCandidate !== void 0;
			const serving = servingAccount(pool);
			/**
			* The batch buttons are disabled for reasons the user cannot see (they are not
			* under the pointer, so a `title` only helps after a hover). Name them here.
			*/
			const actionNotes = [];
			if (selected.size === 0) actionNotes.push(t("row.poolActionNoteNoMembers"));
			if (pool.targetModelSource === "none") actionNotes.push(t("row.poolActionNoteTestNone"));
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: "dsm-trae-pool",
				"aria-label": t("row.poolTitle"),
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsm-trae-pool-head",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
							className: "dsm-trae-pool-title",
							children: t("row.poolTitle")
						}), pool.enabled !== true && onBind !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
							className: "dsm-trae-select dsm-trae-pool-account-select",
							"aria-label": t("row.poolManualAccountLabel"),
							value: serving?.accountId ?? "",
							disabled: bindingBusy === true || !writable,
							onChange: (event) => {
								const next = event.target.value;
								if (next !== "") onBind(next);
							},
							children: [serving === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: "",
								disabled: true,
								children: t("row.poolManualAccountNone")
							}) : null, pool.accounts.filter((account) => account.reachable !== false).map((account) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: account.accountId,
								children: account.accountName
							}, account.accountId))]
						}) : serving === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dsm-trae-pool-current",
							children: t("row.poolCurrentHeader", { account: serving.accountName })
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsm-trae-pool-settings dsm-trae-pool-modebar",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsm-trae-pool-modebar-row",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
									className: "dsm-trae-switch dsm-trae-switch-pill",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "checkbox",
										checked: enabled,
										disabled: busy !== void 0 || !writable,
										"aria-label": t("row.poolEnabled"),
										onChange: (e) => {
											setEnabled(e.target.checked);
										}
									})
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", {
									className: "dsm-trae-pool-modebar-label",
									children: t("row.poolEnabled")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsm-trae-pool-modebar-state",
									children: pool.enabled === true ? t("row.poolModeAuto") : t("row.poolModeManual")
								}),
								dirty ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsm-trae-pool-dirty",
									role: "status",
									children: t("row.poolDirty")
								}) : null
							]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dsm-trae-pool-note",
							children: t("row.poolEnabledHint")
						})]
					}),
					pool.enabled === true && serving !== void 0 && serving.member !== true ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dsm-trae-pool-note dsm-trae-pool-serving-note",
						role: "status",
						children: t("row.poolServingOutside", { account: serving.accountName })
					}) : null,
					saved.enabled === true && enabled === false ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dsm-trae-pool-off-notice",
						role: "status",
						children: t("row.poolOffNotice")
					}) : null,
					showNoCandidate ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(NoCandidateNotice, {
						noCandidate,
						t
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsm-trae-pool-card",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsm-trae-pool-card-head",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
									className: "dsm-trae-pool-card-title",
									children: t("row.poolMembersTitle")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsm-trae-pool-card-tools",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsm-trae-pool-count",
											children: t("row.poolSelectedCount", {
												count: selected.size,
												total: pool.accounts.length + ghosts.length
											})
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "dsm-btn dsm-btn-outline",
											disabled: busy !== void 0,
											onClick: selectAll,
											children: t("row.poolSelectAll")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "dsm-btn dsm-btn-outline",
											disabled: busy !== void 0,
											onClick: selectNone,
											children: t("row.poolSelectNone")
										})
									]
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsm-trae-pool-actions",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "dsm-btn dsm-btn-outline dsm-trae-pool-action-test",
										disabled: busy !== void 0 || selected.size === 0 || pool.targetModelSource === "none",
										title: pool.targetModelSource === "none" ? t("row.poolTargetNoneHint") : void 0,
										onClick: () => {
											runTest();
										},
										children: busy === "test" ? t("row.poolTesting") : t("row.poolTestAll")
									}),
									busy === "test" || testing !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsm-trae-pool-busy",
										role: "status",
										children: t("row.poolBusyHint")
									}) : null,
									topActions === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsm-trae-pool-actions-end",
										children: topActions
									})
								]
							}),
							actionNotes.length === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsm-trae-pool-action-note",
								children: actionNotes.join(" · ")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: pool.checkinSupported ? "dsm-trae-pool-table" : "dsm-trae-pool-table dsm-trae-pool-table-no-checkin",
								role: "table",
								"aria-label": t("row.poolMembersTitle"),
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(MemberRowHeader, {
										t,
										checkinSupported: pool.checkinSupported
									}),
									pool.accounts.map((account) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MemberRow, {
										account,
										showCheckin: pool.checkinSupported,
										deviceClaimed,
										models,
										rows,
										checked: selected.has(account.accountId),
										poolEnabled: pool.enabled === true,
										poolModelId: pool.targetModelId ?? "",
										detail: details?.[account.accountId],
										claim: claims?.[account.accountId],
										onClaim,
										onToggle: () => {
											toggleMember(account.accountId);
										},
										onTest: () => {
											runSingleTest(account);
										},
										t,
										disabled: busy !== void 0 || !writable,
										deleting: deletingIds.has(account.accountId),
										onDelete: () => {
											deleteAccount(account);
										},
										canDelete: pool.deleteSupported === true,
										formatNumber: formatNumber$1,
										relativeAt
									}, account.accountId)),
									ghosts.map((ghost) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MemberGhostRow, {
										ghost,
										showCheckin: pool.checkinSupported,
										checked: selected.has(ghost.accountId),
										onToggle: () => {
											toggleMember(ghost.accountId);
										},
										t,
										disabled: busy !== void 0 || !writable,
										deleting: deletingIds.has(ghost.accountId),
										onDelete: () => {
											deleteAccount(ghost);
										},
										canDelete: pool.deleteSupported === true
									}, `ghost:${ghost.accountId}`))
								]
							}),
							ghosts.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsm-trae-pool-ghost-note",
								role: "status",
								children: t("row.poolGhostMembers", {
									count: ghosts.length,
									names: ghosts.map((g) => g.accountName).join("、")
								})
							}) : null,
							deleteHint?.kind === "still-signed-in" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsm-trae-pool-delete-hint",
								role: "status",
								children: t(deleteHint.hadCopy ? "row.poolDeleteStillSigned" : "row.poolDeleteNoCopy", { accountName: deleteHint.accountName })
							}) : null,
							deleteHint?.kind === "app-running" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsm-trae-pool-delete-hint dsm-trae-pool-delete-hint-action",
								role: "status",
								children: t("row.poolDeleteAppRunning", {
									accountName: deleteHint.accountName,
									apps: appLabels(deleteHint.apps)
								})
							}) : null,
							dirty ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsm-trae-pool-unsaved",
								role: "status",
								children: t("row.poolUnsavedMembers")
							}) : null
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsm-trae-pool-settings-wrap",
						children: [
							tools === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsm-trae-pool-tools dsm-trae-pool-tools-dashed",
								children: tools
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsm-trae-pool-head",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
									className: "dsm-trae-pool-title",
									children: t("row.poolSettingsTitle")
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
								className: "dsm-trae-pool-more",
								open: moreRulesOpen,
								onToggle: (event) => setMoreRulesOpen(event.currentTarget.open),
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", {
									className: "dsm-trae-pool-more-summary",
									children: t("row.poolMoreRulesTitle")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsm-trae-pool-more-body",
									children: [
										pool.copies === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											className: "dsm-trae-pool-note",
											role: "note",
											children: t("row.poolCopyFile", {
												path: pool.copies.path,
												count: pool.copies.count
											})
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											className: "dsm-trae-pool-note",
											children: t("row.poolSettingsNote")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											className: "dsm-trae-pool-note",
											children: t("row.poolDeleteHint")
										})
									]
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsm-trae-pool-settings",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsm-trae-pool-set",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: "dsm-trae-pool-set-copy",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", { children: t("row.poolTargetLabel") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("row.poolTargetHint") })]
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsm-trae-pool-set-ctl",
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
												className: "dsm-trae-select",
												"aria-label": t("row.poolTargetLabel"),
												value: targetModelId,
												disabled: busy !== void 0 || !writable,
												onChange: (e) => {
													setTargetModelId(e.target.value);
												},
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
														value: "",
														children: t("row.poolTargetAutoOption")
													}),
													models.map((model) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
														value: model.id,
														children: model.name
													}, model.id)),
													pool.targetModelSource === "stale" && pool.staleTargetModelId !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
														value: pool.staleTargetModelId,
														children: t("row.poolTargetStaleOption", { model: pool.staleTargetModelId })
													}) : null
												]
											})
										})]
									}),
									pool.targetModelSource === "stale" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsm-trae-pool-target-stale",
										role: "status",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("row.poolTargetStale", { model: pool.staleTargetModelId ?? "" }) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "dsm-btn dsm-btn-outline",
											disabled: busy !== void 0,
											onClick: () => {
												setTargetModelId("");
												pushLog("info", t("row.poolLogTargetCleared"));
											},
											children: t("row.poolTargetStaleClear")
										})]
									}) : null,
									pool.targetModelSource === "none" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
										className: "dsm-trae-pool-target-none",
										role: "status",
										children: [
											t("row.poolTargetNone"),
											" — ",
											t("row.poolTargetNoneHint")
										]
									}) : null,
									probeSupported ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsm-trae-pool-set",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: "dsm-trae-pool-set-copy",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", { children: t("row.poolProbeSizeLabel") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("row.poolProbeSizeHint") })]
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsm-trae-pool-set-ctl",
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
												className: "dsm-trae-select",
												"aria-label": t("row.poolProbeSizeLabel"),
												value: String(probeInputTokens),
												disabled: busy !== void 0 || !writable,
												onChange: (e) => {
													setProbeInputTokens(Number(e.target.value));
												},
												children: PROBE_INPUT_TOKEN_CHOICES.map((choice) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
													value: String(choice),
													children: choice === 0 ? t("row.poolProbeSizeDefault") : t("row.poolProbeSizeOption", { wan: choice / 1e4 })
												}, choice))
											})
										})]
									}) : null,
									saveError === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: "dsm-trae-pool-save-error",
										role: "alert",
										children: saveError
									})
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsm-trae-pool-save-row",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("a", {
									className: "dsm-trae-usage-cheer",
									href: "https://github.com/dingminhua/dsh-connect-trae",
									target: "_blank",
									rel: "noreferrer noopener",
									children: [t("row.cheer"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsm-trae-usage-cheer-star",
										"aria-hidden": "true",
										children: "★"
									})]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsm-trae-pool-save-buttons",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "dsm-btn dsm-btn-outline",
										disabled: !dirty || busy !== void 0,
										onClick: discard,
										children: t("row.poolDiscard")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "dsm-btn dsm-btn-primary",
										disabled: !dirty || busy !== void 0,
										onClick: () => {
											save();
										},
										children: busy === "save" ? t("row.poolSaving") : t("row.poolSaved")
									})]
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ActivityLog, {
						log,
						t,
						now,
						relativeAt,
						onClear: () => setLog([])
					})
				]
			});
		}
		function NoCandidateNotice({ noCandidate, t }) {
			if (noCandidate === "empty") return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsm-trae-pool-warning dsm-trae-pool-warning-empty",
				role: "status",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dsm-trae-pool-warning-title",
					children: t("row.poolNoCandidateEmpty")
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dsm-trae-pool-warning-hint",
					children: t("row.poolNoCandidateEmptyHint")
				})]
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsm-trae-pool-warning dsm-trae-pool-warning-unusable",
				role: "status",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dsm-trae-pool-warning-title",
					children: t("row.poolNoCandidateUnusable")
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: "dsm-trae-pool-warning-hint",
					children: [
						t("row.poolNoCandidateHint"),
						" ",
						exclusionLabel(noCandidate, t)
					]
				})]
			});
		}
		function MemberRowHeader({ t, checkinSupported }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsm-trae-pool-row dsm-trae-pool-row-head",
				role: "row",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dsm-trae-pool-col-account",
						children: t("row.poolColumnAccount")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("row.poolColumnCredits") }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("row.poolColumnProbe") }),
					checkinSupported ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("row.poolColumnCheckin") }) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {})
				]
			});
		}
		function MemberRow({ account, models, rows, checked, onToggle, onTest, t, disabled, deleting, onDelete, canDelete, formatNumber, relativeAt, detail, claim, onClaim, showCheckin, deviceClaimed, poolEnabled, poolModelId }) {
			/**
			* Whether this row is the one billing the next request — and, with the pool on,
			* whether that claim is the pool's own.
			*
			* `account.current` alone is not enough: with an empty (or fully excluded) pool
			* the Host deliberately falls back to the saved selection, so a removed account
			* stays `current` and the pill would keep announcing it as the pool's pick.
			* A row can only be the rotation's answer while it is a member.
			*/
			const isCurrent = account.current === true && (poolEnabled !== true || account.member === true);
			const hasCopy = account.reachable;
			const credit = account.generalAvailable;
			const excluded = account.excludedBy;
			const checkin = account.checkedInToday;
			const device = account.deviceCheckedIn;
			const testRow = rows[account.accountId];
			/**
			* Whether the probe column already explains WHY this row is excluded.
			*
			* The exclusion tag and the probe cell are derived from the same verdict, so a
			* row that shows both says 「登录凭据被拒」 twice, six centimetres apart. Keep
			* the tag only for the case the cell cannot cover: no probe to show at all
			* (e.g. a stored member whose last test predates this session).
			*/
			const probeOnScreen = testRow !== void 0 || account.probe !== void 0;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: `dsm-trae-pool-row${isCurrent ? " dsm-trae-pool-row-current" : ""}`,
				role: "row",
				"data-account-id": account.accountId,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsm-trae-pool-account",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
								className: "dsm-trae-pool-check",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "checkbox",
									checked,
									disabled,
									onChange: onToggle,
									"aria-label": t("row.poolSelectAria", { accountName: account.accountName })
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "dsm-trae-pool-account-name",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: `dsm-trae-pool-dot dsm-trae-pool-dot-${account.reachable === false ? "ghost" : excluded ? "excluded" : "ok"}`,
										"aria-hidden": "true"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", { children: account.accountName !== "" ? account.accountName : account.accountId }),
									detail?.meta === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsm-trae-pool-meta",
										children: detail.meta
									}),
									detail?.warn === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: `dsm-trae-pool-warn-tag dsm-trae-pool-warn-tag-${detail.warnTone ?? "soon"}`,
										role: "status",
										children: detail.warn
									})
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "dsm-trae-pool-account-tags",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: checked ? "dsm-trae-pool-member" : "dsm-trae-pool-not-member",
										children: checked ? t("row.poolMember") : t("row.poolNotMember")
									}),
									account.reachable === false ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsm-trae-pool-tag dsm-trae-pool-tag-ghost",
										role: "status",
										children: t("row.poolNoCopyTag")
									}) : null,
									excluded && !probeOnScreen ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsm-trae-pool-tag dsm-trae-pool-tag-excluded",
										children: exclusionLabel(excluded, t)
									}) : null,
									account.tokenExpired === true && excluded !== "credential-rejected" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsm-trae-pool-warn-tag dsm-trae-pool-warn-tag-lapsed",
										children: t("row.poolTokenExpired")
									}) : null
								]
							}),
							account.probe?.atMs === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dsm-trae-pool-account-note",
								children: t("row.poolProbeAt", { when: shortWhen(account.probe.atMs) })
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsm-trae-pool-credit",
						title: t("row.poolWorkHint"),
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dsm-trae-pool-credit-num",
							children: credit === void 0 ? t("row.poolCreditNone") : formatNumber(credit)
						}), credit === void 0 || account.nearestExpiryMs === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dsm-trae-pool-credit-meta",
							children: t("row.poolCreditExpiry", { when: shortDate(account.nearestExpiryMs) })
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsm-trae-pool-probe",
						children: testRow !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProbeResult, {
							outcome: testRow.outcome,
							modelId: testRow.modelId,
							atMs: void 0,
							source: void 0,
							t,
							relativeAt,
							now: Date.now(),
							detail: testRow.detail,
							poolModelId
						}) : account.probe !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProbeResult, {
							outcome: account.probe.outcome,
							modelId: account.probe.modelId,
							atMs: account.probe.atMs,
							source: account.probe.source,
							t,
							relativeAt,
							now: Date.now(),
							detail: account.probe.message,
							poolModelId
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dsm-trae-pool-probe-none",
							children: t("row.poolNeverTested")
						})
					}),
					showCheckin ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsm-trae-pool-checkin",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: `dsm-trae-pool-checkin-state dsm-trae-pool-checkin-${checkin === void 0 ? "unknown" : checkin ? "ok" : device === true || deviceClaimed ? "device" : "no"}`,
							children: checkin === void 0 ? t("row.poolCheckinUnknown") : checkin ? t("row.poolCheckedIn") : device === true || deviceClaimed ? t("row.poolDeviceUsed") : t("row.poolNotCheckedIn")
						}), claim === void 0 || onClaim === void 0 || claim.claimable === false ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "dsm-btn dsm-btn-outline dsm-trae-pool-claim",
							disabled: claim.disabled || disabled,
							title: claim.title,
							onClick: () => {
								onClaim(account.accountId);
							},
							children: claim.label
						})]
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsm-trae-pool-row-actions",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "dsm-btn dsm-btn-outline",
							disabled: disabled || hasCopy === false,
							title: hasCopy === false ? t("row.poolNoCopyTestHint") : void 0,
							onClick: onTest,
							children: t("row.poolRowTest")
						}), canDelete ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "dsm-btn dsm-btn-outline-danger dsm-trae-pool-delete",
							disabled: disabled || deleting,
							"aria-label": t("row.poolRowDeleteAria", { accountName: account.accountName }),
							onClick: onDelete,
							children: deleting ? t("row.poolRowDeleting") : t("row.poolRowDelete")
						}) : null]
					})
				]
			});
		}
		function MemberGhostRow({ ghost, checked, onToggle, t, disabled, deleting, onDelete, canDelete, showCheckin }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsm-trae-pool-row dsm-trae-pool-row-ghost",
				role: "row",
				"data-account-id": ghost.accountId,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsm-trae-pool-account",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
								className: "dsm-trae-pool-check",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "checkbox",
									checked,
									disabled,
									onChange: onToggle,
									"aria-label": t("row.poolSelectAria", { accountName: ghost.accountName })
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "dsm-trae-pool-account-name",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsm-trae-pool-dot dsm-trae-pool-dot-ghost",
									"aria-hidden": "true"
								}), ghost.accountName]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "dsm-trae-pool-account-tags",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: checked ? "dsm-trae-pool-member" : "dsm-trae-pool-not-member",
									children: checked ? t("row.poolMember") : t("row.poolNotMember")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsm-trae-pool-tag dsm-trae-pool-tag-ghost",
									children: t("row.poolExcludedUnusable")
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsm-trae-pool-credit",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dsm-trae-pool-credit-num",
							children: t("row.poolCreditNone")
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsm-trae-pool-probe",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dsm-trae-pool-probe-none",
							children: t("row.poolNeverTested")
						})
					}),
					showCheckin ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsm-trae-pool-checkin",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dsm-trae-pool-checkin-state dsm-trae-pool-checkin-unknown",
							children: t("row.poolCheckinUnknown")
						})
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsm-trae-pool-row-actions",
						children: canDelete ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "dsm-btn dsm-btn-outline-danger dsm-trae-pool-delete",
							disabled: disabled || deleting,
							"aria-label": t("row.poolGhostDeleteAria", { accountName: ghost.accountName }),
							onClick: onDelete,
							children: deleting ? t("row.poolRowDeleting") : t("row.poolRowDelete")
						}) : null
					})
				]
			});
		}
		function ProbeResult({ outcome, modelId, atMs, source, detail, poolModelId, t, relativeAt, now }) {
			const tone = outcome === "ok" ? "ok" : "warn";
			const modelDiffers = modelId !== void 0 && modelId !== poolModelId;
			const sourceLabel = source === void 0 ? "" : probeSourceLabel(source, t);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsm-trae-pool-probe-cell",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: `dsm-trae-pool-probe-outcome dsm-trae-pool-probe-${tone}`,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dsm-trae-pool-dot dsm-trae-pool-dot-ok",
							"aria-hidden": "true"
						}), outcomeLabel(outcome, t)]
					}),
					atMs === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dsm-trae-pool-probe-meta",
						children: t("row.poolProbeMeasured", { when: relativeAt(atMs, now, t) })
					}),
					modelDiffers ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: "dsm-trae-pool-probe-meta",
						children: [t("row.poolProbeModel", { model: modelId }), sourceLabel === "" ? "" : ` · ${sourceLabel}`]
					}) : sourceLabel === "" ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dsm-trae-pool-probe-meta",
						children: sourceLabel
					}),
					detail !== void 0 && detail !== "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dsm-trae-pool-probe-detail",
						children: detail
					}) : null
				]
			});
		}
		function ActivityLog({ log, t, now, relativeAt, onClear }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsm-trae-pool-log",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dsm-trae-pool-log-head",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h4", {
						className: "dsm-trae-pool-subtitle",
						children: t("row.poolLogTitle")
					}), log.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "dsm-btn dsm-btn-outline",
						onClick: onClear,
						children: t("row.poolLogClear")
					}) : null]
				}), log.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: "dsm-trae-pool-log-empty",
					children: t("row.poolLogEmpty")
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ol", {
					className: "dsm-trae-pool-log-list",
					children: log.map((entry) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", {
						className: `dsm-trae-pool-log-item dsm-trae-pool-log-${entry.tone}`,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dsm-trae-pool-log-text",
							children: entry.text
						})
					}, entry.id))
				})]
			});
		}
		//#endregion
		//#region src/client/AccountTransfer.tsx
		/**
		* The card's account-transfer section: batch export and import of a region's
		* stored credentials, in the file format shared with sibling credential
		* managers for the same upstream (the `dsh-connect-workbuddy` family).
		*
		* Modelled on that plugin's `AccountTransfer`, deliberately: the two plugins
		* share one external-presentation language, and a user who has imported
		* accounts in one should recognise the flow in the other. The shape is a single
		* section owning all of its state (busy / result line / error), with the export
		* dialog (pick accounts → download JSON) and the import dialog (pick file →
		* desensitised preview → tick → import) split the same way.
		*
		* Two properties are load-bearing and must not be relaxed:
		*  - The preview carries display fields and a `hasToken` boolean only. Tokens
		*    never enter the browser at all until the user explicitly exports a chosen
		*    account, and the Host re-parses the file on import rather than trusting
		*    anything this component says about it.
		*  - Import is offered even when the region has NO account: a machine that has
		*    never signed in is exactly where importing someone else's export matters
		*    most. Only EXPORT needs an existing account to select.
		*
		* The download uses `<a download>` on a Blob because the card runs inside the
		* settings iframe and has no host save dialog; a same-origin anchor download is
		* the reliable path there.
		*
		* @module dsh-connect-trae/client/AccountTransfer
		*/
		/** How long the veil may wait for the card's re-read before it comes down. */
		const REFRESH_SETTLE_TIMEOUT_MS = 5e3;
		/** Build the default export file name: trae-accounts-YYYY-MM-DD.json. */
		function exportFileName() {
			const pad = (value) => String(value).padStart(2, "0");
			const now = /* @__PURE__ */ new Date();
			return `trae-accounts-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
		}
		/** Download a JSON value as a local file (no host save dialog inside the iframe). */
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
		/** Resolve once `value` settles, or after `timeoutMs` — whichever comes first. */
		async function settlesWithin(value, timeoutMs) {
			await Promise.race([Promise.resolve(value).catch(() => void 0), new Promise((resolve) => {
				setTimeout(resolve, timeoutMs);
			})]);
		}
		function AccountTransfer({ t, region, accounts, onChanged, hideLabel = false }) {
			const [phase, setPhase] = (0, react.useState)({ kind: "idle" });
			const [dialog, setDialog] = (0, react.useState)(void 0);
			const [selected, setSelected] = (0, react.useState)(/* @__PURE__ */ new Set());
			const [preview, setPreview] = (0, react.useState)(void 0);
			const [importSelected, setImportSelected] = (0, react.useState)(/* @__PURE__ */ new Set());
			const fileInput = (0, react.useRef)(null);
			/**
			* The text of the file the user just picked, held here rather than re-read
			* from the input at import time: the picker is a bare system dialog that
			* closes immediately, so between preview and confirm no dialog holds the
			* File. Re-reading `fileInput.current.files` would also break the moment
			* anything clears the input — and it must be cleared after every pick, or
			* choosing the SAME file twice fires no change event.
			*/
			const importText = (0, react.useRef)("");
			const mounted = (0, react.useRef)(true);
			(0, react.useEffect)(() => {
				mounted.current = true;
				return () => {
					mounted.current = false;
				};
			}, []);
			const closeDialog = () => {
				setDialog(void 0);
				setSelected(/* @__PURE__ */ new Set());
				setPreview(void 0);
				setImportSelected(/* @__PURE__ */ new Set());
			};
			const runExport = async () => {
				if (selected.size === 0) return;
				setPhase({ kind: "exporting" });
				try {
					const response = await fetch(withTraeTransferAction(TRAE_TRANSFER_PATH, region, "export"), {
						method: "POST",
						headers: {
							"content-type": "application/json",
							accept: "application/json"
						},
						credentials: "same-origin",
						body: JSON.stringify({ accountIds: [...selected] })
					});
					const body = await response.json();
					if (!mounted.current) return;
					if (!response.ok || !Array.isArray(body.accounts)) {
						setPhase({
							kind: "error",
							message: body.error ?? `HTTP ${response.status}`
						});
						return;
					}
					const fileName = exportFileName();
					downloadJson(fileName, body.accounts);
					closeDialog();
					setPhase({
						kind: "done",
						message: t("row.transferExported", {
							count: body.accounts.length,
							fileName
						})
					});
				} catch (error) {
					if (mounted.current) setPhase({
						kind: "error",
						message: error instanceof Error ? error.message : String(error)
					});
				}
			};
			const readImportFile = async (file) => {
				setPhase({ kind: "importing" });
				try {
					const text = await file.text();
					importText.current = text;
					const response = await fetch(withTraeTransferAction(TRAE_TRANSFER_PATH, region, "preview"), {
						method: "POST",
						headers: {
							"content-type": "application/json",
							accept: "application/json"
						},
						credentials: "same-origin",
						body: JSON.stringify({ text })
					});
					const body = await response.json();
					if (!mounted.current) return;
					if (!response.ok || !Array.isArray(body.accounts)) {
						setPhase({
							kind: "error",
							message: body.error ?? `HTTP ${response.status}`
						});
						return;
					}
					setPreview(body);
					setImportSelected(new Set(body.accounts.filter((entry) => entry.hasToken).map((entry) => entry.index)));
					setPhase({ kind: "idle" });
				} catch (error) {
					if (mounted.current) setPhase({
						kind: "error",
						message: error instanceof Error ? error.message : String(error)
					});
				}
			};
			const runImport = async () => {
				if (preview === void 0 || importSelected.size === 0 || importText.current === "") return;
				setPhase({ kind: "importing" });
				try {
					const response = await fetch(withTraeTransferAction(TRAE_TRANSFER_PATH, region, "import"), {
						method: "POST",
						headers: {
							"content-type": "application/json",
							accept: "application/json"
						},
						credentials: "same-origin",
						body: JSON.stringify({
							text: importText.current,
							indexes: [...importSelected]
						})
					});
					const body = await response.json();
					if (!mounted.current) return;
					if (!response.ok || typeof body.imported !== "number") {
						setPhase({
							kind: "error",
							message: body.error ?? `HTTP ${response.status}`
						});
						return;
					}
					closeDialog();
					const message = t("row.transferImported", {
						imported: body.imported,
						skipped: body.skipped ?? 0
					});
					setPhase({
						kind: "refreshing",
						message
					});
					await settlesWithin(onChanged?.(), REFRESH_SETTLE_TIMEOUT_MS);
					if (!mounted.current) return;
					setPhase({
						kind: "done",
						message
					});
				} catch (error) {
					if (mounted.current) setPhase({
						kind: "error",
						message: error instanceof Error ? error.message : String(error)
					});
				}
			};
			const busy = phase.kind === "exporting" || phase.kind === "importing" || phase.kind === "refreshing";
			const veilMessage = phase.kind === "exporting" ? t("row.transferExporting") : phase.kind === "importing" || phase.kind === "refreshing" ? t("row.transferImporting") : "";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: hideLabel ? "dsm-trae-transfer dsm-trae-transfer-flat" : "dsm-trae-transfer",
				"aria-label": t("row.transferTitle"),
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(BusyOverlay, {
						visible: busy,
						message: veilMessage,
						...busy ? { hint: t("row.transferVeilHint") } : {}
					}),
					hideLabel ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dsm-trae-transfer-label",
						children: t("row.transferTitle")
					}),
					phase.kind === "done" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dsm-trae-transfer-status dsm-trae-transfer-ok",
						children: phase.message
					}) : phase.kind === "error" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dsm-trae-transfer-status dsm-trae-transfer-error",
						children: t("row.transferError", { message: phase.message })
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsm-trae-transfer-actions",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "dsm-btn dsm-btn-outline",
							disabled: busy || accounts.length === 0,
							onClick: () => {
								setSelected(/* @__PURE__ */ new Set());
								setDialog("export");
							},
							children: t("row.transferExport")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "dsm-btn dsm-btn-outline",
							disabled: busy,
							onClick: () => {
								fileInput.current?.click();
							},
							children: t("row.transferImport")
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						ref: fileInput,
						type: "file",
						accept: "application/json,.json",
						className: "dsm-trae-transfer-file",
						onChange: (event) => {
							const file = event.target.files?.[0];
							event.target.value = "";
							if (file !== void 0) {
								setPreview(void 0);
								setImportSelected(/* @__PURE__ */ new Set());
								setDialog("import");
								readImportFile(file);
							}
						}
					}),
					dialog === "export" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsm-trae-transfer-dialog",
						role: "dialog",
						"aria-label": t("row.transferExport"),
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("row.transferExportPick", { total: accounts.length }) }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsm-trae-hint",
								children: t("row.transferHint")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
								className: "dsm-trae-transfer-list",
								children: accounts.map((account) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "checkbox",
									checked: selected.has(account.id),
									onChange: (event) => {
										const next = new Set(selected);
										if (event.target.checked) next.add(account.id);
										else next.delete(account.id);
										setSelected(next);
									}
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: account.accountName })] }) }, account.id))
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsm-trae-transfer-dialog-actions",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "dsm-btn",
									disabled: selected.size === 0,
									onClick: () => {
										runExport();
									},
									children: t("row.transferExportConfirm", { count: selected.size })
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "dsm-btn dsm-btn-outline",
									onClick: closeDialog,
									children: t("row.transferCancel")
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dsm-trae-transfer-link",
								onClick: () => setSelected(new Set(accounts.map((account) => account.id))),
								children: t("row.transferSelectAll")
							})
						]
					}) : null,
					dialog === "import" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsm-trae-transfer-dialog",
						role: "dialog",
						"aria-label": t("row.transferImport"),
						children: preview === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("row.transferReading") }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("row.transferImportPick", { total: preview.total }) }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
								className: "dsm-trae-transfer-list",
								children: preview.accounts.map((entry) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "checkbox",
									checked: importSelected.has(entry.index),
									disabled: !entry.hasToken,
									onChange: (event) => {
										const next = new Set(importSelected);
										if (event.target.checked) next.add(entry.index);
										else next.delete(entry.index);
										setImportSelected(next);
									}
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
									entry.nickname || entry.uid || t("row.transferUnnamed"),
									entry.email === "" ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: "dsm-trae-hint",
										children: [" · ", entry.email]
									}),
									entry.hasToken ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: "dsm-trae-hint",
										children: [" · ", t("row.transferNoToken")]
									})
								] })] }) }, entry.index))
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsm-trae-transfer-dialog-actions",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "dsm-btn",
									disabled: importSelected.size === 0,
									onClick: () => {
										runImport();
									},
									children: t("row.transferImportConfirm", { count: importSelected.size })
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "dsm-btn dsm-btn-outline",
									onClick: closeDialog,
									children: t("row.transferCancel")
								})]
							})
						] })
					}) : null
				]
			});
		}
		//#endregion
		//#region src/client/display.ts
		/** A group-separated integer, in the reader's own locale. */
		function formatNumber(value) {
			return new Intl.NumberFormat(void 0, {
				minimumFractionDigits: 0,
				maximumFractionDigits: 0
			}).format(value);
		}
		/** A date and time, in the reader's own locale. */
		function formatDateTime(value) {
			return new Intl.DateTimeFormat(void 0, {
				year: "numeric",
				month: "2-digit",
				day: "2-digit",
				hour: "2-digit",
				minute: "2-digit"
			}).format(new Date(value));
		}
		/**
		* The colour of a status dot, as an inline style.
		*
		* Inline rather than a class because the colour IS the value (signed-in / error
		* / signed-out); a class per state would be three names that say the same thing.
		*/
		function dotStyle(status) {
			return { background: status === "signed-in" ? "var(--dsw-alias-state-success-primary, #22a06b)" : status === "error" ? "var(--dsw-alias-state-error-primary, #d92d20)" : "var(--dsw-alias-label-dimmed, #9aa0a6)" };
		}
		/** How close a refresh token must be to lapsing before the card warns, in days. */
		const REFRESH_WARN_DAYS = 30;
		/**
		* The refresh-token warning for one account, or undefined when there is nothing
		* worth saying.
		*
		* The access token renews itself every few minutes, so its own expiry answers
		* "when does this need attention" with "never, until the refresh token lapses".
		* The refresh token is therefore the only honest countdown on this card, and it
		* has to be shown BEFORE it runs out: once it lapses the plugin cannot renew at
		* all and the only recovery is signing in to Trae again, which a user who has
		* been reading "auto-renewal" for months has no reason to expect.
		*
		* Three tones, matching the credit-expiry notice: `lapsed` (renewal already
		* dead), `soon` (inside the warning window), and nothing otherwise — a healthy
		* token must not add a line to every account row forever.
		*/
		function refreshTokenWarning(expiresAtMs, nowMs, t, formatTime) {
			if (expiresAtMs === void 0) return void 0;
			const text = formatTime(expiresAtMs);
			if (expiresAtMs <= nowMs) return {
				tone: "lapsed",
				text: t("row.refreshTokenLapsed", { expiresAt: text })
			};
			const days = Math.ceil((expiresAtMs - nowMs) / 864e5);
			if (days > REFRESH_WARN_DAYS) return void 0;
			return {
				tone: "soon",
				text: t("row.refreshTokenExpiring", {
					expiresAt: text,
					days
				})
			};
		}
		//#endregion
		//#region src/client/expiry-ladder.ts
		/**
		* Choose the notice's tier and its figures.
		*
		* Escalation order matters: a live expiry the user can still act on outranks
		* a lapsed one they cannot, even when the lapsed amount is larger.
		*
		* The 3-day tier exists because the 7-day bucket covers it. Without it, credit
		* expiring in two days was reported as "within 7 days" — true, but three times
		* too coarse to plan around, in the one sentence whose job is "how long do I
		* have left".
		*/
		function expiryNotice(expiry) {
			if (expiry.within24h.packs > 0) return {
				tier: "soon",
				total: expiry.within24h.total,
				packs: expiry.within24h.packs,
				...expiry.within24h.earliestExpiresAtMs === void 0 ? {} : { soonestExpiresAtMs: expiry.within24h.earliestExpiresAtMs }
			};
			if (expiry.within3d.packs > 0) return {
				tier: "days",
				total: expiry.within3d.total,
				packs: expiry.within3d.packs,
				...expiry.within3d.earliestExpiresAtMs === void 0 ? {} : { soonestExpiresAtMs: expiry.within3d.earliestExpiresAtMs }
			};
			if (expiry.within7d.packs > 0) return {
				tier: "week",
				total: expiry.within7d.total,
				packs: expiry.within7d.packs,
				...expiry.within7d.earliestExpiresAtMs === void 0 ? {} : { soonestExpiresAtMs: expiry.within7d.earliestExpiresAtMs }
			};
			if (expiry.expired.packs > 0) return {
				tier: "lapsed",
				total: expiry.expired.total,
				packs: expiry.expired.packs
			};
		}
		/**
		* The locale key that states this tier's headline.
		*
		* Kept beside the tier choice so a new tier cannot be added without its copy.
		*/
		function expiryHeadlineKey(tier) {
			switch (tier) {
				case "soon": return "row.expiryWarningSoon";
				case "days": return "row.expiryWarningDays";
				case "week": return "row.expiryWarningWeek";
				case "lapsed": return "row.expiryWarningLapsed";
			}
		}
		/**
		* The CSS class that gives this tier its urgency tone.
		*
		* Four tones so the 24-hour case cannot be mistaken for the 3-day one, nor
		* either for the 7-day one, at a glance. The 3-day tone sits BETWEEN the other
		* two: it carries the warning border (a 3-day expiry must not be scrolled past
		* unnoticed) but not the warning fill (a 3-day pack is not the emergency a
		* 24-hour pack is).
		*/
		function expiryToneClass(tier) {
			switch (tier) {
				case "soon": return "dsm-trae-expiry-soon";
				case "days": return "dsm-trae-expiry-days";
				case "week": return "dsm-trae-expiry-week";
				case "lapsed": return "dsm-trae-expiry-lapsed";
			}
		}
		//#endregion
		//#region src/client/TraeAccountPanel.tsx
		/**
		* A warning that credit is about to lapse.
		*
		* The balance alone cannot express this: a pack lapsing in an hour and one
		* lapsing next month both render as "150", so a user watching only the total
		* loses the first one silently. The notice names the amount, the pack count and
		* the soonest expiry, and escalates 7d → 24h → already-lapsed.
		*
		* Renders nothing when the upstream reported no end times at all — absence of
		* expiry data is not evidence that nothing lapses, so the component stays silent
		* rather than reassuring.
		*/
		function ExpiryNotice({ expiry, t }) {
			const notice = expiryNotice(expiry);
			if (notice === void 0) return null;
			const message = t(expiryHeadlineKey(notice.tier), {
				total: formatNumber(notice.total),
				packs: String(notice.packs)
			});
			const tone = expiryToneClass(notice.tier);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: `dsm-trae-expiry ${tone}`,
				role: "status",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: message }), notice.soonestExpiresAtMs === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dsm-trae-expiry-detail",
					children: t("row.expiryEarliest", { time: formatDateTime(notice.soonestExpiresAtMs) })
				})]
			});
		}
		/** The CN check-in cell for one row: an outcome once there is nothing left to do. */
		function ClaimCell({ claim, onClaim, t }) {
			if (!claim.claimable) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: "dsm-trae-account-checkin-state",
				children: claim.settled === "claimed" ? t("row.poolCheckedIn") : t("row.poolDeviceUsed")
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				className: "dsm-trae-account-checkin",
				disabled: claim.disabled,
				title: claim.title,
				onClick: onClaim,
				children: claim.label
			});
		}
		/**
		* The account section: preferences, the roster, the pool, and every notice about
		* the credential.
		*
		* Everything here commits ON THE CLICK (the preference boxes write themselves,
		* the check-in claims immediately, the pool saves through its own footer). That
		* is precisely why this section has no 「保存」 of its own — the model catalog,
		* which does, lives in its own section.
		*/
		function TraeAccountPanel({ t, settingsScope, panel, status, statusLabel, credentialRegionIsAi, regionOn, showPointsInMainUi, onToggleShowPoints, creditPosition, onCreditPositionChange, savingPreferences, creditsLabelId, creditsHintId, rows, busy, rescanNote, onRescan, switchingAccount, onSwitchAccount, onClaim, onTransferChanged, poolDetails, poolClaims, models, deviceClaimed, onPoolChanged, onPoolRefresh, creditsUnavailable, creditsExpiry, alternatives, onSwitchToAlternative }) {
			const writable = settingsScope?.getSnapshot().writable === true;
			const signedIn = status.status === "signed-in";
			const accounts = signedIn ? status.accounts : [];
			const pool = signedIn ? status.pool : void 0;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dsm-trae-prefs",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
						className: "dsm-trae-pref",
						title: t(credentialRegionIsAi ? "row.showPointsInMainUiHintAi" : "row.showPointsInMainUiHint"),
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							type: "checkbox",
							className: "dsm-trae-pref-check",
							checked: showPointsInMainUi,
							disabled: !writable || savingPreferences,
							"aria-describedby": creditsHintId,
							onChange: (event) => {
								onToggleShowPoints(event.currentTarget.checked);
							}
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: "dsm-trae-pref-copy",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dsm-trae-pref-label",
								id: creditsLabelId,
								children: t("row.showPointsInMainUi")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dsm-trae-pref-hint",
								id: creditsHintId,
								children: t(credentialRegionIsAi ? "row.showPointsInMainUiHintAi" : "row.showPointsInMainUiHint")
							})]
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
						className: "dsm-trae-pref dsm-trae-credit-position-pref",
						title: t("row.creditPositionHint"),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: "dsm-trae-pref-copy",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "dsm-trae-pref-lead",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsm-trae-pref-label",
									children: t("row.creditPositionLabel")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
									className: "dsm-trae-credit-position",
									value: regionOn ? creditPosition : "composer",
									disabled: !regionOn || !writable || savingPreferences,
									"aria-label": t("row.creditPositionAria", { region: panel === "cn" ? t("row.tabCn") : panel === "enterprise" ? t("row.tabEnterprise") : t("row.tabAi") }),
									onChange: (event) => {
										onCreditPositionChange(event.currentTarget.value === "stats" ? "stats" : "composer");
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
								className: "dsm-trae-pref-hint",
								children: t("row.creditPositionHint")
							})]
						})
					})]
				}),
				pool !== void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
					className: "dsm-trae-accounts",
					"aria-label": t("row.accountsTitle"),
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsm-trae-accounts-head",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
								className: "dsm-trae-accounts-title",
								children: t("row.accountsTitle")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsm-trae-accounts-hint",
								children: t("row.accountsHint")
							})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dsm-btn dsm-btn-outline",
								disabled: busy,
								onClick: onRescan,
								children: busy ? t("row.accountsScanning") : t("row.refreshTokens")
							})]
						}),
						!signedIn || accounts.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dsm-trae-usage-account",
							role: "status",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsm-trae-usage-account-copy",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsm-trae-usage-status",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										"aria-hidden": "true",
										className: "dsm-trae-usage-dot",
										style: dotStyle(status.status)
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: statusLabel })]
								}), signedIn ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsm-trae-usage-expiry",
									children: t("row.tokenExpiry", { expiresAt: formatDateTime(status.tokenExpiresAtMs) })
								}) : null]
							})
						}) : null,
						status.status !== "error" && rows.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: `dsm-trae-account-table${credentialRegionIsAi ? "" : " dsm-trae-account-table-checkin"}`,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsm-trae-account-row dsm-trae-account-row-head",
								role: "row",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("row.accountColumnAccount") }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("row.accountColumnValue") }),
									credentialRegionIsAi ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("row.accountColumnCheckin") }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {})
								]
							}), rows.map((row) => {
								const warning = refreshTokenWarning(row.refreshExpiresAtMs, Date.now(), t, formatDateTime);
								return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: `dsm-trae-account-row${row.current ? " dsm-trae-account-row-current" : ""}`,
									role: "row",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: "dsm-trae-account-who",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												"aria-hidden": "true",
												className: "dsm-trae-usage-dot",
												style: dotStyle(row.selected ? "signed-in" : "signed-out")
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
												className: "dsm-trae-account-name",
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", { children: row.accountName }),
													row.current ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "dsm-trae-account-badge",
														children: t("row.accountCurrentBadge")
													}) : null,
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "dsm-trae-account-meta",
														children: row.meta
													}),
													warning === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: `dsm-trae-refresh-warn dsm-trae-refresh-warn-${warning.tone}`,
														role: "status",
														children: warning.text
													}),
													row.error === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "dsm-trae-account-note",
														role: "alert",
														children: row.error
													})
												]
											})]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsm-trae-account-worth",
											children: row.value
										}),
										credentialRegionIsAi ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsm-trae-account-checkin-cell",
											children: row.claim === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ClaimCell, {
												claim: row.claim,
												t,
												onClaim: () => {
													onClaim(row.id);
												}
											})
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsm-trae-account-actions",
											children: row.current ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: "dsm-btn dsm-btn-outline dsm-trae-account-switch",
												disabled: switchingAccount || !writable,
												onClick: () => {
													onSwitchAccount(row.id);
												},
												children: switchingAccount ? t("row.accountSwitching") : t("row.accountSwitch")
											})
										})
									]
								}, row.id);
							})]
						}) : null,
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(AccountTransfer, {
							t,
							region: panel === "ai" ? "ai" : "cn",
							accounts: accounts.map((account) => ({
								id: account.id,
								accountName: account.accountName
							})),
							onChanged: onTransferChanged
						})
					]
				}),
				signedIn && creditsUnavailable === "enterprise" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: "dsm-trae-credits-unavailable",
					role: "note",
					children: t("row.enterpriseCreditsNotice")
				}) : null,
				signedIn && alternatives !== void 0 && alternatives.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dsm-trae-usage-alternative",
					role: "status",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
						className: "dsm-trae-usage-alternative-text",
						children: [
							t("row.creditsExhausted", { account: status.accountName }),
							" ",
							t("row.creditsAlternative", { accounts: alternatives.map((alt) => `${alt.accountName}（${t(`row.edition${alt.edition === "cn" ? "Cn" : alt.edition === "sg" ? "Sg" : alt.edition === "solo" ? "Solo" : "SoloSg"}`)}：${formatNumber(alt.workAvailable + alt.generalAvailable)}）`).join("、") })
						]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "dsm-trae-usage-switch-button",
						disabled: switchingAccount || !writable,
						onClick: () => {
							const [target] = alternatives;
							if (target !== void 0) onSwitchToAlternative(target.id);
						},
						children: t("row.creditsAlternativeSwitch")
					})]
				}) : null,
				signedIn && creditsExpiry !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ExpiryNotice, {
					expiry: creditsExpiry,
					t
				}) : null,
				rescanNote === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: "dsm-trae-usage-note",
					role: "status",
					children: rescanNote
				}),
				signedIn ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
					pool !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AccountPool, {
						panel,
						pool,
						models,
						t,
						settingsScope,
						topActions: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "dsm-btn dsm-btn-outline",
							disabled: busy,
							onClick: onRescan,
							children: busy ? t("row.accountsScanning") : t("row.poolRescan")
						}),
						tools: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsm-trae-pool-tool-row",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dsm-trae-pool-tool-label",
								children: t("row.poolToolsLabel")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AccountTransfer, {
								t,
								hideLabel: true,
								region: panel === "ai" ? "ai" : "cn",
								accounts: accounts.map((account) => ({
									id: account.id,
									accountName: account.accountName
								})),
								onChanged: onTransferChanged
							})]
						}),
						details: poolDetails,
						claims: pool.checkinSupported === true ? poolClaims : void 0,
						onClaim,
						deviceClaimed,
						onBind: onSwitchAccount,
						bindingBusy: switchingAccount,
						onChanged: onPoolChanged,
						onRefresh: onPoolRefresh
					}) : null,
					status.checkin !== void 0 && !status.checkin.enabled ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dsm-trae-usage-error",
						children: t("row.checkinDisabled")
					}) : null,
					status.checkinError === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dsm-trae-usage-error",
						children: t("row.checkinError", { message: status.checkinError })
					})
				] }) : null
			] });
		}
		//#endregion
		//#region src/client/plan-text.ts
		/**
		* The international region's "what plan is this account on" text.
		*
		* WHY THIS IS ITS OWN MODULE: three surfaces now answer that one question — the
		* card's subscription box, the card's per-account rows, and the composer
		* readout. Each previously carried its own copy of the verdict, which is how the
		* card's box and its roster row were able to disagree about one account's tier
		* (the box read the usage document's top-level `payStatus`, which the ai document
		* does not always carry, while the row read the per-account state). A second
		* implementation of the same rule is free to drift; there is now exactly one.
		*
		* @module dsh-connect-trae/client/plan-text
		*/
		/**
		* Decide whether an international account is on a paid plan, and name the plan.
		*
		* Two independent things can entitle it: a package row (`has_package`) and a
		* plan identity (`user_pay_identity_str`). Reading only the first is what
		* rendered a Pro member as "No active package" in issue #19, so either one
		* counts. The tier string rides separately so a caller can name the plan instead
		* of only asserting a boolean.
		*/
		function planVerdict(payStatus) {
			const tier = payStatus.payIdentityStr?.trim();
			const paid = payStatus.hasPackage || traePlanIsPaid(payStatus.payIdentityStr);
			return {
				paid,
				...tier === void 0 || tier === "" ? {} : { tier },
				label: paid ? "row.subscribed" : "row.noPackage"
			};
		}
		/**
		* The verdict as ONE short string, for a surface that has a single slot.
		*
		* The composer readout is that surface: it is a few characters wide in the tool
		* row, so it gets the tier name alone (`Pro`, `Free`) rather than the card's
		* two-line label-plus-tier. When the upstream named no tier the label stands in,
		* which is still strictly more than the dash the readout used to show for the
		* whole international region.
		*/
		function planText(payStatus, t) {
			const verdict = planVerdict(payStatus);
			return verdict.tier === void 0 ? t(verdict.label) : verdict.tier;
		}
		//#endregion
		//#region src/client/TraeUsageCard.tsx
		/**
		* Trae usage card contributed to Harness Plugin configuration.
		*
		* Structure, CSS classes, and button primitives mirror `dsh-subagent-default-model`'s
		* `SubagentModelCard` so the two plugins share one external-presentation language.
		*/
		/**
		* Failure text of a route: the server's own message when it sent one, else the
		* bare status.
		*
		* Issue #66: the card used to throw `HTTP ${status}` and drop the body, so the
		* Host's explanation ("SOLO remote models returned HTTP 401", or the US-region
		* verdict) never reached the user. A 401 from the wrong gateway and a plugin
		* crash therefore read identically.
		*/
		function routeErrorText(body, status) {
			if (typeof body === "object" && body !== null) {
				const error = body.error;
				if (typeof error === "string" && error.trim() !== "") return error;
			}
			return `HTTP ${status}`;
		}
		const POLL_INTERVAL_MS = 6e4;
		const TRAE_GITHUB_URL = "https://github.com/dingminhua/dsh-connect-trae";
		/**
		* Write one settings field and confirm the value actually landed.
		*
		* `configForms.set()` resolving is NOT proof that anything was stored: a write
		* can be accepted by the transport and still not materialize — a rejected
		* write reloads Host state and merely RETURNS, so the caller's `await`
		* succeeds while the document is unchanged. The form answers with an explicit
		* boolean for exactly this reason.
		*
		* Either way the caller must not report success on an unpersisted write: the
		* user would see the control flip and then silently revert.
		*
		* @throws {TraeSettingsWriteError} when the write was refused or did not land.
		*/
		var TraeSettingsWriteError = class extends Error {
			constructor(field, detail) {
				super(detail === void 0 || detail === "" ? `trae: settings field "${field}" was not persisted by the settings write` : `trae: settings field "${field}" was not persisted by the settings write (${detail})`);
				this.name = "TraeSettingsWriteError";
			}
		};
		async function writeSettingsField(scope, field, value, landed) {
			if (await scope.set(field, value) === false) throw new TraeSettingsWriteError(field, "the Host refused the write");
			if (!landed(unwrapVolatileDeep(scope.getSnapshot().value))) throw new TraeSettingsWriteError(field);
		}
		/** Read one region's stored `regions` slot out of an unwrapped settings value. */
		function regionSlotsOf(value) {
			const regions = value?.regions;
			return typeof regions === "object" && regions !== null ? regions : {};
		}
		/** Inject the shared card CSS once. */
		if (typeof document !== "undefined") {
			const cssId = "dsh-connect-trae/client.css";
			if (!document.querySelector(`style[data-plugin-css="${cssId}"]`)) {
				const styleTag = document.createElement("style");
				styleTag.dataset.plugin = "dsh-connect-trae";
				styleTag.dataset.pluginCss = cssId;
				styleTag.textContent = TRAE_CARD_CSS;
				document.head.appendChild(styleTag);
			}
		}
		function formatCapacity(value, unknown) {
			if (value === void 0) return unknown;
			if (value >= 1e6 && value % 1e6 === 0) return `${value / 1e6}M`;
			if (value >= 1e3 && value % 1e3 === 0) return `${value / 1e3}K`;
			return formatNumber(value);
		}
		/**
		* Human name for one wire channel (issue #52, P0).
		*
		* The group header answers 「why is this list so long」 — because it is the union
		* of several Trae modes — so it must name the mode, not print `solo_work_remote`.
		* An unknown function falls through to its raw name on purpose: a channel this
		* build does not know about is a fact worth showing rather than hiding behind
		* 「其他」, and it is exactly what a bug report should quote.
		*/
		function modelChannelLabel(channel, t) {
			if (channel === void 0) return t("row.modelsChannelDefault");
			const key = {
				solo_work_remote: "row.modelsChannelWorkRemote",
				solo_work_lite: "row.modelsChannelWorkLite",
				solo_agent_remote: "row.modelsChannelAgentRemote",
				chat_v3: "row.modelsChannelChatV3",
				solo_coder: "row.modelsChannelCoder"
			}[channel];
			return key === void 0 ? channel : t(key);
		}
		/**
		* The verdict badge for one model, or null when it has not been tested.
		*
		* `unknown` renders as inconclusive, never as a failure: a throttle or a dropped
		* connection says nothing about the model, and painting it the same red as a
		* real refusal is what makes users delete working models.
		*/
		const PROBE_LABELS = {
			available: "row.probeAvailable",
			gated: "row.probeGated",
			unsupported: "row.probeUnsupported",
			rate_limited: "row.probeRateLimited",
			auth: "row.probeAuth",
			unknown: "row.probeUnknown"
		};
		function probeBadge(probe, t) {
			if (probe === void 0) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: `dsm-trae-model-probe dsm-trae-model-probe-${probe.verdict}`,
				title: probe.detail,
				children: t(PROBE_LABELS[probe.verdict])
			});
		}
		/**
		* How each promotion kind is phrased.
		*
		* The wording is PLUGIN copy, not upstream's: Trae publishes a rule — a pay
		* ratio plus optional cheap-hours windows — and never a label (contrast
		* WorkBuddy's `badge.label`, see docs/PROMO_BADGE.md §3). Two things
		* follow, and both are deliberate:
		*
		*  - only `limited_discount` says 限时 / "limited"; upstream gives no end time
		*    for the other kinds, so claiming one would be inventing urgency;
		*  - the number shown is upstream's own pay ratio (`discount: 50` ⇒ 五折 /
		*    "50% off"), never a re-derived price.
		*/
		const PROMO_LABELS$1 = {
			limited: "row.promoLimited",
			subsidy: "row.promoSubsidy",
			offPeak: "row.promoOffPeak"
		};
		/** Pay ratio as the "折" figure a Chinese price tag uses: 50 → "5", 25 → "2.5". */
		function promoZhe$1(discountPercent) {
			const zhe = Math.round(discountPercent * 10) / 100;
			return Number.isInteger(zhe) ? String(zhe) : zhe.toFixed(1);
		}
		/**
		* The model row's promotion capsule, or nothing.
		*
		* Judged HERE, at paint time, not when the directory was parsed: the rule's
		* windows are wall clocks in an upstream-named zone (00:00–09:00 on weekdays,
		* …), so a verdict frozen into a saved catalog would still be shouting about
		* last night's discount tomorrow afternoon. The card re-renders on its poll, so
		* the capsule appears and disappears with the window.
		*
		* One capsule at most, and it sits BESIDE the name rather than inside it: the
		* name is ellipsis-truncated, so a badge placed inside would be clipped away
		* exactly on the long model names.
		*/
		function promoBadge(model, t, now) {
			const badge = selectTraePromoBadge(model.activityDiscount, now);
			if (badge === void 0) return null;
			const zhe = promoZhe$1(badge.discountPercent);
			const hints = [];
			if (badge.beforeRate !== void 0 && badge.rate !== void 0) hints.push(t("row.promoHintRate", {
				before: String(badge.beforeRate),
				rate: String(badge.rate)
			}));
			if (badge.fromClock !== void 0 && badge.untilClock !== void 0 && badge.timeZone !== void 0) hints.push(t("row.promoHintWindow", {
				from: badge.fromClock,
				until: badge.untilClock,
				zone: badge.timeZone
			}));
			if (badge.memberDiscountPercent !== void 0 && badge.memberRate !== void 0) hints.push(t("row.promoHintMember", {
				rate: String(badge.memberRate),
				zhe: promoZhe$1(badge.memberDiscountPercent),
				percent: String(100 - badge.memberDiscountPercent)
			}));
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: `dsm-trae-model-promo dsm-trae-model-promo-${badge.kind}`,
				title: hints.length === 0 ? t(PROMO_LABELS$1[badge.kind], {
					zhe,
					percent: String(badge.percentOff)
				}) : hints.join(" · "),
				children: t(PROMO_LABELS$1[badge.kind], {
					zhe,
					percent: String(badge.percentOff)
				})
			});
		}
		/** Render Trae sign-in state and the total usage summary as one expandable card. */
		function TraeUsageCard({ t, settingsScope, view }) {
			if (t === void 0) throw new Error("Trae usage card requires its translation function");
			const [open, setOpen] = (0, react.useState)(view === "page");
			/** The region whose tab is on screen; each tab is its own provider stack. */
			const [activeRegion, setActiveRegion] = (0, react.useState)("cn");
			/**
			* Which of the card's three sections is on screen (learned from the sibling
			* `dsh-connect-workbuddy` card, whose settings page split for the same
			* reason).
			*
			* The card had grown into one long column mixing two unrelated jobs —
			* operating an account (who serves, how much is left, the check-in, the pool)
			* and editing the catalog (which models, image input, context budget) — and
			* the two do not even commit the same way: an account change lands on the
			* click, a catalog change is a draft until 「保存」. One column therefore put
			* the save button screens away from what it saves.
			*
			* The region row above stays the SCOPE (which provider this whole card is
			* about); these tabs are the sections of that one scope. Only the ACTIVE
			* section is visible, and the others stay MOUNTED through the `hidden`
			* attribute, so switching back never refetches, a half-filled model draft
			* survives the trip, and the pool keeps its log. `hidden` also takes the
			* inactive panel out of the accessibility tree, which is exactly what
			* `role="tabpanel"` wants.
			*/
			const [panel, setPanel] = (0, react.useState)("accounts");
			/**
			* Last-known usage per region, so tab dots survive tab switches.
			*
			* A region is ABSENT until something has been read for it (issue #77). It used
			* to be seeded with a signed-out document, which meant the whole wait for the
			* first paint rendered as "not signed in — sign in again / scan for accounts"
			* to a user who was perfectly signed in. The difference between "nothing known
			* yet" and "known to be signed out" is the difference between a loading line
			* and a wrong instruction, so the map starts empty and the render below says
			* which one it is.
			*/
			const [statusByRegion, setStatusByRegion] = (0, react.useState)({});
			const [busy, setBusy] = (0, react.useState)(false);
			/**
			* Availability verdicts from the one-click test, per region, keyed by model
			* id. Session-only on purpose: a verdict is one moment on one account, and a
			* persisted "not served" would keep claiming that long after upstream changed
			* its mind.
			*/
			const [probeByRegion, setProbeByRegion] = (0, react.useState)({
				cn: {},
				enterprise: {},
				ai: {}
			});
			const [testing, setTesting] = (0, react.useState)(void 0);
			const [testError, setTestError] = (0, react.useState)(void 0);
			const [testSummary, setTestSummary] = (0, react.useState)(void 0);
			const [settingsRevision, setSettingsRevision] = (0, react.useState)(0);
			/** Per-region unsaved model edits; a draft on one tab is never dropped by
			* switching to the other tab, only by that tab's discard/save. */
			const [drafts, setDrafts] = (0, react.useState)({});
			/**
			* Search text over the model catalog (issue #52, P0).
			*
			* Kept in COMPONENT state, not in the draft: filtering what you look at is not
			* an edit, so it must survive a save and must never make the card look dirty.
			*/
			const [modelQuery, setModelQuery] = (0, react.useState)("");
			/**
			* How much of the catalog the list shows (issue #52, P2).
			*
			* `common` is the DEFAULT because it answers the question the issue was filed
			* with: 24 of the 34 rows are reachable from a normal `solo_work_*` chat turn,
			* and the other 10 exist only on a specialist channel (`solo_coder` 7,
			* `chat_v3` 2, `solo_agent_remote` 1 — measured 2026-10-23). The vendor's own
			* picker shows 14–24 per mode, so 24 is the first list since P0 that looks
			* like the client the reporter compared against.
			*
			* Nothing is REMOVED by this: the view is presentation only. Every action
			* (「test all」, bulk context, the save) still ranges over the full catalog, and
			* an enabled model that the view hides is called out below the list rather
			* than silently dropped from the screen.
			*/
			const [modelView, setModelView] = (0, react.useState)("common");
			/**
			* Channel groups the user folded shut, keyed `panel|channel`.
			*
			* Stored as the EXCEPTION rather than the state of every group so the default
			* stays 「open」: the catalog is short enough to read once grouped, and a
			* default of "collapsed" would hide a model the user came to enable.
			*/
			const [closedModelGroups, setClosedModelGroups] = (0, react.useState)(/* @__PURE__ */ new Set());
			const [saving, setSaving] = (0, react.useState)(false);
			const [switchingAccount, setSwitchingAccount] = (0, react.useState)(false);
			/** Region whose on/off checkbox write is in flight, so its box can't race. */
			const [togglingRegion, setTogglingRegion] = (0, react.useState)(void 0);
			/**
			* Outcome of the last "refresh accounts" press (issue #25).
			*
			* The rescan answers 200 with a fresh account list whether or not anything
			* changed, and the selection is PERSISTED, so a rescan of a machine whose
			* bound account is still the one it was yesterday looks identical to a
			* failure. Reporting the outcome is the difference between "it did nothing"
			* and "it found the same 2 accounts, still on X".
			*/
			const [rescanNote, setRescanNote] = (0, react.useState)(void 0);
			/**
			* A preference the user just flipped, held only until its write lands.
			*
			* The 设置 block used to stage both switches in a draft written by 「保存」.
			* That is GONE: the sibling dsh-connect-workbuddy card commits its preference
			* checkboxes on the click, and a Save button for two booleans asks the user to
			* remember something that has no reason to need remembering.
			*
			* What remains is the smallest thing that keeps a click honest: the box reads
			* this optimistic value until the write settles, then falls back to the
			* committed one. So a flip shows immediately, and a write that FAILS snaps the
			* box back to the Host's value instead of leaving it claiming one that never
			* landed.
			*/
			const optimisticSettings = (0, react.useRef)({});
			/** True while a preference is crossing the wire; serializes both writers. */
			const [savingSettings, setSavingSettings] = (0, react.useState)(false);
			/** The in-flight flip of the per-panel 「自主生图」 switch (undefined = read the document). */
			const [drawImageDraft, setDrawImageDraft] = (0, react.useState)(void 0);
			/**
			* Per-account status (check-in / balances / subscription) shown in each row of
			* the account table, keyed by region then account id. Loaded per account via
			* `TRAE_ACCOUNT_STATUS_PATH` once the table is shown; a row that failed to
			* load (or that has not been read yet) simply renders without its figure,
			* exactly as the composer table treats a missing balance.
			*/
			const [accountStatusByRegion, setAccountStatusByRegion] = (0, react.useState)({
				cn: {},
				enterprise: {},
				ai: {}
			});
			/** Which account row is claiming right now, so only its button spins. */
			const [claimingFor, setClaimingFor] = (0, react.useState)(void 0);
			/**
			* Per-account claim refusals, keyed by region then account id. A refusal is
			* shown next to the row that caused it rather than in one global error line,
			* because the check-in button now lives per account.
			*/
			const [claimErrorByRegion, setClaimErrorByRegion] = (0, react.useState)({
				cn: {},
				enterprise: {},
				ai: {}
			});
			/**
			* Whether this MACHINE has spent today's check-in for a given account — the
			* "device is spent but this account was never rewarded" state, per account so
			* it appears next to the row that owns it. Kept separate from the claim error
			* because it is not a failure: it is the upstream's one-per-device-per-day
			* rule, and rendering it through the "签到失败：…" line would present a normal
			* rule as a plugin fault.
			*/
			const [deviceSpentByRegion, setDeviceSpentByRegion] = (0, react.useState)({
				cn: {},
				enterprise: {},
				ai: {}
			});
			/**
			* A refused or unpersisted settings write, surfaced instead of silently
			* reverting. On 0.1.7 a rejected write resolves normally, so without this
			* the control would flip and then quietly snap back on the next snapshot.
			*/
			const [writeError, setWriteError] = (0, react.useState)(void 0);
			const mounted = (0, react.useRef)(true);
			(0, react.useEffect)(() => {
				mounted.current = true;
				return () => {
					mounted.current = false;
				};
			}, []);
			/**
			* The 设置 block: its committed values, its draft, and the ONE write path.
			*
			* The block commits on 「保存」 rather than on every click, so 「放弃」 has a
			* meaning and a half-finished edit cannot land in the settings document. Both
			* fields are written through `writeSettingsField`, which read-back checks the
			* document — `set()` resolving has never been proof a value landed on this
			* Host, so a saved-looking switch that silently reverted is exactly the
			* failure that guard exists for.
			*
			* Committed values are read from the settings document, never echoed from
			* local state: a write made elsewhere (the DSH settings form, another window)
			* then shows up here instead of being shadowed by a stale copy.
			*/
			const committedSettings = { showPointsInMainUi: unwrapVolatileDeep(settingsScope?.getSnapshot().value)?.showPointsInMainUi === true };
			/**
			* Ids for the block's label/hint wiring. `useId`, not constants: DSH can mount
			* this card twice at once (the settings ROW and the expanded PAGE), and two
			* copies sharing an id would leave the second switch labelled by the first
			* card's element.
			*/
			/**
			* What the two boxes render: the committed value, with any in-flight flip laid
			* over it. Reading BOTH sources here is what lets the write above stay simple —
			* it never has to write into component state that a Host refresh would fight.
			*/
			const settingsEdits = { showPointsInMainUi: optimisticSettings.current.showPointsInMainUi ?? committedSettings.showPointsInMainUi };
			const settingsIds = (0, react.useId)();
			const creditsLabelId = `${settingsIds}-credits`;
			const creditsHintId = `${settingsIds}-credits-hint`;
			/**
			* Write ONE preference switch, on the click that flipped it.
			*
			* This replaced a draft + 「保存」/「放弃」 pair, which is what the sibling
			* dsh-connect-workbuddy card does NOT have: its switches are plain checkboxes
			* on a bare line that commit immediately, and a card that needs a Save button
			* for two booleans is asking the user to remember something for no reason.
			*
			* The two writers are SERIALIZED by `savingSettings`, because they write the
			* same settings document. The pattern is the tab bar's `toggleRegion`: flip
			* optimistically so the box responds, then re-read the Host so a failed write
			* snaps it back instead of leaving the box claiming a value that never landed.
			*/
			const writePreference = async (field, value) => {
				if (settingsScope === void 0 || settingsScope.getSnapshot().writable !== true) return;
				setSavingSettings(true);
				setWriteError(void 0);
				optimisticSettings.current = {
					...optimisticSettings.current,
					[field]: value
				};
				setSettingsRevision((revision) => revision + 1);
				try {
					await writeSettingsField(settingsScope, field, value, (readBack) => unwrapVolatileDeep(readBack)?.showPointsInMainUi === value);
				} catch (error) {
					if (mounted.current) setWriteError(error instanceof Error ? error.message : t("row.requestFailed"));
				} finally {
					if (mounted.current) {
						optimisticSettings.current = {
							...optimisticSettings.current,
							[field]: void 0
						};
						setSettingsRevision((revision) => revision + 1);
					}
					if (mounted.current) setSavingSettings(false);
				}
			};
			/**
			* Flip ONE panel's 「允许模型自主生图」 switch (`drawImageEnabled`).
			*
			* Not a top-level preference like the two above: the flag lives INSIDE
			* `regions.<panel>`, because it is per-panel consent and the Host's tool
			* resolver reads it per panel. `nextRegionDrawImage` carries the rest of that
			* slot through, so flipping this cannot drop the model directory, budgets,
			* pool or credit seat — the failure #44 fixed for the pool.
			*
			* Serialized by `savingSettings` with the sibling writers: they all write the
			* same settings document. The read-back re-reads the document, so a write that
			* silently reverted cannot leave the box claiming a grant the Host never got —
			* the one failure that matters here, because a box that lies about consent
			* makes the tool's absence look like a bug.
			*/
			const writeDrawImage = async (value) => {
				if (settingsScope === void 0 || settingsScope.getSnapshot().writable !== true) return;
				setSavingSettings(true);
				setWriteError(void 0);
				setDrawImageDraft(value);
				try {
					await writeSettingsField(settingsScope, "regions", nextRegionDrawImage(settingsScope.getSnapshot().value, activeRegion, value), (readBack) => regionSlotsOf(readBack)[activeRegion]?.drawImageEnabled === value);
				} catch (error) {
					if (mounted.current) setWriteError(error instanceof Error ? error.message : t("row.requestFailed"));
				} finally {
					if (mounted.current) {
						setDrawImageDraft(void 0);
						setSavingSettings(false);
					}
				}
			};
			(0, react.useEffect)(() => settingsScope?.subscribe(() => {
				setSettingsRevision((value) => value + 1);
			}), [settingsScope]);
			/**
			* WHERE the active tab's credit readout sits (learned from workbuddy #62).
			*
			* Read from the committed SETTINGS document, through the same
			* `regionCreditPositionOf` helper the Host uses — so the control reads
			* instantly and can never disagree with the readout's own gate, which reads
			* the same scope. This mirrors how the show/hide box beside it works
			* (`committedSettings`), rather than how the sibling workbuddy card does it:
			* that card reads the Host's usage answer because a measured defect on its
			* 0.1.7 deployments left the browser settings mirror for its namespace STALE.
			* No such staleness is reproducible here, and reading the mirror eagerly is
			* what keeps this control correct on first paint — a picker fed only by the
			* usage document would sit on the default until a fetch landed, which is the
			* "looks like it did nothing" failure this control must not have.
			*
			* `settingsRevision` is read through the setter above, and the whole block
			* re-renders when the scope notifies, so a write made elsewhere (another
			* window, the DSH settings form) converges here.
			*/
			const creditPositionOn = (item) => regionCreditPositionOf(settingsScope?.getSnapshot().value, item);
			/**
			* Move one region's credit readout between its two seats.
			*
			* Same shape as every other region write on this card: the whole target slot
			* goes in (so a seat change cannot drop that region's model picks, budgets or
			* enabled flag, nor touch the sibling region), the write is read-back
			* verified, and the Host is re-read afterwards. The re-read is load-bearing
			* here — the control renders the Host's answer, so without it the picker
			* keeps showing the seat it had and the change looks like it did nothing.
			*/
			const changeCreditPosition = async (item, position) => {
				if (settingsScope === void 0 || settingsScope.getSnapshot().writable !== true) return;
				setSavingSettings(true);
				setWriteError(void 0);
				try {
					await writeSettingsField(settingsScope, "regions", nextRegionCreditPosition(settingsScope.getSnapshot().value, item, position), (readBack) => regionCreditPositionOf(readBack, item) === position);
					await refreshUsage(item);
				} catch (error) {
					if (mounted.current) setWriteError(error instanceof Error ? error.message : t("row.requestFailed"));
				} finally {
					if (mounted.current) setSavingSettings(false);
				}
			};
			/**
			* Whether one region's provider is switched on, read off the SAME committed
			* settings document the Host reads (`regionEnabledOf` mirrors the Host's
			* `regionStateOf` opt-out rule: only an explicit `false` disables). Reading
			* the stored value rather than echoing local state means a rejected write,
			* another window's change, or a restart all converge on the truth.
			*
			* The whole settings section is passed deliberately: `regionEnabledOf`
			* accepts either it or the bare `regions` map, because passing the section
			* where the map was expected was a shipped bug (the lookup read
			* `section['cn']`, found nothing, and reported `true` forever — the checkbox
			* stayed checked and clicking it appeared dead while the write succeeded).
			*/
			const regionOn = (item) => regionEnabledOf(settingsScope?.getSnapshot().value, item);
			const activeRegionOn = regionOn(activeRegion);
			/**
			* Credential region of the ACTIVE PANEL.
			*
			* The enterprise panel is a second CN pool, so anything that asks "is this the
			* international side?" — pay status vs. credit packs, check-in column, the
			* credit-readout switch — must answer by CREDENTIAL REGION, not by tab
			* identity. `isCnPool` is the common case (cn + enterprise).
			*/
			const credentialRegionIsAi = regionOfPanel(activeRegion) === "ai";
			const isCnPool = !credentialRegionIsAi;
			const refreshUsage = (0, react.useCallback)(async (region, signal) => {
				try {
					const response = await fetch(withTraeRegion(TRAE_USAGE_PATH, region), {
						headers: { accept: "application/json" },
						credentials: "same-origin",
						...signal === void 0 ? {} : { signal }
					});
					const value = await response.json().catch(() => void 0);
					if (!response.ok) throw new Error(routeErrorText(value, response.status));
					const usage = value;
					if (mounted.current && signal?.aborted !== true) setStatusByRegion((prev) => ({
						...prev,
						[region]: usage
					}));
					return usage;
				} catch (error) {
					if (mounted.current && signal?.aborted !== true) setStatusByRegion((prev) => ({
						...prev,
						[region]: {
							status: "error",
							message: error instanceof Error ? error.message : t("row.requestFailed")
						}
					}));
					return;
				}
			}, [t]);
			/**
			* Paint the fast document (issue #77).
			*
			* The full document above cannot answer before the Host has read every member's
			* balance — one upstream round-trip per account, and this panel's pool assembly
			* happens to walk the membership more than once. That is the wait the issue
			* reports: tens of seconds in which the card used to show nothing at all.
			*
			* The fast document is built from local state only (no upstream read at all), so
			* it answers in milliseconds and carries everything needed to DRAW: the bound
			* account, its expiry, the model list and the pool rows. The live figures it
			* omits (credits, check-in column) are exactly the values that need the round
			* trip, and the card already renders their absence as `—` / unknown.
			*
			* Deliberately separate from {@link refreshUsage} rather than a parameter of it:
			* a first paint never writes an error state (a slow upstream is not the user's
			* problem until the full document says so), and it must never downgrade a region
			* that has already been painted in full.
			*/
			const refreshUsageFast = (0, react.useCallback)(async (region, signal) => {
				try {
					const response = await fetch(withTraeRegionFastDetail(TRAE_USAGE_PATH, region), {
						headers: { accept: "application/json" },
						credentials: "same-origin",
						...signal === void 0 ? {} : { signal }
					});
					if (!response.ok) return;
					const usage = await response.json().catch(() => void 0);
					if (usage === void 0) return;
					if (!mounted.current || signal?.aborted === true) return;
					setStatusByRegion((prev) => {
						const previous = prev[region];
						if (previous !== void 0 && previous.status === "signed-in") return prev;
						return {
							...prev,
							[region]: usage
						};
					});
				} catch {}
			}, []);
			(0, react.useEffect)(() => {
				if (!open || !activeRegionOn) return;
				const controller = new AbortController();
				(async () => {
					await refreshUsageFast(activeRegion, controller.signal);
					if (controller.signal.aborted) return;
					refreshUsage(activeRegion, controller.signal);
				})();
				return () => {
					controller.abort();
				};
			}, [
				open,
				activeRegion,
				activeRegionOn,
				refreshUsage,
				refreshUsageFast
			]);
			/**
			* The document actually on screen for this region, and whether one has arrived.
			*
			* `loaded === undefined` is the only state that may render the loading line: a
			* signed-out document is a real answer (the user must sign in), never a stand-in
			* for "still fetching".
			*/
			const loaded = statusByRegion[activeRegion];
			const loading = loaded === void 0;
			const status = loaded ?? {
				status: "signed-out",
				accounts: []
			};
			/**
			* Whether the ACTIVE panel has a usable sign-in.
			*
			* The section tabs render only here: a signed-out card is one screen of
			* instructions ("sign in once in the Trae app" plus the probed paths), and
			* splitting that into panels would hide the only thing it has to say behind a
			* tab the user cannot see the point of. The sibling WorkBuddy card made the
			* same call for the same reason.
			*/
			const signedIn = status.status === "signed-in";
			/**
			* Clear in-flight claim state when the tab changes. `activeRegion` is a single
			* value across both tabs, so a switch must not leave one row's claim spinning
			* under the other tab.
			*/
			(0, react.useEffect)(() => {
				setClaimingFor(void 0);
			}, [activeRegion]);
			(0, react.useEffect)(() => {
				if (!open || !activeRegionOn || status.status !== "signed-in") return;
				const controller = new AbortController();
				const timer = window.setInterval(() => {
					refreshUsage(activeRegion, controller.signal);
				}, POLL_INTERVAL_MS);
				return () => {
					window.clearInterval(timer);
					controller.abort();
				};
			}, [
				open,
				activeRegion,
				activeRegionOn,
				refreshUsage,
				status.status
			]);
			const rescanAccounts = async () => {
				setBusy(true);
				setWriteError(void 0);
				try {
					const response = await fetch(withTraeRegion(TRAE_ACCOUNTS_REFRESH_PATH, activeRegion), {
						method: "POST",
						headers: { accept: "application/json" },
						credentials: "same-origin"
					});
					const body = await response.json().catch(() => void 0);
					if (!response.ok || body === void 0 || !Array.isArray(body.accounts)) throw new Error(routeErrorText(body, response.status));
					/**
					* What this press must persist, and why it is NOT `accounts.find(selected)`.
					*
					* The route's `selected` flag answers "which account is IN USE" — and the
					* store reports the account it is bound to, OR, when no binding has ever
					* been saved, the DETECTED default (`preferred`, i.e. whatever the Trae
					* app is signed in to). Those are the same value on a machine that has
					* been used for a while and diverge on exactly the press where it matters:
					* a fresh install, or a Trae sign-in the plugin has not recorded yet.
					*
					* Reading the flag alone therefore meant "nothing was explicitly bound"
					* reduced to "the detected default is what is in use, write nothing" —
					* so the account the user just refreshed was shown as bound while
					* `accounts.<region>` stayed EMPTY, and the next store rebuild (restart,
					* or a Trae sign-in change) silently re-defaulted somewhere else. That is
					* the "refreshed account was not saved" report.
					*
					* The rule is now: persist the account this region is actually using
					* (the store's verdict, which is the truth the card is displaying), and
					* fall back to the region's own roster only when the route returned no
					* verdict at all. A row that is already the SAVED binding is left alone —
					* one press must not rewrite the settings document for nothing.
					*/
					const inUse = body.accounts.find((account) => account.selected) ?? body.accounts[0];
					const configured = configuredAccountsOf(settingsScope?.getSnapshot().value);
					const alreadyBound = inUse !== void 0 && inUse.id === configured[activeRegion];
					const writable = settingsScope !== void 0 && settingsScope.getSnapshot().writable === true;
					const saved = inUse !== void 0 && !alreadyBound && writable;
					if (saved && settingsScope !== void 0 && inUse !== void 0) await writeSettingsField(settingsScope, "accounts", {
						...configured,
						[activeRegion]: inUse.id
					}, (readBack) => configuredAccountsOf(readBack)[activeRegion] === inUse.id);
					await refreshUsage(activeRegion);
					if (mounted.current) setRescanNote(body.accounts.length === 0 ? t("row.accountsRefreshedNone") : t("row.accountsRefreshed", {
						count: String(body.accounts.length),
						selected: saved ? ` · ${t("row.accountsSaved")} ${inUse.accountName ?? inUse.id}` : ` · ${t("row.accountsKept")} ${inUse?.accountName ?? configured[activeRegion] ?? "—"}`
					}));
				} catch (error) {
					if (mounted.current) {
						const message = error instanceof Error ? error.message : t("row.requestFailed");
						setRescanNote(t("row.accountsRescanFailed", { message }));
						setWriteError(message);
					}
				} finally {
					if (mounted.current) setBusy(false);
				}
			};
			const switchAccount = async (accountId) => {
				if (settingsScope === void 0) return;
				setSwitchingAccount(true);
				setWriteError(void 0);
				try {
					await writeSettingsField(settingsScope, "accounts", {
						...configuredAccountsOf(settingsScope.getSnapshot().value),
						[activeRegion]: accountId
					}, (readBack) => configuredAccountsOf(readBack)[activeRegion] === accountId);
					await refreshUsage(activeRegion);
					loadAccountStatus(accountId, activeRegion);
				} catch (error) {
					if (mounted.current) setWriteError(error instanceof Error ? error.message : t("row.requestFailed"));
				} finally {
					if (mounted.current) setSwitchingAccount(false);
				}
			};
			/**
			* Load one account row's per-account state (check-in / balances /
			* subscription) and cache it for the row. Called when the table renders and
			* again after a claim so the reward/refusal lands on the row that owns it.
			*/
			const loadAccountStatus = async (accountId, region = activeRegion) => {
				try {
					const url = `${withTraeRegion(TRAE_ACCOUNT_STATUS_PATH, region)}&accountId=${encodeURIComponent(accountId)}`;
					const response = await fetch(url, {
						headers: { accept: "application/json" },
						credentials: "same-origin"
					});
					const body = await response.json().catch(() => ({}));
					if (!response.ok) throw new Error(body.error ?? `HTTP ${response.status}`);
					if (mounted.current) setAccountStatusByRegion((prev) => ({
						...prev,
						[region]: {
							...prev[region],
							[accountId]: body
						}
					}));
					return body;
				} catch {
					return;
				}
			};
			/**
			* Re-read EVERY row of one region, not just the one that was acted on.
			*
			* Trae spends the DEVICE's daily check-in, not the account's, so one claim
			* changes what every other row may do: they go from "check in" to "device
			* already used". Re-reading only the claimed account left its siblings
			* advertising a claim that could only come back 9095 — a row of live buttons
			* of which exactly one could work, which is the same false promise the 3.2.0
			* note refused bulk check-in for. Reading the siblings instead of guessing
			* them means the server's own `didCheckedIn` decides, so a sibling that is
			* still genuinely claimable (the device was not spent by this claim) keeps
			* its button.
			*/
			const reloadAccountStatuses = async (region) => {
				if (status.status !== "signed-in") return;
				const ids = status.accounts.map((account) => account.id);
				await Promise.all(ids.map((id) => loadAccountStatus(id, region)));
			};
			/**
			* Claim today's check-in reward for ONE named account row (CN only).
			*
			* The Host route owns every guard that matters — POST only, loopback origin
			* only, CN only, and a status read before the claim — because a browser-side
			* check is not a guard. The row button's own `disabled` is therefore a
			* courtesy (it stops an obviously pointless click), not the protection. The
			* body carries the `accountId`, so the claim reaches THAT account's
			* credential without moving the whole binding.
			*
			* A refusal is not thrown away: the route answers `claimed: false` with the
			* upstream's business code and message, and the row shows it. Three answers
			* are distinguished rather than collapsed into "failed":
			*
			*  - `alreadyCheckedIn` — this ACCOUNT was already paid today; show it as
			*    claimed and refresh, never as an error.
			*  - `deviceCheckedIn` (code 9095) — this MACHINE already spent today's
			*    check-in, so this account cannot claim here today. That is the normal
			*    outcome after switching accounts, and saying "check-in failed" would
			*    blame the plugin for an upstream rule.
			*  - anything else — a real refusal, reported verbatim.
			*/
			const claimFor = async (accountId) => {
				if (activeRegion !== "cn") return;
				setClaimingFor(accountId);
				setClaimErrorByRegion((prev) => {
					const next = { ...prev[activeRegion] };
					delete next[accountId];
					return {
						...prev,
						[activeRegion]: next
					};
				});
				setDeviceSpentByRegion((prev) => {
					const next = { ...prev[activeRegion] };
					delete next[accountId];
					return {
						...prev,
						[activeRegion]: next
					};
				});
				try {
					const response = await fetch(withTraeRegion(TRAE_CHECKIN_PATH, activeRegion), {
						method: "POST",
						headers: {
							accept: "application/json",
							"content-type": "application/json"
						},
						credentials: "same-origin",
						body: JSON.stringify({ accountId })
					});
					const body = await response.json().catch(() => void 0);
					if (!response.ok) throw new Error(body?.error ?? `HTTP ${response.status}`);
					if (body?.claimed === false && body.deviceCheckedIn === true) {
						setDeviceSpentByRegion((prev) => ({
							...prev,
							[activeRegion]: {
								...prev[activeRegion],
								[accountId]: true
							}
						}));
						await refreshUsage(activeRegion);
						await reloadAccountStatuses(activeRegion);
						return;
					}
					if (body?.claimed === false && body.alreadyCheckedIn !== true) throw new Error(body.message === void 0 || body.message === "" ? t("row.checkinRefused", { code: String(body.code ?? "") }) : `${t("row.checkinRefused", { code: String(body.code ?? "") })}: ${body.message}`);
					await refreshUsage(activeRegion);
					await reloadAccountStatuses(activeRegion);
				} catch (error) {
					if (mounted.current) {
						const message = error instanceof Error ? error.message : t("row.requestFailed");
						setClaimErrorByRegion((prev) => ({
							...prev,
							[activeRegion]: {
								...prev[activeRegion],
								[accountId]: message
							}
						}));
					}
				} finally {
					if (mounted.current) setClaimingFor(void 0);
				}
			};
			/**
			* Load every account row's per-account status when the card shows a
			* signed-in region. This is what makes the check-in buttons, balances, and
			* (ai) subscription rows appear. It is scoped to a stable `status.accounts`
			* identity so switching tabs or re-reading the document does not re-trigger a
			* burst of upstream calls for rows already loaded.
			*/
			(0, react.useEffect)(() => {
				if (!open || !activeRegionOn || status.status !== "signed-in" || status.accounts.length === 0) return;
				status.accounts.map((account) => account.id).join("\0");
				const loadedIds = accountStatusByRegion[activeRegion];
				const todo = status.accounts.filter((account) => loadedIds[account.id] === void 0);
				if (todo.length === 0) return;
				for (const account of todo) loadAccountStatus(account.id, activeRegion);
			}, [
				open,
				activeRegionOn,
				status,
				accountStatusByRegion
			]);
			/**
			* Switch one region's provider off or on (issue #11). The write carries the
			* region's whole slot through untouched — only `enabled` changes — so the
			* user's directory, model picks, image opt-ins and budgets survive a
			* round trip. The Host withdraws or restores the provider route on the next
			* `onChange`, which is what actually removes it from DSH's model picker.
			*/
			const toggleRegion = async (item, enabled) => {
				if (settingsScope === void 0 || settingsScope.getSnapshot().writable !== true) return;
				setTogglingRegion(item);
				setWriteError(void 0);
				try {
					await writeSettingsField(settingsScope, "regions", nextRegionEnabled(settingsScope.getSnapshot().value, item, enabled), (readBack) => regionSlotsOf(readBack)[item] !== void 0 && regionSlotsOf(readBack)[item].enabled === enabled);
				} catch (error) {
					if (mounted.current) setWriteError(error instanceof Error ? error.message : t("row.requestFailed"));
				} finally {
					if (mounted.current) setTogglingRegion(void 0);
				}
			};
			/**
			* One-click availability test for a list of models of the active region.
			*
			* Shared by the「enabled models」and「all models」buttons: the only difference
			* between them is which ids are sent — the enabled rows or the whole visible
			* catalog. Each run goes one model per request, deliberately: the host probe
			* is sequential anyway (Trae throttles bursts), and a per-model round trip
			* lets each row show its verdict as soon as it is known instead of the card
			* sitting blank for a minute. User-started, and it stops on the first
			* authentication failure — every later probe would only repeat that answer.
			*/
			const testModels = async (ids) => {
				setTestError(void 0);
				setTestSummary(void 0);
				if (ids.length === 0) {
					setTestError(t("row.modelsTestEmpty"));
					return;
				}
				setTesting({
					done: 0,
					total: ids.length
				});
				const collected = {};
				let available = 0;
				let denied = false;
				try {
					for (const [index, id] of ids.entries()) {
						if (!mounted.current) return;
						const response = await fetch(withTraeRegion(TRAE_MODELS_TEST_PATH, activeRegion), {
							method: "POST",
							headers: {
								accept: "application/json",
								"content-type": "application/json"
							},
							credentials: "same-origin",
							body: JSON.stringify({ ids: [id] })
						});
						const body = await response.json().catch(() => ({}));
						if (!response.ok) throw new Error(body.error ?? `HTTP ${response.status}`);
						const verdict = body.results?.[0];
						if (verdict !== void 0) {
							collected[id] = {
								verdict: verdict.verdict,
								detail: verdict.detail
							};
							if (verdict.verdict === "available") available += 1;
							setProbeByRegion((prev) => ({
								...prev,
								[activeRegion]: {
									...prev[activeRegion],
									[id]: {
										verdict: verdict.verdict,
										detail: verdict.detail
									}
								}
							}));
							if (verdict.verdict === "auth") {
								denied = true;
								break;
							}
						}
						setTesting({
							done: index + 1,
							total: ids.length
						});
					}
					if (mounted.current) {
						setTestSummary(t("row.modelsTestDone", {
							available,
							total: Object.keys(collected).length
						}));
						if (denied) setTestError(t("row.probeAuth"));
					}
				} catch (error) {
					if (mounted.current) setTestError(t("row.modelsTestError", { message: error instanceof Error ? error.message : t("row.requestFailed") }));
				} finally {
					if (mounted.current) setTesting(void 0);
				}
			};
			/** Test only the enabled models of the active region. */
			const testEnabledModels = async () => {
				const ids = [...activeEnabledIds];
				if (ids.length === 0) {
					setTestError(t("row.modelsTestEmpty"));
					setTestSummary(void 0);
					return;
				}
				testModels(ids);
			};
			/**
			* One-click availability test for EVERY model in the active region's catalog,
			* enabled or not — including the rows that are off and the rows the SOLO
			* channel does not serve. The host validates each id against the live catalog
			* and reports rows it does not know as skipped, so passing the whole visible
			* list cannot spend quota on arbitrary config names. Costs quota per model —
			* meaningfully more than the「enabled only」run, which the hint states.
			*/
			const testAllModels = async () => {
				const ids = visibleModels.map((model) => model.id);
				if (ids.length === 0) {
					setTestError(t("row.modelsTestEmpty"));
					setTestSummary(void 0);
					return;
				}
				testModels(ids);
			};
			const refreshModels = async () => {
				setBusy(true);
				try {
					const response = await fetch(withTraeRegion(TRAE_MODELS_REFRESH_PATH, activeRegion), {
						method: "POST",
						headers: { accept: "application/json" },
						credentials: "same-origin"
					});
					const body = await response.json().catch(() => void 0);
					if (!response.ok || body === void 0 || !Array.isArray(body.models)) throw new Error(routeErrorText(body, response.status));
					const fresh = body.models;
					const freshIds = new Set(fresh.map((model) => model.id));
					const stillEnabled = [...activeEnabledIds].filter((id) => freshIds.has(id));
					const stillImages = [...activeImageIds].filter((id) => freshIds.has(id));
					const stillBudgets = {};
					for (const id of freshIds) {
						const budget = activeContextBudgets[id];
						if (typeof budget === "number") stillBudgets[id] = budget;
					}
					setDrafts((prev) => ({
						...prev,
						[activeRegion]: {
							models: fresh.map((model) => ({
								...model,
								input: ["text"]
							})),
							enabledIds: new Set(stillEnabled),
							imageIds: new Set(stillImages),
							contextBudgets: stillBudgets
						}
					}));
				} catch (error) {
					if (mounted.current) setStatusByRegion((prev) => ({
						...prev,
						[activeRegion]: {
							status: "error",
							message: error instanceof Error ? error.message : t("row.requestFailed")
						}
					}));
				} finally {
					if (mounted.current) setBusy(false);
				}
			};
			const settingsValue = unwrapVolatileDeep(settingsScope?.getSnapshot().value);
			const region = activeRegion;
			const configuredRegions = typeof settingsValue === "object" && settingsValue !== null && typeof settingsValue.regions === "object" && settingsValue.regions !== null ? settingsValue.regions : {};
			const regionSlot = configuredRegions[region];
			const legacySlot = region === "cn" && regionSlot === void 0;
			const slotContextBudgets = typeof regionSlot?.contextBudgets === "object" && regionSlot.contextBudgets !== null ? regionSlot.contextBudgets : void 0;
			const legacyContextBudgets = legacySlot && typeof settingsValue === "object" && settingsValue !== null && typeof settingsValue.contextBudgets === "object" && settingsValue.contextBudgets !== null ? settingsValue.contextBudgets : void 0;
			const savedContextBudgets = slotContextBudgets ?? legacyContextBudgets ?? {};
			const slotImageIds = Array.isArray(regionSlot?.imageModelIds) ? regionSlot.imageModelIds.filter((id) => typeof id === "string") : void 0;
			const legacyImageIds = legacySlot && typeof settingsValue === "object" && settingsValue !== null && Array.isArray(settingsValue.imageModelIds) ? settingsValue.imageModelIds.filter((id) => typeof id === "string") : [];
			const savedImageIds = new Set(slotImageIds ?? legacyImageIds);
			/**
			* The active panel's 「自主生图」 consent, read from the SAME place the Host
			* reads it (`regions.<panel>.drawImageEnabled`, see regionStateOf) with any
			* in-flight flip laid over it. There is deliberately no legacy flat fallback:
			* this flag was born after the region split, and reading a top-level key here
			* would show consent the Host's per-panel resolver never grants.
			*/
			const committedDrawImage = regionSlot?.drawImageEnabled === true;
			const drawImageOn = drawImageDraft ?? committedDrawImage;
			/**
			* Whether the active panel can serve text-to-image at all. This is the SAME
			* list the Host registers from (`DRAW_IMAGE_PANELS`, imported rather than
			* restated), so the box can never offer a grant the Host will then refuse:
			* a switch that ticks and does nothing is the exact failure this whole
			* opt-in must not have. Two panels are out — `enterprise` bills through a
			* tenant gateway, and `ai` has never been probed at all (every measurement
			* behind the credit figures is CN), so neither may spend credits.
			*/
			const drawImageServable = DRAW_IMAGE_PANELS.includes(activeRegion);
			const drawImageUnavailableHint = activeRegion === "ai" ? t("row.drawImageHintAi") : t("row.drawImageHintEnterprise");
			const draft = drafts[activeRegion];
			const visibleModels = draft?.models ?? (status.status === "signed-in" ? status.models : []);
			/**
			* The catalog as the card draws it: one fixed order, then the search filter,
			* then split into the channels the rows will actually be called through
			* (issue #52, P0).
			*
			* The ROLL is `orderTraeModels` and it is applied here as well as at
			* discovery, because a catalog saved by an older build carries the arrival
			* order — the very thing the reporter photographed. Re-sorting costs one
			* comparison pass over ≤40 rows and makes the screen independent of which
			* version wrote `lastCatalog`.
			*
			* Every action below still ranges over `visibleModels` (the whole catalog),
			* never `shownModels`: 「test all」 and the bulk context buttons must act on all
			* rows, not on whatever the search box happens to show.
			*/
			const modelRegion = regionOfPanel(activeRegion);
			const orderedModels = orderTraeModels(visibleModels, modelRegion);
			/**
			* Scope, then search, then group — in that order, and each step answers a
			* different question (P2): the view is 「how much of the catalog」, the query is
			* 「which row」, the groups are 「where will the turn go」.
			*
			* SEARCH IS SCOPED TO THE VIEW. A global search would contradict the group
			* headers the user is looking at (results from a channel that is not on
			* screen), and scoping it means the empty state has to be honest about what it
			* did not look at — see `matchesOutsideView`.
			*/
			const commonModels = scopeTraeModels(orderedModels, "common", modelRegion);
			const scopedModels = modelView === "all" ? orderedModels : commonModels;
			const commonModelCount = commonModels.length;
			const shownModels = filterTraeModels(scopedModels, modelQuery);
			const modelGroups = groupTraeModels(shownModels, modelRegion);
			const modelQueryActive = modelQuery.trim() !== "";
			/**
			* Matches the query has in the FULL catalog while the view has none.
			*
			* Without this, searching `kimi` with the default view up would answer
			* 「没有匹配」 for `kimi-k2.5`, which is on screen in 全部 — the one wrong
			* answer a search box must not give. Zero means "genuinely absent".
			*/
			const matchesOutsideView = modelQueryActive && shownModels.length === 0 ? filterTraeModels(orderedModels, modelQuery).length : 0;
			/**
			* One clock reading for the whole model list.
			*
			* Promotion badges are judged against it (see `promoBadge`): reading the clock
			* once per render keeps every row's verdict consistent with the others, and
			* because the card re-renders on its poll, a badge still appears and vanishes
			* with its window instead of sticking until the next manual refresh.
			*/
			const nowForPromo = /* @__PURE__ */ new Date();
			const savedEnabledIds = status.status === "signed-in" ? new Set(status.enabledModelIds) : /* @__PURE__ */ new Set();
			const activeEnabledIds = draft?.enabledIds ?? savedEnabledIds;
			const activeImageIds = draft?.imageIds ?? savedImageIds;
			/**
			* Enabled rows this view does not draw.
			*
			* The view hides 10 rows by default; if the user had enabled some of them
			* before this existed, their checkbox is not on the screen, so the ONLY honest
			* options are "say they exist" or "let the screen imply they are off". The save
			* path is already safe (it writes `activeEnabledIds` from state, never from the
			* rendered checkboxes), so this is about not lying to the reader.
			*/
			const scopedIds = new Set(scopedModels.map((model) => model.id));
			const enabledOutsideView = modelView === "all" ? [] : orderedModels.filter((model) => activeEnabledIds.has(model.id) && !scopedIds.has(model.id));
			/**
			* Effective image capability of one row, mirroring what the Host reports to
			* DSH: the user's opt-in unioned with Trae's own `multimodal` flag (issue
			* #16). Rendering the union is what keeps this checkbox truthful — showing the
			* raw `imageModelIds` would draw an unticked box next to a model the plugin
			* is in fact advertising as image-capable.
			*/
			const rowAcceptsImage = (model) => activeImageIds.has(model.id) || model.multimodal === true;
			/**
			* A row Trae itself declares multimodal needs no manual opt-in, so its box is
			* shown ticked and read-only rather than offering a toggle that the union
			* would immediately undo. Turning image input off for such a model is
			* deliberately not supported: the flag is the vendor's own capability answer,
			* and enabling it only lets DSH attach an image the user still has to pick per
			* message — it never sends one by itself.
			*/
			const rowImageIsAutomatic = (model) => model.multimodal === true;
			/**
			* The international tab's plan is rendered by `rowValue`, in the account
			* table's 额度 column — one place, per account, beside the account it belongs
			* to.
			*
			* There used to be a SECOND surface for it: a standalone 「订阅状态」 box below
			* the table, reporting the bound account's plan on its own. It was added to
			* fix 「国际版没有那个积分框」 — an asymmetry against the CN tab's credit panel
			* — but the table's 额度 column had since absorbed exactly that figure, so the
			* box repeated the row directly above it. Two renderers of one verdict is the
			* drift risk `plan-text.ts` exists to prevent, and the box could only ever
			* restate what the marked 「当前使用」 row already said. It is gone; the row is
			* the single surface.
			*/
			const activeContextBudgets = draft?.contextBudgets ?? savedContextBudgets;
			const dirty = draft !== void 0;
			/** Apply an edit to the ACTIVE tab's draft, seeding it from the current view. */
			const editDraft = (edit) => {
				setDrafts((prev) => ({
					...prev,
					[activeRegion]: edit(prev[activeRegion] ?? {
						models: [...visibleModels],
						enabledIds: new Set(activeEnabledIds),
						imageIds: new Set(activeImageIds),
						contextBudgets: { ...activeContextBudgets }
					})
				}));
			};
			const toggleModel = (modelId) => {
				editDraft((current) => {
					const next = new Set(current.enabledIds);
					if (!next.delete(modelId)) next.add(modelId);
					return {
						...current,
						enabledIds: next
					};
				});
			};
			const toggleImage = (modelId) => {
				editDraft((current) => {
					const next = new Set(current.imageIds);
					if (!next.delete(modelId)) next.add(modelId);
					return {
						...current,
						imageIds: next
					};
				});
			};
			const setContextBudget = (modelId, budget) => {
				editDraft((current) => {
					const next = { ...current.contextBudgets };
					if (budget === void 0) delete next[modelId];
					else next[modelId] = budget;
					return {
						...current,
						contextBudgets: next
					};
				});
			};
			/**
			* Bulk context-budget switch (issue #42 side request). The per-model radios
			* stay exactly as they are; these two act on the whole region draft at once.
			* The reporter counted 18 CN models whose Max window differs from the
			* default and described clicking 18 times per region — 「整区切到 Max」 is
			* those 18 clicks as one button. It writes `maxContextWindow` per row, which
			* is precisely the spelling `applyContextBudgets` recognizes (a budget equal
			* to the native Max window widens the effective window), so bulk and per-row
			* paths land on identical saved state. Models without a Max window are left
			* untouched — inventing a budget for them would be filtered out anyway.
			*/
			const setAllContextMax = () => {
				editDraft((current) => {
					const next = { ...current.contextBudgets };
					for (const model of current.models) if (model.maxContextWindow !== void 0) next[model.id] = model.maxContextWindow;
					return {
						...current,
						contextBudgets: next
					};
				});
			};
			/**
			* Bulk 500K switch: every model that offers the middle step goes to it, and
			* every other model is left exactly as configured.
			*
			* The reporter-shaped case this serves: a region can hold 19 models with a
			* 1M Max, and picking the half-way window one radio at a time is 19 clicks.
			* It writes the literal {@link TRAE_CONTEXT_BUDGET_MID} — the same value the
			* per-row radio writes — so bulk and per-row land on identical saved state,
			* and `applyContextBudgets` re-validates it against each model's windows on
			* every read.
			*/
			const setAllContextMid = () => {
				editDraft((current) => {
					const next = { ...current.contextBudgets };
					for (const model of current.models) if (contextBudgetOptions(model).includes(5e5)) next[model.id] = TRAE_CONTEXT_BUDGET_MID;
					return {
						...current,
						contextBudgets: next
					};
				});
			};
			/**
			* 「恢复默认上下文」 clears every override in this region's draft. Empty
			* dict = every row falls back to its default window (the same state as a
			* region that was never configured), and clearing is what makes the bulk
			* action reversible without 18 more clicks.
			*/
			const resetAllContextBudgets = () => {
				editDraft((current) => ({
					...current,
					contextBudgets: {}
				}));
			};
			const discardModels = () => {
				setDrafts((prev) => {
					const next = { ...prev };
					delete next[activeRegion];
					return next;
				});
			};
			const saveModels = async () => {
				if (settingsScope === void 0) return;
				setSaving(true);
				setWriteError(void 0);
				try {
					if (status.status !== "signed-in") return;
					const nextSlot = {
						enabled: regionOn(activeRegion),
						lastCatalog: orderedModels.map((model) => ({
							...model,
							input: ["text"],
							...model.multimodal === void 0 ? {} : { multimodal: model.multimodal }
						})),
						enabledModelIds: [...activeEnabledIds],
						imageModelIds: [...activeImageIds].filter((id) => activeEnabledIds.has(id)),
						contextBudgets: activeContextBudgets
					};
					await writeSettingsField(settingsScope, "regions", nextRegionDirectory(configuredRegions, activeRegion, nextSlot), (readBack) => {
						const ids = regionSlotsOf(readBack)[activeRegion]?.enabledModelIds;
						return Array.isArray(ids) && ids.length === nextSlot.enabledModelIds.length && nextSlot.enabledModelIds.every((id) => ids.includes(id));
					});
					discardModels();
					await refreshUsage(activeRegion);
				} catch (error) {
					if (mounted.current) setWriteError(error instanceof Error ? error.message : t("row.requestFailed"));
				} finally {
					if (mounted.current) setSaving(false);
				}
			};
			const title = t("row.title");
			/**
			* Row labels for the account table.
			*
			* The raw `edition` token ("solo") told the user nothing about WHICH product a
			* credential came from, which is exactly what made a leftover TRAE SOLO login
			* indistinguishable from the Trae CN one they thought they were bound to
			* (issue #25). Spell the product out, and keep the region as the second axis.
			*/
			const editionLabel = (edition) => t(`row.edition${edition === "cn" ? "Cn" : edition === "sg" ? "Sg" : edition === "solo" ? "Solo" : "SoloSg"}`);
			const sourceLabel = (source) => source === "desktop" ? t("row.sourceDesktop") : source === "cli" ? t("row.sourceCli") : t("row.sourceDsh");
			/**
			* The trailing value on an account row's meta line: the account's general
			* balance (CN) or its subscription verdict (ai).
			*
			* A status that has not loaded — or whose read failed — renders NOTHING
			* rather than a dash. The row already names the account, its edition and its
			* source; a column of placeholder glyphs was pure noise, and it made every
			* row look like something was wrong. `undefined` means "no figure", never
			* "zero".
			*/
			const rowValue = (state) => {
				if (credentialRegionIsAi) {
					const payStatus = state?.payStatus;
					if (payStatus === void 0) return void 0;
					const verdict = planVerdict(payStatus);
					if (!verdict.paid) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dsm-trae-account-value",
						children: t("row.noPackage")
					});
					return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dsm-trae-account-value dsm-trae-account-value-on",
						children: verdict.tier === void 0 ? t("row.subscribed") : t("row.planTier", { tier: verdict.tier })
					});
				}
				if (activeRegion === "enterprise") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dsm-trae-account-value dsm-trae-account-value-muted",
					children: t("row.balanceConsoleOnly")
				});
				const figure = state?.credits?.generalAvailable;
				if (figure === void 0) return void 0;
				return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dsm-trae-account-value",
					children: t("row.accountBalance", { credits: formatNumber(figure) })
				});
			};
			/**
			* The CN check-in control for one account row.
			*
			* The reward rides INSIDE the button ("签到 +150") instead of sitting beside
			* it as a second line, so the row says what the click pays without also
			* carrying a "150 credits per day" caption. Four states, none of which lies:
			*
			*  - claimable — live, and names the payout.
			*  - claiming — this row's own claim is in flight; only its button changes.
			*  - claimed — `checkedIn`: this ACCOUNT was paid, so it reads as done.
			*  - device spent — `didCheckedIn` (or a 9095 refusal from this row's click):
			*    the DEVICE is spent but this account was never rewarded, so the button
			*    says exactly that and stays disabled rather than reporting "done" for an
			*    account that got nothing. The full rule lives in `title` — rendered as a
			*    paragraph it dominated the row and drowned out the account itself.
			*
			* Until the row's status lands the button waits, disabled, so the row keeps
			* its shape instead of reflowing the moment the read returns.
			*/
			/**
			* Everything a check-in button needs, derived once. The pool's table replaces
			* this card's roster table, so the same derivation has to feed both: two
			* copies would drift the moment one of them learned about a new refusal.
			*/
			/**
			* Whether THIS machine has already been paid today, for any account.
			*
			* `didCheckedIn` is not an account fact. Trae keys the daily claim to
			* `x-device-id` and answers a second claim with 9095, so once one account has
			* claimed from this machine, every other account on it is refused for the
			* rest of the day. Keeping that flag per account made the card invite a
			* check-in that could only fail — visible as soon as two accounts sit next to
			* each other in one table.
			*/
			const deviceClaimedToday = (() => {
				for (const state of Object.values(accountStatusByRegion[activeRegion])) if (state?.checkin?.didCheckedIn === true) return true;
				for (const spent of Object.values(deviceSpentByRegion[activeRegion])) if (spent) return true;
				return status.status === "signed-in" && status.pool !== void 0 && status.pool.accounts.some((account) => account.deviceCheckedIn === true);
			})();
			const claimViewOf = (accountId, state) => {
				const checkin = state?.checkin;
				const reward = checkin === void 0 ? void 0 : formatNumber(checkin.credits);
				const claimed = checkin?.checkedIn === true;
				const deviceSpent = deviceClaimedToday;
				const spending = claimingFor === accountId;
				const usable = checkin !== void 0 && checkin.enabled;
				const title = reward === void 0 || !usable ? t("row.checkinDisabled") : deviceSpent && !claimed ? t("row.checkinDeviceSpent") : claimed ? t("row.checkinClaimed") : t("row.checkinReward", { reward });
				return {
					label: spending ? t("row.checkinClaiming") : claimed ? t("row.checkinClaimed") : deviceSpent ? t("row.checkinDeviceSpentShort") : !usable || reward === void 0 ? t("row.checkinClaim") : t("row.checkinClaimWith", { reward }),
					title,
					disabled: !usable || claimed || deviceSpent || spending,
					busy: spending,
					/**
					* False when there is nothing left to DO: a disabled "already claimed"
					* button restates the status line above it, in grey, forever. Callers
					* drop the control instead of buying it a permanent disabled state.
					*/
					claimable: !claimed && !deviceSpent,
					settled: claimed ? "claimed" : deviceSpent ? "device" : void 0
				};
			};
			/**
			* The account roster, ALREADY JUDGED — one row per locally detected sign-in.
			*
			* Every verdict the table draws is decided here rather than in the section
			* component, because each one is a rule with a write or a Host answer behind
			* it: which account is serving (the document's own `accountId`, or the
			* roster's `selected` flag when signed out), what an account is worth
			* (`rowValue`, judged by CREDENTIAL region so the enterprise panel reads CN
			* balances), and whether a row may claim (`claimViewOf`, which knows the
			* device-wide check-in rule). A section that re-derived any of them could
			* disagree with the pool table below it, which reads the same three answers.
			*/
			const accountRows = status.status === "error" ? [] : (status.accounts ?? []).map((account) => {
				const current = status.status === "signed-in" ? account.id === status.accountId : account.selected === true;
				const state = accountStatusByRegion[activeRegion][account.id];
				const error = claimErrorByRegion[activeRegion][account.id];
				return {
					id: account.id,
					accountName: account.accountName,
					current,
					selected: account.selected === true,
					meta: `${editionLabel(account.edition)} · ${sourceLabel(account.source)}`,
					value: rowValue(state),
					refreshExpiresAtMs: account.refreshExpiresAtMs,
					error: error === void 0 ? void 0 : t("row.checkinError", { message: error }),
					claim: isCnPool ? (() => {
						const view = claimViewOf(account.id, state);
						return {
							label: view.label,
							title: view.title,
							disabled: view.disabled,
							busy: view.busy,
							claimable: view.claimable,
							settled: view.settled
						};
					})() : void 0
				};
			});
			/**
			* The pool's per-row details, joined from the roster above by id.
			*
			* The pool document carries the accounts but not their edition, source or
			* refresh-token countdown, so those three are spliced in here — by the same
			* `editionLabel` / `sourceLabel` / `refreshTokenWarning` the roster uses, so
			* one account cannot read "国内版 · 桌面端" in one table and something else in
			* the next.
			*/
			const poolDetails = Object.fromEntries((status.status === "signed-in" ? status.accounts : []).map((account) => {
				const warn = refreshTokenWarning(account.refreshExpiresAtMs, Date.now(), t, formatDateTime);
				return [account.id, {
					meta: `${editionLabel(account.edition)} · ${sourceLabel(account.source)}`,
					...warn === void 0 ? {} : {
						warn: warn.text,
						warnTone: warn.tone
					}
				}];
			}));
			const label = loading ? t("row.accountsLoading") : status.status === "signed-in" ? t("row.signedIn", { accountName: status.accountName }) : status.status === "error" ? t("row.requestFailed") : t("row.signedOut");
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
				className: `dsm-plugin-card${open ? " dsm-plugin-card-open" : ""}`,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "dsm-plugin-card-header",
						"aria-expanded": open,
						"aria-label": `${t(open ? "row.collapse" : "row.expand")}: ${title}`,
						onClick: () => {
							setOpen(!open);
						},
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
								className: "dsm-plugin-card-icon",
								src: TRAE_PLUGIN_ICON,
								alt: ""
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "dsm-plugin-card-head",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsm-plugin-card-title",
									children: title
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsm-plugin-card-description",
									children: t("row.desc")
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								"aria-hidden": "true",
								className: `dsm-plugin-card-chevron${open ? " dsm-plugin-card-chevron-open" : ""}`
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsm-plugin-card-body",
						hidden: !open,
						children: open ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsm-trae-usage",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "dsm-trae-tabs",
									role: "tablist",
									"aria-label": title,
									children: TRAE_PANELS.map((item) => {
										const regionStatus = statusByRegion[item];
										const on = regionOn(item);
										return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "dsm-trae-tab-cell",
											role: "presentation",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
												type: "button",
												role: "tab",
												"aria-selected": item === activeRegion,
												className: `dsm-trae-tab${item === activeRegion ? " dsm-trae-tab-active" : ""}${on ? "" : " dsm-trae-tab-off"}`,
												onClick: () => {
													setActiveRegion(item);
												},
												children: [regionStatus === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													"aria-hidden": "true",
													className: "dsm-trae-tab-dot",
													style: dotStyle(regionStatus.status)
												}), item === "cn" ? t("row.tabCn") : item === "enterprise" ? t("row.tabEnterprise") : t("row.tabAi")]
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
												className: "dsm-trae-switch dsm-trae-tab-switch",
												title: t("row.tabSwitchHint"),
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
													type: "checkbox",
													checked: on,
													disabled: settingsScope?.getSnapshot().writable !== true || togglingRegion !== void 0,
													"aria-label": t("row.tabSwitchAria", { region: item === "cn" ? t("row.tabCn") : item === "enterprise" ? t("row.tabEnterprise") : t("row.tabAi") }),
													onChange: (event) => {
														toggleRegion(item, event.currentTarget.checked);
													}
												})
											})]
										}, item);
									})
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dsm-trae-tab-hint",
									children: t("row.tabHint")
								}),
								writeError === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dsm-trae-usage-error",
									role: "alert",
									children: t("row.settingsWriteFailed", { message: writeError })
								}),
								regionOn(activeRegion) ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dsm-trae-tab-off-notice",
									role: "status",
									children: t("row.tabOffNotice")
								}),
								signedIn ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsm-trae-panels",
									role: "tablist",
									"aria-label": t("row.panelAria"),
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											role: "tab",
											id: "dsm-trae-tab-accounts",
											"aria-controls": "dsm-trae-panel-accounts",
											"aria-selected": panel === "accounts",
											className: `dsm-trae-panel-tab${panel === "accounts" ? " dsm-trae-panel-tab-active" : ""}`,
											onClick: () => {
												setPanel("accounts");
											},
											children: t("row.panelAccounts")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											role: "tab",
											id: "dsm-trae-tab-models",
											"aria-controls": "dsm-trae-panel-models",
											"aria-selected": panel === "models",
											className: `dsm-trae-panel-tab${panel === "models" ? " dsm-trae-panel-tab-active" : ""}`,
											onClick: () => {
												setPanel("models");
											},
											children: t("row.panelModels")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											role: "tab",
											id: "dsm-trae-tab-diag",
											"aria-controls": "dsm-trae-panel-diag",
											"aria-selected": panel === "diag",
											className: `dsm-trae-panel-tab${panel === "diag" ? " dsm-trae-panel-tab-active" : ""}`,
											onClick: () => {
												setPanel("diag");
											},
											children: t("row.panelDiag")
										})
									]
								}) : null,
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "dsm-trae-panel",
									role: "tabpanel",
									id: "dsm-trae-panel-accounts",
									"aria-labelledby": "dsm-trae-tab-accounts",
									hidden: signedIn && panel !== "accounts",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TraeAccountPanel, {
										t,
										settingsScope,
										panel: activeRegion,
										status,
										statusLabel: label,
										credentialRegionIsAi,
										regionOn: activeRegionOn,
										showPointsInMainUi: settingsEdits.showPointsInMainUi,
										onToggleShowPoints: (value) => {
											writePreference("showPointsInMainUi", value);
										},
										creditPosition: creditPositionOn(activeRegion),
										onCreditPositionChange: (position) => {
											changeCreditPosition(activeRegion, position);
										},
										savingPreferences: savingSettings,
										creditsLabelId,
										creditsHintId,
										rows: accountRows,
										busy,
										rescanNote,
										onRescan: () => {
											rescanAccounts();
										},
										switchingAccount,
										onSwitchAccount: (accountId) => {
											switchAccount(accountId);
										},
										onClaim: (accountId) => {
											claimFor(accountId);
										},
										onTransferChanged: async () => {
											const fresh = await refreshUsage(activeRegion);
											if (fresh !== void 0) setStatusByRegion((current) => ({
												...current,
												[activeRegion]: fresh
											}));
										},
										poolDetails,
										poolClaims: status.status === "signed-in" && status.pool?.checkinSupported === true ? Object.fromEntries(status.accounts.map((account) => [account.id, claimViewOf(account.id, accountStatusByRegion[activeRegion][account.id])])) : void 0,
										models: visibleModels,
										deviceClaimed: deviceClaimedToday,
										onPoolChanged: async () => {
											const fresh = await refreshUsage(activeRegion);
											if (fresh !== void 0) setStatusByRegion((current) => ({
												...current,
												[activeRegion]: fresh
											}));
										},
										onPoolRefresh: async () => {
											const fresh = await refreshUsage(activeRegion);
											if (fresh !== void 0) setStatusByRegion((current) => ({
												...current,
												[activeRegion]: fresh
											}));
										},
										creditsUnavailable: status.status === "signed-in" ? status.creditsUnavailable : void 0,
										creditsExpiry: status.status === "signed-in" ? status.credits?.expiry : void 0,
										alternatives: status.status === "signed-in" ? status.alternatives : void 0,
										onSwitchToAlternative: (accountId) => {
											switchAccount(accountId);
										}
									})
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "dsm-trae-panel",
									role: "tabpanel",
									id: "dsm-trae-panel-models",
									"aria-labelledby": "dsm-trae-tab-models",
									hidden: !signedIn || panel !== "models",
									children: signedIn ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
										className: "dsm-trae-models",
										"aria-label": t("row.modelsTitle"),
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "dsm-trae-models-head",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
													className: "dsm-trae-models-title",
													children: t("row.modelsTitle")
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
													className: "dsm-trae-models-summary",
													children: t("row.modelsSummary", { count: activeEnabledIds.size })
												})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: "dsm-trae-models-actions",
													children: [
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
															type: "button",
															className: "dsm-btn dsm-btn-outline",
															disabled: busy,
															onClick: () => {
																refreshModels();
															},
															children: busy ? t("row.modelsRefreshing") : t("row.modelsRefresh")
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
															type: "button",
															className: "dsm-btn dsm-btn-outline",
															disabled: busy || testing !== void 0 || activeEnabledIds.size === 0,
															title: t("row.modelsTestHint"),
															onClick: () => {
																testEnabledModels();
															},
															children: testing === void 0 ? t("row.modelsTestEnabled") : t("row.modelsTesting", {
																done: testing.done,
																total: testing.total
															})
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
															type: "button",
															className: "dsm-btn dsm-btn-outline",
															disabled: busy || testing !== void 0 || visibleModels.length === 0,
															title: t("row.modelsTestAllHint"),
															onClick: () => {
																testAllModels();
															},
															children: testing === void 0 ? t("row.modelsTestAll") : t("row.modelsTesting", {
																done: testing.done,
																total: testing.total
															})
														})
													]
												})]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
												className: "dsm-trae-models-hint",
												children: t("row.modelsTestHint")
											}),
											testSummary === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
												className: "dsm-trae-models-summary",
												children: testSummary
											}),
											testError === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
												className: "dsm-trae-usage-error",
												role: "alert",
												children: testError
											}),
											orderedModels.length > commonModelCount ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "dsm-trae-models-view",
												role: "group",
												"aria-label": t("row.modelsViewLabel"),
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: "dsm-trae-models-view-opt",
													"aria-pressed": modelView === "common",
													title: t("row.modelsViewCommonHint"),
													onClick: () => {
														setModelView("common");
													},
													children: t("row.modelsViewCommon", { count: commonModelCount })
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: "dsm-trae-models-view-opt",
													"aria-pressed": modelView === "all",
													title: t("row.modelsViewAllHint"),
													onClick: () => {
														setModelView("all");
													},
													children: t("row.modelsViewAll", { count: orderedModels.length })
												})]
											}) : null,
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "dsm-trae-models-search",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
													type: "search",
													className: "dsm-trae-models-search-input",
													value: modelQuery,
													placeholder: t("row.modelsSearchPlaceholder"),
													"aria-label": t("row.modelsSearch"),
													onChange: (event) => {
														setModelQuery(event.target.value);
														setClosedModelGroups(/* @__PURE__ */ new Set());
													}
												}), modelQueryActive ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dsm-trae-models-search-count",
													children: t("row.modelsSearchCount", {
														shown: shownModels.length,
														total: scopedModels.length
													})
												}) : null]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "dsm-trae-model-list",
												children: [modelGroups.length === 0 ? matchesOutsideView > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
													className: "dsm-trae-models-empty",
													children: [t("row.modelsSearchOutsideView", {
														query: modelQuery.trim(),
														count: matchesOutsideView
													}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														type: "button",
														className: "dsm-trae-models-widen",
														onClick: () => {
															setModelView("all");
														},
														children: t("row.modelsViewShowAll")
													})]
												}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
													className: "dsm-trae-models-empty",
													children: t("row.modelsSearchEmpty", { query: modelQuery.trim() })
												}) : null, modelGroups.map((group) => {
													const groupKey = `${activeRegion}|${group.channel ?? ""}`;
													const groupOpen = modelQueryActive || !closedModelGroups.has(groupKey);
													return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
														className: "dsm-trae-model-group",
														open: groupOpen,
														onToggle: (event) => {
															const open = event.currentTarget.open;
															setClosedModelGroups((current) => {
																if (open === !current.has(groupKey)) return current;
																const next = new Set(current);
																if (open) next.delete(groupKey);
																else next.add(groupKey);
																return next;
															});
														},
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("summary", {
															className: "dsm-trae-model-group-head",
															children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																className: "dsm-trae-model-group-name",
																children: modelChannelLabel(group.channel, t)
															}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																className: "dsm-trae-model-group-count",
																children: t("row.modelsGroupCount", { count: group.rows.length })
															})]
														}), group.rows.map((model) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
															className: `dsm-trae-model${activeEnabledIds.has(model.id) ? "" : " dsm-trae-model-disabled"}`,
															children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
																className: "dsm-trae-model-head",
																children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
																	className: "dsm-trae-model-enabled",
																	children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
																		type: "checkbox",
																		checked: activeEnabledIds.has(model.id),
																		disabled: settingsScope?.getSnapshot().writable !== true || saving,
																		onChange: () => {
																			toggleModel(model.id);
																		}
																	}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
																		className: "dsm-trae-model-copy",
																		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
																			className: "dsm-trae-model-name",
																			children: [
																				model.name,
																				activeRegion === "enterprise" || model.creditMultiplier === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
																					className: "dsm-trae-model-name-rate",
																					children: ["· x", model.creditMultiplier.toFixed(2)]
																				}),
																				probeBadge(probeByRegion[activeRegion][model.id], t)
																			]
																		}), promoBadge(model, t, nowForPromo)]
																	})]
																}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
																	className: "dsm-trae-model-options",
																	children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
																		className: "dsm-trae-model-image",
																		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
																			type: "checkbox",
																			checked: rowAcceptsImage(model),
																			disabled: rowImageIsAutomatic(model) || settingsScope?.getSnapshot().writable !== true || saving,
																			title: rowImageIsAutomatic(model) ? t("row.modelImageAuto") : void 0,
																			onChange: () => {
																				toggleImage(model.id);
																			}
																		}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("row.modelImage") })]
																	}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("fieldset", {
																		className: "dsm-trae-context-budget",
																		"aria-label": t("row.contextBudget"),
																		title: t("row.contextBudgetHint"),
																		children: contextBudgetOptions(model).map((option) => {
																			const selectable = model.maxContextWindow !== void 0;
																			const checked = (activeContextBudgets[model.id] ?? model.contextWindow) === option;
																			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
																				type: "radio",
																				name: `context-${model.id}`,
																				checked,
																				disabled: !selectable || settingsScope?.getSnapshot().writable !== true || saving,
																				onChange: () => {
																					setContextBudget(model.id, option);
																				}
																			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: formatCapacity(option, t("row.modelUnknown")) })] }, option);
																		})
																	})]
																})]
															}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
																className: "dsm-trae-model-meta",
																children: [
																	/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("row.modelContext", { context: formatCapacity(model.maxContextWindow ?? model.contextWindow, t("row.modelUnknown")) }) }),
																	model.maxTokens === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("row.modelOutput", { output: formatCapacity(model.maxTokens, t("row.modelUnknown")) }) }),
																	model.reasoning === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("row.modelReasoning", { efforts: model.reasoning.supported.join(" / ") }) })
																]
															})]
														}, model.id))]
													}, groupKey);
												})]
											}),
											enabledOutsideView.length === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
												className: "dsm-trae-models-note",
												children: [t("row.modelsEnabledOutsideView", { count: enabledOutsideView.length }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: "dsm-trae-models-widen",
													onClick: () => {
														setModelView("all");
													},
													children: t("row.modelsViewShowAll")
												})]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "dsm-trae-context-bulk",
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														type: "button",
														className: "dsm-btn dsm-btn-outline",
														disabled: busy || saving || settingsScope?.getSnapshot().writable !== true || !visibleModels.some((model) => contextBudgetOptions(model).includes(5e5)),
														title: t("row.contextAllMidHint"),
														onClick: setAllContextMid,
														children: t("row.contextAllMid")
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														type: "button",
														className: "dsm-btn dsm-btn-outline",
														disabled: busy || saving || settingsScope?.getSnapshot().writable !== true || !visibleModels.some((model) => model.maxContextWindow !== void 0),
														title: t("row.contextAllMaxHint"),
														onClick: setAllContextMax,
														children: t("row.contextAllMax")
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														type: "button",
														className: "dsm-btn dsm-btn-outline",
														disabled: busy || saving || settingsScope?.getSnapshot().writable !== true || Object.keys(activeContextBudgets).length === 0,
														title: t("row.contextAllDefaultHint"),
														onClick: resetAllContextBudgets,
														children: t("row.contextAllDefault")
													})
												]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
												className: "dsm-trae-model-capability-note",
												children: t("row.contextBudgetHint")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
												className: "dsm-trae-draw-image",
												"data-disabled": drawImageServable ? void 0 : "true",
												title: drawImageServable ? t("row.drawImageHint") : drawImageUnavailableHint,
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
													type: "checkbox",
													checked: drawImageOn,
													disabled: !drawImageServable || busy || saving || savingSettings || settingsScope?.getSnapshot().writable !== true,
													onChange: (event) => {
														writeDrawImage(event.target.checked);
													}
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [t("row.drawImage"), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
													className: "dsm-trae-draw-image-hint",
													children: [" ", drawImageServable ? t("row.drawImageHint") : drawImageUnavailableHint]
												})] })]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
												className: "dsm-trae-model-capability-note",
												children: t("row.modelCapabilityPending")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "dsm-trae-model-actions",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("a", {
													className: "dsm-trae-usage-cheer",
													href: TRAE_GITHUB_URL,
													target: "_blank",
													rel: "noopener noreferrer",
													children: [t("row.cheer"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "dsm-trae-usage-cheer-star",
														"aria-hidden": "true",
														children: "★"
													})]
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: "dsm-trae-model-actions-buttons",
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														type: "button",
														className: "dsm-btn dsm-btn-outline",
														disabled: !dirty || saving,
														onClick: discardModels,
														children: t("row.discard")
													}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														type: "button",
														className: "dsm-btn dsm-btn-primary",
														disabled: !dirty || saving || activeEnabledIds.size === 0,
														onClick: () => {
															saveModels();
														},
														children: saving ? t("row.saving") : t("row.save")
													})]
												})]
											})
										]
									}) }) : null
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "dsm-trae-panel",
									role: "tabpanel",
									id: "dsm-trae-panel-diag",
									"aria-labelledby": "dsm-trae-tab-diag",
									hidden: !signedIn || panel !== "diag",
									children: status.status !== "signed-in" || panel !== "diag" ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsm-trae-diag",
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "dsm-trae-diag-row",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dsm-trae-diag-label",
													children: t("row.diagRegion")
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dsm-trae-diag-value",
													children: activeRegion === "cn" ? t("row.tabCn") : activeRegion === "enterprise" ? t("row.tabEnterprise") : t("row.tabAi")
												})]
											}),
											status.unsupportedRegion === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "dsm-trae-diag-row",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dsm-trae-diag-label",
													children: t("row.diagUnsupportedRegion")
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
													className: "dsm-trae-diag-value dsm-trae-diag-bad",
													children: [
														status.unsupportedRegion.region.toUpperCase(),
														" · ",
														status.unsupportedRegion.accounts.join(", ")
													]
												})]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "dsm-trae-diag-row",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dsm-trae-diag-label",
													children: t("row.diagProvider")
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dsm-trae-diag-value dsm-trae-diag-mono",
													children: providerOfPanel(activeRegion)
												})]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "dsm-trae-diag-row",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dsm-trae-diag-label",
													children: t("row.diagAccount")
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dsm-trae-diag-value",
													children: status.accountName
												})]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "dsm-trae-diag-row",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dsm-trae-diag-label",
													children: t("row.diagToken")
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dsm-trae-diag-value dsm-trae-diag-mono",
													children: formatDateTime(status.tokenExpiresAtMs)
												})]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "dsm-trae-diag-row",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dsm-trae-diag-label",
													children: t("row.diagRefresh")
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dsm-trae-diag-value dsm-trae-diag-mono",
													children: status.refreshExpiresAtMs === void 0 ? t("row.diagRefreshNone") : formatDateTime(status.refreshExpiresAtMs)
												})]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "dsm-trae-diag-row",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dsm-trae-diag-label",
													children: t("row.diagCatalog")
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dsm-trae-diag-value",
													children: formatNumber(status.models.length)
												})]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "dsm-trae-diag-row",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dsm-trae-diag-label",
													children: t("row.diagEnabled")
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dsm-trae-diag-value",
													children: formatNumber(status.enabledModelIds.length)
												})]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "dsm-trae-diag-row",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dsm-trae-diag-label",
													children: t("row.diagPool")
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dsm-trae-diag-value",
													children: status.pool === void 0 ? t("row.diagPoolOff") : status.pool.enabled ? t("row.diagPoolOn", { count: status.pool.effectiveMemberAccountIds?.length ?? status.pool.accounts.length }) : t("row.diagPoolOff")
												})]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "dsm-trae-diag-row",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dsm-trae-diag-label",
													children: t("row.diagCheckin")
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dsm-trae-diag-value",
													children: status.checkin !== void 0 || status.pool?.checkinSupported === true ? t("row.diagCheckinOn") : t("row.diagCheckinOff")
												})]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "dsm-trae-diag-row",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dsm-trae-diag-label",
													children: t("row.diagRaw")
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dsm-trae-diag-value dsm-trae-diag-mono",
													children: status.rawChat === void 0 ? t("row.diagRawOff") : status.rawChat.state
												})]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "dsm-trae-diag-row",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dsm-trae-diag-label",
													children: t("row.diagFailures")
												}), (() => {
													const failures = [];
													if (status.creditsError !== void 0) failures.push(status.creditsError);
													if (status.payStatusError !== void 0) failures.push(status.payStatusError);
													if (status.checkinError !== void 0) failures.push(status.checkinError);
													if (writeError !== void 0) failures.push(writeError);
													return failures.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "dsm-trae-diag-value",
														children: t("row.diagNoFailures")
													}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "dsm-trae-diag-value dsm-trae-diag-bad dsm-trae-diag-mono",
														children: failures.join(" · ")
													});
												})()]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "dsm-trae-diag-row",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dsm-trae-diag-label",
													children: t("row.diagQuarantine")
												}), status.quarantined === void 0 || status.quarantined.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dsm-trae-diag-value",
													children: t("row.diagQuarantineNone")
												}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dsm-trae-diag-value dsm-trae-diag-bad dsm-trae-diag-mono",
													children: status.quarantined.map((item) => item.quarantinedAs).join(" · ")
												})]
											})
										]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: "dsm-trae-diag-hint",
										children: t("row.diagHint")
									})] })
								}),
								status.status === "signed-out" && loading ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dsm-trae-usage-text",
									role: "status",
									children: t("row.accountsLoading")
								}) }) : null,
								status.status === "signed-out" && !loading ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: "dsm-trae-usage-text",
										children: status.message ?? t("row.signedOutHint")
									}),
									status.unsupportedRegion === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
										className: "dsm-trae-quarantine",
										open: true,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", { children: t("row.unsupportedRegionTitle") }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
												className: "dsm-trae-quarantine-hint",
												children: t("row.unsupportedRegionHint")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
												className: "dsm-trae-quarantine-list",
												children: status.unsupportedRegion.accounts.map((name) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: name }) }, name))
											})
										]
									}),
									status.quarantined && status.quarantined.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
										className: "dsm-trae-quarantine",
										open: true,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("summary", { children: [
												t("row.quarantineTitle"),
												" (",
												status.quarantined.length,
												")"
											] }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
												className: "dsm-trae-quarantine-hint",
												children: t("row.quarantineHint")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
												className: "dsm-trae-quarantine-list",
												children: status.quarantined.map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: item.quarantinedAs }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
													className: "dsm-trae-quarantine-reason",
													children: [
														item.accounts === void 0 ? t("row.quarantineAccountsUnknown") : t("row.quarantineAccounts", { count: item.accounts }),
														" · ",
														t("row.quarantineBytes", { bytes: item.bytes })
													]
												})] }, item.quarantinedAs))
											})
										]
									}) : null,
									status.searched && status.searched.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
										className: "dsm-trae-searched",
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("summary", { children: [
												t("row.searchedTitle"),
												" (",
												status.searched.length,
												")"
											] }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
												className: "dsm-trae-searched-hint",
												children: t("row.searchedHint")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
												className: "dsm-trae-searched-list",
												children: status.searched.map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: item.path }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
													className: "dsm-trae-searched-reason",
													children: [
														t(item.source === "cli" ? "row.sourceCli" : "row.sourceDesktop"),
														" · ",
														t(item.reason === "missing" ? "row.reasonMissing" : item.reason === "unreadable" ? "row.reasonUnreadable" : "row.reasonInvalid")
													]
												})] }, `${item.source}:${item.path}`))
											})
										]
									}) : null
								] }) : null,
								status.status === "error" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dsm-trae-usage-error",
									children: status.message
								}) : null
							]
						}) : null
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(BusyOverlay, {
						visible: saving || savingSettings,
						message: t("row.veilSaving")
					})
				]
			});
		}
		//#endregion
		//#region src/client/popover.ts
		/**
		* The two shell behaviours the composer credit panel needs: hanging the panel
		* off its trigger, and dismissing it on an outside press.
		*
		* Implemented locally rather than imported from
		* `@deepseek-ai/dsh-client-ui-primitives`. The shell DOES register that package
		* for plugin bundles, so importing it is legal — this is a deliberate choice,
		* not a workaround: the two behaviours are ~40 lines of DOM geometry, and owning
		* them keeps this component renderable in the Node test suite without mocking a
		* package that itself reaches `*.module.css` and further DSH dependencies.
		*
		* NOTE ON A MISDIAGNOSIS, kept because it is the kind of thing that gets
		* re-litigated: the 2.12.0/2.13.0 client load failure was first attributed to
		* importing the primitives package. It was not that. The real cause was
		* `import { createPortal } from 'react-dom'` being BUNDLED rather than
		* externalized — the inlined development build opens with
		* `process.env.NODE_ENV` and threw `ReferenceError: process is not defined` in
		* the browser. See `tsdown.config.ts` for the fix and
		* `tests/client-runtime-imports.spec.ts` for the rule that now prevents it.
		*
		* Behaviour is intentionally identical to the shell's implementations: the same
		* top/bottom placement, the same viewport clamping, the same re-measure on
		* scroll (capture, so nested scrollers count), resize and the panel's own size
		* changes, and the same "a pointerdown outside both the trigger and the panel
		* closes it" rule.
		*/
		/**
		* Clearance to keep from the top of the viewport.
		*
		* The shell reserves a strip at the top of the frame (`--dsh-frame-top-clearance`)
		* for the window chrome, so a panel clamped to `margin` alone can still land
		* under it. Absent variable or no `data-fullscreen` distinction is handled the
		* same way the shell does: fall back to `min`.
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
		//#region src/client/ComposerPoints.tsx
		/**
		* Credit readout for the composer row (`conversation.input.right`, rendered
		* immediately before the model picker).
		*
		* Shows the bound CN account's general credit balance, but ONLY while the
		* session's selected model belongs to this plugin. That condition is the whole
		* point: the sidebar foot is a single shared row, so two connector plugins each
		* parking a line there end up fighting for the same space. The composer row is
		* per-session and provider-scoped, so exactly one plugin's credits are relevant
		* at a time and nothing overlaps.
		*
		* The row itself is a bare clickable readout — `Trae CN · 657` — with NO
		* refresh control. Clicking it opens an anchored panel: a TABLE with one row
		* per account in the region and that account's general balance, where a row
		* click switches to it. The manual refresh button lives in the panel too.
		*
		* Two deliberate choices in that panel:
		*
		*  - GENERAL balance only, not Work credits. The table's one figure is the
		*    bucket the SOLO chat actually spends; two columns of numbers in a
		*    five-slot popover is noise, and the card is where the breakdown belongs.
		*  - Per-account figures are fetched ONLY while the panel is open. The
		*    5-minute readout must not multiply its upstream reads by the account
		*    count — a healthy balance should not pay for a table nobody is looking at.
		*    This is the same principle that keeps `creditAlternatives` firing only
		*    when a balance hits zero.
		*
		* The provider comes from the Host's own `modelSelection` projection rather
		* than from anything this plugin tracks: the projection is what the model
		* picker writes and what the next request will use, so the readout cannot
		* disagree with the model actually in effect.
		*/
		/**
		* Inject the readout's styles into the document head, once, on module load.
		*
		* Same idempotent pattern as the card's injection, and for the same reason: the
		* classes are attached to DOM this component owns, and `.dsm-card-*` lives in
		* `TRAE_CARD_CSS` — which only loads when the settings card does. Before this
		* existed (2.13.0–2.13.4) the trigger rendered as the browser's default button
		* box and the panel, with no `position: fixed`, had its measured left/top
		* ignored and appeared nowhere.
		*/
		if (typeof document !== "undefined") {
			const cssId = "dsh-connect-trae/composer-points.css";
			if (!document.querySelector(`style[data-plugin-css="${cssId}"]`)) {
				const styleTag = document.createElement("style");
				styleTag.dataset.plugin = "dsh-connect-trae";
				styleTag.dataset.pluginCss = cssId;
				styleTag.textContent = COMPOSER_POINTS_CSS;
				document.head.appendChild(styleTag);
			}
		}
		/**
		* Automatic refresh period. Five minutes, matching the sidebar line: a credit
		* balance moves on the scale of model calls, not seconds, and each read is two
		* read-only upstream calls.
		*/
		const COMPOSER_POINTS_REFRESH_INTERVAL_MS = 3e5;
		/**
		* Provider routes this readout serves, mapped to the region to read from.
		*
		* BOTH regions, but they do not show the same KIND of number, and that is the
		* data's doing rather than a preference:
		*
		*  - `cn` is credit-based, so the readout shows the account's general balance.
		*  - `ai` is subscription-based. The Host builds its usage document from
		*    `payStatus` and never sets `credits` on it (`webStatusFor` returns early
		*    for `region === 'ai'`), so there is no balance to show. What it does carry
		*    is the PLAN, so the readout names the plan (`Pro` / `Free`) instead.
		*
		* The international route was previously omitted entirely, which meant the
		* readout vanished while an international model was selected — the asymmetry a
		* user reported. Omitting it was the safer half of a real problem (a plan-shaped
		* document templated into a number slot renders a dash), but the fix is to
		* render what that side actually has, not to render nothing.
		*
		* Mirrors `TRAE_PROVIDERS` on the host side; duplicated here because the client
		* bundle must not import the host entry.
		*/
		const TRAE_COMPOSER_PROVIDERS = {
			"trae": "cn",
			"trae-global": "ai"
		};
		/** The general credit balance out of one usage document, or undefined. */
		function generalCreditsOf(usage) {
			if (usage.status !== "signed-in") return void 0;
			return usage.credits?.generalAvailable;
		}
		/** Group the digits so a four-figure balance stays readable in a narrow row. */
		function formatCredits(value) {
			return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
		}
		/**
		* The soonest expiry the chosen tier names, or undefined when none carries one.
		*
		* Read from the tier the shared ladder picked, so the time shown always belongs
		* to the horizon the headline claims — the two cannot disagree.
		*/
		function soonestExpiryOf(expiry) {
			return expiryNotice(expiry)?.soonestExpiresAtMs;
		}
		/**
		* The notice's headline sentence, naming the amount and the pack count.
		*
		* The TIER is chosen by the shared ladder (see `./expiry-ladder.ts`), which the
		* card's account panel uses too — the two surfaces render the same locale
		* keys, so the choice must not be made twice.
		*/
		function expiryMessageOf(expiry, t) {
			const notice = expiryNotice(expiry);
			if (notice === void 0) return "";
			return t(expiryHeadlineKey(notice.tier), {
				total: formatCredits(notice.total),
				packs: String(notice.packs)
			});
		}
		/**
		* A clock time, for the ONE thing in this panel that is always the same day:
		* `composer.lastRefresh`, which is "now" by construction.
		*
		* DO NOT reuse this for credit expiry. It was reused for that once (issue #71)
		* and produced `最早到期：23:59` for a pack expiring TOMORROW at 23:59 — a full
		* day earlier than the truth, in the one sentence whose entire job is "how long
		* do I have left". The card already rendered the same locale key
		* (`row.expiryEarliest`) through `formatDateTime`, so one key had two
		* granularities in one plugin. Expiry goes through `formatDateTime`; only
		* same-day instants may use this.
		*
		* The locale is `undefined` — the READER's, not a fixed one — so an English UI
		* shows `11:59 PM` rather than the Chinese convention's `23:59`. It used to
		* hardcode `'zh-CN'`, which meant the English interface printed a Chinese-style
		* time (issue #71's aside). `formatDateTime` already worked this way; this
		* brings the two into agreement.
		*/
		function formatClock(value) {
			return new Date(value).toLocaleTimeString(void 0, {
				hour: "2-digit",
				minute: "2-digit"
			});
		}
		function ComposerPoints(props) {
			const { t, provider, region, settingsScope } = props;
			if (t === void 0) throw new Error("Composer points readout requires its translation function");
			const owned = provider === void 0 ? void 0 : TRAE_COMPOSER_PROVIDERS[provider];
			const activeRegion = region ?? owned;
			const [usage, setUsage] = (0, react.useState)(void 0);
			const [accountCredits, setAccountCredits] = (0, react.useState)(void 0);
			/**
			* Per-account PLANS, international region only.
			*
			* The CN panel reads the credit route; that route is CN-shaped (it calls the
			* credit snapshot, which the ai document does not carry), so the international
			* panel reads the per-account STATUS route instead — the same one the card's
			* roster uses, which answers `payStatus` for ai. Reads only while the panel is
			* open, for the same reason the credit route does.
			*/
			const [accountPlans, setAccountPlans] = (0, react.useState)(void 0);
			const [busy, setBusy] = (0, react.useState)(false);
			const [switchingId, setSwitchingId] = (0, react.useState)(void 0);
			const [failed, setFailed] = (0, react.useState)(false);
			const [lastRefresh, setLastRefresh] = (0, react.useState)(void 0);
			const [open, setOpen] = (0, react.useState)(false);
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
					const response = await fetch(withTraeRegion(TRAE_USAGE_PATH, activeRegion), {
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
			* Every account's general balance — one upstream read per account.
			*
			* Paid only while the panel is open (see the note at the top of this file).
			* A failure keeps whatever we already have rather than clearing it: a number
			* that went stale is better than a switch that vanished.
			*/
			const fetchAccountCredits = (0, react.useCallback)(async (signal) => {
				if (activeRegion === void 0) return;
				try {
					const response = await fetch(withTraeRegion(TRAE_ACCOUNT_CREDITS_PATH, activeRegion), {
						headers: { accept: "application/json" },
						credentials: "same-origin",
						...signal === void 0 ? {} : { signal }
					});
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
					const data = await response.json();
					if (!mounted.current || signal?.aborted === true) return;
					if (Array.isArray(data.accounts)) setAccountCredits(data.accounts);
				} catch {}
			}, [activeRegion]);
			(0, react.useEffect)(() => {
				if (owned === void 0) return void 0;
				let cancelled = false;
				let timer;
				const controller = new AbortController();
				fetchUsage(controller.signal).finally(() => {
					if (cancelled) return;
					timer = window.setInterval(() => {
						fetchUsage(controller.signal);
					}, COMPOSER_POINTS_REFRESH_INTERVAL_MS);
				});
				return () => {
					cancelled = true;
					if (timer !== void 0) window.clearInterval(timer);
					controller.abort();
				};
			}, [owned, fetchUsage]);
			/**
			* Every account's PLAN, one status read per account — ai only.
			*
			* Costs one upstream call per account, paid only while the panel is open (the
			* same rule the credit route follows). A failed read leaves that account's plan
			* undefined, which the row renders as a dash: the row still switches accounts,
			* which is the panel's primary job.
			*/
			const fetchAccountPlans = (0, react.useCallback)(async (signal) => {
				if (activeRegion !== "ai") return;
				const roster = usage?.status === "signed-in" ? usage.accounts.filter((account) => account.region === "ai") : [];
				if (roster.length === 0) {
					setAccountPlans({});
					return;
				}
				const entries = await Promise.all(roster.map(async (account) => {
					try {
						const response = await fetch(`${withTraeRegion(TRAE_ACCOUNT_STATUS_PATH, "ai")}&accountId=${encodeURIComponent(account.id)}`, {
							headers: { accept: "application/json" },
							credentials: "same-origin",
							...signal === void 0 ? {} : { signal }
						});
						if (!response.ok) throw new Error(`HTTP ${response.status}`);
						const state = await response.json();
						return [account.id, state.payStatus];
					} catch {
						return [account.id, void 0];
					}
				}));
				if (!mounted.current || signal?.aborted === true) return;
				setAccountPlans(Object.fromEntries(entries));
			}, [activeRegion, usage]);
			(0, react.useEffect)(() => {
				if (!open || activeRegion === void 0) return void 0;
				const controller = new AbortController();
				if (activeRegion === "ai") fetchAccountPlans(controller.signal);
				else fetchAccountCredits(controller.signal);
				return () => {
					controller.abort();
				};
			}, [
				open,
				activeRegion,
				fetchAccountCredits,
				fetchAccountPlans
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
			/**
			* Switch to another account, then re-read both the usage document and the
			* table so the marker, the readout, and the panel all move together.
			*
			* The merge goes through the shared `configuredAccountsOf` helper (the card
			* uses the same one): writing only `[region]: id` would drop the other
			* region's selection. The write is read-back checked — `set()` resolving is
			* not proof it landed — so a refused write reports failure instead of
			* showing a marker on an account that was never selected.
			*/
			const switchTo = async (accountId) => {
				if (settingsScope === void 0 || settingsScope.getSnapshot().writable !== true) return;
				if (activeRegion === void 0 || switchingId !== void 0) return;
				if (accountId === (accountCredits?.find((account) => account.selected)?.id ?? (usage?.status === "signed-in" ? usage.accountId : void 0))) return;
				setSwitchingId(accountId);
				setFailed(false);
				try {
					const configured = configuredAccountsOf(settingsScope.getSnapshot().value);
					const accepted = await settingsScope.set("accounts", {
						...configured,
						[activeRegion]: accountId
					});
					const readBack = configuredAccountsOf(settingsScope.getSnapshot().value);
					if (accepted === false || readBack[activeRegion] !== accountId) throw new Error("the Host did not persist the switch");
					await fetchUsage();
					if (activeRegion === "ai") await fetchAccountPlans();
					else await fetchAccountCredits();
				} catch {
					if (mounted.current) setFailed(true);
				} finally {
					if (mounted.current) setSwitchingId(void 0);
				}
			};
			if (owned === void 0) return null;
			const signedIn = usage?.status === "signed-in" ? usage : void 0;
			const signedOut = usage !== void 0 && usage.status === "signed-out";
			const general = signedIn === void 0 ? void 0 : generalCreditsOf(signedIn);
			/**
			* What the readout shows after the separator.
			*
			* Region-dependent because the two sides answer different questions: CN has a
			* spendable balance, ai has a plan. Reading the credit field on an ai document
			* would always be `undefined` and print the dash this change exists to remove.
			*/
			const valueText = activeRegion === "ai" ? signedIn?.payStatus === void 0 ? "—" : planText(signedIn.payStatus, t) : general === void 0 ? "—" : formatCredits(general);
			/**
			* The label before the separator. Per REGION, not one hardcoded 'Trae CN':
			* the international readout sat next to the wrong product name otherwise.
			*/
			const label = activeRegion === "ai" ? t("composer.pointsGlobal") : t("composer.points");
			/**
			* The table's rows: every account in this region, with its general balance.
			*
			* The endpoint's answer is authoritative (it carries the figures). Before it
			* lands — or if it fails — fall back to the usage document's account list so
			* the switches are reachable immediately, showing `—` for the figure rather
			* than a spinner the user has to wait on.
			*/
			const selectedId = accountCredits?.find((account) => account.selected)?.id ?? (signedIn === void 0 ? void 0 : signedIn.accountId);
			const rows = (activeRegion === "ai" ? signedIn === void 0 ? [] : signedIn.accounts.filter((account) => account.region === "ai").map((account) => ({
				id: account.id,
				accountName: account.accountName,
				selected: account.selected
			})) : accountCredits ?? (signedIn === void 0 ? [] : signedIn.accounts.filter((account) => account.region === activeRegion).map((account) => ({
				id: account.id,
				accountName: account.accountName,
				selected: account.selected
			})))).map((row) => {
				if (row.id !== selectedId || row.generalAvailable !== void 0 || general === void 0) return row;
				return {
					...row,
					generalAvailable: general
				};
			});
			const canSwitch = settingsScope !== void 0 && settingsScope.getSnapshot().writable === true;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				ref: rootRef,
				className: "dsm-trae-composer-points",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: "dsm-trae-composer-points-trigger",
					"aria-haspopup": "dialog",
					"aria-expanded": open,
					onClick: () => {
						setOpen(!open);
					},
					children: [
						label,
						" · ",
						valueText
					]
				}), open && (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					ref: panelRef,
					className: "dsm-trae-composer-panel",
					style: position ?? {
						visibility: "hidden",
						left: 0,
						top: 0
					},
					role: "dialog",
					"aria-label": activeRegion === "ai" ? t("composer.panelTitleGlobal") : t("composer.panelTitle"),
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsm-trae-composer-panel-head",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dsm-trae-composer-panel-title",
								children: activeRegion === "ai" ? t("composer.panelTitleGlobal") : t("composer.panelTitle")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dsm-trae-composer-panel-refresh",
								disabled: busy || switchingId !== void 0,
								onClick: () => {
									fetchUsage();
								},
								children: busy ? t("composer.refreshing") : t("composer.refresh")
							})]
						}),
						signedOut ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dsm-trae-composer-panel-empty",
							children: t("composer.signedOut")
						}) : rows.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dsm-trae-composer-panel-empty",
							children: t("composer.noAccounts")
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("table", {
							className: "dsm-trae-composer-panel-table",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
								scope: "col",
								children: t("composer.account")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
								scope: "col",
								className: "dsm-trae-composer-panel-num",
								children: activeRegion === "ai" ? t("composer.plan") : t("composer.generalCredits")
							})] }) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("tbody", { children: rows.map((row) => {
								const current = row.id === selectedId;
								return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", {
									className: current ? "dsm-trae-composer-panel-row-current" : void 0,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
										scope: "row",
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
											type: "button",
											className: "dsm-trae-composer-panel-switch",
											disabled: !canSwitch || switchingId !== void 0 || current,
											"aria-label": t("composer.switchTo", { account: row.accountName }),
											onClick: () => {
												switchTo(row.id);
											},
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "dsm-trae-composer-panel-dot",
												"aria-hidden": "true"
											}), row.accountName]
										})
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
										className: "dsm-trae-composer-panel-num",
										children: activeRegion === "ai" ? (() => {
											const payStatus = row.id === selectedId && signedIn?.payStatus !== void 0 ? signedIn.payStatus : accountPlans?.[row.id];
											return payStatus === void 0 ? "—" : planText(payStatus, t);
										})() : row.generalAvailable === void 0 ? "—" : formatCredits(row.generalAvailable)
									})]
								}, row.id);
							}) })]
						}),
						activeRegion === "cn" && signedIn?.credits?.expiry !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: `dsm-trae-expiry ${expiryToneClass(expiryNotice(signedIn.credits.expiry)?.tier ?? "lapsed")}`,
							role: "status",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: expiryMessageOf(signedIn.credits.expiry, t) }), soonestExpiryOf(signedIn.credits.expiry) === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dsm-trae-expiry-detail",
								children: t("row.expiryEarliest", { time: formatDateTime(soonestExpiryOf(signedIn.credits.expiry)) })
							})]
						}) : null,
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dsm-trae-composer-panel-foot",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
								t("composer.lastRefresh"),
								" ",
								lastRefresh === void 0 ? "—" : formatClock(lastRefresh)
							] })
						}),
						failed ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dsm-trae-composer-panel-error",
							role: "status",
							children: t("composer.refreshFailed")
						}) : null
					]
				}), document.body)]
			});
		}
		//#endregion
		//#region src/client/ComposerPointsGate.tsx
		/**
		* Decides whether the composer credit readout belongs in this session, by
		* reading the Host's own `modelSelection` projection and the plugin's
		* `showPointsInMainUi` switch.
		*
		* Kept separate from {@link ComposerPoints} (and from the browser-plugin entry)
		* so the decision can be unit-tested without a Host: the entry imports
		* browser-only DSH packages the test environment cannot load, while this module
		* depends only on React and a narrow projection shape.
		*
		* WHY the projection rather than this plugin's own state: the projection is
		* what the model picker writes and what the next request will use, so the
		* readout cannot disagree with the model actually in effect. `next` outranks
		* `lastUsed` because a selection that has been made but not yet sent is still
		* what the composer shows the user.
		*
		* The switch is read the same way the retired sidebar gate read it: absent or
		* false means OFF, and only an explicit `true` shows the readout. The composer
		* row is shared with the shell's own permission/agent/model controls, so the
		* readout must be asked for, not imposed — 2.13.0 rendered it unconditionally
		* and 2.13.3 restored the opt-in after the user went looking for the switch.
		*
		* WHY THERE IS A SECOND SEAT (learned from dsh-connect-workbuddy issue #62).
		* That row is a LIST seat, so it is shared not only with the shell's own
		* controls but with any other plugin that registers there — and one report is
		* exactly that: with a third-party plugin installed the readout stopped
		* appearing. A list seat cannot promise that every occupant is visible, so the
		* seat becomes the USER's choice: `composer` (default, unchanged for anyone who
		* does not choose) or `stats`, the ambient dock below the composer card where
		* the shell renders its own round/step/token pills. This plugin has already
		* lost this readout once to a shared seat — it used to live at the sidebar
		* foot, where it was clipped to "Tr" beside dsh-connect-workbuddy's rows.
		*
		* The gate is registered in BOTH seats and renders in the one the setting
		* names, which keeps the decision in ONE function instead of re-registering
		* slots when the setting changes — and this repository already documents that
		* kind of binding as fragile (the rc.6→rc.7 `id`/`order` → `key`/`priority`
		* rename). Registration is unconditional; only the render is conditional.
		*/
		/**
		* The provider route the session is currently pointed at.
		*
		* `next` wins over `lastUsed`: a switch that has landed but not yet been sent
		* is still the selection the composer displays.
		*/
		function selectedProviderOf(projection) {
			const provider = (projection?.next ?? projection?.lastUsed)?.provider;
			return typeof provider === "string" && provider !== "" ? provider : void 0;
		}
		/**
		* The settings tree this plugin writes, unwrapped to a plain object.
		*
		* `unwrapVolatileDeep` first: on DSH 0.1.7 the scope's value is a live
		* cosmokit reference, and reading a field off it without unwrapping yields a
		* proxy whose `===` comparison against a string is false — which would make the
		* seat test below reject EVERY seat and silently hide the readout.
		*/
		function scopeValueOf(scope) {
			return scope === void 0 ? void 0 : unwrapVolatileDeep(scope.getSnapshot().value);
		}
		/**
		* Read the composer-readout switch out of a committed settings snapshot.
		*
		* Absent means OFF, matching the host default (`false`): a scope that has not
		* populated yet, or a host too old to serve the field, must not put a row in
		* the composer toolbar that the user never asked for.
		*/
		function composerPointsEnabledOf(scope) {
			return scopeValueOf(scope)?.showPointsInMainUi === true;
		}
		function ComposerPointsGate(props) {
			const { t, position, settingsScope, useProjection } = props;
			const [enabled, setEnabled] = (0, react.useState)(() => composerPointsEnabledOf(settingsScope));
			(0, react.useEffect)(() => settingsScope?.subscribe(() => {
				setEnabled(composerPointsEnabledOf(settingsScope));
			}), [settingsScope]);
			const projection = useProjection === void 0 ? void 0 : useProjection("modelSelection");
			if (!enabled) return null;
			const provider = selectedProviderOf(projection);
			const region = provider === void 0 ? void 0 : TRAE_COMPOSER_PROVIDERS[provider];
			if (region === void 0) return null;
			if (!regionEnabledOf(scopeValueOf(settingsScope), region)) return null;
			if (regionCreditPositionOf(scopeValueOf(settingsScope), region) !== (position ?? "composer")) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ComposerPoints, {
				t,
				provider,
				region,
				...settingsScope === void 0 ? {} : { settingsScope }
			});
		}
		//#endregion
		//#region src/client/locales.ts
		/**
		* Plugin-card copy registered under the settings.trae locale namespace.
		* Key shape follows `dsh-subagent-default-model`'s `row.*` convention so the
		* two plugins share one external-presentation language.
		*/
		const en = {
			"row.title": "Trae credits & models (dsh-connect-trae)",
			"row.desc": "Use Trae models in DSH and see your remaining credits; the domestic and international sides are two independent providers, each with its own account — use both at the same time.",
			"row.expand": "Expand",
			"row.collapse": "Collapse",
			"row.tabCn": "Domestic",
			"row.tabEnterprise": "Enterprise",
			"row.tabAi": "Global",
			"row.tabHint": "Three independent providers, each with its own account, usage, and models. All are live at once and never affect each other.",
			"row.tabEnterpriseHint": "Enterprise bills the tenant pool of the same Trae CN account instead of the personal one. It never falls back: a refusal is reported as an error rather than quietly spending personal credits.",
			"row.tabSwitchHint": "Turns this provider off: its models leave the DSH picker. Account and settings are kept.",
			"row.tabSwitchAria": "Offer the {region} provider to DSH",
			"row.tabOffNotice": "This provider is off: its models are not offered to DSH. Account and settings are kept.",
			"row.panelAria": "Card sections",
			"row.panelAccounts": "Account",
			"row.panelModels": "Models",
			"row.panelDiag": "Diagnostics",
			"row.diagRegion": "Panel",
			"row.diagProvider": "Provider id",
			"row.diagAccount": "Serving account",
			"row.diagToken": "Access token expires",
			"row.diagRefresh": "Re-sign-in deadline",
			"row.diagRefreshNone": "this credential carries none",
			"row.diagCatalog": "Models in catalog",
			"row.diagEnabled": "Models enabled",
			"row.diagPool": "Account pool",
			"row.diagPoolOn": "on · {count} account(s)",
			"row.diagPoolOff": "off",
			"row.diagCheckin": "Daily check-in",
			"row.diagCheckinOn": "supported",
			"row.diagCheckinOff": "not offered here",
			"row.diagRaw": "Raw chat channel",
			"row.diagRawOff": "not checked",
			"row.diagFailures": "Last reported failure",
			"row.diagNoFailures": "none",
			"row.diagQuarantine": "Quarantined copies",
			"row.diagQuarantineNone": "none",
			"row.diagHint": "Everything above is read-only and can be quoted verbatim into a bug report. The values are this panel’s own last refresh, not a summary of it.",
			"row.settingsWriteFailed": "The setting was not saved: {message}",
			"row.signedOut": "Not signed in",
			"row.signedOutHint": "Sign in once in the Trae desktop app; this plugin follows that sign-in automatically.",
			"row.unsupportedRegionTitle": "US region is not supported yet",
			"row.unsupportedRegionHint": "A Trae account on this machine belongs to the United States region (userRegion \"US\" / host *.traeapi.us). This build does not serve that region, so the account is NOT used and no request is sent to the Singapore gateway — signing in again changes nothing. Use a CN or Singapore account (or the Trae CN build) in this panel.",
			"row.diagUnsupportedRegion": "Unsupported region",
			"row.searchedTitle": "Paths checked",
			"row.searchedHint": "No sign-in was found. These locations were probed; if your Trae stores its login elsewhere, please report the path.",
			"row.searchedMore": "Show {count} more",
			"row.quarantineTitle": "Quarantined credential copies",
			"row.quarantineHint": "A credential copy could not be read, so the plugin did not overwrite it — it was renamed aside with its bytes intact. The accounts it held exist only in that file; delete it once you have them back.",
			"row.quarantineAccounts": "{count} account(s)",
			"row.quarantineAccountsUnknown": "account count unreadable",
			"row.quarantineBytes": "{bytes} bytes",
			"row.reasonMissing": "not found",
			"row.reasonUnreadable": "unreadable",
			"row.reasonInvalid": "unreadable format",
			"row.sourceDesktop": "desktop app",
			"row.sourceCli": "Trae CLI",
			"row.signedIn": "Signed in: {accountName}",
			"row.tokenExpiry": "Access token expires {expiresAt} (auto-renewal)",
			"row.refreshTokenExpiring": "Sign in to Trae again by {expiresAt} ({days} day(s) left) — automatic renewal stops after that.",
			"row.refreshTokenLapsed": "Automatic renewal has stopped: the Trae sign-in expired {expiresAt}. Sign in to Trae again to restore it.",
			"row.requestFailed": "Request failed",
			"row.creditsAvailableLabel": "Available",
			"row.workCreditsLabel": "Work credits",
			"row.generalCreditsLabel": "General credits",
			"row.workNotUsable": "Not usable in DSH",
			"row.generalUsable": "Usable",
			"row.workUsableHint": "Only inside the Trae app",
			"row.generalUsableHint": "Powers DSH chat & tools",
			"row.creditsConsumedLabel": "Consumed",
			"row.creditsTotalLabel": "Total",
			"row.creditsError": "Usage unavailable: {message}",
			"row.checkinReward": "{reward} credits per day",
			"row.checkinClaim": "Check in",
			"row.checkinClaimWith": "Check in +{reward}",
			"row.checkinClaiming": "Claiming…",
			"row.checkinClaimed": "Claimed",
			"row.checkinRefused": "Trae refused the check-in (code {code})",
			"row.checkinError": "Check-in failed: {message}",
			"row.checkinDeviceSpent": "This machine already used today's check-in — Trae allows one per device per day, so this account cannot claim here today. Claim it on another device or from the account that checked in, or come back tomorrow.",
			"row.checkinDisabled": "This account has no check-in activity available.",
			"row.checkinDeviceSpentShort": "Device used",
			"row.subscriptionLabel": "Subscription",
			"row.subscribed": "Active package",
			"row.noPackage": "No active package",
			"row.planTier": "{tier} plan",
			"row.trialUntil": "Trial until {date}",
			"row.payStatusError": "Subscription status unavailable: {message}",
			"row.payStatusUnknown": "Plan not loaded yet",
			"row.refresh": "Refresh",
			"row.refreshTokens": "Refresh accounts & tokens",
			"row.refreshCredits": "Refresh usage",
			"row.refreshing": "Refreshing…",
			"row.accountsTitle": "Trae account",
			"row.accountsHint": "Copies this plugin keeps of every Trae sign-in on this machine (mirrored on refresh). Refresh after signing in, or Trae's next sign-in overwrites that login. Tokens are never shown.",
			"row.transferTitle": "Import & export accounts",
			"row.transferExport": "Export selected",
			"row.transferImport": "Import from file",
			"row.transferCancel": "Cancel",
			"row.transferSelectAll": "Select all",
			"row.transferExportPick": "Choose which of the {total} account copies to export.",
			"row.transferExportConfirm": "Export {count}",
			"row.transferExported": "Exported {count} account copy/copies to {fileName}.",
			"row.transferExporting": "Preparing the export…",
			"row.transferImportPick": "This file holds {total} record(s). Ticked records are added as plugin-owned copies; the Trae app is not touched.",
			"row.transferImportConfirm": "Import {count}",
			"row.transferImported": "Imported {imported} account copy/copies, skipped {skipped}.",
			"row.transferImporting": "Importing…",
			"row.transferReading": "Reading the file…",
			"row.transferHint": "The exported file holds this plugin's own copies, including live tokens — treat it as a password. Records belonging to the other region are skipped.",
			"row.transferError": "Import/export failed: {message}",
			"row.transferVeilHint": "The account list refreshes when this finishes.",
			"row.transferUnnamed": "Unnamed account",
			"row.transferNoToken": "no token, will be skipped",
			"row.accountsRescan": "Detect accounts again",
			"row.accountsScanning": "Detecting…",
			"row.accountsLoading": "Loading your accounts…",
			"row.accountsNone": "This region reports no usable account.",
			"row.accountCurrentBadge": "in use",
			"row.accountSwitch": "Switch",
			"row.accountSwitching": "Switching…",
			"row.accountColumnAccount": "Account",
			"row.accountColumnValue": "Balance",
			"row.accountColumnCheckin": "Check-in",
			"row.accountBalance": "{credits} credits",
			"row.balanceConsoleOnly": "In the enterprise console",
			"row.enterpriseCreditsNotice": "Enterprise spend is not reported here. The Trae client cannot read the tenant balance — every enterprise quota endpoint answers 404 — so the only place to see it is the enterprise console (console.enterprise.trae.cn). The personal credit figure is deliberately NOT shown on this tab: it belongs to the consumer pool and would be misread as the tenant balance.",
			"row.sourceDsh": "plugin copy",
			"row.modelsTitle": "Models",
			"row.modelsSummary": "{count} enabled",
			"row.modelsRefresh": "Refresh from Trae",
			"row.modelsRefreshing": "Refreshing models…",
			"row.modelsSearch": "Search models",
			"row.modelsSearchPlaceholder": "Search by name or config name",
			"row.modelsSearchCount": "{shown} of {total}",
			"row.modelsSearchEmpty": "No model matches 「{query}」.",
			"row.modelsGroupCount": "{count}",
			"row.modelsViewLabel": "Model scope",
			"row.modelsViewCommon": "Common channels · {count}",
			"row.modelsViewAll": "All · {count}",
			"row.modelsViewCommonHint": "Models a normal SOLO workspace chat can call (solo_work_remote / solo_work_lite).",
			"row.modelsViewAllHint": "Also includes models only offered by a specialist channel: solo_coder, chat_v3, solo_agent_remote.",
			"row.modelsViewShowAll": "Show all",
			"row.modelsSearchOutsideView": "No match for 「{query}」 on the common channels; the full catalog has {count}.",
			"row.modelsEnabledOutsideView": "{count} enabled model(s) are not in this view.",
			"row.modelsChannelWorkRemote": "SOLO workspace · remote",
			"row.modelsChannelWorkLite": "SOLO workspace · default",
			"row.modelsChannelAgentRemote": "SOLO agent · remote",
			"row.modelsChannelChatV3": "Chat · v3",
			"row.modelsChannelCoder": "Code · solo_coder",
			"row.modelsChannelDefault": "No mode announced (calls solo_work_lite)",
			"row.modelsTestEnabled": "Test enabled models",
			"row.modelsTestAll": "Test all models",
			"row.modelsTesting": "Testing {done}/{total}…",
			"row.modelsTestHint": "Sends one minimal message per enabled model to see which ones actually answer. Costs a small amount of quota.",
			"row.modelsTestAllHint": "The「test all」button probes every model in the catalog, enabled or not, so it spends noticeably more quota than the enabled-only run.",
			"row.showPointsInMainUi": "Show credits in the composer row",
			"row.showPointsInMainUiHint": "A clickable readout in the composer tool row while a model from this plugin is selected: Trae CN · <balance> on the CN side, Trae Global · <plan> on the international one.",
			"row.drawImage": "Let the model draw images (trae_draw_image)",
			"row.drawImageHint": "Adds a trae_draw_image tool to this panel: the model can generate one image when you ask for one, at this account's real credit cost (measured ~8.8 for 1920x1920 on Trae CN). Off by default — while this is unticked the tool does not exist, so the model cannot spend credits on its own.",
			"row.drawImageHintEnterprise": "Not available on the enterprise panel: that path bills through the tenant gateway and has not been verified.",
			"row.drawImageHintAi": "Not available on the international panel: image generation has only been measured on Trae CN, and this path bills on a different plan, so the credit figures shown here would be wrong. Switch to the CN panel to use it.",
			"row.showPointsInMainUiHintAi": "A clickable readout in the composer tool row while a model from this plugin is selected: Trae Global · <plan>.",
			"row.creditPositionLabel": "position",
			"row.creditPositionComposer": "composer toolbar",
			"row.creditPositionStats": "below the input box",
			"row.creditPositionAria": "Credit readout position for {region}",
			"row.creditPositionHint": "Where the credit readout sits. \"composer toolbar\" is the default (the row with the model picker). Choose \"below the input box\" — the row carrying the round / step / token statistics — if another plugin occupies the composer toolbar and the readout does not appear.",
			"composer.switchTo": "Switch to {account}",
			"composer.noAccounts": "No account in this region",
			"composer.panelTitle": "Trae credits",
			"composer.panelTitleGlobal": "Trae Global plan",
			"composer.account": "Account",
			"composer.generalCredits": "General credits",
			"composer.plan": "Plan",
			"composer.lastRefresh": "Last refreshed",
			"composer.signedOut": "Not signed in",
			"composer.points": "Trae CN",
			"composer.pointsGlobal": "Trae Global",
			"composer.refresh": "Refresh credits",
			"composer.refreshing": "Refreshing credits…",
			"composer.refreshFailed": "Could not refresh credits",
			"row.accountsRefreshed": "Accounts refreshed: {count} found{selected}",
			"row.accountsSaved": "bound to",
			"row.accountsKept": "still bound to",
			"row.accountsRefreshedNone": "Accounts refreshed: no usable Trae account found",
			"row.accountsRescanFailed": "Could not refresh accounts: {message}",
			"row.editionCn": "Trae",
			"row.editionSg": "Trae (international)",
			"row.editionSolo": "TRAE SOLO",
			"row.editionSoloSg": "TRAE SOLO (international)",
			"row.creditsExhausted": "The bound account ({account}) has run out of credit",
			"row.creditsAlternative": "Another account on this machine still has credit: {accounts}",
			"row.creditsAlternativeSwitch": "Switch to it",
			"row.expiryWarningSoon": "{total} credit lapses within 24 hours ({packs} packs)",
			"row.expiryWarningDays": "{total} credit lapses within 3 days ({packs} packs)",
			"row.expiryWarningWeek": "{total} credit lapses within 7 days ({packs} packs)",
			"row.expiryWarningLapsed": "{total} credit has already lapsed but is still counted in the balance ({packs} packs)",
			"row.expiryEarliest": "Earliest: {time}",
			"row.settingsDirty": "Unsaved changes",
			"row.modelsTestEmpty": "Enable at least one model first.",
			"row.contextAllMid": "Switch all to 500K",
			"row.contextAllMidHint": "Sets the DSH context budget of every model in this region whose Max window is at least 500K to the 500K middle step, leaving the rest alone. Half-way between the default window and Max — for when 1M is more than you need. Still a draft — press Save to apply.",
			"row.contextAllMax": "Switch all to Max",
			"row.contextAllMaxHint": "Sets the DSH context budget of every model in this region that has a Max window to its Max window at once. Still a draft — press Save to apply. Models without a Max window are left alone.",
			"row.contextAllDefault": "Restore default context",
			"row.contextAllDefaultHint": "Clears every context-budget override in this region, so all models go back to Trae's default window. Still a draft — press Save to apply.",
			"row.modelsTestError": "Test failed: {message}",
			"row.modelsTestDone": "{available} of {total} answered.",
			"row.probeAvailable": "works",
			"row.probeGated": "needs a higher plan",
			"row.probeUnsupported": "not served",
			"row.probeRateLimited": "throttled",
			"row.probeAuth": "sign-in rejected",
			"row.probeUnknown": "not determined",
			"row.promoLimited": "Limited {percent}% off",
			"row.promoSubsidy": "{percent}% off",
			"row.promoOffPeak": "Off-peak {percent}% off",
			"row.promoHintRate": "was {before} credits/Mtoken, now {rate}",
			"row.promoHintWindow": "off-peak hours {from}–{until} ({zone})",
			"row.promoHintMember": "subscription price is {rate} credits/Mtoken ({percent}% off)",
			"row.modelEnabled": "Enabled",
			"row.discard": "Discard changes",
			"row.save": "Save",
			"row.saving": "Saving…",
			"row.veilSaving": "Saving changes…",
			"row.modelContext": "Max context {context}",
			"row.contextBudget": "DSH context budget",
			"row.contextBudgetHint": "Affects the DSH-side context budget only. The plugin does not send a window or Max-mode field upstream, so this does not change the window Trae serves the request with.",
			"row.modelOutput": "Output {output}",
			"row.modelImage": "Image",
			"row.modelImageAuto": "Enabled automatically: Trae marks this model multimodal.",
			"row.modelRate": "{rate}x credits",
			"row.modelReasoning": "Reasoning: {efforts}",
			"row.modelReasoningSupported": "Reasoning: supported",
			"row.modelUnknown": "Unknown",
			"row.modelCapabilityPending": "Image input follows Trae's own multimodal flag, plus anything you tick yourself.",
			"row.poolTitle": "Account pool",
			"row.poolEnabled": "Enable the account pool",
			"row.poolEnabledHint": "The pool picks the account to bill for this panel's requests, ranking by credits and availability. Off means the manually bound account serves.",
			"row.poolCurrentHeader": "Billing now: {account}",
			"row.poolModeAuto": "pool picks",
			"row.poolModeManual": "you pick",
			"row.poolMember": "in pool",
			"row.poolNotMember": "not in pool",
			"row.poolBusyHint": "Working through accounts one at a time…",
			"row.poolTestAll": "Test all accounts",
			"row.poolTesting": "Testing…",
			"row.poolOffNotice": "The pool is off — the bound account is what serves. Turn the switch below on to let the pool decide.",
			"row.poolNoCandidate": "No usable pool member can serve this panel right now.",
			"row.poolNoCandidateEmpty": "No pool members are selected yet.",
			"row.poolNoCandidateEmptyHint": "Tick accounts in the membership list to bring them into the pool.",
			"row.poolNoCandidateUnusable": "Every selected member is unavailable right now.",
			"row.poolNoCandidateHint": "Traffic keeps landing on the saved selection until one recovers.",
			"row.poolServingOutside": "{account} is billing right now but is not in the pool — until a member becomes available, requests fall back to the saved selection.",
			"row.poolMembersTitle": "Accounts in this pool",
			"row.poolRescan": "Re-detect accounts",
			"row.poolToolsLabel": "Export / import accounts",
			"row.poolCreditExpiry": "expires {when}",
			"row.poolProbeMeasured": "measured {when}",
			"row.poolProbeAt": "tested {when}",
			"row.poolSettingsNote": "Preferences below take effect when you save; test results are written by the plugin and are not affected by that button.",
			"row.poolSelectedCount": "Selected {count} / {total}",
			"row.poolNoCopyTag": "no copy here",
			"row.poolCopyFile": "Copies live in {path} — {count} right now. Switching accounts in Trae adds a copy; it never overwrites an existing one.",
			"row.poolNoCopyTestHint": "This machine holds no sign-in for this account, so it cannot be tested. Sign in to Trae with it again to recreate a copy, or delete the row.",
			"row.poolSelectAll": "All",
			"row.poolSelectNone": "None",
			"row.poolColumnAccount": "Account",
			"row.poolColumnCredits": "Credits",
			"row.poolColumnProbe": "Status",
			"row.poolColumnCheckin": "Check-in",
			"row.poolGeneralLabel": "General",
			"row.poolWorkHint": "Work credits are not spendable by DSH — only General powers chat.",
			"row.poolCreditNone": "—",
			"row.poolTestedAt": "tested {at}",
			"row.poolNeverTested": "not tested yet",
			"row.poolRetryAt": "retry {at}",
			"row.poolRetryUnknown": "retry time unknown",
			"row.poolTargetCurrentPreferred": "Current: your choice {model}",
			"row.poolTargetCurrentFree": "Current: free model {model}",
			"row.poolTargetStale": "Model {model} is no longer offered by this panel",
			"row.poolTargetStaleOption": "{model} (no longer offered)",
			"row.poolTargetStaleClear": "Back to automatic",
			"row.poolTargetNone": "No free model available for this panel",
			"row.poolTargetNoneHint": "The pool can only pick a free model; none resolves right now, so tests are disabled.",
			"row.poolActionNoteTestNone": "No free model resolves in this panel — pick a target model before testing.",
			"row.poolActionNoteNoMembers": "Tick the accounts you want in the pool and save first.",
			"row.poolTargetAutoOption": "Automatic (free model)",
			"row.poolTargetLabel": "Target test model",
			"row.poolTargetHint": "The model a probe test uses.",
			"row.poolProbeSizeLabel": "Probe request size",
			"row.poolProbeSizeHint": "How much text a test sends. A one-word probe only proves the account can answer a one-word request — if the upstream refuses long turns, this is where you find out. Bigger is closer to a real conversation, and costs more credit on every account in the batch.",
			"row.poolProbeSizeDefault": "Minimal (default)",
			"row.poolProbeSizeOption": "{wan}0k tokens",
			"row.poolSettingsTitle": "More settings",
			"row.poolMoreRulesTitle": "Account copies & saving rules",
			"row.poolManualAccountLabel": "Manually billed account",
			"row.poolManualAccountNone": "No account in effect",
			"row.poolDirty": "unsaved",
			"row.poolSaved": "Save",
			"row.poolSaving": "Saving…",
			"row.poolDiscard": "Discard",
			"row.poolSaveFailed": "Save failed: {message}",
			"row.poolGhostMembers": "{count} saved member(s) no longer resolve to a local sign-in: {names}",
			"row.poolUnsavedMembers": "Unsaved membership changes — Save below to apply.",
			"row.poolRowTest": "Test",
			"row.poolLogTitle": "Activity",
			"row.poolLogClear": "Clear",
			"row.poolLogEmpty": "No pool activity yet.",
			"row.poolLogTestStart": "Test started for {count} account(s) against {model}.",
			"row.poolLogTestRow": "{accountName}: {outcome}.",
			"row.poolLogTestRowMalformed": "{accountName}: malformed result.",
			"row.poolLogTestDone": "Test finished.",
			"row.poolLogBatchFailed": "Pool action failed: {message}",
			"row.poolLogTimeout": "The test did not answer in time — it was cancelled, so the button works again. Check the network and retry: {message}",
			"row.poolSelectAria": "Include {accountName} in the pool",
			"row.poolCheckedIn": "Checked in",
			"row.poolNotCheckedIn": "Not checked in",
			"row.poolCheckinUnknown": "Unknown",
			"row.poolDeviceUsed": "device used",
			"row.poolTestingPerRow": "testing…",
			"row.poolProbeOk": "works",
			"row.poolProbeRateLimited": "rate limited",
			"row.poolProbeModelBusy": "model busy",
			"row.poolProbeOutOfCredit": "out of credit",
			"row.poolProbeCredentialRejected": "sign-in rejected",
			"row.poolProbePolicyRejected": "policy rejected",
			"row.poolProbePlanGated": "needs a higher plan",
			"row.poolProbeUnavailable": "unavailable",
			"row.poolProbeNotFound": "not served",
			"row.poolProbeFailed": "failed",
			"row.poolProbeSourceUnknown": "reason unknown",
			"row.poolProbeSourceLive": "from a live request",
			"row.poolProbeSourceTest": "from a test",
			"row.poolProbeModel": "model {model}",
			"row.poolProbeModelUnknown": "model unknown",
			"row.poolExcludedUnusable": "unusable",
			"row.poolTokenExpired": "sign-in expired",
			"row.poolExcludedRateLimited": "rate limited",
			"row.poolExcludedModelBusy": "model busy",
			"row.poolExcludedOutOfCredit": "out of credit",
			"row.poolExcludedCredentialRejected": "sign-in rejected",
			"row.poolExcludedPolicyRejected": "policy rejected",
			"row.poolExcludedPlanGated": "needs a higher plan",
			"row.poolExcludedNotFound": "not served",
			"row.poolExcludedUnavailable": "unavailable",
			"row.poolExcludedFailed": "failed",
			"row.poolAgoNow": "just now",
			"row.poolAgoMin": "{n} min ago",
			"row.poolAgoHour": "{n} h ago",
			"row.poolAgoDay": "{n} d ago",
			"row.poolErrOrigin": "the page is not the plugin's own page, so the request was refused",
			"row.poolErrUnavailable": "the pool is unavailable right now",
			"row.poolErrMethod": "the pool does not accept that request method",
			"row.poolErrBadRequest": "the pool refused the request",
			"row.poolErrNoMembers": "the pool has no members to act on",
			"row.poolErrNoLiveMembers": "every member is unavailable — nothing can serve",
			"row.poolErrCheckinUnsupported": "this panel does not offer a daily check-in",
			"row.poolErrTargetStale": "the saved target model is no longer offered",
			"row.poolErrNoFreeModel": "no free model is available for this panel",
			"row.poolErrConflict": "the pool refused the request",
			"row.poolErrGeneric": "pool request failed (HTTP {status})",
			"row.poolSettingsHint": "The switch and the target model are preferences — save them. Test, check in and delete act at once.",
			"row.poolLogSaved": "Pool settings saved.",
			"row.poolLogSaveFailed": "Could not save the pool settings.",
			"row.poolLogNoMembers": "Nothing to do — no pool members are selected.",
			"row.poolLogDiscarded": "Discarded the unsaved pool changes.",
			"row.poolLogGeneric": "the pool answered nothing usable",
			"row.poolLogRowTesting": "Testing {accountName}…",
			"row.poolLogTargetCleared": "Returned the test target to automatic.",
			"row.poolRowDelete": "Delete",
			"row.poolRowDeleteAria": "Delete {accountName} from this machine: the plugin's copy and its Trae app login (this will sign it out of Trae)",
			"row.poolRowDeleting": "Deleting…",
			"row.poolGhostDeleteAria": "Delete the saved but unreachable account {accountName} from this machine",
			"row.poolRowDeleteError": "Could not delete {accountName}: {message}",
			"row.poolRowDeleteFailed": "the deletion was not confirmed",
			"row.poolRowDeleted": "Deleted the credential copy of {accountName}.",
			"row.poolDeleteStillSigned": "Deleted this plugin's copy of {accountName}, but it is still signed in to Trae, so the account itself is not gone. Sign out inside Trae to remove it from this machine.",
			"row.poolRowDeletedSignedOut": "Deleted {accountName} and signed it out of {apps}.",
			"row.poolRowDeleteAppRunning": "Could not delete {accountName}: {apps} is running and would restore the login. Quit {apps} completely, then delete again.",
			"row.poolDeleteAppRunning": "Nothing was changed: {apps} is running, and it would write the login back over the file on exit. Quit {apps} completely, then delete again.",
			"row.poolDeleteNoCopy": "There was no plugin copy of {accountName} left to delete — it only exists as a Trae app login, and that sign-out did not take effect.",
			"row.poolRowDeleteStillSigned": "removed this copy, but {accountName} is still signed in to Trae",
			"row.poolRowDeleteNoCopy": "{accountName} had no plugin copy — only its Trae app login",
			"row.poolDeleteHint": "The plugin keeps its own copy of every local Trae login (a copy is created on refresh unless one already exists) and only ever shows and bills those copies. Delete removes the copy AND signs that account out of Trae itself, leaving a backup of every file it rewrites; a deleted account is not re-imported while it stays signed in Trae. A running Trae would flush its own state back over the file, so quit it first — the card names the app it needs closed.",
			"row.cheer": "Star on GitHub"
		};
		const zh = {
			"row.title": "接入使用Trae积分与模型（dsh-connect-trae）",
			"row.desc": "在 DSH 中使用 Trae 模型并随时查看剩余积分；国内版与国际版是两个独立供应商，各有自己的账号，可同时使用。",
			"row.expand": "展开",
			"row.collapse": "收起",
			"row.tabCn": "国内版",
			"row.tabEnterprise": "企业版",
			"row.tabAi": "国际版",
			"row.tabHint": "国内版、企业版、国际版各有账号、用量与模型，可同时启用。企业版与国内版共用同一份 Trae CN 登录。",
			"row.tabEnterpriseHint": "企业版用同一个 Trae CN 账号走企业租户池计费，而不是个人积分池。它不会回落：被拒时如实报错，绝不悄悄花掉个人额度。",
			"row.tabSwitchHint": "关闭该供应商：其模型不再提供给 DSH；账号与设置保留，可随时恢复。",
			"row.tabSwitchAria": "是否向 DSH 提供{region}供应商",
			"row.tabOffNotice": "该供应商已关闭，模型不会提供给 DSH。账号与设置均已保留。",
			"row.panelAria": "卡片分栏",
			"row.panelAccounts": "账号",
			"row.panelModels": "模型",
			"row.panelDiag": "诊断",
			"row.diagRegion": "面板",
			"row.diagProvider": "供应商 id",
			"row.diagAccount": "服务账号",
			"row.diagToken": "访问令牌到期",
			"row.diagRefresh": "重新登录最后期限",
			"row.diagRefreshNone": "该凭据不携带",
			"row.diagCatalog": "目录模型数",
			"row.diagEnabled": "已启用模型数",
			"row.diagPool": "账号池",
			"row.diagPoolOn": "已开启 · {count} 个账号",
			"row.diagPoolOff": "未开启",
			"row.diagCheckin": "每日签到",
			"row.diagCheckinOn": "支持",
			"row.diagCheckinOff": "本面板不提供",
			"row.diagRaw": "Raw 会话通道",
			"row.diagRawOff": "未检测",
			"row.diagFailures": "最近一次报错",
			"row.diagNoFailures": "无",
			"row.diagQuarantine": "损坏副本留存",
			"row.diagQuarantineNone": "无",
			"row.diagHint": "以上全部只读，可整段原样贴进反馈。数值来自本面板最近一次刷新，不是概括。",
			"row.settingsWriteFailed": "设置未能保存：{message}",
			"row.signedOut": "未登录",
			"row.signedOutHint": "在 Trae 桌面 App 里登录一次即可，插件会自动跟随当前登录的账号。",
			"row.unsupportedRegionTitle": "美国区（US）暂不支持",
			"row.unsupportedRegionHint": "本机有一个 Trae 账号属于美国区（userRegion \"US\" / 主机 *.traeapi.us）。本版本尚未支持该区，因此不会使用这个账号，也不会把请求发往新加坡网关——重新登录不会有任何变化。请在该面板改用国内版或新加坡区账号（或使用 Trae 国内版客户端）。",
			"row.diagUnsupportedRegion": "未支持的区域",
			"row.searchedTitle": "已检查的路径",
			"row.searchedHint": "未找到登录信息。以下是插件探测过的位置；如果你的 Trae 把登录信息存在别处，请把该路径反馈给我们。",
			"row.searchedMore": "展开其余 {count} 条",
			"row.quarantineTitle": "被隔离的账号副本",
			"row.quarantineHint": "有一份账号副本文件读不出来，插件没有覆盖它，而是改名留存（字节完整）。它曾经保存的账号只可能在那份文件里；确认已取回后删掉它即可不再提示。",
			"row.quarantineAccounts": "含 {count} 个账号",
			"row.quarantineAccountsUnknown": "账号数无法读取",
			"row.quarantineBytes": "{bytes} 字节",
			"row.reasonMissing": "文件不存在",
			"row.reasonUnreadable": "无法读取",
			"row.reasonInvalid": "格式无法识别",
			"row.sourceDesktop": "桌面版",
			"row.sourceCli": "Trae CLI",
			"row.signedIn": "已登录：{accountName}",
			"row.tokenExpiry": "访问令牌 {expiresAt} 过期（自动续期）",
			"row.refreshTokenExpiring": "请在 {expiresAt} 前重新登录一次 Trae（还剩 {days} 天），此后将无法自动续期。",
			"row.refreshTokenLapsed": "自动续期已停止：Trae 登录凭据已于 {expiresAt} 过期。请重新登录一次 Trae 以恢复。",
			"row.requestFailed": "请求失败",
			"row.creditsAvailableLabel": "可用",
			"row.workCreditsLabel": "Work 积分",
			"row.generalCreditsLabel": "通用积分",
			"row.workNotUsable": "DSH 不可用",
			"row.generalUsable": "可用",
			"row.workUsableHint": "仅限 Trae 客户端内使用",
			"row.generalUsableHint": "供 DSH 聊天与工具使用",
			"row.creditsConsumedLabel": "消耗",
			"row.creditsTotalLabel": "合计",
			"row.creditsError": "用量查询失败：{message}",
			"row.checkinReward": "每日 {reward} 积分",
			"row.checkinClaim": "签到",
			"row.checkinClaimWith": "签到 +{reward}",
			"row.checkinClaiming": "领取中…",
			"row.checkinClaimed": "已领取",
			"row.checkinRefused": "Trae 拒绝了本次签到（业务码 {code}）",
			"row.checkinError": "签到失败：{message}",
			"row.checkinDeviceSpent": "本机今日的签到已用掉——Trae 按「每台设备每天一次」限制，所以当前账号在本机今天无法再签。可换一台设备领取，或用今天已签到的那台设备/账号，或明天再来。",
			"row.checkinDisabled": "该账号当前没有可用的签到活动。",
			"row.checkinDeviceSpentShort": "本机已签",
			"row.subscriptionLabel": "订阅状态",
			"row.subscribed": "已有套餐",
			"row.noPackage": "无套餐",
			"row.planTier": "{tier} 套餐",
			"row.trialUntil": "试用至 {date}",
			"row.payStatusError": "订阅状态查询失败：{message}",
			"row.payStatusUnknown": "套餐尚未读到",
			"row.refresh": "刷新",
			"row.refreshTokens": "刷新账号与 Token",
			"row.refreshCredits": "刷新用量",
			"row.refreshing": "正在刷新…",
			"row.accountsTitle": "Trae 账号",
			"row.accountsHint": "本插件保管的账号副本：本机每个 Trae 登录都会在刷新时补建一份副本。登录新号后要刷新一次，否则它会被 Trae 的下一次登录覆盖。Token 不会显示。",
			"row.transferTitle": "导入 / 导出账号",
			"row.transferExport": "导出所选",
			"row.transferImport": "从文件导入",
			"row.transferCancel": "取消",
			"row.transferSelectAll": "全选",
			"row.transferExportPick": "从这 {total} 个账号副本中选择要导出的。",
			"row.transferExportConfirm": "导出 {count} 个",
			"row.transferExported": "已导出 {count} 个账号副本到 {fileName}。",
			"row.transferExporting": "正在准备导出…",
			"row.transferImportPick": "该文件包含 {total} 条记录；勾选的会作为插件副本导入，不会写入 Trae 应用。",
			"row.transferImportConfirm": "导入 {count} 个",
			"row.transferImported": "已导入 {imported} 个账号副本，跳过 {skipped} 个。",
			"row.transferImporting": "正在导入…",
			"row.transferReading": "正在读取文件…",
			"row.transferHint": "导出的文件里是插件保管的账号副本（含有效 Token），请当作密码保管。属于另一区域的记录会被跳过。",
			"row.transferError": "导入/导出失败：{message}",
			"row.transferVeilHint": "完成后账号列表会自动刷新。",
			"row.transferUnnamed": "未命名账号",
			"row.transferNoToken": "无 Token，将被跳过",
			"row.accountsRescan": "重新检测账号",
			"row.accountsScanning": "正在检测…",
			"row.accountsLoading": "正在加载账号…",
			"row.accountsNone": "该区域没有可列出的账号。",
			"row.accountCurrentBadge": "当前使用",
			"row.accountSwitch": "切换",
			"row.accountSwitching": "切换中…",
			"row.accountColumnAccount": "账号",
			"row.accountColumnValue": "额度",
			"row.accountColumnCheckin": "签到",
			"row.accountBalance": "积分 {credits}",
			"row.balanceConsoleOnly": "见企业版控制台",
			"row.enterpriseCreditsNotice": "企业版额度不在这里显示。Trae 客户端读不到企业租户的余额（所有企业额度接口都返回 404），只能到企业版控制台（console.enterprise.trae.cn）查看。这里也刻意不显示个人积分：那是消费池的数字，放在企业版标签下会被误认为企业额度。",
			"row.sourceDsh": "插件副本",
			"row.modelsTitle": "模型",
			"row.modelsSummary": "已启用 {count} 个",
			"row.modelsRefresh": "从 Trae 刷新",
			"row.modelsRefreshing": "正在刷新模型…",
			"row.modelsSearch": "搜索模型",
			"row.modelsSearchPlaceholder": "按模型名或 config_name 搜索",
			"row.modelsSearchCount": "{shown} / {total}",
			"row.modelsSearchEmpty": "没有匹配「{query}」的模型。",
			"row.modelsGroupCount": "{count} 个",
			"row.modelsViewLabel": "模型范围",
			"row.modelsViewCommon": "常用通道 · {count}",
			"row.modelsViewAll": "全部 · {count}",
			"row.modelsViewCommonHint": "普通 SOLO 工作区对话能调到的模型（solo_work_remote / solo_work_lite）。",
			"row.modelsViewAllHint": "还包含只在专用通道提供的模型：solo_coder、chat_v3、solo_agent_remote。",
			"row.modelsViewShowAll": "查看全部",
			"row.modelsSearchOutsideView": "常用通道内没有匹配「{query}」的模型，全部目录里有 {count} 个。",
			"row.modelsEnabledOutsideView": "另有 {count} 个已启用的模型不在此视图内。",
			"row.modelsChannelWorkRemote": "SOLO 工作区 · 远程",
			"row.modelsChannelWorkLite": "SOLO 工作区 · 默认",
			"row.modelsChannelAgentRemote": "SOLO 智能体 · 远程",
			"row.modelsChannelChatV3": "对话 · v3",
			"row.modelsChannelCoder": "代码 · solo_coder",
			"row.modelsChannelDefault": "未标注模式（走 solo_work_lite）",
			"row.modelsTestEnabled": "一键测试启用模型",
			"row.modelsTestAll": "一键测试所有模型",
			"row.modelsTesting": "正在测试 {done}/{total}…",
			"row.modelsTestHint": "给每个已启用模型发一条最小消息，看哪些真的能应答。会消耗少量额度。",
			"row.modelsTestAllHint": "「测试所有模型」会遍历目录里的每一个模型（含未启用的），消耗的额度明显多于「仅测试启用」。",
			"row.showPointsInMainUi": "在输入框工具栏显示积分读数",
			"row.showPointsInMainUiHint": "在输入框工具栏显示可点击读数（选中本插件模型时出现）：国内版为「Trae CN · 余额」，国际版为「Trae 国际版 · 套餐」。",
			"row.showPointsInMainUiHintAi": "在输入框工具栏显示可点击读数（选中本插件模型时出现）：国际版为「Trae 国际版 · 套餐」。",
			"row.drawImage": "允许模型自主生图（trae_draw_image）",
			"row.drawImageHint": "为本面板挂上 trae_draw_image 工具：你要求时模型能生成一张图，按本账号真实扣积分（国内版实测 1920x1920 约 8.8）。默认关闭——不勾选时工具根本不存在，模型无法自己花额度。",
			"row.drawImageHintEnterprise": "企业面板不提供：那条路径走租户网关计费，未经验证。",
			"row.drawImageHintAi": "国际版面板不提供：生图只在 Trae CN 实测过，国际版按另一套套餐计费，这里标注的积分价格会对不上。要用请切到国内版面板。",
			"row.creditPositionLabel": "显示位置",
			"row.creditPositionComposer": "输入框工具栏",
			"row.creditPositionStats": "输入框下方",
			"row.creditPositionAria": "{region} 的积分显示位置",
			"row.creditPositionHint": "积分显示在哪里。「输入框工具栏」是默认位置（与模型选择同一行）。如果装了别的插件后读数不显示，改成「输入框下方」—— 那是「轮次 / 步数 / token」统计所在的那一行。",
			"composer.switchTo": "切换到 {account}",
			"composer.noAccounts": "该区域暂无账号",
			"composer.panelTitle": "Trae 积分",
			"composer.panelTitleGlobal": "Trae 国际版套餐",
			"composer.account": "账号",
			"composer.generalCredits": "通用积分",
			"composer.plan": "套餐",
			"composer.lastRefresh": "最近刷新",
			"composer.signedOut": "未登录",
			"composer.points": "Trae CN",
			"composer.pointsGlobal": "Trae 国际版",
			"composer.refresh": "刷新积分",
			"composer.refreshing": "正在刷新积分…",
			"composer.refreshFailed": "积分刷新失败",
			"row.accountsRefreshed": "已刷新账号：找到 {count} 个账号{selected}",
			"row.accountsSaved": "已绑定",
			"row.accountsKept": "仍绑定",
			"row.accountsRefreshedNone": "已刷新账号：未找到可用的 Trae 账号",
			"row.accountsRescanFailed": "刷新账号失败：{message}",
			"row.editionCn": "Trae",
			"row.editionSg": "Trae 国际版",
			"row.editionSolo": "TRAE SOLO",
			"row.editionSoloSg": "TRAE SOLO 国际版",
			"row.creditsExhausted": "当前绑定账号（{account}）额度已用尽",
			"row.creditsAlternative": "本机还有可用账号：{accounts}",
			"row.creditsAlternativeSwitch": "切换到它",
			"row.expiryWarningSoon": "有 {total} 积分将在 24 小时内过期（{packs} 个套餐）",
			"row.expiryWarningDays": "有 {total} 积分将在 3 天内过期（{packs} 个套餐）",
			"row.expiryWarningWeek": "有 {total} 积分将在 7 天内过期（{packs} 个套餐）",
			"row.expiryWarningLapsed": "有 {total} 积分已过期但仍计入余额（{packs} 个套餐）",
			"row.expiryEarliest": "最早到期：{time}",
			"row.settingsDirty": "有未保存的修改",
			"row.modelsTestEmpty": "请先启用至少一个模型。",
			"row.contextAllMid": "整区切到 500K",
			"row.contextAllMidHint": "把本区所有 Max 档不小于 500K 的模型的 DSH 上下文预算一次性设为 500K 中间档，其余模型不动。这是默认窗口与 Max 之间的半步——觉得 1M 用不上、又嫌默认太小时用。这只是草稿——要按「保存」才生效。",
			"row.contextAllMax": "整区切到 Max",
			"row.contextAllMaxHint": "把本区所有带 Max 档的模型的 DSH 上下文预算一次性设为各自的 Max 档。这只是草稿——要按「保存」才生效。没有 Max 档的模型不会被改动。",
			"row.contextAllDefault": "全部恢复默认上下文",
			"row.contextAllDefaultHint": "清掉本区所有上下文预算覆盖，让每个模型都回到 Trae 的默认窗口。这只是草稿——要按「保存」才生效。",
			"row.modelsTestError": "测试失败：{message}",
			"row.modelsTestDone": "{total} 个里有 {available} 个正常应答。",
			"row.probeAvailable": "可用",
			"row.probeGated": "需要更高档位",
			"row.probeUnsupported": "上游不提供",
			"row.probeRateLimited": "被限流",
			"row.probeAuth": "登录凭据被拒",
			"row.probeUnknown": "本次未测出",
			"row.promoLimited": "限时 {zhe} 折",
			"row.promoSubsidy": "{zhe} 折",
			"row.promoOffPeak": "闲时 {zhe} 折",
			"row.promoHintRate": "原价 {before} 积分/百万 token，现价 {rate}",
			"row.promoHintWindow": "闲时时段 {from}–{until}（{zone}）",
			"row.promoHintMember": "会员价 {rate} 积分/百万 token（{zhe} 折）",
			"row.modelEnabled": "启用模型",
			"row.discard": "放弃修改",
			"row.save": "保存",
			"row.saving": "保存中…",
			"row.veilSaving": "正在保存更改…",
			"row.modelContext": "最大上下文 {context}",
			"row.contextBudget": "DSH 上下文预算",
			"row.contextBudgetHint": "只影响 DSH 侧的上下文预算。插件不会向上游发送窗口或 Max 模式字段，所以这不会改变 Trae 实际服务这次请求所用的窗口。",
			"row.modelOutput": "最大输出 {output}",
			"row.modelImage": "图片",
			"row.modelImageAuto": "已自动开启：Trae 把该模型标为多模态。",
			"row.modelRate": "积分 {rate}x",
			"row.modelReasoning": "推理强度：{efforts}",
			"row.modelReasoningSupported": "推理：支持",
			"row.modelUnknown": "未知",
			"row.modelCapabilityPending": "图片输入跟随 Trae 自身的多模态标注，并叠加你手动勾选的模型。",
			"row.poolTitle": "账号池",
			"row.poolEnabled": "启用账号池",
			"row.poolEnabledHint": "账号池按积分与可用性挑选本面板请求的计费账号；关闭时由手动绑定的账号计费。",
			"row.poolCurrentHeader": "当前计费：{account}",
			"row.poolModeAuto": "自动挑号",
			"row.poolModeManual": "手动选号",
			"row.poolMember": "已在池中",
			"row.poolNotMember": "未入池",
			"row.poolBusyHint": "逐个处理账号中…",
			"row.poolTestAll": "一键测试所有账号",
			"row.poolTesting": "测速中…",
			"row.poolOffNotice": "账号池已关闭——由绑定的账号计费。开启上方开关即可让账号池派单。",
			"row.poolNoCandidate": "当前没有可用的池成员能为本面板提供请求。",
			"row.poolNoCandidateEmpty": "尚未勾选任何池成员。",
			"row.poolNoCandidateEmptyHint": "在成员列表中勾选账号即可加入账号池。",
			"row.poolNoCandidateUnusable": "所有已选成员当前均不可用。",
			"row.poolNoCandidateHint": "请求会继续落在已保存的账号上，直到有成员恢复可用。",
			"row.poolServingOutside": "{account} 当前在计费，但它不在池中——在池里有可用成员之前，请求会落回你保存的选择。",
			"row.poolMembersTitle": "本池包含的账号",
			"row.poolRescan": "重新检测账号",
			"row.poolToolsLabel": "导出 / 导入账号",
			"row.poolCreditExpiry": "{when} 过期",
			"row.poolProbeMeasured": "测得 {when}",
			"row.poolProbeAt": "测试于 {when}",
			"row.poolSettingsNote": "下面是偏好设置：点保存才生效；测试结果由插件自动写入，不受这个保存按钮影响。",
			"row.poolSelectedCount": "已选 {count} / {total}",
			"row.poolNoCopyTag": "本机无副本",
			"row.poolCopyFile": "副本就存在 {path}，当前 {count} 份。在 Trae 里换号只会新增一份，不会覆盖已有的副本。",
			"row.poolNoCopyTestHint": "本机没有这个账号的登录，无法测速。需要它请在 Trae 里重新登录以重建副本，或删除这一行。",
			"row.poolSelectAll": "全部",
			"row.poolSelectNone": "清空",
			"row.poolColumnAccount": "账号",
			"row.poolColumnCredits": "积分",
			"row.poolColumnProbe": "状态",
			"row.poolColumnCheckin": "签到",
			"row.poolGeneralLabel": "通用",
			"row.poolWorkHint": "工作积分不能由 DSH 消费——只有通用积分用于对话。",
			"row.poolCreditNone": "—",
			"row.poolTestedAt": "测于 {at}",
			"row.poolNeverTested": "尚未测速",
			"row.poolRetryAt": "{at} 后重试",
			"row.poolRetryUnknown": "重试时间未知",
			"row.poolTargetCurrentPreferred": "当前：你选定的模型 {model}",
			"row.poolTargetCurrentFree": "当前：免费模型 {model}",
			"row.poolTargetStale": "模型 {model} 已不再由本面板提供",
			"row.poolTargetStaleOption": "{model}（已下架）",
			"row.poolTargetStaleClear": "改回自动",
			"row.poolTargetNone": "本面板暂无可用免费模型",
			"row.poolTargetNoneHint": "账号池只会挑免费模型；当前无法解析出可用模型，测速暂被禁用。",
			"row.poolActionNoteTestNone": "本面板没有解析出免费模型——先指定一个目标模型再测速。",
			"row.poolActionNoteNoMembers": "先勾选要入池的账号并保存。",
			"row.poolTargetAutoOption": "自动（免费模型）",
			"row.poolTargetLabel": "目标测速模型",
			"row.poolTargetHint": "探针测速所用的模型。",
			"row.poolProbeSizeLabel": "测试请求体积",
			"row.poolProbeSizeHint": "测试时发送多少文本。只发一个词的探针，只能证明「这个账号能回答一个词」——如果上游拒绝长请求，问题只会在你真实对话时才出现。填得越多越接近真实对话，每个账号每次测试消耗的积分也越多。",
			"row.poolProbeSizeDefault": "最小请求（默认）",
			"row.poolProbeSizeOption": "{wan} 万 token",
			"row.poolSettingsTitle": "更多设置",
			"row.poolMoreRulesTitle": "账号副本与保存规则",
			"row.poolManualAccountLabel": "手动计费账号",
			"row.poolManualAccountNone": "当前无生效账号",
			"row.poolDirty": "未保存",
			"row.poolSaved": "保存",
			"row.poolSaving": "保存中…",
			"row.poolDiscard": "放弃",
			"row.poolSaveFailed": "保存失败：{message}",
			"row.poolGhostMembers": "{count} 个已保存成员不再对应本机登录：{names}",
			"row.poolUnsavedMembers": "成员改动尚未保存——请点击下方保存。",
			"row.poolRowTest": "测速",
			"row.poolLogTitle": "活动记录",
			"row.poolLogClear": "清空",
			"row.poolLogEmpty": "暂无账号池活动。",
			"row.poolLogTestStart": "开始为 {count} 个账号测速（{model}）。",
			"row.poolLogTestRow": "{accountName}：{outcome}。",
			"row.poolLogTestRowMalformed": "{accountName}：结果异常。",
			"row.poolLogTestDone": "测速完成。",
			"row.poolLogBatchFailed": "账号池操作失败：{message}",
			"row.poolLogTimeout": "测速超时，已自动取消（按钮已恢复可用）。请检查网络后重试：{message}",
			"row.poolSelectAria": "把 {accountName} 加入账号池",
			"row.poolCheckedIn": "已签到",
			"row.poolNotCheckedIn": "未签到",
			"row.poolCheckinUnknown": "未知",
			"row.poolDeviceUsed": "本设备今日已用",
			"row.poolTestingPerRow": "测速中…",
			"row.poolProbeOk": "正常",
			"row.poolProbeRateLimited": "被限流",
			"row.poolProbeModelBusy": "模型繁忙",
			"row.poolProbeOutOfCredit": "积分不足",
			"row.poolProbeCredentialRejected": "登录凭据被拒",
			"row.poolProbePolicyRejected": "被策略拒绝",
			"row.poolProbePlanGated": "需要更高套餐",
			"row.poolProbeUnavailable": "不可用",
			"row.poolProbeNotFound": "上游不提供",
			"row.poolProbeFailed": "失败",
			"row.poolProbeSourceUnknown": "原因未知",
			"row.poolProbeSourceLive": "来自实时请求",
			"row.poolProbeSourceTest": "来自测速",
			"row.poolProbeModel": "模型 {model}",
			"row.poolProbeModelUnknown": "模型未知",
			"row.poolExcludedUnusable": "不可用",
			"row.poolTokenExpired": "登录已失效",
			"row.poolExcludedRateLimited": "被限流",
			"row.poolExcludedModelBusy": "模型繁忙",
			"row.poolExcludedOutOfCredit": "积分不足",
			"row.poolExcludedCredentialRejected": "登录凭据被拒",
			"row.poolExcludedPolicyRejected": "被策略拒绝",
			"row.poolExcludedPlanGated": "需要更高套餐",
			"row.poolExcludedNotFound": "上游不提供",
			"row.poolExcludedUnavailable": "不可用",
			"row.poolExcludedFailed": "失败",
			"row.poolAgoNow": "刚刚",
			"row.poolAgoMin": "{n} 分钟前",
			"row.poolAgoHour": "{n} 小时前",
			"row.poolAgoDay": "{n} 天前",
			"row.poolErrOrigin": "页面并非插件自身页面，请求因而不被接受",
			"row.poolErrUnavailable": "账号池当前不可用",
			"row.poolErrMethod": "账号池不接受该请求方法",
			"row.poolErrBadRequest": "账号池拒绝了该请求",
			"row.poolErrNoMembers": "账号池没有任何成员可处理",
			"row.poolErrNoLiveMembers": "所有成员均不可用——没有可派单的账号",
			"row.poolErrCheckinUnsupported": "本面板不提供每日签到",
			"row.poolErrTargetStale": "已保存的目标模型已下架",
			"row.poolErrNoFreeModel": "本面板没有可用的免费模型",
			"row.poolErrConflict": "账号池拒绝了该请求",
			"row.poolErrGeneric": "账号池请求失败（HTTP {status}）",
			"row.poolSettingsHint": "开关与目标模型是偏好，改完要保存；行内的测速、签到与删除立即生效。",
			"row.poolLogSaved": "账号池设置已保存。",
			"row.poolLogSaveFailed": "无法保存账号池设置。",
			"row.poolLogNoMembers": "没有可处理的内容——尚未勾选任何池成员。",
			"row.poolLogDiscarded": "已放弃未保存的账号池修改。",
			"row.poolLogGeneric": "账号池未返回可用的结果",
			"row.poolLogRowTesting": "正在测速 {accountName}…",
			"row.poolLogTargetCleared": "测速目标已改回自动。",
			"row.poolRowDelete": "删除",
			"row.poolRowDeleteAria": "从本机删除 {accountName}：插件的副本连同它在 Trae 应用里的登录（会把它从 Trae 退出登录）",
			"row.poolRowDeleting": "删除中…",
			"row.poolGhostDeleteAria": "从本机删除已保存但无法登录的账号 {accountName}",
			"row.poolRowDeleteError": "无法删除 {accountName}：{message}",
			"row.poolRowDeleteFailed": "删除未得到确认",
			"row.poolRowDeleted": "已删除 {accountName} 的凭据副本。",
			"row.poolDeleteStillSigned": "已删除本插件对 {accountName} 的副本，但它仍登录在 Trae 里，所以账号本身还在。要彻底从本机移除，请在 Trae 内退出登录。",
			"row.poolRowDeletedSignedOut": "已删除 {accountName}，并将它从 {apps} 中退出登录。",
			"row.poolRowDeleteAppRunning": "无法删除 {accountName}：{apps} 正在运行，退出时会把登录写回去。请先完全退出 {apps}，再重新删除。",
			"row.poolDeleteAppRunning": "这次没有改动任何文件：{apps} 正在运行，退出时会把自己的状态回写到文件、覆盖这次修改。请先完全退出 {apps}，再点「删除」。",
			"row.poolDeleteNoCopy": "{accountName} 本来就没有插件副本可删——它只存在于 Trae 应用登录里，而这次退出登录没有生效。",
			"row.poolRowDeleteStillSigned": "已删除副本，但 {accountName} 仍登录在 Trae 中",
			"row.poolRowDeleteNoCopy": "{accountName} 没有插件副本——它只存在于 Trae 应用登录里",
			"row.poolDeleteHint": "本插件会为本机每个 Trae 登录各创建一份自己的副本（刷新时自动创建，已有副本则不动），卡片只显示、也只使用这些副本。「删除」会同时删掉副本并把该账号从 Trae 应用中退出登录，改写的每个文件都留一份备份；只要该账号还登录在 Trae 里，就不会被重新收录。Trae 正在运行时会把自己的状态回写到文件，所以要先完全退出——卡片会点名是哪个应用。",
			"row.cheer": "鼓励一下"
		};
		//#endregion
		//#region src/client/TraeModelLabel.tsx
		/**
		* The HOST's model picker label: the catalog name, the upstream's activity
		* badge, and EXACTLY ONE multiplier.
		*
		* WHY A SLOT. The picker renders the model name as a plain string, so the only
		* thing a provider can put there is a character — and a character's colour is
		* the emoji font's business, not ours. The host therefore offers exactly one
		* seam for this: the `conversation.input.model.label` slot, whose contract is
		* "render non-interactive inline content such as a coloured name or badge"
		* while the picker keeps owning clicks, focus, check marks and the
		* accessibility text. The shipped example is the official DeepSeek "1017"
		* release badge — a coloured marker next to a model name — which is the same
		* job. (Ported from the sibling `dsh-connect-workbuddy` plugin, which solved
		* the same problem for the same host; the two must stay one presentation.)
		*
		* WHY THE BADGE BELONGS HERE AT ALL. The picker is where the choice is made,
		* and a time-boxed promotion is a choice criterion: "half price at night"
		* changes which row you click. The card already drew these badges, but the card
		* is the settings surface — by the time you read them there you have already
		* picked. This is the same upstream fact, moved to where it can still change a
		* decision.
		*
		* WHY ONE MULTIPLIER AND NOT TWO. `traeModelDisplayName` ALREADY ends the name
		* in the catalog multiplier (`Kimi-K2 · x0.55` — see `src/catalog.ts`), and the
		* host renders that string verbatim. Appending another rate here would print
		* `· x0.55 · x0.55`, which is precisely the defect the sibling plugin shipped
		* and had to fix (its #120 regression). The suffix is therefore pulled back OUT
		* of the name and re-drawn in the span that can carry the DISCOUNTED value, so
		* the row always shows exactly one number and it is the one that holds now.
		*
		* WHY A SEPARATE FETCH. The slot is rendered by the host, outside the plugin's
		* card, so it cannot read the card's React state (nor its injected `t`). It
		* asks the Host itself, over the SAME route the card polls
		* (`TRAE_USAGE_PATH`) — but with `detail=fast` (issue #77), the first-paint
		* document built from LOCAL state: the model roster, its `creditMultiplier` and
		* its unresolved `activityDiscount` are all known locally, so opening the
		* picker must not trigger an upstream read. The answer is cached briefly: a
		* picker that re-fetched on every re-render would be wasteful, and a level a few
		* seconds old is still true.
		*
		* WHY THE CLOCK IS RE-READ ON EVERY RENDER. A promotion's badge is a function
		* of the clock (an off-peak window opens and closes; a campaign expires).
		* Resolving it once at fetch time and holding it would leave "闲时 5 折" on the
		* picker the next morning — the exact overstatement `src/promo.ts` refuses to
		* make. The snapshot is fetched once and the BADGE is resolved at render time;
		* a shared one-minute ticker re-renders the mounted labels, so a window edge is
		* picked up without one timer per model row.
		*
		* WHY THE HOST STILL OWNS THE NAME. The contract says to keep `model.name` as
		* the text and render the addition beside it, so this component returns the name
		* first — it never replaces it — and it renders nothing extra for a provider
		* that is not ours.
		*
		* @module dsh-connect-trae/client/TraeModelLabel
		*/
		/** How long a fetched snapshot is trusted, in milliseconds. */
		const CACHE_MS = 6e4;
		/** How often a mounted label re-reads the clock, in milliseconds. */
		const TICK_MS = 6e4;
		/** The snapshot per panel, plus when it was read. */
		const caches = /* @__PURE__ */ new Map();
		/**
		* The snapshot, read from the Host once and reused briefly.
		*
		* `undefined` means "not known" — the caller renders the plain name rather than
		* guessing, because a badge that claims a promotion the upstream never stated
		* is worse than no badge.
		*/
		async function statusNow(panel) {
			const cached = caches.get(panel);
			if (cached !== void 0 && Date.now() - cached.at < CACHE_MS) return cached.snapshot;
			try {
				const response = await fetch(withTraeRegionFastDetail(TRAE_USAGE_PATH, panel), {
					headers: { accept: "application/json" },
					credentials: "same-origin"
				});
				if (!response.ok) return void 0;
				const body = await response.json();
				const models = /* @__PURE__ */ new Map();
				for (const model of body.models ?? []) models.set(model.id, model);
				const snapshot = { models };
				caches.set(panel, {
					snapshot,
					at: Date.now()
				});
				return snapshot;
			} catch {
				return;
			}
		}
		/** One shared minute ticker, so N mounted labels cost one timer, not N. */
		const minuteTicker = {
			timer: void 0,
			listeners: /* @__PURE__ */ new Set()
		};
		/**
		* Re-render the caller once a minute while it is mounted.
		*
		* @param listener - The callback to run at each tick.
		* @returns The unsubscribe function, which stops the shared timer when the last
		*          listener leaves.
		*/
		function subscribeMinute(listener) {
			minuteTicker.listeners.add(listener);
			if (minuteTicker.timer === void 0) {
				minuteTicker.timer = setInterval(() => {
					for (const each of [...minuteTicker.listeners]) each();
				}, TICK_MS);
				minuteTicker.timer.unref?.();
			}
			return () => {
				minuteTicker.listeners.delete(listener);
				if (minuteTicker.listeners.size === 0 && minuteTicker.timer !== void 0) {
					clearInterval(minuteTicker.timer);
					minuteTicker.timer = void 0;
				}
			};
		}
		/**
		* The UI's language, as the browser reports it.
		*
		* The card formats dates and numbers with the browser's locale, so reading the
		* same signal here keeps the badge in the language the user reads. Read
		* defensively: this module is imported by tests that run in a plain Node
		* environment, where neither global exists.
		*/
		function uiLanguage() {
			if (typeof navigator !== "undefined" && typeof navigator.language === "string" && navigator.language !== "") return navigator.language;
			if (typeof document !== "undefined" && typeof document.documentElement?.lang === "string") return document.documentElement.lang;
			return "";
		}
		/** Whether the given language is an English one. */
		function isEnglish(language) {
			return language.toLowerCase().startsWith("en");
		}
		/** The copy table for one language, so the slot needs no injected `t`. */
		function copyFor(language) {
			return isEnglish(language) ? en : zh;
		}
		/**
		* Fill `{name}` placeholders in one locale string.
		*
		* The card's own `t` does this; the slot cannot use `t` (it is rendered by the
		* host, outside the card's injection), so the same substitution is done here on
		* the same table. Both phrasings are always passed: the zh locale spells a pay
		* ratio as "5 折" and needs `{zhe}`, the en one says "50% off" and needs
		* `{percent}` — each uses the placeholder it names, the other is ignored.
		*/
		function fillPlaceholders(template, vars) {
			return template.replace(/\{(\w+)\}/g, (whole, key) => vars[key] ?? whole);
		}
		/** Pay ratio as the "折" figure a Chinese price tag uses: 50 → "5", 25 → "2.5". */
		function promoZhe(discountPercent) {
			const zhe = Math.round(discountPercent * 10) / 100;
			return Number.isInteger(zhe) ? String(zhe) : zhe.toFixed(1);
		}
		/** The locale key that names each promotion kind. */
		const PROMO_LABELS = {
			limited: "row.promoLimited",
			subsidy: "row.promoSubsidy",
			offPeak: "row.promoOffPeak"
		};
		/**
		* The chip's colour per kind, mirroring `.dsm-trae-model-promo-*` in
		* `styles.ts`.
		*
		* Written inline because a slot component is rendered OUTSIDE the card: the
		* card's stylesheet is only mounted while the card is, so a picker opened on a
		* page where the card was never opened would otherwise get an uncoloured chip.
		* The tokens are the same ones the stylesheet uses, with the same fallbacks.
		*/
		const PROMO_TONES = {
			subsidy: {
				color: "var(--dsw-alias-state-error-primary,#d92d20)",
				border: "color-mix(in srgb,var(--dsw-alias-state-error-primary,#d92d20) 40%,transparent)",
				background: "color-mix(in srgb,var(--dsw-alias-state-error-primary,#d92d20) 10%,transparent)"
			},
			limited: {
				color: "var(--dsw-alias-state-warn-primary,#f59e0b)",
				border: "color-mix(in srgb,var(--dsw-alias-state-warn-primary,#f59e0b) 45%,transparent)",
				background: "color-mix(in srgb,var(--dsw-alias-state-warn-primary,#f59e0b) 12%,transparent)"
			},
			offPeak: {
				color: "var(--dsw-alias-brand-primary,#5686fe)",
				border: "color-mix(in srgb,var(--dsw-alias-brand-primary,#5686fe) 40%,transparent)",
				background: "color-mix(in srgb,var(--dsw-alias-brand-primary,#5686fe) 10%,transparent)"
			}
		};
		/**
		* Split the host's display name into "name" and "the multiplier to show".
		*
		* `traeModelDisplayName` builds `"<name> · x<multiplier>"` and the host renders
		* that string verbatim, so appending another rate next to it would print the
		* figure twice in the picker (`Kimi-K2 · x0.55 · x0.55`). The suffix is
		* therefore pulled back OUT of the string and re-drawn in the span that can
		* carry the discounted value — exactly one number, and it is the one that holds
		* right now.
		*
		* The suffix is recognised by SHAPE, not by comparing against the snapshot's
		* `creditMultiplier`: the two can disagree (a promotion can change the catalog
		* figure between the snapshot and this render), and leaving the suffix in place
		* then prints two numbers again — the very defect this function removes.
		*
		* @param name - The host's rendered name, possibly ending in ` · x<rate>`.
		* @param catalogRate - The catalog multiplier, as the snapshot reports it.
		* @param discounted - The rate to show instead, when a discount is running.
		* @returns The name without its rate suffix, and the single rate to draw.
		*          `undefined` means "draw no number" (the name had none and no discount
		*          is running).
		*/
		function splitCatalogRate(name, catalogRate, discounted) {
			const match = / · x(\d+(?:\.\d+)?)$/.exec(name);
			const fromName = match === null ? void 0 : Number(match[1]);
			return {
				base: match === null ? name : name.slice(0, match.index),
				rate: discounted ?? fromName ?? catalogRate
			};
		}
		/** The rate a live badge says the user pays, when it names one. */
		function discountedRateOf(badge) {
			return badge?.rate;
		}
		/**
		* The upstream's promotion chip, as the picker draws it.
		*
		* Same classes as the card's capsule so the two surfaces cannot drift apart,
		* plus the inline tone described in {@link PROMO_TONES}.
		*
		* @param props - The resolved badge and the copy table for the UI's language.
		* @returns The chip.
		*/
		function PromoChip(props) {
			const { badge, copy } = props;
			const zhe = promoZhe(badge.discountPercent);
			const label = fillPlaceholders(copy[PROMO_LABELS[badge.kind]], {
				zhe,
				percent: String(badge.percentOff)
			});
			const hints = [];
			if (badge.beforeRate !== void 0 && badge.rate !== void 0) hints.push(fillPlaceholders(copy["row.promoHintRate"], {
				before: String(badge.beforeRate),
				rate: String(badge.rate)
			}));
			if (badge.fromClock !== void 0 && badge.untilClock !== void 0 && badge.timeZone !== void 0) hints.push(fillPlaceholders(copy["row.promoHintWindow"], {
				from: badge.fromClock,
				until: badge.untilClock,
				zone: badge.timeZone
			}));
			if (badge.memberDiscountPercent !== void 0 && badge.memberRate !== void 0) hints.push(fillPlaceholders(copy["row.promoHintMember"], {
				rate: String(badge.memberRate),
				zhe: promoZhe(badge.memberDiscountPercent),
				percent: String(100 - badge.memberDiscountPercent)
			}));
			const tone = PROMO_TONES[badge.kind];
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: `dsm-trae-model-promo dsm-trae-model-promo-${badge.kind} dsm-trae-model-label-promo`,
				title: hints.length === 0 ? label : hints.join(" · "),
				style: {
					flex: "none",
					borderRadius: "999px",
					padding: "1px 7px",
					fontSize: "10px",
					fontWeight: 500,
					lineHeight: "15px",
					whiteSpace: "nowrap",
					border: `1px solid ${tone.border}`,
					color: tone.color,
					background: tone.background,
					maxWidth: "6em",
					overflow: "hidden",
					textOverflow: "ellipsis"
				},
				children: label
			});
		}
		/**
		* The label for one model row in the host's picker.
		*
		* @param props - The host's model identity and the placement of this label.
		* @returns The catalog name, followed by the promotion chip when one holds.
		*/
		function TraeModelLabel(props) {
			const { provider, model } = props;
			const panel = panelOfProvider(provider.id);
			if (panel === void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: model.name });
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TraeModelLabelInner, {
				modelId: model.id,
				name: model.name,
				panel
			});
		}
		/** The stateful half: fetches the snapshot, then renders what holds right now. */
		function TraeModelLabelInner(props) {
			const { modelId, name, panel } = props;
			const [snapshot, setSnapshot] = (0, react.useState)(void 0);
			const [, setTick] = (0, react.useState)(0);
			(0, react.useEffect)(() => {
				let live = true;
				statusNow(panel).then((next) => {
					if (!live || next === void 0) return;
					setSnapshot(next);
				});
				return () => {
					live = false;
				};
			}, [modelId, panel]);
			(0, react.useEffect)(() => subscribeMinute(() => setTick((count) => count + 1)), []);
			const model = snapshot?.models.get(modelId);
			const badge = model === void 0 ? void 0 : selectTraePromoBadge(model.activityDiscount, /* @__PURE__ */ new Date());
			const { base, rate } = splitCatalogRate(name, model?.creditMultiplier, discountedRateOf(badge));
			const copy = copyFor(uiLanguage());
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				className: "dsm-trae-model-label",
				style: {
					display: "inline-flex",
					alignItems: "center",
					gap: "5px",
					whiteSpace: "nowrap",
					verticalAlign: "baseline"
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: base }),
					rate === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: "dsm-trae-model-label-rate",
						children: [" · x", rate.toFixed(2)]
					}),
					badge === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PromoChip, {
						badge,
						copy
					})
				]
			});
		}
		//#endregion
		//#region src/client/index.tsx
		/** Stable browser-plugin name. */
		const name = "dsh-connect-trae-client";
		/**
		* Client services required by the Plugin configuration contribution.
		*
		* Deliberately only the two services the 0.1.7 line provides unconditionally:
		* `slots` (card injection) and `locale` (copy). The settings surface is probed
		* through `ctx.get()` (which returns undefined, never throws, for an absent
		* service), so the card degrades to read-only rather than failing to load if
		* configForms is not served yet.
		*/
		const inject = ["slots", "locale"];
		/**
		* Register card copy and the Trae card under Plugin configuration.
		*
		* The entire body is wrapped so that a DSH slot-API breaking change (for
		* example the rc.6→rc.7 `id`→`key` / `order`→`priority` rename) degrades
		* to a `console.error` instead of throwing into the DSH loader and raising
		* the red "Failed to load plugins" banner. The host provider keeps working:
		* the `trae` model channel is unaffected.
		*
		* NOTE: the try/catch boundary of this function is mirrored (duplicated) in
		* `tests/client-fallback.spec.ts`, because the real client entry imports
		* browser-only DSH packages that cannot load in the Node test environment.
		* If you change the guarded body, the soft probe, or the per-slot
		* registration here, update that mirror too.
		*/
		function apply(ctx) {
			try {
				const namespace = "settings.trae";
				ctx.effect(() => ctx.locale.register(namespace, {
					zh,
					en
				}), "dsh-connect-trae: settings copy");
				const t = ctx.locale.bind(namespace);
				const softGet = (name) => ctx.get(name);
				const forms = softGet("configForms");
				/**
				* The card's settings scope, bound to whichever namespace the Host actually
				* serves — resolved from the describe mirror, and RE-BOUND whenever the
				* mirror changes.
				*
				* The mirror answers asynchronously relative to this plugin's `apply()`
				* (and, on a profile reload, may gain namespaces that did not exist at
				* boot — this plugin's entry is exactly such a case). Resolving the
				* namespace ONCE at apply time and falling back to the declared constant
				* is a real failure: the form controller is bound to its namespace forever,
				* so a card whose entry appeared after the mirror's first load writes to
				* `trae` — a namespace the host does not serve — and every write is
				* refused (`No configurable plugin entry "trae"`), while the controls stay
				* enabled (the mirror reports global `writable` even when the namespace is
				* missing).
				*
				* The scope therefore forwards every read/write to the CURRENT controller:
				* once the mirror lists the trae namespace (any name matching `/trae/i`,
				* e.g. `dsh-connect-trae` or `include:dsh-connect-trae`), the card lands on
				* the right namespace and re-renders through its own subscription. Before
				* the mirror answers, the scope reports `writable: false` so the card is
				* read-only rather than offering controls that cannot save.
				*/
				const settingsScope = (() => {
					let current;
					let currentOff;
					let refreshedOnce = false;
					const listeners = /* @__PURE__ */ new Set();
					const notify = () => {
						for (const listener of [...listeners]) listener();
					};
					const scope = {
						getSnapshot: () => current?.getSnapshot() ?? {
							status: "unavailable",
							value: void 0,
							writable: false
						},
						subscribe: (listener) => {
							listeners.add(listener);
							return () => {
								listeners.delete(listener);
							};
						},
						set: (field, value) => current !== void 0 ? current.set(field, value) : Promise.resolve(false)
					};
					const rebind = () => {
						let served;
						try {
							served = (forms?.describe().getSnapshot().view?.namespaces ?? []).find((entry) => entry.ns === "trae" || /trae/i.test(entry.ns));
						} catch {}
						const next = served === void 0 || forms === void 0 ? void 0 : forms.get(served.ns);
						if (next !== current) {
							currentOff?.();
							current = next;
							currentOff = current?.subscribe(notify);
							notify();
						}
						if (next === void 0 && !refreshedOnce) {
							refreshedOnce = true;
							try {
								(forms?.describe()).load?.();
							} catch {}
						}
					};
					rebind();
					forms?.describe().subscribe?.(rebind);
					return scope;
				})();
				const registerCard = (slotName, key) => {
					try {
						ctx.slots.inject(slotName, () => ctx.slots.register({
							name: slotName,
							key,
							priority: 30,
							inject: () => ({
								t,
								settingsScope
							})
						}, TraeUsageCard));
					} catch (error) {
						console.error(`[dsh-connect-trae] card slot "${slotName}" failed to register (host provider unaffected):`, error);
					}
				};
				registerCard("plugins.bundle.config", "dsh-connect-trae");
				registerCard("plugins.row.config", "dsh-connect-trae#dsh-connect-trae");
				/**
				* Credit readout in the composer row (`conversation.input.right`, a
				* session-scope list slot rendered immediately before the model picker).
				*
				* Provider-scoped on purpose: it renders only while the session's selected
				* model belongs to this plugin. That is what keeps two connector plugins
				* from competing for one shared row — the sidebar foot, where this line used
				* to live, is a single root row, and the observed result beside
				* dsh-connect-workbuddy's two rows was this plugin's line squeezed down to a
				* clipped "Tr".
				*
				* Registration is unconditional; the gate reads the Host's modelSelection
				* projection and returns null for every other provider, so nothing is drawn
				* and no fetch loop starts while another provider is selected.
				*
				* THE SAME READOUT IS REGISTERED IN TWO SEATS (learned from workbuddy issue
				* #62), and BOTH registrations are unconditional too. Which one actually
				* draws is decided inside the gate by the per-region `creditPosition`
				* setting, so changing the setting is a settings write rather than a slot
				* re-registration — this file's own header records how fragile rebinding a
				* slot is across DSH lines (the rc.6→rc.7 `id`/`order` → `key`/`priority`
				* rename). The composer row is a LIST seat shared with every other bundle,
				* so a third party parking something there can crowd this readout out of
				* existence; the second seat is what keeps one plugin's presence from
				* deciding another's.
				*/
				const registerPointsSlot = (slotName, id, order, position) => {
					try {
						ctx.slots.inject(slotName, () => ctx.slots.register({
							name: slotName,
							id,
							order,
							locale: namespace,
							inject: () => ({
								t,
								settingsScope,
								position
							})
						}, ComposerPointsGate));
					} catch (error) {
						console.error(`[dsh-connect-trae] points slot "${slotName}" failed to register (host provider unaffected):`, error);
					}
				};
				registerPointsSlot("conversation.input.right", "dsh-connect-trae-composer-points", 4, "composer");
				registerPointsSlot("conversation.composer.dock", "dsh-connect-trae-stats-points", 10, "stats");
				/**
				* The upstream's activity badge in the HOST's model picker (ported from the
				* sibling `dsh-connect-workbuddy` plugin, whose #120 shipped the same fix).
				*
				* The picker renders the model name as a plain string, so a provider can
				* only put a CHARACTER there — and a character's colour is the emoji font's
				* business, not ours. The host therefore offers exactly one seam for this:
				* the `conversation.input.model.label` slot, whose contract is "render
				* non-interactive inline content such as a coloured name or badge" while the
				* picker keeps owning clicks, focus and check marks.
				*
				* Registered unconditionally: the component renders the plain name for a
				* provider that is not ours, so there is nothing to gate on. Its own
				* try/catch keeps a host that does not serve this slot from taking the card
				* down with it.
				*/
				const registerModelLabel = () => {
					try {
						return ctx.slots.inject("conversation.input.model.label", () => ctx.slots.register({ name: "conversation.input.model.label" }, TraeModelLabel));
					} catch (error) {
						console.error("[dsh-connect-trae] model label slot failed to register (host provider unaffected):", error);
					}
				};
				registerModelLabel();
			} catch (error) {
				console.error("[dsh-connect-trae] client card failed to load (host provider unaffected):", error);
			}
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	}
});
