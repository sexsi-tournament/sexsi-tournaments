import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ADMIN_ID = "13f1ada8-cd05-4c31-8940-4fb1790cb90e";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const jsonHeaders = {
    ...corsHeaders,
    "Content-Type": "application/json",
  };

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: jsonHeaders,
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      throw new Error("Липсва конфигурация на Supabase функцията.");
    }

    const token = authorization.slice("Bearer ".length);
    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: { user }, error: userError } = await authClient.auth.getUser(token);

    if (userError || !user || user.id !== ADMIN_ID) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: jsonHeaders,
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let total = 0;
    const perPage = 1000;
    let page = 1;

    while (true) {
      const { data, error } = await adminClient.auth.admin.listUsers({
        page,
        perPage,
      });

      if (error) throw error;

      const users = data.users || [];
      total += users.length;

      if (users.length < perPage) break;
      page += 1;
    }

    return new Response(JSON.stringify({ total }), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch (error) {
    console.error("admin-user-count:", error);
    return new Response(JSON.stringify({
      error: "Неуспешно зареждане на общия брой потребители.",
    }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});
