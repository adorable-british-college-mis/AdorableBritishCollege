import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    fileParallelism: false,
    globalSetup: ["./src/test/global-setup.ts"],
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5433/adorablems_test?schema=public",
      FRONTEND_URL: "http://localhost:5173",
      JWT_ACCESS_SECRET: "test-access-secret-at-least-thirty-two-characters",
      JWT_REFRESH_SECRET: "test-refresh-secret-at-least-thirty-two-characters",
    },
    coverage: { reporter: ["text", "html"] },
  },
});
