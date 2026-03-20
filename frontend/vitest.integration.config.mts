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
    include: ["test/integration/**/*.spec.ts"],
    coverage: {
      enabled: true,
      provider: "v8",
      reporter: ["text-summary", "json-summary"],
      reportsDirectory: "./coverage/integration/frontend",
      include: [
        "src/stores/**/*.ts",
        "src/lib/api/**/*.ts",
        "src/lib/socket.ts",
        "src/game/managers/SocketManager.ts",
      ],
    },
  },
});
