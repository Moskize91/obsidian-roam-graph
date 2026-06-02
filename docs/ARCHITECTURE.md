# 整体结构

这个仓库发布一个 Obsidian 插件：Roam Graph。

Roam Graph 不实现自定义 graph renderer。它复用 Obsidian 原生 Canvas：插件根据当前焦点笔记生成一个 `.canvas` 文件，然后把该文件打开到右侧边栏。Canvas 文件是运行时派生物，会在焦点笔记变化时被重写。

## 源码布局

- `src/main.ts` 是 Obsidian plugin 入口，只负责注册设置页、命令、协议处理器和 workspace 事件。
- `src/refresh-controller.ts` 编排焦点笔记刷新：收集图谱数据、生成 Canvas、写入文件并交给右侧栏打开。
- `src/workspace-graph-view.ts` 处理右侧栏 Canvas leaf 管理和生成图谱 leaf 的导航纠偏。
- `src/canvas-file.ts` 处理生成 Canvas 文件的创建和写入。
- `src/graph-model.ts` 定义插件内部的图谱数据模型。
- `src/link-neighborhood.ts` 从 Obsidian metadata cache 解析 outgoing links 和 backlinks。
- `src/daily-context.ts` 读取 Obsidian Daily Notes 设置并解析邻近日记。
- `src/canvas-types.ts` 定义 Obsidian Canvas JSON 类型。
- `src/graph-canvas.ts` 把图谱数据转换为 Obsidian Canvas JSON。
- `src/settings.ts` 放插件设置类型、默认值和规范化逻辑。
- `src/settings-tab.ts` 放 Obsidian 设置页 UI。
- `manifest.json` 和可选的 `styles.css` 是 plugin 发布输入。
- `scripts/install-plugin-dev.mjs` 是开发安装脚本，负责把 `plugin-dist/` 复制到本地测试 vault。

## 运行关系

插件监听 Obsidian 当前焦点 Markdown 文件。刷新时，`refresh-controller` 从 metadata cache 和 Daily Notes 设置收集邻近笔记，调用 Canvas 生成模块生成 JSON，写入设置指定的 `.canvas` 文件，再用右侧栏 workspace 适配层打开它。

## 构建产物

- Plugin 构建到 `plugin-dist/main.js`。
- `npm run prepare:plugin` 还会暂存 `manifest.json` 和可选 `styles.css`。
- `plugin-dist/` 是构建产物，不是源码维护入口。

## Canvas 边界

当前实现依赖 Obsidian 原生 Canvas 渲染和交互。插件不会接管 Canvas 内部事件，也不会注册自定义 Canvas view。

这带来几个明确边界：

- 生成的 Canvas 不是强制只读。用户可以手动编辑，但下次刷新会覆盖派生内容。
- Canvas 中点击或打开 file node 的行为由 Obsidian 原生 Canvas 决定。
- 若未来要强制只读、拦截双击、或把 Canvas node 打开的目标固定到主编辑区，可能需要使用非公开 Canvas 内部 API 或 DOM hack。

开发入口和公开说明见 `README.md`。
