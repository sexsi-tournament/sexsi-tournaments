
const SUPABASE_URL = "https://fyxlwcoochsuzhqostpe.supabase.co";
const SUPABASE_KEY = "sb_publishable_B_y2VUBIRuOdtN_57EJplQ_e-xoC5YP";

const sexsiSupabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    }
  }
);

window.sexsiSupabase = sexsiSupabase;
