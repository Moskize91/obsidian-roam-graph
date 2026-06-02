# 整体结构

这个仓库发布一个 Obsidian 插件：Roam Graph。

Roam Graph 不实现自定义 graph renderer。它复用 Obsidian 原生 Canvas：插件根据当前焦点笔记生成一个 `.canvas` 文件，然后把该文件打开到右侧边栏。Canvas 文件是运行时派生物，会在焦点笔记变化时被重写。

## 源码布局

- `src/plugin/main.ts` 是 Obsidian plugin 入口，负责插件设置页、命令、ribbon 按钮、焦点文件监听、Canvas 文件创建和右侧边栏打开。
- `src/lib/plugin-settings.ts` 放插件设置类型、默认值和规范化逻辑。
- `src/lib/graph.ts` 放本地图谱数据解析逻辑。当前实现使用 `app.metadataCache.resolvedLinks` 读取 outgoing links，并反向扫描 backlinks。
- `src/lib/canvas.ts` 放 Canvas JSON 类型和布局生成逻辑。当前布局是 backlinks、中心节点、outgoing links 三列。
- `manifest.json` 和可选的 `styles.css` 是 plugin 发布输入。
- `scripts/install-plugin-dev.mjs` 是开发安装脚本，负责把 `plugin-dist/` 复制到本地测试 vault。

## 构建产物

- Plugin 构建到 `plugin-dist/main.js`。
- `npm run prepare:plugin` 还会暂存 `manifest.json` 和可选 `styles.css`。
- `plugin-dist/` 是构建产物，不是源码维护入口。

构建插件：

```sh
npm run build
```

完整检查：

```sh
npm run check
```

## 运行关系

插件监听 Obsidian 的 `workspace.on("active-leaf-change")`。当焦点切到 Markdown 文件时，插件会 debounce 一次刷新：

1. 读取当前 Markdown 文件路径。
2. 根据设置决定是否包含 outgoing links 和 backlinks。
3. 从 Obsidian metadata cache 中解析邻居。
4. 调用 Canvas 生成器构造 `{ nodes, edges }`。
5. 写入设置中指定的 `.canvas` 文件，默认是 `Roam Graph.canvas`。
6. 使用右侧 leaf 打开该 Canvas 文件，并尽量不抢占主编辑焦点。

Canvas 中的 more 节点使用 `obsidian://roam-graph` 协议触发分批展开。初始骨架为每侧 `neighborLimit` 个邻居加中心节点；每次展开额外显示 `neighborExpandStep` 个邻居。

## Canvas 边界

当前实现依赖 Obsidian 原生 Canvas 渲染和交互。插件不会接管 Canvas 内部事件，也不会注册自定义 Canvas view。

这带来几个明确边界：

- 生成的 Canvas 不是强制只读。用户可以手动编辑，但下次刷新会覆盖派生内容。
- Canvas 中点击或打开 file node 的行为由 Obsidian 原生 Canvas 决定。
- 若未来要强制只读、拦截双击、或把 Canvas node 打开的目标固定到主编辑区，可能需要使用非公开 Canvas 内部 API 或 DOM hack。

## 本地开发

创建 `.env.local`，指向测试 vault：

```sh
OBSIDIAN_DEV_VAULT="/absolute/path/to/vault"
OBSIDIAN_PLUGIN_ID="roam-graph"
```

安装开发版插件：

```sh
npm run install:plugin
```

该命令会构建 `plugin-dist/`，然后复制到：

```text
<OBSIDIAN_DEV_VAULT>/.obsidian/plugins/roam-graph
```
