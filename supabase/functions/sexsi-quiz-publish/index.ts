import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BOT_TOKEN = Deno.env.get("DISCORD_BOT_TOKEN")!;
const CHANNEL_ID = "1573215964051279922";
const ORIGIN = "https://sexsi-tournament.github.io";
const cors = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers: cors });

  const authorization = req.headers.get("Authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401, headers: cors });

  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: "Bearer " + token } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  const { data: permitted, error: permissionError } = await authClient.rpc("sexsi_has_admin_permission", { p_permission: "publish_discord" });
  if (authError || !authData.user || permissionError || permitted !== true) {
    return Response.json({ error: "Forbidden" }, { status: 403, headers: cors });
  }

  const db = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: existing, error: readError } = await db
    .from("sexsi_quiz_control_message")
    .select("message_id")
    .eq("channel_id", CHANNEL_ID)
    .maybeSingle();

  if (readError && readError.code !== "PGRST116") {
    console.error("Quiz control lookup failed:", readError);
    return Response.json({ error: "Не успях да проверя публикацията." }, { status: 500, headers: cors });
  }

  const payload = {
    embeds: [{
      title: "🧠 SEXSI QUIZ BATTLE",
      description: "Провери знанията си, събери точки и се изкачи в класацията!\n\n🎯 10 въпроса · ⏱️ 15 секунди на въпрос\n🏆 Точките се натрупват в общата класация.",
      color: 15548997,
      footer: { text: "SEXSI BG COMMUNITY · QUIZ ZONE" }
    }],
    components: [{
      type: 1,
      components: [
        { type: 2, style: 3, label: "СТАРТИРАЙ ИГРА", custom_id: "sexsi_quiz:start" },
        { type: 2, style: 1, label: "КЛАСАЦИЯ", custom_id: "sexsi_quiz:ranking" },
        { type: 2, style: 2, label: "ПРАВИЛА", custom_id: "sexsi_quiz:rules" }
      ]
    }]
  };

  let response: Response;
  if (existing?.message_id) {
    response = await fetch("https://discord.com/api/v10/channels/" + CHANNEL_ID + "/messages/" + existing.message_id, {
      method: "PATCH",
      headers: { Authorization: "Bot " + BOT_TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } else {
    response = await fetch("https://discord.com/api/v10/channels/" + CHANNEL_ID + "/messages", {
      method: "POST",
      headers: { Authorization: "Bot " + BOT_TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  }
  const discordResult = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("Quiz control publish failed:", discordResult);
    return Response.json({ error: "Discord API error", details: discordResult }, { status: 502, headers: cors });
  }

  const messageId = String(discordResult.id || existing?.message_id || "");
  const { error: saveError } = await db.from("sexsi_quiz_control_message").upsert({
    channel_id: CHANNEL_ID, message_id: messageId, updated_at: new Date().toISOString()
  }, { onConflict: "channel_id" });
  if (saveError) {
    console.error("Quiz control message tracking failed:", saveError);
    return Response.json({ success: true, message_id: messageId, warning: "Публикацията е изпратена, но ID-то не е записано." }, { headers: cors });
  }
  return Response.json({ success: true, message_id: messageId, channel_id: CHANNEL_ID, updated: Boolean(existing?.message_id) }, { headers: cors });
});