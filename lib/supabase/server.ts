import { createClient } from "@supabase/supabase-js";

function getConfig() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url) throw new Error("SUPABASE_URL não configurada.");
  if (!key) throw new Error("SUPABASE_PUBLISHABLE_KEY não configurada.");

  return { url, key };
}

export function getSupabaseServer() {
  const { url, key } = getConfig();
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
