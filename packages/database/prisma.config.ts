import { defineConfig } from "prisma/config";

// Prisma 7 does not read .env files, and neither does Node. The root .env is loaded here.
// A missing file is fine: in CI the variables come from the environment.
function loadRootEnvFile(): void {
  try {
    process.loadEnvFile(new URL("../../.env", import.meta.url));
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
      throw error;
    }
  }
}

loadRootEnvFile();

// The fallback only lets `prisma validate` and `prisma generate` run without a database.
// Commands that connect (migrate, seed) fail with a connection error if DATABASE_URL is unset.
const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://placeholder:placeholder@localhost:5433/placeholder";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: databaseUrl },
});
