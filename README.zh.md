# dsh-model-accordion

[English](./README.md) · **简体中文**

> 把 DeepSeek Harness 的模型列表折叠成**每个供应商一行**。
> 点开 `Qoder`，只显示 Qoder 的模型，其他供应商全部收起。

<p align="center">
  <img src="./docs/images/hero.png" alt="展开 Qoder，其余供应商全部收起" width="520">
</p>

供应商十几个、模型几百个的时候，原生选择器就是一条无尽的滚动条。这个插件把每个供应商变成一行：
你只看到供应商名字和模型数量，想看具体模型再点开。

**两处模型列表都生效**：

- 输入框旁边的模型菜单；
- `/model` 斜杠命令弹窗。

---

## 效果

| 全部收起 | 展开一个 | 搜索 |
| --- | --- | --- |
| <img src="./docs/images/all-collapsed.png" alt="全部供应商收起" width="300"> | <img src="./docs/images/trae-expanded.png" alt="展开 Trae" width="300"> | <img src="./docs/images/search.png" alt="搜索 qwen" width="300"> |
| 九个供应商只占 8 行，点哪行开哪个。 | `Trae` 展开 33 个模型，其余保持收起。 | 输入 `qwen`，所有匹配的供应商自动展开。 |

<p align="center">
  <img src="./docs/images/favorites.png" alt="收藏固定在顶部" width="420">
</p>

收藏的模型固定在供应商之上，常用的两三个模型永远一步可达。

<p align="center">
  <img src="./docs/images/stars.png" alt="每行右侧的收藏星标" width="380">
</p>

每个模型行右侧都有一颗星标：点一下即可收藏，不会顺带切换模型，所以一次打开菜单就能把几个常用模型都挑出来。`/model` 弹窗里行更宽，星标同样贴在右侧：

<p align="center">
  <img src="./docs/images/stars-popup.png" alt="/model 弹窗中的收藏星标" width="620">
</p>

---

## 功能

| 功能 | 用法 |
| --- | --- |
| **手风琴** | 点击供应商标题：它展开，其他供应商自动收起。 |
| **全部收起** | 再点一次已展开的供应商，或用工具栏按钮。 |
| **多开** | `Ctrl`/`Cmd` + 点击标题，切换该供应商而不关闭其他。 |
| **全部展开 / 收起** | 搜索行右侧的工具栏按钮。 |
| **记忆状态** | 展开的供应商在关闭菜单、刷新页面后仍然保留。 |
| **星标按钮** | 每行右侧都有星标，点击即收藏，不会切换当前模型。 |
| **收藏** | `Shift`+点击、右键点击或点星标，把模型固定到顶部 `★` 分组；点击收藏行即可选中。 |
| **供应商排序** | 工具栏 `↺` 循环切换：默认顺序 → 名称 A→Z → 模型数量 ↓N。 |
| **标题显示当前模型** | 当前模型所在的供应商显示 `● <模型> · <数量>`。 |
| **固定高度** | 菜单高度保持稳定，不再在 260 px 和 368 px 之间跳动。 |
| **搜索穿透** | 在搜索框输入时所有供应商自动展开，匹配项不会被折叠藏住。 |
| **键盘操作** | `Tab` 到标题，`Enter`/`空格` 切换，`↑`/`↓` 在标题间移动，`→`/`←` 展开/收起。 |
| **中英双语** | 根据页面语言自动切换文案。 |
| **热重载** | 修改 `lib/client.js` 后一两秒内自动在页面里替换。 |

插件只**装饰 DOM**，不重写选择器。模型选择、推理等级切换、供应商加载和 `/model` 命令
仍然由 `@deepseek-ai/dsh-client-ui-model-selection` 负责，所以宿主更新选择逻辑时插件不会失效。

---

## 安装

桌面版 profile 由 Electron 应用独占，`dsh plugin add` 会拒绝写入。用脚本安装：

```sh
git clone https://github.com/lllbjs/dsh-model-accordion.git
cd dsh-model-accordion
./install.sh desktop        # 或：./install.sh "$DSH_PROFILE"
```

脚本会：

