import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;

if (!url || !key) {
  console.warn("SUPABASE_URL or SUPABASE_SERVICE_KEY not set — falling back to in-memory store");
}

export const supabase = url && key ? createClient(url, key) : null;
