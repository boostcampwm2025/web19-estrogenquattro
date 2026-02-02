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
    include: ["test/**/*.spec.ts", "src/**/*.test.{ts,tsx}"],
    environmentMatchGlobs: [
      // React 컴포넌트 테스트는 jsdom 환경 사용
      ["src/**/*.test.{ts,tsx}", "jsdom"],
    ],
  },
});
