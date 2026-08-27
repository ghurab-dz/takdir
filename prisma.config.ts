// Prisma CLI config: the Neon CLI manages .env.local (via `neon env pull`),
// so load it here — Prisma's CLI only reads .env by default.
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

loadEnv({ path: ".env" }); // base values (e.g. GEMINI_API_KEY placeholder)
loadEnv({ path: ".env.local", override: true }); // Neon-managed, takes precedence

export default defineConfig({
  schema: "prisma/schema.prisma",
});
