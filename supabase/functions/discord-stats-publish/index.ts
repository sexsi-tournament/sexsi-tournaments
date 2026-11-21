import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BOT_TOKEN = Deno.env.get("DISCORD_BOT_TOKEN")!;
const DISCOVERY_CHANNEL_ID = "1572861480586444830";
const headers = {
  "Access-Control-Allow-Origin": "https://sexsi-tournament.github.io",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const origin = req.headers.get("origin") || "";
  if (origin !== "https://sexsi-tournament.github.io") return json({ error: "Origin not allowed" }, 403);

  const authorization = req.headers.get("Authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return json({ error: "Влез в администраторския профил отново." }, 401);

  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: "Bearer " + token } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await userClient.auth.getUser(token);
  const { data: permitted, error: permissionError } = await userClient.rpc("sexsi_has_admin_permission", { p_permission: "publish_discord" });
  if (authError || !authData.user || permissionError || permitted !== true) return json({ error: "Нямаш администраторски достъп." }, 403);
  if (!BOT_TOKEN) return json({ error: "DISCORD_BOT_TOKEN не е конфигуриран." }, 500);

  const db = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const { count: total, error: totalError } = await db.from("profiles").select("id", { count: "exact", head: true });
  const { count: connected, error: connectedError } = await db.from("profiles")
    .select("id", { count: "exact", head: true }).not("discord_user_id", "is", null).neq("discord_user_id", "");
  if (totalError || connectedError) { console.error("discord-stats-publish database", totalError, connectedError); return json({ error: "Не успях да заредя статистиката от базата данни.", details: { total: totalError?.message, connected: connectedError?.message } }, 500); }

  const totalCount = total || 0;
  const connectedCount = connected || 0;
  const unlinkedCount = Math.max(0, totalCount - connectedCount);
  const percent = totalCount ? (connectedCount / totalCount * 100).toFixed(1).replace(".", ",") : "0,0";

  const botHeaders = { Authorization: "Bot " + BOT_TOKEN, "Content-Type": "application/json" };
  const discoveryResponse = await fetch("https://discord.com/api/v10/channels/" + DISCOVERY_CHANNEL_ID, {
    headers: { Authorization: "Bot " + BOT_TOKEN }
  });
  const discovery = await discoveryResponse.json().catch(() => ({}));
  console.log("discord-stats-publish discovery", discoveryResponse.status, JSON.stringify(discovery));
  if (!discoveryResponse.ok || !discovery.guild_id) {
    return json({ error: "Ботът не може да достъпи съществуващ Discord канал, за да открие сървъра.", details: discovery }, 502);
  }
  const guildId = String(discovery.guild_id);

  const botUserResponse = await fetch("https://discord.com/api/v10/users/@me", { headers: { Authorization: "Bot " + BOT_TOKEN } });
  const botUser = await botUserResponse.json().catch(() => ({}));
  console.log("discord-stats-publish bot-user", botUserResponse.status, JSON.stringify({id: botUser.id, message: botUser.message, code: botUser.code}));
  if (!botUserResponse.ok || !botUser.id) return json({ error: "Не успях да разпозная Discord бота." }, 502);

  const payload = {
    embeds: [{
      title: "📊 SEXSI DISCORD STATISTICS",
      description: "Официална статистика за свързването на Discord профилите със SEXSI акаунтите.",
      color: 5793266,
      fields: [
        { name: "🟢 СВЪРЗАНИ АКАУНТИ", value: String(connectedCount), inline: true },
        { name: "⚪ НЕСВЪРЗАНИ", value: String(unlinkedCount), inline: true },
        { name: "👥 ОБЩО ПРОФИЛИ", value: String(totalCount), inline: true },
        { name: "📈 ПРОЦЕНТ СВЪРЗАНИ", value: percent + "%", inline: false }
      ],
      footer: { text: "SEXSI TOURNAMENTS · Статистиката се обновява автоматично" },
      timestamp: new Date().toISOString()
    }]
  };

  const { data: config, error: configError } = await db.from("sexsi_discord_stats_config")
    .select("guild_id,channel_id,message_id").eq("id", true).maybeSingle();
  if (configError) return json({ error: "Не успях да прочета настройките на статистическия канал." }, 500);

  let channelId = config?.channel_id as string | undefined;
  let messageId = config?.message_id as string | undefined;
  let created = false;

  if (!channelId) {
    const createPayload = {
      name: "discord-statistics",
      type: 0,
      topic: "Публична статистика за свързаните Discord акаунти в SEXSI TOURNAMENTS.",
      permission_overwrites: [
        { id: guildId, type: 0, deny: "2048", allow: "1024" },
        { id: String(botUser.id), type: 1, deny: "0", allow: "84992" }
      ]
    };
    const createResponse = await fetch("https://discord.com/api/v10/guilds/" + guildId + "/channels", {
      method: "POST", headers: botHeaders, body: JSON.stringify(createPayload)
    });
    const createdChannel = await createResponse.json().catch(() => ({}));
    console.log("discord-stats-publish create-channel", createResponse.status, JSON.stringify(createdChannel));
    if (!createResponse.ok || !createdChannel.id) {
      return json({
        error: createResponse.status === 403
          ? "Ботът няма право Manage Channels. Дай му това разрешение и опитай отново."
          : "Discord не позволи създаването на канала.",
        details: createdChannel
      }, 502);
    }
    channelId = String(createdChannel.id);
    created = true;
  }

  if (!messageId) {
    const postResponse = await fetch("https://discord.com/api/v10/channels/" + channelId + "/messages", {
      method: "POST", headers: botHeaders, body: JSON.stringify(payload)
    });
    const posted = await postResponse.json().catch(() => ({}));
    if (!postResponse.ok || !posted.id) return json({ error: "Каналът е създаден, но публикацията не можа да бъде изпратена.", details: posted }, 502);
    messageId = String(posted.id);
  } else {
    const editResponse = await fetch("https://discord.com/api/v10/channels/" + channelId + "/messages/" + messageId, {
      method: "PATCH", headers: botHeaders, body: JSON.stringify(payload)
    });
    const edited = await editResponse.json().catch(() => ({}));
    if (!editResponse.ok) return json({ error: "Каналът съществува, но статистиката не можа да се обнови.", details: edited }, 502);
  }

  const { error: saveError } = await db.from("sexsi_discord_stats_config").upsert({
    id: true, guild_id: guildId, channel_id: channelId, message_id: messageId, updated_at: new Date().toISOString()
  }, { onConflict: "id" });
  if (saveError) return json({ error: "Статистиката е публикувана, но настройките не можаха да се запазят." }, 500);

  return json({ success: true, created, channel_id: channelId, message_id: messageId, connected: connectedCount, total: totalCount });
});