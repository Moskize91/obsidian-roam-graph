import { defineConfig } from "tsup";

export default defineConfig({
  clean: true,
  dts: false,
  entry: {
    main: "src/main.ts",
  },
  external: ["obsidian"],
  format: ["cjs"],
  outDir: "plugin-dist",
  sourcemap: true,
  splitting: false,
  target: "node20",
});
