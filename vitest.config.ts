import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      obsidian: new URL("./test/obsidian-stub.ts", import.meta.url).pathname,
    },
  },
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      reportsDirectory: "coverage",
      include: [
        "src/settings.ts",
        "src/link-neighborhood.ts",
        "src/daily-context.ts",
        "src/graph-canvas.ts",
        "src/canvas-file.ts",
        "src/workspace-graph-view.ts",
      ],
      thresholds: {
        branches: 70,
        functions: 75,
        lines: 80,
        statements: 80,
      },
    },
  },
});