1. 把本包软链到 `$DSH_HOME/profiles/<profile>/node_modules/dsh-model-accordion`；
2. 把 `- insert:` 条目追加到 `$DSH_HOME/profiles/<profile>/cordis.patch.yml`
   （先备份，已存在则跳过）。

### 手动安装

```sh
ln -s /path/to/dsh-model-accordion ~/.dsh/profiles/desktop/node_modules/dsh-model-accordion

cat >> ~/.dsh/profiles/desktop/cordis.patch.yml <<'YAML'
- insert:
    - id: dsh-model-accordion
      name: dsh-model-accordion
YAML
```

然后刷新界面。桌面版 profile 会热应用补丁改动，通常无需重启；若菜单没变化，退出并重开应用。

### 卸载

```sh
rm ~/.dsh/profiles/desktop/node_modules/dsh-model-accordion
# 再从 cordis.patch.yml 里删掉那个 `- insert:` 条目
```

---

## 操作

| 操作 | 手势 |
| --- | --- |
| 展开供应商 | 点击标题 |
| 收起已展开的供应商 | 再点一次标题 |
| 同时展开第二个 | `Ctrl`/`Cmd` + 点击 |
| 全部收起 | 工具栏按钮，或点掉唯一展开的那个 |
| 收藏模型 | 点击该行右侧星标，或 `Shift`+点击 / 右键点击该行 |
| 选择模型 | 直接点击（收藏行同样有效） |
| 切换排序 | 工具栏 `↺` |

---

## 存储

所有状态存在界面同源的 `localStorage` 中：

| 键 | 值 |
| --- | --- |
| `dsh-model-accordion:open` | 已展开供应商标题的 JSON 数组 |
| `dsh-model-accordion:all-collapsed` | 主动全部收起时为 `true` |
| `dsh-model-accordion:favorites` | `供应商标题/模型名` 键的 JSON 数组（用的是界面可见文字，因此主菜单与 `/model` 弹窗互通） |
| `dsh-model-accordion:sort` | `default` \| `name` \| `size` |
| `dsh-model-accordion:stable-height` | 设为 `false` 可让菜单按内容自适应高度 |
| `dsh-model-accordion:last-open` | 旧版键，仍会写入以兼容 |

---

## 诊断

插件挂载后，页面控制台可以访问 `window.__dshModelAccordion`：

```js
__dshModelAccordion.version      // "0.4.1"
__dshModelAccordion.rescan()     // 重新扫描 DOM
__dshModelAccordion.state()      // [{ open: [...], groups: [{ label, models, collapsed }] }]
__dshModelAccordion.favorites()  // ["qoder/qmodel_latest", ...]
__dshModelAccordion.sort()       // "default"
```

如果页面上出现了模型列表但没有识别出任何供应商分组，控制台会打印：

```
[dsh-model-accordion] a model list is present but no provider sections were found; the menu markup may have changed
```

说明宿主的菜单结构变了 —— 需要更新 [`lib/client.js`](./lib/client.js) 里的
`ROW_SELECTOR` 和 `[data-menu-group]` 相关假设。

---

## 实现原理

```
lib/client.js   全部功能 —— 浏览器 bundle，包在 window.__ModuleLoader__ 里
lib/index.js    宿主侧 —— 不注册服务，不做任何事
```

1. 在 `document.body` 上挂 `MutationObserver`（`childList`、`subtree`），扫描模型列表：
   任何 `id$="-models"` 且子元素含 `[data-menu-group]` 的节点。
2. 每个供应商分组打上 `data-dsh-acc-collapsed`，收起分组里的行用 CSS 隐藏 ——
   不触发 React 重渲染，也不改虚拟 DOM。
3. 每个容器只绑定一次 click / keydown / input 处理，状态写回 `localStorage`。
4. `/model` 弹窗的结构不同（`div[role="option"]` 行，没有 `data-provider-id`），
   所以 `ROW_SELECTOR` 同时匹配两种形状；弹窗卡片被重排成两列网格，给工具栏腾位置。

---

## 兼容性

- DeepSeek Harness `0.2.1-rc.5` 及以上（在桌面版 bundle 上验证）。
- 无需构建：仓库里的 `lib/client.js` 就是浏览器 bundle。
- 无依赖。

---

## 许可证

MIT
