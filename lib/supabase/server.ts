import { createClient } from "@supabase/supabase-js";

function getConfig() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url) throw new Error("SUPABASE_URL não configurada.");
  if (!key) {
    throw new Error(
      "SUPABASE_SECRET_KEY (recomendado) ou SUPABASE_PUBLISHABLE_KEY não configurada."
    );
  }

  return { url, key };
}

export function getSupabaseServer() {
  const { url, key } = getConfig();
  const usesSecretKey =
    key.startsWith("sb_secret_") ||
    key === process.env.SUPABASE_SERVICE_ROLE_KEY;

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    ...(usesSecretKey ? { db: { schema: "public" } } : {}),
  });
}
