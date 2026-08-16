import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  outDir: "lib",
  format: ["cjs"],
  target: "node22",
  platform: "node",
  sourcemap: true,
  clean: true,
  dts: false,
  splitting: false,
  treeshake: true,
});
