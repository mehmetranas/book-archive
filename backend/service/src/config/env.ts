import { z } from "zod";

const envSchema = z.object({
  PB_URL: z.string().url(),
  PB_SUPERUSER_EMAIL: z.string().email(),
  PB_SUPERUSER_PASSWORD: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3000),
  GOOGLE_BOOKS_KEY: z.string().min(1),
  TMDB_API_KEY: z.string().min(1),
  SPOTIFY_CLIENT_ID: z.string().min(1),
  SPOTIFY_CLIENT_SECRET: z.string().min(1),
  OPENROUTER_API_KEY: z.string().min(1),
  // Not required until phase D wires up the webhook route, but validated up front so
  // misconfiguration fails at boot instead of silently skipping the signature check.
  RC_WEBHOOK_SECRET: z.string().min(1).optional(),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid environment configuration:");
    console.error(z.prettifyError(parsed.error));
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();
