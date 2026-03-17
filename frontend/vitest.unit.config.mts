import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@test": path.resolve(__dirname, "test"),
      "@backend": path.resolve(__dirname, "../backend/src"),
      typeorm: path.resolve(__dirname, "test/mocks/typeorm.ts"),
    },
  },
  esbuild: {
    tsconfigRaw: {
      compilerOptions: {
        experimentalDecorators: true,
      },
    },
  },
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./test/setup.ts", "./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "test/unit/**/*.spec.ts"],
    environmentMatchGlobs: [
      ["src/**/*.test.{ts,tsx}", "jsdom"],
    ],
    coverage: {
      reporter: ["json-summary", "lcov", "text-summary"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "test/**",
        "src/test/**",
        "src/**/*.d.ts",
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
