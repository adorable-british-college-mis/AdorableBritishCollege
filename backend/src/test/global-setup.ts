import { execFileSync } from "node:child_process";
import { join } from "node:path";

const testDatabaseUrl = "postgresql://postgres:postgres@localhost:5433/adorablems_test?schema=public";

export function setup() {
  const prismaCli = join(process.cwd(), "..", "node_modules", "prisma", "build", "index.js");
  const options = {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
    stdio: "pipe",
  } as const;
  execFileSync(process.execPath, [prismaCli, "migrate", "deploy"], options);
  execFileSync(process.execPath, [prismaCli, "db", "seed"], options);
}
