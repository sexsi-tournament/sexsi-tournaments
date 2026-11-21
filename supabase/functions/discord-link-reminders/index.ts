import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BOT_TOKEN = Deno.env.get("DISCORD_BOT_TOKEN")!;
const DISCOVERY_CHANNEL_ID = "1572861480586444830";
const SITE_PROFILE_URL = "https://sexsi-tournament.github.io/sexsi-tournaments/profile.html#discordLinkCard";
const ALLOWED_ORIGIN = "https://sexsi-tournament.github.io";

const headers = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Vary": "Origin",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

async function discordRequest(path: string, init: RequestInit = {}) {
  return await fetch("https://discord.com/api/v10" + path, {
    ...init,
    headers: {
      Authorization: "Bot " + BOT_TOKEN,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
    },
  });
}

async function getGuildId() {
  const channelResponse = await discordRequest("/channels/" + DISCOVERY_CHANNEL_ID);
  const channel = await channelResponse.json().catch(() => ({}));
  if (!channelResponse.ok || !channel.guild_id) {
    throw new Error("Ботът не успя да открие Discord сървъра през съществуващия канал.");
  }
  return String(channel.guild_id);
}

async function getGuildMembers(guildId: string) {
  const all: any[] = [];
  let after = "0";
  for (let page = 0; page < 100; page++) {
    const response = await discordRequest("/guilds/" + guildId + "/members?limit=1000&after=" + after);
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !Array.isArray(data)) {
      const detail = typeof data?.message === "string" ? data.message : "";
      if (response.status === 403 || data?.code === 50001 || data?.code === 50013) {
        throw new Error("Ботът няма достъп до списъка с членове. Провери разрешението Server Members Intent (GUILD_MEMBERS) в Discord Developer Portal и правата на бота.");
      }
      throw new Error("Discord не върна списъка с членове (HTTP " + response.status + "). " + detail);
    }
    all.push(...data);
    if (data.length < 1000) return all;
    after = String(data[data.length - 1]?.user?.id || "");
    if (!/^\d{15,22}$/.test(after)) return all;
  }
  throw new Error("Списъкът с членове е прекалено голям за едно зареждане. Използвай филтър или разделяне на страниците.");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if ((req.headers.get("origin") || "") !== ALLOWED_ORIGIN) return json({ error: "Origin not allowed" }, 403);
  if (!BOT_TOKEN) return json({ error: "DISCORD_BOT_TOKEN не е конфигуриран." }, 500);

  const authorization = req.headers.get("Authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return json({ error: "Влез в администраторския профил отново." }, 401);

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: "Bearer " + token } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser(token);
  if (authError || !authData.user) return json({ error: "Сесията е невалидна. Влез отново." }, 401);
  const { data: permitted, error: permissionError } = await userClient.rpc(
    "sexsi_has_admin_permission", { p_permission: "view_discord" }
  );
  if (permissionError || permitted !== true) return json({ error: "Нямаш достъп до управлението на Discord акаунтите." }, 403);

  const db = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const body = await req.json().catch(() => ({}));
  const action = String(body?.action || "list");

  try {
    const guildId = await getGuildId();

    if (action === "list") {
      const members = await getGuildMembers(guildId);
      const linkedIds = new Set<string>();
      let from = 0;
      while (true) {
        const { data, error } = await db.from("profiles")
          .select("discord_user_id")
          .not("discord_user_id", "is", null)
          .neq("discord_user_id", "")
          .range(from, from + 999);
        if (error) throw new Error("Не успях да прочета свързаните профили от базата данни.");
        for (const row of data || []) if (row.discord_user_id) linkedIds.add(String(row.discord_user_id));
        if (!data || data.length < 1000) break;
        from += 1000;
      }

      const { data: reminders, error: reminderError } = await db.from("discord_link_reminders")
        .select("discord_user_id,status,last_attempt_at,sent_at,last_error");
      if (reminderError) throw new Error("Не успях да прочета историята на поканите.");

      const reminderMap = new Map((reminders || []).map((r: any) => [String(r.discord_user_id), r]));
      const unlinked = members
        .filter((m: any) => m?.user?.id && !m.user.bot && !linkedIds.has(String(m.user.id)))
        .map((m: any) => {
          const id = String(m.user.id);
          const reminder: any = reminderMap.get(id);
          const lastAttempt = reminder?.last_attempt_at ? new Date(reminder.last_attempt_at).getTime() : 0;
          const sentAt = reminder?.sent_at ? new Date(reminder.sent_at).getTime() : 0;
          const cooldownUntil = reminder?.status === "sending"
            ? lastAttempt + 60_000
            : sentAt > 0
              ? sentAt + 24 * 60 * 60 * 1000
              : reminder?.status === "failed"
                ? lastAttempt + 60_000
                : 0;
          return {
            discord_user_id: id,
            username: String(m.nick || m.user.global_name || m.user.username || "Discord потребител"),
            status: reminder?.status || "not_invited",
            sent_at: reminder?.sent_at || null,
            last_attempt_at: reminder?.last_attempt_at || null,
            last_error: reminder?.last_error || null,
            cooldown_until: cooldownUntil > Date.now() ? new Date(cooldownUntil).toISOString() : null,
          };
        })
        .sort((a: any, b: any) => a.username.localeCompare(b.username, "bg"));
      return json({ success: true, guild_id: guildId, member_count: members.length, unlinked_count: unlinked.length, users: unlinked });
    }

    if (action === "send") {
      const discordUserId = String(body?.discord_user_id || "");
      if (!/^\d{15,22}$/.test(discordUserId)) return json({ error: "Невалиден Discord потребител." }, 400);

      const memberResponse = await discordRequest("/guilds/" + guildId + "/members/" + discordUserId);
      const member = await memberResponse.json().catch(() => ({}));
      if (!memberResponse.ok || !member?.user?.id || member.user.bot) return json({ error: "Потребителят не е намерен като член на Discord сървъра." }, 404);

      const { data: linkedProfile, error: linkedError } = await db.from("profiles")
        .select("id").eq("discord_user_id", discordUserId).maybeSingle();
      if (linkedError) throw new Error("Не успях да проверя дали Discord акаунтът вече е свързан.");
      if (linkedProfile) return json({ error: "Този Discord акаунт вече е свързан със SEXSI профил." }, 409);

      const username = String(member.nick || member.user.global_name || member.user.username || "Discord потребител");
      const { data: reserved, error: reserveError } = await db.rpc("sexsi_reserve_discord_link_reminder", {
        p_discord_user_id: discordUserId,
        p_discord_username: username,
        p_actor: authData.user.id,
      });
      if (reserveError) throw new Error("Не успях да запазя поканата в системата.");
      if (reserved !== true) return json({ error: "Вече е изпратена покана през последните 24 часа или има активна заявка. Изчакай преди нов опит." }, 429);

      let dmChannel: any = {};
      let message: any = {};
      try {
        const dmResponse = await discordRequest("/users/@me/channels", {
          method: "POST", body: JSON.stringify({ recipient_id: discordUserId }),
        });
        dmChannel = await dmResponse.json().catch(() => ({}));
        if (!dmResponse.ok || !dmChannel.id) {
          throw new Error(dmResponse.status === 403
            ? "Discord не позволява лично съобщение до този потребител. Вероятно е ограничил личните съобщения от членове на сървъра."
            : "Discord не успя да отвори личен разговор (HTTP " + dmResponse.status + ").");
        }

        const messageResponse = await discordRequest("/channels/" + dmChannel.id + "/messages", {
          method: "POST",
          body: JSON.stringify({
            embeds: [{
              title: "🔗 СВЪРЖИ DISCORD АКАУНТА СИ",
              description: "Здравей! Забелязахме, че Discord профилът ти все още не е свързан със SEXSI TOURNAMENTS. Свържи го, за да използваш пълноценно турнирните функции и да бъде разпознат профилът ти.",
              color: 15562829,
              footer: { text: "SEXSI TOURNAMENTS · Официално съобщение" },
            }],
            components: [{
              type: 1,
              components: [{ type: 2, style: 5, label: "ОТВОРИ ПРОФИЛА И СВЪРЖИ", url: SITE_PROFILE_URL }],
            }],
            allowed_mentions: { parse: [] },
          }),
        });
        message = await messageResponse.json().catch(() => ({}));
        if (!messageResponse.ok || !message.id) {
          throw new Error("Discord не успя да изпрати лично съобщение (HTTP " + messageResponse.status + ").");
        }
      } catch (sendError) {
        await db.from("discord_link_reminders").update({
          status: "failed", sent_at: null, last_error: String(sendError).slice(0, 500), updated_at: new Date().toISOString(),
        }).eq("discord_user_id", discordUserId);
        throw sendError;
      }

      const { error: saveError } = await db.from("discord_link_reminders").update({
        status: "sent", sent_at: new Date().toISOString(), discord_message_id: String(message.id),
        last_error: null, updated_at: new Date().toISOString(),
      }).eq("discord_user_id", discordUserId);
      if (saveError) console.error("Reminder sent but status update failed:", saveError);

      return json({ success: true, username, sent_at: new Date().toISOString(), message: "Поканата е изпратена успешно на лично съобщение в Discord." });
    }

    return json({ error: "Непознато действие." }, 400);
  } catch (error) {
    console.error("discord-link-reminders:", error);
    return json({ error: error instanceof Error ? error.message : "Възникна неочаквана грешка." }, 500);
  }
});
