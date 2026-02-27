import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

config({ path: ".env.local" });

const databaseUrl = env("DATABASE_URL");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    url: databaseUrl,
    // Bypass PgBouncer for CLI operations (migrations, introspection).
    // Neon pooler URLs contain "-pooler" — strip it to get the direct endpoint.
    // For non-pooler URLs this is a no-op (directUrl === url).
    directUrl: databaseUrl.replace(/-pooler/g, ""),
  },
});
