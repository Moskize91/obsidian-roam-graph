这个仓库是 `obsidian-roam-graph` 的开源项目仓库，对应 <https://github.com/moskize91/obsidian-roam-graph>。

项目主体是一个 Obsidian 插件。它监听当前焦点 Markdown 笔记，用 Obsidian 的链接 metadata 生成一个 `.canvas` 文件，并把这个 Canvas 打开在右侧边栏中，形成随焦点移动的本地图谱。

# 现状总览

- 当前只有一个发布面：Obsidian community plugin。没有 CLI，不要引入参考项目中的 CLI、子进程、vault discovery 或全局安装流程。
- 插件入口是 `src/plugin/main.ts`，纯逻辑放在 `src/lib/`。
- `src/lib/graph.ts` 负责从 Obsidian metadata cache 解析 outgoing links 和 backlinks。
- `src/lib/canvas.ts` 负责生成 Obsidian Canvas JSON。
- 构建产物不作为源码维护：plugin release staging 输出到 `plugin-dist/`。
- 开发安装使用 `npm run install:plugin`，它会把 `plugin-dist/` 复制到 `.env.local` 中 `OBSIDIAN_DEV_VAULT` 指向的 vault。

# 文档原则

- 文档入口是 AI 路由表。它的职责不是摘要下层文档，而是用问题域和触发条件把 AI 路由到合适的文档。
- 这个原则适用于整个仓库的所有文档。上层文档负责路由，下层文档负责展开；文档之间应通过引用组织信息，而不是重复彼此内容。
- 所有文档都应保持简洁，只写和业务有关、AI 不会天然知道的信息；不要为了阅读体验补写常识，也不要把细节不断堆回入口文档。

# AI 路由表

- `docs/ARCHITECTURE.md`: 涉及项目整体结构、Obsidian Canvas 生成、焦点笔记监听、构建产物或运行边界时，阅读此文。
- `docs/PULL_REQUEST_WORKFLOW.md`: 进行 Git 操作或 GitHub 相关操作，如提交代码、推分支、提 PR、检查 PR 状态前阅读此文。
- `README.md`: 涉及用户安装、开发构建入口、插件行为概述或公开说明时，阅读此文。
